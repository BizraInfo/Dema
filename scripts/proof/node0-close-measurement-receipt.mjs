#!/usr/bin/env node
/**
 * NODE0-CLOSE-MEASUREMENT-RECEIPT-1A — emit an honest measurement receipt.
 *
 * Gathers whatever closure adapters can observe (same set as the review gate),
 * overlays soak/remote_write admission, and prints JSON. On a typical host with
 * no soak artefact and incomplete remote_write evidence this prints
 * measurement_admits_closed:false with ok:true (usable OPEN measurement).
 *
 * Boundary: no mint, no daemon start, no network beyond what adapters already
 * refuse; soak is never invented.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateNode0ClosureInvariants } from "../../packages/core/src/node0-closure-invariants.js";
import { buildNode0CloseMeasurementReceipt } from "../../packages/core/src/node0-close-measurement-receipt.js";
import { projectSoakJudgmentToAdmission } from "../../packages/core/src/node0-soak-judgment-admission.js";
import { gatherClosureEvidence } from "../review/node0-closure-invariants-check.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function gitHead() {
  const r = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: REPO,
    encoding: "utf8",
  });
  return (r.stdout || "").trim() || null;
}

function parseArgs(argv) {
  const out = { soakJudgmentPath: null };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--soak-judgment" || a === "--soak-judgment-file") {
      out.soakJudgmentPath = argv[i + 1] || null;
      i += 1;
      continue;
    }
    if (a === "--help" || a === "-h") {
      out.help = true;
    }
  }
  return out;
}

export function runNode0CloseMeasurementReceiptProof({
  soak = null,
  soak_judgment = null,
  now = new Date(),
} = {}) {
  let soakProjection = null;
  let resolvedSoak = soak;
  if (soak_judgment !== null && soak_judgment !== undefined) {
    soakProjection = projectSoakJudgmentToAdmission(soak_judgment);
    resolvedSoak = soakProjection.ok ? soakProjection.soak : null;
  }
  const evidence = gatherClosureEvidence();
  const closure_ledger = evaluateNode0ClosureInvariants(evidence);
  const receipt = buildNode0CloseMeasurementReceipt({
    closure_ledger,
    soak: resolvedSoak,
    head_sha: gitHead(),
    measured_at: now.toISOString(),
  });
  if (soakProjection) {
    return Object.freeze({
      ...receipt,
      soak_judgment_projection: soakProjection,
    });
  }
  return receipt;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    process.stdout.write(
      "Usage: node scripts/proof/node0-close-measurement-receipt.mjs [--soak-judgment <endurance-judgment.json>]\n",
    );
    process.exitCode = 0;
    return;
  }
  let soak_judgment = null;
  if (args.soakJudgmentPath) {
    soak_judgment = JSON.parse(readFileSync(args.soakJudgmentPath, "utf8"));
  }
  const receipt = runNode0CloseMeasurementReceiptProof({ soak_judgment });
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  // Exit 0 when the measurement is usable (ok). CLOSED is not required.
  process.exitCode = receipt.ok ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
