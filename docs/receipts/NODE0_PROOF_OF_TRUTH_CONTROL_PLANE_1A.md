# NODE0 Proof-of-Truth Control Plane 1A

**Truth label:** `NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_LOCAL_ONLY`  
**Schema:** `bizra.dema.node0_proof_of_truth_control_plane.v0.1`  
**Slice:** NODE0-PROOF-OF-TRUTH-CONTROL-PLANE-1A

## What this proves

- Dema can emit one canonical, deterministic local proof ledger joining:
  - **Formal** — schemas, invariants, fail-closed verifier posture, truth-labeled claims
  - **Cryptographic** — `receipt_hash` over canonical JSON (`sha256(stableStringify(body))`)
  - **Empirical** — tests, coverage, perf, delivery check, CI matrix signals (when gathered)
  - **Economic** — explicit non-claim boundary (`BLOCKED_UNLESS_MEASURED`)
- `release_verdict` in 1A is capped at **`READY_LOCAL`** or **`BLOCKED`**
- Review gate fails closed on overclaim verdicts (`READY_REMOTE`, `PUBLIC_SAFE`) and live economic claims

## What this does not prove

- Remote release readiness (`READY_REMOTE`)
- Public-safe external publication (`PUBLIC_SAFE`)
- Live token mint, wallet action, URP submission, PoI reward settlement, or federation
- Node1/Node2 activation or autonomous runtime
- Production SLOs (perf section is regression-gate only)

## Commands

```bash
npm run proof:truth          # JSON ledger (gathered snapshot)
npm run proof:truth:check    # Hermetic fail-closed gate (also in npm run check)
node --test tests/node0-proof-of-truth-control-plane.test.js
```

## Boundaries (1A)

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
