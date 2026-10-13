#!/usr/bin/env node
/**
 * Provision BigQuery (`twok_marketing_intelligence`), Cloud Storage
 * (`twok-courtside-media-jamie-bq-test`), and Pub/Sub (`twok-courtside-activations`)
 * for 2K Courtside.
 *
 * Run with: node scripts/setup-gcp-bigquery.js
 */
const fs = require("fs");
const path = require("path");
const { BigQuery } = require("@google-cloud/bigquery");
const { Storage } = require("@google-cloud/storage");
const { PubSub } = require("@google-cloud/pubsub");

const PROJECT = process.env.GCP_PROJECT_ID || "jamie-bq-test";
const REGION = process.env.GCP_REGION || "us-central1";
const DATASET = process.env.BQ_DATASET_ID || "twok_marketing_intelligence";
const BUCKET = process.env.GCS_BUCKET_NAME || "twok-courtside-media-jamie-bq-test";
const TOPIC = process.env.PUBSUB_TOPIC || "twok-courtside-activations";
const SUBSCRIPTION = `${TOPIC}-sub`;

async function ensureBigQuery() {
  console.log(`\n[1/3] Provisioning BigQuery dataset ${PROJECT}.${DATASET}...`);
  const bq = new BigQuery({ projectId: PROJECT });
  const dataset = bq.dataset(DATASET);
  const [exists] = await dataset.exists();
  if (!exists) {
    await bq.createDataset(DATASET, { location: "US" });
    console.log(`  Created dataset ${DATASET}`);
  } else {
    console.log(`  Dataset ${DATASET} exists`);
  }

  // 1. telemetry_events
  const telemetryTable = dataset.table("telemetry_events");
  const [telExists] = await telemetryTable.exists();
  if (telExists) {
    await telemetryTable.delete();
  }
  await dataset.createTable("telemetry_events", {
    schema: [
      { name: "event_id", type: "STRING", mode: "REQUIRED" },
      { name: "player_id", type: "STRING", mode: "REQUIRED" },
      { name: "game_id", type: "STRING", mode: "NULLABLE" },
      { name: "event_type", type: "STRING", mode: "REQUIRED" },
      { name: "consecutive_losses", type: "INT64", mode: "NULLABLE" },
      { name: "tilt_index", type: "FLOAT64", mode: "NULLABLE" },
      { name: "event_timestamp", type: "TIMESTAMP", mode: "NULLABLE" },
      { name: "triggered_offer_id", type: "STRING", mode: "NULLABLE" },
    ],
  });

  const rawEvents = JSON.parse(
    fs.readFileSync(path.join("data", "telemetry_match_events.json"), "utf-8")
  );
  const rows = rawEvents.map((e) => ({
    event_id: String(e.event_id),
    player_id: String(e.player_id),
    game_id: e.game_id ? String(e.game_id) : null,
    event_type: String(e.event_type),
    consecutive_losses: Number(e.consecutive_losses || 0),
    tilt_index: Number(e.tilt_index || 0),
    event_timestamp: e.timestamp || new Date().toISOString(),
    triggered_offer_id: e.triggered_offer_id ? String(e.triggered_offer_id) : null,
  }));

  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    await telemetryTable.insert(rows.slice(i, i + chunkSize));
  }
  console.log(`  Loaded ${rows.length} rows into ${DATASET}.telemetry_events`);

  // 2. saved_audiences
  const savedTable = dataset.table("saved_audiences");
  const [savedExists] = await savedTable.exists();
  if (!savedExists) {
    await dataset.createTable("saved_audiences", {
      schema: [
        { name: "audience_id", type: "STRING", mode: "REQUIRED" },
        { name: "name", type: "STRING", mode: "REQUIRED" },
        { name: "nl_query", type: "STRING", mode: "REQUIRED" },
        { name: "gql", type: "STRING", mode: "REQUIRED" },
        { name: "matched_count", type: "INT64", mode: "REQUIRED" },
        { name: "created_at", type: "TIMESTAMP", mode: "REQUIRED" },
        { name: "created_by", type: "STRING", mode: "REQUIRED" },
        { name: "channels", type: "STRING", mode: "REPEATED" },
        { name: "status", type: "STRING", mode: "REQUIRED" },
        { name: "franchise", type: "STRING", mode: "NULLABLE" },
        { name: "dominant_archetype", type: "STRING", mode: "NULLABLE" },
        { name: "avg_spend", type: "FLOAT64", mode: "NULLABLE" },
      ],
    });
    const seedAudiences = [
      {
        audience_id: "aud-s2-cliff-seed",
        name: "Season 2 Cliff · Active Crew Mates",
        nl_query:
          "NBA 2K27 MyCAREER builds below 85 OVR who spent $50+ on VC, haven't logged in for 7 days, and are in a Crew with active teammates",
        gql: `GRAPH TakeTwoPlayerGraph MATCH (p:Player)-[:MEMBER_OF_CLAN]->(c:Clan)<-[:MEMBER_OF_CLAN]-(mate:Player) WHERE p.primary_franchise = 'NBA2K' AND INT64(p.game_telemetry.myplayer_ovr) < 85 AND FLOAT64(p.game_telemetry.vc_spend_90d) >= 50 AND INT64(p.game_telemetry.last_login_days_ago) >= 7 AND INT64(mate.game_telemetry.last_login_days_ago) <= 3 AND p.player_id <> mate.player_id RETURN DISTINCT p.player_id`,
        matched_count: 284,
        created_at: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
        created_by: "2K Lifecycle Growth",
        channels: ["IN_GAME_INBOX", "2K_ACCOUNT_EMAIL", "PUSH_2K_MOBILE"],
        status: "SAVED",
        franchise: "NBA2K",
        dominant_archetype: "MYCAREER_STORY_CASUAL",
        avg_spend: 124.8,
      },
      {
        audience_id: "aud-gta6-gravity-seed",
        name: "Cross-Label Gravity · GTA VI Pre-Order Bridge",
        nl_query:
          "NBA 2K27 MyTEAM spenders with a linked Rockstar Social Club account and GTA Online spend who have not pre-ordered GTA VI",
        gql: `GRAPH TakeTwoPlayerGraph MATCH (p:Player)-[:HAS_IDENTITY]->(i:Identity {platform: 'Rockstar Social Club'}), (p)-[:PLAYS_GAME]->(g:Game {game_id: 'game-gta-online'}) WHERE FLOAT64(p.game_telemetry.myteam_vc_spend_90d) > 0 AND FLOAT64(p.game_telemetry.gta_online_spend_usd) > 0 AND NOT EXISTS { MATCH (p2:Player)-[:PLAYS_GAME]->(:Game {game_id: 'game-gta6'}) WHERE p2.player_id = p.player_id } RETURN DISTINCT p.player_id`,
        matched_count: 303,
        created_at: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
        created_by: "Take-Two Cross-Label CRM",
        channels: ["ROCKSTAR_NEWSWIRE", "2K_ACCOUNT_EMAIL", "IN_GAME_INBOX"],
        status: "ACTIVATED",
        franchise: "GTA6",
        dominant_archetype: "CROSS_LABEL_NOMAD",
        avg_spend: 318.4,
      },
    ];
    await savedTable.insert(seedAudiences);
    console.log(`  Created and seeded ${DATASET}.saved_audiences`);
  } else {
    console.log(`  Table ${DATASET}.saved_audiences exists`);
  }

  // 3. activation_log
  const actTable = dataset.table("activation_log");
  const [actExists] = await actTable.exists();
  if (!actExists) {
    await dataset.createTable("activation_log", {
      schema: [
        { name: "activation_id", type: "STRING", mode: "REQUIRED" },
        { name: "audience_id", type: "STRING", mode: "REQUIRED" },
        { name: "channel", type: "STRING", mode: "REQUIRED" },
        { name: "payload", type: "JSON", mode: "NULLABLE" },
        { name: "published_at", type: "TIMESTAMP", mode: "REQUIRED" },
        { name: "pubsub_message_id", type: "STRING", mode: "NULLABLE" },
      ],
    });
    const seedActivations = [
      {
        activation_id: "act-seed-001",
        audience_id: "aud-gta6-gravity-seed",
        channel: "ROCKSTAR_NEWSWIRE",
        payload: JSON.stringify({
          audienceName: "Cross-Label Gravity · GTA VI Pre-Order Bridge",
          matchedCount: 303,
          offerId: "off-gta6-preorder",
          approvedBy: "Courtside Policy Gate",
        }),
        published_at: new Date(Date.now() - 3600 * 1000 * 1.5).toISOString(),
        pubsub_message_id: "12849201948102",
      },
      {
        activation_id: "act-seed-002",
        audience_id: "aud-s2-cliff-seed",
        channel: "IN_GAME_INBOX",
        payload: JSON.stringify({
          audienceName: "Season 2 Cliff · Active Crew Mates",
          matchedCount: 284,
          offerId: "off-crew-reup-bundle",
          approvedBy: "Courtside Policy Gate",
        }),
        published_at: new Date(Date.now() - 3600 * 1000 * 0.5).toISOString(),
        pubsub_message_id: "12849201948891",
      },
    ];
    await actTable.insert(seedActivations);
    console.log(`  Created and seeded ${DATASET}.activation_log`);
  } else {
    console.log(`  Table ${DATASET}.activation_log exists`);
  }
}

