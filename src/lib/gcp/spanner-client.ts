import { Spanner } from "@google-cloud/spanner";
import { GCP_CONFIG } from "../config";
import fs from "fs";
import path from "path";

let spannerClient: Spanner | null = null;

export function getSpannerDatabase() {
  if (!spannerClient) {
    spannerClient = new Spanner({ projectId: GCP_CONFIG.projectId });
  }
  const instance = spannerClient.instance(GCP_CONFIG.spannerInstanceId);
  return instance.database(GCP_CONFIG.spannerDatabaseId);
}

let cachedPlayers: any[] | null = null;

export function loadLocalMasterPlayers() {
  if (cachedPlayers) return cachedPlayers;
  try {
    const playersPath = path.join(process.cwd(), "data/master_players.json");
    if (fs.existsSync(playersPath)) {
      const raw = fs.readFileSync(playersPath, "utf-8");
      cachedPlayers = JSON.parse(raw);
      return cachedPlayers as any[];
    }
  } catch (e) {
    console.error("[Local Fallback] Error reading master players:", e);
  }
  cachedPlayers = [];
  return cachedPlayers;
}

/**
 * Aggregates computed across the FULL matched population, not the rendered page.
 */
export interface CohortAggregates {
  avgSpendUsd: number;
  avgChurnRisk: number;
  avgTilt: number;
  highChurnCount: number;
  archetypeHistogram: Record<string, number>;
  countryHistogram: Record<string, number>;
  franchiseHistogram: Record<string, number>;
  dominantArchetype: string;
}

/**
 * Result envelope for a graph query.
 *
 * `totalMatched` is the TRUE number of players satisfying the query predicates,
 * independent of `rows`, which is truncated by the query's LIMIT clause for
 * rendering. These must never be conflated: `totalMatched` is what a marketer
 * reads as reachable audience size.
 */
export interface GraphQueryResult {
  rows: any[];
  totalMatched: number;
  aggregates: CohortAggregates;
  isLive: boolean;
  source: string;
  executionTimeMs: number;
  /** Human-readable predicates that were actually evaluated, for UI provenance. */
  appliedPredicates: string[];
}

type Predicate = (p: any) => boolean;

interface ParsedAtom {
  predicate: Predicate;
  description: string;
}

/** Resolve a `p.field` reference against a player record, with a few aliases. */
function fieldValue(player: any, field: string): any {
  const f = field.replace(/^p\./, "").trim();
  if (f in player) return player[f];
  // Telemetry fields are nested one level down.
  if (player.game_telemetry && f in player.game_telemetry) return player.game_telemetry[f];
  return undefined;
}

function coerce(raw: string): string | number {
  const trimmed = raw.trim();
  const unquoted = trimmed.replace(/^'(.*)'$/s, "$1").replace(/^"(.*)"$/s, "$1");
  if (unquoted === trimmed && /^-?[0-9.]+$/.test(trimmed)) return parseFloat(trimmed);
  return unquoted;
}

function compare(op: string, left: any, right: any): boolean {
  if (left === undefined || left === null) return false;
  const bothNumeric = typeof right === "number";
  const l = bothNumeric ? Number(left) : String(left).toLowerCase();
  const r = bothNumeric ? Number(right) : String(right).toLowerCase();
  switch (op) {
    case ">=":
      return l >= r;
    case "<=":
      return l <= r;
    case ">":
      return l > r;
    case "<":
      return l < r;
    case "=":
    case "==":
      return l === r;
    case "!=":
    case "<>":
      return l !== r;
    default:
      return false;
  }
}

/** Locate top-level balanced parenthesised groups within a clause. */
function findBalancedGroups(s: string): { start: number; end: number; body: string }[] {
  const groups: { start: number; end: number; body: string }[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "'") inString = !inString;
    if (inString) continue;
    if (ch === "(") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth === 0 && start >= 0) {
        groups.push({ start, end: i, body: s.slice(start + 1, i) });
        start = -1;
      }
    }
  }
  return groups;
}

/**
 * Parse a single comparison atom.
 *
 * Supported forms:
 *   p.field >= 1500                      numeric / string comparison
 *   p.field = 'United States'
 *   p.field LIKE '%Dallas%'
 *   p.field IN ('COD', 'WOW')            membership against a scalar or array field
 *   'DIABLO4' IN p.franchises_played     membership against an array field
 */
