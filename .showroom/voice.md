# 2K Games — Brand Voice, Lexicon & Copy Audit (`voice.md`)

**Product**: 2K Courtside — Audience Intelligence Engine (`2k-miro` branch)  
**Customer**: 2K Games (`https://2k.com`, `https://nba.2k.com`)  
**Portfolio Scope**: Strictly **2K Brands** (`NBA 2K27`, `NBA 2K26`, `NBA 2K Mobile`, `WWE 2K25`, `PGA TOUR 2K25`, `Borderlands 4`, `Sid Meier's Civilization VII`)  
**Audited At**: `2026-10-13`

---

## 1. Reading Level, Cadence & Punctuation Discipline

| Dimension | Specification | Observed Public & Product Exemplar (`nba.2k.com` / `2K Courtside`) |
|---|---|---|
| **Flesch-Kincaid Grade Level** | **Grade 7.5–8.5** for player-facing offers, Courtside Reports, and Season headlines; **Grade 9.5–10.5** for internal 2K Growth Marketing, 2-Round Social Contagion Focus Group, and Live-Ops telemetry surfaces | *"High-spend NBA 2K26 veterans ($150+ VC, 90+ OVR) whose Crew mates already play NBA 2K27."* |
| **Average Sentence Length** | **11–14 words** on headlines, playbook cards, and telemetry rows; **<= 18 words** on Opportunity Brief bullets and Round 2 Crew/Creator contagion quotes | *"Builds stalled at 78-84 OVR show 2.6x higher Season 2 churn risk when solo-queuing."* (14 words) |
| **Voice Posture** | **100% Active, Imperative, Broadcast-Table Authority**. Write like an NBA 2K Courtside Report producer and a 2K Live-Ops director—never like a generic SaaS dashboard or cloud infrastructure brochure | Imperative verbs: *Explore Cohort*, *Inject Event*, *Pressure-Test*, *Re-Up*, *Break the Cap*, *Isolate Creator Followers* |
| **Punctuation Habits** | **Zero em-dashes (`—`)**. Use middots (`·`), arrows (`→`), colons (`:`), or crisp periods (`.`). Static scan confirms **0 em-dashes across `src/components/`** | `NBA 2K27 · Season 1 · 14d left · Oct 16` · `2K26 → 2K27 Migration Curve` |
| **Numeric Discipline** | Mandatory `font-variant-numeric: tabular-nums` (`.tabular` / `.font-mono` / `<TabularNumber />`) on every player count, OVR rating, VC balance, dollar figure, contagion flip delta (`+6 R2`), and latency (`19ms`) | `418 Holdout Veterans · 84 OVR · 15,000 VC · $4.99 · 3.1x Squad Multiplier` |

---

## 2. Customer Terminology & Lexicon Translation Matrix

### 2A. Showroom 7-Row Enterprise Lexicon Matrix (2K Games Edition)

