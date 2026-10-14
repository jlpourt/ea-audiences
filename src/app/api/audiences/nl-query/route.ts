import { NextRequest, NextResponse } from "next/server";
import { generateText } from "@/lib/gcp/genai-client";
import { MODELS } from "@/lib/models";
import { NL_TO_GQL_SYSTEM_PROMPT } from "@/lib/prompts/nl_to_gql";
import {
  runSpannerGraphQuery,
  SpannerUnavailableError,
  extractWhereClause,
  extractMatchClause,
} from "@/lib/gcp/spanner-client";
import {
  getCatalog,
  GRAPH_NAME,
  HUB_ID_BY_FRANCHISE,
  FRANCHISE_COLORS,
  LABEL_COLORS,
} from "@/lib/gcp/catalog";
import { archetypeColor } from "@/lib/archetypes";
import { GraphNode, GraphLink, MultiHopPathInfo, TakeTwoLabel } from "@/lib/types";

export const dynamic = "force-dynamic";

export interface ParsedCondition {
  id: string;
  field: string;
  op: string;
  value: string;
  label: string;
  rawFragment: string;
}

const ALLOWED_IDENTIFIER_PATTERNS = [
  /^(?:p|mate|c|cl|cr|clan|i|id|g|g[0-9]+|game|p2|p_sub)\.[a-z0-9_]+$/i,
  /^(?:p|mate|p2|p_sub)\.game_telemetry\.[a-z0-9_]+$/i,
];

class GqlTranslationError extends Error {
  readonly modelUsed?: string;
  readonly rawOutput?: string;
  constructor(message: string, modelUsed?: string, rawOutput?: string) {
    super(message);
    this.name = "GqlTranslationError";
    this.modelUsed = modelUsed;
    this.rawOutput = rawOutput;
  }
}

function validateGqlSafety(gql: string): { ok: boolean; reason?: string } {
  const forbidden = /\b(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)\b/i;
  if (forbidden.test(gql)) {
    return { ok: false, reason: "Mutating statements are not permitted." };
  }
  const propRefs =
    gql.match(/\b(?:p|mate|c|cl|cr|clan|i|id|g|g[0-9]+|game|p2|p_sub)\.[a-zA-Z0-9_.]+/g) || [];
  for (const ref of propRefs) {
    if (!ALLOWED_IDENTIFIER_PATTERNS.some((re) => re.test(ref))) {
      return { ok: false, reason: `Disallowed identifier '${ref}' in generated GQL.` };
    }
  }
  return { ok: true };
}

