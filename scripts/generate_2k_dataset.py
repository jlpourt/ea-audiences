#!/usr/bin/env python3
# SYNTHETIC_EBC_SEED_DATA · 2K Courtside synthetic player & telemetry generator
"""
Generate the 2K Courtside dataset · a pure-2K identity graph centered on the
NBA 2K catalog (NBA 2K27, NBA 2K26 holdout/upgrade migration, NBA 2K Mobile)
with cross-pollination across 2K Sports (WWE 2K25, PGA TOUR 2K25, TopSpin 2K25)
and 2K Core (Borderlands 4, Sid Meier's Civilization VII, Mafia: The Old Country).

Writes every file in data/ that scripts/spanner_load_data.js and
scripts/setup-gcp-bigquery.js consume:

    games.json                 12 pure-2K titles
    creators.json              16 authentic NBA 2K / WWE 2K / Borderlands / Civ creators
    clans.json                 48 Crews (Rec / Pro-Am / Comp / 2K26 Veterans / WWE Factions)
    marketing_offers.json      VC ladder, Season Pass, MyTEAM packs, 2K26->2K27 Loyalty Upgrade, ...
    platform_identities.json   2K Account / PSN / Xbox / Steam / Switch 2 / Apple Game Center
    master_players.json        2,850 players with NBA 2K27 & NBA 2K26 migration telemetry
    played_game_edges.json     PLAYS_GAME
    member_of_clan_edges.json  MEMBER_OF_CLAN
    has_identity_edges.json    HAS_IDENTITY
    telemetry_match_events.json NBA 2K27 live-service events
"""
import json
import os
import random
from datetime import datetime, timedelta, timezone

random.seed(2027)

NOW = datetime(2026, 10, 2, 12, 0, 0, tzinfo=timezone.utc)
NBA2K27_LAUNCH = datetime(2026, 9, 4, tzinfo=timezone.utc)
N_PLAYERS = 2850
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")

# ---------------------------------------------------------------------------
# Reference catalog (100% 2K titles)
# ---------------------------------------------------------------------------

GAMES = [
    # id, title, franchise, label, genre, active, hub, parent, release, lifecycle, monetization, season
    ("game-nba2k27", "NBA 2K27", "NBA2K", "2K", "Basketball Sim", 9_800_000, True, None, "2026-09-04", "LIVE", "PREMIUM_PLUS_VC", "Season 1"),
    ("game-nba2k27-mycareer", "NBA 2K27 · MyCAREER / The City", "NBA2K", "2K", "Park / Rec / Pro-Am", 6_400_000, False, "game-nba2k27", "2026-09-04", "LIVE", "VC_BUILDS_SEASON_PASS", "Season 1"),
    ("game-nba2k27-myteam", "NBA 2K27 · MyTEAM", "NBA2K", "2K", "Card Collecting", 3_900_000, False, "game-nba2k27", "2026-09-04", "LIVE", "PACKS_VC", "Season 1"),
    ("game-nba2k27-mynba", "NBA 2K27 · MyNBA & The W", "NBA2K", "2K", "Franchise Sim / WNBA", 2_100_000, False, "game-nba2k27", "2026-09-04", "LIVE", "PREMIUM", "Season 1"),
    ("game-nba2k26", "NBA 2K26", "NBA2K26", "2K", "Basketball Sim (Prior Gen/Holdouts)", 3_400_000, True, None, "2025-09-05", "LEGACY", "PREMIUM_PLUS_VC", "Season 9 Finale"),
    ("game-nba2k-mobile", "NBA 2K Mobile", "NBA2KMOBILE", "2K", "Mobile Basketball", 4_200_000, True, None, "2018-10-01", "LIVE", "FREE_TO_PLAY_IAP", "Season 8"),
    ("game-wwe2k25", "WWE 2K25", "WWE2K", "2K_SPORTS", "Wrestling Sim", 2_600_000, True, None, "2025-03-14", "LIVE", "PREMIUM_PLUS_MYFACTION", "Season Pass Year 1"),
    ("game-pga2k25", "PGA TOUR 2K25", "PGA2K", "2K_SPORTS", "Golf Sim", 1_100_000, True, None, "2025-02-28", "LIVE", "PREMIUM_PLUS_CLUBHOUSE_PASS", "Clubhouse Pass Season 7"),
    ("game-topspin2k25", "TopSpin 2K25", "TOPSPIN", "2K_SPORTS", "Tennis Sim", 640_000, True, None, "2024-04-26", "LIVE", "PREMIUM_PLUS_CENTRE_COURT_PASS", "Centre Court Pass Season 10"),
    ("game-bl4", "Borderlands 4", "BL4", "2K_CORE", "Looter Shooter", 3_300_000, True, None, "2025-09-12", "LIVE", "PREMIUM_PLUS_BOUNTY_PACKS", "Bounty Pack 2"),
    ("game-civ7", "Sid Meier's Civilization VII", "CIV7", "2K_CORE", "4X Strategy", 1_900_000, True, None, "2025-02-11", "LIVE", "PREMIUM_PLUS_DLC", "Crossroads of the World"),
    ("game-mafia-toc", "Mafia: The Old Country", "MAFIA", "2K_CORE", "Narrative Action", 1_400_000, True, None, "2025-08-08", "LIVE", "PREMIUM", None),
]
GAME_KEYS = ["game_id", "title", "franchise", "label", "genre", "active_players", "is_parent_hub",
             "parent_game_id", "release_date", "lifecycle_status", "monetization_model", "current_season"]
GAME_LABEL = {g[0]: g[3] for g in GAMES}
FRANCHISE_LABEL = {g[2]: g[3] for g in GAMES}

ARCHETYPES = [
    "MYTEAM_PACK_WHALE", "PARK_REP_GRINDER", "REC_CREW_CAPTAIN", "MYCAREER_STORY_CASUAL",
    "MYNBA_FRANCHISE_SIM", "BUILD_LAB_THEORYCRAFTER", "THE_W_LOYALIST", "CROSS_LABEL_NOMAD",
    "MOBILE_DAILY_RITUALIST", "RAGE_QUIT_TILT_RISK",
]

# Primary-franchise mix across 2K titles
FRANCHISE_MIX = [
    ("NBA2K", 0.56), ("NBA2K26", 0.14), ("NBA2KMOBILE", 0.08),
    ("WWE2K", 0.08), ("PGA2K", 0.03), ("TOPSPIN", 0.02),
    ("BL4", 0.04), ("CIV7", 0.03), ("MAFIA", 0.02),
]

ARCHETYPE_MIX = {
    "NBA2K": [("MYTEAM_PACK_WHALE", 11), ("PARK_REP_GRINDER", 18), ("REC_CREW_CAPTAIN", 10),
              ("MYCAREER_STORY_CASUAL", 21), ("MYNBA_FRANCHISE_SIM", 9), ("BUILD_LAB_THEORYCRAFTER", 10),
              ("THE_W_LOYALIST", 5), ("CROSS_LABEL_NOMAD", 6), ("MOBILE_DAILY_RITUALIST", 2),
              ("RAGE_QUIT_TILT_RISK", 8)],
    "NBA2K26": [("CROSS_LABEL_NOMAD", 50), ("PARK_REP_GRINDER", 18), ("MYCAREER_STORY_CASUAL", 17),
                ("MYTEAM_PACK_WHALE", 10), ("RAGE_QUIT_TILT_RISK", 5)],
    "NBA2KMOBILE": [("MOBILE_DAILY_RITUALIST", 75), ("MYTEAM_PACK_WHALE", 15), ("CROSS_LABEL_NOMAD", 10)],
    "WWE2K": [("MYTEAM_PACK_WHALE", 20), ("MYCAREER_STORY_CASUAL", 35), ("CROSS_LABEL_NOMAD", 25),
              ("RAGE_QUIT_TILT_RISK", 10), ("MYNBA_FRANCHISE_SIM", 10)],
    "PGA2K": [("MYNBA_FRANCHISE_SIM", 35), ("MYCAREER_STORY_CASUAL", 35), ("CROSS_LABEL_NOMAD", 20), ("BUILD_LAB_THEORYCRAFTER", 10)],
    "TOPSPIN": [("MYNBA_FRANCHISE_SIM", 25), ("MYCAREER_STORY_CASUAL", 40), ("CROSS_LABEL_NOMAD", 15), ("BUILD_LAB_THEORYCRAFTER", 20)],
    "CIV7": [("MYNBA_FRANCHISE_SIM", 55), ("MYCAREER_STORY_CASUAL", 20), ("CROSS_LABEL_NOMAD", 25)],
    "BL4": [("BUILD_LAB_THEORYCRAFTER", 35), ("CROSS_LABEL_NOMAD", 35), ("MYCAREER_STORY_CASUAL", 30)],
    "MAFIA": [("MYCAREER_STORY_CASUAL", 60), ("CROSS_LABEL_NOMAD", 30), ("BUILD_LAB_THEORYCRAFTER", 10)],
}

