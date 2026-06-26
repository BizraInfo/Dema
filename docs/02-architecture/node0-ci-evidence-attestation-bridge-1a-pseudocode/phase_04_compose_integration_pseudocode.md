# Phase 4 · Compose Integration Pseudocode

**Pseudocode-bundle file:** `phase_04_compose_integration_pseudocode.md`
**Target modules:**
- `packages/core/src/node0-proof-snapshot-attachment.js`
- `packages/core/src/node0-killer-demo-value-loop-proof-convergence.js`
- `apps/cli/src/commands/demo.js` (existing convergence dispatch)

## Data flow

```text
gatherProofSnapshotAudit({ hermetic: false })
  → runNode0ProofOfTruthControlPlaneAudit()
  → { ledger, ci_evidence_attestation, attestation_merged, ... }

buildNode0KillerDemoValueLoopProofConvergence({ proof_snapshot_audit })
  → buildNode0ProofSnapshotAttachment({ auditResult })
  → computeReadyLocalEligible(ledger)
  → compose_status from attachment + convergence summary
```

## Pseudocode: snapshot attachment extensions

```text
FUNCTION buildNode0ProofSnapshotAttachment({ auditResult }):

  ledger ← extractLedger(auditResult)
  ready ← computeReadyLocalEligible(ledger)

  RETURN {
    schema: PROOF_SNAPSHOT_ATTACHMENT_SCHEMA,
    snapshot_source: gathered | hermetic,
    ci_evidence_attestation: auditResult.ci_evidence_attestation ?? null,
    attestation_merged: auditResult.attestation_merged == true,
    advisory_rails: from ledger.ci_cd,
    ledger, ledger_summary,
    ready_local_eligible: ready.eligible,
    ready_local_blockers: ready.blockers,
    boundary: preview all-false
  }
```

Advisory note text MUST say attestation, not raw `DEMA_PROOF_*`.

## Pseudocode: compose_status decision tree

```text
FUNCTION resolveComposeStatus(killer_demo_verified, attachment, convergence):

  IF NOT killer_demo_verified.ok → RETURN BLOCKED
  IF attachment IS NULL → RETURN BLOCKED
  IF verifyNode0ProofSnapshotAttachment(attachment) fails → RETURN BLOCKED

  converged ← convergence.summary.converged
  total ← convergence.summary.total

  IF attachment.ready_local_eligible:
    IF converged < total → RETURN PROOF_ATTACHED_PARTIAL_CONVERGENCE
    ELSE → RETURN PROOF_ATTACHED_READY_LOCAL

  IF converged < total → RETURN PROOF_ATTACHED_ADVISORY_BLOCKED
  RETURN PROOF_ATTACHED_ADVISORY_BLOCKED
```

## Honest output matrix

| Attestation | Ledger verdict | Convergence | compose_status | ready_local_eligible |
| --- | --- | --- | --- | --- |
| absent | BLOCKED | any | PROOF_ATTACHED_ADVISORY_BLOCKED | false |
| valid PASS | READY_LOCAL | partial | PROOF_ATTACHED_PARTIAL_CONVERGENCE | true |
| valid PASS | READY_LOCAL | full | PROOF_ATTACHED_READY_LOCAL | true |
| invalid | (gather throws) | n/a | CLI error | n/a |

## Still explicitly blocked (all paths)

```text
READY_REMOTE: false
PUBLIC_SAFE: false
TOKEN_LIVE: false
NODE0_ACTIVATED: false
```

## CLI command

```text
dema demo node0-value-loop convergence --json

REQUIRES proof_snapshot_audit in builder params (wired in demo command)
OUTPUT includes:
  compose_status
  proof_snapshot_attachment.ready_local_eligible
  control_plane_reference.release_verdict
  control_plane_reference.gathered == true
```

## Review gates (compose stack)

```text
node0-killer-demo-value-loop-compose-gate.mjs
node0-killer-demo-value-loop-cli-check.mjs
node0-killer-demo-value-loop-proof-convergence-check.mjs
node0-proof-snapshot-attachment-check.mjs
node0-ci-evidence-attestation-check.mjs   ← new
node0-proof-of-truth-control-plane-check.mjs (hermetic)
```
