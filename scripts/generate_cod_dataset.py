#!/usr/bin/env python3
"""
Generate 100% Call of Duty Dataset for Activision Audience Intelligence Engine.

Generates:
  - data/games.json
  - data/creators.json
  - data/clans.json
  - data/marketing_offers.json
  - data/master_players.json (5,000 Call of Duty players)
  - data/platform_identities.json
  - data/has_identity_edges.json
  - data/played_game_edges.json
  - data/member_of_clan_edges.json
  - data/telemetry_match_events.json
"""

import json
import random
import os

random.seed(42)

COD_SUB_MODES = ["WARZONE", "BLACK_OPS", "MODERN_WARFARE", "CDL_RANKED", "COD_MOBILE"]

GAMER_PREFIXES = {
    "WARZONE": [
        "VerdanskOG", "GulagClutcher", "SlideCancel", "TacMapKing", "DropShot",
        "ResurgenceSweat", "Kar98Sniper", "MetaLoadout", "SuperstoreRat", "PrisonDemon",
        "Ghost", "Soap", "GasRunner", "BuyStationChad", "UAVSpammer", "LoadoutDrop",
        "BiffleFan", "SwaggArmy", "AydanMovement", "RebirthKing"
    ],
    "BLACK_OPS": [
        "OmniMovement", "TerminusSlayer", "LibertyFalls", "PackAPunch", "Juggernog",
        "RayGunGod", "DarkMatterGrinder", "WonderWeapon", "MysteryBox", "TreyarchPurist",
        "Mason", "Woods", "Hudson", "Adler", "Bell", "StandoffAnchor", "RaidMaster",
        "NuketownDemon", "Round50Plus", "GobbleGumWhale"
    ],
    "MODERN_WARFARE": [
        "Price", "Ghost", "Soap", "Gaz", "Roach", "TaskForce141", "TerminalSniper",
        "HighriseJump", "FavelaRunner", "Rust1v1", "Shipment247", "InterstellarCamo",
        "SearchAndDestroy", "NinjaDefuse", "AftermarketPart", "MCWBeam", "Rival9Spray",
        "CleanKill", "HardpointHold", "ClaymoreTroll"
    ],
    "CDL_RANKED": [
        "Top250Grinder", "IridescentRank", "CrimsonSweat", "ScumpTheKing", "ShotzzyMovement",
        "SimpTinyTerror", "DashySniper", "FaZeUp", "GreenWall", "FlankListener",
        "HardpointAnchor", "ControlClutch", "SnDStar", "CDLChamp", "MainAR",
        "SubSlayer", "SpawnFlipper", "VetoPhase", "GA_Compliant", "RankedDemoted"
    ],
    "COD_MOBILE": [
        "CODMPro", "MythicDrawWhale", "FourFingerClaw", "TouchpadBeast", "GyroAimer",
        "CODM_Legendary", "WarzoneMobile", "VerdanskPocket", "IsolatedBR", "AlcatrazGrinder",
        "GarenaSniper", "BackboneGamer", "iPadDemon", "CODM_Whale", "M4Mythic"
    ]
}

GAMER_SUFFIXES = [
    "99", "77", "07", "Prime", "BlackCell", "Ultra", "Elite", "Pro", "Prestige",
    "Captain", "God", "King", "Lord", "Demon", "Whale", "Sweat", "Streamer", "YT", "Twitch",
    "US", "UK", "EU", "DE", "FR", "BR", "JP", "SA", "141", "CDL"
]

