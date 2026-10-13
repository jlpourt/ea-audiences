import { generateText, parseModelJson } from "@/lib/gcp/genai-client";
import { runRawGql, parseJsonColumn, toNumber } from "@/lib/gcp/spanner-client";
import {
  buildPersonaPrompt,
  buildCreatorBroadcastPrompt,
  buildContagionRound2Prompt,
  buildCrowdSwarmBatchPrompt,
} from "@/lib/prompts/courtside_personas";
import {
  FocusGroupReaction,
  FocusGroupResult,
  CreatorBroadcast,
  SwarmCrowdAgent,
  MigrationCurvePoint,
  ContagionDriver,
} from "@/lib/types";

export interface ExtendedFocusGroupResult extends FocusGroupResult {
  backlash_index: number;
  wtp_curve: Array<{ price: number; conversion_pct: number }>;
  recommended_price: number;
  model_used: string;
  lite_model_used?: string;
  reasoning_model_used: string;
  latency_ms: number;
  swarm_size: number;
  counterfactual_event?: string | null;
  creator_broadcasts: CreatorBroadcast[];
  crowd_agents: SwarmCrowdAgent[];
  contagion_flips_count: number;
  crew_contagion_multiplier: number;
  contagion_summary: string;
  migration_curve: MigrationCurvePoint[];
  round1_tally: {
    purchased: number;
    evaluating: number;
    abandoned: number;
    boycott: number;
  };
  round2_tally: {
    purchased: number;
    evaluating: number;
    abandoned: number;
    boycott: number;
  };
  alt_result?: {
    price_usd: number;
    reactions: FocusGroupReaction[];
    consensus_summary: string;
    predicted_conversion_lift: number;
    backlash_index: number;
    projected_revenue_impact_usd: number;
    purchased_count: number;
    evaluating_count: number;
    abandoned_count: number;
    boycott_count: number;
  };
}

const CREATOR_HANDLE_MAP: Record<string, string> = {
  "creator-agent00": "@Agent00",
  "creator-troydan": "@Troydan",
  "creator-dbg": "@DBG",
  "creator-tydebo": "@Tydebo",
  "creator-joeknows": "@JoeKnows",
  "creator-flightreacts": "@FlightReacts",
  "creator-cashnasty": "@CashNasty",
  "creator-kot4q": "@KOT4Q",
  "creator-chrissmoove": "@ChrisSmoove",
  "creator-dukedennis": "@DukeDennis",
  "creator-badgeplug": "@BadgePlug",
  "creator-lakerfan": "@LakerFan",
};

const CREW_FALLBACK_NAMES = [
  { id: "crew-001", name: "Bucket Getters", tier: "Rec" },
  { id: "crew-003", name: "Dimers Only", tier: "Pro-Am" },
  { id: "crew-008", name: "Splash Bros Rec", tier: "Rec" },
  { id: "crew-010", name: "Lob City Legends", tier: "Pro-Am" },
  { id: "crew-014", name: "Fadeaway Family", tier: "Comp" },
];

