# 2K Courtside — Realness & Demo-Day Reliability Report (`2k-miro`)

- **Repository**: `/Users/jlpourt/CCAI/ea-audiences` (branch: `2k-miro`)
- **Application**: **2K Courtside — Audience Intelligence Engine** (Take-Two Interactive / 2K Games / Visual Concepts)
- **Target GCP Project**: `jamie-bq-test`
  - **Cloud Spanner Graph**: Instance `blackrock-spanner` · Database `twok_graph_db` · Property Graph `TakeTwoPlayerGraph`
  - **BigQuery**: Dataset `jamie-bq-test.twok_marketing_intelligence` (`saved_audiences`, `activation_log`, `telemetry_events`)
  - **Cloud Storage**: Bucket `gs://twok-courtside-media-jamie-bq-test`
  - **Cloud Pub/Sub**: Topic `twok-courtside-activations` · Subscription `twok-courtside-activations-sub`
- **Audit Date**: 2026-10-12
- **Auditor**: `realness-verifier` (`showroom` plugin)

---

## Executive Summary & Scorecard

| Dimension | Score | Verdict | Summary |
| :--- | :---: | :---: | :--- |
| **Realness Score** | **7.6 / 10** | **REAL BACKEND / FRONTEND FALLBACK VIOLATIONS** | All 20 Next.js API routes invoke genuine Google Cloud SDK clients (`@google/genai`, `@google-cloud/spanner`, `@google-cloud/bigquery`, `@google-cloud/storage`, `@google-cloud/pubsub`) and fail loudly with `HTTP 500/502/503`. However, several frontend and synthesis modules violate `GEMINI.md` Rule 1 via hardcoded fallback arrays (`SYNTHETIC_FALLBACK_PERSONAS`, `DEFAULT_DYNAMIC_FINDINGS`, hardcoded `migration_curve` fallback), silent `.catch(() => {})` handlers, and `setTimeout`-driven DAG step animation in `ActivationDAG.tsx`. |
| **Demo-Day Readiness Score** | **6.5 / 10** | **PARTIAL KILL SWITCHES** | Deep health probes exist (`/api/health/spanner`, `/api/health/models`, `/api/health/services`) and Cloud Run sets `minInstanceCount: 1`, but unified `/api/health?deep=1`, `scripts/warm_cache.sh`, and `scripts/reset_state.sh` (`POST /api/reset`) are missing, and synthetic seed data lacks explicit `# SYNTHETIC_EBC_SEED_DATA` code/UI labeling. |

---

## 1. End-to-End Output Traceability Matrix

Every user-visible UI card, chart, search bar, and AI action on the `2k-miro` branch was traced end-to-end (`UI Component -> Frontend Fetch -> Backend Endpoint -> GCP Service/Model Call`).

> **Why `realness_scanner.py` reported `realGcpCallsCount: 5`**: The deterministic scanner (`scripts/realness_scanner.py`) matches Python SDK patterns (`bigquery.Client`, `spanner.Client`, `self.client.models.generate_content`) and counted only the 5 Python calls inside `agents/` and `scripts/`. The primary application backend is written in TypeScript (`src/app/api/**/route.ts` and `src/lib/gcp/*.ts`) and contains **35+ live Google Cloud SDK invocations** across all 20 API routes.

