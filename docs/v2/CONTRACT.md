# 2K Courtside v2: Shared Build Contract (P0, demo next week)

All agents build against **this file**. If you need to change the contract, message the orchestrator first; don't silently diverge.

- **Branch:** `2k-audiences-v2` (already checked out; do NOT switch branches, do NOT commit; the orchestrator commits).
- **GCP:** project `jamie-bq-test`, Spanner instance **`audience-graph-v2`** (blackrock-spanner is at its 10-DB limit), **new DB `twok_graph_db_v2`** (v1 `twok_graph_db` must stay untouched; it backs the live demo), BigQuery dataset `twok_marketing_intelligence` (v2 tables prefixed `v2_`), Vertex AI via `src/lib/gcp/genai-client.ts`.
- **Zero data fallbacks** (GEMINI.md): every endpoint hits live Spanner, BigQuery, or Vertex AI. On failure, return HTTP 502/503 with service + error details. No canned JSON, no mock arrays, no `setTimeout`/`sleep` fake latency.
- **Do not edit** `.env.local`. To test against v2, start your server with the env override: `NEXT_DIST_DIR=.next-<port> SPANNER_INSTANCE_ID=audience-graph-v2 SPANNER_DATABASE_ID=twok_graph_db_v2 npx next dev -p <port>` (shell env wins over `.env.local`). For v2 code, read instance and DB ids from env (`SPANNER_INSTANCE_ID`, `SPANNER_DATABASE_ID`) via the existing config. Never hardcode them.
- **Curtis's nodal workflow: RECEIVED.** Visual reference: `docs/v2/curtis_nodal_reference.png`. Use its **look** (dark node cards on an infinite pan/zoom canvas, colored bezier edges, zoom controls), **not** its content. Section D is now the **Personalization Flow** (see §7).
- **Dev servers:** each agent uses its own port (see ownership table). Run `npx next dev -p <port>`. Never kill other agents' processes. Type-check with `npx tsc --noEmit` and fix only errors in **your** files.

---

## 1. Spanner ontology v2 (`twok_graph_db_v2`, property graph `TakeTwoPlayerGraph`)

Keep **all v1 tables/columns/labels** (so existing Focus Group, Twin Finder, and NL-to-GQL keep working), plus the following.

### New / changed columns
| Table | New columns |
| :--- | :--- |
| `Players` | `last_active_at TIMESTAMP`, `churned_at TIMESTAMP` (NULL if active; churn = no session for 14d), `session_min_7d FLOAT64`, `session_min_prev_7d FLOAT64`, `college_hoops_affinity FLOAT64`, `wnba_affinity FLOAT64`, `franchise_mode_affinity FLOAT64`, `community_id STRING(64)` |
| `MemberOfClan` | `joined_at TIMESTAMP`, `left_at TIMESTAMP` (NULL = active), `is_active BOOL`, `crew_centrality FLOAT64` (0–1 weighted co-play degree within crew) |
| `Creators` | `hub_score FLOAT64`, `community_span INT64` |

### New node tables
| Table (KEY) | Label(s) | Columns |
| :--- | :--- | :--- |
| `Seasons(season_id)` | `Season` | season_id, game_id, name (e.g. "NBA 2K27 Season 2"), start_at, end_at |
| `Matches(match_id)` | `Match` | match_id, season_id, mode (REC/PRO_AM/PARK/COMP), played_at |
| `Streams(stream_id)` | `Stream` | stream_id, creator_id, title, platform, started_at, ended_at, peak_viewers, featured_offer_id, featured_item_id |
| `Brands(brand_id)` | `Brand` | brand_id, name, category, partnership_summary, logo_url |
| `BrandActivations(activation_id)` | `Activation` | activation_id, brand_id, title, kind (CITY_EVENT/STORE_DROP/COURT/SEASON_REWARD), starts_at, ends_at, season_id |
| `Items(item_id)` | `Item` | item_id, name, item_type (SHOES/JERSEY/APPAREL/ACCESSORY/BUNDLE), brand_id (NULL if unbranded), is_branded, vc_price |
| `CrewMembershipEvents(event_id)` | (table only, not in graph) | event_id, player_id, clan_id, event_type (JOIN/LEAVE/KICK/SPLIT), occurred_at, related_clan_id |

Also add the alias labels: `Clans` → `LABEL Clan LABEL Crew`; `Identities` → `LABEL Identity LABEL ViewerAccount`.

