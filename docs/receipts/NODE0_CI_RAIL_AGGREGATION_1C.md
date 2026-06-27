# NODE0 CI Rail Aggregation 1C

**Truth label:** `NODE0_CI_EVIDENCE_ATTESTATION_LOCAL_ONLY`  
**Schema:** `bizra.dema.node0_ci_evidence_attestation.v0.1`  
**Slice:** NODE0-CI-RAIL-AGGREGATION-1C

## Purpose

After the `check` workflow completes, aggregate GitHub Actions conclusions for `check.yml`, `codeql.yml`, and `gitleaks.yml` at the same `head_sha` into a verified attestation with honest rail mapping:

| Workflow conclusion | Rail status |
|--------------------|-------------|
| `success` | `PASS` |
| `failure`, `cancelled`, `timed_out`, … | `FAIL` |
| missing / in progress | `UNKNOWN` |

## Commands

```bash
npm run proof:attest:ci:aggregate
NODE0_CI_WORKFLOW_CONCLUSION_CHECK=success \
NODE0_CI_WORKFLOW_CONCLUSION_CODEQL=success \
NODE0_CI_WORKFLOW_CONCLUSION_GITLEAKS=success \
  npm run proof:attest:ci:aggregate -- --commit <sha>
```

## CI wiring

Workflow: `.github/workflows/node0-ci-rail-aggregation.yml`  
Trigger: `workflow_run` on `check` completed (+ manual `workflow_dispatch`)  
Artifact: `node0-ci-evidence-attestation-aggregated.json`

## Operator apply (micro-consent)

```text
GO: apply aggregated CI evidence attestation locally
```

Download artifact → set `DEMA_CI_EVIDENCE_ATTESTATION_PATH` → run `npm run proof:truth`.

## Review gate

```bash
node scripts/review/node0-ci-rail-aggregation-check.mjs
node --test tests/node0-ci-rail-aggregation.test.js
```

Wired in `npm run check`.

## What this proves

- Peer workflow conclusions map to attestation rails without raw env spoofing
- Full PASS artifact when check + CodeQL + gitleaks all succeeded for the commit

## What this does not prove

- Remote seal, public-safe publication, or live Node0 activation
- `PROOF_ATTACHED_READY_LOCAL` compose when convergence claims CONVERGED and attestation merged
