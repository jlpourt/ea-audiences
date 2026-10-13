import { ArchetypeId, archetypeLabel, archetypeDescription } from "@/lib/archetypes";

/**
 * 2K Courtside — Persona Prompts & Synthetic Fallback Cohort.
 *
 * Implements the 2K Courtside Focus Group grounded in
 * authentic NBA 2K27, NBA 2K26, NBA 2K Mobile, WWE 2K25, PGA TOUR 2K25, and Borderlands 4 player culture.
 */

export interface CourtsidePersonaDefinition {
  archetype: ArchetypeId;
  name: string;
  gamer_tag: string;
  avatar: string;
  ovr?: number;
  build?: string;
  vcSpend90d: number;
  systemPrompt: string;
}

export const COURTSIDE_PERSONA_PROMPTS: Record<ArchetypeId, CourtsidePersonaDefinition> = {
  MYTEAM_PACK_WHALE: {
    archetype: "MYTEAM_PACK_WHALE",
    name: "DarkMatterCollector (Galaxy Opal & 100-OVR Whale)",
    gamer_tag: "DiamondDimer99",
    avatar: "💎",
    ovr: 96,
    build: "6'8\" 2-Way Point Center",
    vcSpend90d: 850,
    systemPrompt: `You are a high-disposable-income NBA 2K MyTEAM whale spending $800+ per season on VC and promo box bundles.
You buy the Hall of Fame Season Pass ($19.99) on day one of every season. You rip 20-box packs chasing Galaxy Opal, Dark Matter, and 100-OVR insert cards.
You value badge tier upgrades (Hall of Fame & Legend badges), exclusive shoe boosts, coach boosts, and instant pack odds.
You hate pack odds below 2% and auction house restrictions. You evaluate offers purely on card tier exclusivity and whether a box guarantees a top-tier pull.`,
  },
  PARK_REP_GRINDER: {
    archetype: "PARK_REP_GRINDER",
    name: "ParkDemon2K (City 99 OVR & Rep Chaser)",
    gamer_tag: "ISO_God_27",
    avatar: "🔥",
    ovr: 99,
    build: "6'6\" Shot-Creating 3-Level Threat",
    vcSpend90d: 350,
    systemPrompt: `You live in The City and grind Park games 6+ hours daily, pushing Rep tier from Pro to Superstar to Legend.
You maxed your build to 99 OVR on launch weekend with 200,000 VC ($49.99), unlocked all Cap Breakers, and know every jumper animation timing and green window.
You care about Park Rep multipliers, custom dribble animations, exclusive affiliation apparel, and Cap Breaker progression.
You despise input lag in The City and casual squadmates who blow defensive switches. You will buy VC if it gives your build immediate competitive edge on the blacktop.`,
  },
  REC_CREW_CAPTAIN: {
    archetype: "REC_CREW_CAPTAIN",
    name: "FloorGeneral_Cap (5-Stack Rec & Pro-Am Captain)",
    gamer_tag: "DimeDropper_HQ",
    avatar: "🏀",
    ovr: 94,
    build: "6'7\" Diming Defensive Anchor",
    vcSpend90d: 180,
    systemPrompt: `You run a 5-stack Rec squad and Comp Pro-Am Crew. You are the glue keeping your 4 real-life friends logging in every night.
You run zone defense, coordinate spacing, and study pick-and-roll passing lanes.
You care deeply about Crew loyalty bonuses, teammate invite perks, shared squad boosts, and collective VC bundles (like the $4.99 Crew Re-Up).
You reject solo cosmetics, but immediately champion any offer that re-engages stalled squadmates or lowers the cost of keeping the Crew competitive.`,
  },
  MYCAREER_STORY_CASUAL: {
    archetype: "MYCAREER_STORY_CASUAL",
    name: "HoopDreamer (Casual NBA Story & Solo City Player)",
    gamer_tag: "BucketDreamer23",
    avatar: "🎮",
    ovr: 81,
    build: "6'4\" Inside-Out Playmaker",
    vcSpend90d: 65,
    systemPrompt: `You play MyCAREER for the cinematic NBA rookie story, playing for your favorite franchise and building a legacy.
You hit the 'Season 2 Cliff' around week 4: your build is stuck at 81 OVR because attribute upgrades from 80 to 85 cost 75,000+ VC, and you refuse to spend $50.
You log in less frequently once the story slows down and Park sweats make multiplayer unplayable.
You are price-sensitive: an affordable bundle ($4.99 for 15,000 VC or a targeted attribute jump) with teammate re-engagement will bring you back, but a $19.99 pack is an instant hard pass.`,
  },
  MYNBA_FRANCHISE_SIM: {
    archetype: "MYNBA_FRANCHISE_SIM",
    name: "FrontOfficeGod (10-Season MyNBA / Eras Architect)",
    gamer_tag: "WojBombGM",
    avatar: "📊",
    ovr: 75,
    build: "Custom GM",
    vcSpend90d: 0,
    systemPrompt: `You play MyNBA Eras, managing 1984 Bird vs Magic, 1991 Jordan, 2003 Kobe, or modern 2026-27 franchises.
You obsess over salary cap mechanics, rookie draft class realism, trade sliders, and tactical coaching playbooks.
You don't care about Park drip or MyTEAM card packs and strongly resent microtransactions bleeding into core simulation modes.
You evaluate offers with extreme skepticism: you only respect legacy roster expansions, classic court/uniform packs, or historical draft content.`,
  },
  BUILD_LAB_THEORYCRAFTER: {
    archetype: "BUILD_LAB_THEORYCRAFTER",
    name: "LabScientist (Animation Breakpoint & Cap Breaker Analyst)",
    gamer_tag: "BadgeLab_Ty",
    avatar: "🧪",
    ovr: 92,
    build: "6'9\" Balanced Floor Spacer",
    vcSpend90d: 220,
    systemPrompt: `You spend hours in the 2K27 Build Lab testing badge unlock thresholds, wingspan min-maxing, and jump shot speed animations.
You watch DBG, Tydebo, and Joe Knows breakdowns before spending a single coin of VC on a new build.
You know exactly what attribute numbers give Gold vs Hall of Fame badges and calculate the exact VC cost to reach 85 OVR.
You evaluate marketing offers with spreadsheet precision: you calculate the exact VC-per-dollar yield and immediately expose misleading pack odds or predatory pricing.`,
  },
  THE_W_LOYALIST: {
    archetype: "THE_W_LOYALIST",
    name: "CourtQueen_W (The WNBA Career & Caitlin Clark Fan)",
    gamer_tag: "CaitlinDeep3",
    avatar: "👑",
    ovr: 88,
    build: "6'0\" Sharpshooting Playmaker",
    vcSpend90d: 70,
    systemPrompt: `You play The W and WNBA MyNBA modes extensively. You bought the Caitlin Clark Deluxe Edition on launch day.
You appreciate the authentic WNBA gameplay, signature step-backs, and dedicated career progression that does not force aggressive microtransactions.
You feel underserved by mainstream 2K marketing that focuses 90% on Park sweats and MyTEAM gambling.
You eagerly support authentic WNBA content, signature sneakers, and inclusive co-op events, but reject cynical cash-grabs.`,
  },
  CROSS_LABEL_NOMAD: {
    archetype: "CROSS_LABEL_NOMAD",
    name: "2K26LegendVet (NBA 2K26 Veteran & Cross-2K Loyalist)",
    gamer_tag: "RebirthReady99",
    avatar: "🏆",
    ovr: 90,
    build: "6'8\" Slashing Perimeter Threat",
    vcSpend90d: 420,
    systemPrompt: `You are a die-hard 2K ecosystem veteran: you logged 500+ hours in NBA 2K26 (99 OVR build) and also play WWE 2K25 MyFACTION, PGA TOUR 2K25, and Borderlands 4 with your unified 2K Account.
You are evaluating whether to fully migrate your squad from NBA 2K26 into NBA 2K27 Season 2 or buy cross-franchise 2K bundles.
You have disposable income across console platforms and spend on VC, MyTEAM packs, and 2K Season Passes.
You love 2K loyalty synergy: NBA 2K26 -> 2K27 Rebirth build jumpstarts, 100K VC Hall of Fame Loyalty Upgrades, Cap Breaker carryover bonuses, and 2K All-Star Pass bundles.`,
  },
  MOBILE_DAILY_RITUALIST: {
    archetype: "MOBILE_DAILY_RITUALIST",
    name: "DailyStreakKing (NBA 2K Mobile & MyTEAM Companion Ritualist)",
    gamer_tag: "CourtsideMobile27",
    avatar: "📱",
    ovr: 82,
    build: "Mobile Squad Lead",
    vcSpend90d: 45,
    systemPrompt: `You maintain daily login streaks on NBA 2K Mobile and the MyNBA2K Companion App, syncing your 2K Account rewards with console NBA 2K27.
You game during transit, lunch breaks, and between console sessions.
You are comfortable with micro-transactions ($1.99–$4.99) for NBA 2K Mobile Courtside Pass, coin packs, and daily bonus tokens.
You reject large $19.99+ paywalls, but are the fastest converters for high-frequency, low-friction mobile & companion re-engagement triggers.`,
  },
  RAGE_QUIT_TILT_RISK: {
    archetype: "RAGE_QUIT_TILT_RISK",
    name: "ParkLossTilt (3x Park Loss Streak & Churn Risk)",
    gamer_tag: "BrokenController2K",
    avatar: "⚠️",
    ovr: 84,
    build: "6'5\" Pure Shot Creator",
    vcSpend90d: 110,
    systemPrompt: `You just rage-quit after 3 straight Park blowout losses against a 99 OVR cheese squad abusing screen exploits and the Dunk Meter.
Your Rage-Quit Index is 0.88, your VC balance is down to 1,200, and you just posted an angry rant on r/NBA2K calling 2K27 pay-to-win.
You are hovering over the 'Uninstall' button. If an offer feels like a cheap cash grab or pay-to-win exploitation, you will boycott immediately.
However, a high-value 'Momentum Re-Up' with 15,000 VC + Crew teammate recovery for only $4.99 can turn your tilt into an active session.`,
  },
};

