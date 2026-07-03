# Receipt: ABSENCE-STEWARD-RETURN-REVIEW-1A

Truth label: `ABSENCE_STEWARD_RETURN_REVIEW_MEASURED_NOT_LIVE`

## Slice

Absence Steward return review (spec
`docs/02-architecture/ABSENCE_STEWARD_RETURN_REVIEW_v0_1.md` · ADR-043): a pure
derivation kernel plus the `dema away review` report-only CLI over the Away
Contract trio and a **declared** absence window (`--left`/`--returned` — never
the clock; readiness re-derived at both window edges).

```text
trio + window → NO_ABSENCE_RECORDED / REVIEW_BLOCKED /
                READY_BUT_NOT_STARTED / EXPIRED_BEFORE_START
```

Every claim is receipt-backed or says `NO_RECEIPT — cannot claim.` The
executed summary is always *"Nothing executed. I can only report readiness and
receipts."* `WORK_COMPLETE` is not in the vocabulary. `dema away start` does
not exist.

## Proof Contract

The review gate must pass only while:

- the kernel exports the expected schema, truth label, first line, and the
  refusal statements verbatim,
- a missing trio derives `NO_ABSENCE_RECORDED` and an invalid/inverted window
  derives `REVIEW_BLOCKED` — both with the ten-key all-false spec boundary,
- a laundered contract derives `REVIEW_BLOCKED` with named refused events,
- a verified pair without a receipt derives `REVIEW_BLOCKED` naming the
  missing receipt,
- the kernel's verdict vocabulary contains no `COMPLETE`, `REQUIRED`, or
  `WORK_COMPLETE` derivation,
- the `away` CLI dispatches `review` and does **not** dispatch `start`,
- `docs/CURRENT_LIMITS.md` still says no live absence stewardship, no queue,
  no runtime.

`npm run check` runs `absence-steward-return-review-check.mjs` and keeps
`ABSENCE_STEWARD_RETURN_REVIEW_1A` at `MEASURED_REPO` (repo-measured kernels;
runtime stays `PREVIEW_ONLY`).

## Commands

```bash
node --test tests/absence-steward-return-review.test.js tests/away-contract-cli-review.test.js
node scripts/review/absence-steward-return-review-check.mjs --json
npm run check
```

## Non-claims

No live absence stewardship · no work-completion claim (`WORK_COMPLETE`
undefined) · no queue · no steward runtime · no daemon · no scheduler · no
unattended execution · no model invocation · no network · no mint · no wallet
· no `dema away start` (does not exist) · **no proof that any work occurred**.
The review's purpose is the opposite: to prove, receipt by receipt, what was
not done.
