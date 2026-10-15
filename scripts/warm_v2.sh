#!/usr/bin/env bash
# Pre-warm the v2 storyline routes before the demo.
#
# Every route below computes LIVE (Spanner Graph / BigQuery / Vertex AI). This
# script just makes the first, slowest computation happen before Jamie clicks:
# core-finding keeps its live result in a 15 min per-process cache, and the
# others warm Spanner sessions, BigQuery, and model connections.
#
# Usage: BASE_URL=http://localhost:3101 scripts/warm_v2.sh
#        (re-run within 15 min of showtime)
set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
FAIL=0

hit() {
  local label="$1" path="$2"
  local start end code body
  body=$(mktemp -t warm_v2)
  start=$(date +%s)
  code=$(curl -s -o "$body" -w "%{http_code}" -m 240 "${BASE_URL}${path}")
  end=$(date +%s)
  if [[ "$code" =~ ^2 ]]; then
    printf "  ok   %-26s %3ss  %s\n" "$label" "$((end - start))" "$path"
  else
    FAIL=1
    printf "  FAIL %-26s %3ss  HTTP %s  %s\n" "$label" "$((end - start))" "$code" "$path"
    head -c 400 "$body"; echo
  fi
  rm -f "$body"
  [[ "$code" =~ ^2 ]]
}

echo "[warm_v2] Warming v2 storyline against ${BASE_URL}"
# Run the two Home cards first (what Jamie sees on open), in parallel.
# Background jobs cannot set FAIL in this shell, so collect their exit codes.
pids=()
hit "core-finding (NBA2K)"   "/api/insights/core-finding?franchise=NBA2K" & pids+=($!)
hit "weekly-briefing"        "/api/insights/weekly-briefing" & pids+=($!)
hit "recent-creatives"       "/api/insights/recent-creatives?limit=5" & pids+=($!)
for p in "${pids[@]}"; do wait "$p" || FAIL=1; done
hit "player/featured"        "/api/v2/player/featured" || FAIL=1
hit "crew/churn"             "/api/v2/crew/churn" || FAIL=1
hit "crew/lost-core-member"  "/api/v2/crew/lost-core-member?days=7" || FAIL=1
hit "creator/incremental"    "/api/v2/creator/incremental" || FAIL=1
# Confirm the core-finding cache is now a hit.
curl -s -m 30 "${BASE_URL}/api/insights/core-finding?franchise=NBA2K" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('  core-finding cache:', d.get('cache'), 'computed_at', d.get('computed_at'))" 2>/dev/null \
  || echo "  core-finding cache check failed"

if [[ $FAIL -ne 0 ]]; then
  echo "[warm_v2] One or more routes FAILED. Fix before the demo (no fallbacks)."
  exit 1
fi
echo "[warm_v2] All v2 routes warm."
