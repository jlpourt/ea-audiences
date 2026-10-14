#!/usr/bin/env node
/**
 * Load the 2K Courtside (Take-Two Identity Graph) dataset into Spanner.
 *
 * Run with:  node scripts/spanner_load_data.js [--truncate]
 */
const fs = require("fs");
const path = require("path");
const { Spanner } = require("@google-cloud/spanner");

const PROJECT = process.env.GCP_PROJECT_ID || "jamie-bq-test";
const INSTANCE = process.env.SPANNER_INSTANCE_ID || "blackrock-spanner";
const DATABASE = process.env.SPANNER_DATABASE_ID || "twok_graph_db";

const DATA = (f) => JSON.parse(fs.readFileSync(path.join("data", f), "utf-8"));

const int = (v) => (v === null || v === undefined ? null : Spanner.int(Math.round(Number(v))));
const num = (v) => (v === null || v === undefined ? null : Spanner.float(Number(v)));
const str = (v) => (v === null || v === undefined ? null : String(v));
const json = (v) => (v === null || v === undefined ? null : JSON.stringify(v));
const bool = (v) => (v === null || v === undefined ? null : Boolean(v));

async function insertAll(database, tableName, rows, chunkSize = 700, concurrency = 4) {
  if (!rows.length) {
    console.log(`  ${tableName}: nothing to insert`);
    return;
  }
  const table = database.table(tableName);
  const chunks = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    chunks.push(rows.slice(i, i + chunkSize));
  }
  let done = 0;
  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (c) => {
        await table.insert(c);
        done += c.length;
        process.stdout.write(`\r  ${tableName}: ${done}/${rows.length}`);
      })
    );
  }
  process.stdout.write(`\r  ${tableName}: ${done}/${rows.length}  ✓\n`);
}

