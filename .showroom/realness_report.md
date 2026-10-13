# 2K Courtside — Realness & Demo-Day Reliability Report (`realness-verifier`)

- **Repository**: `/Users/jlpourt/CCAI/ea-audiences` (2K Courtside — Audience Builder & Segmentation Engine)
- **Target GCP Environment**:
  - **Project / Region**: `jamie-bq-test` (`us-central1` + `global` Vertex AI endpoint)
  - **Cloud Spanner Graph**: `blackrock-spanner/twok_graph_db` (`TakeTwoPlayerGraph`)
  - **BigQuery Dataset**: `twok_marketing_intelligence` (`telemetry_events`, `saved_audiences`, `activation_log`)
  - **Cloud Storage Bucket**: `gs://twok-courtside-media-jamie-bq-test` (`images/`, `audio/`, `music/`, `briefs/`, `smoke/`)
  - **Cloud Pub/Sub Topic**: `twok-courtside-activations` (subscription `twok-courtside-activations-sub`)
  - **Vertex AI (`@google/genai`)**: `gemini-3.1-pro-preview` (REASONING), `gemini-3.5-flash` (FAST / GROUNDED), `gemini-3.5-flash-lite` (LITE), `gemini-2.5-flash-image` (IMAGE), `gemini-3.1-flash-tts-preview` (TTS), `lyria-002` (MUSIC), `gemini-embedding-001` (EMBED, 3,072-d)
- **Audit Date**: 2026-10-12

---

## Executive Summary & Scores

| Metric | Score | Status | Summary |
| :--- | :---: | :---: | :--- |
| **Realness Score** | **6.5 / 10** | ⚠️ **BLOCKING FALLBACK VIOLATIONS** | All 22 Next.js API routes and 6 GCP client libraries (`spanner-client.ts`, `bigquery-client.ts`, `genai-client.ts`, `storage-client.ts`, `pubsub-client.ts`, `catalog.ts`) are wired to real, live Google Cloud services. **However**, 12 `try/catch` and silent fallback paths across `focus-group-eval.ts`, `campaign/brief`, `marketing/journey/summary`, `insights/core-finding`, `audiences/nl-query`, `official-server.ts`, `ActivationDAG.tsx`, and the Python `agents/` fleet violate `GEMINI.md` Rule 1 (**ZERO DATA FALLBACKS**). |
| **Demo-Day Readiness Score** | **4.5 / 10** | ⚠️ **MISSING KILL SWITCHES** | Live health probes exist at `/api/health/spanner`, `/api/health/models`, and `/api/health/services`, plus `scripts/smoke_models.mjs`. Missing: unified `/api/health?deep=1`, `scripts/warm_cache.sh`, `scripts/reset_state.sh` (`POST /api/reset`), and UI synthetic dataset disclosure badge. |

> [!CAUTION]
> **Deterministic Scanner Note (`realness_scan_raw.json`)**: `realness_scanner.py` scored `0.0/10` prelim realness because its regexes only matched Python SDK calls (`5` in `agents/app/`) while flagging `43` `random.randint`/`random.uniform` calls inside the offline dataset generator `scripts/generate_2k_dataset.py`. Manual code trace across all 22 TypeScript Next.js routes confirms **real live GCP execution across Spanner Graph, BigQuery, GCS, Pub/Sub, and Vertex AI**, tempered by the specific `GEMINI.md` Rule 1 fallback violations cataloged in Section 2.

---

## 1. End-to-End Output Traceability Matrix

Every user-visible UI surface, API route, and backend service call is traced below:

| UI Component / Surface | Frontend Fetch Call | Backend API Route | Underlying GCP Service / Model Call | Verdict | Evidence (`file:line`) |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **Header Spanner Status Pill** (`SpannerStatusPill.tsx`) | `GET /api/health/spanner` (`SpannerStatusPill.tsx:35`) | `src/app/api/health/spanner/route.ts` | Cloud Spanner `SELECT 1` + `GRAPH TakeTwoPlayerGraph MATCH (p:Player) RETURN COUNT(*)` | **REAL** | `src/app/api/health/spanner/route.ts:20-51`, `src/lib/gcp/spanner-client.ts:615-646` |
| **Model Health Probe** | `GET /api/health/models` | `src/app/api/health/models/route.ts` | Vertex AI `@google/genai` parallel live probes of `REASONING`, `FAST`, `LITE` | **REAL** | `src/app/api/health/models/route.ts:18-58`, `src/lib/gcp/genai-client.ts:735-764` |
| **Infra Services Health Probe** | `GET /api/health/services` | `src/app/api/health/services/route.ts` | BigQuery `dataset.exists()`, GCS `bucket.getMetadata()`, Pub/Sub `topic.exists()` | **REAL** | `src/app/api/health/services/route.ts:14-67` |
| **Landing KPI Strip & Play Counts** (`CourtsideLanding.tsx`) | `GET /api/insights/graph-stats` (`CourtsideLanding.tsx:101`) | `src/app/api/insights/graph-stats/route.ts` | 7 parallel Cloud Spanner GQL & SQL count queries on `TakeTwoPlayerGraph`, `Clans`, `Identities` | **REAL** *(UI swallows error)* | `src/app/api/insights/graph-stats/route.ts:7-76` (UI silent `.catch(() => {})` at `CourtsideLanding.tsx:116`) |
| **Landing Executive Finding Banner** (`CourtsideLanding.tsx`) | `GET /api/insights/core-finding` (`CourtsideLanding.tsx:118`) | `src/app/api/insights/core-finding/route.ts` | 4 Spanner GQL queries + Vertex AI `generateText({ role: "FAST" })` (`gemini-3.5-flash`) | **SILENT_FALLBACK** | `src/app/api/insights/core-finding/route.ts:55-89` catches Gemini errors & returns canned summary with HTTP 200 |
| **Force Graph Canvas (4 Views: Cohorts, Cross-Label, Crews, Single Identity)** (`GraphStage.tsx`) | `GET /api/graph/view` (`src/app/page.tsx:112`) | `src/app/api/graph/view/route.ts` | Cloud Spanner `getCatalog()`, `getPlayersForView()`, `getIdentitiesForPlayer()`, `getCrewMates()`, `getCrossLabelBridges()` | **REAL** | `src/app/api/graph/view/route.ts:74-617`, `src/lib/gcp/catalog.ts:154-381` |
| **NL Audience Builder & GQL Chip Editor** (`NLSearchBar.tsx`, `AudienceBuilder.tsx`) | `POST /api/audiences/nl-query` (`src/app/page.tsx:144`, `NLSearchBar.tsx:84`) | `src/app/api/audiences/nl-query/route.ts` | Vertex AI `generateText({ role: "FAST" })` (`gemini-3.5-flash`) + Spanner `runSpannerGraphQuery()` | **SILENT_FALLBACK** | `src/app/api/audiences/nl-query/route.ts:196-271` bypasses LLM on Golden Plays; `lines 302-305` catch JSON parse error & substitute hardcoded GQL |
| **Lookalike Audience Expansion** (`SaveAudienceSheet.tsx`) | `POST /api/audiences/lookalike` (`SaveAudienceSheet.tsx:88`) | `src/app/api/audiences/lookalike/route.ts` | Spanner candidate query + Vertex AI `embedText()` (`gemini-embedding-001`, 3,072-d cosine similarity) | **REAL** | `src/app/api/audiences/lookalike/route.ts:14-100`, `src/lib/gcp/genai-client.ts:597-633` |
| **Save Audience Segment** (`SaveAudienceSheet.tsx`) | `POST /api/audiences/save` (`SaveAudienceSheet.tsx:111`) | `src/app/api/audiences/save/route.ts` | BigQuery `dataset("twok_marketing_intelligence").table("saved_audiences").insert()` | **REAL** | `src/app/api/audiences/save/route.ts:8-52`, `src/lib/gcp/bigquery-client.ts:34-60` |
| **Saved Audiences Drawer** (`SavedAudiencesDrawer.tsx`) | `GET /api/audiences/saved` (`SavedAudiencesDrawer.tsx:27`) | `src/app/api/audiences/saved/route.ts` | BigQuery `SELECT ... FROM twok_marketing_intelligence.saved_audiences` | **REAL** | `src/app/api/audiences/saved/route.ts:6-20`, `src/lib/gcp/bigquery-client.ts:65-92` |
| **20-Persona Courtside Focus Group & Offer Battle** (`FocusGroupModal.tsx`) | `POST /api/synthetic/focus-group` (`FocusGroupModal.tsx:186`) | `src/app/api/synthetic/focus-group/route.ts` | 20 parallel `generateText({ role: "FAST" })` + `synthesizeConsensus` via `REASONING` (`gemini-3.1-pro-preview`) | **SILENT_FALLBACK** | `src/lib/focus-group-eval.ts:58-92` & `184-205` catch Vertex AI errors and return hardcoded quotes, WTP curve, and lift metrics |
| **Focus Group SSE Stream** | `POST /api/synthetic/focus-group/stream` | `src/app/api/synthetic/focus-group/stream/route.ts` | 20 streaming `generateText({ role: "FAST" })` + `synthesizeConsensus` (`REASONING`) | **SILENT_FALLBACK** | `src/app/api/synthetic/focus-group/stream/route.ts:66-85` (persona fallback) & `95-131` (deterministic fake alt-price battle) |
| **1-on-1 Persona Interrogation Drawer** (`PersonaInterrogationDrawer.tsx`) | `POST /api/synthetic/focus-group/interrogate` (`PersonaInterrogationDrawer.tsx:50`) | `src/app/api/synthetic/focus-group/interrogate/route.ts` | Vertex AI `generateText({ role: "REASONING" })` (`gemini-3.1-pro-preview`) | **REAL** | `src/app/api/synthetic/focus-group/interrogate/route.ts:8-63` (fails loudly with HTTP 500 on error) |
| **Live Grounded Reddit Pulse** (`RedditPulseCard.tsx`) | `POST /api/social/reddit-pulse` (`RedditPulseCard.tsx:35`) | `src/app/api/social/reddit-pulse/route.ts` | Vertex AI `groundedSearch()` (`gemini-3.5-flash` + `googleSearch` tool) + `generateText({ role: "LITE" })` | **REAL** | `src/app/api/social/reddit-pulse/route.ts:32-125`, `src/lib/gcp/genai-client.ts:666-720` (fails with HTTP 503 if citations=0) |
| **Executive Campaign Brief Generator** (`CampaignBriefModal.tsx`) | `POST /api/campaign/brief` (`src/app/page.tsx:255`) | `src/app/api/campaign/brief/route.ts` | Vertex AI `groundedSearch()` + `generateText({ role: "REASONING" })` (`gemini-3.1-pro-preview`) | **SILENT_FALLBACK** | `src/app/api/campaign/brief/route.ts:23-33` swallows search error; `lines 87-125` fall back to canned `trigger_rules`, `creative_hooks`, `strategic_pivot` |
| **Campaign Brief Audio Narrator** (`CampaignBriefModal.tsx`) | `POST /api/creative/brief-audio` (`CampaignBriefModal.tsx:52`) | `src/app/api/creative/brief-audio/route.ts` | Vertex AI `REASONING` script + `synthesizeSpeech()` (`gemini-3.1-flash-tts-preview`) + GCS `uploadMedia()` | **REAL** | `src/app/api/creative/brief-audio/route.ts:7-66` |
| **Creative Studio — Pack Art Generator** (`CreativeStudioPanel.tsx`) | `POST /api/creative/image` (`CreativeStudioPanel.tsx:68`) | `src/app/api/creative/image/route.ts` | Vertex AI `generateImage()` (`gemini-2.5-flash-image`) + GCS `uploadMedia(prefix: "images")` | **REAL** | `src/app/api/creative/image/route.ts:7-50`, `src/lib/gcp/genai-client.ts:409-448` |
| **Creative Studio — Arena PA Announcer VO** (`CreativeStudioPanel.tsx`) | `POST /api/creative/voice` (`CreativeStudioPanel.tsx:99`) | `src/app/api/creative/voice/route.ts` | Vertex AI `LITE` script + `synthesizeSpeech()` (`gemini-3.1-flash-tts-preview`) + GCS `uploadMedia(prefix: "audio")` | **REAL** | `src/app/api/creative/voice/route.ts:7-62`, `src/lib/gcp/genai-client.ts:502-537` |
| **Creative Studio — Lyria 2 Arena Hype Bed** (`CreativeStudioPanel.tsx`) | `POST /api/creative/music` (`CreativeStudioPanel.tsx:125`) | `src/app/api/creative/music/route.ts` | Vertex AI `generateMusic()` (`lyria-002` `:predict`) + GCS `uploadMedia(prefix: "music")` | **REAL** | `src/app/api/creative/music/route.ts:7-50`, `src/lib/gcp/genai-client.ts:555-591` |
| **Season 1→2 Journey Sankey** (`SeasonJourneySankey.tsx`) | `GET/POST /api/marketing/journey/summary` (`SeasonJourneySankey.tsx:109, 175`) | `src/app/api/marketing/journey/summary/route.ts` | Spanner `SELECT ... FROM Players` + Vertex AI `generateText({ role: "FAST" })` (`gemini-3.5-flash`) | **SILENT_FALLBACK** | `src/app/api/marketing/journey/summary/route.ts:297-321` & `348-370` catch Gemini errors & return canned `diagnosis` |
| **36-Market NBA & Global Geo Map** (`NBAMarketMap.tsx`) | `GET /api/marketing/markets` (`NBAMarketMap.tsx:102`) | `src/app/api/marketing/markets/route.ts` | 2 Cloud Spanner SQL aggregation queries grouped by `dma_market` | **REAL** | `src/app/api/marketing/markets/route.ts:63-146` |
| **Live Telemetry Ticker** (`LiveTelemetryTicker.tsx`) | `GET /api/simulation/triggers` (`LiveTelemetryTicker.tsx:24`) | `src/app/api/simulation/triggers/route.ts` | Cloud Spanner `SELECT ... FROM TelemetryEvents t JOIN Players p` | **REAL** | `src/app/api/simulation/triggers/route.ts:69-204` |
| **Hold-to-Approve Activation DAG** (`ActivationDAG.tsx`) | `POST /api/activation/dispatch` (`ActivationDAG.tsx:96`) | `src/app/api/activation/dispatch/route.ts` | Cloud Pub/Sub `publishActivation()` (`twok-courtside-activations`) + BigQuery `logActivation()` (`activation_log`) | **FAKE_LATENCY** *(UI steps 1–3)* / **REAL** *(Step 4 dispatch)* | `ActivationDAG.tsx:78-80` uses `setTimeout` (`600ms`, `1400ms`, `2200ms`) for steps 1–3; `dispatch/route.ts:18-111` executes real Pub/Sub + BigQuery |
| **Activation Audit Feed** (`ActivationFeed.tsx`) | `GET /api/activation/log?limit=25` & `GET /api/a2a` (`ActivationFeed.tsx:37-38`) | `src/app/api/activation/log/route.ts` & `src/app/api/a2a/route.ts` | BigQuery `listActivations()` (`activation_log`) + Spanner `extractPlayersForA2A()` | **SILENT_FALLBACK** | `src/app/api/a2a/route.ts:8-54` seeds 3 hardcoded fake A2A events; `src/lib/a2a/official-server.ts:114-117` catches Spanner errors and returns `[]` |
| **Python ADK Agent Fleet** (`agents/app/fast_api_app.py`) | `POST /focus-group/simulate`, `POST /audiences/nl-query` | `agents/app/sub_agents/*.py` & `agents/app/tools/*.py` | `google.genai`, `google.cloud.spanner`, `google.cloud.bigquery` | **STUBBED / SILENT_FALLBACK** | `audience_agent.py:21-129` reads local `data/master_players.json`; `bq_tools.py:32-41`, `spanner_graph_tools.py:27-35`, `focus_group_agent.py:148-208` catch errors and return local JSON / canned reactions |