async function ensureStorage() {
  console.log(`\n[2/3] Provisioning Cloud Storage bucket gs://${BUCKET}...`);
  const storage = new Storage({ projectId: PROJECT });
  const bucket = storage.bucket(BUCKET);
  const [exists] = await bucket.exists();
  if (!exists) {
    await storage.createBucket(BUCKET, {
      location: REGION,
      storageClass: "STANDARD",
      iamConfiguration: { uniformBucketLevelAccess: { enabled: true } },
    });
    console.log(`  Created bucket gs://${BUCKET}`);
  } else {
    console.log(`  Bucket gs://${BUCKET} exists`);
  }
  try {
    await bucket.makePublic();
    console.log(`  Verified public object viewer access on gs://${BUCKET}`);
  } catch (e) {
    console.log(`  Public IAM status: ${e.message}`);
  }
}

async function ensurePubSub() {
  console.log(`\n[3/3] Provisioning Pub/Sub topic ${TOPIC}...`);
  const pubsub = new PubSub({ projectId: PROJECT });
  const topic = pubsub.topic(TOPIC);
  const [tExists] = await topic.exists();
  if (!tExists) {
    await pubsub.createTopic(TOPIC);
    console.log(`  Created topic ${TOPIC}`);
  } else {
    console.log(`  Topic ${TOPIC} exists`);
  }
  const sub = topic.subscription(SUBSCRIPTION);
  const [sExists] = await sub.exists();
  if (!sExists) {
    await topic.createSubscription(SUBSCRIPTION, {
      ackDeadlineSeconds: 30,
    });
    console.log(`  Created subscription ${SUBSCRIPTION}`);
  } else {
    console.log(`  Subscription ${SUBSCRIPTION} exists`);
  }
}

async function main() {
  await ensureBigQuery();
  await ensureStorage();
  await ensurePubSub();
  console.log("\nAll 2K Courtside GCP services provisioned ✓");
}

main().catch((e) => {
  console.error("Setup failed:", e);
  process.exit(1);
});
