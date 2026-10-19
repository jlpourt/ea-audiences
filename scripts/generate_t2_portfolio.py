#!/usr/bin/env python3
"""
Take-Two portfolio extension for the Take-Two command center (t2_graph_db).

Adds Rockstar Games and Zynga to the 2K v2 player graph so the command center
can show cross-studio player interaction: who plays what, who is friends with
whom across studios, who invited whom into another title, and GTA VI wishlist
intent. The 2K v2 dataset (data/v2, data/*.json) is read, never modified.

Outputs (data/t2/):
  games.json             new parent-hub Games rows (labels ROCKSTAR, ZYNGA)
  players.json           new Rockstar- and Zynga-primary players (v2 Player shape)
  player_overrides.json  existing 2K player_id -> franchises_played (adds R/Z titles)
  plays_game.json        FULL PlaysGame set for t2_graph_db: v1 2K edges enriched
                         with spend_usd / first_played_at / acquired_via, plus
                         every new cross-studio and new-player edge
  identities.json        Rockstar Games Social Club / Zynga Account / platform ids
  has_identity.json
  friends_with.json      new FriendsWith pairs (player_id < other_player_id)
  invited.json           INVITED edges (inviter -> invitee, from title -> to title)
  wishlisted.json        WISHLISTED edges (player -> GTA VI)
  planted_truth.json     the effects this generator plants, for validation

Planted, realistic effects (validated by printing measured values at the end):
  * Friend pull: players outside a title's studio adopt it ~3-5x more often when
    at least one friend already plays it.
  * Accepted cross-title invites retain better (lower churn) than organic adopters.
  * Multi-studio players spend more per head and churn less than single-studio.
  * Studio overlap: 2K x Rockstar is the largest bridge (console core, NBA 2K /
    Mafia / Borderlands <-> GTA Online); 2K x Zynga runs through NBA 2K Mobile;
    Rockstar x Zynga runs through CSR Racing 2.

Deterministic (seed 2727). Usage: python3 scripts/generate_t2_portfolio.py
"""
import json
import math
import os
import random
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

SEED = 2727
rng = random.Random(SEED)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "t2")
os.makedirs(OUT, exist_ok=True)

AS_OF = datetime(2026, 10, 15, 11, 53, 38, tzinfo=timezone.utc)


def iso(d):
    return d.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load(*parts):
    with open(os.path.join(ROOT, "data", *parts)) as f:
        return json.load(f)


def dump(name, obj):
    with open(os.path.join(OUT, name), "w") as f:
        json.dump(obj, f, indent=None, separators=(",", ":"))
    print(f"  wrote data/t2/{name}  ({len(obj) if hasattr(obj, '__len__') else ''})")


# ---------------------------------------------------------------- base data
players_v2 = load("v2", "players.json")
games_v1 = load("games.json")
edges_v1 = load("played_game_edges.json")
friends_v2 = load("v2", "friends_with.json")

by_id = {p["player_id"]: p for p in players_v2}
FR_TO_GAME = {g["franchise"]: g["game_id"] for g in games_v1 if g.get("is_parent_hub")}
TWOK_FRANCHISES = set(FR_TO_GAME)

# ---------------------------------------------------------------- new titles
NEW_GAMES = [
    # Rockstar Games
    dict(game_id="game-gta-online", title="Grand Theft Auto Online", franchise="GTAO", label="ROCKSTAR",
         genre="Open World Online", release_date="2013-10-01", lifecycle_status="LIVE",
         monetization_model="PREMIUM_PLUS_GTA_PLUS_SHARK_CARDS", current_season="Fall 2026 Update"),
    dict(game_id="game-red-dead-online", title="Red Dead Online", franchise="RDO", label="ROCKSTAR",
         genre="Open World Online (Western)", release_date="2018-11-27", lifecycle_status="LIVE",
         monetization_model="PREMIUM_PLUS_GOLD_BARS", current_season=None),
    dict(game_id="game-gta6", title="Grand Theft Auto VI", franchise="GTA6", label="ROCKSTAR",
         genre="Open World Action", release_date="2026-11-19", lifecycle_status="PRE_LAUNCH",
         monetization_model="PREMIUM", current_season=None),
    # Zynga
    dict(game_id="game-words-with-friends", title="Words With Friends", franchise="WWF", label="ZYNGA",
         genre="Social Word", release_date="2009-07-01", lifecycle_status="LIVE",
         monetization_model="FREE_TO_PLAY_ADS_IAP", current_season=None),
    dict(game_id="game-match-factory", title="Match Factory!", franchise="MATCHFACTORY", label="ZYNGA",
         genre="Mobile Puzzle", release_date="2023-01-01", lifecycle_status="LIVE",
         monetization_model="FREE_TO_PLAY_IAP", current_season=None),
    dict(game_id="game-toon-blast", title="Toon Blast", franchise="TOONBLAST", label="ZYNGA",
         genre="Mobile Puzzle", release_date="2017-02-01", lifecycle_status="LIVE",
         monetization_model="FREE_TO_PLAY_IAP", current_season=None),
    dict(game_id="game-csr2", title="CSR Racing 2", franchise="CSR2", label="ZYNGA",
         genre="Mobile Racing", release_date="2016-06-29", lifecycle_status="LIVE",
         monetization_model="FREE_TO_PLAY_IAP", current_season=None),
    dict(game_id="game-empires-puzzles", title="Empires & Puzzles", franchise="EMPIRES", label="ZYNGA",
         genre="Puzzle RPG", release_date="2017-03-01", lifecycle_status="LIVE",
         monetization_model="FREE_TO_PLAY_IAP", current_season=None),
    dict(game_id="game-zynga-poker", title="Zynga Poker", franchise="ZPOKER", label="ZYNGA",
         genre="Social Casino", release_date="2007-07-01", lifecycle_status="LIVE",
         monetization_model="FREE_TO_PLAY_IAP", current_season=None),
]
for g in NEW_GAMES:
    g.update(active_players=None, is_parent_hub=True, parent_game_id=None)
    FR_TO_GAME[g["franchise"]] = g["game_id"]
GAME_BY_FR = {g["franchise"]: g for g in NEW_GAMES}
ROCKSTAR_PLAYABLE = ["GTAO", "RDO"]
ZYNGA_TITLES = ["WWF", "MATCHFACTORY", "TOONBLAST", "CSR2", "EMPIRES", "ZPOKER"]


def studio_of(fr):
    if fr in TWOK_FRANCHISES:
        return "2K"
    return {"ROCKSTAR": "ROCKSTAR", "ZYNGA": "ZYNGA"}[GAME_BY_FR[fr]["label"]]


# ---------------------------------------------------------------- helpers
def lognorm(median, sigma):
    return median * math.exp(rng.gauss(0, sigma))


def rand_ts(start, end):
    s, e = start.timestamp(), end.timestamp()
    return datetime.fromtimestamp(s + rng.random() * (e - s), tz=timezone.utc)


