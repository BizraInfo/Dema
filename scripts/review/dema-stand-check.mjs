#!/usr/bin/env node
// DEMA-STAND-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  runDemaStand,
  DEMA_STAND_SCHEMA,
  DEMA_STAND_TRUTH_LABEL,
  DEMA_STAND_GO_PHRASE,
} from "../../packages/core/src/dema-stand.js";

const JSON_MODE = process.argv.includes("--json");

// Canonical deterministic fixture — a realistic clean-tree standing snapshot
// with the three standing declared blockers. Shared with tests/dema-stand.test.js.
export const DEMA_STAND_CANONICAL_FIXTURE = Object.freeze({
  observed_at_iso: "2026-07-03T08:00:00Z",
  git: {
    head: "b805166",
    branch: "feat/node0-spine-runner-cli-1a",
    dirty_files: 0,
    ahead: 19,
  },
  gates: {
    test: { status: "pass", tests_total: 6192, age_hours: 1, log_path: "/data/bizra/logs/npm-test.log" },
    check: { status: "pass", age_hours: 1, log_path: "/data/bizra/logs/npm-check.log" },
  },
  blockers: [
    { id: "github-billing", lens: "OUTWARD", label: "GitHub billing blocks the remote CI lane" },
    { id: "push-stack", lens: "AUTHORITY", label: "Push the local commit stack" },
    { id: "mint-blocked", lens: "ECONOMIC", label: "Token mint stays blocked until verified impact" },
  ],
  drain: "less",
  recent_commits: [
    { sha: "b805166", kind: "fix" },
    { sha: "a41d4c5", kind: "docs" },
    { sha: "8a8eeb4", kind: "fix" },
  ],
});

export function runDemaStandCheck() {
  return runDemaStand({
    consent: DEMA_STAND_GO_PHRASE,
    input: DEMA_STAND_CANONICAL_FIXTURE,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runDemaStandCheck();

  if (JSON_MODE) {
    // Strip heavy/non-summary fields here if the envelope carries them.
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - DEMA-STAND-1A");
    console.log(`  schema: ${DEMA_STAND_SCHEMA}`);
    console.log(`  truth: ${DEMA_STAND_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