export async function fetchLiveSpannerPersonas(
  limit = 20,
  _franchise = "NBA2K"
): Promise<any[]> {
  const safeLimit = Math.max(1, Math.min(120, Math.floor(limit)));
  const [rows, clanRows] = await Promise.all([
    runRawGql(
      `SELECT p.player_id, p.gamer_tag, p.primary_archetype, p.lifetime_spend_usd, p.churn_risk_score, p.tilt_sensitivity, p.recent_loss_streak, p.dma_market, p.followed_creators, p.primary_creator_influence, p.game_telemetry FROM GRAPH_TABLE(TakeTwoPlayerGraph MATCH (p:Player) RETURN p.player_id, p.gamer_tag, p.primary_archetype, p.lifetime_spend_usd, p.churn_risk_score, p.tilt_sensitivity, p.recent_loss_streak, p.dma_market, p.followed_creators, p.primary_creator_influence, p.game_telemetry) AS p LIMIT @limit`,
      { limit: safeLimit }
    ),
    runRawGql(
      `SELECT c.clan_id, c.name, c.tier FROM GRAPH_TABLE(TakeTwoPlayerGraph MATCH (c:Clan) RETURN c.clan_id, c.name, c.tier) AS c LIMIT 48`
    ),
  ]);

  const clanById = new Map<string, { name: string; tier: string }>();
  for (const c of clanRows) {
    if (c.clan_id) {
      clanById.set(String(c.clan_id), {
        name: String(c.name || "Bucket Getters"),
        tier: String(c.tier || "Rec"),
      });
    }
  }

  return rows.map((r, idx) => {
    const telemetry = parseJsonColumn(r.game_telemetry, {});
    const crewId = String(
      telemetry.crew_id || CREW_FALLBACK_NAMES[idx % CREW_FALLBACK_NAMES.length].id
    );
    const clanInfo =
      clanById.get(crewId) || CREW_FALLBACK_NAMES[idx % CREW_FALLBACK_NAMES.length];
    const primaryCreatorId = String(
      r.primary_creator_influence ||
        (Array.isArray(r.followed_creators) && r.followed_creators[0]) ||
        (idx % 3 === 0
          ? "creator-agent00"
          : idx % 3 === 1
            ? "creator-troydan"
            : "creator-dbg")
    );
    const creatorHandle = CREATOR_HANDLE_MAP[primaryCreatorId] || "@Agent00";
    const archetype = String(r.primary_archetype || "MYCAREER_STORY_CASUAL");
    const crewRole =
      archetype === "REC_CREW_CAPTAIN" || archetype === "PARK_REP_GRINDER"
        ? "CAPTAIN"
        : "MEMBER";

    return {
      player_id: r.player_id,
      gamer_tag: r.gamer_tag,
      archetype,
      primary_archetype: archetype,
      lifetime_spend_usd: toNumber(r.lifetime_spend_usd),
      churn_risk_score: toNumber(r.churn_risk_score),
      tilt_sensitivity: toNumber(r.tilt_sensitivity),
      recent_loss_streak: toNumber(r.recent_loss_streak),
      dma_market: r.dma_market ?? null,
      crew_id: crewId,
      crew_name: clanInfo.name,
      crew_tier: clanInfo.tier,
      crew_role: crewRole,
      creator_id: primaryCreatorId,
      creator_handle: creatorHandle,
      game_telemetry: telemetry,
      myplayer_ovr:
        telemetry.myplayer_ovr !== undefined && telemetry.myplayer_ovr !== null
          ? toNumber(telemetry.myplayer_ovr)
          : 85,
      myplayer_build: telemetry.myplayer_build || "Balanced Build",
      vc_spend_90d:
        telemetry.vc_spend_90d !== undefined && telemetry.vc_spend_90d !== null
          ? toNumber(telemetry.vc_spend_90d)
          : toNumber(r.lifetime_spend_usd),
      vc_balance:
        telemetry.vc_balance !== undefined && telemetry.vc_balance !== null
          ? toNumber(telemetry.vc_balance)
          : 15000,
      loss_streak:
        telemetry.loss_streak !== undefined && telemetry.loss_streak !== null
          ? toNumber(telemetry.loss_streak)
          : toNumber(r.recent_loss_streak),
      rage_quits_7d:
        telemetry.rage_quits_7d !== undefined && telemetry.rage_quits_7d !== null
          ? toNumber(telemetry.rage_quits_7d)
          : 0,
      season_pass_edition: telemetry.season_pass_edition || "NONE",
      season_pass_tier:
        telemetry.season_pass_tier !== undefined && telemetry.season_pass_tier !== null
          ? toNumber(telemetry.season_pass_tier)
          : 12,
      myteam_galaxy_opal_count:
        telemetry.myteam_galaxy_opal_count !== undefined &&
        telemetry.myteam_galaxy_opal_count !== null
          ? toNumber(telemetry.myteam_galaxy_opal_count)
          : 0,
      park_win_pct:
        telemetry.park_win_pct !== undefined && telemetry.park_win_pct !== null
          ? toNumber(telemetry.park_win_pct)
          : 0.5,
      rockstar_linked: Boolean(telemetry.nba2k26_veteran ?? telemetry.rockstar_linked),
      gta_online_spend_usd:
        telemetry.nba2k26_spend_usd !== undefined && telemetry.nba2k26_spend_usd !== null
          ? toNumber(telemetry.nba2k26_spend_usd)
          : telemetry.gta_online_spend_usd !== undefined &&
              telemetry.gta_online_spend_usd !== null
            ? toNumber(telemetry.gta_online_spend_usd)
            : 0,
      gta6_preorder: Boolean(telemetry.migrated_to_2k27 ?? telemetry.gta6_preorder),
      gravity_score:
        telemetry.gravity_score !== undefined && telemetry.gravity_score !== null
          ? toNumber(telemetry.gravity_score)
          : 0.5,
      favorite_team: telemetry.favorite_team || "Los Angeles Lakers",
    };
  });
}

