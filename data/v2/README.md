# 2K Courtside v2 dataset (`data/v2/`)

This is the player-behaviour simulation behind Spanner `audience-graph-v2/twok_graph_db_v2` (property graph `TakeTwoPlayerGraph`) and the BigQuery mirror `jamie-bq-test.twok_marketing_intelligence.v2_*`. The contract is in [docs/v2/CONTRACT.md](../../docs/v2/CONTRACT.md) §1–2.

- **Synthetic, with real brands.** Player behaviour is simulated. The 19 NBA brands are real, current 2K partners from `data/brands_research.json` and are not labelled synthetic.
- **Consistent by construction.** Everything new comes from **one day-level simulation of the 90 days ending at the as-of date**:
  - `sessions_daily` drives `last_active_at`, `churned_at` and `session_min_7d` / `session_min_prev_7d`.
  - Co-play drives `PlayedWith` and `crew_centrality`.
  - Watches drive creator lift and `hub_score`.
  - Purchases drive branded attach.
- **Default as-of:** `2026-10-15` (NOW = 12:00Z). The window is `2026-07-18 .. 2026-10-15`.

## Rebuild (idempotent)

```bash
scripts/rebuild_v2.sh                      # as-of 2026-10-15, validated seed 12
scripts/rebuild_v2.sh --as-of 2026-10-22   # shift the whole player timeline to a new as-of
scripts/rebuild_v2.sh --as-of 2026-10-22 --seed 7
scripts/rebuild_v2.sh --truncate           # truncate + insert instead of the zero-downtime replace
```

The script runs four steps and stops at the first error (`set -euo pipefail`):

1. `python3 scripts/generate_2k_dataset_v2.py --as-of <date> [--seed N] [--out DIR]` writes `data/v2/*.json`, `sessions_daily.ndjson` and `planted_truth.json`.
   - Output is deterministic: the generator re-execs itself with `PYTHONHASHSEED=0`, so the same seed and as-of give byte-identical files.
2. `python3 scripts/validate_dataset_v2.py [--data DIR]` checks integrity and the planted effects with 95% CIs, and writes `validation_report.json`. It exits 1 if anything is out of range, and **then nothing is loaded**, so the live DB keeps the last good dataset.
3. `node scripts/load_v2_spanner.js --replace --verify` reloads Spanner with no downtime.
   - It UPSERTs every row, then deletes keys that are not in this load, so the DB is never empty while the apps read it.
   - It refuses any DB other than `twok_graph_db_v2` and refuses `blackrock-spanner`.
   - It writes `spanner_counts.json`.
4. `node scripts/mirror_v2_bigquery.js` mirrors to BigQuery.
   - It runs NDJSON load jobs (WRITE_TRUNCATE) with explicit types, staged in `data/v2/_bq/` (gitignored).
   - It refuses any table not prefixed `v2_` and checks that the loaded row count equals the source and the live count.
   - It writes `bigquery_counts.json`.

**What `--as-of` shifts.** It moves every player-behaviour timestamp: sessions, matches, streams, watches, purchases, crew joins/leaves/kicks/splits, `last_active_at` and `churned_at`. The **real calendar stays fixed**:

| Item | Dates |
| :--- | :--- |
| NBA 2K26 S5 | 06-12 → 07-24 |
| NBA 2K26 S6 | 07-24 → 09-04 |
| **NBA 2K27 S1** | **2026-09-04 → 10-16** |
| **NBA 2K27 S2** | **starts 2026-10-16** |
| Brand activations | real event dates |

Seasons flip at 17:00Z. With a different as-of, the window simply covers a different part of the real calendar.

The default seed is validated only at the default as-of. If another as-of fails validation, the rebuild stops before loading anything; re-run it with `--seed N`.

## Row counts (as-of 2026-10-15, seed 12)

