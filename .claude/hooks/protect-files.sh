#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

PROTECTED=(".env" ".env.local" ".env.production" "package-lock.json")
for p in "${PROTECTED[@]}"; do
  [[ "$FILE_PATH" == *"$p"* ]] && echo "Blocked: $FILE_PATH matches protected pattern '$p'" >&2 && exit 2
done
exit 0
