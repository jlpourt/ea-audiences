import { NextRequest, NextResponse } from "next/server";
import { generateText } from "@/lib/gcp/genai-client";
import { MODELS } from "@/lib/models";
import { NL_TO_GQL_SYSTEM_PROMPT } from "@/lib/prompts/nl_to_gql";
import {
  runSpannerGraphQuery,
  runRawGql,
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
import { GraphNode, GraphLink, MultiHopPathInfo, GameLabel } from "@/lib/types";
import { buildFranchiseIndex, studioForLabel } from "@/lib/studios";

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
  /^(?:p|mate|c|cl|cr|clan|i|id|g|g[0-9]+|game|p2|p_sub|m|m[0-9]+)\.[a-z0-9_]+$/i,
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
    gql.match(/\b(?:p|mate|c|cl|cr|clan|i|id|g|g[0-9]+|game|p2|p_sub|m|m[0-9]+)\.[a-zA-Z0-9_.]+/g) || [];
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
  // Subject of the predicate: the matched player (p) or the crew mate (mate).
  const isMate = /\bmate\./.test(clean);
  const who = isMate ? "Crew mate " : "";
  const whoField = isMate ? "mate_" : "";
  const daysInterval = clean.match(/INTERVAL\s+(\d+)\s+DAY/i)?.[1];

  if (/churned_at/i.test(clean)) {
    field = `${whoField}churned_at`;
    if (/IS\s+NULL/i.test(clean)) {
      op = "IS NULL";
      value = "active";
      label = isMate ? "Crew mate still active" : "Still active (not churned)";
    } else if (daysInterval) {
      op = ">=";
      value = `${daysInterval}d`;
      label = `${who}churned in last ${daysInterval}d`.replace(/^c/, "C");
    } else {
      op = "IS NOT NULL";
      value = "churned";
      label = isMate ? "Crew mate churned" : "Churned";
    }
  } else if (/\bm[0-9]*\.is_active/i.test(clean)) {
    field = "membership_active";
    op = "=";
    value = /false/i.test(clean) ? "false" : "true";
    label = value === "true" ? "Active crew membership" : "Former crew member";
  } else if (/\bm[0-9]*\.left_at/i.test(clean)) {
    field = "membership_left_at";
    op = daysInterval ? ">=" : /IS\s+NULL/i.test(clean) ? "IS NULL" : "IS NOT NULL";
    value = daysInterval ? `${daysInterval}d` : "";
    label = daysInterval
      ? `Left crew in last ${daysInterval}d`
      : op === "IS NULL"
        ? "Still in crew"
        : "Left crew";
  } else if (/session_min_7d/i.test(clean) && /session_min_prev_7d/i.test(clean)) {
    const m = clean.match(/([<>]=?)\s*(\d+(?:\.\d+)?)\s*\*?\s*\w*\.?session_min_prev_7d/i)
      || clean.match(/([<>]=?)\s*(\d+(?:\.\d+)?)/);
    field = `${whoField}session_trend`;
    op = m?.[1] || "";
    value = m?.[2] || "";
    label = `${who}sessions 7d vs prior 7d ${op} ${value}`.trim().replace(/^s/, "S");
  } else if (/myplayer_ovr/i.test(clean)) {
    const m = clean.match(/([<>]=?|=)\s*(\d+)/);
    field = "myplayer_ovr";
    op = m?.[1] || "";
    value = m?.[2] || "";
    label = `MyPLAYER OVR ${op} ${value}`;
  } else if (/myteam_galaxy_opal_count/i.test(clean)) {
    const m = clean.match(/([<>]=?|=)\s*(\d+)/);
    field = "myteam_galaxy_opal_count";
    op = m?.[1] || "";
    value = m?.[2] || "";
    label = `Galaxy Opals ${op} ${value}`;
  } else if (/myteam_vc_spend_90d/i.test(clean)) {
    const m = clean.match(/([<>]=?|=)\s*(\d+(?:\.\d+)?)/);
    field = "myteam_vc_spend_90d";
    op = m?.[1] || "";
    value = m?.[2] || "";
    label = `MyTEAM VC Spend ${op} $${value}`;
  } else if (/vc_spend_90d/i.test(clean)) {
    const m = clean.match(/([<>]=?|=)\s*(\d+(?:\.\d+)?)/);
    field = "vc_spend_90d";
    op = m?.[1] || "";
    value = m?.[2] || "";
    label = `90d VC Spend ${op} $${value}`;
  } else if (/mate\.game_telemetry\.last_login_days_ago/i.test(clean)) {
    const m = clean.match(/([<>]=?|=)\s*(\d+)/);
    field = "mate_last_login";
    op = m?.[1] || "";
    value = m?.[2] || "";
    label = /</.test(op) ? `Crew mate active in last ${value}d` : `Crew mate inactive ${op} ${value}d`;
  } else if (/last_login_days_ago/i.test(clean) && !/churn_risk_score/i.test(clean)) {
    const m = clean.match(/([<>]=?|=)\s*(\d+)/);
    field = "last_login_days_ago";
    op = m?.[1] || "";
    value = m?.[2] || "";
    label = /</.test(op) ? `Active in last ${value}d` : `Inactive ${op} ${value}d`;
  } else if (/season_pass_edition/i.test(clean)) {
    const m = clean.match(/'([^']+)'/);
    field = "season_pass_edition";
    op = "=";
    value = m?.[1] || "";
    label = `Season Pass: ${value.replace(/_/g, " ")}`;
  } else if (/nba2k26_spend_usd/i.test(clean)) {
    const m = clean.match(/([<>]=?|=)\s*(\d+(?:\.\d+)?)/);
    field = "nba2k26_spend_usd";
    op = m?.[1] || "";
    value = m?.[2] || "";
    label = `NBA 2K26 Spend ${op} $${value}`;
  } else if (/migrated_to_2k27\)?\s*=\s*false|migrated_to_2k27\s*=\s*false/i.test(clean)) {
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
    op = m?.[1] || "";
    value = m?.[2] || "";
    label = `Cross-2K Titles ${op} ${value}`;
  } else if (/g\.franchise\s+IN/i.test(clean)) {
    field = "cross_2k_franchise";
    op = "IN";
    value = (clean.match(/'([^']+)'/g) || []).map((x) => x.replace(/'/g, "")).join(", ");
    label = value ? `Plays: ${value}` : "";
  } else if (/c\.franchise/i.test(clean)) {
    field = "creator_franchise";
    op = "=";
    value = clean.match(/'([^']+)'/)?.[1] || "";
    label = value ? `Follows a ${value} creator` : "";
  } else if (/dma_market/i.test(clean)) {
    const m = clean.match(/'%?([^'%]+)%?'/);
    field = "dma_market";
    op = "LIKE";
    value = m?.[1] || "";
    label = `Market: ${value}`;
  } else if (/primary_franchise/i.test(clean)) {
    const m = clean.match(/'([^']+)'/);
    field = "primary_franchise";
    op = "=";
    value = m?.[1] || "";
    label = `Franchise: ${value}`;
  } else if (/lifetime_spend_usd/i.test(clean)) {
    const m = clean.match(/([<>]=?|=)\s*(\d+(?:\.\d+)?)/);
    field = "lifetime_spend_usd";
    op = m?.[1] || "";
    value = m?.[2] || "";
    label = `Lifetime Spend ${op} $${value}`;
  } else if (/churn_risk_score/i.test(clean) && /last_login_days_ago/i.test(clean)) {
    field = "velocity_decay";
    op = "";
    value = "";
    label = "";
  } else if (/churn_risk_score/i.test(clean)) {
    const m = clean.match(/([<>]=?|=)\s*(\d+(?:\.\d+)?)/);
    field = `${whoField}churn_risk_score`;
    op = m?.[1] || "";
    value = m?.[2] || "";
    label = `${isMate ? "Crew mate churn risk" : "Churn Risk"} ${op} ${value}`;
  } else if (/recent_loss_streak/i.test(clean)) {
    const m = clean.match(/recent_loss_streak\s*([<>]=?|=)\s*(\d+)/i);
    field = "recent_loss_streak";
    op = m?.[1] || "";
    value = m?.[2] || "";
    label = /rage_quits_7d/i.test(clean)
      ? `Loss Streak ${op} ${value} or Tilt Risk`
      : `Loss Streak ${op} ${value}`;
  } else if (/tilt_sensitivity|rage_quits_7d/i.test(clean)) {
    field = "rage_quits_7d";
    op = "";
    value = "";
    label = "";
  }

  if (!label || (!value && !/IS NULL|IS NOT NULL|= (true|false)/i.test(clean) && field !== "migrated_to_2k27" && field !== "nba2k26_veteran")) {
    label = clean.length > 64 ? `${clean.slice(0, 62)}…` : clean;
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
        "1-hop FOLLOWS_CREATOR traversal isolating high-LTV players ($200+ lifetime spend) who follow an NBA 2K creator.",
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

/**
 * Build the Multi-Hop Path card from the GQL that actually ran: node labels and
 * edge labels come from the executed MATCH pattern, and each step carries the
 * WHERE predicates bound to that variable. Nothing here is templated.
 */
const NODE_DISPLAY: Record<string, string> = {
  Player: "Player",
  Clan: "Crew",
  Creator: "Creator",
  Identity: "Identity",
  Game: "Game",
  Offer: "Offer",
  Stream: "Stream",
  Item: "Item",
  Brand: "Brand",
};

function deriveMultiHopPath(
  matchClause: string,
  conditions: ParsedCondition[],
  summary: string,
  bridgeNodes: string[]
): MultiHopPathInfo {
  // Split top-level comma-separated path patterns.
  const paths: string[] = [];
  let depth = 0;
  let last = 0;
  for (let i = 0; i < matchClause.length; i++) {
    const ch = matchClause[i];
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    else if (ch === "," && depth === 0) {
      paths.push(matchClause.slice(last, i));
      last = i + 1;
    }
  }
  paths.push(matchClause.slice(last));

  const hasClan = /:\s*Clan\b/.test(matchClause);
  const condsByVar = new Map<string, string[]>();
  for (const c of conditions) {
    const v = c.rawFragment.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\./)?.[1];
    if (!v) continue;
    const list = condsByVar.get(v) || [];
    list.push(c.label);
    condsByVar.set(v, list);
  }
  // Edge-variable predicates (e.g. m1.is_active) describe the hop into the next node.
  const edgeVars = new Set<string>();

  const nodeName = (v: string, label: string, inline: string) => {
    let name = NODE_DISPLAY[label] || label || "Node";
    if (label === "Player" && v === "mate") name = hasClan ? "Crew mate" : "Connected player";
    const prop = inline.match(/\{\s*\w+\s*:\s*'([^']+)'\s*\}/)?.[1];
    if (prop) name = `${name}: ${prop}`;
    return name;
  };

  const steps: string[] = [];
  const labelParts: string[] = [];
  const seen = new Set<string>();
  let hops = 0;
  const tokenRe = /\(\s*([a-zA-Z_][a-zA-Z0-9_]*)?\s*(?::\s*([A-Za-z_]+))?([^)]*)\)|(<)?-\[\s*([a-zA-Z_][a-zA-Z0-9_]*)?\s*(?::\s*([A-Za-z_]+))?[^\]]*\]-(>)?/g;

  paths.forEach((path, pi) => {
    if (pi > 0) labelParts.push(" · ");
    let m: RegExpExecArray | null;
    let pendingEdgeConds: string[] = [];
    while ((m = tokenRe.exec(path))) {
      if (m[0].startsWith("(")) {
        const v = m[1] || "";
        const label = m[2] || "";
        const name = nodeName(v, label, m[3] || "");
        labelParts.push(name);
        if (v && seen.has(v)) continue; // re-referenced node, e.g. (p) in a second path
        if (v) seen.add(v);
        const conds = [...pendingEdgeConds, ...(condsByVar.get(v) || [])].map((c) => {
          const trimmed = name.startsWith("Crew mate") ? c.replace(/^Crew mate\s+/i, "") : c;
          return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
        });
        pendingEdgeConds = [];
        steps.push(conds.length ? `${name} · ${conds.slice(0, 3).join(" · ")}` : name);
      } else {
        hops++;
        const ev = m[5] || "";
        const elabel = m[6] || "EDGE";
        if (ev) {
          edgeVars.add(ev);
          pendingEdgeConds = condsByVar.get(ev) || [];
        }
        labelParts.push(m[4] ? ` ←${elabel}─ ` : m[7] ? ` ─${elabel}→ ` : ` ─${elabel}─ `);
      }
    }
  });

  return {
    hops,
    patternLabel: labelParts.join("").replace(/\s+/g, " ").trim(),
    summary,
    steps,
    bridgeNodes: bridgeNodes.slice(0, 8),
  };
}

