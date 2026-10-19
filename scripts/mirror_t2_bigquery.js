#!/usr/bin/env node
/**
 * Mirror the Take-Two portfolio graph (t2_graph_db) into BigQuery
 * `jamie-bq-test.take_two_portfolio.t2_*` (US multi-region): the lakehouse
 * side of the Take-Two command center.
 *
 *   node scripts/mirror_t2_bigquery.js            # load every t2 table (WRITE_TRUNCATE, idempotent)
 *   node scripts/mirror_t2_bigquery.js --only t2_sessions_daily
 *   node scripts/mirror_t2_bigquery.js --counts
 *
 * Sources: data/v2 (2K base) + data/t2 (Rockstar Games / Zynga extension from
 * scripts/generate_t2_portfolio.py), merged exactly like
 * `SPANNER_V2_DATABASE_ID=t2_graph_db node scripts/load_v2_spanner.js` does.
 * t2_sessions_daily (per player, title and day) lives only in BigQuery.
 *
 * Hard guard: only writes tables whose name starts with `t2_` in the
 * take_two_portfolio dataset. Zero fallbacks: any failed job or row-count
 * mismatch throws and exits non-zero.
 */
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { BigQuery } = require("@google-cloud/bigquery");

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT_ID || "jamie-bq-test";
const DATASET = process.env.T2_BQ_DATASET_ID || "take_two_portfolio";
const LOCATION = "US";
const ROOT = path.join(__dirname, "..", "data");
const TMP = path.join(ROOT, "t2", "_bq");

const J = (...p) => JSON.parse(fs.readFileSync(path.join(ROOT, ...p), "utf-8"));
const iso = (v) => (v == null ? null : new Date(v).toISOString());

function games() {
  return [...J("games.json"), ...J("t2", "games.json")]
    .filter((g) => g.is_parent_hub)
    .map((g) => ({
      game_id: g.game_id, title: g.title, franchise: g.franchise, label: g.label,
      studio: g.label === "ROCKSTAR" ? "ROCKSTAR" : g.label === "ZYNGA" ? "ZYNGA" : "2K",
      lifecycle_status: g.lifecycle_status, release_date: g.release_date,
    }));
}

function players() {
  const studioOf = new Map(games().map((g) => [g.franchise, g.studio]));
  const overrides = J("t2", "player_overrides.json");
  return [...J("v2", "players.json"), ...J("t2", "players.json")].map((p) => ({
    player_id: p.player_id, gamer_tag: p.gamer_tag, primary_franchise: p.primary_franchise,
    home_studio: studioOf.get(p.primary_franchise) ?? "2K",
    franchises_played: overrides[p.player_id] ?? p.franchises_played ?? [],
    primary_archetype: p.primary_archetype, lifetime_spend_usd: p.lifetime_spend_usd,
    churn_risk_score: p.churn_risk_score, age: p.age, gender: p.gender, country: p.country,
    account_tenure_days: p.account_tenure_days, last_active_at: iso(p.last_active_at), churned_at: iso(p.churned_at),
    session_min_7d: p.session_min_7d, session_min_prev_7d: p.session_min_prev_7d,
  }));
}

const S = (name, type, mode = "NULLABLE") => ({ name, type, mode });

