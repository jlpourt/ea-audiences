/**
 * Section D · 3-arm Concept Test engine (server only).
 *
 * Live path, zero fallbacks:
 *   1. Hydrate N personas from Spanner Graph (`TakeTwoPlayerGraph`) on the DB in
 *      `process.env.SPANNER_DATABASE_ID`. Concept affinity columns
 *      (`wnba_affinity`, `college_hoops_affinity`, `franchise_mode_affinity`)
 *      are read only when INFORMATION_SCHEMA says they exist (v2). On v1 they
 *      are not selected and are reported as missing; nothing is invented.
 *   2. 20 core personas react individually (Vertex AI FAST, per-persona voice
 *      profile); crowd agents react in LITE batches.
 *   3. Live creators followed by the cohort take a stance (FAST), then a social
 *      round lets Crew pulse and Creator stances shift preference.
 *   4. Final synthesis (Gemini REASONING) over aggregates computed in code.
 *
 * Any GCP failure throws a `ConceptEngineError` naming the service; the route
 * turns it into an SSE `error` event (or HTTP 502/503 before streaming).
 */
import { generateText, parseModelJson } from "@/lib/gcp/genai-client";
import { runRawGql, toNumber, parseJsonColumn, SpannerUnavailableError } from "@/lib/gcp/spanner-client";
import { GCP_CONFIG } from "@/lib/config";
import { MODELS } from "@/lib/models";
import { archetypeLabel, archetypeDescription, type ArchetypeId } from "@/lib/archetypes";
import {
  COURTSIDE_PERSONA_PROMPTS,
  buildIndividualVoiceProfile,
  buildCollegeHoopsVoiceOverlay,
  describeConceptAffinities,
  REAL_ATHLETE_VOICE_GUARD,
} from "@/lib/prompts/courtside_personas";
import {
  CONCEPT_ARMS,
  CONCEPT_ARM_IDS,
  CONCEPT_CORE_SIZE,
  CONCEPT_EDITIONS,
  isConceptArmId,
  type ConceptArmId,
  type ConceptArmReaction,
  type ConceptArmAggregate,
  type ConceptCohortSummary,
  type ConceptCreatorStance,
  type ConceptShift,
  type ConceptSynthesis,
  type ConceptVerdict,
  type PurchaseIntent,
} from "@/lib/v2/concept";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ConceptEngineError extends Error {
  constructor(
    message: string,
    readonly service: "cloud-spanner" | "vertex-ai",
    readonly phase: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "ConceptEngineError";
  }
}

