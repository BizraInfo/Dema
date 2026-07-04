#!/usr/bin/env node
// POI-TIME-COMPRESSION-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  runPoiTimeCompression,
  POI_TIME_COMPRESSION_SCHEMA,
  POI_TIME_COMPRESSION_TRUTH_LABEL,
  POI_TIME_COMPRESSION_GO_PHRASE,
} from "../../packages/core/src/poi-time-compression.js";

const JSON_MODE = process.argv.includes("--json");

export function runPoiTimeCompressionCheck() {
  // Canonical fixture: 6-week model estimate (240 declared working hours) vs a
  // 5-hour gated proof loop = 48x CANDIDATE. Life proof stays a separate clock.
  return runPoiTimeCompression({
    consent: POI_TIME_COMPRESSION_GO_PHRASE,
    input: {
      task_id: "poi-time-compression-gate-fixture",
      task_name: "Scoped feature slice under agentic proof loop",
      baseline: {
        duration_hours: 240,
        source: "model_estimate",
        reference_class: "human_only_team",
      },
      actual: {
        duration_hours: 5,
        operating_mode: "ai_agent_proof_loop",
      },
      quality_gates: {
        required: ["npm_test", "npm_run_check", "llm_guidance"],
        passed: ["npm_test", "npm_run_check", "llm_guidance"],
      },
      observation_required: true,
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runPoiTimeCompressionCheck();

  if (JSON_MODE) {
    // Strip heavy/non-summary fields here if the envelope carries them.
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - POI-TIME-COMPRESSION-1A");
    console.log(`  schema: ${POI_TIME_COMPRESSION_SCHEMA}`);
    console.log(`  truth: ${POI_TIME_COMPRESSION_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
