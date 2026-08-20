#!/usr/bin/env node
// SELF-EVAL-COLLECT-1A — review gate. Proves the effect adapter's three load-
// bearing invariants without running any heavy command: (1) an unspawnable
// signal source REFUSES the gather — a broken command can never read as a
// clean measurement; (2) real-format fixture outputs produce a kernel-eligible
// input end to end; (3) the CLI checks the exact consent phrase BEFORE any
// effect runs — authority writes ahead.

import { pathToFileURL } from "node:url";

import { gatherSelfEvalSignals } from "../../apps/cli/src/commands/self-eval-gatherer.js";
import { runSelfEvalBaseline } from "../../apps/cli/src/commands/self-eval.js";
import {
  runDemaSelfEvalBaselinePreview,
  DEMA_SELF_EVAL_BASELINE_PREVIEW_GO_PHRASE,
} from "../../packages/core/src/dema-self-eval-baseline-preview.js";

const JSON_MODE = process.argv.includes("--json");

const TAP_GREEN = [
  "# tests 16",
  "# pass 16",
  "# fail 0",
  "# all files                                    |  19.21 |    87.97 |   75.71 |",
].join("\n");
const MONITORS_JSON = JSON.stringify({ monitor: { summary: { critical_count: 0, warning_count: 0 } } });
const HAPPY = {
  coverage: { code: 0, stdout: TAP_GREEN, stderr: "", duration_ms: 1, spawn_error: null },
  monitors: { code: 0, stdout: MONITORS_JSON, stderr: "", duration_ms: 1, spawn_error: null },
  gates: { code: 0, stdout: "", stderr: "", duration_ms: 1, spawn_error: null },
  boot: { code: 0, stdout: "", stderr: "", duration_ms: 1, spawn_error: null },
};
const fakeRun = (map) => async (spec) =>
  map[spec.name] ?? { code: 0, stdout: "", stderr: "", duration_ms: 1, spawn_error: null };

export async function runDemaSelfEvalCollectCheck() {
  const blocked_by = [];

  // (1) fail-closed: unspawnable source refuses, fabricates nothing.
  const broken = await gatherSelfEvalSignals({
    label: "gate",
    runImpl: fakeRun({ ...HAPPY, coverage: { code: null, stdout: "", stderr: "", duration_ms: 0, spawn_error: "ENOENT" } }),
    nowIso: "2026-08-14T00:00:00.000Z",
    testFileCountImpl: () => 3,
  });
  if (broken.ok !== false) blocked_by.push("broken_source_did_not_refuse");
  if (broken.input !== null) blocked_by.push("broken_source_leaked_partial_input");

  // (2) real-format fixtures → kernel-eligible input, end to end.
  const gathered = await gatherSelfEvalSignals({ label: "gate", runImpl: fakeRun(HAPPY), nowIso: "2026-08-14T00:00:00.000Z", testFileCountImpl: () => 3 });
  if (!gathered.ok) for (const c of gathered.blocked_by) blocked_by.push(`gather:${c}`);
  else {
    const run = runDemaSelfEvalBaselinePreview({ consent: DEMA_SELF_EVAL_BASELINE_PREVIEW_GO_PHRASE, input: gathered.input });
    if (!run.ok) for (const c of run.blocked_by) blocked_by.push(`kernel:${c}`);
  }

  // (3) consent before effects: wrong phrase must never invoke the gatherer.
  let gatherCalls = 0;
  const refused = await runSelfEvalBaseline({
    label: "gate",
    consent: "GO: something else",
    demaHome: "/nonexistent-self-eval-gate-home",
    gatherImpl: async () => {
      gatherCalls += 1;
      return gathered;
    },
  });
  if (refused.ok !== false || !refused.blocked_by.includes("consent_phrase_mismatch")) {
    blocked_by.push("wrong_consent_not_refused");
  }
  if (gatherCalls !== 0) blocked_by.push("effects_ran_before_consent");

  return Object.freeze({ ok: blocked_by.length === 0, blocked_by: Object.freeze(blocked_by) });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runDemaSelfEvalCollectCheck();
  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA - SELF-EVAL-COLLECT-1A");
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) for (const c of result.blocked_by) console.log(`    ${c}`);
  }
  if (!result.ok) process.exit(1);
}
