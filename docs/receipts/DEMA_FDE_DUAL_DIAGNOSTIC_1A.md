# Receipt: DEMA-FDE-DUAL-DIAGNOSTIC-1A

Truth label: `DEMA_FDE_DUAL_DIAGNOSTIC_PREVIEW_ONLY`

## Slice

This slice adds deterministic inward/outward failure diagnosis for proof-control surfaces:

```text
FDE-I = code/proof/test/gate failure classification
FDE-O = environment/permission/dependency failure classification
```

The kernel binds failed command excerpts and environment summaries to explicit hypotheses without patching or executing fixes.

Current reports use `bizra.dema.fde_dual_diagnostic.v0.2`. Historical v0.1
reports are integrity-verifiable only and are never authority-eligible.

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
docs/receipts/DEMA_FDE_SEMANTIC_REDERIVATION_1B.md
docs/receipts/DEMA_FDE_BOUNDARY_PRECEDENCE_1C.md
docs/TESTING.md
docs/CURRENT_LIMITS.md
```

## Proof Contract

The default FDE gate must pass only while:

- the canonical fixture classifies a proof failure with `eligible_for_autopatch: false`,
- inward and outward diagnoses include hypothesis, evidence, and confidence,
- `consent_required` remains true,
- all FDE boundaries remain false,
- boundary violations dominate simultaneous environment-repair evidence,
- GitHub billing lock remains an outward-only diagnosis,
- all-false boundary JSON does not count as positive violation evidence,
- the diagnostic hash recomputes exactly.

`npm run check` also runs `dema-capability-truth-registry-check.mjs`, which must keep `DEMA_FDE_DUAL_DIAGNOSTIC_1A` at `MEASURED_REPO` alongside the other spine rows.

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