function vertexError(phase: string, err: unknown): ConceptEngineError {
  if (err instanceof ConceptEngineError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  return new ConceptEngineError(`Vertex AI ${phase} failed: ${msg}`, "vertex-ai", phase, err);
}

function spannerError(phase: string, err: unknown): ConceptEngineError {
  if (err instanceof ConceptEngineError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  return new ConceptEngineError(
    `Cloud Spanner ${phase} failed on ${GCP_CONFIG.spannerInstanceId}/${GCP_CONFIG.spannerDatabaseId}: ${msg}`,
    "cloud-spanner",
    phase,
    err
  );
}

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

/** Run `fn` over `items` with at most `limit` in flight. Rejects on first failure. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  let failed: unknown = null;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (failed === null) {
      const i = next++;
      if (i >= items.length) return;
      try {
        results[i] = await fn(items[i], i);
      } catch (e) {
        failed = e;
        throw e;
      }
    }
  });
  await Promise.all(workers);
  return results;
}

function chunk<T>(xs: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

function clampInt(v: unknown, lo: number, hi: number, field: string): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`invalid ${field}: ${JSON.stringify(v)}`);
  return Math.round(Math.min(hi, Math.max(lo, n)));
}

function clampNum(v: unknown, lo: number, hi: number, field: string): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`invalid ${field}: ${JSON.stringify(v)}`);
  return Math.min(hi, Math.max(lo, Math.round(n * 10) / 10));
}

function toBool(v: unknown, field: string): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  throw new Error(`invalid ${field}: ${JSON.stringify(v)}`);
}

function toIntent(v: unknown): PurchaseIntent {
  const s = String(v || "").toUpperCase();
  if (s === "STANDARD" || s === "DELUXE" || s === "NONE") return s;
  throw new Error(`invalid purchase_intent: ${JSON.stringify(v)}`);
}

function toArm(v: unknown, field: string): ConceptArmId {
  const s = String(v || "").toLowerCase();
  if (isConceptArmId(s)) return s;
  throw new Error(`invalid ${field}: ${JSON.stringify(v)}`);
}

function cleanQuote(s: unknown): string {
  return String(s ?? "")
    .replace(/[\u2014\u2013]/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// 1. Spanner hydration
// ---------------------------------------------------------------------------

const AFFINITY_COLUMNS = ["wnba_affinity", "college_hoops_affinity", "franchise_mode_affinity"] as const;
type AffinityColumn = (typeof AFFINITY_COLUMNS)[number];

interface SchemaCaps {
  database: string;
  affinityColumns: AffinityColumn[];
  hasSessionMin7d: boolean;
  hasCrewCentrality: boolean;
  hasMembershipIsActive: boolean;
}

const schemaCache = new Map<string, SchemaCaps>();

/**
 * Detect which v2 columns exist on the connected DB. This is how v1 vs v2 is
 * handled: absent columns are never selected (no column-not-found errors, no
 * invented values).
 */
async function detectSchema(): Promise<SchemaCaps> {
  const db = GCP_CONFIG.spannerDatabaseId;
  const cached = schemaCache.get(db);
  if (cached) return cached;
  const rows = await runRawGql(
    `SELECT table_name, column_name
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE table_schema = ''
        AND table_name IN ('Players', 'MemberOfClan')`
  );
  const has = (t: string, c: string) => rows.some((r) => r.table_name === t && r.column_name === c);
  const caps: SchemaCaps = {
    database: db,
    affinityColumns: AFFINITY_COLUMNS.filter((c) => has("Players", c)),
    hasSessionMin7d: has("Players", "session_min_7d"),
    hasCrewCentrality: has("MemberOfClan", "crew_centrality"),
    hasMembershipIsActive: has("MemberOfClan", "is_active"),
  };
  schemaCache.set(db, caps);
  return caps;
}

export interface ConceptPersona {
  player_id: string;
  gamer_tag: string;
  archetype: string;
  primary_franchise: string;
  age: number | null;
  lifetime_spend_usd: number;
  churn_risk_score: number;
  crew_id: string;
  crew_name: string;
  crew_tier: string;
  crew_role: string;
  crew_centrality: number | null;
  creator_id: string;
  creator_handle: string;
  wnba_affinity: number | null;
  college_hoops_affinity: number | null;
  franchise_mode_affinity: number | null;
  session_min_7d: number | null;
  telemetry: Record<string, any>;
  tier: "core" | "crowd";
}

export const HYDRATION_GQL = `SELECT p.player_id,
       ANY_VALUE(p.gamer_tag) AS gamer_tag,
       ANY_VALUE(p.age) AS age,
       ANY_VALUE(p.primary_archetype) AS primary_archetype,
       ANY_VALUE(p.primary_franchise) AS primary_franchise,
       ANY_VALUE(p.lifetime_spend_usd) AS lifetime_spend_usd,
       ANY_VALUE(p.churn_risk_score) AS churn_risk_score,
       ANY_VALUE(p.game_telemetry) AS game_telemetry,
       ANY_VALUE(p.clan_id) AS clan_id,
       ANY_VALUE(p.crew_name) AS crew_name,
       ANY_VALUE(p.crew_tier) AS crew_tier,
       ANY_VALUE(p.crew_role) AS crew_role,
       ANY_VALUE(p.creator_id) AS creator_id,
       ANY_VALUE(p.creator_handle) AS creator_handle
  FROM GRAPH_TABLE(
    TakeTwoPlayerGraph
    MATCH (p:Player)-[m:MEMBER_OF_CLAN]->(c:Clan),
          (p)-[:FOLLOWS_CREATOR]->(cr:Creator)
    WHERE p.primary_franchise IN ('NBA2K', 'NBA2K26', 'NBA2KMOBILE')
    RETURN p.player_id, p.gamer_tag, p.age, p.primary_archetype, p.primary_franchise,
           p.lifetime_spend_usd, p.churn_risk_score, p.game_telemetry,
           c.clan_id AS clan_id, c.name AS crew_name, c.tier AS crew_tier,
           m.role AS crew_role, cr.creator_id AS creator_id, cr.handle AS creator_handle
  ) AS p
 GROUP BY p.player_id
 ORDER BY FARM_FINGERPRINT(CONCAT(p.player_id, @seed))
 LIMIT @limit`;

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = toNumber(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Pick core personas round-robin across archetypes (from a seeded random
 * sample) so the 20 individually voiced personas cover the whole archetype
 * mix; the remaining sample becomes the crowd.
 */
function splitCoreCrowd(rows: ConceptPersona[], n: number): ConceptPersona[] {
  const byArch = new Map<string, ConceptPersona[]>();
  for (const r of rows) {
    const list = byArch.get(r.archetype) || [];
    list.push(r);
    byArch.set(r.archetype, list);
  }
  const core: ConceptPersona[] = [];
  const coreSize = Math.min(CONCEPT_CORE_SIZE, n);
  const queues = Array.from(byArch.values());
  let progressed = true;
  while (core.length < coreSize && progressed) {
    progressed = false;
    for (const q of queues) {
      if (core.length >= coreSize) break;
      const next = q.shift();
      if (next) {
        core.push({ ...next, tier: "core" });
        progressed = true;
      }
    }
  }
  const coreIds = new Set(core.map((c) => c.player_id));
  const crowd = rows
    .filter((r) => !coreIds.has(r.player_id))
    .slice(0, Math.max(0, n - core.length))
    .map((r) => ({ ...r, tier: "crowd" as const }));
  return [...core, ...crowd];
}

export async function hydrateConceptCohort(
  n: number,
  seed: string
): Promise<{ personas: ConceptPersona[]; summary: ConceptCohortSummary }> {
  const started = Date.now();
  let caps: SchemaCaps;
  let rows: any[];
  try {
    caps = await detectSchema();
    rows = await runRawGql(HYDRATION_GQL, { seed, limit: Math.max(n, 120) });
  } catch (e) {
    throw spannerError("cohort hydration", e);
  }
  if (rows.length < n) {
    throw new ConceptEngineError(
      `Cloud Spanner returned ${rows.length} eligible personas on ${caps.database}; ${n} requested.`,
      "cloud-spanner",
      "cohort hydration"
    );
  }

  const ids = rows.map((r) => String(r.player_id));
  const extrasById = new Map<string, any>();
  const centralityById = new Map<string, number | null>();
  try {
    const playerExtraCols = [...caps.affinityColumns, ...(caps.hasSessionMin7d ? ["session_min_7d"] : [])];
    if (playerExtraCols.length > 0) {
      // Column names come from a fixed allowlist verified against INFORMATION_SCHEMA.
      const extra = await runRawGql(
        `SELECT player_id, ${playerExtraCols.join(", ")} FROM Players WHERE player_id IN UNNEST(@ids)`,
        { ids }
      );
      for (const r of extra) extrasById.set(String(r.player_id), r);
    }
    if (caps.hasCrewCentrality) {
      const cent = await runRawGql(
        `SELECT player_id, crew_centrality FROM MemberOfClan
          WHERE player_id IN UNNEST(@ids)${caps.hasMembershipIsActive ? " AND is_active = TRUE" : ""}`,
        { ids }
      );
      for (const r of cent) centralityById.set(String(r.player_id), numOrNull(r.crew_centrality));
    }
  } catch (e) {
    throw spannerError("concept affinity read", e);
  }

  const mapped: ConceptPersona[] = rows.map((r) => {
    const telemetry = parseJsonColumn(r.game_telemetry, {}) as Record<string, any>;
    const ex = extrasById.get(String(r.player_id)) || {};
    return {
      player_id: String(r.player_id),
      gamer_tag: String(r.gamer_tag),
      archetype: String(r.primary_archetype),
      primary_franchise: String(r.primary_franchise),
      age: numOrNull(r.age),
      lifetime_spend_usd: toNumber(r.lifetime_spend_usd),
      churn_risk_score: toNumber(r.churn_risk_score),
      crew_id: String(r.clan_id),
      crew_name: String(r.crew_name),
      crew_tier: String(r.crew_tier),
      crew_role: String(r.crew_role),
      crew_centrality: centralityById.get(String(r.player_id)) ?? null,
      creator_id: String(r.creator_id),
      creator_handle: String(r.creator_handle),
      wnba_affinity: caps.affinityColumns.includes("wnba_affinity") ? numOrNull(ex.wnba_affinity) : null,
      college_hoops_affinity: caps.affinityColumns.includes("college_hoops_affinity")
        ? numOrNull(ex.college_hoops_affinity)
        : null,
      franchise_mode_affinity: caps.affinityColumns.includes("franchise_mode_affinity")
        ? numOrNull(ex.franchise_mode_affinity)
        : null,
      session_min_7d: caps.hasSessionMin7d ? numOrNull(ex.session_min_7d) : null,
      telemetry,
      tier: "crowd",
    };
  });

  const personas = splitCoreCrowd(mapped, n);
  const archetypes: Record<string, number> = {};
  for (const p of personas) archetypes[p.archetype] = (archetypes[p.archetype] || 0) + 1;

  return {
    personas,
    summary: {
      n: personas.length,
      core: personas.filter((p) => p.tier === "core").length,
      crowd: personas.filter((p) => p.tier === "crowd").length,
      database: caps.database,
      affinity_columns: caps.affinityColumns,
      missing_affinity_columns: AFFINITY_COLUMNS.filter((c) => !caps.affinityColumns.includes(c)),
      archetypes,
      crews: new Set(personas.map((p) => p.crew_id)).size,
      sample_seed: seed,
      latency_ms: Date.now() - started,
      query: HYDRATION_GQL,
    },
  };
}

// ---------------------------------------------------------------------------
// 2. Round 1 · persona reactions
// ---------------------------------------------------------------------------

function conceptBlock(): string {
  return CONCEPT_ARM_IDS.map((id) => {
    const a = CONCEPT_ARMS[id];
    return `Concept ${a.letter} [${id}]: ${a.title}\n${a.pitch}`;
  }).join("\n\n");
}

function editionsLine(): string {
  return `Editions if it ships: Standard $${CONCEPT_EDITIONS.STANDARD.price_usd} · Deluxe $${CONCEPT_EDITIONS.DELUXE.price_usd}`;
}

function currentPlayLine(p: ConceptPersona): string {
  if (p.session_min_7d !== null) {
    return `Current play: ${(p.session_min_7d / 60).toFixed(1)} hours in the last 7 days`;
  }
  const h = p.telemetry?.hours_played;
  return h !== undefined && h !== null ? `Hours played this season: ${toNumber(h)}` : "";
}

const ARM_REACTION_SCHEMA = {
  type: "OBJECT",
  properties: {
    interest: { type: "INTEGER" },
    weekly_hours: { type: "NUMBER" },
    replaces_current_mode: { type: "BOOLEAN" },
  },
  required: ["interest", "weekly_hours", "replaces_current_mode"],
};

const CORE_SCHEMA = {
  type: "OBJECT",
  properties: {
    nba: ARM_REACTION_SCHEMA,
    wnba: ARM_REACTION_SCHEMA,
    college: ARM_REACTION_SCHEMA,
    preferred_arm: { type: "STRING", enum: ["nba", "wnba", "college"] },
    purchase_intent: { type: "STRING", enum: ["STANDARD", "DELUXE", "NONE"] },
    quote: { type: "STRING" },
  },
  required: ["nba", "wnba", "college", "preferred_arm", "purchase_intent", "quote"],
};

function parseArm(raw: any, arm: ConceptArmId): ConceptArmReaction {
  if (!raw || typeof raw !== "object") throw new Error(`missing ${arm} reaction`);
  return {
    interest: clampInt(raw.interest, 0, 100, `${arm}.interest`),
    weekly_hours: clampNum(raw.weekly_hours, 0, 60, `${arm}.weekly_hours`),
    replaces_current_mode: toBool(raw.replaces_current_mode, `${arm}.replaces_current_mode`),
  };
}

function baseVerdict(p: ConceptPersona) {
  return {
    player_id: p.player_id,
    gamer_tag: p.gamer_tag,
    archetype: p.archetype,
    tier: p.tier,
    age: p.age,
    crew_id: p.crew_id,
    crew_name: p.crew_name,
    crew_role: p.crew_role,
    creator_id: p.creator_id,
    creator_handle: p.creator_handle,
    churn_risk_score: p.churn_risk_score,
    affinity: {
      wnba_affinity: p.wnba_affinity,
      college_hoops_affinity: p.college_hoops_affinity,
      franchise_mode_affinity: p.franchise_mode_affinity,
    },
  };
}

function voiceInput(p: ConceptPersona) {
  const t = p.telemetry || {};
  return {
    gamer_tag: p.gamer_tag,
    archetype: p.archetype,
    age: p.age,
    myplayer_ovr: t.myplayer_ovr ?? null,
    myplayer_build: t.myplayer_build ?? null,
    vc_spend_90d: t.vc_spend_90d ?? null,
    vc_balance: t.vc_balance ?? null,
    loss_streak: t.loss_streak ?? null,
    rage_quits_7d: t.rage_quits_7d ?? null,
    crew_name: p.crew_name,
    crew_role: p.crew_role === "CAPTAIN" || p.crew_role === "CO_CAPTAIN" ? "CAPTAIN" : p.crew_role,
    creator_handle: p.creator_handle,
    favorite_team: t.favorite_team ?? null,
  };
}

export function buildCoreConceptPrompt(p: ConceptPersona, index: number) {
  const arch = (p.archetype as ArchetypeId) || "MYCAREER_STORY_CASUAL";
  const def = COURTSIDE_PERSONA_PROMPTS[arch] || COURTSIDE_PERSONA_PROMPTS.MYCAREER_STORY_CASUAL;
  const vp = buildIndividualVoiceProfile(voiceInput(p), index);
  const college = buildCollegeHoopsVoiceOverlay(p);
  const affinity = describeConceptAffinities(p);
  const t = p.telemetry || {};

  const system = `${def.systemPrompt}
${college ? `\n${college}\n` : ""}
You are taking part in a 2K concept test for NBA 2K27. Your gamer tag is "@${p.gamer_tag}".
${REAL_ATHLETE_VOICE_GUARD}

${vp.promptDirective}

Rules:
- Score EACH of the three concepts independently (interest 0 to 100), honestly from your own play style. Do not be polite; low scores are fine.
- weekly_hours: hours per week you would realistically spend in that mode in its first month.
- replaces_current_mode: true if those hours would come out of the mode you play most today rather than being extra play.
- preferred_arm: the one concept you would pick if 2K could only build one.
- purchase_intent: whether you would buy NBA 2K27 for your preferred concept (STANDARD, DELUXE, or NONE).
- quote: your reaction in your own voice, strictly ${vp.wordCountRange} (${vp.sentenceTarget}). Say which concept pulls you and why, grounded in how YOU actually play (your modes, team, favorite player, crew, schedule). Talk about the concepts themselves; only bring up VC or pack odds if that is genuinely your main lens. Use at most one slang term, only if it fits your age, and avoid stock words like ngl, lowkey, cooked, taxing or valid. Zero corporate buzzwords, zero em-dashes.`;

  const prompt = `${conceptBlock()}

${editionsLine()}

You:
- @${p.gamer_tag}, age ${p.age ?? "unknown"} · ${archetypeLabel(arch)} (${archetypeDescription(arch)})
- Plays: ${p.primary_franchise}${t.platform ? ` on ${t.platform}` : ""}${t.position ? ` · ${t.position}` : ""}
- MyPLAYER: ${t.myplayer_ovr ?? "n/a"} OVR ${t.myplayer_build ?? ""} · 90-day VC spend $${toNumber(t.vc_spend_90d ?? 0).toFixed(0)}
- Favorite team: ${t.favorite_team ?? "n/a"} · Favorite player: ${t.favorite_player ?? "n/a"}
- Crew: ${p.crew_name} (${p.crew_tier}, ${p.crew_role}) · Follows ${p.creator_handle}
${currentPlayLine(p) ? `- ${currentPlayLine(p)}\n` : ""}${affinity ? `- ${affinity}\n` : ""}- Voice: ${vp.personalHook}

Return strict JSON.`;

  return { system, prompt, voiceProfile: vp };
}

export async function evaluateCorePersona(
  p: ConceptPersona,
  index: number,
  signal?: AbortSignal
): Promise<ConceptVerdict> {
  const { system, prompt, voiceProfile } = buildCoreConceptPrompt(p, index);
  let res;
  try {
    res = await generateText({
      role: "FAST",
      system,
      prompt,
      schema: CORE_SCHEMA,
      temperature: 0.8,
      thinkingBudget: 0,
      maxOutputTokens: 700,
      signal,
    });
  } catch (e) {
    throw vertexError(`core persona @${p.gamer_tag}`, e);
  }
  const parsed = parseModelJson<any>(res.text);
  if (!parsed) {
    throw new ConceptEngineError(
      `Vertex AI ${res.modelUsed} returned unparseable JSON for @${p.gamer_tag}`,
      "vertex-ai",
      "round1 core"
    );
  }
  try {
    return {
      ...baseVerdict(p),
      arms: {
        nba: parseArm(parsed.nba, "nba"),
        wnba: parseArm(parsed.wnba, "wnba"),
        college: parseArm(parsed.college, "college"),
      },
      preferred_arm: toArm(parsed.preferred_arm, "preferred_arm"),
      purchase_intent: toIntent(parsed.purchase_intent),
      quote: cleanQuote(parsed.quote),
      voice_tier: voiceProfile.cadenceTier,
      latency_ms: res.latencyMs,
      model: res.modelUsed,
    };
  } catch (e) {
    throw new ConceptEngineError(
      `Vertex AI ${res.modelUsed} returned an invalid verdict for @${p.gamer_tag}: ${(e as Error).message}`,
      "vertex-ai",
      "round1 core"
    );
  }
}

const CROWD_SCHEMA = {
  type: "OBJECT",
  properties: {
    agents: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          i: { type: "INTEGER" },
          nba: { type: "INTEGER" },
          wnba: { type: "INTEGER" },
          college: { type: "INTEGER" },
          h_nba: { type: "NUMBER" },
          h_wnba: { type: "NUMBER" },
          h_college: { type: "NUMBER" },
          r_nba: { type: "BOOLEAN" },
          r_wnba: { type: "BOOLEAN" },
          r_college: { type: "BOOLEAN" },
          pref: { type: "STRING", enum: ["nba", "wnba", "college"] },
          buy: { type: "STRING", enum: ["STANDARD", "DELUXE", "NONE"] },
          q: { type: "STRING" },
        },
        required: [
          "i", "nba", "wnba", "college", "h_nba", "h_wnba", "h_college",
          "r_nba", "r_wnba", "r_college", "pref", "buy", "q",
        ],
      },
    },
  },
  required: ["agents"],
};

