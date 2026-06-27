# Phase 5 · TDD Anchors

**Pseudocode-bundle file:** `phase_05_tdd_anchors.md`
**Goal:** red-green anchors for NODE0-CI-EVIDENCE-ATTESTATION-BRIDGE-1A

## Attestation kernel tests

Target file:

```text
tests/node0-ci-evidence-attestation.test.js
```

| Anchor | Test ID | Assertion |
| --- | --- | --- |
| TDD-CEA-01 | CEA-01 | Canonical schema + truth label + receipt_hash format |
| TDD-CEA-02 | CEA-02 | Valid attestation verifies |
| TDD-CEA-03 | CEA-03 | Missing commit blocked |
| TDD-CEA-04 | CEA-04 | UNKNOWN commit sentinel blocked |
| TDD-CEA-05 | CEA-05 | receipt_hash mismatch blocked |
| TDD-CEA-06 | CEA-06 | READY_REMOTE overclaim blocked |
| TDD-CEA-07 | CEA-07 | Boundary violation blocked |
| TDD-CEA-08 | CEA-08 | require_pass_rails rejects UNKNOWN rail |
| TDD-CEA-09 | CEA-09 | Merge promotes ledger to READY_LOCAL |
| TDD-CEA-10 | CEA-10 | Commit mismatch refuses merge |
| TDD-CEA-11 | CEA-11 | Attachment ready_local_eligible with attestation |
| TDD-CEA-12 | CEA-12 | formatNode0CiEvidenceAttestation human output |
| TDD-CEA-13 | CEA-13 | Review gate script passes |
| TDD-CEA-14 | CEA-14 | runNode0CiEvidenceAttestation kernel envelope |

## Snapshot attachment regression tests

Target file:

```text
tests/node0-proof-snapshot-attachment.test.js
```

| Anchor | Test ID | Assertion |
| --- | --- | --- |
| TDD-PSA-02 | PSA-02 | Default gathered fixture UNKNOWN + BLOCKED |
| TDD-PSA-04 | PSA-04 | ready_local when ledger READY_LOCAL |
| TDD-PSA-08 | PSA-08 | Gathered attachment review gate passes |

## Convergence compose tests

Target file:

```text
tests/node0-killer-demo-value-loop-proof-convergence.test.js
```

| Anchor | Test ID | Assertion |
| --- | --- | --- |
| TDD-PC-06 | PC-06 | Default gathered → PROOF_ATTACHED_ADVISORY_BLOCKED |
| TDD-PC-11 | PC-11 | Manual READY_LOCAL ledger → ready_local + PARTIAL compose |
| TDD-PC-12 | PC-12 | Attested audit → ready_local + READY_LOCAL verdict |
| TDD-PC-13 | PC-13 | full CONVERGED claims + attestation → PROOF_ATTACHED_READY_LOCAL |
| TDD-PC-10 | PC-10 | CLI smoke without attestation env |

## Hermetic proof truth (must not regress)

| Anchor | Command | Assertion |
| --- | --- | --- |
| TDD-PT-01 | `npm run proof:truth:check` | Hermetic fixture READY_LOCAL PASS |

## Review gate tests

Target file:

```text
scripts/review/node0-ci-evidence-attestation-check.mjs
```

Hermetic fixture commit + PASS rails attestation must:

1. Reject overclaim attestation.
2. Verify valid attestation.
3. Merge into gathered input.
4. Produce READY_LOCAL ledger.
5. Produce ready_local_eligible attachment.

## Verification ladder

```bash
node --test tests/node0-ci-evidence-attestation.test.js
node --test tests/node0-proof-snapshot-attachment.test.js
node --test tests/node0-killer-demo-value-loop-proof-convergence.test.js
node scripts/review/node0-ci-evidence-attestation-check.mjs
node scripts/review/node0-proof-snapshot-attachment-check.mjs
npm test
npm run check
npm run proof:truth:check
npm run llm:guidance
git diff --check
```

## Adversarial cases (manual or future automation)

```bash
# Should remain ADVISORY_BLOCKED (no attestation)
dema demo node0-value-loop convergence --json

# Should promote READY_LOCAL (with attestation for current HEAD)
COMMIT=$(git rev-parse HEAD)
# build attestation JSON for COMMIT with rails PASS
DEMA_CI_EVIDENCE_ATTESTATION_PATH=/path/to/attestation.json \
  dema demo node0-value-loop convergence --json
```

## Env hygiene

New variables MUST appear in `scripts/review/env-hygiene-check.mjs`:

```text
DEMA_CI_EVIDENCE_ATTESTATION_JSON
DEMA_CI_EVIDENCE_ATTESTATION_PATH
```

T-13 env-hygiene test enforces completeness.
