#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ ! "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
  exit 0
fi

npx biome format --write "$FILE_PATH" 2>/dev/null
exit 0