| Spanner table | rows | BigQuery table | rows |
| :--- | ---: | :--- | ---: |
| `Identities` | 24,666 | `v2_identities` | 24,666 |
| `Offers` | 24 | (v1 base, Spanner only) | |
| `Clans` | 94 | `v2_clans` | 94 |
| `Creators` | 40 | `v2_creators` | 40 |
| `Games` | 12 | (v1 base, Spanner only) | |
| `Players` | 6,500 | `v2_players` | 6,500 |
| `Seasons` | 6 | `v2_seasons` | 6 |
| `Matches` | 19,782 | `v2_matches` | 19,782 |
| `Streams` | 400 | `v2_streams` | 400 |
| `Brands` | 19 | `v2_brands` | 19 |
| `BrandActivations` | 16 | `v2_brand_activations` | 16 |
| `Items` | 62 | `v2_items` | 62 |
| `TelemetryEvents` | 14,446 | (v1 base, Spanner only) | |
| `HasIdentity` | 24,666 | `v2_has_identity` | 24,666 |
| `MemberOfClan` | 4,321 | `v2_member_of_clan` | 4,321 |
| `FollowsCreator` | 11,922 | (v1 base, Spanner only) | |
| `PlaysGame` | 23,079 | (v1 base, Spanner only) | |
| `CrewMembershipEvents` | 5,239 | `v2_crew_membership_events` | 5,239 |
| `PlayedWith` | 58,745 | `v2_played_with` | 58,745 |
| `FriendsWith` | 23,766 | `v2_friends_with` | 23,766 |
| `Messaged` | 15,953 | `v2_messaged` | 15,953 |
| `CompetedIn` | 39,564 | `v2_competed_in` | 39,564 |
| `InSeason` | 19,782 | `v2_in_season` | 19,782 |
| `SplitFrom` | 10 | `v2_split_from` | 10 |
| `Hosted` | 400 | `v2_hosted` | 400 |
| `Watched` | 32,229 | `v2_watched` | 32,229 |
| `Sponsors` | 16 | `v2_sponsors` | 16 |
| `Features` | 38 | `v2_features` | 38 |
| `Bought` | 18,610 | `v2_bought` | 18,610 |
| `Equipped` | 7,914 | `v2_equipped` | 7,914 |
| (sessions, BigQuery only) | | `v2_sessions_daily` | 297,623 |

Players: 6,500 (1,248 churned). Clans: 94 (84 v1 crews + 10 split-off crews). Creators: 40. sessions_daily covers 90 days. Spanner and BigQuery counts are verified equal after every rebuild.

## Validation (as-of 2026-10-15): ALL CHECKS PASSED

All integrity checks pass:
- primary keys
- referential integrity on every edge and FK-like column
- `player_id < other_player_id` and no self-edges for PlayedWith / FriendsWith / Messaged
- all timestamps ≤ as-of
- `left_at > joined_at` and `is_active == (left_at IS NULL)`
- one active crew per player
- matches inside their season, watches inside the stream, purchases inside the window
- `last_active_at` = last session day
- `churned_at` = `last_active_at` + 14d
- the 7d / prev-7d minutes match `sessions_daily`

The planted effects are re-measured **from the output tables only**:

| Effect | Canonical definition | Result (95% CI) | Target |
| :--- | :--- | :--- | :--- |
| Churn exposure | person-day hazard; exposed = ≥1 PLAYED_WITH neighbour with `churned_at` in the previous 14d; churned = `churned_at IS NOT NULL` | **HR 1.85 [1.66, 2.07]**, Mantel-Haenszel by archetype (crude 1.93 [1.72, 2.15]); 634 events / 158,686 exposed person-days vs 614 / 295,914 | 1.6–2.0× |
| Anchor dependency | crews whose top-centrality member left (`left_at` set AND `crew_centrality = 1.0`) 14–60 days ago; D14 retained = session in [T+7, T+13] among members active in [T−7, T−1]; up to 3 matched crews (same franchise, tier, closest size, no departure in [T−60, T+14]) | **−28.7% [−34.4%, −22.9%]** (66.7% vs 93.6%; 33 crews, n = 1,293 vs 4,038; 26 of 33 crews drop ≥10%), matched-set bootstrap | −25% to −40% |
| Keystones | active MemberOfClan with `crew_centrality >= 0.9` | **6.7% [5.9%, 7.5%]** (231 of 3,449) | 5–9% |
| Declining keystones | keystone, not churned, `session_min_7d / session_min_prev_7d < 0.7` | **16** | 15–35 |
| Lost a core member this week | `left_at` in last 7d AND `crew_centrality = 1.0` (all 17 are LEAVE events) | **17 crews** (previous week 9 → **WoW +89%**) | 12–25 |
| Creator lift | viewers who watched ≥20 min of an offer stream (first such stream on day t ≤ as-of − 30), eligible = session in [t−7, t−1] and alive at t; controls = had not watched that creator by t, exact-matched on archetype × pre-period session-day bucket, 3:1; D30 = session in [t+24, t+30] | **5 clearly positive:** BadgePlug +10.5 pts [7.6, 13.4], KOT4Q +9.6 [5.4, 13.8], JoeKnows +8.4 [5.3, 11.5], NBA2KLab +8.2 [5.0, 11.4], ColeTheMan +7.5 [4.4, 10.6]. 20 creators have a CI crossing 0. Slightly negative: FlightReacts −8.8 [−12.7, −5.0], GrindingDF −2.4 [−10.9, 6.2] | 4–6 positive, most ~0, 1–2 negative |
| Branded social attach | unit = (NBA player, brand); exposed = ≥1 PLAYED_WITH neighbour bought the brand | **×2.32 [2.15, 2.49]**, Mantel-Haenszel by brand (crude pooled ×5.79 is confounded by brand popularity) | 1.5–2.5× |
| Branded share of VC | branded `vc_amount` / all `vc_amount` | **31.9%**; 2,300 purchases carry `via_activation_id` | 30–40% |
| Creator hubs | `hub_score` (Simpson diversity × log community span of viewers) | Mid-follower creators rank near the top on hub score: NBA2KLab, ColeTheMan and JoeKnows are follower ranks #17, #20 and #15 but hub #2–4 | a few mid-follower bridges |
| `churn_risk_score` | recomputed from v2 behaviour, noisy logistic | declining keystones mean 0.79 (62% in 0.55–0.90); other active 0.46; churned 0.90 | keystones at risk ≈ 0.55–0.85 |
| Concept affinity | archetype means | THE_W_LOYALIST has the highest WNBA affinity and MYNBA_FRANCHISE_SIM the highest franchise affinity; college affinity is 0.45 for age ≤21 vs 0.20 for age ≥28 | sensible |