### New edge tables
| Table (KEY) | Source → Dest | Label(s) | Properties |
| :--- | :--- | :--- | :--- |
| `PlayedWith(player_id, other_player_id)` | Player → Player | `PLAYED_WITH` | games_together_30d, games_together_total, last_played_at, same_crew BOOL |
| `FriendsWith(player_id, other_player_id)` | Player → Player | `FRIENDS_WITH` | since |
| `Messaged(player_id, other_player_id)` | Player → Player | `MESSAGED` | msg_count_30d, last_msg_at |
| `CompetedIn(clan_id, match_id)` | Clan → Match | `COMPETED_IN` | result (W/L), score_diff |
| `InSeason(match_id, season_id)` | Match → Season | `IN_SEASON` | |
| `SplitFrom(clan_id, parent_clan_id)` | Clan → Clan | `SPLIT_FROM` | split_at, shared_members |
| `Hosted(creator_id, stream_id)` | Creator → Stream | `HOSTED` | |
| `Watched(identity_id, stream_id)` | Identity → Stream | `WATCHED` | watched_at, watch_minutes |
| `Sponsors(brand_id, activation_id)` | Brand → Activation | `SPONSORS` | |
| `Features(activation_id, item_id)` | Activation → Item | `FEATURES` | |
| `Bought(player_id, item_id, bought_at)` | Player → Item | `BOUGHT` | vc_amount, bought_at, via_activation_id |
| `Equipped(player_id, item_id)` | Player → Item | `EQUIPPED` | equipped_at |

v1 edges are kept as-is, plus alias labels: `MemberOfClan` → `LABEL MEMBER_OF_CLAN LABEL MEMBER_OF`; `HasIdentity` → `LABEL HAS_IDENTITY LABEL LINKED_TO`.

> PlayedWith/FriendsWith/Messaged are stored **once per unordered pair** (player_id < other_player_id). Query them **undirected**: `(a:Player)-[e:PLAYED_WITH]-(b:Player)`.

### Planted patterns (moderate, noisy, defensible; with CIs)
- **Churn exposure:** players whose co-play neighbors churned in the last 14d have ~1.6–2.0× the churn hazard.
- **Anchor dependency:** in crews whose top-centrality member left in the last 60d, D14 retention drops roughly 25–40% vs. matched crews (noisy, not every crew).
- **Keystones:** ~6–9% of crew members are keystones (top-decile centrality). A subset (~15–25 players) shows declining sessions (`session_min_7d / session_min_prev_7d < 0.7`).
- **"Crews that lost a core member this week":** 12–25 crews with a `LEAVE` event in the last 7 days for their top-centrality member.
- **Creator lift:** viewers who watched ≥20 min of a stream featuring an offer have a D30 active rate a few points above matched non-viewers (varies by creator: 2–3 creators clearly positive, some ~0, one slightly negative).
- **Branded attach:** branded-item purchases cluster socially (attach is ~1.5–2.5× higher when ≥1 PLAYED_WITH neighbor bought the same brand).
- **Creator hubs:** a few mid-follower creators bridge many communities (high hub_score despite fewer followers than the top creators).
- **Concept affinity:** wnba/college/franchise affinities correlate sensibly with archetypes (THE_W_LOYALIST → WNBA, MYNBA_FRANCHISE_SIM → franchise, younger casuals → college).

Brands = **real, current 2K partners** from `data/brands_research.json` (provided by the orchestrator). Do NOT label them synthetic.

## 2. BigQuery mirror (`twok_marketing_intelligence`)
`v2_players`, `v2_member_of_clan`, `v2_crew_membership_events`, `v2_played_with`, `v2_streams`, `v2_watched`, `v2_identities`, `v2_has_identity`, `v2_items`, `v2_brands`, `v2_brand_activations`, `v2_bought`, `v2_sessions_daily` (player_id, date, session_minutes; 90 days), `v2_matches`.
Section C will also use a BigQuery → Spanner federated connection (`EXTERNAL_QUERY`) named `projects/jamie-bq-test/locations/us/connections/twok-spanner-v2`. It lives in location **US**, because the dataset is US multi-region and the connection must share the query's location. The Data agent creates it. Code reads it from env `BQ_SPANNER_CONNECTION`, defaulting to that path.