function parseAtom(raw: string): ParsedAtom | null {
  const atom = raw.trim().replace(/;$/, "");
  if (!atom) return null;

  // 'VALUE' IN p.array_field
  let m = atom.match(/^'([^']+)'\s+IN\s+(p\.[a-z_0-9]+)$/i);
  if (m) {
    const needle = m[1].toLowerCase();
    const field = m[2];
    return {
      description: `'${m[1]}' in ${field}`,
      predicate: (p) => {
        const v = fieldValue(p, field);
        return Array.isArray(v) && v.some((x) => String(x).toLowerCase() === needle);
      },
    };
  }

  // p.field IN ('A', 'B')
  m = atom.match(/^(p\.[a-z_0-9]+)\s+IN\s*\(([^)]*)\)$/i);
  if (m) {
    const field = m[1];
    const list = m[2]
      .split(",")
      .map((x) => String(coerce(x)).toLowerCase())
      .filter(Boolean);
    return {
      description: `${field} in (${list.join(", ")})`,
      predicate: (p) => {
        const v = fieldValue(p, field);
        if (Array.isArray(v)) return v.some((x) => list.includes(String(x).toLowerCase()));
        return v !== undefined && list.includes(String(v).toLowerCase());
      },
    };
  }

  // p.field LIKE '%value%'
  m = atom.match(/^(p\.[a-z_0-9]+)\s+LIKE\s+'([^']*)'$/i);
  if (m) {
    const field = m[1];
    const pattern = m[2].toLowerCase();
    const bare = pattern.replace(/%/g, "");
    const startsOpen = pattern.startsWith("%");
    const endsOpen = pattern.endsWith("%");
    return {
      description: `${field} like '${m[2]}'`,
      predicate: (p) => {
        const v = fieldValue(p, field);
        if (v === undefined || v === null) return false;
        const s = String(v).toLowerCase();
        if (startsOpen && endsOpen) return s.includes(bare);
        if (endsOpen) return s.startsWith(bare);
        if (startsOpen) return s.endsWith(bare);
        return s === bare;
      },
    };
  }

  // p.field <op> value
  m = atom.match(/^(p\.[a-z_0-9]+)\s*(>=|<=|!=|<>|=|>|<)\s*(.+)$/i);
  if (m) {
    const field = m[1];
    const op = m[2];
    const value = coerce(m[3]);
    return {
      description: `${field} ${op} ${typeof value === "string" ? `'${value}'` : value}`,
      predicate: (p) => compare(op, fieldValue(p, field), value),
    };
  }

  return null;
}

/** Split a clause on a boolean operator, respecting parentheses and string literals. */
function splitTopLevel(clause: string, op: "AND" | "OR"): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inString = false;
  let buf = "";
  const token = op.toLowerCase();
  for (let i = 0; i < clause.length; i++) {
    const ch = clause[i];
    if (ch === "'") inString = !inString;
    if (!inString) {
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      if (depth === 0) {
        const ahead = clause.slice(i, i + token.length).toLowerCase();
        const before = i === 0 ? " " : clause[i - 1];
        const after = clause[i + token.length] || " ";
        if (ahead === token && /\s/.test(before) && /\s/.test(after)) {
          parts.push(buf);
          buf = "";
          i += token.length - 1;
          continue;
        }
      }
    }
    buf += ch;
  }
  parts.push(buf);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Recursively build a predicate from a boolean expression. */
function buildPredicate(clause: string, applied: string[]): Predicate | null {
  const trimmed = clause.trim().replace(/;$/, "");
  if (!trimmed) return null;

  // Unwrap a fully-enclosing paren group.
  const groups = findBalancedGroups(trimmed);
  if (groups.length === 1 && groups[0].start === 0 && groups[0].end === trimmed.length - 1) {
    return buildPredicate(groups[0].body, applied);
  }

  const orParts = splitTopLevel(trimmed, "OR");
  if (orParts.length > 1) {
    const preds = orParts.map((p) => buildPredicate(p, applied)).filter(Boolean) as Predicate[];
    if (!preds.length) return null;
    return (p) => preds.some((fn) => fn(p));
  }

  const andParts = splitTopLevel(trimmed, "AND");
  if (andParts.length > 1) {
    const preds = andParts.map((p) => buildPredicate(p, applied)).filter(Boolean) as Predicate[];
    if (!preds.length) return null;
    return (p) => preds.every((fn) => fn(p));
  }

  const atom = parseAtom(trimmed);
  if (atom) {
    applied.push(atom.description);
    return atom.predicate;
  }

  // Unrecognised atom: ignore it rather than silently narrowing the audience.
  console.warn(`[Graph Engine] Unparsed predicate, ignoring: "${trimmed}"`);
  return null;
}