function crowdCompact(p: ConceptPersona, i: number) {
  const t = p.telemetry || {};
  const aff: string[] = [];
  if (p.wnba_affinity !== null) aff.push(`w${p.wnba_affinity.toFixed(2)}`);
  if (p.college_hoops_affinity !== null) aff.push(`c${p.college_hoops_affinity.toFixed(2)}`);
  if (p.franchise_mode_affinity !== null) aff.push(`f${p.franchise_mode_affinity.toFixed(2)}`);
  return {
    i,
    tag: p.gamer_tag,
    arch: p.archetype,
    age: p.age,
    ovr: t.myplayer_ovr ?? null,
    vc90: Math.round(toNumber(t.vc_spend_90d ?? 0)),
    fav: t.favorite_player ?? null,
    crew_role: p.crew_role,
    creator: p.creator_handle,
    ...(aff.length ? { aff: aff.join(" ") } : {}),
  };
}

export async function evaluateCrowdBatch(
  batch: ConceptPersona[],
  batchIndex: number,
  signal?: AbortSignal
): Promise<{ verdicts: ConceptVerdict[]; latencyMs: number; model: string }> {
  const compact = batch.map((p, i) => crowdCompact(p, i));
  const hasAff = compact.some((c) => "aff" in c);
  const system = `You simulate a batch of real NBA 2K players (from the 2K identity graph) reacting to three NBA 2K27 concepts in a concept test. Each player answers from their own archetype, age and play history; scores must differ between players. ${REAL_ATHLETE_VOICE_GUARD} Output compact strict JSON.`;
  const prompt = `${conceptBlock()}

${editionsLine()}

Players (${compact.length}). arch = archetype, vc90 = 90-day VC spend USD, fav = favorite NBA/WNBA player${hasAff ? ", aff = live affinities 0-1 (w = WNBA, c = college hoops, f = franchise mode)" : ""}:
${JSON.stringify(compact)}

For EVERY player (same i), return:
- nba / wnba / college: interest 0-100 per concept
- h_nba / h_wnba / h_college: weekly hours they'd spend in that mode in month one
- r_nba / r_wnba / r_college: true if those hours replace the mode they play most today
- pref: the one concept they'd pick; buy: STANDARD | DELUXE | NONE for their preferred concept
- q: a 4 to 14 word reaction in that player's own voice (vary length and slang by age and archetype, no em-dashes)
{"agents":[{"i":0,"nba":0,"wnba":0,"college":0,"h_nba":0,"h_wnba":0,"h_college":0,"r_nba":false,"r_wnba":false,"r_college":false,"pref":"nba","buy":"NONE","q":""}]}`;

  const attempt = async () => {
    const res = await generateText({
      role: "LITE",
      system,
      prompt,
      schema: CROWD_SCHEMA,
      temperature: 0.8,
      thinkingBudget: 0,
      maxOutputTokens: 8000,
      signal,
    });
    const parsed = parseModelJson<any>(res.text);
    const list: any[] | undefined = Array.isArray(parsed) ? parsed : parsed?.agents;
    if (!Array.isArray(list)) throw new Error(`crowd batch ${batchIndex + 1}: response had no agents array`);
    const byI = new Map<number, any>();
    for (const a of list) if (Number.isInteger(a?.i)) byI.set(a.i, a);
    const verdicts = batch.map((p, i) => {
      const a = byI.get(i);
      if (!a) throw new Error(`crowd batch ${batchIndex + 1}: missing agent i=${i} (@${p.gamer_tag})`);
      return {
        ...baseVerdict(p),
        arms: {
          nba: parseArm({ interest: a.nba, weekly_hours: a.h_nba, replaces_current_mode: a.r_nba }, "nba"),
          wnba: parseArm({ interest: a.wnba, weekly_hours: a.h_wnba, replaces_current_mode: a.r_wnba }, "wnba"),
          college: parseArm(
            { interest: a.college, weekly_hours: a.h_college, replaces_current_mode: a.r_college },
            "college"
          ),
        },
        preferred_arm: toArm(a.pref, "pref"),
        purchase_intent: toIntent(a.buy),
        quote: cleanQuote(a.q),
        model: res.modelUsed,
      } satisfies ConceptVerdict;
    });
    return { verdicts, latencyMs: res.latencyMs, model: res.modelUsed };
  };

  try {
    return await attempt();
  } catch (first) {
    if (signal?.aborted) throw vertexError(`crowd batch ${batchIndex + 1}`, first);
    // One retry of the same live call for malformed JSON / transient errors.
    console.warn(`[concept-test] crowd batch ${batchIndex + 1} retrying after: ${(first as Error).message}`);
    try {
      return await attempt();
    } catch (second) {
      throw vertexError(`crowd batch ${batchIndex + 1}`, second);
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Creator stances + social round
// ---------------------------------------------------------------------------

export async function fetchCohortCreators(
  ids: string[],
  limit = 6
): Promise<Array<Omit<ConceptCreatorStance, "endorsed_arm" | "stance" | "headline"> & { signature_mode: string }>> {
  try {
    const rows = await runRawGql(
      `SELECT cr.creator_id, cr.handle, cr.name, cr.platform, cr.followers, cr.signature_mode,
              COUNT(*) AS cohort_followers
         FROM FollowsCreator f
         JOIN Creators cr ON cr.creator_id = f.creator_id
        WHERE f.player_id IN UNNEST(@ids)
        GROUP BY cr.creator_id, cr.handle, cr.name, cr.platform, cr.followers, cr.signature_mode
        ORDER BY cohort_followers DESC, cr.followers DESC
        LIMIT @limit`,
      { ids, limit }
    );
    return rows.map((r) => ({
      creator_id: String(r.creator_id),
      handle: String(r.handle),
      name: String(r.name),
      platform: String(r.platform),
      followers: toNumber(r.followers),
      cohort_followers: toNumber(r.cohort_followers),
      signature_mode: String(r.signature_mode ?? ""),
    }));
  } catch (e) {
    throw spannerError("cohort creators", e);
  }
}

export async function generateCreatorStances(
  creators: Awaited<ReturnType<typeof fetchCohortCreators>>,
  round1: ConceptVerdict[],
  signal?: AbortSignal
): Promise<{ stances: ConceptCreatorStance[]; latencyMs: number; model: string }> {
  if (creators.length === 0) return { stances: [], latencyMs: 0, model: MODELS.FAST.id };
  const pulse = CONCEPT_ARM_IDS.map(
    (a) => `${CONCEPT_ARMS[a].label} ${round1.filter((v) => v.preferred_arm === a).length}/${round1.length}`
  ).join(" · ");
  const system = `You simulate how real NBA 2K content creators would react on stream to three NBA 2K27 concepts. Each creator keeps their real channel style (signature_mode). Vary headline length (6 to 20 words). ${REAL_ATHLETE_VOICE_GUARD} No em-dashes.`;
  const prompt = `${conceptBlock()}

Community pulse so far (round 1 preference): ${pulse}

Creators (from the 2K identity graph, ordered by how many of this cohort follow them):
${JSON.stringify(creators.map((c) => ({ creator_id: c.creator_id, handle: c.handle, name: c.name, platform: c.platform, followers: c.followers, signature_mode: c.signature_mode })))}

For each creator return the concept they'd hype (endorsed_arm nba | wnba | college | none), stance (ENDORSE | MIXED | CALLOUT) and a stream headline in their voice.
{"creators":[{"creator_id":"","endorsed_arm":"nba","stance":"ENDORSE","headline":""}]}`;
  let res;
  try {
    res = await generateText({
      role: "FAST",
      system,
      prompt,
      schema: {
        type: "OBJECT",
        properties: {
          creators: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                creator_id: { type: "STRING" },
                endorsed_arm: { type: "STRING", enum: ["nba", "wnba", "college", "none"] },
                stance: { type: "STRING", enum: ["ENDORSE", "MIXED", "CALLOUT"] },
                headline: { type: "STRING" },
              },
              required: ["creator_id", "endorsed_arm", "stance", "headline"],
            },
          },
        },
        required: ["creators"],
      },
      temperature: 0.8,
      thinkingBudget: 0,
      maxOutputTokens: 1500,
      signal,
    });
  } catch (e) {
    throw vertexError("creator stances", e);
  }
  const parsed = parseModelJson<any>(res.text);
  const list: any[] | undefined = parsed?.creators;
  if (!Array.isArray(list)) {
    throw new ConceptEngineError(`Vertex AI ${res.modelUsed} returned no creator stances`, "vertex-ai", "creator stances");
  }
  const byId = new Map(list.map((c) => [String(c.creator_id), c]));
  const stances = creators.map((c) => {
    const s = byId.get(c.creator_id);
    if (!s) {
      throw new ConceptEngineError(
        `Vertex AI ${res.modelUsed} omitted a stance for ${c.handle}`,
        "vertex-ai",
        "creator stances"
      );
    }
    const arm = String(s.endorsed_arm).toLowerCase();
    const stance = String(s.stance).toUpperCase();
    return {
      creator_id: c.creator_id,
      handle: c.handle,
      name: c.name,
      platform: c.platform,
      followers: c.followers,
      cohort_followers: c.cohort_followers,
      endorsed_arm: (isConceptArmId(arm) ? arm : "none") as ConceptCreatorStance["endorsed_arm"],
      stance: (stance === "ENDORSE" || stance === "CALLOUT" ? stance : "MIXED") as ConceptCreatorStance["stance"],
      headline: cleanQuote(s.headline),
    };
  });
  return { stances, latencyMs: res.latencyMs, model: res.modelUsed };
}