## 3. API contract (all `force-dynamic`, all live)
| Route | Owner | Returns (shape) |
| :--- | :--- | :--- |
| `GET /api/v2/player/[id]?hops=1\|2` | Player360 | `{ player, pillars: { crew, creator, brand }, social: { nodes, links }, metrics: { churn_exposure, crew_centrality, keystone, players_like_you_bought[] }, gql, latency_ms }` |
| `GET /api/v2/player/featured` | Player360 | `{ player_id, reason }`, picks a keystone with declining sessions for the guided storyline |
| `GET /api/v2/crew/churn?limit=` | CrewChurn | `{ churn_exposure_dist, anchor_dependency: { lift_pct, ci_low, ci_high, n_treated, n_control }, keystones: [...] , gql }` |
| `GET /api/v2/crew/lost-core-member?days=7` | CrewChurn | `{ crews: [{ clan_id, name, lost_player, centrality, members_at_risk, bookings_at_risk_usd, retention_trend }], query_sql, engines: ["spanner","bigquery"], latency_ms }` |
| `POST /api/v2/crew/act` | CrewChurn | Hands the target list to the existing Focus Group + `/api/activation/dispatch` |
| `GET /api/v2/creator/incremental` | CreatorBrand | `{ creators: [{ handle, treated_n, control_n, d30_treated, d30_control, incremental_players, ci_low, ci_high, hub_score }], method }` |
| `GET /api/v2/brand/attach` | CreatorBrand | `{ brands: [{ brand, branded_vc_revenue, attach_rate, in_crew_attach, out_crew_attach, social_multiplier }] }` |
| `GET /api/v2/social/hops?from=&to=` | CreatorBrand | `{ hops, path[] }` |
| `GET /api/v2/creator/hubs` | CreatorBrand | `{ hubs: [{ handle, hub_score, community_span, followers }] }` |
| `GET /api/insights/weekly-briefing` | Home | `{ week_of, kpis: [{ label, value, delta_pct \| null, status: "ok"\|"n/a" }], headline }` (BigQuery WoW) |
| `POST /api/v2/personalize` (SSE) | Concept | Personalization Flow (§7): `user` → `preference` → `content_pairs` (with synthetic-twin scores) → `activation` events |
| `GET /api/v2/personalize/users` | Concept | Picker list: real players spanning NBA / WNBA / College leaning |

## 4. Design system: "dark, minimal, sleek, animate like crazy"
- **Tokens:** `src/styles/tokens.css` defines CSS variables (`--bg`, `--surface`, `--surface-2`, `--border`, `--text`, `--text-dim`, `--accent` (2K red), `--accent-2`, `--good`, `--warn`, `--bad`, radius, shadows) under `:root[data-theme="dark"]` (default) and `:root[data-theme="light"]`. **Use tokens, not raw hex,** in all new v2 components so the light toggle is cheap. Tailwind can reference them (`bg-[var(--surface)]`).
- **Motion:** framer-motion only (already installed) + CSS/SVG. Shared primitives live in `src/components/v2/motion/` (owned by Home/Design): `springs.ts` (snappy `{type:"spring",stiffness:420,damping:34}`, gentle `{stiffness:220,damping:28}`), `<Reveal>` (stagger), `<Ticker>` (tabular number tween), `<AnimatedEdge>` (SVG path draw + flowing dash), `layoutId` conventions (`player-card-<id>`, `crew-<id>`). Respect `prefers-reduced-motion`. Animate transform/opacity only, no layout thrash. Target 60fps.
- **Minimal:** fewer words, more icons and numbers. One idea per card. Generous spacing. Max two accent colors per screen. No emoji in UI. No em-dashes in copy.
- **Exec persona:** "Welcome back, Jamie".

## 5. Guided storyline (one flow, step indicator A · B · C · D)
`A Home` (Core Finding + Weekly Briefing) → click finding → `B Player 360` (one player) → **Expand social** (animated ego → social graph; then Crew · Creator · Brand pillars) → metric cards (Crew Churn / Creator Engagement / Brand + Crew) → `C` "Crews that lost a core member this week" (Spanner + BigQuery, one query) → **Act** (Pressure-Test → Dispatch) → `D` Personalization Flow (pick user → infer preference → content pairs → serve) on a Curtis-style node canvas. A small persistent step indicator lets Jamie jump between steps. Free exploration of the old screens stays reachable.

