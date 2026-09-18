#!/usr/bin/env node
// PEAK-EVIDENCE-SEMANTIC-ADMISSION-1A negative control.
//
// These nine candidates point at implementation/source files. Source-byte
// existence and a matching SHA-256 prove provenance only; they do NOT prove a
// gate passed or a commit is clean. The semantic gatherer must therefore exclude
// this entire set and leave the peak self-loop in HOLD.
//
// A future positive demonstration must point at event-class-specific proof
// artefacts (for gate_passed today: JSON { gate:<id>, exit:0 }), not source code.

import { readFileSync } from "node:fs";
import { gatherEvidenceSignals, verifyEvidenceSignals } from "../packages/core/src/peak-evidence-gatherer.js";
import { buildPeakSelfLoopPreview } from "../packages/core/src/peak-self-loop-preview.js";

function readSource(ref) {
  try {
    return readFileSync(ref, "utf8");
  } catch {
    return null;
  }
}

const candidates = [
  { id: "ux-first-look-gate", source_ref: "packages/core/src/ux-quality-gate.js", type: "gate_passed", label: "UX first-look gate green" },
  { id: "delivery-readiness-gate", source_ref: "packages/core/src/baseline-verifier-gate.js", type: "gate_passed", label: "Delivery readiness gate green" },
  { id: "realm-ux-2", source_ref: "packages/dema-ui/src/components/dema/FirstRun.tsx", type: "clean_commit", label: "Realm UX-2 menu + wallet + timeline" },
  { id: "peak-self-loop-wired", source_ref: "packages/core/src/peak-self-loop-preview.js", type: "clean_commit", label: "Peak self-loop + Proof Studio dispatch shipped" },
  { id: "proof-spine-local-gates", source_ref: "packages/core/src/baseline-verifier-gate.js", type: "gate_passed", label: "npm test + npm run check + dema harness CLEAN on NODE0" },
  { id: "node0-spine-runner-sandbox", source_ref: "packages/core/src/node0-spine-runner.js", type: "clean_commit", label: "Measured proof spine runs inside sandbox only (#312)" },
  { id: "billing-lock-local-proof-lane", source_ref: "packages/core/src/node0-ci-vendor-availability.js", type: "gate_passed", label: "proof:truth:local-lane READY_LOCAL when vendor billing lock" },
  { id: "undo-proven-1a", source_ref: "packages/core/src/node0-undo-proven-preview.js", type: "clean_commit", label: "UNDO-PROVEN-1A measured inverse correction preview" },
  { id: "proof-of-spend-1a", source_ref: "packages/core/src/proof-of-spend-1a.js", type: "clean_commit", label: "PROOF-OF-SPEND-1A founder cost receipt (FOUNDER_COST_MEASURED_NOT_VALUE)" },
];

console.log("=== BEFORE (no evidence) ===");
const before = buildPeakSelfLoopPreview({});
console.log("SNR:", before.snr_framework.score, "verified:", before.snr_framework.verified_signal_count, "RSI:", before.autonomous_rsi.merged_verdict);

console.log("\n=== GATHER SOURCE-CODE CANDIDATES ===");
const gathered = gatherEvidenceSignals({ candidates, readSource });
console.log("gathered:", gathered.gathered_count, "excluded:", gathered.excluded_count);
for (const row of gathered.excluded) {
  console.log(`  ${row.id ?? "<unknown>"} → ${row.gap}`);
}

console.log("\n=== VERIFY ADMITTED SET ===");
const verified = verifyEvidenceSignals({ events: gathered.events, readSource });
console.log("verify:", { ok: verified.ok, verified: verified.verified_count, mismatches: verified.mismatches.length });

console.log("\n=== AFTER ===");
const after = buildPeakSelfLoopPreview({ signal_events: gathered.events });
console.log("SNR:", after.snr_framework.score, "verified:", after.snr_framework.verified_signal_count, "RSI:", after.autonomous_rsi.merged_verdict);

const held =
  gathered.gathered_count === 0 &&
  gathered.excluded_count === candidates.length &&
  after.snr_framework.verified_signal_count === 0 &&
  after.autonomous_rsi.merged_verdict === "HOLD_AND_REDUCE_NOISE";

if (!held) {
  console.error("FAIL: source-code provenance was promoted into positive semantic evidence");
  process.exitCode = 1;
} else {
  console.log("PASS: readable source code remains evidence debt; semantic proof is required before SNR can rise.");
}
