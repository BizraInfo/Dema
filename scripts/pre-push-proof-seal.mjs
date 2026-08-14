#!/usr/bin/env node
// Pre-push proof seal CLI — orchestrates publish pipeline gates before git push.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PRE_PUSH_PROOF_SEAL_SCHEMA,
  buildPrePushProofSealReport,
} from "../packages/core/src/pre-push-proof-seal.js";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const JSON_MODE = process.argv.includes("--json");
const FETCH = process.argv.includes("--fetch");
const SKIP_GATES = process.argv.includes("--skip-gates");

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

export async function runPrePushProofSealScript(options = {}) {
  const report = await buildPrePushProofSealReport({
    root: options.root ?? repoRoot,
    fetch: options.fetch ?? FETCH,
    skip_gates: options.skip_gates ?? SKIP_GATES,
    gates: options.gates,
    runGate: options.runGate,
    git: options.git,
  });

  const outPath = options.out ?? argValue("--out");
  if (outPath) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  return report;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  runPrePushProofSealScript()
    .then((report) => {
      if (JSON_MODE) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log("DEMA · pre-push proof seal (publish pipeline)");
        console.log(`  schema:  ${PRE_PUSH_PROOF_SEAL_SCHEMA}`);
        console.log(`  verdict: ${report.verdict}`);
        console.log(
          // Never collapse UNMEASURED into "clean" or "dirty" — the operator
          // must see that the tree was not observed at all.
          `  git:     ${(report.git.working_tree_status ?? "unmeasured").toLowerCase()} · ahead ${report.git.upstream_counts?.ahead ?? "?"} · behind ${report.git.upstream_counts?.behind ?? "?"}`,
        );
        if (report.gates.length) {
          console.log("  gates:");
          for (const gate of report.gates) {
            console.log(
              `    - ${gate.id}: ${gate.ok ? "PASS" : "FAIL"} (${gate.duration_ms}ms)`,
            );
          }
        }
        if (report.blockers.length) {
          console.log("  blockers:");
          for (const b of report.blockers) {
            console.log(`    - ${b.code}: ${b.message}`);
          }
        }
        console.log(`  next:    ${report.recommended_next}`);
      }
      process.exit(report.ok ? 0 : 1);
    })
    .catch((err) => {
      console.error("pre-push-proof-seal failed:", err);
      process.exit(2);
    });
}