---

## 2. `GEMINI.md` Rule 1 Audit — Zero Data Fallbacks Violations

Per `GEMINI.md` Rule 1 (**ZERO DATA FALLBACKS — REAL GCP INTEGRATIONS ONLY**), applications must **never** catch an exception from Vertex AI, BigQuery, Cloud Spanner, or any GCP API and return hardcoded objects, static JSON, canned strings, or fallback WTP curves. Every violation found in the repository is documented below with exact `file:line` references:

### Critical & High Severity Violations (`src/` — Active Next.js App)

1. **[`src/lib/focus-group-eval.ts:58-75`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L58-L75) & [`79-92`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L79-L92) — Silent Persona Verdict Fallbacks on Vertex AI Failure**
   - **What it does**: In `evaluatePersonas()`, the `catch (err)` block swallows Vertex AI `generateText({ role: "FAST" })` exceptions and returns a fabricated `FocusGroupReaction` (`verbatim_quote: isHighPrice ? "Too steep for virtual items. I would rather grind Cap Breakers in The City." : "Solid bundle value compared to standard VC ladder pricing."`, `authenticity_rating: 0.92`, `churn_risk_score: 0.35`). Lines `79-92` also catch rejected promises via `Promise.allSettled` and return another hardcoded reaction (`"Decent offer proposition, weighing squad utility against the VC store."`).
   - **Required Fix**: Remove the `try / catch` and `Promise.allSettled` fallback objects in `evaluatePersonas()`. Let `GenAIError` propagate so `/api/synthetic/focus-group` returns `HTTP 502/503` if Vertex AI fails.

