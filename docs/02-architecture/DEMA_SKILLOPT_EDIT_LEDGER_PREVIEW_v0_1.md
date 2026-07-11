# DEMA-SKILLOPT-EDIT-LEDGER-PREVIEW-1A

Truth label: `DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_ONLY`

## Purpose

PREVIEW_ONLY ledger recording SkillOpt-style skill-document edit-optimization
attempts; fail-closed on authority expansion. Motivation only: arXiv:2605.23904
(SkillOpt). Runs no optimizer, applies no edit, promotes no skill. Distinct from
`agent-skill-ledger.js` (AGENT-SKILL-1A = agent XP). Core law: **skills may improve;
authority may not self-expand.**

## Input Contract

```js
runDemaSkilloptEditLedgerPreview({ consent, input })
```

Exact consent:

```text
GO: dema skillopt edit ledger preview 1a
```

`input` = one skill-edit attempt entry:

```text
skill_id, skill_version          non-empty strings
base_skill_hash, candidate_skill_hash   sha256:<64hex>
edit_type                        add | delete | replace
edit_budget                      finite number >= 0
training_rollout_refs            string[]
heldout_validation_refs          string[]  (non-empty REQUIRED when accepted)
score_before, score_after        finite numbers (recorded, not ordered)
accepted                         boolean
rejected_edit_reason             non-empty string REQUIRED when accepted=false
authority_delta                  must be 0
boundary_unchanged               must be true
consent_unchanged                must be true
current_limits_unchanged         must be true
```

`receipt_hash` is DERIVED (== `content_hash`), never caller-supplied.

Fail-closed blocks: `authority_delta_nonzero`, `boundary_changed`,
`consent_changed`, `current_limits_changed`, `accepted_without_heldout_validation`,
`rejected_without_reason`, `content_hash_mismatch`, plus per-field `*_invalid`.

## Output Contract

```text
schema
truth_label
ok
content_hash
boundary.execution_allowed (false)
blocked_by[]
```

## Verification

```js
verifyDemaSkilloptEditLedgerPreview(payload)
```

Body-bound re-derivation. Tampering any field breaks the bind.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/dema-skillopt-edit-ledger-preview.js
tests/dema-skillopt-edit-ledger-preview.test.js
scripts/review/dema-skillopt-edit-ledger-preview-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_1A.md
docs/02-architecture/DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_v0_1.md
```

## Commands

```bash
node --test tests/dema-skillopt-edit-ledger-preview.test.js
node scripts/review/dema-skillopt-edit-ledger-preview-check.mjs --json
npm test
npm run check
```
