# DEMA-SELF-EVAL-BASELINE-PREVIEW-1A

Truth label: `DEMA_SELF_EVAL_BASELINE_PREVIEW_MEASURED_REPO`

## Purpose

Self-eval quality baseline + compare: captures measured system-quality signals (tests, coverage, registry, monitor, gates, perf) as a content-addressed baseline and compares a candidate against it per dimension to say improved / regressed / mixed / unchanged, so system change is measured not blind; signals are injected, no tests are run here.

## Input Contract

```js
runDemaSelfEvalBaselinePreview({ consent, input })
```

Exact consent:

```text
GO: dema self eval baseline preview
```

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
verifyDemaSelfEvalBaselinePreview(payload)
```

Body-bound re-derivation. Tampering any field breaks the bind.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/dema-self-eval-baseline-preview.js
tests/dema-self-eval-baseline-preview.test.js
scripts/review/dema-self-eval-baseline-preview-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/DEMA_SELF_EVAL_BASELINE_PREVIEW_1A.md
docs/02-architecture/DEMA_SELF_EVAL_BASELINE_PREVIEW_v0_1.md
```

## Commands

```bash
node --test tests/dema-self-eval-baseline-preview.test.js
node scripts/review/dema-self-eval-baseline-preview-check.mjs --json
npm test
npm run check
```
