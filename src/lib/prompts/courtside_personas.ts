import { ArchetypeId, archetypeLabel, archetypeDescription } from "@/lib/archetypes";

/**
 * 2K Courtside · Persona Prompts & Synthetic Fallback Cohort.
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
You maxed your build to 99 OVR on launch weekend with 200,000 VC ($49.99), earned all Cap Breakers, and know every jumper animation timing and green window.
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
    systemPrompt: `You spend hours in the 2K27 Build Lab testing badge hit thresholds, wingspan min-maxing, and jump shot speed animations.
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
    systemPrompt: `You are a die-hard 2K catalog veteran: you logged 500+ hours in NBA 2K26 (99 OVR build) and also play WWE 2K25 MyFACTION, PGA TOUR 2K25, and Borderlands 4 with your unified 2K Account.
You are evaluating whether to fully migrate your squad from NBA 2K26 into NBA 2K27 Season 2 or buy cross-franchise 2K bundles.
You have disposable income across console platforms and spend on VC, MyTEAM packs, and 2K Season Passes.
You love 2K loyalty rewards: NBA 2K26 -> 2K27 Rebirth build jumpstarts, 100K VC Hall of Fame Loyalty Upgrades, Cap Breaker carryover bonuses, and 2K All-Star Pass bundles.`,
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
 * Deprecated fallback persona array emptied out so all evaluations run strictly
 * against live 2K Identity Graph telemetry (GEMINI.md Rule 1).
 */
export const SYNTHETIC_FALLBACK_PERSONAS: Array<any> = [];