export async function evaluatePersonas(
  players: any[],
  offerTitle: string,
  priceUsd: number,
  franchise: string,
  counterfactualEvent?: string | null
): Promise<{ reactions: FocusGroupReaction[]; modelUsed: string }> {
  let modelUsed = "gemini-3.5-flash";

  const promises = players.map(async (player, index) => {
    const { system, prompt } = buildPersonaPrompt(
      player,
      offerTitle,
      priceUsd,
      franchise,
      counterfactualEvent
    );
    const res = await generateText({
      role: "FAST",
      system,
      prompt,
      json: true,
    });
    modelUsed = res.modelUsed;
    const parsed = parseModelJson<any>(res.text);
    if (!parsed) {
      throw new Error(
        `Persona evaluation returned unparseable JSON for ${player.gamer_tag || `persona-${index + 1}`}`
      );
    }

    const state = parsed.final_fsm_state;
    const reaction: FocusGroupReaction = {
      player_id: player.player_id || `persona-${index + 1}`,
      gamer_tag: player.gamer_tag || `Player_${index + 1}`,
      archetype: player.archetype || player.primary_archetype || "MYCAREER_STORY_CASUAL",
      crew_name: player.crew_name || "Bucket Getters",
      crew_tier: player.crew_tier || "Rec",
      crew_role: player.crew_role || "MEMBER",
      creator_handle: player.creator_handle || "@Agent00",
      willingness_to_pay_usd: Number(parsed.willingness_to_pay_usd),
      final_fsm_state: state,
      round1_fsm_state: state,
      round1_quote: parsed.verbatim_quote,
      round1_wtp_usd: Number(parsed.willingness_to_pay_usd),
      contagion_flipped: false,
      contagion_driver: "NONE",
      verbatim_quote: parsed.verbatim_quote,
      sentiment_score: Number(parsed.sentiment_score),
      authenticity_rating: Number(parsed.authenticity_rating ?? 0.94),
      churn_risk_score: Number(parsed.churn_risk_score ?? player.churn_risk_score ?? 0.25),
    };
    return reaction;
  });

  const reactions = await Promise.all(promises);
  return { reactions, modelUsed };
}

