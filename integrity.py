import json

def load(f):
    with open('data/' + f) as f:
         return json.load(f)

master_players = load('master_players.json')
offers = load('marketing_offers.json')
games = load('games.json')
has_identity_edges = load('has_identity_edges.json')
platform_identities = load('platform_identities.json')
played_game_edges = load('played_game_edges.json')

# 1. Offers in code vs data
code_offers = [
    "off-cod-01", "off-cod-03", "off-wow-01", "off-wow-03",
    "off-diablo4-01", "off-overwatch2-01", "off-candycrush-01", "off-candycrush-02",
    "offer-fc26-champs-pity-pack", "offer-fc26-whale-promo-flash"
]
data_offer_ids = {o['offer_id'] for o in offers}
missing_offers = [o for o in code_offers if o not in data_offer_ids]
print(f"Missing offers in data: {missing_offers}")

# 2. Edges
player_ids = {p['player_id'] for p in master_players}
identity_ids = {i['identity_id'] for i in platform_identities}
game_ids = {g['game_id'] for g in games}

dangling_has_ident_players = [e for e in has_identity_edges if e['player_id'] not in player_ids]
dangling_has_ident_idents = [e for e in has_identity_edges if e['identity_id'] not in identity_ids]
print(f"Dangling has_identity -> player: {len(dangling_has_ident_players)}")
print(f"Dangling has_identity -> identity: {len(dangling_has_ident_idents)}")

dangling_played_game_players = [e for e in played_game_edges if e['player_id'] not in player_ids]
dangling_played_game_games = [e for e in played_game_edges if e['game_id'] not in game_ids]
print(f"Dangling played_game -> player: {len(dangling_played_game_players)}")
print(f"Dangling played_game -> game: {len(dangling_played_game_games)}")
print(f"Dangling played_game -> game examples: {dangling_played_game_games[:5] if dangling_played_game_games else []}")

# 3. Archetypes emitted vs handled
ui_archetypes = {
  "COMPETITIVE_GRINDER",
  "ULTIMATE_TEAM_WHALE",
  "CASUAL_SOCIALIZER",
  "LORE_SEEKER",
  "RANKED_SWEAT",
  "HEIRLOOM_WHALE",
  "CASUAL_WARRIOR",
  "BLACKCELL_WHALE",
  "MYTHIC_RAIDER",
  "SANCTUARY_COLLECTOR",
  "BOOSTER_WHALE",
  "MUT_WHALE",
  "CONQUEST_LEADER",
  "SIMS_COLLECTOR",
  "BUILDER_CREATOR"
}
data_archetypes = {p['primary_archetype'] for p in master_players}
unhandled_archetypes = data_archetypes - ui_archetypes
print(f"Unhandled archetypes: {unhandled_archetypes}")

