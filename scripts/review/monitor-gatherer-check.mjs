#!/usr/bin/env node
// MONITOR-GATHERER-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  runMonitorGatherer,
  MONITOR_GATHERER_SCHEMA,
  MONITOR_GATHERER_TRUTH_LABEL,
  MONITOR_GATHERER_GO_PHRASE,
} from "../../packages/core/src/monitor-gatherer.js";

const JSON_MODE = process.argv.includes("--json");

// Canonical deterministic fixture — clean raw artifacts with both rows fully
// wired. No fs, no network: the gate proves the derivation CONTRACT, not the
// live repo (binding live surfaces is the CLI gatherer's job).
const GATE_FIXTURE_INPUT = {
  git: { head_sha: "32743df", dirty_count: 0 },
  gate_logs: { test_age_hours: 0.5, check_age_hours: 0.4, stale_threshold_hours: 24 },
  ci_available_declared: true,
  registry: {
    required_ids: ["RECEIPT_MONITOR_PREVIEW_1A", "MONITOR_GATHERER_1A"],
    rows: [
      {
        capability_id: "RECEIPT_MONITOR_PREVIEW_1A",
        test_paths: ["tests/receipt-monitor-preview.test.js"],
        review_gate_paths: ["scripts/review/receipt-monitor-preview-check.mjs"],
      },
      {
        capability_id: "MONITOR_GATHERER_1A",
        test_paths: ["tests/monitor-gatherer.test.js"],
        review_gate_paths: ["scripts/review/monitor-gatherer-check.mjs"],
      },
    ],
  },
  artifacts: {
    check_source:
      "node scripts/review/receipt-monitor-preview-check.mjs node scripts/review/monitor-gatherer-check.mjs",
    current_limits_text: "| RECEIPT-MONITOR-PREVIEW-1A | MONITOR-GATHERER-1A |",
    testing_text: "receipt-monitor-preview.test.js monitor-gatherer.test.js",
    test_paths_present: {
      "tests/receipt-monitor-preview.test.js": true,
      "tests/monitor-gatherer.test.js": true,
    },
  },
  receipts_raw: [{ id: "stand-2026-07-06-396a4939", evidence_refs: 2 }],
};

export function runMonitorGathererCheck() {
  return runMonitorGatherer({ consent: MONITOR_GATHERER_GO_PHRASE, input: GATE_FIXTURE_INPUT });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runMonitorGathererCheck();

  if (JSON_MODE) {
    // Strip heavy/non-summary fields here if the envelope carries them.
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - MONITOR-GATHERER-1A");
    console.log(`  schema: ${MONITOR_GATHERER_SCHEMA}`);
    console.log(`  truth: ${MONITOR_GATHERER_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