export async function generateCreatorBroadcasts(
  offerTitle: string,
  priceUsd: number,
  franchise: string,
  r1Reactions: FocusGroupReaction[],
  counterfactualEvent?: string | null
): Promise<CreatorBroadcast[]> {
  const buyCount = r1Reactions.filter((r) => r.final_fsm_state === "PURCHASED").length;
  const boycottCount = r1Reactions.filter((r) => r.final_fsm_state === "BOYCOTT").length;
  const { system, prompt } = buildCreatorBroadcastPrompt(
    offerTitle,
    priceUsd,
    franchise,
    buyCount,
    boycottCount,
    counterfactualEvent
  );

  const res = await generateText({
    role: "FAST",
    system,
    prompt,
    json: true,
    thinkingBudget: 0,
  });

  const parsed = parseModelJson<any>(res.text);
  if (!parsed || !Array.isArray(parsed.broadcasts)) {
    throw new Error("Creator broadcast generation returned invalid JSON payload");
  }

  return parsed.broadcasts.map((b: any) => ({
    creator_id: String(b.creator_id || "creator-agent00"),
    handle: String(b.handle || "@Agent00"),
    name: String(b.name || "Agent 00"),
    platform: String(b.platform || "YouTube"),
    stance: (["ENDORSE", "MIXED", "CALLOUT"].includes(b.stance) ? b.stance : "MIXED") as
      | "ENDORSE"
      | "MIXED"
      | "CALLOUT",
    headline: String(b.headline || ""),
    influence_reach: Number(b.influence_reach || 2600000),
  }));
}

export async function evaluateContagionRound2(
  players: any[],
  r1Reactions: FocusGroupReaction[],
  offerTitle: string,
  priceUsd: number,
  franchise: string,
  creatorBroadcasts: CreatorBroadcast[],
  counterfactualEvent?: string | null
): Promise<{
  reactions: FocusGroupReaction[];
  flipsCount: number;
  crewCaptainSummary: string;
}> {
  const captains = r1Reactions.filter(
    (r) =>
      r.crew_role === "CAPTAIN" ||
      r.archetype === "REC_CREW_CAPTAIN" ||
      r.archetype === "PARK_REP_GRINDER"
  );
  const captainBuys = captains.filter((c) => c.final_fsm_state === "PURCHASED");
  const crewCaptainSummary =
    captainBuys.length > 0
      ? `${captainBuys.length}/${captains.length} Crew Captains (${captainBuys
          .map((c) => `${c.gamer_tag} in ${c.crew_name}`)
          .slice(0, 3)
          .join(", ")}) locked in PURCHASED in Round 1 and pinged their 5-stack Rec/Pro-Am rosters.`
      : `Crew Captains held back in Round 1 (${captains.length} captains evaluating/passing), warning squadmates to watch VC value.`;

  const personasWithR1 = r1Reactions.map((r, index) => {
    const p = players[index] || {};
    return {
      index,
      player_id: r.player_id || p.player_id || `persona-${index + 1}`,
      gamer_tag: r.gamer_tag || p.gamer_tag || `Player_${index + 1}`,
      archetype: String(r.archetype || p.archetype || "MYCAREER_STORY_CASUAL"),
      myplayer_ovr: Number(p.myplayer_ovr || 85),
      vc_spend_90d: Number(p.vc_spend_90d || p.spend || 60),
      crew_name: r.crew_name || p.crew_name || "Bucket Getters",
      crew_tier: r.crew_tier || p.crew_tier || "Rec",
      crew_role: r.crew_role || p.crew_role || "MEMBER",
      creator_handle: r.creator_handle || p.creator_handle || "@Agent00",
      round1_state: r.round1_fsm_state || r.final_fsm_state,
      round1_wtp: r.round1_wtp_usd ?? r.willingness_to_pay_usd,
      round1_quote: r.round1_quote || r.verbatim_quote,
    };
  });

  const { system, prompt } = buildContagionRound2Prompt(
    personasWithR1,
    offerTitle,
    priceUsd,
    franchise,
    creatorBroadcasts,
    crewCaptainSummary,
    counterfactualEvent
  );

  const res = await generateText({
    role: "FAST",
    system,
    prompt,
    json: true,
    thinkingBudget: 0,
  });

  const parsed = parseModelJson<any>(res.text);
  if (!parsed || !Array.isArray(parsed.round2)) {
    throw new Error("Round 2 social contagion evaluation returned invalid JSON payload");
  }

  const r2ByIndex = new Map<number, any>();
  for (const item of parsed.round2) {
    if (typeof item.index === "number") {
      r2ByIndex.set(item.index, item);
    }
  }

  let flipsCount = 0;
  const updatedReactions: FocusGroupReaction[] = r1Reactions.map((r1, idx) => {
    const r2 = r2ByIndex.get(idx);
    if (!r2) return r1;

    const r1State = r1.round1_fsm_state || r1.final_fsm_state;
    const r2State = r2.final_fsm_state || r1State;
    const flipped = r2State !== r1State;
    if (flipped) flipsCount++;

    const driver: ContagionDriver = ["CREW_CAPTAIN", "CREATOR_STREAM", "COUNTERFACTUAL"].includes(
      r2.contagion_driver
    )
      ? r2.contagion_driver
      : flipped
        ? counterfactualEvent
          ? "COUNTERFACTUAL"
          : "CREW_CAPTAIN"
        : "NONE";

    return {
      ...r1,
      round1_fsm_state: r1State,
      round1_quote: r1.round1_quote || r1.verbatim_quote,
      round1_wtp_usd: r1.round1_wtp_usd ?? r1.willingness_to_pay_usd,
      final_fsm_state: r2State,
      willingness_to_pay_usd: Number(r2.willingness_to_pay_usd ?? r1.willingness_to_pay_usd),
      verbatim_quote: String(r2.verbatim_quote || r1.verbatim_quote),
      sentiment_score: Number(r2.sentiment_score ?? r1.sentiment_score),
      contagion_flipped: flipped,
      contagion_driver: driver,
      contagion_source: String(
        r2.contagion_source || (flipped ? r1.crew_name || r1.creator_handle || "" : "")
      ),
    };
  });

  return {
    reactions: updatedReactions,
    flipsCount,
    crewCaptainSummary,
  };
}

