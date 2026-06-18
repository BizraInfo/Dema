#!/usr/bin/env node
// PROOF-SPINE-GUARD-1A — read-only review check.
//
// Combines:
//   1) pure substrate-parity spine health validator (packages/receipts)
//   2) LCC/G-ladder reference guard for local proof-layer closure (packages/core)
//
// No signing, no key generation, no delivery-check rewrite, no claim-map writes.

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateProofSpineGuard } from "../../packages/receipts/src/proof-spine-guard.js";
import { auditProofSpineLayers } from "../../packages/core/src/proof-spine-lcc-guard.js";
import { loadExampleGLadderLayerIndexInput } from "../g-ladder-layer-index-mock.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const JSON_MODE = process.argv.includes("--json");

export function runProofSpineGuardReview({ root = REPO_ROOT } = {}) {
  const deliveryCheckSource = readFileSync(
    join(root, "scripts/delivery-check.mjs"),
    "utf8",
  );
  const layerReport = auditProofSpineLayers({
    root,
    layers: loadExampleGLadderLayerIndexInput().layers,
    deliveryCheckSource,
    exists: (path) => existsSync(path),
  });

  const selfTest = validateProofSpineGuard({
    genesis_receipt: { self_test: true },
    signature: "dGVzdA==",
    decision: "APPROVED",
    fresh_state_ed25519: "pk",
  });

  const ok =
    layerReport.ok &&
    selfTest.allowed_to_advance === true &&
    selfTest.reason_codes.length === 0;

  return Object.freeze({
    ok,
    layer_report: layerReport,
    self_test: selfTest,
  });
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = runProofSpineGuardReview();
  if (JSON_MODE) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("DEMA · proof-spine guard (read-only)");
    console.log(`  layer_count: ${report.layer_report.layer_count}`);
    console.log(`  layer_refs: ${report.layer_report.ok ? "PASS" : "FAIL"}`);
    if (!report.layer_report.ok) {
      for (const finding of report.layer_report.findings) {
        console.log(
          `    - ${finding.layer_id} ${finding.field}: ${finding.code}`,
        );
      }
    }
    console.log(
      `  self_test: ${report.self_test.allowed_to_advance ? "PASS" : "FAIL"}`,
    );
  }
  process.exit(report.ok ? 0 : 1);
}
