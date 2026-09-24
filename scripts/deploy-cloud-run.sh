#!/usr/bin/env bash
set -e

PROJECT_ID="${GCP_PROJECT_ID:-jamie-bq-test}"
SERVICE_NAME="${1:-abk-audiences-command-center}"
REGION="${GCP_REGION:-us-central1}"
IMAGE_TAG="us-central1-docker.pkg.dev/${PROJECT_ID}/abk-audiences-repo/${SERVICE_NAME}:latest"

echo "============================================================"
echo "🚀 Building and Deploying ABK Audiences Engine to Cloud Run"
echo "Project:  ${PROJECT_ID}"
echo "Service:  ${SERVICE_NAME}"
echo "Region:   ${REGION}"
echo "Image:    ${IMAGE_TAG}"
echo "============================================================"

# Ensure artifact registry repo exists
gcloud artifacts repositories describe abk-audiences-repo --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1 || \
gcloud artifacts repositories create abk-audiences-repo \
  --repository-format=docker \
  --location="${REGION}" \
  --description="Docker repository for ABK Audiences Intelligence Engine" \
  --project="${PROJECT_ID}"

# Build container with Google Cloud Build
echo "⚡ Submitting build to Cloud Build..."
gcloud builds submit --tag "${IMAGE_TAG}" --project="${PROJECT_ID}"

# Deploy to Cloud Run
echo "⚡ Deploying service to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image="${IMAGE_TAG}" \
  --platform=managed \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --allow-unauthenticated \
  --set-env-vars="GCP_PROJECT_ID=${PROJECT_ID},GCP_REGION=${REGION},SPANNER_INSTANCE_ID=${SPANNER_INSTANCE_ID:-blackrock-spanner},SPANNER_DATABASE_ID=${SPANNER_DATABASE_ID:-abk_graph_db},BQ_DATASET_ID=${BQ_DATASET_ID:-abk_marketing_intelligence},VERTEX_MODEL=gemini-2.5-flash-lite,VERTEX_GROUNDED_MODEL=gemini-2.5-flash,EMBEDDING_MODEL=text-embedding-004,NEXT_TELEMETRY_DISABLED=1" \
  --memory=2Gi \
  --cpu=2 \
  --min-instances=1 \
  --max-instances=10

echo "✅ Cloud Run deployment complete!"
URL=$(gcloud run services describe "${SERVICE_NAME}" --platform=managed --region="${REGION}" --project="${PROJECT_ID}" --format="value(status.url)")
echo "🌐 Live URL: ${URL}"
