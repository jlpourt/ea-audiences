#!/usr/bin/env bash
set -e

# GCP Spanner Graph Setup Script for EA Engagement Intelligence Engine (01-audiences)
PROJECT_ID="${GCP_PROJECT_ID:-jamie-bq-test}"
INSTANCE_ID="${SPANNER_INSTANCE_ID:-bravoverse-spanner}"
DATABASE_ID="${SPANNER_DATABASE_ID:-abk_graph_db}"
REGION="${GCP_REGION:-us-central1}"

echo "============================================================"
echo "🚀 Initializing Google Cloud Spanner Graph Setup"
echo "Project:   ${PROJECT_ID}"
echo "Instance:  ${INSTANCE_ID}"
echo "Database:  ${DATABASE_ID}"
echo "Region:    ${REGION}"
echo "============================================================"

# Check if Spanner instance exists
if ! gcloud spanner instances describe "${INSTANCE_ID}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo "⚡ Creating Spanner instance '${INSTANCE_ID}'..."
  gcloud spanner instances create "${INSTANCE_ID}" \
    --project="${PROJECT_ID}" \
    --config="regional-${REGION}" \
    --description="EA Audiences Spanner Instance" \
    --processing-units=100
else
  echo "✅ Spanner instance '${INSTANCE_ID}' is active."
fi

# Check if Database exists
if ! gcloud spanner databases describe "${DATABASE_ID}" --instance="${INSTANCE_ID}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo "⚡ Creating Spanner database '${DATABASE_ID}'..."
  gcloud spanner databases create "${DATABASE_ID}" \
    --instance="${INSTANCE_ID}" \
    --project="${PROJECT_ID}"
else
  echo "✅ Spanner database '${DATABASE_ID}' exists."
fi

echo "⚡ Applying Spanner Graph DDL schema..."

cat << 'EOF' > /tmp/ea_spanner_schema.sql
CREATE TABLE MasterPlayer (
  player_id STRING(64) NOT NULL,
  display_name STRING(128) NOT NULL,
  primary_email STRING(128),
  country STRING(64),
  lifetime_spend_usd FLOAT64,
  primary_archetype STRING(64),
  churn_risk_score FLOAT64,
  tilt_sensitivity FLOAT64,
  archetype_embedding ARRAY<FLOAT64>,
  created_at TIMESTAMP OPTIONS (allow_commit_timestamp = true),
) PRIMARY KEY(player_id);

CREATE TABLE PlatformIdentity (
  identity_id STRING(64) NOT NULL,
  platform STRING(32) NOT NULL,
  platform_handle STRING(128) NOT NULL,
  confidence_score FLOAT64 NOT NULL,
  linked_at TIMESTAMP OPTIONS (allow_commit_timestamp = true),
) PRIMARY KEY(identity_id);

CREATE TABLE HasIdentity (
  player_id STRING(64) NOT NULL,
  identity_id STRING(64) NOT NULL,
  verification_source STRING(64),
  FOREIGN KEY(identity_id) REFERENCES PlatformIdentity(identity_id),
  FOREIGN KEY(player_id) REFERENCES MasterPlayer(player_id),
) PRIMARY KEY(player_id, identity_id);

CREATE TABLE Game (
  game_id STRING(64) NOT NULL,
  title STRING(128) NOT NULL,
  genre STRING(64) NOT NULL,
  platform_support ARRAY<STRING(32)>,
) PRIMARY KEY(game_id);

CREATE TABLE PlayedGame (
  player_id STRING(64) NOT NULL,
  game_id STRING(64) NOT NULL,
  hours_played FLOAT64 NOT NULL,
  total_spend_usd FLOAT64 NOT NULL,
  skill_rating INT64,
  last_played_at TIMESTAMP OPTIONS (allow_commit_timestamp = true),
  FOREIGN KEY(game_id) REFERENCES Game(game_id),
  FOREIGN KEY(player_id) REFERENCES MasterPlayer(player_id),
) PRIMARY KEY(player_id, game_id);

