# 2K Games / Take-Two Interactive — Brand Voice & Copy Audit (`voice.md`)

**Product**: 2K Courtside — Audience Builder & Segmentation Engine (`TakeTwoPlayerGraph`)  
**Customer**: 2K Games & Take-Two Interactive Software, Inc. (`https://2k.com`, `https://nba.2k.com`, `https://www.take2games.com`)  
**Audited At**: `2026-10-12`

---

## 1. Reading Level, Cadence & Punctuation Discipline

| Dimension | Specification | Observed Public Exemplar (`nba.2k.com` / `2k.com`) |
|---|---|---|
| **Flesch-Kincaid Grade Level** | **Grade 7.5–8.5** for player-facing offers, Courtside Reports, and Season headlines; **Grade 9.5–10.5** for internal Take-Two Growth Marketing & Live-Ops telemetry surfaces | *"Leave no doubt you run the court in NBA 2K, featuring immersive MyCAREER, MyTEAM, and MyNBA game modes, Powered by ProPLAY®."* |
| **Average Sentence Length** | **11–15 words** on headlines, playbook cards, and telemetry rows; **<= 20 words** on executive insight banners | *"Build the audience. Pressure-test it. Put it on the floor."* (10 words across 3 punchy sentences) |
| **Voice Posture** | **100% Active, Imperative, Broadcast-Table Authority**. Write like an NBA Courtside Report producer and a Take-Two Live-Ops director—never like a generic SaaS dashboard or cloud vendor brochure | Imperative verbs: *Target*, *Bridge*, *Pressure-Test*, *Dispatch*, *Re-Up*, *Break the Cap* |
| **Punctuation Habits** | **Zero em-dashes (`—`)**. Use middots (`·`), colons (`:`), or crisp periods (`.`). Repository static scan currently flags **76 em-dashes** that should be replaced with `·` or `.` | `NBA 2K27 · Season 1 · 14d left · Oct 16` |
| **Numeric Discipline** | Mandatory `font-variant-numeric: tabular-nums` (`.tabular` / `.font-mono`) on every player count, OVR rating, VC balance, dollar figure, countdown (`T−48d`), and latency (`ms`) | `284 players · 83 OVR · 15,000 VC · $4.99` |

---

## 2. Customer Terminology & Lexicon Translation Matrix

### 2A. Showroom 7-Row Enterprise Lexicon Matrix (Take-Two / 2K Edition)

| # | Enterprise Category | Generic / Prior-Brand Term (AVOID) | Authentic 2K / Take-Two Term (USE) | Operational Context in 2K Courtside |
|---|---|---|---|---|
| **1** | **Employees / Associates / Studios** | Employees, Associates, Devs, Business Units | **Publishing Labels & Studios** (*2K*, *Visual Concepts*, *Firaxis Games*, *Gearbox*, *Rockstar Games*, *Zynga*) | Cross-label growth marketing and live-ops teams operating across Take-Two's portfolio |
| **2** | **Customers / End Users** | Users, Subscribers, Shoppers, Consumers, Gamers | **Players / Ballers / Hoop Heads / MyPLAYERs / Crew Mates / Collectors** | Segmented by play style (*Park Grinder*, *Rec Squad*, *MyTEAM Whale*, *GTA Online Shark Card Veteran*) |
| **3** | **Private Label / Own Brand / Currencies** | Credits, Points, Tokens, In-App Purchases (IAP), Microtransactions | **Virtual Currency (VC)**, **MyTEAM Points (MTP)**, **Recurrent Consumer Spending (RCS)**, **Shark Cards** | Take-Two's core monetization metric (**RCS** represents ~79–80% of total Net Bookings) |
| **4** | **Loyalty & Promotions / Live-Ops** | Loyalty Tier, Promo Code, Seasonal Sale, Battle Pass | **Season Pass** (*Pro Pass*, *Hall of Fame Pass*), **Locker Codes**, **2× Crew Rep Weekend**, **Cap Breakers**, **Galaxy Opal / Dark Matter Drops** | 6-week NBA 2K Seasonal lifecycle transitions (Season 1 → Season 2 cliff) and pack drops |
| **5** | **Fulfillment / Pickup / Activation Channels** | Email Blast, Push Notification, Storefront Banner, Webhook | **In-Game Inbox (The City)**, **2K Account Email**, **MyNBA 2K Companion Push**, **Rockstar Newswire**, **PSN / Xbox Live Feed**, **Discord Crew Webhook** | Multi-channel player dispatch triggered via `ActivationDAG` and `SaveAudienceSheet` |
| **6** | **Frontline Handheld / App / Companion** | Mobile App, Admin Portal, Analytics Tool, AI Assistant | **2K Courtside**, **TakeTwoPlayerGraph**, **MyNBA 2K Companion App**, **Courtside Report**, **2K Support** | First-party identity graph and live-ops segmentation console |
| **7** | **Local / Emerging Vendors / Community** | Influencers, Affiliates, Third-Party Forums | **2K NextMakers**, **Courtside Creators**, **Crew Captains**, **`r/NBA2K` / `r/MyTEAM` / `r/GTA6` Community Pulse** | Creator amplification nodes and live community sentiment grounding |

