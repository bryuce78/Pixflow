# Pixflow

AI-powered web platform for creative asset production workflows.

## Features

### 🎨 Prompt Factory
Transform concepts and images into structured, production-ready prompts for AI generation.

### 🖼️ Asset Monster
Batch image generation with advanced prompt management:
- Generated, custom, and library prompt sources
- Reference image support (up to 5 images)
- Character-consistent generation
- Configurable aspect ratios, resolutions, and formats

### 👤 Avatar Studio
Create AI avatars with scripts, text-to-speech, and lip-sync capabilities.

### 🔧 The Machine
End-to-end pipeline orchestration for automated asset production.

### 📚 Library
Organize, favorite, and reuse your best prompts and generated assets.

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express
- **Styling**: TailwindCSS
- **State Management**: Zustand
- **AI Services**: OpenAI, FAL.ai, ElevenLabs, Hedra, Kling

## Getting Started

### Prerequisites

- Node.js 20.x (required)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your API keys to .env

# Start web app (API + UI)
npm run dev
```

Or run each process separately:

```bash
npm run dev:web:server
npm run dev:web:client
```

Default web API port is `3002` (override with `PIXFLOW_WEB_API_PORT`).

### Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Cloudflare Pages Deploy

Pixflow is currently deployed as a frontend Pages app.

```bash
# one-time auth
npx wrangler login
npx wrangler whoami

# set backend API origin used by frontend build
export VITE_API_BASE_URL="https://your-api-domain.example.com"

# deploy
npm run deploy:pages
```

Detailed guide: `/Users/pixery/Projects/pixflow/docs/CLOUDFLARE_DEPLOY.md`

CI option:
- GitHub workflow `/Users/pixery/Projects/pixflow/.github/workflows/deploy-pages.yml` deploys on `main` pushes (and manual preview runs).

## Project Structure

```
pixflow/
├── src/
│   ├── renderer/      # React UI application
│   └── server/        # Express API server
├── docs/              # Documentation
├── avatars/           # Manual avatar gallery (curated)
└── outputs/           # Generated assets
```

## Configuration

API keys required in `.env`:
- `OPENAI_API_KEY` - For prompt generation and text processing
- `FAL_API_KEY` - For image generation
- `ELEVENLABS_API_KEY` - For text-to-speech
- `HEDRA_API_KEY` - For video generation
- `KLING_API_KEY` - For advanced video generation

## Development

```bash
# Run tests
npm test

# Lint code (TypeScript + Biome)
npm run lint
npm run lint:biome

# Format code
npm run format
```

## License

Private - All rights reserved

## Notes

- Login screen is disabled by default (`PIXFLOW_AUTH_MODE=disabled`).
- Re-enable token auth with `PIXFLOW_AUTH_MODE=token` and `VITE_PIXFLOW_DISABLE_LOGIN=0`.
- Gallery (`avatars/`) is manually curated - generated assets do not auto-populate
- Generated images are saved to `outputs/` directory
- Avatar Studio outputs go to `avatars_generated/` (not included in gallery)