interface CrewPulse {
  counts: Record<ConceptArmId, number>;
  captain?: { tag: string; arm: ConceptArmId; centrality: number | null };
}

/** Crew pulse from the cohort's own round-1 verdicts (real MEMBER_OF_CLAN edges). */
export function buildCrewPulse(verdicts: ConceptVerdict[], personas: ConceptPersona[]): Map<string, CrewPulse> {
  const centrality = new Map(personas.map((p) => [p.player_id, p.crew_centrality]));
  const pulse = new Map<string, CrewPulse>();
  for (const v of verdicts) {
    if (!v.crew_id) continue;
    const entry = pulse.get(v.crew_id) || { counts: { nba: 0, wnba: 0, college: 0 } };
    entry.counts[v.preferred_arm]++;
    const isCap = v.crew_role === "CAPTAIN" || v.crew_role === "CO_CAPTAIN";
    const c = centrality.get(v.player_id) ?? null;
    if (isCap || c !== null) {
      const better =
        !entry.captain ||
        (c !== null && (entry.captain.centrality ?? -1) < c) ||
        (c === null && isCap && entry.captain.centrality === null && v.crew_role === "CAPTAIN");
      if (better && (isCap || (c !== null && c >= 0.6))) {
        entry.captain = { tag: v.gamer_tag, arm: v.preferred_arm, centrality: c };
      }
    }
    pulse.set(v.crew_id, entry);
  }
  return pulse;
}