2. **[`src/lib/focus-group-eval.ts:164-182`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L164-L182) & [`184-205`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L184-L205) — Hardcoded Consensus Summary, Lift Metrics & 8-Point WTP Curve Fallback**
   - **What it does**: In `synthesizeConsensus()`, the `catch (err)` block (`lines 184-205`) catches failures from `generateText({ role: "REASONING" })` (`gemini-3.1-pro-preview`) and returns a hardcoded 8-point `wtpCurve` (`$2.99 -> 66%` down to `$24.99 -> 5%`), hardcoded `predictedConversionLift: 24.0`, `projectedRevenueImpactUsd: 125000`, `churnMitigationLift: 18.0`, and falsely labels `reasoningModelUsed: "gemini-3.1-pro-preview"`. Even inside the `try` block (`lines 167-178`), if `parsed?.wtp_curve` is missing, it substitutes a hardcoded 8-point WTP curve.
   - **Required Fix**: Pass a strict `responseSchema` to `generateText({ role: "REASONING", schema: ... })` and delete the `catch (err)` fallback block (`lines 184-205`) and inline WTP curve fallback (`lines 169-178`).

3. **[`src/app/api/synthetic/focus-group/stream/route.ts:66-85`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/synthetic/focus-group/stream/route.ts#L66-L85) & [`95-131`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/synthetic/focus-group/stream/route.ts#L95-L131) — Streaming Focus Group Persona Fallback & Stubbed Alt-Price Offer Battle**
   - **What it does**:
     - Lines `66-85`: Catches Vertex AI `generateText` errors during streaming and emits fake persona reactions over SSE.
     - Lines `95-131`: When `altPriceUsd` is provided (Play 3 Offer Battle `$14.99 vs $19.99`), the streaming endpoint **never calls Vertex AI** for the alternative price — it mutates `reactions` in-memory using `if (isMoreExpensive)` heuristics and emits a hardcoded `consensus_summary` (`"At $19.99, conversion rate drops by ~34% as casual and theorycrafter players reject the premium pricing tier."`).
   - **Required Fix**: Remove the `catch` fallback at `lines 66-85` and call `evaluatePersonas()` + `synthesizeConsensus()` against live Vertex AI for `altPriceUsd` just as `src/app/api/synthetic/focus-group/route.ts:36-57` does.

4. **[`src/app/api/synthetic/focus-group/route.ts:24-28`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/synthetic/focus-group/route.ts#L24-L28), [`src/app/api/synthetic/focus-group/stream/route.ts:20-24`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/synthetic/focus-group/stream/route.ts#L20-L24), [`src/components/focusgroup/FocusGroupModal.tsx:166`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/focusgroup/FocusGroupModal.tsx#L166), & [`src/lib/prompts/courtside_personas.ts:158-725`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/prompts/courtside_personas.ts#L158-L725) — Hardcoded `SYNTHETIC_FALLBACK_PERSONAS` Array**
   - **What it does**: When `sampled_players` has fewer than 20 players, both backend routes and `FocusGroupModal.tsx` pad the cohort from `SYNTHETIC_FALLBACK_PERSONAS` (20 static in-memory objects in `courtside_personas.ts:158-725`) rather than querying live player rows from Cloud Spanner `TakeTwoPlayerGraph`.
   - **Required Fix**: When `sampled_players.length < 20`, query the remaining players directly from Cloud Spanner via `getPlayersForView({ franchise, limit: 20 - sampledPlayers.length })` in `src/lib/gcp/catalog.ts`.

5. **[`src/app/api/campaign/brief/route.ts:23-33`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/campaign/brief/route.ts#L23-L33) & [`87-125`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/campaign/brief/route.ts#L87-L125) — Swallowed Search Grounding Error & Canned Brief Fallbacks**
   - **What it does**:
     - Lines `23-33`: Wraps `groundedSearch()` in a `try / catch` that ignores grounding failures and sets `groundedInsight` to a canned string. Even worse, inside the `try` block (`lines 27-29`), when `searchRes.text` is truthy, it overwrites `groundedInsight` with a static string (`"Live Reddit grounding across r/NBA2K confirmed high community sensitivity..."`) instead of using `searchRes.text`!
     - Lines `87-125`: Falls back to hardcoded `trigger_rules` (`lines 100-104`), hardcoded `creative_hooks` (`lines 114-118`), and a hardcoded `strategic_pivot` (`lines 120-124`) if model JSON fields are missing.
   - **Required Fix**: Use `searchRes.text` directly, remove the `try / catch` around `groundedSearch()`, enforce a strict JSON `responseSchema` on `generateText({ role: "REASONING" })`, and fail with HTTP 502/503 if Vertex AI fails.

6. **[`src/app/api/marketing/journey/summary/route.ts:297-321`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/marketing/journey/summary/route.ts#L297-L321) & [`348-370`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/marketing/journey/summary/route.ts#L348-L370) — Swallowed Gemini Failure Returning Canned Journey Diagnosis**
   - **What it does**: Both `GET` and `POST` handlers initialize `diagnosis` to a canned 2-sentence string and wrap `generateText({ role: "FAST" })` in a `try / catch` that logs `console.warn("[journey-summary] Gemini diagnosis generation fallback:")` and returns HTTP 200 with the canned diagnosis and `model_used: "gemini-3.5-flash"`.
   - **Required Fix**: Remove the `try / catch` fallback blocks at `lines 300-321` and `352-370` so Gemini errors surface as HTTP 502/503.

7. **[`src/app/api/insights/core-finding/route.ts:55-67`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/insights/core-finding/route.ts#L55-L67) & [`69-89`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/insights/core-finding/route.ts#L69-L89) — Hardcoded Spanner Count Defaults & Swallowed Gemini Executive Summary Error**
   - **What it does**:
     - Lines `55-67`: Uses `|| 284`, `|| 124.8`, `|| 303`, `|| 176`, `|| 2850` fallback numbers if Spanner returns 0.
     - Lines `69-89`: Initializes `executiveSummary` to a static template and wraps `generateText({ role: "FAST" })` in `try { ... } catch { // Keep deterministic summary if rate-limited }`, returning HTTP 200 with `model_used: "gemini-3.5-flash"`.
   - **Required Fix**: Remove the `|| 284` / `|| 303` / `|| 176` fallback numbers and remove the `try / catch` around `generateText()`.

8. **[`src/app/api/audiences/nl-query/route.ts:196-271`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/audiences/nl-query/route.ts#L196-L271) & [`298-305`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/audiences/nl-query/route.ts#L298-L305) — Regex Bypass of Gemini NL→GQL & Silent Fallback GQL on Parse Error**
   - **What it does**:
     - Lines `196-271` (`matchGoldenPlay`): Intercepts the 3 Golden Plays via substring matching and returns pre-written GQL without calling Vertex AI `gemini-3.5-flash`, while still returning `model_used: "gemini-3.5-flash"` (`line 281`) to the UI badge.
     - Lines `298-305`: Catches `JSON.parse(gen.text)` errors and silently substitutes `GRAPH TakeTwoPlayerGraph MATCH (p:Player) WHERE p.primary_franchise = 'NBA2K' RETURN p.player_id`.
   - **Required Fix**: Either route all NL queries through live `generateText({ role: "FAST" })` (with few-shot Golden Play examples in `NL_TO_GQL_SYSTEM_PROMPT` which already exist in `src/lib/prompts/nl_to_gql.ts`) or accurately label preset GQL, and throw a loud HTTP 502 error if `parseModelJson(gen.text)` fails to extract `gql_query`.

9. **[`src/lib/a2a/official-server.ts:114-117`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/a2a/official-server.ts#L114-L117) & [`src/app/api/a2a/route.ts:8-54`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/a2a/route.ts#L8-L54) — Seeded Fake A2A Feed & Swallowed Spanner Error in A2A Handler**
   - **What it does**:
     - `src/app/api/a2a/route.ts:8-54`: Seeds `liveA2AEvents` with 3 hardcoded fake A2A messages (`msg-2k-a2a-001`, `002`, `003` with `spanner_matched_count: 431`, `predicted_retention_lift: "+26.4%"`).
     - `src/lib/a2a/official-server.ts:114-117`: Catches Spanner query errors in `extractPlayersForA2A()` and returns `[]`, causing `handleOfficialA2ARequest()` to return `TASK_STATE_COMPLETED` with 0 players instead of failing with HTTP 503.
   - **Required Fix**: Start `liveA2AEvents` empty (or populate from BigQuery `activation_log`) and rethrow Spanner errors in `extractPlayersForA2A()`.

10. **[`src/lib/gcp/spanner-client.ts:333`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/spanner-client.ts#L333), [`347`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/spanner-client.ts#L347), [`358`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/gcp/spanner-client.ts#L358) — Swallowed Multi-Hop Bridge Query Errors**
    - **What it does**: Chains `.catch(() => [])` onto `bridgePromise = runGql(database, bridgeSql)`, silently masking invalid GQL in multi-hop bridge queries.
    - **Required Fix**: Remove `.catch(() => [])` so bridge query syntax or Spanner errors surface in `Promise.all`.

11. **[`src/components/activation/ActivationDAG.tsx:78-80`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/activation/ActivationDAG.tsx#L78-L80) & [`src/components/landing/CourtsideLanding.tsx:81-98, 116, 128`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/landing/CourtsideLanding.tsx#L81-L128) — Frontend Fake Latency Timers & Silent Catch Blocks**
    - **What it does**:
      - `ActivationDAG.tsx:78-80`: Uses `setTimeout(() => setExecutionStep(1), 600)`, `setTimeout(..., 1400)`, and `setTimeout(..., 2200)` to simulate agent execution progress before the user triggers Hold-to-Approve (`POST /api/activation/dispatch`).
      - `CourtsideLanding.tsx:81-98, 116, 128`: Initializes `graphStats` and `coreFinding` with hardcoded numbers/text and swallows `/api/insights/graph-stats` and `/api/insights/core-finding` failures via `.catch(() => {})`.
    - **Required Fix**: Tie `ActivationDAG.tsx` node states to actual completed artifacts (`cohortContext`, `activeBrief`, generated media URLs, and `/api/activation/dispatch` response) rather than `setTimeout`, and surface API errors on `CourtsideLanding.tsx`.

### Critical Violations in Python ADK Fleet (`agents/app/**`)

12. **[`agents/app/tools/bq_tools.py:32-41`](file:///Users/jlpourt/CCAI/ea-audiences/agents/app/tools/bq_tools.py#L32-L41), [`agents/app/tools/spanner_graph_tools.py:27-35`](file:///Users/jlpourt/CCAI/ea-audiences/agents/app/tools/spanner_graph_tools.py#L27-L35), [`agents/app/sub_agents/audience_agent.py:21-129`](file:///Users/jlpourt/CCAI/ea-audiences/agents/app/sub_agents/audience_agent.py#L21-L129), & [`agents/app/sub_agents/focus_group_agent.py:60-62, 148-208`](file:///Users/jlpourt/CCAI/ea-audiences/agents/app/sub_agents/focus_group_agent.py#L148-L208)**
    - **What it does**:
      - `bq_tools.py:32-41` catches `Exception` on BigQuery and loads `data/telemetry_match_events.json`.
      - `spanner_graph_tools.py:27-35` catches `Exception` on Cloud Spanner and loads `data/master_players.json`.
      - `audience_agent.py:59-111` reads `data/master_players.json` directly off disk without calling Spanner or Vertex AI.
      - `focus_group_agent.py:60-62` and `148-208` catch `Exception` on Vertex AI `genai.Client` and return 4 hardcoded `PersonaReaction` objects.
    - **Required Fix**: Remove all `try / except` local JSON and canned response fallbacks in `agents/app/` and raise `fastapi.HTTPException(status_code=503, detail=str(e))` on any GCP failure.

---

## 3. Synthetic Data Compliance Audit (The 3 Rules)

The seed dataset in `data/*.json` (generated by [`scripts/generate_2k_dataset.py`](file:///Users/jlpourt/CCAI/ea-audiences/scripts/generate_2k_dataset.py) and validated by [`scripts/validate_dataset.py`](file:///Users/jlpourt/CCAI/ea-audiences/scripts/validate_dataset.py)) was audited against the 3 Showroom Synthetic Data Rules:

| Rule | Status | Evidence & Audit Findings |
| :--- | :---: | :--- |
| **(a) Explicitly Labeled in Code & UI** | ⚠️ **PARTIAL** | **Code**: Docstrings in [`scripts/generate_2k_dataset.py:3`](file:///Users/jlpourt/CCAI/ea-audiences/scripts/generate_2k_dataset.py#L3) and [`scripts/validate_dataset.py:2`](file:///Users/jlpourt/CCAI/ea-audiences/scripts/validate_dataset.py#L2) state `"synthetic Take-Two identity graph"`, but the canonical `# SYNTHETIC_EBC_SEED_DATA` comment tag required by `realness_scanner.py` is missing.<br>**UI**: **MISSING**. While `FocusGroupModal.tsx:408` labels `"20 Synthetic Personas"`, neither `CourtsideLanding.tsx` nor `src/app/page.tsx` displays a subtle *"Synthetic EBC Simulation Dataset"* disclosure badge in the footer/header. |
| **(b) Statistically Believable & Aligned with Customer Catalog** | ✅ **PASS** | Verified via `python3 scripts/validate_dataset.py` (`0` dangling foreign keys across all 10 tables):<br>• **18 Take-Two Games** ([`data/games.json`](file:///Users/jlpourt/CCAI/ea-audiences/data/games.json), [`scripts/generate_2k_dataset.py:46-66`](file:///Users/jlpourt/CCAI/ea-audiences/scripts/generate_2k_dataset.py#L46-L66)) across `2K` (*NBA 2K27*, *MyCAREER/The City*, *MyTEAM*, *MyNBA & The W*, *NBA 2K Mobile*, *WWE 2K25*, *PGA TOUR 2K25*, *TopSpin 2K25*, *Civilization VII*, *Borderlands 4*, *Mafia: The Old Country*), `ROCKSTAR` (*GTA Online*, *Red Dead Online*, *Grand Theft Auto VI*), and `ZYNGA` (*Toon Blast*, *Words With Friends*, *Match Factory!*, *Zynga Poker*).<br>• **16 Authentic Creators** ([`data/creators.json`](file:///Users/jlpourt/CCAI/ea-audiences/data/creators.json), [`scripts/generate_2k_dataset.py:165-183`](file:///Users/jlpourt/CCAI/ea-audiences/scripts/generate_2k_dataset.py#L165-L183)): DBG, Tydebo, JoeKnows, Agent00, FlightReacts, CallMeAgent, Troydan, ChrisSmoove, DukeDennis, GrindingDF, Shake4ndbake, PowerDF, Assemble, TGG, MrBossFTW, PotatoMcWhiskey.<br>• **48 Crews** ([`data/clans.json`](file:///Users/jlpourt/CCAI/ea-audiences/data/clans.json), [`scripts/generate_2k_dataset.py:187-202`](file:///Users/jlpourt/CCAI/ea-audiences/scripts/generate_2k_dataset.py#L187-L202)): 36 NBA 2K Crews across `Rec` (16), `Pro-Am` (12), and `Comp` (8) tiers + 8 Rockstar Crews + 4 WWE Factions.<br>• **29 Marketing Offers** ([`data/marketing_offers.json`](file:///Users/jlpourt/CCAI/ea-audiences/data/marketing_offers.json), [`scripts/generate_2k_dataset.py:203-234`](file:///Users/jlpourt/CCAI/ea-audiences/scripts/generate_2k_dataset.py#L203-L234)): Authentic VC ladder ($1.99–$99.99), Season 1 Pass Pro/HoF ($9.99/$19.99), Galaxy Opal Deluxe Pack ($14.99 vs $19.99 variants), $4.99 Crew Re-Up Bundle, $69.99 GTA VI Pre-Order, Shark Cards, Gold Bars, and Zynga coin packs.<br>• **2,850 Players & Realistic Distributions**: Uses Pareto heavy-tailed spend (`pareto_spend` at [`scripts/generate_2k_dataset.py:317-319`](file:///Users/jlpourt/CCAI/ea-audiences/scripts/generate_2k_dataset.py#L317-L319)), franchise-calibrated Gaussian age/gender distributions (`demographics` at [`lines 350-363`](file:///Users/jlpourt/CCAI/ea-audiences/scripts/generate_2k_dataset.py#L350-L363): NBA2K median age 25, CIV7 median age 32, ZYNGA median age 41 / 56% female), 30 NBA DMA markets + 6 international hubs, and verified Golden Play cohorts (**Play 1**: 288 players, **Play 2**: 306 players, **Play 3**: 176 players). |
| **(c) Non-Deceptive / Zero Customer PII** | ✅ **PASS** | Uses synthetic player IDs (`t2-usr-00001`..`t2-usr-02850`), masked email placeholders (`mask_email` at [`scripts/generate_2k_dataset.py:322-323`](file:///Users/jlpourt/CCAI/ea-audiences/scripts/generate_2k_dataset.py#L322-L323)), and curated gaming handles. Never claims to be confidential Take-Two production PII. |

---

## 4. Demo-Day Kill Switches Checklist & Ready-to-Drop Implementations

| # | Kill Switch | Status | Existing Coverage | What Is Missing |
| :---: | :--- | :---: | :--- | :--- |
| 1 | **Warm Caches (`warm_cache`)** | ❌ **MISSING** | `catalog.ts` memoizes `Games`/`Offers`/`Creators`/`Clans` after first call; `reddit-pulse/route.ts` caches grounded Reddit results for 10m. | No `scripts/warm_cache.sh` or `/api/warm` route to pre-warm Cloud Run, Spanner session pool, BigQuery, and the 3 Golden Play queries + Reddit pulse before the EBC briefing starts. |
| 2 | **Quota & Deep Health Check (`quota_check`)** | ⚠️ **PARTIAL** | `/api/health/spanner`, `/api/health/models`, `/api/health/services`, and `scripts/smoke_models.mjs` exist and test real GCP resources. | No unified `GET /api/health?deep=1` endpoint or fast `<5s` pre-demo CLI script (`scripts/quota_check.sh`) recognized by preflight tooling. |
| 3 | **Offline Emergency Contingency (`offline_fallback`)** | ⚠️ **EXTERNAL ONLY** | Per `GEMINI.md` Rule 1.3, code-level `DEMO_OFFLINE_FALLBACK` branches are **strictly forbidden**. | Record a standalone 1080p MP4 golden-path walkthrough video (`docs/demo_walkthrough_backup.mp4`) stored outside application code for catastrophic conference Wi-Fi failure. |
| 4 | **Reset-State Script (`reset_state`)** | ❌ **MISSING** | `invalidateCatalogCache()` exists in `src/lib/gcp/catalog.ts:272`. | No `scripts/reset_state.sh` or `POST /api/reset` endpoint to purge demo-session rows from BigQuery `saved_audiences` & `activation_log` and clear in-memory A2A tasks between back-to-back EBC briefings. |

### Ready-to-Drop Implementation 1: `scripts/warm_cache.sh`
```bash
#!/usr/bin/env bash
# Pre-warm Cloud Run / local server, Spanner session pool, catalog cache, Golden Plays, and Reddit grounding cache.
set -euo pipefail
BASE_URL="${1:-http://localhost:3000}"

echo "🔥 Warming 2K Courtside caches against ${BASE_URL}..."
curl -fsS "${BASE_URL}/api/health/spanner" >/dev/null
curl -fsS "${BASE_URL}/api/health/services" >/dev/null
curl -fsS "${BASE_URL}/api/insights/graph-stats" >/dev/null
curl -fsS "${BASE_URL}/api/insights/core-finding" >/dev/null
curl -fsS "${BASE_URL}/api/graph/view?view=audience-cohorts&game=ALL&archetype=ALL" >/dev/null
curl -fsS -X POST "${BASE_URL}/api/social/reddit-pulse" \
  -H "Content-Type: application/json" \
  -d '{"topic":"NBA 2K27 Season 1 VC pricing, MyTEAM Galaxy Opal pack odds, GTA VI pre-order hype"}' >/dev/null
echo "✅ Warm-up complete."
```

### Ready-to-Drop Implementation 2: Unified Deep Health Check (`src/app/api/health/route.ts`)
```typescript
import { NextRequest, NextResponse } from "next/server";
import { GET as getSpanner } from "./spanner/route";
import { GET as getServices } from "./services/route";
import { GET as getModels } from "./models/route";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const deep = request.nextUrl.searchParams.get("deep") === "1";
  const started = Date.now();

  const [spannerRes, servicesRes, modelsRes] = await Promise.all([
    getSpanner(),
    getServices(),
    deep ? getModels() : Promise.resolve(null),
  ]);

  const spanner = await spannerRes.json();
  const services = await servicesRes.json();
  const models = modelsRes ? await modelsRes.json() : undefined;

  const ok = Boolean(spanner.ok && services.ok && (!deep || models?.ok));
  return NextResponse.json(
    {
      ok,
      deep,
      latencyMs: Date.now() - started,
      spanner,
      services: services.services,
      models: models?.models,
      checkedAt: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  );
}
```

### Ready-to-Drop Implementation 3: Demo State Reset (`scripts/reset_state.sh`)
```bash
#!/usr/bin/env bash
# Reset BigQuery demo-session tables (saved_audiences, activation_log) between EBC briefings in <2s.
set -euo pipefail
PROJECT_ID="${GCP_PROJECT_ID:-jamie-bq-test}"
DATASET_ID="${BQ_DATASET_ID:-twok_marketing_intelligence}"

echo "🔄 Resetting BigQuery demo tables in ${PROJECT_ID}:${DATASET_ID}..."
bq query --project_id="${PROJECT_ID}" --use_legacy_sql=false \
  "DELETE FROM \`${PROJECT_ID}.${DATASET_ID}.saved_audiences\` WHERE TRUE;
   DELETE FROM \`${PROJECT_ID}.${DATASET_ID}.activation_log\` WHERE TRUE;"
echo "✅ Demo state reset complete."
```

---

## 5. Prioritized Remediation Roadmap

1. **P0 — Eliminate All `try / catch` Data Fallbacks in Focus Group Evaluation ([`src/lib/focus-group-eval.ts:58-92`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L58-L92), [`164-205`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/focus-group-eval.ts#L164-L205), [`src/app/api/synthetic/focus-group/stream/route.ts:66-131`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/synthetic/focus-group/stream/route.ts#L66-L131))**:
   - Remove the persona and consensus `catch` blocks returning hardcoded quotes, conversion lifts, and WTP curves. Enforce live Vertex AI execution for both primary and `altPriceUsd` Offer Battle evaluations, failing loudly with `HTTP 502/503` on error.
2. **P0 — Replace `SYNTHETIC_FALLBACK_PERSONAS` with Live Spanner Player Sampling ([`src/app/api/synthetic/focus-group/route.ts:24-28`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/synthetic/focus-group/route.ts#L24-L28), [`stream/route.ts:20-24`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/synthetic/focus-group/stream/route.ts#L20-L24), [`FocusGroupModal.tsx:166`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/focusgroup/FocusGroupModal.tsx#L166))**:
   - Query `getPlayersForView({ franchise, limit: 20 })` from Cloud Spanner whenever fewer than 20 players are provided by the client.
3. **P0 — Remove Swallowed Gemini Exceptions in Campaign Brief, Journey Summary, Core Finding & NL-Query ([`campaign/brief/route.ts:23-33, 87-125`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/campaign/brief/route.ts#L23-L33), [`journey/summary/route.ts:297-321, 348-370`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/marketing/journey/summary/route.ts#L297-L321), [`core-finding/route.ts:55-89`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/insights/core-finding/route.ts#L55-L89), [`nl-query/route.ts:196-305`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/audiences/nl-query/route.ts#L196-L305))**:
   - Let `GenAIError` and `SpannerUnavailableError` propagate to return `HTTP 502/503` instead of masking failures with canned text or fallback GQL.
4. **P1 — Remove Local JSON & Canned Fallbacks in Python ADK Fleet ([`agents/app/tools/bq_tools.py:32-41`](file:///Users/jlpourt/CCAI/ea-audiences/agents/app/tools/bq_tools.py#L32-L41), [`spanner_graph_tools.py:27-35`](file:///Users/jlpourt/CCAI/ea-audiences/agents/app/tools/spanner_graph_tools.py#L27-L35), [`audience_agent.py:59-111`](file:///Users/jlpourt/CCAI/ea-audiences/agents/app/sub_agents/audience_agent.py#L59-L111), [`focus_group_agent.py:148-208`](file:///Users/jlpourt/CCAI/ea-audiences/agents/app/sub_agents/focus_group_agent.py#L148-L208))**:
   - Delete all `data/*.json` fallback reads and hardcoded `PersonaReaction` lists in `agents/app/`.
5. **P1 — Remove Fake Latency in `ActivationDAG.tsx` & Seeded Fake Events in `/api/a2a` ([`ActivationDAG.tsx:78-80`](file:///Users/jlpourt/CCAI/ea-audiences/src/components/activation/ActivationDAG.tsx#L78-L80), [`src/app/api/a2a/route.ts:8-54`](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/a2a/route.ts#L8-L54), [`official-server.ts:114-117`](file:///Users/jlpourt/CCAI/ea-audiences/src/lib/a2a/official-server.ts#L114-L117))**:
   - Drive DAG step states from actual completed brief/creative/dispatch state rather than `setTimeout`, and remove hardcoded initial A2A messages.
6. **P2 — Add Demo-Day Operational Scripts & Synthetic Dataset UI Badge**:
   - Add `src/app/api/health/route.ts` (`?deep=1`), `scripts/warm_cache.sh`, `scripts/reset_state.sh`, `# SYNTHETIC_EBC_SEED_DATA` header in `scripts/generate_2k_dataset.py`, and a subtle *"Synthetic EBC Simulation Dataset"* badge in `CourtsideLanding.tsx`.