function humanizePredicate(fragment: string, idx: number): ParsedCondition {
  const clean = fragment.trim();
  let field = "predicate";
  let op = "=";
  let value = clean;
  let label = clean;

  if (/myplayer_ovr/i.test(clean)) {
    const m = clean.match(/([<>]=?|=)\s*(\d+)/);
    field = "myplayer_ovr";
    op = m?.[1] || "<";
    value = m?.[2] || "85";
    label = `MyPLAYER OVR ${op} ${value}`;
  } else if (/myteam_galaxy_opal_count/i.test(clean)) {
    const m = clean.match(/([<>]=?|=)\s*(\d+)/);
    field = "myteam_galaxy_opal_count";
    op = m?.[1] || ">=";
    value = m?.[2] || "10";
    label = `Galaxy Opals ${op} ${value}`;
  } else if (/myteam_vc_spend_90d/i.test(clean)) {
    const m = clean.match(/([<>]=?|=)\s*(\d+(?:\.\d+)?)/);
    field = "myteam_vc_spend_90d";
    op = m?.[1] || ">";
    value = m?.[2] || "0";
    label = `MyTEAM VC Spend ${op} $${value}`;
  } else if (/vc_spend_90d/i.test(clean)) {
    const m = clean.match(/([<>]=?|=)\s*(\d+(?:\.\d+)?)/);
    field = "vc_spend_90d";
    op = m?.[1] || ">=";
    value = m?.[2] || "50";
    label = `90d VC Spend ${op} $${value}`;
  } else if (/mate\.game_telemetry\.last_login_days_ago/i.test(clean)) {
    const m = clean.match(/([<>]=?|=)\s*(\d+)/);
    field = "mate_last_login";
    op = m?.[1] || "<=";
    value = m?.[2] || "3";
    label = `Crew Mate Active <= ${value}d`;
  } else if (/last_login_days_ago/i.test(clean) && !/churn_risk_score/i.test(clean)) {
    const m = clean.match(/([<>]=?|=)\s*(\d+)/);
    field = "last_login_days_ago";
    op = m?.[1] || ">=";
    value = m?.[2] || "7";
    label = `Inactive ${op} ${value}d`;
  } else if (/season_pass_edition/i.test(clean)) {
    const m = clean.match(/'([^']+)'/);
    field = "season_pass_edition";
    op = "=";
    value = m?.[1] || "HALL_OF_FAME";
    label = `Season Pass: ${value.replace(/_/g, " ")}`;
  } else if (/nba2k26_spend_usd/i.test(clean)) {
    const m = clean.match(/([<>]=?|=)\s*(\d+(?:\.\d+)?)/);
    field = "nba2k26_spend_usd";
    op = m?.[1] || ">";
    value = m?.[2] || "0";
    label = `NBA 2K26 Spend ${op} $${value}`;
  } else if (/migrated_to_2k27|game-nba2k26/i.test(clean)) {
    field = "migrated_to_2k27";
    op = "=";
    value = "false";
    label = "NBA 2K26 Holdout (No 2K27 Upgrade)";
  } else if (/nba2k26_veteran/i.test(clean)) {
    field = "nba2k26_veteran";
    op = "=";
    value = "true";
    label = "NBA 2K26 Veteran Account";
  } else if (/cross_2k_titles/i.test(clean)) {
    const m = clean.match(/([<>]=?|=)\s*(\d+)/);
    field = "cross_2k_titles";
    op = m?.[1] || ">=";
    value = m?.[2] || "2";
    label = `Cross-2K Titles ${op} ${value}`;
  } else if (/g\.franchise\s+IN/i.test(clean)) {
    field = "cross_2k_franchise";
    op = "IN";
    value = "WWE2K, PGA2K, BL4, CIV7";
    label = "2K Cross-Franchise (WWE / PGA / BL4 / Civ)";
  } else if (/c\.franchise/i.test(clean)) {
    field = "creator_franchise";
    op = "=";
    value = "NBA2K";
    label = "Follows NBA 2K Creator Squad";
  } else if (/dma_market/i.test(clean)) {
    const m = clean.match(/'%?([^'%]+)%?'/);
    field = "dma_market";
    op = "LIKE";
    value = m?.[1] || "NBA Market";
    label = `Market: ${value}`;
  } else if (/primary_franchise/i.test(clean)) {
    const m = clean.match(/'([^']+)'/);
    field = "primary_franchise";
    op = "=";
    value = m?.[1] || "NBA2K";
    label = `Franchise: ${value}`;
  } else if (/lifetime_spend_usd/i.test(clean)) {
    const m = clean.match(/([<>]=?|=)\s*(\d+(?:\.\d+)?)/);
    field = "lifetime_spend_usd";
    op = m?.[1] || ">=";
    value = m?.[2] || "100";
    label = `Lifetime Spend ${op} $${value}`;
  } else if (/churn_risk_score/i.test(clean) && /last_login_days_ago/i.test(clean)) {
    field = "velocity_decay";
    op = ">=";
    value = "0.45";
    label = "Churn Risk >= 0.45 or Inactive >= 5d";
  } else if (/churn_risk_score/i.test(clean)) {
    const m = clean.match(/([<>]=?|=)\s*(\d+(?:\.\d+)?)/);
    field = "churn_risk_score";
    op = m?.[1] || ">=";
    value = m?.[2] || "0.7";
    label = `Churn Risk ${op} ${value}`;
  } else if (/recent_loss_streak/i.test(clean)) {
    const m = clean.match(/recent_loss_streak\s*([<>]=?|=)\s*(\d+)/i);
    field = "recent_loss_streak";
    op = m?.[1] || ">=";
    value = m?.[2] || "2";
    label = /rage_quits_7d/i.test(clean)
      ? `Loss Streak ${op} ${value} or Tilt Risk`
      : `Loss Streak ${op} ${value}`;
  } else if (/tilt_sensitivity|rage_quits_7d/i.test(clean)) {
    field = "rage_quits_7d";
    op = ">=";
    value = "high";
    label = "High Rage-Quit Index";
  }

  return {
    id: `cond-${idx}-${field}`,
    field,
    op,
    value,
    label,
    rawFragment: clean,
  };
}

function parseConditionsFromWhere(whereClause: string): ParsedCondition[] {
  if (!whereClause) return [];
  // Split top-level ANDs without splitting inside NOT EXISTS { ... }
  const parts: string[] = [];
  let depth = 0;
  let last = 0;
  for (let i = 0; i < whereClause.length; i++) {
    const ch = whereClause[i];
    if (ch === "{" || ch === "(") depth++;
    else if (ch === "}" || ch === ")") depth = Math.max(0, depth - 1);
    else if (
      depth === 0 &&
      /^\s+AND\s+/i.test(whereClause.slice(i))
    ) {
      const andMatch = whereClause.slice(i).match(/^\s+AND\s+/i)!;
      parts.push(whereClause.slice(last, i).trim());
      i += andMatch[0].length - 1;
      last = i + 1;
    }
  }
  parts.push(whereClause.slice(last).trim());

  return parts
    .filter((p) => p && !/p\.player_id\s*(?:<>|!=)\s*mate\.player_id/i.test(p))
    .map((p, idx) => humanizePredicate(p, idx));
}

/**
 * Deterministic fast-path for the 3 Golden Plays + 2K Cross-Franchise Pollination + Creator Squads,
 * with full Gemini 3.5 Flash translation for arbitrary queries.
 */
