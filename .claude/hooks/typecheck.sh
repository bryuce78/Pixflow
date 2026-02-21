#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ ! "$FILE_PATH" =~ \.(ts|tsx)$ ]]; then
  exit 0
fi

OUTPUT=$(npx tsc --noEmit --pretty 2>&1 | head -30)
if [[ $? -ne 0 ]]; then
  echo "$OUTPUT" >&2
  exit 1
fi
exit 0
