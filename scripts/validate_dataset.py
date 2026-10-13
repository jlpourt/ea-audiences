#!/usr/bin/env python3
"""Validate 2K Courtside synthetic dataset integrity and Golden Play populations."""
import json
import statistics
from collections import defaultdict


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


master_players = load_json("data/master_players.json")
platform_identities = load_json("data/platform_identities.json")
has_identity_edges = load_json("data/has_identity_edges.json")
games = load_json("data/games.json")
played_game_edges = load_json("data/played_game_edges.json")
clans = load_json("data/clans.json")
member_of_clan_edges = load_json("data/member_of_clan_edges.json")
marketing_offers = load_json("data/marketing_offers.json")
telemetry_match_events = load_json("data/telemetry_match_events.json")

valid_games = {g["game_id"] for g in games}
valid_players = {p["player_id"] for p in master_players}
valid_clans = {c["clan_id"] for c in clans}
valid_identities = {i["identity_id"] for i in platform_identities}
valid_offers = {o["offer_id"] for o in marketing_offers}
valid_labels = {"2K", "2K_SPORTS", "2K_CORE"}
valid_franchises = {
    "NBA2K", "NBA2K26", "NBA2KMOBILE", "WWE2K", "PGA2K", "TOPSPIN", "CIV7",
    "BL4", "MAFIA",
}
valid_archetypes = {
    "MYTEAM_PACK_WHALE",
    "PARK_REP_GRINDER",
    "REC_CREW_CAPTAIN",
    "MYCAREER_STORY_CASUAL",
    "MYNBA_FRANCHISE_SIM",
    "BUILD_LAB_THEORYCRAFTER",
    "THE_W_LOYALIST",
    "CROSS_LABEL_NOMAD",
    "MOBILE_DAILY_RITUALIST",
    "RAGE_QUIT_TILT_RISK",
}
valid_platforms = {
    "2K Account",
    "PlayStation Network",
    "Xbox Live",
    "Steam",
    "Nintendo Switch 2",
    "Apple Game Center",
}

dangling_games = sum(1 for e in played_game_edges if e["game_id"] not in valid_games)
dangling_players_pge = sum(1 for e in played_game_edges if e["player_id"] not in valid_players)
dangling_players_hie = sum(1 for e in has_identity_edges if e["player_id"] not in valid_players)
dangling_players_moce = sum(1 for e in member_of_clan_edges if e["player_id"] not in valid_players)
dangling_players_tme = sum(1 for e in telemetry_match_events if e["player_id"] not in valid_players)
total_dangling_players = (
    dangling_players_pge + dangling_players_hie + dangling_players_moce + dangling_players_tme
)
dangling_clans = sum(1 for e in member_of_clan_edges if e["clan_id"] not in valid_clans)
dangling_identities = sum(1 for e in has_identity_edges if e["identity_id"] not in valid_identities)
dangling_offers = sum(
    1 for e in telemetry_match_events
    if e["triggered_offer_id"] is not None and e["triggered_offer_id"] not in valid_offers
)
invalid_archetypes = sum(1 for p in master_players if p["primary_archetype"] not in valid_archetypes)
invalid_franchises = sum(1 for p in master_players if p["primary_franchise"] not in valid_franchises)
invalid_labels = sum(1 for g in games if g.get("label") not in valid_labels)
invalid_platforms = sum(1 for i in platform_identities if i["platform"] not in valid_platforms)
missing_fields = sum(
    1 for p in master_players
    if not all(k in p for k in ("age", "gender", "account_tenure_days", "currency_balance", "game_telemetry"))
)

nba_players = [p for p in master_players if p["primary_franchise"] == "NBA2K"]
play1_players = [
    p for p in nba_players
    if (p["game_telemetry"].get("myplayer_ovr") or 99) < 85
    and (p["game_telemetry"].get("vc_spend_90d") or 0) >= 50
    and (p["game_telemetry"].get("last_login_days_ago") or 0) >= 7
]
play2_players = [
    p for p in master_players
    if p["game_telemetry"].get("rockstar_linked")
    and (p["game_telemetry"].get("gta_online_spend_usd") or 0) > 0
    and not p["game_telemetry"].get("gta6_preorder")
    and (p["game_telemetry"].get("myteam_vc_spend_90d") or 0) > 0
]
play3_players = [
    p for p in master_players
    if (p["game_telemetry"].get("myteam_galaxy_opal_count") or 0) >= 10
    and p["game_telemetry"].get("season_pass_edition") == "HALL_OF_FAME"
]

print("| Check                                       | Result |")
print("|---------------------------------------------|--------|")
print(f"| Total players                               | {len(master_players):6d} |")
print(f"| Games (with valid Take-Two label)           | {len(games):6d} |")
print(f"| Dangling game_id in played_game_edges       | {dangling_games:6d} |")
print(f"| Dangling player_id in all edge files        | {total_dangling_players:6d} |")
print(f"| Dangling clan_id in member_of_clan_edges    | {dangling_clans:6d} |")
print(f"| Dangling identity_id in has_identity_edges  | {dangling_identities:6d} |")
print(f"| Dangling offer_id in telemetry_match_events | {dangling_offers:6d} |")
print(f"| Players with invalid archetype              | {invalid_archetypes:6d} |")
print(f"| Players with invalid franchise              | {invalid_franchises:6d} |")
print(f"| Games with invalid label                    | {invalid_labels:6d} |")
print(f"| Identities with invalid platform            | {invalid_platforms:6d} |")
print(f"| Players missing demographic/telemetry fields| {missing_fields:6d} |")
print(f"| Play 1 — Season 2 Cliff cohort              | {len(play1_players):6d} |")
print(f"| Play 2 — NBA 2K26 -> 2K27 Upgrade Bridge    | {len(play2_players):6d} |")
print(f"| Play 3 — MyTEAM Pack Whales                 | {len(play3_players):6d} |")

assert dangling_games == 0
assert total_dangling_players == 0
assert dangling_clans == 0
assert dangling_identities == 0
assert dangling_offers == 0
assert invalid_archetypes == 0
assert invalid_franchises == 0
assert invalid_labels == 0
assert invalid_platforms == 0
assert missing_fields == 0
assert 200 <= len(play1_players) <= 400, f"Play 1 out of range: {len(play1_players)}"
assert 250 <= len(play2_players) <= 450, f"Play 2 out of range: {len(play2_players)}"
assert 120 <= len(play3_players) <= 220, f"Play 3 out of range: {len(play3_players)}"

print("\nDemographics by Primary Franchise:")
print(f"{'Franchise':<12} | {'Med Age':<7} | {'% Male':<6} | {'% Female':<8} | {'% NB/Undisc':<11} | {'Count'}")
demographics = defaultdict(lambda: {"ages": [], "m": 0, "f": 0, "o": 0, "count": 0})
for p in master_players:
    f = p["primary_franchise"]
    demographics[f]["ages"].append(p["age"])
    demographics[f]["count"] += 1
    if p["gender"] == "male":
        demographics[f]["m"] += 1
    elif p["gender"] == "female":
        demographics[f]["f"] += 1
    else:
        demographics[f]["o"] += 1

for f, stats in sorted(demographics.items()):
    med_age = int(statistics.median(stats["ages"]))
    pct_m = int(stats["m"] / stats["count"] * 100)
    pct_f = int(stats["f"] / stats["count"] * 100)
    pct_o = int(stats["o"] / stats["count"] * 100)
    print(f"{f:<12} | {med_age:<7} | {pct_m:>5}% | {pct_f:>7}% | {pct_o:>10}% | {stats['count']}")

print("\nALL VALIDATIONS PASSED ✓")