function matchGoldenPlay(
  query: string,
  franchise: string
): {
  gql_query: string;
  explanation: string;
  dominant_archetype: string;
} | null {
  const q = query.toLowerCase();
  const dmaMatch = query.match(/in\s+([A-Za-z\s]+)\s+DMA/i);
  const sanitizedDma = dmaMatch ? dmaMatch[1].replace(/[^a-zA-Z0-9 ]/g, "").trim() : "";
  const dmaClause = sanitizedDma
    ? `\n  AND p.dma_market LIKE '%${sanitizedDma}%'`
    : "";

  // Play 1 — Season 1 → 2 Build Cliff Rescue
  if (
    (q.includes("85 ovr") || q.includes("84 ovr") || q.includes("below 85") || q.includes("under 85") || q.includes("cliff")) &&
    (q.includes("crew") || q.includes("teammate") || q.includes("7 days") || q.includes("7+ days") || q.includes("inactivity") || q.includes("stalled"))
  ) {
    return {
      gql_query: `GRAPH ${GRAPH_NAME}
MATCH (p:Player)-[:MEMBER_OF_CLAN]->(c:Clan)<-[:MEMBER_OF_CLAN]-(mate:Player)
WHERE p.primary_franchise = 'NBA2K'
  AND INT64(p.game_telemetry.myplayer_ovr) < 85
  AND FLOAT64(p.game_telemetry.vc_spend_90d) >= 50
  AND INT64(p.game_telemetry.last_login_days_ago) >= 7
  AND INT64(mate.game_telemetry.last_login_days_ago) <= 3${dmaClause}
  AND p.player_id <> mate.player_id
RETURN p.player_id`,
      explanation:
        "2-hop Crew traversal isolating stalled NBA 2K27 MyCAREER builds (<85 OVR, $50+ VC spend, 7+ days inactive) whose Rec/Pro-Am Crew teammates logged in within the last 72 hours for the $4.99 Crew Re-Up Bundle.",
      dominant_archetype: "MYCAREER_STORY_CASUAL",
    };
  }

  // Play 3 — MyTEAM Galaxy Opal Pack Whales
  if (
    q.includes("galaxy opal") ||
    (q.includes("myteam") && (q.includes("hall of fame") || q.includes("whale") || q.includes("10+")))
  ) {
    return {
      gql_query: `GRAPH ${GRAPH_NAME}
MATCH (p:Player)
WHERE INT64(p.game_telemetry.myteam_galaxy_opal_count) >= 10
  AND STRING(p.game_telemetry.season_pass_edition) = 'HALL_OF_FAME'${dmaClause}
RETURN p.player_id`,
      explanation:
        "Isolates high-velocity NBA 2K27 MyTEAM collectors holding 10+ Galaxy Opal cards and the Hall of Fame Season Pass.",
      dominant_archetype: "MYTEAM_PACK_WHALE",
    };
  }

  // Creator Squads & Halo (Agent 00, Troydan, CashNasty, Kenny Beecham / KOT4Q, DBG, Tydebo)
  if (
    q.includes("creator") ||
    q.includes("agent 00") ||
    q.includes("agent00") ||
    q.includes("troydan") ||
    q.includes("cashnasty") ||
    q.includes("kenny beecham") ||
    q.includes("kot4q") ||
    q.includes("dbg") ||
    q.includes("tydebo")
  ) {
    return {
      gql_query: `GRAPH ${GRAPH_NAME}
MATCH (p:Player)-[:FOLLOWS_CREATOR]->(c:Creator)
WHERE c.franchise = 'NBA2K'
  AND p.lifetime_spend_usd >= 200${dmaClause}
RETURN p.player_id`,
      explanation:
        "2-hop Creator Squad traversal isolating high-LTV NBA 2K27 players ($200+ lifetime spend) following Agent 00, Troydan, CashNasty, Kenny Beecham / KOT4Q, DBG, and Tydebo.",
      dominant_archetype: "BUILD_LAB_THEORYCRAFTER",
    };
  }

  // 2K Cross-Franchise Pollination (explicitly asking for WWE 2K25, PGA TOUR 2K25, Borderlands 4, Civilization VII without 2K26 holdout/upgrade)
  if (
    !q.includes("2k26") &&
    !q.includes("holdout") &&
    !q.includes("loyalty") &&
    !q.includes("veteran") &&
    !q.includes("upgrade") &&
    (q.includes("wwe") ||
      q.includes("pga") ||
      q.includes("topspin") ||
      q.includes("borderlands") ||
      q.includes("bl4") ||
      q.includes("civ") ||
      q.includes("mafia") ||
      q.includes("cross-franchise") ||
      q.includes("crossplay") ||
      q.includes("cross-play"))
  ) {
    return {
      gql_query: `GRAPH ${GRAPH_NAME}
MATCH (p:Player)-[:HAS_IDENTITY]->(i:Identity {platform: '2K Account'}),
      (p)-[:PLAYS_GAME]->(g:Game)
WHERE g.franchise IN ('WWE2K', 'PGA2K', 'TOPSPIN', 'BL4', 'CIV7', 'MAFIA')
  AND p.lifetime_spend_usd >= 150${dmaClause}
RETURN p.player_id`,
      explanation:
        "Multi-hop 2K Account traversal connecting NBA 2K27 players across WWE 2K25, PGA TOUR 2K25, TopSpin 2K25, Borderlands 4, Civilization VII, and Mafia: The Old Country.",
      dominant_archetype: "CROSS_LABEL_NOMAD",
    };
  }

  // Concordia Crew Tipping Point (>=60% Crew in 2K27)
  if (
    q.includes("tipping point") ||
    q.includes("3/5") ||
    q.includes("concordia")
  ) {
    return {
      gql_query: `GRAPH ${GRAPH_NAME}
MATCH (p:Player)-[:MEMBER_OF_CLAN]->(c:Clan)<-[:MEMBER_OF_CLAN]-(mate:Player)
WHERE BOOL(p.game_telemetry.nba2k26_veteran) = true
  AND BOOL(p.game_telemetry.migrated_to_2k27) = false
  AND INT64(mate.game_telemetry.last_login_days_ago) <= 3${dmaClause}
  AND p.player_id <> mate.player_id
RETURN p.player_id`,
      explanation:
        "2-hop Concordia Crew Tipping-Point traversal isolating NBA 2K26 holdout veterans whose Rec/Pro-Am Crew mates are actively playing NBA 2K27 (3.4x social conversion multiplier with zero discount).",
      dominant_archetype: "REC_CREW_CAPTAIN",
    };
  }

  // Whale Velocity Decay Guard (Lainie Goldstein Q4 FY26 Call)
  if (
    q.includes("velocity decay") ||
    q.includes("whale exhaustion") ||
    q.includes("whale decay") ||
    q.includes("spending velocity")
  ) {
    return {
      gql_query: `GRAPH ${GRAPH_NAME}
MATCH (p:Player)
WHERE p.primary_franchise = 'NBA2K'
  AND p.lifetime_spend_usd >= 350
  AND (p.churn_risk_score >= 0.45 OR INT64(p.game_telemetry.last_login_days_ago) >= 5)${dmaClause}
RETURN p.player_id`,
      explanation:
        "TimesFM 3.0 velocity-decay segment isolating front-loaded NBA 2K27 high spenders ($350+ LTV) showing mid-season engagement deceleration (Lainie Goldstein Q4 FY26 guard).",
      dominant_archetype: "MYTEAM_PACK_WHALE",
    };
  }

  // D2C Web Store Margin Arbitrage (Strauss Zelnick 1B+ Graph / Chartboost)
  if (
    q.includes("d2c") ||
    q.includes("web store") ||
    q.includes("margin arbitrage") ||
    q.includes("direct-to-consumer")
  ) {
    return {
      gql_query: `GRAPH ${GRAPH_NAME}
MATCH (p:Player)-[:HAS_IDENTITY]->(i:Identity {platform: '2K Account'})
WHERE p.lifetime_spend_usd >= 400
  AND FLOAT64(p.game_telemetry.vc_spend_90d) >= 120${dmaClause}
RETURN p.player_id`,
      explanation:
        "2K Account D2C Web Store arbitrage cohort isolating high-velocity recurrent VC spenders ($400+ LTV) where holding promos and routing to the 2K Web Store expands gross margin by +22%.",
      dominant_archetype: "MYTEAM_PACK_WHALE",
    };
  }

  // Build-Meta Rebirth & Progression Frustration (Dennis Ceccarelli / 2K Applied AI)
  if (
    q.includes("build-meta") ||
    q.includes("rebirth") ||
    q.includes("meta frustration") ||
    q.includes("reactive frustration") ||
    q.includes("loss streak")
  ) {
    return {
      gql_query: `GRAPH ${GRAPH_NAME}
MATCH (p:Player)
WHERE p.primary_franchise = 'NBA2K'
  AND INT64(p.game_telemetry.myplayer_ovr) < 86
  AND FLOAT64(p.game_telemetry.vc_spend_90d) >= 50
  AND (p.recent_loss_streak >= 2 OR INT64(p.game_telemetry.rage_quits_7d) >= 1)${dmaClause}
RETURN p.player_id`,
      explanation:
        "Dennis Ceccarelli Reactive Journey trigger isolating sub-86 OVR MyCAREER builds with $50+ sunk VC experiencing matchmaking loss streaks or tilt—targeted with a Rebirth Badge Boost.",
      dominant_archetype: "BUILD_LAB_THEORYCRAFTER",
    };
  }

  // Play 2 — NBA 2K26 → 2K27 Holdout & Cross-2K Upgrade Bridge
  if (
    q.includes("2k26") ||
    q.includes("upgrade") ||
    q.includes("holdout") ||
    q.includes("loyalty") ||
    q.includes("veteran") ||
    q.includes("cross-franchise") ||
    q.includes("wwe") ||
    q.includes("pga") ||
    q.includes("borderlands") ||
    q.includes("civ")
  ) {
    return {
      gql_query: `GRAPH ${GRAPH_NAME}
MATCH (p:Player)-[:HAS_IDENTITY]->(i:Identity {platform: '2K Account'}),
      (p)-[:PLAYS_GAME]->(g:Game {game_id: 'game-nba2k26'})
WHERE BOOL(p.game_telemetry.nba2k26_veteran) = true
  AND FLOAT64(p.game_telemetry.nba2k26_spend_usd) > 0
  AND BOOL(p.game_telemetry.migrated_to_2k27) = false
  AND FLOAT64(p.game_telemetry.myteam_vc_spend_90d) > 0${dmaClause}
RETURN p.player_id`,
      explanation:
        "3-hop 2K Account traversal bridging high-value NBA 2K26 veterans and cross-2K spenders who have not yet claimed the NBA 2K26 → 2K27 Hall of Fame Loyalty Upgrade + 100K VC.",
      dominant_archetype: "CROSS_LABEL_NOMAD",
    };
  }

  // DMA Market fast-path when dispatched from NBAMarketMap
  if (sanitizedDma) {
    const spendClause = q.includes("100+") || q.includes("high-spend")
      ? `\n  AND p.lifetime_spend_usd >= 100`
      : "";
    return {
      gql_query: `GRAPH ${GRAPH_NAME}
MATCH (p:Player)
WHERE p.dma_market LIKE '%${sanitizedDma}%'${spendClause}
RETURN p.player_id`,
      explanation: `Isolates active NBA 2K27, NBA 2K26, and 2K Sports players clustered in the ${sanitizedDma} DMA market.`,
      dominant_archetype: "PARK_REP_GRINDER",
    };
  }

  return null;
}

