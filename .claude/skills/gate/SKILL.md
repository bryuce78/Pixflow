---
name: gate
description: Run release gate checks and optionally push to main
disable-model-invocation: true
---

# Release Gate

Run the full release gate pipeline and report results.

## Steps

1. Run `npm run gate:release`
2. If all gates pass, show a success summary and ask if I should `git push origin main`
3. If any gate fails, show which gate failed and suggest fixes — do NOT push
