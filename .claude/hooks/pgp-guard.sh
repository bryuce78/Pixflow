#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

PROTECTED=(
  "src/server/routes/prompts.ts"
  "src/server/routes/videos.ts"
  "src/server/services/promptGenerator.ts"
  "src/server/services/research.ts"
  "src/server/services/ytdlp.ts"
  "src/server/services/wizper.ts"
  "src/server/utils/prompts.ts"
  "docs/PIPELINE.md"
  "docs/ops/pgp-lock.json"
  "scripts/pgp-lock-guard.js"
)

REL_PATH="${FILE_PATH#$CLAUDE_PROJECT_DIR/}"

for p in "${PROTECTED[@]}"; do
  if [[ "$REL_PATH" == "$p" ]]; then
    echo "BLOCKED: $REL_PATH is PGP-protected. Run 'npm run pgp:lock:check' and get explicit user approval before editing." >&2
    exit 2
  fi
done
exit 0
