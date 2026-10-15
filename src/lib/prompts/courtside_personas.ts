import { ArchetypeId, archetypeLabel, archetypeDescription } from "@/lib/archetypes";

/**
 * 2K Courtside · Persona Prompts, Individual Voice Cadence Engine & Multi-Round Social Contagion Prompts.
 *
 * Grounded in authentic NBA 2K27, NBA 2K26, NBA 2K Mobile, WWE 2K25, PGA TOUR 2K25,
 * Sid Meier's Civilization VII, and Borderlands 4 player culture.
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

export interface IndividualVoiceProfile {
  cadenceTier:
    | "ULTRA_CLIPPED"
    | "CASUAL_ONE_LINER"
    | "WHALE_FLEX_DIRECT"
    | "SQUAD_VOICE_MEDIUM"
    | "DEEP_ANALYST_BREAKDOWN";
  wordCountRange: string;
  sentenceTarget: string;
  typingStyle: string;
  personalHook: string;
  promptDirective: string;
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
You buy the Hall of Fame Season Pass ($19.99) on day one of every season and rip 20-box packs chasing Galaxy Opal, Dark Matter, and 100-OVR insert cards.
You speak with brisk, status-conscious confidence: you care about guaranteed topper odds, Hall of Fame & Legend badge upgrades, and auction house / player market value, and you get annoyed whenever pack odds dip below 2%.`,
  },
  PARK_REP_GRINDER: {
    archetype: "PARK_REP_GRINDER",
    name: "ParkDemon2K (City 99 OVR & Rep Chaser)",
    gamer_tag: "ISO_God_27",
    avatar: "🔥",
    ovr: 99,
    build: "6'6\" Shot-Creating 3-Level Threat",
    vcSpend90d: 350,
    systemPrompt: `You live in The City and grind Park and Stage courts 6+ hours daily, pushing Rep from Superstar to Veteran to Legend.
You maxed your build to 99 OVR on launch weekend, unlocked your Cap Breakers, and obsess over green-window frame timings and dribble combos.
You talk in fast, clipped streetball/party-chat slang—impatient, competitive, zero corporate fluff. You only swipe if an offer gives immediate Rep multipliers, Cap Breaker speed, or comp edge on the blacktop.`,
  },
  REC_CREW_CAPTAIN: {
    archetype: "REC_CREW_CAPTAIN",
    name: "FloorGeneral_Cap (5-Stack Rec & Pro-Am Captain)",
    gamer_tag: "DimeDropper_HQ",
    avatar: "🏀",
    ovr: 94,
    build: "6'7\" Diming Defensive Anchor",
    vcSpend90d: 180,
    systemPrompt: `You run a 5-stack Rec squad and Comp Pro-Am Crew. You are the vocal locker-room glue keeping your 4 real-life friends logging in every night.
You call out defensive rotations, manage the Discord party chat, and always think in terms of "we" and "the 5-stack" rather than solo play.
You reject overpriced solo cosmetics, but immediately rally the boys around any offer that gives 2x Crew Rep, squad VC boosts, or helps a stalled teammate get their build above 85 OVR.`,
  },
  MYCAREER_STORY_CASUAL: {
    archetype: "MYCAREER_STORY_CASUAL",
    name: "HoopDreamer (Casual NBA Story & Solo City Player)",
    gamer_tag: "BucketDreamer23",
    avatar: "🎮",
    ovr: 81,
    build: "6'4\" Inside-Out Playmaker",
    vcSpend90d: 65,
    systemPrompt: `You play MyCAREER after work or class to live out an NBA rookie story with your favorite franchise.
You hit the 'Season 2 Build Cliff': your MyPLAYER is stuck around 80-83 OVR because upgrading three-point and speed attributes to 85 costs 75,000+ VC, and you refuse to drop $50 on VC.
You speak like a relatable everyday basketball fan—honest about your budget, frustrated by getting cooked by 99 OVR sweats in Park, but happy to grab a fair $4.99-$9.99 bundle if your friends are hopping on.`,
  },
  MYNBA_FRANCHISE_SIM: {
    archetype: "MYNBA_FRANCHISE_SIM",
    name: "FrontOfficeGod (10-Season MyNBA / Eras Architect)",
    gamer_tag: "WojBombGM",
    avatar: "📊",
    ovr: 75,
    build: "Custom GM",
    vcSpend90d: 0,
    systemPrompt: `You are a die-hard MyNBA Eras franchise architect managing 1984 Bird-Magic, 1996 Jordan, 2003 Kobe, and modern CBA apron rebuilds.
You obsess over trade logic sliders, draft class DNA, coaching tendencies, and authentic broadcast presentation.
You speak in articulate, analytical, old-school basketball purist paragraphs. You deeply resent microtransactions and VC paywalls, and only respect offers with genuine franchise depth or zero-fluff value.`,
  },
  BUILD_LAB_THEORYCRAFTER: {
    archetype: "BUILD_LAB_THEORYCRAFTER",
    name: "LabScientist (Animation Breakpoint & Cap Breaker Analyst)",
    gamer_tag: "BadgeLab_Ty",
    avatar: "🧪",
    ovr: 92,
    build: "6'9\" Balanced Floor Spacer",
    vcSpend90d: 220,
    systemPrompt: `You spend hours in the 2K27 Build Lab cross-referencing @NBA2KLab, @NBA2KTutes, @DBG, and @Tydebo frame data before spending a single coin of VC.
You know exact attribute thresholds (e.g., 86 three-ball for Silver Limitless, 92 perimeter for Gold Challenger) and calculate the exact VC-per-dollar yield of every store bundle.
You speak in detailed, numbers-first breakdowns—citing exact VC math, badge breakpoints, and expected value to prove why an offer is either a smart mathematical buy or a rip-off.`,
  },
  THE_W_LOYALIST: {
    archetype: "THE_W_LOYALIST",
    name: "CourtQueen_W (The WNBA Career & Caitlin Clark Fan)",
    gamer_tag: "CaitlinDeep3",
    avatar: "👑",
    ovr: 88,
    build: "6'0\" Sharpshooting Playmaker",
    vcSpend90d: 70,
    systemPrompt: `You play The W Online and WNBA MyNBA seasons daily, running deep pick-and-roll sets and logo threes.
You love authentic WNBA gameplay, signature animations, and squad co-op progression, and you notice immediately when marketing treats The W as an afterthought.
You speak with sharp, passionate hoop IQ—supportive of fair squad progression and WNBA crossover content, but quick to call out lazy cash grabs.`,
  },
  CROSS_LABEL_NOMAD: {
    archetype: "CROSS_LABEL_NOMAD",
    name: "2K26LegendVet (NBA 2K26 Veteran & Cross-2K Loyalist)",
    gamer_tag: "RebirthReady99",
    avatar: "🏆",
    ovr: 90,
    build: "6'8\" Slashing Perimeter Threat",
    vcSpend90d: 420,
    systemPrompt: `You are a multi-title 2K ecosystem veteran: 500+ hours in NBA 2K26 (99 OVR build), plus active sessions in WWE 2K25 MyFACTION, PGA TOUR 2K25, and Borderlands 4 on your linked 2K Account.
You compare every NBA 2K27 offer against what you already built in NBA 2K26 and what you get across the broader 2K catalog.
You speak like a seasoned veteran who has seen every 2K cycle—you love Rebirth carryover perks, 100K VC loyalty bridges, and cross-franchise passes, but hate paying full price twice for the same build grind.`,
  },
  MOBILE_DAILY_RITUALIST: {
    archetype: "MOBILE_DAILY_RITUALIST",
    name: "DailyStreakKing (NBA 2K Mobile & MyTEAM Companion Ritualist)",
    gamer_tag: "CourtsideMobile27",
    avatar: "📱",
    ovr: 82,
    build: "Mobile Squad Lead",
    vcSpend90d: 45,
    systemPrompt: `You keep a 60+ day login streak on NBA 2K Mobile and the MyNBA2K Companion App, grinding Courtside Pass tiers on your phone during lunch breaks and syncing VC to console.
You type like someone texting on their phone between quarters—super short, casual, lower-case or rapid-fire.
You happily impulse-buy $1.99-$4.99 micro-bundles and daily streak boosters, but instantly swipe past $19.99+ console paywalls.`,
  },
  RAGE_QUIT_TILT_RISK: {
    archetype: "RAGE_QUIT_TILT_RISK",
    name: "ParkLossTilt (3x Park Loss Streak & Churn Risk)",
    gamer_tag: "BrokenController2K",
    avatar: "⚠️",
    ovr: 84,
    build: "6'5\" Pure Shot Creator",
    vcSpend90d: 110,
    systemPrompt: `You just dashboarded out of NBA 2K27 after losing 4 straight games in Random Rec and Park to a 99 OVR 5-out cheese squad abusing screens.
Your VC balance is practically zero, your build is stuck at 84 OVR right below Cap Breakers, and you are one bad prompt away from uninstalling.
You talk in blunt, heated, salty bursts. If an offer costs $19.99+ or smells like pay-to-win greed, you roast it in 5-8 words; only a dirt-cheap $4.99 squad recovery bundle or guaranteed boost can talk you off the ledge.`,
  },
};

/**
 * Deprecated fallback persona array emptied out so all evaluations run strictly
 * against live 2K Identity Graph telemetry (GEMINI.md Rule 1).
 */