const TABLES = {
  t2_games: {
    rows: games,
    schema: [S("game_id", "STRING", "REQUIRED"), S("title", "STRING"), S("franchise", "STRING"), S("label", "STRING"),
      S("studio", "STRING"), S("lifecycle_status", "STRING"), S("release_date", "STRING")],
  },
  t2_players: {
    rows: players,
    schema: [S("player_id", "STRING", "REQUIRED"), S("gamer_tag", "STRING"), S("primary_franchise", "STRING"), S("home_studio", "STRING"),
      S("franchises_played", "STRING", "REPEATED"), S("primary_archetype", "STRING"), S("lifetime_spend_usd", "FLOAT64"),
      S("churn_risk_score", "FLOAT64"), S("age", "INT64"), S("gender", "STRING"), S("country", "STRING"),
      S("account_tenure_days", "INT64"), S("last_active_at", "TIMESTAMP"), S("churned_at", "TIMESTAMP"),
      S("session_min_7d", "FLOAT64"), S("session_min_prev_7d", "FLOAT64")],
  },
  t2_plays_game: {
    rows: () => J("t2", "plays_game.json").map((e) => ({
      player_id: e.player_id, game_id: e.game_id, hours_played: e.hours_played, spend_usd: e.spend_usd,
      first_played_at: iso(e.first_played_at), last_played_at: iso(e.last_played_timestamp), acquired_via: e.acquired_via,
    })),
    schema: [S("player_id", "STRING", "REQUIRED"), S("game_id", "STRING", "REQUIRED"), S("hours_played", "FLOAT64"), S("spend_usd", "FLOAT64"),
      S("first_played_at", "TIMESTAMP"), S("last_played_at", "TIMESTAMP"), S("acquired_via", "STRING")],
  },
  t2_friends_with: {
    rows: () => [...J("v2", "friends_with.json"), ...J("t2", "friends_with.json")].map((e) => ({ player_id: e.player_id, other_player_id: e.other_player_id, since: iso(e.since) })),
    schema: [S("player_id", "STRING", "REQUIRED"), S("other_player_id", "STRING", "REQUIRED"), S("since", "TIMESTAMP")],
  },
  t2_invited: {
    rows: () => J("t2", "invited.json").map((e) => ({ ...e, invited_at: iso(e.invited_at) })),
    schema: [S("player_id", "STRING", "REQUIRED"), S("invitee_id", "STRING", "REQUIRED"), S("to_game_id", "STRING", "REQUIRED"),
      S("from_game_id", "STRING"), S("invited_at", "TIMESTAMP"), S("accepted", "BOOL")],
  },
  t2_wishlisted: {
    rows: () => J("t2", "wishlisted.json").map((e) => ({ ...e, wishlisted_at: iso(e.wishlisted_at) })),
    schema: [S("player_id", "STRING", "REQUIRED"), S("game_id", "STRING", "REQUIRED"), S("wishlisted_at", "TIMESTAMP"), S("store", "STRING")],
  },
  t2_clans: {
    rows: () => [...J("v2", "clans.json"), ...J("t2", "clans.json")].map((c) => ({
      clan_id: c.clan_id, name: c.name, franchise: c.franchise, region: c.region, tier: c.tier, member_count: c.member_count,
    })),
    schema: [S("clan_id", "STRING", "REQUIRED"), S("name", "STRING"), S("franchise", "STRING"), S("region", "STRING"), S("tier", "STRING"), S("member_count", "INT64")],
  },
  t2_member_of_clan: {
    rows: () => [...J("v2", "member_of_clan.json"), ...J("t2", "member_of_clan.json")].map((e) => ({
      player_id: e.player_id, clan_id: e.clan_id, role: e.role, joined_at: iso(e.joined_at), left_at: iso(e.left_at),
      is_active: e.is_active, crew_centrality: e.crew_centrality,
    })),
    schema: [S("player_id", "STRING", "REQUIRED"), S("clan_id", "STRING", "REQUIRED"), S("role", "STRING"), S("joined_at", "TIMESTAMP"),
      S("left_at", "TIMESTAMP"), S("is_active", "BOOL"), S("crew_centrality", "FLOAT64")],
  },
  t2_items: {
    rows: () => [...J("v2", "items.json"), ...J("t2", "items.json")].map((i) => ({
      item_id: i.item_id, name: i.name, item_type: i.item_type, brand_id: i.brand_id, is_branded: i.is_branded, vc_price: i.vc_price,
    })),
    schema: [S("item_id", "STRING", "REQUIRED"), S("name", "STRING"), S("item_type", "STRING"), S("brand_id", "STRING"), S("is_branded", "BOOL"), S("vc_price", "INT64")],
  },
  t2_bought: {
    rows: () => [...J("v2", "bought.json"), ...J("t2", "bought.json")].map((e) => ({
      player_id: e.player_id, item_id: e.item_id, bought_at: iso(e.bought_at), vc_amount: e.vc_amount, via_activation_id: e.via_activation_id,
    })),
    schema: [S("player_id", "STRING", "REQUIRED"), S("item_id", "STRING", "REQUIRED"), S("bought_at", "TIMESTAMP"), S("vc_amount", "INT64"), S("via_activation_id", "STRING")],
  },
  t2_sessions_daily: {
    ndjson: path.join(ROOT, "t2", "sessions_daily.ndjson"),
    schema: [S("player_id", "STRING", "REQUIRED"), S("game_id", "STRING", "REQUIRED"), S("date", "DATE", "REQUIRED"), S("session_minutes", "INT64")],
  },
};

async function countLines(file) {
  let n = 0;
  const rl = readline.createInterface({ input: fs.createReadStream(file) });
  for await (const line of rl) if (line.trim()) n++;
  return n;
}

async function main() {
  const args = process.argv.slice(2);
  const onlyIdx = args.indexOf("--only");
  const only = onlyIdx >= 0 ? new Set(args[onlyIdx + 1].split(",")) : null;
  const bq = new BigQuery({ projectId: PROJECT, location: LOCATION });
  const ds = bq.dataset(DATASET);
  const [exists] = await ds.exists();
  if (!exists) {
    await bq.createDataset(DATASET, { location: LOCATION, description: "Take-Two portfolio player graph mirror (2K + Rockstar Games + Zynga) for the Take-Two command center." });
    console.log(`Created dataset ${PROJECT}:${DATASET} (${LOCATION})`);
  }

  if (args.includes("--counts")) {
    for (const t of Object.keys(TABLES)) {
      const [rows] = await bq.query({ query: `SELECT COUNT(*) AS n FROM \`${PROJECT}.${DATASET}.${t}\``, location: LOCATION });
      console.log(`  ${t.padEnd(20)} ${rows[0].n}`);
    }
    return;
  }

  fs.mkdirSync(TMP, { recursive: true });
  for (const [table, spec] of Object.entries(TABLES)) {
    if (only && !only.has(table)) continue;
    if (!table.startsWith("t2_")) throw new Error(`Refusing to write non-t2 table ${table}`);
    let file = spec.ndjson;
    let expected;
    if (!file) {
      const rows = spec.rows();
      if (!rows.length) throw new Error(`${table}: zero rows`);
      file = path.join(TMP, `${table}.ndjson`);
      fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
      expected = rows.length;
    } else {
      expected = await countLines(file);
    }
    process.stdout.write(`  ${table.padEnd(20)} loading ${expected} rows... `);
    const [job] = await ds.table(table).load(file, {
      sourceFormat: "NEWLINE_DELIMITED_JSON",
      schema: { fields: spec.schema },
      writeDisposition: "WRITE_TRUNCATE",
      createDisposition: "CREATE_IF_NEEDED",
      location: LOCATION,
    });
    const errs = job.status?.errors;
    if (errs?.length) throw new Error(`${table}: load errors ${JSON.stringify(errs.slice(0, 3))}`);
    const [rows] = await bq.query({ query: `SELECT COUNT(*) AS n FROM \`${PROJECT}.${DATASET}.${table}\``, location: LOCATION });
    const got = Number(rows[0].n);
    if (got !== expected) throw new Error(`${table}: BigQuery has ${got} rows, expected ${expected}`);
    console.log("ok");
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error("\nT2 BIGQUERY MIRROR FAILED:", e.message);
  process.exit(1);
});
