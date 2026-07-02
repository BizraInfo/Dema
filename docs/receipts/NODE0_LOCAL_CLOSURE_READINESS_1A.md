# Receipt: NODE0-LOCAL-CLOSURE-READINESS-1A

Truth label: `NODE0_LOCAL_CLOSURE_READINESS_MEASURED_REPO`

## Slice

Compose the Node0 evidence source registry and space-index envelope into local closure readiness with PAT/SAT metadata-only gates and no-mint blockers.

```text
plan → build → verify → tamper-reject
```

## Proof Contract

The default gate must pass only while:

- the exact GO phrase matches byte-for-byte,
- the source registry and Node0 space-index envelopes are structurally valid,
- the canonical readiness payload is content-addressed,
- the pipeline preserves `source_registry -> metadata_index -> hash consent -> dedup plan -> reorg plan -> apply -> SAT metadata -> PoI -> mint`,
- impact candidates remain `REVIEW_CANDIDATE_ONLY`,
- the economy simulator is excluded from the impact queue,
- live and preview mint amounts stay zero before verified PoI,
- stale-hash tamper and self-consistent live-mint promotion are rejected,
- the readiness kernel boundary stays all-false.

`npm run check` runs `node0-local-closure-readiness-check.mjs` and keeps `NODE0_LOCAL_CLOSURE_READINESS_1A` at `MEASURED_REPO`.

## Non-Claims

This receipt does not prove content ingestion, dedup execution, file
reorganization, SAT acceptance, verified impact, live token minting, wallet
access, daemon runtime, network use, or federation.

## Commands

```bash
node --test tests/node0-local-closure-readiness.test.js
node scripts/review/node0-local-closure-readiness-check.mjs --json
npm run check
```