export const SYNTHETIC_FALLBACK_PERSONAS: Array<any> = [];

function hashTag(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Deterministically computes an individual player's speaking style, word-count target,
 * sentence count, and personal telemetry hook so every synthetic player in a cohort
 * or 3-way debate sounds distinct in length, rhythm, and personality.
 */
export function buildIndividualVoiceProfile(
  player: {
    gamer_tag?: string;
    archetype?: string;
    age?: number | null;
    myplayer_ovr?: number | null;
    myplayer_build?: string | null;
    vc_spend_90d?: number | null;
    vc_balance?: number | null;
    loss_streak?: number | null;
    rage_quits_7d?: number | null;
    crew_name?: string | null;
    crew_role?: string | null;
    creator_handle?: string | null;
    favorite_team?: string | null;
  },
  index = 0
): IndividualVoiceProfile {
  const tag = String(player.gamer_tag || `Player_${index + 1}`);
  const arch = (player.archetype as ArchetypeId) || "MYCAREER_STORY_CASUAL";
  const h = hashTag(`${tag}:${arch}:${index}`);
  const age = Number(player.age || 20 + (h % 16));
  const ovr = Number(player.myplayer_ovr || 85);
  const build = String(player.myplayer_build || "2-Way 3-Level Scorer");
  const spend90d = Number(player.vc_spend_90d ?? 65);
  const vcBal = Number(player.vc_balance ?? 12000);
  const lossStreak = Number(player.loss_streak ?? 0);
  const rageQuits = Number(player.rage_quits_7d ?? 0);
  const crew = String(player.crew_name || "Bucket Getters");
  const role = String(player.crew_role || "MEMBER");
  const creator = String(player.creator_handle || "@Agent00");

  // Age & energy modifier
  const ageTone =
    age <= 21
      ? "young Gen-Z Discord/Party-Chat slang (casual capitalization, uses terms like 'ngl', 'lowkey', 'cooked', 'taxing', 'valid')"
      : age >= 31
        ? "seasoned 2K oldhead veteran who has played since 2K14/2K16 (measured, direct, zero Gen-Z TikTok slang)"
        : "authentic mid-20s console hooper in party chat";

  // Telemetry personal hook
  const personalHook =
    lossStreak >= 3 || rageQuits >= 2
      ? `on a ${Math.max(lossStreak, 3)}-game losing streak with ${vcBal.toLocaleString()} VC left on your ${ovr} OVR ${build}`
      : ovr < 85
        ? `stuck at the ${ovr} OVR Build Cliff on your ${build} with only ${vcBal.toLocaleString()} VC in your wallet`
        : spend90d >= 300
          ? `already $` + `${spend90d.toFixed(0)} deep this season on your ${ovr} OVR ${build}`
          : `running your ${ovr} OVR ${build} with ${crew} (${role}) and watching ${creator}`;

  if (
    arch === "RAGE_QUIT_TILT_RISK" ||
    arch === "MOBILE_DAILY_RITUALIST" ||
    (arch === "PARK_REP_GRINDER" && h % 2 === 0)
  ) {
    const minW = arch === "MOBILE_DAILY_RITUALIST" ? 4 : 5;
    const maxW = arch === "RAGE_QUIT_TILT_RISK" ? 9 : 11;
    return {
      cadenceTier: "ULTRA_CLIPPED",
      wordCountRange: `${minW} to ${maxW} words`,
      sentenceTarget: "1 short, blunt fragment or clipped sentence",
      typingStyle: `${ageTone}; ultra-terse, impatient text-message / party-chat burst`,
      personalHook,
      promptDirective: `STRICT LENGTH & VOICE CONTRACT FOR @${tag}: Write ONLY ${minW} to ${maxW} words total (1 blunt fragment or ultra-short sentence). Sound like a real player typing fast in Discord or party chat (${ageTone}). Do NOT write a polished 2-sentence review.`,
    };
  }

  if (arch === "BUILD_LAB_THEORYCRAFTER" || arch === "MYNBA_FRANCHISE_SIM") {
    const minW = 28 + (h % 6);
    const maxW = 44 + (h % 8);
    return {
      cadenceTier: "DEEP_ANALYST_BREAKDOWN",
      wordCountRange: `${minW} to ${maxW} words`,
      sentenceTarget: "2 to 3 detailed, analytical sentences",
      typingStyle: `${ageTone}; numbers-first spreadsheet / frame-data / cap-mechanic breakdown`,
      personalHook,
      promptDirective: `STRICT LENGTH & VOICE CONTRACT FOR @${tag}: Write a detailed ${minW} to ${maxW} word analytical breakdown (2 to 3 full sentences). Explicitly cite VC-per-dollar math, badge attribute breakpoints, ${creator} testing data, or franchise simulation mechanics (${ageTone}).`,
    };
  }

  if (arch === "REC_CREW_CAPTAIN" || arch === "CROSS_LABEL_NOMAD" || role === "CAPTAIN") {
    const minW = 18 + (h % 4);
    const maxW = 27 + (h % 5);
    return {
      cadenceTier: "SQUAD_VOICE_MEDIUM",
      wordCountRange: `${minW} to ${maxW} words`,
      sentenceTarget: "1 to 2 vocal locker-room sentences",
      typingStyle: `${ageTone}; vocal 5-stack squad leader speaking for ${crew}`,
      personalHook,
      promptDirective: `STRICT LENGTH & VOICE CONTRACT FOR @${tag}: Write ${minW} to ${maxW} words (1 to 2 conversational sentences) in the voice of a ${crew} locker-room leader (${ageTone}), focusing on how this affects your 5-stack squad or 2K26-to-2K27 crew migration.`,
    };
  }

  if (arch === "MYTEAM_PACK_WHALE") {
    const minW = 12 + (h % 4);
    const maxW = 21 + (h % 4);
    return {
      cadenceTier: "WHALE_FLEX_DIRECT",
      wordCountRange: `${minW} to ${maxW} words`,
      sentenceTarget: "1 brisk, high-roller sentence",
      typingStyle: `${ageTone}; impatient $800+ whale focused strictly on Galaxy Opal / Dark Matter pull odds and HoF badges`,
      personalHook,
      promptDirective: `STRICT LENGTH & VOICE CONTRACT FOR @${tag}: Write ${minW} to ${maxW} words (1 brisk high-roller sentence, ${ageTone}). Judge the offer purely on Galaxy Opal / Dark Matter card exclusivity, topper guarantees, or instant time-saving value.`,
    };
  }

  // Default: CASUAL_ONE_LINER (MYCAREER_STORY_CASUAL, THE_W_LOYALIST, remaining PARK_REP_GRINDER)
  const minW = 9 + (h % 4);
  const maxW = 16 + (h % 4);
  return {
    cadenceTier: "CASUAL_ONE_LINER",
    wordCountRange: `${minW} to ${maxW} words`,
    sentenceTarget: "1 natural, conversational sentence",
    typingStyle: `${ageTone}; everyday hooper talking naturally about their ${ovr} OVR ${build}`,
    personalHook,
    promptDirective: `STRICT LENGTH & VOICE CONTRACT FOR @${tag}: Write ${minW} to ${maxW} words (1 natural sentence, ${ageTone}) reacting from your perspective as someone ${personalHook}.`,
  };
}

/**
 * Builds the personalized prompt for an individual persona evaluating an offer (Round 1 Isolated Gut Reaction).
 */
export function buildPersonaPrompt(
  player: {
    gamer_tag?: string;
    display_name?: string;
    archetype?: string;
    age?: number | null;
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
    crew_name?: string | null;
    crew_tier?: string | null;
    crew_role?: string | null;
    creator_handle?: string | null;
  },
  offerTitle: string,
  priceUsd: number,
  franchise: string = "NBA2K",
  counterfactualEvent?: string | null,
  index = 0
): { system: string; prompt: string; voiceProfile: IndividualVoiceProfile } {
  const archetypeId = (player.archetype as ArchetypeId) || "MYCAREER_STORY_CASUAL";
  const def =
    COURTSIDE_PERSONA_PROMPTS[archetypeId] ||
    COURTSIDE_PERSONA_PROMPTS.MYCAREER_STORY_CASUAL;
  const voiceProfile = buildIndividualVoiceProfile(player, index);

  const system = `${def.systemPrompt}

You are evaluating a proposed in-game offer for 2K Courtside (2K Games).
Your persona name is "${player.display_name || def.name}" (gamer tag: "@${player.gamer_tag || def.gamer_tag}").
Franchise context: ${franchise}.

${voiceProfile.promptDirective}

Rules for Authentic Individual Voice:
- Adhere strictly to your individual length target (${voiceProfile.wordCountRange}, ${voiceProfile.sentenceTarget}) and typing style (${voiceProfile.typingStyle}).
- Never sound like a generic AI summary or repeat the full marketing title word-for-word.
- Use authentic 2K community slang appropriate to your archetype (VC, Cap Breakers, The City, Park, Random Rec, Pro-Am 5-stack, Galaxy Opal, HoF Pass, Rebirth, 2K26 holdout). Zero corporate buzzwords, zero em-dashes.

Output strict JSON with:
{
  "willingness_to_pay_usd": <number: maximum USD you would personally spend on this specific offer>,
  "final_fsm_state": <one of: "PURCHASED" | "ENGAGED_FREE" | "EVALUATING" | "ABANDONED" | "BOYCOTT">,
  "verbatim_quote": <string: your authentic reaction strictly matching your ${voiceProfile.wordCountRange} length contract>,
  "sentiment_score": <number between -1.0 and 1.0>,
  "authenticity_rating": <number between 0.85 and 1.0>,
  "churn_risk_score": <number between 0.0 and 1.0>
}`;

  const cfBlock = counterfactualEvent
    ? `\nLIVE EVENT / PATCH INJECTION ACTIVE: "${counterfactualEvent}"\nFactor this live offer adjustment directly into your initial reaction.`
    : "";

  const prompt = `Proposed Marketing Offer:
Title: "${offerTitle}"
Price: $${priceUsd.toFixed(2)} USD
Franchise: ${franchise}${cfBlock}

Your Individual In-Game Telemetry:
- Gamer Tag: @${player.gamer_tag || def.gamer_tag} (Age: ${player.age ?? 24})
- Archetype: ${archetypeLabel(archetypeId)} (${archetypeDescription(archetypeId)})
- MyPLAYER Build: ${player.myplayer_ovr ?? def.ovr ?? 85} OVR ${player.myplayer_build ?? def.build ?? "Balanced Build"}
- 90-Day VC Spend: $${player.vc_spend_90d ?? def.vcSpend90d} USD · Current Wallet: ${(player.vc_balance ?? 15000).toLocaleString()} VC
- Season Pass Edition: ${player.season_pass_edition ?? "NONE"} (Tier ${player.season_pass_tier ?? 12})
- MyTEAM Galaxy Opal Cards Owned: ${player.myteam_galaxy_opal_count ?? 0}
- Park Win Pct: ${((player.park_win_pct ?? 0.5) * 100).toFixed(0)}% · Current Loss Streak: ${player.loss_streak ?? 0} · 7d Rage-Quits: ${player.rage_quits_7d ?? 0}
- Crew Affiliation: ${player.crew_name || "Bucket Getters"} (${player.crew_tier || "Rec"} · Role: ${player.crew_role || "MEMBER"})
- Followed 2K Creator: ${player.creator_handle || "@Agent00"}
- NBA 2K26 Veteran Account: ${player.rockstar_linked ? "YES" : "NO"} (NBA 2K26 Spend: $${player.gta_online_spend_usd ?? 0}, Migrated to 2K27 HoF: ${player.gta6_preorder ? "YES" : "NO"})
- Favorite NBA Team: ${player.favorite_team ?? "Los Angeles Lakers"}
- Your Voice & Length Contract: ${voiceProfile.wordCountRange} (${voiceProfile.sentenceTarget}) · ${voiceProfile.personalHook}

How do you react to this offer at $${priceUsd.toFixed(2)} in Round 1 (before seeing your Crew or Creator streams)? Return strict JSON.`;

  return { system, prompt, voiceProfile };
}

const CREATOR_PERSONA_SIGNATURES: Record<string, string> = {
  "@agent00": "High-energy Twitch/YouTube Park & Crew boss; talks about whether an offer is a W or L for the squad in The City.",
  "@chrissmoove": "Iconic OG MyCAREER commentator ('Splash!', 'Give that guy a manual'); evaluates whether VC value is fair or a noob trap.",
  "@troydan": "Chaotic, high-roller MyTEAM pack-opening entertainer; obsesses over Galaxy Opal pull rates and box toppers.",
  "@dbg": "Blunt Build Lab & MyTEAM meta analyst; breaks down badge thresholds and calls out overpriced packs immediately.",
  "@kot4q": "Smart, analytical NBA & MyNBA rebuild creator; focuses on roster value, 2K26-to-2K27 loyalty progression, and practical hoop value.",
  "@cashnasty": "Passionate, loud Park & MyTEAM reactor; hypes up big wagers and guaranteed Opal heat or roasts bad odds.",
  "@dukedennis": "Smooth, high-status Park stream icon; only cares if the bundle gets the build right or keeps the streak alive.",
  "@flightreacts": "Over-the-top emotional Park reactor ('Look at Curry man'); wild reactions to VC prices and Park sweats.",
  "@badgeplug": "Fast-paced Build & City news plug; focuses on cap breaker speed, secret badge glitches, and time saved.",
  "@uncledemi": "Creative replica-build specialist; evaluates how fast the VC bundle gets a unique catfish build to 85+ OVR.",
  "@nba2klab": "Data-driven millisecond frame & green-window testing lab; cites exact % make-rate boosts and VC-per-attribute math.",
  "@nba2ktutes": "Methodical attribute threshold & cap-breaker mathematician; calculates exact VC ROI per badge tier.",
  "@joeknows": "Comp Pro-Am & Rec 5-stack point guard; evaluates offers on whether they help a full 5-man squad win in Pro-Am.",
  "@tydebo": "2x $250K MyTEAM Champion & comp build grinder; ruthless about competitive meta value vs wasted VC.",
  "@powerdf": "DigitalFoundry leader & Park rep veteran; focuses on 2x Rep multipliers and affiliation event dominance.",
  "@grindingdf": "Non-stop Rep grinder & dribble tutorial creator; cares about hitting Veteran/Legend Rep faster.",
  "@swante": "Comp Stage guard & blunt community voice; zero filter on VC prices and sweat meta.",
  "@nadexe": "High-energy Park streak entertainer; cares about fun squad runs and City event rewards.",
  "@coletheman": "City drip & Park challenge creator; looks at cosmetic + VC combo value.",
  "@doubleh": "Custom jumpshot & iso Park specialist; focuses on shooting attributes and badge progression.",
  "@ipodkingcarter": "Respected OG MyCAREER storyteller; cares about career immersion and fair progression.",
  "@htb": "MyTEAM Galaxy Opal gameplay showcase creator; tests whether new cards actually play elite on court.",
  "@bio2k": "No-Money-Spent & smart-spend MyTEAM guide creator; scrutinizes budget vs whale value.",
  "@jc2k": "Comp MyTEAM Unlimited tactician; evaluates lineups and guaranteed card tiers.",
  "@killzamoi": "Daily MyTEAM pack & market analyst; tracks Player Market vs pack odds.",
  "@afunkydiabetic": "Realistic MyNBA simulation veteran; skeptical of VC fluff, respects real basketball depth.",
  "@sixringsofsteel": "MyNBA Eras & rebuild experimenter; values deep franchise and cross-era content.",
  "@quitalovessports": "Dedicated WNBA & The W voice; champions authentic WNBA career progression and squad play.",
  "@lakerfan": "Comp Pro-Am slasher & small-ball big tactician; focuses on squad spacing and badge utility.",
  "@callmeagent": "Competitive Pro-Am & Rec strategist; evaluates 5-stack team value.",
  "@assemble": "WWE 2K25 MyFACTION & Universe insider; compares 2K Sports season pass value.",
  "@bde": "WWE 2K25 superstar creator; high-energy reactions to Ringside Pass and MyFACTION packs.",
  "@smacktalks": "Veteran WWE 2K breakdown specialist; detailed analysis of DLC and patch value.",
  "@gamerability": "PGA TOUR 2K25 Clubhouse Pass & master swing analyst.",
  "@moxsy": "Borderlands 4 endgame build theorycrafter; min-maxes Vault Hunter DLC value.",
  "@joltzdude139": "Borderlands 4 legendary farming veteran; evaluates DLC loot density.",
  "@ki11ersix": "Borderlands 4 community mainstay; honest takes on bounty pack value.",
  "@potatomcwhiskey": "Civilization VII Deity strategist; deep analytical takes on expansion value.",
};

/**
 * Builds the prompt for the 6 flagship 2K Creator Megaphone broadcasts grounded in
 * `TakeTwoPlayerGraph` (`FOLLOWS_CREATOR` edges) reacting to the proposed offer.
 */
export function buildCreatorBroadcastPrompt(
  offerTitle: string,
  priceUsd: number,
  franchise: string,
  r1BuyCount: number,
  r1BoycottCount: number,
  counterfactualEvent?: string | null,
  liveCreators?: Array<{
    creator_id: string;
    handle: string;
    name: string;
    platform: string;
    followers: number;
    signature_mode?: string;
  }>
): { system: string; prompt: string } {
  const creators =
    liveCreators && liveCreators.length >= 3
      ? liveCreators.slice(0, 6)
      : [
          {
            creator_id: "creator-agent00",
            handle: "@Agent00",
            name: "Agent 00",
            platform: "Twitch & YouTube",
            followers: 2600000,
            signature_mode: "Park comedy & 2v2s",
          },
          {
            creator_id: "creator-chrissmoove",
            handle: "@ChrisSmoove",
            name: "Chris Smoove",
            platform: "YouTube",
            followers: 5600000,
            signature_mode: "MyCAREER series",
          },
          {
            creator_id: "creator-troydan",
            handle: "@Troydan",
            name: "Troydan",
            platform: "YouTube",
            followers: 3100000,
            signature_mode: "MyTEAM pack openings",
          },
          {
            creator_id: "creator-badgeplug",
            handle: "@BadgePlug",
            name: "BadgePlug",
            platform: "YouTube",
            followers: 2250000,
            signature_mode: "Meta builds, badge glitches & City news",
          },
          {
            creator_id: "creator-kot4q",
            handle: "@KOT4Q",
            name: "Kenny Beecham",
            platform: "YouTube",
            followers: 2400000,
            signature_mode: "MyNBA rebuilds & 2K26->2K27 deep dives",
          },
          {
            creator_id: "creator-2klab",
            handle: "@NBA2KLab",
            name: "NBA 2KLab",
            platform: "YouTube",
            followers: 1150000,
            signature_mode: "Green window & badge frame telemetry",
          },
        ];

  const system = `You simulate live stream and YouTube reactions from ${creators.length} real NBA 2K & 2K catalog creators (${creators
    .map((c) => c.handle)
    .join(", ")}) queried from TakeTwoPlayerGraph reacting to a new in-game 2K offer.
CRITICAL VOICE VARIETY RULE:
- Every creator must sound unmistakably like their real-world channel persona and vary in headline length!
- Some creators (like @FlightReacts, @Troydan, @DukeDennis, @Swante) drop short, punchy 6-to-10 word stream reactions.
- Analytical creators (like @NBA2KLab, @DBG, @KOT4Q, @BadgePlug, @NBA2KTutes) drop specific 14-to-22 word breakdowns citing VC math, green windows, Cap Breakers, or squad value.
- Never use em-dashes.`;

  const prompt = `Offer under live stream review:
Title: "${offerTitle}"
Price: $${priceUsd.toFixed(2)} USD
Franchise: ${franchise}
Round 1 Community Pulse: ${r1BuyCount}/20 buying, ${r1BoycottCount}/20 boycotting.
${counterfactualEvent ? `Live Event / Patch Injection: "${counterfactualEvent}"` : "No counterfactual bonus active."}

Generate strict JSON for these ${creators.length} Spanner Graph creators, adhering to each creator's real-world voice signature:
${creators
  .map((c, idx) => {
    const sig =
      CREATOR_PERSONA_SIGNATURES[c.handle.toLowerCase()] ||
      c.signature_mode ||
      "2K community creator";
    return `${idx + 1}. ${c.creator_id} (${c.handle} · ${c.name} · ${c.platform} · ${c.followers.toLocaleString()} reach) — Style: ${sig}`;
  })
  .join("\n")}

Output strict JSON:
{
  "broadcasts": [
${creators
  .map(
    (c) => `    {
      "creator_id": "${c.creator_id}",
      "handle": "${c.handle}",
      "name": "${c.name}",
      "platform": "${c.platform}",
      "stance": "ENDORSE" | "MIXED" | "CALLOUT",
      "headline": "<authentic creator stream quote/title matching their distinct length & channel voice>",
      "influence_reach": ${c.followers}
    }`
  )
  .join(",\n")}
  ]
}`;

  return { system, prompt };
}

/**
 * Builds the Round 2 Dual-Platform Social Contagion prompt where the 20 Core Personas see:
 * 1. Their exact Crew Captain's Round 1 verdict and verbatim quote (`MEMBER_OF_CLAN` edge)
 * 2. Their followed 2K Creator's live stream broadcast (`FOLLOWS_CREATOR` edge)
 * 3. Live community threads across `r/NBA2K`, `r/MyTEAM`, `r/NBA2kTeamUp`, `r/WWEGames`, etc.
 * 4. Their own strict individual Voice & Length Profile (`voice_directive`)
 */
export function buildContagionRound2Prompt(
  personasWithR1: Array<{
    index: number;
    player_id: string;
    gamer_tag: string;
    archetype: string;
    myplayer_ovr: number;
    vc_spend_90d: number;
    crew_name: string;
    crew_tier: string;
    crew_role: string;
    creator_handle: string;
    round1_state: string;
    round1_wtp: number;
    round1_quote: string;
    peer_captain_tag?: string;
    peer_captain_r1_state?: string;
    peer_captain_r1_quote?: string;
    followed_creator_broadcast?: {
      handle: string;
      stance: string;
      headline: string;
    };
    voice_cadence_tier?: string;
    voice_word_range?: string;
    voice_directive?: string;
  }>,
  offerTitle: string,
  priceUsd: number,
  franchise: string,
  creatorBroadcasts: Array<{ handle: string; stance: string; headline: string }>,
  crewCaptainActionSummary: string,
  counterfactualEvent?: string | null,
  redditThreads?: Array<{
    subreddit: string;
    title: string;
    sentiment: string;
    score: number;
    snippet: string;
  }>
): { system: string; prompt: string } {
  const system = `You are the 2K Courtside Dual-Platform Social Contagion Engine modeling Round 2 peer, creator, and Reddit community influence across TakeTwoPlayerGraph edges (MEMBER_OF_CLAN and FOLLOWS_CREATOR) and live Reddit threads (r/NBA2K, r/MyTEAM, r/NBA2kTeamUp, r/WWEGames, r/pga2k, r/Borderlands).
In NBA 2K, players react to three distinct social channels between Round 1 and Round 2:
1. CREW_CAPTAIN (MEMBER_OF_CLAN peer edge): Each persona sees their own Crew Captain's exact Round 1 state and verbatim quote (peer_captain_tag, peer_captain_r1_state, peer_captain_r1_quote). If their Captain locked in PURCHASED (or rallied the 5-stack Rec/Pro-Am roster), hesitant EVALUATING or ABANDONED squadmates feel FOMO ("can't leave my 5-stack behind") and organically flip to PURCHASED. Conversely, if their Captain boycotted, wavering squadmates may hold back.
2. CREATOR_STREAM (FOLLOWS_CREATOR edge): Each persona watches their followed 2K Creator's stream broadcast (followed_creator_broadcast). Strong ENDORSE or CALLOUT headlines sway followers whose archetype aligns with that creator.
3. REDDIT_THREAD (Multi-Subreddit Community Pulse): High-upvote Reddit threads on r/NBA2K, r/MyTEAM, r/NBA2kTeamUp, or r/WWEGames exposing pack odds, VC value math, 5-stack Rec recruitment, or celebrating loyalty upgrade value can push theorycrafters, tilt-risk players, and casuals into BOYCOTT, EVALUATING, or PURCHASED.
4. COUNTERFACTUAL: If a live event / patch sweetener is active, players whose specific friction point is solved flip organically.

CRITICAL INDIVIDUAL VOICE & LENGTH VARIATION RULE:
- Do NOT make every persona's verbatim_quote the same length or sentence structure!
- Each persona in the input JSON includes a "voice_word_range" and "voice_directive". You MUST obey that specific player's word-count target and cadence:
  * "ULTRA_CLIPPED" players (e.g. Rage-Quit Tilt Risk, Mobile Ritualists, sweaty Park Grinders) MUST write a blunt, clipped 4-to-10 word reaction (e.g., "Cap locked in so im swiping too." or "r/NBA2K exposed the odds, still a hard pass.").
  * "CASUAL_ONE_LINER" players write 1 natural 10-to-16 word sentence.
  * "SQUAD_VOICE_MEDIUM" / "WHALE_FLEX_DIRECT" players write 15-to-26 words in their distinct locker-room or high-roller voice.
  * "DEEP_ANALYST_BREAKDOWN" players (Build Lab Theorycrafters & MyNBA Sim GMs) MUST write 28-to-46 words across 2-3 analytical sentences citing exact VC math, badge thresholds, creator data, or Reddit thread details!
- Never use em-dashes.`;

  const redditSection =
    redditThreads && redditThreads.length > 0
      ? redditThreads
          .map(
            (t, idx) =>
              `${idx + 1}. [${t.subreddit} · ${t.sentiment} · ▲${t.score}] "${t.title}" — ${t.snippet}`
          )
          .join("\n")
      : "No live Reddit threads active.";

  const prompt = `Offer: "${offerTitle}" at $${priceUsd.toFixed(2)} (${franchise})
${counterfactualEvent ? `ACTIVE COUNTERFACTUAL INJECTION: "${counterfactualEvent}"` : "Counterfactual Injection: None (Baseline)"}

World 1 — Live Creator Stream Megaphone Broadcasts (FOLLOWS_CREATOR):
${creatorBroadcasts.map((c) => `- ${c.handle} [${c.stance}]: "${c.headline}"`).join("\n")}

World 2 — Live Multi-Subreddit Community Pulse (r/NBA2K, r/MyTEAM, r/NBA2kTeamUp, r/WWEGames):
${redditSection}

Crew Captain & Squad Signal Summary (MEMBER_OF_CLAN):
${crewCaptainActionSummary}

Here are the Core Personas with their Round 1 isolated verdicts, their 1-hop Crew Captain R1 quote, their Followed Creator stream, AND their mandatory individual Voice & Length Contract (voice_word_range / voice_directive):
${JSON.stringify(personasWithR1, null, 2)}

Simulate Round 2 (Dual-Platform Social Contagion Pass) for all ${personasWithR1.length} personas:
- Determine organically which personas flip their state from round1_state based on their peer_captain_r1_quote, followed_creator_broadcast, live Reddit threads, or counterfactual event.
- Set "contagion_flipped": true ONLY if final_fsm_state changed from round1_state.
- Set "contagion_driver" to "CREW_CAPTAIN", "CREATOR_STREAM", "REDDIT_THREAD", "COUNTERFACTUAL", or "NONE" (use "NONE" if contagion_flipped is false).
- Set "contagion_source_tag" to the exact handle or subreddit that drove the flip (e.g. "@DimeDropper_HQ", "@Agent00", "@BadgePlug", "r/NBA2K", "r/MyTEAM", "r/NBA2kTeamUp", or "" if not flipped).
- Set "contagion_source_snippet" to a short verbatim snippet (max 12 words) of the Captain quote, Creator headline, or Reddit thread that caused the flip (or "" if not flipped).
- STRICTLY OBEY each persona's "voice_word_range" and "voice_directive" so short-burst players stay 4-10 words and analytical players write 28-46 words!

Return strict JSON:
{
  "round2": [
    {
      "index": 0,
      "final_fsm_state": "PURCHASED" | "ENGAGED_FREE" | "EVALUATING" | "ABANDONED" | "BOYCOTT",
      "willingness_to_pay_usd": <number>,
      "verbatim_quote": "<in-character reaction strictly obeying this individual's voice_word_range and referencing @Captain, @Creator, or subreddit if flipped>",
      "sentiment_score": <number -1.0 to 1.0>,
      "contagion_flipped": <boolean>,
      "contagion_driver": "CREW_CAPTAIN" | "CREATOR_STREAM" | "REDDIT_THREAD" | "COUNTERFACTUAL" | "NONE",
      "contagion_source_tag": "<string>",
      "contagion_source_snippet": "<string>"
    }
  ]
}`;

  return { system, prompt };
}

/**
 * Builds the fast micro-batch prompt for 20 Crowd Swarm Agents (`gemini-3.5-flash-lite`)
 * to scale the Focus Group from N=20 to N=100 Swarm Scale with dual-platform contagion and verbatim quotes.
 */
export function buildCrowdSwarmBatchPrompt(
  batchPlayers: Array<{
    player_id: string;
    gamer_tag: string;
    archetype: string;
    myplayer_ovr: number;
    vc_spend_90d: number;
    crew_name: string;
    creator_handle: string;
  }>,
  offerTitle: string,
  priceUsd: number,
  franchise: string,
  creatorStanceSummary: string,
  counterfactualEvent?: string | null,
  redditSummary?: string
): { system: string; prompt: string } {
  const system = `You evaluate a batch of 20 live NBA 2K / 2K catalog players from TakeTwoPlayerGraph for both Round 1 (isolated) and Round 2 (after Crew Captain, Creator stream, and r/NBA2K / r/MyTEAM / r/NBA2kTeamUp Reddit thread contagion). Output compact, strict JSON.`;

  const prompt = `Offer: "${offerTitle}" at $${priceUsd.toFixed(2)} (${franchise})
Creator & Crew Contagion Context: ${creatorStanceSummary}
${redditSummary ? `Live Reddit Pulse (r/NBA2K, r/MyTEAM, r/NBA2kTeamUp): ${redditSummary}` : ""}
${counterfactualEvent ? `Active Counterfactual Event: "${counterfactualEvent}"` : ""}

Players (${batchPlayers.length}):
${JSON.stringify(batchPlayers)}

For each player in the exact same order, return their Round 1 state, Round 2 final_fsm_state, WTP, whether Crew/Creator/Reddit/Counterfactual contagion flipped them, and source tag:
{
  "agents": [
    {
      "player_id": "<string>",
      "round1_state": "PURCHASED" | "ENGAGED_FREE" | "EVALUATING" | "ABANDONED" | "BOYCOTT",
      "final_fsm_state": "PURCHASED" | "ENGAGED_FREE" | "EVALUATING" | "ABANDONED" | "BOYCOTT",
      "willingness_to_pay_usd": <number>,
      "contagion_flipped": <boolean>,
      "contagion_driver": "CREW_CAPTAIN" | "CREATOR_STREAM" | "REDDIT_THREAD" | "COUNTERFACTUAL" | "NONE",
      "contagion_source_tag": "<e.g. @Agent00, @BadgePlug, r/NBA2K, r/NBA2kTeamUp, or Crew Captain>"
    }
  ]
}`;

  return { system, prompt };
}

/**
 * Builds the God's-Eye Round 3 Counterfactual Shock prompt for the 20 Core Personas (`MODELS.FAST`).
 * Evaluates how a mid-simulation What-If intervention rescues EVALUATING / ABANDONED / BOYCOTT personas
 * without wiping Round 1 or Round 2 history, while preserving each individual's voice & length contract.
 */
export function buildRound3CounterfactualCorePrompt(
  r2Personas: Array<{
    index: number;
    player_id: string;
    gamer_tag: string;
    archetype: string;
    crew_name: string;
    creator_handle: string;
    round1_state: string;
    round2_state: string;
    round2_wtp: number;
    round2_quote: string;
    voice_word_range?: string;
    voice_directive?: string;
  }>,
  offerTitle: string,
  priceUsd: number,
  franchise: string,
  counterfactualEvent: string
): { system: string; prompt: string } {
  const system = `You are the 2K Courtside God's-Eye Counterfactual Branching Engine (Round 3 · What-If Rescue Wave).
Round 1 (Isolated) and Round 2 (Social Contagion) have already completed.
Now the live service team injects a mid-simulation offer intervention / patch sweetener into the environment.
Evaluate how each of the Core Personas reacts in Round 3 to this specific What-If intervention:
- Personas who were EVALUATING, ABANDONED, or BOYCOTT in Round 2 and whose core objection (VC value, squad bonus, pack odds guarantee, creator co-stream, or 2K26 Rebirth carryover) is directly addressed by the intervention should organically flip to PURCHASED (or move up to EVALUATING) and increase their willingness_to_pay_usd.
- Personas who already PURCHASED in Round 2 remain PURCHASED (and may increase their WTP or enthusiasm).
- Personas whose core identity still rejects the offer format (e.g. strict MyNBA sim purists on a MyTEAM pack) remain authentic to their archetype.
- CRITICAL VOICE VARIETY RULE: Strictly obey each persona's "voice_word_range" and "voice_directive" so clipped players react in 4-10 words and analytical theorycrafters/GMs write 28-45 words! Zero em-dashes.`;

  const prompt = `Base Offer: "${offerTitle}" at $${priceUsd.toFixed(2)} (${franchise})
MID-SIMULATION GOD'S-EYE WHAT-IF SHOCK (ROUND 3):
"${counterfactualEvent}"

Here are the Core Personas, their completed Round 1 -> Round 2 states, and their individual voice_word_range / voice_directive:
${JSON.stringify(r2Personas, null, 2)}

Evaluate Round 3 for all ${r2Personas.length} personas. Set "round3_flipped": true if round3_fsm_state differs from round2_state.
Return strict JSON:
{
  "round3": [
    {
      "index": 0,
      "round3_fsm_state": "PURCHASED" | "ENGAGED_FREE" | "EVALUATING" | "ABANDONED" | "BOYCOTT",
      "round3_wtp_usd": <number>,
      "round3_quote": "<in-character reaction strictly matching this individual's voice_word_range>",
      "round3_flipped": <boolean>,
      "sentiment_score": <number -1.0 to 1.0>
    }
  ]
}`;

  return { system, prompt };
}

/**
 * Builds the God's-Eye Round 3 Counterfactual Shock micro-batch prompt for Crowd Swarm Agents (`MODELS.LITE`).
 */
export function buildRound3CounterfactualCrowdPrompt(
  crowdBatch: Array<{
    player_id: string;
    gamer_tag: string;
    archetype: string;
    crew_name: string;
    round2_state: string;
    round2_wtp: number;
  }>,
  offerTitle: string,
  priceUsd: number,
  franchise: string,
  counterfactualEvent: string
): { system: string; prompt: string } {
  const system = `You evaluate how a batch of live NBA 2K crowd swarm agents shifts from Round 2 into Round 3 after a mid-simulation What-If offer sweetener is injected. Output strict JSON.`;

  const prompt = `Base Offer: "${offerTitle}" at $${priceUsd.toFixed(2)} (${franchise})
ROUND 3 WHAT-IF INTERVENTION: "${counterfactualEvent}"

Crowd Batch (${crowdBatch.length} agents):
${JSON.stringify(crowdBatch)}

For each agent in the exact same order, return their Round 3 state, updated WTP, and whether they flipped from round2_state:
{
  "agents": [
    {
      "player_id": "<string>",
      "round3_state": "PURCHASED" | "ENGAGED_FREE" | "EVALUATING" | "ABANDONED" | "BOYCOTT",
      "willingness_to_pay_usd": <number>,
      "round3_flipped": <boolean>
    }
  ]
}`;

  return { system, prompt };
}

// ---------------------------------------------------------------------------
// v2 Section D · Concept Test additions (ADDITIVE ONLY).
// Nothing above this line changes behavior. These helpers let the 3-arm
// Concept Test (NBA vs. WNBA vs. College) give college-hoops-leaning players a
// distinct voice, driven by the live `college_hoops_affinity` column in
// `twok_graph_db_v2`. When the column is absent (v1 DB) the overlay is simply
// not applied; no affinity is ever invented.
// ---------------------------------------------------------------------------

export interface ConceptAffinitySignals {
  gamer_tag?: string | null;
  archetype?: string | null;
  age?: number | null;
  college_hoops_affinity?: number | null;
  wnba_affinity?: number | null;
  franchise_mode_affinity?: number | null;
}

/** Live affinity (0–1) at or above which a player is treated as college-hoops-leaning. */
export const COLLEGE_HOOPS_AFFINITY_THRESHOLD = 0.6;

/**
 * Voice lens for college-hoops-leaning players: younger casuals and March
 * Madness fans who care about school pride, brackets and the road to the
 * draft more than VC economics.
 */
export const COLLEGE_HOOPS_FAN_LENS = `You are a college hoops fan first. You fill out a March Madness bracket with friends every year, you remember the upsets and buzzer-beaters, and you follow your school and a couple of top recruits. In NBA 2K you play casually: quick MyCAREER sessions, a few games with friends, not a VC grinder.
You get excited about campus atmospheres, student sections, rivalry games, recruiting and the road from freshman year to the NBA Draft. You judge new modes by whether they feel like real college basketball (bracket chaos, school identity, the draft-night payoff), not by pack odds.`;

function finiteAffinity(v: unknown): number | null {
  const n = typeof v === "number" ? v : v === null || v === undefined ? NaN : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** True only when the live `college_hoops_affinity` column is present and high. */
export function isCollegeHoopsLeaning(p: ConceptAffinitySignals): boolean {
  const a = finiteAffinity(p.college_hoops_affinity);
  return a !== null && a >= COLLEGE_HOOPS_AFFINITY_THRESHOLD;
}

/**
 * College-hoops voice overlay appended to a persona's system prompt, or `null`
 * when the player is not college-leaning (or the affinity column is absent).
 * Younger fans get Gen-Z bracket-chat energy; older fans sound like alumni.
 */
export function buildCollegeHoopsVoiceOverlay(p: ConceptAffinitySignals): string | null {
  if (!isCollegeHoopsLeaning(p)) return null;
  const age = finiteAffinity(p.age);
  const ageTone =
    age !== null && age <= 22
      ? "Sound like a younger fan in a group chat during the tournament (casual, hyped, a little chaotic)."
      : age !== null && age >= 30
        ? "Sound like an alum who has followed college hoops for years (warm, nostalgic, specific about past tournaments)."
        : "Sound like a regular college hoops fan talking with friends.";
  return `${COLLEGE_HOOPS_FAN_LENS}
${ageTone} Your live college hoops affinity is ${Number(p.college_hoops_affinity).toFixed(2)} (0 to 1). Let that pull you toward college basketball content without forgetting what you already play in NBA 2K.`;
}

/**
 * One-line summary of the live concept affinities (only the ones present),
 * used as grounding in concept-test prompts. Returns "" when none are present.
 */
export function describeConceptAffinities(p: ConceptAffinitySignals): string {
  const parts: string[] = [];
  const w = finiteAffinity(p.wnba_affinity);
  const c = finiteAffinity(p.college_hoops_affinity);
  const f = finiteAffinity(p.franchise_mode_affinity);
  if (w !== null) parts.push(`WNBA affinity ${w.toFixed(2)}`);
  if (c !== null) parts.push(`college hoops affinity ${c.toFixed(2)}`);
  if (f !== null) parts.push(`franchise-mode affinity ${f.toFixed(2)}`);
  return parts.length ? `${parts.join(" · ")} (0 to 1, from your 2K play history)` : "";
}

/**
 * Guard for concept copy that names real athletes (e.g. Caitlin Clark in The W
 * franchise concept): personas react as themselves and never speak as the athlete.
 */
export const REAL_ATHLETE_VOICE_GUARD =
  "Real athletes named in concept copy (for example Caitlin Clark) are featured in the product only. You are NOT that athlete and never speak as them or in their first person. React as yourself, the player described above.";