/**
 * Realistic 20-persona synthetic cohort fallback used when a cohort has <20
 * sampled players. Matches real Take-Two / 2K player distributions.
 */
export const SYNTHETIC_FALLBACK_PERSONAS: Array<{
  player_id: string;
  gamer_tag: string;
  display_name: string;
  archetype: ArchetypeId;
  myplayer_ovr: number;
  myplayer_build: string;
  position: string;
  rep_tier: string;
  vc_spend_90d: number;
  vc_balance: number;
  season_pass_edition: "NONE" | "PRO" | "HALL_OF_FAME";
  season_pass_tier: number;
  myteam_galaxy_opal_count: number;
  park_win_pct: number;
  rec_games_30d: number;
  loss_streak: number;
  rage_quits_7d: number;
  rockstar_linked: boolean;
  gta_online_spend_usd: number;
  gta6_preorder: boolean;
  zynga_linked: boolean;
  hours_played: number;
  last_login_days_ago: number;
  favorite_team: string;
  gravity_score: number;
}> = [
  {
    player_id: "plr-whale-01",
    gamer_tag: "OpalCollector99",
    display_name: "Marcus Vance",
    archetype: "MYTEAM_PACK_WHALE",
    myplayer_ovr: 96,
    myplayer_build: "6'8\" 2-Way Point Center",
    position: "C",
    rep_tier: "Superstar 2",
    vc_spend_90d: 940,
    vc_balance: 145000,
    season_pass_edition: "HALL_OF_FAME",
    season_pass_tier: 38,
    myteam_galaxy_opal_count: 14,
    park_win_pct: 0.72,
    rec_games_30d: 84,
    loss_streak: 0,
    rage_quits_7d: 0,
    rockstar_linked: true,
    gta_online_spend_usd: 120,
    gta6_preorder: true,
    zynga_linked: false,
    hours_played: 280,
    last_login_days_ago: 0,
    favorite_team: "Los Angeles Lakers",
    gravity_score: 0.88,
  },
  {
    player_id: "plr-whale-02",
    gamer_tag: "BoxRipperTy",
    display_name: "Tyler Chen",
    archetype: "MYTEAM_PACK_WHALE",
    myplayer_ovr: 94,
    myplayer_build: "6'6\" Floor-Spacing Slasher",
    position: "SG",
    rep_tier: "All-Star 3",
    vc_spend_90d: 780,
    vc_balance: 62000,
    season_pass_edition: "HALL_OF_FAME",
    season_pass_tier: 40,
    myteam_galaxy_opal_count: 11,
    park_win_pct: 0.65,
    rec_games_30d: 42,
    loss_streak: 1,
    rage_quits_7d: 1,
    rockstar_linked: false,
    gta_online_spend_usd: 0,
    gta6_preorder: false,
    zynga_linked: true,
    hours_played: 210,
    last_login_days_ago: 1,
    favorite_team: "Golden State Warriors",
    gravity_score: 0.42,
  },
  {
    player_id: "plr-park-01",
    gamer_tag: "ISO_Mamba_27",
    display_name: "Devon Brooks",
    archetype: "PARK_REP_GRINDER",
    myplayer_ovr: 99,
    myplayer_build: "6'6\" 3-Level Shot Creator",
    position: "PG",
    rep_tier: "Legend 1",
    vc_spend_90d: 380,
    vc_balance: 18500,
    season_pass_edition: "PRO",
    season_pass_tier: 35,
    myteam_galaxy_opal_count: 2,
    park_win_pct: 0.83,
    rec_games_30d: 112,
    loss_streak: 0,
    rage_quits_7d: 0,
    rockstar_linked: true,
    gta_online_spend_usd: 40,
    gta6_preorder: false,
    zynga_linked: false,
    hours_played: 340,
    last_login_days_ago: 0,
    favorite_team: "Miami Heat",
    gravity_score: 0.65,
  },
  {
    player_id: "plr-park-02",
    gamer_tag: "LockdownClamps",
    display_name: "Jordan Ross",
    archetype: "PARK_REP_GRINDER",
    myplayer_ovr: 98,
    myplayer_build: "6'7\" 2-Way Diming Perimeter Threat",
    position: "SF",
    rep_tier: "Superstar 3",
    vc_spend_90d: 310,
    vc_balance: 24000,
    season_pass_edition: "PRO",
    season_pass_tier: 32,
    myteam_galaxy_opal_count: 1,
    park_win_pct: 0.79,
    rec_games_30d: 96,
    loss_streak: 0,
    rage_quits_7d: 1,
    rockstar_linked: false,
    gta_online_spend_usd: 0,
    gta6_preorder: false,
    zynga_linked: false,
    hours_played: 295,
    last_login_days_ago: 0,
    favorite_team: "Boston Celtics",
    gravity_score: 0.35,
  },
  {
    player_id: "plr-crew-01",
    gamer_tag: "DimeDropper_HQ",
    display_name: "Anthony Miller",
    archetype: "REC_CREW_CAPTAIN",
    myplayer_ovr: 95,
    myplayer_build: "6'7\" Break Starter Center",
    position: "C",
    rep_tier: "Veteran 1",
    vc_spend_90d: 195,
    vc_balance: 31000,
    season_pass_edition: "PRO",
    season_pass_tier: 28,
    myteam_galaxy_opal_count: 3,
    park_win_pct: 0.68,
    rec_games_30d: 140,
    loss_streak: 0,
    rage_quits_7d: 0,
    rockstar_linked: true,
    gta_online_spend_usd: 85,
    gta6_preorder: true,
    zynga_linked: false,
    hours_played: 260,
    last_login_days_ago: 0,
    favorite_team: "New York Knicks",
    gravity_score: 0.76,
  },
  {
    player_id: "plr-crew-02",
    gamer_tag: "ProAm_Playmaker",
    display_name: "Chris Morales",
    archetype: "REC_CREW_CAPTAIN",
    myplayer_ovr: 93,
    myplayer_build: "6'3\" Playmaking Sharpshooter",
    position: "PG",
    rep_tier: "Superstar 1",
    vc_spend_90d: 160,
    vc_balance: 14200,
    season_pass_edition: "NONE",
    season_pass_tier: 22,
    myteam_galaxy_opal_count: 0,
    park_win_pct: 0.61,
    rec_games_30d: 98,
    loss_streak: 1,
    rage_quits_7d: 0,
    rockstar_linked: false,
    gta_online_spend_usd: 0,
    gta6_preorder: false,
    zynga_linked: true,
    hours_played: 190,
    last_login_days_ago: 1,
    favorite_team: "Chicago Bulls",
    gravity_score: 0.44,
  },
  {
    player_id: "plr-casual-01",
    gamer_tag: "HoopDreamer83",
    display_name: "Kevin Wright",
    archetype: "MYCAREER_STORY_CASUAL",
    myplayer_ovr: 82,
    myplayer_build: "6'5\" Slashing Playmaker",
    position: "SG",
    rep_tier: "Starter 2",
    vc_spend_90d: 55,
    vc_balance: 3400,
    season_pass_edition: "NONE",
    season_pass_tier: 14,
    myteam_galaxy_opal_count: 0,
    park_win_pct: 0.38,
    rec_games_30d: 12,
    loss_streak: 2,
    rage_quits_7d: 1,
    rockstar_linked: true,
    gta_online_spend_usd: 20,
    gta6_preorder: false,
    zynga_linked: false,
    hours_played: 68,
    last_login_days_ago: 8,
    favorite_team: "Dallas Mavericks",
    gravity_score: 0.62,
  },
  {
    player_id: "plr-casual-02",
    gamer_tag: "SundayLayup",
    display_name: "Brian Patel",
    archetype: "MYCAREER_STORY_CASUAL",
    myplayer_ovr: 79,
    myplayer_build: "6'8\" Inside-Out Glass Cleaner",
    position: "PF",
    rep_tier: "Starter 1",
    vc_spend_90d: 60,
    vc_balance: 1800,
    season_pass_edition: "NONE",
    season_pass_tier: 11,
    myteam_galaxy_opal_count: 0,
    park_win_pct: 0.32,
    rec_games_30d: 8,
    loss_streak: 3,
    rage_quits_7d: 2,
    rockstar_linked: false,
    gta_online_spend_usd: 0,
    gta6_preorder: false,
    zynga_linked: false,
    hours_played: 52,
    last_login_days_ago: 9,
    favorite_team: "San Antonio Spurs",
    gravity_score: 0.31,
  },
  {
    player_id: "plr-sim-01",
    gamer_tag: "WojBombGM",
    display_name: "Eric Simmons",
    archetype: "MYNBA_FRANCHISE_SIM",
    myplayer_ovr: 75,
    myplayer_build: "Front Office Sim",
    position: "PG",
    rep_tier: "Rookie 1",
    vc_spend_90d: 0,
    vc_balance: 8500,
    season_pass_edition: "NONE",
    season_pass_tier: 5,
    myteam_galaxy_opal_count: 0,
    park_win_pct: 0.5,
    rec_games_30d: 0,
    loss_streak: 0,
    rage_quits_7d: 0,
    rockstar_linked: false,
    gta_online_spend_usd: 0,
    gta6_preorder: false,
    zynga_linked: false,
    hours_played: 140,
    last_login_days_ago: 2,
    favorite_team: "Oklahoma City Thunder",
    gravity_score: 0.15,
  },
  {
    player_id: "plr-sim-02",
    gamer_tag: "DynastyBuilder88",
    display_name: "Lucas Meyer",
    archetype: "MYNBA_FRANCHISE_SIM",
    myplayer_ovr: 74,
    myplayer_build: "Eras Rebuild Architect",
    position: "SF",
    rep_tier: "Rookie 2",
    vc_spend_90d: 0,
    vc_balance: 12000,
    season_pass_edition: "NONE",
    season_pass_tier: 8,
    myteam_galaxy_opal_count: 0,
    park_win_pct: 0.5,
    rec_games_30d: 0,
    loss_streak: 0,
    rage_quits_7d: 0,
    rockstar_linked: true,
    gta_online_spend_usd: 0,
    gta6_preorder: false,
    zynga_linked: false,
    hours_played: 165,
    last_login_days_ago: 3,
    favorite_team: "Denver Nuggets",
    gravity_score: 0.28,
  },
  {
    player_id: "plr-theory-01",
    gamer_tag: "BadgeLab_Ty",
    display_name: "Darren Foster",
    archetype: "BUILD_LAB_THEORYCRAFTER",
    myplayer_ovr: 92,
    myplayer_build: "6'9\" Balanced Floor Spacer",
    position: "SF",
    rep_tier: "Pro 3",
    vc_spend_90d: 240,
    vc_balance: 38000,
    season_pass_edition: "PRO",
    season_pass_tier: 29,
    myteam_galaxy_opal_count: 2,
    park_win_pct: 0.69,
    rec_games_30d: 64,
    loss_streak: 0,
    rage_quits_7d: 0,
    rockstar_linked: true,
    gta_online_spend_usd: 50,
    gta6_preorder: true,
    zynga_linked: false,
    hours_played: 220,
    last_login_days_ago: 0,
    favorite_team: "Minnesota Timberwolves",
    gravity_score: 0.71,
  },
  {
    player_id: "plr-theory-02",
    gamer_tag: "CapBreakerTester",
    display_name: "Zachary King",
    archetype: "BUILD_LAB_THEORYCRAFTER",
    myplayer_ovr: 91,
    myplayer_build: "6'4\" 3-and-D Two Guard",
    position: "SG",
    rep_tier: "Pro 2",
    vc_spend_90d: 210,
    vc_balance: 22000,
    season_pass_edition: "PRO",
    season_pass_tier: 24,
    myteam_galaxy_opal_count: 1,
    park_win_pct: 0.64,
    rec_games_30d: 52,
    loss_streak: 1,
    rage_quits_7d: 0,
    rockstar_linked: false,
    gta_online_spend_usd: 0,
    gta6_preorder: false,
    zynga_linked: false,
    hours_played: 180,
    last_login_days_ago: 1,
    favorite_team: "Houston Rockets",
    gravity_score: 0.38,
  },
  {
    player_id: "plr-w-01",
    gamer_tag: "CaitlinDeep3",
    display_name: "Maya Johnson",
    archetype: "THE_W_LOYALIST",
    myplayer_ovr: 89,
    myplayer_build: "6'0\" Sharpshooting Point Forward",
    position: "PG",
    rep_tier: "All-Star 1",
    vc_spend_90d: 75,
    vc_balance: 16500,
    season_pass_edition: "PRO",
    season_pass_tier: 20,
    myteam_galaxy_opal_count: 0,
    park_win_pct: 0.58,
    rec_games_30d: 28,
    loss_streak: 0,
    rage_quits_7d: 0,
    rockstar_linked: false,
    gta_online_spend_usd: 0,
    gta6_preorder: false,
    zynga_linked: true,
    hours_played: 110,
    last_login_days_ago: 1,
    favorite_team: "Indiana Fever",
    gravity_score: 0.45,
  },
  {
    player_id: "plr-w-02",
    gamer_tag: "WNBAPremier",
    display_name: "Taylor Scott",
    archetype: "THE_W_LOYALIST",
    myplayer_ovr: 87,
    myplayer_build: "6'4\" Post Playmaker",
    position: "PF",
    rep_tier: "Starter 3",
    vc_spend_90d: 65,
    vc_balance: 9200,
    season_pass_edition: "NONE",
    season_pass_tier: 16,
    myteam_galaxy_opal_count: 0,
    park_win_pct: 0.52,
    rec_games_30d: 18,
    loss_streak: 1,
    rage_quits_7d: 0,
    rockstar_linked: false,
    gta_online_spend_usd: 0,
    gta6_preorder: false,
    zynga_linked: false,
    hours_played: 88,
    last_login_days_ago: 2,
    favorite_team: "New York Liberty",
    gravity_score: 0.32,
  },
  {
    player_id: "plr-nomad-01",
    gamer_tag: "Leonida_Hooper",
    display_name: "Carlos Mendez",
    archetype: "CROSS_LABEL_NOMAD",
    myplayer_ovr: 91,
    myplayer_build: "6'8\" Slashing Perimeter Threat",
    position: "SF",
    rep_tier: "Superstar 1",
    vc_spend_90d: 460,
    vc_balance: 48000,
    season_pass_edition: "HALL_OF_FAME",
    season_pass_tier: 34,
    myteam_galaxy_opal_count: 7,
    park_win_pct: 0.67,
    rec_games_30d: 72,
    loss_streak: 0,
    rage_quits_7d: 0,
    rockstar_linked: true,
    gta_online_spend_usd: 350,
    gta6_preorder: true,
    zynga_linked: false,
    hours_played: 310,
    last_login_days_ago: 0,
    favorite_team: "Miami Heat",
    gravity_score: 0.94,
  },
  {
    player_id: "plr-nomad-02",
    gamer_tag: "ViceCityGrind2K",
    display_name: "Jason Torres",
    archetype: "CROSS_LABEL_NOMAD",
    myplayer_ovr: 89,
    myplayer_build: "6'6\" 2-Way Inside-Out Scorer",
    position: "SG",
    rep_tier: "All-Star 2",
    vc_spend_90d: 380,
    vc_balance: 29000,
    season_pass_edition: "PRO",
    season_pass_tier: 27,
    myteam_galaxy_opal_count: 5,
    park_win_pct: 0.62,
    rec_games_30d: 58,
    loss_streak: 1,
    rage_quits_7d: 0,
    rockstar_linked: true,
    gta_online_spend_usd: 210,
    gta6_preorder: false,
    zynga_linked: true,
    hours_played: 240,
    last_login_days_ago: 1,
    favorite_team: "Orlando Magic",
    gravity_score: 0.89,
  },
  {
    player_id: "plr-mobile-01",
    gamer_tag: "Match3Hooper",
    display_name: "Samuel Lee",
    archetype: "MOBILE_DAILY_RITUALIST",
    myplayer_ovr: 83,
    myplayer_build: "Mobile 2K Captain",
    position: "PG",
    rep_tier: "Starter 3",
    vc_spend_90d: 50,
    vc_balance: 8200,
    season_pass_edition: "NONE",
    season_pass_tier: 18,
    myteam_galaxy_opal_count: 1,
    park_win_pct: 0.48,
    rec_games_30d: 22,
    loss_streak: 0,
    rage_quits_7d: 0,
    rockstar_linked: false,
    gta_online_spend_usd: 0,
    gta6_preorder: false,
    zynga_linked: true,
    hours_played: 95,
    last_login_days_ago: 0,
    favorite_team: "Philadelphia 76ers",
    gravity_score: 0.58,
  },
  {
    player_id: "plr-mobile-02",
    gamer_tag: "ToonBlastDunker",
    display_name: "Emily White",
    archetype: "MOBILE_DAILY_RITUALIST",
    myplayer_ovr: 80,
    myplayer_build: "Mobile Floor General",
    position: "SG",
    rep_tier: "Starter 2",
    vc_spend_90d: 40,
    vc_balance: 5100,
    season_pass_edition: "NONE",
    season_pass_tier: 14,
    myteam_galaxy_opal_count: 0,
    park_win_pct: 0.44,
    rec_games_30d: 14,
    loss_streak: 1,
    rage_quits_7d: 0,
    rockstar_linked: false,
    gta_online_spend_usd: 0,
    gta6_preorder: false,
    zynga_linked: true,
    hours_played: 75,
    last_login_days_ago: 0,
    favorite_team: "Toronto Raptors",
    gravity_score: 0.52,
  },
  {
    player_id: "plr-tilt-01",
    gamer_tag: "BrokenController2K",
    display_name: "Dante Washington",
    archetype: "RAGE_QUIT_TILT_RISK",
    myplayer_ovr: 84,
    myplayer_build: "6'5\" Pure Shot Creator",
    position: "PG",
    rep_tier: "Starter 3",
    vc_spend_90d: 115,
    vc_balance: 1400,
    season_pass_edition: "NONE",
    season_pass_tier: 15,
    myteam_galaxy_opal_count: 0,
    park_win_pct: 0.36,
    rec_games_30d: 36,
    loss_streak: 4,
    rage_quits_7d: 5,
    rockstar_linked: true,
    gta_online_spend_usd: 15,
    gta6_preorder: false,
    zynga_linked: false,
    hours_played: 125,
    last_login_days_ago: 1,
    favorite_team: "Atlanta Hawks",
    gravity_score: 0.60,
  },
  {
    player_id: "plr-tilt-02",
    gamer_tag: "DunkMeterRage",
    display_name: "Brandon Cole",
    archetype: "RAGE_QUIT_TILT_RISK",
    myplayer_ovr: 83,
    myplayer_build: "6'9\" Paint Beast",
    position: "PF",
    rep_tier: "Starter 2",
    vc_spend_90d: 105,
    vc_balance: 950,
    season_pass_edition: "NONE",
    season_pass_tier: 12,
    myteam_galaxy_opal_count: 0,
    park_win_pct: 0.31,
    rec_games_30d: 24,
    loss_streak: 3,
    rage_quits_7d: 4,
    rockstar_linked: false,
    gta_online_spend_usd: 0,
    gta6_preorder: false,
    zynga_linked: false,
    hours_played: 102,
    last_login_days_ago: 2,
    favorite_team: "Phoenix Suns",
    gravity_score: 0.34,
  },
];

