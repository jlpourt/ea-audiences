/**
 * Section D · Personalization Flow engine (server only). Contract §7.
 *
 *   Pick user (Spanner) -> Infer preference (Vertex FAST, JSON schema) ->
 *   Content pairs (GCS content library + FAST copy, scored by 6 synthetic twins
 *   from the graph) -> Serve (channel copy; dispatch via Pub/Sub + BigQuery in
 *   ./serve/route.ts).
 *
 * v1 vs v2: v2-only columns/tables (concept affinities, PlayedWith, Watched,
 * Bought) are detected through INFORMATION_SCHEMA and only queried when they
 * exist. Nothing is invented when they are absent. Every GCP failure throws a
 * `PersonalizeError` naming the service and stage; there are no fallbacks.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { generateText, parseModelJson } from "@/lib/gcp/genai-client";
import { runRawGql, toNumber, parseJsonColumn } from "@/lib/gcp/spanner-client";
import { getStorage } from "@/lib/gcp/storage-client";
import { GCP_CONFIG } from "@/lib/config";
import { archetypeLabel, archetypeDescription, type ArchetypeId } from "@/lib/archetypes";
import {
  COURTSIDE_PERSONA_PROMPTS,
  buildIndividualVoiceProfile,
  buildCollegeHoopsVoiceOverlay,
  describeConceptAffinities,
  REAL_ATHLETE_VOICE_GUARD,
} from "@/lib/prompts/courtside_personas";
import {
  CHANNELS,
  CHANNEL_IDS,
  HOLDOUT_PCT,
  isHoldout,
  PREFERENCE_IDS,
  PREFERENCES,
  isConceptArmId,
  type ChannelActivation,
  type ContentPair,
  type CreativeFormat,
  type PersonalizePreset,
  type PersonalizeUser,
  type PreferenceEvidence,
  type PreferenceId,
  type PreferenceInference,
  type Twin,
  type TwinScore,
  type UserSignals,
} from "@/lib/v2/concept";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type PersonalizeService = "cloud-spanner" | "vertex-ai" | "cloud-storage" | "pubsub" | "bigquery";

export class PersonalizeError extends Error {
  constructor(
    message: string,
    readonly service: PersonalizeService,
    readonly stage: string,
    readonly status = 502,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "PersonalizeError";
  }
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

function spannerErr(stage: string, e: unknown) {
  if (e instanceof PersonalizeError) return e;
  return new PersonalizeError(
    `Cloud Spanner ${stage} failed on ${GCP_CONFIG.spannerInstanceId}/${GCP_CONFIG.spannerDatabaseId}: ${errMsg(e)}`,
    "cloud-spanner",
    stage,
    503,
    e
  );
}

function vertexErr(stage: string, e: unknown) {
  if (e instanceof PersonalizeError) return e;
  return new PersonalizeError(`Vertex AI ${stage} failed: ${errMsg(e)}`, "vertex-ai", stage, 502, e);
}

function clean(s: unknown): string {
  return String(s ?? "")
    .replace(/[\u2014\u2013]/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Schema capabilities (v1 vs v2)
// ---------------------------------------------------------------------------

interface Caps {
  database: string;
  affinity: { wnba: boolean; college: boolean; franchise: boolean };
  tables: Set<string>;
}

const capsCache = new Map<string, Caps>();

export async function detectCaps(): Promise<Caps> {
  const key = `${GCP_CONFIG.spannerInstanceId}/${GCP_CONFIG.spannerDatabaseId}`;
  const hit = capsCache.get(key);
  if (hit) return hit;
  try {
    const [cols, tables] = await Promise.all([
      runRawGql(
        `SELECT column_name FROM INFORMATION_SCHEMA.COLUMNS
          WHERE table_schema = '' AND table_name = 'Players'`
      ),
      runRawGql(`SELECT table_name FROM INFORMATION_SCHEMA.TABLES WHERE table_schema = ''`),
    ]);
    const has = (c: string) => cols.some((r) => r.column_name === c);
    const caps: Caps = {
      database: GCP_CONFIG.spannerDatabaseId,
      affinity: {
        wnba: has("wnba_affinity"),
        college: has("college_hoops_affinity"),
        franchise: has("franchise_mode_affinity"),
      },
      tables: new Set(tables.map((t) => String(t.table_name))),
    };
    capsCache.set(key, caps);
    return caps;
  } catch (e) {
    throw spannerErr("schema detection", e);
  }
}

function affinityCols(caps: Caps): string[] {
  const out: string[] = [];
  if (caps.affinity.wnba) out.push("p.wnba_affinity");
  if (caps.affinity.college) out.push("p.college_hoops_affinity");
  if (caps.affinity.franchise) out.push("p.franchise_mode_affinity");
  return out;
}

const hasAllAffinity = (c: Caps) => c.affinity.wnba && c.affinity.college && c.affinity.franchise;

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/** WNBA players present in Players.game_telemetry.favorite_player (live values). */
const WNBA_FAVORITES = [
  "Caitlin Clark",
  "Sabrina Ionescu",
  "Breanna Stewart",
  "A'ja Wilson",
  "Angel Reese",
  "Paige Bueckers",
  "Napheesa Collier",
];
/** Players whose fandom started in recent college seasons (v1 college proxy only). */
const RECENT_COLLEGE_STARS = ["Cooper Flagg", "Paige Bueckers"];

const NBA_FRANCHISES = "('NBA2K', 'NBA2K26', 'NBA2KMOBILE')";

function userSelect(caps: Caps): string {
  return [
    "p.player_id",
    "p.gamer_tag",
    "p.primary_archetype",
    "p.primary_franchise",
    "p.age",
    "p.lifetime_spend_usd",
    "p.churn_risk_score",
    "p.game_telemetry",
    "m.clan_id",
    "m.role AS crew_role",
    "c.name AS crew_name",
    "c.tier AS crew_tier",
    ...affinityCols(caps),
  ].join(", ");
}