TAG_A = ["Vice", "Leonida", "Neon", "Night", "Grove", "Vinewood", "Paleto", "Sandy", "Blaine", "Cayo",
         "Outlaw", "Frontier", "Ghost", "Midnight", "Turbo", "Drift", "Nitro", "Chrome", "Royal", "Lucky",
         "Puzzle", "Word", "Tile", "Combo", "Blitz", "Daily", "Queen", "Ace", "Jackpot", "Star",
         "Vespucci", "Mirror", "Strawberry", "Bayou", "Saint", "Valentine", "Rhodes", "Blackwater", "Sunny", "Pixel",
         "Velvet", "Static", "Copper", "Silver", "Golden", "Rapid", "Quiet", "Wild", "Lone", "Big"]
TAG_B = ["Runner", "Hustler", "Kingpin", "Rider", "Bandit", "Racer", "Wheelman", "Heister", "Ranger", "Drifter",
         "Smith", "Wizard", "Master", "Champ", "Fox", "Wolf", "Shark", "Maven", "Pro", "Legend",
         "Viper", "Ghost", "Boss", "Pilot", "Outlaw", "Bishop", "Rook", "Spinner", "Ace", "Duke"]
used_tags = {p["gamer_tag"] for p in players_v2}


def new_tag():
    while True:
        t = rng.choice(TAG_A) + rng.choice(TAG_B)
        r = rng.random()
        if r < 0.45:
            t += str(rng.randint(1, 99))
        elif r < 0.6:
            t += rng.choice(["TTV", "_YT", "Jr", "OG", "x"])
        if t not in used_tags:
            used_tags.add(t)
            return t


DOMAINS = ["gmail.com", "outlook.com", "icloud.com", "yahoo.com", "proton.me"]

ROCKSTAR_ARCH = [("GTAO_HEIST_CREW", 0.27), ("GTAO_BUSINESS_GRINDER", 0.22), ("CAR_MEET_ENTHUSIAST", 0.16),
                 ("RP_COMMUNITY_REGULAR", 0.13), ("SHARK_CARD_SPENDER", 0.10), ("RDO_FRONTIER_ROLEPLAYER", 0.12)]
ZYNGA_ARCH = {"WWF": "WORD_GAME_SOCIALITE", "MATCHFACTORY": "PUZZLE_DAILY_RITUALIST",
              "TOONBLAST": "PUZZLE_DAILY_RITUALIST", "CSR2": "MOBILE_RACER", "EMPIRES": "RPG_PUZZLE_ALLIANCE",
              "ZPOKER": "SOCIAL_CASINO_REGULAR"}


def wpick(pairs):
    r, acc = rng.random(), 0.0
    tot = sum(w for _, w in pairs)
    for v, w in pairs:
        acc += w / tot
        if r <= acc:
            return v
    return pairs[-1][0]


geo_pool = [(p["country"], p["country_code"], p["country_flag"], p["dma_market"], p["lat"], p["lng"]) for p in players_v2]

# ---------------------------------------------------------------- new players
N_ROCKSTAR = {"GTAO": 12500, "RDO": 3500}
N_ZYNGA = {"WWF": 3600, "MATCHFACTORY": 3400, "TOONBLAST": 2800, "CSR2": 2200, "EMPIRES": 1600, "ZPOKER": 1400}

new_players = []
plays = {}  # (player_id, franchise) -> edge dict (before game_id mapping)


def add_play(pid, fr, hours, spend, first, via="ORGANIC", last=None):
    key = (pid, fr)
    if key in plays:
        return plays[key]
    e = dict(player_id=pid, franchise=fr, hours_played=round(hours, 1), spend_usd=round(spend, 2),
             first_played_at=first, acquired_via=via, last_played_at=last)
    plays[key] = e
    plays_by_fr[fr].append(pid)
    plays_by_pid[pid].append((fr, e))
    return e


plays_by_fr = defaultdict(list)
plays_by_pid = defaultdict(list)


def make_player(pid, studio, primary_fr, arch, platform):
    c, cc, flag, dma, lat, lng = rng.choice(geo_pool)
    tag = new_tag()
    tenure = int(lognorm(900 if studio == "ROCKSTAR" else 700, 0.6))
    tenure = max(30, min(tenure, 4600))
    age = int(max(16, min(64, rng.gauss(29 if studio == "ROCKSTAR" else 38, 9))))
    return dict(
        player_id=pid, display_name=tag, gamer_tag=tag,
        primary_email=f"{tag[0].lower()}***@{rng.choice(DOMAINS)}",
        primary_franchise=primary_fr, franchises_played=[primary_fr], primary_archetype=arch,
        age=age, gender=rng.choice(["male"] * (7 if studio == "ROCKSTAR" else 4) + ["female"] * (3 if studio == "ROCKSTAR" else 6)),
        account_tenure_days=tenure, currency_balance=0, lifetime_spend_usd=0.0,
        churn_risk_score=0.0, tilt_sensitivity=round(rng.uniform(0.05, 0.6), 2), recent_loss_streak=0,
        country=c, country_code=cc, country_flag=flag, dma_market=dma, lat=lat, lng=lng,
        primary_creator_influence=None, followed_creators=[], game_telemetry={"platform": platform},
        purchased_items=[], last_active_at=None, churned_at=None, session_min_7d=None, session_min_prev_7d=None,
        community_id=None, wnba_affinity=None, franchise_mode_affinity=None, college_hoops_affinity=None,
        _studio=studio,
    )


i = 0
for fr, n in N_ROCKSTAR.items():
    for _ in range(n):
        i += 1
        pid = f"t2-rsg-{i:05d}"
        arch = "RDO_FRONTIER_ROLEPLAYER" if fr == "RDO" and rng.random() < 0.7 else wpick(ROCKSTAR_ARCH[:-1] if fr == "GTAO" else ROCKSTAR_ARCH)
        plat = wpick([("PlayStation 5", 0.46), ("Xbox Series X|S", 0.27), ("PC (Steam)", 0.17), ("PC (Rockstar Launcher)", 0.10)])
        p = make_player(pid, "ROCKSTAR", fr, arch, plat)
        new_players.append(p)
        payer = rng.random() < (0.62 if arch == "SHARK_CARD_SPENDER" else 0.33)
        spend = lognorm(55 if arch != "SHARK_CARD_SPENDER" else 180, 0.9) if payer else 0.0
        first = AS_OF - timedelta(days=p["account_tenure_days"])
        add_play(pid, fr, lognorm(240 if fr == "GTAO" else 140, 0.8), spend, first)
        if fr == "GTAO" and rng.random() < 0.18:
            add_play(pid, "RDO", lognorm(60, 0.8), lognorm(15, 0.8) if rng.random() < 0.2 else 0.0, rand_ts(first, AS_OF - timedelta(days=20)))
        if fr == "RDO" and rng.random() < 0.55:
            add_play(pid, "GTAO", lognorm(120, 0.8), lognorm(35, 0.9) if rng.random() < 0.3 else 0.0, rand_ts(first, AS_OF - timedelta(days=20)))

