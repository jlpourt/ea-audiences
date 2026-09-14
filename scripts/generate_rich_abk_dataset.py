import json
import random
import os

random.seed(42)

# Gamer prefixes and suffixes across ABK's 5 major titles
GAMER_PREFIXES = {
    "COD": [
        "Ghost", "Price", "Soap", "Gaz", "Roach", "Scump", "Swagg", "TimTheTatman", "VerdanskGod",
        "GulagClutcher", "SlideCancel", "BlackCellWhale", "WZPredator", "TacMapKing", "DropShot",
        "RicochetHunter", "NukeChaser", "ResurgenceSweat", "Kar98Sniper", "MetaLoadout", "CamoGrinder",
        "HardpointAnchor", "SearchDemon", "PrestigeMaster", "RankedTop250", "UAVSpammer"
    ],
    "WOW": [
        "Thrall", "Jaina", "Illidan", "Arthas", "Sylvanas", "Anduin", "Asmongold", "Maximum", "EchoRaidLead",
        "MythicPlusHero", "KeystoneMaster", "GladiatorR1", "MethodHealer", "TransmogHunter", "GoldCapWhale",
        "AzerothPurist", "DornogalDefender", "WarWithinVoyager", "EbonBlade", "PaladinGod", "MageBlink",
        "RaidWipeSurvivor", "AddonTheorycrafter", "SixMonthSubber", "MountFarmer", "SilvermoonGuard"
    ],
    "DIABLO4": [
        "SanctuarySlayer", "NecroLord", "PitPusher", "TormentMaster", "InfernalHarvester", "WudijoSpeedrun",
        "LootGoblin", "Raxxanterax", "UberLilithSolo", "HelltideCommander", "ParagonLevel300", "VesselOfHatred",
        "SpiritbornMain", "AspectMinMaxer", "Masterwork12", "NightmareVault", "BloodMaiden", "HardcoreSurvivor"
    ],
    "OVERWATCH2": [
        "TracerMain", "GenjiBlade", "WidowOneShot", "AnaSleepGod", "ReinhardtShield", "KirikoSuzu",
        "Top500Support", "GrandmasterDPS", "NanoBladeAce", "OverwatchLeague", "PayloadPrincess", "DiveCompLead",
        "SeagullFan", "FlatsTank", "MercyPocket", "MythicSkinWhale", "VanguardTank", "OverwatchVeteran"
    ],
    "CANDYCRUSH": [
        "CrushQueen", "CandyKing", "SagaMaster", "Level2000Hero", "BoosterWhale", "SugarCrushAce",
        "ColorBombGod", "WrappedCandy", "StripedCombo", "JellyClearer", "CommuterCrusher", "DailySpinner",
        "EpisodeChampion", "LondonCommuter", "LivesGifter", "SweetToothWhale", "SodaPopPro"
    ]
}

GAMER_SUFFIXES = [
    "99", "77", "07", "Prime", "BlackCell", "Mythic", "Elite", "Pro", "Gladiator", "Prestige",
    "Captain", "God", "King", "Lord", "Hero", "Whale", "Sweat", "Streamer", "YT", "Twitch",
    "US", "UK", "EU", "DE", "FR", "BR", "JP", "SA"
]

CITIES = [
    {"dma": "New York DMA", "country": "United States", "region": "us-nyc", "lat": 40.7128, "lng": -74.0060},
    {"dma": "Los Angeles DMA", "country": "United States", "region": "us-lax", "lat": 34.0522, "lng": -118.2437},
    {"dma": "Dallas / Fort Worth DMA", "country": "United States", "region": "us-dfw", "lat": 32.7767, "lng": -96.7970},
    {"dma": "Chicago DMA", "country": "United States", "region": "us-chi", "lat": 41.8781, "lng": -87.6298},
    {"dma": "London Metro", "country": "United Kingdom", "region": "uk-lon", "lat": 51.5074, "lng": -0.1278},
    {"dma": "Manchester", "country": "United Kingdom", "region": "uk-lon", "lat": 53.4808, "lng": -2.2426},
    {"dma": "Paris Île-de-France", "country": "France", "region": "fr-par", "lat": 48.8566, "lng": 2.3522},
    {"dma": "Madrid", "country": "Spain", "region": "es-mad", "lat": 40.4168, "lng": -3.7038},
    {"dma": "Berlin & DACH", "country": "Germany", "region": "de-ber", "lat": 52.5200, "lng": 13.4050},
    {"dma": "São Paulo", "country": "Brazil", "region": "br-sao", "lat": -23.5505, "lng": -46.6333},
    {"dma": "Riyadh & GCC", "country": "Saudi Arabia", "region": "sa-ruh", "lat": 24.7136, "lng": 46.6753},
    {"dma": "Tokyo", "country": "Japan", "region": "jp-tyo", "lat": 35.6762, "lng": 139.6503}
]

