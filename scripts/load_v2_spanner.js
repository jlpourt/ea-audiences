#!/usr/bin/env node
/**
 * Create + load the 2K Courtside v2 Spanner database (twok_graph_db_v2).
 *
 *   node scripts/load_v2_spanner.js --create     # create DB + apply schema/twok_graph_db_v2.ddl
 *   node scripts/load_v2_spanner.js --load       # insert data/*.json (v1 base) + data/v2/*.json
 *   node scripts/load_v2_spanner.js --truncate   # delete all rows first (v2 DB only)
 *   node scripts/load_v2_spanner.js --verify     # row counts + sample GQL
 *   node scripts/load_v2_spanner.js --replace    # zero-downtime reload: UPSERT every row, then delete
 *                                                # stale keys (DB never empty while other apps read it)
 *
 * Hard guard: this script refuses to touch any database other than
 * twok_graph_db_v2. v1 twok_graph_db backs the live demo and is never modified.
 * Zero fallbacks: every failure throws and exits non-zero.
 */
const fs = require("fs");
const path = require("path");
const { Spanner } = require("@google-cloud/spanner");

const PROJECT = "jamie-bq-test";
const INSTANCE = process.env.SPANNER_INSTANCE_ID || "audience-graph-v2";
if (INSTANCE === "blackrock-spanner") {
  throw new Error("Refusing blackrock-spanner: v2 lives on audience-graph-v2 (blackrock-spanner is at its DB limit and hosts v1).");
}
const DATABASE = process.env.SPANNER_V2_DATABASE_ID || "twok_graph_db_v2";
if (DATABASE !== "twok_graph_db_v2") {
  throw new Error(`Refusing to operate on '${DATABASE}': this loader only targets twok_graph_db_v2.`);
}
const DDL_PATH = path.join("schema", "twok_graph_db_v2.ddl");

const V1 = (f) => JSON.parse(fs.readFileSync(path.join("data", f), "utf-8"));
const V2 = (f) => JSON.parse(fs.readFileSync(path.join("data", "v2", f), "utf-8"));

const int = (v) => (v === null || v === undefined ? null : Spanner.int(Math.round(Number(v))));
const num = (v) => (v === null || v === undefined ? null : Spanner.float(Number(v)));
const str = (v) => (v === null || v === undefined ? null : String(v));
const json = (v) => (v === null || v === undefined ? null : JSON.stringify(v));
const bool = (v) => (v === null || v === undefined ? null : Boolean(v));
const ts = (v) => (v === null || v === undefined ? null : new Date(v).toISOString());