async function executeAudienceQuery(
  query: string,
  franchise: string,
  excludeConditionIds: string[] = []
) {
  const translateStart = Date.now();
  let gqlQuery = "";
  let explanation = "";
  let modelUsed = MODELS.FAST.id;

  const golden = matchGoldenPlay(query, franchise);
  if (golden) {
    gqlQuery = golden.gql_query;
    explanation = golden.explanation;
    modelUsed = "spanner-gql-fastpath";
  } else {
    let gen;
    try {
      gen = await generateText({
        role: "FAST",
        system: NL_TO_GQL_SYSTEM_PROMPT,
        prompt: `Translate this 2K Courtside audience request into 2K Identity Graph GQL on TakeTwoPlayerGraph.
Franchise Scope: ${franchise || "ALL"}
User Request: "${query}"`,
        json: true,
        thinkingBudget: 0,
      });
    } catch (err: any) {
      throw new GqlTranslationError(
        `2K Intelligence Engine NL-to-GQL generation failed: ${err?.message || String(err)}`,
        modelUsed
      );
    }
    modelUsed = gen.modelUsed;
    let parsed: any;
    try {
      const cleaned = gen.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (err: any) {
      throw new GqlTranslationError(
        `Failed to parse 2K Intelligence Engine NL-to-GQL JSON response (${modelUsed}): ${err?.message || String(err)}`,
        modelUsed,
        gen.text
      );
    }
    gqlQuery = String(parsed?.gql_query || "").trim();
    explanation = String(parsed?.explanation || "").trim();
    if (!gqlQuery) {
      throw new GqlTranslationError(
        `2K Intelligence Engine NL-to-GQL response (${modelUsed}) did not include a valid gql_query.`,
        modelUsed,
        gen.text
      );
    }
  }
  const translateMs = Date.now() - translateStart;

  // Apply excludeConditions if any chip was removed by the user
  let matchClause = extractMatchClause(gqlQuery);
  let whereClause = extractWhereClause(gqlQuery);
  const allConditions = parseConditionsFromWhere(whereClause);

  if (excludeConditionIds.length > 0) {
    const excludeSet = new Set(excludeConditionIds);
    const remaining = allConditions.filter(
      (c) => !excludeSet.has(c.id) && !excludeSet.has(c.field) && !excludeSet.has(c.label)
    );
    const needsCrewMateJoin = /\bmate\b/.test(matchClause);
    const mateGuard = needsCrewMateJoin ? ["p.player_id <> mate.player_id"] : [];
    whereClause = [...remaining.map((c) => c.rawFragment), ...mateGuard].join(" AND ");
    gqlQuery = `GRAPH ${GRAPH_NAME}\nMATCH ${matchClause}\n${
      whereClause ? `WHERE ${whereClause}\n` : ""
    }RETURN p.player_id`;
  }

  const safety = validateGqlSafety(gqlQuery);
  if (!safety.ok) {
    throw new Error(safety.reason || "Invalid GQL query.");
  }

  const spannerRes = await runSpannerGraphQuery(gqlQuery, 520);
  const { games, creators } = await getCatalog();
  const gameById = new Map(games.map((g) => [g.game_id, g]));
  const creatorById = new Map(creators.map((c) => [c.creator_id, c]));

  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const nodeIds = new Set<string>();

  const addNode = (n: GraphNode) => {
    if (nodeIds.has(n.id)) return;
    nodeIds.add(n.id);
    nodes.push(n);
  };

  // Add franchise / game hub nodes referenced by matched players
  const activeFranchises = new Set<string>();
  for (const r of spannerRes.rows) {
    activeFranchises.add(r.primary_franchise);
  }
  if (activeFranchises.size === 0) activeFranchises.add("NBA2K");

  Array.from(activeFranchises).forEach((f, idx) => {
    const hubId = HUB_ID_BY_FRANCHISE[f] || "game-nba2k27";
    const g = gameById.get(hubId);
    const lbl = (g?.label || "2K") as TakeTwoLabel;
    const angle = (idx / Math.max(1, activeFranchises.size)) * Math.PI * 2;
    addNode({
      id: hubId,
      name: g?.title || f,
      type: "GAME",
      franchise: f,
      label: lbl,
      val: 34,
      color: FRANCHISE_COLORS[f] || LABEL_COLORS[lbl],
      fx: activeFranchises.size === 1 ? 0 : Math.cos(angle) * 220,
      fy: activeFranchises.size === 1 ? -140 : Math.sin(angle) * 180,
    });
  });

  // Add matched player nodes
  for (const r of spannerRes.rows) {
    const primaryLabel: TakeTwoLabel =
      r.primary_franchise === "WWE2K" ||
      r.primary_franchise === "PGA2K" ||
      r.primary_franchise === "TOPSPIN"
        ? "2K_SPORTS"
        : r.primary_franchise === "BL4" ||
            r.primary_franchise === "CIV7" ||
            r.primary_franchise === "MAFIA"
          ? "2K_CORE"
          : "2K";

    addNode({
      id: r.player_id,
      name: r.gamer_tag || r.display_name,
      type: "PLAYER",
      franchise: r.primary_franchise,
      label: primaryLabel,
      archetype: r.primary_archetype,
      spend: r.lifetime_spend_usd,
      churn_risk: r.churn_risk_score,
      tilt: r.tilt_sensitivity,
      loss_streak: r.recent_loss_streak,
      gravity_score: Number(r.game_telemetry?.gravity_score ?? 0),
      game_telemetry: r.game_telemetry,
      purchased_items: r.purchased_items,
      followed_creators: r.followed_creators,
      primary_creator_influence: r.primary_creator_influence ?? undefined,
      country: r.country ?? undefined,
      country_code: r.country_code ?? undefined,
      country_flag: r.country_flag ?? undefined,
      dma_market: r.dma_market ?? undefined,
      lat: r.lat ?? undefined,
      lng: r.lng ?? undefined,
      val: Math.max(6, Math.min(18, Math.sqrt(r.lifetime_spend_usd || 30) * 0.45)),
      color: archetypeColor(r.primary_archetype),
    });

    const hubId = HUB_ID_BY_FRANCHISE[r.primary_franchise] || "game-nba2k27";
    if (nodeIds.has(hubId)) {
      links.push({
        source: r.player_id,
        target: hubId,
        value: 1.2,
      });
    }
  }

  // Synthesize Multi-Hop Bridge Nodes & Edges (Crews, Active Teammates, 2K Account, NBA 2K26, Loyalty Offer, Creators)
  let multiHopMetadata: MultiHopPathInfo | undefined;
  const bridgeRows = spannerRes.bridgeRows || [];

  if (spannerRes.isMultiHop && bridgeRows.length > 0) {
    const bridgeNames = new Set<string>();

    for (const br of bridgeRows.slice(0, 180)) {
      if (!nodeIds.has(br.player_id)) continue;

      if (br.clan_id) {
        addNode({
          id: br.clan_id,
          name: `${br.clan_name || br.clan_id} (${br.clan_tier || "Crew"})`,
          type: "CLAN",
          franchise: "NBA2K",
          isMultiHopBridge: true,
          hopStep: 1,
          val: 20,
          color: "#19C37D",
        });
        bridgeNames.add(br.clan_name || br.clan_id);
        links.push({
          source: br.player_id,
          target: br.clan_id,
          label: "MEMBER_OF_CLAN",
          isMultiHopBridge: true,
          hopStep: 1,
          value: 2,
          color: "#19C37D",
        });

        if (br.mate_id) {
          addNode({
            id: br.mate_id,
            name: `${br.mate_tag || br.mate_id} (Active Crew Mate)`,
            type: "SQUADMATE",
            franchise: br.mate_franchise || "NBA2K",
            isMultiHopBridge: true,
            hopStep: 2,
            val: 11,
            color: "#19C37D",
          });
          links.push({
            source: br.clan_id,
            target: br.mate_id,
            label: "Active Crew Mate",
            isMultiHopBridge: true,
            hopStep: 2,
            value: 1.8,
            color: "#19C37D",
          });
        }

        // Recommended Offer node for Play 1: $4.99 Crew Re-Up Bundle
        const crewOfferId = "off-crew-reup-bundle";
        addNode({
          id: crewOfferId,
          name: "$4.99 Crew Re-Up Bundle",
          type: "OFFER",
          franchise: "NBA2K",
          label: "2K",
          isMultiHopBridge: true,
          hopStep: 3,
          val: 24,
          color: "#F5B400",
          fx: 320,
          fy: -120,
        });
        bridgeNames.add("$4.99 Crew Re-Up Bundle");
      }

      if (br.identity_id) {
        const platHubId = `ident-hub-${(br.identity_platform || "2k-account")
          .toLowerCase()
          .replace(/\s+/g, "-")}`;
        addNode({
          id: platHubId,
          name: br.identity_platform || "2K Account",
          type: "IDENTITY",
          platform: br.identity_platform || "2K Account",
          label: "2K",
          isMultiHopBridge: true,
          hopStep: 1,
          val: 28,
          color: "#F5B400",
          fx: 240,
          fy: -40,
        });
        bridgeNames.add(br.identity_platform || "2K Account");
        links.push({
          source: br.player_id,
          target: platHubId,
          label: "HAS_IDENTITY",
          isMultiHopBridge: true,
          hopStep: 1,
          value: 2,
          color: "#F5B400",
        });

        if (br.target_game_id) {
          const targetFranchise = br.target_game_franchise || "NBA2K26";
          const targetLabel = (br.target_game_label as TakeTwoLabel) || "2K";
          addNode({
            id: br.target_game_id,
            name: br.target_game_title || "NBA 2K26",
            type: "GAME",
            franchise: targetFranchise,
            label: targetLabel,
            isMultiHopBridge: true,
            hopStep: 2,
            val: 32,
            color: FRANCHISE_COLORS[targetFranchise] || "#FF6B35",
            fx: 380,
            fy: 80,
          });
          bridgeNames.add(br.target_game_title || "NBA 2K26");
          links.push({
            source: platHubId,
            target: br.target_game_id,
            label: "PLAYS_GAME",
            isMultiHopBridge: true,
            hopStep: 2,
            value: 2.2,
            color: FRANCHISE_COLORS[targetFranchise] || "#FF6B35",
          });

          if (br.target_game_id === "game-nba2k26") {
            const loyaltyOfferId = "off-nba2k27-loyalty-upgrade";
            const loyaltyOfferTitle =
              "NBA 2K26 → 2K27 Hall of Fame Loyalty Upgrade + 100K VC";
            addNode({
              id: loyaltyOfferId,
              name: loyaltyOfferTitle,
              type: "OFFER",
              franchise: "NBA2K",
              label: "2K",
              isMultiHopBridge: true,
              hopStep: 3,
              val: 26,
              color: "#F5B400",
              fx: 460,
              fy: 175,
            });
            bridgeNames.add(loyaltyOfferTitle);
            links.push({
              source: br.target_game_id,
              target: loyaltyOfferId,
              label: "LOYALTY_UPGRADE",
              isMultiHopBridge: true,
              hopStep: 3,
              value: 2.4,
              color: "#F5B400",
            });
          }
        }
      }

      if (br.creator_id) {
        const cr = creatorById.get(br.creator_id);
        addNode({
          id: br.creator_id,
          name: br.creator_handle || cr?.handle || br.creator_name || cr?.name || br.creator_id,
          type: "CREATOR",
          franchise: br.target_game_franchise || cr?.franchise || "NBA2K",
          platform: br.creator_platform || cr?.platform,
          creator_data: cr || {
            creator_id: br.creator_id,
            handle: br.creator_handle,
            name: br.creator_name,
            platform: br.creator_platform,
            franchise: br.target_game_franchise || "NBA2K",
          },
          isMultiHopBridge: true,
          hopStep: 1,
          val: 22,
          color: "#F5B400",
        });
        bridgeNames.add(br.creator_handle || cr?.handle || br.creator_id);
        links.push({
          source: br.player_id,
          target: br.creator_id,
          label: "FOLLOWS_CREATOR",
          isMultiHopBridge: true,
          hopStep: 1,
          value: 1.8,
          color: "#F5B400",
        });
      }
    }

    const is2K26Bridge = matchClause.includes("game-nba2k26");
    const isIdentityBridge = matchClause.includes("Identity");
    const isD2cWebStore = isIdentityBridge && !matchClause.includes("Game");
    const isConcordiaCrew =
      matchClause.includes("Clan") && /migrated_to_2k27/i.test(whereClause);
    multiHopMetadata = {
      hops: isIdentityBridge && !isD2cWebStore ? 3 : 2,
      patternLabel: is2K26Bridge
        ? "Player → 2K Account → NBA 2K26 → HoF Loyalty Upgrade (+100K VC)"
        : isD2cWebStore
          ? "Player → 2K Account → 2K D2C Web Store (+22% Gross Margin)"
          : isIdentityBridge
            ? "Player → 2K Account → 2K Cross-Franchise Portfolio (WWE / PGA / BL4 / Civ VII)"
            : isConcordiaCrew
              ? "NBA 2K26 Holdout → Crew (MEMBER_OF_CLAN) → Active 2K27 Crew Mate (3.4x Tipping Point)"
              : matchClause.includes("Clan")
                ? "Player → Crew (MEMBER_OF_CLAN) → Active Crew Mate → $4.99 Crew Re-Up Bundle"
                : "Player → NBA 2K Creator Squad Halo (Agent 00 / Troydan / KOT4Q / DBG)",
      summary: explanation,
      steps: is2K26Bridge
        ? [
            "NBA 2K26 Veteran & MyTEAM Spender",
            "2K Account Identity Spine",
            "NBA 2K26 → 2K27 Hall of Fame Loyalty Upgrade + 100K VC",
          ]
        : isD2cWebStore
          ? [
              "High-Velocity Recurrent VC Spender ($400+ LTV)",
              "2K Account Identity Spine",
              "2K D2C Web Store Margin Arbitrage (+22% Margin)",
            ]
          : isIdentityBridge
            ? [
                "NBA 2K27 Core Player",
                "2K Account Identity Spine",
                "WWE 2K25 / PGA TOUR 2K25 / Borderlands 4 / Civ VII",
              ]
            : isConcordiaCrew
              ? [
                  "NBA 2K26 Holdout Veteran",
                  "Rec / Pro-Am Crew Roster (≥60% Tipping Point)",
                  "Active NBA 2K27 Crew Mate (3.4x Conversion Multiplier)",
                ]
              : matchClause.includes("Clan")
                ? [
                    "Stalled MyCAREER Build (<85 OVR)",
                    "Rec / Pro-Am Crew Roster",
                    "Active Crew Mate (<=3d) + $4.99 Crew Re-Up Bundle",
                  ]
                : [
                    "High-LTV NBA 2K27 Player",
                    "FOLLOWS_CREATOR Edge",
                    "Creator Squad (Agent 00, Troydan, CashNasty, KOT4Q, DBG, Tydebo)",
                  ],
      bridgeNodes: Array.from(bridgeNames).slice(0, 8),
    };
  }

  const activeConditions = parseConditionsFromWhere(spannerRes.whereClause);

  // Compute deterministic, real-data-driven Causal Pruning & D2C Margin Waterfall from spannerRes.rows
  const scaleFactor =
    spannerRes.totalMatched / Math.max(1, spannerRes.rows.length);
  let sleepingDogsRaw = 0;
  let sureThingsD2cRaw = 0;
  let keystoneCaptainsRaw = 0;
  let persuadablesRaw = 0;

  for (const r of spannerRes.rows) {
    if (
      r.tilt_sensitivity >= 0.58 ||
      r.recent_loss_streak >= 3 ||
      r.primary_archetype === "MYNBA_FRANCHISE_SIM"
    ) {
      sleepingDogsRaw++;
    } else if (
      r.lifetime_spend_usd >= 420 ||
      r.primary_archetype === "MYTEAM_PACK_WHALE" ||
      r.game_telemetry?.season_pass_edition === "HALL_OF_FAME"
    ) {
      sureThingsD2cRaw++;
    } else if (
      r.primary_archetype === "REC_CREW_CAPTAIN" ||
      r.primary_archetype === "PARK_REP_GRINDER"
    ) {
      keystoneCaptainsRaw++;
    } else {
      persuadablesRaw++;
    }
  }

  let sleeping_dogs_suppressed = Math.round(sleepingDogsRaw * scaleFactor);
  let sure_things_d2c_routed = Math.round(sureThingsD2cRaw * scaleFactor);
  let keystone_captains_seeded = Math.round(keystoneCaptainsRaw * scaleFactor);
  let persuadables_targeted =
    spannerRes.totalMatched -
    sleeping_dogs_suppressed -
    sure_things_d2c_routed -
    keystone_captains_seeded;

  if (persuadables_targeted < 0) {
    const deficit = -persuadables_targeted;
    persuadables_targeted = 0;
    if (sure_things_d2c_routed >= deficit) {
      sure_things_d2c_routed -= deficit;
    } else if (keystone_captains_seeded >= deficit) {
      keystone_captains_seeded -= deficit;
    } else {
      sleeping_dogs_suppressed = Math.max(0, sleeping_dogs_suppressed - deficit);
    }
  }

  const d2c_margin_saved_usd = Math.round(
    sure_things_d2c_routed * Math.max(18, spannerRes.aggregates.avgSpend * 0.085)
  );
  const squad_var_protected_usd = Math.round(keystone_captains_seeded * 680);
  const scann_twins_added = Math.round(
    (persuadables_targeted + keystone_captains_seeded) * 0.24
  );
  const net_activated_cohort =
    persuadables_targeted +
    keystone_captains_seeded +
    sure_things_d2c_routed +
    scann_twins_added;
  const projected_incremental_lift_usd = Math.round(
    (persuadables_targeted + keystone_captains_seeded + scann_twins_added) *
      24.5 +
      d2c_margin_saved_usd
  );

  const causal_waterfall = {
    total_graph_players: 6500,
    raw_matched: spannerRes.totalMatched,
    sleeping_dogs_suppressed,
    sure_things_d2c_routed,
    d2c_margin_saved_usd,
    keystone_captains_seeded,
    squad_var_protected_usd,
    persuadables_targeted,
    scann_twins_added,
    net_activated_cohort,
    projected_incremental_lift_usd,
  };

  return {
    nodes,
    links,
    natural_language_summary:
      explanation ||
      `Matched ${spannerRes.totalMatched.toLocaleString()} players on ${GRAPH_NAME}.`,
    generated_gql: spannerRes.gqlExecuted,
    where_clause: spannerRes.whereClause,
    conditions: activeConditions,
    model_used: modelUsed,
    translate_ms: translateMs,
    execution_ms: spannerRes.executionTimeMs,
    aggregate_metrics: {
      matched_count: spannerRes.totalMatched,
      rendered_count: spannerRes.rows.length,
      is_sampled: spannerRes.totalMatched > spannerRes.rows.length,
      estimated_total: spannerRes.totalMatched,
      dominant_archetype: spannerRes.aggregates.dominantArchetype,
      avg_spend_usd: Number(spannerRes.aggregates.avgSpend.toFixed(2)),
      avg_churn_risk: Number(spannerRes.aggregates.avgChurn.toFixed(2)),
      avg_tilt: Number(spannerRes.aggregates.avgTilt.toFixed(2)),
      high_churn_count: spannerRes.aggregates.highChurnCount,
      archetype_histogram: spannerRes.aggregates.archetypeHistogram,
      is_live: true,
      spanner_source: spannerRes.source,
      is_multi_hop: spannerRes.isMultiHop,
      multi_hop_metadata: multiHopMetadata,
      causal_waterfall,
    },
  };
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wantStream = searchParams.get("stream") === "1";

  try {
    const body = await request.json();
    const query = String(body?.query || "").trim();
    const franchise = String(body?.franchise || "ALL").trim();
    const excludeConditions: string[] = Array.isArray(body?.excludeConditions)
      ? body.excludeConditions.map(String)
      : [];

    if (!query) {
      return NextResponse.json(
        { error: "Please provide a natural language audience query." },
        { status: 400 }
      );
    }

    if (!wantStream) {
      const result = await executeAudienceQuery(query, franchise, excludeConditions);
      return NextResponse.json(result);
    }

    // SSE mode (?stream=1): stream GQL lines first, then final result payload
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const result = await executeAudienceQuery(query, franchise, excludeConditions);
          const gqlLines = (result.generated_gql || "").split("\n");
          for (const line of gqlLines) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "gql_delta", delta: line + "\n" })}\n\n`
              )
            );
          }
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "result", payload: result })}\n\n`)
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                error: err instanceof Error ? err.message : String(err),
              })}\n\n`
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    if (err instanceof SpannerUnavailableError) {
      return NextResponse.json({ error: err.message, is_live: false }, { status: 503 });
    }
    if (err instanceof GqlTranslationError) {
      return NextResponse.json(
        {
          error: err.message,
          service: "2K Intelligence Engine",
          model_used: err.modelUsed,
          raw_output: err.rawOutput,
          is_live: false,
        },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}
