#!/usr/bin/env bash
set -euo pipefail

echo "Checking Cloudflare auth..."
npx wrangler whoami >/dev/null

if [[ -z "${BACKEND_ORIGIN:-}" ]]; then
  echo "BACKEND_ORIGIN is empty."
  echo "Example: export BACKEND_ORIGIN=https://pixflow-backend.railway.app"
  exit 1
fi

echo "Updating BACKEND_ORIGIN secret..."
printf '%s' "$BACKEND_ORIGIN" | npx wrangler secret put BACKEND_ORIGIN --config wrangler.api-proxy.toml >/dev/null

echo "Deploying API gateway worker..."
npx wrangler deploy --config wrangler.api-proxy.toml
