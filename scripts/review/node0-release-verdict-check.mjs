#!/usr/bin/env node
// NODE0-RELEASE-VERDICT-KERNEL-1A — hermetic fail-closed review gate.

import { pathToFileURL } from "node:url";
import {
  computeReleaseVerdict,
  verifyReleaseVerdict,
  NODE0_RELEASE_VERDICT_SCHEMA,
  NODE0_RELEASE_VERDICT_TRUTH_LABEL,
} from "../../packages/core/src/node0-release-verdict.js";
import { HERMETIC_CONTROL_PLANE_FIXTURE } from "../../packages/core/src/node0-proof-of-truth-control-plane.js";

const JSON_MODE = process.argv.includes("--json");

export function runNode0ReleaseVerdictCheck() {
  const verdict = computeReleaseVerdict({
    checks: HERMETIC_CONTROL_PLANE_FIXTURE.checks,
    workflows: HERMETIC_CONTROL_PLANE_FIXTURE.workflows,
    coverage: HERMETIC_CONTROL_PLANE_FIXTURE.coverage,
    perf: HERMETIC_CONTROL_PLANE_FIXTURE.perf,
    claims: HERMETIC_CONTROL_PLANE_FIXTURE.claims,
    boundaries: HERMETIC_CONTROL_PLANE_FIXTURE.boundaries,
    release_mode: HERMETIC_CONTROL_PLANE_FIXTURE.release_mode,
  });
  const verified = verifyReleaseVerdict(verdict);
  return Object.freeze({
    ok: verified.ok && verdict === "READY_LOCAL",
    schema: NODE0_RELEASE_VERDICT_SCHEMA,
    truth_label: NODE0_RELEASE_VERDICT_TRUTH_LABEL,
    verdict,
    verified,
  });
}

if (pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = runNode0ReleaseVerdictCheck();

  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA · Node0 release verdict kernel check (hermetic)");
    console.log(`  schema: ${NODE0_RELEASE_VERDICT_SCHEMA}`);
    console.log(`  truth: ${NODE0_RELEASE_VERDICT_TRUTH_LABEL}`);
    console.log(`  release_verdict: ${result.verdict}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.verified.blocked_by) {
        console.log(`    ${code}`);
      }
    }
  }

  if (!result.ok) process.exit(1);
}
