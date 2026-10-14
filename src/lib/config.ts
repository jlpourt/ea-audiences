/**
 * Google Cloud and application configuration with sensible fallbacks.
 *
 * Every value can be overridden from `.env.local`; the defaults point at the
 * live 2K Courtside resources in `jamie-bq-test`. Auth is Application Default
 * Credentials — there is deliberately no key or secret here.
 */

export const GCP_CONFIG = {
  projectId: process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "jamie-bq-test",
  region: process.env.GCP_REGION || "us-central1",
  // Cloud Spanner Graph — the Take-Two identity graph (property graph TakeTwoPlayerGraph).
  spannerInstanceId: process.env.SPANNER_INSTANCE_ID || "blackrock-spanner",
  spannerDatabaseId: process.env.SPANNER_DATABASE_ID || "twok_graph_db",
  // BigQuery — telemetry warehouse, saved audiences, activation log.
  bqDatasetId: process.env.BQ_DATASET_ID || "twok_marketing_intelligence",
  // Cloud Storage — generated creative (images, announcer VO, music beds).
  gcsBucketName: process.env.GCS_BUCKET_NAME || "twok-courtside-media-jamie-bq-test",
  // Pub/Sub — activation events published on hold-to-approve.
  pubsubTopic: process.env.PUBSUB_TOPIC || "twok-courtside-activations",
  // Model ids are consolidated in `src/lib/models.ts`; these remain as
  // aligned defaults for modules reading `GCP_CONFIG`.
  vertexModel: process.env.VERTEX_MODEL || "gemini-3.8-flash",
  // Google Search grounding requires a model that supports the `googleSearch`
  // tool. Kept separate from `vertexModel` so tuning the fast structured-output
  // model cannot silently disable grounding.
  vertexGroundedModel: process.env.VERTEX_GROUNDED_MODEL || "gemini-3.8-flash",
  embeddingModel: process.env.EMBEDDING_MODEL || "gemini-embedding-001",
  adkAgentServiceUrl: process.env.ADK_AGENT_SERVICE_URL || "http://localhost:8080",
};
