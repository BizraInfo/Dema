---
paths:
  - "apps/cli/**"
  - "bin/**"
---

# Path rule — CLI commands

Register commands in `apps/cli/src/index.js` and update `tests/cli-command-table.test.js`.

CLI wrappers call gatherers + kernels only — no hidden side effects.

Preview commands must print `PREVIEW_ONLY` / boundary labels in `--json` output.

Consent-gated commands: exact-string phrase from `packages/fate` or domain-specific consent modules.

Help text must not advertise DESIGNED_NOT_LIVE surfaces as live.
