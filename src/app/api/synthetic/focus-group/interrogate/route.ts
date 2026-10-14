import { NextRequest, NextResponse } from "next/server";
import { generateText, parseModelJson } from "@/lib/gcp/genai-client";
import { runRawGql, parseJsonColumn, toNumber } from "@/lib/gcp/spanner-client";
import {
  COURTSIDE_PERSONA_PROMPTS,
  buildIndividualVoiceProfile,
} from "@/lib/prompts/courtside_personas";
import { normalizeCreatorHandle } from "@/lib/focus-group-eval";
import { ArchetypeId, archetypeLabel } from "@/lib/archetypes";

export const dynamic = "force-dynamic";

interface SpannerPlayerEnrichment {
  player_id: string;
  gamer_tag: string;
  age: number;
  primary_archetype: string;
  lifetime_spend_usd: number;
  churn_risk_score: number;
  tilt_sensitivity: number;
  recent_loss_streak: number;
  rage_quits_7d: number;
  myplayer_ovr: number;
  myplayer_build: string;
  vc_spend_90d: number;
  vc_balance: number;
  season_pass_edition: string;
  season_pass_tier: number;
  myteam_galaxy_opal_count: number;
  crew_id: string;
  crew_name: string;
  crew_tier: string;
  creator_id: string;
  creator_handle: string;
}

function mapSpannerEnrichmentRow(row: any): SpannerPlayerEnrichment {
  const telemetry = parseJsonColumn(row.game_telemetry, {});
  const lifetimeSpend = toNumber(row.lifetime_spend_usd);
  return {
    player_id: String(row.player_id || ""),
    gamer_tag: String(row.gamer_tag || "Player_2K"),
    age: toNumber(row.age) || 24,
    primary_archetype: String(row.primary_archetype || "MYCAREER_STORY_CASUAL"),
    lifetime_spend_usd: lifetimeSpend,
    churn_risk_score: toNumber(row.churn_risk_score),
    tilt_sensitivity: toNumber(row.tilt_sensitivity),
    recent_loss_streak: toNumber(row.recent_loss_streak),
    rage_quits_7d:
      telemetry.rage_quits_7d !== undefined && telemetry.rage_quits_7d !== null
        ? toNumber(telemetry.rage_quits_7d)
        : 0,
    myplayer_ovr:
      telemetry.myplayer_ovr !== undefined && telemetry.myplayer_ovr !== null
        ? toNumber(telemetry.myplayer_ovr)
        : 85,
    myplayer_build: String(telemetry.myplayer_build || "Balanced Build"),
    vc_spend_90d:
      telemetry.vc_spend_90d !== undefined && telemetry.vc_spend_90d !== null
        ? toNumber(telemetry.vc_spend_90d)
        : lifetimeSpend,
    vc_balance:
      telemetry.vc_balance !== undefined && telemetry.vc_balance !== null
        ? toNumber(telemetry.vc_balance)
        : 15000,
    season_pass_edition: String(telemetry.season_pass_edition || "NONE"),
    season_pass_tier:
      telemetry.season_pass_tier !== undefined && telemetry.season_pass_tier !== null
        ? toNumber(telemetry.season_pass_tier)
        : 12,
    myteam_galaxy_opal_count:
      telemetry.myteam_galaxy_opal_count !== undefined &&
      telemetry.myteam_galaxy_opal_count !== null
        ? toNumber(telemetry.myteam_galaxy_opal_count)
        : 0,
    crew_id: String(row.clan_id || telemetry.crew_id || ""),
    crew_name: String(row.crew_name || "Bucket Getters"),
    crew_tier: String(row.crew_tier || "Rec"),
    creator_id: String(row.creator_id || ""),
    creator_handle: normalizeCreatorHandle(row.creator_handle),
  };
}

