import json
import random
import datetime

SEED = 42
random.seed(SEED)
ref_date = datetime.date(2026, 9, 14)

def run():
    print(f"Using random seed: {SEED}")
    
    with open('/Users/jlpourt/CCAI/ea-audiences/data/games.json', 'r') as f:
        games = json.load(f)
    
    with open('/Users/jlpourt/CCAI/ea-audiences/data/marketing_offers.json', 'r') as f:
        offers = json.load(f)
        
    with open('/Users/jlpourt/CCAI/ea-audiences/data/master_players.json', 'r') as f:
        players = json.load(f)
        
    offers_by_franchise = {}
    for o in offers:
        f_id = o['target_franchise']
        if f_id not in offers_by_franchise:
            offers_by_franchise[f_id] = []
        offers_by_franchise[f_id].append(o)
        
    ONE_TIME_TYPES = {"GAME_PURCHASE", "COSMETIC", "SERVICE"}
    
    def find_purchase_combo(available_offers, target_usd, arch, tenure):
        if target_usd == 0:
            return []
            
        target_cents = int(round(target_usd * 100))
        avail = []
        player_cheapest = min((o['price_usd'] for o in available_offers), default=0.99)
        
        for o in available_offers:
            c = int(round(o['price_usd'] * 100))
            is_one_time = o['offer_type'] in ONE_TIME_TYPES
            avail.append((c, o, is_one_time))
            
        tol = max(0.05 * target_usd, player_cheapest)
        
        avail_sorted = sorted(available_offers, key=lambda x: x['price_usd'], reverse=True)
        
        # We will try increasing the cap until we hit the tolerance
        # Cap starts at 24
        current_cap = 24
        
        while True:
            best_combo = []
            best_error = target_usd
            
            for _ in range(300):
                combo = []
                current_sum = 0.0
                purchased_one_times = set()
                purchased_repeatables = {}
                
                while current_sum < target_usd:
                    remaining = target_usd - current_sum
                    
                    candidates = [o for o in avail_sorted if o['price_usd'] <= remaining + tol]
                    candidates = [o for o in candidates if not (o['offer_type'] in ONE_TIME_TYPES and o['offer_id'] in purchased_one_times)]
                    candidates = [o for o in candidates if not (o['offer_type'] not in ONE_TIME_TYPES and purchased_repeatables.get(o['offer_id'], 0) >= current_cap)]
                    
                    if not candidates:
                        break
                        
                    if remaining < 50:
                        top_candidates = candidates
                    else:
                        max_price = candidates[0]['price_usd']
                        top_candidates = []
                        for c in candidates:
                            if c['price_usd'] >= max_price * 0.7:
                                weight = 5 if c.get('affinity_archetype') == arch else 1
                                top_candidates.extend([c] * weight)
                        if not top_candidates:
                            top_candidates = candidates
                            
                    choice = random.choice(top_candidates)
                    combo.append(choice)
                    current_sum += choice['price_usd']
                    
                    if choice['offer_type'] in ONE_TIME_TYPES:
                        purchased_one_times.add(choice['offer_id'])
                    else:
                        purchased_repeatables[choice['offer_id']] = purchased_repeatables.get(choice['offer_id'], 0) + 1
                        
                err_with = abs(current_sum - target_usd)
                if err_with < best_error:
                    best_error = err_with
                    best_combo = list(combo)
                    
                if len(combo) > 0:
                    err_without = abs((current_sum - combo[-1]['price_usd']) - target_usd)
                    if err_without < best_error:
                        best_error = err_without
                        best_combo = list(combo[:-1])
                        
                if best_error <= tol:
                    break
                    
            if best_error <= tol:
                return best_combo
                
            # If greedy failed, check if it's mathematically possible to reach under current_cap
            # Max possible sum
            max_possible = sum(c for c, o, is_one in avail if is_one) / 100.0 + sum(c * current_cap for c, o, is_one in avail if not is_one) / 100.0
            
            if target_usd - max_possible > tol:
                # Mathematically impossible with this cap!
                # Increase cap and try again.
                current_cap += 1
            else:
                # Mathematically possible but greedy didn't find it.
                # Try DP!
                expanded_avail = []
                for c, o, is_one_time in avail:
                    if is_one_time:
                        expanded_avail.append((c, o))
                    else:
                        for _ in range(current_cap):
                            expanded_avail.append((c, o))
                            
                max_sum = int(target_cents + player_cheapest * 100 + 100)
                if max_sum > 600000:
                    max_sum = 600000
                    
                dp = [None] * (max_sum + 1)
                dp[0] = (0, None)
                
                for c, o in expanded_avail:
                    for s in range(max_sum - c, -1, -1):
                        if dp[s] is not None and dp[s + c] is None:
                            dp[s + c] = (s, o)
                            
                dp_best_diff = target_cents
                dp_best_sum = 0
                for s in range(max_sum + 1):
                    if dp[s] is not None:
                        diff = abs(s - target_cents)
                        if diff < dp_best_diff:
                            dp_best_diff = diff
                            dp_best_sum = s
                            
                if dp_best_diff/100.0 <= tol:
                    dp_combo = []
                    curr = dp_best_sum
                    while curr > 0:
                        prev_sum, item = dp[curr]
                        dp_combo.append(item)
                        curr = prev_sum
                    return dp_combo
                else:
                    # Even DP failed? That means there's no combination. Increase cap or return best.
                    if dp_best_diff/100.0 < best_error:
                        best_error = dp_best_diff/100.0
                        
                        dp_combo = []
                        curr = dp_best_sum
                        while curr > 0:
                            prev_sum, item = dp[curr]
                            dp_combo.append(item)
                            curr = prev_sum
                        best_combo = dp_combo
                        
                    # Still failed, return the best we could do
                    return best_combo
                    
        return best_combo

    for p in players:
        target_usd = p.get('lifetime_spend_usd', 0)
        franchises = p.get('franchises_played', [])
        arch = p.get('player_archetype')
        tenure = p.get('account_tenure_days', 365)
        
        available = []
        for fr in franchises:
            if fr in offers_by_franchise:
                available.extend(offers_by_franchise[fr])
                
        if target_usd == 0 or not available:
            p['purchased_items'] = []
            continue
            
        combo = find_purchase_combo(available, target_usd, arch, tenure)
        
        purchased_items = []
        for o in combo:
            avail_date_str = o.get('available_from', '2024-01-01')
            avail_date = datetime.date.fromisoformat(avail_date_str)
            player_start_date = ref_date - datetime.timedelta(days=tenure)
            earliest_date = max(avail_date, player_start_date)
            if earliest_date > ref_date:
                earliest_date = ref_date
                
            days_range = (ref_date - earliest_date).days
            if days_range < 0:
                days_range = 0
            
            random_days = random.randint(0, days_range)
            purchase_date = earliest_date + datetime.timedelta(days=random_days)
            
            purchased_items.append({
                "offer_id": o["offer_id"],
                "title": o["offer_title"],
                "price": o["price_usd"],
                "date": purchase_date.isoformat(),
                "category": o["category"],
                "type": o["offer_type"]
            })
            
        p['purchased_items'] = purchased_items

    with open('/Users/jlpourt/CCAI/ea-audiences/data/master_players.json', 'w') as f:
        json.dump(players, f, indent=2)

if __name__ == '__main__':
    run()