async function main() {
  const truncate = process.argv.includes("--truncate");
  const spanner = new Spanner({ projectId: PROJECT });
  const database = spanner.instance(INSTANCE).database(DATABASE);

  if (truncate) {
    console.log(`Truncating existing rows in ${DATABASE}...`);
    for (const t of [
      "PlaysGame",
      "FollowsCreator",
      "MemberOfClan",
      "HasIdentity",
      "TelemetryEvents",
      "Players",
      "Games",
      "Creators",
      "Clans",
      "Offers",
      "Identities",
    ]) {
      await database.runTransactionAsync(async (tx) => {
        await tx.runUpdate({ sql: `DELETE FROM ${t} WHERE TRUE` });
        await tx.commit();
      });
      console.log(`  cleared ${t}`);
    }
  }

  console.log("\nLoading reference tables...");

  const gamesData = DATA("games.json");
  const offersData = DATA("marketing_offers.json");

  const gameIds = new Set(gamesData.map((g) => g.game_id));
  const hubs = gamesData.filter((g) => g.is_parent_hub);
  const REQUIRED_HUBS = [
    "game-nba2k27",
    "game-nba2k26",
    "game-nba2k-mobile",
    "game-wwe2k25",
    "game-pga2k25",
    "game-topspin2k25",
    "game-civ7",
    "game-bl4",
    "game-mafia-toc",
  ];
  const CANONICAL_ARCHETYPES = new Set([
    "MYTEAM_PACK_WHALE",
    "PARK_REP_GRINDER",
    "REC_CREW_CAPTAIN",
    "MYCAREER_STORY_CASUAL",
    "MYNBA_FRANCHISE_SIM",
    "BUILD_LAB_THEORYCRAFTER",
    "THE_W_LOYALIST",
    "CROSS_LABEL_NOMAD",
    "MOBILE_DAILY_RITUALIST",
    "RAGE_QUIT_TILT_RISK",
  ]);
  const VALID_LABELS = new Set(["2K", "2K_SPORTS", "2K_CORE"]);

  const problems = [];
  for (const id of REQUIRED_HUBS) {
    if (!hubs.some((h) => h.game_id === id)) {
      problems.push(`missing parent hub '${id}'`);
    }
  }
  for (const g of gamesData) {
    if (!VALID_LABELS.has(g.label)) {
      problems.push(`game '${g.game_id}' has invalid label '${g.label}'`);
    }
    if (g.parent_game_id && !gameIds.has(g.parent_game_id)) {
      problems.push(`game '${g.game_id}' has unresolvable parent '${g.parent_game_id}'`);
    }
  }
  for (const o of offersData) {
    if (typeof o.expected_conversion_boost === "string") {
      problems.push(`offer '${o.offer_id}' has a string expected_conversion_boost`);
    }
    if (o.affinity_archetype && !CANONICAL_ARCHETYPES.has(o.affinity_archetype)) {
      problems.push(`offer '${o.offer_id}' has unknown archetype '${o.affinity_archetype}'`);
    }
    if (o.game_id && !gameIds.has(o.game_id)) {
      problems.push(`offer '${o.offer_id}' references unknown game '${o.game_id}'`);
    }
  }
  if (problems.length) {
    throw new Error(
      `Catalog validation failed (${problems.length}):\n  - ` +
        problems.slice(0, 20).join("\n  - ")
    );
  }
  console.log(`  catalog validated: ${gamesData.length} games (${hubs.length} hubs), ${offersData.length} offers`);

  await insertAll(
    database,
    "Games",
    gamesData.map((g) => ({
      game_id: str(g.game_id),
      title: str(g.title),
      franchise: str(g.franchise),
      label: str(g.label),
      genre: str(g.genre),
      active_players: int(g.active_players),
      is_parent_hub: bool(g.is_parent_hub),
      parent_game_id: str(g.parent_game_id),
      release_date: str(g.release_date),
      lifecycle_status: str(g.lifecycle_status),
      monetization_model: str(g.monetization_model),
      current_season: str(g.current_season),
    }))
  );

  await insertAll(
    database,
    "Creators",
    DATA("creators.json").map((c) => ({
      creator_id: str(c.creator_id),
      handle: str(c.handle),
      name: str(c.name),
      platform: str(c.platform),
      franchise: str(c.franchise),
      followers: int(c.followers),
      avg_stream_viewers: int(c.avg_stream_viewers),
      conversion_affinity: num(c.conversion_affinity),
      signature_mode: str(c.signature_mode),
      avatar: str(c.avatar),
    }))
  );

  await insertAll(
    database,
    "Clans",
    DATA("clans.json").map((c) => ({
      clan_id: str(c.clan_id),
      name: str(c.name),
      franchise: str(c.franchise),
      region: str(c.region),
      tier: str(c.tier),
      member_count: int(c.member_count),
    }))
  );

  await insertAll(
    database,
    "Offers",
    offersData.map((o) => ({
      offer_id: str(o.offer_id),
      offer_title: str(o.offer_title),
      target_franchise: str(o.target_franchise),
      game_id: str(o.game_id),
      offer_type: str(o.offer_type),
      category: str(o.category),
      price_usd: num(o.price_usd),
      expected_conversion_boost: num(o.expected_conversion_boost),
      affinity_archetype: str(o.affinity_archetype),
      lifecycle_status: str(o.lifecycle_status),
      available_from: str(o.available_from),
      description: str(o.description),
    }))
  );

  await insertAll(
    database,
    "Identities",
    DATA("platform_identities.json").map((i) => ({
      identity_id: str(i.identity_id),
      platform: str(i.platform),
      platform_handle: str(i.platform_handle),
      confidence_score: num(i.confidence_score),
    }))
  );

  console.log("\nLoading players...");
  await insertAll(
    database,
    "Players",
    DATA("master_players.json").map((p) => ({
      player_id: str(p.player_id),
      display_name: str(p.display_name),
      gamer_tag: str(p.gamer_tag),
      primary_email: str(p.primary_email),
      primary_franchise: str(p.primary_franchise),
      franchises_played: (p.franchises_played || []).map(String),
      primary_archetype: str(p.primary_archetype),
      lifetime_spend_usd: num(p.lifetime_spend_usd),
      churn_risk_score: num(p.churn_risk_score),
      tilt_sensitivity: num(p.tilt_sensitivity),
      recent_loss_streak: int(p.recent_loss_streak || 0),
      age: int(p.age),
      gender: str(p.gender),
      account_tenure_days: int(p.account_tenure_days),
      currency_balance: int(p.currency_balance),
      country: str(p.country),
      country_code: str(p.country_code),
      country_flag: str(p.country_flag),
      dma_market: str(p.dma_market),
      lat: num(p.lat),
      lng: num(p.lng),
      followed_creators: (p.followed_creators || []).map(String),
      primary_creator_influence: str(p.primary_creator_influence),
      game_telemetry: json(p.game_telemetry || {}),
      purchased_items: json(p.purchased_items || []),
    })),
    450,
    4
  );

  console.log("\nLoading edges...");

  const playsRaw = DATA("played_game_edges.json");
  const unresolved = new Map();
  const playsRows = [];
  for (const e of playsRaw) {
    const gid = String(e.game_id);
    if (!gameIds.has(gid)) {
      unresolved.set(gid, (unresolved.get(gid) || 0) + 1);
      continue;
    }
    playsRows.push({
      player_id: str(e.player_id),
      game_id: str(gid),
      hours_played: num(e.hours_played),
      last_played_timestamp: str(e.last_played_timestamp),
    });
  }
  if (unresolved.size) {
    throw new Error(
      "PlaysGame edges reference games that do not exist:\n  - " +
        [...unresolved.entries()]
          .map(([g, n]) => `${g} (${n} edges)`)
          .join("\n  - ")
    );
  }
  await insertAll(database, "PlaysGame", playsRows);

  await insertAll(
    database,
    "MemberOfClan",
    DATA("member_of_clan_edges.json").map((e) => ({
      player_id: str(e.player_id),
      clan_id: str(e.clan_id),
      role: str(e.role),
    }))
  );

  await insertAll(
    database,
    "HasIdentity",
    DATA("has_identity_edges.json").map((e) => ({
      player_id: str(e.player_id),
      identity_id: str(e.identity_id),
      confidence_score: num(e.confidence_score),
    }))
  );

  const creators = DATA("creators.json");
  const byKey = new Map();
  for (const c of creators) {
    byKey.set(String(c.creator_id).toLowerCase(), c.creator_id);
    byKey.set(String(c.handle).toLowerCase(), c.creator_id);
    byKey.set(String(c.name).toLowerCase(), c.creator_id);
  }
  const followEdges = [];
  const seen = new Set();
  for (const p of DATA("master_players.json")) {
    for (const ref of p.followed_creators || []) {
      const cid = byKey.get(String(ref).toLowerCase());
      if (!cid) continue;
      const key = `${p.player_id}|${cid}`;
      if (seen.has(key)) continue;
      seen.add(key);
      followEdges.push({
        player_id: str(p.player_id),
        creator_id: str(cid),
        affinity_level:
          String(p.primary_creator_influence || "").toLowerCase() ===
          String(ref).toLowerCase()
            ? "PRIMARY"
            : "SECONDARY",
      });
    }
  }
  if (!followEdges.length) {
    throw new Error("FollowsCreator derived zero edges.");
  }
  await insertAll(database, "FollowsCreator", followEdges);

  await insertAll(
    database,
    "TelemetryEvents",
    DATA("telemetry_match_events.json").map((e) => ({
      event_id: str(e.event_id),
      player_id: str(e.player_id),
      game_id: str(e.game_id),
      event_type: str(e.event_type),
      consecutive_losses: int(e.consecutive_losses),
      tilt_index: num(e.tilt_index),
      event_timestamp: str(e.timestamp),
      triggered_offer_id: str(e.triggered_offer_id),
    }))
  );

  console.log("\nVerifying row counts in database...");
  for (const t of [
    "Players",
    "Games",
    "Creators",
    "Clans",
    "Offers",
    "Identities",
    "PlaysGame",
    "FollowsCreator",
    "MemberOfClan",
    "HasIdentity",
    "TelemetryEvents",
  ]) {
    const [rows] = await database.run({ sql: `SELECT COUNT(*) AS n FROM ${t}` });
    console.log(`  ${t.padEnd(18)} ${rows[0].toJSON().n}`);
  }

  console.log("\nVerifying TakeTwoPlayerGraph & Golden Plays via GQL...");
  const [gCount] = await database.run({
    sql: `GRAPH TakeTwoPlayerGraph MATCH (p:Player) RETURN COUNT(p) AS total_players`,
  });
  console.log(`  Total Graph Players: ${gCount[0].toJSON().total_players}`);

  const [labelRows] = await database.run({
    sql: `SELECT label, COUNT(*) AS games_count FROM Games GROUP BY label ORDER BY label`,
  });
  for (const r of labelRows) {
    const j = r.toJSON();
    console.log(`  Label ${j.label.padEnd(10)}: ${j.games_count} games`);
  }

  const [play1] = await database.run({
    sql: `GRAPH TakeTwoPlayerGraph
          MATCH (p:Player)-[:MEMBER_OF_CLAN]->(c:Clan)<-[:MEMBER_OF_CLAN]-(mate:Player)
          WHERE p.primary_franchise = 'NBA2K'
            AND INT64(p.game_telemetry.myplayer_ovr) < 85
            AND FLOAT64(p.game_telemetry.vc_spend_90d) >= 50
            AND INT64(p.game_telemetry.last_login_days_ago) >= 7
            AND INT64(mate.game_telemetry.last_login_days_ago) <= 3
            AND p.player_id <> mate.player_id
          RETURN COUNT(DISTINCT p.player_id) AS n`,
  });
  console.log(`  Play 1 (Season 2 Cliff w/ active crew mate): ${play1[0].toJSON().n}`);

  const [play2] = await database.run({
    sql: `GRAPH TakeTwoPlayerGraph
          MATCH (p:Player)-[:HAS_IDENTITY]->(i:Identity {platform: '2K Account'}),
                (p)-[:PLAYS_GAME]->(g:Game {game_id: 'game-nba2k26'})
          WHERE FLOAT64(p.game_telemetry.myteam_vc_spend_90d) > 0
            AND FLOAT64(p.game_telemetry.nba2k26_spend_usd) > 0
            AND BOOL(p.game_telemetry.migrated_to_2k27) = false
          RETURN COUNT(DISTINCT p.player_id) AS n`,
  });
  console.log(`  Play 2 (NBA 2K26 -> 2K27 Upgrade Bridge):    ${play2[0].toJSON().n}`);

  const [play3] = await database.run({
    sql: `GRAPH TakeTwoPlayerGraph
          MATCH (p:Player)
          WHERE INT64(p.game_telemetry.myteam_galaxy_opal_count) >= 10
            AND STRING(p.game_telemetry.season_pass_edition) = 'HALL_OF_FAME'
          RETURN COUNT(p.player_id) AS n`,
  });
  console.log(`  Play 3 (MyTEAM Pack Whales):                 ${play3[0].toJSON().n}`);

  await database.close();
  console.log("\nLoad complete.");
}

main().catch((e) => {
  console.error("\nLOAD FAILED:", e.message);
  if (e.details) console.error(e.details);
  process.exit(1);
});