/**
 * Look up a single player's live node + 1-hop MEMBER_OF_CLAN and FOLLOWS_CREATOR
 * edges in TakeTwoPlayerGraph by player_id or gamer_tag (or archetype match if
 * a synthetic persona card id was passed).
 */
async function fetchSinglePlayerSpannerContext(
  playerId: string,
  gamerTag: string,
  archetype: string
): Promise<{ profile: SpannerPlayerEnrichment | null; spannerEnriched: boolean }> {
  const byIdentityRows = await runRawGql(
    `GRAPH TakeTwoPlayerGraph
     MATCH (p:Player)-[:MEMBER_OF_CLAN]->(c:Clan),
           (p:Player)-[:FOLLOWS_CREATOR]->(cr:Creator)
     WHERE p.player_id = @playerId OR p.gamer_tag = @gamerTag
     RETURN p.player_id AS player_id,
            ANY_VALUE(p.gamer_tag) AS gamer_tag,
            ANY_VALUE(p.age) AS age,
            ANY_VALUE(p.primary_archetype) AS primary_archetype,
            ANY_VALUE(p.lifetime_spend_usd) AS lifetime_spend_usd,
            ANY_VALUE(p.churn_risk_score) AS churn_risk_score,
            ANY_VALUE(p.tilt_sensitivity) AS tilt_sensitivity,
            ANY_VALUE(p.recent_loss_streak) AS recent_loss_streak,
            ANY_VALUE(p.game_telemetry) AS game_telemetry,
            ANY_VALUE(c.clan_id) AS clan_id,
            ANY_VALUE(c.name) AS crew_name,
            ANY_VALUE(c.tier) AS crew_tier,
            ANY_VALUE(cr.creator_id) AS creator_id,
            ANY_VALUE(cr.handle) AS creator_handle
     GROUP BY p.player_id
     LIMIT 1`,
    { playerId: playerId || "", gamerTag: gamerTag || "" }
  );

  if (byIdentityRows.length > 0) {
    return {
      profile: mapSpannerEnrichmentRow(byIdentityRows[0]),
      spannerEnriched: true,
    };
  }

  // If the persona came from an un-hydrated card id, match a live Spanner player of the same archetype
  const byArchetypeRows = await runRawGql(
    `GRAPH TakeTwoPlayerGraph
     MATCH (p:Player)-[:MEMBER_OF_CLAN]->(c:Clan),
           (p:Player)-[:FOLLOWS_CREATOR]->(cr:Creator)
     WHERE p.primary_archetype = @archetype
     RETURN p.player_id AS player_id,
            ANY_VALUE(p.gamer_tag) AS gamer_tag,
            ANY_VALUE(p.age) AS age,
            ANY_VALUE(p.primary_archetype) AS primary_archetype,
            ANY_VALUE(p.lifetime_spend_usd) AS lifetime_spend_usd,
            ANY_VALUE(p.churn_risk_score) AS churn_risk_score,
            ANY_VALUE(p.tilt_sensitivity) AS tilt_sensitivity,
            ANY_VALUE(p.recent_loss_streak) AS recent_loss_streak,
            ANY_VALUE(p.game_telemetry) AS game_telemetry,
            ANY_VALUE(c.clan_id) AS clan_id,
            ANY_VALUE(c.name) AS crew_name,
            ANY_VALUE(c.tier) AS crew_tier,
            ANY_VALUE(cr.creator_id) AS creator_id,
            ANY_VALUE(cr.handle) AS creator_handle
     GROUP BY p.player_id
     LIMIT 1`,
    { archetype: archetype || "MYCAREER_STORY_CASUAL" }
  );

  if (byArchetypeRows.length > 0) {
    return {
      profile: mapSpannerEnrichmentRow(byArchetypeRows[0]),
      spannerEnriched: true,
    };
  }

  return { profile: null, spannerEnriched: false };
}

/**
 * Look up live Spanner Graph telemetry + 1-hop Clan/Creator edges for a 3-agent panel.
 */