The full per-creator and per-brand tables are in `validation_report.json`.

### Planted mechanisms
Generator knobs and the ground truth are in `planted_truth.json`.

- **Churn contagion.** Quit hazard × `EXPOSURE_MULT` while a co-play neighbour quit in the last 14 days. The crew anchor shocks below add correlated quits on top of this.
- **Anchor departures**, each with a crew-specific strength (72% of crews react strongly, the rest barely). Crewmates' hazard rises (decaying over about 12 days) and their play rate falls, scaled by tie strength to the anchor. The remaining keystones are shielded. Departures are scheduled as:
  - about 10 per week in the 3 prior weeks (the weekly baseline);
  - about 2–3 per week in weeks 5–9;
  - 18 planned in the last 7 days.
- **Keystones.** Each crew has a small core of near-equal regulars with a co-play degree within 10% of the top.
- **Creator influence.** For 30 days after a ≥20-min watch, the hazard multiplier and play rate shift for that creator's viewers:

  | Creator | Hazard multiplier |
  | :--- | :--- |
  | JoeKnows | 0.12 |
  | ColeTheMan | 0.15 |
  | NBA2KLab | 0.15 |
  | KOT4Q | 0.10 |
  | BadgePlug | 0.12 |
  | FlightReacts | 1.8 |
  | GrindingDF | 1.6 |

  Viewer selection does not depend on activity, to avoid confounding.
- **Branded purchases.** Brand choice weight × (1 + κ) once a co-play neighbour has bought the brand. 65% of purchases are unbranded VC sinks or cosmetics (MyPLAYER boosts, badge, pack and animation bundles).
- **Activations.** 2K27 S1 events: American Express 2XREP (09-19), Coach 2XREP (09-12, 10-03), Kia Challenge (09-26, 10-10), Gatorade Training Facility, plus the CeraVe / Coach / Nike / Converse / Reebok S1 drops. S2 events are upcoming: Adidas 2XREP 10-23, American Express 2XREP 11-07, The CeraVe Splash Zone 11-13.
- **Logos.** `Brands.logo_url` is a Wikimedia Commons file for the 12 brands with a verified HTTP 200. The others are NULL and the UI renders a wordmark.

## Sample GQL (Spanner `TakeTwoPlayerGraph`)

PlayedWith, FriendsWith and Messaged are stored once per unordered pair, so query them **undirected**.

```sql
-- A keystone's 1-hop and 2-hop co-play reach
GRAPH TakeTwoPlayerGraph
MATCH (a:Player)-[m:MEMBER_OF]->(c:Crew)
WHERE m.is_active AND m.crew_centrality >= 0.9
LIMIT 1
MATCH (a)-[e1:PLAYED_WITH]-(b:Player)-[e2:PLAYED_WITH]-(c2:Player)
WHERE c2.player_id <> a.player_id
RETURN a.gamer_tag AS keystone, COUNT(DISTINCT b.player_id) AS hop1, COUNT(DISTINCT c2.player_id) AS hop2
```

```sql
-- Creator -> Stream <- Watched <- ViewerAccount <- Player
GRAPH TakeTwoPlayerGraph
MATCH (cr:Creator)-[:HOSTED]->(s:Stream)<-[w:WATCHED]-(i:ViewerAccount)<-[:LINKED_TO]-(p:Player)
WHERE s.featured_offer_id IS NOT NULL AND w.watch_minutes >= 20
RETURN cr.handle AS creator, COUNT(DISTINCT p.player_id) AS engaged_viewers
ORDER BY engaged_viewers DESC
LIMIT 5
```

