# Demo Readiness Report: 2K Courtside (Audience Builder & Segmentation Engine)

**Generated:** 2026-10-12
**Target Application:** `/Users/jlpourt/CCAI/ea-audiences`
**Overall Verdict:** **NOT READY (5 of 7 moments fully ready, 2 moments degraded/failing)**

---

## 1. Moment Evaluation Table (in Script Order)

| # | Moment / Beat | Status | Component(s) & Routes | What's Wrong | Concrete Fix |
|---|---|---|---|---|---|
| **1** | **Beat 1: Courtside Landing**<br>Countdown, Core Finding, 3 Golden Plays, AudienceBuilder Island | ✅ READY | `CourtsideLanding.tsx`<br>`AudienceBuilder.tsx`<br>`LiveCountTicker.tsx`<br>`GqlDisclosure.tsx`<br>`/api/insights/core-finding`<br>`/api/insights/graph-stats` | Fully wired. S1 countdown (`14d left · Oct 16`), GTA VI (`T-48d · Nov 19`), 3 golden plays with counts (284, 303, 176), and GQL disclosure all work. | *None.* |
| **2** | **Beat 2: Graph Workspace**<br>ForceGraph Canvas, Controls, Inspector, NL Search, Spanner Status | ⚠️ WARN | `ForceGraphCanvas.tsx`<br>`GraphControls.tsx`<br>`EntityInspector.tsx`<br>`NLSearchBar.tsx`<br>`SpannerStatusPill.tsx`<br>`/api/graph/view` | 1) `single-identity` view mode is accessible only implicitly via node clicks; no direct tab button exists in `GraphControls.tsx`.<br>2) Social Bridge highlight toggle (`highlightBridges`) is only available inside `EntityInspector.tsx` and absent from main `GraphControls.tsx` header toolbar. | Add `single-identity` and "Highlight Bridges" controls into `GraphControls.tsx`. |
| **3** | **Beat 3: Multi-Hop Traversal & Entity Inspector**<br>IdentityTree, PlaystyleRadar, MyPLAYER build, VC Wallet, Gravity, Creator influence | ❌ NOT READY | `EntityInspector.tsx`<br>`IdentityTree.tsx`<br>`PlaystyleRadar.tsx` | 1) **`IdentityTree.tsx` is completely orphaned** (0 imports in app). Take-Two Identity Spine with linked platform confidence badges is never rendered.<br>2) Creator influence (`followed_creators`, `primary_creator_influence`, `CREATOR` nodes) is queryable in Spanner but omitted from UI; clicking a `CREATOR` node shows a generic fallback hub message. | Mount `<IdentityTree identities={node.linked_identities || []} masterId={node.master_player_id || node.id} />` in `EntityInspector.tsx:368`. Add Creator profile card when `node.type === 'CREATOR'` or when a player follows creators. |
| **4** | **Beat 4: Courtside Focus Group**<br>20 Personas, Offer Battle ($14.99 vs $19.99), WTP Curve, Interrogation, Reddit Pulse | ⚠️ WARN | `FocusGroupModal.tsx`<br>`PersonaInterrogationDrawer.tsx`<br>`RedditPulseCard.tsx`<br>`/api/synthetic/focus-group`<br>`/api/synthetic/focus-group/stream`<br>`/api/synthetic/focus-group/interrogate`<br>`/api/social/reddit-pulse` | `FocusGroupModal.tsx:186` invokes the monolithic batch endpoint (`/api/synthetic/focus-group`) instead of the SSE streaming endpoint (`/api/synthetic/focus-group/stream`). `streamProgress` remains static and evaluation cannot stream live verdicts. | Switch `handleRunPressureTest` in `FocusGroupModal.tsx` to read the SSE stream from `/api/synthetic/focus-group/stream` via `EventSource` or `fetch` body reader. |
| **5** | **Beat 5: Multimodal Creative Studio**<br>Pack Art (CompareSlider), Announcer VO, Lyria 2 Hype Bed, HoldToConfirm | ✅ READY | `CreativeStudioPanel.tsx`<br>`CompareSlider.tsx`<br>`WaveformButton.tsx`<br>`HoldToConfirm.tsx`<br>`/api/creative/image`<br>`/api/creative/voice`<br>`/api/creative/music` | Fully wired. Image generation with before/after slider, Gemini TTS VO playback, Lyria 2 music generation, and continuous hold approval are functional. | *None.* |
| **6** | **Beat 6: Campaign Brief & Save Audience**<br>Executive Brief Modal, Audio Briefing, Save Audience to BigQuery | ✅ READY | `CampaignBriefModal.tsx`<br>`SaveAudienceSheet.tsx`<br>`SavedAudiencesDrawer.tsx`<br>`/api/campaign/brief`<br>`/api/creative/brief-audio`<br>`/api/audiences/save`<br>`/api/audiences/saved` | Fully wired to BigQuery `saved_audiences` table with lookalike expansion and audio executive brief synthesis. | *None.* |
| **7** | **Beat 7: Sankey, NBA Market Map, Live Telemetry, & Activation DAG**<br>Season 1->2 Sankey, 36 DMA Map, Telemetry Ticker, Pub/Sub Activation | ⚠️ WARN | `SeasonJourneySankey.tsx`<br>`NBAMarketMap.tsx`<br>`LiveTelemetryTicker.tsx`<br>`ActivationDAG.tsx`<br>`ActivationFeed.tsx`<br>`/api/marketing/journey/summary`<br>`/api/marketing/markets`<br>`/api/simulation/triggers`<br>`/api/activation/dispatch` | 1) In `src/app/page.tsx:502`, `<NBAMarketMap />` is rendered without `onReturnToGraph`, hiding the "← Graph Canvas" return button.<br>2) In `src/app/page.tsx:214-228`, selecting a player from `LiveTelemetryTicker` not already in memory loads single-identity view but fails to set `selectedNode`, leaving the inspector on cohort summary. | 1) Pass `onReturnToGraph={() => setCurrentView('audience-cohorts')}` to `<NBAMarketMap />`.<br>2) In `fetchGraphView`, select the fetched player node once response arrives. |