j = 0
for fr, n in N_ZYNGA.items():
    for _ in range(n):
        j += 1
        pid = f"t2-zng-{j:05d}"
        plat = wpick([("iOS", 0.55), ("Android", 0.40), ("Web", 0.05)])
        p = make_player(pid, "ZYNGA", fr, ZYNGA_ARCH[fr], plat)
        new_players.append(p)
        payer = rng.random() < {"ZPOKER": 0.30, "EMPIRES": 0.32, "CSR2": 0.26}.get(fr, 0.17)
        spend = lognorm({"ZPOKER": 60, "EMPIRES": 70, "CSR2": 45}.get(fr, 22), 1.0) if payer else 0.0
        first = AS_OF - timedelta(days=p["account_tenure_days"])
        add_play(pid, fr, lognorm(160, 0.8), spend, first)
        # Zynga players commonly run 2 titles in the same genre family.
        if rng.random() < 0.30:
            sib = {"MATCHFACTORY": "TOONBLAST", "TOONBLAST": "MATCHFACTORY", "WWF": "MATCHFACTORY",
                   "CSR2": "EMPIRES", "EMPIRES": "TOONBLAST", "ZPOKER": "WWF"}[fr]
            add_play(pid, sib, lognorm(70, 0.8), lognorm(15, 0.8) if rng.random() < 0.12 else 0.0, rand_ts(first, AS_OF - timedelta(days=10)))

new_by_id = {p["player_id"]: p for p in new_players}
rockstar_ids = [p["player_id"] for p in new_players if p["_studio"] == "ROCKSTAR"]
zynga_ids = [p["player_id"] for p in new_players if p["_studio"] == "ZYNGA"]

# ---------------------------------------------------------------- 2K edges (enriched)
twok_edges_by_player = defaultdict(list)
for e in edges_v1:
    twok_edges_by_player[e["player_id"]].append(e)
for pid, es in twok_edges_by_player.items():
    p = by_id[pid]
    tot_h = sum(max(1.0, float(e.get("hours_played") or 0)) for e in es)
    for e in es:
        share = max(1.0, float(e.get("hours_played") or 0)) / tot_h
        fr = next((g["franchise"] for g in games_v1 if g["game_id"] == e["game_id"]), None)
        first = AS_OF - timedelta(days=int((p.get("account_tenure_days") or 365) * rng.uniform(0.3, 1.0)))
        e2 = dict(player_id=pid, game_id=e["game_id"], hours_played=e.get("hours_played"),
                  last_played_timestamp=e.get("last_played_timestamp"),
                  spend_usd=round(float(p["lifetime_spend_usd"]) * share, 2), first_played_at=iso(first),
                  acquired_via="ORGANIC")
        plays[(pid, "__v1__" + e["game_id"])] = e2

# ---------------------------------------------------------------- social layer
friends = set()


def befriend(a, b):
    if a == b:
        return False
    k = (a, b) if a < b else (b, a)
    if k in friends:
        return False
    friends.add(k)
    return True


existing_friends = defaultdict(set)
for f in friends_v2:
    existing_friends[f["player_id"]].add(f["other_player_id"])
    existing_friends[f["other_player_id"]].add(f["player_id"])

# Within-studio friendships among new players (title communities).
by_primary = defaultdict(list)
for p in new_players:
    by_primary[p["primary_franchise"]].append(p["player_id"])
for fr, ids in by_primary.items():
    for pid in ids:
        for _ in range(rng.randint(2, 7)):
            befriend(pid, rng.choice(ids))
for pid in rockstar_ids:
    if rng.random() < 0.35:
        befriend(pid, rng.choice(rockstar_ids))
for pid in zynga_ids:
    if rng.random() < 0.25:
        befriend(pid, rng.choice(zynga_ids))

# Adjacency over ALL friendships (v2 + new), maintained as we go.
adj = defaultdict(set)
for a, bs in existing_friends.items():
    adj[a] |= bs
for a, b in friends:
    adj[a].add(b)
    adj[b].add(a)


def link(a, b):
    if befriend(a, b):
        adj[a].add(b)
        adj[b].add(a)


def players_of(fr):
    return plays_by_fr[fr]


# ---------------------------------------------------------------- cross-studio adoption
invited = []
overrides = {}
wishlisted = []
cross_adopters = defaultdict(set)  # franchise -> pids adopting from another studio


def adopt(pid, fr, via_invite_prob, hours_med, spend_med, payer_prob, earliest):
    """Player pid (from another studio) adopts title fr. Friend-driven when possible."""
    title_players = players_of(fr)
    first = rand_ts(max(earliest, AS_OF - timedelta(days=420)), AS_OF - timedelta(days=3))
    via = "ORGANIC"
    inviter = None
    if rng.random() < via_invite_prob:
        friends_in = [f for f in adj[pid] if (f, fr) in plays]
        inviter = rng.choice(friends_in) if friends_in else rng.choice(title_players)
        link(pid, inviter)
        via = "FRIEND_INVITE"
    elif rng.random() < 0.2:
        # Some organic adopters already knew people there (homophily).
        link(pid, rng.choice(title_players))
    else:
        via = rng.choice(["CROSS_PROMO", "CREATOR", "ORGANIC", "ORGANIC"])
    spend = lognorm(spend_med, 0.9) * 1.25 if rng.random() < payer_prob else 0.0
    add_play(pid, fr, lognorm(hours_med, 0.8), spend, first, via)
    cross_adopters[fr].add(pid)
    if inviter:
        invited.append(dict(player_id=inviter, invitee_id=pid,
                            from_game_id=None, to_game_id=FR_TO_GAME[fr],
                            invited_at=iso(first - timedelta(days=rng.randint(0, 6), hours=rng.randint(1, 20))),
                            accepted=True))
    return first


