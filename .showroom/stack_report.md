# 2K Courtside — Google Cloud Stack Currency Audit (`.showroom/stack_report.md`)

**Repository**: `/Users/jlpourt/CCAI/ea-audiences` (`2k-miro` branch — **2K Courtside: Audience Intelligence Engine**)
**Target GCP Project**: `jamie-bq-test` (`global` + `us-central1`)
**Audit Date**: `2026-10-13`
**Auditor**: `stack-currency` (Showroom Google Cloud Technical Architecture Subagent)

> [!IMPORTANT]
> **Executive Summary (`2k-miro` Branch Audit)**: The `2k-miro` branch represents a major architectural leap forward, raising the Stack Currency score from **8.0 / 10 → 9.4 / 10** (`stack_scanner.py` preliminary automated scan: **10.0 / 10**, `0` deprecated refs, `0` outdated refs across 38 model references and 61 SDK/service references).
>
> **Key Upgrades Verified on `2k-miro`**:
> 1. **Tiered Multi-Model `N=100` Social Contagion Swarm ([focus-group-eval.ts:201-741](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L201-L741), [stream/route.ts:105-359](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/synthetic/focus-group/stream/route.ts#L105-L359))**:
>    - **Round 1 Core Personas (`N=20`)**: 20 concurrent `MODELS.FAST` (`gemini-3.5-flash` on `global`) evaluations with `thinkingBudget: 0` (translated to `thinkingConfig: { thinkingLevel: "MINIMAL" }` by [`thinkingConfigFor()`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/genai-client.ts#L215-L228)).
>    - **Creator Megaphone Broadcasts (`@Agent00`, `@Troydan`, `@DBG`)**: `MODELS.FAST` (`gemini-3.5-flash` on `global`) with strict OpenAPI `responseSchema` grammar enforcement and `thinkingBudget: 0` (`thinkingLevel: "MINIMAL"`).
>    - **Round 2 Social Contagion Pass (`N=20`)**: `MODELS.FAST` (`gemini-3.5-flash` on `global`) modeling Crew Captain (`MEMBER_OF_CLAN`) and Creator (`FOLLOWS_CREATOR`) FOMO/boycott cascades with strict `responseSchema` and `thinkingBudget: 0`.
>    - **4×20 `N=80` Crowd Swarm Micro-Batches**: 4 parallel batches of 20 live Spanner players evaluated on `MODELS.LITE` (`gemini-3.5-flash-lite` on `global`) with `thinkingBudget: 0` (`thinkingLevel: "MINIMAL"`), strict OpenAPI `responseSchema`, and live `swarm_batch` SSE streaming.
> 2. **All Prior Audit Blockers Resolved**:
>    - [config.ts:27](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/config.ts#L27) upgraded `vertexGroundedModel` from `gemini-2.5-flash` to `gemini-3.5-flash`.
>    - [models.ts:29,64,153](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/models.ts#L29) renamed the `"gemini-pro"` TypeScript union tag to `"gemini-3-pro"`, and the unused `@deprecated` `src/lib/gcp/vertex-client.ts` shim was deleted.
>    - [agents/pyproject.toml:11-12](file:///Users/jlpourt/CCAI/ea-audiences/agents/pyproject.toml#L11-L12) and [agents/requirements.txt:4-5](file:///Users/jlpourt/CCAI/ea-audiences/agents/requirements.txt#L4-L5) now declare `google-adk>=1.0.0` and `google-genai>=1.16.0` (legacy `google-cloud-aiplatform` removed), and [focus_group_agent.py:51](file:///Users/jlpourt/CCAI/ea-audiences/agents/app/sub_agents/focus_group_agent.py#L51) routes `gemini-3.5-flash` to `location="global"` with zero data fallback blocks.
>
> **Remaining Opportunities to Reach 10.0 / 10**:
> 1. **Upgrade `MODELS.IMAGE` (`src/lib/models.ts:88`)**: `gemini-2.5-flash-image` (`us-central1`) can be upgraded to GA `gemini-3.1-flash-image` (`global`) for sharper MyTEAM pack typography.
> 2. **Role & Schema Alignment (`src/lib/focus-group-eval.ts:218,701`, `README.md:27,37`)**: `synthesizeConsensus()` populates `reasoning_model_used` (and `README.md:37` attributes Consensus & NL→GQL to `REASONING` / `gemini-3.1-pro-preview`), but the code calls `role: "FAST"` (`gemini-3.5-flash`) without an OpenAPI `schema` object. Also `README.md:27` says "Next.js 16 App Router" while `package.json:25` runs `next: "^14.2.24"`.
> 3. **Prune Unused `package.json` Dependencies**: `clsx`, `tailwind-merge`, and `three-spritetext` have zero imports across `src/` and `scripts/`.

---

## 1. Current Stack Inventory Table

| Component / Category | Found in Repo (File:Line) | Current Identifier / Version | Status (CURRENT / OUTDATED / DEPRECATED / MISSING) | Checked Date & Source URL |
| :--- | :--- | :--- | :--- | :--- |
| **Reasoning Model (`REASONING`)** | [models.ts:60-65](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/models.ts#L60-L65), [brief/route.ts:75-80](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/campaign/brief/route.ts#L75-L80), [brief-audio/route.ts:30-35](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/creative/brief-audio/route.ts#L30-L35), [interrogate/route.ts:39-45](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/synthetic/focus-group/interrogate/route.ts#L39-L45) | `gemini-3.1-pro-preview` (`global`) | **CURRENT** (`[Preview]`) | `2026-10-13` · [Vertex AI Models](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/models#preview-gemini-models) |
| **Fast Structured Model (`FAST`)** | [models.ts:66-71](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/models.ts#L66-L71), [focus-group-eval.ts:218,280,387,701](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L218), [nl-query/route.ts:386-394](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/audiences/nl-query/route.ts#L386-L394), [core-finding/route.ts:94-103](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/insights/core-finding/route.ts#L94-L103), [journey/summary/route.ts:336-346](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/marketing/journey/summary/route.ts#L336-L346) | `gemini-3.5-flash` (`global`, `thinkingBudget: 0` → `thinkingLevel: "MINIMAL"`) | **CURRENT** (`[GA]`; `gemini-3.8-flash` also `[GA]`) | `2026-10-13` · [Gemini 3.5 Flash](https://cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-5-flash) |
| **Low-Latency Swarm Model (`LITE`)** | [models.ts:72-77](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/models.ts#L72-L77), [focus-group-eval.ts:523-557](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L523-L557), [voice/route.ts:24-29](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/creative/voice/route.ts#L24-L29), [reddit-pulse/route.ts:93-97](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/social/reddit-pulse/route.ts#L93-L97) | `gemini-3.5-flash-lite` (`global`, 4×20 `N=80` Crowd Swarm batches + `responseSchema`) | **CURRENT** (`[GA Featured]`) | `2026-10-13` · [Gemini 3.5 Flash-Lite](https://cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-5-flash-lite) |
| **Search Grounded Model (`GROUNDED`)** | [models.ts:81-86](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/models.ts#L81-L86), [config.ts:27](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/config.ts#L27), [genai-client.ts:679-733](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/genai-client.ts#L679-L733), [reddit-pulse/route.ts:55-58](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/social/reddit-pulse/route.ts#L55-L58) | `gemini-3.5-flash` + `googleSearch` (`global`) | **CURRENT** (`[GA]`) | `2026-10-13` · [Vertex AI Search Grounding](https://cloud.google.com/vertex-ai/generative-ai/docs/grounding/grounding-with-google-search) |
| **Image Generation (`IMAGE`)** | [models.ts:87-92](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/models.ts#L87-L92), [genai-client.ts:422-461](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/genai-client.ts#L422-L461), [image/route.ts:23-26](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/creative/image/route.ts#L23-L26) | `gemini-2.5-flash-image` (`us-central1`) | **CURRENT / UPGRADEABLE** (`[GA]`; `gemini-3.1-flash-image` is newer `[GA]`) | `2026-10-13` · [Gemini 3.1 Flash Image](https://cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-1-flash-image) |
| **Speech Synthesis (`TTS`)** | [models.ts:93-98](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/models.ts#L93-L98), [genai-client.ts:515-550](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/genai-client.ts#L515-L550), [voice/route.ts:34-38](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/creative/voice/route.ts#L34-L38), [brief-audio/route.ts:38-42](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/creative/brief-audio/route.ts#L38-L42) | `gemini-3.1-flash-tts-preview` (`us-central1`, 24kHz PCM→WAV) | **CURRENT** (`[Preview]`; `gemini-3.8-flash-tts` also `[Preview]`) | `2026-10-13` · [Gemini TTS Models](https://cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-8-flash-tts) |
| **Music Generation (`MUSIC`)** | [models.ts:99-104](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/models.ts#L99-L104), [genai-client.ts:568-604](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/genai-client.ts#L568-L604), [music/route.ts:24-26](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/creative/music/route.ts#L24-L26) | `lyria-002` (`us-central1` `:predict` REST) | **CURRENT** (`[GA]`; `lyria-3-pro-preview` in `[Preview]`) | `2026-10-13` · [Lyria 2 Docs](https://cloud.google.com/gemini-enterprise-agent-platform/models/lyria/lyria-002) |
| **Text Embedding (`EMBED`)** | [models.ts:105-115](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/models.ts#L105-L115), [genai-client.ts:610-632](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/genai-client.ts#L610-L632), [lookalike/route.ts:41-58](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/audiences/lookalike/route.ts#L41-L58) | `gemini-embedding-001` (`us-central1`, `3072`-d) | **CURRENT** (`[GA]`) | `2026-10-13` · [Vertex AI Embeddings](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/models#embeddings-models) |
| **Unified GenAI SDK (Node.js)** | [package.json:17](file:///Users/jlpourt/CCAI/ea-audiences/package.json#L17), [genai-client.ts:15-55](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/genai-client.ts#L15-L55) | `@google/genai` `^2.27.0` (`vertexai: true`, IPv4-first DNS + retry) | **CURRENT** (`[GA]`) | `2026-10-13` · [Google GenAI Libraries](https://cloud.google.com/gemini-enterprise-agent-platform/models/start/libraries) |
| **Cloud Spanner Graph (`TakeTwoPlayerGraph`)** | [package.json:15](file:///Users/jlpourt/CCAI/ea-audiences/package.json#L15), [spanner-client.ts:7,93-133,275-449](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/spanner-client.ts#L7) | `@google-cloud/spanner` `^7.18.0` (`7.21.0` resolved), ISO GQL & `GRAPH_TABLE` | **CURRENT** (`[GA]`, `blackrock-spanner/twok_graph_db`) | `2026-10-13` · [Spanner Graph Overview](https://cloud.google.com/spanner/docs/graph/overview) |
| **BigQuery (`twok_marketing_intelligence`)** | [package.json:13](file:///Users/jlpourt/CCAI/ea-audiences/package.json#L13), [bigquery-client.ts:1-158](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/bigquery-client.ts#L1-L158), [health/services/route.ts:14-41](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/health/services/route.ts#L14-L41) | `@google-cloud/bigquery` `^7.9.2` (`7.9.4` resolved), `saved_audiences` & `activation_log` | **CURRENT** (`[GA]`) | `2026-10-13` · [BigQuery Client Libraries](https://cloud.google.com/bigquery/docs/reference/libraries) |
| **Cloud Pub/Sub (`twok-courtside-activations`)** | [package.json:14](file:///Users/jlpourt/CCAI/ea-audiences/package.json#L14), [pubsub-client.ts:13-165](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/pubsub-client.ts#L13-L165), [dispatch/route.ts:47-58](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/activation/dispatch/route.ts#L47-L58) | `@google-cloud/pubsub` `^5.1.0` | **CURRENT** (`[GA]`) | `2026-10-13` · [Pub/Sub Client Libraries](https://cloud.google.com/pubsub/docs/reference/libraries) |
| **Cloud Storage (`twok-courtside-media-jamie-bq-test`)** | [package.json:16](file:///Users/jlpourt/CCAI/ea-audiences/package.json#L16), [storage-client.ts:15-164](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/storage-client.ts#L15-L164) | `@google-cloud/storage` `^7.15.0` | **CURRENT** (`[GA]`) | `2026-10-13` · [Cloud Storage Node.js](https://cloud.google.com/storage/docs/reference/libraries) |
| **Agent2Agent (A2A) Protocol SDK** | [package.json:12](file:///Users/jlpourt/CCAI/ea-audiences/package.json#L12), [official-server.ts:1-5,115-234](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/a2a/official-server.ts#L1-L5), [a2a/route.ts:1-105](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/a2a/route.ts#L1-L105) | `@a2a-js/sdk` `^1.0.1` (JSON-RPC 2.0 `tasks/send`, `agents/getCard`) | **CURRENT** (`[GA]`) | `2026-10-13` · [Google ADK & A2A Docs](https://google.github.io/adk-docs/) |
| **Python ADK & GenAI Fleet (`agents/`)** | [agents/pyproject.toml:11-15](file:///Users/jlpourt/CCAI/ea-audiences/agents/pyproject.toml#L11-L15), [agents/requirements.txt:4-8](file:///Users/jlpourt/CCAI/ea-audiences/agents/requirements.txt#L4-L8), [focus_group_agent.py:44-57](file:///Users/jlpourt/CCAI/ea-audiences/agents/app/sub_agents/focus_group_agent.py#L44-L57) | `google-adk>=1.0.0`, `google-genai>=1.16.0`, `gemini-3.5-flash` (`global`) | **CURRENT** (`[GA]`) | `2026-10-13` · [Google ADK Docs](https://google.github.io/adk-docs/) |
| **Cloud Run Deployment & Container** | [Dockerfile:1-40](file:///Users/jlpourt/CCAI/ea-audiences/Dockerfile#L1-L40), [deploy_cloud_run.py:229-265](file:///Users/jlpourt/CCAI/ea-audiences/scripts/deploy_cloud_run.py#L229-L265) | Cloud Run v2 REST (`node:20-alpine`, `cpuIdle: False`, `minInstanceCount: 1`) | **CURRENT** (`[GA]`) | `2026-10-13` · [Cloud Run v2 API](https://cloud.google.com/run/docs/reference/rest/v2/projects.locations.services) |
| **Unused Frontend Packages** | [package.json:20,30,32](file:///Users/jlpourt/CCAI/ea-audiences/package.json#L20), [next.config.js:45](file:///Users/jlpourt/CCAI/ea-audiences/next.config.js#L45) | `clsx` (`^2.1.1`), `tailwind-merge` (`^2.6.0`), `three-spritetext` (`^1.8.2`) | **OUTDATED / UNUSED** (0 imports in `src/` or `scripts/`) | `2026-10-13` · Repo static import scan |

---

## 2. Deep-Dive Audit of `2k-miro` Architecture & Ready-to-Apply Upgrade Diffs

### 2.1 How `2k-miro` Orchestrates Vertex AI, Spanner Graph, BigQuery, Pub/Sub & Cloud Storage
- **Multi-Location `@google/genai` Client Pool ([genai-client.ts:46-55](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/genai-client.ts#L46-L55))**: Maintains one `GoogleGenAI({ vertexai: true, project, location })` singleton per Vertex AI location (`global` for Gemini 3.x models; `us-central1` for `gemini-2.5-flash-image`, `gemini-3.1-flash-tts-preview`, `lyria-002`, and `gemini-embedding-001`). Includes IPv4-first DNS resolution ([genai-client.ts:27](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/genai-client.ts#L27)) and transient network/429/503 retry ([genai-client.ts:108-138](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/genai-client.ts#L108-L138)).
- **Gemini 3.x Thinking Budget Translation ([genai-client.ts:215-228](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/genai-client.ts#L215-L228))**: `thinkingConfigFor()` automatically translates numeric `thinkingBudget: 0` into `{ thinkingLevel: "MINIMAL" }` for Gemini 3.x models (`/^gemini-3(\.\d+)?-/i`), preventing reasoning tokens from exhausting `maxOutputTokens` on high-concurrency JSON calls.
- **2-Round Social Contagion & Tiered `N=100` Swarm ([focus-group-eval.ts:83-741](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L83-L741), [stream/route.ts:68-358](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/synthetic/focus-group/stream/route.ts#L68-L358))**:
  1. Hydrates up to 100 live players and 48 Crews from `TakeTwoPlayerGraph` via parallel `GRAPH_TABLE` queries ([focus-group-eval.ts:88-96](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L88-L96)).
  2. Streams 20 parallel Round 1 Core Persona verdicts on `MODELS.FAST` (`gemini-3.5-flash`, `thinkingBudget: 0`).
  3. Generates 3 Creator Megaphone broadcasts (`@Agent00`, `@Troydan`, `@DBG`) on `MODELS.FAST` with OpenAPI `responseSchema` ([focus-group-eval.ts:286-307](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L286-L307)).
  4. Runs Round 2 Social Contagion (`MODELS.FAST` + `responseSchema`, [focus-group-eval.ts:394-422](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L394-L422)) concurrently with 4 parallel micro-batches of 20 Crowd Swarm agents (`N=80`) on `MODELS.LITE` (`gemini-3.5-flash-lite` + `responseSchema` + `thinkingBudget: 0`, [focus-group-eval.ts:523-557](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L523-L557)).
- **Cloud Spanner Graph (`TakeTwoPlayerGraph`, [spanner-client.ts:275-631](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/spanner-client.ts#L275-L631))**: Executes 6 parallel ISO GQL queries per cohort resolution (player projection, distinct counts/averages, archetype/country/franchise histograms, and 2-hop/3-hop bridge nodes across `MEMBER_OF_CLAN`, `HAS_IDENTITY`, `PLAYS_GAME`, and `FOLLOWS_CREATOR`).
- **BigQuery + Pub/Sub + Cloud Storage**:
  - `saveAudience()` and `logActivation()` stream rows to `jamie-bq-test.twok_marketing_intelligence.saved_audiences` and `activation_log` ([bigquery-client.ts:34-117](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/bigquery-client.ts#L34-L117)).
  - `publishActivation()` validates and publishes 64KB-capped activation envelopes to `twok-courtside-activations` on Cloud Pub/Sub ([pubsub-client.ts:101-128](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/pubsub-client.ts#L101-L128)).
  - `uploadMedia()` persists generated PNG key art and 24kHz RIFF/WAV audio to `gs://twok-courtside-media-jamie-bq-test/{images,audio,music,briefs}/<uuid>` ([storage-client.ts:102-135](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/storage-client.ts#L102-L135)).

---

### Fix 2.2: Upgrade `MODELS.IMAGE` from `gemini-2.5-flash-image` to `gemini-3.1-flash-image` (`[GA]`)
- **Finding ([src/lib/models.ts:87-92](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/models.ts#L87-L92))**: `MODELS.IMAGE` is the only remaining Gemini 2.5 model in `src/lib/models.ts`. Per live Vertex AI documentation ([Gemini 3.1 Flash Image](https://cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-1-flash-image), checked `2026-10-13`), `gemini-3.1-flash-image` (Nano Banana 2) is **Generally Available (`[GA]`)** and provides cleaner text rendering on NBA 2K27 MyTEAM pack foil titles and streetwear emblems.

```diff
--- a/src/lib/models.ts
+++ b/src/lib/models.ts
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
```

---

### Fix 2.3: Add `responseSchema` to `synthesizeConsensus` & Replace Hardcoded Model Fallback Strings with `MODELS` Constants
- **Finding ([src/lib/focus-group-eval.ts:208,501,701-707](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L701-L707), [src/lib/config.ts:23-28](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/config.ts#L23-L28))**:
  1. `generateCreatorBroadcasts()`, `evaluateContagionRound2()`, and `evaluateCrowdSwarm80()` all enforce OpenAPI `schema` grammar, whereas `synthesizeConsensus()` (`src/lib/focus-group-eval.ts:701-707`) uses `json: true` without `schema`. Adding `schema` guarantees `wtp_curve` and `migration_curve` never fail JSON validation during live stage runs.
  2. `src/lib/focus-group-eval.ts:208,501`, `src/app/api/synthetic/focus-group/stream/route.ts:112-113`, `src/app/api/audiences/nl-query/route.ts:377`, and `src/lib/config.ts:23-28` initialize local string literals (`"gemini-3.5-flash"`, `"gemini-3.5-flash-lite"`) instead of importing `MODELS.FAST.id` / `MODELS.LITE.id`.
  3. `README.md:27,37` states `Next.js 16 App Router` (actual: `next ^14.2.24`) and attributes NL→GQL and Focus Group consensus to `REASONING` (`gemini-3.1-pro-preview`), whereas both call `MODELS.FAST` (`gemini-3.5-flash`) with `thinkingBudget: 0` for sub-2s live EBC responsiveness.

```diff
--- a/src/lib/config.ts
+++ b/src/lib/config.ts
@@ -6,6 +6,7 @@
  * Credentials — there is deliberately no key or secret here.
  */
+import { MODELS } from "./models";
 
 export const GCP_CONFIG = {
   projectId: process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "jamie-bq-test",
@@ -20,11 +21,8 @@
   // Pub/Sub — activation events published on hold-to-approve.
   pubsubTopic: process.env.PUBSUB_TOPIC || "twok-courtside-activations",
-  // Model ids are being consolidated into `src/lib/models.ts` by the
-  // AI-Platform lane; these remain as fallbacks until that import lands.
-  vertexModel: process.env.VERTEX_MODEL || "gemini-3.5-flash",
-  // Google Search grounding requires a model that supports the `googleSearch`
-  // tool. Kept separate from `vertexModel` so tuning the fast structured-output
-  // model cannot silently disable grounding.
-  vertexGroundedModel: process.env.VERTEX_GROUNDED_MODEL || "gemini-3.5-flash",
-  embeddingModel: process.env.EMBEDDING_MODEL || "gemini-embedding-001",
+  vertexModel: process.env.VERTEX_MODEL || MODELS.FAST.id,
+  vertexGroundedModel: process.env.VERTEX_GROUNDED_MODEL || MODELS.GROUNDED.id,
+  embeddingModel: process.env.EMBEDDING_MODEL || MODELS.EMBED.id,
   adkAgentServiceUrl: process.env.ADK_AGENT_SERVICE_URL || "http://localhost:8080",
 };
```

---

### Fix 2.4: Remove Unused Dependencies from `package.json` and `next.config.js`
- **Finding ([package.json:20,30,32](file:///Users/jlpourt/CCAI/ea-audiences/package.json#L20), [next.config.js:45](file:///Users/jlpourt/CCAI/ea-audiences/next.config.js#L45))**: `clsx`, `tailwind-merge`, and `three-spritetext` have zero imports anywhere in `src/` or `scripts/`. Removing them trims the Cloud Build / Docker layer footprint.

```diff
--- a/package.json
+++ b/package.json
@@ -17,7 +17,6 @@
     "@google/genai": "^2.27.0",
     "@types/d3-geo": "^3.1.1",
     "@types/topojson-client": "^3.1.5",
-    "clsx": "^2.1.1",
     "d3-geo": "^3.1.1",
     "framer-motion": "^11.18.2",
     "google-auth-library": "^10.5.0",
@@ -27,9 +26,7 @@
     "react-dom": "^18.3.1",
     "react-force-graph-2d": "^1.25.7",
     "react-force-graph-3d": "^1.24.4",
-    "tailwind-merge": "^2.6.0",
     "three": "^0.160.0",
-    "three-spritetext": "^1.8.2",
     "topojson-client": "^3.1.0",
     "world-atlas": "^2.0.2"
   },
```

```diff
--- a/next.config.js
+++ b/next.config.js
@@ -42,7 +42,7 @@
   reactStrictMode: true,
   output: "standalone",
   poweredByHeader: false,
-  transpilePackages: ["three", "react-force-graph-2d", "react-force-graph-3d", "three-spritetext"],
+  transpilePackages: ["three", "react-force-graph-2d", "react-force-graph-3d"],
   experimental: {
     serverComponentsExternalPackages: [
```

---

## 3. High-Impact Newer GCP Capabilities (Strengthening the Hero Moment)

Per Showroom guardrails, we recommend **only 3 high-leverage capabilities** that directly strengthen 2K Courtside's Hero Moment (multi-hop Spanner Graph cohort resolution → `N=100` 2-Round Social Contagion Focus Group → multimodal Creative Studio & Pub/Sub activation):

### 1. Native Spanner Graph Vector Search (`COSINE_DISTANCE` / `APPROX_COSINE_DISTANCE`) for Lookalike Expansion — **`[GA]`**
- **Checked Date & Doc**: `2026-10-13` · [Use vector search with Spanner Graph](https://cloud.google.com/spanner/docs/graph/perform-vector-similarity-search)
- **Current Implementation**: In [src/app/api/audiences/lookalike/route.ts:24-64](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/audiences/lookalike/route.ts#L24-L64), lookalike expansion fetches 60 candidate rows from Spanner, embeds the seed query and archetype descriptions via `gemini-embedding-001` (`3,072`-d), and computes cosine similarity in Node.js memory (`cosine(seedVec, vectors[idx + 1])`).
- **Why It Strengthens the Demo**: Storing the `3,072`-d `gemini-embedding-001` vector directly on the `Players` node table in `twok_graph_db` allows a **single combined Spanner Graph GQL + KNN/ANN query** (`GRAPH TakeTwoPlayerGraph MATCH (p:Player)-[:HAS_IDENTITY]->(:Identity {platform: '2K Account'}) RETURN p.player_id, COSINE_DISTANCE(p.profile_embedding, @seed_embedding) AS dist ORDER BY dist ASC LIMIT 50`). When Take-Two's data engineering leadership inspects the GQL drawer, they see Spanner executing property-graph traversal + vector similarity in one engine.

### 2. Upgrade Creative Studio Pack Art to `gemini-3.1-flash-image` (Nano Banana 2) — **`[GA]`**
- **Checked Date & Doc**: `2026-10-13` · [Gemini 3.1 Flash Image (Nano Banana 2)](https://cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-1-flash-image)
- **Current Implementation**: [src/lib/models.ts:88](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/models.ts#L88) calls `gemini-2.5-flash-image` (`us-central1`) for MyTEAM Galaxy Opal pack art and Crew Re-Up promos.
- **Why It Strengthens the Demo**: `gemini-3.1-flash-image` is **Generally Available (`[GA]`)** on Vertex AI (`global`), delivering markedly sharper in-image typography on pack banners (`"GALAXY OPAL DELUXE PACK"`, `"15,000 VC CREW RE-UP"`), multi-turn conversational image editing, and SynthID / C2PA provenance. Because [genai-client.ts:438-445](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/genai-client.ts#L438-L445) already uses `generateContent` with `responseModalities: ["IMAGE", "TEXT"]`, upgrading is a 3-line swap in `src/lib/models.ts`.

### 3. BigQuery Continuous Queries (`EXPORT DATA` to Pub/Sub / Spanner) for Sub-Second Slump & Cliff Triggers — **`[GA]`**
- **Checked Date & Doc**: `2026-10-13` · [Introduction to BigQuery Continuous Queries](https://cloud.google.com/bigquery/docs/continuous-queries-introduction)
- **Current Implementation**: Situational triggers ([src/app/api/simulation/triggers/route.ts:75-98](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/simulation/triggers/route.ts#L75-L98)) poll `TelemetryEvents` via `SELECT ... ORDER BY t.event_timestamp DESC LIMIT 120`, and Pub/Sub (`twok-courtside-activations`) fires when the operator holds to approve.
- **Why It Strengthens the Demo**: BigQuery Continuous Queries (`[GA]`) execute streaming SQL over incoming `twok_marketing_intelligence.telemetry_events` and natively `EXPORT DATA` directly to Cloud Pub/Sub (`twok-courtside-activations`) or Cloud Spanner as soon as a player hits `consecutive_losses >= 3 AND tilt_index >= 0.75` in The City, optionally invoking `AI.GENERATE` in-stream. Surfacing a live Continuous Query pipeline alongside Hold-to-Approve shows how 2K scales from executive campaign validation to autonomous, real-time live-ops intervention.

---

## 4. Stack Currency Score: **9.4 / 10**

| Scoring Dimension | Max Points | Awarded | Rationale |
| :--- | :---: | :---: | :--- |
| **1. Model Currency** | 3.0 | **2.8** | Exemplary multi-tier Gemini 3.x & generative media lineup in [`src/lib/models.ts`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/models.ts): `gemini-3.1-pro-preview` (`REASONING`), `gemini-3.5-flash` (`FAST` & `GROUNDED`), `gemini-3.5-flash-lite` (`LITE` for 4×20 `N=80` Crowd Swarm batches), `gemini-3.1-flash-tts-preview` (`TTS`), `lyria-002` (`MUSIC`), and `gemini-embedding-001` (`EMBED`), verified via `/api/health/models` and `scripts/smoke_models.mjs`. Deducted **0.2 pts** because `MODELS.IMAGE` still uses `gemini-2.5-flash-image` while `gemini-3.1-flash-image` is `[GA]`. |
| **2. SDK Modernity (`@google/genai`, ADK, A2A)** | 3.0 | **2.8** | Uses unified `@google/genai` `^2.27.0` (`vertexai: true`, ADC auth, `thinkingLevel: "MINIMAL"` translation, OpenAPI `responseSchema` enforcement on Creator Broadcasts, Round 2 Contagion, and 4×20 Swarm batches), `@a2a-js/sdk` `^1.0.1` JSON-RPC 2.0, and Python `google-adk>=1.0.0` + `google-genai>=1.16.0` on `global`. Deducted **0.2 pts** for missing `responseSchema` on `synthesizeConsensus()` / `evaluatePersonas()` and minor unused packages (`clsx`, `tailwind-merge`, `three-spritetext`) in `package.json`. |
| **3. Native GCP Data & Compute Integration** | 2.0 | **1.8** | 100% live execution against Cloud Spanner Graph (`TakeTwoPlayerGraph` ISO GQL & `GRAPH_TABLE`), BigQuery (`twok_marketing_intelligence`), Cloud Pub/Sub (`twok-courtside-activations`), Cloud Storage (`twok-courtside-media-jamie-bq-test`), and Cloud Run v2 (`minInstanceCount: 1`, `cpuIdle: False`) with zero data fallbacks. Deducted **0.2 pts** for in-memory JS cosine similarity in `/api/audiences/lookalike` instead of native Spanner `COSINE_DISTANCE()`. |
| **4. Zero Deprecated Endpoints** | 2.0 | **2.0** | Zero deprecated Gemini 1.0/1.5 models, zero legacy `@google-cloud/vertexai` or `google-cloud-aiplatform` packages, and `stack_scanner.py` reports `deprecatedCount: 0, outdatedCount: 0`. |
| **TOTAL STACK CURRENCY SCORE** | **10.0** | **9.4 / 10** | **Production-grade, EBC-ready Google Cloud & Vertex AI architecture (`+1.4` pts vs. prior audit). Reaches 10.0 / 10 with `gemini-3.1-flash-image` and Spanner Graph `COSINE_DISTANCE()`.** |
