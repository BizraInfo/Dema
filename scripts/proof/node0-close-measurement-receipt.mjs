#!/usr/bin/env node
/**
 * NODE0-CLOSE-MEASUREMENT-RECEIPT-1A — emit an honest measurement receipt.
 *
 * Gathers whatever closure adapters can observe (same set as the review gate),
 * overlays soak/remote_write admission, and prints JSON. On a typical host with
 * no soak artefact and incomplete remote_write evidence this prints
 * NODE0_CLOSED:false with ok:true (usable OPEN measurement).
 *
 * Boundary: no mint, no daemon start, no network beyond what adapters already
 * refuse; soak is never invented.
 */

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateNode0ClosureInvariants } from "../../packages/core/src/node0-closure-invariants.js";
import { buildNode0CloseMeasurementReceipt } from "../../packages/core/src/node0-close-measurement-receipt.js";
import { gatherClosureEvidence } from "../review/node0-closure-invariants-check.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function gitHead() {
  const r = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: REPO,
    encoding: "utf8",
  });
  return (r.stdout || "").trim() || null;
}

export function runNode0CloseMeasurementReceiptProof({
  soak = null,
  now = new Date(),
} = {}) {
  const evidence = gatherClosureEvidence();
  const closure_ledger = evaluateNode0ClosureInvariants(evidence);
  return buildNode0CloseMeasurementReceipt({
    closure_ledger,
    soak,
    head_sha: gitHead(),
    measured_at: now.toISOString(),
  });
}

function main() {
  const receipt = runNode0CloseMeasurementReceiptProof();
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  // Exit 0 when the measurement is usable (ok). CLOSED is not required.
  process.exitCode = receipt.ok ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