```sql
-- Brand -> Activation -> Item <- Bought <- Player
GRAPH TakeTwoPlayerGraph
MATCH (b:Brand)-[:SPONSORS]->(a:Activation)-[:FEATURES]->(it:Item)<-[bo:BOUGHT]-(p:Player)
RETURN b.name AS brand, COUNT(DISTINCT p.player_id) AS buyers, SUM(bo.vc_amount) AS vc
ORDER BY vc DESC
LIMIT 5
```

```sql
-- Crews that lost their top-centrality member in the last 7 days
GRAPH TakeTwoPlayerGraph
MATCH (p:Player)-[m:MEMBER_OF]->(c:Crew)
WHERE m.left_at IS NOT NULL AND m.crew_centrality >= 0.9999
  AND m.left_at > TIMESTAMP_SUB(TIMESTAMP '2026-10-15 12:00:00+00', INTERVAL 7 DAY)
RETURN c.clan_id, c.name, p.gamer_tag AS lost_player, m.left_at
ORDER BY m.left_at DESC
```

## Federated SQL (BigQuery → live Spanner)

The connection `projects/jamie-bq-test/locations/us/connections/twok-spanner-v2` is set up as follows:
- **Location:** US.
- **Type:** CLOUD_SPANNER, pointing at `projects/jamie-bq-test/instances/audience-graph-v2/databases/twok_graph_db_v2`.
- **Options:** `useParallelism = true`, `useDataBoost = true`.
- **Credentials:** a Spanner connection runs with the caller's credentials. The Cloud Run runtime SA `694576205607-compute@developer.gserviceaccount.com` has `roles/spanner.databaseReader` and `roles/spanner.databaseReaderWithDataBoost` on the DB.
- **Location must match:** run these queries with location **US**.
- **App config:** the app reads the connection from env `BQ_SPANNER_CONNECTION`.

```sql
-- Live Spanner MemberOfClan (keystones) x BigQuery v2_sessions_daily
WITH moc AS (
  SELECT * FROM EXTERNAL_QUERY(
    'projects/jamie-bq-test/locations/us/connections/twok-spanner-v2',
    '''SELECT player_id, clan_id, crew_centrality, is_active
       FROM MemberOfClan WHERE is_active = TRUE AND crew_centrality >= 0.9''')
),
s AS (
  SELECT player_id,
         SUM(IF(date >= DATE_SUB(DATE '2026-10-15', INTERVAL 7 DAY), session_minutes, 0)) AS min_7d,
         SUM(IF(date <  DATE_SUB(DATE '2026-10-15', INTERVAL 7 DAY)
                AND date >= DATE_SUB(DATE '2026-10-15', INTERVAL 14 DAY), session_minutes, 0)) AS min_prev_7d
  FROM `jamie-bq-test.twok_marketing_intelligence.v2_sessions_daily`
  GROUP BY player_id
)
SELECT COUNT(*) AS keystones_live_spanner,
       COUNT(DISTINCT moc.clan_id) AS crews,
       ROUND(SUM(IFNULL(s.min_7d,0))) AS keystone_min_7d,
       ROUND(SUM(IFNULL(s.min_prev_7d,0))) AS keystone_min_prev_7d,
       COUNTIF(SAFE_DIVIDE(s.min_7d, s.min_prev_7d) < 0.7) AS keystones_declining
FROM moc LEFT JOIN s USING (player_id)
```

Result after the final rebuild (16:50 PT, 2.5 s): `{keystones_live_spanner: 231, crews: 85, keystone_min_7d: 119910, keystone_min_prev_7d: 108446, keystones_declining: 10}`. The 231 keystones match the validator.

This demo query counts 10 declining keystones, while the validator counts 16. The windows differ: the query's 7-day window is 8 calendar days inclusive, and the validator uses `Players.session_min_7d` and excludes churned players.

## BigQuery column types
- `*_at` and `since` → TIMESTAMP.
- `v2_sessions_daily.date` → DATE; `session_minutes` → INT64.
- `game_telemetry` and `purchased_items` → JSON, e.g. `JSON_VALUE(game_telemetry, '$.myplayer_ovr')`.
- `franchises_played` and `followed_creators` → REPEATED STRING.
- Column names match the JSON files.

Tables: `v2_players`, `v2_member_of_clan`, `v2_crew_membership_events`, `v2_clans`, `v2_played_with`, `v2_friends_with`, `v2_messaged`, `v2_streams`, `v2_watched`, `v2_identities`, `v2_has_identity`, `v2_items`, `v2_brands`, `v2_brand_activations`, `v2_bought`, `v2_equipped`, `v2_sessions_daily`, `v2_matches`, `v2_seasons`, `v2_creators`, `v2_competed_in`, `v2_in_season`, `v2_split_from`, `v2_hosted`, `v2_sponsors`, `v2_features`.
