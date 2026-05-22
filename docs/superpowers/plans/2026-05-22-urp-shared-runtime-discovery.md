# URP Shared Runtime Discovery v0.1

**Goal:** Discovery-only slice for URP shared runtime — local manifest template + SAT-governed write boundary — without network, UKE ingest, PAT leakage, tokens, or chain mint.

**Shipped in repo:**

- `packages/core/src/urp-shared-runtime-discovery.js`
- `scripts/urp-shared-discovery.mjs`
- `tests/urp-shared-runtime-discovery.test.js`
- `npm run urp:discovery`

**Not in scope (v0.1):** filesystem persist under `DEMA_HOME`, CLI `dema urp` surface, federation, UKE runtime.

**Next slice after merge:** persist manifest only when `discovery_only: false` + typed GO + SAT `pipeline_verified` + dedicated consent tests.
