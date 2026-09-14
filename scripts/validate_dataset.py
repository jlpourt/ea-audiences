import json
import os

def load_json(path):
    with open(path, 'r') as f:
        return json.load(f)

# Load data
master_players = load_json('data/master_players.json')
platform_identities = load_json('data/platform_identities.json')
has_identity_edges = load_json('data/has_identity_edges.json')
games = load_json('data/games.json')
played_game_edges = load_json('data/played_game_edges.json')
clans = load_json('data/clans.json')
member_of_clan_edges = load_json('data/member_of_clan_edges.json')
marketing_offers = load_json('data/marketing_offers.json')
telemetry_match_events = load_json('data/telemetry_match_events.json')

# Validations
valid_games = set(g['game_id'] for g in games)
valid_players = set(p['player_id'] for p in master_players)
valid_clans = set(c['clan_id'] for c in clans)
valid_identities = set(i['identity_id'] for i in platform_identities)
valid_offers = set(o['offer_id'] for o in marketing_offers)
valid_archetypes = {"BLACKCELL_WHALE", "AZERITE_COLLECTOR", "SANCTUARY_COLLECTOR", "MYTHIC_COLLECTOR", "BOOSTER_WHALE", "COMPETITIVE_GRINDER", "RANKED_SWEAT", "CASUAL_SOCIALIZER", "CASUAL_WARRIOR", "LORE_SEEKER"}

# Counters
dangling_games = sum(1 for e in played_game_edges if e['game_id'] not in valid_games)

dangling_players_pge = sum(1 for e in played_game_edges if e['player_id'] not in valid_players)
dangling_players_hie = sum(1 for e in has_identity_edges if e['player_id'] not in valid_players)
dangling_players_moce = sum(1 for e in member_of_clan_edges if e['player_id'] not in valid_players)
dangling_players_tme = sum(1 for e in telemetry_match_events if e['player_id'] not in valid_players)
total_dangling_players = dangling_players_pge + dangling_players_hie + dangling_players_moce + dangling_players_tme

dangling_clans = sum(1 for e in member_of_clan_edges if e['clan_id'] not in valid_clans)
dangling_identities = sum(1 for e in has_identity_edges if e['identity_id'] not in valid_identities)
dangling_offers = sum(1 for e in telemetry_match_events if e['triggered_offer_id'] not in valid_offers)

invalid_archetypes = sum(1 for p in master_players if p['primary_archetype'] not in valid_archetypes)
missing_fields = sum(1 for p in master_players if not all(k in p for k in ('age', 'gender', 'account_tenure_days', 'currency_balance')))

print("| Check                                      | Result |")
print("|--------------------------------------------|--------|")
print(f"| Dangling game_id in played_game_edges      | {dangling_games:6d} |")
print(f"| Dangling player_id in all edge files       | {total_dangling_players:6d} |")
print(f"| Dangling clan_id in member_of_clan_edges   | {dangling_clans:6d} |")
print(f"| Dangling identity_id in has_identity_edges | {dangling_identities:6d} |")
print(f"| Dangling offer_id in telemetry_match_events| {dangling_offers:6d} |")
print(f"| Players with invalid archetype             | {invalid_archetypes:6d} |")
print(f"| Players missing demographic fields         | {missing_fields:6d} |")
print("\nDemographics by Franchise:")
print(f"{'Franchise':<15} | {'Med Age':<7} | {'% Male':<6} | {'% Female':<8} | {'% NB/Undisc':<11} | {'Count'}")

from collections import defaultdict
import statistics

demographics = defaultdict(lambda: {'ages': [], 'm': 0, 'f': 0, 'o': 0, 'count': 0})
for p in master_players:
    f = p['primary_franchise']
    demographics[f]['ages'].append(p['age'])
    demographics[f]['count'] += 1
    if p['gender'] == 'male': demographics[f]['m'] += 1
    elif p['gender'] == 'female': demographics[f]['f'] += 1
    else: demographics[f]['o'] += 1

for f, stats in sorted(demographics.items()):
    med_age = int(statistics.median(stats['ages']))
    pct_m = int(stats['m'] / stats['count'] * 100)
    pct_f = int(stats['f'] / stats['count'] * 100)
    pct_o = int(stats['o'] / stats['count'] * 100)
    print(f"{f:<15} | {med_age:<7} | {pct_m:>5}% | {pct_f:>7}% | {pct_o:>10}% | {stats['count']}")