# 2K -> Rockstar / Zynga, driven by the existing telemetry flags so the 2K data
# stays self-consistent (rockstar_linked, gta_online_spend_usd, zynga_linked).
for p in players_v2:
    t = p["game_telemetry"]
    pid = p["player_id"]
    earliest = AS_OF - timedelta(days=p.get("account_tenure_days") or 365)
    added = []
    # Planted: players who arrived through a friend's invite stick around more.
    # The 2K churn data is fixed, so the association is planted on the invite
    # side: still-active 2K players are more likely to have been invited.
    inv_p = 0.40 if p.get("churned_at") is None else 0.24
    if t.get("rockstar_linked"):
        if rng.random() < 0.88 or (t.get("gta_online_spend_usd") or 0) > 0:
            adopt(pid, "GTAO", inv_p, 150, max(10.0, float(t.get("gta_online_spend_usd") or 30)), 0.9 if (t.get("gta_online_spend_usd") or 0) > 0 else 0.0, earliest)
            # Respect the telemetry spend exactly when present.
            if (t.get("gta_online_spend_usd") or 0) > 0:
                plays[(pid, "GTAO")]["spend_usd"] = round(float(t["gta_online_spend_usd"]), 2)
            added.append("GTAO")
        if rng.random() < 0.22:
            adopt(pid, "RDO", inv_p * 0.8, 70, 20, 0.15, earliest)
            added.append("RDO")
    if t.get("zynga_linked"):
        arch = p["primary_archetype"]
        pool = [("MATCHFACTORY", 3), ("TOONBLAST", 2), ("WWF", 2), ("CSR2", 2), ("EMPIRES", 1), ("ZPOKER", 1)]
        if arch == "MOBILE_DAILY_RITUALIST":
            pool = [("MATCHFACTORY", 4), ("TOONBLAST", 3), ("WWF", 2), ("CSR2", 1)]
        elif arch in ("PARK_REP_GRINDER", "REC_CREW_CAPTAIN", "RAGE_QUIT_TILT_RISK"):
            pool = [("CSR2", 4), ("EMPIRES", 2), ("MATCHFACTORY", 1), ("ZPOKER", 1)]
        for _ in range(1 if rng.random() < 0.7 else 2):
            fr = wpick(pool)
            if (pid, fr) not in plays:
                adopt(pid, fr, inv_p * 0.65, 80, 20, 0.2, earliest)
                added.append(fr)
    if t.get("gta6_preorder"):
        wishlisted.append(dict(player_id=pid, game_id="game-gta6",
                               wishlisted_at=iso(rand_ts(datetime(2025, 5, 6, tzinfo=timezone.utc), AS_OF - timedelta(days=1))),
                               store=wpick([("PlayStation Store", 0.55), ("Microsoft Store", 0.30), ("Rockstar Store", 0.15)])))
    if added:
        overrides[pid] = sorted(set(p["franchises_played"]) | set(added), key=lambda f: (f not in TWOK_FRANCHISES, f))

# Rockstar -> 2K, Rockstar -> Zynga
twok_pool_by_fr = defaultdict(list)
for p in players_v2:
    twok_pool_by_fr[p["primary_franchise"]].append(p["player_id"])


def adopt_2k(pid, fr, via_invite_prob, earliest):
    """A Rockstar/Zynga player picks up a 2K title (needs a 2K Account)."""
    first = rand_ts(max(earliest, AS_OF - timedelta(days=500)), AS_OF - timedelta(days=3))
    via = "ORGANIC"
    inviter = None
    pool = twok_pool_by_fr.get(fr) or twok_pool_by_fr["NBA2K"]
    if rng.random() < via_invite_prob:
        friends_in = [f for f in adj[pid] if f in by_id and fr in by_id[f]["franchises_played"]]
        inviter = rng.choice(friends_in) if friends_in else rng.choice(pool)
        link(pid, inviter)
        via = "FRIEND_INVITE"
    elif rng.random() < 0.1:
        link(pid, rng.choice(pool))
    else:
        via = rng.choice(["CROSS_PROMO", "CREATOR", "ORGANIC"])
    spend = lognorm(45, 0.9) * 1.25 if rng.random() < 0.45 else 0.0
    add_play(pid, fr, lognorm(110, 0.8), spend, first, via)
    cross_adopters[fr].add(pid)
    if inviter:
        invited.append(dict(player_id=inviter, invitee_id=pid, from_game_id=None, to_game_id=FR_TO_GAME[fr],
                            invited_at=iso(first - timedelta(days=rng.randint(0, 6), hours=rng.randint(1, 20))),
                            accepted=True))


for pid in rockstar_ids:
    p = new_by_id[pid]
    earliest = AS_OF - timedelta(days=p["account_tenure_days"])
    if rng.random() < 0.12:
        adopt_2k(pid, wpick([("NBA2K", 0.48), ("MAFIA", 0.22), ("BL4", 0.18), ("WWE2K", 0.08), ("NBA2K26", 0.04)]), 0.25, earliest)
    if rng.random() < 0.10:
        adopt(pid, "CSR2" if rng.random() < 0.7 else "ZPOKER", 0.2, 60, 25, 0.25, earliest)
    if (pid, "GTAO") in plays and rng.random() < 0.46:
        wishlisted.append(dict(player_id=pid, game_id="game-gta6",
                               wishlisted_at=iso(rand_ts(datetime(2023, 12, 5, tzinfo=timezone.utc), AS_OF - timedelta(days=1))),
                               store=wpick([("PlayStation Store", 0.55), ("Microsoft Store", 0.30), ("Rockstar Store", 0.15)])))
    elif rng.random() < 0.18:
        wishlisted.append(dict(player_id=pid, game_id="game-gta6",
                               wishlisted_at=iso(rand_ts(datetime(2023, 12, 5, tzinfo=timezone.utc), AS_OF - timedelta(days=1))),
                               store=wpick([("PlayStation Store", 0.55), ("Microsoft Store", 0.30), ("Rockstar Store", 0.15)])))

for pid in zynga_ids:
    p = new_by_id[pid]
    earliest = AS_OF - timedelta(days=p["account_tenure_days"])
    if rng.random() < 0.06:
        adopt_2k(pid, wpick([("NBA2KMOBILE", 0.62), ("NBA2K", 0.18), ("CIV7", 0.20)]), 0.30, earliest)
    if p["primary_franchise"] == "CSR2" and rng.random() < 0.16:
        adopt(pid, "GTAO", 0.3, 90, 30, 0.3, earliest)
    elif rng.random() < 0.03:
        adopt(pid, "GTAO", 0.3, 90, 30, 0.3, earliest)
    if rng.random() < 0.04:
        wishlisted.append(dict(player_id=pid, game_id="game-gta6",
                               wishlisted_at=iso(rand_ts(datetime(2023, 12, 5, tzinfo=timezone.utc), AS_OF - timedelta(days=1))),
                               store=wpick([("PlayStation Store", 0.55), ("Microsoft Store", 0.30), ("Rockstar Store", 0.15)])))

# Background noise: some cross-studio friendships among NON-adopters (so the
# friend-pull lift is a ratio of two real rates, not infinity).
twok_ids = [p["player_id"] for p in players_v2]
for pid in twok_ids:
    if rng.random() < 0.25:
        link(pid, rng.choice(rockstar_ids))
    if rng.random() < 0.12:
        link(pid, rng.choice(zynga_ids))
for pid in rockstar_ids:
    if rng.random() < 0.08:
        link(pid, rng.choice(twok_ids))
    if rng.random() < 0.15:
        link(pid, rng.choice(zynga_ids))
for pid in zynga_ids:
    if rng.random() < 0.05:
        link(pid, rng.choice(twok_ids))

# Super-connectors: a few community regulars (crew leaders, RP server regulars,
# word-game league hosts) with many friends across studios.
for pool, others in ((twok_ids, rockstar_ids + zynga_ids), (rockstar_ids, twok_ids + zynga_ids), (zynga_ids, twok_ids + rockstar_ids)):
    for pid in rng.sample(pool, 40):
        for _ in range(rng.randint(6, 18)):
            link(pid, rng.choice(others))