### 2B. 2K & Take-Two Game Mode & Progression Glossary

- **`MyCAREER` & `MyPLAYER`**: Single-player and online career progression mode where players build an archetype and upgrade attributes from `60 OVR` to `99 OVR` using **VC**.
- **`Sub-85 OVR Cliff`**: The critical progression friction point in Weeks 4–6 of Season 1 where builds stalled between `78–84 OVR` face high churn risk before Season 2 tip-off unless anchored by an active **Crew**.
- **`Cap Breakers`**: Progression mechanic allowing players to push specific attribute ratings past their initial archetype builder caps—a major driver of `r/NBA2K` theorycrafting and retention.
- **`The City` / `Park` / `The Rec` / `Pro-Am`**:
  - **The City**: Open-world online basketball hub on current-gen consoles.
  - **Park**: 3v3 streetball courts inside The City.
  - **The Rec**: 5v5 walk-on / squad indoor regulation games.
  - **Pro-Am**: Ranked 3v3 and 5v5 competitive team play with custom jerseys and arenas.
- **`Crews` & `Crew Re-Up`**: Persistent social squads across The City, Rec, and Pro-Am. An active Crew mate logging in within the last 7 days is the #1 social retention anchor for a lapsing MyPLAYER.
- **`MyTEAM` Card Tiers**: Collectible team-building mode ordered by gem tier—*Amethyst*, *Diamond*, *Pink Diamond*, **Galaxy Opal**, **Dark Matter**, and *100 OVR*.
- **Cross-Label Identity Bridge (`2K Account` ↔ `Rockstar Games Social Club` ↔ `Zynga ID`)**: Multi-hop identity linkage across Take-Two labels used to bridge high-LTV NBA 2K27 players into **Grand Theft Auto VI** pre-orders and Zynga mobile titles (*Top Troops*, *CSR Racing*, *Words With Friends*).

---

## 3. Banned Vocabulary (Zero Tolerance)

1. **Banned AI Slop Buzzwords**:
   - Never use: `synergy`, `seamless`, `seamlessly`, `unlock`, `delve`, `empower`, `revolutionize`, `harness`, `next-gen`, `supercharge`, `holistic`, `paradigm`, `ecosystem`.
   - *Active repo violations found*: `Synergy` in `src/components/journey/SeasonJourneySankey.tsx:69`, `src/app/api/marketing/journey/summary/route.ts:56`, `src/app/api/simulation/triggers/route.ts:35`, `agents/app/sub_agents/focus_group_agent.py:186`; `Unlock` in `src/app/api/campaign/brief/route.ts:117`; `seamlessly` in `src/app/api/creative/image/route.ts:20`.
