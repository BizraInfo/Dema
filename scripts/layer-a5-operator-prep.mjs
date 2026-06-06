#!/usr/bin/env node
// Layer A5 operator prep — real-home ARTIFACT-011 ceremony readiness (Dema-side only).

import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildLayerA5OperatorPrepReport } from "../packages/core/src/layer-a5-operator-prep.js";
import { runArtifact011CeremonyPreflight } from "../packages/mission/src/artifact-011-ceremony-preflight.js";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const CLI_PATH = join(repoRoot, "apps/cli/src/index.js");
const JSON_MODE = process.argv.includes("--json");

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

export async function runLayerA5OperatorPrepScript(options = {}) {
  const home =
    options.home ??
    argValue("--home") ??
    process.env.DEMA_HOME ??
    join(homedir(), ".dema");

  const preflight = await runArtifact011CeremonyPreflight({
    demaHome: home,
    cliPath: options.cliPath ?? CLI_PATH,
    execFileFn: options.execFileFn,
    gitCommit: options.gitCommit ?? null,
  });

  return buildLayerA5OperatorPrepReport(preflight);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  runLayerA5OperatorPrepScript()
    .then((report) => {
      if (JSON_MODE) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(
          "DEMA · Layer A5 operator prep (real home, Dema-side only)",
        );
        console.log(`  step:     ${report.road_map_step}`);
        console.log(`  home:     ${report.dema_home}`);
        console.log(`  truth:    ${report.truth_label}`);
        console.log(
          `  operator: ${report.operator_runtime_ready ? "RUNTIME-READY" : "NOT RUNTIME-READY"}`,
        );
        console.log("  checklist:");
        for (const item of report.checklist) {
          console.log(`    - [${item.ok ? "x" : " "}] ${item.label}`);
        }
        if (report.preflight_summary.blockers.length) {
          console.log("  blockers:");
          for (const b of report.preflight_summary.blockers) {
            console.log(`    - ${b.code}: ${b.message}`);
          }
        }
        console.log(`  next:     ${report.recommended_next}`);
      }
      process.exit(report.cleared_for_preview_ceremony ? 0 : 1);
    })
    .catch((err) => {
      console.error("layer-a5-operator-prep failed:", err);
      process.exit(2);
    });
}