# Wishlist contagion: friends of wishlisters wishlist a little more often.
wish_set = {w["player_id"] for w in wishlisted}
for pid in twok_ids + rockstar_ids:
    if pid in wish_set:
        continue
    if any(f in wish_set for f in adj[pid]) and rng.random() < 0.07:
        wish_set.add(pid)
        wishlisted.append(dict(player_id=pid, game_id="game-gta6",
                               wishlisted_at=iso(rand_ts(datetime(2025, 5, 6, tzinfo=timezone.utc), AS_OF - timedelta(days=1))),
                               store=wpick([("PlayStation Store", 0.55), ("Microsoft Store", 0.30), ("Rockstar Store", 0.15)])))

# Unaccepted invites (sent, never converted) so acceptance rate is real.
accepted_pairs = {(x["player_id"], x["invitee_id"], x["to_game_id"]) for x in invited}
for _ in range(int(len(invited) * 0.75)):
    src = rng.choice(invited)
    inviter = src["player_id"]
    to_game = src["to_game_id"]
    to_fr = next(f for f, g in FR_TO_GAME.items() if g == to_game)
    cands = [f for f in adj[inviter] if (f, to_fr) not in plays and not (f in by_id and to_fr in by_id[f]["franchises_played"])]
    if not cands:
        continue
    invitee = rng.choice(cands)
    if (inviter, invitee, to_game) in accepted_pairs:
        continue
    accepted_pairs.add((inviter, invitee, to_game))
    invited.append(dict(player_id=inviter, invitee_id=invitee, from_game_id=None, to_game_id=to_game,
                        invited_at=iso(rand_ts(AS_OF - timedelta(days=300), AS_OF - timedelta(days=2))), accepted=False))


# Inviter's "from" title = the inviter's primary franchise game.
def primary_of(pid):
    return (by_id.get(pid) or new_by_id[pid])["primary_franchise"]


for x in invited:
    x["from_game_id"] = FR_TO_GAME[primary_of(x["player_id"])]
# Dedupe on PK (player_id, invitee_id, to_game_id); keep the accepted one.
dedup = {}
for x in sorted(invited, key=lambda r: not r["accepted"]):
    dedup.setdefault((x["player_id"], x["invitee_id"], x["to_game_id"]), x)
invited = list(dedup.values())

# ---------------------------------------------------------------- per-player rollups for new players
studios_of = defaultdict(set)
for (pid, fr), e in list(plays.items()):
    if fr.startswith("__v1__"):
        g = e["game_id"]
        fr2 = next(g2["franchise"] for g2 in games_v1 if g2["game_id"] == g)
        studios_of[pid].add("2K" if fr2 in TWOK_FRANCHISES else studio_of(fr2))
    else:
        studios_of[pid].add(studio_of(fr))

invitees_accepted = {x["invitee_id"] for x in invited if x["accepted"]}
for p in new_players:
    pid = p["player_id"]
    my = plays_by_pid[pid]
    p["franchises_played"] = sorted({fr for fr, _ in my}, key=lambda f: (f != p["primary_franchise"], f))
    multi = len(studios_of[pid]) >= 2
    # Multi-studio players spend more (applied to their primary-title spend).
    if multi:
        prim = plays[(pid, p["primary_franchise"])]
        if prim["spend_usd"] > 0:
            prim["spend_usd"] = round(prim["spend_usd"] * 1.35, 2)
        elif rng.random() < 0.18:
            prim["spend_usd"] = round(lognorm(30, 0.8), 2)
    p["lifetime_spend_usd"] = round(sum(e["spend_usd"] for _, e in my), 2)
    # Churn: base by studio; multi-studio and invited players churn less.
    base = 0.17 if p["_studio"] == "ROCKSTAR" else 0.21
    h = base * (0.6 if multi else 1.0) * (0.6 if pid in invitees_accepted else 1.0)
    cross_friends = sum(1 for f in adj[pid] if (f in by_id) or (f in new_by_id and new_by_id[f]["_studio"] != p["_studio"]))
    if cross_friends >= 3:
        h *= 0.8
    churned = rng.random() < h
    if churned:
        last = rand_ts(AS_OF - timedelta(days=120), AS_OF - timedelta(days=14, hours=1))
        p["churned_at"] = iso(last + timedelta(days=14))
        p["session_min_7d"], p["session_min_prev_7d"] = 0.0, 0.0
    else:
        last = rand_ts(AS_OF - timedelta(days=12), AS_OF - timedelta(minutes=5))
        s = lognorm(320 if p["_studio"] == "ROCKSTAR" else 180, 0.6)
        p["session_min_7d"] = round(s * rng.uniform(0.6, 1.25))
        p["session_min_prev_7d"] = round(s)
    p["last_active_at"] = iso(last)
    p["churn_risk_score"] = round(min(0.98, max(0.02, (0.85 if churned else h * 2.2) + rng.uniform(-0.1, 0.1))), 2)
    # Last-played on each edge consistent with last_active_at.
    for _, e in my:
        e["last_played_at"] = iso(min(last, rand_ts(AS_OF - timedelta(days=60), last)) if rng.random() < 0.4 else last)
        if e["first_played_at"] and isinstance(e["first_played_at"], datetime):
            pass
    # Studio-native telemetry (shape mirrors the 2K telemetry keys that matter to NL queries).
    t = p["game_telemetry"]
    t.update(last_login_days_ago=max(0, (AS_OF - last).days), hours_played=int(sum(e["hours_played"] for _, e in my)),
             cross_take_two_studios=len(studios_of[pid]), take_two_account_linked=multi,
             rockstar_linked=any(studio_of(fr) == "ROCKSTAR" for fr, _ in my),
             zynga_linked=any(studio_of(fr) == "ZYNGA" for fr, _ in my),
             gta6_wishlisted=pid in wish_set)
    if p["_studio"] == "ROCKSTAR":
        t.update(gtao_rank=int(lognorm(140, 0.7)) if (pid, "GTAO") in plays else None,
                 gta_plus_member=rng.random() < (0.45 if p["primary_archetype"] == "SHARK_CARD_SPENDER" else 0.14),
                 gta_online_spend_usd=round(plays[(pid, "GTAO")]["spend_usd"], 2) if (pid, "GTAO") in plays else 0.0,
                 owned_businesses=rng.randint(0, 9) if p["primary_archetype"] in ("GTAO_BUSINESS_GRINDER", "SHARK_CARD_SPENDER") else rng.randint(0, 3),
                 heists_completed_30d=rng.randint(0, 25) if p["primary_archetype"] == "GTAO_HEIST_CREW" else rng.randint(0, 5),
                 rdo_role=rng.choice(["Bounty Hunter", "Trader", "Collector", "Moonshiner", "Naturalist"]) if (pid, "RDO") in plays else None)
        p["currency_balance"] = int(lognorm(1_200_000, 1.0))
    else:
        t.update(zynga_daily_streak=int(lognorm(25, 1.0)) if not churned else 0,
                 games_started_30d=int(lognorm(60, 0.7)) if not churned else 0,
                 iap_spend_90d=round(sum(e["spend_usd"] for _, e in my) * rng.uniform(0.1, 0.4), 2),
                 ad_views_30d=int(lognorm(140, 0.8)) if not churned else 0)
        p["currency_balance"] = int(lognorm(3_000, 1.0))