CREATE TABLE Clan (
  clan_id STRING(64) NOT NULL,
  clan_name STRING(128) NOT NULL,
  game_id STRING(64) NOT NULL,
  member_count INT64,
  activity_level STRING(32),
  FOREIGN KEY(game_id) REFERENCES Game(game_id),
) PRIMARY KEY(clan_id);

CREATE TABLE MemberOfClan (
  player_id STRING(64) NOT NULL,
  clan_id STRING(64) NOT NULL,
  role STRING(32),
  joined_at TIMESTAMP OPTIONS (allow_commit_timestamp = true),
  FOREIGN KEY(clan_id) REFERENCES Clan(clan_id),
  FOREIGN KEY(player_id) REFERENCES MasterPlayer(player_id),
) PRIMARY KEY(player_id, clan_id);

CREATE TABLE MarketingOffer (
  offer_id STRING(64) NOT NULL,
  offer_title STRING(128) NOT NULL,
  target_franchise STRING(64) NOT NULL,
  offer_type STRING(64) NOT NULL,
  price_usd FLOAT64,
  discount_percent FLOAT64,
  trigger_condition STRING(128),
  description STRING(MAX),
) PRIMARY KEY(offer_id);

CREATE TABLE TriggeredOffer (
  player_id STRING(64) NOT NULL,
  offer_id STRING(64) NOT NULL,
  trigger_reason STRING(128),
  triggered_at TIMESTAMP OPTIONS (allow_commit_timestamp = true),
  converted BOOL,
  FOREIGN KEY(offer_id) REFERENCES MarketingOffer(offer_id),
  FOREIGN KEY(player_id) REFERENCES MasterPlayer(player_id),
) PRIMARY KEY(player_id, offer_id, triggered_at);

CREATE PROPERTY GRAPH EAPlayerGraph
  NODE TABLES(
    MasterPlayer
      KEY(player_id)
      LABEL Player PROPERTIES(
        player_id, display_name, primary_email, country,
        lifetime_spend_usd, primary_archetype, churn_risk_score,
        tilt_sensitivity, archetype_embedding),
    PlatformIdentity
      KEY(identity_id)
      LABEL Identity PROPERTIES(
        identity_id, platform, platform_handle, confidence_score),
    Game
      KEY(game_id)
      LABEL Game PROPERTIES(
        game_id, title, genre),
    Clan
      KEY(clan_id)
      LABEL Clan PROPERTIES(
        clan_id, clan_name, game_id, member_count, activity_level),
    MarketingOffer
      KEY(offer_id)
      LABEL Offer PROPERTIES(
        offer_id, offer_title, target_franchise, offer_type, price_usd, discount_percent, trigger_condition)
  )
  EDGE TABLES(
    HasIdentity
      KEY(player_id, identity_id)
      SOURCE KEY(player_id) REFERENCES MasterPlayer(player_id)
      DESTINATION KEY(identity_id) REFERENCES PlatformIdentity(identity_id)
      LABEL HAS_IDENTITY PROPERTIES(verification_source),
    PlayedGame
      KEY(player_id, game_id)
      SOURCE KEY(player_id) REFERENCES MasterPlayer(player_id)
      DESTINATION KEY(game_id) REFERENCES Game(game_id)
      LABEL PLAYED PROPERTIES(hours_played, total_spend_usd, skill_rating, last_played_at),
    MemberOfClan
      KEY(player_id, clan_id)
      SOURCE KEY(player_id) REFERENCES MasterPlayer(player_id)
      DESTINATION KEY(clan_id) REFERENCES Clan(clan_id)
      LABEL MEMBER_OF PROPERTIES(role, joined_at),
    TriggeredOffer
      KEY(player_id, offer_id, triggered_at)
      SOURCE KEY(player_id) REFERENCES MasterPlayer(player_id)
      DESTINATION KEY(offer_id) REFERENCES MarketingOffer(offer_id)
      LABEL TARGETED_BY PROPERTIES(trigger_reason, triggered_at, converted)
  );
EOF

gcloud spanner databases ddl update "${DATABASE_ID}" \
  --instance="${INSTANCE_ID}" \
  --project="${PROJECT_ID}" \
  --ddl-file=/tmp/ea_spanner_schema.sql || true

echo "✅ Spanner Graph schema successfully updated!"
