# 2K Courtside · EBC Executive Run of Show (`run_of_show.md`)

**Customer**: Take-Two Interactive Software, Inc. (NASDAQ: `TTWO`) & 2K Games (`https://2k.com`, `https://nba.2k.com`, `https://www.take2games.com`)  
**Application**: **2K Courtside · Audience Builder & Segmentation Engine (`TakeTwoPlayerGraph`)**  
**Demo Temporal Anchor**: **Friday, October 2, 2026** · `14 Days` Remaining in *NBA 2K27* Season 1 (closes October 16, 2026) · `T-48 Days` to *Grand Theft Auto VI* Worldwide Launch (November 19, 2026)  
**Authored By**: `story-director` (`showroom` EBC Narrative Choreographer)  
**Last Verified**: `2026-10-12`

---

## 1. The North Star Banner

- **Target Audience**:
  - **Strauss Zelnick** · Chairman & Chief Executive Officer, Take-Two Interactive
  - **Karl Slatoff** · President, Take-Two Interactive
  - **Lainie Goldstein** · Chief Financial Officer, Take-Two Interactive
  - **Greg Thomas** · President, Visual Concepts (*NBA 2K* Studio Head)
  - **SVP of Growth Marketing & Live-Ops**, 2K Games
  - **VP of Data Engineering & Player Identity**, Take-Two Interactive
- **Total Runtime**: **`7:00`** (strictly choreographed so the live demonstration finishes at `7:00` sharp, reserving `23:00` of the 30-minute EBC session for executive P&L discussion and pilot scoping).
- **The ONE Hero Moment**:
  > At `1:15`, the presenter clicks **Golden Play 01 (`The Season 2 Cliff`)** and **Golden Play 02 (`Cross-Label Gravity: 2K → Rockstar`)** to execute a live `<50ms` multi-hop traversal across `TakeTwoPlayerGraph` on Cloud Spanner, instantaneously isolating **`284` stalled `<85 OVR` *NBA 2K27* MyCAREER spenders tethered to active Rec/Pro-Am Crew mates** alongside **`303` high-LTV MyTEAM spenders linked to Rockstar Social Club who have not yet pre-ordered *Grand Theft Auto VI* (`T-48d`)**. In one click on the **2D Court**, the room sees their own *NBA 2K27*, *Rockstar*, and *Zynga* player spine resolve social squad tethers and cross-label identity bridges that take 4 days of multi-table SQL joins today, then pressure-tests a **`$14.99 vs. $19.99` Galaxy Opal Pack Offer Battle** across 20 player personas grounded in live `r/NBA2K` and `r/MyTEAM` community sentiment before shipping a single price tag to The City.
- **Features Explicitly Excluded from the Live Flow (`CUT` / `HIDE` per `value_tree.md`)**:
  1. **`CUT` · `src/components/sidebar/IdentityTree.tsx`**: Orphaned unmounted component superseded by the inline **Cross-Label Gravity · Take-Two Spine** card in `EntityInspector.tsx`. Do not reference.
  2. **`CUT` · `src/components/simulation/SimulationClock.tsx`**: Orphaned unmounted widget superseded by the bottom `LiveTelemetryTicker.tsx` bar. Do not reference.
  3. **`HIDE` · `3D Arena` WebGL Toggle (`GraphControls.tsx:151-163` / `ForceGraphCanvas.tsx:349-364`)**: **Skip during the 7-minute run.** Keep the stage locked on **`2D Court`** where custom 2K (`#EA2228`), Rockstar (`#FCAF17`), and Zynga (`#2F6FED`) vector badges, churn rings, and dashed cross-label bridges render with broadcast clarity.
  4. **`HIDE` · Raw ISO GQL Code Accordions (`GqlDisclosure.tsx:1-94` & `NLSearchBar.tsx:263-276`)**: **Keep collapsed (`open=false`)** during the 7-minute pitch. Open only during Q&A if the VP of Data Engineering asks to inspect the underlying ISO GQL `GRAPH TakeTwoPlayerGraph MATCH` syntax.
  5. **`HIDE` · 1-on-1 Persona Interrogation Drawer (`PersonaInterrogationDrawer.tsx:1-220`)**: **Skip during the 7-minute run.** Reserve clicking an individual persona card for Q&A if an executive asks: *"Can we ask that MyTEAM collector why they boycotted the $19.99 pack?"*
  6. **`HIDE` · Raw BigQuery Event Log & JSON Payload Drawer (`ActivationFeed.tsx:1-245`)**: **Keep closed (`isActivationFeedOpen=false`)** during the live flow; use the visual **`ActivationDAG.tsx`** pipeline modal instead.
  7. **`HIDE` · Save Segment & Saved Audiences Drawers (`SaveAudienceSheet.tsx` & `SavedAudiencesDrawer.tsx`)**: **Keep closed** during the 7-minute run; reserve vector lookalike expansion (`3,072-d` `gemini-embedding-001` cosine similarity) for technical Q&A.