FRANCHISE_CATALOGS = {
    "COD": [
        {"title": "13,000 CoD Points Vault Bundle", "price": 99.99, "category": "CoD Store Currency", "type": "CURRENCY_VAULT"},
        {"title": "Call of Duty: Black Ops 6 Vault Edition Upgrade", "price": 30.00, "category": "Game Edition Upgrade", "type": "EDITION_UPGRADE"},
        {"title": "Season 1 BlackCell Battle Pass Bundle", "price": 29.99, "category": "Premium Battle Pass", "type": "BATTLE_PASS"},
        {"title": "5,000 (+800 Bonus) CoD Points", "price": 39.99, "category": "CoD Store Currency", "type": "CURRENCY_PACK"},
        {"title": "Pro Pack Operator Bundle + 2,400 CP", "price": 19.99, "category": "Featured Operator Pack", "type": "OPERATOR_BUNDLE"},
        {"title": "2,400 CoD Points Pack", "price": 19.99, "category": "CoD Store Currency", "type": "CURRENCY_PACK"},
        {"title": "Standard Seasonal Battle Pass (1,100 CP)", "price": 9.99, "category": "Progression Pass", "type": "BATTLE_PASS"},
        {"title": "Gulag Loss-Streak Recovery Starter ($4.99)", "price": 4.99, "category": "Situational Retention", "type": "STARTER_PACK"},
    ],
    "WOW": [
        {"title": "World of Warcraft: The War Within (Epic Edition)", "price": 89.99, "category": "Expansion Edition", "type": "MAJOR_DLC"},
        {"title": "6-Month Recurring Subscription + Ethereal Mount", "price": 77.94, "category": "Recurring Membership", "type": "SUBSCRIPTION"},
        {"title": "The War Within Heroic Edition Upgrade", "price": 69.99, "category": "Expansion Edition", "type": "MAJOR_DLC"},
        {"title": "Level 70 Enhanced Character Boost", "price": 60.00, "category": "Character Services", "type": "GAME_SERVICE"},
        {"title": "Mythic Keystone Transmog Armor Bundle", "price": 25.00, "category": "Battle.net Shop Cosmetic", "type": "COSMETIC_BUNDLE"},
        {"title": "World of Warcraft Token ($20 USD)", "price": 20.00, "category": "In-Game Economy Token", "type": "ECONOMY_TOKEN"},
        {"title": "1-Month Game Time Subscription", "price": 14.99, "category": "Recurring Membership", "type": "SUBSCRIPTION"},
        {"title": "Ethereal Hearthstone Toy & Pet Pack", "price": 9.99, "category": "Battle.net Shop", "type": "PET_BUNDLE"},
    ],
    "DIABLO4": [
        {"title": "Diablo IV: Vessel of Hatred (Ultimate Edition)", "price": 89.99, "category": "Expansion Edition", "type": "MAJOR_DLC"},
        {"title": "11,500 Platinum Treasury Vault", "price": 99.99, "category": "Sanctuary Teasury", "type": "CURRENCY_VAULT"},
        {"title": "Vessel of Hatred Deluxe Upgrade", "price": 59.99, "category": "Expansion Edition", "type": "MAJOR_DLC"},
        {"title": "5,700 Platinum Bundle", "price": 49.99, "category": "Sanctuary Treasury", "type": "CURRENCY_PACK"},
        {"title": "Accelerated Seasonal Battle Pass + 20 Tier Skips", "price": 24.99, "category": "Seasonal Battle Pass", "type": "BATTLE_PASS"},
        {"title": "Infernal Champion Cosmetic Armor Set", "price": 19.99, "category": "Class Armor Set", "type": "ARMOR_SET"},
        {"title": "Standard Premium Battle Pass (1,000 Plat)", "price": 9.99, "category": "Seasonal Progression", "type": "BATTLE_PASS"},
        {"title": "The Pit Loss-Protection Elixir Starter", "price": 4.99, "category": "Situational Retention", "type": "STARTER_PACK"},
    ],
    "OVERWATCH2": [
        {"title": "10,000 (+1,600 Bonus) Overwatch Coins Vault", "price": 99.99, "category": "Hero Gallery Coins", "type": "CURRENCY_VAULT"},
        {"title": "Season 12 Ultimate Battle Pass Bundle", "price": 39.99, "category": "Featured Bundle", "type": "BATTLE_PASS"},
        {"title": "Mythic Prism 80-Pack (Mythic Weapon/Skin)", "price": 39.99, "category": "Mythic Upgrade Shards", "type": "MYTHIC_PRISM"},
        {"title": "5,000 (+700 Bonus) Overwatch Coins", "price": 49.99, "category": "Hero Gallery Coins", "type": "CURRENCY_PACK"},
        {"title": "2,000 (+200 Bonus) Overwatch Coins", "price": 19.99, "category": "Hero Gallery Coins", "type": "CURRENCY_PACK"},
        {"title": "Premium Season Battle Pass", "price": 9.99, "category": "Seasonal Pass", "type": "BATTLE_PASS"},
        {"title": "Competitive Starter Pack + 500 Coins", "price": 4.99, "category": "Entry Promo", "type": "STARTER_PACK"},
    ],
    "CANDYCRUSH": [
        {"title": "1,000 Gold Bars Royal Vault", "price": 99.99, "category": "King Store Currency", "type": "CURRENCY_VAULT"},
        {"title": "Mega Party Booster Super Pack (x20 Each)", "price": 49.99, "category": "LiveOps Event Pack", "type": "BOOSTER_BUNDLE"},
        {"title": "500 Gold Bars Royal Stash", "price": 49.99, "category": "King Store Currency", "type": "CURRENCY_PACK"},
        {"title": "Color Bomb & Lollipop Hammer Master Pack", "price": 19.99, "category": "Tactical Booster Pack", "type": "BOOSTER_BUNDLE"},
        {"title": "120 Gold Bars Pack", "price": 9.99, "category": "King Store Currency", "type": "CURRENCY_PACK"},
        {"title": "24-Hour Unlimited Lives + 50 Gold Bars", "price": 4.99, "category": "Session Re-engagement", "type": "LIVES_BOOST"},
        {"title": "Level 1500+ Sticky Level Rescue Bundle", "price": 2.99, "category": "Situational Rescue", "type": "RESCUE_PACK"},
    ]
}

