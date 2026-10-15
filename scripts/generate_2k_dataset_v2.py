#!/usr/bin/env python3
# SYNTHETIC_EBC_SEED_DATA · 2K Courtside v2 player-behaviour simulation (brands are REAL 2K partners)
"""
Generate the 2K Courtside v2 dataset (Spanner twok_graph_db_v2 + BigQuery v2_*)
on top of the v1 dataset in data/*.json. Source of truth: docs/v2/CONTRACT.md §1-2.

The same 6,500 players, 40 creators, crews, identities and offers from v1 are
kept. Everything new is produced by ONE day-level simulation of the 90 days
ending "now" (2026-10-15), so all derived fields are mutually consistent:

    sessions_daily  -> last_active_at, churned_at, session_min_7d/prev_7d
    co-play days    -> PlayedWith.games_together_30d / last_played_at
    co-play weights -> MemberOfClan.crew_centrality, keystones
    watches         -> creator lift, hub_score / community_span
    purchases       -> branded social attach

Planted causal mechanisms (moderate, noisy; validated with 95% CIs by
scripts/validate_dataset_v2.py):
    * churn exposure  : quit hazard x EXPOSURE_MULT while >=1 co-play neighbour
                        played their last session in the previous 14 days
    * anchor dependency: when a crew's top-centrality member leaves, crewmates'
                        hazard rises / session frequency falls (scaled by tie
                        strength to the anchor; some crews barely react)
    * keystone decline: a handful of keystones taper sessions in the last week
    * creator lift    : watching >=20 min of an offer stream changes the 30-day
                        hazard by a creator-specific factor
    * branded attach  : purchase propensity for a brand rises once a co-play
                        neighbour has bought that brand
    * creator hubs    : a few mid-follower creators draw viewers evenly from
                        every community; top creators draw from home communities

Writes data/v2/*.json (+ sessions_daily.ndjson) and data/v2/planted_truth.json.

Usage:
    python3 scripts/generate_2k_dataset_v2.py              # full build (needs data/brands_research.json)
    python3 scripts/generate_2k_dataset_v2.py --skip-brands # everything except brand/item/purchase tables
"""
import argparse
import heapq
import json
import math
import os
import random
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V1_DIR = os.path.join(ROOT, "data")
OUT = os.path.join(ROOT, "data", "v2")
BRANDS_PATH = os.path.join(ROOT, "data", "brands_research.json")

SEED = 12  # validated seed (scripts/validate_dataset_v2.py passes every check at as-of 2026-10-15)
UTC = timezone.utc
N_DAYS = 90
NBA2K27_LAUNCH = datetime(2026, 9, 4, tzinfo=UTC)
NBA2K27_S2 = datetime(2026, 10, 16, tzinfo=UTC)
# The as-of date ("now") is configurable with --as-of; configure() sets these.
NOW = DAY0 = None
LAUNCH_IDX = S2_IDX = None


def configure(as_of):
    """NOW = as_of 12:00Z; the 90-day window is day 0 = as_of-89 .. day 89 = as_of."""
    global NOW, DAY0, LAUNCH_IDX, S2_IDX
    d = datetime.strptime(as_of, "%Y-%m-%d").replace(tzinfo=UTC)
    NOW = d + timedelta(hours=12)
    DAY0 = d - timedelta(days=N_DAYS - 1)
    LAUNCH_IDX = (NBA2K27_LAUNCH - DAY0).days
    S2_IDX = (NBA2K27_S2 - DAY0).days

# ---------------------------------------------------------------------------
# Tuning knobs (validated by scripts/validate_dataset_v2.py)
# ---------------------------------------------------------------------------
K = {
    "CREW_PAIR_TARGET": 33000,
    "GROUP_PAIR_TARGET": 8500,
    "CROSS_PAIR_TARGET": 16500,
    "CORE_SOC": (2.7, 2.8),
    "CORE_PAIR_SHAPE": 12.0,
    "CORE_PAIR_MULT": 3.0,  # core-core pairs co-play ~3x more than core-regular pairs  # low-variance co-play weights inside a crew core (2-3 near-equal keystones per crew)
    "ANCHOR_SOC_MULT": 1.30,
    "BASE_H": 0.0034,  # per-session-day quit hazard scale
    "EXPOSURE_MULT": 1.0,
    "ANCHOR_H": 240.0,  # hazard x (1 + ANCHOR_H * strength * exp(-days_since / ANCHOR_DECAY))
    "ANCHOR_DECAY": 12.0,
    "ANCHOR_P": 0.9,
    "ANCHOR_DAYS": 35,
    "N_ANCHOR_A": 12,  # top member left 29-62 days ago (older anchor-dependency cohort, ~2-3 per week)
    "N_ANCHOR_W": 30,  # top member left 8-28 days ago: weekly baseline of ~8-12 per week (weeks 2-4)
    "N_ANCHOR_B": 18,  # top member left in the last 7 days ("lost a core member this week")
    "N_SPLITS": 10,
    "N_DECLINE": 0,
    "KEYSTONE_SHARE": 0.12,
    "KEYSTONE_MIN_SIGMA": 0.15,
    "CORE_SHIELD": 0.05,  # remaining keystones feel the anchor loss less than the periphery
    "CORE_MIN_SIGMA": 0.26,
    "VIEWERS_PER_STREAM": 72,
    "SOCIAL_KAPPA": 2.0,
    "BUY_RATE": 0.046,
    "UNBRANDED_P": 0.65,  # share of purchases that are unbranded VC sinks / cosmetics
}

# Hazard multiplier applied for 30 days after watching >= 20 min of the creator's stream
# (planted creators feature an offer on ~85% of streams). 5 clearly positive (incl. the
# three mid-follower hub creators), 2 slightly negative, everyone else ~0.
CREATOR_EFFECT = {
    "creator-joeknows": 0.12,
    "creator-coletheman": 0.15,
    "creator-2klab": 0.15,
    "creator-kot4q": 0.10,
    "creator-badgeplug": 0.12,
    "creator-flightreacts": 1.80,
    "creator-grindingdf": 1.60,
}
HUB_CREATORS = ["creator-joeknows", "creator-2klab", "creator-coletheman"]

ARCH_PPLAY = {
    "MYTEAM_PACK_WHALE": 0.66, "PARK_REP_GRINDER": 0.72, "REC_CREW_CAPTAIN": 0.72,
    "MYCAREER_STORY_CASUAL": 0.40, "MYNBA_FRANCHISE_SIM": 0.52, "BUILD_LAB_THEORYCRAFTER": 0.58,
    "THE_W_LOYALIST": 0.50, "CROSS_LABEL_NOMAD": 0.44, "MOBILE_DAILY_RITUALIST": 0.80,
    "RAGE_QUIT_TILT_RISK": 0.50,
}
ARCH_MIN = {
    "MYTEAM_PACK_WHALE": 70, "PARK_REP_GRINDER": 95, "REC_CREW_CAPTAIN": 90,
    "MYCAREER_STORY_CASUAL": 48, "MYNBA_FRANCHISE_SIM": 75, "BUILD_LAB_THEORYCRAFTER": 65,
    "THE_W_LOYALIST": 55, "CROSS_LABEL_NOMAD": 50, "MOBILE_DAILY_RITUALIST": 18,
    "RAGE_QUIT_TILT_RISK": 55,
}
ARCH_SPEND = {
    "MYTEAM_PACK_WHALE": 3.0, "PARK_REP_GRINDER": 1.6, "REC_CREW_CAPTAIN": 1.4,
    "MYCAREER_STORY_CASUAL": 0.8, "MYNBA_FRANCHISE_SIM": 0.5, "BUILD_LAB_THEORYCRAFTER": 1.3,
    "THE_W_LOYALIST": 0.9, "CROSS_LABEL_NOMAD": 1.0, "MOBILE_DAILY_RITUALIST": 0.4,
    "RAGE_QUIT_TILT_RISK": 1.0,
}
NBA_FAMILY = {"NBA2K", "NBA2K26", "NBA2KMOBILE"}

SEASONS = [
    ("season-nba2k26-s5", "game-nba2k26", "NBA 2K26 Season 5", "2026-06-12", "2026-07-24"),
    ("season-nba2k26-s6", "game-nba2k26", "NBA 2K26 Season 6", "2026-07-24", "2026-09-04"),
    ("season-nba2k27-s1", "game-nba2k27", "NBA 2K27 Season 1", "2026-09-04", "2026-10-16"),
    ("season-nba2k27-s2", "game-nba2k27", "NBA 2K27 Season 2", "2026-10-16", "2026-11-27"),
    ("season-nba2k27-s3", "game-nba2k27", "NBA 2K27 Season 3", "2026-11-27", "2027-01-08"),
    ("season-nba2k27-s4", "game-nba2k27", "NBA 2K27 Season 4", "2027-01-08", "2027-02-19"),
]
# Crew-vs-crew matches per day by season (S2 tip-off week runs hot).
SEASON_RATE = {"season-nba2k26-s5": 86, "season-nba2k26-s6": 102, "season-nba2k27-s1": 283,
               "season-nba2k27-s2": 300, "season-nba2k27-s3": 240, "season-nba2k27-s4": 220}

