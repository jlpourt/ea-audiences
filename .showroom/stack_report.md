# 2K Courtside — Google Cloud Stack Currency Audit (`.showroom/stack_report.md`)

**Repository**: `/Users/jlpourt/CCAI/ea-audiences` (`2K Courtside — Audience Builder & Segmentation Engine`)
**Target GCP Project**: `jamie-bq-test` (`us-central1` + `global`)
**Audit Date**: `2026-10-12`
**Auditor**: `stack-currency` (Showroom Google Cloud Technical Architecture Subagent)

> [!IMPORTANT]
> **Executive Summary**: The Next.js TypeScript backend (`src/lib/models.ts`, `src/lib/gcp/genai-client.ts`, `src/lib/gcp/spanner-client.ts`) is **modern and well-architected**, running the unified `@google/genai` (`^2.27.0`) SDK against Vertex AI (`global` and `us-central1`), live Cloud Spanner Graph (`TakeTwoPlayerGraph` ISO GQL), BigQuery (`twok_marketing_intelligence`), Cloud Storage, Cloud Pub/Sub, and the official `@a2a-js/sdk` (`^1.0.1`) JSON-RPC 2.0 protocol.
>
> However, **five currency & consistency issues** prevent a 10/10 score:
> 1. **Legacy Config Drift (`src/lib/config.ts:27`)**: `vertexGroundedModel` still defaults to `"gemini-2.5-flash"` even though `src/lib/models.ts:81-86` upgraded `MODELS.GROUNDED` to `"gemini-3.5-flash"` (`global`).
> 2. **Image Model Generation Behind (`src/lib/models.ts:88`)**: `MODELS.IMAGE` uses `gemini-2.5-flash-image`, whereas `gemini-3.1-flash-image` (Nano Banana 2) is now **GA** on Vertex AI with superior in-image typography and character consistency for NBA 2K27 MyTEAM pack art.
> 3. **Hand-Rolled Python Agents Claiming ADK (`agents/`)**: `agents/pyproject.toml` and `agents/app/fast_api_app.py` claim to be a Google Agent Development Kit (ADK) fleet, but **`google-adk` is missing from dependencies**, `google-cloud-aiplatform>=1.44.0` is still listed, and `agents/app/sub_agents/focus_group_agent.py:53` routes `gemini-3.5-flash` to `us-central1` instead of `global`.
> 4. **Deprecated Shim & Type Enum False Positive**: `src/lib/gcp/vertex-client.ts` is an unused `@deprecated` shim with zero callers, and `src/lib/models.ts:29,64,153` uses the legacy string `"gemini-pro"` as a TypeScript `ModelFamily` literal (triggering static deprecation scanners).
> 5. **Data Fallback Branches (`agents/app/**`, `src/lib/focus-group-eval.ts`)**: `try/except` blocks fall back to local `data/*.json` or canned persona verdicts on error, violating `GEMINI.md` Rule 1.

---

## 1. Current Stack Inventory Table