function crewSignal(v: ConceptVerdict, pulse: Map<string, CrewPulse>) {
  const p = v.crew_id ? pulse.get(v.crew_id) : undefined;
  if (!p) return null;
  const counts = { ...p.counts };
  counts[v.preferred_arm] = Math.max(0, counts[v.preferred_arm] - 1); // exclude self
  const total = counts.nba + counts.wnba + counts.college;
  const captain = p.captain && p.captain.tag !== v.gamer_tag ? p.captain : undefined;
  if (total === 0 && !captain) return null;
  const majority = (CONCEPT_ARM_IDS.slice().sort((a, b) => counts[b] - counts[a])[0]) as ConceptArmId;
  return { counts, total, majority: total > 0 ? majority : null, captain };
}

function shiftDriverFor(
  to: ConceptArmId,
  modelDriver: string,
  crew: ReturnType<typeof crewSignal>,
  creator: ConceptCreatorStance | undefined
): { driver: "CREW" | "CREATOR"; source: string } {
  const crewArm = crew?.captain?.arm ?? crew?.majority ?? null;
  const creatorArm = creator && creator.stance !== "CALLOUT" ? creator.endorsed_arm : null;
  const crewSource = crew?.captain ? `@${crew.captain.tag}` : "Crew";
  const md = String(modelDriver || "").toUpperCase();
  if (md === "CREATOR" && creatorArm === to && creator) return { driver: "CREATOR", source: creator.handle };
  if (md === "CREW" && crewArm === to) return { driver: "CREW", source: crewSource };
  if (creatorArm === to && creator) return { driver: "CREATOR", source: creator.handle };
  if (crewArm === to || (crew && crew.counts[to] > 0)) return { driver: "CREW", source: crewSource };
  return md === "CREATOR" && creator
    ? { driver: "CREATOR", source: creator.handle }
    : { driver: "CREW", source: crewSource };
}