/**
 * Builds the personalized prompt for an individual persona evaluating an offer (Round 1 Isolated Gut Reaction).
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
    crew_name?: string | null;
    crew_tier?: string | null;
    crew_role?: string | null;
    creator_handle?: string | null;
  },
  offerTitle: string,
  priceUsd: number,
  franchise: string = "NBA2K",
  counterfactualEvent?: string | null
): { system: string; prompt: string } {
  const archetypeId = (player.archetype as ArchetypeId) || "MYCAREER_STORY_CASUAL";
  const def = COURTSIDE_PERSONA_PROMPTS[archetypeId] || COURTSIDE_PERSONA_PROMPTS.MYCAREER_STORY_CASUAL;

  const system = `${def.systemPrompt}

You are evaluating a proposed commercial in-game offer for 2K Courtside (2K Games).
Your persona name is "${player.display_name || def.name}" (gamer tag: "${player.gamer_tag || def.gamer_tag}").
Franchise context: ${franchise}.

Respond in authentic gamer voice using authentic NBA 2K27, NBA 2K26, WWE 2K25, PGA TOUR 2K25, and Borderlands 4 terminology (VC, Cap Breakers, The City, Park, Rec, Pro-Am Crews, MyTEAM Galaxy Opal, Season Pass HoF, Rep tiers, Rebirth builds, 2K26 holdouts). Zero corporate buzzwords. Never reference outside franchises or competitor games.

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

  const cfBlock = counterfactualEvent
    ? `\nLIVE EVENT / PATCH INJECTION ACTIVE: "${counterfactualEvent}"\nFactor this live offer adjustment directly into your initial reaction.`
    : "";

  const prompt = `Proposed Marketing Offer:
Title: "${offerTitle}"
Price: $${priceUsd.toFixed(2)} USD
Franchise: ${franchise}${cfBlock}

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
- Crew Affiliation: ${player.crew_name || "Bucket Getters"} (${player.crew_tier || "Rec"} · ${player.crew_role || "MEMBER"})
- Followed 2K Creator: ${player.creator_handle || "@Agent00"}
- NBA 2K26 Veteran Account: ${player.rockstar_linked ? "YES" : "NO"} (NBA 2K26 Prior Spend: $${player.gta_online_spend_usd ?? 0}, Migrated to 2K27 HoF: ${player.gta6_preorder ? "YES" : "NO"})
- 2K Cross-Franchise Gravity Score: ${((player.gravity_score ?? 0.5) * 100).toFixed(0)}%
- Favorite NBA Team: ${player.favorite_team ?? "Los Angeles Lakers"}

How do you react to this offer at $${priceUsd.toFixed(2)} in Round 1 (before seeing your Crew or Creator streams)? Provide your verdict in strict JSON.`;

  return { system, prompt };
}

/**
 * Builds the prompt for the 3 flagship 2K Creator Megaphone broadcasts grounded in
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
  }>
): { system: string; prompt: string } {
  const creators =
    liveCreators && liveCreators.length >= 3
      ? liveCreators.slice(0, 3)
      : [
          {
            creator_id: "creator-agent00",
            handle: "@Agent00",
            name: "Agent 00",
            platform: "Twitch & YouTube",
            followers: 2600000,
          },
          {
            creator_id: "creator-chrissmoove",
            handle: "@ChrisSmoove",
            name: "Chris Smoove",
            platform: "YouTube",
            followers: 3100000,
          },
          {
            creator_id: "creator-kot4q",
            handle: "@KOT4Q",
            name: "Kenny Beecham",
            platform: "YouTube",
            followers: 1850000,
          },
        ];

  const system = `You simulate live stream and YouTube reactions from top NBA 2K & 2K catalog creators (${creators
    .map((c) => c.handle)
    .join(", ")}) queried from TakeTwoPlayerGraph reacting to a new in-game 2K offer.
Keep every headline punchy (max 14 words), authentic to 2K community culture (Park, Rec, MyTEAM pack odds, Cap Breakers, 2K26 to 2K27 upgrade value), and free of em-dashes.`;

  const prompt = `Offer under live stream review:
Title: "${offerTitle}"
Price: $${priceUsd.toFixed(2)} USD
Franchise: ${franchise}
Round 1 Community Pulse: ${r1BuyCount}/20 buying, ${r1BoycottCount}/20 boycotting.
${counterfactualEvent ? `Live Event / Patch Injection: "${counterfactualEvent}"` : "No counterfactual bonus active."}

Generate strict JSON for these 3 Spanner Graph creators:
${creators
  .map(
    (c, idx) =>
      `${idx + 1}. ${c.creator_id} (${c.handle} · ${c.name} · ${c.platform} · ${c.followers.toLocaleString()} reach)`
  )
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
      "headline": "<max 14 words authentic stream reaction>",
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
 * 3. Live community threads on `r/NBA2K` / `r/MyTEAM` (`REDDIT_THREAD` dual-platform interplay)
 * 4. Any active Counterfactual Injection
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
  const system = `You are the 2K Courtside Dual-Platform Social Contagion Engine modeling Round 2 peer, creator, and Reddit community influence across TakeTwoPlayerGraph edges (MEMBER_OF_CLAN and FOLLOWS_CREATOR) and live r/NBA2K & r/MyTEAM threads.
In NBA 2K, players react to three distinct social channels between Round 1 and Round 2:
1. CREW_CAPTAIN (MEMBER_OF_CLAN peer edge): Each persona sees their own Crew Captain's exact Round 1 state and verbatim quote (peer_captain_tag, peer_captain_r1_state, peer_captain_r1_quote). If their Captain locked in PURCHASED (or rallied the 5-stack Rec/Pro-Am roster), hesitant EVALUATING or ABANDONED squadmates feel FOMO ("can't leave my 5-stack behind") and organically flip to PURCHASED. Conversely, if their Captain boycotted, wavering squadmates may hold back.
2. CREATOR_STREAM (FOLLOWS_CREATOR edge): Each persona watches their followed 2K Creator's stream broadcast (followed_creator_broadcast). Strong ENDORSE or CALLOUT headlines sway followers whose archetype aligns with that creator.
3. REDDIT_THREAD (r/NBA2K & r/MyTEAM Topic Community): High-upvote Reddit threads exposing pack odds, VC value math, or celebrating loyalty upgrade value can push theorycrafters, tilt-risk players, and casuals into BOYCOTT, EVALUATING, or PURCHASED.
4. COUNTERFACTUAL: If a live event / patch sweetener is active, players whose specific friction point is solved flip organically.

Evaluate each of the 20 personas organically based on their archetype, telemetry, Round 1 state, and specific social graph inputs. Do NOT force a fixed quota of flips.
Keep quotes concise (1 sentence, max 18 words, zero em-dashes) and explicitly reference their Crew Captain (@tag), Creator handle (@handle), or Reddit thread (r/NBA2K or r/MyTEAM) when a persona flips!`;

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

World 2 — Live Reddit Community Pulse (r/NBA2K & r/MyTEAM):
${redditSection}

Crew Captain & Squad Signal Summary (MEMBER_OF_CLAN):
${crewCaptainActionSummary}

Here are the 20 Core Personas with their Round 1 isolated verdicts AND their exact 1-hop Crew Captain R1 quote & Followed Creator stream:
${JSON.stringify(personasWithR1, null, 2)}

Simulate Round 2 (Dual-Platform Social Contagion Pass) for all 20 personas:
- Determine organically which personas flip their state from round1_state based on their peer_captain_r1_quote, followed_creator_broadcast, live Reddit threads, or counterfactual event.
- Set "contagion_flipped": true ONLY if final_fsm_state changed from round1_state.
- Set "contagion_driver" to "CREW_CAPTAIN", "CREATOR_STREAM", "REDDIT_THREAD", "COUNTERFACTUAL", or "NONE" (use "NONE" if contagion_flipped is false).
- Set "contagion_source_tag" to the exact handle or subreddit that drove the flip (e.g. "@DimeDropper_HQ", "@Agent00", "r/NBA2K", "r/MyTEAM", or "" if not flipped).
- Set "contagion_source_snippet" to a short verbatim snippet (max 12 words) of the Captain quote, Creator headline, or Reddit thread that caused the flip (or "" if not flipped).

Return strict JSON:
{
  "round2": [
    {
      "index": 0,
      "final_fsm_state": "PURCHASED" | "ENGAGED_FREE" | "EVALUATING" | "ABANDONED" | "BOYCOTT",
      "willingness_to_pay_usd": <number>,
      "verbatim_quote": "<1 concise sentence referencing @Captain, @Creator, or r/NBA2K if flipped>",
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
  const system = `You evaluate a batch of 20 live NBA 2K / 2K catalog players from TakeTwoPlayerGraph for both Round 1 (isolated) and Round 2 (after Crew Captain, Creator stream, and r/NBA2K Reddit thread contagion). Output compact, strict JSON.`;

  const prompt = `Offer: "${offerTitle}" at $${priceUsd.toFixed(2)} (${franchise})
Creator & Crew Contagion Context: ${creatorStanceSummary}
${redditSummary ? `Live Reddit Pulse (r/NBA2K & r/MyTEAM): ${redditSummary}` : ""}
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
      "contagion_source_tag": "<e.g. @Agent00, r/NBA2K, or Crew Captain>"
    }
  ]
}`;

  return { system, prompt };
}

/**
 * Builds the God's-Eye Round 3 Counterfactual Shock prompt for the 20 Core Personas (`MODELS.FAST`).
 * Evaluates how a mid-simulation What-If intervention rescues EVALUATING / ABANDONED / BOYCOTT personas
 * without wiping Round 1 or Round 2 history.
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
  }>,
  offerTitle: string,
  priceUsd: number,
  franchise: string,
  counterfactualEvent: string
): { system: string; prompt: string } {
  const system = `You are the 2K Courtside God's-Eye Counterfactual Branching Engine (Round 3 · What-If Rescue Wave).
Round 1 (Isolated) and Round 2 (Social Contagion) have already completed.
Now the live service team injects a mid-simulation offer intervention / patch sweetener into the environment.
Evaluate how each of the 20 Core Personas reacts in Round 3 to this specific What-If intervention:
- Personas who were EVALUATING, ABANDONED, or BOYCOTT in Round 2 and whose core objection (VC value, squad bonus, pack odds guarantee, creator co-stream, or 2K26 Rebirth carryover) is directly addressed by the intervention should organically flip to PURCHASED (or move up to EVALUATING) and increase their willingness_to_pay_usd.
- Personas who already PURCHASED in Round 2 remain PURCHASED (and may increase their WTP or enthusiasm).
- Personas whose core identity still rejects the offer format (e.g. strict MyNBA sim purists on a MyTEAM pack) remain authentic to their archetype.
Keep every round3_quote concise (1 sentence, max 16 words, zero em-dashes) directly reacting to the What-If sweetener!`;

  const prompt = `Base Offer: "${offerTitle}" at $${priceUsd.toFixed(2)} (${franchise})
MID-SIMULATION GOD'S-EYE WHAT-IF SHOCK (ROUND 3):
"${counterfactualEvent}"

Here are the 20 Core Personas and their completed Round 1 -> Round 2 states and quotes:
${JSON.stringify(r2Personas, null, 2)}

Evaluate Round 3 for all 20 personas. Set "round3_flipped": true if round3_fsm_state differs from round2_state.
Return strict JSON:
{
  "round3": [
    {
      "index": 0,
      "round3_fsm_state": "PURCHASED" | "ENGAGED_FREE" | "EVALUATING" | "ABANDONED" | "BOYCOTT",
      "round3_wtp_usd": <number>,
      "round3_quote": "<1 concise in-character sentence reacting to the Round 3 What-If shock>",
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
