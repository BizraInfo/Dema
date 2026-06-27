# NODE0 CI Evidence Attestation Export 1B

**Truth label:** `NODE0_CI_EVIDENCE_ATTESTATION_LOCAL_ONLY`  
**Schema:** `bizra.dema.node0_ci_evidence_attestation.v0.1`  
**Slice:** NODE0-CI-EVIDENCE-ATTESTATION-EXPORT-1B

## Purpose

Export a verified CI evidence attestation JSON artifact from GitHub Actions after the Node 22 check matrix passes. Operators download the artifact and supply it locally via `DEMA_CI_EVIDENCE_ATTESTATION_PATH`.

## Commands

```bash
npm run proof:attest:ci
npm run proof:attest:ci -- --out ./my-attestation.json --commit <sha>
```

## CI wiring (check workflow, Node 22 only)

1. `npm run proof:attest:ci` with `NODE0_CI_EVIDENCE_EXPORT_CONTEXT=post_check` (ci_matrix → PASS; codeql/gitleaks → UNKNOWN unless env overrides)
2. Gather smoke: `DEMA_CI_EVIDENCE_ATTESTATION_PATH=./node0-ci-evidence-attestation.json` + proof audit
3. Upload artifact `node0-ci-evidence-attestation-22.x.json`

## Rail env overrides (optional)

| Variable | Values |
|----------|--------|
| `NODE0_CI_EVIDENCE_RAIL_CI_MATRIX` | PASS \| FAIL \| UNKNOWN |
| `NODE0_CI_EVIDENCE_RAIL_CODEQL` | PASS \| FAIL \| UNKNOWN |
| `NODE0_CI_EVIDENCE_RAIL_GITLEAKS` | PASS \| FAIL \| UNKNOWN |

## What this proves

- CI can emit structurally valid, hash-verified attestation JSON tied to `GITHUB_SHA`
- Exported attestation loads through the existing audit gatherer without kernel changes

## What this does not prove

- That CodeQL/gitleaks passed unless explicitly set on export (defaults honest UNKNOWN)
- Remote seal, public-safe publication, or full `PROOF_ATTACHED_READY_LOCAL` compose (requires all rails PASS + convergence claims)

## Tests

```bash
node --test tests/node0-ci-evidence-attestation-export.test.js
```