2. **Banned Exposed Cloud / LLM Plumbing in Customer UI Chrome**:
   - Customer-facing pills, headers, footers, loading states, and comparison sliders must look like **2K / Take-Two first-party software**—not a Google Cloud infrastructure advertisement.
   - Replace raw vendor strings in UI copy (`Cloud Spanner`, `Spanner Graph`, `BigQuery`, `Vertex AI`, `Gemini 3.1 Pro`, `Gemini 3.5 Flash`, `Gemini 2.5 Flash Render`) with authentic Take-Two product nomenclature (`TakeTwoPlayerGraph`, `Courtside Intelligence`, `Courtside GQL Engine`, `Personalized Courtside Key Art`).
3. **Banned Magic-Wand / Sparkle Icons (`Sparkles`, `Wand2`)**:
   - Replace `lucide-react` `Sparkles` and `Wand2` icons in `src/components/` with domain-authentic operational icons (`Target`, `Radio`, `Crosshair`, `Cpu`, `Flame`, `Layers`, `Sliders`).

---

## 4. Ten Concrete Before / After Copy Rewrites in `src/components/`

### Rewrite 1 — Landing Hero Subheadline (`CourtsideLanding.tsx`)
- **Location**: [src/components/landing/CourtsideLanding.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/landing/CourtsideLanding.tsx#L265-L271)
- **Before**:
  ```tsx
  Multi-hop audience segmentation across{" "}
  <span className="text-chalk font-medium">TakeTwoPlayerGraph</span>{" "}
  connecting NBA 2K27 MyPLAYER builds, Crews, Rockstar Social Club,
  and Zynga IDs — powered by Cloud Spanner Graph, BigQuery, and
  Vertex AI Gemini 3.
  ```
- **After**:
  ```tsx
  Multi-hop audience segmentation across{" "}
  <span className="text-chalk font-medium">TakeTwoPlayerGraph</span>{" "}
  connecting NBA 2K27 MyPLAYER builds, Rec Crews, Rockstar Social Club,
  and Zynga IDs · real-time cohort sizing, Courtside Focus Groups, and
  live multi-channel dispatch.
  ```
- **Rationale**: Eliminates both the em-dash (`—`) and the exposed Google Cloud product list (`Cloud Spanner Graph, BigQuery, and Vertex AI Gemini 3`) in the hero subheadline, replacing them with concrete Take-Two marketing capabilities.

### Rewrite 2 — Golden Plays Playbook Subtitle (`CourtsideLanding.tsx`)
- **Location**: [src/components/landing/CourtsideLanding.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/landing/CourtsideLanding.tsx#L330-L333)
- **Before**:
  ```tsx
  <span className="text-caption">Courtside Playbook · Three Golden Plays</span>
  <span className="font-mono text-[11px] text-chalk-dim">
    Click any play to execute live GQL on Spanner &amp; open the graph
  </span>
  ```
- **After**:
  ```tsx
  <span className="text-caption">Courtside Playbook · Three Golden Plays</span>
  <span className="font-mono text-[11px] text-chalk-dim">
    Select any play to run live graph traversal on TakeTwoPlayerGraph
  </span>
  ```
- **Rationale**: Replaces raw `on Spanner` infrastructure jargon with the customer's first-party identity graph name (`TakeTwoPlayerGraph`).

### Rewrite 3 — Landing Page Footer Telemetry Strip (`CourtsideLanding.tsx`)
- **Location**: [src/components/landing/CourtsideLanding.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/landing/CourtsideLanding.tsx#L440-L459)
- **Before**:
  ```tsx
  <span>Cloud Spanner Graph · blackrock-spanner/twok_graph_db</span>
  <span>·</span>
  <span>BigQuery · twok_marketing_intelligence</span>
  <span>·</span>
  <span>Pub/Sub · twok-courtside-activations</span>
  ...
  <span>Gemini 3.1 Pro</span> · <span>Gemini 3.5 Flash</span> · <span>Flash Image</span> · <span>Flash TTS</span> · <span>Lyria 2</span>
  ```
- **After**:
  ```tsx
  <span>TakeTwoPlayerGraph · 2,850 Players · 7,472 Linked IDs</span>
  <span>·</span>
  <span>Courtside Telemetry Warehouse · 6,099 Events</span>
  <span>·</span>
  <span>Live-Ops Dispatch Bus · 6 Channels Active</span>
  ...
  <span>2K · Rockstar Games · Zynga Cross-Label Growth Intelligence</span>
  ```
- **Rationale**: Removes internal GCP instance/dataset identifiers (`blackrock-spanner/twok_graph_db`) and raw model SKUs from the customer-facing footer, replacing them with live Take-Two operational telemetry.

### Rewrite 4 — Season 1 → Season 2 Sankey Stage 1 Header (`SeasonJourneySankey.tsx`)
- **Location**: [src/components/journey/SeasonJourneySankey.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/journey/SeasonJourneySankey.tsx#L68-L74)
- **Before**:
  ```tsx
  const STAGE_HEADERS = [
    { index: 0, title: "1. Acquisition", subtitle: "Launch & Synergy" },
    { index: 1, title: "2. Mode Entry", subtitle: "City / Team / W" },
    { index: 2, title: "3. Week 4–6 Status", subtitle: "Progression & Friction" },
  ```
- **After**:
  ```tsx
  const STAGE_HEADERS = [
    { index: 0, title: "1. Tip-Off Cohort", subtitle: "Launch & Cross-Label" },
    { index: 1, title: "2. Mode Entry", subtitle: "The City · MyTEAM · The W" },
    { index: 2, title: "3. Week 4-6 Status", subtitle: "OVR Cap & Build Friction" },
  ```
- **Rationale**: Eliminates the banned AI slop word `Synergy` in Stage 1 and sharpens Stage 2/3 subtitles into authentic NBA 2K terminology (`Tip-Off Cohort`, `Cross-Label`, `OVR Cap & Build Friction`).

### Rewrite 5 — Sankey Header Badge & Loading Overlay (`SeasonJourneySankey.tsx`)
- **Location**: [src/components/journey/SeasonJourneySankey.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/journey/SeasonJourneySankey.tsx#L237-L239) and [line 306](file:///Users/jlpourt/CCAI/ea-audiences/src/components/journey/SeasonJourneySankey.tsx#L306)
- **Before**:
  ```tsx
  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E4002B]/20 text-[#E4002B] font-mono font-medium border border-[#E4002B]/30">
    LIVE SPANNER
  </span>
  ...
  <span>Computing Take-Two Spanner Graph Trajectories...</span>
  ```
- **After**:
  ```tsx
  <span className="text-[10px] px-2 py-0.5 rounded-full bg-twok-red/20 text-twok-red font-mono font-medium border border-twok-red/30">
    LIVE PLAYER GRAPH
  </span>
  ...
  <span>Tracing Season 1 → Season 2 MyPLAYER trajectories across TakeTwoPlayerGraph...</span>
  ```
- **Rationale**: Replaces `LIVE SPANNER` and `Spanner Graph` with `LIVE PLAYER GRAPH` / `TakeTwoPlayerGraph`, and fixes the hardcoded `#E4002B` hex to `twok-red` (`#EA2228`).

### Rewrite 6 — Entity Inspector Cohort Status Pill (`EntityInspector.tsx`)
- **Location**: [src/components/sidebar/EntityInspector.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/sidebar/EntityInspector.tsx#L436-L439)
- **Before**:
  ```tsx
  <span className="inline-flex items-center gap-1.5 rounded-full border border-win-green/35 bg-win-green/10 px-2 py-0.5 font-mono text-[10px] text-win-green">
    <span className="h-1.5 w-1.5 rounded-full bg-win-green" />
    Spanner Graph · LIVE
  </span>
  ```
- **After**:
  ```tsx
  <span className="inline-flex items-center gap-1.5 rounded-full border border-win-green/35 bg-win-green/10 px-2 py-0.5 font-mono text-[10px] text-win-green">
    <span className="h-1.5 w-1.5 rounded-full bg-win-green" />
    TakeTwoPlayerGraph · LIVE
  </span>
  ```
- **Rationale**: Aligns the Cohort Summary drawer status pill with the top navigation pill (`TakeTwoPlayerGraph · LIVE`) and removes the exposed GCP database product name.

### Rewrite 7 — Bottom Telemetry Ticker Initial Stream Copy (`LiveTelemetryTicker.tsx`)
- **Location**: [src/components/activation/LiveTelemetryTicker.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/activation/LiveTelemetryTicker.tsx#L135-L138)
- **Before**:
  ```tsx
  <div className="flex items-center gap-2 text-white/40 text-[11px]">
    <Activity className="w-3.5 h-3.5 animate-pulse text-[#19C37D]" />
    <span>Streaming Take-Two live telemetry triggers from Spanner...</span>
  </div>
  ```
- **After**:
  ```tsx
  <div className="flex items-center gap-2 text-white/40 text-[11px]">
    <Activity className="w-3.5 h-3.5 animate-pulse text-win-green" />
    <span>Streaming live Courtside telemetry triggers from TakeTwoPlayerGraph...</span>
  </div>
- **Rationale**: Replaces `from Spanner...` with `from TakeTwoPlayerGraph...` so the persistent arena ticker speaks in customer domain language.

### Rewrite 8 — Audience Builder Live Count Ticker Status Copy (`LiveCountTicker.tsx`)
- **Location**: [src/components/audience/LiveCountTicker.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/audience/LiveCountTicker.tsx#L46-L54)
- **Before**:
  ```tsx
  <span>
    {status === "translating"
      ? "Translating NL → GQL"
      : status === "counting"
        ? "Querying Spanner Graph"
        : status === "error"
          ? "Spanner Error"
          : "Spanner · LIVE"}
  </span>
  ```
- **After**:
  ```tsx
  <span>
    {status === "translating"
      ? "Compiling Courtside GQL"
      : status === "counting"
        ? "Traversing Player Graph"
        : status === "error"
          ? "Graph Query Error"
          : "Player Graph · LIVE"}
  </span>
  ```
- **Rationale**: Removes three separate `Spanner` strings from the primary Audience Builder counter card and replaces them with crisp graph-operational status states.

### Rewrite 9 — Save Audience Sheet Lookalike Header & Progress Copy (`SaveAudienceSheet.tsx`)
- **Location**: [src/components/audience/SaveAudienceSheet.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/audience/SaveAudienceSheet.tsx#L190-L192) and [line 223](file:///Users/jlpourt/CCAI/ea-audiences/src/components/audience/SaveAudienceSheet.tsx#L223)
- **Before**:
  ```tsx
  <span className="font-mono text-[11px] uppercase tracking-wider text-chalk-dim">
    Lookalike Expansion (Gemini Embedding)
  </span>
  ...
  <span>Scoring 3,072-d cosine similarity in Spanner…</span>
  ```
- **After**:
  ```tsx
  <span className="font-mono text-[11px] uppercase tracking-wider text-chalk-dim">
    Playstyle &amp; Spend Lookalike Expansion
  </span>
  ...
  <span>Scoring 3,072-d player-vector similarity across TakeTwoPlayerGraph...</span>
  ```
- **Rationale**: Replaces `(Gemini Embedding)` and `in Spanner…` with marketer-meaningful terminology (`Playstyle & Spend Lookalike Expansion` and `across TakeTwoPlayerGraph`).

### Rewrite 10 — Creative Studio CompareSlider Labels (`CreativeStudioPanel.tsx` & `CompareSlider.tsx`)
- **Location**: [src/components/creative/CreativeStudioPanel.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/creative/CreativeStudioPanel.tsx#L257-L259) and [src/components/brand/CompareSlider.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/brand/CompareSlider.tsx#L24-L25)
- **Before**:
  ```tsx
  beforeLabel="Standard Store Tile"
  afterLabel={generatedArtUrl ? "Gemini 2.5 Flash Render" : "Preset Hero Art"}
  ```
- **After**:
  ```tsx
  beforeLabel="Generic City Store Tile"
  afterLabel={generatedArtUrl ? "Cohort-Tailored Courtside Key Art" : "Courtside Hero Key Art"}
  ```
- **Rationale**: Removes the exposed (and outdated) `Gemini 2.5 Flash Render` label from the creative before/after slider and frames the comparison in 2K Growth Marketing terms (`Generic City Store Tile` vs. `Cohort-Tailored Courtside Key Art`).