# ABK Creators / Influencers
CREATORS = [
    {
        "creator_id": "creator-scump",
        "name": "Seth 'Scump' Abner",
        "handle": "Scump",
        "platform": "Twitch & YouTube",
        "franchise": "COD",
        "followers": 3200000,
        "avatar": "🎯",
        "avg_stream_viewers": 45000,
        "conversion_affinity": 0.88,
        "signature_mode": "Warzone & CDL Watch Party"
    },
    {
        "creator_id": "creator-asmongold",
        "name": "Zack 'Asmongold'",
        "handle": "Asmongold",
        "platform": "Twitch",
        "franchise": "WOW",
        "followers": 3600000,
        "avatar": "⚔️",
        "avg_stream_viewers": 65000,
        "conversion_affinity": 0.85,
        "signature_mode": "World of Warcraft & Transmog Competitions"
    },
    {
        "creator_id": "creator-timthetatman",
        "name": "Timothy 'TimTheTatman' Betar",
        "handle": "TimTheTatman",
        "platform": "YouTube Gaming",
        "franchise": "COD",
        "followers": 4800000,
        "avatar": "📺",
        "avg_stream_viewers": 38000,
        "conversion_affinity": 0.84,
        "signature_mode": "Warzone Squads with Cloakzy"
    },
    {
        "creator_id": "creator-wudijo",
        "name": "Wudijo",
        "handle": "Wudijo",
        "platform": "YouTube & Twitch",
        "franchise": "DIABLO4",
        "followers": 850000,
        "avatar": "🔥",
        "avg_stream_viewers": 18000,
        "conversion_affinity": 0.92,
        "signature_mode": "Diablo IV Hardcore Pit Pushing"
    },
    {
        "creator_id": "creator-swagg",
        "name": "Kris 'FaZe Swagg' Lamberson",
        "handle": "FaZe_Swagg",
        "platform": "Twitch",
        "franchise": "COD",
        "followers": 2900000,
        "avatar": "⚡",
        "avg_stream_viewers": 26000,
        "conversion_affinity": 0.82,
        "signature_mode": "Warzone High-Kill Gameplays"
    },
    {
        "creator_id": "creator-maximum",
        "name": "Maximum (Team Liquid)",
        "handle": "Maximum",
        "platform": "Twitch",
        "franchise": "WOW",
        "followers": 650000,
        "avatar": "🛡️",
        "avg_stream_viewers": 22000,
        "conversion_affinity": 0.89,
        "signature_mode": "Race to World First Raid Leader"
    },
    {
        "creator_id": "creator-flats",
        "name": "Flats",
        "handle": "Flats",
        "platform": "Twitch & YouTube",
        "franchise": "OVERWATCH2",
        "followers": 920000,
        "avatar": "🔨",
        "avg_stream_viewers": 15000,
        "conversion_affinity": 0.79,
        "signature_mode": "Overwatch 2 Top 500 Reinhardt"
    }
]

