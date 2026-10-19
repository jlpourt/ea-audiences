# Take-Two portfolio extension (`t2_graph_db`)

The Take-Two command center runs on its own Spanner database, `t2_graph_db`
(instance `audience-graph-v2`, project `jamie-bq-test`, graph `TakeTwoPlayerGraph`).
It is the 2K Courtside v2 graph (`data/v2`, untouched) plus Rockstar Games and Zynga.
The 2K demo database `twok_graph_db_v2` is never modified.

## Rebuild

```bash
python3 scripts/generate_t2_portfolio.py                       # data/t2/* (deterministic, seed 2727, ~1 min)
SPANNER_INSTANCE_ID=audience-graph-v2 SPANNER_V2_DATABASE_ID=t2_graph_db \
  node scripts/load_v2_spanner.js --replace                    # zero-downtime upsert + prune (~8 min)
node scripts/mirror_t2_bigquery.js                             # BigQuery take_two_portfolio.t2_* (~2 min)
```

First-time create: `... node scripts/load_v2_spanner.js --create --load --verify` (schema `schema/t2_graph_db.ddl`).
Large generated files in `data/t2/` are gitignored; regenerate them with the script.

## Contents

| | 2K (v2) | Rockstar Games | Zynga |
|---|---|---|---|
| Players | 6,500 (`t2-usr-*`) | 16,000 (`t2-rsg-*`) | 15,000 (`t2-zng-*`) |
| Titles | NBA 2K27/26/Mobile, WWE, PGA, TopSpin, BL4, Civ VII, Mafia | GTA Online, Red Dead Online, GTA VI (pre-launch) | Words With Friends, Match Factory!, Toon Blast, CSR Racing 2, Empires & Puzzles, Zynga Poker |
| Crews | v2 crews | GTA Online crews, RDO posses | E&P alliances, Match Factory! / Toon Blast teams, CSR2 crews |

Graph additions: `PLAYS_GAME.spend_usd / first_played_at / acquired_via`, `INVITED` (Player -> Player,
into another title), `WISHLISTED` (Player -> GTA VI), Rockstar Games Social Club / Zynga Account identities,
Rockstar / Zynga purchases (`BOUGHT`), co-play (`PLAYED_WITH`) and chat (`MESSAGED`).
BigQuery adds `t2_sessions_daily` (player x title x day) for the retention curves.

## Planted effects (synthetic data, validated by the generator printout)

- Friend pull: a studio's players are ~1.7-4x more likely to play another studio's title when a friend already plays it.
- Invites: players who joined another studio's title through a friend's invite churn less (about 10% vs 16%)
  and stay longer (week-4 retention about 40% vs 19% in BigQuery).
- Multi-studio players spend more per head and churn less.
- GTA VI wishlists concentrate in Rockstar players, then 2K players.
