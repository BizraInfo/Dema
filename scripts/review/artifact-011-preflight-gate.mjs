#!/usr/bin/env node
// ARTIFACT-011 ceremony preflight release gate (preview-only, isolated home).
//
//   node scripts/review/artifact-011-preflight-gate.mjs
//   node scripts/review/artifact-011-preflight-gate.mjs --json
//
// Invoked from npm run check. Does not require operator_runtime_ready.

import { pathToFileURL } from "node:url";

import { validateArtifact011PreflightReleaseGate } from "../../packages/mission/src/artifact-011-ceremony-preflight.js";
import { runArtifact011PreflightScript } from "../artifact-011-ceremony-preflight.mjs";

const JSON_MODE = process.argv.includes("--json");

export async function runArtifact011PreflightGate(options = {}) {
  const report = await runArtifact011PreflightScript({
    isolated: true,
    gitCommit: options.gitCommit ?? null,
    execFileFn: options.execFileFn,
  });
  const gate = validateArtifact011PreflightReleaseGate(report);
  return { report, gate };
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  runArtifact011PreflightGate()
    .then(({ report, gate }) => {
      const payload = {
        schema: gate.schema,
        ok: gate.ok,
        truth_label: report.truth_label,
        cleared_for_preview_ceremony: report.cleared_for_preview_ceremony,
        cleared_for_runtime_ceremony: report.cleared_for_runtime_ceremony,
        operator_runtime_ready: report.operator_runtime_ready,
        boundary: report.boundary,
        blockers: gate.blockers,
        ceremony_blockers: report.blockers,
      };
      if (JSON_MODE) {
        console.log(JSON.stringify(payload, null, 2));
      } else {
        console.log("DEMA · ARTIFACT-011 preflight release gate");
        console.log(`  ok:      ${gate.ok ? "PASS" : "FAIL"}`);
        console.log(`  truth:   ${report.truth_label}`);
        console.log(
          `  preview: ${report.cleared_for_preview_ceremony ? "CLEARED" : "GAP"}`,
        );
        if (gate.blockers.length) {
          console.log("  gate blockers:");
          for (const b of gate.blockers) {
            console.log(`    - ${b.code}: ${b.message}`);
          }
        }
        if (report.blockers.length) {
          console.log("  ceremony blockers:");
          for (const b of report.blockers) {
            console.log(`    - ${b.code}: ${b.message}`);
          }
        }
      }
      process.exit(gate.ok ? 0 : 1);
    })
    .catch((err) => {
      console.error("artifact-011-preflight-gate failed:", err);
      process.exit(2);
    });
}