export async function socialRoundCore(
  core: ConceptVerdict[],
  personas: ConceptPersona[],
  pulse: Map<string, CrewPulse>,
  stances: ConceptCreatorStance[],
  signal?: AbortSignal
): Promise<{ shifts: ConceptShift[]; updated: ConceptVerdict[]; latencyMs: number; model: string }> {
  const started = Date.now();
  const stanceById = new Map(stances.map((s) => [s.creator_id, s]));
  const personaById = new Map(personas.map((p) => [p.player_id, p]));
  let model: string = MODELS.FAST.id;

  const inputs = core.map((v, index) => {
    const p = personaById.get(v.player_id)!;
    const vp = buildIndividualVoiceProfile(voiceInput(p), index);
    const crew = crewSignal(v, pulse);
    const cr = v.creator_id ? stanceById.get(v.creator_id) : undefined;
    return {
      index,
      gamer_tag: v.gamer_tag,
      archetype: v.archetype,
      round1_pref: v.preferred_arm,
      interest: { nba: v.arms.nba.interest, wnba: v.arms.wnba.interest, college: v.arms.college.interest },
      round1_quote: v.quote,
      crew: crew
        ? {
            crew_name: v.crew_name,
            crewmates_pref: crew.counts,
            captain: crew.captain ? `@${crew.captain.tag} picked ${crew.captain.arm}` : null,
          }
        : null,
      followed_creator: cr ? { handle: cr.handle, stance: cr.stance, hypes: cr.endorsed_arm, headline: cr.headline } : null,
      voice_word_range: vp.wordCountRange,
      voice_directive: vp.promptDirective,
      _crew: crew,
      _creator: cr,
    };
  });

  const system = `You run the social round of an NBA 2K27 concept test. Each player already chose a concept on their own (round1_pref). Now they see their Crew (MEMBER_OF_CLAN: crewmates' picks and their captain's pick) and the stream take of the creator they follow (FOLLOWS_CREATOR).
Social proof matters in 2K: a player whose captain, crewmates or followed creator clearly back a concept they already rated within ~25 points of their pick will often move to it. Players with a big gap, or loyal archetypes defending their home mode, hold. Never shift toward a concept nobody in their signals backs.
${REAL_ATHLETE_VOICE_GUARD}
Every quote must obey that player's voice_word_range / voice_directive. If they shifted, mention the @captain, crew or @creator that moved them. No em-dashes.`;

  const chunks = chunk(inputs, 5);
  const results = await Promise.all(
    chunks.map(async (c) => {
      const prompt = `Concepts: nba = ${CONCEPT_ARMS.nba.title}; wnba = ${CONCEPT_ARMS.wnba.title}; college = ${CONCEPT_ARMS.college.title}

Players:
${JSON.stringify(c.map(({ _crew, _creator, ...rest }) => rest), null, 1)}

Return {"social":[{"index":0,"final_arm":"nba","driver":"CREW|CREATOR|NONE","quote":""}]} for every index.`;
      let res;
      try {
        res = await generateText({
          role: "FAST",
          system,
          prompt,
          schema: {
            type: "OBJECT",
            properties: {
              social: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    index: { type: "INTEGER" },
                    final_arm: { type: "STRING", enum: ["nba", "wnba", "college"] },
                    driver: { type: "STRING", enum: ["CREW", "CREATOR", "NONE"] },
                    quote: { type: "STRING" },
                  },
                  required: ["index", "final_arm", "driver", "quote"],
                },
              },
            },
            required: ["social"],
          },
          temperature: 0.6,
          thinkingBudget: 0,
          maxOutputTokens: 2500,
          signal,
        });
      } catch (e) {
        throw vertexError("social round (core)", e);
      }
      model = res.modelUsed;
      const parsed = parseModelJson<any>(res.text);
      if (!Array.isArray(parsed?.social)) {
        throw new ConceptEngineError(`Vertex AI ${res.modelUsed} returned no social round payload`, "vertex-ai", "social round (core)");
      }
      return parsed.social as any[];
    })
  );
  const byIndex = new Map<number, any>();
  for (const r of results.flat()) if (Number.isInteger(r?.index)) byIndex.set(r.index, r);

  const shifts: ConceptShift[] = [];
  const updated = core.map((v, index) => {
    const r = byIndex.get(index);
    if (!r) {
      throw new ConceptEngineError(`Social round omitted core persona @${v.gamer_tag}`, "vertex-ai", "social round (core)");
    }
    const to = toArm(r.final_arm, "final_arm");
    const inp = inputs[index];
    if (to === v.preferred_arm) {
      return { ...v, final_arm: to, shifted: false, shift_driver: "NONE" as const, final_quote: cleanQuote(r.quote) };
    }
    const { driver, source } = shiftDriverFor(to, r.driver, inp._crew, inp._creator);
    const quote = cleanQuote(r.quote);
    shifts.push({
      player_id: v.player_id,
      gamer_tag: v.gamer_tag,
      archetype: v.archetype,
      tier: "core",
      from: v.preferred_arm,
      to,
      driver,
      source,
      quote,
    });
    return { ...v, final_arm: to, shifted: true, shift_driver: driver, shift_source: source, final_quote: quote };
  });
  return { shifts, updated, latencyMs: Date.now() - started, model };
}

