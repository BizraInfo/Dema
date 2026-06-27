# NODE0-RELEASE-VERDICT-KERNEL-1A

**Slice:** Extract pure release verdict kernel from proof-of-truth control plane.  
**Truth label:** `NODE0_RELEASE_VERDICT_LOCAL_ONLY`  
**Max auto-verdict:** `READY_LOCAL` (rejects `READY_REMOTE`, `PUBLIC_SAFE`)

## What shipped

| Module | Role |
| --- | --- |
| `packages/core/src/node0-proof-rails.js` | Pure four-rail summarizers (formal, crypto, empirical, economic, CI/CD, perf) |
| `packages/core/src/node0-release-verdict.js` | `computeReleaseVerdict`, `computeNextAction`, `verifyReleaseVerdict` |
| `packages/core/src/node0-proof-of-truth-control-plane.js` | Ledger build/verify; re-exports verdict + rails for compatibility |
| `scripts/review/node0-release-verdict-check.mjs` | Hermetic review gate |
| `tests/node0-release-verdict.test.js` | RV-01 … RV-08 |

## Convergence hardening (PC-13)

- Upgraded `KILLER_DEMO_PROOF_CONVERGENCE_CLAIMS` evidence tokens to honest floor ≥ 4
- Added `ci-evidence-attestation-bridge` claim
- `PROOF_ATTACHED_READY_LOCAL` when attestation + ledger `READY_LOCAL` + all claims CONVERGED

## Commands

```bash
npm run proof:verdict
npm run proof:verdict:check
node scripts/review/node0-release-verdict-check.mjs
```

## Boundaries (unchanged)

- No runtime execution in repo
- No live federation, token mint, or Node0 activation
- Hermetic `npm run proof:truth:check` unchanged

## What did not happen

- No `READY_REMOTE` / `PUBLIC_SAFE` promotion
- No weakening of CI or attestation verify rules