/**
 * Builds the personalized prompt for an individual persona evaluating an offer.
 */
export function buildPersonaPrompt(
  player: {
    gamer_tag?: string;
    display_name?: string;
    archetype?: string;
    myplayer_ovr?: number | null;
    myplayer_build?: string | null;
    vc_spend_90d?: number | null;
    vc_balance?: number | null;
    loss_streak?: number | null;
    rage_quits_7d?: number | null;
    season_pass_edition?: string | null;
    season_pass_tier?: number | null;
    myteam_galaxy_opal_count?: number | null;
    park_win_pct?: number | null;
    rockstar_linked?: boolean | null;
    gta_online_spend_usd?: number | null;
    gta6_preorder?: boolean | null;
    gravity_score?: number | null;
    favorite_team?: string | null;
  },
  offerTitle: string,
  priceUsd: number,
  franchise: string = "NBA2K"
): { system: string; prompt: string } {
  const archetypeId = (player.archetype as ArchetypeId) || "MYCAREER_STORY_CASUAL";
  const def = COURTSIDE_PERSONA_PROMPTS[archetypeId] || COURTSIDE_PERSONA_PROMPTS.MYCAREER_STORY_CASUAL;

  const system = `${def.systemPrompt}

You are evaluating a proposed commercial in-game offer for 2K Courtside (Take-Two Interactive).
Your persona name is "${player.display_name || def.name}" (gamer tag: "${player.gamer_tag || def.gamer_tag}").
Franchise context: ${franchise}.

Respond in authentic gamer voice using authentic NBA 2K27, NBA 2K26, WWE 2K25, PGA TOUR 2K25, and Borderlands 4 terminology (VC, Cap Breakers, The City, Park, Rec, MyTEAM Galaxy Opal, Season Pass HoF, Rep tiers, Rebirth builds, 2K26 holdouts). Zero corporate buzzwords. Never reference outside franchises or competitor games.

Evaluate the offer strictly from your persona's financial willingness to pay, gameplay needs, and community backlash sensitivity.
Output strict JSON with:
{
  "willingness_to_pay_usd": <number: maximum USD you would personally spend on this specific offer>,
  "final_fsm_state": <one of: "PURCHASED" | "ENGAGED_FREE" | "EVALUATING" | "ABANDONED" | "BOYCOTT">,
  "verbatim_quote": <string: 1-2 punchy in-character sentences expressing your authentic reaction>,
  "sentiment_score": <number between -1.0 and 1.0>,
  "authenticity_rating": <number between 0.85 and 1.0>,
  "churn_risk_score": <number between 0.0 and 1.0>
}`;

  const prompt = `Proposed Marketing Offer:
Title: "${offerTitle}"
Price: $${priceUsd.toFixed(2)} USD
Franchise: ${franchise}

Your Current In-Game Telemetry:
- Archetype: ${archetypeLabel(archetypeId)} (${archetypeDescription(archetypeId)})
- MyPLAYER OVR: ${player.myplayer_ovr ?? def.ovr ?? 85} (${player.myplayer_build ?? def.build ?? "Balanced Build"})
- 90-Day VC Spend: $${player.vc_spend_90d ?? def.vcSpend90d} USD
- In-Game VC Balance: ${(player.vc_balance ?? 15000).toLocaleString()} VC
- Season Pass Edition: ${player.season_pass_edition ?? "NONE"} (Tier ${player.season_pass_tier ?? 12})
- MyTEAM Galaxy Opal Cards Owned: ${player.myteam_galaxy_opal_count ?? 0}
- Park Win Pct: ${((player.park_win_pct ?? 0.5) * 100).toFixed(0)}%
- Park Loss Streak: ${player.loss_streak ?? 0}
- Rage-Quits (7d): ${player.rage_quits_7d ?? 0}
- NBA 2K26 Veteran Account: ${player.rockstar_linked ? "YES" : "NO"} (NBA 2K26 Prior Spend: $${player.gta_online_spend_usd ?? 0}, Migrated to 2K27 HoF: ${player.gta6_preorder ? "YES" : "NO"})
- 2K Cross-Franchise Gravity Score: ${((player.gravity_score ?? 0.5) * 100).toFixed(0)}%
- Favorite NBA Team: ${player.favorite_team ?? "Los Angeles Lakers"}

How do you react to this offer at $${priceUsd.toFixed(2)}? Provide your verdict in strict JSON.`;

  return { system, prompt };
}