NBA_MARKETS = [
    ("Atlanta Hawks", "Atlanta DMA", 33.7573, -84.3963, "United States", "US", "🇺🇸"),
    ("Boston Celtics", "Boston DMA", 42.3662, -71.0621, "United States", "US", "🇺🇸"),
    ("Brooklyn Nets", "Brooklyn DMA", 40.6826, -73.9754, "United States", "US", "🇺🇸"),
    ("Charlotte Hornets", "Charlotte DMA", 35.2251, -80.8392, "United States", "US", "🇺🇸"),
    ("Chicago Bulls", "Chicago DMA", 41.8807, -87.6742, "United States", "US", "🇺🇸"),
    ("Cleveland Cavaliers", "Cleveland DMA", 41.4965, -81.6882, "United States", "US", "🇺🇸"),
    ("Dallas Mavericks", "Dallas / Fort Worth DMA", 32.7905, -96.8103, "United States", "US", "🇺🇸"),
    ("Denver Nuggets", "Denver DMA", 39.7487, -105.0077, "United States", "US", "🇺🇸"),
    ("Detroit Pistons", "Detroit DMA", 42.3410, -83.0552, "United States", "US", "🇺🇸"),
    ("Golden State Warriors", "San Francisco Bay Area DMA", 37.7680, -122.3877, "United States", "US", "🇺🇸"),
    ("Houston Rockets", "Houston DMA", 29.7508, -95.3621, "United States", "US", "🇺🇸"),
    ("Indiana Pacers", "Indianapolis DMA", 39.7640, -86.1555, "United States", "US", "🇺🇸"),
    ("Los Angeles Clippers", "Los Angeles – Inglewood DMA", 33.9450, -118.3418, "United States", "US", "🇺🇸"),
    ("Los Angeles Lakers", "Los Angeles DMA", 34.0430, -118.2673, "United States", "US", "🇺🇸"),
    ("Memphis Grizzlies", "Memphis DMA", 35.1382, -90.0506, "United States", "US", "🇺🇸"),
    ("Miami Heat", "Miami / Fort Lauderdale DMA", 25.7814, -80.1870, "United States", "US", "🇺🇸"),
    ("Milwaukee Bucks", "Milwaukee DMA", 43.0451, -87.9172, "United States", "US", "🇺🇸"),
    ("Minnesota Timberwolves", "Minneapolis / St. Paul DMA", 44.9795, -93.2760, "United States", "US", "🇺🇸"),
    ("New Orleans Pelicans", "New Orleans DMA", 29.9490, -90.0821, "United States", "US", "🇺🇸"),
    ("New York Knicks", "New York DMA", 40.7505, -73.9934, "United States", "US", "🇺🇸"),
    ("Oklahoma City Thunder", "Oklahoma City DMA", 35.4634, -97.5151, "United States", "US", "🇺🇸"),
    ("Orlando Magic", "Orlando DMA", 28.5392, -81.3839, "United States", "US", "🇺🇸"),
    ("Philadelphia 76ers", "Philadelphia DMA", 39.9012, -75.1720, "United States", "US", "🇺🇸"),
    ("Phoenix Suns", "Phoenix DMA", 33.4457, -112.0712, "United States", "US", "🇺🇸"),
    ("Portland Trail Blazers", "Portland DMA", 45.5316, -122.6668, "United States", "US", "🇺🇸"),
    ("Sacramento Kings", "Sacramento DMA", 38.5802, -121.4997, "United States", "US", "🇺🇸"),
    ("San Antonio Spurs", "San Antonio DMA", 29.4270, -98.4375, "United States", "US", "🇺🇸"),
    ("Toronto Raptors", "Toronto DMA", 43.6435, -79.3791, "Canada", "CA", "🇨🇦"),
    ("Utah Jazz", "Salt Lake City DMA", 40.7683, -111.9011, "United States", "US", "🇺🇸"),
    ("Washington Wizards", "Washington DC DMA", 38.8981, -77.0209, "United States", "US", "🇺🇸"),
]
INTL_MARKETS = [
    (None, "London DMA", 51.5033, -0.0032, "United Kingdom", "GB", "🇬🇧"),
    (None, "Paris DMA", 48.8384, 2.3784, "France", "FR", "🇫🇷"),
    (None, "Manila DMA", 14.5547, 121.0244, "Philippines", "PH", "🇵🇭"),
    (None, "São Paulo DMA", -23.5505, -46.6333, "Brazil", "BR", "🇧🇷"),
    (None, "Sydney DMA", -33.8688, 151.2093, "Australia", "AU", "🇦🇺"),
    (None, "Mexico City DMA", 19.4326, -99.1332, "Mexico", "MX", "🇲🇽"),
]
NBA_TEAM_NAMES = [m[0] for m in NBA_MARKETS]

NBA_PLAYERS = ["Victor Wembanyama", "Shai Gilgeous-Alexander", "Luka Dončić", "Nikola Jokić",
               "Giannis Antetokounmpo", "Jayson Tatum", "Anthony Edwards", "Stephen Curry",
               "LeBron James", "Derrick Rose", "Cooper Flagg", "Jalen Brunson", "Cade Cunningham",
               "Tyrese Haliburton", "Donovan Mitchell", "Paolo Banchero"]
WNBA_PLAYERS = ["Caitlin Clark", "A'ja Wilson", "Paige Bueckers", "Angel Reese", "Sabrina Ionescu",
                "Breanna Stewart", "Napheesa Collier"]

BUILDS = [
    ("PG", "6'3\" 3-Level Scorer"), ("PG", "6'1\" Green Light Sharp"), ("PG", "6'5\" Playmaking Shot Creator"),
    ("SG", "6'6\" 2-Way Slashing Playmaker"), ("SG", "6'4\" Slasher"), ("SF", "6'9\" Inside-Out Playmaker"),
    ("SF", "6'8\" 2-Way 3-Level Scorer"), ("SF", "6'7\" Lockdown Defender"), ("PF", "6'10\" Paint Beast"),
    ("PF", "6'9\" Stretch Four"), ("C", "7'0\" Glass-Cleaning Lockdown"), ("C", "6'11\" Stretch Big"),
    ("C", "7'1\" Rim Protector"), ("PG", "6'2\" Playmaking Sharp"), ("SF", "6'8\" Point Forward"),
]
REP_TIERS = (["Rookie 1", "Rookie 2", "Rookie 3", "Starter 1", "Starter 2", "Starter 3", "Pro 1", "Pro 2", "Pro 3",
              "All-Star 1", "All-Star 2", "All-Star 3", "Superstar 1", "Superstar 2", "Superstar 3",
              "Veteran 1", "Veteran 2", "Veteran 3", "Legend"])

PLATFORM_IDENTITY = {"PS5": "PlayStation Network", "Xbox Series X|S": "Xbox Live", "PC": "Steam",
                     "Switch 2": "Nintendo Switch 2", "iOS": "Apple Game Center", "Android": "Apple Game Center"}

CREATORS = [
    # id, handle, name, platform, franchise, followers, avg viewers, affinity, signature
    ("creator-dbg", "DBG", "DBG", "YouTube", "NBA2K", 1_850_000, 21_000, 0.91, "Best builds & badge testing"),
    ("creator-tydebo", "Tydebo", "Tydebo", "YouTube", "NBA2K", 1_400_000, 16_500, 0.89, "Build Lab breakdowns"),
    ("creator-joeknows", "JoeKnows", "Joe Knows", "YouTube", "NBA2K", 1_300_000, 14_000, 0.86, "Park & Rec gameplay"),
    ("creator-agent00", "Agent00", "Agent 00", "Twitch & YouTube", "NBA2K", 2_600_000, 38_000, 0.88, "Park comedy & 2v2s"),
    ("creator-flightreacts", "FlightReacts", "FlightReacts", "YouTube", "NBA2K", 6_900_000, 52_000, 0.74, "Rage, reactions & Park chaos"),
    ("creator-callmeagent", "CallMeAgent", "CallMeAgent", "Twitch", "NBA2K", 980_000, 11_500, 0.87, "Comp Pro-Am"),
    ("creator-troydan", "Troydan", "Troydan", "YouTube", "NBA2K", 3_100_000, 24_000, 0.82, "MyTEAM pack openings"),
    ("creator-chrissmoove", "ChrisSmoove", "Chris Smoove", "YouTube", "NBA2K", 5_600_000, 19_000, 0.80, "MyCAREER series"),
    ("creator-dukedennis", "DukeDennis", "Duke Dennis", "Twitch & YouTube", "NBA2K", 4_500_000, 46_000, 0.78, "Park streams"),
    ("creator-grindingdf", "GrindingDF", "Grinding DF", "YouTube", "NBA2K", 760_000, 8_200, 0.84, "Rep grind & dribble tutorials"),
    ("creator-shake4ndbake", "Shake4ndbake", "Shake4ndbake", "YouTube", "NBA2K", 1_900_000, 9_800, 0.76, "MyNBA & Eras rebuilds"),
    ("creator-powerdf", "PowerDF", "Power DF", "YouTube", "NBA2K", 690_000, 7_400, 0.83, "Rec & Pro-Am strategy"),
    ("creator-cashnasty", "CashNasty", "CashNasty", "YouTube & Twitch", "NBA2K", 4_200_000, 31_000, 0.85, "Park wagers & MyTEAM hype"),
    ("creator-kot4q", "KOT4Q", "Kenny Beecham", "YouTube", "NBA2K", 2_400_000, 18_500, 0.86, "MyNBA rebuilds & 2K26->2K27 deep dives"),
    ("creator-assemble", "Assemble", "Assemble", "YouTube", "WWE2K", 620_000, 6_900, 0.81, "WWE 2K25 MyFACTION & news"),
    ("creator-moxsy", "Moxsy", "Moxsy", "YouTube & Twitch", "BL4", 940_000, 11_200, 0.84, "Borderlands 4 endgame builds"),
    ("creator-potatomcwhiskey", "PotatoMcWhiskey", "PotatoMcWhiskey", "YouTube & Twitch", "CIV7", 790_000, 9_100, 0.83, "Civilization VII strategy"),
]
CREATOR_KEYS = ["creator_id", "handle", "name", "platform", "franchise", "followers", "avg_stream_viewers",
                "conversion_affinity", "signature_mode"]

