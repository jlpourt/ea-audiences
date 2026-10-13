# Showroom Anti-Slop Audit Report (`slop_report.md`)

- **Repository**: `/Users/jlpourt/CCAI/ea-audiences`
- **Application**: **2K Courtside — Audience Builder & Segmentation Engine** (2K Games / Take-Two Interactive)
- **Audited By**: `slop-auditor` (`/showroom:audit`)
- **Audit Date**: `2026-10-12`
- **Viewports Verified via Playwright**: Desktop (`1440x900`) & Laptop (`1280x800`)
- **Overall Anti-Slop Score**: **6.2 / 10** *(Strong dark-arena visual foundation, authentic NBA 2K27 / Rockstar / Zynga domain taxonomy, and compositor-first motion curves; penalized by pervasive Google Cloud / Gemini model badges across all 5 screens, `Sparkles`/`Wand2` AI icons, `animate-spin` blocking loaders, floating sub-header & search bar layout collisions on Laptop/Desktop, truncated Sankey Gemini output, and US map label pile-up).*

---

## Executive Summary & Screen Score Matrix

| # | Screen Name | Route / View State | Desktop (`1440x900`) | Laptop (`1280x800`) | Score (`0–10`) | Primary Slop & Visual Defects Observed |
| :- | :--- | :--- | :--- | :--- | :---: | :--- |
| 1 | **Courtside Landing & Audience Builder** | `/` (`showLanding = true`) | `.showroom/screenshots/landing-page-desktop.png` | `.showroom/screenshots/landing-page-laptop.png` | **7.0 / 10** | Exposed `Cloud Spanner Graph`, `BigQuery`, `Vertex AI Gemini 3`, `Gemini 3.5 Flash` pills & footer (#15); `<Sparkles>` on `"Build Segment"` CTA (#2); hero em-dash (#12); `SpannerStatusPill` renders blank `"· ms"` latency. |
| 2 | **Graph Workspace & Cohort Inspector** | `/` (`currentView = "audience-cohorts"`) | `.showroom/screenshots/graph-workspace-desktop.png` | `.showroom/screenshots/graph-workspace-laptop.png` | **6.4 / 10** | `<Sparkles>` & `<Wand2>` icons in header, inspector, and search bar (#2); `"Spanner Graph · LIVE"` & `"Save BQ"` badges (#15); Laptop `1280x800` header buttons wrap to 2 lines; `GraphControls` & `NLSearchBar` collide horizontally with right `EntityInspector`. |
| 3 | **Courtside Focus Group Modal** | `FocusGroupModal` (`isOpen = true`) | `.showroom/screenshots/focus-group-modal-desktop.png` | `.showroom/screenshots/focus-group-modal-laptop.png` | **6.2 / 10** | `✦ Gemini 3.5 Flash` & `✦ Gemini 3.1 Pro` header/card badges (#15); 20 uniform cards with identical canned quote & `$9.99` WTP operator-precedence bug before run (#5, #9); `RedditPulseCard` stuck on `animate-spin` (`"Grounding over reddit.com..."`) (#14). |
| 4 | **Season 1→2 Journey Sankey** | `/` (`currentView = "marketing-journey"`) | `.showroom/screenshots/season-journey-sankey-desktop.png` | `.showroom/screenshots/season-journey-sankey-laptop.png` | **5.4 / 10** | Floating `GraphControls` overlaps Sankey header & KPI pills; Gemini diagnosis truncated mid-sentence (`"While a critical sub-85"`) due to missing `thinkingBudget: 0`; SVG text collision in 48px-tall nodes; `"Synergy"` buzzword (#11); `"LIVE SPANNER"` & `Gemini 3.5 Flash` badges (#15); `<Sparkles>` icon (#2). |
| 5 | **NBA Market Telemetry & Gravity Map** | `/` (`currentView = "geo-map"`) | `.showroom/screenshots/nba-market-map-desktop.png` | `.showroom/screenshots/nba-market-map-laptop.png` | **6.0 / 10** | Floating `GraphControls` overlaps map header & metric tabs (`Players / VC Spend / Season 2 Cliff Risk / GTA VI Gravity`); 30 US NBA DMA bubbles & permanent `<text>` labels pile up illegibly over North America; `"Live Spanner DMA clustering"` copy (#15); `animate-spin` loader (#14). |

---

## The 15 Mandatory AI Slop Giveaways — Master Checklist

| # | Slop Giveaway Category | Status | Hit Count | Summary of Findings |
| :- | :--- | :---: | :---: | :--- |
| **1** | **Default purple/blue gradients** (`#6366f1`, `#8b5cf6`, `from-indigo-*`) | **PASS** | `0` | Zero indigo/purple gradients. Uses authentic 2K broadcast arena palette (`--court-black: #0a0a0c`, `--court-ink: #121216`, `--twok-red: #ea2228`, `--vc-gold: #f5b400`, `--rockstar-gold: #fcaf17`, `--win-green: #19c37d`). |
| **2** | **Sparkle / magic-wand icons** (`✨`, `🪄`, `Sparkles`, `Wand2`) | **FAIL** | `21` | `<Sparkles>` and `<Wand2>` used on primary operational CTAs (`Build Segment`, `Focus Group`, `Creative Studio`, `Pressure-Test`, `Segment`, `Generate Art/VO/Beat`, `Brief Agent`, `SeasonJourneySankey` diagnosis banner) plus 4-point sparkle star SVG inside `<ModelBadge>`. |
| **3** | **Emoji in headers** (`🚀`, `📊`, `🤖`, `💡`, `🔥` in `<h1>`–`<h4>`, nav, KPIs) | **PASS** | `0` | Zero emojis in DOM headers, navigation bars, or KPI titles. (Emoji strings in `courtside_personas.ts:26-143` are not rendered in UI headers). |
| **4** | **Generic all-Inter look** (`font-family: Inter` everywhere with no brand display contrast) | **WARN** | `3` | `src/app/layout.tsx:5-16` and `src/app/globals.css:51-52` pair `Inter` (`--font-sans`) with `Inter_Tight` (`--font-display`), and `ForceGraphCanvas.tsx:291` hardcodes `Inter`. While optical tracking (`-0.02em` display, `tabular-nums`) is well-crafted, `.showroom/brand.json` identifies 2K's display/ athletic typography (`VideoJS`, `Montserrat`, `Roboto`). |
| **5** | **Identical rounded cards in endless grids** | **WARN** | `1` | `FocusGroupModal.tsx:420-515` renders a 2x10 grid of 20 uniform `rounded-xl` persona cards that all display the exact same placeholder quote (`"Evaluating whether this offer justifies the VC investment before Season 1 ends."`) before running a test. |
| **6** | **Meaningless "AI Insights" panels** | **PASS** | `0` | Zero generic `"AI Insights"` or `"Smart Recommendations"` titles. Uses domain-specific headers (`Live Graph Synthesis`, `Willingness-to-Pay Curve`, `Backlash Index`, `Cross-Label Gravity Histogram`). |
| **7** | **Chatbot-as-the-whole-UI** | **PASS** | `0` | Natural language segmentation is integrated into an operational Audience Builder with franchise filters, predicate chips, live count ticker, and GQL disclosure. |
| **8** | **Placeholder / Acme / lorem data** | **PASS** | `0` | Zero `Acme`, `Lorem ipsum`, or `SKU-12345` placeholders. Grounded in NBA 2K27 (`MyCAREER`, `MyTEAM`, `The City`, `Cap Breakers`, `Galaxy Opal`), Rockstar (`GTA VI`, `GTA Online`, `Social Club`), and Zynga terminology. |
| **9** | **Suspiciously round numbers** | **WARN** | `2` | Spanner cohort counts (`2,850`, `1,791`, `284`, `303`, `176`) are realistic. However, `FocusGroupModal.tsx:362-398` initializes with `0 / 20` across all 4 verdict boxes and a ternary precedence bug (`FocusGroupModal.tsx:497`) forces 19/20 persona cards to display `WTP: $9.99`. |
| **10** | **Made-up personas with stock names** (`Sarah Jenkins`, `Alex Rivera`, `Marcus Chen`) | **PASS** | `0` | UI renders authentic NBA 2K gamer tags (`TheWBucketz`, `MeterOffMike`, `LegendRepLeo`, `PosterizePete`, `ClarkDeluxeCrew`, `NoZenHere`). |
| **11** | **AI buzzword vocabulary** (`seamless`, `unlock`, `synergy`, `empower`, `elevate`) | **FAIL** | `8` | `"Launch & Synergy"` (`SeasonJourneySankey.tsx:69`), `"Take-Two Cross-Label Synergy"` (`journey/summary/route.ts:56`, visible on Stage 4 Sankey node), `"Crew synergy active"` (`triggers/route.ts:35`), `"Unlock your next Cap Breaker"` (`brief/route.ts:117`), `"blending seamlessly"` (`creative/image/route.ts:20`). |
| **12** | **Overused em-dashes** (`—` in UI copy and generated insights) | **WARN** | `76` | Em-dashes appear in Landing Page hero copy (`CourtsideLanding.tsx:269`), default offer title (`page.tsx:81, 88`: `"Crew Re-Up Bundle — 15,000 VC..."`), and Focus Group offer input. |
| **13** | **Dashboards with 12+ metrics and no point of view** | **PASS** | `0` | KPI strips are disciplined (3–4 metrics per view) and directly tied to next-step operational actions. |
| **14** | **Loading spinners with no streaming/progress story** (`animate-spin`) | **FAIL** | `19` | 19 `animate-spin` instances across 12 components: `RedditPulseCard.tsx:90` spins indefinitely on initial modal open; `SeasonJourneySankey.tsx:305` blocks the entire canvas for 5+ seconds waiting on Gemini; `FocusGroupModal.tsx:276` uses a blocking POST instead of the existing SSE stream route `/api/synthetic/focus-group/stream`. |
| **15** | **Exposed Google Cloud / AI model & vendor service badges in customer UI** | **FAIL** | `48` | Pervasive vendor marketing badges across every screen: `<ModelBadge>` (`✦ Gemini 3.5 Flash`, `✦ Gemini 3.1 Pro`, `✦ Gemini 2.5 Flash Image`, `✦ Gemini 3.1 Flash TTS`, `✦ Lyria 2`, `✦ Gemini Embedding`), `"TakeTwoPlayerGraph · LIVE"` / `"SPANNER · LIVE"`, `"Save to BigQuery"`, `"LIVE SPANNER"`, `"GCP NATIVE"`, and footer infrastructure strings. |

---

## Screen-by-Screen Visual & Code Audit

### Screen 1: Courtside Landing & Audience Builder (`/`)
- **Score**: **7.0 / 10**
- **Screenshots**:
  - Desktop (`1440x900`): [landing-page-desktop.png](file:///Users/jlpourt/CCAI/ea-audiences/.showroom/screenshots/landing-page-desktop.png)
  - Laptop (`1280x800`): [landing-page-laptop.png](file:///Users/jlpourt/CCAI/ea-audiences/.showroom/screenshots/landing-page-laptop.png)

#### Visual Inspection Notes
- Strong visual hierarchy at both `1440x900` and `1280x800`: the dark hardwood arena backdrop, `2,850` / `48` / `1,791` tabular stat strip, two-column Audience Builder island (`grid-cols-[1fr_290px]`), and Three Golden Plays rail with custom key art look cohesive and purposeful.
- **Defect 1 (Broken Latency Pill)**: In the top header, `SpannerStatusPill` renders `● TakeTwoPlayerGraph · LIVE · ms` with a blank number before `ms` because `/api/health/spanner` returns `graphLatencyMs` / `probe.latencyMs` while `SpannerStatusPill.tsx:108` reads `health.latencyMs`.
- **Defect 2 (Exposed Vendor Badges — Giveaway #15)**: Hero paragraph (`CourtsideLanding.tsx:269-270`) advertises `"— powered by Cloud Spanner Graph, BigQuery, and Vertex AI Gemini 3."`; the Audience Builder right panel shows `"SPANNER · LIVE"`, `"✦ Gemini 3.5 Flash · 0 ms"`, and `"Save to BigQuery"`; the footer lists `"Cloud Spanner Graph · blackrock-spanner/twok_graph_db · BigQuery · twok_marketing_intelligence · Pub/Sub · twok-courtside-activations"` and `"Gemini 3.1 Pro · Gemini 3.5 Flash · Flash Image · Flash TTS · Lyria 2"`.
- **Defect 3 (Magic Sparkle CTA Icon — Giveaway #2)**: The primary red `"BUILD SEGMENT"` button inside `AudienceBuilder.tsx:203` wears a `<Sparkles>` icon.

#### Flagged Slop Giveaways — Screen 1

| Giveaway # & Category | File:Line / Selector | Exact Problem Observed | Exact Fix (CSS / Copy / Component Level) |
| :--- | :--- | :--- | :--- |
| **#15 Exposed GCP / AI Model Badges** | [CourtsideLanding.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/landing/CourtsideLanding.tsx#L265-L271) | Hero subtitle reads: `"...and Zynga IDs — powered by Cloud Spanner Graph, BigQuery, and Vertex AI Gemini 3."` (also uses em-dash #12). | Rewrite in 2K product voice: `"Multi-hop audience segmentation across TakeTwoPlayerGraph connecting NBA 2K27 MyPLAYER builds, Crews, Rockstar Social Club, and Zynga IDs in real time."` |
| **#2 Sparkle / Magic-Wand Icons** | [AudienceBuilder.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/audience/AudienceBuilder.tsx#L201-L205) | Primary `"Build Segment"` CTA renders `<Sparkles className="h-3.5 w-3.5" />`. | Replace `<Sparkles>` with `<Filter className="h-3.5 w-3.5" />` or `<Crosshair className="h-3.5 w-3.5" />` from `lucide-react`. |
| **#15 Exposed GCP / AI Model Badges** | [LiveCountTicker.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/audience/LiveCountTicker.tsx#L47-L54), [L94](file:///Users/jlpourt/CCAI/ea-audiences/src/components/audience/LiveCountTicker.tsx#L94) | Displays `"SPANNER · LIVE"` and `<ModelBadge modelId={modelUsed} />` (`"✦ Gemini 3.5 Flash · 0 ms"`). | Replace `"SPANNER · LIVE"` with `"IDENTITY GRAPH · LIVE"` and replace `<ModelBadge>` with an operational telemetry badge: `"NL→GQL Parser · ${translateMs || executionMs} ms"`. |
| **#15 Exposed GCP / AI Model Badges** | [AudienceBuilder.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/audience/AudienceBuilder.tsx#L174) | Button label reads `"Save to BigQuery"`. | Rename button to `"Save Segment"` or `"Save to Audience Library"`. |
| **#15 Exposed GCP / AI Model Badges** | [CourtsideLanding.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/landing/CourtsideLanding.tsx#L332), [L422](file:///Users/jlpourt/CCAI/ea-audiences/src/components/landing/CourtsideLanding.tsx#L422), [L440-L459](file:///Users/jlpourt/CCAI/ea-audiences/src/components/landing/CourtsideLanding.tsx#L440-L459) | Playbook subtitle (`"execute live GQL on Spanner"`), Core Finding `<ModelBadge>`, and footer advertising GCP database/model names. | Replace with customer product terminology: `"Click any play to execute live graph traversal"`, remove `<ModelBadge>`, and replace footer with `"2K Courtside · Take-Two Interactive Identity Spine · NBA 2K27 Season 1 Live-Ops"`. |
| **Visual Bug: Blank Latency in Status Pill** | [SpannerStatusPill.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/common/SpannerStatusPill.tsx#L6-L13), [L108](file:///Users/jlpourt/CCAI/ea-audiences/src/components/common/SpannerStatusPill.tsx#L108) | Renders `TakeTwoPlayerGraph · LIVE · ms` with missing number because API returns `graphLatencyMs` / `probe.latencyMs`. | Read `health.graphLatencyMs ?? health.probe?.latencyMs ?? health.latencyMs` in `SpannerStatusPill.tsx`. |

---

### Screen 2: Graph Workspace & Cohort Inspector (`/`, `currentView = "audience-cohorts"`)
- **Score**: **6.4 / 10**
- **Screenshots**:
  - Desktop (`1440x900`): [graph-workspace-desktop.png](file:///Users/jlpourt/CCAI/ea-audiences/.showroom/screenshots/graph-workspace-desktop.png)
  - Laptop (`1280x800`): [graph-workspace-laptop.png](file:///Users/jlpourt/CCAI/ea-audiences/.showroom/screenshots/graph-workspace-laptop.png)

#### Visual Inspection Notes
- The 2D Force Graph canvas (`446 nodes · 1,014 edges`) with Take-Two label hubs (`NBA 2K27`, `GTA Online`, `Grand Theft Auto VI`, `Toon Blast`, `WWE 2K25`, `PGA TOUR 2K25`) and the right-hand `EntityInspector` (`420 MATCHED PLAYERS`, `AVG LTV $246`, `RAGE-QUIT RISK 25%`, `HIGH CHURN 33`, stacked archetype bar, 10-bar Cross-Label Gravity histogram, and sampled player roster) is visually rich and domain-authentic.
- **Defect 1 (Laptop `1280x800` Header Wrapping & Sub-Header / Search Bar Collisions)**:
  - At `1280x800` ([graph-workspace-laptop.png](file:///Users/jlpourt/CCAI/ea-audiences/.showroom/screenshots/graph-workspace-laptop.png)), the top `<header>` (`src/app/page.tsx:388`) runs out of horizontal space, forcing button labels (`Courtside Home`, `FOCUS GROUP`, `Creative Studio`, `Save Segment`, `Activate DAG`) to wrap onto two lines inside a fixed `h-14` bar.
  - `GraphControls` (`src/components/graph/GraphControls.tsx:67`, `absolute top-16 left-5 z-20`) has no right boundary when `EntityInspector` (`fixed right-4 top-16 w-[410px] z-30`) is open, so the `ARCHETYPE All 10 Archetypes` select pill extends **underneath** the `EntityInspector` panel on Laptop (`1280x800`).
  - `NLSearchBar` (`src/components/search/NLSearchBar.tsx:150`, `fixed bottom-12 left-1/2 -translate-x-1/2 w-[94%] max-w-3xl z-20`) is centered across the full viewport width rather than the canvas area left of the `410px` inspector. Consequently, the right side of `NLSearchBar` (including the red `"Segment"` button and the `"Play 02 · GTA VI"` preset chip) is **covered by the bottom of `EntityInspector`** on both `1280x800` and `1440x900`!
- **Defect 2 (Sparkle & Magic-Wand Icons — Giveaway #2)**:
  - Top bar `"FOCUS GROUP"` button (`<Sparkles>`), `"Creative Studio"` button (`<Wand2>`), `EntityInspector` `"PRESSURE-TEST IN COURTSIDE FOCUS GROUP"` button (`<Sparkles>`), `EntityInspector` `"Creative"` button (`<Wand2>`), and `NLSearchBar` `"Segment"` button (`<Sparkles>`).
- **Defect 3 (Exposed Vendor Badges — Giveaway #15)**:
  - `EntityInspector.tsx:438` badge reads `"● Spanner Graph · LIVE"`; `EntityInspector.tsx:695` button reads `"Save BQ"`; `LiveTelemetryTicker.tsx:137` reads `"Streaming Take-Two live telemetry triggers from Spanner..."`.

#### Flagged Slop Giveaways — Screen 2

| Giveaway # & Category | File:Line / Selector | Exact Problem Observed | Exact Fix (CSS / Copy / Component Level) |
| :--- | :--- | :--- | :--- |
| **Layout Collision (Desktop & Laptop)** | [NLSearchBar.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/search/NLSearchBar.tsx#L150), [GraphControls.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/graph/GraphControls.tsx#L67) | Centered `NLSearchBar` (`left-1/2 -translate-x-1/2 max-w-3xl`) and `GraphControls` collide with the open `410px` right-hand `EntityInspector` (`right-4 z-30`), hiding the `"Segment"` button and `"ARCHETYPE"` filter. | When `isInspectorOpen` is true on graph views, constrain `GraphControls` with `right-[436px]` and shift `NLSearchBar` to center within the available canvas (`left-5 right-[436px] translate-x-0 max-w-2xl mx-auto`). Add `whitespace-nowrap` to top `<header>` buttons in `src/app/page.tsx:390-452`. |
| **#2 Sparkle / Magic-Wand Icons** | [page.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/app/page.tsx#L413-L424), [EntityInspector.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/sidebar/EntityInspector.tsx#L403), [L673-L685](file:///Users/jlpourt/CCAI/ea-audiences/src/components/sidebar/EntityInspector.tsx#L673-L685), [NLSearchBar.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/search/NLSearchBar.tsx#L326) | 6 visible `<Sparkles>` and `<Wand2>` icons across header, inspector, and search bar CTAs. | Replace `<Sparkles>` on Focus Group CTAs with `<Users className="h-3.5 w-3.5" />`, replace `<Wand2>` on Creative Studio CTAs with `<Palette className="h-3.5 w-3.5 text-vc-gold" />`, and replace `<Sparkles>` on `"Segment"` with `<ArrowRight className="h-3 w-3" />`. |
| **#15 Exposed GCP / AI Model Badges** | [EntityInspector.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/sidebar/EntityInspector.tsx#L438), [L695](file:///Users/jlpourt/CCAI/ea-audiences/src/components/sidebar/EntityInspector.tsx#L695), [LiveTelemetryTicker.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/activation/LiveTelemetryTicker.tsx#L137) | Inspector badge reads `"Spanner Graph · LIVE"`, button reads `"Save BQ"`, ticker reads `"from Spanner..."`. | Change `"Spanner Graph · LIVE"` to `"Take-Two Graph · LIVE"`, `"Save BQ"` to `"Save"`, and `"from Spanner..."` to `"from Courtside Telemetry Spine..."`. |
| **#4 Generic All-Inter Canvas Font** | [ForceGraphCanvas.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/graph/ForceGraphCanvas.tsx#L291) | Hardcodes `ctx.font = "600 ${fontSize}px Inter, system-ui, sans-serif"`. | Use `Roboto` / condensed display font stack matching `.showroom/brand.json`. |

---

### Screen 3: Courtside Focus Group Modal (`FocusGroupModal`)
- **Score**: **6.2 / 10**
- **Screenshots**:
  - Desktop (`1440x900`): [focus-group-modal-desktop.png](file:///Users/jlpourt/CCAI/ea-audiences/.showroom/screenshots/focus-group-modal-desktop.png)
  - Laptop (`1280x800`): [focus-group-modal-laptop.png](file:///Users/jlpourt/CCAI/ea-audiences/.showroom/screenshots/focus-group-modal-laptop.png)

#### Visual Inspection Notes
- The right column (Willingness-to-Pay Sparkline with `$4.99` optimal callout, Backlash Index bar at `18%`, and Offer Battle toggle) is well-structured and readable at both `1440x900` and `1280x800`.
- **Defect 1 (20 Identical Placeholder Quotes & `$9.99` WTP Bug Before Run — Giveaways #5 & #9)**:
  - Look at the 20 persona cards in [focus-group-modal-desktop.png](file:///Users/jlpourt/CCAI/ea-audiences/.showroom/screenshots/focus-group-modal-desktop.png): before clicking `"Run 20-Persona Pressure Test"`, every single card displays the exact same italicized string: `"Evaluating whether this offer justifies the VC investment before Season 1 ends."` (`FocusGroupModal.tsx:507-508`), while the top 4 verdict boxes read `0 / 20` across the board.
  - Worse, at `FocusGroupModal.tsx:497`, `value={reaction?.willingness_to_pay_usd ?? p.vc_spend_90d ? 9.99 : 4.99}` has a JavaScript operator-precedence bug (`??` binds looser than `? :`), so whenever `p.vc_spend_90d` is truthy (`$14`, `$81`, `$37`, `$101`, `$216`, `$652`, `$6`), it evaluates to `$9.99` even when `reaction` is `null`!
- **Defect 2 (`RedditPulseCard` Indefinite `animate-spin` — Giveaway #14)**:
  - In the bottom-right panel of both screenshots, `LIVE REDDIT PULSE` shows a spinning red circle (`<Loader2 className="w-3.5 h-3.5 animate-spin text-twok-red" /> Grounding over reddit.com...`) because `/api/social/reddit-pulse` takes several seconds on mount with no skeleton or step-level progress indicator.
- **Defect 3 (Exposed Gemini Model Badges — Giveaway #15)**:
  - Modal header displays `✦ Gemini 3.5 Flash` and `✦ Gemini 3.1 Pro` (`FocusGroupModal.tsx:262-263`), and `RedditPulseCard` displays `✦ Gemini 3.5 Flash` (`RedditPulseCard.tsx:76`).

#### Flagged Slop Giveaways — Screen 3

| Giveaway # & Category | File:Line / Selector | Exact Problem Observed | Exact Fix (CSS / Copy / Component Level) |
| :--- | :--- | :--- | :--- |
| **#5 & #9 Identical Placeholder Quotes & `$9.99` WTP Precedence Bug** | [FocusGroupModal.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/focusgroup/FocusGroupModal.tsx#L496-L509) | 1) `reaction?.willingness_to_pay_usd ?? p.vc_spend_90d ? 9.99 : 4.99` evaluates to `9.99` for 19/20 personas. 2) All 20 cards show the identical string `"Evaluating whether this offer justifies the VC investment before Season 1 ends."` | 1) Parenthesize the fallback: `reaction?.willingness_to_pay_usd ?? (p.vc_spend_90d >= 100 ? 14.99 : p.vc_spend_90d >= 50 ? 9.99 : 4.99)`. 2) Render each persona's authentic telemetry context (`"${p.myplayer_ovr} OVR ${p.myplayer_build} · $${p.vc_spend_90d} 90d VC · ${p.favorite_team}"`) when `reaction` is null, or auto-trigger the SSE stream `/api/synthetic/focus-group/stream` on open. |
| **#14 Loading Spinners (`animate-spin`)** | [FocusGroupModal.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/focusgroup/FocusGroupModal.tsx#L185-L205), [L276](file:///Users/jlpourt/CCAI/ea-audiences/src/components/focusgroup/FocusGroupModal.tsx#L276), [RedditPulseCard.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/focusgroup/RedditPulseCard.tsx#L88-L93) | `FocusGroupModal` calls blocking `/api/synthetic/focus-group` with `RotateCw animate-spin` instead of streaming persona cards one by one via `/api/synthetic/focus-group/stream`; `RedditPulseCard` shows a bare `Loader2 animate-spin`. | Wire `FocusGroupModal` to `/api/synthetic/focus-group/stream` so persona reactions flip in progressively (`1 / 20` → `20 / 20`), and replace the `RedditPulseCard` spinner with a 3-row shimmer skeleton (`r/NBA2K`, `r/MyTEAM`, `r/GTA6`). |
| **#15 Exposed GCP / AI Model Badges** | [FocusGroupModal.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/focusgroup/FocusGroupModal.tsx#L261-L264), [RedditPulseCard.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/focusgroup/RedditPulseCard.tsx#L76) | Renders `<ModelBadge modelId="gemini-3.5-flash" />` and `<ModelBadge modelId="gemini-3.1-pro-preview" />` in the modal header and Reddit card. | Remove `<ModelBadge>` from customer-facing headers; replace with domain badges (`"20-Persona Cohort Panel"`, `"Live Community Signal"`). |
| **#12 Em-Dash in Default Offer Input** | [page.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/app/page.tsx#L81), [L88](file:///Users/jlpourt/CCAI/ea-audiences/src/app/page.tsx#L88) | Default offer title uses em-dash: `"Crew Re-Up Bundle — 15,000 VC + 2x Crew REP Booster"`. | Replace em-dash with middle dot: `"Crew Re-Up Bundle · 15,000 VC + 2x Crew REP Booster"`. |

---

### Screen 4: Season 1→2 Journey Sankey (`/`, `currentView = "marketing-journey"`)
- **Score**: **5.4 / 10**
- **Screenshots**:
  - Desktop (`1440x900`): [season-journey-sankey-desktop.png](file:///Users/jlpourt/CCAI/ea-audiences/.showroom/screenshots/season-journey-sankey-desktop.png)
  - Laptop (`1280x800`): [season-journey-sankey-laptop.png](file:///Users/jlpourt/CCAI/ea-audiences/.showroom/screenshots/season-journey-sankey-laptop.png)

#### Visual Inspection Notes
- The 5-stage Sankey flow diagram (`1. Acquisition` → `2. Mode Entry` → `3. Week 4–6 Status` → `4. Intervention Offer` → `5. Season 2 Outcome`) has strong color coding and cubic-bezier ribbons, but **four severe visual/copy defects** appear in the live screenshots:
- **Defect 1 (Severe Header Overlap with `GraphControls`)**:
  - Look at the top-left of [season-journey-sankey-desktop.png](file:///Users/jlpourt/CCAI/ea-audiences/.showroom/screenshots/season-journey-sankey-desktop.png) and [season-journey-sankey-laptop.png](file:///Users/jlpourt/CCAI/ea-audiences/.showroom/screenshots/season-journey-sankey-laptop.png): the floating `GraphControls` bar (`Audience Graph | Cross-Label Bridges | Crews | Season 1→2 Sankey | NBA Markets`, `TITLE All Take-Two Labels`, `446 nodes · 1,014 edges`) sits **directly on top of** `SeasonJourneySankey`'s internal top bar (`← Graph Canvas`, `NBA 2K27 Season 1 → Season 2 Lifecycle Flows`, `TOTAL COHORT 2,850`, `SUB-85 CLIFF RISK 431`)!
- **Defect 2 (Truncated 4-Word Gemini Diagnosis)**:
  - Look at the diagnosis banner below the header: on Desktop it reads `"✨ While a critical sub-85"` and stops mid-phrase; on Laptop it reads `"✨ While our Season 1"` and stops mid-phrase!
  - Root cause: [src/app/api/marketing/journey/summary/route.ts:301-314](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/marketing/journey/summary/route.ts#L301-L314) calls `generateText({ role: "FAST", maxOutputTokens: 200 })` **without** `thinkingBudget: 0`. Because `gemini-3.5-flash` uses ~195 tokens for internal thinking by default, only 4–5 output tokens remain before hitting `maxOutputTokens: 200`!
- **Defect 3 (SVG Node Text Collision & Horizontal Overflow)**:
  - In compact 48px-tall Sankey nodes (`NBA 2K27 Launch (S...`, `MyNBA & The W`, `MyTEAM Whale (10+ ...`, `Galaxy Opal Deluxe...`), `SeasonJourneySankey.tsx:438-458` renders the subtitle at `y={32}` and the count/percentage (`61 (2%)`, `104 (4%)`, `239 (8%)`) at `y={Math.min(layout.h - 8, 48)}` (`y=40`), causing the two text lines to overlap and collide vertically! Meanwhile, longer subtitles (`"Play 1 Retention Churn Risk"`, `"$19.99 40-Tier Accelerator"`, `"Take-Two Cross-Label Synergy"`, `"Lost Engagement Pre-Oct 16"`) overflow horizontally outside the `150px`-wide `<rect>` border.
- **Defect 4 (AI Buzzword `"Synergy"` + `<Sparkles>` + Exposed Badges — Giveaways #2, #11, #14, #15)**:
  - Stage 1 subtitle reads `"Launch & Synergy"` (`SeasonJourneySankey.tsx:69`) and Stage 4 bottom node subtitle reads `"Take-Two Cross-Label Synergy"` (`journey/summary/route.ts:56`).
  - Diagnosis bar uses `<Sparkles className="w-4 h-4 text-[#F5B400]" />` and `<ModelBadge modelId={modelUsed} />` (`"✦ Gemini 3.5 Flash"`), and header pill reads `"LIVE SPANNER"`.

#### Flagged Slop Giveaways — Screen 4

| Giveaway # & Category | File:Line / Selector | Exact Problem Observed | Exact Fix (CSS / Copy / Component Level) |
| :--- | :--- | :--- | :--- |
| **Layout Collision (Desktop & Laptop)** | [page.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/app/page.tsx#L456-L480), [SeasonJourneySankey.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/journey/SeasonJourneySankey.tsx#L223) | `GraphControls` (`absolute top-16 left-5 z-20`) overlaps `SeasonJourneySankey`'s top header bar (`px-6 py-4`). | Either hide `GraphControls` when `currentView === "marketing-journey" \|\| currentView === "geo-map"`, or add `pt-14` top offset to `SeasonJourneySankey` / `NBAMarketMap` and remove their duplicate `"← Graph Canvas"` button. |
| **Truncated LLM Output & Fallback Violation** | [journey/summary/route.ts](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/marketing/journey/summary/route.ts#L297-L321), [L348-L370](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/marketing/journey/summary/route.ts#L348-L370) | `generateText` omits `thinkingBudget: 0` with `maxOutputTokens: 200`, truncating visible diagnosis to `"While a critical sub-85"`. Also wraps `generateText` in a `try/catch` canned fallback (violating `GEMINI.md`). | Pass `thinkingBudget: 0, maxOutputTokens: 320` to `generateText`, and remove the `try/catch` canned diagnosis fallback. |
| **SVG Text Overlap & Overflow** | [SeasonJourneySankey.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/journey/SeasonJourneySankey.tsx#L154), [L427-L458](file:///Users/jlpourt/CCAI/ea-audiences/src/components/journey/SeasonJourneySankey.tsx#L427-L458) | `Math.max(48, rawH)` puts `y=32` subtitle and `y=40` metric text on top of each other; subtitles >22 chars overflow `width=150`. | Increase minimum node height to `Math.max(58, Math.min(160, rawH))`, place metrics at `y={Math.max(48, layout.h - 10)}`, and truncate `node.subtitle` at 22 chars (`node.subtitle.length > 22 ? node.subtitle.slice(0, 21) + "…" : node.subtitle`). |
| **#11 AI Buzzword Vocabulary (`Synergy`)** | [SeasonJourneySankey.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/journey/SeasonJourneySankey.tsx#L69), [journey/summary/route.ts](file:///Users/jlpourt/CCAI/ea-audiences/src/app/api/marketing/journey/summary/route.ts#L56) | Stage 1 subtitle reads `"Launch & Synergy"`; Stage 4 GTA VI node subtitle reads `"Take-Two Cross-Label Synergy"`. | Change `"Launch & Synergy"` to `"Launch & Cross-Label"` and `"Take-Two Cross-Label Synergy"` to `"Rockstar Social Club Bridge"`. |
| **#2 & #15 Sparkles & Vendor Badges** | [SeasonJourneySankey.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/journey/SeasonJourneySankey.tsx#L238), [L281-L284](file:///Users/jlpourt/CCAI/ea-audiences/src/components/journey/SeasonJourneySankey.tsx#L281-L284), [L306](file:///Users/jlpourt/CCAI/ea-audiences/src/components/journey/SeasonJourneySankey.tsx#L306), [L513-L516](file:///Users/jlpourt/CCAI/ea-audiences/src/components/journey/SeasonJourneySankey.tsx#L513-L516) | `"LIVE SPANNER"` pill, `<Sparkles>` icons, `<ModelBadge>` (`"✦ Gemini 3.5 Flash"`), and `"Computing Take-Two Spanner Graph Trajectories..."`. | Replace `"LIVE SPANNER"` with `"SEASON 1 TELEMETRY"`, replace `<Sparkles>` with `<TrendingUp className="w-4 h-4 text-[#F5B400]" />`, and remove `<ModelBadge>`. |

---

### Screen 5: NBA Market Telemetry & Gravity Map (`/`, `currentView = "geo-map"`)
- **Score**: **6.0 / 10**
- **Screenshots**:
  - Desktop (`1440x900`): [nba-market-map-desktop.png](file:///Users/jlpourt/CCAI/ea-audiences/.showroom/screenshots/nba-market-map-desktop.png)
  - Laptop (`1280x800`): [nba-market-map-laptop.png](file:///Users/jlpourt/CCAI/ea-audiences/.showroom/screenshots/nba-market-map-laptop.png)

#### Visual Inspection Notes
- **Defect 1 (Severe Header Overlap with `GraphControls`)**:
  - Look at the top bar in [nba-market-map-desktop.png](file:///Users/jlpourt/CCAI/ea-audiences/.showroom/screenshots/nba-market-map-desktop.png) and [nba-market-map-laptop.png](file:///Users/jlpourt/CCAI/ea-audiences/.showroom/screenshots/nba-market-map-laptop.png): `GraphControls` (`Audience Graph | Cross-Label Bridges | Crews | Season 1→2 Sankey | NBA Markets`, `TITLE All Take-Two Labels`, `36 NBA & Global DMAs`) sits right on top of `NBAMarketMap`'s header (`NBA Market Telemetry & Gravity Map | 30 NBA DMAS + INTL`) and **completely covers** the first three metric toggle buttons (`Players`, `VC Spend`, `Season 2 Cliff Risk`), leaving only `... Gravity` peeking out underneath `36 NBA & Global DMAs`!
- **Defect 2 (Continental US Bubble & Label Pile-Up)**:
  - Because `NBAMarketMap.tsx:120-124` uses a full world map (`geoNaturalEarth1().scale(mapSize.width / 5.4)`) and renders a permanent white `<text>` label for every bubble with `radius >= 12` (`NBAMarketMap.tsx:346`), 30 US NBA DMAs are crammed into a ~220x130px region of North America. The city labels (`Portland`, `San Francisco`, `Los Angeles`, `Salt Lake City`, `Denver`, `Minneapolis / St. Paul`, `Milwaukee`, `Chicago`, `Indiana`, `New York`, `Boston`, `Charlotte`, `Houston`, `Miami / Fort Lauderdale`) overlap into an illegible cluster.
- **Defect 3 (Exposed Vendor Copy & Spinner — Giveaways #14 & #15)**:
  - Subtitle reads `"Live Spanner DMA clustering · Season 2 Cliff & GTA VI Pre-Order Gravity"` (`NBAMarketMap.tsx:211`) and loading overlay uses `<RefreshCw className="w-5 h-5 animate-spin" /> Resolving Spanner DMA Coordinates...` (`NBAMarketMap.tsx:260-261`).

#### Flagged Slop Giveaways — Screen 5

| Giveaway # & Category | File:Line / Selector | Exact Problem Observed | Exact Fix (CSS / Copy / Component Level) |
| :--- | :--- | :--- | :--- |
| **Layout Collision (Desktop & Laptop)** | [NBAMarketMap.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/map/NBAMarketMap.tsx#L191-L253), [GraphControls.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/graph/GraphControls.tsx#L67) | Floating `GraphControls` covers `NBAMarketMap`'s title and obscures the `Players / VC Spend / Season 2 Cliff Risk / GTA VI Gravity` segmented control. | Add `pt-14` to `NBAMarketMap`'s top bar or hide `GraphControls` on non-graph views (`marketing-journey`, `geo-map`). |
| **Map Label Pile-Up Over US DMAs** | [NBAMarketMap.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/map/NBAMarketMap.tsx#L314), [L346-L357](file:///Users/jlpourt/CCAI/ea-audiences/src/components/map/NBAMarketMap.tsx#L346-L357) | `radius >= 12` matches almost all 30 US NBA markets simultaneously on a global projection, causing 25+ `<text>` labels to overlap over the US. | Only render permanent `<text>` labels for the top 6 non-overlapping global/regional hubs (e.g., `Los Angeles`, `New York`, `Chicago`, `Miami`, `London`, `Manila`, `São Paulo`, `Sydney`) or when `isSelected \|\| isHovered`, and tighten bubble radius to `Math.max(4, Math.min(18, (val / max) * 14 + 4))`. |
| **#14 & #15 Vendor Copy & Spinner** | [NBAMarketMap.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/map/NBAMarketMap.tsx#L211), [L260-L261](file:///Users/jlpourt/CCAI/ea-audiences/src/components/map/NBAMarketMap.tsx#L260-L261) | `"Live Spanner DMA clustering"` and `"Resolving Spanner DMA Coordinates..."` with `animate-spin`. | Replace with `"30 NBA Team Markets + 6 Global Hubs · Season 2 Cliff & GTA VI Pre-Order Gravity"`. |

---

### Secondary Drawers & Modals Audited (`CreativeStudioPanel`, `CampaignBriefModal`, `SaveAudienceSheet`, `SavedAudiencesDrawer`, `ActivationDAG`, `ActivationFeed`)

| Component & File | Giveaway # | Exact Problem Observed | Exact Fix |
| :--- | :---: | :--- | :--- |
| [CreativeStudioPanel.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/creative/CreativeStudioPanel.tsx#L209), [L246](file:///Users/jlpourt/CCAI/ea-audiences/src/components/creative/CreativeStudioPanel.tsx#L246), [L258](file:///Users/jlpourt/CCAI/ea-audiences/src/components/creative/CreativeStudioPanel.tsx#L258), [L297](file:///Users/jlpourt/CCAI/ea-audiences/src/components/creative/CreativeStudioPanel.tsx#L297), [L331](file:///Users/jlpourt/CCAI/ea-audiences/src/components/creative/CreativeStudioPanel.tsx#L331), [L373-L375](file:///Users/jlpourt/CCAI/ea-audiences/src/components/creative/CreativeStudioPanel.tsx#L373-L375), [L403](file:///Users/jlpourt/CCAI/ea-audiences/src/components/creative/CreativeStudioPanel.tsx#L403) | **#2, #14, #15** | `<Sparkles>` on `"Generate Art"`, `"Generate VO"`, `"Generate Beat"`; `<ModelBadge>` pills; `"Gemini 2.5 Flash Render"` label on `CompareSlider`; `"Arena Hype Bed (Lyria 2)"` header. | Replace `<Sparkles>` with `<ImageIcon>`, `<Mic>`, `<Music2>`; change `afterLabel` to `"Custom Cohort Key Art"`; change `"Arena Hype Bed (Lyria 2)"` to `"Arena Hype Sound Bed"`. |
| [ActivationDAG.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/activation/ActivationDAG.tsx#L156-L160), [L249](file:///Users/jlpourt/CCAI/ea-audiences/src/components/activation/ActivationDAG.tsx#L249), [L266-L270](file:///Users/jlpourt/CCAI/ea-audiences/src/components/activation/ActivationDAG.tsx#L266-L270), [L342](file:///Users/jlpourt/CCAI/ea-audiences/src/components/activation/ActivationDAG.tsx#L342), [L364](file:///Users/jlpourt/CCAI/ea-audiences/src/components/activation/ActivationDAG.tsx#L364) | **#2, #14, #15** | Header pill `"GCP NATIVE"`, subtitle `"Spanner Identity Graph → Gemini Reasoning Agents → HITL Gate → Pub/Sub & BigQuery"`, Node 2 `<Sparkles>` + `<ModelBadge>` (`"Gemini 3.1 Pro"`), Node 5 `"PUB/SUB & BQ"`, Gate pause `<Clock className="animate-spin" />`. | Replace `"GCP NATIVE"` with `"LIVE-OPS PIPELINE"`, subtitle with `"Take-Two Identity Spine → Campaign Brief → Creative Pack → Policy Gate → Multi-Channel Dispatch"`, and `<Sparkles>` with `<FileText>`. |
| [SaveAudienceSheet.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/audience/SaveAudienceSheet.tsx#L156-L159), [L191-L193](file:///Users/jlpourt/CCAI/ea-audiences/src/components/audience/SaveAudienceSheet.tsx#L191-L193), [L222-L223](file:///Users/jlpourt/CCAI/ea-audiences/src/components/audience/SaveAudienceSheet.tsx#L222-L223), [L308-L309](file:///Users/jlpourt/CCAI/ea-audiences/src/components/audience/SaveAudienceSheet.tsx#L308-L309) | **#14, #15** | Title `"Save Segment to BigQuery"`, `"Lookalike Expansion (Gemini Embedding)"` + `<ModelBadge>`, `"Scoring 3,072-d cosine similarity in Spanner…"`, CTA `"Save to twok_marketing_intelligence.saved_audiences"`. | Rename to `"Save Audience Segment"`, `"Lookalike Expansion (3,072-d Vector Similarity)"`, `"Scoring player behavioral similarity…"`, and `"Save Segment to Library"`. |
| [CampaignBriefModal.tsx](file:///Users/jlpourt/CCAI/ea-audiences/src/components/brief/CampaignBriefModal.tsx#L86), [L112](file:///Users/jlpourt/CCAI/ea-audiences/src/components/brief/CampaignBriefModal.tsx#L112), [L128](file:///Users/jlpourt/CCAI/ea-audiences/src/components/brief/CampaignBriefModal.tsx#L128), [L206](file:///Users/jlpourt/CCAI/ea-audiences/src/components/brief/CampaignBriefModal.tsx#L206) | **#14, #15** | Renders 3 `<ModelBadge>` pills and `"Synthesizes key metrics into a 55-word briefing via Gemini TTS."` | Remove `<ModelBadge>` pills and change copy to `"Synthesizes cohort metrics and community guardrails into a 55-word audio briefing."` |

---

## Ready-to-Apply Code, CSS & Copy Fixes

### Fix 1: Eliminate Sub-Header & Search Bar Collisions (`src/app/page.tsx`, `src/components/graph/GraphControls.tsx`, `src/components/search/NLSearchBar.tsx`)
1. In `src/app/page.tsx:456-480`, only render floating `<GraphControls>` on graph canvas views (or add `top-14` spacing so it never overlaps `SeasonJourneySankey` or `NBAMarketMap`), and pass `isInspectorOpen` to `GraphControls` and `NLSearchBar`:
```tsx
// src/components/graph/GraphControls.tsx (line 67)
return (
  <div
    className={`absolute top-16 left-5 z-20 flex flex-wrap items-center gap-2 font-sans ${
      isGraphCanvasView ? "right-[436px]" : "right-5"
    }`}
  >
```
2. In `src/components/search/NLSearchBar.tsx:150`, offset the search bar away from the right-hand `410px` `EntityInspector`:
```tsx
// src/components/search/NLSearchBar.tsx (line 150)
<div className="fixed bottom-12 left-5 right-[436px] z-20 mx-auto max-w-3xl flex flex-col items-center gap-2 font-sans">
```

### Fix 2: Fix `SpannerStatusPill` Blank Latency & Vendor Copy (`src/components/common/SpannerStatusPill.tsx`)
```tsx
// src/components/common/SpannerStatusPill.tsx (lines 6-14 & 97-111)
export type SpannerHealth = {
  ok: boolean;
  database: string;
  graph?: string;
  playerCount?: number;
  latencyMs?: number;
  graphLatencyMs?: number;
  probe?: { ok: boolean; latencyMs: number };
  error?: string;
};
// ...
const resolvedLatencyMs =
  health?.graphLatencyMs ?? health?.probe?.latencyMs ?? health?.latencyMs;
// ...
<span className="font-medium tracking-tight">
  {phase === "live"
    ? "TakeTwoPlayerGraph · LIVE"
    : phase === "down"
      ? `Graph Offline · ${health?.error?.slice(0, 28) || "error"}`
      : "Identity Graph · Probing"}
</span>
{phase === "live" && typeof resolvedLatencyMs === "number" && (
  <>
    <span className="opacity-35">·</span>
    <span className="tabular text-win-green font-semibold">
      {resolvedLatencyMs} ms
    </span>
  </>
)}
```

### Fix 3: Fix Truncated Sankey Diagnosis (`thinkingBudget: 0`), SVG Node Text Overlap & `"Synergy"` Buzzword (`src/app/api/marketing/journey/summary/route.ts` & `src/components/journey/SeasonJourneySankey.tsx`)
```ts
// src/app/api/marketing/journey/summary/route.ts (line 56 & lines 301-315)
{ stageIndex: 3, id: "offer_gta6_bridge", title: "GTA VI Pre-Order Bridge", subtitle: "Rockstar Social Club Bridge", color: "#FCAF17" },
// ...
const genRes = await generateText({
  role: "FAST",
  prompt: `...`,
  temperature: 0.2,
  maxOutputTokens: 320,
  thinkingBudget: 0,
});
```
```tsx
// src/components/journey/SeasonJourneySankey.tsx (lines 69, 154, 438-458)
const STAGE_HEADERS = [
  { index: 0, title: "1. Acquisition", subtitle: "Launch & Cross-Label" },
  // ...
];
// In svgLayout (line 154):
const h = Math.max(58, Math.min(160, rawH));
// In SVG Node rendering (lines 438-458):
<text x={12} y={32} fill="rgba(244,241,234,0.5)" fontSize={9} className="pointer-events-none font-mono">
  {node.subtitle.length > 22 ? `${node.subtitle.slice(0, 21)}…` : node.subtitle}
</text>
<text x={12} y={Math.max(46, Math.min(layout.h - 8, 52))} fill={node.color} fontSize={11} fontWeight={600} className="pointer-events-none font-mono">
  {node.count.toLocaleString()} ({node.pct}%)
</text>
```

### Fix 4: Fix `FocusGroupModal` WTP Operator-Precedence Bug & Identical Placeholder Quotes (`src/components/focusgroup/FocusGroupModal.tsx`)
```tsx
// src/components/focusgroup/FocusGroupModal.tsx (lines 496-509)
<TabularNumber
  value={
    reaction?.willingness_to_pay_usd ??
    ((p.vc_spend_90d || 0) >= 150 ? 14.99 : (p.vc_spend_90d || 0) >= 60 ? 9.99 : 4.99)
  }
  decimals={2}
/>
// ...
<p className="pl-2 text-[11px] text-chalk-dim/90 line-clamp-2 leading-relaxed italic">
  {reaction?.verbatim_quote ? (
    <>&ldquo;{reaction.verbatim_quote}&rdquo;</>
  ) : (
    <span className="not-italic font-mono text-[10px] text-chalk-dim">
      {p.myplayer_ovr || 85} OVR {p.myplayer_build || "MyPLAYER"} · {p.favorite_team || "NBA 2K27"}
    </span>
  )}
</p>
```

### Fix 5: Declutter `NBAMarketMap` US DMA Label Pile-Up (`src/components/map/NBAMarketMap.tsx`)
```tsx
// src/components/map/NBAMarketMap.tsx (lines 314 & 346-357)
const MAJOR_LABEL_HUBS = new Set([
  "Los Angeles DMA",
  "New York DMA",
  "Chicago DMA",
  "Miami / Fort Lauderdale DMA",
  "Dallas / Fort Worth DMA",
  "London",
  "Paris",
  "Manila",
  "São Paulo",
  "Sydney",
]);
const radius = Math.max(5, Math.min(20, (val / max) * 16 + 4));
const showLabel = isSelected || isHovered || MAJOR_LABEL_HUBS.has(market.dma_market);
```