function splitDdl(text) {
  const noComments = text
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .map((l) => l.replace(/\s--\s.*$/, ""))
    .join("\n");
  return noComments
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function createDb(instance) {
  const statements = splitDdl(fs.readFileSync(DDL_PATH, "utf-8"));
  const db = instance.database(DATABASE);
  const [exists] = await db.exists();
  if (exists) {
    throw new Error(`${DATABASE} already exists. Drop it manually (v2 only) before --create.`);
  }
  console.log(`Creating ${DATABASE} with ${statements.length} DDL statements...`);
  const [, op] = await instance.createDatabase(DATABASE, { schema: statements });
  await op.promise();
  console.log(`  ${DATABASE} created.`);
}

// Primary keys (schema/twok_graph_db_v2.ddl), used by --replace to prune stale rows.
const KEYS = {
  Players: ["player_id"], Games: ["game_id"], Creators: ["creator_id"], Clans: ["clan_id"], Offers: ["offer_id"],
  Identities: ["identity_id"], TelemetryEvents: ["event_id"], Seasons: ["season_id"], Matches: ["match_id"],
  Streams: ["stream_id"], Brands: ["brand_id"], BrandActivations: ["activation_id"], Items: ["item_id"],
  CrewMembershipEvents: ["event_id"], PlaysGame: ["player_id", "game_id"], FollowsCreator: ["player_id", "creator_id"],
  MemberOfClan: ["player_id", "clan_id"], HasIdentity: ["player_id", "identity_id"],
  PlayedWith: ["player_id", "other_player_id"], FriendsWith: ["player_id", "other_player_id"],
  Messaged: ["player_id", "other_player_id"], CompetedIn: ["clan_id", "match_id"], InSeason: ["match_id", "season_id"],
  SplitFrom: ["clan_id", "parent_clan_id"], Hosted: ["creator_id", "stream_id"], Watched: ["identity_id", "stream_id"],
  Sponsors: ["brand_id", "activation_id"], Features: ["activation_id", "item_id"],
  Bought: ["player_id", "item_id", "bought_at"], Equipped: ["player_id", "item_id"],
};
const TS_KEYS = new Set(["bought_at"]);
let MODE = "insert"; // or "upsert" (--replace)
const LOADED_KEYS = {}; // table -> Set of key strings written in this run

const keyStr = (row, cols) =>
  cols.map((c) => {
    const v = row[c];
    if (!TS_KEYS.has(c)) return String(v);
    return (v instanceof Date ? new Date(v.getTime()) : new Date(String(v))).toISOString();
  }).join("\u0001");

async function insertAll(database, tableName, rows, chunkSize = 600, concurrency = 6) {
  if (!rows.length) throw new Error(`${tableName}: zero rows to insert (refusing to load an empty table)`);
  const table = database.table(tableName);
  const cols = KEYS[tableName];
  if (!cols) throw new Error(`No primary key registered for ${tableName}`);
  LOADED_KEYS[tableName] = new Set(rows.map((r) => keyStr(r, cols)));
  const chunks = [];
  for (let i = 0; i < rows.length; i += chunkSize) chunks.push(rows.slice(i, i + chunkSize));
  let done = 0;
  for (let i = 0; i < chunks.length; i += concurrency) {
    await Promise.all(
      chunks.slice(i, i + concurrency).map(async (c) => {
        await (MODE === "upsert" ? table.upsert(c) : table.insert(c));
        done += c.length;
        process.stdout.write(`\r  ${tableName}: ${done}/${rows.length}`);
      })
    );
  }
  process.stdout.write(`\r  ${tableName}: ${done}/${rows.length}  ok\n`);
}

const ALL_TABLES = [
  "Equipped", "Bought", "Features", "Sponsors", "Watched", "Hosted", "SplitFrom", "InSeason",
  "CompetedIn", "Messaged", "FriendsWith", "PlayedWith", "CrewMembershipEvents", "PlaysGame",
  "FollowsCreator", "MemberOfClan", "HasIdentity", "TelemetryEvents", "Items", "BrandActivations",
  "Brands", "Streams", "Matches", "Seasons", "Players", "Games", "Creators", "Clans", "Offers",
  "Identities",
];

async function truncate(database) {
  console.log(`Truncating ${DATABASE}...`);
  for (const t of ALL_TABLES) {
    await database.runPartitionedUpdate({ sql: `DELETE FROM ${t} WHERE TRUE` });
    console.log(`  cleared ${t}`);
  }
}

async function prune(database) {
  console.log("\nPruning stale rows (keys not in this load)...");
  for (const t of ALL_TABLES) {
    const cols = KEYS[t];
    const want = LOADED_KEYS[t];
    if (!want) throw new Error(`prune: ${t} was not loaded in this run; refusing to prune`);
    const [rows] = await database.run({ sql: `SELECT ${cols.join(", ")} FROM ${t}` });
    const stale = [];
    for (const r of rows) {
      const o = r.toJSON();
      if (!want.has(keyStr(o, cols))) stale.push(cols.map((c) => o[c]));
    }
    for (let i = 0; i < stale.length; i += 2000) {
      await database.table(t).deleteRows(stale.slice(i, i + 2000).map((k) => (k.length === 1 ? k[0] : k)));
    }
    console.log(`  ${t.padEnd(22)} kept ${want.size}  deleted ${stale.length}`);
  }
}

async function load(database) {
  console.log("\nReference tables (v1 base)...");
  await insertAll(database, "Games", V1("games.json").map((g) => ({
    game_id: str(g.game_id), title: str(g.title), franchise: str(g.franchise), label: str(g.label),
    genre: str(g.genre), active_players: int(g.active_players), is_parent_hub: bool(g.is_parent_hub),
    parent_game_id: str(g.parent_game_id), release_date: str(g.release_date),
    lifecycle_status: str(g.lifecycle_status), monetization_model: str(g.monetization_model),
    current_season: str(g.current_season),
  })));
  await insertAll(database, "Offers", V1("marketing_offers.json").map((o) => ({
    offer_id: str(o.offer_id), offer_title: str(o.offer_title), target_franchise: str(o.target_franchise),
    game_id: str(o.game_id), offer_type: str(o.offer_type), category: str(o.category),
    price_usd: num(o.price_usd), expected_conversion_boost: num(o.expected_conversion_boost),
    affinity_archetype: str(o.affinity_archetype), lifecycle_status: str(o.lifecycle_status),
    available_from: str(o.available_from), description: str(o.description),
  })));
  await insertAll(database, "TelemetryEvents", V1("telemetry_match_events.json").map((e) => ({
    event_id: str(e.event_id), player_id: str(e.player_id), game_id: str(e.game_id),
    event_type: str(e.event_type), consecutive_losses: int(e.consecutive_losses),
    tilt_index: num(e.tilt_index), event_timestamp: str(e.timestamp),
    triggered_offer_id: str(e.triggered_offer_id),
  })));
  await insertAll(database, "PlaysGame", V1("played_game_edges.json").map((e) => ({
    player_id: str(e.player_id), game_id: str(e.game_id), hours_played: num(e.hours_played),
    last_played_timestamp: str(e.last_played_timestamp),
  })));

  console.log("\nv2 nodes...");
  await insertAll(database, "Creators", V2("creators.json").map((c) => ({
    creator_id: str(c.creator_id), handle: str(c.handle), name: str(c.name), platform: str(c.platform),
    franchise: str(c.franchise), followers: int(c.followers), avg_stream_viewers: int(c.avg_stream_viewers),
    conversion_affinity: num(c.conversion_affinity), signature_mode: str(c.signature_mode),
    avatar: str(c.avatar), hub_score: num(c.hub_score), community_span: int(c.community_span),
  })));
  await insertAll(database, "Clans", V2("clans.json").map((c) => ({
    clan_id: str(c.clan_id), name: str(c.name), franchise: str(c.franchise), region: str(c.region),
    tier: str(c.tier), member_count: int(c.member_count),
  })));
  await insertAll(database, "Identities", V2("identities.json").map((i) => ({
    identity_id: str(i.identity_id), platform: str(i.platform), platform_handle: str(i.platform_handle),
    confidence_score: num(i.confidence_score),
  })));
  const players = V2("players.json");
  await insertAll(database, "Players", players.map((p) => ({
    player_id: str(p.player_id), display_name: str(p.display_name), gamer_tag: str(p.gamer_tag),
    primary_email: str(p.primary_email), primary_franchise: str(p.primary_franchise),
    franchises_played: (p.franchises_played || []).map(String), primary_archetype: str(p.primary_archetype),
    lifetime_spend_usd: num(p.lifetime_spend_usd), churn_risk_score: num(p.churn_risk_score),
    tilt_sensitivity: num(p.tilt_sensitivity), recent_loss_streak: int(p.recent_loss_streak || 0),
    age: int(p.age), gender: str(p.gender), account_tenure_days: int(p.account_tenure_days),
    currency_balance: int(p.currency_balance), country: str(p.country), country_code: str(p.country_code),
    country_flag: str(p.country_flag), dma_market: str(p.dma_market), lat: num(p.lat), lng: num(p.lng),
    followed_creators: (p.followed_creators || []).map(String),
    primary_creator_influence: str(p.primary_creator_influence),
    game_telemetry: json(p.game_telemetry || {}), purchased_items: json(p.purchased_items || []),
    last_active_at: ts(p.last_active_at), churned_at: ts(p.churned_at),
    session_min_7d: num(p.session_min_7d), session_min_prev_7d: num(p.session_min_prev_7d),
    college_hoops_affinity: num(p.college_hoops_affinity), wnba_affinity: num(p.wnba_affinity),
    franchise_mode_affinity: num(p.franchise_mode_affinity), community_id: str(p.community_id),
  })), 400, 6);
  await insertAll(database, "Seasons", V2("seasons.json").map((s) => ({
    season_id: str(s.season_id), game_id: str(s.game_id), name: str(s.name),
    start_at: ts(s.start_at), end_at: ts(s.end_at),
  })));
  await insertAll(database, "Matches", V2("matches.json").map((m) => ({
    match_id: str(m.match_id), season_id: str(m.season_id), mode: str(m.mode), played_at: ts(m.played_at),
  })), 1500);
  await insertAll(database, "Streams", V2("streams.json").map((s) => ({
    stream_id: str(s.stream_id), creator_id: str(s.creator_id), title: str(s.title), platform: str(s.platform),
    started_at: ts(s.started_at), ended_at: ts(s.ended_at), peak_viewers: int(s.peak_viewers),
    featured_offer_id: str(s.featured_offer_id), featured_item_id: str(s.featured_item_id),
  })));
  await insertAll(database, "Brands", V2("brands.json").map((b) => ({
    brand_id: str(b.brand_id), name: str(b.name), category: str(b.category),
    partnership_summary: str(b.partnership_summary), logo_url: str(b.logo_url),
  })));
  await insertAll(database, "BrandActivations", V2("brand_activations.json").map((a) => ({
    activation_id: str(a.activation_id), brand_id: str(a.brand_id), title: str(a.title), kind: str(a.kind),
    starts_at: ts(a.starts_at), ends_at: ts(a.ends_at), season_id: str(a.season_id),
  })));
  await insertAll(database, "Items", V2("items.json").map((i) => ({
    item_id: str(i.item_id), name: str(i.name), item_type: str(i.item_type), brand_id: str(i.brand_id),
    is_branded: bool(i.is_branded), vc_price: int(i.vc_price),
  })));
  await insertAll(database, "CrewMembershipEvents", V2("crew_membership_events.json").map((e) => ({
    event_id: str(e.event_id), player_id: str(e.player_id), clan_id: str(e.clan_id),
    event_type: str(e.event_type), occurred_at: ts(e.occurred_at), related_clan_id: str(e.related_clan_id),
  })), 1000);

  console.log("\nEdges...");
  // FollowsCreator is derived from Players.followed_creators exactly like the v1 loader.
  const creators = V2("creators.json");
  const byKey = new Map();
  for (const c of creators) {
    byKey.set(String(c.creator_id).toLowerCase(), c.creator_id);
    byKey.set(String(c.handle).toLowerCase(), c.creator_id);
    byKey.set(String(c.name).toLowerCase(), c.creator_id);
  }
  const follows = [];
  const seen = new Set();
  for (const p of players) {
    for (const ref of p.followed_creators || []) {
      const cid = byKey.get(String(ref).toLowerCase());
      if (!cid) throw new Error(`Player ${p.player_id} follows unknown creator '${ref}'`);
      const k = `${p.player_id}|${cid}`;
      if (seen.has(k)) continue;
      seen.add(k);
      follows.push({
        player_id: str(p.player_id), creator_id: str(cid),
        affinity_level: String(p.primary_creator_influence || "").toLowerCase() === String(ref).toLowerCase()
          ? "PRIMARY" : "SECONDARY",
      });
    }
  }
  await insertAll(database, "FollowsCreator", follows, 1500);
  await insertAll(database, "MemberOfClan", V2("member_of_clan.json").map((e) => ({
    player_id: str(e.player_id), clan_id: str(e.clan_id), role: str(e.role), joined_at: ts(e.joined_at),
    left_at: ts(e.left_at), is_active: bool(e.is_active), crew_centrality: num(e.crew_centrality),
  })), 1000);
  await insertAll(database, "HasIdentity", V2("has_identity.json").map((e) => ({
    player_id: str(e.player_id), identity_id: str(e.identity_id), confidence_score: num(e.confidence_score),
  })), 1500);
  await insertAll(database, "PlayedWith", V2("played_with.json").map((e) => ({
    player_id: str(e.player_id), other_player_id: str(e.other_player_id),
    games_together_30d: int(e.games_together_30d), games_together_total: int(e.games_together_total),
    last_played_at: ts(e.last_played_at), same_crew: bool(e.same_crew),
  })), 1200);
  await insertAll(database, "FriendsWith", V2("friends_with.json").map((e) => ({
    player_id: str(e.player_id), other_player_id: str(e.other_player_id), since: ts(e.since),
  })), 1500);
  await insertAll(database, "Messaged", V2("messaged.json").map((e) => ({
    player_id: str(e.player_id), other_player_id: str(e.other_player_id),
    msg_count_30d: int(e.msg_count_30d), last_msg_at: ts(e.last_msg_at),
  })), 1500);
  await insertAll(database, "CompetedIn", V2("competed_in.json").map((e) => ({
    clan_id: str(e.clan_id), match_id: str(e.match_id), result: str(e.result), score_diff: int(e.score_diff),
  })), 1500);
  await insertAll(database, "InSeason", V2("in_season.json").map((e) => ({
    match_id: str(e.match_id), season_id: str(e.season_id),
  })), 2000);
  await insertAll(database, "SplitFrom", V2("split_from.json").map((e) => ({
    clan_id: str(e.clan_id), parent_clan_id: str(e.parent_clan_id), split_at: ts(e.split_at),
    shared_members: int(e.shared_members),
  })));
  await insertAll(database, "Hosted", V2("hosted.json").map((e) => ({
    creator_id: str(e.creator_id), stream_id: str(e.stream_id),
  })));
  await insertAll(database, "Watched", V2("watched.json").map((e) => ({
    identity_id: str(e.identity_id), stream_id: str(e.stream_id), watched_at: ts(e.watched_at),
    watch_minutes: num(e.watch_minutes),
  })), 1500);
  await insertAll(database, "Sponsors", V2("sponsors.json").map((e) => ({
    brand_id: str(e.brand_id), activation_id: str(e.activation_id),
  })));
  await insertAll(database, "Features", V2("features.json").map((e) => ({
    activation_id: str(e.activation_id), item_id: str(e.item_id),
  })));
  await insertAll(database, "Bought", V2("bought.json").map((e) => ({
    player_id: str(e.player_id), item_id: str(e.item_id), bought_at: ts(e.bought_at),
    vc_amount: int(e.vc_amount), via_activation_id: str(e.via_activation_id),
  })), 1200);
  await insertAll(database, "Equipped", V2("equipped.json").map((e) => ({
    player_id: str(e.player_id), item_id: str(e.item_id), equipped_at: ts(e.equipped_at),
  })), 1500);
}

const SAMPLE_GQL = [
  {
    name: "Undirected PLAYED_WITH 2-hop (a keystone's friends-of-friends)",
    sql: `GRAPH TakeTwoPlayerGraph
MATCH (a:Player)-[m:MEMBER_OF]->(c:Crew)
WHERE m.is_active AND m.crew_centrality >= 0.9
LIMIT 1
MATCH (a)-[e1:PLAYED_WITH]-(b:Player)-[e2:PLAYED_WITH]-(c2:Player)
WHERE c2.player_id <> a.player_id
RETURN a.gamer_tag AS keystone, COUNT(DISTINCT b.player_id) AS hop1, COUNT(DISTINCT c2.player_id) AS hop2`,
  },
  {
    name: "Creator -> Stream <- Watched <- Identity <- Player",
    sql: `GRAPH TakeTwoPlayerGraph
MATCH (cr:Creator)-[:HOSTED]->(s:Stream)<-[w:WATCHED]-(i:ViewerAccount)<-[:LINKED_TO]-(p:Player)
WHERE s.featured_offer_id IS NOT NULL AND w.watch_minutes >= 20
RETURN cr.handle AS creator, COUNT(DISTINCT p.player_id) AS engaged_viewers
ORDER BY engaged_viewers DESC
LIMIT 5`,
  },
  {
    name: "Brand -> Activation -> Item <- Bought <- Player",
    sql: `GRAPH TakeTwoPlayerGraph
MATCH (b:Brand)-[:SPONSORS]->(a:Activation)-[:FEATURES]->(it:Item)<-[bo:BOUGHT]-(p:Player)
RETURN b.name AS brand, COUNT(DISTINCT p.player_id) AS buyers, SUM(bo.vc_amount) AS vc
ORDER BY vc DESC
LIMIT 5`,
  },
];

async function verify(database) {
  console.log("\nRow counts:");
  const counts = {};
  for (const t of [...ALL_TABLES].reverse()) {
    const [rows] = await database.run({ sql: `SELECT COUNT(*) AS n FROM ${t}` });
    counts[t] = Number(rows[0].toJSON().n);
    console.log(`  ${t.padEnd(22)} ${counts[t]}`);
  }
  for (const q of SAMPLE_GQL) {
    const t0 = Date.now();
    const [rows] = await database.run({ sql: q.sql });
    console.log(`\n${q.name}  (${Date.now() - t0} ms)`);
    if (!rows.length) throw new Error(`Sample GQL returned zero rows: ${q.name}`);
    for (const r of rows) console.log("  ", JSON.stringify(r.toJSON()));
  }
  fs.writeFileSync(path.join("data", "v2", "spanner_counts.json"), JSON.stringify(counts, null, 2));
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const spanner = new Spanner({ projectId: PROJECT });
  const instance = spanner.instance(INSTANCE);
  if (args.has("--create")) await createDb(instance);
  const database = instance.database(DATABASE);
  if (args.has("--truncate")) await truncate(database);
  if (args.has("--replace")) {
    MODE = "upsert";
    await load(database);
    await prune(database);
  }
  if (args.has("--load")) await load(database);
  if (args.has("--verify")) await verify(database);
  await database.close();
  console.log("\nDone.");
}

main().catch((e) => {
  console.error("\nV2 SPANNER LOAD FAILED:", e.message);
  if (e.details) console.error(e.details);
  process.exit(1);
});
