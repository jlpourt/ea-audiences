#!/usr/bin/env bash
set -e

# Deployment script for the ABK Engagement Intelligence Engine (01-audiences) to Google Cloud Run
PROJECT_ID="${GCP_PROJECT_ID:-jamie-bq-test}"
SERVICE_NAME="abk-audiences-command-center"
REGION="${GCP_REGION:-us-central1}"
IMAGE_TAG="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"

echo "============================================================"
echo "🚀 Building and Deploying to Google Cloud Run"
echo "Project:  ${PROJECT_ID}"
echo "Service:  ${SERVICE_NAME}"
echo "Region:   ${REGION}"
echo "Image:    ${IMAGE_TAG}"
echo "============================================================"

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
  --set-env-vars="GCP_PROJECT_ID=${PROJECT_ID},GCP_REGION=${REGION},SPANNER_INSTANCE_ID=${SPANNER_INSTANCE_ID:-blackrock-spanner},SPANNER_DATABASE_ID=${SPANNER_DATABASE_ID:-abk_graph_db},BQ_DATASET_ID=${BQ_DATASET_ID:-abk_marketing_intelligence}" \
  --memory=2Gi \
  --cpu=2 \
  --min-instances=1 \
  --max-instances=10

echo "✅ Cloud Run deployment complete!"
gcloud run services describe "${SERVICE_NAME}" --platform=managed --region="${REGION}" --project="${PROJECT_ID}" --format="value(status.url)"