---

## 2. The 3-Act, 7-Minute Script

> [!IMPORTANT]
> **Voice & Lexicon Discipline (`voice.md`)**:
> - Speak with **Broadcast-Table Authority** (like an *NBA 2K* Courtside Report producer and Take-Two Live-Ops director).
> - Use authentic Take-Two & 2K nomenclature: **Recurrent Consumer Spending (RCS)**, **Net Bookings**, **Virtual Currency (VC)**, **MyCAREER**, **MyPLAYER**, **Sub-85 OVR Cliff**, **Cap Breakers**, **The City**, **The Rec**, **Pro-Am**, **Crews**, **Crew Re-Up**, **MyTEAM Galaxy Opal**, **Pro Pass / Hall of Fame Pass**, **Rockstar Social Club**, **Shark Cards**, and **TakeTwoPlayerGraph**.
> - **Zero AI slop buzzwords** and **zero em-dashes**. Cite exact tabular numbers from `sentiment.md` and `value_tree.md`.

---

### Act 1 (`0:00 – 1:15`): Their World Today · Shown in Their Own UI Style

#### Beat 1.1 (`0:00 – 0:45`): The Courtside Broadcast Desk & Take-Two's `$6.72B` RCS Engine
1. **Click Path**:
   - `[View: CourtsideLanding (src/components/landing/CourtsideLanding.tsx)]` -> Verify top header pill reads **`TakeTwoPlayerGraph · LIVE`** with latency in `ms` (`SpannerStatusPill.tsx:99-109`) -> Point to the hero temporal badge **`NBA 2K27 Season 1 · 14 Days Remaining (Oct 16) · GTA VI T-48d`** (`CourtsideLanding.tsx:254-259`) -> Gesture across the right-hand **Live Graph Stat Strip** (`2,850 Graph Players` · `48 Active Crews` · `1,180 Cross-Label Links` at `CourtsideLanding.tsx:275-300`).
2. **Talk Track (Customer Voice)**:
   - *"Welcome to 2K Courtside. Today is Friday, October 2, 2026. We are four weeks into NBA 2K27, with exactly 14 days left before Season 1 closes on October 16, and 48 days until Grand Theft Auto VI launches on November 19. In FY26, Take-Two delivered $6.72 billion in Net Bookings, and Recurrent Consumer Spending drove 78% of that total, climbing to 84% in Q1 FY27 on the back of a 25% surge in MyCAREER daily active players and 35% more games played per baller. Protecting that $5.24 billion RCS baseline and converting our first-party console base into $8.0 billion to $8.2 billion in FY27 Net Bookings comes down to how fast Live-Ops can act in the next 14 days."*
3. **KPI Proved**:
   - **Operational Metric**: Real-Time First-Party Identity Graph Coverage (`2,850` sampled players, `48` active Rec/Pro-Am Crews, `1,180` linked cross-label accounts) -> **Business KPI**: **FY2027 Net Bookings (`$8.0B–$8.2B` guidance) & Recurrent Consumer Spending Share (`78%–84%` of Net Bookings)**.
4. **Google Tech Behind It (1 Line)**:
   - **Cloud Spanner Graph** (`twok_graph_db`) serves live node, Crew edge, and cross-label identity counts with sub-50ms health telemetry directly to the Next.js broadcast console.

#### Beat 1.2 (`0:45 – 1:15`): The Sub-85 OVR Progression Cliff & Paid UA Blind Spot
1. **Click Path**:
   - `[View: CourtsideLanding (src/components/landing/CourtsideLanding.tsx)]` -> Scroll slightly to frame the **`AudienceBuilder`** island (`CourtsideLanding.tsx:305-323`) and the **`Courtside Playbook · Three Golden Plays`** rail (`CourtsideLanding.tsx:327-411`) -> Hover over **Play 01 (`The Season 2 Cliff · 284 players`)**, **Play 02 (`Cross-Label Gravity (2K → Rockstar) · 303 players`)**, and **Play 03 (`MyTEAM Pack Pricing Pressure Test · 176 players`)**.
2. **Talk Track (Customer Voice)**:
   - *"Here is the operational bottleneck today. In Weeks 4 through 6 of Season 1, MyCAREER builds stalled between 78 and 84 OVR hit a progression wall. Players on r/NBA2K calculate it takes 375,000 to 400,000 VC to max a build, so if an 82 OVR guard goes 7 days without logging in, pitching a generic $49.99 VC bundle triggers immediate backlash and permanent Season 2 churn. At the same time, Strauss noted on the Q1 call that external user-acquisition competitors are vastly overspending, yet our own NBA 2K27 MyTEAM spenders who also play GTA Online sit in disconnected label tables. Watch how fast we resolve both on TakeTwoPlayerGraph."*