for p in new_players:
    p.pop("_studio", None)

# ---------------------------------------------------------------- crews + co-play (Rockstar / Zynga)
# GTA Online crews, Red Dead Online posses, Empires & Puzzles alliances,
# Match Factory! / Toon Blast teams, CSR Racing 2 crews. Words With Friends and
# Zynga Poker have no crews; their co-play is with friends.
CREW_SPEC = {
    "GTAO": dict(join=0.55, median=14, lo=4, hi=60, tier=["Casual", "Competitive"],
                 a=["Vinewood", "Paleto", "Vespucci", "Cayo", "Sandy Shores", "Del Perro", "Mirror Park", "Leonida", "Vice", "Chumash", "Grapeseed", "La Mesa"],
                 b=["Syndicate", "Outlaws", "Motor Club", "Heist Crew", "Collective", "Kings", "Riders", "Union", "Cartel", "Customs"]),
    "RDO": dict(join=0.50, median=4, lo=2, hi=7, tier=["Posse"],
                a=["Blackwater", "Valentine", "Rhodes", "Strawberry", "Annesburg", "Tumbleweed", "Saint Denis", "Emerald"],
                b=["Posse", "Gang", "Riders", "Outfit", "Company", "Boys"]),
    "EMPIRES": dict(join=0.70, median=22, lo=8, hi=30, tier=["Alliance"],
                    a=["Iron", "Crimson", "Northern", "Golden", "Shadow", "Silver", "Ember", "Frost"],
                    b=["Legion", "Order", "Vanguard", "Wardens", "Covenant", "Banner"]),
    "MATCHFACTORY": dict(join=0.35, median=20, lo=5, hi=50, tier=["Team"],
                         a=["Cozy", "Sunny", "Tidy", "Lucky", "Happy", "Quick", "Bright"],
                         b=["Matchers", "Sorters", "Crew", "Club", "Squad", "Circle"]),
    "TOONBLAST": dict(join=0.40, median=20, lo=5, hi=50, tier=["Team"],
                      a=["Toon", "Blast", "Boom", "Pop", "Fizz", "Zap", "Bubble"],
                      b=["Busters", "Squad", "Club", "Gang", "Team", "Pals"]),
    "CSR2": dict(join=0.45, median=16, lo=4, hi=32, tier=["Crew"],
                 a=["Nitro", "Apex", "Redline", "Torque", "Boost", "Quarter Mile", "Launch"],
                 b=["Crew", "Racing", "Garage", "Motorsport", "Syndicate", "Club"]),
}
clans_out, member_out, played_with_out, messaged_out = [], [], {}, []
used_crew_names = set()


def crew_name(spec):
    for _ in range(50):
        n = f"{rng.choice(spec['a'])} {rng.choice(spec['b'])}"
        if n not in used_crew_names:
            used_crew_names.add(n)
            return n
    n = f"{rng.choice(spec['a'])} {rng.choice(spec['b'])} {rng.randint(2, 99)}"
    used_crew_names.add(n)
    return n


def coplay(a, b, games30, total, last, same):
    # PlayedWith between two 2K players already exists in data/v2; never duplicate it.
    if a == b or (a not in new_by_id and b not in new_by_id):
        return
    k = (a, b) if a < b else (b, a)
    cur = played_with_out.get(k)
    if cur:
        cur["games_together_30d"] += games30
        cur["games_together_total"] += total
        cur["same_crew"] = cur["same_crew"] or same
        return
    played_with_out[k] = dict(player_id=k[0], other_player_id=k[1], games_together_30d=games30,
                              games_together_total=total, last_played_at=last, same_crew=same)


