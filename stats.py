import json

def load(f):
    with open('data/' + f) as f:
         return json.load(f)

players = load('master_players.json')
offers = load('marketing_offers.json')

franchise_counts = {}
churn_counts = {'low': 0, 'med': 0, 'high': 0, 'very_high': 0}
ltv_counts = {'0-50': 0, '50-250': 0, '250-1000': 0, '1000+': 0}
creator_affinity = 0
age_present = 0
gender_present = 0
telemetry_joins = 0

for p in players:
    f = p['primary_franchise']
    franchise_counts[f] = franchise_counts.get(f, 0) + 1
    
    churn = p.get('churn_risk_score', 0)
    if churn < 0.25: churn_counts['low'] += 1
    elif churn < 0.5: churn_counts['med'] += 1
    elif churn < 0.75: churn_counts['high'] += 1
    else: churn_counts['very_high'] += 1
        
    ltv = p.get('lifetime_spend_usd', 0)
    if ltv < 50: ltv_counts['0-50'] += 1
    elif ltv < 250: ltv_counts['50-250'] += 1
    elif ltv < 1000: ltv_counts['250-1000'] += 1
    else: ltv_counts['1000+'] += 1
        
    if p.get('primary_creator_influence') or p.get('followed_creators'):
        creator_affinity += 1
        
    if 'age' in p: age_present += 1
    if 'gender' in p: gender_present += 1
    if p.get('game_telemetry'): telemetry_joins += 1

print(f"Total Players: {len(players)}")
print(f"Franchise Counts: {franchise_counts}")
print(f"Churn Risk: {churn_counts}")
print(f"LTV Distribution: {ltv_counts}")
print(f"Has Creator Affinity: {creator_affinity}")
print(f"Has Age: {age_present}")
print(f"Has Gender: {gender_present}")
print(f"Has Telemetry: {telemetry_joins}")

# Sample player keys
print(f"\nKeys in player 0: {list(players[0].keys())}")