NBA_CREWS = {
    "Rec": ["Bucket Getters", "Rim Runners Rec", "Dimers Only", "No Fly Zone", "Paint Beasts", "Glass Cleaners",
            "Green Machine", "Splash Bros Rec", "The Rec Sweats", "Lob City Legends", "Iso Kings", "Cheese Factory",
            "Random Rec Survivors", "Fadeaway Family", "Zig Zag Nation", "Stepback Society"],
    "Pro-Am": ["Lock & Load", "Stage Sharks", "Pro-Am Prophets", "Clamp Gods", "Five Out Faithful", "Pick & Pop Co.",
               "Bully Ball Union", "Court Vision Collective", "Hoop Dreams Pro-Am", "Dunk Meter Mafia",
               "Takeover Tribe", "The W Collective"],
    "Comp": ["Comp Stage Elite", "Legend Rep Syndicate", "Ankle Breakers Comp", "Dark Matter Dynasty",
             "99 OVR Only", "Posterize Pros", "Cap Breaker Crew", "Full Court Press Comp"],
}
NBA2K26_VETERAN_CREWS = [
    ("2K26 Park Oldheads", "Rec"), ("2K26 Sunset Legends", "Pro-Am"), ("2K26 Holdout Hoopers", "Rec"),
    ("Prior Gen Grinding Squad", "Pro-Am"), ("2K26 Stage Holdouts", "Comp"), ("2K26 MyTEAM Vault", "Rec"),
    ("2K26 Rec Captains", "Pro-Am"), ("2K26 Hall of Fame Crew", "Comp"),
]
WWE_FACTIONS = [("The Bloodline Faction", "Comp"), ("Judgment Day Faction", "Pro-Am"),
                ("Attitude Era Revivalists", "Rec"), ("Wyatt Sicks Society", "Rec")]

OFFERS = [
    # id, title, franchise, game, type, category, price, boost, archetype, lifecycle, from, description
    ("off-vc-5k", "5,000 VC", "NBA2K", "game-nba2k27", "VC_PACK", "Virtual Currency", 1.99, 8.5, "MYCAREER_STORY_CASUAL", "CURRENT", "2026-09-04", "5,000 Virtual Currency for builds, animations and MyTEAM packs."),
    ("off-vc-15k", "15,000 VC", "NBA2K", "game-nba2k27", "VC_PACK", "Virtual Currency", 4.99, 12.1, "MYCAREER_STORY_CASUAL", "CURRENT", "2026-09-04", "15,000 Virtual Currency."),
    ("off-vc-35k", "35,000 VC", "NBA2K", "game-nba2k27", "VC_PACK", "Virtual Currency", 9.99, 15.4, "PARK_REP_GRINDER", "CURRENT", "2026-09-04", "35,000 Virtual Currency."),
    ("off-vc-75k", "75,000 VC", "NBA2K", "game-nba2k27", "VC_PACK", "Virtual Currency", 19.99, 18.9, "PARK_REP_GRINDER", "CURRENT", "2026-09-04", "75,000 Virtual Currency - enough to take a new build to 85 OVR."),
    ("off-vc-200k", "200,000 VC", "NBA2K", "game-nba2k27", "VC_PACK", "Virtual Currency", 49.99, 22.3, "MYTEAM_PACK_WHALE", "CURRENT", "2026-09-04", "200,000 Virtual Currency."),
    ("off-vc-450k", "450,000 VC", "NBA2K", "game-nba2k27", "VC_PACK", "Virtual Currency", 99.99, 24.8, "MYTEAM_PACK_WHALE", "CURRENT", "2026-09-04", "450,000 Virtual Currency."),
    ("off-season-pass-pro", "Season 1 Pass · Pro", "NBA2K", "game-nba2k27", "SEASON_PASS", "Season Pass", 9.99, 26.2, "PARK_REP_GRINDER", "CURRENT", "2026-09-04", "40 levels of Season 1 rewards plus instant level skips."),
    ("off-season-pass-hof", "Season 1 Pass · Hall of Fame", "NBA2K", "game-nba2k27", "SEASON_PASS", "Season Pass", 19.99, 31.7, "MYTEAM_PACK_WHALE", "CURRENT", "2026-09-04", "Hall of Fame tier: 15% XP boost, 10 instant levels and exclusive MyTEAM & MyCAREER rewards."),
    ("off-myteam-galaxy-opal-deluxe-1499", "Galaxy Opal Deluxe Pack · $14.99", "NBA2K", "game-nba2k27-myteam", "MYTEAM_PACK", "MyTEAM Pack", 14.99, 34.0, "MYTEAM_PACK_WHALE", "UPCOMING", "2026-10-17", "Guaranteed Galaxy Opal plus 4 Diamond-or-better cards. Season 2 launch pricing variant A."),
    ("off-myteam-galaxy-opal-deluxe-1999", "Galaxy Opal Deluxe Pack · $19.99", "NBA2K", "game-nba2k27-myteam", "MYTEAM_PACK", "MyTEAM Pack", 19.99, 27.5, "MYTEAM_PACK_WHALE", "UPCOMING", "2026-10-17", "Guaranteed Galaxy Opal plus 4 Diamond-or-better cards and a Dark Matter contract. Season 2 launch pricing variant B."),
    ("off-crew-reup-bundle", "Crew Re-Up Bundle", "NBA2K", "game-nba2k27-mycareer", "RETENTION_BUNDLE", "Retention Offer", 4.99, 41.2, "MYCAREER_STORY_CASUAL", "UPCOMING", "2026-10-10", "35,000 VC plus a 2x Crew XP token and teammate squad invite for Season 2 tip-off."),
    ("off-nba2k27-deluxe-to-ultra", "NBA 2K27 Deluxe → Ultra Edition Upgrade", "NBA2K", "game-nba2k27", "EDITION_UPGRADE", "Premium Game", 49.99, 19.6, "MYTEAM_PACK_WHALE", "CURRENT", "2026-09-04", "Upgrade to the Ultra Edition: 100,000 VC, Season Pass Hall of Fame tier for Seasons 1–3 and MyTEAM boosts."),
    ("off-nba2k27-loyalty-upgrade", "NBA 2K26 → 2K27 Hall of Fame Loyalty Upgrade + 100K VC", "NBA2K", "game-nba2k27", "LOYALTY_UPGRADE", "2K26 → 2K27 Bridge", 69.99, 44.5, "CROSS_LABEL_NOMAD", "CURRENT", "2026-09-04", "Exclusive loyalty bridge for NBA 2K26 veterans: full NBA 2K27 game, 100,000 VC build jumpstart, and Crew carryover badge."),
    ("off-nba2k26-vc-carryover", "NBA 2K26 Veteran Welcome Pack · 75K VC + Cap Breaker", "NBA2K26", "game-nba2k26", "LOYALTY_UPGRADE", "2K26 → 2K27 Bridge", 19.99, 36.8, "CROSS_LABEL_NOMAD", "CURRENT", "2026-09-04", "Instant 85 OVR Rebirth boost + 75,000 VC when migrating your NBA 2K26 MyPLAYER account into NBA 2K27."),
    ("off-2k-allstar-pass", "2K Sports All-Star Cross-Franchise Bundle (NBA 2K27 + WWE 2K25 + PGA 2K25)", "NBA2K", "game-nba2k27", "CROSS_FRANCHISE", "Cross-Franchise Bundle", 29.99, 28.4, "CROSS_LABEL_NOMAD", "CURRENT", "2026-09-15", "Unified Season Pass rewards across NBA 2K27 The City, WWE 2K25 MyFACTION, and PGA TOUR 2K25 Clubhouse Pass."),
    ("off-nba2k-mobile-vc", "NBA 2K Mobile · 1,500 Coins & MyTEAM Sync Pack", "NBA2KMOBILE", "game-nba2k-mobile", "COIN_PACK", "Mobile Currency", 4.99, 14.3, "MOBILE_DAILY_RITUALIST", "CURRENT", "2026-01-15", "1,500 coins for NBA 2K Mobile card packs with 2K Account XP sync."),
    ("off-nba2k-mobile-opal-pass", "NBA 2K Mobile · Courtside Pass Premium", "NBA2KMOBILE", "game-nba2k-mobile", "SEASON_PASS", "Mobile Season Pass", 9.99, 18.6, "MOBILE_DAILY_RITUALIST", "CURRENT", "2026-09-01", "Earn exclusive Courtside Pass Galaxy Opal mobile rewards and console VC bonus."),
    ("off-wwe2k25-season-pass", "WWE 2K25 Ringside Season Pass", "WWE2K", "game-wwe2k25", "SEASON_PASS", "Season Pass", 39.99, 21.0, "MYCAREER_STORY_CASUAL", "CURRENT", "2025-03-14", "Five post-launch Superstar packs plus MyFACTION bonuses."),
    ("off-wwe2k25-myfaction-pack", "WWE 2K25 MyFACTION Gold Pack Bundle", "WWE2K", "game-wwe2k25", "CARD_PACK", "MyFACTION Pack", 9.99, 17.3, "MYTEAM_PACK_WHALE", "CURRENT", "2025-03-14", "Ten MyFACTION packs with a guaranteed Sapphire-or-better Superstar."),
    ("off-pga2k25-clubhouse-pass", "PGA TOUR 2K25 Clubhouse Pass", "PGA2K", "game-pga2k25", "SEASON_PASS", "Season Pass", 9.99, 14.7, "MYNBA_FRANCHISE_SIM", "CURRENT", "2025-02-28", "Premium Clubhouse Pass tier for the current season."),
    ("off-topspin2k25-centre-court-pass", "TopSpin 2K25 Centre Court Pass", "TOPSPIN", "game-topspin2k25", "SEASON_PASS", "Season Pass", 9.99, 13.1, "BUILD_LAB_THEORYCRAFTER", "CURRENT", "2024-04-26", "Premium Centre Court Pass tier for the current season."),
    ("off-civ7-crossroads", "Civilization VII · Crossroads of the World Collection", "CIV7", "game-civ7", "DLC", "Expansion", 29.99, 18.2, "MYNBA_FRANCHISE_SIM", "CURRENT", "2025-03-04", "New civilizations, leaders and wonders for Civilization VII."),
    ("off-bl4-bounty-pack-1", "Borderlands 4 · Vault Hunter Bounty Pack", "BL4", "game-bl4", "DLC", "Expansion", 14.99, 19.0, "BUILD_LAB_THEORYCRAFTER", "CURRENT", "2025-11-20", "New region, missions, bosses and legendary gear."),
    ("off-mafia-toc-deluxe-upgrade", "Mafia: The Old Country · Deluxe Upgrade", "MAFIA", "game-mafia-toc", "EDITION_UPGRADE", "Premium Game", 9.99, 7.9, "MYCAREER_STORY_CASUAL", "CURRENT", "2025-08-08", "Deluxe Edition content: Padrino and Gatto Nero packs plus the digital soundtrack."),
]
OFFER_KEYS = ["offer_id", "offer_title", "target_franchise", "game_id", "offer_type", "category", "price_usd",
              "expected_conversion_boost", "affinity_archetype", "lifecycle_status", "available_from", "description"]
