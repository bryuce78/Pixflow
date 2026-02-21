---
name: commit
description: Stage, review, and commit changes following Pixflow conventions
disable-model-invocation: true
---

# Commit

Stage and commit current changes following Pixflow project conventions.

## Workflow

### 1. Gather Context (in parallel)

```bash
git status
git diff --staged
git diff
git log --oneline -5
```

### 2. Pre-commit Checks

Run quality checks before committing:

```bash
npm run lint && npm run lint:biome && npm run format:check
```

If any check fails, fix the issues first and re-run.

If PGP-protected files were modified, run:
```bash
npm run pgp:lock:check
```

### 3. Stage Files

- Stage specific files by name — avoid `git add -A` or `git add .`
- Never stage: `.env`, `.env.local`, `.env.production`, `credentials.json`, or any file containing secrets
- Review what's being staged before proceeding

### 4. Draft Commit Message

Follow conventional commit format:

```
type(scope): short description

Optional body explaining the "why"

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

**Types:** `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `perf`
**Scopes:** `compose`, `captions`, `lifetime`, `avatars`, `prompts`, `machine`, `ui`, `server`, etc.

Match the style of recent commits visible in `git log`.

### 5. Commit

Use HEREDOC format for the message:
```bash
git commit -m "$(cat <<'EOF'
type(scope): description

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

### 6. Verify

```bash
git status
git log --oneline -3
```

## Rules

- Never amend previous commits unless explicitly asked
- Never push to remote unless explicitly asked
- Never force push
- If pre-commit hook fails, fix and create a NEW commit
- One commit per logical change — don't batch unrelated work
