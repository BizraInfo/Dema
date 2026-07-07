#!/usr/bin/env node
// PUBLIC-METRIC-CLAIM-GATE-PREVIEW-1A — review gate. Binds the operator's exact acceptance-test claim
// set (the bizra.ai containment failure + its honest corrections) against evidence and prints the
// label table: "12,680 tests" → REJECTED, "6,993 Dema-core" → VERIFIED, "~15,000 hours" → DECLARED,
// "Live URP" → REJECTED, "URP Preview" → PREVIEW, "SEED minted" → REJECTED, unmeasured → UNKNOWN.

import { pathToFileURL } from "node:url";

import {
  runPublicMetricClaimGatePreview,
  publicMetricClaimGatePreviewBoundary,
  exampleClaimSet,
  PUBLIC_METRIC_CLAIM_GATE_PREVIEW_SCHEMA,
  PUBLIC_METRIC_CLAIM_GATE_PREVIEW_TRUTH_LABEL,
  PUBLIC_METRIC_CLAIM_GATE_PREVIEW_GO_PHRASE,
} from "../../packages/core/src/public-metric-claim-gate-preview.js";

const JSON_MODE = process.argv.includes("--json");

// Expected label per acceptance criterion (the gate must reproduce these exactly).
const EXPECTED = Object.freeze({
  tests_12680: "REJECTED",
  tests_6993: "VERIFIED",
  hours_15000: "DECLARED",
  urp_live: "REJECTED",
  urp_preview: "PREVIEW",
  seed_minted: "REJECTED",
  tests_wrong: "REJECTED",
  rust_crates: "UNKNOWN",
});

export function runPublicMetricClaimGatePreviewCheck() {
  return runPublicMetricClaimGatePreview({
    consent: PUBLIC_METRIC_CLAIM_GATE_PREVIEW_GO_PHRASE,
    input: exampleClaimSet(),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runPublicMetricClaimGatePreviewCheck();
  const boundaryAllFalse = Object.values(publicMetricClaimGatePreviewBoundary()).every((v) => v === false);
  const mismatches = (result.bindings || [])
    .filter((b) => EXPECTED[b.id] && b.label !== EXPECTED[b.id])
    .map((b) => `${b.id}: expected ${EXPECTED[b.id]}, got ${b.label}`);
  const ok = result.ok && mismatches.length === 0;

  if (JSON_MODE) {
    console.log(
      JSON.stringify(
        {
          schema: result.schema,
          truth_label: result.truth_label,
          preview_only: true,
          status: result.status,
          gate_ran_ok: result.ok,
          acceptance_matches: mismatches.length === 0,
          mismatches,
          claim_count: result.claim_count,
          label_counts: result.label_counts,
          public_displayable_count: result.public_displayable_count,
          rejected_count: result.rejected_count,
          unknown_count: result.unknown_count,
          bindings: result.bindings,
          boundary_all_false: boundaryAllFalse,
          mint_allowed: result.mint_allowed,
          what_this_proves: result.what_this_proves,
          what_this_does_not_prove: result.what_this_does_not_prove,
          blocked_by: result.blocked_by,
        },
        null,
        2,
      ),
    );
  } else {
    console.log("DEMA - PUBLIC-METRIC-CLAIM-GATE-PREVIEW-1A (PREVIEW_ONLY · Materialization Pulse Step 5)");
    console.log(`  schema: ${PUBLIC_METRIC_CLAIM_GATE_PREVIEW_SCHEMA}`);
    console.log(`  truth: ${PUBLIC_METRIC_CLAIM_GATE_PREVIEW_TRUTH_LABEL}`);
    console.log(`  status: ${result.status} | claims: ${result.claim_count} | public_displayable: ${result.public_displayable_count}`);
    for (const b of result.bindings || []) {
      const disp = b.public_displayable ? "PUBLIC" : "hold";
      const ptr = b.evidence_pointer ? ` ← ${b.evidence_pointer}` : "";
      console.log(`    [${b.label.padEnd(8)}] ${b.id.padEnd(14)} ${disp}${ptr}`);
    }
    console.log(`  boundary_all_false: ${boundaryAllFalse} | mint_allowed: ${result.mint_allowed}`);
    console.log(`  result: ${ok ? "PASS" : "FAIL"}${ok ? " (all acceptance labels reproduced)" : ""}`);
    if (!ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
      for (const m of mismatches) console.log(`    ${m}`);
    }
  }

  if (!ok) process.exit(1);
}
