#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "[warm_cache] Warming 2K Courtside Command against ${BASE_URL}..."

echo "  1/5 Probing /api/health..."
curl -sf "${BASE_URL}/api/health" > /dev/null

echo "  2/5 Warming catalog & Sankey journey (/api/catalog, /api/marketing/journey/summary)..."
curl -sf "${BASE_URL}/api/catalog" > /dev/null
curl -sf "${BASE_URL}/api/marketing/journey/summary" > /dev/null

echo "  3/5 Warming 2K Identity Graph view (/api/graph/view)..."
curl -sf "${BASE_URL}/api/graph/view" > /dev/null

echo "  4/5 Warming Play 1 NL-to-GQL fastpath (/api/audiences/nl-query)..."
curl -sf -X POST "${BASE_URL}/api/audiences/nl-query" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Find NBA 2K27 MyCAREER players stuck below 85 OVR who spent over $50 on VC in the last 90 days and stopped logging in for 7+ days, along with their active Rec Crew captains"}' > /dev/null

echo "  5/5 Warming Play 2 & Play 3 NL-to-GQL fastpaths..."
curl -sf -X POST "${BASE_URL}/api/audiences/nl-query" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Find NBA 2K26 veterans who spent on VC or MyTEAM and have not yet migrated to NBA 2K27 Hall of Fame Edition"}' > /dev/null
curl -sf -X POST "${BASE_URL}/api/audiences/nl-query" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Find MyTEAM pack whales with 10+ Galaxy Opal cards on the Hall of Fame Season Pass"}' > /dev/null

echo "[warm_cache] All connection pools and Golden Play routes warmed."
