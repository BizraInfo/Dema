# Receipt: AWAY-CONTRACT-1A

Truth label: `AWAY_CONTRACT_DESIGNED_NOT_LIVE`

## Slice

Away Contract ladder (ADR-043 · `docs/02-architecture/AWAY_CONTRACT_SPEC_v0_1.md`):
schema validator → body-bound verifier → consent-gated receipt writer → draft
compiler → `dema away draft|verify|receipt` CLI. Contracts are drafted,
validated, verified, and receipted — **never started**.

```text
spec → schema → verify → receipt → compiler → CLI (draft · verify · receipt)
```

## Proof Contract

The review gate must pass only while:

- a docs-only fixture intent compiles into a shape-valid contract with a
  deterministic `<prefix>-<hash12>` id under injected act-time,
- the body-bound verifier accepts the exact compiled pair,
- a drifted contract against the original validation_result is rejected AND
  flagged `launder_attempt_detected`,
- the consent phrase derives as `GO: write away-contract receipt <id> <hash12>`,
- every boundary stays all-false (no execution, no contract start, no receipt
  written by the gate itself, no model, no network, no mint, no daemon).

`npm run check` runs `away-contract-check.mjs` and keeps `AWAY_CONTRACT_1A`
at `MEASURED_REPO` (repo-measured kernels; runtime stays `PREVIEW_ONLY`).

## Commands

```bash
node --test tests/away-contract-schema.test.js tests/away-contract-verify.test.js \
  tests/away-contract-receipt.test.js tests/away-contract-compiler.test.js \
  tests/away-contract-cli-draft.test.js tests/away-contract-cli-verify.test.js \
  tests/away-contract-cli-receipt.test.js
node scripts/review/away-contract-check.mjs --json
npm run check
```

## Non-claims

No live absence stewardship · no `dema away start` (does not exist) · no
unattended runtime · no model invocation · no network · no mint · no daemon.
The receipt rung records operator consent to REMEMBER a contract, not to run it.