# ---------------------------------------------------------------------------
# Real 2K partner brands. Names / categories / partnership text come from
# data/brands_research.json (verified by the orchestrator, with sources); the
# items and activations below use the public item / event names listed in that
# research (generic "<Brand> ..." names only where the research says "generic").
# Dated real events keep their real dates; "store drop" / "court" activations
# inside the window describe in-game availability, not a dated press event.
# WWE / PGA-only partners (minute-maid, sun-day-red, lululemon) are excluded
# from NBA data on purpose.
# ---------------------------------------------------------------------------
NBA_EXCLUDED_BRANDS = {"minute-maid", "sun-day-red", "lululemon"}
BRAND_CATALOG = {
    "american-express": {
        "items": [("American Express 2XREP Tee", "APPAREL"), ("Amex Courtside Hoodie", "APPAREL")],
        "activations": [("American Express 2XREP", "CITY_EVENT", "2026-09-19", "2026-09-21", "season-nba2k27-s1"),
                        ("American Express 2XREP", "CITY_EVENT", "2026-11-07", "2026-11-09", "season-nba2k27-s2")]},
    "gatorade": {
        "items": [("Gatorade Boosts", "BUNDLE"), ("Gatorade Training Facility Tee", "APPAREL"), ("Gatorade Towel", "ACCESSORY")],
        "activations": [("Gatorade Training Facility", "COURT", "2026-09-04", "2026-11-27", "season-nba2k27-s1")]},
    "cerave": {
        "items": [("CeraVe Splash Zone Tee", "APPAREL"), ("CeraVe Headband", "ACCESSORY")],
        "activations": [("CeraVe endorsement challenge", "SEASON_REWARD", "2026-09-04", "2026-10-16", "season-nba2k27-s1"),
                        ("The CeraVe Splash Zone", "CITY_EVENT", "2026-11-13", "2026-11-16", "season-nba2k27-s2")]},
    "coach": {
        "items": [("Coach Varsity Jacket", "APPAREL"), ("Coach Signature Hoodie", "APPAREL"), ("Coach Crossbody Bag", "ACCESSORY")],
        "activations": [("Coach 2XREP", "CITY_EVENT", "2026-09-12", "2026-09-14", "season-nba2k27-s1"),
                        ("Coach 2XREP", "CITY_EVENT", "2026-10-03", "2026-10-05", "season-nba2k27-s1"),
                        ("Coach apparel in The City", "STORE_DROP", "2026-09-04", "2026-10-16", "season-nba2k27-s1")]},
    "adidas": {
        "items": [("adidas Anthony Edwards signature shoe", "SHOES"), ("adidas Superstar", "SHOES"), ("adidas 2XREP Tee", "APPAREL")],
        "activations": [("adidas Superstar in The City", "STORE_DROP", "2026-07-24", "2026-09-04", "season-nba2k26-s6"),
                        ("Adidas 2XREP", "CITY_EVENT", "2026-10-23", "2026-10-25", "season-nba2k27-s2")]},
    "nike": {
        "items": [("Nike Caitlin 1", "SHOES"), ("Nike Air Foamposite One", "SHOES"), ("Nike Dunk High", "SHOES")],
        "activations": [("Nike Caitlin 1 drop in The City", "STORE_DROP", "2026-09-18", "2026-10-09", "season-nba2k27-s1")]},
    "kia": {
        "items": [("Kia Challenge Tee", "APPAREL")],
        "activations": [("Kia Challenge", "CITY_EVENT", "2026-09-26", "2026-09-29", "season-nba2k27-s1"),
                        ("Kia Challenge", "CITY_EVENT", "2026-10-10", "2026-10-13", "season-nba2k27-s1")]},
    "converse": {
        "items": [("Converse SHAI 001", "SHOES"), ("Chuck Taylor All Star", "SHOES"), ("Converse Weapon", "SHOES")],
        "activations": [("Converse SHAI 001 drop in The City", "STORE_DROP", "2026-09-04", "2026-09-25", "season-nba2k27-s1")]},
    "nvidia": {"items": [("NVIDIA City Edition Hoodie", "APPAREL")], "activations": []},
    "state-farm": {
        "items": [("State Farm City Edition Hoodie", "APPAREL")],
        "activations": [("Jake from State Farm quest", "SEASON_REWARD", "2026-07-24", "2026-09-04", "season-nba2k26-s6")]},
    "reebok": {
        "items": [("Reebok Angel Reese 1", "SHOES"), ("Reebok Pump", "SHOES"), ("Reebok Blast", "SHOES")],
        "activations": [("Reebok Angel Reese 1 drop in The City", "STORE_DROP", "2026-09-25", "2026-10-16", "season-nba2k27-s1")]},
    "jordan-brand": {"items": [("Air Jordan 1", "SHOES"), ("Air Jordan 40", "SHOES")], "activations": []},
    "puma": {"items": [("Puma LaMelo Ball signature shoe", "SHOES"), ("Puma Suede", "SHOES")], "activations": []},
    "new-balance": {"items": [("New Balance P400", "SHOES"), ("New Balance 550", "SHOES"), ("New Balance 990v6", "SHOES")], "activations": []},
    "under-armour": {"items": [("Curry Brand Curry signature shoe", "SHOES"), ("Curry Brand De'Aaron Fox signature shoe", "SHOES")], "activations": []},
    "bape": {"items": [("BAPE City Edition Hoodie", "APPAREL")], "activations": []},
    "tissot": {"items": [("Tissot City Edition Watch", "ACCESSORY")], "activations": []},
    "denim-tears": {"items": [("Denim Tears City Edition Hoodie", "APPAREL")], "activations": []},
    "true-religion": {"items": [("True Religion City Edition Hoodie", "APPAREL")], "activations": []},
}
UNBRANDED_ITEMS = [
    ("2K27 Rec Center Practice Jersey", "JERSEY"), ("The City Neon Hoodie", "APPAREL"),
    ("Season 1 Pass Track Jacket", "APPAREL"), ("Courtside Compression Sleeve", "ACCESSORY"),
    ("Park Legend Chain", "ACCESSORY"), ("Rivet City Beanie", "ACCESSORY"),
    ("Retro Hoops Shorts", "APPAREL"), ("MyCAREER Rookie Starter Bundle", "BUNDLE"),
    ("Pro-Am Team Uniform Set", "JERSEY"), ("Glow Arm Band", "ACCESSORY"),
    ("Comp Stage Warmup Tee", "APPAREL"), ("Old Town Flyers Throwback Jersey", "JERSEY"),
    ("City Drip Starter Bundle", "BUNDLE"), ("Gym Rat Joggers", "APPAREL"),
    # college-leaning (generic, no school marks)
    ("Campus Classic Hoodie", "APPAREL"), ("College Hoops Throwback Jersey", "JERSEY"), ("March Run Warmup Tee", "APPAREL"),
    # WNBA / The W leaning (generic)
    ("The W Courtside Hoodie", "APPAREL"), ("The W Practice Jersey", "JERSEY"),
    # VC sinks that dominate real spend (MyPLAYER upgrades, badges, packs, animations)
    ("MyPLAYER Attribute Boost Pack", "BUNDLE"), ("Badge Unlock Bundle", "BUNDLE"),
    ("MyTEAM Pack Bundle", "BUNDLE"), ("Animation Package Bundle", "BUNDLE"),
    ("Signature Takeover Upgrade", "BUNDLE"),
]
VC_SINK_ITEMS = {"MyPLAYER Attribute Boost Pack", "Badge Unlock Bundle", "MyTEAM Pack Bundle",
                 "Animation Package Bundle", "Signature Takeover Upgrade"}
# Stable public logo files (Wikimedia Commons, verified HTTP 200). Brands without a
# verified file stay NULL and the UI renders a wordmark.
LOGO_URLS = {
    "american-express": "https://upload.wikimedia.org/wikipedia/commons/f/fa/American_Express_logo_%282018%29.svg",
    "gatorade": "https://upload.wikimedia.org/wikipedia/commons/9/9b/Gatorade_logo.svg",
    "adidas": "https://upload.wikimedia.org/wikipedia/commons/2/20/Adidas_Logo.svg",
    "nike": "https://upload.wikimedia.org/wikipedia/commons/a/a6/Logo_NIKE.svg",
    "converse": "https://upload.wikimedia.org/wikipedia/commons/3/30/Converse_logo.svg",
    "nvidia": "https://upload.wikimedia.org/wikipedia/commons/2/21/Nvidia_logo.svg",
    "state-farm": "https://upload.wikimedia.org/wikipedia/commons/9/9a/State_Farm_logo.svg",
    "reebok": "https://upload.wikimedia.org/wikipedia/commons/5/53/Reebok_2019_logo.svg",
    "new-balance": "https://upload.wikimedia.org/wikipedia/commons/e/ea/New_Balance_logo.svg",
    "under-armour": "https://upload.wikimedia.org/wikipedia/commons/4/44/Under_armour_logo.svg",
    "tissot": "https://upload.wikimedia.org/wikipedia/commons/c/ce/Tissot_Logo.svg",
    "puma": "https://upload.wikimedia.org/wikipedia/commons/a/ae/Puma-logo-%28text%29.svg",
}

SPLIT_SUFFIX = ["Reloaded", "2.0", "Next Up", "Second Unit", "Run It Back", "Afterhours",
                "Bench Mob", "Late Night Runs", "Remix", "B-Team", "Overtime"]

rng = random.Random(SEED)


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ") if dt is not None else None


def day_dt(i):
    return DAY0 + timedelta(days=i)


def time_in_day(r, i, evening=True):
    """A timestamp inside day index i (never after NOW)."""
    base = day_dt(i)
    if evening:
        hour = r.choices(range(24), weights=[2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 4, 5, 7, 8, 8, 7, 5, 3])[0]
    else:
        hour = r.randint(0, 23)
    dt = base + timedelta(hours=hour, minutes=r.randint(0, 59), seconds=r.randint(0, 59))
    if dt > NOW - timedelta(minutes=5):
        dt = base + timedelta(hours=r.randint(0, 10), minutes=r.randint(0, 59))
    return dt


def poisson(r, lam):
    if lam <= 0:
        return 0
    if lam > 30:
        return max(0, int(round(r.gauss(lam, math.sqrt(lam)))))
    L, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= r.random()
        if p <= L:
            return k
        k += 1


def pkey(a, b):
    return (a, b) if a < b else (b, a)


def load(name):
    with open(os.path.join(V1_DIR, name), encoding="utf-8") as f:
        return json.load(f)


def weighted_sample(r, items, weights, n):
    """Weighted sampling without replacement (Efraimidis-Spirakis)."""
    keyed = []
    for it, w in zip(items, weights):
        if w > 0:
            keyed.append((r.random() ** (1.0 / w), it))
    return [it for _, it in heapq.nlargest(n, keyed)]