function mapUser(r: any, creators: PersonalizeUser["creators"]): PersonalizeUser {
  const t = parseJsonColumn(r.game_telemetry, {}) as Record<string, any>;
  const num = (v: unknown) => (v === null || v === undefined ? null : Number.isFinite(toNumber(v)) ? toNumber(v) : null);
  return {
    player_id: String(r.player_id),
    gamer_tag: String(r.gamer_tag),
    archetype: String(r.primary_archetype),
    age: num(r.age),
    primary_franchise: String(r.primary_franchise),
    ovr: num(t.myplayer_ovr),
    build: t.myplayer_build ?? null,
    position: t.position ?? null,
    platform: t.platform ?? null,
    favorite_team: t.favorite_team ?? null,
    favorite_player: t.favorite_player ?? null,
    lifetime_spend_usd: toNumber(r.lifetime_spend_usd),
    churn_risk_score: toNumber(r.churn_risk_score),
    crew: r.clan_id
      ? { id: String(r.clan_id), name: String(r.crew_name), tier: String(r.crew_tier), role: String(r.crew_role) }
      : null,
    creators,
    affinity: {
      wnba: "wnba_affinity" in r ? num(r.wnba_affinity) : null,
      college: "college_hoops_affinity" in r ? num(r.college_hoops_affinity) : null,
      franchise: "franchise_mode_affinity" in r ? num(r.franchise_mode_affinity) : null,
    },
  };
}

async function creatorsFor(ids: string[]): Promise<Map<string, PersonalizeUser["creators"]>> {
  const out = new Map<string, PersonalizeUser["creators"]>();
  if (ids.length === 0) return out;
  const rows = await runRawGql(
    `SELECT f.player_id, cr.handle, cr.name, cr.signature_mode
       FROM FollowsCreator f JOIN Creators cr ON cr.creator_id = f.creator_id
      WHERE f.player_id IN UNNEST(@ids)
      ORDER BY cr.followers DESC`,
    { ids }
  );
  for (const r of rows) {
    const list = out.get(String(r.player_id)) || [];
    list.push({ handle: String(r.handle), name: String(r.name), signature_mode: String(r.signature_mode ?? "") });
    out.set(String(r.player_id), list);
  }
  return out;
}

async function hydrateUsers(rows: any[]): Promise<PersonalizeUser[]> {
  const creators = await creatorsFor(rows.map((r) => String(r.player_id)));
  return rows.map((r) => mapUser(r, creators.get(String(r.player_id)) || []));
}

export async function fetchUser(playerId: string): Promise<PersonalizeUser> {
  const caps = await detectCaps();
  try {
    const rows = await runRawGql(
      `SELECT ${userSelect(caps)}
         FROM Players p
         LEFT JOIN MemberOfClan m ON m.player_id = p.player_id
         LEFT JOIN Clans c ON c.clan_id = m.clan_id
        WHERE p.player_id = @id
        LIMIT 1`,
      { id: playerId }
    );
    if (rows.length === 0) {
      throw new PersonalizeError(`Player ${playerId} not found in ${caps.database}`, "cloud-spanner", "user", 404);
    }
    return (await hydrateUsers(rows))[0];
  } catch (e) {
    throw spannerErr("user lookup", e);
  }
}

/**
 * Picker list + presets. v2: ranked by the live affinity columns. v1: ranked by
 * archetype and telemetry signals (favorite player, age), and labelled as such.
 */
type PickerResult = {
  presets: PersonalizePreset[];
  users: PersonalizeUser[];
  lean_basis: "affinity" | "archetype_telemetry";
  caps: Caps;
};
/** Live picker results are reused for 2 minutes per DB (real rows, never synthesized). */
const pickerCache = new Map<string, { at: number; value: PickerResult }>();

export async function listPickerUsers(): Promise<PickerResult> {
  const key = `${GCP_CONFIG.spannerInstanceId}/${GCP_CONFIG.spannerDatabaseId}`;
  const hit = pickerCache.get(key);
  if (hit && Date.now() - hit.at < 120_000) return hit.value;
  const value = await listPickerUsersLive();
  pickerCache.set(key, { at: Date.now(), value });
  return value;
}

async function listPickerUsersLive(): Promise<PickerResult> {
  const caps = await detectCaps();
  const sel = userSelect(caps);
  const base = `FROM Players p
      JOIN MemberOfClan m ON m.player_id = p.player_id
      JOIN Clans c ON c.clan_id = m.clan_id
     WHERE p.primary_franchise IN ${NBA_FRANCHISES}
       AND EXISTS (SELECT 1 FROM FollowsCreator f WHERE f.player_id = p.player_id)`;
  const fav = "JSON_VALUE(p.game_telemetry, '$.favorite_player')";
  try {
    let nbaRows: any[];
    let wnbaRows: any[];
    let collegeRows: any[];
    let lean: "affinity" | "archetype_telemetry";
    if (hasAllAffinity(caps)) {
      lean = "affinity";
      [nbaRows, wnbaRows, collegeRows] = await Promise.all([
        runRawGql(
          `SELECT ${sel} ${base} ORDER BY p.franchise_mode_affinity - GREATEST(p.wnba_affinity, p.college_hoops_affinity) DESC LIMIT 8`
        ),
        runRawGql(
          `SELECT ${sel} ${base} ORDER BY p.wnba_affinity - GREATEST(p.college_hoops_affinity, p.franchise_mode_affinity) DESC LIMIT 8`
        ),
        runRawGql(
          `SELECT ${sel} ${base} ORDER BY p.college_hoops_affinity - GREATEST(p.wnba_affinity, p.franchise_mode_affinity) DESC LIMIT 8`
        ),
      ]);
    } else {
      lean = "archetype_telemetry";
      [nbaRows, wnbaRows, collegeRows] = await Promise.all([
        runRawGql(
          `SELECT ${sel} ${base}
             AND p.primary_archetype IN ('MYNBA_FRANCHISE_SIM', 'PARK_REP_GRINDER', 'REC_CREW_CAPTAIN')
             AND ${fav} NOT IN UNNEST(@wnba)
           ORDER BY CAST(JSON_VALUE(p.game_telemetry, '$.hours_played') AS FLOAT64) DESC LIMIT 8`,
          { wnba: WNBA_FAVORITES }
        ),
        runRawGql(
          `SELECT ${sel} ${base}
             AND p.primary_archetype = 'THE_W_LOYALIST' AND ${fav} IN UNNEST(@wnba)
           ORDER BY p.lifetime_spend_usd DESC LIMIT 8`,
          { wnba: WNBA_FAVORITES }
        ),
        runRawGql(
          `SELECT ${sel} ${base}
             AND p.age <= 21 AND p.primary_archetype IN ('MYCAREER_STORY_CASUAL', 'MOBILE_DAILY_RITUALIST')
           ORDER BY IF(${fav} IN UNNEST(@college), 0, 1), p.age LIMIT 8`,
          { college: RECENT_COLLEGE_STARS }
        ),
      ]);
    }
    const [nba, wnba, college] = await Promise.all([
      hydrateUsers(nbaRows),
      hydrateUsers(wnbaRows),
      hydrateUsers(collegeRows),
    ]);
    if (!nba[0] || !wnba[0] || !college[0]) {
      throw new PersonalizeError(
        `Picker query returned an empty lean bucket on ${caps.database} (nba=${nba.length}, wnba=${wnba.length}, college=${college.length})`,
        "cloud-spanner",
        "picker",
        503
      );
    }
    const basis = (pref: PreferenceId, u: PersonalizeUser) => {
      if (lean === "affinity") {
        const v = pref === "nba" ? u.affinity.franchise : pref === "wnba" ? u.affinity.wnba : u.affinity.college;
        const col = pref === "nba" ? "franchise_mode_affinity" : pref === "wnba" ? "wnba_affinity" : "college_hoops_affinity";
        return `${col} ${v?.toFixed(2)}`;
      }
      if (pref === "wnba") return `The W Loyalist · favorite player ${u.favorite_player}`;
      if (pref === "college") return `age ${u.age} · ${archetypeLabel(u.archetype)}${u.favorite_player ? ` · fan of ${u.favorite_player}` : ""}`;
      return `${archetypeLabel(u.archetype)} · favorite player ${u.favorite_player}`;
    };
    const presets: PersonalizePreset[] = [
      { pref: "nba", label: "NBA grinder", basis: basis("nba", nba[0]), user: nba[0] },
      { pref: "wnba", label: "WNBA loyalist", basis: basis("wnba", wnba[0]), user: wnba[0] },
      { pref: "college", label: "College casual", basis: basis("college", college[0]), user: college[0] },
    ];
    const seen = new Set<string>();
    const users: PersonalizeUser[] = [];
    for (let i = 0; i < 8; i++) {
      for (const list of [nba, wnba, college]) {
        const u = list[i];
        if (u && !seen.has(u.player_id)) {
          seen.add(u.player_id);
          users.push(u);
        }
      }
    }
    return { presets, users, lean_basis: lean, caps };
  } catch (e) {
    throw spannerErr("picker", e);
  }
}

