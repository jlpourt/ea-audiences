# 2K Courtside — Audience Builder & Segmentation Engine

**NBA 2K27-forward marketing audience builder, cross-label identity graph, synthetic focus group, multimodal creative studio, and multi-channel activation engine across Take-Two Interactive (`2K`, `Rockstar Games`, `Zynga`), built on Google Cloud & Vertex AI.**

---

## Executive Narrative — October 2, 2026

Today is **Friday, October 2, 2026** — four weeks into **NBA 2K27** (launched September 4, 2026, Shai Gilgeous-Alexander Standard cover & Caitlin Clark Deluxe cover), **14 days before Season 1 closes on October 16**, and **48 days before Grand Theft Auto VI launches on November 19, 2026**.

Take-Two Growth Marketing faces three high-stakes plays inside a single 14-day window:

1. **Play 1 — The Season 2 Cliff Rescue (`284` players live in Spanner)**: Four weeks after launch, MyCAREER builds stalled below **85 OVR** who spent **$50+ in VC** and haven't logged in for **7+ days** are on the Season 2 cliff—except **284** of them still have at least one active **Rec / Pro-Am Crew mate** logging in this week. Target the Crew bond with a **$4.99 Crew Re-Up Bundle** (`15,000 VC + 2× Crew Rep Weekend Token`).
2. **Play 2 — Cross-Label Gravity (`303` players live in Spanner)**: **303** NBA 2K27 players are linked to **Rockstar Social Club**, have spent **$75+ in GTA Online**, and have **not yet pre-ordered GTA VI** (`T−48 days`). One graph hop across `HasIdentity` and `PlaysGame` bridges 2K Red (`#E4002B`) to Rockstar Gold (`#F5B400`).
3. **Play 3 — MyTEAM Galaxy Opal Pack Whale Calibration (`176` players live in Spanner)**: Pressure-test **$14.99 vs. $19.99** on the **Season 2 Tip-Off Galaxy Opal Deluxe Pack** with a 20-persona Courtside Focus Group grounded against live `r/NBA2K` and `r/MyTEAM` sentiment before shipping a single price tag to The City.

---

## Live Google Cloud Architecture (`jamie-bq-test`)

| Layer | Google Cloud Service | Live Resource | Purpose |
|---|---|---|---|
| **Identity & Social Graph** | **Cloud Spanner Graph** (ISO GQL) | `blackrock-spanner / twok_graph_db` (`TakeTwoPlayerGraph`) | 2,850 players, 18 Take-Two titles (`2K`, `ROCKSTAR`, `ZYNGA`), 48 Crews, 16 Creators, 29 Offers, 7,472 linked identities (`2K Account`, `Rockstar Social Club`, `PSN`, `Xbox`, `Steam`, `Zynga ID`), 10,522 `PlaysGame` edges, 6,099 `TelemetryEvents` |
| **Analytical Warehouse & Persistence** | **BigQuery** | `jamie-bq-test.twok_marketing_intelligence` | `telemetry_events` (6,099 rows), `saved_audiences`, `activation_log` |
| **Multimodal Asset CDN** | **Cloud Storage** | `gs://twok-courtside-media-jamie-bq-test` | Generated MyTEAM pack art (`images/*.png`), Arena PA voiceovers (`audio/*.wav`), Lyria 2 hype beds (`music/*.wav`), executive brief audio (`briefs/*.wav`) |
| **Event Bus & Dispatch** | **Cloud Pub/Sub** | `twok-courtside-activations` | Real-time multi-channel audience dispatch (`IN_GAME_INBOX`, `2K_ACCOUNT_EMAIL`, `PUSH_2K_MOBILE`, `ROCKSTAR_NEWSWIRE`, `XBOX_PSN_FEED`, `DISCORD_WEBHOOK`) |
| **Container Runtime** | **Cloud Run** | `us-central1` | Next.js 16 App Router + Vertex AI GenAI SDK (`@google/genai`) |

---

## Live Vertex AI Model Registry (`src/lib/models.ts`)

Every AI feature in 2K Courtside calls a dedicated Vertex AI model and surfaces its model badge and live latency in the UI:

| Role | Model ID | Region | Feature Surface |
|---|---|---|---|
| `REASONING` | `gemini-3.1-pro-preview` | `global` | NL → Spanner ISO GQL compiler, Focus Group consensus & WTP pricing curve, Campaign Brief synthesis, Persona interrogation |
| `FAST` | `gemini-3.5-flash` | `global` | 20-persona parallel Courtside Focus Group evaluation, Season 1→2 Sankey lifecycle diagnosis, Core Finding card |
| `LITE` | `gemini-3.5-flash-lite` | `global` | Sub-second pill suggestions, Arena PA script drafting, Reddit Pulse JSON structuring |
| `GROUNDED` | `gemini-3.5-flash` + `googleSearch` | `global` | Live Google Search grounding across `r/NBA2K`, `r/MyTEAM`, and `r/GTA6` |
| `IMAGE` | `gemini-2.5-flash-image` | `us-central1` | Live MyTEAM Galaxy Opal pack & Crew Re-Up promo key art generation |
| `TTS` | `gemini-3.1-flash-tts-preview` | `us-central1` | Arena PA announcer voiceover (`Charon`, `Fenrir`, `Kore`) & "Hear the Brief" executive audio |
| `MUSIC` | `lyria-002` | `us-central1` | 30-second 48kHz stereo Arena tunnel walkout & MyTEAM pack-rip instrumental beds |
| `EMBED` | `gemini-embedding-001` | `us-central1` | 3,072-dimensional vector lookalike audience expansion (`findLookalikes`) |

---

## Local Development & Verification

```bash
# 1. Install dependencies
npm install

# 2. Verify all 8 live Vertex AI models
npx tsx scripts/smoke_models.mjs

# 3. Validate the Take-Two synthetic dataset
python3 scripts/validate_dataset.py

# 4. Run development server on 127.0.0.1:3005
npx next dev -p 3005 -H 127.0.0.1
```