---

## 2. Critical UI State Transition Bugs

### Bug A: Modals Not Mounted in Landing View (`src/app/page.tsx:281-382`)
- **Impact**: HIGH / DEMO BLOCKER.
- **Root Cause**: When `showLanding === true`, `src/app/page.tsx` renders `CourtsideLanding`, `FocusGroupModal`, `CreativeStudioPanel`, `SaveAudienceSheet`, `SavedAudiencesDrawer`, and `ActivationFeed`, but **omits `CampaignBriefModal` and `ActivationDAG`**.
- **Demonstration Failure**: If the presenter opens `FocusGroupModal` from the Landing page, finishes an evaluation, and clicks "Generate Campaign Brief", `setIsBriefModalOpen(true)` is executed, but `CampaignBriefModal` is not mounted, so nothing renders. Similarly, clicking "Activate" in `SavedAudiencesDrawer` or confirming in `CreativeStudioPanel` sets `isActivationDagOpen(true)`, but `ActivationDAG` does not render.
- **Fix**: Move `<CampaignBriefModal />` and `<ActivationDAG />` outside the `if (showLanding)` conditional or mount them inside the Landing view return tree.

---

## 3. Orphaned Components Audit

1. **`src/components/sidebar/IdentityTree.tsx`**:
   - **Status**: Orphaned (`reachable_file: false`, 0 consumer imports).
   - **Purpose**: Multi-platform Take-Two Identity Spine showing 2K Account, Rockstar Social Club, Zynga ID, PSN, and Xbox with confidence scores.
   - **Recommendation**: Mount in `src/components/sidebar/EntityInspector.tsx` inside the player detail view right above or below Cross-Label Gravity.

2. **`src/components/simulation/SimulationClock.tsx`**:
   - **Status**: Orphaned (`reachable_file: false`, 0 consumer imports).
   - **Purpose**: Step-by-step playback HUD for live telemetry ticks (`/api/simulation/triggers`).
   - **Recommendation**: Mount in `NBAMarketMap.tsx` or `GraphStage.tsx` as an optional manual telemetry clock controller, or remove if `LiveTelemetryTicker.tsx` fully supersedes it.

---

## 4. Ranked Remediation Plan

1. **Rank 1 (Landing View Modal Drop)**: In `src/app/page.tsx:281-382`, mount `<CampaignBriefModal />` and `<ActivationDAG />` inside the `showLanding` tree so brief generation and DAG activation work from the landing page.
2. **Rank 2 (Mount `IdentityTree.tsx`)**: Import and mount `IdentityTree` in `src/components/sidebar/EntityInspector.tsx` using `node.linked_identities` and `node.master_player_id`.
3. **Rank 3 (Player Desync on Ticker Click)**: In `src/app/page.tsx:214-228`, update `onSelectPlayerEvent` and `fetchGraphView` so that when `view === 'single-identity'` finishes fetching, the node matching `playerId` is immediately set to `selectedNode`.
4. **Rank 4 (Wire NBAMarketMap Return Button)**: In `src/app/page.tsx:502`, pass `onReturnToGraph={() => setCurrentView('audience-cohorts')}` to `<NBAMarketMap />`.
5. **Rank 5 (Enable SSE Streaming in Focus Group)**: In `src/components/focusgroup/FocusGroupModal.tsx:186`, switch from batch `/api/synthetic/focus-group` to `/api/synthetic/focus-group/stream` and update persona reaction cards incrementally as chunks arrive.
6. **Rank 6 (Add Creator Details in EntityInspector)**: Render followed creators and primary creator influence in `EntityInspector.tsx` for player and creator nodes.
