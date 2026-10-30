#!/usr/bin/env bash
set -euo pipefail
export PORT="${PORT:-10000}"
export HOST=0.0.0.0
export HTTP_ADDR=127.0.0.1:3000
export BACKEND_API_BASE_URL=http://127.0.0.1:3000
export LIVE_TRANSPORT=r2
cd /app/backend
./shekinah-api &
api_pid=$!
node /app/admin/.output/server/index.mjs &
admin_pid=$!
cleanup() { kill "$api_pid" "$admin_pid" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
# Stop the whole service if either process exits. Render can restart it, rather
# than leaving an admin that silently serves a dead API.
set +e
wait -n "$api_pid" "$admin_pid"
status=$?
set -e
exit "$status"
