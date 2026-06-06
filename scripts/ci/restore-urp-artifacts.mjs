#!/usr/bin/env node
// [PROTOTYPE CI ISOLATION] 448711b
// 1-line inline restore for B-bucket URP drift (pre-existing environmental side-effect
// of the ARTIFACT-011 / node0-local-urp harness preview writer).
// Valid short-term emergency micro.
// 
// Replaced by this explicit script for:
//   - better logging
//   - clear intent
//   - less hidden mutation of working tree
//   - stronger auditability
//
// See user directive (2026-06-06 Dubai, /S /A /Q /C /O):
//   "classify `448711b` as [PROTOTYPE CI ISOLATION].
//    Valid short-term. Needs explicit restore script or artifact fixture boundary later.
//    Do not undo it now. First capture remote proof."
//   "Next architecture improvement after green:
//    scripts/ci/restore-urp-artifacts.mjs
//    Then package.json becomes:
//    "test": "node scripts/ci/restore-urp-artifacts.mjs && node --test tests/*.test.js""
//
// This script must ONLY be used to isolate the *known* pre-existing B-bucket drift.
// It must NOT be used to hide legitimate changes to the committed artifact goldens.
// Future: replace with true artifact fixtures under the test harness so restore is unnecessary.
//
// Truth labels respected: REMOTE_VISIBLE != REMOTE_CI_VERIFIED until a green run on a commit
// containing this isolation (or the fixture boundary) is captured.

import { execSync } from "node:child_process";

const DRIFT_NOTE = "pre-existing B-bucket URP drift (Omnidirectional Audit 2026-06-06, commit 448711b [PROTOTYPE CI ISOLATION])";

console.log(`[CI ISOLATION] Restoring URP artifacts before test to isolate ${DRIFT_NOTE}.`);
console.log("[CI ISOLATION] This is temporary; replace with artifact fixture boundary for production.");
console.log("[CI ISOLATION] Do not use to hide legitimate artifact changes.");

try {
  execSync("git restore artifacts/proofs/node0-local-urp/ 2>/dev/null || true", {
    stdio: "inherit",
  });
  console.log("[CI ISOLATION] Restore complete. Running tests on clean harness state.");
} catch (err) {
  console.error("[CI ISOLATION] Restore step encountered non-fatal issue:", err?.message || err);
  if (process.argv.includes("--strict")) {
    process.exit(1);
  }
}

// Guard: when run directly, exit cleanly (the script is intended to be prefix for the test command).
if (import.meta.url === `file://${process.argv[1]}`) {
  // no-op; presence of this file + successful restore is the signal
}
