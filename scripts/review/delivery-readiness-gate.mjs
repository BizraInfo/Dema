#!/usr/bin/env node
// DEMA-QUALITY-DELIVERY-SPINE-1A · delivery readiness gate.

import {
  buildFirstLookHome,
  gatherFirstLookContext,
} from "../../packages/core/src/dema-first-look-home.js";
import { evaluateUxFirstLookEnvelope } from "../../packages/core/src/ux-quality-gate.js";
import {
  assertProofBoundary,
  computeDeliveryReadiness,
  scoreEffectBoundary,
} from "../../packages/core/src/delivery-readiness-score.js";

const JSON_MODE = process.argv.includes("--json");

const ctx = await gatherFirstLookContext();
const envelope = buildFirstLookHome(ctx);
const ux = evaluateUxFirstLookEnvelope(envelope);
const proof = assertProofBoundary(envelope.proof_boundary);
const security = scoreEffectBoundary(envelope.effect_boundary);
const report = computeDeliveryReadiness({
  ux,
  proof,
  security,
  performance: { pass: true },
});
const pass = report.pass;

if (JSON_MODE) {
  console.log(
    JSON.stringify(
      {
        ok: pass,
        report,
        ux,
        proof,
        security,
      },
      null,
      2,
    ),
  );
} else {
  console.log("DEMA · delivery readiness gate");
  console.log(`  score: ${report.score.toFixed(2)}`);
  console.log(`  ux: ${ux.pass ? "PASS" : "FAIL"}`);
  console.log(`  proof: ${proof.pass ? "PASS" : "FAIL"}`);
  console.log(`  security: ${security.pass ? "PASS" : "FAIL"}`);
  console.log(`  result: ${pass ? "PASS" : "FAIL"}`);
}

process.exit(pass ? 0 : 1);
