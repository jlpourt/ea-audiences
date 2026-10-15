#!/usr/bin/env node
/**
 * Mirror the 2K Courtside v2 dataset (data/v2/*) into BigQuery
 * `jamie-bq-test.twok_marketing_intelligence.v2_*` (US multi-region).
 *
 *   node scripts/mirror_v2_bigquery.js            # load every v2 table (WRITE_TRUNCATE, idempotent)
 *   node scripts/mirror_v2_bigquery.js --only v2_players,v2_sessions_daily
 *   node scripts/mirror_v2_bigquery.js --counts   # print BigQuery row counts only
 *
 * - Converts JSON arrays to NDJSON under data/v2/_bq/ (gitignored) and runs
 *   load jobs with an explicit schema (TIMESTAMP for *_at / since, DATE for
 *   `date`, JSON for nested objects such as game_telemetry).
 * - Hard guard: only ever writes tables whose name starts with `v2_`.
 * - Zero fallbacks: any failed load job or row-count mismatch throws and exits non-zero.
 */
const fs = require("fs");
const path = require("path");
const { BigQuery } = require("@google-cloud/bigquery");

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT_ID || "jamie-bq-test";
const DATASET = process.env.BQ_DATASET || "twok_marketing_intelligence";
const LOCATION = "US";
const V2_DIR = path.join(__dirname, "..", "data", "v2");
const TMP_DIR = path.join(V2_DIR, "_bq");

// BigQuery table -> source file in data/v2 (JSON array unless .ndjson)
const TABLES = {
  v2_players: "players.json",
  v2_member_of_clan: "member_of_clan.json",
  v2_crew_membership_events: "crew_membership_events.json",
  v2_clans: "clans.json",
  v2_played_with: "played_with.json",
  v2_friends_with: "friends_with.json",
  v2_messaged: "messaged.json",
  v2_streams: "streams.json",
  v2_watched: "watched.json",
  v2_identities: "identities.json",
  v2_has_identity: "has_identity.json",
  v2_items: "items.json",
  v2_brands: "brands.json",
  v2_brand_activations: "brand_activations.json",
  v2_bought: "bought.json",
  v2_equipped: "equipped.json",
  v2_sessions_daily: "sessions_daily.ndjson",
  v2_matches: "matches.json",
  v2_seasons: "seasons.json",
  v2_creators: "creators.json",
  v2_competed_in: "competed_in.json",
  v2_in_season: "in_season.json",
  v2_split_from: "split_from.json",
  v2_hosted: "hosted.json",
  v2_sponsors: "sponsors.json",
  v2_features: "features.json",
};

// Columns whose type cannot be inferred from values (e.g. always NULL) or must be forced.
const OVERRIDES = {
  game_telemetry: { type: "JSON" },
  purchased_items: { type: "JSON" },
  logo_url: { type: "STRING" },
  featured_offer_id: { type: "STRING" },
  featured_item_id: { type: "STRING" },
  via_activation_id: { type: "STRING" },
  related_clan_id: { type: "STRING" },
  season_id: { type: "STRING" },
  brand_id: { type: "STRING" },
  date: { type: "DATE" },
  session_min_7d: { type: "FLOAT64" },
  session_min_prev_7d: { type: "FLOAT64" },
  crew_centrality: { type: "FLOAT64" },
  lifetime_spend_usd: { type: "FLOAT64" },
  hub_score: { type: "FLOAT64" },
  confidence_score: { type: "FLOAT64" },
  watch_minutes: { type: "FLOAT64" },
};

const isTsCol = (k) => k.endsWith("_at") || k === "since";

function inferSchema(rows, table) {
  const cols = new Map(); // name -> {types:Set, repeated:bool, elemTypes:Set}
  for (const r of rows) {
    for (const [k, v] of Object.entries(r)) {
      if (!cols.has(k)) cols.set(k, { types: new Set(), elem: new Set() });
      const c = cols.get(k);
      if (v === null || v === undefined) continue;
      if (Array.isArray(v)) {
        c.types.add("ARRAY");
        for (const e of v) c.elem.add(e !== null && typeof e === "object" ? "OBJECT" : typeof e);
      } else if (typeof v === "object") c.types.add("OBJECT");
      else if (typeof v === "boolean") c.types.add("BOOL");
      else if (typeof v === "number") c.types.add(Number.isInteger(v) ? "INT" : "FLOAT");
      else c.types.add("STRING");
    }
  }
  const fields = [];
  for (const [name, c] of cols) {
    if (OVERRIDES[name]) {
      fields.push({ name, type: OVERRIDES[name].type, mode: "NULLABLE" });
      continue;
    }
    if (isTsCol(name)) {
      fields.push({ name, type: "TIMESTAMP", mode: "NULLABLE" });
      continue;
    }
    const t = c.types;
    if (t.size === 0) throw new Error(`${table}.${name}: all values NULL; add an explicit OVERRIDES entry`);
    if (t.has("ARRAY")) {
      if (t.size > 1) throw new Error(`${table}.${name}: mixed array/scalar types ${[...t]}`);
      if (c.elem.has("OBJECT") || c.elem.size > 1) {
        fields.push({ name, type: "JSON", mode: "NULLABLE" });
      } else {
        const e = [...c.elem][0] || "string";
        const et = e === "number" ? "FLOAT64" : e === "boolean" ? "BOOL" : "STRING";
        fields.push({ name, type: et, mode: "REPEATED" });
      }
      continue;
    }
    if (t.has("OBJECT")) fields.push({ name, type: "JSON", mode: "NULLABLE" });
    else if (t.has("STRING")) {
      if (t.size > 1) throw new Error(`${table}.${name}: mixed string/non-string types ${[...t]}`);
      fields.push({ name, type: "STRING", mode: "NULLABLE" });
    } else if (t.has("BOOL")) fields.push({ name, type: "BOOL", mode: "NULLABLE" });
    else if (t.has("FLOAT")) fields.push({ name, type: "FLOAT64", mode: "NULLABLE" });
    else fields.push({ name, type: "INT64", mode: "NULLABLE" });
  }
  return fields;
}