async function fetchPanelSpannerContext(
  panelAgents: any[]
): Promise<{ byKey: Map<string, SpannerPlayerEnrichment>; spannerEnriched: boolean }> {
  const ids = Array.from(
    new Set(
      panelAgents
        .map((a) => String(a?.player_id || "").trim())
        .filter((s) => s.length > 0)
    )
  );
  const tags = Array.from(
    new Set(
      panelAgents
        .map((a) => String(a?.gamer_tag || "").trim())
        .filter((s) => s.length > 0)
    )
  );

  const rows = await runRawGql(
    `GRAPH TakeTwoPlayerGraph
     MATCH (p:Player)-[:MEMBER_OF_CLAN]->(c:Clan),
           (p:Player)-[:FOLLOWS_CREATOR]->(cr:Creator)
     WHERE p.player_id IN UNNEST(@ids) OR p.gamer_tag IN UNNEST(@tags)
     RETURN p.player_id AS player_id,
            ANY_VALUE(p.gamer_tag) AS gamer_tag,
            ANY_VALUE(p.age) AS age,
            ANY_VALUE(p.primary_archetype) AS primary_archetype,
            ANY_VALUE(p.lifetime_spend_usd) AS lifetime_spend_usd,
            ANY_VALUE(p.churn_risk_score) AS churn_risk_score,
            ANY_VALUE(p.tilt_sensitivity) AS tilt_sensitivity,
            ANY_VALUE(p.recent_loss_streak) AS recent_loss_streak,
            ANY_VALUE(p.game_telemetry) AS game_telemetry,
            ANY_VALUE(c.clan_id) AS clan_id,
            ANY_VALUE(c.name) AS crew_name,
            ANY_VALUE(c.tier) AS crew_tier,
            ANY_VALUE(cr.creator_id) AS creator_id,
            ANY_VALUE(cr.handle) AS creator_handle
     GROUP BY p.player_id
     LIMIT 10`,
    {
      ids: ids.length > 0 ? ids : [""],
      tags: tags.length > 0 ? tags : [""],
    }
  );

  const byKey = new Map<string, SpannerPlayerEnrichment>();
  for (const r of rows) {
    const mapped = mapSpannerEnrichmentRow(r);
    if (mapped.player_id) byKey.set(mapped.player_id, mapped);
    if (mapped.gamer_tag) byKey.set(mapped.gamer_tag, mapped);
  }

  if (byKey.size === 0) {
    // Hydrate from live Spanner graph cohort if panel agents only had synthetic IDs
    const cohortRows = await runRawGql(
      `GRAPH TakeTwoPlayerGraph
       MATCH (p:Player)-[:MEMBER_OF_CLAN]->(c:Clan),
             (p:Player)-[:FOLLOWS_CREATOR]->(cr:Creator)
       RETURN p.player_id AS player_id,
              ANY_VALUE(p.gamer_tag) AS gamer_tag,
              ANY_VALUE(p.age) AS age,
              ANY_VALUE(p.primary_archetype) AS primary_archetype,
              ANY_VALUE(p.lifetime_spend_usd) AS lifetime_spend_usd,
              ANY_VALUE(p.churn_risk_score) AS churn_risk_score,
              ANY_VALUE(p.tilt_sensitivity) AS tilt_sensitivity,
              ANY_VALUE(p.recent_loss_streak) AS recent_loss_streak,
              ANY_VALUE(p.game_telemetry) AS game_telemetry,
              ANY_VALUE(c.clan_id) AS clan_id,
              ANY_VALUE(c.name) AS crew_name,
              ANY_VALUE(c.tier) AS crew_tier,
              ANY_VALUE(cr.creator_id) AS creator_id,
              ANY_VALUE(cr.handle) AS creator_handle
       GROUP BY p.player_id
       LIMIT 3`
    );
    cohortRows.forEach((r, idx) => {
      const mapped = mapSpannerEnrichmentRow(r);
      byKey.set(`slot-${idx}`, mapped);
    });
    return { byKey, spannerEnriched: cohortRows.length > 0 };
  }

  return { byKey, spannerEnriched: true };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const mode: "single" | "panel_debate" =
      body.mode === "panel_debate" ? "panel_debate" : "single";
    const question = body.question;
    const offerTitle = body.offer_title || "Proposed Offer";
    const priceUsd = Number(body.price_usd ?? 4.99);
    const counterfactualEvent: string | null = body.counterfactual_event || null;

    if (!question || typeof question !== "string") {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }

    // =========================================================================
    // MODE 2: MiroFish `interview_agents` 3-Persona Locker Room Debate
    // =========================================================================
    if (mode === "panel_debate") {
      const rawAgents = Array.isArray(body.panel_agents) ? body.panel_agents.slice(0, 3) : [];
      if (rawAgents.length === 0) {
        return NextResponse.json(
          { error: "panel_agents array is required for panel_debate mode" },
          { status: 400 }
        );
      }

      const { byKey, spannerEnriched } = await fetchPanelSpannerContext(rawAgents);

      const enrichedAgents = rawAgents.map((agent: any, idx: number) => {
        const sp =
          byKey.get(String(agent?.player_id || "")) ||
          byKey.get(String(agent?.gamer_tag || "")) ||
          byKey.get(`slot-${idx}`);

        const archetypeId = (agent?.archetype ||
          sp?.primary_archetype ||
          "MYCAREER_STORY_CASUAL") as ArchetypeId;
        const def =
          COURTSIDE_PERSONA_PROMPTS[archetypeId] ||
          COURTSIDE_PERSONA_PROMPTS.MYCAREER_STORY_CASUAL;

        const r1State = agent?.round1_fsm_state || agent?.final_fsm_state || "EVALUATING";
        const r2State = agent?.final_fsm_state || r1State;
        const r3State = agent?.round3_fsm_state || null;
        const activeState = r3State || r2State;
        const activeQuote =
          agent?.round3_quote || agent?.verbatim_quote || agent?.round1_quote || "";
        const wtpUsd = Number(
          agent?.round3_wtp_usd ?? agent?.willingness_to_pay_usd ?? priceUsd
        );

        const mergedForVoice = {
          ...sp,
          ...agent,
          archetype: archetypeId,
          gamer_tag: String(agent?.gamer_tag || sp?.gamer_tag || def.gamer_tag),
          myplayer_ovr: Number(agent?.myplayer_ovr ?? sp?.myplayer_ovr ?? def.ovr ?? 85),
          vc_spend_90d: Number(agent?.vc_spend_90d ?? sp?.vc_spend_90d ?? def.vcSpend90d),
          vc_balance: Number(agent?.vc_balance ?? sp?.vc_balance ?? 15000),
          loss_streak: Number(agent?.loss_streak ?? sp?.recent_loss_streak ?? 0),
          rage_quits_7d: Number(agent?.rage_quits_7d ?? sp?.rage_quits_7d ?? 0),
        };
        const vp = buildIndividualVoiceProfile(mergedForVoice, idx);

        return {
          slot: idx + 1,
          player_id: String(agent?.player_id || sp?.player_id || `panel-${idx + 1}`),
          gamer_tag: String(agent?.gamer_tag || sp?.gamer_tag || def.gamer_tag),
          age: Number(agent?.age ?? sp?.age ?? 24),
          archetype: archetypeId,
          archetype_label: archetypeLabel(archetypeId),
          crew_name: String(agent?.crew_name || sp?.crew_name || "Bucket Getters"),
          crew_role: String(
            agent?.crew_role ||
              (archetypeId === "REC_CREW_CAPTAIN" || archetypeId === "PARK_REP_GRINDER"
                ? "CAPTAIN"
                : "MEMBER")
          ),
          creator_handle: normalizeCreatorHandle(
            agent?.creator_handle || sp?.creator_handle || "@Agent00"
          ),
          myplayer_ovr: Number(agent?.myplayer_ovr ?? sp?.myplayer_ovr ?? def.ovr ?? 85),
          myplayer_build: String(
            agent?.myplayer_build || sp?.myplayer_build || def.build || "Balanced Build"
          ),
          vc_spend_90d: Number(agent?.vc_spend_90d ?? sp?.vc_spend_90d ?? def.vcSpend90d),
          vc_balance: Number(agent?.vc_balance ?? sp?.vc_balance ?? 15000),
          loss_streak: Number(agent?.loss_streak ?? sp?.recent_loss_streak ?? 0),
          round1_fsm_state: r1State,
          round1_quote: String(agent?.round1_quote || agent?.verbatim_quote || ""),
          round2_fsm_state: r2State,
          round2_quote: String(agent?.verbatim_quote || ""),
          round3_fsm_state: r3State,
          active_fsm_state: activeState,
          active_quote: activeQuote,
          contagion_flipped: Boolean(agent?.contagion_flipped || agent?.round3_flipped),
          contagion_driver: String(agent?.contagion_driver || "NONE"),
          contagion_source_tag: String(
            agent?.contagion_source_tag || agent?.contagion_source || ""
          ),
          wtp_usd: wtpUsd,
          voice_cadence_tier: vp.cadenceTier,
          voice_word_range: vp.wordCountRange,
          voice_sentence_target: vp.sentenceTarget,
          voice_typing_style: vp.typingStyle,
          voice_directive: vp.promptDirective,
        };
      });

      const system = `You are the 2K Courtside Locker Room Debate Engine (MiroFish multi-agent panel interrogation).
You are simulating a live, authentic 4-to-5 turn locker-room party-chat debate between 3 real NBA 2K players from TakeTwoPlayerGraph who have distinct stances AND radically different speaking styles on a proposed offer:
Offer: "${offerTitle}" at $${priceUsd.toFixed(2)} USD.
${counterfactualEvent ? `Active What-If Live Patch Injection: "${counterfactualEvent}"` : "No counterfactual sweetener active (Baseline offer)."}

CRITICAL INDIVIDUAL VOICE & LENGTH RULES (DO NOT MAKE TURNS SIMILAR IN LENGTH):
1. Each panelist has a strict "voice_word_range", "voice_sentence_target", "voice_typing_style", and "voice_directive" in their JSON object. You MUST obey each speaker's exact word count range and typing style on every turn they speak!
   - If a speaker is ULTRA_CLIPPED (4 to 9 words), their turn MUST be a blunt 4–9 word party-chat fragment (e.g., "nah bro @$19.99 still wild for 75k VC").
   - If a speaker is CASUAL_ONE_LINER (9 to 19 words) or WHALE_FLEX_DIRECT (12 to 24 words), their turn is 1 crisp sentence.
   - If a speaker is SQUAD_VOICE_MEDIUM (18 to 31 words), their turn is 1–2 vocal locker-room sentences rallying or pressing their 5-stack Crew.
   - If a speaker is DEEP_ANALYST_BREAKDOWN (28 to 51 words), their turn is 2–3 analytical sentences breaking down exact VC-per-dollar math, badge breakpoints, or Cap Breaker value.
2. Generate 4 or 5 total turns in "turns" so it feels like a real back-and-forth exchange:
   - Turn 1: Panelist 1 answers the moderator's question in their exact voice_word_range.
   - Turn 2: Panelist 2 directly calls out or challenges Panelist 1 by @gamer_tag over their stance/telemetry, strictly obeying Panelist 2's voice_word_range.
   - Turn 3: Panelist 3 (often the Crew Captain or swing voice) reacts to both @gamer_tag speakers and states what their 5-stack Crew needs, strictly obeying Panelist 3's voice_word_range.
   - Turn 4 (and optional Turn 5): One or two panelists clap back or respond directly to what was just said in their own strict voice_word_range (e.g., a 6-word snap-back from a tilted grinder or a 35-word math counter from a theorycrafter).
3. Stay 100% in authentic 2K gamer voice (VC, Cap Breakers, The City, Park, Rec, Pro-Am, MyTEAM, Season Pass, 2K27, 2K26 holdouts, badge thresholds). Never use corporate marketing jargon, and never use em-dashes.
4. Provide a 1-sentence "consensus_fracture_summary" explaining the exact fault line splitting the room and the specific offer tweak that bridges all 3 players.`;

      const prompt = `Moderator Question to the 3-Player Panel:
"${question}"

Panelists (with Live Spanner Telemetry, Simulation Memory, and Individual Voice Directives):
${JSON.stringify(enrichedAgents, null, 2)}

Return strict JSON with "turns" (4 to 5 back-and-forth turns where each turn's "text" strictly obeys that speaker's "voice_word_range" and "voice_typing_style") and "consensus_fracture_summary":`;

      const res = await generateText({
        role: "FAST",
        system,
        prompt,
        json: true,
        temperature: 0.7,
        thinkingBudget: 0,
        maxOutputTokens: 1100,
        schema: {
          type: "OBJECT",
          properties: {
            turns: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  gamer_tag: { type: "STRING" },
                  archetype: { type: "STRING" },
                  fsm_state: { type: "STRING" },
                  wtp_usd: { type: "NUMBER" },
                  crew_name: { type: "STRING" },
                  text: { type: "STRING" },
                },
                required: ["gamer_tag", "archetype", "fsm_state", "wtp_usd", "text"],
              },
            },
            consensus_fracture_summary: { type: "STRING" },
          },
          required: ["turns", "consensus_fracture_summary"],
        },
      });

      const parsed = parseModelJson<{
        turns?: Array<{
          gamer_tag?: string;
          archetype?: string;
          fsm_state?: string;
          wtp_usd?: number;
          crew_name?: string;
          text?: string;
        }>;
        consensus_fracture_summary?: string;
      }>(res.text);

      if (!parsed || !Array.isArray(parsed.turns) || parsed.turns.length === 0) {
        throw new Error("Panel debate model response returned invalid JSON payload");
      }

      const turns = parsed.turns.slice(0, 5).map((rawTurn, idx) => {
        const cleanRawTag = String(rawTurn.gamer_tag || "").replace(/^@/, "").toLowerCase();
        const matchedAgent =
          enrichedAgents.find(
            (ag: (typeof enrichedAgents)[number]) =>
              ag.gamer_tag.replace(/^@/, "").toLowerCase() === cleanRawTag
          ) || enrichedAgents[idx % enrichedAgents.length];

        return {
          gamer_tag: matchedAgent.gamer_tag,
          archetype: matchedAgent.archetype,
          fsm_state: matchedAgent.active_fsm_state,
          wtp_usd: matchedAgent.wtp_usd,
          crew_name: matchedAgent.crew_name,
          text: String(rawTurn.text || matchedAgent.active_quote).replace(/—/g, "·"),
        };
      });

      return NextResponse.json({
        mode: "panel_debate",
        turns,
        consensus_fracture_summary: String(
          parsed.consensus_fracture_summary || ""
        ).replace(/—/g, "·"),
        spanner_enriched: spannerEnriched,
        model_used: res.modelUsed,
        latency_ms: res.latencyMs,
      });
    }

    // =========================================================================
    // MODE 1 (DEFAULT): Memory-Grounded 1-on-1 Interview (`mode: "single"`)
    // =========================================================================
    const persona = body.persona || {};
    const history: Array<{ role: "user" | "persona"; text: string }> = Array.isArray(
      body.history
    )
      ? body.history
          .filter(
            (m: any) =>
              m &&
              (m.role === "user" || m.role === "persona") &&
              typeof m.text === "string"
          )
          .slice(-10)
      : [];

    const archetypeId = (persona?.archetype as ArchetypeId) || "MYCAREER_STORY_CASUAL";
    const def =
      COURTSIDE_PERSONA_PROMPTS[archetypeId] ||
      COURTSIDE_PERSONA_PROMPTS.MYCAREER_STORY_CASUAL;
    const requestedTag = String(persona?.gamer_tag || def.gamer_tag);
    const requestedId = String(persona?.player_id || "");

    const { profile: spannerProfile, spannerEnriched } =
      await fetchSinglePlayerSpannerContext(requestedId, requestedTag, archetypeId);

    const gamerTag = persona?.gamer_tag || spannerProfile?.gamer_tag || def.gamer_tag;
    const age = Number(persona?.age ?? spannerProfile?.age ?? 24);
    const myplayerOvr =
      persona?.myplayer_ovr ?? spannerProfile?.myplayer_ovr ?? def.ovr ?? 85;
    const myplayerBuild =
      persona?.myplayer_build || spannerProfile?.myplayer_build || def.build || "Balanced Build";
    const vcSpend90d =
      persona?.vc_spend_90d ?? spannerProfile?.vc_spend_90d ?? def.vcSpend90d;
    const vcBalance = persona?.vc_balance ?? spannerProfile?.vc_balance ?? 15000;
    const lossStreak = Number(
      persona?.loss_streak ?? spannerProfile?.recent_loss_streak ?? 0
    );
    const rageQuits7d = Number(
      persona?.rage_quits_7d ?? spannerProfile?.rage_quits_7d ?? 0
    );
    const crewName =
      persona?.crew_name || spannerProfile?.crew_name || "Bucket Getters";
    const crewTier = persona?.crew_tier || spannerProfile?.crew_tier || "Rec";
    const crewRole =
      persona?.crew_role ||
      (archetypeId === "REC_CREW_CAPTAIN" || archetypeId === "PARK_REP_GRINDER"
        ? "CAPTAIN"
        : "MEMBER");
    const creatorHandle = normalizeCreatorHandle(
      persona?.creator_handle || spannerProfile?.creator_handle || "@Agent00"
    );
    const lifetimeSpendUsd =
      spannerProfile?.lifetime_spend_usd ?? vcSpend90d;
    const churnRiskScore = Number(
      persona?.churn_risk_score ?? spannerProfile?.churn_risk_score ?? 0.25
    );

    const voiceProfile = buildIndividualVoiceProfile({
      ...spannerProfile,
      ...persona,
      player_id: requestedId || spannerProfile?.player_id || gamerTag,
      gamer_tag: gamerTag,
      age,
      archetype: archetypeId,
      myplayer_ovr: myplayerOvr,
      vc_spend_90d: vcSpend90d,
      vc_balance: vcBalance,
      loss_streak: lossStreak,
      rage_quits_7d: rageQuits7d,
      crew_role: crewRole,
    });

    // Simulation Episodic Memory (R1 -> R2 -> R3)
    const r1State = persona?.round1_fsm_state || persona?.final_fsm_state || "EVALUATING";
    const r1Quote = persona?.round1_quote || persona?.verbatim_quote || "";
    const r2State = persona?.final_fsm_state || r1State;
    const r2Quote = persona?.verbatim_quote || r1Quote;
    const r3State = persona?.round3_fsm_state || null;
    const r3Quote = persona?.round3_quote || null;
    const wtpUsd = Number(
      persona?.round3_wtp_usd ?? persona?.willingness_to_pay_usd ?? priceUsd
    );
    const contagionFlipped = Boolean(persona?.contagion_flipped || persona?.round3_flipped);
    const contagionDriver = String(persona?.contagion_driver || "NONE");
    const contagionSourceTag = String(
      persona?.contagion_source_tag || persona?.contagion_source || crewName
    );

    const historyTranscript =
      history.length > 0
        ? `\nPrior Interview Conversation History:\n` +
          history
            .map((m) =>
              m.role === "user"
                ? `Marketer: "${m.text}"`
                : `${gamerTag}: "${m.text}"`
            )
            .join("\n")
        : "";

    const system = `${def.systemPrompt}

You are in a live 1-on-1 interrogation session with 2K's VP of Growth Marketing and Live Services Analytics team.
Your gamer tag is "${gamerTag}" (Age: ${age}).
The proposed offer is: "${offerTitle}" at $${priceUsd.toFixed(2)}.
${counterfactualEvent ? `Active What-If Patch / Bonus Injection: "${counterfactualEvent}".` : ""}

Your Live TakeTwoPlayerGraph Telemetry:
- Archetype: ${archetypeLabel(archetypeId)} (${archetypeId})
- MyPLAYER Build: ${myplayerOvr} OVR ${myplayerBuild}
- 90-Day VC Spend: $${vcSpend90d} (Lifetime Spend: $${lifetimeSpendUsd.toFixed(0)} · VC Balance: ${Number(vcBalance).toLocaleString()} VC)
- Recent Loss Streak: ${lossStreak} games · 7-Day Rage Quits: ${rageQuits7d}
- Crew Affiliation: ${crewName} (${crewTier} · Role: ${crewRole})
- Followed 2K Creator: ${creatorHandle}
- Churn Risk Score: ${(churnRiskScore * 100).toFixed(0)}%

Your Focus Group Simulation Episodic Memory (Stay 100% consistent with your decisions and quotes):
- Round 1 (Isolated Gut Reaction): Verdict = ${r1State}${r1Quote ? ` · Your Quote: "${r1Quote}"` : ""}
- Round 2 (Social Contagion Shift): Verdict = ${r2State}${r2Quote ? ` · Your Quote: "${r2Quote}"` : ""}
- Did You Flip in Round 2?: ${contagionFlipped ? `YES (Driven by ${contagionDriver} via ${contagionSourceTag})` : `NO (Held ${r2State})`}
${r3State ? `- Round 3 (What-If Counterfactual Rescue): Verdict = ${r3State}${r3Quote ? ` · Your R3 Quote: "${r3Quote}"` : ""}` : ""}
- Your Maximum Willingness to Pay (WTP): $${wtpUsd.toFixed(2)} USD

CRITICAL INDIVIDUAL VOICE, LENGTH & CADENCE RULE (STRICTLY ENFORCED):
- Cadence Tier: ${voiceProfile.cadenceTier}
- Target Length: ${voiceProfile.wordCountRange} (${voiceProfile.sentenceTarget})
- Typing & Punctuation Style: ${voiceProfile.typingStyle}
- Directive: ${voiceProfile.promptDirective}
- DO NOT write a generic 2-3 sentence answer if your profile is ULTRA_CLIPPED or CASUAL_ONE_LINER; conversely, if your profile is DEEP_ANALYST_BREAKDOWN, give your full 28–51 word analytical breakdown with exact numbers!
- Never use corporate marketing jargon, never use em-dashes, and never reference outside non-2K franchises.`;

    const prompt = `${historyTranscript}

The marketing team asks you:
"${question}"

Respond directly in character as ${gamerTag}, strictly obeying your ${voiceProfile.wordCountRange} (${voiceProfile.sentenceTarget}) length and typing style:`;

    const res = await generateText({
      role: "FAST",
      system,
      prompt,
      temperature: 0.7,
      thinkingBudget: 0,
      maxOutputTokens: 320,
    });

    return NextResponse.json({
      mode: "single",
      answer: res.text.trim().replace(/—/g, "·"),
      gamer_tag: gamerTag,
      spanner_enriched: spannerEnriched,
      model_used: res.modelUsed,
      latency_ms: res.latencyMs,
    });
  } catch (error: any) {
    console.error("[Interrogate Error]:", error);
    return NextResponse.json(
      {
        error: "Persona interrogation failed",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
