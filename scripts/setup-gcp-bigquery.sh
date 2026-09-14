#!/usr/bin/env bash
set -e

# GCP BigQuery Setup Script for EA Engagement Intelligence Engine (01-audiences)
PROJECT_ID="${GCP_PROJECT_ID:-jamie-bq-test}"
DATASET_ID="${BQ_DATASET_ID:-abk_marketing_intelligence}"
LOCATION="${BQ_LOCATION:-US}"

echo "============================================================"
echo "🚀 Initializing Google Cloud BigQuery Setup"
echo "Project:   ${PROJECT_ID}"
echo "Dataset:   ${DATASET_ID}"
echo "Location:  ${LOCATION}"
echo "============================================================"

# Create dataset if not exists
if ! bq show --dataset "${PROJECT_ID}:${DATASET_ID}" >/dev/null 2>&1; then
  echo "⚡ Creating BigQuery dataset '${PROJECT_ID}:${DATASET_ID}'..."
  bq --location="${LOCATION}" mk --dataset "${PROJECT_ID}:${DATASET_ID}"
else
  echo "✅ BigQuery dataset '${DATASET_ID}' already exists."
fi

# Create Telemetry Table
echo "⚡ Creating table 'fct_player_telemetry_events'..."
bq query --use_legacy_sql=false --project_id="${PROJECT_ID}" "
CREATE TABLE IF NOT EXISTS \`${PROJECT_ID}.${DATASET_ID}.fct_player_telemetry_events\` (
  event_id STRING NOT NULL,
  player_id STRING NOT NULL,
  game_id STRING NOT NULL,
  session_id STRING NOT NULL,
  event_timestamp TIMESTAMP NOT NULL,
  event_type STRING NOT NULL, -- 'MATCH_COMPLETE', 'PURCHASE', 'RAGE_QUIT', 'SQUAD_JOIN', 'TIER_UNLOCK'
  match_outcome STRING,       -- 'VICTORY', 'DEFEAT', 'CRUSHING_LOSS', 'STALEMATE'
  loss_streak_count INT64,
  session_duration_minutes FLOAT64,
  frustration_score FLOAT64,
  tilt_index FLOAT64,
  spend_amount_usd FLOAT64,
  dma_code INT64,
  metro_name STRING,
  metadata_json JSON
)
PARTITION BY DATE(event_timestamp)
CLUSTER BY player_id, game_id, event_type;
"

# Create Resolved Player Identity Graph table
echo "⚡ Creating table 'fct_player_identity_graph'..."
bq query --use_legacy_sql=false --project_id="${PROJECT_ID}" "
CREATE TABLE IF NOT EXISTS \`${PROJECT_ID}.${DATASET_ID}.fct_player_identity_graph\` (
  player_id STRING NOT NULL,
  display_name STRING NOT NULL,
  primary_archetype STRING NOT NULL,
  churn_risk_score FLOAT64,
  tilt_sensitivity FLOAT64,
  lifetime_spend_usd FLOAT64,
  total_play_hours FLOAT64,
  franchises_played ARRAY<STRING>,
  linked_identities ARRAY<STRUCT<platform STRING, handle STRING, confidence_score FLOAT64>>,
  active_clan_id STRING,
  active_clan_name STRING,
  dma_code INT64,
  metro_name STRING,
  last_active_at TIMESTAMP
)
CLUSTER BY primary_archetype, player_id;
"

# Create Marketing Offer Conversions table
echo "⚡ Creating table 'fct_marketing_conversions'..."
bq query --use_legacy_sql=false --project_id="${PROJECT_ID}" "
CREATE TABLE IF NOT EXISTS \`${PROJECT_ID}.${DATASET_ID}.fct_marketing_conversions\` (
  conversion_id STRING NOT NULL,
  player_id STRING NOT NULL,
  offer_id STRING NOT NULL,
  offer_title STRING NOT NULL,
  trigger_reason STRING NOT NULL,
  triggered_at TIMESTAMP NOT NULL,
  converted_at TIMESTAMP,
  conversion_status STRING NOT NULL, -- 'CONVERTED', 'EXPIRED', 'DISMISSED'
  revenue_usd FLOAT64,
  deepsona_predicted_lift FLOAT64
)
PARTITION BY DATE(triggered_at)
CLUSTER BY offer_id, conversion_status;
"

echo "✅ BigQuery tables verified and created successfully!"
