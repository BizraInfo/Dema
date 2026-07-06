# SAT5-CONSTITUTIONAL-VERIFIER-SET-PREVIEW-1A

Truth label: `SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_MEASURED_REPO`

## Purpose

Preview-only SAT-5 constitutional verifier set: five deterministic verifier passes (receipt/hash integrity, consent/FATE, impact/no-riba, security/blast-radius, governance/doctrine) that JUDGE a Node0 outcome — fail-closed admissibility, SAT judges Node0 and does not serve it, inert output with no authority, no mint, no live SAT agent.

## Input Contract

```js
runSat5ConstitutionalVerifierSetPreview({ consent, input })
```

Exact consent:

```text
GO: run sat5 constitutional verifier set
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
verifySat5ConstitutionalVerifierSetPreview(payload)
```

Body-bound re-derivation. Tampering any field breaks the bind.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/sat5-constitutional-verifier-set-preview.js
tests/sat5-constitutional-verifier-set-preview.test.js
scripts/review/sat5-constitutional-verifier-set-preview-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_1A.md
docs/02-architecture/SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_v0_1.md
```

## Commands

```bash
node --test tests/sat5-constitutional-verifier-set-preview.test.js
node scripts/review/sat5-constitutional-verifier-set-preview-check.mjs --json
npm test
npm run check
```