3. **KPI Proved**:
   - **Operational Metric**: Time-to-Segment Multi-Hop Social & Cross-Label Cohorts (reducing 4-day SQL warehouse joins to `<60ms` graph traversal) -> **Business KPI**: **NBA 2K27 Seasonal RCS Retention (`$260M` Season 1 → Season 2 transition pool) & Zero-CAC Cross-Label Acquisition**.
4. **Google Tech Behind It (1 Line)**:
   - **Vertex AI Gemini 3.5 Flash** (`global` endpoint) parses natural-language Live-Ops criteria into structured predicate chips and multi-hop ISO GQL against **Cloud Spanner Graph**.

---

### Act 2 (`1:15 – 4:45`): The "Holy Shit" Moment (First Impact at `1:30`)

#### Beat 2.1 (`1:15 – 1:30`): Triggering the Hero Moment Live · 2-Hop Crew Rescue on the 2D Court
1. **Click Path**:
   - `[View: CourtsideLanding -> Three Golden Plays Rail]` -> Click the **Play 01 Card (`PLAY 01 · RETENTION · 2-HOP CREW GRAPH · The Season 2 Cliff · 284 players`)** (`CourtsideLanding.tsx:339-350`) -> Application executes live `/api/audiences/nl-query` and transitions automatically at `<= 1:30` into `[View: 2D Court Workspace (src/components/graph/ForceGraphCanvas.tsx)]` with `highlightBridges=true` and `EntityInspector.tsx` open on the right rail showing **`284 Matched Players`** (`EntityInspector.tsx:448-453`) and the green **`2-Hop Traversal`** stepper (`EntityInspector.tsx:501-520`).
2. **Talk Track (Customer Voice)**:
   - *"One click on Play 1, and in 42 milliseconds we are live on the 2D Court. TakeTwoPlayerGraph just traversed two social hops across our player spine: isolating 284 NBA 2K27 MyCAREER ballers stalled below 85 OVR who spent $50 or more on VC, have been dark for 7 days, but belong to an active Rec or Pro-Am Crew whose captain logged in within the last 72 hours. Instead of blasting a cold discount, we use their active Crew bond to pull them back onto the hardwood with a $4.99 Crew Re-Up Bundle: 15,000 VC plus a 2x Crew Rep Weekend Token."*
3. **KPI Proved**:
   - **Operational Metric**: Season 1 → Season 2 Transition Retention (`+150 to +400 bps` lift on at-risk `<85 OVR` cohort) & Co-Op Crew Reactivation Rate (`<50ms` 2-hop traversal) -> **Business KPI**: **`$10.3M–$14.0M` Conservative (`$25.7M–$42.9M` Expected) Annual NBA 2K27 RCS Operating Contribution**.
4. **Google Tech Behind It (1 Line)**:
   - **Cloud Spanner Graph** executes a live 2-hop ISO GQL pattern (`Player -[IN_CREW]-> Crew <-[IN_CREW]- ActiveTeammate`) in `<50ms` without relational join tables.

#### Beat 2.2 (`1:30 – 2:35`): Cross-Label Identity Gravity (`2K → Rockstar GTA VI` at `T-48d`) & 360° Player Telemetry
1. **Click Path**:
   - `[View: 2D Court Workspace]` -> In the bottom **`NLSearchBar`** quick chips (`NLSearchBar.tsx:335-353`), click **`Play 02 · GTA VI · MyTEAM Spenders · Rockstar Linked · No GTA VI Pre-Order`** -> In the top-left sub-header (`GraphControls.tsx:136-148`), click **`Cluster by Label`** so it toggles to **`Label Clusters: ON`** (separating 2K Red `#EA2228`, Rockstar Gold `#FCAF17`, and Zynga Blue `#2F6FED` clusters with animated dashed cross-label bridges) -> Click any gold-ringed player node on the 2D Court (or click the top player row in `EntityInspector.tsx:626-660`, e.g., **`Sampled Cohort Roster`**) to open the **Player Detail View** (`EntityInspector.tsx:135-418`) -> Point to **`MyPLAYER Build · Season 1`** (`OVR`, `Badges`, `Cap Breakers` at `lines 204-245`), **`Rage-Quit Index`** (`lines 310-330`), and **`Cross-Label Gravity · Take-Two Spine`** (`Rockstar Social Club: Linked` + `GTA VI (Nov 19): ELIGIBLE BRIDGE` at `lines 334-368`).