# ABK Clans / Guilds
CLANS = [
    {"clan_id": "clan-optic", "name": "OpTic Nation", "franchise": "COD", "region": "us-dfw", "member_count": 8420, "tier": "PRO_ESPORTS"},
    {"clan_id": "clan-faze", "name": "FaZe Clan", "franchise": "COD", "region": "us-lax", "member_count": 9250, "tier": "PRO_ESPORTS"},
    {"clan_id": "clan-taskforce", "name": "Task Force 141 Milsim", "franchise": "COD", "region": "uk-lon", "member_count": 3120, "tier": "COMMUNITY_WARRIORS"},
    {"clan_id": "clan-echo", "name": "Echo Esports", "franchise": "WOW", "region": "de-ber", "member_count": 1450, "tier": "WORLD_FIRST_MYTHIC"},
    {"clan_id": "clan-liquid", "name": "Team Liquid Guild", "franchise": "WOW", "region": "us-nyc", "member_count": 1820, "tier": "WORLD_FIRST_MYTHIC"},
    {"clan_id": "clan-method", "name": "Method Gaming", "franchise": "WOW", "region": "uk-lon", "member_count": 2100, "tier": "HALL_OF_FAME"},
    {"clan_id": "clan-sanctuary", "name": "Infernal Lords of Sanctuary", "franchise": "DIABLO4", "region": "us-chi", "member_count": 4200, "tier": "HARDCORE_COVEN"},
    {"clan_id": "clan-dallasfuel", "name": "Dallas Fuel Supporters", "franchise": "OVERWATCH2", "region": "us-dfw", "member_count": 3600, "tier": "OWL_SUPPORTERS"},
    {"clan_id": "clan-kingcrushers", "name": "King Royal Crushers Club", "franchise": "CANDYCRUSH", "region": "uk-lon", "member_count": 12800, "tier": "GLOBAL_CASUAL"}
]

# ABK Games
GAMES = [
    {"game_id": "game-cod", "franchise": "COD", "title": "Call of Duty: Warzone / BO6", "genre": "Battle Royale & Tactical FPS", "active_players": 2200000},
    {"game_id": "game-wow", "franchise": "WOW", "title": "World of Warcraft: The War Within", "genre": "MMORPG", "active_players": 1850000},
    {"game_id": "game-diablo", "franchise": "DIABLO4", "title": "Diablo IV: Vessel of Hatred", "genre": "Action RPG", "active_players": 1400000},
    {"game_id": "game-ow2", "franchise": "OVERWATCH2", "title": "Overwatch 2", "genre": "Competitive Hero Shooter", "active_players": 1150000},
    {"game_id": "game-candy", "franchise": "CANDYCRUSH", "title": "Candy Crush Saga", "genre": "Match-3 Casual Mobile", "active_players": 4500000}
]