export async function randomUser(seed: string): Promise<PersonalizeUser> {
  const caps = await detectCaps();
  try {
    const rows = await runRawGql(
      `SELECT ${userSelect(caps)}
         FROM Players p
         JOIN MemberOfClan m ON m.player_id = p.player_id
         JOIN Clans c ON c.clan_id = m.clan_id
        WHERE p.primary_franchise IN ${NBA_FRANCHISES}
        ORDER BY FARM_FINGERPRINT(CONCAT(p.player_id, @seed))
        LIMIT 1`,
      { seed }
    );
    if (!rows[0]) throw new Error("no eligible players");
    return (await hydrateUsers(rows))[0];
  } catch (e) {
    throw spannerErr("surprise pick", e);
  }
}

// ---------------------------------------------------------------------------
// Graph signals for preference inference
// ---------------------------------------------------------------------------

export async function fetchSignals(user: PersonalizeUser): Promise<UserSignals> {
  const caps = await detectCaps();
  const sources: string[] = ["Players", "FollowsCreator → Creators"];
  try {
    const tasks: Array<Promise<void>> = [];
    let crew_mix: UserSignals["crew_mix"] = [];
    let crew_wnba_fans = 0;
    let crew_size_sampled = 0;
    let purchases: UserSignals["purchases"] = [];
    let watched_streams: UserSignals["watched_streams"] = [];
    let friends_affinity: UserSignals["friends_affinity"] = null;

    if (user.crew) {
      sources.push("MemberOfClan → crewmates");
      tasks.push(
        runRawGql(
          `SELECT p.primary_archetype AS archetype, COUNT(*) AS n,
                  COUNTIF(JSON_VALUE(p.game_telemetry, '$.favorite_player') IN UNNEST(@wnba)) AS wnba_fans
             FROM MemberOfClan m JOIN Players p ON p.player_id = m.player_id
            WHERE m.clan_id = @clan AND m.player_id != @id
            GROUP BY archetype ORDER BY n DESC`,
          { clan: user.crew.id, id: user.player_id, wnba: WNBA_FAVORITES }
        ).then((rows) => {
          crew_mix = rows.map((r) => ({ archetype: String(r.archetype), n: toNumber(r.n) }));
          crew_wnba_fans = rows.reduce((a, r) => a + toNumber(r.wnba_fans), 0);
          crew_size_sampled = rows.reduce((a, r) => a + toNumber(r.n), 0);
        })
      );
    }

    if (caps.tables.has("Bought") && caps.tables.has("Items")) {
      sources.push("BOUGHT → Items → Brands");
      const brandJoin = caps.tables.has("Brands") ? "LEFT JOIN Brands br ON br.brand_id = i.brand_id" : "";
      const brandCol = caps.tables.has("Brands") ? "br.name" : "CAST(NULL AS STRING)";
      tasks.push(
        runRawGql(
          `SELECT i.name, i.item_type, ${brandCol} AS brand, b.vc_amount
             FROM Bought b JOIN Items i ON i.item_id = b.item_id ${brandJoin}
            WHERE b.player_id = @id ORDER BY b.bought_at DESC LIMIT 6`,
          { id: user.player_id }
        ).then((rows) => {
          purchases = rows.map((r) => ({
            title: r.brand ? `${r.brand} · ${r.name}` : String(r.name),
            category: String(r.item_type),
            price: r.vc_amount === null || r.vc_amount === undefined ? null : toNumber(r.vc_amount),
          }));
        })
      );
    } else {
      sources.push("Players.purchased_items");
      tasks.push(
        runRawGql(`SELECT purchased_items FROM Players WHERE player_id = @id`, { id: user.player_id }).then((rows) => {
          const items = parseJsonColumn(rows[0]?.purchased_items, []) as any[];
          purchases = (Array.isArray(items) ? items : []).slice(0, 6).map((it) => ({
            title: String(it.title ?? it.offer_id ?? "item"),
            category: String(it.category ?? it.type ?? ""),
            price: it.price === undefined || it.price === null ? null : toNumber(it.price),
          }));
        })
      );
    }

    if (caps.tables.has("Watched") && caps.tables.has("Streams") && caps.tables.has("HasIdentity")) {
      sources.push("HAS_IDENTITY → WATCHED → Streams");
      tasks.push(
        runRawGql(
          `SELECT s.title, cr.handle, w.watch_minutes
             FROM HasIdentity h
             JOIN Watched w ON w.identity_id = h.identity_id
             JOIN Streams s ON s.stream_id = w.stream_id
             LEFT JOIN Creators cr ON cr.creator_id = s.creator_id
            WHERE h.player_id = @id
            ORDER BY w.watch_minutes DESC LIMIT 5`,
          { id: user.player_id }
        ).then((rows) => {
          watched_streams = rows.map((r) => ({
            title: String(r.title),
            creator: String(r.handle ?? ""),
            minutes: toNumber(r.watch_minutes),
          }));
        })
      );
    }

    if (caps.tables.has("PlayedWith") && hasAllAffinity(caps)) {
      sources.push("PLAYED_WITH → co-players' affinities");
      tasks.push(
        runRawGql(
          `SELECT AVG(o.wnba_affinity) AS wnba, AVG(o.college_hoops_affinity) AS college,
                  AVG(o.franchise_mode_affinity) AS franchise, COUNT(*) AS n
             FROM PlayedWith pw
             JOIN Players o ON o.player_id = IF(pw.player_id = @id, pw.other_player_id, pw.player_id)
            WHERE pw.player_id = @id OR pw.other_player_id = @id`,
          { id: user.player_id }
        ).then((rows) => {
          const r = rows[0];
          if (r && toNumber(r.n) > 0) {
            friends_affinity = {
              wnba: toNumber(r.wnba),
              college: toNumber(r.college),
              franchise: toNumber(r.franchise),
              n: toNumber(r.n),
            };
          }
        })
      );
    }

    await Promise.all(tasks);
    return { crew_mix, crew_wnba_fans, crew_size_sampled, purchases, watched_streams, friends_affinity, sources };
  } catch (e) {
    throw spannerErr("graph signals", e);
  }
}