/**
 * Evaluate a GQL string against the local master player table.
 *
 * This is a genuine (if small) predicate evaluator: it parses the WHERE clause
 * into a boolean tree and applies it field-by-field. It deliberately does NOT
 * substring-match the query text, which previously caused `lifetime_spend_usd`
 * to match a bare `"us"` country token and silently constrain every cohort to
 * the United States, and caused churn predicates to be dropped entirely.
 */
export function evaluateGqlLocally(gql: string) {
  const players = loadLocalMasterPlayers();
  const applied: string[] = [];

  const whereMatch = gql.match(/\bWHERE\b([\s\S]*?)(?:\bRETURN\b|\bORDER\s+BY\b|\bLIMIT\b|$)/i);
  const whereClause = whereMatch ? whereMatch[1].trim() : "";

  const predicate = whereClause ? buildPredicate(whereClause, applied) : null;
  let filtered = predicate ? players.filter(predicate) : players.slice();

  const totalMatched = filtered.length;

  const orderMatch = gql.match(/\bORDER\s+BY\s+(p\.[a-z_0-9]+)\s*(ASC|DESC)?/i);
  if (orderMatch) {
    const field = orderMatch[1];
    const dir = (orderMatch[2] || "ASC").toUpperCase() === "DESC" ? -1 : 1;
    filtered = [...filtered].sort((a, b) => {
      const av = fieldValue(a, field);
      const bv = fieldValue(b, field);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
    });
  }

  const limitMatch = gql.match(/\bLIMIT\s+(\d+)/i);
  const limit = limitMatch ? parseInt(limitMatch[1], 10) : 250;

  return { filtered, totalMatched, limit, applied };
}

export function computeAggregates(players: any[]): CohortAggregates {
  const n = Math.max(1, players.length);
  let spend = 0;
  let churn = 0;
  let tilt = 0;
  let highChurn = 0;
  const archetypeHistogram: Record<string, number> = {};
  const countryHistogram: Record<string, number> = {};
  const franchiseHistogram: Record<string, number> = {};

  for (const p of players) {
    spend += Number(p.lifetime_spend_usd || 0);
    churn += Number(p.churn_risk_score || 0);
    tilt += Number(p.tilt_sensitivity || 0);
    if (Number(p.churn_risk_score || 0) >= 0.7) highChurn++;
    if (p.primary_archetype) archetypeHistogram[p.primary_archetype] = (archetypeHistogram[p.primary_archetype] || 0) + 1;
    if (p.country) countryHistogram[p.country] = (countryHistogram[p.country] || 0) + 1;
    if (p.primary_franchise) franchiseHistogram[p.primary_franchise] = (franchiseHistogram[p.primary_franchise] || 0) + 1;
  }

  const dominantArchetype =
    Object.entries(archetypeHistogram).sort((a, b) => b[1] - a[1])[0]?.[0] || "UNCLASSIFIED";

  return {
    avgSpendUsd: Math.round((spend / n) * 100) / 100,
    avgChurnRisk: Number((churn / n).toFixed(3)),
    avgTilt: Number((tilt / n).toFixed(3)),
    highChurnCount: highChurn,
    archetypeHistogram,
    countryHistogram,
    franchiseHistogram,
    dominantArchetype,
  };
}

function normalizeLocalRow(p: any) {
  return {
    player_id: p.player_id,
    display_name: p.display_name,
    gamer_tag: p.gamer_tag || p.display_name,
    primary_franchise: p.primary_franchise,
    franchises_played: p.franchises_played || [p.primary_franchise],
    primary_archetype: p.primary_archetype,
    lifetime_spend_usd: p.lifetime_spend_usd,
    churn_risk_score: p.churn_risk_score,
    tilt_sensitivity: p.tilt_sensitivity,
    recent_loss_streak: p.recent_loss_streak || 0,
    age: p.age,
    gender: p.gender,
    account_tenure_days: p.account_tenure_days,
    currency_balance: p.currency_balance,
    country: p.country,
    country_code: p.country_code || "US",
    country_flag: p.country_flag || "🇺🇸",
    dma_market: p.dma_market,
    lat: p.lat,
    lng: p.lng,
    followed_creators: p.followed_creators || [p.primary_creator_influence].filter(Boolean),
    primary_creator_influence: p.primary_creator_influence,
    game_telemetry: p.game_telemetry || {},
    purchased_items: p.purchased_items || [],
  };
}