crew_seq = 0
for fr, spec in CREW_SPEC.items():
    pool = [pid for pid in by_primary.get(fr, []) if rng.random() < spec["join"]]
    rng.shuffle(pool)
    i0 = 0
    while i0 < len(pool):
        size = int(max(spec["lo"], min(spec["hi"], lognorm(spec["median"], 0.55))))
        members = pool[i0:i0 + size]
        i0 += size
        if len(members) < 2:
            break
        crew_seq += 1
        cid = f"crew-{fr.lower()}-{crew_seq:04d}"
        c0 = rng.choice(geo_pool)
        # Co-play inside the crew: weighted, with a few hubs who play with everyone.
        deg = defaultdict(float)
        hubs = set(rng.sample(members, max(1, len(members) // 8)))
        for m in members:
            k = min(len(members) - 1, rng.randint(2, 6) + (len(members) // 3 if m in hubs else 0))
            for o in rng.sample([x for x in members if x != m], k):
                g30 = rng.randint(1, 14) + (6 if m in hubs else 0)
                coplay(m, o, g30, g30 + rng.randint(5, 90), iso(rand_ts(AS_OF - timedelta(days=20), AS_OF - timedelta(hours=2))), True)
                deg[m] += g30
                deg[o] += g30
                if rng.random() < 0.55:
                    link(m, o)
        mx = max(deg.values()) if deg else 1.0
        active_n = 0
        for j, m in enumerate(sorted(members, key=lambda x: -deg.get(x, 0))):
            left = rng.random() < 0.10
            joined = rand_ts(AS_OF - timedelta(days=700), AS_OF - timedelta(days=15))
            left_at = rand_ts(joined + timedelta(days=5), AS_OF - timedelta(days=1)) if left else None
            active_n += 0 if left else 1
            member_out.append(dict(player_id=m, clan_id=cid, role="CAPTAIN" if j == 0 else ("CO_CAPTAIN" if j <= max(1, len(members) // 10) else "MEMBER"),
                                   joined_at=iso(joined), left_at=iso(left_at) if left_at else None, is_active=not left,
                                   crew_centrality=round(deg.get(m, 0) / mx, 3) if mx else 0.0))
        clans_out.append(dict(clan_id=cid, name=crew_name(spec), franchise=fr, region=c0[0], tier=rng.choice(spec["tier"]), member_count=active_n))

# Public-lobby co-play for GTA Online / Red Dead Online players outside crews,
# and friend-to-friend co-play for Words With Friends / Zynga Poker.
by_title_players = defaultdict(list)
for (pid, fr), e in plays.items():
    if not fr.startswith("__v1__"):
        by_title_players[fr].append(pid)
for fr in ("GTAO", "RDO"):
    ids = by_title_players[fr]
    for pid in ids:
        if rng.random() < 0.6:
            for o in rng.sample(ids, rng.randint(1, 3)):
                if o != pid:
                    g = rng.randint(1, 6)
                    coplay(pid, o, g, g + rng.randint(0, 20), iso(rand_ts(AS_OF - timedelta(days=30), AS_OF - timedelta(hours=3))), False)
for fr in ("WWF", "ZPOKER"):
    title_set = set(by_title_players[fr])
    for pid in by_title_players[fr]:
        for o in list(adj[pid])[:6]:
            if o in title_set:
                g = rng.randint(2, 30)
                coplay(pid, o, g, g + rng.randint(5, 200), iso(rand_ts(AS_OF - timedelta(days=10), AS_OF - timedelta(hours=1))), False)

# Messages: a share of new-player friendships chat (in-game / Social Club / Zynga chat).
new_ids = set(new_by_id)
for a, b in sorted(friends):
    if (a in new_ids or b in new_ids) and rng.random() < 0.3:
        messaged_out.append(dict(player_id=a, other_player_id=b, msg_count_30d=int(lognorm(9, 1.0)) + 1,
                                 last_msg_at=iso(rand_ts(AS_OF - timedelta(days=30), AS_OF - timedelta(minutes=10)))))

# ---------------------------------------------------------------- purchases (Rockstar / Zynga)
# Product names follow the titles' real storefront types; per-pack amounts are
# not modelled (vc_price NULL), only the USD the player spent.
ITEMS = {
    "GTAO": [("item-gtao-shark-tiger", "Tiger Shark Card", "CURRENCY", 2.99), ("item-gtao-shark-bull", "Bull Shark Card", "CURRENCY", 4.99),
             ("item-gtao-shark-greatwhite", "Great White Shark Card", "CURRENCY", 9.99), ("item-gtao-shark-whale", "Whale Shark Card", "CURRENCY", 19.99),
             ("item-gtao-shark-megalodon", "Megalodon Shark Card", "CURRENCY", 39.99), ("item-gtao-gtaplus", "GTA+ Membership (1 month)", "SUBSCRIPTION", 7.99)],
    "RDO": [("item-rdo-gold-25", "Gold Bars (25)", "CURRENCY", 2.99), ("item-rdo-gold-55", "Gold Bars (55)", "CURRENCY", 4.99),
            ("item-rdo-gold-150", "Gold Bars (150)", "CURRENCY", 9.99)],
    "WWF": [("item-wwf-coins-s", "Words With Friends Coin Pack", "CURRENCY", 4.99), ("item-wwf-noads", "Words With Friends Ad-Free", "SUBSCRIPTION", 9.99)],
    "MATCHFACTORY": [("item-mf-coins", "Match Factory! Coin Pack", "CURRENCY", 4.99), ("item-mf-pass", "Match Factory! Season Pass", "PASS", 7.99)],
    "TOONBLAST": [("item-tb-coins", "Toon Blast Coin Pack", "CURRENCY", 4.99), ("item-tb-bundle", "Toon Blast Booster Bundle", "BUNDLE", 9.99)],
    "CSR2": [("item-csr2-gold", "CSR Racing 2 Gold Pack", "CURRENCY", 9.99), ("item-csr2-pass", "CSR Racing 2 Season Pass", "PASS", 9.99)],
    "EMPIRES": [("item-ep-gems", "Empires & Puzzles Gem Pack", "CURRENCY", 9.99), ("item-ep-bundle", "Empires & Puzzles Hero Bundle", "BUNDLE", 19.99)],
    "ZPOKER": [("item-zp-chips", "Zynga Poker Chip Pack", "CURRENCY", 9.99), ("item-zp-vip", "Zynga Poker VIP Pass", "PASS", 14.99)],
}
items_out = [dict(item_id=i, name=n, item_type=t, brand_id=None, is_branded=False, vc_price=None) for fr in ITEMS for (i, n, t, _) in ITEMS[fr]]
bought_out = []
seen_buy = set()
for (pid, fr), e in plays.items():
    if fr.startswith("__v1__") or fr not in ITEMS or e["spend_usd"] <= 0:
        continue
    budget = e["spend_usd"]
    first = e["first_played_at"]
    first = first if isinstance(first, datetime) else datetime.fromisoformat(str(first).replace("Z", "+00:00"))
    start = max(first, AS_OF - timedelta(days=400))
    n = 0
    while budget > 1 and n < 14:
        iid, _, _, price = rng.choice(ITEMS[fr])
        if price > budget * 1.2 and n > 0:
            break
        at = rand_ts(start, AS_OF - timedelta(hours=1))
        k = (pid, iid, iso(at))
        if k in seen_buy:
            continue
        seen_buy.add(k)
        bought_out.append(dict(player_id=pid, item_id=iid, bought_at=iso(at), vc_amount=None, via_activation_id=None))
        budget -= price
        n += 1

# ---------------------------------------------------------------- identities
identities, has_identity = [], []


def ident(pid, platform, handle, conf):
    iid = f"id-{pid}-{platform.lower().replace(' ', '-').replace('|', '')[:24]}"
    identities.append(dict(identity_id=iid, platform=platform, platform_handle=handle, confidence_score=conf))
    has_identity.append(dict(player_id=pid, identity_id=iid, confidence_score=conf))


for p in new_players:
    pid, tag = p["player_id"], p["gamer_tag"]
    t = p["game_telemetry"]
    if t["rockstar_linked"]:
        ident(pid, "Rockstar Games Social Club", tag, 0.99)
    if t["zynga_linked"]:
        ident(pid, "Zynga Account", tag, 0.98)
    if any(f in TWOK_FRANCHISES for f in p["franchises_played"]):
        ident(pid, "2K Account", tag, 0.99)
    plat = t["platform"]
    if plat.startswith("PlayStation"):
        ident(pid, "PlayStation Network", tag, round(rng.uniform(0.9, 0.99), 2))
    elif plat.startswith("Xbox"):
        ident(pid, "Xbox Live", tag, round(rng.uniform(0.9, 0.99), 2))
    elif "Steam" in plat:
        ident(pid, "Steam", tag, round(rng.uniform(0.88, 0.98), 2))
    elif plat == "iOS":
        ident(pid, "Apple Game Center", tag, round(rng.uniform(0.85, 0.97), 2))
    elif plat == "Android":
        ident(pid, "Google Play Games", tag, round(rng.uniform(0.85, 0.97), 2))

for pid, frs in overrides.items():
    tag = by_id[pid]["gamer_tag"]
    if any(studio_of(f) == "ROCKSTAR" for f in frs if f not in TWOK_FRANCHISES):
        ident(pid, "Rockstar Games Social Club", tag, round(rng.uniform(0.93, 0.99), 2))
    if any(studio_of(f) == "ZYNGA" for f in frs if f not in TWOK_FRANCHISES):
        ident(pid, "Zynga Account", tag, round(rng.uniform(0.9, 0.98), 2))

# ---------------------------------------------------------------- daily sessions per title (BigQuery only)
# One row per (player, title, day) with minutes, for Rockstar / Zynga titles
# (including 2K players who adopted them). Window: 120 days before as-of.
# Retention decays per edge; edges acquired by FRIEND_INVITE decay slower
# (the planted invite-retention effect, visible as curves in BigQuery).
WINDOW_START = (AS_OF - timedelta(days=120)).date()
# Own RNG so session tuning never shifts the graph data generated after it.
srng = random.Random(SEED + 1)
NEW_FR = set(GAME_BY_FR)
sess_path = os.path.join(OUT, "sessions_daily.ndjson")
n_sess = 0
mins_7 = defaultdict(float)
mins_prev7 = defaultdict(float)
last_day = {}
with open(sess_path, "w") as sf:
    for (pid, fr), e in plays.items():
        if fr.startswith("__v1__") or fr not in NEW_FR:
            continue
        p = new_by_id.get(pid) or by_id.get(pid)
        la = datetime.fromisoformat(p["last_active_at"].replace("Z", "+00:00")) if p.get("last_active_at") else AS_OF
        fp = e["first_played_at"]
        fp = fp if isinstance(fp, datetime) else datetime.fromisoformat(str(fp).replace("Z", "+00:00"))
        start = max(fp.date(), WINDOW_START)
        end = min(la.date(), AS_OF.date())
        if end < start:
            continue
        prim = p["primary_franchise"] == fr
        arch = p.get("primary_archetype", "")
        # Daily play probability: home title vs. a title picked up from another studio.
        base = 0.55 if prim else 0.12
        if arch in ("PUZZLE_DAILY_RITUALIST", "WORD_GAME_SOCIALITE", "SOCIAL_CASINO_REGULAR", "MOBILE_DAILY_RITUALIST"):
            base += 0.10 if prim else 0.04
        tau = 60.0 if e["acquired_via"] == "FRIEND_INVITE" else 25.0
        if prim:
            tau = 400.0
        floor = 0.03 if e["acquired_via"] == "FRIEND_INVITE" else 0.01
        med = {"GTAO": 95, "RDO": 70, "WWF": 28, "ZPOKER": 45, "EMPIRES": 40, "CSR2": 30}.get(fr, 25)
        d = start
        age0 = (start - fp.date()).days
        while d <= end:
            age = age0 + (d - start).days
            pday = max(floor, base * math.exp(-age / tau))
            if d == end and end == la.date():
                pday = 1.0  # last active day
            if srng.random() < pday:
                m = round(med * math.exp(srng.gauss(0, 0.6)))
                sf.write(json.dumps(dict(player_id=pid, game_id=FR_TO_GAME[fr], date=d.isoformat(), session_minutes=m)) + "\n")
                n_sess += 1
                dd = (AS_OF.date() - d).days
                if dd < 7:
                    mins_7[pid] += m
                elif dd < 14:
                    mins_prev7[pid] += m
            d += timedelta(days=1)
print(f"  sessions_daily rows: {n_sess}")
for p in new_players:
    pid = p["player_id"]
    p["session_min_7d"] = round(mins_7.get(pid, 0.0))
    p["session_min_prev_7d"] = round(mins_prev7.get(pid, 0.0))

# ---------------------------------------------------------------- PlaysGame (full set for t2 DB)
plays_out = []
for (pid, fr), e in plays.items():
    if fr.startswith("__v1__"):
        plays_out.append(e)
        continue
    first = e["first_played_at"]
    plays_out.append(dict(player_id=pid, game_id=FR_TO_GAME[fr], hours_played=e["hours_played"],
                          last_played_timestamp=e["last_played_at"] or iso(AS_OF - timedelta(days=rng.randint(1, 30))),
                          spend_usd=e["spend_usd"], first_played_at=iso(first) if isinstance(first, datetime) else first,
                          acquired_via=e["acquired_via"]))

# For existing 2K players, last_played on new edges must not post-date last_active_at.
for e in plays_out:
    p = by_id.get(e["player_id"])
    if p and e["game_id"] in {g["game_id"] for g in NEW_GAMES}:
        la = datetime.fromisoformat(p["last_active_at"].replace("Z", "+00:00")) if p.get("last_active_at") else AS_OF
        fp = datetime.fromisoformat(e["first_played_at"].replace("Z", "+00:00"))
        if fp > la:
            fp = la - timedelta(days=rng.randint(1, 30))
            e["first_played_at"] = iso(fp)
        e["last_played_timestamp"] = iso(rand_ts(fp, la) if rng.random() < 0.5 else la)

friends_out = [dict(player_id=a, other_player_id=b,
                    since=iso(rand_ts(AS_OF - timedelta(days=900), AS_OF - timedelta(days=1)))) for a, b in sorted(friends)
               if not (b in existing_friends.get(a, set()))]

# ---------------------------------------------------------------- validation printout
print("\nT2 portfolio extension")
print(f"  new players: {len(new_players)}  (Rockstar {len(rockstar_ids)}, Zynga {len(zynga_ids)})")
print(f"  2K players adopting R/Z titles: {len(overrides)}")
print(f"  PlaysGame rows: {len(plays_out)}   new friendships: {len(friends_out)}   invites: {len(invited)} "
      f"(accepted {sum(x['accepted'] for x in invited)})   GTA VI wishlists: {len(wishlisted)}")

all_players = {**{p['player_id']: p for p in players_v2}, **new_by_id}
frs_of = {pid: set(overrides.get(pid, p["franchises_played"])) for pid, p in all_players.items()}
truth = {}
for src, target in [("2K", "GTAO"), ("ROCKSTAR", "NBA2K"), ("ROCKSTAR", "MAFIA"), ("ZYNGA", "NBA2KMOBILE"), ("ZYNGA", "GTAO")]:
    outside = [pid for pid, fs in frs_of.items() if studio_of(all_players[pid]["primary_franchise"]) == src]
    with_f = [pid for pid in outside if any(target in frs_of.get(f, ()) for f in adj[pid])]
    without = [pid for pid in outside if pid not in set(with_f)]
    r1 = sum(target in frs_of[p] for p in with_f) / max(1, len(with_f))
    r0 = sum(target in frs_of[p] for p in without) / max(1, len(without))
    truth[f"friend_pull_{src}_{target}"] = dict(with_friend=round(r1, 3), without=round(r0, 3), lift=round(r1 / r0, 2) if r0 else None,
                                          n_with=len(with_f), n_without=len(without))
    print(f"  friend pull {src:8s}->{target:12s} with friend {r1:.3f} (n={len(with_f)})  without {r0:.3f} (n={len(without)})  lift {r1 / r0 if r0 else float('nan'):.2f}x")

dump("games.json", NEW_GAMES)
dump("players.json", new_players)
dump("player_overrides.json", overrides)
dump("plays_game.json", plays_out)
dump("identities.json", identities)
dump("has_identity.json", has_identity)
dump("friends_with.json", friends_out)
dump("invited.json", invited)
dump("wishlisted.json", wishlisted)
truth.update(seed=SEED, as_of=iso(AS_OF), new_players=len(new_players), twok_cross_adopters=len(overrides))
dump("clans.json", clans_out)
dump("member_of_clan.json", member_out)
dump("played_with.json", list(played_with_out.values()))
dump("messaged.json", messaged_out)
dump("items.json", items_out)
dump("bought.json", bought_out)
dump("planted_truth.json", truth)
