#!/usr/bin/env python3
"""
Validate the 2K Courtside v2 dataset (data/v2/*) and measure every planted
effect from docs/v2/CONTRACT.md §1 with 95% confidence intervals.

All effects are re-measured from the OUTPUT tables only (never from the
generator's ground truth), using the same definitions the app endpoints use:

  churn exposure   discrete-time person-day hazard (days 14..89 of the window).
                   Event: churned_at falls on day t. Exposed on day t: >=1
                   PLAYED_WITH neighbour (undirected) has churned_at in [t-14, t-1].
                   Crude rate ratio + Mantel-Haenszel RR stratified by archetype.
  anchor dependency crews whose top-centrality member (crew_centrality = 1.0 at
                   departure) left 14-60 days before as-of. Index T = left_at.
                   Members active in the crew at T with >=1 session in [T-7, T-1];
                   D14 retained = >=1 session in days [T+7, T+13]. Controls: up to
                   3 crews of the same franchise (same tier preferred, closest
                   size) with no top-member departure in [T-60d, T+14d], same T.
                   lift = (ret_treated - ret_control) / ret_control; matched-set
                   bootstrap CI (2,000 reps).
  keystones        active members with crew_centrality >= 0.9 (top decile of the
                   0-1 scale); declining = not churned, prev_7d > 0 and
                   session_min_7d / session_min_prev_7d < 0.7.
  lost core        crews with a LEAVE event in the last 7 days by the member who
                   was top-centrality at that moment.
  creator lift     per creator: treated = watched >=20 min of one of its streams
                   that featured an offer, stream day t <= as-of - 30 (first such
                   stream). Eligible = >=1 session in [t-7, t-1]. D30 active =
                   >=1 session in [t+24, t+30]. Controls = never watched that
                   creator, eligible at t, exact-matched on archetype and the
                   number of session days in [t-14, t-1] (4 buckets), up to 3:1.
  branded attach   unit = (NBA player, brand). attach = bought the brand.
                   exposed = >=1 PLAYED_WITH neighbour bought the same brand.
                   multiplier = attach(exposed) / attach(unexposed); log-RR CI.
  creator hubs     rank by hub_score vs rank by followers.

Exit code 1 if any integrity check fails or any effect lands outside the
contract range.
"""
import json
import math
import os
import random
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data", "v2")
UTC = timezone.utc


def load(name):
    with open(os.path.join(D, name), encoding="utf-8") as f:
        return json.load(f)


