// Gathers a local proof:truth audit snapshot for CLI compose surfaces.
// I/O boundary: git commit read only. No network.

import { runNode0ProofOfTruthControlPlaneAudit } from "../../../scripts/audit/node0-proof-of-truth-control-plane.mjs";

export function gatherProofSnapshotAudit({ hermetic = false } = {}) {
  return runNode0ProofOfTruthControlPlaneAudit({ hermetic });
}