OFFER_BY_ID = {o[0]: dict(zip(OFFER_KEYS, o)) for o in OFFERS}

CURATED_2K_TAGS = [
    "IsoJoeOnTheSticks", "GreenLightGod", "ParkLegend99", "OpalChaser", "SixNineInsideOut", "TheWBucketz",
    "RecCaptainKJ", "CheeseMerchant2K", "DimeDropDre", "ClampGodChris", "LobCityLou", "GlassCleanerGio",
    "StepbackSteezo", "NoMeterNate", "BadgeHunterB", "CapBreakerCam", "WembyWall", "PaintBeastPat",
    "ZigZagZay", "StageSharkSean", "FadeawayFaith", "TripleThreatTre", "DarkMatterDee", "PinkDiamondPam",
    "RepGrindRico", "ProAmPrince", "RandomRecRonnie", "GalaxyOpalGabe", "HOFPassHolder", "VCBrokeAgain",
    "DunkMeterDan", "SplashSzn", "TakeoverTay", "FullCourtFrankie", "PostScorerPaz", "ClarkDeluxeCrew",
    "FiveOutFelix", "QuickDrawQuinn", "AnkleTakerAri", "PosterizePete", "SilverBadgeSam", "LegendRepLeo",
    "MyNBADynastyDave", "ErasModeEli", "RebuildRaj", "TradeMachineTom", "BuildLabBen", "TestedThisBuild",
    "BadgeMathBrian", "NoZenHere", "RageQuitRay", "MeterOffMike", "StreakSnapper", "CourtsideCarla",
    "DribbleGodDex", "HoopsHaley", "ShotCreatorSasha", "RimRunnerRudy", "SwishSwishSal", "PickAndPopPaul",
]
CURATED_2K_SPORTS_TAGS = [
    "RomanReignsTribal", "MyFactionWhale", "CodyRhodesFinisher", "BloodlineBoss2K", "RingGeneralGunther",
    "SawgrassScratch", "PebbleBeachPro2K", "ClubhouseEagle", "CentreCourtAce", "TopSpinServeGod",
    "2K26ParkHoldout", "StillOn2K26", "RebirthReady99", "2K26LegendVet", "SunsetParkGoat",
]
CURATED_2K_CORE_TAGS = [
    "VaultHunterZane", "SirenBuildLab", "MaliwanMeltdown", "HexTurn250", "DeityYieldKing",
    "OneMoreTurnCiv7", "SicilyDonMafia", "PandoraLootLord", "BorderlandsCrit", "WonderBuilderCiv",
]
TAG_PREFIX = ["Iso", "Green", "Park", "Opal", "Rec", "Bucket", "Dime", "Lob", "Splash", "Paint", "Glass", "Lock",
              "Cheese", "Zig", "Steeze", "Dunk", "Ankle", "Clamp", "Ring", "Hoop", "Rim", "Dribble", "Fade", "Stepback",
              "Snatch", "Cap", "Rep", "VC", "Badge", "Sauce", "Flash", "Wemby", "Clutch", "Poster", "Euro", "Pump", "Spin",
              "Crossover", "Alley", "Oop", "Swish", "Bank", "Floater", "Drop", "Hesi", "Mamba", "Flagg", "SGA", "Jokic"]
TAG_MID = ["God", "King", "Szn", "Chaser", "Legend", "Captain", "Merchant", "Boy", "Kid", "Wizard", "Demon", "Lord",
           "Monster", "Machine", "Hunter", "Phantom", "Savage", "Addict", "Sniper", "Queen", "Baron", "Chef", "Doctor"]
TAG_SUFFIX = ["2K", "99", "27", "On2K", "OnTheSticks", "TTV", "YT", "Jr", "HOF", "GoatMode", "Sr", "", "", ""]
EMAIL_DOMAINS = ["gmail.com", "outlook.com", "icloud.com", "yahoo.com", "proton.me", "hotmail.com"]


class TagPool:
    def __init__(self):
        self.used = set()
        self.curated = {
            "2K": list(CURATED_2K_TAGS),
            "2K_SPORTS": list(CURATED_2K_SPORTS_TAGS),
            "2K_CORE": list(CURATED_2K_CORE_TAGS),
        }
        for v in self.curated.values():
            random.shuffle(v)

    def take(self, label):
        pool = self.curated.get(label) or []
        if pool:
            tag = pool.pop()
            self.used.add(tag)
            return tag
        for _ in range(200):
            tag = random.choice(TAG_PREFIX) + random.choice(TAG_MID) + random.choice(TAG_SUFFIX)
            if random.random() < 0.45:
                tag += str(random.randint(1, 99))
            if tag not in self.used:
                self.used.add(tag)
                return tag
        tag = f"Player{len(self.used):05d}"
        self.used.add(tag)
        return tag


def weighted(pairs):
    items, weights = zip(*pairs)
    return random.choices(items, weights=weights, k=1)[0]


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def pareto_spend(scale, alpha=1.05, cap=4000.0):
    return round(min(cap, scale * (random.paretovariate(alpha) - 1.0) + random.uniform(0, scale * 0.4)), 2)


def mask_email(tag):
    return f"{tag[0].lower()}***@{random.choice(EMAIL_DOMAINS)}"


def choose_market(primary):
    if primary == "NBA2KMOBILE" and random.random() < 0.25:
        return random.choice(INTL_MARKETS)
    if random.random() < 0.12:
        return random.choice(INTL_MARKETS)
    return random.choice(NBA_MARKETS)


def choose_platform(primary):
    if primary == "NBA2KMOBILE":
        return weighted([("iOS", 60), ("Android", 40)])
    if primary == "CIV7":
        return weighted([("PC", 80), ("PS5", 8), ("Xbox Series X|S", 8), ("Switch 2", 4)])
    if primary in ("NBA2K", "NBA2K26"):
        return weighted([("PS5", 48), ("Xbox Series X|S", 27), ("PC", 15), ("Switch 2", 10)])
    return weighted([("PS5", 45), ("Xbox Series X|S", 30), ("PC", 20), ("Switch 2", 5)])


