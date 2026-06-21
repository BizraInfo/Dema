// SIMPLIFY-RECEIPTS-HASH-1A · single source for the receipt content hash.
//
// The receipt savers (codebase-map / pipeline-result / route-receipt /
// invocation-result / verification-result) each carried a byte-identical
// `sha256Hex`. This is the one definition they now import — same algorithm, so
// every receipt hash is identical to before (no golden/snapshot drift).
import { createHash } from "node:crypto";

export function sha256Hex(content) {
  return createHash("sha256").update(content).digest("hex");
}
