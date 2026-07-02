# NODE0-LOCAL-CLOSURE-READINESS-1A

Truth label: `NODE0_LOCAL_CLOSURE_READINESS_MEASURED_REPO`

## Purpose

Compose the Node0 evidence source registry and space-index envelope into local closure readiness with PAT/SAT metadata-only gates and no-mint blockers.

## Input Contract

```js
runNode0LocalClosureReadiness({ consent, input })
```

Exact consent:

```text
GO: build Node0 local closure readiness preview
```

## Output Contract

```text
schema
truth_label
ok
content_hash
readiness_status
operator_topology
sources
index
pipeline
impact_queue
next_action
remaining_gates
mint
boundary
```

`readiness_status` is `READY_FOR_HASH_CONSENT` for metadata-only indexes and
`READY_FOR_DEDUP_PLAN` once an already-consented content-hash index is supplied.
The next action is still plan-only. The SAT lane remains metadata-only and
blocked until an apply receipt exists.

## Verification

```js
verifyNode0LocalClosureReadiness(payload)
```

Verification re-derives the content hash and also checks policy invariants, so a
self-consistent payload that recomputes the hash while promoting live mint still
fails.

## Boundaries

- Pure kernel: no scan, no content read, no write, no network, no model call.
- No dedup apply, reorg apply, SAT submission, PoI verification, wallet, token,
  daemon, federation, or live execution.
- Registration and readiness are not impact verification.
- Every impact queue row is `REVIEW_CANDIDATE_ONLY`; economy simulation is not
  an impact queue source.

## Files

```text
packages/core/src/node0-local-closure-readiness.js
tests/node0-local-closure-readiness.test.js
scripts/review/node0-local-closure-readiness-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/NODE0_LOCAL_CLOSURE_READINESS_1A.md
docs/02-architecture/NODE0_LOCAL_CLOSURE_READINESS_v0_1.md
```

## Commands

```bash
node --test tests/node0-local-closure-readiness.test.js
node scripts/review/node0-local-closure-readiness-check.mjs --json
npm test
npm run check
```