export async function evaluateCrowdSwarm80(
  crowdPlayers: any[],
  offerTitle: string,
  priceUsd: number,
  franchise: string,
  creatorBroadcasts: CreatorBroadcast[],
  counterfactualEvent?: string | null,
  onBatchReady?: (batchIndex: number, batchAgents: SwarmCrowdAgent[]) => void
): Promise<{ crowdAgents: SwarmCrowdAgent[]; liteModelUsed: string }> {
  const targetPlayers = crowdPlayers.slice(0, 80);
  const batches: any[][] = [];
  for (let i = 0; i < targetPlayers.length; i += 20) {
    batches.push(targetPlayers.slice(i, i + 20));
  }

  const creatorStanceSummary = creatorBroadcasts
    .map((c) => `${c.handle} (${c.stance}): ${c.headline}`)
    .join(" | ");

  let liteModelUsed = "gemini-3.5-flash-lite";

  const batchPromises = batches.map(async (batch, batchIdx) => {
    const compactInput = batch.map((p, i) => ({
      player_id: String(p.player_id || `swarm-${batchIdx * 20 + i + 1}`),
      gamer_tag: String(p.gamer_tag || `Player_${batchIdx * 20 + i + 21}`),
      archetype: String(p.archetype || p.primary_archetype || "MYCAREER_STORY_CASUAL"),
      myplayer_ovr: Number(p.myplayer_ovr || 85),
      vc_spend_90d: Number(p.vc_spend_90d || p.lifetime_spend_usd || 60),
      crew_name: String(p.crew_name || "Bucket Getters"),
      creator_handle: String(p.creator_handle || "@Agent00"),
    }));

    const { system, prompt } = buildCrowdSwarmBatchPrompt(
      compactInput,
      offerTitle,
      priceUsd,
      franchise,
      creatorStanceSummary,
      counterfactualEvent
    );

    const res = await generateText({
      role: "LITE",
      system,
      prompt,
      json: true,
      thinkingBudget: 0,
    });
    liteModelUsed = res.modelUsed;

    const parsed = parseModelJson<any>(res.text);
    if (!parsed || !Array.isArray(parsed.agents)) {
      throw new Error(`Swarm batch ${batchIdx + 1} returned invalid JSON payload`);
    }

    const batchAgents: SwarmCrowdAgent[] = compactInput.map((inp, idx) => {
      const a = parsed.agents[idx] || {};
      const r1 = ["PURCHASED", "ENGAGED_FREE", "EVALUATING", "ABANDONED", "BOYCOTT"].includes(
        a.round1_state
      )
        ? a.round1_state
        : "EVALUATING";
      const r2 = ["PURCHASED", "ENGAGED_FREE", "EVALUATING", "ABANDONED", "BOYCOTT"].includes(
        a.final_fsm_state
      )
        ? a.final_fsm_state
        : r1;
      const flipped = r1 !== r2;
      const driver: ContagionDriver = [
        "CREW_CAPTAIN",
        "CREATOR_STREAM",
        "COUNTERFACTUAL",
      ].includes(a.contagion_driver)
        ? a.contagion_driver
        : flipped
          ? "CREW_CAPTAIN"
          : "NONE";

      return {
        player_id: inp.player_id,
        gamer_tag: inp.gamer_tag,
        archetype: inp.archetype,
        myplayer_ovr: inp.myplayer_ovr,
        crew_name: inp.crew_name,
        creator_handle: inp.creator_handle,
        round1_state: r1,
        final_fsm_state: r2,
        willingness_to_pay_usd: Number(a.willingness_to_pay_usd ?? priceUsd),
        contagion_flipped: flipped,
        contagion_driver: driver,
      };
    });

    if (onBatchReady) {
      onBatchReady(batchIdx, batchAgents);
    }
    return batchAgents;
  });

  const resolvedBatches = await Promise.all(batchPromises);
  return {
    crowdAgents: resolvedBatches.flat(),
    liteModelUsed,
  };
}

