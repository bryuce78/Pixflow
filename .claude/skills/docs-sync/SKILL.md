---
name: docs-sync
description: Sync documentation after feature changes per docs/INDEX.md protocol
---

# Docs Sync

Synchronize active documentation after code changes.

## Protocol

1. Read `docs/INDEX.md` to get the active docs map
2. Scan recent git changes to identify which features were modified:
   ```bash
   git diff --name-only HEAD~1 HEAD 2>/dev/null || git diff --name-only HEAD
   ```
3. Update **only** docs listed under "Core" and "Supporting" in INDEX.md that are affected by recent changes
4. **Never** edit files under `docs/archive/` unless explicitly requested
5. Update `Last updated:` date on each modified doc to today's date
6. Return a concise changelog listing:
   - Which docs were updated
   - What changed in each (1-line summary)
7. **Do NOT commit.** Wait for user to say `go` before creating a docs-only commit

## Docs to Check

| File | Update When |
|------|-------------|
| `CLAUDE.md` | New features, patterns, gotchas, or commands added |
| `README.md` | New product modules, setup changes, or command changes |
| `docs/PIXFLOW_AI_VERSIONING_HANDOFF.md` | Any significant feature work (add new section at top) |
| `docs/PIXFLOW_UI_RULES.md` | Layout or component pattern changes |
| `docs/REPO_STRUCTURE.md` | New directories or major file reorganization |
| `docs/SCHEMA.md` | Prompt schema changes |
| `docs/PIPELINE.md` | Prompt Factory pipeline changes (PGP-protected — check lock first!) |
| `docs/CLOUDFLARE_DEPLOY.md` | Deployment config changes |

## Rules

- Keep updates concise — match the existing doc style
- Do not create new doc files unless explicitly asked
- Do not duplicate information across docs
- PIPELINE.md is PGP-protected: run `npm run pgp:lock:check` before and after any changes