print("Generating 5,000 ABK Master Player Profiles...")

master_players = []
platform_identities = []
has_identity_edges = []
played_game_edges = []
member_of_clan_edges = []
telemetry_match_events = []
all_offers = []

# Populate Marketing Offers
for franchise, items in FRANCHISE_CATALOGS.items():
    for idx, itm in enumerate(items):
        offer_id = f"off-{franchise.lower()}-{idx+1:02d}"
        all_offers.append({
            "offer_id": offer_id,
            "target_franchise": franchise,
            "offer_title": itm["title"],
            "offer_type": itm["type"],
            "category": itm["category"],
            "price_usd": itm["price"],
            "expected_conversion_boost": f"+{random.randint(18, 38)}.{random.randint(1, 9)}%",
            "description": f"Targeted situational intervention for {franchise} players experiencing high friction or milestone events."
        })

FRANCHISE_KEYS = ["COD", "WOW", "DIABLO4", "OVERWATCH2", "CANDYCRUSH"]

# 5,000 Master Players
for i in range(1, 5001):
    pid = f"abk-usr-{i:05d}"
    
    # Primary Franchise Assignment (Realistic Distribution)
    # COD 34%, WOW 26%, DIABLO4 18%, OVERWATCH2 12%, CANDYCRUSH 10%
    roll = random.random()
    if roll < 0.34:
        primary_franchise = "COD"
    elif roll < 0.60:
        primary_franchise = "WOW"
    elif roll < 0.78:
        primary_franchise = "DIABLO4"
    elif roll < 0.90:
        primary_franchise = "OVERWATCH2"
    else:
        primary_franchise = "CANDYCRUSH"

    # Multi-franchise gravity (Battle.net ecosystem cross-play!)
    cross_titles = [primary_franchise]
    if random.random() < 0.38:
        # Cross title with Battle.net siblings (CoD players play Diablo or WoW)
        if primary_franchise == "COD":
            cross_titles.append(random.choice(["DIABLO4", "WOW", "OVERWATCH2"]))
        elif primary_franchise == "WOW":
            cross_titles.append(random.choice(["DIABLO4", "COD"]))
        elif primary_franchise == "DIABLO4":
            cross_titles.append(random.choice(["WOW", "COD"]))
        elif primary_franchise == "OVERWATCH2":
            cross_titles.append("COD")
        elif primary_franchise == "CANDYCRUSH":
            cross_titles.append("COD")

    # Name generation
    prefix = random.choice(GAMER_PREFIXES[primary_franchise])
    suffix = random.choice(GAMER_SUFFIXES)
    tag_num = random.randint(1000, 9999)
    display_name = f"{prefix}_{suffix}"
    gamer_tag = f"{prefix}#{tag_num}"
    email = f"{prefix.lower()}.{tag_num}@battlenet.live"

    # City & Geography
    city = random.choice(CITIES)
    lat_jitter = city["lat"] + (random.random() - 0.5) * 0.15
    lng_jitter = city["lng"] + (random.random() - 0.5) * 0.15

    # Spend Profile (80/20 power law distribution)
    spend_tier_roll = random.random()
    if spend_tier_roll < 0.05:
        # Whales (5% spend $1,000 - $4,800)
        lifetime_spend = round(random.uniform(1000.0, 4800.0), 2)
        if primary_franchise == "COD":
            archetype = "BLACKCELL_WHALE"
        elif primary_franchise == "WOW":
            archetype = "ULTIMATE_TEAM_WHALE"  # Mount & Token Whale
        elif primary_franchise == "DIABLO4":
            archetype = "SANCTUARY_COLLECTOR"
        elif primary_franchise == "OVERWATCH2":
            archetype = "HEIRLOOM_WHALE"
        else:
            archetype = "BOOSTER_WHALE"
    elif spend_tier_roll < 0.35:
        # Competitive Grinders ($250 - $999)
        lifetime_spend = round(random.uniform(250.0, 999.0), 2)
        archetype = "COMPETITIVE_GRINDER" if random.random() < 0.5 else "RANKED_SWEAT"
    elif spend_tier_roll < 0.70:
        # Casual Socializers ($50 - $249)
        lifetime_spend = round(random.uniform(50.0, 249.0), 2)
        archetype = "CASUAL_SOCIALIZER"
    else:
        # Casual / Lore / Free to Play ($0 - $49)
        lifetime_spend = round(random.uniform(0.0, 49.99), 2)
        archetype = "LORE_SEEKER" if random.random() < 0.5 else "CASUAL_WARRIOR"

    # Friction / Tilt / Loss Streak
    churn_risk = round(random.betavariate(2, 3), 2)
    tilt_sensitivity = round(random.uniform(0.2, 0.95), 2)
    loss_streak = random.choices([0, 1, 2, 3, 4, 5], weights=[45, 25, 15, 9, 4, 2])[0]
    
    if loss_streak >= 3:
        tilt_sensitivity = max(tilt_sensitivity, 0.75)
        churn_risk = min(0.95, churn_risk + 0.25)

    # Creator Affinities
    relevant_creators = [c for c in CREATORS if c["franchise"] == primary_franchise]
    if not relevant_creators:
        relevant_creators = CREATORS
    primary_creator = random.choice(relevant_creators)["creator_id"]
    followed_creators = [primary_creator]
    if random.random() < 0.45:
        second_creator = random.choice(CREATORS)["creator_id"]
        if second_creator != primary_creator:
            followed_creators.append(second_creator)

    # Telemetry Specifics
    game_telemetry = {
        "primary_franchise": primary_franchise,
        "hours_played": random.randint(40, 2800),
        "primary_creator_influence": primary_creator,
        "followed_creators": followed_creators,
    }

    if primary_franchise == "COD":
        game_telemetry.update({
            "main_loadout": random.choice(["MCW / Striker 9", "Kar98k / Superi 46", "BP50 / HRM-9", "SVA 545 / Renetti"]),
            "kd_ratio": round(random.uniform(0.85, 3.4), 2),
            "gulag_win_rate": f"{random.randint(42, 84)}%",
            "rank_tier": random.choice(["Silver III", "Gold II", "Platinum I", "Diamond II", "Crimson III", "Iridescent", "Top 250"]),
            "favorite_drop": random.choice(["Superstore", "Promenade", "Military Base", "Downtown Verdansk", "Rebirth Prison"]),
            "ricochet_status": "Clean (Verified Trust Factor)" if random.random() < 0.98 else "Under Shadowban Review",
        })
    elif primary_franchise == "WOW":
        game_telemetry.update({
            "character_class": random.choice(["Retribution Paladin", "Havoc Demon Hunter", "Frost Mage", "Restoration Druid", "Blood Death Knight"]),
            "item_level": random.randint(580, 639),
            "mythic_plus_score": random.randint(1200, 3450),
            "raid_progression": random.choice(["8/8 Normal", "8/8 Heroic", "4/8 Mythic", "7/8 Mythic Nerub-ar Palace"]),
            "active_sub": "6-Month Recurring" if lifetime_spend >= 200 else "Active Monthly",
            "mount_count": random.randint(45, 650),
        })
    elif primary_franchise == "DIABLO4":
        game_telemetry.update({
            "character_class": random.choice(["Spiritborn", "Necromancer", "Sorcerer", "Barbarian", "Rogue"]),
            "pit_tier": random.randint(30, 115),
            "paragon_level": random.randint(120, 300),
            "world_tier": "Torment IV",
            "infernal_horde_tier": f"Tier {random.randint(5, 8)}",
            "masterworked_items": random.randint(4, 12),
        })
    elif primary_franchise == "OVERWATCH2":
        game_telemetry.update({
            "main_hero": random.choice(["Tracer", "Genji", "Ana", "Kiriko", "Reinhardt", "D.Va", "Sojourn"]),
            "role": random.choice(["Tank", "Damage", "Support"]),
            "rank_tier": random.choice(["Gold 1", "Platinum 3", "Diamond 2", "Master 4", "Grandmaster 1", "Top 500"]),
            "win_rate": f"{random.randint(48, 67)}%",
            "mythic_skins_owned": random.randint(1, 8),
        })
    elif primary_franchise == "CANDYCRUSH":
        game_telemetry.update({
            "current_level": random.randint(450, 4800),
            "stars_collected": random.randint(1200, 14000),
            "boosters_inventory": random.randint(5, 65),
            "streak_days": random.randint(3, 180),
            "lives_sent_today": random.randint(0, 15),
        })

    # Purchase History
    purchased_items = []
    avail_catalog = FRANCHISE_CATALOGS[primary_franchise]
    if lifetime_spend >= 50:
        num_items = min(len(avail_catalog), max(1, int(lifetime_spend / 65)))
        sample_items = random.sample(avail_catalog, num_items)
        for sitm in sample_items:
            purchased_items.append({
                "title": sitm["title"],
                "price": sitm["price"],
                "date": f"2024-{random.randint(1,12):02d}-{random.randint(1,28):02d}",
                "category": sitm["category"],
                "type": sitm["type"],
            })

    flag_map = {
        "United States": "🇺🇸", "United Kingdom": "🇬🇧", "France": "🇫🇷", "Germany": "🇩🇪",
        "Spain": "🇪🇸", "Brazil": "🇧🇷", "Japan": "🇯🇵", "Saudi Arabia": "🇸🇦"
    }
    code_map = {
        "United States": "US", "United Kingdom": "GB", "France": "FR", "Germany": "DE",
        "Spain": "ES", "Brazil": "BR", "Japan": "JP", "Saudi Arabia": "SA"
    }

    player_record = {
        "player_id": pid,
        "display_name": display_name,
        "gamer_tag": gamer_tag,
        "primary_email": email,
        "primary_franchise": primary_franchise,
        "franchises_played": cross_titles,
        "primary_archetype": archetype,
        "lifetime_spend_usd": lifetime_spend,
        "churn_risk_score": churn_risk,
        "tilt_sensitivity": tilt_sensitivity,
        "recent_loss_streak": loss_streak,
        "country": city["country"],
        "country_code": code_map.get(city["country"], "US"),
        "country_flag": flag_map.get(city["country"], "🌐"),
        "dma_market": city["dma"],
        "lat": round(lat_jitter, 4),
        "lng": round(lng_jitter, 4),
        "primary_creator_influence": primary_creator,
        "followed_creators": followed_creators,
        "game_telemetry": game_telemetry,
        "purchased_items": purchased_items,
    }
    master_players.append(player_record)

    # 1. Platform Identity & Edges
    # Battle.net
    bnet_id = f"ident-bnet-{i:05d}"
    platform_identities.append({
        "identity_id": bnet_id,
        "platform": "BATTLE_NET",
        "platform_handle": gamer_tag,
        "confidence_score": 1.0,
    })
    has_identity_edges.append({
        "player_id": pid,
        "identity_id": bnet_id,
        "confidence_score": 1.0,
    })

    # Secondary Console or Mobile Platform
    if primary_franchise in ["COD", "OVERWATCH2"]:
        console_type = random.choice(["PLAYSTATION_NETWORK", "XBOX_LIVE", "STEAM"])
        console_id = f"ident-console-{i:05d}"
        platform_identities.append({
            "identity_id": console_id,
            "platform": console_type,
            "platform_handle": f"{prefix}_{suffix}",
            "confidence_score": round(random.uniform(0.92, 0.99), 2),
        })
        has_identity_edges.append({
            "player_id": pid,
            "identity_id": console_id,
            "confidence_score": round(random.uniform(0.92, 0.99), 2),
        })
    elif primary_franchise == "CANDYCRUSH":
        mob_id = f"ident-king-{i:05d}"
        platform_identities.append({
            "identity_id": mob_id,
            "platform": "KING_MOBILE_ID",
            "platform_handle": f"King_{prefix}_{tag_num}",
            "confidence_score": 0.97,
        })
        has_identity_edges.append({
            "player_id": pid,
            "identity_id": mob_id,
            "confidence_score": 0.97,
        })

    # 2. Played Game Edges
    for g_key in cross_titles:
        g_id = f"game-{g_key.lower().replace('4', '').replace('2', '')}"
        played_game_edges.append({
            "player_id": pid,
            "game_id": g_id,
            "hours_played": random.randint(20, 1500),
            "last_played_timestamp": f"2024-09-{random.randint(1,14):02d}T{random.randint(10,23):02d}:00:00Z"
        })

    # 3. Clan / Guild Affiliation
    if random.random() < 0.45:
        rel_clans = [c for c in CLANS if c["franchise"] == primary_franchise]
        if rel_clans:
            chosen_clan = random.choice(rel_clans)
            member_of_clan_edges.append({
                "player_id": pid,
                "clan_id": chosen_clan["clan_id"],
                "role": "OFFICER" if lifetime_spend >= 1000 else "MEMBER"
            })

    # 4. Telemetry Match Events (for Situational Engine)
    if loss_streak >= 2:
        telemetry_match_events.append({
            "event_id": f"evt-{i:06d}",
            "player_id": pid,
            "game_id": f"game-{primary_franchise.lower()}",
            "event_type": "GULAG_DEFEAT_LOSS_STREAK" if primary_franchise == "COD" else "RAID_WIPE_STREAK" if primary_franchise == "WOW" else "PIT_DEATH_SLUMP" if primary_franchise == "DIABLO4" else "OUT_OF_MOVES_STUCK",
            "consecutive_losses": loss_streak,
            "tilt_index": tilt_sensitivity,
            "timestamp": "2024-09-14T12:45:00Z",
            "triggered_offer_id": f"off-{primary_franchise.lower()}-08" if len(FRANCHISE_CATALOGS[primary_franchise]) >= 8 else f"off-{primary_franchise.lower()}-01",
        })