| # | Enterprise Category | Generic / Prior-Brand Term (AVOID) | Authentic 2K Games Term (USE) | Operational Context in 2K Courtside (`2k-miro`) |
|---|---|---|---|---|
| **1** | **Employees / Associates / Studios** | Employees, Associates, Devs, Business Units, Rockstar/Zynga Labels | **2K Publishing & Development Studios** (*Visual Concepts*, *Firaxis Games*, *Gearbox Software*, *HB Studios*, *Cat Daddy Games*) | 2K Growth Marketing and Live-Ops teams operating across the 12-title 2K portfolio |
| **2** | **Customers / End Users** | Users, Subscribers, Shoppers, Consumers, Gamers | **Players / Ballers / MyPLAYERs / Crew Captains / Squadmates / 2K26 Holdout Veterans / MyTEAM Collectors** | Segmented by 10 behavioral archetypes (*Park Rep Grinder*, *Rec & Pro-Am Crew Captain*, *MyTEAM Pack Whale*, *2K26 Veteran & Cross-2K Bridge*) |
| **3** | **Private Label / Own Brand / Currencies** | Credits, Points, Tokens, In-App Purchases (IAP), Shark Cards | **Virtual Currency (VC)**, **MyTEAM Points (MTP)**, **Recurrent Consumer Spending (RCS)**, **Season Pass (Pro / Hall of Fame)** | 2K's core live-service monetization engine (VC bundles, Hall of Fame Pass upgrades, and MyTEAM pack drops) |
| **4** | **Loyalty & Promotions / Live-Ops** | Loyalty Tier, Promo Code, Seasonal Sale, Battle Pass | **NBA 2K26 → 2K27 Hall of Fame Loyalty Upgrade ($69.99 + 100K VC)**, **$4.99 Crew Re-Up Bundle**, **Locker Codes**, **2× Crew Rep Weekend**, **Cap Breakers**, **90 OVR Rebirth Carryover**, **Galaxy Opal Topper** | 6-week NBA 2K Seasonal lifecycle transitions (Season 1 → Season 2 cliff) and God's-Eye counterfactual event injections |
| **5** | **Fulfillment / Pickup / Activation Channels** | Email Blast, Push Notification, Storefront Banner, Rockstar Newswire, Zynga Cross-Promo | **NBA 2K27 Daily Login Tile (The City)**, **2K Account Lifecycle Email**, **MyNBA 2K Companion Push**, **2K NextMakers Creator Locker Code**, **WWE 2K25 & PGA 2K25 Cross-Promo** | Multi-channel player dispatch triggered via `ActivationDAG` with 1.4s `HoldToConfirm` HITL sign-off |
| **6** | **Frontline Handheld / App / Companion** | Mobile App, Admin Portal, Analytics Tool, AI Assistant, Cloud Spanner | **2K Courtside**, **2K Identity Graph**, **NBA 2K Mobile**, **MyNBA 2K Companion App**, **Courtside Report** | First-party 2K identity graph (`2K Graph · 19ms`) and multi-agent live-ops segmentation console |
| **7** | **Local / Emerging Vendors / Community** | Influencers, Affiliates, Third-Party Forums | **2K NextMakers**, **Courtside Creators** (*@Agent00*, *@Troydan*, *@CashNasty*, *@DBG*, *@Tydebo*, *@KOT4Q*, *@Moxsy*, *@Assemble*), **`r/NBA2K` & `r/MyTEAM` Community Pulse** | Creator Megaphone broadcasts and Round 2 social contagion drivers in `FocusGroupModal` |

### 2B. 2K Game Mode, Progression & Social Contagion Glossary

- **`MyCAREER` & `MyPLAYER`**: Core career progression mode where players create a custom build (*2-Way 3-Level Threat*, *Diming Defensive Anchor*) and upgrade attributes from `60 OVR` to `99 OVR` using **VC**.
- **`Sub-85 OVR Build Cliff`**: The primary Week 4–6 retention friction point in Season 1 where MyPLAYER builds stalled at `78–84 OVR` face 2.6× higher Season 2 churn risk unless anchored by an active **Crew**.
- **`Cap Breakers` & `Rebirth`**:
  - **Cap Breakers**: Progression tokens allowing players to push attributes past initial archetype builder caps to unlock higher Badge tiers (*Gold*, *Hall of Fame*, *Legend*).
  - **Rebirth**: Veteran progression unlock allowing players to start new MyPLAYER builds at `90 OVR` with pre-unlocked silver/gold badges—a top conversion lever for **2K26 Holdouts**.
- **`The City` / `Park` / `The Rec` / `Pro-Am Crews`**:
  - **The City**: Open-world online basketball hub on PlayStation 5, Xbox Series X|S, and PC.
  - **Park**: 3v3 streetball courts inside The City.
  - **The Rec**: 5v5 indoor regulation squad and walk-on games.
  - **Pro-Am Crews**: Persistent 3v3 and 5v5 competitive squads (`Bucket Getters`, `Dimers Only`, `Splash Bros Rec`). Active Crew captains logging into NBA 2K27 within 72 hours drive a **3.1× Squad Multiplier** on teammate upgrades and re-ups.