// ---------------------------------------------------------------------------
// Preference inference
// ---------------------------------------------------------------------------

function signalCatalog(user: PersonalizeUser, s: UserSignals): Array<{ key: string; value: string }> {
  const out: Array<{ key: string; value: string }> = [];
  if (user.affinity.wnba !== null) out.push({ key: "wnba_affinity", value: user.affinity.wnba.toFixed(2) });
  if (user.affinity.college !== null) out.push({ key: "college_hoops_affinity", value: user.affinity.college.toFixed(2) });
  if (user.affinity.franchise !== null) out.push({ key: "franchise_mode_affinity", value: user.affinity.franchise.toFixed(2) });
  out.push({ key: "archetype", value: `${archetypeLabel(user.archetype)} (${archetypeDescription(user.archetype)})` });
  if (user.age !== null) out.push({ key: "age", value: String(user.age) });
  if (user.favorite_player) out.push({ key: "favorite_player", value: user.favorite_player });
  if (user.favorite_team) out.push({ key: "favorite_team", value: user.favorite_team });
  if (user.creators.length)
    out.push({
      key: "followed_creators",
      value: user.creators.map((c) => `@${c.handle} (${c.signature_mode})`).join("; "),
    });
  if (user.crew)
    out.push({
      key: "crew",
      value: `${user.crew.name} (${user.crew.tier}, ${user.crew.role}); crewmates: ${s.crew_mix
        .slice(0, 5)
        .map((m) => `${archetypeLabel(m.archetype)} ×${m.n}`)
        .join(", ")}; ${s.crew_wnba_fans}/${s.crew_size_sampled} crewmates list a WNBA favorite player`,
    });
  if (s.friends_affinity)
    out.push({
      key: "co_players_affinity",
      value: `${s.friends_affinity.n} PLAYED_WITH neighbors avg WNBA ${s.friends_affinity.wnba?.toFixed(2)} · college ${s.friends_affinity.college?.toFixed(2)} · franchise ${s.friends_affinity.franchise?.toFixed(2)}`,
    });
  if (s.purchases.length)
    out.push({ key: "purchases", value: s.purchases.map((p) => `${p.title}${p.category ? ` [${p.category}]` : ""}`).join("; ") });
  if (s.watched_streams.length)
    out.push({
      key: "watched_streams",
      value: s.watched_streams.map((w) => `"${w.title}" by @${w.creator} (${w.minutes} min)`).join("; "),
    });
  return out;
}

export async function inferPreference(
  user: PersonalizeUser,
  signals: UserSignals,
  signal?: AbortSignal
): Promise<PreferenceInference> {
  const catalog = signalCatalog(user, signals);
  const keys = catalog.map((c) => c.key);
  const system = `You infer which basketball content a real NBA 2K player prefers: NBA (MyNBA / MyCAREER / The City), WNBA (The W, WNBA franchise), or College hoops. Use ONLY the graph signals provided; cite them exactly. Calibrate: a single weak signal should not produce an extreme split. Output strict JSON. No em-dashes.`;
  const prompt = `Player @${user.gamer_tag}. Graph signals (key: value):
${catalog.map((c) => `- ${c.key}: ${c.value}`).join("\n")}

Return:
{"nba": <0-1>, "wnba": <0-1>, "college": <0-1>,   // probabilities, sum to 1
 "evidence": [ {"pref": "nba|wnba|college", "signal": "<one of: ${keys.join(", ")}>", "label": "<chip, max 5 words>", "detail": "<one line citing the exact value>"} x3 ],  // the 3 strongest signals, strongest first
 "rationale": "<one sentence>"}`;
  let res;
  try {
    res = await generateText({
      role: "FAST",
      system,
      prompt,
      schema: {
        type: "OBJECT",
        properties: {
          nba: { type: "NUMBER" },
          wnba: { type: "NUMBER" },
          college: { type: "NUMBER" },
          evidence: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                pref: { type: "STRING", enum: ["nba", "wnba", "college"] },
                signal: { type: "STRING", enum: keys },
                label: { type: "STRING" },
                detail: { type: "STRING" },
              },
              required: ["pref", "signal", "label", "detail"],
            },
          },
          rationale: { type: "STRING" },
        },
        required: ["nba", "wnba", "college", "evidence", "rationale"],
      },
      temperature: 0.2,
      thinkingBudget: 0,
      maxOutputTokens: 800,
      signal,
    });
  } catch (e) {
    throw vertexErr("preference inference", e);
  }
  const p = parseModelJson<any>(res.text);
  const raw = PREFERENCE_IDS.map((k) => Number(p?.[k]));
  if (!p || raw.some((x) => !Number.isFinite(x) || x < 0) || raw.reduce((a, b) => a + b, 0) <= 0) {
    throw new PersonalizeError(`Vertex AI ${res.modelUsed} returned an invalid preference split`, "vertex-ai", "preference");
  }
  const sum = raw.reduce((a, b) => a + b, 0);
  const split = { nba: raw[0] / sum, wnba: raw[1] / sum, college: raw[2] / sum };
  const top = PREFERENCE_IDS.slice().sort((a, b) => split[b] - split[a])[0];
  const evidence: PreferenceEvidence[] = (Array.isArray(p.evidence) ? p.evidence : [])
    .filter((e: any) => isConceptArmId(e?.pref) && keys.includes(e?.signal))
    .slice(0, 3)
    .map((e: any) => ({ pref: e.pref, signal: e.signal, label: clean(e.label), detail: clean(e.detail) }));
  if (evidence.length === 0) {
    throw new PersonalizeError(`Vertex AI ${res.modelUsed} returned no valid evidence chips`, "vertex-ai", "preference");
  }
  return { split, top, evidence, rationale: clean(p.rationale), model: res.modelUsed, latency_ms: res.latencyMs };
}