export async function synthesizeConsensus(
  reactions: FocusGroupReaction[],
  offerTitle: string,
  priceUsd: number,
  franchise: string,
  cohortContext?: any,
  contagionMeta?: {
    crowdAgents?: SwarmCrowdAgent[];
    creatorBroadcasts?: CreatorBroadcast[];
    counterfactualEvent?: string | null;
    flipsCount?: number;
  }
): Promise<{
  consensusSummary: string;
  predictedConversionLift: number;
  backlashIndex: number;
  wtpCurve: Array<{ price: number; conversion_pct: number }>;
  recommendedPrice: number;
  projectedRevenueImpactUsd: number;
  churnMitigationLift: number;
  crewContagionMultiplier: number;
  contagionSummary: string;
  migrationCurve: MigrationCurvePoint[];
  reasoningModelUsed: string;
}> {
  const crowdCount = contagionMeta?.crowdAgents?.length ?? 0;
  const totalAgents = reactions.length + crowdCount;

  const prompt = `You are the Lead Audience Intelligence & Pricing Strategist for 2K Games.
Synthesize the results of a ${totalAgents}-agent 2-Round Social Contagion Focus Group (${reactions.length} Core Personas + ${crowdCount} Crowd Swarm Agents) evaluating:
Offer Title: "${offerTitle}"
Proposed Price: $${priceUsd.toFixed(2)} USD
Franchise: ${franchise}
Target Cohort: ${cohortContext?.query || "NBA 2K27 Active Cohort"}
Active Counterfactual Event: ${contagionMeta?.counterfactualEvent || "None (Baseline)"}
Round 2 Contagion Flips in Core Cohort: ${contagionMeta?.flipsCount ?? 0}/20

Core Persona Evaluations (Round 1 -> Round 2 Contagion):
${JSON.stringify(
  reactions.map((r) => ({
    gamer_tag: r.gamer_tag,
    archetype: r.archetype,
    crew: r.crew_name,
    creator: r.creator_handle,
    r1_state: r.round1_fsm_state || r.final_fsm_state,
    r2_state: r.final_fsm_state,
    flipped: r.contagion_flipped,
    driver: r.contagion_driver,
    wtp: r.willingness_to_pay_usd,
    quote: r.verbatim_quote,
  })),
  null,
  2
)}

Provide an executive synthesis in strict JSON format (zero em-dashes in strings):
{
  "consensus_summary": "1-2 concise sentences summarizing community consensus, social contagion impact, and winning value proposition.",
  "contagion_summary": "1 concise sentence explaining how Crew Captains and Creator streams (@Agent00, @Troydan, @DBG) shifted Round 2 conversions.",
  "crew_contagion_multiplier": <number between 1.4 and 3.6, e.g. 3.1 for Crew/2K26 upgrade offers>,
  "predicted_conversion_lift": <number: estimated percentage lift, e.g. 28.4>,
  "backlash_index": <number: 0 to 100 indicating community backlash / boycott risk>,
  "wtp_curve": [
    { "price": 2.99, "conversion_pct": <number 0-100> },
    { "price": 4.99, "conversion_pct": <number 0-100> },
    { "price": 7.99, "conversion_pct": <number 0-100> },
    { "price": 9.99, "conversion_pct": <number 0-100> },
    { "price": 12.99, "conversion_pct": <number 0-100> },
    { "price": 14.99, "conversion_pct": <number 0-100> },
    { "price": 19.99, "conversion_pct": <number 0-100> },
    { "price": 24.99, "conversion_pct": <number 0-100> }
  ],
  "migration_curve": [
    { "stage": "S1 Wk4", "isolated_pct": <number 15-40>, "contagion_pct": <number 20-50> },
    { "stage": "S1 Cliff", "isolated_pct": <number 20-50>, "contagion_pct": <number 35-70> },
    { "stage": "S2 Tip-Off", "isolated_pct": <number 25-55>, "contagion_pct": <number 50-82> },
    { "stage": "S2 Holiday", "isolated_pct": <number 30-60>, "contagion_pct": <number 62-90> },
    { "stage": "S3 All-Star", "isolated_pct": <number 35-65>, "contagion_pct": <number 70-94> }
  ],
  "recommended_price": <number: the revenue-maximizing price point that keeps backlash under control>,
  "projected_revenue_impact_usd": <number: estimated incremental gross revenue, e.g. 168000>,
  "churn_mitigation_lift": <number: churn reduction percentage, e.g. 22.5>
}`;

  const res = await generateText({
    role: "REASONING",
    prompt,
    system: "You are an expert game monetization and social contagion economist at 2K Games.",
    json: true,
  });
  const parsed = parseModelJson<any>(res.text);
  if (!parsed || !Array.isArray(parsed.wtp_curve)) {
    throw new Error("Consensus synthesis returned invalid or incomplete JSON payload");
  }

  return {
    consensusSummary: String(parsed.consensus_summary || "").replace(/—/g, "·"),
    contagionSummary: String(parsed.contagion_summary || "").replace(/—/g, "·"),
    crewContagionMultiplier: Number(parsed.crew_contagion_multiplier || 3.1),
    predictedConversionLift: Number(parsed.predicted_conversion_lift),
    backlashIndex: Number(parsed.backlash_index),
    wtpCurve: parsed.wtp_curve.map((pt: any) => ({
      price: Number(pt.price),
      conversion_pct: Number(pt.conversion_pct),
    })),
    migrationCurve: Array.isArray(parsed.migration_curve)
      ? parsed.migration_curve.map((m: any) => ({
          stage: String(m.stage),
          isolated_pct: Number(m.isolated_pct),
          contagion_pct: Number(m.contagion_pct),
        }))
      : [
          { stage: "S1 Wk4", isolated_pct: 24, contagion_pct: 36 },
          { stage: "S1 Cliff", isolated_pct: 31, contagion_pct: 54 },
          { stage: "S2 Tip-Off", isolated_pct: 38, contagion_pct: 68 },
          { stage: "S2 Holiday", isolated_pct: 44, contagion_pct: 79 },
          { stage: "S3 All-Star", isolated_pct: 49, contagion_pct: 86 },
        ],
    recommendedPrice: Number(parsed.recommended_price),
    projectedRevenueImpactUsd: Number(parsed.projected_revenue_impact_usd),
    churnMitigationLift: Number(parsed.churn_mitigation_lift),
    reasoningModelUsed: res.modelUsed,
  };
}