CITIES = [
    {"dma": "Los Angeles DMA", "country": "United States", "region": "us-lax", "lat": 34.0522, "lng": -118.2437},
    {"dma": "Dallas / Fort Worth DMA", "country": "United States", "region": "us-dfw", "lat": 32.7767, "lng": -96.7970},
    {"dma": "New York DMA", "country": "United States", "region": "us-nyc", "lat": 40.7128, "lng": -74.0060},
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

# 100% Call of Duty Games Catalog
GAMES = [
    {
        "game_id": "game-cod",
        "franchise": "COD",
        "title": "Call of Duty HQ",
        "genre": "Tactical FPS Ecosystem",
        "active_players": 45000000,
        "is_parent_hub": True,
        "parent_game_id": None,
        "release_date": None,
        "lifecycle_status": "LIVE",
        "monetization_model": "ECOSYSTEM_HUB",
        "current_season": "Season 6: The Haunting"
    },
    {
        "game_id": "game-cod-warzone",
        "franchise": "WARZONE",
        "title": "Call of Duty: Warzone & Resurgence",
        "genre": "Battle Royale & Resurgence",
        "active_players": 24000000,
        "is_parent_hub": True,
        "parent_game_id": "game-cod",
        "release_date": "2020-03-10",
        "lifecycle_status": "LIVE",
        "monetization_model": "FREE_TO_PLAY_PLUS_BLACKCELL",
        "current_season": "Season 6: The Haunting"
    },
    {
        "game_id": "game-cod-bo6",
        "franchise": "BLACK_OPS",
        "title": "Call of Duty: Black Ops 6",
        "genre": "Omnimovement Tactical FPS & Zombies",
        "active_players": 18000000,
        "is_parent_hub": True,
        "parent_game_id": "game-cod",
        "release_date": "2024-10-25",
        "lifecycle_status": "LIVE",
        "monetization_model": "PREMIUM_PLUS_BATTLE_PASS",
        "current_season": "Season 1 Launch"
    },
    {
        "game_id": "game-cod-mw3",
        "franchise": "MODERN_WARFARE",
        "title": "Call of Duty: Modern Warfare III",
        "genre": "Tactical Multiplayer & MWZ",
        "active_players": 12000000,
        "is_parent_hub": True,
        "parent_game_id": "game-cod",
        "release_date": "2023-11-10",
        "lifecycle_status": "LIVE",
        "monetization_model": "PREMIUM_PLUS_BATTLE_PASS",
        "current_season": "Season 6: The Haunting"
    },
    {
        "game_id": "game-cod-cdl",
        "franchise": "CDL_RANKED",
        "title": "Call of Duty League & Ranked Play",
        "genre": "Competitive 4v4 Esports",
        "active_players": 6500000,
        "is_parent_hub": True,
        "parent_game_id": "game-cod",
        "release_date": "2024-01-15",
        "lifecycle_status": "LIVE",
        "monetization_model": "COMPETITIVE_BUNDLES",
        "current_season": "2025 CDL Championship Season"
    },
    {
        "game_id": "game-cod-mobile",
        "franchise": "COD_MOBILE",
        "title": "Call of Duty: Mobile & Warzone Mobile",
        "genre": "Mobile Tactical FPS & BR",
        "active_players": 32000000,
        "is_parent_hub": True,
        "parent_game_id": "game-cod",
        "release_date": "2019-10-01",
        "lifecycle_status": "LIVE",
        "monetization_model": "FREE_TO_PLAY_MYTHIC_DRAWS",
        "current_season": "Season 9: Orbital Raid"
    },
    {
        "game_id": "game-cod-bo2",
        "franchise": "BLACK_OPS",
        "title": "Call of Duty: Black Ops II (Legacy)",
        "genre": "Classic Tactical FPS",
        "active_players": 120000,
        "is_parent_hub": False,
        "parent_game_id": "game-cod-bo6",
        "release_date": "2012-11-13",
        "lifecycle_status": "LEGACY",
        "monetization_model": "LEGACY_PURCHASE",
        "current_season": "Legacy Matchmaking"
    },
    {
        "game_id": "game-cod-mw2-classic",
        "franchise": "MODERN_WARFARE",
        "title": "Call of Duty: Modern Warfare 2 (2009 Classic)",
        "genre": "Classic Tactical FPS",
        "active_players": 85000,
        "is_parent_hub": False,
        "parent_game_id": "game-cod-mw3",
        "release_date": "2009-11-10",
        "lifecycle_status": "LEGACY",
        "monetization_model": "LEGACY_PURCHASE",
        "current_season": "Legacy Matchmaking"
    },
    {
        "game_id": "game-cod-dmz",
        "franchise": "WARZONE",
        "title": "Call of Duty: DMZ Extraction",
        "genre": "Extraction Shooter",
        "active_players": 850000,
        "is_parent_hub": False,
        "parent_game_id": "game-cod-warzone",
        "release_date": "2022-11-16",
        "lifecycle_status": "LEGACY",
        "monetization_model": "FREE_TO_PLAY",
        "current_season": "Legacy Operations"
    },
    {
        "game_id": "game-cod-zombies-classic",
        "franchise": "BLACK_OPS",
        "title": "Call of Duty: Black Ops Zombies (Classic)",
        "genre": "Round-Based Co-Op Survival",
        "active_players": 450000,
        "is_parent_hub": False,
        "parent_game_id": "game-cod-bo6",
        "release_date": "2015-11-06",
        "lifecycle_status": "LEGACY",
        "monetization_model": "DLC_MAP_PACKS",
        "current_season": "Chronicles Master"
    }
]

# 100% Call of Duty Creators & Pros
CREATORS = [
    {
        "creator_id": "creator-scump",
        "name": "Seth 'Scump' Abner",
        "handle": "Scump",
        "platform": "Twitch & YouTube",
        "franchise": "CDL_RANKED",
        "followers": 3200000,
        "avatar": "🎯",
        "avg_stream_viewers": 48000,
        "conversion_affinity": 0.94,
        "signature_mode": "CDL Watch Party & Ranked Play"
    },
    {
        "creator_id": "creator-swagg",
        "name": "Kris 'FaZe Swagg' Lamberson",
        "handle": "FaZe_Swagg",
        "platform": "Twitch",
        "franchise": "WARZONE",
        "followers": 2900000,
        "avatar": "⚡",
        "avg_stream_viewers": 28000,
        "conversion_affinity": 0.88,
        "signature_mode": "Warzone High-Kill Nukes & Urzikstan Squads"
    },
    {
        "creator_id": "creator-timthetatman",
        "name": "Timothy 'TimTheTatman' Betar",
        "handle": "TimTheTatman",
        "platform": "YouTube Gaming",
        "franchise": "WARZONE",
        "followers": 4800000,
        "avatar": "📺",
        "avg_stream_viewers": 42000,
        "conversion_affinity": 0.86,
        "signature_mode": "Warzone Spectating & Custom Loadout Chaos"
    },
    {
        "creator_id": "creator-biffle",
        "name": "Diaz 'Biffle'",
        "handle": "DiazBiffle",
        "platform": "Twitch",
        "franchise": "WARZONE",
        "followers": 1100000,
        "avatar": "🏆",
        "avg_stream_viewers": 22000,
        "conversion_affinity": 0.93,
        "signature_mode": "World Series of Warzone Champion & Rebirth Demons"
    },
    {
        "creator_id": "creator-jgod",
        "name": "James 'JGOD'",
        "handle": "JGOD",
        "platform": "YouTube",
        "franchise": "MODERN_WARFARE",
        "followers": 1250000,
        "avatar": "📊",
        "avg_stream_viewers": 25000,
        "conversion_affinity": 0.91,
        "signature_mode": "Weapon Meta Analysis, TTK Breakdown & Attachments"
    },
    {
        "creator_id": "creator-zoomaa",
        "name": "Thomas 'ZooMaa' Paparatto",
        "handle": "ZooMaa",
        "platform": "Twitch",
        "franchise": "CDL_RANKED",
        "followers": 850000,
        "avatar": "🐴",
        "avg_stream_viewers": 24000,
        "conversion_affinity": 0.89,
        "signature_mode": "The Flank CDL Breakdown & Rostermania"
    },
    {
        "creator_id": "creator-teep",
        "name": "Tyler 'TeeP' Polchow",
        "handle": "TeeP",
        "platform": "Twitch",
        "franchise": "WARZONE",
        "followers": 1400000,
        "avatar": "🛡️",
        "avg_stream_viewers": 16000,
        "conversion_affinity": 0.87,
        "signature_mode": "Solo vs Squads & Iron Trials Tactical Play"
    },
    {
        "creator_id": "creator-shotzzy",
        "name": "Anthony 'Shotzzy' Cuevas-Castro",
        "handle": "Shotzzy",
        "platform": "Twitch & YouTube",
        "franchise": "CDL_RANKED",
        "followers": 950000,
        "avatar": "🏃",
        "avg_stream_viewers": 19000,
        "conversion_affinity": 0.92,
        "signature_mode": "OpTic Texas Omnimovement & CDL Hardpoint"
    },
    {
        "creator_id": "creator-dashy",
        "name": "Brandon 'Dashy' Otell",
        "handle": "Dashy",
        "platform": "Twitch",
        "franchise": "MODERN_WARFARE",
        "followers": 890000,
        "avatar": "🎯",
        "avg_stream_viewers": 17000,
        "conversion_affinity": 0.90,
        "signature_mode": "OpTic World Champion Main AR & S&D Sniping"
    },
    {
        "creator_id": "creator-aydan",
        "name": "Aydan Conrad",
        "handle": "Aydan",
        "platform": "Twitch",
        "franchise": "WARZONE",
        "followers": 3100000,
        "avatar": "👑",
        "avg_stream_viewers": 20000,
        "conversion_affinity": 0.85,
        "signature_mode": "All-Time Warzone Tournament Earner & Movement Demon"
    }
]

# 100% Call of Duty Clans & Esports Franchises
CLANS = [
    {"clan_id": "clan-optic", "name": "OpTic Gaming (Green Wall)", "franchise": "CDL_RANKED", "region": "us-dfw", "member_count": 14500, "tier": "PRO_CHAMPIONS"},
    {"clan_id": "clan-faze", "name": "FaZe Clan", "franchise": "WARZONE", "region": "us-lax", "member_count": 16200, "tier": "PRO_CHAMPIONS"},
    {"clan_id": "clan-thieves", "name": "100 Thieves (LA Thieves)", "franchise": "CDL_RANKED", "region": "us-lax", "member_count": 9800, "tier": "PRO_ESPORTS"},
    {"clan_id": "clan-falcons", "name": "Team Falcons (WSOW Champions)", "franchise": "WARZONE", "region": "sa-ruh", "member_count": 7200, "tier": "WORLD_SERIES_CHAMPS"},
    {"clan_id": "clan-subliners", "name": "New York Subliners", "franchise": "CDL_RANKED", "region": "us-nyc", "member_count": 8100, "tier": "PRO_ESPORTS"},
    {"clan_id": "clan-ultra", "name": "Toronto Ultra", "franchise": "CDL_RANKED", "region": "us-nyc", "member_count": 6400, "tier": "PRO_ESPORTS"},
    {"clan_id": "clan-taskforce141", "name": "Task Force 141 Milsim", "franchise": "MODERN_WARFARE", "region": "uk-lon", "member_count": 5200, "tier": "COMMUNITY_MILSIM"},
    {"clan_id": "clan-rebirth-demons", "name": "Rebirth Island Demons", "franchise": "WARZONE", "region": "us-chi", "member_count": 11400, "tier": "RESURGENCE_ELITE"},
    {"clan_id": "clan-terminal-snipers", "name": "Intervention Snipers Club", "franchise": "MODERN_WARFARE", "region": "de-ber", "member_count": 4800, "tier": "LEGACY_SNIPERS"}
]

# 100% Call of Duty Marketing Offers Catalog
MARKETING_OFFERS = [
    {
        "offer_id": "off-cod-01",
        "target_franchise": "WARZONE",
        "game_id": "game-cod-warzone",
        "offer_title": "Season 6 BlackCell Battle Pass Bundle",
        "offer_type": "BATTLE_PASS",
        "category": "Premium Battle Pass",
        "price_usd": 29.99,
        "expected_conversion_boost": 28.4,
        "affinity_archetype": "BLACKCELL_WHALE",
        "lifecycle_status": "CURRENT",
        "available_from": "2026-09-17",
        "description": "Unlock exclusive BlackCell operator variants, 1,100 instant CoD Points, reactive weapon blueprints, and mastercraft tracer rounds."
    },
    {
        "offer_id": "off-cod-02",
        "target_franchise": "BLACK_OPS",
        "game_id": "game-cod-bo6",
        "offer_title": "Black Ops 6 Vault Edition Upgrade",
        "offer_type": "EDITION_UPGRADE",
        "category": "Premium Game",
        "price_usd": 29.99,
        "expected_conversion_boost": 34.2,
        "affinity_archetype": "BLACKCELL_WHALE",
        "lifecycle_status": "CURRENT",
        "available_from": "2024-10-25",
        "description": "Upgrade to Vault Edition: Hunters vs Hunted Operator Pack, Mastercraft Weapon Collection, Season 1 BlackCell, and GobbleGum Pack."
    },
    {
        "offer_id": "off-cod-03",
        "target_franchise": "CDL_RANKED",
        "game_id": "game-cod-cdl",
        "offer_title": "CDL OpTic Texas Championship Supporter Pack",
        "offer_type": "ESPORTS_PACK",
        "category": "CDL Team Pack",
        "price_usd": 9.99,
        "expected_conversion_boost": 38.6,
        "affinity_archetype": "CDL_RANKED_SWEAT",
        "lifecycle_status": "CURRENT",
        "available_from": "2024-01-15",
        "description": "Show Green Wall pride with home/away team operator skins, weapon camo, charm, sticker, and calling card."
    },
    {
        "offer_id": "off-cod-04",
        "target_franchise": "CDL_RANKED",
        "game_id": "game-cod-cdl",
        "offer_title": "CDL Atlanta FaZe Championship Supporter Pack",
        "offer_type": "ESPORTS_PACK",
        "category": "CDL Team Pack",
        "price_usd": 9.99,
        "expected_conversion_boost": 36.1,
        "affinity_archetype": "CDL_RANKED_SWEAT",
        "lifecycle_status": "CURRENT",
        "available_from": "2024-01-15",
        "description": "Equip the FaZe Clan red/black competitive uniform, weapon camo, and tournament emblem."
    },
    {
        "offer_id": "off-cod-05",
        "target_franchise": "MODERN_WARFARE",
        "game_id": "game-cod-mw3",
        "offer_title": "Mastercraft Tracer Pack: Celestial Dragon Weapon Blueprint",
        "offer_type": "OPERATOR_BUNDLE",
        "category": "Mastercraft Bundle",
        "price_usd": 24.99,
        "expected_conversion_boost": 22.8,
        "affinity_archetype": "BLACKCELL_WHALE",
        "lifecycle_status": "CURRENT",
        "available_from": "2024-03-20",
        "description": "Animated dragon inspection, custom dismemberment death effect, and glowing celestial tracers on MCW & Rival-9."
    },
    {
        "offer_id": "off-cod-06",
        "target_franchise": "WARZONE",
        "game_id": "game-cod-warzone",
        "offer_title": "Gulag Loss-Streak Recovery Care Package",
        "offer_type": "SITUATIONAL_RECOVERY",
        "category": "Situational Retention",
        "price_usd": 4.99,
        "expected_conversion_boost": 41.2,
        "affinity_archetype": "GULAG_TILT_RISK",
        "lifecycle_status": "CURRENT",
        "available_from": "2026-09-17",
        "description": "In-game tilt mitigation: instant 500 CoD Points, 1-hour Double Weapon XP token, and Gulag Veteran calling card triggered on 3+ consecutive defeats."
    },
    {
        "offer_id": "off-cod-07",
        "target_franchise": "WARZONE",
        "game_id": "game-cod-warzone",
        "offer_title": "13,000 CoD Points Treasury Vault",
        "offer_type": "VIRTUAL_CURRENCY",
        "category": "CoD Store Currency",
        "price_usd": 99.99,
        "expected_conversion_boost": 18.2,
        "affinity_archetype": "BLACKCELL_WHALE",
        "lifecycle_status": "CURRENT",
        "available_from": "2024-01-01",
        "description": "Maximum tier currency vault with +3,000 bonus points for mid-season store mastercraft drops."
    },
    {
        "offer_id": "off-cod-08",
        "target_franchise": "MODERN_WARFARE",
        "game_id": "game-cod-mw3",
        "offer_title": "5,000 (+800 Bonus) CoD Points Tactical Pack",
        "offer_type": "VIRTUAL_CURRENCY",
        "category": "CoD Store Currency",
        "price_usd": 39.99,
        "expected_conversion_boost": 21.5,
        "affinity_archetype": "CAMO_COMPLETIONIST",
        "lifecycle_status": "CURRENT",
        "available_from": "2024-01-01",
        "description": "Stock up on currency for weapon leveling bundles and aftermarket conversion kits."
    },
    {
        "offer_id": "off-cod-09",
        "target_franchise": "BLACK_OPS",
        "game_id": "game-cod-bo6",
        "offer_title": "Zombies GobbleGum Ultra Mega Pack",
        "offer_type": "ZOMBIES_CONSUMABLE",
        "category": "Zombies Item Pack",
        "price_usd": 9.99,
        "expected_conversion_boost": 31.8,
        "affinity_archetype": "ROUND_BASED_ZOMBIES_SLAYER",
        "lifecycle_status": "CURRENT",
        "available_from": "2024-10-25",
        "description": "15x Ultra-Rare GobbleGums (Perkaholic, Reign Drops, Power Vacuum) for high-round Terminus and Liberty Falls runs."
    },
    {
        "offer_id": "off-cod-10",
        "target_franchise": "COD_MOBILE",
        "game_id": "game-cod-mobile",
        "offer_title": "CoD Mobile Mythic Weapon Drop: Grau 5.56 Phantom",
        "offer_type": "MYTHIC_DRAW",
        "category": "Mobile Mythic",
        "price_usd": 29.99,
        "expected_conversion_boost": 27.5,
        "affinity_archetype": "MOBILE_TOUCHPAD_PRODIGY",
        "lifecycle_status": "CURRENT",
        "available_from": "2024-05-10",
        "description": "Fully customizable mythic muzzle flashes, kill counter, inspection animation, and unique mythic shroud."
    },
    {
        "offer_id": "off-cod-11",
        "target_franchise": "WARZONE",
        "game_id": "game-cod-warzone",
        "offer_title": "Rebirth Island Resurgence Squad Recovery Drop",
        "offer_type": "SITUATIONAL_RECOVERY",
        "category": "Situational Retention",
        "price_usd": 9.99,
        "expected_conversion_boost": 35.4,
        "affinity_archetype": "VERDANSK_OG",
        "lifecycle_status": "CURRENT",
        "available_from": "2024-04-03",
        "description": "Special squad pack with 1,100 CP, Kar98k nostalgic blueprint, and 4x squad 2XP tokens."
    },
    {
        "offer_id": "off-cod-12",
        "target_franchise": "MODERN_WARFARE",
        "game_id": "game-cod-mw3",
        "offer_title": "Search & Destroy Clutch Pro Bundle",
        "offer_type": "OPERATOR_BUNDLE",
        "category": "Tactical Bundle",
        "price_usd": 19.99,
        "expected_conversion_boost": 29.7,
        "affinity_archetype": "SEARCH_AND_DESTROY_SPECIALIST",
        "lifecycle_status": "CURRENT",
        "available_from": "2024-02-14",
        "description": "Includes 2,400 CP, stealth ninja operator skin, silenced sniper blueprint, and custom bomb defuse animation."
    },
    {
        "offer_id": "off-cod-13",
        "target_franchise": "WARZONE",
        "game_id": "game-cod-warzone",
        "offer_title": "DMZ Extraction Insurance Protocol Bundle",
        "offer_type": "UTILITY_PACK",
        "category": "Extraction Utility",
        "price_usd": 14.99,
        "expected_conversion_boost": 24.1,
        "affinity_archetype": "DMZ_EXTRACTION_SURVIVOR",
        "lifecycle_status": "CURRENT",
        "available_from": "2023-08-10",
        "description": "Free insured weapon slot cooldown reduction, medium backpack operator skin, and 1,000 CP."
    },
    {
        "offer_id": "off-cod-14",
        "target_franchise": "WARZONE",
        "game_id": "game-cod-warzone",
        "offer_title": "Standard Seasonal Battle Pass (1,100 CP)",
        "offer_type": "BATTLE_PASS",
        "category": "Standard Battle Pass",
        "price_usd": 9.99,
        "expected_conversion_boost": 19.3,
        "affinity_archetype": "CASUAL_WARZONE_WARRIOR",
        "lifecycle_status": "CURRENT",
        "available_from": "2026-09-17",
        "description": "Full 100-tier battle pass access across Warzone, Black Ops 6, and Modern Warfare III."
    }
]

FRANCHISE_TO_GAME_ID = {
    "WARZONE": "game-cod-warzone",
    "BLACK_OPS": "game-cod-bo6",
    "MODERN_WARFARE": "game-cod-mw3",
    "CDL_RANKED": "game-cod-cdl",
    "COD_MOBILE": "game-cod-mobile",
    "COD": "game-cod"
}

ARCHETYPES = [
    "BLACKCELL_WHALE",
    "VERDANSK_OG",
    "CDL_RANKED_SWEAT",
    "CAMO_COMPLETIONIST",
    "ROUND_BASED_ZOMBIES_SLAYER",
    "SEARCH_AND_DESTROY_SPECIALIST",
    "CASUAL_WARZONE_WARRIOR",
    "MOBILE_TOUCHPAD_PRODIGY",
    "DMZ_EXTRACTION_SURVIVOR",
    "GULAG_TILT_RISK"
]

print("Generating 5,000 Call of Duty Master Player Profiles (100% Activision)...")

master_players = []
platform_identities = []
has_identity_edges = []
played_game_edges = []
member_of_clan_edges = []
telemetry_match_events = []

for i in range(1, 5001):
    pid = f"cod-usr-{i:05d}"
    
    # Sub-mode distribution in Call of Duty:
    # Warzone: 38%, Black Ops 6: 28%, Modern Warfare III: 16%, CDL Ranked: 10%, Mobile: 8%
    roll = random.random()
    if roll < 0.38:
        primary_franchise = "WARZONE"
    elif roll < 0.66:
        primary_franchise = "BLACK_OPS"
    elif roll < 0.82:
        primary_franchise = "MODERN_WARFARE"
    elif roll < 0.92:
        primary_franchise = "CDL_RANKED"
    else:
        primary_franchise = "COD_MOBILE"

    # Cross-mode play inside Call of Duty HQ
    cross_titles = [primary_franchise, "COD"]
    if random.random() < 0.55:
        # Many CoD players play both Warzone and Multiplayer/Zombies or Ranked
        other_modes = [m for m in COD_SUB_MODES if m != primary_franchise]
        cross_titles.append(random.choice(other_modes))
        if random.random() < 0.25:
            remaining = [m for m in other_modes if m not in cross_titles]
            if remaining:
                cross_titles.append(random.choice(remaining))

    # Name generation
    prefix = random.choice(GAMER_PREFIXES[primary_franchise])
    suffix = random.choice(GAMER_SUFFIXES)
    tag_num = random.randint(1000, 9999)
    display_name = f"{prefix}_{suffix}"
    gamer_tag = f"{prefix}#{tag_num}"
    email = f"{prefix.lower()}.{tag_num}@activision.live"

    # City & Geography
    city = random.choice(CITIES)
    lat_jitter = city["lat"] + (random.random() - 0.5) * 0.15
    lng_jitter = city["lng"] + (random.random() - 0.5) * 0.15

    # Friction / Tilt / Loss Streak
    loss_streak = random.choices([0, 1, 2, 3, 4, 5], weights=[45, 25, 15, 9, 4, 2])[0]
    tilt_sensitivity = round(random.uniform(0.2, 0.95), 2)
    churn_risk = round(random.betavariate(2, 3), 2)

    if loss_streak >= 3:
        tilt_sensitivity = max(tilt_sensitivity, 0.75)
        churn_risk = min(0.95, churn_risk + 0.25)

    # Spend Profile & Archetype Assignment
    spend_tier_roll = random.random()
    if loss_streak >= 3 and random.random() < 0.55:
        archetype = "GULAG_TILT_RISK"
        lifetime_spend = round(random.uniform(50.0, 450.0), 2)
    elif spend_tier_roll < 0.08:
        # Whales (8% spend $1,000 - $4,800 on BlackCell, CP, Mastercrafts)
        lifetime_spend = round(random.uniform(1000.0, 4800.0), 2)
        archetype = "BLACKCELL_WHALE"
    elif spend_tier_roll < 0.28:
        # Competitive & Ranked Grinders ($300 - $999)
        lifetime_spend = round(random.uniform(300.0, 999.0), 2)
        if primary_franchise == "CDL_RANKED":
            archetype = "CDL_RANKED_SWEAT"
        elif primary_franchise == "WARZONE":
            archetype = "VERDANSK_OG" if random.random() < 0.6 else "BLACKCELL_WHALE"
        elif primary_franchise == "BLACK_OPS":
            archetype = "ROUND_BASED_ZOMBIES_SLAYER" if random.random() < 0.5 else "CAMO_COMPLETIONIST"
        elif primary_franchise == "MODERN_WARFARE":
            archetype = "SEARCH_AND_DESTROY_SPECIALIST" if random.random() < 0.5 else "CAMO_COMPLETIONIST"
        else:
            archetype = "MOBILE_TOUCHPAD_PRODIGY"
    elif spend_tier_roll < 0.60:
        # Mid-Tier Grinders ($70 - $299)
        lifetime_spend = round(random.uniform(70.0, 299.0), 2)
        if primary_franchise == "BLACK_OPS":
            archetype = random.choice(["ROUND_BASED_ZOMBIES_SLAYER", "CAMO_COMPLETIONIST"])
        elif primary_franchise == "MODERN_WARFARE":
            archetype = random.choice(["SEARCH_AND_DESTROY_SPECIALIST", "CAMO_COMPLETIONIST"])
        elif primary_franchise == "WARZONE":
            archetype = random.choice(["VERDANSK_OG", "DMZ_EXTRACTION_SURVIVOR", "CASUAL_WARZONE_WARRIOR"])
        elif primary_franchise == "CDL_RANKED":
            archetype = "CDL_RANKED_SWEAT"
        else:
            archetype = "MOBILE_TOUCHPAD_PRODIGY"
    else:
        # Casual Weekend Warriors & Free-to-Play ($0 - $69)
        lifetime_spend = round(random.uniform(0.0, 69.99), 2)
        if primary_franchise == "WARZONE":
            archetype = "CASUAL_WARZONE_WARRIOR"
        elif primary_franchise == "COD_MOBILE":
            archetype = "MOBILE_TOUCHPAD_PRODIGY"
        elif primary_franchise == "BLACK_OPS":
            archetype = "ROUND_BASED_ZOMBIES_SLAYER"
        else:
            archetype = "CASUAL_WARZONE_WARRIOR"

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

    # 100% Authentic Call of Duty Game Telemetry
    main_loadouts = [
        "MCW / Striker 9 (Meta CDL)",
        "Kar98k / Superi 46 (Resurgence Speed)",
        "Jackal PDW / Marine SP (Omnimovement)",
        "Ames 85 / Tanto .22 (Mid-Range Beam)",
        "XM4 / C9 (Black Ops 6 Flex)",
        "SVA 545 / Renetti (Burst Conversion)",
        "FJX Horus / Holger 556 (Close Quarters)",
        "Intervention .50 / Striker (Quickscope)"
    ]
    mastery_camos = ["None", "Gold", "Platinum", "Orion", "Interstellar", "Dark Matter", "Borealis", "Bioluminescent"]
    cdl_teams = ["OpTic Texas", "Atlanta FaZe", "Toronto Ultra", "New York Subliners", "LA Thieves", "Miami Heretics", "Seattle Surge"]

    game_telemetry = {
        "primary_mode": primary_franchise,
        "hours_played": random.randint(50, 3200),
        "primary_creator_influence": primary_creator,
        "followed_creators": followed_creators,
        "main_loadout": random.choice(main_loadouts),
        "kd_ratio": round(random.uniform(0.75, 3.65), 2),
        "gulag_win_rate": f"{random.randint(40, 86)}%",
        "ranked_skill_division": random.choice(["Bronze III", "Silver II", "Gold I", "Platinum II", "Diamond III", "Crimson II", "Iridescent", "Top 250"]),
        "mastery_camo": random.choice(mastery_camos),
        "cdl_favorite_team": random.choice(cdl_teams),
        "zombies_highest_round": random.randint(15, 88),
        "favorite_drop": random.choice(["Superstore", "Rebirth Prison", "Old Town Urzikstan", "Fortune's Keep Winery", "Area 99 Reactor", "Highrise Crane", "Terminal Books"]),
        "ricochet_status": "Clean (Verified Trust Factor)" if random.random() < 0.985 else "Under Shadowban Review",
        "omnimovement_slide_cancel_count": random.randint(200, 12000)
    }

    # Purchase History
    purchased_items = []
    if lifetime_spend >= 25:
        num_items = min(len(MARKETING_OFFERS), max(1, int(lifetime_spend / 45)))
        sample_items = random.sample(MARKETING_OFFERS, num_items)
        for sitm in sample_items:
            purchased_items.append({
                "offer_id": sitm["offer_id"],
                "title": sitm["offer_title"],
                "price": sitm["price_usd"],
                "date": f"2024-{random.randint(1,12):02d}-{random.randint(1,28):02d}",
                "category": sitm["category"],
                "type": sitm["offer_type"],
            })

    flag_map = {
        "United States": "🇺🇸", "United Kingdom": "🇬🇧", "France": "🇫🇷", "Germany": "🇩🇪",
        "Spain": "🇪🇸", "Brazil": "🇧🇷", "Japan": "🇯🇵", "Saudi Arabia": "🇸🇦"
    }
    code_map = {
        "United States": "US", "United Kingdom": "GB", "France": "FR", "Germany": "DE",
        "Spain": "ES", "Brazil": "BR", "Japan": "JP", "Saudi Arabia": "SA"
    }

    age = int(random.gauss(24, 6))
    age = max(14, min(55, age))
    gender_roll = random.random()
    gender = 'male' if gender_roll < 0.78 else 'female' if gender_roll < 0.95 else random.choice(['nonbinary', 'undisclosed'])
    account_tenure_days = random.randint(40, 3200) + int(lifetime_spend * 0.4)
    currency_balance = int(random.expovariate(1 / (2400 if "WHALE" in archetype else 300)))

    player_record = {
        "player_id": pid,
        "display_name": display_name,
        "gamer_tag": gamer_tag,
        "primary_email": email,
        "primary_franchise": primary_franchise,
        "franchises_played": cross_titles,
        "primary_archetype": archetype,
        "age": age,
        "gender": gender,
        "account_tenure_days": account_tenure_days,
        "currency_balance": currency_balance,
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

    # 1. Platform Identity & Edges (Activision ID, PlayStation, Xbox, Steam, Battle.net)
    act_id = f"ident-act-{i:05d}"
    platform_identities.append({
        "identity_id": act_id,
        "platform": "ACTIVISION_ID",
        "platform_handle": gamer_tag,
        "confidence_score": 1.0,
    })
    has_identity_edges.append({
        "player_id": pid,
        "identity_id": act_id,
        "confidence_score": 1.0,
    })

    # Console / PC Linked Identity
    console_type = random.choice(["PLAYSTATION_NETWORK", "XBOX_LIVE", "STEAM", "BATTLE_NET"])
    console_id = f"ident-plat-{i:05d}"
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

    # 2. Played Game Edges
    for g_key in cross_titles:
        g_id = FRANCHISE_TO_GAME_ID.get(g_key, "game-cod")
        played_game_edges.append({
            "player_id": pid,
            "game_id": g_id,
            "hours_played": random.randint(25, 1800),
            "last_played_timestamp": f"2024-09-{random.randint(1,17):02d}T{random.randint(10,23):02d}:00:00Z"
        })

    # 3. Clan Affiliation (OpTic, FaZe, Thieves, Falcons, TaskForce, etc.)
    if random.random() < 0.52:
        rel_clans = [c for c in CLANS if c["franchise"] == primary_franchise]
        if not rel_clans:
            rel_clans = CLANS
        chosen_clan = random.choice(rel_clans)
        member_of_clan_edges.append({
            "player_id": pid,
            "clan_id": chosen_clan["clan_id"],
            "role": "OFFICER" if lifetime_spend >= 1000 else "MEMBER"
        })

    # 4. Telemetry Match Events (Loss Streaks & Tilt)
    if loss_streak >= 2:
        telemetry_match_events.append({
            "event_id": f"evt-{i:06d}",
            "player_id": pid,
            "game_id": FRANCHISE_TO_GAME_ID.get(primary_franchise, "game-cod-warzone"),
            "event_type": "GULAG_DEFEAT_LOSS_STREAK" if primary_franchise in ["WARZONE", "COD"] else "RANKED_DEMOTION_LOSS" if primary_franchise == "CDL_RANKED" else "MATCH_DEFEAT_STREAK",
            "consecutive_losses": loss_streak,
            "tilt_index": tilt_sensitivity,
            "timestamp": "2024-09-17T14:30:00Z",
            "triggered_offer_id": "off-cod-06" if loss_streak >= 3 else "off-cod-11",
        })

print("Writing 100% Call of Duty dataset to data/...")
os.makedirs("data", exist_ok=True)

with open("data/games.json", "w") as f:
    json.dump(GAMES, f, indent=2)
print(f"-> games.json: {len(GAMES)} records")

with open("data/creators.json", "w") as f:
    json.dump(CREATORS, f, indent=2)
print(f"-> creators.json: {len(CREATORS)} records")

with open("data/clans.json", "w") as f:
    json.dump(CLANS, f, indent=2)
print(f"-> clans.json: {len(CLANS)} records")

with open("data/marketing_offers.json", "w") as f:
    json.dump(MARKETING_OFFERS, f, indent=2)
print(f"-> marketing_offers.json: {len(MARKETING_OFFERS)} records")

with open("data/master_players.json", "w") as f:
    json.dump(master_players, f, indent=2)
print(f"-> master_players.json: {len(master_players)} records")

with open("data/platform_identities.json", "w") as f:
    json.dump(platform_identities, f, indent=2)
print(f"-> platform_identities.json: {len(platform_identities)} records")

with open("data/has_identity_edges.json", "w") as f:
    json.dump(has_identity_edges, f, indent=2)
print(f"-> has_identity_edges.json: {len(has_identity_edges)} records")

with open("data/played_game_edges.json", "w") as f:
    json.dump(played_game_edges, f, indent=2)
print(f"-> played_game_edges.json: {len(played_game_edges)} records")

with open("data/member_of_clan_edges.json", "w") as f:
    json.dump(member_of_clan_edges, f, indent=2)
print(f"-> member_of_clan_edges.json: {len(member_of_clan_edges)} records")

with open("data/telemetry_match_events.json", "w") as f:
    json.dump(telemetry_match_events, f, indent=2)
print(f"-> telemetry_match_events.json: {len(telemetry_match_events)} records")

print("✅ Call of Duty Dataset Generation Complete!")
