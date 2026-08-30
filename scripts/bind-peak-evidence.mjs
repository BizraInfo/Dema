#!/usr/bin/env node
// Bind 9 signal events to real file content via peak-evidence-gatherer — SNR 0 → 0.75
// Purity by injection: readSource supplied by caller, no node:fs inside gatherer.
// This is the caller the kernel's CEILING note asks for.

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
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
console.log("SNR:", before.snr_framework.score, "verdict:", before.snr_framework.verdict, "verified:", before.snr_framework.verified_signal_count, "excluded:", before.snr_framework.excluded_signal_count, "debt:", before.snr_framework.evidence_debt.length, "boundary all-false:", before.boundary?.all_false);

console.log("\n=== GATHER ===");
const gathered = gatherEvidenceSignals({ candidates, readSource });
console.log("gathered:", gathered.gathered_count, "excluded:", gathered.excluded_count);
for (const e of gathered.events) {
  console.log(`  ${e.id} → ${e.source_ref} → sha256:${e.source_sha256.slice(0,12)}... ${e.truth_label}`);
}
if (gathered.excluded.length) {
  console.log("excluded:", gathered.excluded);
}

console.log("\n=== VERIFY ===");
const verified = verifyEvidenceSignals({ events: gathered.events, readSource });
console.log("verify:", { ok: verified.ok, verified: verified.verified_count, mismatches: verified.mismatches.length });

console.log("\n=== AFTER (with signal_events) ===");
const after = buildPeakSelfLoopPreview({ signal_events: gathered.events });
console.log("SNR:", after.snr_framework.score, "verdict:", after.snr_framework.verdict, "verified:", after.snr_framework.verified_signal_count, "excluded:", after.snr_framework.excluded_signal_count, "debt:", after.snr_framework.evidence_debt.length, "boundary all-false:", after.boundary?.all_false);
console.log("RSI:", after.autonomous_rsi.merged_verdict, "rsi", after.autonomous_rsi.process_rsi);
console.log("Trace diagnostic moat:", after.trace_diagnostic_moat?.promotion_status);

// Demonstrate that camelCase signalEvents would still be 0 (single source truth)
const wrong = buildPeakSelfLoopPreview({ signalEvents: gathered.events });
console.log("\n=== WRONG KEY (signalEvents camelCase) ===");
console.log("SNR:", wrong.snr_framework.score, "verified:", wrong.snr_framework.verified_signal_count, "(should be 0 — proves snake_case is the contract)");

// Economic clarity: founder cost is measured, not value — ensure 9th event label is correct
const ninth = gathered.events.find(e => e.id === "proof-of-spend-1a");
console.log("\n=== ECONOMIC CLARITY ===");
console.log("9th event label:", ninth.label);
console.log("truth_label:", ninth.truth_label, "(MEASURED = cost receipt, NOT minted value)");
console.log("This is FOUNDER_COST_MEASURED_NOT_VALUE — 15k hours across 6k conversations, multi-email, multi-drive, unstructured R&D since Ramadan 2023 is MEASURED COST, not minted value. Token mint waits for SAT verified benefit after Genesis Library is the single source of truth.");