def demographics(primary, archetype):
    if primary == "CIV7":
        age = int(clamp(random.gauss(34, 9), 18, 62))
        gender = weighted([("male", 74), ("female", 22), ("non-binary", 2), ("undisclosed", 2)])
    elif archetype == "THE_W_LOYALIST":
        age = int(clamp(random.gauss(26, 7), 16, 50))
        gender = weighted([("female", 56), ("male", 38), ("non-binary", 4), ("undisclosed", 2)])
    else:
        age = int(clamp(random.gauss(25, 7), 16, 52))
        gender = weighted([("male", 76), ("female", 19), ("non-binary", 3), ("undisclosed", 2)])
    return age, gender


def build_players(crews_by_tier, crew_region):
    tags = TagPool()
    players = []
    for i in range(N_PLAYERS):
        primary = weighted(FRANCHISE_MIX)
        archetype = weighted(ARCHETYPE_MIX[primary])
        label = FRANCHISE_LABEL[primary]
        tag = tags.take(label)
        market = choose_market(primary)
        team, dma, lat, lng, country, cc, flag = market
        platform = choose_platform(primary)
        age, gender = demographics(primary, archetype)

        # --- Secondary 2K franchises & NBA 2K26 -> 2K27 migration links ---
        played = {primary}
        nba2k26_veteran = False
        mobile_linked = False

        if primary == "NBA2K":
            nba2k26_veteran = random.random() < 0.34
            if nba2k26_veteran:
                played.add("NBA2K26")
            mobile_linked = random.random() < 0.24
            for f, p in (("WWE2K", 0.16), ("PGA2K", 0.08), ("BL4", 0.12), ("CIV7", 0.06), ("TOPSPIN", 0.04), ("MAFIA", 0.05)):
                if random.random() < p:
                    played.add(f)
        elif primary == "NBA2K26":
            nba2k26_veteran = True
            mobile_linked = random.random() < 0.25
            # Holdouts vs already migrated
            if random.random() < 0.22:
                played.add("NBA2K")
            for f, p in (("WWE2K", 0.22), ("PGA2K", 0.12), ("BL4", 0.14), ("CIV7", 0.06)):
                if random.random() < p:
                    played.add(f)
        elif primary == "NBA2KMOBILE":
            mobile_linked = True
            nba2k26_veteran = random.random() < 0.20
            if nba2k26_veteran:
                played.add("NBA2K26")
            if random.random() < 0.42:
                played.add("NBA2K")
        else:
            # 2K Sports (WWE2K, PGA2K, TOPSPIN) or 2K Core (BL4, CIV7, MAFIA)
            nba2k26_veteran = random.random() < 0.24
            if nba2k26_veteran:
                played.add("NBA2K26")
            if random.random() < 0.36:
                played.add("NBA2K")
            if random.random() < 0.20:
                played.add(random.choice(["WWE2K", "PGA2K", "BL4", "CIV7"]))

        if archetype == "CROSS_LABEL_NOMAD":
            nba2k26_veteran = True
            played.add("NBA2K26")
        if archetype == "MOBILE_DAILY_RITUALIST":
            mobile_linked = True
            played.add("NBA2KMOBILE")
        if mobile_linked:
            played.add("NBA2KMOBILE")

        plays_nba27 = "NBA2K" in played
        plays_nba26 = "NBA2K26" in played

        scale = {
            "MYTEAM_PACK_WHALE": 260, "PARK_REP_GRINDER": 70, "REC_CREW_CAPTAIN": 55, "MYCAREER_STORY_CASUAL": 24,
            "MYNBA_FRANCHISE_SIM": 30, "BUILD_LAB_THEORYCRAFTER": 45, "THE_W_LOYALIST": 28,
            "CROSS_LABEL_NOMAD": 95, "MOBILE_DAILY_RITUALIST": 22, "RAGE_QUIT_TILT_RISK": 40,
        }[archetype]
        lifetime = pareto_spend(scale)

        cliff = False
        p2 = False
        if plays_nba27 or plays_nba26:
            pos, build = random.choice(BUILDS)
            if archetype in ("PARK_REP_GRINDER", "REC_CREW_CAPTAIN", "RAGE_QUIT_TILT_RISK"):
                ovr = int(clamp(random.gauss(91, 4), 78, 99))
                rep_i = int(clamp(random.gauss(12, 3), 4, 18))
            elif archetype in ("MYTEAM_PACK_WHALE", "BUILD_LAB_THEORYCRAFTER", "CROSS_LABEL_NOMAD"):
                ovr = int(clamp(random.gauss(86, 6), 70, 99))
                rep_i = int(clamp(random.gauss(8, 3), 1, 16))
            else:
                ovr = int(clamp(random.gauss(81, 6), 65, 95))
                rep_i = int(clamp(random.gauss(5, 3), 0, 12))
            hours = int(clamp(random.gauss(95, 45), 4, 420)) if primary in ("NBA2K", "NBA2K26") else int(clamp(random.gauss(35, 20), 2, 140))
            last_login = weighted([(random.randint(0, 6), 74), (random.randint(7, 13), 12), (random.randint(14, 28), 10), (random.randint(29, 60), 4)])
            vc_spend_90d = round(min(lifetime, lifetime * random.uniform(0.25, 0.78)), 2)

            # Play 1 · Season 2 cliff cohort: stalled NBA 2K27 builds below 85 OVR that spent >= $50 and stopped logging in.
            if primary == "NBA2K" and archetype not in ("MYNBA_FRANCHISE_SIM", "MOBILE_DAILY_RITUALIST") and random.random() < 0.195:
                cliff = True
                ovr = random.randint(72, 84)
                vc_spend_90d = round(random.uniform(50, 260), 2)
                lifetime = max(lifetime, round(vc_spend_90d * random.uniform(1.0, 1.6), 2))
                last_login = random.randint(7, 28)
            elif primary == "NBA2K" and ovr < 85 and last_login >= 7 and vc_spend_90d >= 50 and random.random() < 0.7:
                vc_spend_90d = round(random.uniform(5, 49), 2)

            badges = int(clamp((ovr - 60) * 1.3 + random.gauss(0, 4), 0, 53))
            cap_breakers = int(clamp((ovr - 85) // 2 + random.randint(0, 2), 0, 8)) if ovr >= 85 else 0
            edition = weighted([("NONE", 55), ("PRO", 30), ("HALL_OF_FAME", 15)])
            if archetype in ("MYTEAM_PACK_WHALE", "PARK_REP_GRINDER") and random.random() < 0.55:
                edition = "HALL_OF_FAME"
            if archetype == "MYTEAM_PACK_WHALE" and random.random() < 0.65:
                edition = "HALL_OF_FAME"
                opals = random.randint(10, 42)
            else:
                opals = weighted([(random.randint(0, 3), 78), (random.randint(4, 9), 20), (random.randint(10, 18), 2)])
            packs_30d = int(clamp(random.gauss(14 if archetype == "MYTEAM_PACK_WHALE" else 4, 4), 0, 60))
            if archetype == "MYTEAM_PACK_WHALE":
                packs_30d = max(packs_30d, 6)
            myteam_spend = round(min(vc_spend_90d, vc_spend_90d * random.uniform(0.5, 1.0)), 2) if packs_30d > 0 else 0.0
            myteam_rating = int(clamp(random.gauss(88 if opals >= 10 else 80, 5), 60, 99)) if packs_30d > 0 or opals > 0 else None
            pass_tier = int(clamp(random.gauss(26 if edition == "HALL_OF_FAME" else 14 if edition == "PRO" else 8, 8), 0, 40))
            park_win = round(clamp(random.gauss(0.52 if ovr >= 85 else 0.44, 0.1), 0.1, 0.92), 3)
            rec_games = int(clamp(random.gauss(22 if archetype in ("REC_CREW_CAPTAIN", "PARK_REP_GRINDER") else 8, 8), 0, 90))
            loss_streak = weighted([(0, 40), (1, 20), (2, 14), (3, 10), (4, 7), (5, 4), (random.randint(6, 9), 5)])
            rage = int(clamp(random.gauss(5, 2), 1, 14)) if archetype == "RAGE_QUIT_TILT_RISK" else weighted([(0, 60), (1, 22), (2, 10), (3, 5), (random.randint(4, 7), 3)])
            if archetype == "RAGE_QUIT_TILT_RISK":
                loss_streak = max(loss_streak, random.randint(3, 8))
            fav_team = team if team and random.random() < 0.72 else random.choice(NBA_TEAM_NAMES)
            fav_player = random.choice(WNBA_PLAYERS) if archetype == "THE_W_LOYALIST" else random.choice(NBA_PLAYERS)
            vc_balance = int(clamp(random.gauss(9000 if archetype == "MYTEAM_PACK_WHALE" else 2500, 3000), 0, 120000))
        else:
            pos = build = None
            ovr = None
            rep_i = None
            hours = int(clamp(random.gauss(110 if primary in ("CIV7", "BL4") else 45, 40), 2, 600))
            last_login = weighted([(random.randint(0, 6), 68), (random.randint(7, 13), 14), (random.randint(14, 28), 12), (random.randint(29, 60), 6)])
            vc_spend_90d = 0.0
            badges = cap_breakers = None
            edition = "NONE"
            opals = 0
            packs_30d = 0
            myteam_spend = 0.0
            myteam_rating = None
            pass_tier = 0
            park_win = None
            rec_games = 0
            loss_streak = weighted([(0, 55), (1, 20), (2, 12), (3, 8), (random.randint(4, 7), 5)])
            rage = int(clamp(random.gauss(4, 2), 1, 10)) if archetype == "RAGE_QUIT_TILT_RISK" else weighted([(0, 70), (1, 18), (2, 8), (3, 4)])
            fav_team = random.choice(NBA_TEAM_NAMES)
            fav_player = random.choice(NBA_PLAYERS)
            vc_balance = 0

        # --- NBA 2K26 -> NBA 2K27 Upgrade Bridge fields ---
        nba2k26_spend = 0.0
        nba2k26_ovr = None
        migrated_to_2k27 = False
        if nba2k26_veteran:
            nba2k26_ovr = int(clamp(random.gauss(92, 4), 82, 99))
            nba2k26_spend = round(pareto_spend(65 if primary == "NBA2K26" else 48), 2) if random.random() < 0.72 else 0.0
            migrated_to_2k27 = random.random() < (0.48 if primary == "NBA2K26" else 0.62)

        # Play 2 · NBA 2K26 -> 2K27 Holdout & Cross-2K Upgrade Bridge cohort (~300-360 players):
        # High-value 2K26 veterans (with 2K26 spend > 0 and MyTEAM/VC spend > 0) who have NOT yet earned the 2K27 Hall of Fame loyalty upgrade
        if nba2k26_veteran and nba2k26_spend > 0 and not migrated_to_2k27 and myteam_spend > 0 and packs_30d > 0:
            p2 = True
            played.add("NBA2K26")

        mobile_streak = int(clamp(random.gauss(95 if primary == "NBA2KMOBILE" else 28, 45), 1, 600)) if mobile_linked else 0
        cross_2k_titles = len(played)

        gravity = clamp(0.12 + 0.28 * nba2k26_veteran + 0.14 * mobile_linked + 0.08 * cross_2k_titles
                        + (0.12 if archetype == "CROSS_LABEL_NOMAD" else 0) + random.gauss(0, 0.05), 0.05, 0.99)
        churn = 0.12 + 0.012 * last_login + 0.03 * loss_streak + 0.02 * rage
        churn += {"RAGE_QUIT_TILT_RISK": 0.22, "MYCAREER_STORY_CASUAL": 0.10, "REC_CREW_CAPTAIN": -0.08,
                  "PARK_REP_GRINDER": -0.05, "MYTEAM_PACK_WHALE": -0.04}.get(archetype, 0)
        if cliff:
            churn += 0.18
        churn = round(clamp(churn + random.gauss(0, 0.05), 0.02, 0.98), 2)
        tilt = round(clamp(0.12 + 0.07 * rage + 0.03 * loss_streak + (0.25 if archetype == "RAGE_QUIT_TILT_RISK" else 0) + random.gauss(0, 0.06), 0.03, 0.98), 2)
        tenure = int(clamp(random.gauss(1400 if nba2k26_veteran else 850, 480), 30, 4200))

        # --- Crew ---
        crew_id = None
        if primary == "NBA2K":
            join_p = 1.0 if (cliff or archetype == "REC_CREW_CAPTAIN") else 0.74
            if random.random() < join_p:
                tier = ("Rec" if archetype in ("MYCAREER_STORY_CASUAL", "THE_W_LOYALIST", "MYNBA_FRANCHISE_SIM", "MOBILE_DAILY_RITUALIST")
                        else weighted([("Pro-Am", 55), ("Comp", 30), ("Rec", 15)]) if archetype in ("PARK_REP_GRINDER", "REC_CREW_CAPTAIN")
                        else weighted([("Rec", 50), ("Pro-Am", 35), ("Comp", 15)]))
                local = [c for c in crews_by_tier[tier] if crew_region[c] == dma]
                crew_id = random.choice(local) if local and random.random() < 0.6 else random.choice(crews_by_tier[tier])
        elif primary == "NBA2K26" and random.random() < 0.72:
            crew_id = random.choice(crews_by_tier["NBA2K26"])
        elif primary == "WWE2K" and random.random() < 0.45:
            crew_id = random.choice(crews_by_tier["WWE"])

        # --- Creators ---
        followed = []
        if (plays_nba27 or plays_nba26) and random.random() < 0.84:
            pool = [c[0] for c in CREATORS if c[4] == "NBA2K"]
            if archetype == "BUILD_LAB_THEORYCRAFTER":
                pool = ["creator-dbg", "creator-tydebo", "creator-tydebo", "creator-dbg", "creator-grindingdf"]
            elif archetype == "MYTEAM_PACK_WHALE":
                pool = ["creator-troydan", "creator-troydan", "creator-cashnasty", "creator-agent00"]
            elif archetype == "MYNBA_FRANCHISE_SIM":
                pool = ["creator-kot4q", "creator-shake4ndbake", "creator-chrissmoove"]
            elif archetype == "REC_CREW_CAPTAIN":
                pool = ["creator-callmeagent", "creator-powerdf", "creator-joeknows", "creator-agent00"]
            elif archetype == "CROSS_LABEL_NOMAD":
                pool = ["creator-kot4q", "creator-chrissmoove", "creator-cashnasty", "creator-agent00"]
            elif archetype == "RAGE_QUIT_TILT_RISK":
                pool = ["creator-flightreacts", "creator-flightreacts", "creator-dukedennis", "creator-cashnasty"]
            followed = list(dict.fromkeys(random.sample(pool, k=min(len(set(pool)), random.randint(1, 3)))))
        if "WWE2K" in played and random.random() < 0.45:
            followed.append("creator-assemble")
        if "BL4" in played and random.random() < 0.55:
            followed.append("creator-moxsy")
        if "CIV7" in played and random.random() < 0.55:
            followed.append("creator-potatomcwhiskey")
        followed = list(dict.fromkeys(followed))[:4]

        telemetry = {
            "myplayer_ovr": ovr,
            "myplayer_build": build,
            "position": pos,
            "rep_tier": REP_TIERS[rep_i] if rep_i is not None else None,
            "badges_count": badges,
            "cap_breakers_unlocked": cap_breakers,
            "vc_balance": vc_balance,
            "vc_spend_90d": vc_spend_90d,
            "season_pass_tier": pass_tier,
            "season_pass_edition": edition,
            "myteam_rating": myteam_rating,
            "myteam_galaxy_opal_count": opals,
            "myteam_packs_opened_30d": packs_30d,
            "myteam_vc_spend_90d": myteam_spend,
            "park_win_pct": park_win,
            "rec_games_30d": rec_games,
            "crew_id": crew_id,
            "loss_streak": loss_streak,
            "rage_quits_7d": rage,
            "favorite_team": fav_team,
            "favorite_player": fav_player,
            "hours_played": hours,
            "last_login_days_ago": last_login,
            "platform": platform,
            "nba2k26_veteran": nba2k26_veteran,
            "nba2k26_spend_usd": nba2k26_spend,
            "nba2k26_ovr": nba2k26_ovr,
            "migrated_to_2k27": migrated_to_2k27,
            "cross_2k_titles": cross_2k_titles,
            # Legacy compatibility mirrors so any existing JSON predicate works cleanly
            "rockstar_linked": nba2k26_veteran,
            "gta_online_spend_usd": nba2k26_spend,
            "gta6_preorder": migrated_to_2k27,
            "zynga_linked": mobile_linked,
            "zynga_daily_streak": mobile_streak,
            "gravity_score": round(gravity, 3),
        }

        players.append({
            "player_id": f"t2-usr-{i + 1:05d}",
            "display_name": tag,
            "gamer_tag": tag,
            "primary_email": mask_email(tag),
            "primary_franchise": primary,
            "franchises_played": sorted(played),
            "primary_archetype": archetype,
            "age": age,
            "gender": gender,
            "account_tenure_days": tenure,
            "currency_balance": vc_balance if (plays_nba27 or plays_nba26) else int(clamp(random.gauss(1500, 900), 0, 20000)),
            "lifetime_spend_usd": lifetime,
            "churn_risk_score": churn,
            "tilt_sensitivity": tilt,
            "recent_loss_streak": loss_streak,
            "country": country,
            "country_code": cc,
            "country_flag": flag,
            "dma_market": dma,
            "lat": round(lat + random.gauss(0, 0.04), 4),
            "lng": round(lng + random.gauss(0, 0.04), 4),
            "primary_creator_influence": followed[0] if followed else None,
            "followed_creators": followed,
            "game_telemetry": telemetry,
            "purchased_items": [],
            "_cliff": cliff, "_p2": p2, "_label": label, "_platform": platform,
        })
    return players


def purchase_pool(player):
    played = set(player["franchises_played"])
    arch = player["primary_archetype"]
    t = player["game_telemetry"]
    pool = []
    if "NBA2K" in played:
        pool += ["off-vc-5k", "off-vc-15k", "off-vc-35k", "off-vc-75k"]
        if arch in ("MYTEAM_PACK_WHALE", "PARK_REP_GRINDER", "CROSS_LABEL_NOMAD"):
            pool += ["off-vc-200k", "off-vc-450k", "off-nba2k27-deluxe-to-ultra", "off-2k-allstar-pass"]
        if t["season_pass_edition"] == "PRO":
            pool.append("off-season-pass-pro")
        if t["season_pass_edition"] == "HALL_OF_FAME":
            pool.append("off-season-pass-hof")
    if "NBA2K26" in played and t["nba2k26_spend_usd"] > 0:
        pool += ["off-nba2k26-vc-carryover", "off-2k-allstar-pass"]
    if "NBA2KMOBILE" in played or arch == "MOBILE_DAILY_RITUALIST":
        pool += ["off-nba2k-mobile-vc", "off-nba2k-mobile-opal-pass"]
    if "WWE2K" in played:
        pool += ["off-wwe2k25-season-pass", "off-wwe2k25-myfaction-pack"]
    if "PGA2K" in played:
        pool.append("off-pga2k25-clubhouse-pass")
    if "TOPSPIN" in played:
        pool.append("off-topspin2k25-centre-court-pass")
    if "CIV7" in played:
        pool.append("off-civ7-crossroads")
    if "BL4" in played:
        pool.append("off-bl4-bounty-pack-1")
    if "MAFIA" in played:
        pool.append("off-mafia-toc-deluxe-upgrade")
    return pool


def assign_purchases(players):
    for p in players:
        t = p["game_telemetry"]
        items = []
        spent = 0.0
        budget = p["lifetime_spend_usd"]
        if t["migrated_to_2k27"]:
            items.append("off-nba2k27-loyalty-upgrade")
            spent += 69.99
        if "NBA2K" in p["franchises_played"] and t["season_pass_edition"] == "HALL_OF_FAME":
            items.append("off-season-pass-hof")
            spent += 19.99
        elif "NBA2K" in p["franchises_played"] and t["season_pass_edition"] == "PRO":
            items.append("off-season-pass-pro")
            spent += 9.99
        pool = [o for o in purchase_pool(p) if o not in ("off-season-pass-pro", "off-season-pass-hof")]
        guard = 0
        while pool and spent < budget and len(items) < 14 and guard < 40:
            guard += 1
            o = random.choice(pool)
            price = OFFER_BY_ID[o]["price_usd"]
            if spent + price > budget * 1.15 and items:
                continue
            items.append(o)
            spent += price
        if spent > p["lifetime_spend_usd"]:
            p["lifetime_spend_usd"] = round(spent, 2)
        purchases = []
        for o in items:
            off = OFFER_BY_ID[o]
            if o == "off-nba2k27-loyalty-upgrade":
                when = NOW - timedelta(days=random.randint(3, 28))
            elif off["target_franchise"] == "NBA2K":
                when = NOW - timedelta(days=random.randint(0, 28))
            else:
                when = NOW - timedelta(days=random.randint(1, 300))
            purchases.append({
                "offer_id": o, "title": off["offer_title"], "price": off["price_usd"],
                "date": when.strftime("%Y-%m-%d"), "category": off["category"], "type": off["offer_type"],
            })
        purchases.sort(key=lambda x: x["date"], reverse=True)
        p["purchased_items"] = purchases


def build_crews():
    crews = []
    crews_by_tier = {"Rec": [], "Pro-Am": [], "Comp": [], "NBA2K26": [], "WWE": []}
    crew_region = {}
    markets = [m[1] for m in NBA_MARKETS] + [m[1] for m in INTL_MARKETS]
    n = 0
    for tier, names in NBA_CREWS.items():
        for name in names:
            n += 1
            cid = f"crew-{n:03d}"
            region = random.choice(markets)
            crews.append({"clan_id": cid, "name": name, "franchise": "NBA2K", "region": region, "tier": tier, "member_count": 0})
            crews_by_tier[tier].append(cid)
            crew_region[cid] = region
    for name, tier in NBA2K26_VETERAN_CREWS:
        n += 1
        cid = f"crew-{n:03d}"
        region = random.choice(markets)
        crews.append({"clan_id": cid, "name": name, "franchise": "NBA2K26", "region": region, "tier": tier, "member_count": 0})
        crews_by_tier["NBA2K26"].append(cid)
        crew_region[cid] = region
    for name, tier in WWE_FACTIONS:
        n += 1
        cid = f"crew-{n:03d}"
        region = random.choice(markets)
        crews.append({"clan_id": cid, "name": name, "franchise": "WWE2K", "region": region, "tier": tier, "member_count": 0})
        crews_by_tier["WWE"].append(cid)
        crew_region[cid] = region
    return crews, crews_by_tier, crew_region


def build_crew_edges(players, crews):
    members = {}
    for p in players:
        cid = p["game_telemetry"]["crew_id"]
        if cid:
            members.setdefault(cid, []).append(p)
    edges = []
    for c in crews:
        roster = members.get(c["clan_id"], [])
        c["member_count"] = len(roster)
        if not roster:
            continue
        roster.sort(key=lambda p: (p["primary_archetype"] != "REC_CREW_CAPTAIN", p["game_telemetry"]["last_login_days_ago"]))
        for i, p in enumerate(roster):
            role = "CAPTAIN" if i == 0 else "CO_CAPTAIN" if i <= 2 else "MEMBER"
            edges.append({"player_id": p["player_id"], "clan_id": c["clan_id"], "role": role})
    return edges


def build_identities(players):
    identities, edges = [], []
    n = 0

    def add(p, platform, handle, conf):
        nonlocal n
        n += 1
        iid = f"ident-{n:05d}"
        identities.append({"identity_id": iid, "platform": platform, "platform_handle": handle, "confidence_score": conf})
        edges.append({"player_id": p["player_id"], "identity_id": iid, "confidence_score": round(clamp(conf - random.uniform(0, 0.04), 0.5, 1.0), 2)})

    for p in players:
        tag = p["gamer_tag"]
        t = p["game_telemetry"]
        add(p, "2K Account", tag, 1.0)
        plat = p["_platform"]
        if plat in PLATFORM_IDENTITY:
            suffix = random.choice(["", "_", "x", "TTV", str(random.randint(1, 999))])
            add(p, PLATFORM_IDENTITY[plat], f"{tag}{suffix}"[:40], round(random.uniform(0.86, 0.99), 2))
            if random.random() < 0.22:
                other = random.choice(["PlayStation Network", "Xbox Live", "Steam", "Nintendo Switch 2"])
                if other != PLATFORM_IDENTITY[plat]:
                    add(p, other, f"{tag}{random.randint(1, 99)}", round(random.uniform(0.75, 0.94), 2))
        if t["zynga_linked"]:
            add(p, "Apple Game Center", f"{tag}_Mobile", round(random.uniform(0.82, 0.98), 2))
    return identities, edges


def build_play_edges(players):
    edges = []
    for p in players:
        t = p["game_telemetry"]
        arch = p["primary_archetype"]
        last_played = NOW - timedelta(days=t["last_login_days_ago"], hours=random.randint(0, 20))
        primary = p["primary_franchise"]
        total_hours = t["hours_played"]

        def edge(game_id, hours, when=None):
            edges.append({"player_id": p["player_id"], "game_id": game_id, "hours_played": round(hours, 1),
                          "last_played_timestamp": iso(when or last_played)})

        for f in p["franchises_played"]:
            is_primary = f == primary
            hrs = total_hours if is_primary else max(2.0, total_hours * random.uniform(0.15, 0.55))
            when = last_played if is_primary else last_played - timedelta(days=random.randint(0, 30))
            if f == "NBA2K":
                edge("game-nba2k27", hrs, when)
                if arch not in ("MYNBA_FRANCHISE_SIM",) or random.random() < 0.3:
                    edge("game-nba2k27-mycareer", hrs * random.uniform(0.4, 0.8), when)
                if t["myteam_packs_opened_30d"] > 0 or t["myteam_galaxy_opal_count"] > 0:
                    edge("game-nba2k27-myteam", hrs * random.uniform(0.2, 0.7), when)
                if arch in ("MYNBA_FRANCHISE_SIM", "THE_W_LOYALIST") or random.random() < 0.12:
                    edge("game-nba2k27-mynba", hrs * random.uniform(0.3, 0.9), when)
            elif f == "NBA2K26":
                edge("game-nba2k26", max(45.0, hrs * 1.4), NOW - timedelta(days=random.randint(5, 45)))
            elif f == "NBA2KMOBILE":
                edge("game-nba2k-mobile", max(12.0, hrs * 0.5), when)
            else:
                gid = {"WWE2K": "game-wwe2k25", "PGA2K": "game-pga2k25", "TOPSPIN": "game-topspin2k25",
                       "CIV7": "game-civ7", "BL4": "game-bl4", "MAFIA": "game-mafia-toc"}[f]
                edge(gid, hrs, when)
    seen = set()
    out = []
    for e in edges:
        k = (e["player_id"], e["game_id"])
        if k in seen:
            continue
        seen.add(k)
        out.append(e)
    return out


EVENT_WEIGHTS = {
    "MYTEAM_PACK_WHALE": [("MYTEAM_PACK_OPENED", 40), ("VC_PURCHASE", 20), ("SEASON_PASS_LEVEL_UP", 15), ("DAILY_LOGIN", 15), ("PARK_GAME_COMPLETE", 10)],
    "PARK_REP_GRINDER": [("PARK_GAME_COMPLETE", 45), ("REC_GAME_COMPLETE", 15), ("SEASON_PASS_LEVEL_UP", 15), ("VC_PURCHASE", 10), ("RAGE_QUIT", 5), ("DAILY_LOGIN", 10)],
    "REC_CREW_CAPTAIN": [("REC_GAME_COMPLETE", 40), ("CREW_INVITE_SENT", 25), ("PARK_GAME_COMPLETE", 15), ("DAILY_LOGIN", 15), ("SEASON_PASS_LEVEL_UP", 5)],
    "MYCAREER_STORY_CASUAL": [("DAILY_LOGIN", 35), ("PARK_GAME_COMPLETE", 25), ("VC_PURCHASE", 15), ("REC_GAME_COMPLETE", 10), ("RAGE_QUIT", 10), ("SEASON_PASS_LEVEL_UP", 5)],
    "MYNBA_FRANCHISE_SIM": [("DAILY_LOGIN", 70), ("SEASON_PASS_LEVEL_UP", 20), ("VC_PURCHASE", 10)],
    "BUILD_LAB_THEORYCRAFTER": [("PARK_GAME_COMPLETE", 35), ("VC_PURCHASE", 25), ("DAILY_LOGIN", 20), ("REC_GAME_COMPLETE", 15), ("SEASON_PASS_LEVEL_UP", 5)],
    "THE_W_LOYALIST": [("DAILY_LOGIN", 50), ("SEASON_PASS_LEVEL_UP", 25), ("REC_GAME_COMPLETE", 15), ("VC_PURCHASE", 10)],
    "CROSS_LABEL_NOMAD": [("DAILY_LOGIN", 35), ("MYTEAM_PACK_OPENED", 25), ("VC_PURCHASE", 20), ("PARK_GAME_COMPLETE", 20)],
    "MOBILE_DAILY_RITUALIST": [("DAILY_LOGIN", 80), ("VC_PURCHASE", 20)],
    "RAGE_QUIT_TILT_RISK": [("RAGE_QUIT", 40), ("PARK_GAME_COMPLETE", 30), ("REC_GAME_COMPLETE", 15), ("DAILY_LOGIN", 10), ("VC_PURCHASE", 5)],
}
EVENT_GAME = {
    "PARK_GAME_COMPLETE": "game-nba2k27-mycareer", "REC_GAME_COMPLETE": "game-nba2k27-mycareer",
    "MYTEAM_PACK_OPENED": "game-nba2k27-myteam", "SEASON_PASS_LEVEL_UP": "game-nba2k27",
    "RAGE_QUIT": "game-nba2k27-mycareer", "VC_PURCHASE": "game-nba2k27", "CREW_INVITE_SENT": "game-nba2k27-mycareer",
    "DAILY_LOGIN": "game-nba2k27",
}


def build_telemetry(players):
    events = []
    n = 0
    for p in players:
        t = p["game_telemetry"]
        plays_nba = "NBA2K" in p["franchises_played"]
        if not plays_nba:
            if random.random() < 0.45:
                n += 1
                gid = {"NBA2K26": "game-nba2k26", "NBA2KMOBILE": "game-nba2k-mobile", "WWE2K": "game-wwe2k25",
                       "PGA2K": "game-pga2k25", "TOPSPIN": "game-topspin2k25", "CIV7": "game-civ7", "BL4": "game-bl4",
                       "MAFIA": "game-mafia-toc"}[p["primary_franchise"]]
                when = NOW - timedelta(days=t["last_login_days_ago"], minutes=random.randint(0, 1400))
                events.append({"event_id": f"evt-{n:06d}", "player_id": p["player_id"], "game_id": gid, "event_type": "DAILY_LOGIN",
                               "consecutive_losses": 0, "tilt_index": round(p["tilt_sensitivity"] * 0.5, 2),
                               "timestamp": iso(when), "triggered_offer_id": "off-nba2k27-loyalty-upgrade" if p["primary_franchise"] == "NBA2K26" else None})
            continue
        k = random.randint(1, 6) if p["primary_franchise"] == "NBA2K" else random.randint(0, 2)
        weights = EVENT_WEIGHTS[p["primary_archetype"]]
        first = max(NBA2K27_LAUNCH, NOW - timedelta(days=max(t["last_login_days_ago"], 1) + 14))
        last = NOW - timedelta(days=t["last_login_days_ago"])
        span = max(1, int((last - first).total_seconds() // 60))
        for _ in range(k):
            n += 1
            et = weighted(weights)
            when = first + timedelta(minutes=random.randint(0, span))
            losses = 0
            tilt = round(clamp(p["tilt_sensitivity"] * random.uniform(0.4, 0.9), 0.02, 0.98), 2)
            offer = None
            if et == "RAGE_QUIT":
                losses = max(2, t["loss_streak"] + random.randint(0, 2))
                tilt = round(clamp(p["tilt_sensitivity"] + random.uniform(0.05, 0.25), 0.3, 0.99), 2)
                if p["_cliff"] or random.random() < 0.35:
                    offer = "off-crew-reup-bundle"
            elif et == "VC_PURCHASE":
                offer = random.choice(["off-vc-5k", "off-vc-15k", "off-vc-35k", "off-vc-75k", "off-vc-200k"])
            elif et == "MYTEAM_PACK_OPENED" and random.random() < 0.4:
                offer = random.choice(["off-myteam-galaxy-opal-deluxe-1499", "off-myteam-galaxy-opal-deluxe-1999"])
            elif et == "SEASON_PASS_LEVEL_UP" and t["season_pass_edition"] == "NONE" and random.random() < 0.5:
                offer = "off-season-pass-pro"
            elif et in ("PARK_GAME_COMPLETE", "REC_GAME_COMPLETE"):
                losses = random.randint(0, max(0, t["loss_streak"]))
            events.append({"event_id": f"evt-{n:06d}", "player_id": p["player_id"], "game_id": EVENT_GAME[et], "event_type": et,
                           "consecutive_losses": losses, "tilt_index": tilt, "timestamp": iso(when), "triggered_offer_id": offer})
    events.sort(key=lambda e: e["timestamp"])
    return events


def write(name, rows):
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
    print(f"  {name:<30} {len(rows):>7,} rows")


def main():
    os.makedirs(OUT, exist_ok=True)
    games = [dict(zip(GAME_KEYS, g)) for g in GAMES]
    creators = [dict(zip(CREATOR_KEYS, c)) | {"avatar": c[1][:2].upper()} for c in CREATORS]
    offers = [dict(zip(OFFER_KEYS, o)) for o in OFFERS]
    crews, crews_by_tier, crew_region = build_crews()

    players = build_players(crews_by_tier, crew_region)
    assign_purchases(players)
    crew_edges = build_crew_edges(players, crews)
    identities, identity_edges = build_identities(players)
    play_edges = build_play_edges(players)
    events = build_telemetry(players)

    nba = [p for p in players if p["primary_franchise"] == "NBA2K"]
    cliff = sum(1 for p in nba if p["_cliff"])
    p2 = sum(1 for p in players if p["_p2"])
    p3 = sum(1 for p in players if p["game_telemetry"]["myteam_galaxy_opal_count"] >= 10
             and p["game_telemetry"]["season_pass_edition"] == "HALL_OF_FAME")
    for p in players:
        for k in ("_cliff", "_p2", "_label", "_platform"):
            p.pop(k, None)

    print(f"Writing pure-2K Courtside dataset to {OUT}")
    write("games.json", games)
    write("creators.json", creators)
    write("clans.json", crews)
    write("marketing_offers.json", offers)
    write("platform_identities.json", identities)
    write("master_players.json", players)
    write("played_game_edges.json", play_edges)
    write("member_of_clan_edges.json", crew_edges)
    write("has_identity_edges.json", identity_edges)
    write("telemetry_match_events.json", events)
    print(f"\nPlayers: {len(players):,}  (NBA 2K27 primary: {len(nba):,})")
    print(f"Seeded Play 1 Season 2 Cliff cohort: {cliff} ({cliff / len(nba):.1%} of NBA 2K27 primaries)")
    print(f"Seeded Play 2 NBA 2K26 -> 2K27 Holdout Upgrade Bridge cohort: {p2}")
    print(f"Seeded Play 3 MyTEAM Pack Whale cohort: {p3}")


if __name__ == "__main__":
    main()
