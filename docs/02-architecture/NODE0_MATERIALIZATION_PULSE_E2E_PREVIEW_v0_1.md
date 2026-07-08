# NODE0-MATERIALIZATION-PULSE-E2E-PREVIEW-1A

Truth label: `NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_MEASURED_REPO`

## Purpose

**The capstone: it makes the assembled Materialization Pulse RUN.** After the five station kernels were
built + tested in isolation, this is the orchestrator that takes ONE real local mission through them and
produces one chained receipt + a per-station ladder. It composes the existing pure kernels — it
re-implements nothing.

## The chain

```text
rung 1  sanitize(file_text)   → input_safety
rung 2  plan-branch(branches) → plan
rung 3  FATE (caller verdict) → fate
rung 4  claim-gate(claims)    → claim_binding + claims_public_safe
rung 5  assemble #351 envelope → SEALED or ABORTED Pulse receipt
```

Each rung → ladder entry `{ station, ok, verdict, content_hash, blocked_by[] }`.

## Atomicity (inherited from the #351 envelope, not re-invented)

- sanitize ALLOWED → proceed; **BLOCKED / QUARANTINED → abort @ rung 1** (only cleared input runs a mission)
- plan-branch not ok, or **FATE = REJECT / authority-violation → abort** at that rung
- claim-gate rejection of a public claim → **no abort**; sets `claims_public_safe: false`
- all pass → `pulse_status: sealed`; any block → `aborted`, chain stops, **the receipt still records where + why**

## Units

1. `packages/core/src/node0-materialization-pulse-e2e-preview.js` — pure orchestrator (composes station kernels).
2. `dema mission run <file>` — thin CLI: reads one real file read-only, runs it through the chain with a benign built-in demo mission, prints the ladder, exits non-zero unless sealed.
3. `scripts/review/materialization-pulse-e2e-fixtures.mjs` — example missions (happy + abort variants), kept out of the scanned kernel.

## Input / Output

```js
runNode0MaterializationPulseE2ePreview({ consent, input })   // input = { mission: {...} }
```
Exact consent: `GO: node0 materialization pulse e2e preview`. Output: `ok · status · pulse_status ·
final_verdict · reached_station · station_count · claims_public_safe · ladder[] · pulse_receipt(#351
envelope | null) · content_hash · boundary(all-false)`.

## Verification

`verify` re-derives the content hash, re-verifies the embedded #351 envelope, and cross-checks that
each ladder station hash matches the sealed envelope's bound reference — so a forged rung or laundered
authority (even with a recomputed hash) is rejected. An aborted pulse must carry no envelope and a
blocked last rung.

## What this does NOT prove

Runs no live model, executes no real-world action, publishes/mints nothing. A `sealed` pulse means the
assembled PREVIEW stations passed on this input — NOT that the mission was executed or the claims are
true. The orchestrator adds composition, not authority.

## Commands

```bash
node --test tests/node0-materialization-pulse-e2e-preview.test.js
node --test tests/node0-materialization-pulse-e2e-cli.test.js
node scripts/review/node0-materialization-pulse-e2e-preview-check.mjs --json
dema mission run <file>
npm test && npm run check && npm run coverage
```
