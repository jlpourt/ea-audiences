#!/usr/bin/env bash
# Rebuild the 2K Courtside v2 dataset end to end (idempotent):
#   generate -> validate -> reload Spanner twok_graph_db_v2 -> mirror BigQuery v2_* tables
#
#   scripts/rebuild_v2.sh                       # as-of 2026-10-15 (validated default seed)
#   scripts/rebuild_v2.sh --as-of 2026-10-22    # shift every player-behaviour timestamp to a new as-of
#   scripts/rebuild_v2.sh --as-of 2026-10-22 --seed 7
#   scripts/rebuild_v2.sh --truncate            # truncate + insert instead of the zero-downtime replace
#
# Only touches: data/v2/**, Spanner audience-graph-v2/twok_graph_db_v2, BigQuery
# twok_marketing_intelligence.v2_* . Fails loudly (set -e) at the first error; if validation
# fails, nothing is loaded, so the live DB keeps the last good dataset.
set -euo pipefail

AS_OF="2026-10-15"
SEED_ARGS=()
SPANNER_MODE="--replace"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --as-of) AS_OF="$2"; shift 2 ;;
    --seed) SEED_ARGS=(--seed "$2"); shift 2 ;;
    --truncate) SPANNER_MODE="--truncate --load"; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
if ! [[ "$AS_OF" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  echo "--as-of must be YYYY-MM-DD (got '$AS_OF')" >&2; exit 2
fi

cd "$(dirname "$0")/.."
export PATH="/Users/jlpourt/google-cloud-sdk/bin:$PATH"
export SPANNER_INSTANCE_ID="audience-graph-v2"
export SPANNER_V2_DATABASE_ID="twok_graph_db_v2"

echo "== 1/4 generate (as-of $AS_OF ${SEED_ARGS[*]+${SEED_ARGS[*]}})"
python3 scripts/generate_2k_dataset_v2.py --as-of "$AS_OF" ${SEED_ARGS[@]+"${SEED_ARGS[@]}"}

echo "== 2/4 validate"
python3 scripts/validate_dataset_v2.py

echo "== 3/4 Spanner $SPANNER_INSTANCE_ID/$SPANNER_V2_DATABASE_ID ($SPANNER_MODE)"
# shellcheck disable=SC2086
node scripts/load_v2_spanner.js $SPANNER_MODE --verify

echo "== 4/4 BigQuery mirror (twok_marketing_intelligence.v2_*)"
node scripts/mirror_v2_bigquery.js

echo "rebuild_v2 complete: as-of $AS_OF"
