#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

BASENAME=$(basename "$FILE_PATH")
PROTECTED=(".env" ".env.local" ".env.production" "package-lock.json")
for p in "${PROTECTED[@]}"; do
  [[ "$BASENAME" == "$p" ]] && echo "Blocked: $FILE_PATH is a protected file" >&2 && exit 2
done
exit 0
