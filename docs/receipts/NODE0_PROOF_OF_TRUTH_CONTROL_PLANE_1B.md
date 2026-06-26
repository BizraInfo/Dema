# NODE0 Proof-of-Truth Control Plane 1B

**Truth label:** `NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_LOCAL_ONLY`  
**Schema:** `bizra.dema.node0_proof_of_truth_control_plane.v0.1`  
**Slice:** NODE0-PROOF-OF-TRUTH-CONTROL-PLANE-1B (hardens 1A)

## What 1B adds

- Verifier enforces `boundary.local_only` and `boundary.no_network_required`
- `READY_LOCAL` blocked when formal rail fails (`schema` / `invariants` / `fail_closed`)
- Rejects git-unavailable `UNKNOWN` commit sentinel
- `computeReleaseVerdict` uses caller-provided `boundaries` for economic rail
- Audit gatherer no longer optimistically marks CodeQL/gitleaks/CI matrix PASS under `CI=true`; advisory rails default to `UNKNOWN` unless `DEMA_PROOF_*` env evidence is set
- Audit gatherer throws if git commit is unavailable (no `UNKNOWN` fallback)

## What this proves

- Same as 1A: one canonical, deterministic local proof ledger joining formal, cryptographic, empirical, and economic rails
- `release_verdict` capped at **`READY_LOCAL`** or **`BLOCKED`**
- Review gate fails closed on overclaim verdicts and live economic claims

## What this does not prove

- Remote release readiness (`READY_REMOTE`)
- Public-safe external publication (`PUBLIC_SAFE`)
- Live token mint, wallet action, URP submission, PoI reward settlement, or federation
- Node1/Node2 activation or autonomous runtime
- Production SLOs (perf section is regression-gate only)

## Commands

```bash
npm run proof:truth          # JSON ledger (gathered snapshot; requires git)
npm run proof:truth:check    # Hermetic fail-closed gate (also in npm run check)
node --test tests/node0-proof-of-truth-control-plane.test.js
```

## Advisory CI evidence (optional)

Set when running gathered audit with real CI signals:

- `DEMA_PROOF_CODEQL_STATUS=PASS|FAIL|UNKNOWN`
- `DEMA_PROOF_GITLEAKS_STATUS=PASS|FAIL|UNKNOWN`
- `DEMA_PROOF_CI_MATRIX_STATUS=PASS|FAIL|UNKNOWN`
- `DEMA_PROOF_BIZRA_REVIEW_STATUS=PASS|FAIL|UNKNOWN`

## Boundaries

| Boundary | Value |
| -------- | ----- |
| `local_only` | true |
| `no_network_required` | true |
| `no_token_mint` | true |
| `no_wallet_action` | true |
| `no_node1_activation` | true |
| `no_urp_publication` | true |
| `no_autonomous_runtime` | true |

## Receipt

Public-safe summary only. Run `npm run proof:truth -- --hermetic` for a reproducible hermetic fixture ledger suitable for gate closeout.
