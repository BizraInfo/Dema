# Receipt: NODE0-MINIMUM-SEASON-SAVE-RESUME-1A

Truth label: `NODE0_MINIMUM_SEASON_SAVE_RESUME_MEASURED_REPO`

## Slice

Durable local season state: save, status and resume a bounded Node0 continuation
checkpoint from disk alone.

The question this slice answers: **after the model disappears, what does a new
process know?** Not "everything" — exactly six things, and no more:

1. which mission is active,
2. what has already completed,
3. what must not be repeated,
4. what consent is still pending,
5. the exact next safe action,
6. the repository commit and tree that produced the checkpoint.

```text
save:    validate → read+verify HEAD → bind previous → hash → publish state →
         fsync → publish receipt → fsync → win sequence fence → replace HEAD
         (rename) → fsync dir → re-read and verify → return hashes
status:  read HEAD → verify head/state/receipt/previous-link → report → mutate nothing
resume:  verify chain → verify repository binding → project continuation → execute nothing
```

## Surfaces

| Role | Path |
| --- | --- |
| Pure kernel (shape, hash, chain algebra, refusal reasons) | `packages/core/src/node0-minimum-season-save-resume.js` |
| I/O tier (publication, fsync, fence, HEAD) | `packages/receipts/src/season-state-store.js` |
| CLI | `apps/cli/src/commands/season.js` — `dema season save\|status\|resume` |
| Tests (S1–S13) | `tests/node0-minimum-season-save-resume.test.js` |
| Review gate | `scripts/review/node0-minimum-season-save-resume-check.mjs` |
| Architecture | `docs/02-architecture/NODE0_MINIMUM_SEASON_SAVE_RESUME_v0_1.md` |

## Storage layout

```text
$DEMA_HOME/seasons/<season_id>/
  states/sha256-<64hex>.json      immutable, content-addressed
  receipts/sha256-<64hex>.json    immutable, binds state_hash + saved_at
  seq/<NNNNNN>.json               the sequence FENCE — owns "who wrote N"
  HEAD.json                       mutable pointer, replaced by rename()
```

## Proof Contract

28 focused tests, all green. The load-bearing ones do not simulate:

- **S3** spawns a real writer process that exits, then reconstructs via the
  shipped CLI in a second process. No shared object, no transcript.
- **S6 / S6b / S7** call `process.exit()` *inside* the save transaction — before
  the fence, holding the fence, and immediately after HEAD publication. `finally`
  does not run after `process.exit`, which is exactly the point.
- **S13** races two real processes from the same HEAD, barriered at the
  documented `linkFile` seam so both genuinely contend for sequence N.
- **S9b** forges a HEAD *and re-hashes it* so it is internally self-consistent;
  the sequence fence — not the HEAD's own hash — is what refuses it.

Fail-closed, typed, no stack traces, no path leakage: malformed HEAD, missing
state, state/receipt hash mismatch, broken previous link, sequence regression,
repository commit/tree mismatch, unknown schema, secret-bearing state, invalid
pending-consent shape, conflicting HEAD candidates.

## What this does NOT prove

- No semantic memory, vector store, or knowledge graph.
- No cross-host replication — local single-node storage only.
- No autonomous execution on resume: resume is reconstruction, never continuation.
- No daemon, no network, no model-state persistence.
- Pending consent is **preserved, never inferred and never granted**.
- Does not close Node0 and does not make Dema active.

## Commands

```bash
node --test tests/node0-minimum-season-save-resume.test.js
node scripts/review/node0-minimum-season-save-resume-check.mjs --json
node apps/cli/src/index.js season status --json --dema-home <isolated>
node apps/cli/src/index.js season resume --json --dema-home <isolated>
npm run check
```
