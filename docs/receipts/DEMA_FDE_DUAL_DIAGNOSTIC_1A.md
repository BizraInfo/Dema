# Receipt: DEMA-FDE-DUAL-DIAGNOSTIC-1A

Truth label: `DEMA_FDE_DUAL_DIAGNOSTIC_PREVIEW_ONLY`

## Slice

This slice adds deterministic inward/outward failure diagnosis for proof-control surfaces:

```text
FDE-I = code/proof/test/gate failure classification
FDE-O = environment/permission/dependency failure classification
```

The kernel binds failed command excerpts and environment summaries to explicit hypotheses without patching or executing fixes.

## Files

```text
packages/core/src/dema-fde-dual-diagnostic.js
tests/dema-fde-dual-diagnostic.test.js
scripts/review/dema-fde-dual-diagnostic-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
tests/dema-capability-truth-registry.test.js
docs/02-architecture/DEMA_FDE_DUAL_DIAGNOSTIC_v0_1.md
docs/receipts/DEMA_FDE_DUAL_DIAGNOSTIC_1A.md
docs/TESTING.md
docs/CURRENT_LIMITS.md
```

## Proof Contract

The default gate must pass only while:

- the canonical fixture classifies a proof failure with `eligible_for_autopatch: false`,
- inward and outward diagnoses include hypothesis, evidence, and confidence,
- `consent_required` remains true,
- all FDE boundaries remain false,
- the diagnostic hash recomputes exactly,
- the capability truth registry includes `DEMA_FDE_DUAL_DIAGNOSTIC_1A` as `MEASURED_REPO`.

## Commands

```bash
node --test tests/dema-fde-dual-diagnostic.test.js
node scripts/review/dema-fde-dual-diagnostic-check.mjs --json
node --test tests/dema-capability-truth-registry.test.js
node --test tests/kernel-purity-check.test.js
npm test
npm run check
npm run llm:guidance
git diff --check
```

## Boundaries

- No patch
- No commit
- No push
- No merge
- No daemon
- No network
- No token mint
- No wallet
- No live execution
- No autopatch

## Promotion Rule

May not claim autopatch, live remediation, autonomous repair, or field execution without separate consent and proof gates.
