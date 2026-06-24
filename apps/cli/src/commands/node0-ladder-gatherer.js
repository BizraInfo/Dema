// NODE0-ACTIVATION-LADDER-1A — read-only ladder evidence gatherer (apps/cli).
//
// Reads disk presence (file exists + optional feature marker) for each ladder
// rung and feeds packages/core/src/node0-activation-ladder.js. No mutation,
// no network, no execution. fs deps are injected for deterministic tests.

import { existsSync as fsExistsSync, readFileSync as fsReadFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { NODE0_ACTIVATION_LADDER } from "../../../../packages/core/src/node0-activation-ladder.js";

const REPO_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
);

export function gatherNode0LadderEvidence({
  existsSyncImpl = fsExistsSync,
  readFileImpl = fsReadFileSync,
  repoRoot = REPO_ROOT,
} = {}) {
  const evidence = {};
  for (const rung of NODE0_ACTIVATION_LADDER) {
    if (rung.tier === "gated" || !rung.evidence_file) {
      evidence[rung.id] = { kernel_present: false, marker_present: false };
      continue;
    }
    const abs = join(repoRoot, rung.evidence_file);
    const kernel_present = existsSyncImpl(abs) === true;
    let marker_present;
    if (rung.marker == null) {
      marker_present = kernel_present;
    } else if (kernel_present) {
      try {
        marker_present = String(readFileImpl(abs, "utf8")).includes(rung.marker);
      } catch {
        marker_present = false;
      }
    } else {
      marker_present = false;
    }
    evidence[rung.id] = { kernel_present, marker_present };
  }
  return evidence;
}
