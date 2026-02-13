#!/usr/bin/env bash
set -euo pipefail

server_pid=""
client_pid=""

cleanup() {
  if [[ -n "$server_pid" ]]; then
    kill "$server_pid" 2>/dev/null || true
  fi
  if [[ -n "$client_pid" ]]; then
    kill "$client_pid" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

npm run dev:web:server &
server_pid="$!"

npm run dev:web:client &
client_pid="$!"

set +e
exit_code=0
while true; do
  if ! kill -0 "$server_pid" 2>/dev/null; then
    wait "$server_pid"
    exit_code=$?
    break
  fi
  if ! kill -0 "$client_pid" 2>/dev/null; then
    wait "$client_pid"
    exit_code=$?
    break
  fi
  sleep 1
done
set -e

cleanup
wait "$server_pid" "$client_pid" 2>/dev/null || true
exit "$exit_code"