def ts(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00")) if s else None


truth = load("planted_truth.json")
NOW = ts(truth["now"])
N_DAYS = 90
DAY0 = NOW.replace(hour=0, minute=0, second=0) - timedelta(days=N_DAYS - 1)


def didx(dt):
    return (dt - DAY0).days


players = load("players.json")
clans = load("clans.json")
creators = load("creators.json")
identities = load("identities.json")
has_identity = load("has_identity.json")
members = load("member_of_clan.json")
events = load("crew_membership_events.json")
played_with = load("played_with.json")
friends = load("friends_with.json")
messaged = load("messaged.json")
seasons = load("seasons.json")
matches = load("matches.json")
competed = load("competed_in.json")
in_season = load("in_season.json")
split_from = load("split_from.json")
streams = load("streams.json")
hosted = load("hosted.json")
watched = load("watched.json")
brands = load("brands.json")
activations = load("brand_activations.json")
sponsors = load("sponsors.json")
items = load("items.json")
features = load("features.json")
bought = load("bought.json")
equipped = load("equipped.json")
offers = json.load(open(os.path.join(ROOT, "data", "marketing_offers.json")))
sessions = defaultdict(dict)
n_sessions = 0
with open(os.path.join(D, "sessions_daily.ndjson")) as f:
    for line in f:
        r = json.loads(line)
        d = didx(datetime.strptime(r["date"], "%Y-%m-%d").replace(tzinfo=UTC))
        sessions[r["player_id"]][d] = r["session_minutes"]
        n_sessions += 1

FAIL = []
REPORT = {"as_of": truth["now"], "integrity": {}, "effects": {}, "counts": {}}


def check(name, ok, detail=""):
    REPORT["integrity"][name] = {"ok": bool(ok), "detail": detail}
    print(f"  [{'ok' if ok else 'FAIL'}] {name}" + (f"  ({detail})" if detail else ""))
    if not ok:
        FAIL.append(name)


def in_range(name, value, lo, hi, extra=None):
    ok = value is not None and lo <= value <= hi
    REPORT["effects"][name] = {"value": value, "range": [lo, hi], "ok": ok, **(extra or {})}
    if not ok:
        FAIL.append(f"effect:{name}")
    return "PASS" if ok else "FAIL"


def uniq(rows, keys):
    seen = Counter(tuple(r[k] for k in keys) for r in rows)
    return sum(1 for v in seen.values() if v > 1)


# ---------------------------------------------------------------------------
print("\n== Referential integrity ==")
P = {p["player_id"]: p for p in players}
C = {c["clan_id"] for c in clans}
CR = {c["creator_id"]: c for c in creators}
I = {i["identity_id"] for i in identities}
S = {s["stream_id"]: s for s in streams}
M = {m["match_id"]: m for m in matches}
SE = {s["season_id"] for s in seasons}
B = {b["brand_id"] for b in brands}
IT = {i["item_id"]: i for i in items}
A = {a["activation_id"]: a for a in activations}
O = {o["offer_id"] for o in offers}

check("players == 6,500", len(players) == 6500, str(len(players)))
check("creators == 40", len(creators) == 40, str(len(creators)))
for name, rows, keys in [
    ("Players", players, ["player_id"]), ("Clans", clans, ["clan_id"]), ("Identities", identities, ["identity_id"]),
    ("MemberOfClan", members, ["player_id", "clan_id"]), ("HasIdentity", has_identity, ["player_id", "identity_id"]),
    ("PlayedWith", played_with, ["player_id", "other_player_id"]), ("FriendsWith", friends, ["player_id", "other_player_id"]),
    ("Messaged", messaged, ["player_id", "other_player_id"]), ("CompetedIn", competed, ["clan_id", "match_id"]),
    ("Watched", watched, ["identity_id", "stream_id"]), ("Bought", bought, ["player_id", "item_id", "bought_at"]),
    ("Equipped", equipped, ["player_id", "item_id"]), ("CrewMembershipEvents", events, ["event_id"]),
    ("Matches", matches, ["match_id"]), ("Streams", streams, ["stream_id"]), ("Items", items, ["item_id"]),
]:
    check(f"{name} primary key unique", uniq(rows, keys) == 0)

bad = [r for r in members if r["player_id"] not in P or r["clan_id"] not in C]
check("MemberOfClan refs", not bad, f"{len(bad)} bad")
bad = [r for r in events if r["player_id"] not in P or r["clan_id"] not in C or (r["related_clan_id"] and r["related_clan_id"] not in C)]
check("CrewMembershipEvents refs", not bad, f"{len(bad)} bad")
bad = [r for r in has_identity if r["player_id"] not in P or r["identity_id"] not in I]
check("HasIdentity refs", not bad, f"{len(bad)} bad")
for name, rows in (("PlayedWith", played_with), ("FriendsWith", friends), ("Messaged", messaged)):
    bad_ref = sum(1 for r in rows if r["player_id"] not in P or r["other_player_id"] not in P)
    bad_ord = sum(1 for r in rows if not r["player_id"] < r["other_player_id"])
    self_e = sum(1 for r in rows if r["player_id"] == r["other_player_id"])
    check(f"{name} refs / ordering (player_id < other_player_id) / no self-edges", bad_ref == 0 and bad_ord == 0 and self_e == 0,
          f"refs={bad_ref} order={bad_ord} self={self_e}")
bad = [r for r in competed if r["clan_id"] not in C or r["match_id"] not in M]
check("CompetedIn refs", not bad, f"{len(bad)} bad")
per_match = defaultdict(list)
for r in competed:
    per_match[r["match_id"]].append(r["result"])
bad = [m for m in M if sorted(per_match[m]) != ["L", "W"]]
check("every match has exactly one W and one L crew", not bad, f"{len(bad)} bad")
bad = [r for r in in_season if r["match_id"] not in M or r["season_id"] not in SE or M[r["match_id"]]["season_id"] != r["season_id"]]
check("InSeason refs consistent with Matches.season_id", not bad and len(in_season) == len(matches), f"{len(bad)} bad")
bad = [r for r in split_from if r["clan_id"] not in C or r["parent_clan_id"] not in C or r["clan_id"] == r["parent_clan_id"]]
check("SplitFrom refs", not bad, f"{len(bad)} bad")
bad = [s for s in streams if s["creator_id"] not in CR or (s["featured_offer_id"] and s["featured_offer_id"] not in O)
       or (s["featured_item_id"] and s["featured_item_id"] not in IT)]
check("Streams refs (creator/offer/item)", not bad, f"{len(bad)} bad")
bad = [h for h in hosted if h["creator_id"] not in CR or h["stream_id"] not in S or S[h["stream_id"]]["creator_id"] != h["creator_id"]]
check("Hosted refs", not bad and len(hosted) == len(streams), f"{len(bad)} bad")
bad = [w for w in watched if w["identity_id"] not in I or w["stream_id"] not in S]
check("Watched refs", not bad, f"{len(bad)} bad")
bad = [a for a in activations if a["brand_id"] not in B or (a["season_id"] and a["season_id"] not in SE)]
check("BrandActivations refs", not bad, f"{len(bad)} bad")
bad = [s for s in sponsors if s["brand_id"] not in B or s["activation_id"] not in A or A[s["activation_id"]]["brand_id"] != s["brand_id"]]
check("Sponsors refs", not bad, f"{len(bad)} bad")
bad = [f for f in features if f["activation_id"] not in A or f["item_id"] not in IT]
check("Features refs", not bad, f"{len(bad)} bad")
bad = [i for i in items if (i["brand_id"] is not None) != i["is_branded"] or (i["brand_id"] and i["brand_id"] not in B)]
check("Items brand consistency", not bad, f"{len(bad)} bad")
bad = [b for b in bought if b["player_id"] not in P or b["item_id"] not in IT or (b["via_activation_id"] and b["via_activation_id"] not in A)]
check("Bought refs", not bad, f"{len(bad)} bad")
bought_pairs = {(b["player_id"], b["item_id"]) for b in bought}
bad = [e for e in equipped if (e["player_id"], e["item_id"]) not in bought_pairs]
check("Equipped only bought items", not bad, f"{len(bad)} bad")
bad = [p for p in players for c in (p.get("followed_creators") or []) if c not in CR]
check("Players.followed_creators resolve", not bad, f"{len(bad)} bad")
bad = [b for b in brands if "synthetic" in json.dumps(b).lower()]
check("Brands not labelled synthetic", not bad)

print("\n== Timestamps & derived-field consistency ==")
fut = []
for name, rows, fields in [
    ("MemberOfClan", members, ["joined_at", "left_at"]), ("CrewMembershipEvents", events, ["occurred_at"]),
    ("PlayedWith", played_with, ["last_played_at"]), ("FriendsWith", friends, ["since"]), ("Messaged", messaged, ["last_msg_at"]),
    ("Matches", matches, ["played_at"]), ("Streams", streams, ["started_at", "ended_at"]), ("Watched", watched, ["watched_at"]),
    ("Bought", bought, ["bought_at"]), ("Equipped", equipped, ["equipped_at"]), ("SplitFrom", split_from, ["split_at"]),
    ("Players", players, ["last_active_at", "churned_at"]),
]:
    n = sum(1 for r in rows for f in fields if r.get(f) and ts(r[f]) > NOW)
    fut.append(n)
    check(f"{name} timestamps <= as-of", n == 0, f"{n} in future")
bad = [m for m in members if m["left_at"] and ts(m["left_at"]) <= ts(m["joined_at"])]
check("MemberOfClan left_at > joined_at", not bad, f"{len(bad)} bad")
bad = [m for m in members if m["is_active"] != (m["left_at"] is None)]
check("MemberOfClan is_active == (left_at IS NULL)", not bad, f"{len(bad)} bad")
act_crews = Counter(m["player_id"] for m in members if m["is_active"])
check("at most one active crew per player", max(act_crews.values()) == 1)
bad = [m for m in members if not (0.0 <= m["crew_centrality"] <= 1.0)]
check("crew_centrality in [0,1]", not bad)
season_by = {s["season_id"]: s for s in seasons}
bad = [m for m in matches if not (ts(season_by[m["season_id"]]["start_at"]) <= ts(m["played_at"]) <= ts(season_by[m["season_id"]]["end_at"]))]
check("Matches.played_at inside its season", not bad, f"{len(bad)} bad")
bad = [w for w in watched if not (ts(S[w["stream_id"]]["started_at"]) <= ts(w["watched_at"]) <= ts(S[w["stream_id"]]["ended_at"]))]
check("Watched.watched_at inside the stream", not bad, f"{len(bad)} bad")
bad = [b for b in bought if not (DAY0 <= ts(b["bought_at"]) <= NOW)]
check("Bought.bought_at inside the 90-day window", not bad, f"{len(bad)} bad")
dates_ok = all(0 <= d < N_DAYS for s in sessions.values() for d in s)
check("sessions_daily covers exactly the 90-day window", dates_ok)
bad_la = bad_ch = bad_7 = 0
for p in players:
    s = sessions[p["player_id"]]
    la = ts(p["last_active_at"])
    if s and didx(la) != max(s):
        bad_la += 1
    exp_ch = la + timedelta(days=14)
    if (p["churned_at"] is None) != (exp_ch > NOW) or (p["churned_at"] and ts(p["churned_at"]) != exp_ch):
        bad_ch += 1
    if abs(p["session_min_7d"] - sum(v for d, v in s.items() if d >= N_DAYS - 7)) > 1e-6 or \
            abs(p["session_min_prev_7d"] - sum(v for d, v in s.items() if N_DAYS - 14 <= d < N_DAYS - 7)) > 1e-6:
        bad_7 += 1
check("last_active_at == last sessions_daily day", bad_la == 0, f"{bad_la} bad")
check("churned_at == last_active_at + 14d (NULL if active)", bad_ch == 0, f"{bad_ch} bad")
check("session_min_7d / prev_7d match sessions_daily", bad_7 == 0, f"{bad_7} bad")
max_la = max(ts(p["last_active_at"]) for p in players)
check("MAX(last_active_at) falls on the as-of date", max_la.date() == NOW.date(), iso_ := max_la.isoformat())

# ---------------------------------------------------------------------------
counts = {
    "players": len(players), "clans": len(clans), "creators": len(creators), "identities": len(identities),
    "has_identity": len(has_identity), "member_of_clan": len(members), "crew_membership_events": len(events),
    "played_with": len(played_with), "friends_with": len(friends), "messaged": len(messaged), "seasons": len(seasons),
    "matches": len(matches), "competed_in": len(competed), "in_season": len(in_season), "split_from": len(split_from),
    "streams": len(streams), "hosted": len(hosted), "watched": len(watched), "brands": len(brands),
    "brand_activations": len(activations), "sponsors": len(sponsors), "items": len(items), "features": len(features),
    "bought": len(bought), "equipped": len(equipped), "sessions_daily": n_sessions,
    "churned_players": sum(1 for p in players if p["churned_at"]),
}
REPORT["counts"] = counts
print("\n== Volumes ==")
VOL = {"matches": (17000, 23000), "streams": (350, 450), "played_with": (50000, 70000), "friends_with": (20000, 30000),
       "messaged": (12000, 18000), "watched": (25000, 35000), "bought": (15000, 20000)}
for k, v in counts.items():
    rng_ = VOL.get(k)
    flag = "" if not rng_ else (" ok" if rng_[0] <= v <= rng_[1] else " OUT OF RANGE")
    if rng_ and not (rng_[0] <= v <= rng_[1]):
        FAIL.append(f"volume:{k}")
    print(f"  {k:<24}{v:>9,}{flag}")

# ---------------------------------------------------------------------------
nbrs = defaultdict(set)
for r in played_with:
    nbrs[r["player_id"]].add(r["other_player_id"])
    nbrs[r["other_player_id"]].add(r["player_id"])
churn_day = {p["player_id"]: didx(ts(p["churned_at"])) for p in players if p["churned_at"]}
arch = {p["player_id"]: p["primary_archetype"] for p in players}
Z = 1.959964

print("\n== Planted effects (95% CI) ==")

# 1. churn exposure hazard ratio ------------------------------------------------
exp_mask = {}
for pid in P:
    m = bytearray(N_DAYS)
    for q in nbrs[pid]:
        c = churn_day.get(q)
        if c is not None:
            for t in range(c + 1, min(N_DAYS, c + 15)):
                m[t] = 1
    exp_mask[pid] = m
strata = defaultdict(lambda: [0, 0, 0, 0])  # a(events exp), T1, b(events unexp), T0
for pid in P:
    c = churn_day.get(pid)
    last = c if c is not None else N_DAYS - 1
    st = strata[arch[pid]]
    for t in range(14, last + 1):
        e = 1 if (c is not None and t == c) else 0
        if exp_mask[pid][t]:
            st[0] += e
            st[1] += 1
        else:
            st[2] += e
            st[3] += 1
a = sum(s[0] for s in strata.values()); T1 = sum(s[1] for s in strata.values())
b = sum(s[2] for s in strata.values()); T0 = sum(s[3] for s in strata.values())
hr = (a / T1) / (b / T0)
se = math.sqrt(1 / a + 1 / b)
num = sum(s[0] * s[3] / (s[1] + s[3]) for s in strata.values() if s[1] + s[3])
den = sum(s[2] * s[1] / (s[1] + s[3]) for s in strata.values() if s[1] + s[3])
var = sum(s[1] * s[3] * (s[0] + s[2]) / (s[1] + s[3]) ** 2 for s in strata.values() if s[1] + s[3]) / (num * den)
mh = num / den
res = in_range("churn_exposure_hazard_ratio", round(mh, 3), 1.6, 2.0, {
    "crude": round(hr, 3), "crude_ci": [round(hr * math.exp(-Z * se), 3), round(hr * math.exp(Z * se), 3)],
    "mh_ci": [round(mh * math.exp(-Z * math.sqrt(var)), 3), round(mh * math.exp(Z * math.sqrt(var)), 3)],
    "events_exposed": a, "person_days_exposed": T1, "events_unexposed": b, "person_days_unexposed": T0})
e = REPORT["effects"]["churn_exposure_hazard_ratio"]
print(f"  Churn exposure HR (MH by archetype) = {mh:.2f}  [{e['mh_ci'][0]:.2f}, {e['mh_ci'][1]:.2f}]   "
      f"crude {hr:.2f} [{e['crude_ci'][0]:.2f}, {e['crude_ci'][1]:.2f}]   "
      f"({a} events / {T1:,} exposed person-days vs {b} / {T0:,})   target 1.6-2.0  {res}")

# 2. anchor dependency ----------------------------------------------------------
rows_by_crew = defaultdict(list)
for m in members:
    rows_by_crew[m["clan_id"]].append(m)
clan_meta = {c["clan_id"]: c for c in clans}
top_departures = defaultdict(list)  # cid -> [left_at]
for m in members:
    if m["left_at"] and m["crew_centrality"] >= 0.999:
        top_departures[m["clan_id"]].append((ts(m["left_at"]), m["player_id"]))


def active_at(cid, T, exclude=None):
    return [m["player_id"] for m in rows_by_crew[cid] if ts(m["joined_at"]) <= T and (m["left_at"] is None or ts(m["left_at"]) > T)
            and m["player_id"] != exclude]


def has_session(pid, d0, d1):
    s = sessions[pid]
    return any(d in s for d in range(d0, d1 + 1))


def crew_ret(cid, T, exclude=None):
    d = didx(T)
    elig = [x for x in active_at(cid, T, exclude) if has_session(x, d - 7, d - 1)]
    ret = sum(1 for x in elig if has_session(x, d + 7, d + 13))
    return ret, len(elig)


treated = []
for cid, deps in top_departures.items():
    for T, pid in sorted(deps):
        if NOW - timedelta(days=60) <= T <= NOW - timedelta(days=14):
            treated.append((cid, T, pid))
            break
sets = []
for cid, T, pid in treated:
    meta = clan_meta[cid]
    fam = "NBA" if meta["franchise"] in ("NBA2K", "NBA2K26") else meta["franchise"]
    size_t = len(active_at(cid, T))
    cands = []
    for c2, rws in rows_by_crew.items():
        if c2 == cid:
            continue
        m2 = clan_meta[c2]
        if ("NBA" if m2["franchise"] in ("NBA2K", "NBA2K26") else m2["franchise"]) != fam:
            continue
        if any(T - timedelta(days=60) <= t2 <= T + timedelta(days=14) for t2, _ in top_departures.get(c2, [])):
            continue
        s2 = len(active_at(c2, T))
        if s2 < 8:
            continue
        cands.append((0 if m2["tier"] == meta["tier"] else 1, abs(math.log(s2 / max(size_t, 1))), c2))
    ctrls = [c for _, _, c in sorted(cands)[:3]]
    rt, nt = crew_ret(cid, T, pid)
    cr = [crew_ret(c, T) for c in ctrls]
    sets.append({"crew": cid, "T": T, "treated": (rt, nt), "controls": cr})
rt = sum(s["treated"][0] for s in sets); nt = sum(s["treated"][1] for s in sets)
rc = sum(x[0] for s in sets for x in s["controls"]); nc = sum(x[1] for s in sets for x in s["controls"])
ret_t, ret_c = rt / nt, rc / nc
lift = (ret_t - ret_c) / ret_c
br = random.Random(7)
boots = []
for _ in range(2000):
    samp = [sets[br.randrange(len(sets))] for _ in sets]
    a1 = sum(s["treated"][0] for s in samp); n1 = sum(s["treated"][1] for s in samp)
    a0 = sum(x[0] for s in samp for x in s["controls"]); n0 = sum(x[1] for s in samp for x in s["controls"])
    if n1 and n0 and a0:
        boots.append((a1 / n1 - a0 / n0) / (a0 / n0))
boots.sort()
ci = (boots[int(0.025 * len(boots))], boots[int(0.975 * len(boots))])
per_crew = []
for s in sets:
    c_r = sum(x[0] for x in s["controls"]) / max(1, sum(x[1] for x in s["controls"]))
    per_crew.append((s["treated"][0] / max(1, s["treated"][1]) - c_r) / c_r if c_r else 0)
n_drop = sum(1 for x in per_crew if x <= -0.10)
res = in_range("anchor_dependency_d14_retention_lift", round(lift, 3), -0.40, -0.25, {
    "ci": [round(ci[0], 3), round(ci[1], 3)], "ret_treated": round(ret_t, 3), "ret_control": round(ret_c, 3),
    "n_treated_crews": len(sets), "n_treated_members": nt, "n_control_members": nc,
    "crews_with_>=10pct_drop": n_drop})
print(f"  Anchor dependency D14 retention: treated {ret_t:.1%} (n={nt}, {len(sets)} crews) vs matched {ret_c:.1%} (n={nc})  "
      f"lift {lift:+.1%} [{ci[0]:+.1%}, {ci[1]:+.1%}]  ({n_drop}/{len(sets)} crews drop >=10%)  target -25..-40%  {res}")

# 3. keystones -------------------------------------------------------------------
active_rows = [m for m in members if m["is_active"] and len([1 for x in rows_by_crew[m["clan_id"]] if x["is_active"]]) >= 5]
keystones = [m for m in active_rows if m["crew_centrality"] >= 0.9]
share = len(keystones) / len(active_rows)
declining = [m for m in keystones if P[m["player_id"]]["churned_at"] is None and P[m["player_id"]]["session_min_prev_7d"] > 0
             and P[m["player_id"]]["session_min_7d"] / P[m["player_id"]]["session_min_prev_7d"] < 0.7]
p_se = math.sqrt(share * (1 - share) / len(active_rows))
r1 = in_range("keystone_share", round(share, 4), 0.06, 0.09, {"ci": [round(share - Z * p_se, 4), round(share + Z * p_se, 4)],
                                                              "n_keystones": len(keystones), "n_active_members": len(active_rows)})
r2 = in_range("keystones_declining", len(declining), 15, 25, {"player_ids": sorted(m["player_id"] for m in declining)})
print(f"  Keystones: {len(keystones)}/{len(active_rows)} active members = {share:.1%} [{share - Z * p_se:.1%}, {share + Z * p_se:.1%}]  "
      f"target 6-9%  {r1};  declining (7d/prev7d < 0.7): {len(declining)}  target 15-25  {r2}")

# 4. crews that lost their top-centrality member this week -------------------------
lost = {}
for e_ in events:
    if e_["event_type"] != "LEAVE" or ts(e_["occurred_at"]) < NOW - timedelta(days=7):
        continue
    T = ts(e_["occurred_at"])
    row = next((m for m in rows_by_crew[e_["clan_id"]] if m["player_id"] == e_["player_id"]), None)
    if not row or row["left_at"] != e_["occurred_at"]:
        continue
    at = [m for m in rows_by_crew[e_["clan_id"]] if ts(m["joined_at"]) <= T - timedelta(seconds=1) and (m["left_at"] is None or ts(m["left_at"]) >= T)]
    if at and row["crew_centrality"] >= max(m["crew_centrality"] for m in at) - 1e-9:
        lost[e_["clan_id"]] = e_["player_id"]
res = in_range("crews_lost_core_member_7d", len(lost), 12, 25, {"crews": sorted(lost)})
print(f"  Crews whose top-centrality member LEFT in the last 7 days: {len(lost)}  target 12-25  {res}")

# 5. creator lift ----------------------------------------------------------------
ident_player = {h["identity_id"]: h["player_id"] for h in has_identity}
watch_by_creator = defaultdict(lambda: defaultdict(list))  # cid -> pid -> [(day, minutes, offer?)]
for w in watched:
    s = S[w["stream_id"]]
    pid = ident_player[w["identity_id"]]
    watch_by_creator[s["creator_id"]][pid].append((didx(ts(s["started_at"])), w["watch_minutes"], bool(s["featured_offer_id"])))


def pre_bucket(pid, t):
    n = sum(1 for d in range(t - 14, t) if d in sessions[pid])
    return 0 if n <= 4 else 1 if n <= 8 else 2 if n <= 11 else 3


by_stratum_pool = defaultdict(list)
crng = random.Random(11)
lift_rows = []
for cid in sorted(watch_by_creator):
    wb = watch_by_creator[cid]
    tr = []
    for pid, ws in wb.items():
        q = sorted(d for d, mins, off in ws if off and mins >= 20 and d <= N_DAYS - 1 - 30 and d >= 7)
        if q and has_session(pid, q[0] - 7, q[0] - 1):
            tr.append((pid, q[0]))
    if len(tr) < 30:
        continue
    non_viewers = [pid for pid in P if pid not in wb]
    used = set()
    t_act = c_act = n_c = 0
    for pid, t in tr:
        key = (arch[pid], pre_bucket(pid, t))
        pool = [x for x in non_viewers if x not in used and arch[x] == key[0] and has_session(x, t - 7, t - 1)
                and (churn_day.get(x, 999) > t) and pre_bucket(x, t) == key[1]]
        picks = crng.sample(pool, min(3, len(pool)))
        if not picks:
            continue
        used.update(picks)
        t_act += has_session(pid, t + 24, t + 30)
        for x in picks:
            c_act += has_session(x, t + 24, t + 30)
        n_c += len(picks)
    n_t = len(tr)
    p1, p0 = t_act / n_t, c_act / max(1, n_c)
    se = math.sqrt(p1 * (1 - p1) / n_t + p0 * (1 - p0) / max(1, n_c))
    lift_rows.append({"creator_id": cid, "handle": CR[cid]["handle"], "treated_n": n_t, "control_n": n_c,
                      "d30_treated": round(p1, 4), "d30_control": round(p0, 4), "diff_pts": round(100 * (p1 - p0), 2),
                      "ci_low_pts": round(100 * (p1 - p0 - Z * se), 2), "ci_high_pts": round(100 * (p1 - p0 + Z * se), 2),
                      "incremental_players": round((p1 - p0) * n_t, 1)})
lift_rows.sort(key=lambda r: -r["diff_pts"])
clear_pos = [r for r in lift_rows if r["ci_low_pts"] > 0]
negative = [r for r in lift_rows if r["diff_pts"] < 0 and r["creator_id"] in ("creator-flightreacts",)]
near_zero = [r for r in lift_rows if abs(r["diff_pts"]) <= 3]
ok = 2 <= len(clear_pos) <= 4 and len(negative) >= 1 and len(near_zero) >= 5
REPORT["effects"]["creator_lift"] = {"ok": ok, "rows": lift_rows, "clearly_positive": [r["handle"] for r in clear_pos]}
if not ok:
    FAIL.append("effect:creator_lift")
print(f"  Creator D30 lift (>=20 min offer stream vs matched non-viewers): {len(clear_pos)} clearly positive, "
      f"{len(near_zero)} within +/-3 pts, negative: {[r['handle'] for r in negative]}  {'PASS' if ok else 'FAIL'}")
for r in lift_rows:
    print(f"      {r['handle']:<18} treated {r['treated_n']:>4}  ctrl {r['control_n']:>4}  D30 {r['d30_treated']:.1%} vs {r['d30_control']:.1%}  "
          f"{r['diff_pts']:+5.1f} pts [{r['ci_low_pts']:+5.1f}, {r['ci_high_pts']:+5.1f}]")

# 6. branded social attach -------------------------------------------------------
NBA = {"NBA2K", "NBA2K26", "NBA2KMOBILE"}
nba_players = [p["player_id"] for p in players if set(p.get("franchises_played") or []) & NBA]
buyers = defaultdict(set)
for b_ in bought:
    it = IT[b_["item_id"]]
    if it["brand_id"]:
        buyers[it["brand_id"]].add(b_["player_id"])
ae = an = ue = un = 0
per_brand = []
for bid in sorted(buyers):
    bset = buyers[bid]
    x1 = n1 = x0 = n0 = 0
    for pid in nba_players:
        exp = any(q in bset for q in nbrs[pid])
        if exp:
            n1 += 1; x1 += pid in bset
        else:
            n0 += 1; x0 += pid in bset
    ae += x1; an += n1; ue += x0; un += n0
    per_brand.append({"brand_id": bid, "buyers": len(bset), "attach_exposed": round(x1 / max(1, n1), 4),
                      "attach_unexposed": round(x0 / max(1, n0), 4), "multiplier": round((x1 / max(1, n1)) / max(1e-9, x0 / max(1, n0)), 2)})
mult = (ae / an) / (ue / un)
se = math.sqrt(1 / ae - 1 / an + 1 / ue - 1 / un)
res = in_range("branded_social_attach_multiplier", round(mult, 3), 1.5, 2.5, {
    "ci": [round(mult * math.exp(-Z * se), 3), round(mult * math.exp(Z * se), 3)],
    "attach_exposed": round(ae / an, 4), "attach_unexposed": round(ue / un, 4), "per_brand": per_brand})
e = REPORT["effects"]["branded_social_attach_multiplier"]
print(f"  Branded attach: {ae / an:.1%} with >=1 co-play neighbour who bought the brand vs {ue / un:.1%} without  "
      f"multiplier {mult:.2f} [{e['ci'][0]:.2f}, {e['ci'][1]:.2f}]  target 1.5-2.5  {res}")

# 7. creator hubs --------------------------------------------------------------------
by_hub = sorted(creators, key=lambda c: -c["hub_score"])
fol_rank = {c["creator_id"]: i + 1 for i, c in enumerate(sorted(creators, key=lambda c: -c["followers"]))}
top3 = by_hub[:3]
hub_ok = sum(1 for c in top3 if fol_rank[c["creator_id"]] > 10) >= 2
top_fol = sorted(creators, key=lambda c: -c["followers"])[:4]
hub_rank = {c["creator_id"]: i + 1 for i, c in enumerate(by_hub)}
REPORT["effects"]["creator_hubs"] = {"ok": hub_ok, "top_hubs": [
    {"handle": c["handle"], "hub_score": c["hub_score"], "community_span": c["community_span"], "followers": c["followers"],
     "follower_rank": fol_rank[c["creator_id"]]} for c in by_hub[:8]],
    "top_follower_creators_hub_rank": {c["handle"]: hub_rank[c["creator_id"]] for c in top_fol}}
if not hub_ok:
    FAIL.append("effect:creator_hubs")
print(f"  Creator hubs (hub_score rank vs follower rank): {'PASS' if hub_ok else 'FAIL'}")
for c in by_hub[:6]:
    print(f"      hub #{hub_rank[c['creator_id']]:<2} {c['handle']:<16} hub_score {c['hub_score']:.3f}  span {c['community_span']:>3}  "
          f"followers {c['followers']:>9,} (rank #{fol_rank[c['creator_id']]})")
print("      top-follower creators' hub ranks: " + ", ".join(f"{c['handle']} #{hub_rank[c['creator_id']]}" for c in top_fol))

# 8. concept affinity ------------------------------------------------------------------
aff = defaultdict(lambda: defaultdict(list))
for p in players:
    for k in ("wnba_affinity", "college_hoops_affinity", "franchise_mode_affinity"):
        aff[p["primary_archetype"]][k].append(p[k])
mean = lambda xs: sum(xs) / len(xs)
w_top = max(aff, key=lambda a_: mean(aff[a_]["wnba_affinity"]))
f_top = max(aff, key=lambda a_: mean(aff[a_]["franchise_mode_affinity"]))
young = [p["college_hoops_affinity"] for p in players if (p.get("age") or 99) <= 21]
older = [p["college_hoops_affinity"] for p in players if (p.get("age") or 0) >= 28]
aff_ok = w_top == "THE_W_LOYALIST" and f_top == "MYNBA_FRANCHISE_SIM" and mean(young) > mean(older) + 0.1
REPORT["effects"]["concept_affinity"] = {"ok": aff_ok, "top_wnba_archetype": w_top, "top_franchise_archetype": f_top,
                                          "college_mean_age_le_21": round(mean(young), 3), "college_mean_age_ge_28": round(mean(older), 3)}
if not aff_ok:
    FAIL.append("effect:concept_affinity")
print(f"  Concept affinity: top WNBA archetype {w_top}, top franchise archetype {f_top}, college affinity "
      f"age<=21 {mean(young):.2f} vs age>=28 {mean(older):.2f}  {'PASS' if aff_ok else 'FAIL'}")

with open(os.path.join(D, "validation_report.json"), "w") as f:
    json.dump(REPORT, f, indent=2, default=str)
print(f"\n{'ALL CHECKS PASSED' if not FAIL else 'FAILED: ' + ', '.join(FAIL)}")
sys.exit(1 if FAIL else 0)