2. **Talk Track (Customer Voice)**:
   - *"Now watch what happens when we pivot from retention to Grand Theft Auto VI acquisition at T-minus 48 days. Clicking Play 2 traverses 2K Account IDs into Rockstar Games Social Club and GTA Online telemetry, isolating 303 high-LTV NBA 2K27 MyTEAM spenders who have dropped $75 or more on Shark Cards in Los Santos, but have not locked in their GTA VI pre-order. Remember Strauss's reminder on the Q1 call: you can cancel a pre-order, and external UA is overpriced. Clicking any baller on the court opens their 360-degree profile: we see their 84 OVR 2-Way 3-Level Threat build, Cap Breakers unlocked, 10-segment Rage-Quit Index, and verified Rockstar Social Club link eligible for the GTA VI Vice City Court Pack bridge."*
3. **KPI Proved**:
   - **Operational Metric**: Cross-Label Identity Resolution Rate (`2K Account ID` ↔ `Rockstar Social Club ID` ↔ `Zynga ID`) & Zero-CAC Owned Pre-Order Conversion Lift (`+120 to +220 bps`) -> **Business KPI**: **`$9.5M–$14.0M` Conservative (`$38.0M–$55.0M` Expected) Operating Contribution from Incremental *GTA VI* Bookings + `$8.1M–$32.4M` Paid UA CAC Avoided**.
4. **Google Tech Behind It (1 Line)**:
   - **Cloud Spanner Graph** resolves multi-label identity edges (`2K`, `Rockstar`, `Zynga`) in real time while **Vertex AI Gemini 3.5 Flash** synthesizes cohort gravity metrics across `TakeTwoPlayerGraph`.

#### Beat 2.3 (`2:35 – 3:45`): Play 3 · The 20-Persona Courtside Focus Group `$14.99 vs. $19.99` Offer Battle Grounded in Live `r/NBA2K` Sentiment
1. **Click Path**:
   - `[View: 2D Court Workspace]` -> In the bottom **`NLSearchBar`** quick chips (`NLSearchBar.tsx:335-353`), click **`Play 03 · Whales · MyTEAM Whales · 10+ Galaxy Opals · HoF Pass`** (`176 players` matched) -> Click the red **`Focus Group`** CTA button in the `NLSearchBar` banner (`NLSearchBar.tsx:204-222`) or top header (`page.tsx:408-415`) -> Inside **`FocusGroupModal`** (`FocusGroupModal.tsx:243-729`), click the preset chip **`$14.99 vs $19.99 Galaxy Opal Pack Battle`** (`FocusGroupModal.tsx:71-77`, `328-341`) which activates **`Battle Mode`** (`$14.99` vs. `$19.99`) -> Click the solid red **`Run Offer Battle ($14.99 vs $19.99)`** button (`FocusGroupModal.tsx:268-288`) -> Point to the **4 Live Verdict Tallies (`BUY` · `EVALUATE` · `PASS` · `BOYCOTT`)** (`lines 362-398`), the **20-Card Persona Grid** with 3D-flipping verdict badges (`lines 420-516`), the **`Offer Battle Arena`** card (`Tier A $14.99` vs. `Tier B $19.99` at `lines 522-577`), the **`Willingness-to-Pay Curve`** (`lines 580-608`), the **`Backlash Index`** bar (`lines 611-646`), and the live **`RedditPulseCard`** (`r/NBA2K` & `r/MyTEAM` community threads at `line 649`) -> Click **`Generate Campaign Brief`** (`FocusGroupModal.tsx:676-716`) to open **`CampaignBriefModal`** (`CampaignBriefModal.tsx:77-305`) -> Point to **`Community Guardrails & Strategic Pivot (Reddit Grounding)`** (`lines 199-241`), then close the brief modal (`X` at `line 94`).
2. **Talk Track (Customer Voice)**:
   - *"Before we put a MyTEAM pack offer on the floor for our 176 Galaxy Opal whales, Strauss's pricing rule is non-negotiable: deliver way more value to consumers than what we charge them. On r/MyTEAM right now, collectors are calling out sub-2% Galaxy Opal odds. Watch what happens when we run an Offer Battle comparing $14.99 against $19.99 across 20 player personas grounded in live Reddit threads. At $19.99, the Backlash Index spikes to 48%, BOYCOTT verdicts light up across our No-Money-Spent and Competitive Pro-Am personas, and unit volume drops 42%. At $14.99 with a guaranteed Galaxy Opal topper, conversion lift jumps +26.5% while keeping community backlash inside safe commercial guardrails. One click on Generate Campaign Brief synthesizes those exact Reddit objections into an executive playbook with projected ROAS."*
