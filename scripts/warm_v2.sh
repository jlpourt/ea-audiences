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
hit "portfolio (Take-Two)"    "/api/v2/portfolio" || FAIL=1
hit "portfolio retention (BQ)" "/api/v2/portfolio/retention" || FAIL=1
hit "play: warm intro"        "/api/v2/actions/audience?play=warm_intro&segment=rockstar-nba2k" || FAIL=1
hit "play: warm intro (zynga)" "/api/v2/actions/audience?play=warm_intro&segment=zynga-gtao" || FAIL=1
hit "play: GTA VI day one"    "/api/v2/actions/audience?play=gta6_window&segment=day_one" || FAIL=1
hit "play: GTA VI momentum"   "/api/v2/actions/audience?play=gta6_window&segment=shield" || FAIL=1
hit "play: warm intro (2K)"   "/api/v2/actions/audience?play=warm_intro&segment=2k-gtao" || FAIL=1
hit "play: GTA VI halo"       "/api/v2/actions/audience?play=gta6_window&segment=halo" || FAIL=1
hit "play: save elsewhere"    "/api/v2/actions/audience?play=save_elsewhere&segment=fading_2k" || FAIL=1
hit "play: warm intro (mafia)" "/api/v2/actions/audience?play=warm_intro&segment=rockstar-mafia" || FAIL=1
hit "play: warm intro (2K mob)" "/api/v2/actions/audience?play=warm_intro&segment=zynga-nba2kmobile" || FAIL=1
hit "player 360: featured"    "/api/v2/player/featured" || FAIL=1
hit "deep dive: creator hubs" "/api/v2/creator/hubs" || FAIL=1
hit "deep dive: brand attach" "/api/v2/brand/attach" || FAIL=1
hit "deep dive: social hops"  "/api/v2/social/hops" || FAIL=1
hit "deep dive: hops x-label" "/api/v2/social/hops?from=archetype:REC_CREW_CAPTAIN&to=archetype:GTAO_HEIST_CREW" || FAIL=1
hit "deep dive: concept users" "/api/v2/personalize/users" || FAIL=1
hit "deep dive: x-label creators" "/api/v2/crosslabel/creators" || FAIL=1
hit "player/featured"        "/api/v2/player/featured" || FAIL=1
hit "crew/churn"             "/api/v2/crew/churn" || FAIL=1
hit "crew/lost-core-member"  "/api/v2/crew/lost-core-member?days=7" || FAIL=1
hit "creator/incremental"    "/api/v2/creator/incremental" || FAIL=1
# Warm "Load cohort" for every core finding (NL->GQL translation + live Spanner
# result, both cached in-process by /api/audiences/nl-query).
curl -s -m 30 "${BASE_URL}/api/insights/core-finding?franchise=NBA2K" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); [print(f['queryToRun']) for f in d.get('findings',[]) if f.get('queryToRun')]" 2>/dev/null \
  | while IFS= read -r q; do
      start=$(date +%s)
      code=$(curl -s -o /dev/null -w "%{http_code}" -m 240 -X POST "${BASE_URL}/api/audiences/nl-query" \
        -H 'content-type: application/json' \
        -d "$(python3 -c 'import json,sys; print(json.dumps({"query": sys.argv[1], "franchise": "NBA2K"}))' "$q")")
      printf "  %-4s %-26s %3ss  %s\n" "$([[ "$code" =~ ^2 ]] && echo ok || echo FAIL)" "cohort (nl-query)" "$(( $(date +%s) - start ))" "${q:0:70}"
    done
# Confirm the core-finding cache is now a hit.
curl -s -m 30 "${BASE_URL}/api/insights/core-finding?franchise=NBA2K" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('  core-finding cache:', d.get('cache'), 'computed_at', d.get('computed_at'))" 2>/dev/null \
  || echo "  core-finding cache check failed"

if [[ $FAIL -ne 0 ]]; then
  echo "[warm_v2] One or more routes FAILED. Fix before the demo (no fallbacks)."
  exit 1
fi
echo "[warm_v2] All v2 routes warm."
