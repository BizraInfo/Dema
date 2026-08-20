import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runSelfEvalBaseline, runSelfEvalCompare } from "../apps/cli/src/commands/self-eval.js";
import {
  buildDemaSelfEvalBaselinePreviewPayload,
  verifyDemaSelfEvalBaselinePreview,
  DEMA_SELF_EVAL_BASELINE_PREVIEW_GO_PHRASE,
  SELF_EVAL_BASELINE_FIXTURE,
  SELF_EVAL_CANDIDATE_FIXTURE,
} from "../packages/core/src/dema-self-eval-baseline-preview.js";

const GO = DEMA_SELF_EVAL_BASELINE_PREVIEW_GO_PHRASE;
const MEASURED_INPUT = Object.freeze({
  label: "cli-test",
  captured_at: "2026-08-14T00:00:00.000Z",
  tests_pass: 16,
  tests_total: 16,
  coverage_line_pct: 19.21,
  coverage_branch_pct: 87.97,
  coverage_function_pct: 75.71,
  monitor_critical: 0,
  monitor_warning: 2,
  perf_boot_ms: 88,
  perf_verify_ms: 0.01,
  registry_count: 40,
  gates_all_green: true,
});
const happyGather = async () => ({
  ok: true,
  blocked_by: [],
  input: MEASURED_INPUT,
  provenance: { coverage: { cmd: "npm run coverage", exit_code: 0, duration_ms: 1, spawn_error: null } },
});

test("baseline with exact consent gathers, seals, and writes a re-verifiable payload under DEMA_HOME", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-self-eval-"));
  const out = await runSelfEvalBaseline({ label: "cli-test", consent: GO, demaHome: home, gatherImpl: happyGather });
  assert.equal(out.ok, true);
  assert.match(out.baseline_hash, /^sha256:[0-9a-f]{64}$/);
  assert.ok(out.receipt_path.startsWith(join(home, "self-eval")));
  const onDisk = JSON.parse(await readFile(out.receipt_path, "utf8"));
  const verified = verifyDemaSelfEvalBaselinePreview(onDisk);
  assert.equal(verified.ok, true);
  assert.equal(onDisk.content_hash, out.baseline_hash);
  const st = await stat(out.receipt_path);
  assert.equal(st.mode & 0o777, 0o600);
});

test("without the exact phrase nothing runs and nothing is written", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-self-eval-"));
  let gatherCalls = 0;
  const spy = async () => {
    gatherCalls += 1;
    return happyGather();
  };
  const out = await runSelfEvalBaseline({ label: "x", consent: "GO please", demaHome: home, gatherImpl: spy });
  assert.equal(out.ok, false);
  assert.ok(out.blocked_by.includes("consent_phrase_mismatch"));
  assert.equal(gatherCalls, 0);
  assert.equal(existsSync(join(home, "self-eval")), false);
});

test("a blocked gather seals nothing", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-self-eval-"));
  const out = await runSelfEvalBaseline({
    label: "x",
    consent: GO,
    demaHome: home,
    gatherImpl: async () => ({ ok: false, blocked_by: ["signal_unmeasurable:tests"], input: null, provenance: {} }),
  });
  assert.equal(out.ok, false);
  assert.ok(out.blocked_by.includes("signal_unmeasurable:tests"));
  const entries = existsSync(join(home, "self-eval")) ? await readdir(join(home, "self-eval")) : [];
  assert.deepEqual(entries.filter((e) => e.endsWith(".json")), []);
});

test("compare re-derives improved / regressed / unchanged from two on-disk baselines", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-self-eval-"));
  const before = buildDemaSelfEvalBaselinePreviewPayload(SELF_EVAL_BASELINE_FIXTURE);
  const after = buildDemaSelfEvalBaselinePreviewPayload(SELF_EVAL_CANDIDATE_FIXTURE);
  const beforePath = join(home, "before.json");
  const afterPath = join(home, "after.json");
  await writeFile(beforePath, JSON.stringify(before, null, 2));
  await writeFile(afterPath, JSON.stringify(after, null, 2));

  const improved = await runSelfEvalCompare({ baselinePath: beforePath, candidatePath: afterPath });
  assert.equal(improved.ok, true);
  assert.equal(improved.overall, "improved");

  const regressed = await runSelfEvalCompare({ baselinePath: afterPath, candidatePath: beforePath });
  assert.equal(regressed.overall, "regressed");

  const unchanged = await runSelfEvalCompare({ baselinePath: beforePath, candidatePath: beforePath });
  assert.equal(unchanged.overall, "unchanged");
});

test("cmd routing: dispatcher ctx reaches the compare branch (no silent help fallback)", async () => {
  const { cmd_self_eval } = await import("../apps/cli/src/commands/self-eval.js");
  const prevExit = process.exitCode;
  const logs = [];
  const origLog = console.log;
  console.log = (...a) => logs.push(a.join(" "));
  try {
    await cmd_self_eval({ argv: ["self-eval", "compare", "--baseline", "relative.json", "--candidate", "also-relative.json"], command: "self-eval", subcommand: "compare" });
  } finally {
    console.log = origLog;
  }
  const exited = process.exitCode;
  process.exitCode = prevExit;
  assert.equal(exited, 1);
  assert.match(logs.join("\n"), /REFUSED: path_not_absolute/);
});