export async function socialRoundCrowdBatch(
  batch: ConceptVerdict[],
  batchIndex: number,
  pulse: Map<string, CrewPulse>,
  stances: ConceptCreatorStance[],
  signal?: AbortSignal
): Promise<{ shifts: ConceptShift[]; updated: ConceptVerdict[]; latencyMs: number; model: string }> {
  const stanceById = new Map(stances.map((s) => [s.creator_id, s]));
  const ctx = batch.map((v, i) => {
    const crew = crewSignal(v, pulse);
    const cr = v.creator_id ? stanceById.get(v.creator_id) : undefined;
    return { v, i, crew, cr };
  });
  const compact = ctx.map(({ v, i, crew, cr }) => ({
    i,
    arch: v.archetype,
    pref: v.preferred_arm,
    int: `${v.arms.nba.interest}/${v.arms.wnba.interest}/${v.arms.college.interest}`,
    ...(crew ? { crew: `nba${crew.counts.nba} wnba${crew.counts.wnba} college${crew.counts.college}` } : {}),
    ...(crew?.captain ? { cap: crew.captain.arm } : {}),
    ...(cr ? { cr: `${cr.handle} ${cr.stance} ${cr.endorsed_arm}` } : {}),
  }));
  const system = `Social round of an NBA 2K27 concept test for a batch of real 2K players. Each has a round-1 pick (pref) and interest nba/wnba/college. They now see crewmates' picks (crew), their captain's pick (cap) and their followed creator's stance (cr). Social proof matters in 2K: shift when the signal clearly backs a concept they rated within ~25 points of their pick; hold when the gap is big or nobody in their signals backs the other concept. Output strict JSON.`;
  const prompt = `${JSON.stringify(compact)}

Return {"agents":[{"i":0,"final":"nba","driver":"CREW|CREATOR|NONE"}]} for every i.`;

  const attempt = async () => {
    const res = await generateText({
      role: "LITE",
      system,
      prompt,
      schema: {
        type: "OBJECT",
        properties: {
          agents: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                i: { type: "INTEGER" },
                final: { type: "STRING", enum: ["nba", "wnba", "college"] },
                driver: { type: "STRING", enum: ["CREW", "CREATOR", "NONE"] },
              },
              required: ["i", "final", "driver"],
            },
          },
        },
        required: ["agents"],
      },
      temperature: 0.5,
      thinkingBudget: 0,
      maxOutputTokens: 4000,
      signal,
    });
    const parsed = parseModelJson<any>(res.text);
    const list: any[] | undefined = parsed?.agents;
    if (!Array.isArray(list)) throw new Error(`social batch ${batchIndex + 1}: no agents array`);
    const byI = new Map<number, any>();
    for (const a of list) if (Number.isInteger(a?.i)) byI.set(a.i, a);
    const shifts: ConceptShift[] = [];
    const updated = ctx.map(({ v, i, crew, cr }) => {
      const a = byI.get(i);
      if (!a) throw new Error(`social batch ${batchIndex + 1}: missing i=${i}`);
      const to = toArm(a.final, "final");
      if (to === v.preferred_arm) return { ...v, final_arm: to, shifted: false, shift_driver: "NONE" as const };
      const { driver, source } = shiftDriverFor(to, a.driver, crew, cr);
      shifts.push({
        player_id: v.player_id,
        gamer_tag: v.gamer_tag,
        archetype: v.archetype,
        tier: "crowd",
        from: v.preferred_arm,
        to,
        driver,
        source,
      });
      return { ...v, final_arm: to, shifted: true, shift_driver: driver, shift_source: source };
    });
    return { shifts, updated, latencyMs: res.latencyMs, model: res.modelUsed };
  };
  try {
    return await attempt();
  } catch (first) {
    if (signal?.aborted) throw vertexError(`social batch ${batchIndex + 1}`, first);
    console.warn(`[concept-test] social batch ${batchIndex + 1} retrying after: ${(first as Error).message}`);
    try {
      return await attempt();
    } catch (second) {
      throw vertexError(`social batch ${batchIndex + 1}`, second);
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Synthesis
// ---------------------------------------------------------------------------

function pct(x: number) {
  return `${(x * 100).toFixed(1)}%`;
}

export async function synthesizeConcept(
  round1: ConceptArmAggregate[],
  final: ConceptArmAggregate[],
  verdicts: ConceptVerdict[],
  stances: ConceptCreatorStance[],
  shiftsCount: number,
  cohort: ConceptCohortSummary,
  signal?: AbortSignal
): Promise<ConceptSynthesis> {
  const table = final
    .map((a) => {
      const r1 = round1.find((x) => x.arm === a.arm)!;
      return `${a.arm} (${CONCEPT_ARMS[a.arm].title}): share ${pct(r1.share_of_preference)} -> ${pct(a.share_of_preference)} after social; mean interest ${a.mean_interest.toFixed(1)} (95% CI ${a.interest_ci_low.toFixed(1)} to ${a.interest_ci_high.toFixed(1)}); incremental ${a.incremental_hours.toFixed(2)} h/wk per player; cannibalization ${pct(a.cannibalization_rate)} of ${a.interested_count} interested; purchase among preferrers std ${a.purchase.standard} / deluxe ${a.purchase.deluxe} / none ${a.purchase.none}; best-fit archetypes ${a.best_fit_archetypes.map((b) => `${b.archetype} ${b.mean_interest.toFixed(0)} (n=${b.n})`).join(", ")}`;
    })
    .join("\n");
  const quotes = CONCEPT_ARM_IDS.map((arm) => {
    const qs = verdicts
      .filter((v) => v.tier === "core" && (v.final_arm ?? v.preferred_arm) === arm)
      .slice(0, 4)
      .map((v) => `"${v.final_quote || v.quote}" (@${v.gamer_tag}, ${v.archetype})`);
    return `${arm}: ${qs.join(" | ") || "none"}`;
  }).join("\n");

  const system = `You are the 2K Insights lead writing the readout of a synthetic concept test for NBA 2K27 executives. Be crisp and specific. Use ONLY the numbers given; never invent figures. This is a synthetic audience grounded in live 2K identity-graph personas, so frame it as directional, and size confidence by n and CI overlap. No em-dashes, no emoji.`;
  const prompt = `Cohort: n=${cohort.n} live personas from ${cohort.database} (${cohort.core} individually voiced core + ${cohort.crowd} crowd), ${cohort.crews} crews. Concept affinity columns available: ${cohort.affinity_columns.join(", ") || "none on this database"}.
Social round shifted ${shiftsCount} of ${cohort.n} picks.

Per-arm results:
${table}

Creator stances: ${stances.map((s) => `${s.handle} ${s.stance} ${s.endorsed_arm}`).join("; ") || "none"}

Sample core quotes by final pick:
${quotes}

Write the readout as strict JSON:
{"headline": "<= 16 words",
 "recommendation": {"arm": "nba|wnba|college", "confidence": "low|medium|high", "rationale": "2 sentences citing the numbers"},
 "arms": [{"arm":"nba","opportunity":"1 sentence","risk":"1 sentence","best_fit":"archetypes in plain words"}, ...all three],
 "cannibalization_note": "1 sentence",
 "next_test": "1 sentence: the next experiment to de-risk the call"}`;
  let res;
  try {
    res = await generateText({
      role: "REASONING",
      system,
      prompt,
      schema: {
        type: "OBJECT",
        properties: {
          headline: { type: "STRING" },
          recommendation: {
            type: "OBJECT",
            properties: {
              arm: { type: "STRING", enum: ["nba", "wnba", "college"] },
              confidence: { type: "STRING", enum: ["low", "medium", "high"] },
              rationale: { type: "STRING" },
            },
            required: ["arm", "confidence", "rationale"],
          },
          arms: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                arm: { type: "STRING", enum: ["nba", "wnba", "college"] },
                opportunity: { type: "STRING" },
                risk: { type: "STRING" },
                best_fit: { type: "STRING" },
              },
              required: ["arm", "opportunity", "risk", "best_fit"],
            },
          },
          cannibalization_note: { type: "STRING" },
          next_test: { type: "STRING" },
        },
        required: ["headline", "recommendation", "arms", "cannibalization_note", "next_test"],
      },
      temperature: 0.4,
      thinkingBudget: 512,
      maxOutputTokens: 4000,
      signal,
    });
  } catch (e) {
    throw vertexError("synthesis", e);
  }
  const p = parseModelJson<any>(res.text);
  if (!p?.recommendation || !Array.isArray(p?.arms)) {
    throw new ConceptEngineError(`Vertex AI ${res.modelUsed} returned an invalid synthesis payload`, "vertex-ai", "synthesis");
  }
  return {
    headline: cleanQuote(p.headline),
    recommendation: {
      arm: toArm(p.recommendation.arm, "recommendation.arm"),
      confidence: ["low", "medium", "high"].includes(p.recommendation.confidence) ? p.recommendation.confidence : "low",
      rationale: cleanQuote(p.recommendation.rationale),
    },
    arms: p.arms
      .filter((a: any) => isConceptArmId(a?.arm))
      .map((a: any) => ({
        arm: a.arm as ConceptArmId,
        opportunity: cleanQuote(a.opportunity),
        risk: cleanQuote(a.risk),
        best_fit: cleanQuote(a.best_fit),
      })),
    cannibalization_note: cleanQuote(p.cannibalization_note),
    next_test: cleanQuote(p.next_test),
    model: res.modelUsed,
    latency_ms: res.latencyMs,
  };
}

export { SpannerUnavailableError };