3. **KPI Proved**:
   - **Operational Metric**: Pre-Launch Offer Win-Rate & Simulated Price Elasticity Calibration (`$14.99` vs. `$19.99` across 20 archetypes) -> **Business KPI**: **`$16.4M–$20.5M` Conservative (`$34.7M–$43.7M` Expected) Annual MyTEAM & Pack RCS Operating Contribution** (on Take-Two's `$650M` pack RCS base at `57.2%` GAAP Gross Margin).
4. **Google Tech Behind It (1 Line)**:
   - **Vertex AI Gemini 3.5 Flash** with **Google Search Grounding** pulls live `r/NBA2K` and `r/MyTEAM` sentiment to score 20 personas in parallel, while **Vertex AI Gemini 3.1 Pro** (`global`) authors the strategic pivot brief.

#### Beat 2.4 (`3:45 – 4:45`): Closed-Loop Multimodal Creative Studio · Pack Art, Arena PA Announcer VO, & Lyria 2 Hype Bed
1. **Click Path**:
   - `[View: 2D Court Workspace]` -> Click **`Creative Studio`** in the top header bar (`page.tsx:417-424`) to slide open **`CreativeStudioPanel`** (`CreativeStudioPanel.tsx:150-448`) -> In **Section 1 (`Pack & Promo Art`)**, select style chip **`Galaxy Opal Pack`** or **`Crew Re-Up`** (`lines 214-230`), click **`Generate Art`** (`lines 233-250`), and drag the **`CompareSlider`** (`lines 254-260`) between `Standard Store Tile` and the live generated key art -> In **Section 2 (`Arena PA Announcer Voiceover`)**, keep voice **`Charon`** (`lines 303-315`), click **`Generate VO`** (`lines 318-335`), and click the red **`WaveformButton`** (`lines 352-358`) to play the live arena announcer callout -> In **Section 3 (`Arena Hype Bed (Lyria 2)`)**, keep **`Stadium Hype Bed (128 BPM)`** (`lines 379-388`), click **`Generate Beat`** (`lines 390-407`), and click the gold **`WaveformButton`** (`lines 411-416`).
2. **Talk Track (Customer Voice)**:
   - *"Strauss said on the Q1 earnings call that AI at Take-Two isn't about cutting corners; it is about meaningfully increasing creative quality and doing bigger things. Instead of waiting three weeks for generic store tiles, our Creative Studio generates cohort-tailored MyTEAM Galaxy Opal key art, synthesizes a live 28-word Arena PA Announcer callout in Charon's stadium voice, and composes a custom 128-BPM Arena Hype Beat. Dragging the comparison slider shows the difference between a generic City storefront tile and personalized Courtside key art ready for In-Game Inbox and MyNBA 2K Companion push."*
3. **KPI Proved**:
   - **Operational Metric**: Creative Production Cycle Time (from 3 weeks down to `<60 seconds`) & Cohort-Tailored Conversion Lift -> **Business KPI**: **`$3.5M/year` in Direct Creative Production OpEx Savings + Personalized Live-Ops Yield Lift**.
4. **Google Tech Behind It (1 Line)**:
   - **Vertex AI Gemini 2.5 Flash Image** renders the pack key art, **Gemini 3.1 Flash TTS** synthesizes the Arena PA announcer voiceover, and **Vertex AI Lyria 2** (`lyria-002`) composes the 128-BPM instrumental stadium beat live on GCP.

---

### Act 3 (`4:45 – 7:00`): The Value Number (`$48.5M–$141.6M`) + What a Pilot Looks Like

#### Beat 3.1 (`4:45 – 5:45`): The `$48.5M–$141.6M` P&L Impact Across the Season 1→2 Sankey & 36-DMA NBA Market Map
1. **Click Path**:
   - `[View: CreativeStudioPanel]` -> Click `X` (`CreativeStudioPanel.tsx:190`) to close the studio drawer -> In the top-left sub-header view switcher (`GraphControls.tsx:52-86`), click **`Season 1→2 Sankey`** to open **`SeasonJourneySankey`** (`SeasonJourneySankey.tsx:220-610`) -> Point to the top KPI pills (`TOTAL COHORT: 2,850` · `SUB-85 CLIFF RISK` · `CREW RE-UP OFFERS` · `S2 RETENTION RATE` at `lines 248-266`) and click the Stage 2->3 `Sub-85 OVR Cliff` node (`lines 390-460`) to slide out the **`Executive Path Diagnosis`** drawer (`lines 467-585`) -> Next, in the top-left sub-header (`GraphControls.tsx:57`), click **`NBA Markets`** to open **`NBAMarketMap`** (`NBAMarketMap.tsx:189-543`) -> Click the metric tab **`GTA VI Gravity`** (`NBAMarketMap.tsx:61`, `217-240`) and click the **Miami (`Miami DMA`)** or **Los Angeles (`Los Angeles DMA`)** bubble (`lines 295-360`) to open the right-hand **DMA Market Drawer** showing **`PLAY 1 S2 CLIFF`** and **`PLAY 2 GTA VI BRIDGE`** counts (`lines 407-470`).
2. **Talk Track (Customer Voice)**:
   - *"Let's connect these three plays directly to Lainie's P&L and the 57.2% GAAP Gross Margin reported in Take-Two's FY26 Form 10-K. On the Season 1 to Season 2 Sankey, we see the exact 16% seasonal drop-off cliff exposing $260 million in annualized NBA 2K Recurrent Consumer Spending. Switching to the NBA Markets map across all 30 NBA arenas and 6 international DMAs, we can toggle between Season 2 Cliff Risk and GTA VI Gravity in Miami, Los Angeles, and New York. Across the portfolio, Play 1 retains $10.3 million to $25.7 million in seasonal RCS operating contribution; Play 2 drives $9.5 million to $45.4 million in zero-CAC GTA VI pre-order contribution and avoided paid media spend; and Play 3 protects $16.4 million to $35.1 million in MyTEAM pack yield. With Google Cloud Spanner Graph and Vertex AI (Gemini 3.1 Pro, Gemini 3 Flash, Imagen 3 & Veo 3.1), Take-Two Interactive and 2K Games can resolve cross-label player identity (2K Account ID ↔ Social Club ID) and simulate offer price elasticity before deployment to drive $48.5M–$141.6M in annual Recurrent Consumer Spending (RCS) and Net Bookings operating contribution, starting with a 6-week pilot across NBA 2K27 Season 1 → Season 2 Retention and GTA VI Cross-Label Pre-Order Activation."*
3. **KPI Proved**:
   - **Operational Metric**: End-to-End Funnel Retention (`+150 to +400 bps`), Cross-Label DMA Pre-Order Conversion (`+120 to +220 bps`), and Pack Yield Calibration (`+350 to +650 bps`) -> **Business KPI**: **`$48.5M` Conservative (`$98.4M–$141.6M` Expected) Total Annual Operating Contribution** (`+140 to +210 bps` GAAP Operating Margin expansion, more than offsetting Take-Two's entire `-$104.2M` FY26 GAAP Operating Loss).
4. **Google Tech Behind It (1 Line)**:
   - **Cloud Spanner Graph** aggregates 5-stage seasonal transition paths and 36-DMA geospatial telemetry in real time while **Vertex AI Gemini 3.5 Flash** diagnoses stage-by-stage attrition drivers.

#### Beat 3.2 (`5:45 – 7:00`): Human-in-the-Loop Activation DAG (`Pub/Sub` + `BigQuery`) & The 6-Week Pilot Blueprint
1. **Click Path**:
   - `[View: Top Workspace Header (src/app/page.tsx:444-451)]` -> Click the gold **`Activate DAG`** button (`Send` icon) in the top-right header -> **`ActivationDAG`** modal opens (`ActivationDAG.tsx:142-425`) and auto-advances across **Step 1 (`Audience Segment · Spanner TakeTwoGraph`)** -> **Step 2 (`Brief Agent · Gemini 3.1 Pro`)** -> **Step 3 (`Creative Agent · Image · VO · Lyria Beat`)** before pausing at **Gate 1 (`Policy Gate (HITL) · Awaiting Sign-Off`)** (`lines 235-330`) -> Press and hold the red **`Hold to Approve & Dispatch`** button (`HoldToConfirm` 1.4-second cryptographic fill at `lines 385-391`) -> Observe live dispatch to **`Pub/Sub`** (`Pub/Sub ID` badge appears in green at `lines 182-187`) and **`BigQuery`** (`Activation Channels` node turns green `#19C37D` at `lines 333-355` and footer confirms `Activation successfully published to Pub/Sub and written to BigQuery activation_log` at `lines 373-378`).
2. **Talk Track (Customer Voice)**:
   - *"Nothing touches a player's inbox without human-in-the-loop governance. When we open the Activation DAG, the pipeline stages our cohort from TakeTwoPlayerGraph, attaches the Gemini 3.1 Pro brief and multimodal creative pack, and halts at Policy Gate 1. Holding this button for 1.4 seconds executes a live cryptographic sign-off, publishing the payload to Google Cloud Pub/Sub topic twok-courtside-activations across In-Game Inbox, 2K Account Email, and Rockstar Newswire while writing an immutable attribution record to BigQuery. We propose a zero-PII, 6-week pilot starting Monday: Weeks 1 and 2 ingest anonymized 2K Account, Crew, and Rockstar Social Club graph edges into Cloud Spanner Graph; Weeks 3 and 4 calibrate Season 2 Cliff and MyTEAM pack offers with Courtside Focus Groups; and Weeks 5 and 6 measure incremental Season 2 retention and GTA VI pre-order lift in BigQuery against a 10% holdout cohort. Let's open the floor: which of the three Golden Plays should we put on the clock first?"*
3. **KPI Proved**:
   - **Operational Metric**: Human-in-the-Loop Dispatch Governance (`1.4s` Hold-to-Confirm gate) & Closed-Loop Attribution Logging (`Pub/Sub` + `BigQuery`) -> **Business KPI**: **6-Week Pilot Time-to-Value (`$48.5M` Conservative Run-Rate Operating Contribution with Zero PII Exposure)**.
4. **Google Tech Behind It (1 Line)**:
   - **Google Cloud Pub/Sub** (`twok-courtside-activations`) dispatches the approved multi-channel activation payload while **BigQuery** (`twok_marketing_intelligence.activation_log`) records real-time campaign telemetry for holdout attribution.

---

## 3. 6-to-8-Week Pilot Architecture Blueprint (Executive Leave-Behind)

| Pilot Dimension | Concrete Specification for Take-Two & 2K Engineering |
| :--- | :--- |
| **Pilot Duration & Window** | **6 Weeks** aligned to the **NBA 2K27 Season 1 → Season 2 Transition** and the **48-Day Grand Theft Auto VI Pre-Order Window** |
| **Data Slice & Zero-PII Boundary** | **Zero PII**. Salted/hashed `player_id`, `2k_account_id`, `rockstar_social_club_id`, `crew_id`, MyPLAYER `ovr` / `build` / `vc_balance` / `last_login_days_ago`, MyTEAM gem-tier counts, and DMA code. No player names, raw emails, payment cards, or console billing tokens leave Take-Two's first-party vault. |
| **GCP Services Deployed** | 1. **Cloud Spanner Graph** (`twok_graph_db` / `TakeTwoPlayerGraph`) for `<50ms` 2-hop Crew and Cross-Label identity traversal.<br>2. **BigQuery** (`twok_marketing_intelligence`) for cohort persistence, funnel Sankey aggregation, and holdout attribution.<br>3. **Vertex AI** (`gemini-3.1-pro-preview`, `gemini-3.5-flash` with Google Search Grounding, `gemini-embedding-001` `3,072-d` vectors, `gemini-2.5-flash-image`, `gemini-3.1-flash-tts-preview`, and `lyria-002`).<br>4. **Cloud Pub/Sub** (`twok-courtside-activations`) feeding Take-Two's existing Braze / In-Game Inbox / Rockstar Newswire webhook consumers. |
| **Success Metrics (Exit Criteria)** | 1. **`+150 bps`** minimum Season 1 → Season 2 retention lift on the `<85 OVR` Crew-connected cohort vs. 10% control holdout.<br>2. **`+120 bps`** incremental *GTA VI* owned-channel pre-order conversion across Rockstar-linked *NBA 2K27* spenders.<br>3. **`+350 bps`** net revenue-per-drop yield lift on MyTEAM pack drops pre-tested in the 20-persona Offer Battle simulator. |

---

## 4. Demo-Day Presenter Cue Card

### Chronological 7-Minute Booth Cheatsheet

| Timestamp | Act / Beat | Active Screen / View | Exact Click Action | Key Number to Say Out Loud |
| :---: | :--- | :--- | :--- | :--- |
| **`0:00 – 0:45`** | **Beat 1.1**: Broadcast Desk | `CourtsideLanding` | Point to `TakeTwoPlayerGraph · LIVE` pill, `14 Days Remaining · GTA VI T-48d`, and `2,850` / `48` / `1,180` stat strip | **`$6.72B` FY26 Net Bookings · `78%–84%` RCS Share** |
| **`0:45 – 1:15`** | **Beat 1.2**: The Sub-85 Cliff | `CourtsideLanding` (`AudienceBuilder` + `Playbook`) | Frame `AudienceBuilder` predicates and hover over Golden Plays `01`, `02`, `03` | **`375K–400K VC` build friction · `$260M` S1→S2 RCS exposed** |
| **`1:15 – 1:30`** | **Beat 2.1**: **HERO MOMENT** | `CourtsideLanding` -> `2D Court` | Click **Play 01 (`The Season 2 Cliff · 284 players`)** card -> lands on `2D Court` with `2-Hop Traversal` open | **`284` stalled `<85 OVR` builds · `<50ms` 2-hop Crew traversal** |
| **`1:30 – 2:35`** | **Beat 2.2**: Cross-Label Gravity | `2D Court` + `EntityInspector` | Click **`Play 02 · GTA VI`** quick chip -> Toggle **`Cluster by Label`** (`ON`) -> Click a player node to inspect **Cross-Label Gravity** | **`303` Rockstar-linked 2K whales · `T-48d` to *GTA VI*** |
| **`2:35 – 3:45`** | **Beat 2.3**: Offer Battle | `FocusGroupModal` + `CampaignBriefModal` | Click **`Play 03 · Whales`** chip -> Click **`Focus Group`** -> Select **`$14.99 vs $19.99 Galaxy Opal Pack Battle`** -> Click **`Run Offer Battle`** -> Click **`Generate Campaign Brief`** | **`+26.5%` lift at `$14.99` vs. `48%` Backlash Index at `$19.99`** |
| **`3:45 – 4:45`** | **Beat 2.4**: Creative Studio | `CreativeStudioPanel` | Click **`Creative Studio`** -> Click **`Generate Art`** + drag `CompareSlider` -> Click **`Generate VO`** (`Charon`) -> Click **`Generate Beat`** (`Lyria 2`) | **3 weeks -> `<60 seconds` multimodal asset turnaround** |
| **`4:45 – 5:45`** | **Beat 3.1**: The Value Number | `Season 1→2 Sankey` -> `NBA Markets` | Click **`Season 1→2 Sankey`** -> Click `Sub-85 OVR Cliff` node -> Click **`NBA Markets`** -> Toggle **`GTA VI Gravity`** & click **Miami DMA** | **`$48.5M–$141.6M` Annual RCS & Net Bookings Operating Contribution** |
| **`5:45 – 7:00`** | **Beat 3.2**: Pilot & Dispatch | `ActivationDAG` | Click **`Activate DAG`** -> Wait for `Gate 1 (HITL)` pause -> Hold **`Hold to Approve & Dispatch`** for `1.4s` -> Confirm `Pub/Sub ID` & `BigQuery` log | **6-Week Zero-PII Pilot · `1.4s` HITL Cryptographic Sign-Off** |

### 5-Bullet Demo-Day Pre-Flight Checklist

- [ ] **1. Run State Reset & Seed Verification (`reset_state`)**: Verify that Cloud Spanner instance `blackrock-spanner` / database `twok_graph_db` (`TakeTwoPlayerGraph`) and BigQuery dataset `twok_marketing_intelligence` are seeded and clean by probing `curl -s http://localhost:3000/api/insights/graph-stats | jq .` and confirming `players: 2850`, `crews: 48`, `cross_label_identities: 1180`, `play1_season2_cliff: 284`, `play2_cross_label_gravity: 303`, and `play3_myteam_whales: 176`.
- [ ] **2. Warm Live GCP Caches & Vertex AI Endpoints (`warm_cache`)**: Execute one pre-briefing warm-up pass against `/api/audiences/nl-query` (Play 1 query), `/api/marketing/journey/summary` (Sankey), `/api/marketing/markets` (36 DMAs), and `/api/reddit/pulse` (`r/NBA2K` / `r/MyTEAM` grounding) 10 minutes before executives enter the room so Cloud Run / Next.js connections and Spanner sessions are warm (`<50ms` graph latency).
- [ ] **3. Live Spanner & Vertex AI Model Quota Check (`quota_check`)**: Verify the top-bar `SpannerStatusPill` displays a solid green dot (`#19C37D`) reading **`TakeTwoPlayerGraph · LIVE · <60 ms`** (`/api/health/spanner`) and run `node scripts/smoke_models.mjs` (or probe `/api/health/models`) to confirm `200 OK` quota availability across `gemini-3.1-pro-preview` (`global`), `gemini-3.5-flash` (`global`), `gemini-2.5-flash-image` (`us-central1`), `gemini-3.1-flash-tts-preview` (`us-central1`), and `lyria-002` (`us-central1`).
- [ ] **4. Browser Viewport, Audio Output, & Zoom Discipline (`100%` Zoom)**: Set Chrome/Arc to Full Screen (`1920x1080` or `1440x900` at **`100%` browser zoom**), mute macOS notification banners (`Do Not Disturb: ON`), verify HDMI/display audio output is active for the `Charon` Arena PA Announcer VO and `Lyria 2` Stadium Hype Beat in Beat 2.4, and start on `CourtsideLanding` (`showLanding=true`).
- [ ] **5. Zero-Fallback Live Recovery Hotkey & Pinned Quick-Chip Discipline (`GEMINI.md` Compliant)**: Per `GEMINI.md`, zero canned/offline data fallbacks exist in the application. If a free-form natural language prompt is mistyped during live Q&A, click the `X` (`Reset to Full Graph`) button in `NLSearchBar.tsx:226-233` or click any of the **3 Pinned Golden Play Quick Chips** (`Play 01 · Cliff`, `Play 02 · GTA VI`, `Play 03 · Whales` at `NLSearchBar.tsx:335-353`) to immediately re-execute a verified live ISO GQL query against Cloud Spanner Graph.
