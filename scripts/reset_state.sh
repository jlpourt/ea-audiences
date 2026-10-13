#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "[reset_state] Resetting 2K Courtside demo state via ${BASE_URL}/api/reset..."
RESPONSE="$(curl -sf -X POST "${BASE_URL}/api/reset" -H "Content-Type: application/json")"
echo "[reset_state] Done: ${RESPONSE}"