function readRows(file) {
  const p = path.join(V2_DIR, file);
  if (!fs.existsSync(p)) throw new Error(`Missing source file ${p}. Run scripts/generate_2k_dataset_v2.py first.`);
  if (file.endsWith(".ndjson")) {
    return fs
      .readFileSync(p, "utf-8")
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l));
  }
  const d = JSON.parse(fs.readFileSync(p, "utf-8"));
  if (!Array.isArray(d)) throw new Error(`${p} is not a JSON array`);
  return d;
}

function writeNdjson(table, rows, fields) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const out = path.join(TMP_DIR, `${table}.ndjson`);
  const repeated = new Set(fields.filter((f) => f.mode === "REPEATED").map((f) => f.name));
  const fd = fs.openSync(out, "w");
  try {
    let buf = [];
    for (const r of rows) {
      const o = {};
      for (const f of fields) {
        let v = r[f.name];
        if (v === undefined) v = null;
        if (repeated.has(f.name) && v === null) v = [];
        o[f.name] = v;
      }
      buf.push(JSON.stringify(o));
      if (buf.length >= 5000) {
        fs.writeSync(fd, buf.join("\n") + "\n");
        buf = [];
      }
    }
    if (buf.length) fs.writeSync(fd, buf.join("\n") + "\n");
  } finally {
    fs.closeSync(fd);
  }
  return out;
}

async function loadTable(bq, table, file) {
  if (!table.startsWith("v2_")) throw new Error(`Refusing to write non-v2 table ${table}`);
  const rows = readRows(file);
  if (!rows.length) throw new Error(`${file} has 0 rows`);
  const fields = inferSchema(rows, table);
  const nd = writeNdjson(table, rows, fields);
  const t0 = Date.now();
  const [job] = await bq.dataset(DATASET).table(table).load(nd, {
    sourceFormat: "NEWLINE_DELIMITED_JSON",
    writeDisposition: "WRITE_TRUNCATE",
    createDisposition: "CREATE_IF_NEEDED",
    schema: { fields },
    schemaUpdateOptions: [],
    location: LOCATION,
  });
  const errs = job.status && job.status.errors;
  if (errs && errs.length) throw new Error(`${table} load failed: ${JSON.stringify(errs).slice(0, 2000)}`);
  const loaded = Number(job.statistics.load.outputRows);
  if (loaded !== rows.length) throw new Error(`${table}: loaded ${loaded} rows, expected ${rows.length}`);
  console.log(`  ${table.padEnd(28)} ${String(loaded).padStart(8)} rows  (${fields.length} cols, ${Date.now() - t0} ms)`);
  return { table, rows: loaded };
}

async function counts(bq, tables) {
  const sql = tables
    .map((t) => `SELECT '${t}' AS t, COUNT(*) AS n FROM \`${PROJECT}.${DATASET}.${t}\``)
    .join("\nUNION ALL\n");
  const [rows] = await bq.query({ query: sql, location: LOCATION });
  const m = Object.fromEntries(rows.map((r) => [r.t, Number(r.n)]));
  for (const t of tables) console.log(`  ${t.padEnd(28)} ${String(m[t]).padStart(8)}`);
  return m;
}

async function main() {
  const args = process.argv.slice(2);
  const onlyIdx = args.indexOf("--only");
  let tables = Object.keys(TABLES);
  if (onlyIdx >= 0) {
    const want = (args[onlyIdx + 1] || "").split(",").filter(Boolean);
    for (const w of want) if (!TABLES[w]) throw new Error(`Unknown table ${w}`);
    tables = want;
  }
  const bq = new BigQuery({ projectId: PROJECT });
  const [ds] = await bq.dataset(DATASET).get();
  const loc = ds.metadata.location;
  if (loc !== LOCATION) throw new Error(`Dataset ${DATASET} is in ${loc}, expected ${LOCATION}`);

  if (args.includes("--counts")) {
    await counts(bq, tables);
    return;
  }
  console.log(`Mirroring ${tables.length} v2 tables -> ${PROJECT}.${DATASET} (${loc})`);
  // Small parallelism to keep it quick without hitting per-table rate limits.
  const queue = [...tables];
  const results = [];
  const worker = async () => {
    while (queue.length) {
      const t = queue.shift();
      results.push(await loadTable(bq, t, TABLES[t]));
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  const summary = Object.fromEntries(tables.map((t) => [t, results.find((r) => r.table === t).rows]));
  fs.writeFileSync(path.join(V2_DIR, "bigquery_counts.json"), JSON.stringify(summary, null, 2) + "\n");
  console.log("Verifying counts from BigQuery...");
  const live = await counts(bq, tables);
  for (const t of tables) {
    if (live[t] !== summary[t]) throw new Error(`${t}: BigQuery has ${live[t]} rows, loaded ${summary[t]}`);
  }
  console.log("BigQuery v2 mirror complete.");
}

main().catch((e) => {
  console.error("mirror_v2_bigquery FAILED:", e && e.stack ? e.stack : e);
  process.exit(1);
});