// NL -> GQL translation cache (in-process, 1h). Only the translation is cached;
// results are always fetched live from Spanner.
const TRANSLATION_TTL_MS = 60 * 60 * 1000;
const translationCache = new Map<string, { gql: string; explanation: string; model: string; at: number }>();
function translationCacheKey(query: string, franchise: string): string {
  const normalized = query
    .toLowerCase()
    .replace(/[^a-z0-9$%.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${process.env.SPANNER_DATABASE_ID || "default"}|${franchise || "ALL"}|${normalized}`;
}

// Live Spanner result cache (in-process, 1h, like the other demo caches) keyed by the exact GQL, so a
// cohort reopened during the demo does not rerun a multi-hop traversal. Misses and
// errors always go to Spanner; errors are never cached.
const RESULT_TTL_MS = 60 * 60 * 1000;
const resultCache = new Map<string, { at: number; res: Awaited<ReturnType<typeof runSpannerGraphQuery>> }>();
const resultInflight = new Map<string, ReturnType<typeof runSpannerGraphQuery>>();
async function cachedGraphQuery(gql: string) {
  const hit = resultCache.get(gql);
  if (hit && Date.now() - hit.at < RESULT_TTL_MS) return hit.res;
  const pending = resultInflight.get(gql);
  if (pending) return pending;
  const p = runSpannerGraphQuery(gql, 520)
    .then((res) => {
      resultCache.set(gql, { at: Date.now(), res });
      return res;
    })
    .finally(() => resultInflight.delete(gql));
  resultInflight.set(gql, p);
  return p;
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
  const cacheKey = translationCacheKey(query, franchise);
  const cachedTranslation = translationCache.get(cacheKey);
  let translationSource: "golden" | "cache" | "model" = "model";
  if (golden) {
    translationSource = "golden";
    gqlQuery = golden.gql_query;
    explanation = golden.explanation;
    modelUsed = "spanner-gql-fastpath";
  } else if (cachedTranslation && Date.now() - cachedTranslation.at < TRANSLATION_TTL_MS) {
    // Same question this session: reuse the translated GQL so the matched count
    // is stable. The GQL itself is still executed live against Spanner below.
    gqlQuery = cachedTranslation.gql;
    explanation = cachedTranslation.explanation;
    modelUsed = cachedTranslation.model;
    translationSource = "cache";
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
        // Deterministic translation: same question -> same GQL.
        temperature: 0,
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
  if (translationSource === "model") {
    translationCache.set(cacheKey, { gql: gqlQuery, explanation, model: modelUsed, at: Date.now() });
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

  const spannerRes = await cachedGraphQuery(gqlQuery);
  const { games, creators, clans } = await getCatalog();
  const clanById = new Map(clans.map((c) => [c.clan_id, c]));
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

  // Add franchise / game hub nodes referenced by matched players. Hubs and
  // labels come from the live Spanner Games catalog (2K, Rockstar, Zynga).
  const franchiseIdx = buildFranchiseIndex(games);
  const hubIdFor = (f: string) =>
    franchiseIdx.hubByFranchise.get(f)?.game_id || HUB_ID_BY_FRANCHISE[f];
  const activeFranchises = new Set<string>();
  for (const r of spannerRes.rows) {
    activeFranchises.add(r.primary_franchise);
  }

  Array.from(activeFranchises).forEach((f, idx) => {
    const hubId = hubIdFor(f);
    if (!hubId) return;
    const g = gameById.get(hubId);
    const lbl = (g?.label || franchiseIdx.labelOf(f)) as GameLabel;
    const angle = (idx / Math.max(1, activeFranchises.size)) * Math.PI * 2;
    addNode({
      id: hubId,
      name: g?.title || f,
      type: "GAME",
      franchise: f,
      label: lbl,
      studio: studioForLabel(lbl),
      lifecycle_status: g?.lifecycle_status ?? undefined,
      val: 34,
      color: FRANCHISE_COLORS[f] || LABEL_COLORS[lbl],
      fx: activeFranchises.size === 1 ? 0 : Math.cos(angle) * 220,
      fy: activeFranchises.size === 1 ? -140 : Math.sin(angle) * 180,
    });
  });

  // Add matched player nodes
  for (const r of spannerRes.rows) {
    const primaryLabel = franchiseIdx.labelOf(r.primary_franchise) as GameLabel;

    addNode({
      id: r.player_id,
      name: r.gamer_tag || r.display_name,
      type: "PLAYER",
      franchise: r.primary_franchise,
      label: primaryLabel,
      studio: studioForLabel(primaryLabel),
      franchises_played: r.franchises_played || undefined,
      archetype: r.primary_archetype,
      spend: r.lifetime_spend_usd,
      churn_risk: r.churn_risk_score,
      tilt: r.tilt_sensitivity,
      loss_streak: r.recent_loss_streak,
      gravity_score:
        typeof r.game_telemetry?.gravity_score === "number" ? r.game_telemetry.gravity_score : undefined,
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

    const hubId = hubIdFor(r.primary_franchise);
    if (hubId && nodeIds.has(hubId)) {
      links.push({
        source: r.player_id,
        target: hubId,
        label: "PLAYS_GAME",
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
          franchise: clanById.get(br.clan_id)?.franchise,
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
            name: br.mate_tag || br.mate_id,
            type: "SQUADMATE",
            franchise: br.mate_franchise || undefined,
            isMultiHopBridge: true,
            hopStep: 2,
            val: 11,
            color: "#19C37D",
          });
          links.push({
            source: br.clan_id,
            target: br.mate_id,
            label: "MEMBER_OF_CLAN",
            isMultiHopBridge: true,
            hopStep: 2,
            value: 1.8,
            color: "#19C37D",
          });
        }

      }

      if (br.identity_id) {
        const platHubId = `ident-hub-${(br.identity_platform || br.identity_id)
          .toLowerCase()
          .replace(/\s+/g, "-")}`;
        addNode({
          id: platHubId,
          name: br.identity_platform || "Identity",
          type: "IDENTITY",
          platform: br.identity_platform || "Identity",
          isMultiHopBridge: true,
          hopStep: 1,
          val: 28,
          color: "#F5B400",
          fx: 240,
          fy: -40,
        });
        bridgeNames.add(br.identity_platform || "Identity");
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
          const targetGame = gameById.get(br.target_game_id);
          const targetFranchise = br.target_game_franchise || targetGame?.franchise || "";
          const targetLabel = (br.target_game_label || targetGame?.label || franchiseIdx.labelOf(targetFranchise)) as GameLabel;
          addNode({
            id: br.target_game_id,
            name: br.target_game_title || targetGame?.title || br.target_game_id,
            type: "GAME",
            franchise: targetFranchise,
            label: targetLabel,
            studio: studioForLabel(targetLabel),
            lifecycle_status: targetGame?.lifecycle_status ?? undefined,
            isMultiHopBridge: true,
            hopStep: 2,
            val: 32,
            color: FRANCHISE_COLORS[targetFranchise] || "#FF6B35",
            fx: 380,
            fy: 80,
          });
          bridgeNames.add(br.target_game_title || targetGame?.title || br.target_game_id);
          links.push({
            source: platHubId,
            target: br.target_game_id,
            label: "PLAYS_GAME",
            isMultiHopBridge: true,
            hopStep: 2,
            value: 2.2,
            color: FRANCHISE_COLORS[targetFranchise] || "#FF6B35",
          });

        }
      }

      if (br.creator_id) {
        const cr = creatorById.get(br.creator_id);
        addNode({
          id: br.creator_id,
          name: br.creator_handle || cr?.handle || br.creator_name || cr?.name || br.creator_id,
          type: "CREATOR",
          franchise: br.target_game_franchise || cr?.franchise || undefined,
          platform: br.creator_platform || cr?.platform,
          creator_data: cr || {
            creator_id: br.creator_id,
            handle: br.creator_handle,
            name: br.creator_name,
            platform: br.creator_platform,
            franchise: br.target_game_franchise || undefined,
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

    multiHopMetadata = deriveMultiHopPath(
      matchClause,
      parseConditionsFromWhere(spannerRes.whereClause),
      explanation,
      Array.from(bridgeNames)
    );
  }

  const activeConditions = parseConditionsFromWhere(spannerRes.whereClause);

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
    translation_source: translationSource,
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
      sample_strata: spannerRes.sampleStrata,
      total_graph_players: Number(
        (await runRawGql(`SELECT COUNT(*) AS n FROM Players`))[0]?.n ?? 0
      ),
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
