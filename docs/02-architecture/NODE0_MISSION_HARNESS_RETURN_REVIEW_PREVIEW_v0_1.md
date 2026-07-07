# NODE0-MISSION-HARNESS-RETURN-REVIEW-PREVIEW-1A

Truth label: `NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_MEASURED_REPO`

## Purpose

Closes the **read side** of the mission loop (above `NODE0-LOCAL-MISSION-HARNESS-PREVIEW-1A`, #345):

```text
local file → hash → mission packet → pulse → preview receipt → RETURN REVIEW
```

Given a `dema mission pulse` receipt, a pure kernel reviews its structure + preview invariants and
emits **what was proven, what was NOT, and exactly one next safe action.** Two layers:

- **Pure kernel** (`node0-mission-harness-return-review-preview.js`) — reads NO file; reviews an
  injected receipt.
- **CLI adapter** (`apps/cli/src/commands/mission.js`, `dema mission review <receipt>`) — reads the
  receipt JSON read-only.

**Honesty:** judges NO semantic correctness; cannot re-derive the pulse→composition→genesis chain
from the receipt SUMMARY (it declares this in `what_was_not_proven`). Reviewing a bad receipt is the
kernel's *job* — the review completes (`run.ok` true) while `receipt_ok` is false.

## Input Contract

```js
runNode0MissionHarnessReturnReviewPreview({ consent, input })
// input = { receipt: <receipt_artifact_preview a `dema mission pulse` run wrote> }
```

Exact consent: `GO: node0 mission harness return review preview`

## Output Contract

```text
schema · truth_label · ok · status (return_review_complete | return_review_broken)
content_hash · receipt_ok
what_was_proven[] · what_was_not_proven[] · one_next_safe_action
boundary (all-false) · mint_allowed:false · authority_delta:0 · blocked_by[]
```

## Verification

```js
verifyNode0MissionHarnessReturnReviewPreview(payload)
```

Body-bound re-derivation over the whole verdict, plus consistency: rejects a tampered hash, an
**ok-without-proof** forgery, and a **not-ok-but-claims-proof** forgery, and requires a non-empty
`what_was_not_proven` + a single next action.

## What this does NOT prove

No file read in the kernel, no semantic judgment, no pulse re-run, no model, no live action. The
recommended next action is a preview recommendation, not an execution.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/node0-mission-harness-return-review-preview.js
tests/node0-mission-harness-return-review-preview.test.js
scripts/review/node0-mission-harness-return-review-preview-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_1A.md
docs/02-architecture/NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_v0_1.md
```

## Commands

```bash
node --test tests/node0-mission-harness-return-review-preview.test.js
node scripts/review/node0-mission-harness-return-review-preview-check.mjs --json
npm test
npm run check
```