export async function runSpannerGraphQuery(
  gqlQuery: string,
  params: Record<string, any> = {},
  sourceMode: "live_spanner" | "local" = "local"
): Promise<GraphQueryResult> {
  const startTime = Date.now();
  let cleanedGql = gqlQuery.trim();

  if (!cleanedGql.startsWith("GRAPH ")) {
    cleanedGql = `GRAPH ABKPlayerGraph\n${cleanedGql}`;
  }

  // Ensure node table reference matches Spanner DDL (Players table)
  const spannerGql = cleanedGql.replace(/MATCH\s*\(\s*p:Player\s*\)/gi, "MATCH (p:Players)");

  console.log(`[Spanner Engine Mode]: ${sourceMode.toUpperCase()}`);

  if (sourceMode === "live_spanner") {
    try {
      console.log(`[Cloud Spanner Live GQL Executing]:\n${spannerGql}`);
      const database = getSpannerDatabase();
      const [rows] = await database.run({ sql: spannerGql, params });

      if (rows && rows.length > 0) {
        const executionTimeMs = Date.now() - startTime;
        console.log(`[Cloud Spanner Result]: ${rows.length} rows in ${executionTimeMs}ms`);

        const mappedRows = rows.map((r: any) => {
          let telemetry: any = {};
          let purchasedItems: any[] = [];
          try {
            if (r.telemetry_json) {
              telemetry = typeof r.telemetry_json === "string" ? JSON.parse(r.telemetry_json) : r.telemetry_json;
            }
          } catch (e) {}
          try {
            if (r.purchased_items_json) {
              purchasedItems =
                typeof r.purchased_items_json === "string"
                  ? JSON.parse(r.purchased_items_json)
                  : r.purchased_items_json;
            }
          } catch (e) {}

          return {
            player_id: r.player_id || r.p?.player_id,
            display_name: r.display_name || r.p?.display_name,
            gamer_tag: r.gamer_tag || r.p?.gamer_tag || r.display_name,
            primary_franchise: r.primary_franchise || r.p?.primary_franchise,
            franchises_played: r.franchises_played || [r.primary_franchise || r.p?.primary_franchise],
            primary_archetype: r.primary_archetype || r.p?.primary_archetype,
            lifetime_spend_usd: Number(r.lifetime_spend_usd || r.p?.lifetime_spend_usd || 0),
            churn_risk_score: Number(r.churn_risk_score || r.p?.churn_risk_score || 0),
            tilt_sensitivity: Number(r.tilt_sensitivity || r.p?.tilt_sensitivity || 0),
            recent_loss_streak: Number(r.recent_loss_streak || r.p?.recent_loss_streak || 0),
            age: r.age ?? r.p?.age,
            gender: r.gender ?? r.p?.gender,
            account_tenure_days: r.account_tenure_days ?? r.p?.account_tenure_days,
            currency_balance: r.currency_balance ?? r.p?.currency_balance,
            country: r.country || r.p?.country || "United States",
            country_code: r.country_code || r.p?.country_code || "US",
            country_flag: r.country_flag || r.p?.country_flag || "🇺🇸",
            dma_market: r.dma_market || r.p?.dma_market || "Los Angeles Metro",
            lat: Number(r.lat || r.p?.lat || 34.0522),
            lng: Number(r.lng || r.p?.lng || -118.2437),
            game_telemetry: telemetry,
            purchased_items: purchasedItems,
            followed_creators: r.followed_creators || telemetry?.followed_creators || [],
            primary_creator_influence: r.primary_creator_influence || telemetry?.primary_creator_influence,
          };
        });

        return {
          rows: mappedRows,
          // Live Spanner returns the LIMITed page; without a COUNT(*) companion
          // query the honest answer is the page size, not an extrapolation.
          totalMatched: mappedRows.length,
          aggregates: computeAggregates(mappedRows),
          isLive: true,
          source: `Google Cloud Spanner Enterprise (${GCP_CONFIG.spannerDatabaseId})`,
          executionTimeMs,
          appliedPredicates: [],
        };
      }
    } catch (error: any) {
      console.warn("[Cloud Spanner Notice - Falling back to local graph engine]:", error?.message || error);
    }
  }

  const { filtered, totalMatched, limit, applied } = evaluateGqlLocally(cleanedGql);
  const rows = filtered.slice(0, limit).map(normalizeLocalRow);

  return {
    rows,
    totalMatched,
    aggregates: computeAggregates(filtered),
    isLive: false,
    source: "Local Graph Engine (predicate-evaluated over 5,000 master players)",
    executionTimeMs: Date.now() - startTime,
    appliedPredicates: applied,
  };
}
