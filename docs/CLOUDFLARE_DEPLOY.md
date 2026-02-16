# Cloudflare Deploy (Web Frontend)

Last updated: 2026-02-15

This project is currently deployed to Cloudflare as:
- **Pages** for frontend (`dist/web`)
- **Workers API Gateway** for `/api` + static output path proxying

## Why backend is still separate

The backend in `/src/server` depends on:
- `better-sqlite3` (native module)
- local filesystem writes (`outputs/`, `uploads/`, `avatars_generated/`)

Those are not compatible with a direct Workers runtime port without a deeper refactor (D1/R2/Queues or separate containerized backend).
Current recommended production shape:
- Frontend on Cloudflare Pages
- API Gateway on Cloudflare Workers
- Node backend on Railway/Fly/Render/etc.

## Prerequisites

1. Cloudflare auth:
```bash
npx wrangler login
npx wrangler whoami
```

2. Set API base URL for the frontend build:
```bash
export VITE_API_BASE_URL="https://your-api-domain.example.com"
```

If using the Worker API gateway, set:
```bash
export VITE_API_BASE_URL="https://pixflow-api-gateway.<your-subdomain>.workers.dev"
```

In non-interactive environments (CI), also set:
```bash
export CLOUDFLARE_API_TOKEN="your-token"
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
```

3. Optional project settings:
```bash
export PIXFLOW_CF_PAGES_PROJECT="pixflow-web"
export PIXFLOW_CF_PREVIEW_BRANCH="staging"
```

## Deploy commands

Production:
```bash
npm run deploy:pages
```

Preview:
```bash
npm run deploy:pages:preview
```

Worker API gateway:
```bash
export BACKEND_ORIGIN="https://your-backend-domain.example.com"
npm run deploy:worker:api
```

Optional Worker vars:
- `ALLOWED_ORIGINS` (comma-separated allowlist, empty = reflect request origin)
- `UPSTREAM_TIMEOUT_MS` (default `610000`)

Local gateway dev against local Node backend:
```bash
BACKEND_ORIGIN="http://localhost:3002" npm run dev:worker:api
```

Safety rule for collaborative sessions:
- Never deploy without explicit user approval.

## First-time project creation (if project does not exist)

Create once from Cloudflare dashboard:
- Workers & Pages -> Create -> Pages -> Direct Upload or Git connect
- Project name must match `PIXFLOW_CF_PAGES_PROJECT` (default: `pixflow-web`)

Then run the deploy script above.

## Current deployment files

- `wrangler.toml`
- `wrangler.api-proxy.toml`
- `scripts/deploy-pages.sh`
- `scripts/deploy-worker-api.sh`
- `.github/workflows/deploy-pages.yml`
- `package.json` scripts:
  - `cf:whoami`
  - `deploy:pages`
  - `deploy:pages:preview`
  - `dev:worker:api`
  - `deploy:worker:api`

## GitHub Actions deploy

Workflow: `.github/workflows/deploy-pages.yml`

Required repository secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `VITE_API_BASE_URL`
- `BACKEND_ORIGIN` (for `.github/workflows/deploy-worker-api.yml`)

Optional repository variable:
- `CF_PAGES_PROJECT` (default fallback: `pixflow-web`)