// ---------------------------------------------------------------------------
// Synthetic twins (user + 5 graph lookalikes)
// ---------------------------------------------------------------------------

interface TwinPersona extends PersonalizeUser {
  is_self: boolean;
  similarity: string;
  telemetry: Record<string, any>;
}

export async function fetchTwins(user: PersonalizeUser): Promise<TwinPersona[]> {
  const caps = await detectCaps();
  const affDist = hasAllAffinity(caps)
    ? ` + 100 * (ABS(IFNULL(p.wnba_affinity, 0) - @wa) + ABS(IFNULL(p.college_hoops_affinity, 0) - @ca) + ABS(IFNULL(p.franchise_mode_affinity, 0) - @fa))`
    : "";
  try {
    const [selfRows, rows] = await Promise.all([
      runRawGql(`SELECT game_telemetry FROM Players WHERE player_id = @id`, { id: user.player_id }),
      runRawGql(
        `SELECT ${userSelect(caps)}
           FROM Players p
           LEFT JOIN MemberOfClan m ON m.player_id = p.player_id
           LEFT JOIN Clans c ON c.clan_id = m.clan_id
          WHERE p.primary_archetype = @arch AND p.player_id != @id
            AND p.primary_franchise IN ${NBA_FRANCHISES}
          ORDER BY ABS(IFNULL(p.age, 25) - @age) * 3
                 + ABS(p.lifetime_spend_usd - @spend) / 50
                 + IF(JSON_VALUE(p.game_telemetry, '$.favorite_player') = @fav, 0, 6)${affDist}
          LIMIT 5`,
        {
          arch: user.archetype,
          id: user.player_id,
          age: user.age ?? 25,
          spend: user.lifetime_spend_usd,
          fav: user.favorite_player ?? "",
          ...(affDist ? { wa: user.affinity.wnba ?? 0, ca: user.affinity.college ?? 0, fa: user.affinity.franchise ?? 0 } : {}),
        }
      ),
    ]);
    if (rows.length < 5) {
      throw new PersonalizeError(
        `Only ${rows.length} lookalikes found for @${user.gamer_tag} (${user.archetype}) on ${caps.database}`,
        "cloud-spanner",
        "twins",
        503
      );
    }
    const users = await hydrateUsers(rows);
    const self: TwinPersona = {
      ...user,
      is_self: true,
      similarity: "the player",
      telemetry: parseJsonColumn(selfRows[0]?.game_telemetry, {}) as Record<string, any>,
    };
    return [
      self,
      ...users.map((u, i) => ({
        ...u,
        is_self: false,
        similarity: `${archetypeLabel(u.archetype)} · age ${u.age ?? "?"}${u.favorite_player === user.favorite_player && u.favorite_player ? ` · also a ${u.favorite_player} fan` : ""}`,
        telemetry: parseJsonColumn(rows[i].game_telemetry, {}) as Record<string, any>,
      })),
    ];
  } catch (e) {
    throw spannerErr("twin lookup", e);
  }
}

export function twinSummary(t: TwinPersona[]): Twin[] {
  return t.map((x) => ({
    player_id: x.player_id,
    gamer_tag: x.gamer_tag,
    archetype: x.archetype,
    age: x.age,
    is_self: x.is_self,
    similarity: x.similarity,
  }));
}

// ---------------------------------------------------------------------------
// Content library (GCS manifest)
// ---------------------------------------------------------------------------

export interface LibraryAsset {
  id: string;
  preference: PreferenceId;
  title: string;
  concept: string;
  offer_hint: string;
  tags: string[];
  formats: Record<string, { url: string; object: string }>;
}

let manifestCache: { at: number; assets: LibraryAsset[] } | null = null;
export const LIBRARY_MANIFEST_OBJECT = "v2/content-library/manifest.json";

export async function loadLibrary(): Promise<LibraryAsset[]> {
  if (manifestCache && Date.now() - manifestCache.at < 60_000) return manifestCache.assets;
  const bucket = GCP_CONFIG.gcsBucketName;
  try {
    const [buf] = await getStorage().bucket(bucket).file(LIBRARY_MANIFEST_OBJECT).download();
    const m = JSON.parse(buf.toString("utf8"));
    const assets: LibraryAsset[] = Array.isArray(m?.assets) ? m.assets : [];
    if (assets.length === 0) throw new Error("manifest has no assets");
    manifestCache = { at: Date.now(), assets };
    return assets;
  } catch (e) {
    throw new PersonalizeError(
      `Content library manifest gs://${bucket}/${LIBRARY_MANIFEST_OBJECT} unavailable: ${errMsg(e)}. Run: npx tsx scripts/generate_content_library_v2.ts`,
      "cloud-storage",
      "content library",
      503,
      e
    );
  }
}

const FORMATS: CreativeFormat[] = ["16:9", "9:16", "1:1", "4:3"];