| Component / Category | Found in Repo (File:Line) | Current Identifier / Version | Status (CURRENT / OUTDATED / DEPRECATED / MISSING) | Checked Date & Source URL |
| :--- | :--- | :--- | :--- | :--- |
| **Reasoning Model (`REASONING`)** | [models.ts:60-65](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/models.ts#L60-L65), [brief/route.ts:78-83](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/campaign/brief/route.ts#L78-L83), [interrogate/route.ts:39-45](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/synthetic/focus-group/interrogate/route.ts#L39-L45) | `gemini-3.1-pro-preview` (`global`) | **CURRENT** (`[Preview]`) | `2026-10-12` · [Vertex AI Models](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/models#preview-gemini-models) |
| **Fast Structured Model (`FAST`)** | [models.ts:66-71](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/models.ts#L66-L71), [nl-query/route.ts:288-296](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/audiences/nl-query/route.ts#L288-L296), [focus-group-eval.ts:37-43](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L37-L43) | `gemini-3.5-flash` (`global`) | **CURRENT** (`[GA]`; `gemini-3.8-flash` also `[GA]`) | `2026-10-12` · [Gemini 3.5 Flash](https://cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-5-flash) |
| **Low-Latency Model (`LITE`)** | [models.ts:72-77](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/models.ts#L72-L77), [voice/route.ts:24-29](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/creative/voice/route.ts#L24-L29), [reddit-pulse/route.ts:93-97](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/social/reddit-pulse/route.ts#L93-L97) | `gemini-3.5-flash-lite` (`global`) | **CURRENT** (`[GA Featured]`) | `2026-10-12` · [Gemini 3.5 Flash-Lite](https://cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-5-flash-lite) |
| **Search Grounded Model (`GROUNDED`)** | [models.ts:81-86](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/models.ts#L81-L86), [genai-client.ts:666-720](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/genai-client.ts#L666-L720) | `gemini-3.5-flash` + `googleSearch` (`global`) | **CURRENT** (`[GA]`) | `2026-10-12` · [Vertex AI Search Grounding](https://cloud.google.com/vertex-ai/generative-ai/docs/grounding/grounding-with-google-search) |
| **Legacy Grounded Config Fallback** | [config.ts:27](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/config.ts#L27) | `gemini-2.5-flash` (`vertexGroundedModel`) | **OUTDATED** (Conflicts with `MODELS.GROUNDED`) | `2026-10-12` · [Vertex AI Models](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/models#generally-available-gemini-models) |
| **Image Generation (`IMAGE`)** | [models.ts:87-92](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/models.ts#L87-L92), [CreativeStudioPanel.tsx:37](file:///Users/jlpourt/CCAI/ea-audiences/src/components/creative/CreativeStudioPanel.tsx#L37), [image/route.ts:23-26](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/creative/image/route.ts#L23-L26) | `gemini-2.5-flash-image` (`us-central1`) | **OUTDATED** (`gemini-3.1-flash-image` is `[GA]`) | `2026-10-12` · [Gemini 3.1 Flash Image](https://cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-1-flash-image) |
| **Speech Synthesis (`TTS`)** | [models.ts:93-98](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/models.ts#L93-L98), [genai-client.ts:502-537](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/genai-client.ts#L502-L537), [CreativeStudioPanel.tsx:47](file:///Users/jlpourt/CCAI/ea-audiences/src/components/creative/CreativeStudioPanel.tsx#L47) | `gemini-3.1-flash-tts-preview` (`us-central1`) | **CURRENT** (`[Preview]`; `gemini-3.8-flash-tts` also `[Preview]`) | `2026-10-12` · [Gemini 3.8 Flash TTS](https://cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-8-flash-tts) |
| **Music Generation (`MUSIC`)** | [models.ts:99-104](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/models.ts#L99-L104), [genai-client.ts:555-591](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/genai-client.ts#L555-L591), [music/route.ts:24-26](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/creative/music/route.ts#L24-L26) | `lyria-002` (`us-central1` `:predict` REST) | **CURRENT** (`[GA]`; `lyria-3-pro-preview` in `[Preview]`) | `2026-10-12` · [Lyria Models](https://cloud.google.com/gemini-enterprise-agent-platform/models/lyria/lyria-002) |
| **Text Embedding (`EMBED`)** | [models.ts:105-115](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/models.ts#L105-L115), [lookalike/route.ts:41-58](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/audiences/lookalike/route.ts#L41-L58) | `gemini-embedding-001` (`us-central1`, 3072-d) | **CURRENT** (`[GA]`) | `2026-10-12` · [Vertex AI Embeddings](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/models#embeddings-models) |
| **TypeScript `ModelFamily` Tag** | [models.ts:29,64,153](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/models.ts#L29) | `"gemini-pro"` (TS union label) | **DEPRECATED** (Scanner false positive; rename to `"gemini-3-pro"`) | `2026-10-12` · [Model Lifecycle](https://cloud.google.com/gemini-enterprise-agent-platform/models/model-versions) |
| **Unified GenAI SDK (Node.js)** | [package.json:17](file:///Users/jlpourt/CCAI/ea-audiences/package.json#L17), [genai-client.ts:14-47](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/genai-client.ts#L14-L47) | `@google/genai` `^2.27.0` (`vertexai: true`) | **CURRENT** (`[GA]`) | `2026-10-12` · [Google GenAI SDK](https://cloud.google.com/gemini-enterprise-agent-platform/models/start/libraries) |
| **Deprecated Vertex Shim** | [vertex-client.ts:1-41](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/vertex-client.ts#L1-L41) | `@deprecated` wrapper (`generateVertexContent`) | **DEPRECATED** (0 callers in `src/`; delete file) | `2026-10-12` · [Google GenAI SDK](https://cloud.google.com/gemini-enterprise-agent-platform/models/start/libraries) |
| **Cloud Spanner Graph SDK** | [package.json:15](file:///Users/jlpourt/CCAI/ea-audiences/package.json#L15), [spanner-client.ts:7,125-133](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/spanner-client.ts#L7) | `@google-cloud/spanner` `^7.18.0` (`7.21.0`) | **CURRENT** (`[GA]`, ISO GQL `TakeTwoPlayerGraph`) | `2026-10-12` · [Spanner Graph Overview](https://cloud.google.com/spanner/docs/graph/overview) |
| **BigQuery SDK** | [package.json:13](file:///Users/jlpourt/CCAI/ea-audiences/package.json#L13), [bigquery-client.ts:1-25](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/bigquery-client.ts#L1-L25) | `@google-cloud/bigquery` `^7.9.2` (`7.9.4`) | **CURRENT** (`[GA]`) | `2026-10-12` · [BigQuery Client Libraries](https://cloud.google.com/bigquery/docs/reference/libraries) |
| **Cloud Storage SDK** | [package.json:16](file:///Users/jlpourt/CCAI/ea-audiences/package.json#L16), [storage-client.ts:15,42-47](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/storage-client.ts#L15) | `@google-cloud/storage` `^7.15.0` | **CURRENT** (`[GA]`) | `2026-10-12` · [Cloud Storage Node.js](https://cloud.google.com/storage/docs/reference/libraries) |
| **Cloud Pub/Sub SDK** | [package.json:14](file:///Users/jlpourt/CCAI/ea-audiences/package.json#L14), [pubsub-client.ts:13,54-57](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/pubsub-client.ts#L13) | `@google-cloud/pubsub` `^5.1.0` | **CURRENT** (`[GA]`) | `2026-10-12` · [Pub/Sub Client Libraries](https://cloud.google.com/pubsub/docs/reference/libraries) |
| **Agent2Agent (A2A) JS SDK** | [package.json:12](file:///Users/jlpourt/CCAI/ea-audiences/package.json#L12), [official-server.ts:1-5](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/a2a/official-server.ts#L1-L5) | `@a2a-js/sdk` `^1.0.1` (JSON-RPC 2.0) | **CURRENT** (`[GA]`) | `2026-10-12` · [Google ADK & A2A Docs](https://google.github.io/adk-docs/) |
| **Google ADK (Python Fleet)** | [agents/pyproject.toml:7-20](file:///Users/jlpourt/CCAI/ea-audiences/agents/pyproject.toml#L7-L20), [agents/requirements.txt:1-12](file:///Users/jlpourt/CCAI/ea-audiences/agents/requirements.txt#L1-L12), [agents/app/agent.py:21-35](file:///Users/jlpourt/CCAI/ea-audiences/agents/app/agent.py#L21-L35) | Hand-rolled Python classes + `google-cloud-aiplatform>=1.44.0` | **MISSING / OUTDATED** (`google-adk` missing; `focus_group_agent.py:53` uses `us-central1` for `gemini-3.5-flash`) | `2026-10-12` · [Agent Development Kit (ADK)](https://google.github.io/adk-docs/) |
| **Cloud Run Runtime** | [Dockerfile:1-40](file:///Users/jlpourt/CCAI/ea-audiences/Dockerfile#L1-L40), [deploy_cloud_run.py:229-265](file:///Users/jlpourt/CCAI/ea-audiences/scripts/deploy_cloud_run.py#L229-L265) | Cloud Run v2 REST API (`node:20-alpine`, `cpuIdle: False`, `minInstanceCount: 1`) | **CURRENT** (`[GA]`) | `2026-10-12` · [Cloud Run v2 API](https://cloud.google.com/run/docs/reference/rest/v2/projects.locations.services) |

---

## 2. Deprecations, Inconsistencies & Upgrade Paths (with Ready-to-Apply Code Diffs)

### Fix 2.1: Upgrade `MODELS.IMAGE` to `gemini-3.1-flash-image` (`[GA]`) and Rename `"gemini-pro"` Family Literal in `src/lib/models.ts`
- **Why**:
  1. `src/lib/models.ts:29,64,153` uses `"gemini-pro"` as a TypeScript `ModelFamily` union string, which trips automated deprecation scanners looking for the retired Gemini 1.0 `gemini-pro` model ID.
  2. `src/lib/models.ts:88` and `src/components/creative/CreativeStudioPanel.tsx:37` still point `IMAGE` to `gemini-2.5-flash-image`. Per live Vertex AI documentation (`https://cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-1-flash-image`, checked `2026-10-12`), `gemini-3.1-flash-image` (Nano Banana 2) is **Generally Available (`[GA]`)** and delivers markedly sharper badge/jersey typography and character consistency for NBA 2K27 MyTEAM Galaxy Opal pack art.

```diff
--- a/src/lib/models.ts
+++ b/src/lib/models.ts
@@ -26,7 +26,7 @@
 export type ModelLocation = "global" | "us-central1";
 
 export type ModelFamily =
-  | "gemini-pro"
+  | "gemini-3-pro"
   | "gemini-flash"
   | "gemini-flash-lite"
   | "gemini-image"
@@ -61,7 +61,7 @@
     id: "gemini-3.1-pro-preview",
     location: "global",
     label: "Gemini 3.1 Pro",
-    family: "gemini-pro",
+    family: "gemini-3-pro",
   }),
   FAST: withEnvOverride("FAST", {
     id: "gemini-3.5-flash",
@@ -85,9 +85,9 @@
     family: "gemini-flash",
   }),
   IMAGE: withEnvOverride("IMAGE", {
-    id: "gemini-2.5-flash-image",
-    location: "us-central1",
-    label: "Gemini 2.5 Flash Image",
+    id: "gemini-3.1-flash-image",
+    location: "global",
+    label: "Gemini 3.1 Flash Image",
     family: "gemini-image",
   }),
   TTS: withEnvOverride("TTS", {
@@ -150,7 +150,7 @@
     family: roleOrId.includes("lite")
       ? "gemini-flash-lite"
       : roleOrId.includes("pro")
-        ? "gemini-pro"
+        ? "gemini-3-pro"
         : "gemini-flash",
   };
 }
```

```diff
--- a/src/components/creative/CreativeStudioPanel.tsx
+++ b/src/components/creative/CreativeStudioPanel.tsx
@@ -34,7 +34,7 @@
 }: CreativeStudioPanelProps) {
   const [artStyle, setArtStyle] = useState<ArtStyle>("myteam-pack");
   const [artUrl, setArtUrl] = useState<string | null>(null);
-  const [artModelUsed, setArtModelUsed] = useState<string>("gemini-2.5-flash-image");
+  const [artModelUsed, setArtModelUsed] = useState<string>("gemini-3.1-flash-image");
   const [artLatency, setArtLatency] = useState<number | null>(null);
   const [artLoading, setArtLoading] = useState(false);
   const [artError, setArtError] = useState<string | null>(null);
```

### Fix 2.2: Align `src/lib/config.ts` with `src/lib/models.ts` (Remove Outdated `gemini-2.5-flash` Default)
- **Why**: `src/lib/config.ts:27` still sets `vertexGroundedModel: process.env.VERTEX_GROUNDED_MODEL || "gemini-2.5-flash"`, contradicting `src/lib/models.ts:81-86` (`MODELS.GROUNDED.id = "gemini-3.5-flash"`). Referencing `MODELS` directly eliminates duplicate model ID strings across config files.

```diff
--- a/src/lib/config.ts
+++ b/src/lib/config.ts
@@ -6,6 +6,8 @@
  * Credentials — there is deliberately no key or secret here.
  */
+import { MODELS } from "./models";
 
 export const GCP_CONFIG = {
   projectId: process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "jamie-bq-test",
@@ -18,13 +20,8 @@
   gcsBucketName: process.env.GCS_BUCKET_NAME || "twok-courtside-media-jamie-bq-test",
   // Pub/Sub — activation events published on hold-to-approve.
   pubsubTopic: process.env.PUBSUB_TOPIC || "twok-courtside-activations",
-  // Model ids are being consolidated into `src/lib/models.ts` by the
-  // AI-Platform lane; these remain as fallbacks until that import lands.
-  vertexModel: process.env.VERTEX_MODEL || "gemini-3.5-flash",
-  // Google Search grounding requires a model that supports the `googleSearch`
-  // tool. Kept separate from `vertexModel` so tuning the fast structured-output
-  // model cannot silently disable grounding.
-  vertexGroundedModel: process.env.VERTEX_GROUNDED_MODEL || "gemini-2.5-flash",
-  embeddingModel: process.env.EMBEDDING_MODEL || "gemini-embedding-001",
+  vertexModel: process.env.VERTEX_MODEL || MODELS.FAST.id,
+  vertexGroundedModel: process.env.VERTEX_GROUNDED_MODEL || MODELS.GROUNDED.id,
+  embeddingModel: process.env.EMBEDDING_MODEL || MODELS.EMBED.id,
   adkAgentServiceUrl: process.env.ADK_AGENT_SERVICE_URL || "http://localhost:8080",
 };
```

### Fix 2.3: Delete Unused `@deprecated` Compatibility Shim `src/lib/gcp/vertex-client.ts`
- **Why**: `src/lib/gcp/vertex-client.ts:1-41` states *"it will be deleted once no imports remain"*. A full repository scan confirms **zero files** import `vertex-client.ts`. Leaving it in `src/lib/gcp/` risks accidental re-introduction of untyped model calls that strip `modelUsed` badges.

```diff
--- a/src/lib/gcp/vertex-client.ts
+++ /dev/null
@@ -1,41 +0,0 @@
-/**
- * @deprecated Compatibility shim...
- */
```

### Fix 2.4: Upgrade Python Agent Dependencies (`google-adk`, `google-genai>=1.10.0`) & Fix `global` Endpoint Routing in `agents/`
- **Why**:
  1. `agents/pyproject.toml:11-15` and `agents/requirements.txt:4-8` omit `google-adk`, pin an outdated lower bound `google-genai>=0.1.1`, and retain legacy `google-cloud-aiplatform>=1.44.0`.
  2. `agents/app/sub_agents/focus_group_agent.py:53` sets `location = os.getenv("GEMINI_LOCATION", "us-central1")` for `model_name = "gemini-3.5-flash"`. Because `gemini-3.5-flash` is served from Vertex AI `global`, calling it on `us-central1` fails and triggers the prohibited static fallback on line 148.

```diff
--- a/agents/requirements.txt
+++ b/agents/requirements.txt
@@ -1,11 +1,11 @@
 fastapi>=0.110.0
 uvicorn[standard]>=0.28.0
 pydantic>=2.6.0
-google-genai>=0.1.1
+google-adk>=1.0.0
+google-genai>=1.10.0
 google-cloud-spanner>=3.40.0
 google-cloud-bigquery>=3.18.0
 google-cloud-storage>=2.14.0
-google-cloud-aiplatform>=1.44.0
 numpy>=1.26.0
 scipy>=1.12.0
 requests>=2.31.0
```

```diff
--- a/agents/pyproject.toml
+++ b/agents/pyproject.toml
@@ -8,11 +8,11 @@
 dependencies = [
     "fastapi>=0.110.0",
     "uvicorn[standard]>=0.28.0",
     "pydantic>=2.6.0",
-    "google-genai>=0.1.1",
+    "google-adk>=1.0.0",
+    "google-genai>=1.10.0",
     "google-cloud-spanner>=3.40.0",
     "google-cloud-bigquery>=3.18.0",
     "google-cloud-storage>=2.14.0",
-    "google-cloud-aiplatform>=1.44.0",
     "numpy>=1.26.0",
     "scipy>=1.12.0",
```

```diff
--- a/agents/app/sub_agents/focus_group_agent.py
+++ b/agents/app/sub_agents/focus_group_agent.py
@@ -50,7 +50,7 @@
       from google import genai
       api_key = os.getenv("GEMINI_API_KEY")
       project_id = os.getenv("GCP_PROJECT_ID", "jamie-bq-test")
-      location = os.getenv("GEMINI_LOCATION", "us-central1")
+      location = os.getenv("GEMINI_LOCATION", "global")
 
       if api_key:
         self.client = genai.Client(api_key=api_key)
```

---

## 3. High-Impact Newer GCP Capabilities (Strengthening the Hero Moment)

Per Showroom guardrails, we recommend **only 3 high-leverage capabilities** that directly elevate 2K Courtside's Hero Moment (live multi-hop Spanner Graph segmentation → 20-persona Courtside Focus Group pressure test → multimodal creative & Pub/Sub activation):

### 1. Native Spanner Graph Vector Search (`COSINE_DISTANCE` / `APPROX_COSINE_DISTANCE`) for Lookalike Expansion — **`[GA]`**
- **Checked Date & Doc**: `2026-10-12` · [Use vector search with Spanner Graph](https://cloud.google.com/spanner/docs/graph/perform-vector-similarity-search)
- **Current Gap**: In [src/app/api/audiences/lookalike/route.ts:24-64](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/audiences/lookalike/route.ts#L24-L64), lookalike expansion pulls 60 players sorted by spend, embeds the 10 archetype descriptions on the fly in Node.js via `gemini-embedding-001`, and computes cosine similarity in JavaScript memory (`cosine(seedVec, vectors[idx + 1])`).
- **Why It Strengthens the Demo**: Storing the 3,072-d `gemini-embedding-001` vector directly on the `Players` node table in `twok_graph_db` allows a **single combined Spanner Graph GQL + KNN query** (`GRAPH TakeTwoPlayerGraph MATCH (p:Player)-[:HAS_IDENTITY]->(:Identity {platform: 'Rockstar Social Club'}) RETURN p.player_id, COSINE_DISTANCE(p.profile_embedding, @seed_embedding) AS dist ORDER BY dist ASC LIMIT 50`). When Take-Two's Principal Data Architect inspects the GQL drawer, they see Spanner executing graph traversal + vector similarity in one engine rather than application-layer array math.

### 2. Upgrade Creative Studio Pack Art to `gemini-3.1-flash-image` (Nano Banana 2) — **`[GA]`**
- **Checked Date & Doc**: `2026-10-12` · [Gemini 3.1 Flash Image (Nano Banana 2)](https://cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-1-flash-image)
- **Current Gap**: [src/lib/models.ts:88](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/models.ts#L88) uses `gemini-2.5-flash-image` for MyTEAM Galaxy Opal pack art and Crew Re-Up promos.
- **Why It Strengthens the Demo**: `gemini-3.1-flash-image` is now **GA** on Vertex AI (`global`), offering substantially cleaner text rendering on pack titles (`"GALAXY OPAL DELUXE PACK"`, `"15,000 VC CREW RE-UP"`), multi-turn conversational image editing, and Content Credentials (C2PA) provenance. It is a 1-line model ID swap in `src/lib/models.ts` because `genai-client.ts:409-448` already uses `generateContent` with `responseModalities: ["IMAGE", "TEXT"]`.

### 3. BigQuery Continuous Queries (`EXPORT DATA` to Pub/Sub / Spanner) for Real-Time Defeat-Slump & Loss-Streak Triggers — **`[GA]`**
- **Checked Date & Doc**: `2026-10-12` · [Introduction to BigQuery Continuous Queries](https://cloud.google.com/bigquery/docs/continuous-queries-introduction)
- **Current Gap**: `twok_marketing_intelligence.telemetry_events` in BigQuery is currently queried via batch SQL (`SELECT ... FROM telemetry_events ORDER BY event_timestamp DESC`), while `twok-courtside-activations` Pub/Sub only fires on manual button press.
- **Why It Strengthens the Demo**: BigQuery Continuous Queries (`[GA]`) execute streaming SQL over incoming match telemetry and natively `EXPORT DATA` directly to Cloud Pub/Sub (`twok-courtside-activations`) or Cloud Spanner within milliseconds when a player hits `consecutive_losses >= 3 AND tilt_index >= 0.75` in The City. Showcasing a live Continuous Query DDL alongside the Hold-to-Approve Pub/Sub dispatcher proves how 2K transitions from an executive workbench to an autonomous, sub-second live-ops trigger pipeline.

---

## 4. Stack Currency Score: **8.0 / 10**

| Scoring Dimension | Max Points | Awarded | Rationale |
| :--- | :---: | :---: | :--- |
| **1. Model Currency** | 3.0 | **2.5** | Uses `gemini-3.1-pro-preview`, `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-tts-preview`, `lyria-002`, and `gemini-embedding-001` via a verified registry (`src/lib/models.ts`) and live health probe (`/api/health/models`). Deducted **0.5 pts** for `gemini-2.5-flash-image` (`gemini-3.1-flash-image` is GA) and `src/lib/config.ts:27` referencing `gemini-2.5-flash`. |
| **2. SDK Modernity (`@google/genai`, ADK, A2A)** | 3.0 | **2.2** | Next.js app uses `@google/genai` `^2.27.0` with `vertexai: true` (ADC) and `@a2a-js/sdk` `^1.0.1` JSON-RPC 2.0. Deducted **0.8 pts** because `agents/` claims to be an ADK fleet without `google-adk` installed, retains `google-cloud-aiplatform>=1.44.0`, and routes `gemini-3.5-flash` to `us-central1` in Python. |
| **3. Native GCP Data & Compute Integration** | 2.0 | **1.8** | Live multi-hop ISO GQL on Cloud Spanner Graph (`TakeTwoPlayerGraph`), BigQuery persistence (`saved_audiences`, `activation_log`), GCS media bucket (`twok-courtside-media-jamie-bq-test`), Cloud Pub/Sub (`twok-courtside-activations`), and Cloud Run v2 deployment. Deducted **0.2 pts** for in-memory JS cosine similarity instead of Spanner `COSINE_DISTANCE()` and fallback catches in `agents/app/tools/`. |
| **4. Zero Deprecated Endpoints** | 2.0 | **1.5** | Zero retired Gemini 1.0/1.5 runtime calls in Next.js routes, and `@google-cloud/vertexai` was removed from `package.json`. Deducted **0.5 pts** for the lingering `@deprecated` `src/lib/gcp/vertex-client.ts` shim and `"gemini-pro"` `ModelFamily` string literal in `src/lib/models.ts:29,64,153`. |
| **TOTAL STACK CURRENCY SCORE** | **10.0** | **8.0 / 10** | **Strong modern Vertex AI + Spanner Graph foundation; reaches 9.8/10 once Fixes 2.1–2.4 are applied.** |