| # | UI Surface / User Action | Frontend Component & Fetch | Backend Endpoint | GCP Service / Model Call (`file:line`) | Verdict |
| :- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Courtside Landing — Live Graph Footer & Cohort Tab Counts** | [`CourtsideLanding.tsx:526`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/landing/CourtsideLanding.tsx#L526) (`GET /api/insights/graph-stats`) | [`/api/insights/graph-stats/route.ts:9-103`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/insights/graph-stats/route.ts#L9-L103) | **Cloud Spanner** (`runSpannerSql` at [`spanner-client.ts:154`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/spanner-client.ts#L154)) querying `Players`, `PlayerIdentities`, `PlayerGameStats`, `MemberOfClan` | **SILENT_FALLBACK** — Route is 100% live Spanner, but UI initializes from hardcoded [`DEFAULT_DYNAMIC_FINDINGS`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/landing/CourtsideLanding.tsx#L177-L473) and swallows errors via `.catch(() => {})` at [`CourtsideLanding.tsx:568-570`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/landing/CourtsideLanding.tsx#L568-L570). |
| **2** | **Dynamic Core Finding Synthesis Endpoint** | *(Unwired on landing page; available at `/api/insights/core-finding`)* | [`/api/insights/core-finding/route.ts:27-328`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/insights/core-finding/route.ts#L27-L328) | **Cloud Spanner** (`runSpannerQuery` at [`route.ts:32-72`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/insights/core-finding/route.ts#L32-L72)) + **Vertex AI** `gemini-3.5-flash` (`generateText({ role: "FAST" })` at [`route.ts:94`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/insights/core-finding/route.ts#L94)) | **PARTIAL_BYPASS** — Route uses live Spanner + `gemini-3.5-flash` on `global`, but [`route.ts:212-308`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/insights/core-finding/route.ts#L212-L308) has hardcoded copy fallbacks if `aiCopy` is missing a category. |
| **3** | **Natural Language Audience Builder & Cohort Search** | [`page.tsx:167`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/page.tsx#L167) (`POST /api/audiences/nl-query`) | [`/api/audiences/nl-query/route.ts:520-733`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/audiences/nl-query/route.ts#L520-L733) | **Vertex AI** `gemini-3.5-flash` (`generateText({ role: "FAST" })` at [`route.ts:386`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/audiences/nl-query/route.ts#L386)) -> **Cloud Spanner Graph** ISO GQL `GRAPH TakeTwoPlayerGraph MATCH ...` (`runSpannerQuery` at [`route.ts:606`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/audiences/nl-query/route.ts#L606)) | **REAL (with Golden Fast-Path)** — Executes live GQL against Spanner (`twok_graph_db`). Note: [`matchGoldenPlay()`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/audiences/nl-query/route.ts#L215-L367) bypasses Gemini for 5 preset queries while still reporting `model_used: "gemini-3.5-flash"` (`translateMs = 12`). |
| **4** | **Full Property Graph Canvas (`Explore Graph`)** | [`page.tsx:249`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/page.tsx#L249) (`GET /api/graph/view`) | [`/api/graph/view/route.ts:13-303`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/graph/view/route.ts#L13-L303) | **Cloud Spanner Graph** (`runSpannerQuery` at [`route.ts:30-86`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/graph/view/route.ts#L30-L86)) + live catalog hydration (`loadCatalog` at [`catalog.ts:74-156`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/catalog.ts#L74-L156)) | **REAL** — 100% live Spanner Graph queries + live catalog; throws HTTP 503 on Spanner failure (`zero fallbacks`). |
| **5** | **3,072-d Lookalike Audience Expansion** | [`AudienceBuilder.tsx`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/audience/AudienceBuilder.tsx) (`POST /api/audiences/lookalike`) | [`/api/audiences/lookalike/route.ts:9-151`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/audiences/lookalike/route.ts#L9-L151) | **Vertex AI** `gemini-embedding-001` (`embedText` 3,072-d at [`genai-client.ts:610-632`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/genai-client.ts#L610-L632)) + **Cloud Spanner** `COSINE_DISTANCE(p.behavior_embedding_3072, @seedVec)` (`runSpannerSql` at [`route.ts:79-105`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/audiences/lookalike/route.ts#L79-L105)) | **REAL** — Genuine 3,072-d embedding generation + Spanner vector cosine distance search. |
| **6** | **Focus Group — Initial 20-Persona Roster Load** | [`FocusGroupModal.tsx:167`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/focusgroup/FocusGroupModal.tsx#L167) (`GET /api/synthetic/focus-group?limit=20`) | [`/api/synthetic/focus-group/route.ts:19-41`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/synthetic/focus-group/route.ts#L19-L41) | **Cloud Spanner** (`fetchLiveSpannerPersonas` at [`focus-group-eval.ts:83-163`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L83-L163)) | **SILENT_FALLBACK** — Backend queries Spanner, but [`FocusGroupModal.tsx:184`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/focusgroup/FocusGroupModal.tsx#L184) catches errors silently and [`FocusGroupModal.tsx:267`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/focusgroup/FocusGroupModal.tsx#L267) falls back to hardcoded [`SYNTHETIC_FALLBACK_PERSONAS`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/prompts/courtside_personas.ts#L158-L725). |
| **7** | **Focus Group — Round 1 Isolated Persona Evaluation (20 Deep Agents)** | [`FocusGroupModal.tsx:311`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/focusgroup/FocusGroupModal.tsx#L311) (`POST /api/synthetic/focus-group`) | [`/api/synthetic/focus-group/route.ts:95-99`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/synthetic/focus-group/route.ts#L95-L99) -> [`evaluatePersonas`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L190-L236) | **Vertex AI** `gemini-3.5-flash` (`generateStructured({ role: "FAST" })` in 5 parallel batches of 4 personas at [`focus-group-eval.ts:218`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L218)) | **REAL** — Live structured JSON evaluation via `gemini-3.5-flash` on `global`. |
| **8** | **Focus Group — Creator Broadcast Generation (`@Agent00`, `@Troydan`, `@DBG`)** | [`FocusGroupModal.tsx:311`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/focusgroup/FocusGroupModal.tsx#L311) (`POST /api/synthetic/focus-group`) | [`/api/synthetic/focus-group/route.ts:103-108`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/synthetic/focus-group/route.ts#L103-L108) -> [`generateCreatorBroadcasts`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L242-L290) | **Vertex AI** `gemini-3.5-flash` (`generateStructured({ role: "FAST", schema: CREATOR_BROADCAST_SCHEMA })` at [`focus-group-eval.ts:280`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L280)) | **REAL** — Live structured creator takes generated from Round 1 persona reactions. |
| **9** | **Focus Group — Round 2 Social Contagion Re-Evaluation (Crew + Creator Influence)** | [`FocusGroupModal.tsx:311`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/focusgroup/FocusGroupModal.tsx#L311) (`POST /api/synthetic/focus-group`) | [`/api/synthetic/focus-group/route.ts:109-121`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/synthetic/focus-group/route.ts#L109-L121) -> [`evaluateContagionRound2`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L296-L412) | **Vertex AI** `gemini-3.5-flash` (`generateStructured({ role: "FAST", schema: CONTAGION_ROUND2_SCHEMA })` in 5 parallel batches of 4 at [`focus-group-eval.ts:387`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L387)) | **REAL** — Computes genuine Crew peer summaries + creator broadcast impact and re-evaluates all 20 deep personas via `gemini-3.5-flash`. |
| **10** | **Focus Group — Tiered `N=80` Crowd Swarm (`N=100` Total Panel)** | [`FocusGroupModal.tsx:311`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/focusgroup/FocusGroupModal.tsx#L311) (`POST /api/synthetic/focus-group`) | [`/api/synthetic/focus-group/route.ts:109-121`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/synthetic/focus-group/route.ts#L109-L121) -> [`evaluateCrowdSwarm80`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L471-L547) | **Cloud Spanner** (`fetchLiveSpannerPersonas(80)` at [`route.ts:81`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/synthetic/focus-group/route.ts#L81)) + **Vertex AI** `gemini-3.5-flash-lite` (`generateStructured({ role: "LITE", schema: CROWD_SWARM_SCHEMA })` in 4 parallel batches of 20 at [`focus-group-eval.ts:523`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L523)) | **REAL** — Queries up to 80 distinct Spanner players and evaluates them in 4 parallel micro-batches against `gemini-3.5-flash-lite` (`global`). |
| **11** | **Focus Group — Consensus Synthesis & Migration Curve** | [`FocusGroupModal.tsx:311`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/focusgroup/FocusGroupModal.tsx#L311) (`POST /api/synthetic/focus-group`) | [`/api/synthetic/focus-group/route.ts:127-134`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/synthetic/focus-group/route.ts#L127-L134) -> [`synthesizeConsensus`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L593-L741) | **Vertex AI** `gemini-3.5-flash` (`generateText({ role: "FAST", responseMimeType: "application/json" })` at [`focus-group-eval.ts:701`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L701)) | **SILENT_FALLBACK** — Calls live `gemini-3.5-flash` and computes math deterministically from Round 1/2 + Swarm, but [`focus-group-eval.ts:723-735`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L723-L735) falls back to a hardcoded 5-stage `migration_curve` array if omitted by the LLM. |
| **12** | **Focus Group — SSE Streaming Endpoint** | *(Available at `POST /api/synthetic/focus-group/stream`)* | [`/api/synthetic/focus-group/stream/route.ts:30-264`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/synthetic/focus-group/stream/route.ts#L30-L264) | **Cloud Spanner** (`fetchLiveSpannerPersonas(20)`) + **Vertex AI** `gemini-3.5-flash` (`evaluateBatch`, `generateCreatorBroadcasts`, `evaluateContagionRound2`, `synthesizeConsensus`) | **REAL** — Live SSE stream backed by Spanner and `gemini-3.5-flash` (inherits `synthesizeConsensus` `migration_curve` fallback). |
| **13** | **1-on-1 Persona Interrogation Drawer** | [`PersonaInterrogationDrawer.tsx:50`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/focusgroup/PersonaInterrogationDrawer.tsx#L50) (`POST /api/synthetic/focus-group/interrogate`) | [`/api/synthetic/focus-group/interrogate/route.ts:7-63`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/synthetic/focus-group/interrogate/route.ts#L7-L63) | **Vertex AI** `gemini-3.1-pro-preview` (`generateText({ role: "REASONING" })` at [`route.ts:39`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/synthetic/focus-group/interrogate/route.ts#L39)) | **REAL** — Live deep reasoning via `gemini-3.1-pro-preview` on `global`. |
| **14** | **Live Reddit Pulse Card (`r/NBA2K · r/MyTEAM`)** | [`RedditPulseCard.tsx:33`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/focusgroup/RedditPulseCard.tsx#L33) (`POST /api/social/reddit-pulse`) | [`/api/social/reddit-pulse/route.ts:43-147`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/social/reddit-pulse/route.ts#L43-L147) | **Vertex AI** `gemini-3.5-flash` with Google Search Grounding (`generateGrounded` at [`route.ts:55`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/social/reddit-pulse/route.ts#L55)) + `gemini-3.5-flash-lite` (`generateStructured({ role: "LITE" })` at [`route.ts:93`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/social/reddit-pulse/route.ts#L93)) | **REAL** — Enforces non-empty web grounding citations (`genai-client.ts:722-724` throws `GenAIError` if `citations.length === 0`). |
| **15** | **Season 1 -> Season 2 Lifecycle Sankey & Transition Takeaway** | [`SeasonJourneySankey.tsx:128,220`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/journey/SeasonJourneySankey.tsx#L128) (`GET` & `POST /api/marketing/journey/summary`) | [`/api/marketing/journey/summary/route.ts:47-370`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/marketing/journey/summary/route.ts#L47-L370) | **Cloud Spanner** (`runSpannerSql` at [`route.ts:52-79`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/marketing/journey/summary/route.ts#L52-L79)) + **Vertex AI** `gemini-3.5-flash` (`generateText({ role: "FAST" })` at [`route.ts:336`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/marketing/journey/summary/route.ts#L336)) | **REAL** — Queries all 2,850 Spanner players + `PlayerGameStats` + `MemberOfClan` live and synthesizes transition diagnosis via `gemini-3.5-flash`. |
| **16** | **NBA Market Telemetry Geo Map (30 NBA DMAs + 5 Int'l)** | [`NBAMarketMap.tsx:89`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/map/NBAMarketMap.tsx#L89) (`GET /api/marketing/markets`) | [`/api/marketing/markets/route.ts:86-225`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/marketing/markets/route.ts#L86-L225) | **Cloud Spanner** (`runSpannerSql` at [`route.ts:90-121`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/marketing/markets/route.ts#L90-L121)) | **REAL** — Aggregates live Spanner player counts, VC spend, Season 2 cliff risk, and 2K26 holdout counts per DMA. |
| **17** | **Campaign Brief Modal & Grounded Citations** | [`CampaignBriefModal.tsx`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/brief/CampaignBriefModal.tsx) (`POST /api/campaign/brief`) | [`/api/campaign/brief/route.ts:11-114`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/campaign/brief/route.ts#L11-L114) | **Vertex AI** `gemini-3.5-flash` Grounded (`generateGrounded` at [`route.ts:23`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/campaign/brief/route.ts#L23)) + `gemini-3.1-pro-preview` (`generateStructured({ role: "REASONING" })` at [`route.ts:75`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/campaign/brief/route.ts#L75)) | **REAL** — Two-stage grounded search + `gemini-3.1-pro-preview` structured brief synthesis. |
| **18** | **Multimodal Creative Studio (Key Art, Voiceover, Soundtrack, Spoken Brief)** | [`CreativeStudioPanel.tsx:58,113,139`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/creative/CreativeStudioPanel.tsx#L58) & [`CampaignBriefModal.tsx:51`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/brief/CampaignBriefModal.tsx#L51) | [`/api/creative/image`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/creative/image/route.ts), [`/api/creative/voice`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/creative/voice/route.ts), [`/api/creative/music`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/creative/music/route.ts), [`/api/creative/brief-audio`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/creative/brief-audio/route.ts) | **Vertex AI** `gemini-2.5-flash-image` (`generateImage`), `gemini-3.1-flash-tts-preview` (`generateSpeech`), `lyria-002` (`generateMusic`) + **Cloud Storage** (`uploadMediaAndSign` to `gs://twok-courtside-media-jamie-bq-test` at [`storage-client.ts:79-125`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/storage-client.ts#L79-L125)) | **REAL** — Live multimodal generation persisted to GCS with V4 signed URLs. |
| **19** | **Save & List Audiences** | [`SaveAudienceModal.tsx`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/audience/SaveAudienceModal.tsx) & [`page.tsx:107`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/page.tsx#L107) | [`/api/audiences/save/route.ts`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/audiences/save/route.ts) & [`/api/audiences/saved/route.ts`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/audiences/saved/route.ts) | **BigQuery** `twok_marketing_intelligence.saved_audiences` (`insertRow` & `runBqQuery` at [`bigquery-client.ts:27-57`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/bigquery-client.ts#L27-L57)) | **SILENT_FALLBACK (UI)** — Backend is 100% live BigQuery, but [`page.tsx:71`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/page.tsx#L71) initializes `savedAudiencesCount` to `3` and [`page.tsx:114`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/page.tsx#L114) swallows errors via `.catch(() => {})`. |
| **20** | **Activation DAG & Multi-Channel Dispatch (2K Account, Locker Code, In-Game Store)** | [`ActivationDAG.tsx:66-109`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/activation/ActivationDAG.tsx#L66-L109) & [`ActivationFeed.tsx:58,101`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/activation/ActivationFeed.tsx#L58) | [`/api/activation/dispatch/route.ts:9-111`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/activation/dispatch/route.ts#L9-L111), [`/api/activation/log/route.ts`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/activation/log/route.ts), [`/api/a2a/route.ts`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/a2a/route.ts) | **Cloud Pub/Sub** (`publishActivation` to `twok-courtside-activations` at [`pubsub-client.ts:96-119`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/pubsub-client.ts#L96-L119)) + **BigQuery** `activation_log` (`insertRow` at [`dispatch/route.ts:62`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/activation/dispatch/route.ts#L62)) + **Cloud Spanner** (`extractPlayersForA2A` at [`official-server.ts:39-143`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/a2a/official-server.ts#L39-L143)) | **FAKE_LATENCY (UI Step 1-2) / REAL (Step 4-5)** — Step 4 -> 5 publishes a real Pub/Sub message and writes to BigQuery, but Steps 1-2 in [`ActivationDAG.tsx:77-79`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/activation/ActivationDAG.tsx#L77-L79) use `setTimeout` (`600ms`, `1400ms`, `2200ms`) to simulate Brief & Creative Agent progress without calling `/api/campaign/brief` or `/api/creative/*`. |

---

## 2. Triage of Scanner Flags (`fakeOrRiskFlagsCount = 54`) & `GEMINI.md` Rule 1 Audit

The deterministic scanner ([`.showroom/realness_scan_raw.json`](file:///Users/jlpourt/CCAI/ea-audiences/.showroom/realness_scan_raw.json)) raised **54 flags**. Below is the complete forensic separation into **49 False Positives** vs. **5 Scanner-Flagged + 4 Deep-Audit `GEMINI.md` Rule 1 Violations**.

### 2.1 Verified False Positives in `realness_scan_raw.json` (49 of 54 Flags)

1. **`scripts/generate_2k_dataset.py` (38 `UNIFORM_SYNTHETIC_RANDOM` flags, lines 36–711)**:
   - **Why it is a false positive**: This is the offline dataset generator script that seeds Spanner and BigQuery. Inspection of [`scripts/generate_2k_dataset.py:297`](file:///Users/jlpourt/CCAI/ea-audiences/scripts/generate_2k_dataset.py#L297) and [`line 452`](file:///Users/jlpourt/CCAI/ea-audiences/scripts/generate_2k_dataset.py#L452) confirms it uses **Pareto (`random.paretovariate(alpha)`)** for lifetime VC spend and **Gaussian (`random.gauss(5, 2)`)** for rage-quit distributions, while `random.randint`/`random.uniform` are used only to jitter dates, match counts, OVR bounds within archetype tiers, and spherical unit-vector dimensions.
2. **`scripts/deploy_cloud_run.py:212,225` & `scripts/spanner_create_db.py:91,112` (4 `FAKE_LATENCY` flags)**:
   - **Why it is a false positive**: Standard `time.sleep(2..5)` polling loops waiting for GCP Long-Running Operations (Cloud Build, Cloud Run revision readiness, and Spanner DDL creation) in CLI provisioning scripts.
3. **UI Copy-Button & Telemetry Pulse Reset Timers (5 `FAKE_LATENCY` flags)**:
   - [`src/components/activation/LiveTelemetryTicker.tsx:44`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/activation/LiveTelemetryTicker.tsx#L44) (`120ms` CSS opacity pulse reset on real event change).
   - [`src/components/common/SpannerStatusPill.tsx:32`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/common/SpannerStatusPill.tsx#L32) (`140ms` CSS opacity pulse reset when probing `/api/health/spanner`).
   - [`src/components/brief/CampaignBriefModal.tsx:34`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/brief/CampaignBriefModal.tsx#L34) (`2000ms` `"Copied"` button state reset after `navigator.clipboard.writeText`).
   - [`src/components/creative/CreativeStudioPanel.tsx:93`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/creative/CreativeStudioPanel.tsx#L93) (`2000ms` `"Copied"` button state reset).
   - [`src/components/audience/GqlDisclosure.tsx:29`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/audience/GqlDisclosure.tsx#L29) (`1600ms` `"Copied"` button state reset).
4. **`agents/app/protocols/a2a_protocol.py:81,172` (2 `DATA_FALLBACK_BRANCH` flags)**:
   - **Why it is a false positive**: Both `except Exception as e:` blocks return explicit error payloads (`{"error": str(e)}` at [`line 81`](file:///Users/jlpourt/CCAI/ea-audiences/agents/app/protocols/a2a_protocol.py#L81) and `{"status": "ERROR", "error": str(e)}` at [`line 172`](file:///Users/jlpourt/CCAI/ea-audiences/agents/app/protocols/a2a_protocol.py#L172)), not fallback data.

---

### 2.2 Confirmed `GEMINI.md` Rule 1 Violations & Realness Defects

#### VIOLATION 1 (CRITICAL — Hardcoded Fallback Persona Array & Silent Catch in Focus Group UI)
- **Locations**:
  - [`src/lib/prompts/courtside_personas.ts:158-725`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/prompts/courtside_personas.ts#L158-L725) (`export const SYNTHETIC_FALLBACK_PERSONAS: CourtsidePersona[]`)
  - [`src/components/focusgroup/FocusGroupModal.tsx:36`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/focusgroup/FocusGroupModal.tsx#L36), [`line 184`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/focusgroup/FocusGroupModal.tsx#L184), and [`line 267`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/focusgroup/FocusGroupModal.tsx#L267)
  - [`src/components/focusgroup/FocusGroupModal.tsx:477-502`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/focusgroup/FocusGroupModal.tsx#L477-L502)
- **What Happens**:
  1. `FocusGroupModal.tsx:167-185` fetches `/api/synthetic/focus-group?limit=20&franchise=...` on open, but `.catch(() => {})` at [`line 184`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/focusgroup/FocusGroupModal.tsx#L184) silently swallows any Spanner error.
  2. At [`FocusGroupModal.tsx:267`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/focusgroup/FocusGroupModal.tsx#L267), `const pool = liveSpannerDefaults.length > 0 ? liveSpannerDefaults : SYNTHETIC_FALLBACK_PERSONAS;` silently falls back to 20 hardcoded personas in `courtside_personas.ts`.
  3. Worse yet, `SYNTHETIC_FALLBACK_PERSONAS` in [`courtside_personas.ts:276-699`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/prompts/courtside_personas.ts#L276-L699) contains **prior-brand Rockstar/Zynga bleed** (`Leonida_Hooper`, `ViceCityGrind2K`, `GTA_And_2K_Whale`, `Match3Hooper`, `ToonBlastDunker`, `Rockstar + 2K Whale`).
  4. Before a simulation run completes (`currentResult === null`), [`FocusGroupModal.tsx:477-502`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/focusgroup/FocusGroupModal.tsx#L477-L502) renders hardcoded `wtpCurve`, `migrationCurve`, `backlashIndex = 18`, `conversionLift = 26.5`, and `crewMultiplier = 3.1`.
- **Required Fix**: Delete `SYNTHETIC_FALLBACK_PERSONAS` from `src/lib/prompts/courtside_personas.ts`, surface HTTP/Spanner errors explicitly in `FocusGroupModal.tsx`, and show an explicit empty/loading state until live Spanner personas and Gemini simulation results arrive.

#### VIOLATION 2 (HIGH — Hardcoded `migration_curve`, Crew, and Creator Fallbacks in `focus-group-eval.ts`)
- **Locations**:
  - [`src/lib/focus-group-eval.ts:723-735`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L723-L735)
  - [`src/lib/focus-group-eval.ts:75-81`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L75-L81) and [`lines 110-124`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L110-L124)
- **What Happens**:
  1. In `synthesizeConsensus` ([`focus-group-eval.ts:723-735`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L723-L735)), if Gemini's JSON omits `migration_curve`, the code silently substitutes a 5-stage hardcoded curve (`{ stage: "S1 Wk4", isolated_pct: 24, contagion_pct: 36 }`, etc.) instead of enforcing `migration_curve` via `generateStructured` schema validation.
  2. In `fetchLiveSpannerPersonas` ([`focus-group-eval.ts:88-96`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L88-L96)), the SQL query only reads `FROM Players p` without joining `MemberOfClan`/`Clans` or `FollowsCreator`/`Creators`, so [`lines 110-124`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L110-L124) assign deterministic fallback Crew names (`CREW_FALLBACK_NAMES`) and creator handles (`@Agent00`, `@Troydan`, `@DBG`).
- **Required Fix**: Join `MemberOfClan`/`Clans` and `FollowsCreator`/`Creators` directly in `fetchLiveSpannerPersonas`, and use `generateStructured` with a required `migration_curve` schema in `synthesizeConsensus`.

#### VIOLATION 3 (HIGH — Simulated `setTimeout` Agent Progress in `ActivationDAG.tsx`)
- **Location**: [`src/components/activation/ActivationDAG.tsx:76-81`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/activation/ActivationDAG.tsx#L76-L81) (flagged by `realness_scanner.py`)
- **What Happens**: Clicking **"Run Pipeline"** in `ActivationDAG.tsx` uses three `setTimeout` calls (`600ms`, `1400ms`, `2200ms`) to animate Step 1 (`"Brief Agent: Reasoning..."`) and Step 2 (`"Creative Agent: Generating..."`) to `"completed"` before pausing at Step 3 (HITL Policy Gate). Only Step 4 -> 5 invokes a real backend endpoint (`POST /api/activation/dispatch`).
- **Required Fix**: Wire Step 1 to `POST /api/campaign/brief` (or reuse the active brief state if already generated) and Step 2 to `/api/creative/image` before advancing to Step 3, removing the three `setTimeout` timers.

#### VIOLATION 4 (MEDIUM — Landing Page Hardcoded `DEFAULT_DYNAMIC_FINDINGS` & Silent `.catch(() => {})`)
- **Locations**:
  - [`src/components/landing/CourtsideLanding.tsx:177-473`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/landing/CourtsideLanding.tsx#L177-L473) (`DEFAULT_DYNAMIC_FINDINGS`) and [`lines 526-570`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/landing/CourtsideLanding.tsx#L526-L570)
  - [`src/app/page.tsx:71`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/page.tsx#L71) and [`line 114`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/page.tsx#L114)
- **What Happens**:
  1. `CourtsideLanding.tsx` initializes from hardcoded `DEFAULT_DYNAMIC_FINDINGS` (`418`, `284`, `196`, `512`, `364` players) and `footerStats` (`2850` players, `6853` identities). When `/api/insights/graph-stats` fails, `.catch(() => {})` at [`line 568`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/landing/CourtsideLanding.tsx#L568) keeps the static snapshot numbers instead of surfacing a Spanner error banner.
  2. `page.tsx:71` initializes `savedAudiencesCount` to `3` and `.catch(() => {})` at [`page.tsx:114`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/page.tsx#L114) silently ignores BigQuery errors on `/api/audiences/saved`.

#### VIOLATION 5 (MEDIUM — Golden-Play Fast-Path Reports `gemini-3.5-flash` Without Calling Gemini, Plus Non-LLM Python `AudienceAgent`)
- **Locations**:
  - [`src/app/api/audiences/nl-query/route.ts:215-367`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/audiences/nl-query/route.ts#L215-L367) and [`lines 560-571`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/audiences/nl-query/route.ts#L560-L571)
  - [`agents/app/sub_agents/audience_agent.py:21-58`](file:///Users/jlpourt/CCAI/ea-audiences/agents/app/sub_agents/audience_agent.py#L21-L58)
- **What Happens**:
  1. In `/api/audiences/nl-query/route.ts:560-571`, when `matchGoldenPlay(query, franchise)` matches one of the 5 preset golden queries, it skips `generateText({ role: "FAST" })` (`translateMs = 12`) and executes the pre-verified ISO GQL directly against Spanner, but still returns `model_used: MODELS.FAST.id` (`"gemini-3.5-flash"`). Either call Gemini live or label the fast-path transparently (`"iso-gql-compiled"`).
  2. In the secondary Python ADK microservice, [`agents/app/sub_agents/audience_agent.py:21-58`](file:///Users/jlpourt/CCAI/ea-audiences/agents/app/sub_agents/audience_agent.py#L21-L58) uses `if/elif` keyword matching instead of `genai.Client`, and [`lines 46-47`](file:///Users/jlpourt/CCAI/ea-audiences/agents/app/sub_agents/audience_agent.py#L46-L47) still contain prior-brand Rockstar bleed (`'Rockstar Social Club'`, `'game-gta6'`).

---

## 3. Synthetic Data Compliance Audit (The 3 Rules)

| Rule | Status | Evidence (`file:line`) |
| :--- | :---: | :--- |
| **(a) Explicitly Labeled in Code & UI** | **FAIL** | `realness_scan_raw.json` reports `"syntheticDataLabeled": false`. While [`scripts/generate_2k_dataset.py:2`](file:///Users/jlpourt/CCAI/ea-audiences/scripts/generate_2k_dataset.py#L2) has a docstring (`Synthetic dataset generator for the 2K Games...`), it lacks the mandatory `# SYNTHETIC_EBC_SEED_DATA` marker, and [`CourtsideLanding.tsx:963-976`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/landing/CourtsideLanding.tsx#L963-L976) displays `"2K Courtside · Live Telemetry"` without a subtle *"Synthetic EBC Simulation Dataset"* badge. |
| **(b) Statistically Believable** | **PASS** | [`scripts/generate_2k_dataset.py`](file:///Users/jlpourt/CCAI/ea-audiences/scripts/generate_2k_dataset.py) models 2,850 players across 30 authentic NBA DMAs + 5 international hubs ([`lines 189-227`](file:///Users/jlpourt/CCAI/ea-audiences/scripts/generate_2k_dataset.py#L189-L227)), 6 weighted 2K archetypes ([`lines 274-281`](file:///Users/jlpourt/CCAI/ea-audiences/scripts/generate_2k_dataset.py#L274-L281)), **Pareto lifetime spend distributions** (`random.paretovariate(alpha)` at [`line 297`](file:///Users/jlpourt/CCAI/ea-audiences/scripts/generate_2k_dataset.py#L297)), **Gaussian rage-quit distributions** (`random.gauss(5, 2)` at [`line 452`](file:///Users/jlpourt/CCAI/ea-audiences/scripts/generate_2k_dataset.py#L452)), authentic 2K titles (`game-nba2k27`, `game-nba2k26`, `game-wwe2k25`, `game-pga2k25`, `game-bl4`, `game-civ7`), and realistic VC/MyTEAM store SKUs (`offer-crew-reup-499`, `offer-hof-upgrade-6999`, `offer-opal-deluxe-1499`). |
| **(c) Non-Deceptive (Never Presented as Real Customer PII/Financials)** | **PASS** | All player records use synthetic IDs (`player-0001`..`player-2850`), SHA-256 hashed emails, and masked display emails (`f"{tag[0].lower()}***@{domain}"` at [`generate_2k_dataset.py:324`](file:///Users/jlpourt/CCAI/ea-audiences/scripts/generate_2k_dataset.py#L324)). No real Take-Two / 2K customer PII or confidential non-public financials are present. |

---

## 4. Demo-Day Kill Switches Checklist & Ready-to-Drop Implementations

| # | Kill Switch | Scanner Status | Deep Audit Status | Findings & Evidence |
| :- | :--- | :---: | :---: | :--- |
| **1** | **Warm Caches (`warm_cache`)** | `MISSING` | **MISSING** | Cloud Run sets `minInstanceCount: 1` ([`scripts/deploy_cloud_run.py:243`](file:///Users/jlpourt/CCAI/ea-audiences/scripts/deploy_cloud_run.py#L243)), `catalog.ts` caches Spanner catalog for 60s, and `/api/social/reddit-pulse` caches grounded results for 10m. However, there is no `scripts/warm_cache.sh` or `/api/warm` route to pre-warm Spanner sessions, BigQuery connections, Reddit pulse, and the 3 Golden Plays before executives walk in. |
| **2** | **Quota & Health Check (`quota_check`)** | `MISSING` | **PARTIAL** | [`/api/health/spanner/route.ts`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/health/spanner/route.ts), [`/api/health/models/route.ts`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/health/models/route.ts), [`/api/health/services/route.ts`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/health/services/route.ts), and [`scripts/smoke_models.mjs`](file:///Users/jlpourt/CCAI/ea-audiences/scripts/smoke_models.mjs) exist and probe real GCP resources, but the unified `/api/health?deep=1` endpoint and `<5s` `scripts/quota_check.sh` CLI expected by Showroom are missing. |
| **3** | **Offline Fallback Recording (`offline_fallback`)** | `MISSING` | **SUPERSEDED BY `GEMINI.md` RULE 1.3** | **Per `GEMINI.md` Rule 1.3 (`No Offline / Canned Replay Modes`)**: Building `DEMO_OFFLINE_FALLBACK` or static golden-response dictionaries inside application code is **strictly prohibited**. Conference Wi-Fi / regional blip resilience must instead be achieved via (a) `warm_cache.sh` pre-warming live TTL caches, (b) Cloud Run `minInstanceCount: 1`, and (c) an external MP4 screen recording stored outside the runtime codebase. |
| **4** | **Reset-State Script (`reset_state`)** | `MISSING` | **MISSING** | [`scripts/spanner_load_data.js`](file:///Users/jlpourt/CCAI/ea-audiences/scripts/spanner_load_data.js) and [`scripts/setup-gcp-bigquery.js`](file:///Users/jlpourt/CCAI/ea-audiences/scripts/setup-gcp-bigquery.js) perform full 60-second reloads, but there is no 1-second `scripts/reset_state.sh` or `POST /api/reset` endpoint to restore BigQuery `saved_audiences` / `activation_log` and clear in-memory `sessionA2AEvents` between back-to-back briefings. |

### Ready-to-Drop Kill Switch 1: `scripts/warm_cache.sh`

```bash
#!/usr/bin/env bash
# Warm Cloud Run instance, Spanner session pool, BigQuery, Reddit Grounding cache, and Golden Plays
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
echo "=== [warm_cache] Pre-warming 2K Courtside at ${BASE_URL} ==="

curl -fsS "${BASE_URL}/api/health/spanner" > /dev/null
curl -fsS "${BASE_URL}/api/health/services" > /dev/null
curl -fsS "${BASE_URL}/api/insights/graph-stats" > /dev/null
curl -fsS "${BASE_URL}/api/graph/view?franchise=ALL" > /dev/null
curl -fsS "${BASE_URL}/api/marketing/journey/summary" > /dev/null
curl -fsS "${BASE_URL}/api/marketing/markets" > /dev/null
curl -fsS -X POST "${BASE_URL}/api/social/reddit-pulse" \
  -H "Content-Type: application/json" -d '{}' > /dev/null

# Pre-warm the 3 Golden Plays against Spanner Graph
for PLAY in \
  "NBA 2K27 MyCAREER builds below 85 OVR who spent \$50+ on VC, haven't logged in for 7 days, and are in a Crew with active teammates" \
  "High-spend NBA 2K26 veterans who haven't migrated to NBA 2K27 yet and have Crew mates active in NBA 2K27" \
  "NBA 2K27 MyTEAM whales with 10+ Galaxy Opals and Hall of Fame Season Pass"; do
  curl -fsS -X POST "${BASE_URL}/api/audiences/nl-query" \
    -H "Content-Type: application/json" \
    -d "{\"query\":\"${PLAY}\",\"franchise\":\"ALL\"}" > /dev/null
done

echo "=== [warm_cache] All live GCP pools and caches warmed ==="
```

### Ready-to-Drop Kill Switch 2: Unified `src/app/api/health/route.ts` (`/api/health?deep=1`) & `scripts/quota_check.sh`

```typescript
// src/app/api/health/route.ts
import { NextRequest, NextResponse } from "next/server";
import { probeSpannerHealth } from "@/lib/gcp/spanner-client";
import { runBqQuery, tableFqn } from "@/lib/gcp/bigquery-client";
import { checkBucketAccess } from "@/lib/gcp/storage-client";
import { checkPubSubAccess } from "@/lib/gcp/pubsub-client";
import { generateText } from "@/lib/gcp/genai-client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deep = req.nextUrl.searchParams.get("deep") === "1";
  const startedAt = Date.now();

  const spanner = await probeSpannerHealth();
  if (!deep) {
    return NextResponse.json(
      { ok: spanner.ok, spanner, latency_ms: Date.now() - startedAt },
      { status: spanner.ok ? 200 : 503 }
    );
  }

  const [bqCheck, gcsCheck, pubsubCheck, geminiCheck] = await Promise.all([
    runBqQuery(`SELECT COUNT(1) AS cnt FROM ${tableFqn("saved_audiences")}`)
      .then(() => ({ ok: true }))
      .catch((e: Error) => ({ ok: false, error: e.message })),
    checkBucketAccess(),
    checkPubSubAccess(),
    generateText({
      role: "LITE",
      prompt: "Reply with OK.",
      temperature: 0,
      maxOutputTokens: 8,
    })
      .then((r) => ({ ok: true, model: r.modelUsed, latencyMs: r.latencyMs }))
      .catch((e: Error) => ({ ok: false, error: e.message })),
  ]);

  const allOk =
    spanner.ok && bqCheck.ok && gcsCheck.ok && pubsubCheck.ok && geminiCheck.ok;

  return NextResponse.json(
    {
      ok: allOk,
      deep: true,
      latency_ms: Date.now() - startedAt,
      services: {
        spanner,
        bigquery: bqCheck,
        storage: gcsCheck,
        pubsub: pubsubCheck,
        vertex_ai: geminiCheck,
      },
    },
    { status: allOk ? 200 : 503 }
  );
}
```

### Ready-to-Drop Kill Switch 4: `src/app/api/reset/route.ts` & `scripts/reset_state.sh`

```typescript
// src/app/api/reset/route.ts
import { NextResponse } from "next/server";
import { runBqQuery, tableFqn } from "@/lib/gcp/bigquery-client";
import { invalidateCatalogCache } from "@/lib/gcp/catalog";

export const dynamic = "force-dynamic";

export async function POST() {
  const startedAt = Date.now();
  try {
    invalidateCatalogCache();
    // Remove ad-hoc audiences and activations created during the live demo session
    // while preserving the baseline seeded records.
    await Promise.all([
      runBqQuery(
        `DELETE FROM ${tableFqn("saved_audiences")} WHERE audience_id NOT LIKE 'seed-%'`
      ),
      runBqQuery(
        `DELETE FROM ${tableFqn("activation_log")} WHERE activation_id NOT LIKE 'seed-%'`
      ),
    ]);
    return NextResponse.json({
      ok: true,
      reset_ms: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 503 }
    );
  }
}
```

```bash
#!/usr/bin/env bash
# scripts/reset_state.sh — 1-second EBC briefing state reset
set -euo pipefail
BASE_URL="${1:-http://localhost:3000}"
curl -fsS -X POST "${BASE_URL}/api/reset"
echo ""
```

---

## 5. Prioritized Remediation Roadmap

1. **Remove `SYNTHETIC_FALLBACK_PERSONAS` & Prior-Brand Bleed (`P0`)**:
   - Delete `SYNTHETIC_FALLBACK_PERSONAS` in [`src/lib/prompts/courtside_personas.ts:158-725`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/prompts/courtside_personas.ts#L158-L725) (which also eliminates the Rockstar/Zynga `Leonida_Hooper`, `ViceCityGrind2K`, `Match3Hooper`, `ToonBlastDunker` bleed) and remove the fallback in [`FocusGroupModal.tsx:267`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/focusgroup/FocusGroupModal.tsx#L267) and silent `.catch(() => {})` at [`FocusGroupModal.tsx:184`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/focusgroup/FocusGroupModal.tsx#L184).
2. **Enforce Schema-Validated `migration_curve` & Graph-Joined Crew/Creator Metadata in `focus-group-eval.ts` (`P0`)**:
   - Replace the hardcoded `migration_curve` fallback in [`src/lib/focus-group-eval.ts:723-735`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L723-L735) with `generateStructured` schema validation, and join `MemberOfClan`/`Clans` and `FollowsCreator`/`Creators` in `fetchLiveSpannerPersonas` ([`focus-group-eval.ts:88-96`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L88-L96)).
3. **Replace `setTimeout` DAG Step Simulation in `ActivationDAG.tsx` (`P1`)**:
   - Wire Steps 1 and 2 in [`src/components/activation/ActivationDAG.tsx:76-81`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/activation/ActivationDAG.tsx#L76-L81) to live `/api/campaign/brief` and `/api/creative/image` execution instead of `setTimeout` timers.
4. **Add Explicit Synthetic Dataset Labeling in Code & UI (`P1`)**:
   - Add `# SYNTHETIC_EBC_SEED_DATA` to [`scripts/generate_2k_dataset.py:1`](file:///Users/jlpourt/CCAI/ea-audiences/scripts/generate_2k_dataset.py#L1) and add a subtle `"Synthetic EBC Simulation Dataset"` badge to the footer of [`src/components/landing/CourtsideLanding.tsx:973-975`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/landing/CourtsideLanding.tsx#L973-L975).
5. **Drop In Unified Health/Quota, Warm-Cache, and Reset-State Kill Switches (`P1`)**:
   - Add `src/app/api/health/route.ts` (`?deep=1`), `src/app/api/reset/route.ts`, `scripts/warm_cache.sh`, and `scripts/reset_state.sh`.