function creativesOf(a: LibraryAsset): Record<CreativeFormat, string> {
  const out = {} as Record<CreativeFormat, string>;
  for (const f of FORMATS) {
    const url = a.formats?.[f]?.url;
    if (!url) {
      throw new PersonalizeError(
        `Content library asset ${a.id} is missing its ${f} creative in gs://${GCP_CONFIG.gcsBucketName}/v2/content-library`,
        "cloud-storage",
        "content library",
        503
      );
    }
    out[f] = url;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Content pairs: pick + copy
// ---------------------------------------------------------------------------

let brandCache: string | null = null;
async function brandPartners(): Promise<string> {
  if (brandCache) return brandCache;
  const raw = await fs.readFile(path.join(process.cwd(), "data", "brands_research.json"), "utf8");
  const list = JSON.parse(raw) as any[];
  brandCache = list
    .filter((b) => b.confidence !== "LOW")
    .map((b) => `${b.name} (${b.category}): ${(b.example_items || []).slice(0, 2).join("; ")}`)
    .join("\n");
  return brandCache;
}

export async function pickContentPairs(
  user: PersonalizeUser,
  pref: PreferenceInference,
  signal?: AbortSignal
): Promise<{ pairs: ContentPair[]; latencyMs: number; model: string }> {
  const library = await loadLibrary();
  const ranked = PREFERENCE_IDS.slice().sort((a, b) => pref.split[b] - pref.split[a]);
  const primary = library.filter((a) => a.preference === ranked[0]);
  const secondary = library.filter((a) => a.preference === ranked[1]).slice(0, 2);
  if (primary.length < 2) {
    throw new PersonalizeError(
      `Content library has ${primary.length} ${ranked[0]} assets (need at least 2). Run scripts/generate_content_library_v2.ts`,
      "cloud-storage",
      "content library",
      503
    );
  }
  const candidates = [...primary, ...secondary];
  const brands = await brandPartners();
  const ids = candidates.map((c) => c.id);

  const system = `You are a 2K lifecycle marketer building 1:1 personalized content for one real NBA 2K player. Pick 3 creative+offer pairs from the content library and write copy for each. At least 2 pairs must match the player's top preference; the third may test their second preference. ${REAL_ATHLETE_VOICE_GUARD} Real athletes and real 2K brand partners may be named in copy only when it fits (e.g. Caitlin Clark for The W franchise mode, Nike or Reebok signature gear for WNBA fans). Never claim a partner deal that is not in the partner list. Short, punchy, no em-dashes, no emoji.`;
  const prompt = `Player: @${user.gamer_tag} · ${archetypeLabel(user.archetype)} · age ${user.age ?? "?"} · favorite player ${user.favorite_player ?? "n/a"} · favorite team ${user.favorite_team ?? "n/a"} · ${user.crew ? `crew ${user.crew.name} (${user.crew.role})` : "no crew"} · follows ${user.creators.slice(0, 3).map((c) => "@" + c.handle).join(", ") || "none"}
Inferred preference: NBA ${(pref.split.nba * 100).toFixed(0)}% · WNBA ${(pref.split.wnba * 100).toFixed(0)}% · College ${(pref.split.college * 100).toFixed(0)}% (${pref.rationale})

Content library candidates:
${candidates.map((c) => `- ${c.id} [${c.preference}] "${c.title}": ${c.concept}. Offer angle: ${c.offer_hint}`).join("\n")}

Real 2K brand partners (may appear in offers):
${brands}

Return {"pairs":[{"asset_id":"<one of ${ids.join(", ")}>","headline":"<= 8 words","body":"<= 24 words, speaks to this player","cta":"<= 4 words","offer":"<= 10 words, concrete in-game offer","why":"<= 14 words: why this pair fits this player"} x3]}`;
  let res;
  try {
    res = await generateText({
      role: "FAST",
      system,
      prompt,
      schema: {
        type: "OBJECT",
        properties: {
          pairs: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                asset_id: { type: "STRING", enum: ids },
                headline: { type: "STRING" },
                body: { type: "STRING" },
                cta: { type: "STRING" },
                offer: { type: "STRING" },
                why: { type: "STRING" },
              },
              required: ["asset_id", "headline", "body", "cta", "offer", "why"],
            },
          },
        },
        required: ["pairs"],
      },
      temperature: 0.7,
      thinkingBudget: 0,
      maxOutputTokens: 1200,
      signal,
    });
  } catch (e) {
    throw vertexErr("content pair copy", e);
  }
  const p = parseModelJson<any>(res.text);
  const seen = new Set<string>();
  const list = (Array.isArray(p?.pairs) ? p.pairs : []).filter((x: any) => {
    if (!ids.includes(x?.asset_id) || seen.has(x.asset_id)) return false;
    seen.add(x.asset_id);
    return true;
  });
  if (list.length < 3) {
    throw new PersonalizeError(
      `Vertex AI ${res.modelUsed} returned ${list.length} valid content pairs (need 3)`,
      "vertex-ai",
      "content pairs"
    );
  }
  const pairs: ContentPair[] = list.slice(0, 3).map((x: any, i: number) => {
    const a = candidates.find((c) => c.id === x.asset_id)!;
    return {
      id: `pair-${i + 1}-${a.id}`,
      asset_id: a.id,
      preference: a.preference,
      asset_title: a.title,
      concept: a.concept,
      headline: clean(x.headline),
      body: clean(x.body),
      cta: clean(x.cta),
      offer: clean(x.offer),
      why: clean(x.why),
      creatives: creativesOf(a),
      twin_scores: [],
      score: null,
      winner: false,
    };
  });
  return { pairs, latencyMs: res.latencyMs, model: res.modelUsed };
}

// ---------------------------------------------------------------------------
// Twin scoring
// ---------------------------------------------------------------------------

function twinVoiceInput(t: TwinPersona) {
  const tm = t.telemetry || {};
  return {
    gamer_tag: t.gamer_tag,
    archetype: t.archetype,
    age: t.age,
    myplayer_ovr: tm.myplayer_ovr ?? null,
    myplayer_build: tm.myplayer_build ?? null,
    vc_spend_90d: tm.vc_spend_90d ?? null,
    vc_balance: tm.vc_balance ?? null,
    loss_streak: tm.loss_streak ?? null,
    rage_quits_7d: tm.rage_quits_7d ?? null,
    crew_name: t.crew?.name ?? null,
    crew_role: t.crew?.role === "CAPTAIN" || t.crew?.role === "CO_CAPTAIN" ? "CAPTAIN" : t.crew?.role ?? null,
    creator_handle: t.creators[0] ? `@${t.creators[0].handle}` : null,
    favorite_team: t.favorite_team,
  };
}

