#!/usr/bin/env node
// RECEIPT-MONITOR-PREVIEW-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  runReceiptMonitorPreview,
  RECEIPT_MONITOR_PREVIEW_SCHEMA,
  RECEIPT_MONITOR_PREVIEW_TRUTH_LABEL,
  RECEIPT_MONITOR_PREVIEW_GO_PHRASE,
} from "../../packages/core/src/receipt-monitor-preview.js";

const JSON_MODE = process.argv.includes("--json");

// Two canonical deterministic fixtures. The gate passes only when BOTH
// contract behaviors hold: a clean spine reports all_clear, and a drifted
// spine is detected and fails closed (proceed_allowed=false). No fs, no
// network — the gate proves the monitor CONTRACT, not live repo state.
const CLEAN_FIXTURE = {
  repo_state: { head_sha: "c4913ca", tree_clean: true, stale_proof: false, ci_available: true },
  registry_counts: { declared: 28, required_ids: 28 },
  capability_rows: [
    {
      capability_id: "RECEIPT_MONITOR_PREVIEW_1A",
      measured: true,
      has_tests: true,
      review_gate_in_check: true,
      in_current_limits: true,
      in_testing: true,
    },
  ],
  receipts: [{ id: "stand-2026-07-06-396a4939", verified_claim: true, evidence_refs: 3 }],
  claim_markers: [],
};

const DRIFTED_FIXTURE = {
  repo_state: { head_sha: "deadbee", tree_clean: false, stale_proof: true, ci_available: false },
  registry_counts: { declared: 28, required_ids: 27 },
  capability_rows: [
    {
      capability_id: "PHANTOM_CAPABILITY_1A",
      measured: true,
      has_tests: false,
      review_gate_in_check: false,
      in_current_limits: false,
      in_testing: false,
    },
  ],
  receipts: [{ id: "receipt-noevidence", verified_claim: true, evidence_refs: 0 }],
  claim_markers: [{ surface: "docs/README.md", marker: "urp_live_claim" }],
};

export function runReceiptMonitorPreviewCheck() {
  const blocked_by = [];
  const clean = runReceiptMonitorPreview({ consent: RECEIPT_MONITOR_PREVIEW_GO_PHRASE, input: CLEAN_FIXTURE });
  if (!clean.ok) blocked_by.push(...clean.blocked_by.map((c) => `clean:${c}`));
  else if (!clean.summary.all_clear || clean.proceed_allowed !== true) blocked_by.push("clean_fixture_not_all_clear");

  const drifted = runReceiptMonitorPreview({ consent: RECEIPT_MONITOR_PREVIEW_GO_PHRASE, input: DRIFTED_FIXTURE });
  if (!drifted.ok) blocked_by.push(...drifted.blocked_by.map((c) => `drifted:${c}`));
  else {
    if (drifted.summary.critical_count === 0) blocked_by.push("drifted_criticals_not_detected");
    if (drifted.proceed_allowed !== false) blocked_by.push("drifted_did_not_fail_closed");
  }

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: RECEIPT_MONITOR_PREVIEW_SCHEMA,
    truth_label: RECEIPT_MONITOR_PREVIEW_TRUTH_LABEL,
    scenarios: {
      clean: clean.ok ? { all_clear: clean.summary.all_clear, content_hash: clean.content_hash } : null,
      drifted: drifted.ok
        ? { critical_count: drifted.summary.critical_count, proceed_allowed: drifted.proceed_allowed, content_hash: drifted.content_hash }
        : null,
    },
    blocked_by: Object.freeze(blocked_by),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runReceiptMonitorPreviewCheck();

  if (JSON_MODE) {
    // Strip heavy/non-summary fields here if the envelope carries them.
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - RECEIPT-MONITOR-PREVIEW-1A");
    console.log(`  schema: ${RECEIPT_MONITOR_PREVIEW_SCHEMA}`);
    console.log(`  truth: ${RECEIPT_MONITOR_PREVIEW_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