print("Saving synthesized datasets to data/...")
os.makedirs("data", exist_ok=True)

with open("data/master_players.json", "w") as f:
    json.dump(master_players, f, indent=2)
print(f"-> master_players.json: {len(master_players)} records")

with open("data/platform_identities.json", "w") as f:
    json.dump(platform_identities, f, indent=2)
print(f"-> platform_identities.json: {len(platform_identities)} records")

with open("data/has_identity_edges.json", "w") as f:
    json.dump(has_identity_edges, f, indent=2)
print(f"-> has_identity_edges.json: {len(has_identity_edges)} records")

with open("data/games.json", "w") as f:
    json.dump(GAMES, f, indent=2)
print(f"-> games.json: {len(GAMES)} records")

with open("data/played_game_edges.json", "w") as f:
    json.dump(played_game_edges, f, indent=2)
print(f"-> played_game_edges.json: {len(played_game_edges)} records")

with open("data/clans.json", "w") as f:
    json.dump(CLANS, f, indent=2)
print(f"-> clans.json: {len(CLANS)} records")

with open("data/member_of_clan_edges.json", "w") as f:
    json.dump(member_of_clan_edges, f, indent=2)
print(f"-> member_of_clan_edges.json: {len(member_of_clan_edges)} records")

with open("data/creators.json", "w") as f:
    json.dump(CREATORS, f, indent=2)
print(f"-> creators.json: {len(CREATORS)} records")

with open("data/marketing_offers.json", "w") as f:
    json.dump(all_offers, f, indent=2)
print(f"-> marketing_offers.json: {len(all_offers)} records")

with open("data/telemetry_match_events.json", "w") as f:
    json.dump(telemetry_match_events, f, indent=2)
print(f"-> telemetry_match_events.json: {len(telemetry_match_events)} records")

# Also write identity graph projection
identity_graph = []
for p in master_players[:500]:
    identity_graph.append({
        "master_player_id": p["player_id"],
        "display_name": p["display_name"],
        "primary_franchise": p["primary_franchise"],
        "lifetime_spend": p["lifetime_spend_usd"],
        "linked_identities_count": len([e for e in has_identity_edges if e["player_id"] == p["player_id"]]),
        "primary_creator": p["primary_creator_influence"],
        "market": p["dma_market"]
    })
with open("data/fct_player_identity_graph.json", "w") as f:
    json.dump(identity_graph, f, indent=2)
print(f"-> fct_player_identity_graph.json: {len(identity_graph)} records")

print("ABK Dataset Synthesis Complete!")