export async function scorePairsWithTwins(
  pairs: ContentPair[],
  twins: TwinPersona[],
  signal?: AbortSignal
): Promise<{ pairs: ContentPair[]; latencyMs: number; model: string }> {
  const started = Date.now();
  let model = "";
  const perTwin = await Promise.all(
    twins.map(async (t, index) => {
      const arch = (t.archetype as ArchetypeId) || "MYCAREER_STORY_CASUAL";
      const def = COURTSIDE_PERSONA_PROMPTS[arch] || COURTSIDE_PERSONA_PROMPTS.MYCAREER_STORY_CASUAL;
      const vp = buildIndividualVoiceProfile(twinVoiceInput(t), index);
      const college = buildCollegeHoopsVoiceOverlay({
        age: t.age,
        college_hoops_affinity: t.affinity.college,
        archetype: t.archetype,
      });
      const aff = describeConceptAffinities({
        wnba_affinity: t.affinity.wnba,
        college_hoops_affinity: t.affinity.college,
        franchise_mode_affinity: t.affinity.franchise,
      });
      const system = `${def.systemPrompt}
${college ? `\n${college}\n` : ""}
You are @${t.gamer_tag}, shown 3 pieces of NBA 2K27 marketing (image + message). Score how likely each would make you tap and engage, 0 to 10 (decimals ok), honestly from your own play style; low scores are fine.
${REAL_ATHLETE_VOICE_GUARD}
${vp.promptDirective}
Each quote strictly ${vp.wordCountRange}, in your own voice, no em-dashes. React to the content itself (the mode, the image, the offer) and how it fits the way you play; only mention VC or your wallet if the offer is about VC. Use at most one slang term per quote and do not lean on stock words like ngl, lowkey, cooked, taxing or valid.`;
      const prompt = `You: ${archetypeLabel(arch)}, age ${t.age ?? "?"}, favorite player ${t.favorite_player ?? "n/a"}, favorite team ${t.favorite_team ?? "n/a"}${t.crew ? `, crew ${t.crew.name}` : ""}${aff ? `, ${aff}` : ""}. ${vp.personalHook}.

${pairs.map((p) => `[${p.id}] Image: ${p.asset_title} (${p.concept}). Headline: "${p.headline}". Body: "${p.body}". Offer: ${p.offer}. CTA: ${p.cta}`).join("\n")}

Return {"scores":[{"pair_id":"...","score":0-10,"quote":"..."} for all 3]}`;
      let res;
      try {
        res = await generateText({
          role: "FAST",
          system,
          prompt,
          schema: {
            type: "OBJECT",
            properties: {
              scores: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    pair_id: { type: "STRING", enum: pairs.map((p) => p.id) },
                    score: { type: "NUMBER" },
                    quote: { type: "STRING" },
                  },
                  required: ["pair_id", "score", "quote"],
                },
              },
            },
            required: ["scores"],
          },
          temperature: 0.7,
          thinkingBudget: 0,
          maxOutputTokens: 900,
          signal,
        });
      } catch (e) {
        throw vertexErr(`twin scoring @${t.gamer_tag}`, e);
      }
      model = res.modelUsed;
      const parsed = parseModelJson<any>(res.text);
      const list: any[] = Array.isArray(parsed?.scores) ? parsed.scores : [];
      return pairs.map((p) => {
        const s = list.find((x) => x?.pair_id === p.id);
        const score = Number(s?.score);
        if (!s || !Number.isFinite(score)) {
          throw new PersonalizeError(
            `Vertex AI ${res!.modelUsed} omitted a score for ${p.id} from twin @${t.gamer_tag}`,
            "vertex-ai",
            "twin scoring"
          );
        }
        return {
          player_id: t.player_id,
          gamer_tag: t.gamer_tag,
          archetype: t.archetype,
          is_self: t.is_self,
          score: Math.round(Math.min(10, Math.max(0, score)) * 10) / 10,
          quote: clean(s.quote),
          voice_tier: vp.cadenceTier,
        } satisfies TwinScore;
      });
    })
  );
  const scored = pairs.map((p, pi) => {
    const twin_scores = perTwin.map((row) => row[pi]);
    const score = Math.round((twin_scores.reduce((a, b) => a + b.score, 0) / twin_scores.length) * 10) / 10;
    return { ...p, twin_scores, score };
  });
  const best = scored.reduce((a, b) => {
    if ((b.score ?? 0) !== (a.score ?? 0)) return (b.score ?? 0) > (a.score ?? 0) ? b : a;
    const selfA = a.twin_scores.find((x) => x.is_self)?.score ?? 0;
    const selfB = b.twin_scores.find((x) => x.is_self)?.score ?? 0;
    return selfB > selfA ? b : a;
  });
  return {
    pairs: scored.map((p) => ({ ...p, winner: p.id === best.id })),
    latencyMs: Date.now() - started,
    model,
  };
}

// ---------------------------------------------------------------------------
// Channel activation copy
// ---------------------------------------------------------------------------

