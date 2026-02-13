#!/usr/bin/env bash
set -euo pipefail

mode="${1:-production}"
project_name="${PIXFLOW_CF_PAGES_PROJECT:-pixflow-web}"
preview_branch="${PIXFLOW_CF_PREVIEW_BRANCH:-staging}"
allow_relative_api="${PIXFLOW_ALLOW_RELATIVE_API:-0}"

if [[ "$mode" != "production" && "$mode" != "preview" ]]; then
  echo "Usage: bash scripts/deploy-pages.sh [production|preview]"
  exit 1
fi

if [[ "$allow_relative_api" != "1" && -z "${VITE_API_BASE_URL:-}" ]]; then
  echo "VITE_API_BASE_URL is empty."
  echo "Set VITE_API_BASE_URL for Cloudflare Pages deploy, or set PIXFLOW_ALLOW_RELATIVE_API=1 if API is same-origin."
  exit 1
fi

if [[ ! -t 0 && -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "CLOUDFLARE_API_TOKEN is required in non-interactive environments."
  echo "Set CLOUDFLARE_API_TOKEN, then retry deploy."
  exit 1
fi

echo "Checking Cloudflare auth..."
npx wrangler whoami >/dev/null

echo "Building web app..."
npm run build:web

if [[ ! -d "dist/web" ]]; then
  echo "Build output dist/web not found."
  exit 1
fi

if [[ "$mode" == "preview" ]]; then
  echo "Deploying preview to Cloudflare Pages project=${project_name} branch=${preview_branch}"
  npx wrangler pages deploy dist/web --project-name "$project_name" --branch "$preview_branch"
else
  echo "Deploying production to Cloudflare Pages project=${project_name}"
  npx wrangler pages deploy dist/web --project-name "$project_name"
fi
