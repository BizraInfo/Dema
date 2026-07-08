# NODE0-MATERIALIZATION-PULSE-E2E-PREVIEW-1A

Truth label: `NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_MEASURED_REPO`

## Receipt

The capstone of the Materialization Pulse: an orchestrator that RUNS one real local mission through the
five assembled station kernels end to end. The train runs. `dema mission run <file>`.

## Proven

- the assembled Pulse composes + runs: sanitize → plan-branch → FATE → claim-gate → pulse-receipt
- a clean mission SEALS with a full 5-rung green ladder
- an injection file aborts @ rung 1 (BLOCKED); a secret file aborts @ rung 1 (QUARANTINED)
- an unaccounted plan branch aborts @ rung 2; a FATE reject aborts @ rung 3
- an overclaim seals but sets claims_public_safe:false (a claim rejection does not abort)
- an aborted pulse still emits a receipt recording where + why
- verify re-derives the hash, re-verifies the embedded envelope, and cross-checks ladder-vs-envelope hashes
- forged rungs + laundered authority (recomputed hash) are rejected
- the CLI reads a real file read-only and exits non-zero unless sealed

## Not proven

- no live model invoked, no real-world action executed, no publication, no mint
- a sealed pulse means the assembled PREVIEW stations passed — NOT that the mission ran or the claims are true

## Boundary

Preview-only. Composes pure kernels. `authority_delta` 0, boundary all-false, no model/network/mint.

## Gates

```bash
node --test tests/node0-materialization-pulse-e2e-preview.test.js
node --test tests/node0-materialization-pulse-e2e-cli.test.js
node scripts/review/node0-materialization-pulse-e2e-preview-check.mjs --json
npm test && npm run check && npm run coverage
```
