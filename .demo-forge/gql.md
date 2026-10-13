# GQL/SQL contract report: `ea-audiences`

**15 errors · 14 warnings** across 56 queries (36 GQL, 20 SQL).

Schema: 11 tables · 6 node labels · 4 edge labels · graphs: taketwoplayergraph
Sources: schema/twok_graph_db.ddl

## Errors

| Rule | Where | Detail |
|---|---|---|
| unknown-node-label | `src/lib/prompts/nl_to_gql.ts:1` | `TakeTwoPlayerGraph` is not a node label in the graph schema |
| unknown-node-label | `src/lib/prompts/nl_to_gql.ts:1` | `Players` is not a node label in the graph schema |
| unknown-node-label | `src/lib/prompts/nl_to_gql.ts:1` | `Games` is not a node label in the graph schema |
| unknown-node-label | `src/lib/prompts/nl_to_gql.ts:1` | `Clans` is not a node label in the graph schema |
| unknown-node-label | `src/lib/prompts/nl_to_gql.ts:1` | `Creators` is not a node label in the graph schema |
| unknown-node-label | `src/lib/prompts/nl_to_gql.ts:1` | `Identities` is not a node label in the graph schema |
| unknown-node-label | `src/lib/prompts/nl_to_gql.ts:1` | `Offers` is not a node label in the graph schema |
| unknown-node-label | `src/lib/prompts/nl_to_gql.ts:1` | `Inside` is not a node label in the graph schema |
| value-interpolation | `src/app/api/audiences/nl-query/route.ts:216` | `dmaClause` interpolated via template — use query parameters (@param) |
| value-interpolation | `src/lib/a2a/official-server.ts:66` | `whereClause` interpolated via template — use query parameters (@param) |
| value-interpolation | `src/lib/gcp/bigquery-client.ts:67` | `tableRef("saved_audiences")` interpolated via template — use query parameters (@param) |
| value-interpolation | `src/lib/gcp/bigquery-client.ts:124` | `tableRef("activation_log")` interpolated via template — use query parameters (@param) |
| value-interpolation | `src/lib/gcp/catalog.ts:356` | `playerId.replace(/'/g, "")` interpolated via template — use query parameters (@param) |
| value-interpolation | `src/lib/gcp/catalog.ts:367` | `playerId.replace(/'/g, "")` interpolated via template — use query parameters (@param) |
| value-interpolation | `src/lib/gcp/spanner-client.ts:181` | `edgeTail` interpolated via template — use query parameters (@param) |

## Warnings

| Rule | Where | Detail |
|---|---|---|
| identifier-interpolation | `agents/app/sub_agents/audience_agent.py:23` | `limit` interpolated via fstring (ensure it's allow-listed) |
| identifier-interpolation | `agents/app/sub_agents/audience_agent.py:31` | `limit` interpolated via fstring (ensure it's allow-listed) |
| identifier-interpolation | `agents/app/sub_agents/audience_agent.py:38` | `limit` interpolated via fstring (ensure it's allow-listed) |
| identifier-interpolation | `agents/app/sub_agents/audience_agent.py:46` | `limit` interpolated via fstring (ensure it's allow-listed) |
| identifier-interpolation | `agents/app/sub_agents/audience_agent.py:53` | `limit` interpolated via fstring (ensure it's allow-listed) |
| identifier-interpolation | `agents/app/tools/bq_tools.py:21` | `project_id` interpolated via fstring (ensure it's allow-listed) |
| identifier-interpolation | `agents/app/tools/bq_tools.py:21` | `dataset_id` interpolated via fstring (ensure it's allow-listed) |
| identifier-interpolation | `agents/app/tools/bq_tools.py:21` | `where_clause` interpolated via fstring (ensure it's allow-listed) |
| identifier-interpolation | `agents/app/tools/bq_tools.py:21` | `limit` interpolated via fstring (ensure it's allow-listed) |
| identifier-interpolation | `scripts/spanner_load_data.js:60` | `t` interpolated via template (ensure it's allow-listed) |
| identifier-interpolation | `scripts/spanner_load_data.js:356` | `t` interpolated via template (ensure it's allow-listed) |
| identifier-interpolation | `src/lib/a2a/official-server.ts:66` | `limit` interpolated via template (ensure it's allow-listed) |
| silent-fallback | `agents/app/tools/bq_tools.py:32` | logged, returns synthetic/default data: `logger.warning(f'BigQuery telemetry query deferred to local dataset: {e}')` |
| silent-fallback | `agents/app/tools/spanner_graph_tools.py:27` | logged, returns synthetic/default data: `logger.warning(f'Spanner query execution deferred to local cache: {e}')` |
