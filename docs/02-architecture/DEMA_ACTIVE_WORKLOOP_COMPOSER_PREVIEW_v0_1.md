# DEMA-ACTIVE-WORKLOOP-COMPOSER-PREVIEW-1A

Truth label: `DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_MEASURED_REPO`

## Purpose

The **missing bridge organ**. Dema already has organs — pain-goal, mission,
homebase, NodeSpace boundary, file steward, receipt previews, monitor, absence
queue, return review. This composer connects them, by reference, into one
fail-closed operator **work-envelope** that answers: what Dema can safely do
now, what needs consent, what needs approval, what is blocked, and the single
next safe action.

It **references, never runs** the organs, and it **executes no task**. This is
the load-bearing step toward lived impact — it is not the impact itself. A
work-envelope is not a completed task; real impact begins when a consented
reversible action runs and is receipted (a later slice).

## Input Contract

```js
runDemaActiveWorkloopComposerPreview({ consent, input })
```

Exact consent: `GO: dema active workloop composer preview`

```text
input.operator_goal        (string)
input.operator_present     (boolean) · input.unfinished (boolean) · input.returning (boolean)
input.pain_goal_ref        { ref_id, ref_hash? }
input.mission_ref          { ref_id }
input.boundary_ref         { ref_id, snapshot_hash? }   ← NodeSpace boundary; missing → block
input.homebase_state_ref   { ref_id }
input.receipt_preview_ref  { ref_id }                    ← missing → block
input.monitor_status       { critical_count:int, warning_count:int }  ← critical>0 → block
input.proposed_task        { task_id, autonomy_level ∈ L0..L5,
                             irreversible:boolean, file_action:boolean }
```

## Fail-closed behavior (re-derived from state)

- missing NodeSpace boundary / consent / receipt preview → **block**
- monitor critical present → **block** (`stop_blocked`)
- proposed task `irreversible` → **block** (`stop_blocked`)
- task autonomy **L3+** → **require approval** (`await_approval`, `proceed_allowed:true`)
- operator absent + unfinished → **absence-queue candidate** (`queue_for_absence`)
- operator returning → **return-review candidate** (`return_review`)
- otherwise → **`run_safe_task`**

`allowed_next_action` ∈ `{ run_safe_task, await_approval, queue_for_absence, return_review, stop_blocked }`.

## Output Contract

```text
ok · proceed_allowed
schema · truth_label · mode="preview_only"
workloop_id · operator_goal · operator_present
pain_goal_ref · mission_ref · boundary_ref · homebase_state_ref · proposed_task_ref
receipt_preview_ref · monitor_status_ref · required_consent
requires_approval · allowed_next_action
absence_queue_candidate_ref · return_review_ref
content_hash · workloop_hash (== content_hash) · authority_delta=0
boundary (all false) · what_this_proves[] · what_this_does_not_prove[] · blocked_by[]
```

## Verification

```js
verifyDemaActiveWorkloopComposerPreview(payload)
```

Body-bound re-derivation. Tampering any field breaks the bind.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/dema-active-workloop-composer-preview.js
tests/dema-active-workloop-composer-preview.test.js
scripts/review/dema-active-workloop-composer-preview-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_1A.md
docs/02-architecture/DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_v0_1.md
```

## Commands

```bash
node --test tests/dema-active-workloop-composer-preview.test.js
node scripts/review/dema-active-workloop-composer-preview-check.mjs --json
npm test
npm run check
```