- **`MyTEAM Galaxy Opal` & `Dark Matter`**: Collectible card tiers in MyTEAM. Top-decile whales hold `10+ Galaxy Opals` and buy the `Hall of Fame Season Pass` ($19.99), but strongly resist `<2%` pack odds without a guaranteed topper.
- **`2K26 Holdouts` & `2K26 → 2K27 Migration Curve`**: High-spend *NBA 2K26* veterans (`$150+ VC`, `90+ OVR`) who have not yet migrated to *NBA 2K27* despite having 2+ Crew mates already active in *NBA 2K27* Season 1.
- **`2-Round Crew & Creator Social Contagion Focus Group` (`N=20 Core` / `N=100 Swarm`)**:
  - **Round 1 (`R1 · Isolated`)**: 20 core player personas (and 80 crowd swarm agents in `N=100 Swarm` mode) evaluate an offer in isolation.
  - **Creator Megaphone**: `@Agent00`, `@Troydan`, and `@DBG` broadcast live stream stances (`ENDORSE`, `MIXED`, `CALLOUT`).
  - **Round 2 (`R2 · Crew & Creator Shift`)**: Personas observe their Crew Captain's Round 1 action, Creator stream callouts, and any **God's-Eye Counterfactual Injection (`Inject Event`)**, flipping hesitant squadmates from `EVALUATING`/`ABANDONED` to `PURCHASED` (or cascading into `BOYCOTT` on overpriced packs).

---

## 3. Banned Vocabulary & Non-2K Brand Bleed Audit

### 3A. Banned AI Slop Words
- **Never use**: `ecosystem`, `synergy`, `seamless`, `seamlessly`, `unlock`, `delve`, `empower`, `revolutionize`, `harness`, `next-gen`, `supercharge`, `holistic`, `paradigm`.
- **Active Slop Hits Found on `2k-miro`**:
  1. `ecosystem` in `src/components/landing/CourtsideLanding.tsx:721`, `src/app/layout.tsx:7`, `src/app/layout.tsx:20`, `src/components/journey/SeasonJourneySankey.tsx:73`, and `src/components/brand/BrandLockup.tsx:51`.
  2. `synergy` in `src/app/api/simulation/triggers/route.ts:35` (`"Crew synergy active; teammate re-up boost available"`) and `src/lib/prompts/courtside_personas.ts:124`.
  3. `seamlessly` in `src/app/api/creative/image/route.ts:20`.

### 3B. Remaining Non-2K Brand Bleed Audit (Rockstar / GTA / Vice City / Zynga)
While `CourtsideLanding.tsx`, `FocusGroupModal.tsx`, `ForceGraphCanvas.tsx`, `SeasonJourneySankey.tsx`, `NBAMarketMap.tsx`, `EntityInspector.tsx`, and `NLSearchBar.tsx` have been cleanly focused on **2K Games**, static inspection of secondary drawers/tickers revealed **6 residual non-2K brand bleed locations** that should be cleaned in `/showroom:polish`:
1. **`src/components/audience/SaveAudienceSheet.tsx:28-41`**: `CHANNEL_OPTIONS` still lists `ROCKSTAR_NEWSWIRE` (*"Rockstar Social Club Co-Promo · Cross-label GTA VI / GTA Online tile"*) and `ZYNGA_CROSS_PROMO` (*"Zynga Mobile Rewarded Network"*).
2. **`src/components/audience/AudienceBuilder.tsx:70-76`**: `QUICK_PREDICATES` still includes *"Rockstar Social Club Linked"* (*"with a linked Rockstar Social Club account and GTA Online spend"*) and *"No GTA VI Pre-Order"* (*"who have not pre-ordered GTA VI"*).
3. **`src/components/activation/LiveTelemetryTicker.tsx:93-99`**: Left status bar still renders a `GTA VI · T−48d · Nov 19` countdown clock.
4. **`src/components/creative/CreativeStudioPanel.tsx:23, 380` & `src/app/api/creative/image/route.ts:20`**: Music mood dropdown includes `<option value="vice-city-synth">Vice City Neon Synthwave</option>`, and the `cross-label` image prompt references *"neon-soaked Vice City coastline... Rockstar gold"*.
5. **`src/components/sidebar/PlaystyleRadar.tsx:44-48`**: Fourth radar bar is labeled `"Cross-Label Gravity"` with `color: "bg-rockstar-gold"` instead of `"2K26 → 2K27 Upgrade Gravity"` (`bg-vc-gold`).
6. **`public/brands/2k/` unused legacy assets**: `rockstar-logo.svg`, `rockstar-social-club.svg`, and `zynga-logo.svg` remain in `public/brands/2k/` (though not rendered in the active header or graph).