## 6. File ownership
| Agent | Port | Owns (create/edit only these) |
| :--- | :--- | :--- |
| **Data** | n/a | `schema/twok_graph_db_v2.ddl`, `scripts/generate_2k_dataset_v2.py`, `scripts/validate_dataset_v2.py`, `scripts/load_v2_spanner.*`, `scripts/mirror_v2_bigquery.*`, `data/v2/**` |
| **Home / Design** | 3101 | `src/styles/tokens.css`, `src/components/v2/motion/**`, `src/components/v2/shell/**` (step indicator, theme toggle, storyline context), `src/components/v2/home/**`, `src/app/api/insights/weekly-briefing/**`, integration edits in `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `tailwind.config.js` |
| **Player360** | 3102 | `src/components/v2/player360/**`, `src/app/api/v2/player/**`, `src/lib/v2/player360.ts` |
| **CrewChurn** | 3103 | `src/components/v2/crew/**`, `src/app/api/v2/crew/**`, `src/lib/v2/crew.ts` |
| **CreatorBrand** | 3104 | `src/components/v2/creatorbrand/**`, `src/app/api/v2/creator/**`, `src/app/api/v2/brand/**`, `src/app/api/v2/social/**`, `src/lib/v2/creatorbrand.ts` |
| **Concept** | 3105 | `src/components/v2/concept/**`, `src/app/api/v2/concept-test/**`, `src/app/api/v2/personalize/**`, `scripts/generate_content_library_v2.*`, `src/lib/v2/concept.ts`, additive edits to `src/lib/prompts/courtside_personas.ts` (college persona only) |

Shared v2 types go in `src/lib/v2/types.ts`. Anyone may **add** exports there, but never change or remove someone else's. Feature components export a top-level component (e.g. `<Player360 playerId onExpand />`) that Home/Design wires into the storyline.

## 7. Section D: Personalization Flow (replaces the 3-arm concept test)
Jamie's direction: *"Show different content based on user preferences, e.g. NBA vs. WNBA vs. College basketball. **Pick user → infer preference → pick content pairs → serve on downstream activation platforms.**"* Visual style follows Curtis's nodal canvas (`docs/v2/curtis_nodal_reference.png`).

| Node | What happens (all live) |
| :--- | :--- |
| **1 · Pick user** | Choose a real player from Spanner v2 (picker plus "surprise me"; presets that lean NBA / WNBA / College). Card: gamer tag, archetype, OVR, crew, followed creators |
| **2 · Infer preference** | Signals from the graph: `wnba_affinity`, `college_hoops_affinity`, `franchise_mode_affinity`, archetype, watched streams/creators, crew/friends' leanings, purchases. Gemini (FAST, JSON schema) outputs a probability split NBA / WNBA / College plus the top 3 evidence chips, each citing a graph signal. Show the split as animated bars |
| **3 · Pick content pairs** | Pair = **creative asset + message/offer** matched to the inferred preference. Candidates come from a **real content library** in GCS (generated once by a script with the Vertex image model, organized by NBA / WNBA / College × format 16:9 / 9:16 / 1:1 / 4:3). Gemini writes copy per pair. Each pair is scored by **synthetic twins** (the user's persona + 5 graph lookalikes, Vertex FAST) and the winner is highlighted. This is the "synthetic testing" tie-in |
| **4 · Serve downstream** | Fan out in this order: **In-game / 2KTV story** → **Console & 2K launcher ad** → **Push / SMS** → **Email** → **YouTube / Google Ads** (closer: same preference reaching new players = user + graph lookalikes; staged as a Customer Match–ready audience in BigQuery `v2_ads_audience_staging` + Pub/Sub; card says "Audience staged for Google Ads Customer Match", never "campaign live"). Optional 5% holdout chip per channel. Each channel card shows the format-cropped creative and copy. "Serve" publishes via the existing Pub/Sub activation dispatch and logs to BigQuery |

**Wow moment:** switch the user (e.g. NBA grinder → WNBA loyalist → college casual) and the whole canvas re-flows: edges re-draw, the preference bars animate to the new split, and content pairs and channel creatives swap with shared-element transitions.
**Guardrails:** no generated likeness of real athletes (Caitlin Clark appears in copy only; images use generic players). Real brand partners may appear on items/offers. Zero fallbacks: a missing library asset is a visible error, never a placeholder image.