# ---------------------------------------------------------------------------
# main build
# ---------------------------------------------------------------------------
def main():
    global SEED, OUT
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-brands", action="store_true")
    ap.add_argument("--as-of", default="2026-10-15", help="as-of date (YYYY-MM-DD); NOW = as-of 12:00Z")
    ap.add_argument("--seed", type=int, default=SEED, help="simulation seed (validated default in SEED)")
    ap.add_argument("--out", default=OUT, help="output directory (default data/v2)")
    args = ap.parse_args()
    SEED, OUT = args.seed, os.path.abspath(args.out)
    rng.seed(SEED)
    configure(args.as_of)
    print(f"as_of={args.as_of}  window={DAY0.date()}..{(DAY0 + timedelta(days=N_DAYS - 1)).date()}  "
          f"launch_idx={LAUNCH_IDX}  s2_idx={S2_IDX}")

    os.makedirs(OUT, exist_ok=True)
    players = load("master_players.json")
    clans = load("clans.json")
    creators = load("creators.json")
    offers = load("marketing_offers.json")
    identities = load("platform_identities.json")
    has_identity = load("has_identity_edges.json")
    v1_members = load("member_of_clan_edges.json")
    assert len(players) == 6500, f"expected 6,500 v1 players, found {len(players)}"
    assert len(creators) == 40, f"expected 40 v1 creators, found {len(creators)}"

    P = {p["player_id"]: p for p in players}
    pids = [p["player_id"] for p in players]
    clan_by_id = {c["clan_id"]: dict(c) for c in clans}
    creator_by_id = {c["creator_id"]: c for c in creators}

    # ------------------------------------------------------------------
    # 1. Latent behaviour per player
    # ------------------------------------------------------------------
    role_of = {e["player_id"]: e["role"] for e in v1_members}
    crew_of_v1 = {e["player_id"]: e["clan_id"] for e in v1_members}
    crew_members = defaultdict(list)
    for e in v1_members:
        crew_members[e["clan_id"]].append(e["player_id"])

    pp, mu, soc, h0, min_sigma = {}, {}, {}, {}, {}
    for p in players:
        pid, a = p["player_id"], p["primary_archetype"]
        ll = p["game_telemetry"].get("last_login_days_ago") or 0
        pp[pid] = clamp(ARCH_PPLAY[a] - 0.006 * ll + rng.gauss(0, 0.09), 0.10, 0.93)
        mu[pid] = ARCH_MIN[a] * rng.lognormvariate(0, 0.25)
        soc[pid] = clamp(rng.lognormvariate(-0.15, 0.5), 0.15, 1.9)
        min_sigma[pid] = 0.5
        churn = p["churn_risk_score"]
        h0[pid] = K["BASE_H"] * (0.45 + 1.7 * churn) * rng.lognormvariate(0, 0.30) / math.sqrt(max(pp[pid], 0.3) / 0.55)

    # Crew cores: captain + co-captains + top regulars form the 5-6 player core.
    core = {}
    for cid, mem in crew_members.items():
        ranked = sorted(mem, key=lambda x: ({"CAPTAIN": 0, "CO_CAPTAIN": 1}.get(role_of[x], 2), -pp[x]))
        size = 5 if len(mem) < 45 else 6
        core[cid] = ranked[: min(size, max(2, len(mem) // 6))]
        for x in core[cid]:
            soc[x] = rng.uniform(*K["CORE_SOC"])
            pp[x] = max(pp[x], rng.uniform(0.86, 0.92))
            min_sigma[x] = K["CORE_MIN_SIGMA"]

    # Pickup groups for crewless players (same DMA + franchise family), size 30-60.
    group_of = {}
    for pid in pids:
        if pid in crew_of_v1:
            group_of[pid] = crew_of_v1[pid]
    buckets = defaultdict(list)
    for p in players:
        if p["player_id"] in group_of:
            continue
        fam = "NBA" if p["primary_franchise"] in NBA_FAMILY else p["primary_franchise"]
        buckets[(p["dma_market"], fam)].append(p["player_id"])
    gid = 0
    pickup_groups = {}
    leftovers = []
    for key in sorted(buckets):
        mem = buckets[key]
        rng.shuffle(mem)
        if len(mem) < 12:
            leftovers.extend(mem)
            continue
        n_chunks = max(1, round(len(mem) / 45))
        for k in range(n_chunks):
            chunk = mem[k::n_chunks]
            gid += 1
            g = f"pg-{gid:03d}"
            pickup_groups[g] = chunk
            for x in chunk:
                group_of[x] = g
    rng.shuffle(leftovers)
    for k in range(0, len(leftovers), 40):
        gid += 1
        g = f"pg-{gid:03d}"
        pickup_groups[g] = leftovers[k:k + 40]
        for x in pickup_groups[g]:
            group_of[x] = g

    # ------------------------------------------------------------------
    # 2. Choose planted anchors (before pairs, so the anchor is the clear core leader)
    # ------------------------------------------------------------------
    eligible = [c for c in sorted(crew_members) if len(crew_members[c]) >= 20
                and clan_by_id[c]["franchise"] in ("NBA2K", "NBA2K26")]
    rng.shuffle(eligible)
    na, nw, nb_ = K["N_ANCHOR_A"], K["N_ANCHOR_W"], K["N_ANCHOR_B"]
    set_a = eligible[:na]
    set_w = eligible[na:na + nw]
    set_b = eligible[na + nw:na + nw + nb_]
    anchored = set(set_a) | set(set_w) | set(set_b)
    # split parents may also have lost an anchor (just not this week)
    split_pool = [c for c in eligible if c not in set_b and len(crew_members[c]) >= 30]
    split_parents = split_pool[::-1][: K["N_SPLITS"]]
    untouched = [c for c in sorted(crew_members) if c not in anchored]
    anchor_of = {}
    for c in set_a + set_w + set_b:
        # anchors are long-tenured (joined well before the window)
        veterans = [x for x in core[c] if (P[x]["account_tenure_days"] or 0) >= 200] or core[c]
        top = max(veterans, key=lambda x: soc[x])
        soc[top] = K["CORE_SOC"][1] * K["ANCHOR_SOC_MULT"]
        pp[top] = max(pp[top], 0.85)
        anchor_of[c] = top

    # ------------------------------------------------------------------
    # 3. PLAYED_WITH pairs with historical (pre-window) co-play weights
    # ------------------------------------------------------------------
    pairs = {}  # (a,b) -> {"w": hist games, "kind": str}
    tier_f = {"Rec": 0.9, "Pro-Am": 1.0, "Comp": 1.1}

    def calibrate(groups, target, base_fn):
        cand = []
        for mem in groups:
            for i in range(len(mem)):
                for j in range(i + 1, len(mem)):
                    cand.append((mem[i], mem[j], base_fn(mem[i], mem[j])))
        lo, hi = 1e-4, 50.0
        for _ in range(50):
            mid = (lo + hi) / 2
            exp_n = sum(1 - math.exp(-mid * b) for _, _, b in cand)
            lo, hi = (mid, hi) if exp_n < target else (lo, mid)
        return cand, (lo + hi) / 2

    crew_groups = [crew_members[c] for c in sorted(crew_members)]
    tier_by_member = {x: clan_by_id[crew_of_v1[x]]["tier"] for x in crew_of_v1}
    cand, kc = calibrate(crew_groups, K["CREW_PAIR_TARGET"],
                         lambda a, b: soc[a] * soc[b] * tier_f.get(tier_by_member[a], 1.0))
    core_set = {x for mem in core.values() for x in mem}
    for a, b, base in cand:
        if rng.random() < 1 - math.exp(-kc * base):
            scale = 6.5 * soc[a] * soc[b] * tier_f.get(tier_by_member[a], 1.0)
            if a in core_set and b in core_set:
                sh = K["CORE_PAIR_SHAPE"]
                w = 2 + int(round(rng.gammavariate(sh, K["CORE_PAIR_MULT"] * 1.6 * scale / sh)))
            else:
                w = 2 + int(round(rng.gammavariate(1.6, scale)))
            pairs[pkey(a, b)] = {"w": w, "kind": "crew"}
    cand, kg = calibrate([pickup_groups[g] for g in sorted(pickup_groups)], K["GROUP_PAIR_TARGET"],
                         lambda a, b: soc[a] * soc[b])
    for a, b, base in cand:
        if rng.random() < 1 - math.exp(-kg * base):
            pairs[pkey(a, b)] = {"w": 1 + int(round(rng.gammavariate(1.3, 4.0 * soc[a] * soc[b]))), "kind": "group"}
    del cand

    by_dma = defaultdict(list)
    by_fr = defaultdict(list)
    for p in players:
        by_dma[p["dma_market"]].append(p["player_id"])
        by_fr[p["primary_franchise"]].append(p["player_id"])
    total_soc = sum(soc[x] * (0.6 if x in crew_of_v1 else 1.3) for x in pids)
    lam_x = 2 * K["CROSS_PAIR_TARGET"] / total_soc
    added = 0
    for pid in pids:
        n = poisson(rng, lam_x * soc[pid] * (0.6 if pid in crew_of_v1 else 1.3) / 2)
        p = P[pid]
        for _ in range(n):
            u = rng.random()
            pool = by_dma[p["dma_market"]] if u < 0.45 else by_fr[p["primary_franchise"]] if u < 0.75 else pids
            q = rng.choice(pool)
            if q == pid:
                continue
            k2 = pkey(pid, q)
            if k2 in pairs:
                continue
            pairs[k2] = {"w": 1 + int(round(rng.gammavariate(1.2, 3.0))), "kind": "cross"}
            added += 1

    # Crew structure: each crew has a small core of near-equal "keystones" (~KEYSTONE_SHARE of
    # members within ~10% of the top co-play degree); planted anchors are the clear #1.
    crew_nbrs = defaultdict(dict)
    for (a, b), meta in pairs.items():
        if meta["kind"] == "crew":
            crew_nbrs[a][b] = meta
            crew_nbrs[b][a] = meta

    def cdeg(x):
        return sum(m["w"] for m in crew_nbrs[x].values())

    def scale_to(x, target):
        d = cdeg(x)
        if d <= 0:
            return
        f = target / d
        for m in crew_nbrs[x].values():
            m["w"] = max(1, int(round(m["w"] * f)))

    key_core = set()
    for cid in sorted(crew_members):
        mem = crew_members[cid]
        a = anchor_of.get(cid)
        for _ in range(2):
            others = sorted((x for x in mem if x != a), key=lambda x: -cdeg(x))
            if not others:
                break
            n_key = max(2, int(round(K["KEYSTONE_SHARE"] * len(mem) * rng.uniform(0.8, 1.2))))
            top = cdeg(others[0])
            key_core.update(others[:n_key])
            for x in others[1:n_key]:
                if cdeg(x) < 0.93 * top:
                    scale_to(x, top * rng.uniform(0.93, 1.0))
            if a is not None:
                mx = max(cdeg(x) for x in others)
                if cdeg(a) < 1.25 * mx:
                    scale_to(a, 1.25 * mx * rng.uniform(1.0, 1.1))
    # keystones are steady regulars: high play rate, low day-to-day minute variance
    for x in sorted(key_core):
        pp[x] = max(pp[x], 0.84)
        min_sigma[x] = min(min_sigma[x], K["KEYSTONE_MIN_SIGMA"])

    # ------------------------------------------------------------------
    # 4. Crew membership history (joins, splits, re-forms, leaves, former members)
    # ------------------------------------------------------------------
    rows = {}  # (pid, cid) -> {"role", "joined", "left"}
    events = []  # dicts: player_id, clan_id, event_type, occurred_at, related_clan_id

    def ev(pid, cid, et, when, rel=None):
        events.append({"player_id": pid, "clan_id": cid, "event_type": et, "occurred_at": when, "related_clan_id": rel})

    founded = {}
    for cid in sorted(crew_members):
        founded[cid] = NOW - timedelta(days=rng.randint(220, 820))
    for e in v1_members:
        pid, cid = e["player_id"], e["clan_id"]
        tenure_start = NOW - timedelta(days=P[pid]["account_tenure_days"] or 400)
        lo = max(founded[cid], tenure_start)
        if e["role"] == "CAPTAIN":
            joined = lo + timedelta(hours=rng.randint(0, 48))
        else:
            span = max(1.0, (NOW - timedelta(days=95) - lo).total_seconds() / 86400)
            joined = lo + timedelta(days=rng.random() ** 1.3 * span, hours=rng.randint(0, 23))
        rows[(pid, cid)] = {"role": e["role"], "joined": joined, "left": None}
        ev(pid, cid, "JOIN", joined)

    def crew_degree(pid, cid, members):
        return sum(pairs[pkey(pid, q)]["w"] for q in members if q != pid and pkey(pid, q) in pairs)

    pre_rank = {}
    for cid, mem in crew_members.items():
        ranked = sorted(mem, key=lambda x: -crew_degree(x, cid, mem))
        pre_rank[cid] = ranked
    protected = set()
    for cid, ranked in pre_rank.items():
        protected.update(ranked[:3])

    # Planted anchor departures
    anchor_depart = {}  # cid -> day index
    for c in set_a:
        anchor_depart[c] = rng.randint(N_DAYS - 1 - 62, N_DAYS - 1 - 29)
    # weekly baseline: week 2 = days N-14..N-9, week 3 = N-21..N-15, week 4 = N-28..N-22 (noisy 8-12 per week)
    w2 = rng.randint(9, 10)
    w3 = rng.randint(9, 11)
    weeks = [(N_DAYS - 14, N_DAYS - 9)] * w2 + [(N_DAYS - 21, N_DAYS - 15)] * w3 + \
            [(N_DAYS - 28, N_DAYS - 22)] * (len(set_w) - w2 - w3)
    for c, (lo_, hi_) in zip(set_w, weeks):
        anchor_depart[c] = rng.randint(lo_, hi_)
    for c in set_b:
        anchor_depart[c] = rng.randint(N_DAYS - 7, N_DAYS - 1)
    anchor_rejoin = {}
    rejoin_targets = [c for c in sorted(crew_members) if clan_by_id[c]["franchise"] == "NBA2K"
                      and c not in set_w and c not in set_b]
    for c, d in anchor_depart.items():
        a = anchor_of[c]
        t_leave = time_in_day(rng, d)
        if rows[(a, c)]["joined"] >= t_leave - timedelta(days=7):
            raise SystemExit(f"FATAL: anchor {a} of {c} joined {rows[(a, c)]['joined']} after planned departure {t_leave}")
        rows[(a, c)]["left"] = t_leave
        ev(a, c, "LEAVE", t_leave)
        if c not in set_b and rng.random() < 0.5 and rejoin_targets:
            tgt = rng.choice([x for x in rejoin_targets if x != c])
            t_join = min(NOW - timedelta(hours=1), t_leave + timedelta(days=rng.randint(1, 6), hours=rng.randint(0, 12)))
            rows[(a, tgt)] = {"role": "MEMBER", "joined": t_join, "left": None}
            ev(a, tgt, "JOIN", t_join, c)
            anchor_rejoin[a] = tgt

    # Splits (+ re-forms + one second-generation split)
    new_clans = []
    split_from = []
    next_crew = 101
    split_days_pre = [-240, -205, -160, -118]
    split_days_win = sorted(rng.sample(range(4, 72), K["N_SPLITS"] - len(split_days_pre)))
    split_dates = [NOW + timedelta(days=d, hours=rng.randint(-10, 10)) for d in split_days_pre] + \
                  [time_in_day(rng, d) for d in split_days_win]
    split_members = {}
    used_split = set()
    for parent, when in zip(split_parents, split_dates):
        mem = [x for x in crew_members[parent] if x not in protected and rows[(x, parent)]["joined"] < when - timedelta(days=10)]
        if len(mem) < 8:
            continue
        seed = rng.choice(mem)
        mates = sorted([q for q in mem if q != seed and pkey(seed, q) in pairs],
                       key=lambda q: -pairs[pkey(seed, q)]["w"])
        k = rng.randint(5, 10)
        group = [seed] + mates[: k - 1]
        if len(group) < 4:
            continue
        child = f"crew-{next_crew:03d}"
        next_crew += 1
        pc = clan_by_id[parent]
        name = f"{pc['name']} {SPLIT_SUFFIX[(next_crew - 102) % len(SPLIT_SUFFIX)]}"
        new_clans.append({"clan_id": child, "name": name, "franchise": pc["franchise"], "region": pc["region"],
                          "tier": pc["tier"], "member_count": 0})
        clan_by_id[child] = new_clans[-1]
        for x in group:
            rows[(x, parent)]["left"] = when
            ev(x, parent, "SPLIT", when, child)
            rows[(x, child)] = {"role": "CAPTAIN" if x == seed else "MEMBER", "joined": when + timedelta(minutes=rng.randint(1, 90)), "left": None}
            ev(x, child, "JOIN", rows[(x, child)]["joined"], parent)
            used_split.add(x)
        split_from.append({"clan_id": child, "parent_clan_id": parent, "split_at": when, "shared_members": len(group)})
        split_members[child] = (parent, group, when)

    # Re-forms: 3 split crews dissolve and their members return to the parent.
    reform_children = [c for c in list(split_members)[:6]][::2][:3]
    for child in reform_children:
        parent, group, when = split_members[child]
        t_ref = min(NOW - timedelta(days=4), when + timedelta(days=rng.randint(28, 60)))
        for x in group:
            rows[(x, child)]["left"] = t_ref
            ev(x, child, "LEAVE", t_ref)
            t_back = t_ref + timedelta(hours=rng.randint(1, 30))
            rows[(x, parent)] = {"role": rows[(x, parent)]["role"], "joined": t_back, "left": None}
            ev(x, parent, "JOIN", t_back, child)
    # Second-generation split from a surviving pre-window child.
    survivors = [c for c in split_members if c not in reform_children and split_members[c][2] < DAY0]
    if survivors:
        child = survivors[0]
        _, group, when = split_members[child]
        sub = group[1: 1 + min(5, len(group) - 1)]
        if len(sub) >= 3:
            g2 = f"crew-{next_crew:03d}"
            next_crew += 1
            pc = clan_by_id[child]
            t2 = time_in_day(rng, 61)
            new_clans.append({"clan_id": g2, "name": f"{pc['name'].split(' ')[0]} {SPLIT_SUFFIX[-1]}", "franchise": pc["franchise"],
                              "region": pc["region"], "tier": pc["tier"], "member_count": 0})
            clan_by_id[g2] = new_clans[-1]
            for x in sub:
                rows[(x, child)]["left"] = t2
                ev(x, child, "SPLIT", t2, g2)
                rows[(x, g2)] = {"role": "CAPTAIN" if x == sub[0] else "MEMBER", "joined": t2 + timedelta(minutes=rng.randint(1, 60)), "left": None}
                ev(x, g2, "JOIN", rows[(x, g2)]["joined"], child)
            split_from.append({"clan_id": g2, "parent_clan_id": child, "split_at": t2, "shared_members": len(sub)})

    # Random voluntary leaves (never the top-3 of a crew, never split members or anchors).
    anchors = set(anchor_of.values())
    for e in v1_members:
        pid, cid = e["player_id"], e["clan_id"]
        if pid in protected or pid in used_split or pid in anchors or rows[(pid, cid)]["left"] is not None:
            continue
        if rng.random() < 0.055:
            joined = rows[(pid, cid)]["joined"]
            t = joined + timedelta(days=rng.uniform(5, max(6, (NOW - joined).days - 1)))
            t = min(t, NOW - timedelta(hours=2))
            rows[(pid, cid)]["left"] = t
            ev(pid, cid, "LEAVE", t)
            if rng.random() < 0.4:
                tgt = rng.choice([c for c in rejoin_targets if c != cid] or rejoin_targets)
                if (pid, tgt) not in rows:
                    tj = min(NOW - timedelta(hours=1), t + timedelta(days=rng.randint(0, 9), hours=rng.randint(1, 20)))
                    rows[(pid, tgt)] = {"role": "MEMBER", "joined": tj, "left": None}
                    ev(pid, tgt, "JOIN", tj, cid)

    # Former members: crewless NBA players who used to run with a crew.
    crewless_nba = [p["player_id"] for p in players if p["player_id"] not in crew_of_v1 and p["primary_franchise"] in ("NBA2K", "NBA2K26")]
    rng.shuffle(crewless_nba)
    nba_crews = [c for c in sorted(crew_members) if clan_by_id[c]["franchise"] in ("NBA2K", "NBA2K26")]
    for pid in crewless_nba[:320]:
        cid = rng.choice(nba_crews)
        joined = NOW - timedelta(days=rng.randint(120, 520))
        left = joined + timedelta(days=rng.randint(14, 100))
        if left > NOW - timedelta(days=20):
            left = NOW - timedelta(days=rng.randint(20, 60))
        et = "KICK" if rng.random() < 0.3 else "LEAVE"
        rows[(pid, cid)] = {"role": "MEMBER", "joined": joined, "left": left}
        ev(pid, cid, "JOIN", joined)
        ev(pid, cid, et, left)
        for q in rng.sample(crew_members[cid], min(len(crew_members[cid]), rng.randint(2, 6))):
            k2 = pkey(pid, q)
            if k2 not in pairs:
                pairs[k2] = {"w": 2 + int(round(rng.gammavariate(1.4, 4.0))), "kind": "former_crew"}

    nbrs = defaultdict(list)
    for (a, b) in pairs:
        nbrs[a].append(b)
        nbrs[b].append(a)

    # ------------------------------------------------------------------
    # 5. Anchor effects and keystone decline plan
    # ------------------------------------------------------------------
    def active_members(cid, t):
        return [pid for (pid, c), r in rows.items() if c == cid and r["joined"] <= t and (r["left"] is None or r["left"] > t)]

    anchor_eff = {}  # pid -> (start_day, end_day, strength)
    crew_strength = {}
    for c, d in anchor_depart.items():
        a = anchor_of[c]
        strong = rng.random() < 0.72
        cs = rng.uniform(0.75, 1.0) if strong else rng.uniform(0.0, 0.2)
        crew_strength[c] = cs
        t = rows[(a, c)]["left"]
        mem = [x for x in active_members(c, t - timedelta(seconds=1)) if x != a]
        ties = {x: pairs.get(pkey(a, x), {"w": 0})["w"] for x in mem}
        mx = max(ties.values()) if ties else 1
        for x in mem:
            st = cs * (0.35 + 0.65 * ties[x] / max(mx, 1))
            anchor_eff[x] = (d, d + K["ANCHOR_DAYS"], st * (K["CORE_SHIELD"] if x in key_core else 1.0))

    decline_pool = []
    for c in untouched:
        mem = core.get(c, [])
        if not mem:
            continue
        top_soc = max(soc[x] for x in mem)
        decline_pool += [x for x in mem if soc[x] >= 0.94 * top_soc and rows[(x, c)]["left"] is None]
    rng.shuffle(decline_pool)
    decliners = set(decline_pool[: K["N_DECLINE"]])

    # ------------------------------------------------------------------
    # 6. Stream schedule
    # ------------------------------------------------------------------
    creators_sorted = sorted(creators, key=lambda c: -c["followers"])
    followers_of = defaultdict(set)
    for p in players:
        for c in p.get("followed_creators") or []:
            followers_of[c].add(p["player_id"])
    group_list = sorted(set(group_of.values()))
    home_groups = {}
    for c in creators:
        cid = c["creator_id"]
        if cid in HUB_CREATORS:
            continue
        cnt = Counter(group_of[x] for x in followers_of[cid])
        h = 5 if c["followers"] >= 3_000_000 else 7
        home_groups[cid] = set(g for g, _ in cnt.most_common(h))
    offers_by_fr = defaultdict(list)
    for o in offers:
        offers_by_fr[o["target_franchise"]].append(o)

    streams = []
    s_by_day = defaultdict(list)
    sid = 0
    for c in creators:
        cid = c["creator_id"]
        if c["franchise"] == "NBA2K":
            n = 5 + int(round(8 * math.sqrt(c["avg_stream_viewers"] / 52000))) + rng.randint(0, 2)
        else:
            n = rng.randint(5, 7)
        if cid in CREATOR_EFFECT or cid in HUB_CREATORS:
            n += 4
        # NBA 2K27 launch fortnight runs hot for NBA creators (launch streams + first offers)
        day_w = [3.0 if (c["franchise"] == "NBA2K" and LAUNCH_IDX <= d < LAUNCH_IDX + 14) else 1.0 for d in range(N_DAYS)]
        days = sorted(weighted_sample(rng, list(range(N_DAYS)), day_w, n))
        for i, d in enumerate(days):
            sid += 1
            fr = "NBA2K" if c["franchise"] == "NBA2K" else c["franchise"]
            pool = [o for o in offers_by_fr.get(fr, []) if o["available_from"] <= day_dt(d).strftime("%Y-%m-%d")]
            if fr == "NBA2K":
                pool = [o for o in pool if (o["game_id"] or "").startswith("game-nba2k27")]
            p_offer = 0.85 if cid in CREATOR_EFFECT else 0.45
            offer = rng.choice(pool) if pool and rng.random() < p_offer else None
            plat = c["platform"]
            plat = "Twitch" if ("Twitch" in plat and ("YouTube" not in plat or rng.random() < 0.6)) else "YouTube"
            start = time_in_day(rng, d)
            dur = rng.randint(90, 300)
            end = start + timedelta(minutes=dur)
            if end > NOW:
                end = NOW
                dur = max(30, int((end - start).total_seconds() // 60))
            streams.append({
                "stream_id": f"stream-{sid:04d}", "creator_id": cid, "_day": d, "_dur": dur,
                "title": None, "platform": plat, "started_at": start, "ended_at": end,
                "peak_viewers": int(round(c["avg_stream_viewers"] * rng.lognormvariate(0.1, 0.35))),
                "featured_offer_id": offer["offer_id"] if offer else None, "featured_item_id": None,
                "_offer_title": offer["offer_title"] if offer else None,
            })
            s_by_day[d].append(streams[-1])

    # ------------------------------------------------------------------
    # 7. Day-level simulation
    # ------------------------------------------------------------------
    sessions = defaultdict(dict)  # pid -> {day: minutes}
    quit_day = {}
    nbr_last_quit = {}
    watch_eff = defaultdict(list)  # pid -> [(start, end, factor)]
    watches = []  # (pid, stream, minutes, day)
    is_2k26_primary = {p["player_id"]: p["primary_franchise"] == "NBA2K26" for p in players}
    plays_nba27 = {p["player_id"]: "NBA2K" in (p.get("franchises_played") or []) for p in players}
    creator_fr_ok = {}
    for c in creators:
        fr = c["franchise"]
        creator_fr_ok[c["creator_id"]] = (lambda f: (lambda p: bool(set(p.get("franchises_played") or []) & (NBA_FAMILY if f == "NBA2K" else {f}))))(fr)
    fr_match = {c["creator_id"]: {pid: creator_fr_ok[c["creator_id"]](P[pid]) for pid in pids} for c in creators}
    group_size = Counter(group_of.values())
    exposure_days = 0

    for t in range(N_DAYS):
        dow = day_dt(t).weekday()
        wk = 1.12 if dow >= 5 else 1.0
        for pid in pids:
            if pid in quit_day:
                continue
            p_t = pp[pid] * wk
            m_t = 1.18 if dow >= 5 else 1.0
            if LAUNCH_IDX <= t < LAUNCH_IDX + 14 and plays_nba27[pid]:
                p_t *= 1.15
                m_t *= 1.22
            if t >= S2_IDX and plays_nba27[pid]:
                p_t *= 1.06
            hz = h0[pid]
            if is_2k26_primary[pid] and t >= LAUNCH_IDX:
                p_t *= 0.85
                hz *= 1.5
            ae = anchor_eff.get(pid)
            if ae and ae[0] <= t < ae[1]:
                p_t *= 1 - K["ANCHOR_P"] * ae[2]
                hz *= 1 + K["ANCHOR_H"] * ae[2] * math.exp(-(t - ae[0]) / K["ANCHOR_DECAY"])
            if pid in decliners and t >= N_DAYS - 7:
                p_t *= 0.42
                m_t *= 0.62
                hz = 0.0
            lq = nbr_last_quit.get(pid)
            if lq is not None and t - 14 <= lq <= t - 1:
                hz *= K["EXPOSURE_MULT"]
                exposure_days += 1
            for (s0, s1, f) in watch_eff.get(pid, ()):
                if s0 <= t < s1:
                    hz *= f
                    # creator influence also shifts engagement (more / fewer play days)
                    p_t *= (1 + 0.5 * (1 - f)) if f < 1 else 1 / (1 + 0.3 * (f - 1))
            if rng.random() < min(0.97, p_t):
                minutes = max(5, int(round(mu[pid] * m_t * rng.lognormvariate(0, min_sigma[pid]))))
                sessions[pid][t] = minutes
                if rng.random() < hz:
                    quit_day[pid] = t
                    for q in nbrs[pid]:
                        if nbr_last_quit.get(q, -99) < t:
                            nbr_last_quit[q] = t
        # streams of the day: viewers among players who have not quit
        for s in s_by_day.get(t, ()):
            cid = s["creator_id"]
            c = creator_by_id[cid]
            n_view = poisson(rng, K["VIEWERS_PER_STREAM"] * (c["avg_stream_viewers"] / 15000) ** 0.45 *
                             (1.35 if cid in CREATOR_EFFECT else 1.0))
            cands, ws = [], []
            hub = cid in HUB_CREATORS
            homes = home_groups.get(cid, set())
            fol = followers_of[cid]
            fm = fr_match[cid]
            for pid in pids:
                if pid in quit_day and quit_day[pid] < t:
                    continue
                w = (2.4 if pid in fol else 0.35) * (1.0 if fm[pid] else 0.08)
                if hub:
                    w *= 40.0 / max(group_size[group_of[pid]], 10)
                else:
                    w *= 2.5 if group_of[pid] in homes else 0.25
                cands.append(pid)
                ws.append(w)
            viewers = weighted_sample(rng, cands, ws, n_view)
            for pid in viewers:
                mins = round(min(s["_dur"], max(2.0, rng.lognormvariate(math.log(24), 0.75))), 1)
                watches.append((pid, s, mins, t))
                if mins >= 20:
                    f = CREATOR_EFFECT.get(cid, 1.0)
                    if f != 1.0:
                        watch_eff[pid].append((t, t + 30, f))

    # ------------------------------------------------------------------
    # 8. Kicks of inactive members (never top-3 / anchors)
    # ------------------------------------------------------------------
    last_day = {pid: max(d) if d else None for pid, d in ((x, sessions[x].keys()) for x in pids)}
    for (pid, cid), r in list(rows.items()):
        if r["left"] is not None or pid in protected or pid in anchors:
            continue
        ld = last_day[pid]
        if ld is None or ld > N_DAYS - 1 - 21:
            continue
        if rng.random() < 0.40:
            t = day_dt(ld) + timedelta(days=rng.randint(21, 40), hours=rng.randint(0, 23))
            if t < NOW - timedelta(hours=1) and t > r["joined"]:
                r["left"] = t
                ev(pid, cid, "KICK", t)

    # ------------------------------------------------------------------
    # 9. Player activity fields + sessions_daily
    # ------------------------------------------------------------------
    sessions_rows = []
    for pid in pids:
        s = sessions[pid]
        for d in sorted(s):
            sessions_rows.append({"player_id": pid, "date": day_dt(d).strftime("%Y-%m-%d"), "session_minutes": s[d]})
        p = P[pid]
        if s:
            ld = max(s)
            last_active = time_in_day(rng, ld)
        else:
            last_active = DAY0 - timedelta(days=rng.randint(1, 30), hours=rng.randint(0, 23))
        churned = last_active + timedelta(days=14)
        p["last_active_at"] = iso(last_active)
        p["churned_at"] = iso(churned) if churned <= NOW else None
        p["session_min_7d"] = float(sum(v for d, v in s.items() if d >= N_DAYS - 7))
        p["session_min_prev_7d"] = float(sum(v for d, v in s.items() if N_DAYS - 14 <= d < N_DAYS - 7))

    # ------------------------------------------------------------------
    # 10. PLAYED_WITH window stats
    # ------------------------------------------------------------------
    day_sets = {pid: set(sessions[pid]) for pid in pids}
    crew_at_end = {}
    for (pid, cid), r in rows.items():
        if r["left"] is None:
            crew_at_end[pid] = cid
    left_day = {}
    for c, d in anchor_depart.items():
        left_day[anchor_of[c]] = (c, d)
    played_with = []
    for (a, b), meta in pairs.items():
        both = day_sets[a] & day_sets[b]
        base_q = 0.06 + 0.55 * (1 - math.exp(-meta["w"] / 35.0))
        g30 = gwin = 0
        last = None
        for d in sorted(both):
            q = base_q
            for x, y in ((a, b), (b, a)):
                if x in left_day and d >= left_day[x][1] and crew_of_v1.get(y) == left_day[x][0]:
                    q *= 0.3
            if rng.random() < q:
                g = 1 + poisson(rng, 1.4)
                gwin += g
                if d >= N_DAYS - 30:
                    g30 += g
                last = d
        if last is not None:
            lp = time_in_day(rng, last)
        else:
            lp = DAY0 - timedelta(days=rng.randint(1, 200), hours=rng.randint(0, 23))
        meta["total"] = meta["w"] + gwin
        played_with.append({
            "player_id": a, "other_player_id": b, "games_together_30d": g30,
            "games_together_total": meta["total"], "last_played_at": iso(lp),
            "same_crew": crew_at_end.get(a) is not None and crew_at_end.get(a) == crew_at_end.get(b),
        })

    # ------------------------------------------------------------------
    # 11. crew_centrality (0-1 weighted co-play degree within the crew)
    # ------------------------------------------------------------------
    rows_by_crew = defaultdict(list)
    for (pid, cid), r in rows.items():
        rows_by_crew[cid].append(pid)

    def w_total(a, b):
        m = pairs.get(pkey(a, b))
        return m["total"] if m else 0

    centrality = {}
    for cid, mem in rows_by_crew.items():
        active = [x for x in mem if rows[(x, cid)]["left"] is None]
        deg = {x: sum(w_total(x, q) for q in active if q != x) for x in active}
        mx = max(deg.values()) if deg else 0
        for x in active:
            centrality[(x, cid)] = round(deg[x] / mx, 4) if mx > 0 else 0.0
        for x in mem:
            r = rows[(x, cid)]
            if r["left"] is None:
                continue
            t = r["left"] - timedelta(seconds=1)
            at = [q for q in mem if rows[(q, cid)]["joined"] <= t and (rows[(q, cid)]["left"] is None or rows[(q, cid)]["left"] > t)]
            if x not in at:
                at.append(x)
            d2 = {q: sum(w_total(q, z) for z in at if z != q) for q in at}
            m2 = max(d2.values()) if d2 else 0
            centrality[(x, cid)] = round(d2[x] / m2, 4) if m2 > 0 else 0.0

    member_rows = []
    for (pid, cid), r in sorted(rows.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        member_rows.append({
            "player_id": pid, "clan_id": cid, "role": r["role"], "joined_at": iso(r["joined"]),
            "left_at": iso(r["left"]), "is_active": r["left"] is None,
            "crew_centrality": centrality.get((pid, cid), 0.0),
        })
    active_count = Counter(r["clan_id"] for r in member_rows if r["is_active"])
    out_clans = []
    for c in clans + new_clans:
        c2 = dict(clan_by_id[c["clan_id"]])
        c2["member_count"] = active_count.get(c["clan_id"], 0)
        out_clans.append(c2)

    events.sort(key=lambda e: (e["occurred_at"], e["player_id"]))
    out_events = []
    for i, e in enumerate(events, 1):
        out_events.append({"event_id": f"cme-{i:06d}", "player_id": e["player_id"], "clan_id": e["clan_id"],
                           "event_type": e["event_type"], "occurred_at": iso(e["occurred_at"]),
                           "related_clan_id": e["related_clan_id"]})

    # ------------------------------------------------------------------
    # 11b. churn_risk_score (v2). The v1 value is only the latent input to the
    # simulation's base hazard; the published score is re-derived from the v2
    # behaviour so it agrees with what the graph shows: week-over-week session
    # decline, churned/lapsing PLAYED_WITH neighbours, crew top-member departure,
    # days idle, tilt and loss streak. Logistic with noise (not deterministic).
    # ------------------------------------------------------------------
    risk_rng = random.Random(SEED + 202)
    churned_set = {pid for pid in pids if P[pid]["churned_at"]}
    lapsing = {pid for pid in pids if last_day[pid] is None or last_day[pid] <= N_DAYS - 1 - 7}
    for pid in pids:
        p = P[pid]
        if pid in churned_set:
            p["churn_risk_score"] = round(clamp(0.9 + risk_rng.gauss(0, 0.04), 0.75, 0.99), 2)
            continue
        s7, s_prev = p["session_min_7d"], p["session_min_prev_7d"]
        decline = clamp(1 - s7 / s_prev, 0.0, 1.0) if s_prev > 0 else (0.0 if s7 > 0 else 0.6)
        nb = nbrs[pid]
        expo = sum(1 for q in nb if q in churned_set or q in lapsing) / len(nb) if nb else 0.0
        idle = (N_DAYS - 1 - last_day[pid]) / 14 if last_day[pid] is not None else 1.0
        ae = anchor_eff.get(pid)
        crew_hit = 1.0 if (ae and ae[0] >= N_DAYS - 60) else 0.0
        z = (-2.1 + 2.7 * math.sqrt(decline) + 2.0 * max(0.0, expo - 0.15) + 0.8 * (p.get("tilt_sensitivity") or 0.0)
             + 0.12 * min(p.get("recent_loss_streak") or 0, 5) + 0.7 * crew_hit + 1.2 * idle
             + risk_rng.gauss(0, 0.35))
        p["churn_risk_score"] = round(1 / (1 + math.exp(-z)), 2)

    # ------------------------------------------------------------------
    # 12. FRIENDS_WITH + MESSAGED
    # ------------------------------------------------------------------
    friends = {}
    for (a, b), meta in pairs.items():
        pf = 1 - math.exp(-meta["total"] / 55.0)
        pf = 0.10 + 0.8 * pf if meta["kind"] in ("crew", "former_crew") else 0.08 + 0.6 * pf
        if rng.random() < pf:
            since = NOW - timedelta(days=rng.randint(20, 700), hours=rng.randint(0, 23))
            friends[(a, b)] = since
    target_extra = 2600
    while target_extra > 0:
        a, b = rng.sample(pids, 2)
        k2 = pkey(a, b)
        if k2 in friends:
            continue
        friends[k2] = NOW - timedelta(days=rng.randint(30, 1200), hours=rng.randint(0, 23))
        target_extra -= 1
    messaged = []
    for (a, b), since in friends.items():
        meta = pairs.get((a, b))
        pm = 0.66 if meta else 0.25
        if rng.random() >= pm:
            continue
        la, lb = last_day[a], last_day[b]
        both_recent = la is not None and lb is not None and min(la, lb) >= N_DAYS - 30
        if both_recent:
            cnt = 1 + poisson(rng, 6 + 0.08 * (meta["total"] if meta else 5))
            last_msg = time_in_day(rng, min(la, lb) - rng.randint(0, 3) if min(la, lb) >= 3 else min(la, lb))
        else:
            cnt = 0
            ref = min(x for x in (la, lb) if x is not None) if (la is not None or lb is not None) else -30
            last_msg = day_dt(ref) - timedelta(days=rng.randint(31, 90)) if ref < N_DAYS - 30 else NOW - timedelta(days=rng.randint(31, 90))
            last_msg = min(last_msg, NOW - timedelta(days=31))
        messaged.append({"player_id": a, "other_player_id": b, "msg_count_30d": cnt, "last_msg_at": iso(last_msg)})
    for (a, b), meta in pairs.items():
        if (a, b) in friends or meta["kind"] != "crew" or rng.random() >= 0.10:
            continue
        la, lb = last_day[a], last_day[b]
        if la is None or lb is None or min(la, lb) < N_DAYS - 30:
            continue
        messaged.append({"player_id": a, "other_player_id": b, "msg_count_30d": 1 + poisson(rng, 2),
                         "last_msg_at": iso(time_in_day(rng, min(la, lb)))})
    friends_rows = [{"player_id": a, "other_player_id": b, "since": iso(s)} for (a, b), s in friends.items()]

    # ------------------------------------------------------------------
    # 13. Seasons, matches, COMPETED_IN, IN_SEASON
    # ------------------------------------------------------------------
    seasons = [{"season_id": s[0], "game_id": s[1], "name": s[2],
                "start_at": s[3] + "T17:00:00Z", "end_at": s[4] + "T17:00:00Z"} for s in SEASONS]
    strength = {c: {"Rec": 0.0, "Pro-Am": 0.5, "Comp": 1.0}.get(clan_by_id[c]["tier"], 0) + rng.gauss(0, 0.6) for c in clan_by_id}
    active_by_day = defaultdict(Counter)
    for (pid, cid), r in rows.items():
        for d in sessions[pid]:
            t = day_dt(d) + timedelta(hours=12)
            if r["joined"] <= t and (r["left"] is None or r["left"] > t):
                active_by_day[d][cid] += 1
    matches, competed, in_season = [], [], []
    mid = 0
    mode_by_tier = {"Rec": [("REC", 60), ("PARK", 40)], "Pro-Am": [("PRO_AM", 70), ("PARK", 15), ("REC", 15)],
                    "Comp": [("COMP", 65), ("PRO_AM", 35)]}
    for s in SEASONS:
        start = datetime.fromisoformat(s[3]).replace(tzinfo=UTC)
        end = min(datetime.fromisoformat(s[4]).replace(tzinfo=UTC), NOW.replace(hour=0) + timedelta(days=1))
        ndays = (end - start).days
        if ndays <= 0:
            continue
        per_day = SEASON_RATE[s[0]]
        allowed_fr = ("NBA2K", "NBA2K26") if s[1] == "game-nba2k26" else ("NBA2K",)
        for k in range(ndays):
            date = start + timedelta(days=k)
            di = (date - DAY0).days
            if 0 <= di < N_DAYS:
                wmap = {c: n for c, n in active_by_day[di].items() if clan_by_id[c]["franchise"] in allowed_fr}
            else:
                wmap = {}
                for (pid, cid), r in rows.items():
                    if clan_by_id[cid]["franchise"] in allowed_fr and r["joined"] <= date and (r["left"] is None or r["left"] > date):
                        wmap[cid] = wmap.get(cid, 0) + 0.6
            crews_today = [c for c, n in wmap.items() if n >= 3]
            if len(crews_today) < 2:
                continue
            n_today = poisson(rng, per_day * (1.15 if date.weekday() >= 5 else 0.94))
            wts = [wmap[c] for c in crews_today]
            for _ in range(n_today):
                a = rng.choices(crews_today, weights=wts)[0]
                tier = clan_by_id[a]["tier"]
                same = [c for c in crews_today if c != a and clan_by_id[c]["tier"] == tier]
                pool = same if same and rng.random() < 0.7 else [c for c in crews_today if c != a]
                b = rng.choices(pool, weights=[wmap[c] for c in pool])[0]
                mode = rng.choices(*zip(*mode_by_tier.get(tier, mode_by_tier["Rec"])))[0]
                mid += 1
                m_id = f"match-{mid:06d}"
                played = time_in_day(rng, di) if 0 <= di < N_DAYS else date + timedelta(hours=rng.randint(14, 23) + 0, minutes=rng.randint(0, 59)) + timedelta(hours=rng.choice([0, 1, 2, 3, 4, 5, 6]))
                if played > NOW:
                    played = NOW - timedelta(minutes=rng.randint(10, 600))
                s_start = start + timedelta(hours=17)
                s_end = datetime.fromisoformat(s[4]).replace(tzinfo=UTC) + timedelta(hours=17)
                if played < s_start:  # seasons flip at 17:00Z
                    played = s_start + timedelta(minutes=rng.randint(5, 400))
                if played >= s_end:
                    played = s_end - timedelta(minutes=rng.randint(10, 600))
                played = min(played, NOW - timedelta(minutes=5))
                matches.append({"match_id": m_id, "season_id": s[0], "mode": mode, "played_at": iso(played)})
                in_season.append({"match_id": m_id, "season_id": s[0]})
                pa = 1 / (1 + math.exp(-(strength[a] - strength[b])))
                diff = clamp(1 + int(abs(rng.gauss(0, 9))), 1, 40)
                a_wins = rng.random() < pa
                competed.append({"clan_id": a, "match_id": m_id, "result": "W" if a_wins else "L", "score_diff": diff if a_wins else -diff})
                competed.append({"clan_id": b, "match_id": m_id, "result": "L" if a_wins else "W", "score_diff": -diff if a_wins else diff})

    # ------------------------------------------------------------------
    # 14. Viewer identities + WATCHED
    # ------------------------------------------------------------------
    ident_n = max(int(i["identity_id"].split("-")[1]) for i in identities)
    viewer_ident = {}
    out_identities = list(identities)
    out_has_identity = list(has_identity)
    watched_rows = {}
    for pid, s, mins, d in watches:
        key = (pid, s["platform"])
        if key not in viewer_ident:
            ident_n += 1
            iid = f"ident-{ident_n:05d}"
            tag = P[pid]["gamer_tag"]
            handle = (tag.lower() + rng.choice(["", "_", "ttv", str(rng.randint(1, 99))])) if s["platform"] == "Twitch" else "@" + tag
            conf = round(rng.uniform(0.9, 0.99), 2)
            viewer_ident[key] = iid
            out_identities.append({"identity_id": iid, "platform": s["platform"], "platform_handle": handle[:40], "confidence_score": conf})
            out_has_identity.append({"player_id": pid, "identity_id": iid, "confidence_score": round(conf - rng.uniform(0, 0.03), 2)})
        iid = viewer_ident[key]
        wk2 = (iid, s["stream_id"])
        start = s["started_at"]
        offset = rng.uniform(0, max(1.0, s["_dur"] - mins))
        wat = start + timedelta(minutes=offset)
        if wat > NOW:
            wat = NOW - timedelta(minutes=1)
        watched_rows[wk2] = {"identity_id": iid, "stream_id": s["stream_id"], "watched_at": iso(wat), "watch_minutes": mins, "_pid": pid}

    # ------------------------------------------------------------------
    # 15. Communities (weighted label propagation on co-play + watch graph)
    # ------------------------------------------------------------------
    adj = defaultdict(dict)
    for (a, b), meta in pairs.items():
        w = math.log1p(meta["total"])
        adj[a][b] = adj[a].get(b, 0) + w
        adj[b][a] = adj[b].get(a, 0) + w
    for wr in watched_rows.values():
        pid = wr["_pid"]
        cnode = "C:" + creator_by_id_from_stream(streams, wr["stream_id"])
        adj[pid][cnode] = adj[pid].get(cnode, 0) + 0.05
        adj[cnode][pid] = adj[cnode].get(pid, 0) + 0.05
    nodes = sorted(adj)
    label = {n: n for n in nodes}
    lp_rng = random.Random(SEED + 7)
    for it in range(30):
        lp_rng.shuffle(nodes)
        changed = 0
        for n in nodes:
            score = defaultdict(float)
            for m, w in adj[n].items():
                score[label[m]] += w
            if not score:
                continue
            best = max(score.values())
            cands = sorted(l for l, v in score.items() if v >= best - 1e-12)
            new = label[n] if label[n] in cands else lp_rng.choice(cands)
            if new != label[n]:
                label[n] = new
                changed += 1
        if changed == 0:
            break
    comm_members = defaultdict(list)
    for n in adj:
        if not n.startswith("C:"):
            comm_members[label[n]].append(n)
    # merge tiny communities into their most-connected neighbour community
    for _ in range(2):
        for lab in sorted(comm_members, key=lambda l: len(comm_members[l])):
            mem = comm_members.get(lab)
            if not mem or len(mem) >= 12:
                continue
            score = defaultdict(float)
            for n in mem:
                for m, w in adj[n].items():
                    if not m.startswith("C:") and label[m] != lab:
                        score[label[m]] += w
            if not score:
                continue
            tgt = max(sorted(score), key=lambda l: score[l])
            for n in mem:
                label[n] = tgt
            comm_members[tgt].extend(mem)
            del comm_members[lab]
    ordered = sorted(comm_members, key=lambda l: (-len(comm_members[l]), min(comm_members[l])))
    comm_name = {lab: f"comm-{i + 1:03d}" for i, lab in enumerate(ordered)}
    for pid in pids:
        P[pid]["community_id"] = comm_name[label[pid]] if pid in label and not pid.startswith("C:") and label[pid] in comm_name else None

    # creator hub_score / community_span
    stream_creator = {s["stream_id"]: s["creator_id"] for s in streams}
    viewers_by_creator = defaultdict(set)
    for wr in watched_rows.values():
        viewers_by_creator[stream_creator[wr["stream_id"]]].add(wr["_pid"])
    raw_hub = {}
    span = {}
    for c in creators:
        cid = c["creator_id"]
        cnt = Counter(P[x]["community_id"] for x in viewers_by_creator[cid] if P[x]["community_id"])
        n = sum(cnt.values())
        span[cid] = sum(1 for v in cnt.values() if v >= 3)
        if n == 0:
            raw_hub[cid] = 0.0
            continue
        simpson = 1 - sum((v / n) ** 2 for v in cnt.values())
        raw_hub[cid] = simpson * math.log1p(span[cid])
    mx_hub = max(raw_hub.values())
    out_creators = []
    for c in creators:
        c2 = dict(c)
        c2["hub_score"] = round(raw_hub[c["creator_id"]] / mx_hub, 4)
        c2["community_span"] = span[c["creator_id"]]
        out_creators.append(c2)

    # ------------------------------------------------------------------
    # 16. Concept affinities
    # ------------------------------------------------------------------
    wnba_players = {"Caitlin Clark", "A'ja Wilson", "Paige Bueckers", "Angel Reese", "Sabrina Ionescu", "Breanna Stewart", "Napheesa Collier"}
    for p in players:
        a = p["primary_archetype"]
        age = p.get("age") or 25
        t = p["game_telemetry"]
        w = 0.12 + (0.50 if a == "THE_W_LOYALIST" else 0) + (0.10 if p.get("gender") == "female" else 0) + \
            (0.12 if t.get("favorite_player") in wnba_players else 0) + (0.05 if a == "MYNBA_FRANCHISE_SIM" else 0)
        f = 0.15 + (0.55 if a == "MYNBA_FRANCHISE_SIM" else 0) + (0.12 if p["primary_franchise"] in ("CIV7", "PGA2K") else 0) + \
            (0.08 if a == "BUILD_LAB_THEORYCRAFTER" else 0) + (0.06 if age >= 30 else 0)
        c = 0.15 + (0.25 if age <= 21 else 0.12 if age <= 24 else 0) + (0.15 if a in ("MYCAREER_STORY_CASUAL", "MOBILE_DAILY_RITUALIST") else 0) + \
            (0.05 if a == "THE_W_LOYALIST" else 0)
        p["wnba_affinity"] = round(clamp(w + rng.gauss(0, 0.09), 0.0, 1.0), 3)
        p["franchise_mode_affinity"] = round(clamp(f + rng.gauss(0, 0.09), 0.0, 1.0), 3)
        p["college_hoops_affinity"] = round(clamp(c + rng.gauss(0, 0.09), 0.0, 1.0), 3)

    # ------------------------------------------------------------------
    # 17. Brands, activations, items, purchases (REAL 2K partners)
    # ------------------------------------------------------------------
    brand_out = None
    if not args.skip_brands:
        brand_out = build_brands(players, pids, sessions, nbrs, streams, watches, quit_day, creator_by_id)

    # stream titles
    title_rng = random.Random(SEED + 11)
    for s in streams:
        s["title"] = stream_title(title_rng, creator_by_id[s["creator_id"]], s)

    # ------------------------------------------------------------------
    # 18. Write
    # ------------------------------------------------------------------
    print(f"Writing 2K Courtside v2 dataset to {OUT}")
    write("players.json", players)
    write("clans.json", out_clans)
    write("creators.json", out_creators)
    write("identities.json", out_identities)
    write("has_identity.json", out_has_identity)
    write("member_of_clan.json", member_rows)
    write("crew_membership_events.json", out_events)
    write("played_with.json", played_with)
    write("friends_with.json", friends_rows)
    write("messaged.json", messaged)
    write("seasons.json", seasons)
    write("matches.json", matches)
    write("competed_in.json", competed)
    write("in_season.json", in_season)
    write("split_from.json", [dict(s, split_at=iso(s["split_at"])) for s in split_from])
    write("streams.json", [{k: (iso(v) if isinstance(v, datetime) else v) for k, v in s.items() if not k.startswith("_")} for s in streams])
    write("hosted.json", [{"creator_id": s["creator_id"], "stream_id": s["stream_id"]} for s in streams])
    write("watched.json", [{k: v for k, v in w.items() if not k.startswith("_")} for w in watched_rows.values()])
    write_ndjson("sessions_daily.ndjson", sessions_rows)
    if brand_out:
        for name, rows_ in brand_out.items():
            write(name, rows_)

    truth = {
        "seed": SEED, "now": iso(NOW), "knobs": K, "creator_effect": CREATOR_EFFECT, "hub_creators": HUB_CREATORS,
        "anchor_set_a": {c: {"anchor": anchor_of[c], "depart_day": anchor_depart[c], "strength": round(crew_strength[c], 3)} for c in set_a},
        "anchor_set_w": {c: {"anchor": anchor_of[c], "depart_day": anchor_depart[c], "strength": round(crew_strength[c], 3)} for c in set_w},
        "anchor_set_b": {c: {"anchor": anchor_of[c], "depart_day": anchor_depart[c], "strength": round(crew_strength[c], 3)} for c in set_b},
        "decliners": sorted(decliners), "split_children": [s["clan_id"] for s in split_from],
        "reformed_children": reform_children, "exposure_person_days": exposure_days,
    }
    with open(os.path.join(OUT, "planted_truth.json"), "w") as f:
        json.dump(truth, f, indent=2)
    print(f"\nquit in window: {len(quit_day)}  churned: {sum(1 for p in players if p['churned_at'])}  "
          f"pairs: {len(pairs)}  watches: {len(watched_rows)}  communities: {len(comm_name)}")


def creator_by_id_from_stream(streams, stream_id, _cache={}):
    if not _cache:
        for s in streams:
            _cache[s["stream_id"]] = s["creator_id"]
    return _cache[stream_id]


def stream_title(r, c, s):
    sig = c["signature_mode"]
    game = {"NBA2K": "NBA 2K27", "WWE2K": "WWE 2K25", "BL4": "Borderlands 4", "CIV7": "Civilization VII",
            "PGA2K": "PGA TOUR 2K25"}.get(c["franchise"], "2K")
    d = s["_day"]
    season = ("Season 2" if d >= S2_IDX else "Season 1") if d >= LAUNCH_IDX else ("NBA 2K26 Season 6" if c["franchise"] == "NBA2K" else "")
    if c["franchise"] == "NBA2K" and d < LAUNCH_IDX:
        game = "NBA 2K26"
    if s.get("_offer_title"):
        opts = [f"{game} | {sig} + {s['_offer_title']} breakdown",
                f"{s['_offer_title']} is live | {game} {season}".strip(),
                f"{sig} | {game} {season} with chat (featuring {s['_offer_title']})".replace("  ", " ")]
    elif s.get("_item_name"):
        opts = [f"{game} | {sig} in the new {s['_item_name']}", f"Copping the {s['_item_name']} | {game} {season}".strip()]
    else:
        opts = [f"{game} | {sig}", f"{sig} | {game} {season}".strip(), f"Late night {game} | {sig}",
                f"{game} {season} | {sig} with viewers".replace("  ", " ")]
    return r.choice(opts)


# ---------------------------------------------------------------------------
# Brands (real 2K partners from data/brands_research.json)
# ---------------------------------------------------------------------------
def build_brands(players, pids, sessions, nbrs, streams, watches, quit_day, creator_by_id):
    if not os.path.exists(BRANDS_PATH):
        raise SystemExit(
            f"FATAL: {BRANDS_PATH} not found. Brands must be REAL, verified 2K partners supplied by the orchestrator; "
            "refusing to invent brands. Re-run with --skip-brands to build everything else.")
    with open(BRANDS_PATH, encoding="utf-8") as f:
        research = json.load(f)
    if not isinstance(research, list) or not research:
        raise SystemExit("FATAL: data/brands_research.json must be a non-empty array of brands.")
    by_id = {b["brand_id"]: b for b in research}
    missing = [b for b in BRAND_CATALOG if b not in by_id]
    if missing:
        raise SystemExit(f"FATAL: catalog brands missing from brands_research.json: {missing}")
    uncatalogued = [b for b in by_id if b not in BRAND_CATALOG and b not in NBA_EXCLUDED_BRANDS]
    if uncatalogued:
        raise SystemExit(f"FATAL: research brands without an item catalog entry: {uncatalogued}")

    r = random.Random(SEED + 101)
    brands, items, activations, sponsors, features = [], [], [], [], []
    vc_by_type = {"SHOES": (9000, 20000), "JERSEY": (6000, 12000), "APPAREL": (3500, 9000),
                  "ACCESSORY": (1500, 5000), "BUNDLE": (12000, 30000)}
    item_n = act_n = 0
    brand_items = defaultdict(list)
    brand_titles = {}
    conf_w = {}
    for bid in BRAND_CATALOG:
        b = by_id[bid]
        summary = str(b.get("integration") or "").strip()
        titles = b.get("titles") or []
        brand_titles[bid] = set(titles)
        if titles:
            summary = f"{summary} (Titles: {', '.join(titles)})".strip()
        brands.append({"brand_id": bid, "name": b["name"], "category": b.get("category"),
                       "partnership_summary": summary[:1000], "logo_url": b.get("logo_url") or LOGO_URLS.get(bid)})
        conf_w[bid] = {"HIGH": 2.0, "MEDIUM": 1.0}.get(str(b.get("confidence", "")).upper(), 0.7)
        for nm, it in BRAND_CATALOG[bid]["items"]:
            item_n += 1
            lo, hi = vc_by_type[it]
            iid = f"item-{item_n:03d}"
            items.append({"item_id": iid, "name": nm, "item_type": it, "brand_id": bid, "is_branded": True,
                          "vc_price": int(round(r.randint(lo, hi), -2))})
            brand_items[bid].append(iid)
        for title, kind, s0, e0, season in BRAND_CATALOG[bid]["activations"]:
            act_n += 1
            aid = f"act-{act_n:03d}"
            activations.append({"activation_id": aid, "brand_id": bid, "title": title, "kind": kind,
                                "starts_at": s0 + "T17:00:00Z", "ends_at": e0 + "T17:00:00Z", "season_id": season})
            sponsors.append({"brand_id": bid, "activation_id": aid})
            for iid in brand_items[bid]:
                features.append({"activation_id": aid, "item_id": iid})
    for nm, it in UNBRANDED_ITEMS:
        item_n += 1
        lo, hi = vc_by_type[it]
        items.append({"item_id": f"item-{item_n:03d}", "name": nm, "item_type": it, "brand_id": None,
                      "is_branded": False, "vc_price": int(round(r.randint(lo, hi) * 0.7, -2))})

    item_by_id = {i["item_id"]: i for i in items}
    unbranded_ids = [i["item_id"] for i in items if not i["is_branded"]]
    unbranded_w = [2.5 if i["name"] in VC_SINK_ITEMS else 1.0 for i in items if not i["is_branded"]]
    brand_ids = list(BRAND_CATALOG)
    acts_by_item = defaultdict(list)
    for f_ in features:
        acts_by_item[f_["item_id"]].append(f_["activation_id"])
    act_by_id = {a["activation_id"]: a for a in activations}
    act_days = {}
    for a in activations:
        s0 = (datetime.fromisoformat(a["starts_at"].replace("Z", "+00:00")) - DAY0).days
        e0 = (datetime.fromisoformat(a["ends_at"].replace("Z", "+00:00")) - DAY0).days
        act_days[a["activation_id"]] = (s0, e0)

    def brand_live(b, t):
        tl = brand_titles[b]
        return ("NBA 2K26" in tl and t < LAUNCH_IDX) or ("NBA 2K27" in tl and t >= LAUNCH_IDX)

    # Featured items on streams (branded, live in the title being streamed)
    for s in streams:
        if s["featured_offer_id"] is None and creator_by_id[s["creator_id"]]["franchise"] == "NBA2K" and r.random() < 0.45:
            live = [i for b in brand_ids if brand_live(b, s["_day"]) for i in brand_items[b]]
            if live:
                iid = r.choice(live)
                s["featured_item_id"] = iid
                s["_item_name"] = item_by_id[iid]["name"]
    stream_boost = defaultdict(list)  # pid -> [(start, end, brand)]
    for pid, s, mins, d in watches:
        if s.get("featured_item_id") and mins >= 20:
            stream_boost[pid].append((d, d + 7, item_by_id[s["featured_item_id"]]["brand_id"]))

    pop = {b: conf_w[b] * r.lognormvariate(0, 0.35) for b in brand_ids}
    pref = {p["player_id"]: {b: r.lognormvariate(0, 0.6) for b in brand_ids} for p in players}
    nba_player = {p["player_id"]: bool(set(p.get("franchises_played") or []) & NBA_FAMILY) for p in players}
    buy_norm = {pid: 0.6 / max(len(sessions[pid]) / N_DAYS, 0.3) for pid in pids}
    spend = {p["player_id"]: ARCH_SPEND[p["primary_archetype"]] * r.lognormvariate(0, 0.45) for p in players}
    nbr_bought = defaultdict(set)  # pid -> brands bought by co-play neighbours so far
    bought = []
    kappa = K["SOCIAL_KAPPA"]
    for t in range(N_DAYS):
        live_brands = [b for b in brand_ids if brand_live(b, t)]
        act_brand = Counter(act_by_id[a]["brand_id"] for a, (s0, e0) in act_days.items() if s0 <= t <= e0)
        for pid in pids:
            if t not in sessions[pid] or not nba_player[pid]:
                continue
            if r.random() >= K["BUY_RATE"] * spend[pid] * buy_norm[pid]:
                continue
            if r.random() < K["UNBRANDED_P"]:
                iid = r.choices(unbranded_ids, weights=unbranded_w)[0]
            else:
                boosts = {b for (s0, s1, b) in stream_boost.get(pid, ()) if s0 <= t < s1}
                nb = nbr_bought[pid]
                ws = [pop[b] * pref[pid][b] * (1 + 0.8 * act_brand.get(b, 0)) * (1 + kappa if b in nb else 1.0) *
                      (2.5 if b in boosts else 1.0) for b in live_brands]
                b = r.choices(live_brands, weights=ws)[0]
                iid = r.choice(brand_items[b])
                for q in nbrs[pid]:
                    nbr_bought[q].add(b)
            it = item_by_id[iid]
            via = None
            for aid in acts_by_item.get(iid, ()):
                s0, e0 = act_days[aid]
                if s0 <= t <= e0 and r.random() < 0.85:
                    via = aid
                    break
            vc = it["vc_price"] if r.random() > 0.15 else int(round(it["vc_price"] * 0.75, -2))
            bought.append({"player_id": pid, "item_id": iid, "bought_at": iso(time_in_day(r, t)), "vc_amount": vc,
                           "via_activation_id": via})
    seen, dedup = set(), []
    for row in bought:
        k = (row["player_id"], row["item_id"], row["bought_at"])
        if k not in seen:
            seen.add(k)
            dedup.append(row)
    bought = dedup
    latest = {}
    for row in sorted(bought, key=lambda x: x["bought_at"]):
        latest[(row["player_id"], item_by_id[row["item_id"]]["item_type"])] = row
    equipped = []
    for (pid, _), row in sorted(latest.items()):
        if r.random() < 0.7:
            t = datetime.fromisoformat(row["bought_at"].replace("Z", "+00:00")) + timedelta(minutes=r.randint(1, 600))
            equipped.append({"player_id": pid, "item_id": row["item_id"], "equipped_at": iso(min(t, NOW))})
    return {"brands.json": brands, "brand_activations.json": activations, "sponsors.json": sponsors,
            "items.json": items, "features.json": features, "bought.json": bought, "equipped.json": equipped}


def write(name, rows):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  {name:<30} {len(rows):>8,} rows")


def write_ndjson(name, rows):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        for r_ in rows:
            f.write(json.dumps(r_, separators=(",", ":")) + "\n")
    print(f"  {name:<30} {len(rows):>8,} rows")


if __name__ == "__main__":
    # Determinism: some intermediate structures are sets of strings, so pin the hash seed
    # (re-exec once) to make a given --seed / --as-of reproduce byte-identical output.
    if os.environ.get("PYTHONHASHSEED") != "0":
        os.environ["PYTHONHASHSEED"] = "0"
        os.execv(sys.executable, [sys.executable] + sys.argv)
    main()