---

## 4. Ten Concrete Before / After Copy Rewrites (`src/components/` & `src/app/`)

### Rewrite 1 — Landing Hero Subtitle (`CourtsideLanding.tsx`)
- **Location**: [src/components/landing/CourtsideLanding.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/landing/CourtsideLanding.tsx#L720-L722)
- **Before**:
  ```tsx
  <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto leading-relaxed">
    Cross-title player identity, lifecycle cohorts, and offer testing across the 2K ecosystem.
  </p>
  ```
- **After**:
  ```tsx
  <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto leading-relaxed">
    Cross-title player identity, lifecycle cohorts, and 2-round social contagion testing across 12 2K titles.
  </p>
  ```
- **Rationale**: Removes the banned AI slop word `ecosystem` on the primary landing hero and highlights the signature 2-round social contagion capability across the 12-title 2K portfolio.

### Rewrite 2 — Sankey Stage 1 Node Title & Brand Lockup Eyebrow (`SeasonJourneySankey.tsx` & `BrandLockup.tsx`)
- **Location**: [src/components/journey/SeasonJourneySankey.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/journey/SeasonJourneySankey.tsx#L70-L74) and [src/components/brand/BrandLockup.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/brand/BrandLockup.tsx#L50-L52)
- **Before**:
  ```tsx
  const CLEAN_NODE_TITLES: Record<string, string> = {
    acq_launch: "NBA 2K27 Launch",
    acq_returning: "2K26 Returning Veterans",
    acq_cross2k: "Cross-2K Ecosystem",
  ```
- **After**:
  ```tsx
  const CLEAN_NODE_TITLES: Record<string, string> = {
    acq_launch: "NBA 2K27 Launch",
    acq_returning: "2K26 Returning Veterans",
    acq_cross2k: "Cross-2K Portfolio",
  ```
- **Rationale**: Eliminates the banned word `Ecosystem` from the Season 1 → Season 2 Sankey canvas and `BrandLockup` eyebrow (`"2K Unified Identity Graph"`).

### Rewrite 3 — Save Audience Sheet Activation Channels (`SaveAudienceSheet.tsx`)
- **Location**: [src/components/audience/SaveAudienceSheet.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/audience/SaveAudienceSheet.tsx#L28-L42)
- **Before**:
  ```tsx
  {
    id: "ROCKSTAR_NEWSWIRE",
    label: "Rockstar Social Club Co-Promo",
    sub: "Cross-label GTA VI / GTA Online tile",
  },
  ...
  {
    id: "ZYNGA_CROSS_PROMO",
    label: "Zynga Mobile Rewarded Network",
    sub: "Cross-label mobile placement",
  },
  ```
- **After**:
  ```tsx
  {
    id: "ROCKSTAR_NEWSWIRE",
    label: "2K NextMakers Creator Locker Code",
    sub: "Twitch & YouTube co-stream Locker Code drop",
  },
  ...
  {
    id: "ZYNGA_CROSS_PROMO",
    label: "2K Sports & Core Cross-Promo Tile",
    sub: "WWE 2K25, PGA TOUR 2K25 & Borderlands 4 hub placement",
  },
  ```
- **Rationale**: Purges Rockstar / GTA VI / Zynga brand bleed from the Save Cohort drawer while preserving the underlying enum keys for API compatibility.

### Rewrite 4 — Audience Builder Quick Predicates & Placeholder (`AudienceBuilder.tsx`)
- **Location**: [src/components/audience/AudienceBuilder.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/audience/AudienceBuilder.tsx#L69-L77) and [line 204](file:///Users/jlpourt/CCAI/ea-audiences/src/components/audience/AudienceBuilder.tsx#L204)
- **Before**:
  ```tsx
  {
    label: "Rockstar Social Club Linked",
    snippet: "with a linked Rockstar Social Club account and GTA Online spend",
  },
  {
    label: "No GTA VI Pre-Order",
    snippet: "who have not pre-ordered GTA VI",
  },
  ```
- **After**:
  ```tsx
  {
    label: "NBA 2K26 Veteran (90+ OVR)",
    snippet: "with $150+ NBA 2K26 VC spend and a 90+ OVR veteran build",
  },
  {
    label: "2K26 Holdout (No 2K27 Upgrade)",
    snippet: "who haven't migrated to NBA 2K27 yet and have active 2K27 Crew mates",
  },
  ```
- **Rationale**: Replaces Rockstar/GTA VI predicates in the `+ Add condition` popover with authentic `NBA 2K26 → 2K27` upgrade predicates matching Play 1 on the `2k-miro` branch.

### Rewrite 5 — Live Telemetry Ticker Secondary Pill & Initial Copy (`LiveTelemetryTicker.tsx`)
- **Location**: [src/components/activation/LiveTelemetryTicker.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/activation/LiveTelemetryTicker.tsx#L93-L99) and [line 137](file:///Users/jlpourt/CCAI/ea-audiences/src/components/activation/LiveTelemetryTicker.tsx#L137)
- **Before**:
  ```tsx
  {/* GTA VI Launch Countdown */}
  <div className="hidden sm:flex items-center gap-1.5 text-white/70">
    <Clock className="w-3.5 h-3.5 text-[#FCAF17]" />
    <span className="text-[11px] font-mono text-[#FCAF17] font-medium">
      GTA VI · T−48d · Nov 19
    </span>
  </div>
  ...
  <span>Streaming Take-Two live telemetry triggers from 2K Telemetry...</span>
  ```
- **After**:
  ```tsx
  {/* 2K26 Holdout Upgrade Window */}
  <div className="hidden sm:flex items-center gap-1.5 text-white/70">
    <Clock className="w-3.5 h-3.5 text-[#F5B400]" />
    <span className="text-[11px] font-mono text-[#F5B400] font-medium">
      2K26 → 2K27 HoF Bridge · 418 Squads
    </span>
  </div>
  ...
  <span>Streaming live Courtside telemetry triggers from 2K Identity Graph...</span>
  ```
- **Rationale**: Removes the GTA VI countdown and Take-Two reference from the bottom telemetry bar, aligning it with the 2K26 → 2K27 Holdout Bridge.

### Rewrite 6 — Creative Studio Music Mood Option & Image Prompt (`CreativeStudioPanel.tsx` & `image/route.ts`)
- **Location**: [src/components/creative/CreativeStudioPanel.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/creative/CreativeStudioPanel.tsx#L378-L382) and [src/app/api/creative/image/route.ts](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/creative/image/route.ts#L19-L21)
- **Before**:
  ```tsx
  <option value="arena-hype">Stadium Hype Bed (128 BPM)</option>
  <option value="trap-bass">808 City Trap Beat</option>
  <option value="vice-city-synth">Vice City Neon Synthwave</option>
  <option value="cinematic-orchestral">Playoff Fanfare Orchestral</option>
  ```
- **After**:
  ```tsx
  <option value="arena-hype">Stadium Hype Bed (128 BPM)</option>
  <option value="trap-bass">808 City Blacktop Trap</option>
  <option value="vice-city-synth">The City Nightfall Synth (128 BPM)</option>
  <option value="cinematic-orchestral">Championship Banner Orchestral</option>
  ```
- **Rationale**: Replaces the GTA `"Vice City Neon Synthwave"` label in Creative Studio (and the Vice City / `seamlessly` prompt in `src/app/api/creative/image/route.ts:20`) with authentic NBA 2K *The City* and *Hall of Fame Loyalty Upgrade* creative direction.

### Rewrite 7 — Creative Studio CompareSlider Labels (`CreativeStudioPanel.tsx` & `CompareSlider.tsx`)
- **Location**: [src/components/creative/CreativeStudioPanel.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/creative/CreativeStudioPanel.tsx#L252-L257) and [src/components/brand/CompareSlider.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/brand/CompareSlider.tsx#L24-L25)
- **Before**:
  ```tsx
  <CompareSlider
    beforeSrc={defaultBeforeSrc}
    afterSrc={generatedArtUrl || defaultBeforeSrc}
    beforeLabel="Standard Store Tile"
    afterLabel="Custom Render"
    aspectClass="aspect-[16/10]"
  />
  ```
- **After**:
  ```tsx
  <CompareSlider
    beforeSrc={defaultBeforeSrc}
    afterSrc={generatedArtUrl || defaultBeforeSrc}
    beforeLabel="Generic City Store Tile"
    afterLabel="Cohort-Tailored Key Art"
    aspectClass="aspect-[16/10]"
  />
  ```
- **Rationale**: Replaces generic `"Standard Store Tile"` / `"Custom Render"` labels with 2K Growth Marketing terminology (`"Generic City Store Tile"` vs. `"Cohort-Tailored Key Art"`).

### Rewrite 8 — Playstyle Radar Gravity Metric Label (`PlaystyleRadar.tsx`)
- **Location**: [src/components/sidebar/PlaystyleRadar.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/sidebar/PlaystyleRadar.tsx#L43-L48)
- **Before**:
  ```tsx
  {
    label: "Cross-Label Gravity",
    value: Math.min(100, Math.round(gravity * 100)),
    raw: `${Math.round(gravity * 100)}%`,
    color: "bg-rockstar-gold",
  },
  ```
- **After**:
  ```tsx
  {
    label: "2K26 → 2K27 Upgrade Gravity",
    value: Math.min(100, Math.round(gravity * 100)),
    raw: `${Math.round(gravity * 100)}%`,
    color: "bg-vc-gold",
  },
  ```
- **Rationale**: Aligns the `PlaystyleRadar` component inside `EntityInspector.tsx` with the `2K26 → 2K27 Bridge Gravity` histogram above it and replaces `bg-rockstar-gold` with `bg-vc-gold`.

### Rewrite 9 — Live Count Ticker Graph Attribution (`LiveCountTicker.tsx`)
- **Location**: [src/components/audience/LiveCountTicker.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/audience/LiveCountTicker.tsx#L73-L76)
- **Before**:
  ```tsx
  <div className="mt-1 font-mono text-[11px] text-chalk-dim tabular">
    Rendering top {renderedCount} by LTV ·{" "}
    <span className="text-vc-gold">TakeTwoPlayerGraph</span>
  </div>
  ```
- **After**:
  ```tsx
  <div className="mt-1 font-mono text-[11px] text-chalk-dim tabular">
    Rendering top {renderedCount} by LTV ·{" "}
    <span className="text-vc-gold">2K Identity Graph</span>
  </div>
  ```
- **Rationale**: Harmonizes the Audience Builder counter attribution with `CourtsideLanding.tsx` and `EntityInspector.tsx` (`2K Identity Graph`).

### Rewrite 10 — Focus Group Footer Status Copy & Telemetry Trigger Reason (`FocusGroupModal.tsx` & `triggers/route.ts`)
- **Location**: [src/components/focusgroup/FocusGroupModal.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/focusgroup/FocusGroupModal.tsx#L1261-L1265) and [src/app/api/simulation/triggers/route.ts](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/simulation/triggers/route.ts#L34-L36)
- **Before**:
  ```tsx
  // FocusGroupModal.tsx:1264
  : `Ready to run ${swarmSize}-agent 2-round social contagion test`
  // triggers/route.ts:35
  reason: "Crew synergy active; teammate re-up boost available",
  ```
- **After**:
  ```tsx
  // FocusGroupModal.tsx:1264
  : `Ready to run ${swarmSize}-player 2-Round Crew & Creator Contagion test · R1 Isolated vs R2 Squad Shift`
  // triggers/route.ts:35
  reason: "5-stack Rec Crew active; teammate re-up boost available",
  ```
- **Rationale**: Replaces generic `-agent` phrasing in the Focus Group footer with `-player 2-Round Crew & Creator Contagion test` and eliminates the banned word `synergy` from the Rec 5v5 telemetry trigger stream.
