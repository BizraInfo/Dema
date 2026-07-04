# Receipt: ABSENCE-STEWARD-QUEUE-PROPOSAL-SPINE-1A

Truth label: `ABSENCE_STEWARD_QUEUE_PROPOSAL_SPINE_MEASURED_NOT_LIVE`

## Slice

Absence Steward local queue **proposal spine** (spec
`docs/02-architecture/ABSENCE_STEWARD_LOCAL_QUEUE_v0_1.md` · queue ladder rungs
schema → verify → receipt → draft CLI): a fail-closed item-shape validator, a
body-bound launder-detecting verifier, a consent-gated atomic receipt writer,
and the validate-only `dema away queue draft` CLI.

```text
item → validate (fail-closed) → verify (whole-body) → receipt (exact consent)
```

A recorded proposal is a remembered request. Recording never moves it:
approval stays a separate human decision, and execution is not in this track
at all. `dema away start` does not exist.

## Proof Contract

The review gate must pass only while:

- item states stay capped at PROPOSED / HUMAN_APPROVED / HUMAN_REJECTED /
  WITHDRAWN / EXPIRED_WITH_CONTRACT — EXECUTING / DONE / RUNNING / STARTED /
  COMPLETED / AUTO_APPROVED all reject,
- consent-ish fields reject (queue membership is never consent) and
  AUTO_DEQUEUE / SELF_APPROVAL / EXECUTION_FROM_QUEUE reject even when proposed,
- the verifier re-derives the WHOLE validation from the raw item and refuses
  forged `valid:true`, drifted items, edited normalized bodies, and forged hashes,
- the receipt writer accepts only the byte-exact derived phrase
  `GO: write absence-steward queue receipt <id> <hash12>`, writes atomically
  with no overwrite, and stays `approved:false` + `executed:false` with an
  all-false runtime boundary on every path,
- the CLI stays validate-only: no queue stored, no receipt reached, no
  DEMA_HOME touched, nothing starts.

`npm run check` runs `absence-steward-queue-check.mjs` and keeps
`ABSENCE_STEWARD_QUEUE_PROPOSAL_SPINE_1A` at `MEASURED_REPO` (repo-measured
kernels; the queue itself stays `DESIGNED_NOT_LIVE`).

## Commands

```bash
node --test tests/absence-steward-queue-schema.test.js tests/absence-steward-queue-verify.test.js tests/absence-steward-queue-receipt.test.js tests/away-queue-cli-draft.test.js
node scripts/review/absence-steward-queue-check.mjs
npm run check
```

## Non-claims

No live queue · no queue runner · no scheduler · no daemon · no auto-dequeue ·
no self-approval · no execution from queue · no steward runtime · no unattended
execution · no model invocation · no network · no mint · no wallet · no
`dema away start` (does not exist). The spine proves a proposal can be
remembered honestly — it does not prove, and must never imply, that anything
runs while the founder is away.