export async function buildActivations(
  user: PersonalizeUser,
  winner: ContentPair,
  audience: AdsAudience,
  signal?: AbortSignal
): Promise<{ channels: ChannelActivation[]; latencyMs: number; model: string }> {
  const system = `You adapt one winning 2K marketing pair into channel-native creative copy for one real player. Respect each channel's format limits exactly. ${REAL_ATHLETE_VOICE_GUARD} No em-dashes, no emoji.`;
  const prompt = `Player @${user.gamer_tag} (${archetypeLabel(user.archetype)}, favorite player ${user.favorite_player ?? "n/a"}).
Winning pair [${PREFERENCES[winner.preference].label}] "${winner.asset_title}": headline "${winner.headline}", body "${winner.body}", offer "${winner.offer}", CTA "${winner.cta}".

Write:
- email: subject (<= 7 words), headline (<= 8 words), body (<= 30 words), cta (<= 4 words), meta = preheader (<= 10 words)
- twotv: 2KTV / in-game story card. headline (<= 6 words), body = 2 short story beats separated by " / " (<= 20 words), cta (<= 3 words), meta = story chapter label (<= 4 words)
- push: headline = push title (<= 40 characters), body (<= 100 characters), cta (<= 2 words), meta = SMS version (<= 120 characters)
- console: Console & 2K launcher ad tile. headline (<= 5 words), body = subline (<= 12 words), cta (<= 3 words), meta = placement note (<= 6 words)
- youtube: YouTube in-stream / Google Ads creative aimed at NEW players who share this taste. headline = YouTube-style headline (<= 30 characters), body = description line (<= 90 characters), cta (<= 3 words), meta = long headline (<= 60 characters)
Return {"twotv":{...},"console":{...},"push":{...},"email":{...},"youtube":{...}} each with headline, body, cta, meta, and email also subject.`;
  const copySchema = {
    type: "OBJECT",
    properties: {
      subject: { type: "STRING" },
      headline: { type: "STRING" },
      body: { type: "STRING" },
      cta: { type: "STRING" },
      meta: { type: "STRING" },
    },
    required: ["headline", "body", "cta", "meta"],
  };
  let res;
  try {
    res = await generateText({
      role: "FAST",
      system,
      prompt,
      schema: {
        type: "OBJECT",
        properties: { twotv: copySchema, console: copySchema, push: copySchema, email: copySchema, youtube: copySchema },
        required: ["twotv", "console", "push", "email", "youtube"],
      },
      temperature: 0.6,
      thinkingBudget: 0,
      maxOutputTokens: 1200,
      signal,
    });
  } catch (e) {
    throw vertexErr("channel activation copy", e);
  }
  const p = parseModelJson<any>(res.text);
  const channels = CHANNEL_IDS.map((ch) => {
    const c = p?.[ch];
    if (!c?.headline || !c?.body) {
      throw new PersonalizeError(`Vertex AI ${res!.modelUsed} returned no ${ch} copy`, "vertex-ai", "activation");
    }
    const cfg = CHANNELS[ch];
    return {
      channel: ch,
      label: cfg.label,
      format: cfg.format,
      dispatch: cfg.dispatch,
      creative_url: winner.creatives[cfg.format],
      pair_id: winner.id,
      copy: {
        headline: clean(c.headline),
        body: clean(c.body),
        cta: clean(c.cta),
        ...(c.subject ? { subject: clean(c.subject) } : {}),
        ...(c.meta ? { meta: clean(c.meta) } : {}),
      },
      holdout: isHoldout(user.player_id, ch),
      ...(ch === "youtube"
        ? {
            audience: {
              seed: 1,
              lookalikes: audience.members.filter((m) => m.source === "lookalike" && !m.holdout).length,
              holdout: audience.members.filter((m) => m.holdout).length,
              basis: audience.basis,
            },
          }
        : {}),
    } satisfies ChannelActivation;
  });
  return { channels, latencyMs: res.latencyMs, model: res.modelUsed };
}

// ---------------------------------------------------------------------------
// YouTube / Google Ads: seed + graph lookalikes (Customer Match-ready staging)
// ---------------------------------------------------------------------------

export interface AdsAudienceMember {
  player_id: string;
  primary_email: string | null;
  source: "seed" | "lookalike";
  holdout: boolean;
}

export interface AdsAudience {
  preference: PreferenceId;
  basis: string;
  members: AdsAudienceMember[];
}

/**
 * Seed player + up to `limit` graph lookalikes that share the inferred
 * preference. v2: ranked by the matching live affinity column (plus the seed's
 * PLAYED_WITH neighbors). v1: same archetype + the preference's telemetry signal.
 */
export async function fetchAdsAudience(
  user: PersonalizeUser,
  preference: PreferenceId,
  limit = 250
): Promise<AdsAudience> {
  const caps = await detectCaps();
  const fav = "JSON_VALUE(p.game_telemetry, '$.favorite_player')";
  let sql: string;
  let params: Record<string, any>;
  let basis: string;
  if (hasAllAffinity(caps)) {
    const col =
      preference === "wnba" ? "wnba_affinity" : preference === "college" ? "college_hoops_affinity" : "franchise_mode_affinity";
    const neighbor = caps.tables.has("PlayedWith")
      ? `OR p.player_id IN (SELECT IF(pw.player_id = @id, pw.other_player_id, pw.player_id) FROM PlayedWith pw WHERE pw.player_id = @id OR pw.other_player_id = @id)`
      : "";
    sql = `SELECT p.player_id, p.primary_email FROM Players p
            WHERE p.player_id != @id AND (p.${col} >= 0.6 ${neighbor})
            ORDER BY IF(p.primary_archetype = @arch, 0, 1), p.${col} DESC
            LIMIT @limit`;
    params = { id: user.player_id, arch: user.archetype, limit };
    basis = `${col} ≥ 0.60${neighbor ? " + PLAYED_WITH neighbors" : ""}, same archetype first`;
  } else {
    const cond =
      preference === "wnba"
        ? `${fav} IN UNNEST(@wnba)`
        : preference === "college"
          ? `p.age <= 22`
          : `(${fav} IS NULL OR ${fav} NOT IN UNNEST(@wnba))`;
    sql = `SELECT p.player_id, p.primary_email FROM Players p
            WHERE p.player_id != @id AND p.primary_archetype = @arch
              AND p.primary_franchise IN ${NBA_FRANCHISES} AND ${cond}
            ORDER BY ABS(IFNULL(p.age, 25) - @age), p.lifetime_spend_usd DESC
            LIMIT @limit`;
    params = { id: user.player_id, arch: user.archetype, age: user.age ?? 25, limit, wnba: WNBA_FAVORITES };
    basis =
      preference === "wnba"
        ? "same archetype + WNBA favorite player"
        : preference === "college"
          ? "same archetype + age ≤ 22"
          : "same archetype + NBA favorite player";
  }
  try {
    const [seedRows, rows] = await Promise.all([
      runRawGql(`SELECT primary_email FROM Players WHERE player_id = @id`, { id: user.player_id }),
      runRawGql(sql, params),
    ]);
    const members: AdsAudienceMember[] = [
      {
        player_id: user.player_id,
        primary_email: seedRows[0]?.primary_email ?? null,
        source: "seed",
        holdout: false,
      },
      ...rows.map((r) => ({
        player_id: String(r.player_id),
        primary_email: r.primary_email ?? null,
        source: "lookalike" as const,
        holdout: isHoldout(String(r.player_id), "youtube"),
      })),
    ];
    return { preference, basis: `${basis} · ${HOLDOUT_PCT}% holdout`, members };
  } catch (e) {
    throw spannerErr("ads audience", e);
  }
}
