#!/usr/bin/env zsh
# Launches two isolated watchlist clients on ports 7891 (Client A) and 7892 (Client B).
# Each client has its own localStorage (different origin). Both use the token in config.js.
# Usage: ./scripts/test-sync.sh [--open]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT_A=7891
PORT_B=7892

cleanup() {
  echo "\nStopping servers..."
  kill "$PID_A" "$PID_B" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Kill any stale servers on these ports
lsof -ti tcp:$PORT_A | xargs kill -9 2>/dev/null || true
lsof -ti tcp:$PORT_B | xargs kill -9 2>/dev/null || true

# Serve the app root from two different ports
# Different ports = different origins = isolated localStorage
python3 -m http.server $PORT_A --directory "$ROOT" --bind 127.0.0.1 &>/tmp/watchlist-A.log &
PID_A=$!
python3 -m http.server $PORT_B --directory "$ROOT" --bind 127.0.0.1 &>/tmp/watchlist-B.log &
PID_B=$!

sleep 0.5

echo "Client A → http://127.0.0.1:$PORT_A  (logs: /tmp/watchlist-A.log)"
echo "Client B → http://127.0.0.1:$PORT_B  (logs: /tmp/watchlist-B.log)"
echo ""
echo "Both clients share the same config.js token → same GitHub Gist."
echo "localStorage is isolated per origin — each client has independent state."
echo ""

# Open both in browser
open "http://127.0.0.1:$PORT_A"
sleep 0.3
open "http://127.0.0.1:$PORT_B"

echo "Press Ctrl+C to stop."
wait
