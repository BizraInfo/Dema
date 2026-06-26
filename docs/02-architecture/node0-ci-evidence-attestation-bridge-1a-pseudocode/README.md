# Node0 CI Evidence Attestation Bridge 1A · SPEC-PSEUDOCODE bundle

**Status:** [MEASURED] Implemented on branch `feat/ci-evidence-attestation-bridge-1a` (parent `main @ 7dcb97a`).
**Slice ID:** `NODE0-CI-EVIDENCE-ATTESTATION-BRIDGE-1A`
**Authored:** 2026-06-27 GST.

This bundle decomposes the attestation bridge contract into modular pseudocode
with TDD anchors. It replaces raw `DEMA_PROOF_*` environment variables as
advisory CI truth with a hashable, fail-closed attestation object.

## Phase index

| File | Scope | Audience |
| --- | --- | --- |
| [phase_01_requirements.md](phase_01_requirements.md) | Requirements, edge cases, constraints | reviewer, implementer |
| [phase_02_attestation_kernel_pseudocode.md](phase_02_attestation_kernel_pseudocode.md) | Pure build / verify / merge kernel | implementer |
| [phase_03_audit_gatherer_pseudocode.md](phase_03_audit_gatherer_pseudocode.md) | I/O boundary: load attestation, gather audit | implementer |
| [phase_04_compose_integration_pseudocode.md](phase_04_compose_integration_pseudocode.md) | Snapshot attachment + convergence compose | implementer |
| [phase_05_tdd_anchors.md](phase_05_tdd_anchors.md) | Test anchors and verification ladder | implementer, reviewer |

## Scope discipline

| In scope | Out of scope |
| --- | --- |
| Structured attestation schema `bizra.dema.node0_ci_evidence_attestation.v0.1` | Remote CI seal or GitHub API polling |
| Verifier fail-closed on commit, hash, boundary, rails | Raw `DEMA_PROOF_*` env-as-truth in core |
| Merge into gathered proof ledger when commit matches | `READY_REMOTE`, `PUBLIC_SAFE`, token mint |
| `ready_local_eligible` via proof snapshot attachment | Autonomous runtime or Node0 activation |
| Operator supply via JSON env or file path | Network fetch of attestation |

## Cross-references

- Receipt: [../../receipts/NODE0_CI_EVIDENCE_ATTESTATION_BRIDGE_1A.md](../../receipts/NODE0_CI_EVIDENCE_ATTESTATION_BRIDGE_1A.md)
- Prior slice: [../../receipts/NODE0_PROOF_SNAPSHOT_ATTACHMENT_1A.md](../../receipts/NODE0_PROOF_SNAPSHOT_ATTACHMENT_1A.md)
- Control plane: [../../receipts/NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_1B.md](../../receipts/NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_1B.md)
- Kernel: [../../../packages/core/src/node0-ci-evidence-attestation.js](../../../packages/core/src/node0-ci-evidence-attestation.js)
- Canonical flow: [../../LLM_SYSTEM_FLOW.md](../../LLM_SYSTEM_FLOW.md)

## Truth labels

```text
NODE0_CI_EVIDENCE_ATTESTATION_LOCAL_ONLY
NODE0_PROOF_SNAPSHOT_ATTACHMENT_LOCAL_ONLY
NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_PREVIEW_ONLY
```

## Implementation GO (completed on branch)

```text
GO: NODE0-CI-EVIDENCE-ATTESTATION-BRIDGE-1A
```
