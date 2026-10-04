import test from "node:test";
import assert from "node:assert/strict";
import {
  runReliefShift,
  buildWorkReceipt,
  RELIEF_RECEIPT_SCHEMA,
} from "../packages/core/src/dema-relief-runner.js";
import { resolveOperation } from "../packages/core/src/dema-relief-capabilities.js";

// injected op executor: deterministic, records (file, argv) calls
function mockOpRunner(script) {
  const calls = [];
  const fn = (file, argv) => { const key = [file, ...argv].join(" "); calls.push(key); return script[key] ?? { code: 0, stdout: "ok", stderr: "" }; };
  fn.calls = calls;
  return fn;
}

// ── RR-01 registered A0 ops run+receipt; unregistered dangerous ops are refused ─
test("RR-01: A0 ops execute+receipt; an unregistered git.push is refused, never run", () => {
  const run = mockOpRunner({ "git status --short": { code: 0, stdout: "clean", stderr: "" } });
  const r = runReliefShift({
    queue: [
      { id: "health", op: "git.status" },
      { id: "push", op: "git.push" },              // NOT registered -> refused
      { id: "migrate", op: "authorship.migration" }, // NOT registered -> refused
    ],
    runOp: run,
    now: "2026-08-13T05:00:00Z",
  });
  assert.equal(r.completed.length, 1);
  assert.equal(r.completed[0].op, "git.status");
  assert.equal(r.refused.length, 2);
  assert.deepEqual(run.calls, ["git status --short"], "only the registered A0 op executed");
});

// ── RR-02 the trust hole is closed: a caller command/label cannot execute ──────
test("RR-02: a caller-supplied command/effect_class is ignored — no injection path", () => {
  const run = mockOpRunner({});
  const r = runReliefShift({
    // caller tries to smuggle a mutating command under a read_only label + no op
    queue: [{ id: "evil", effect_class: "read_only", command: "rm -rf /" }],
    runOp: run,
  });
  assert.equal(r.completed.length, 0);
  assert.equal(run.calls.length, 0, "no command was executed");
  assert.equal(r.refused[0].reason, "op_malformed"); // missing op -> refused
});

// ── RR-03 both effect surfaces are recorded on the receipt ─────────────────────
test("RR-03: receipts bind subject_effect AND control_plane_effect", () => {
  const run = mockOpRunner({ "git status --short": { code: 0, stdout: "x", stderr: "" } });
  const r = runReliefShift({ queue: [{ id: "h", op: "git.status" }], runOp: run });
  assert.equal(r.completed[0].subject_effect, "read_only");
  assert.equal(r.completed[0].control_plane_effect, "none");
  assert.match(r.completed[0].observation_sha256, /^sha256:[0-9a-f]{64}$/);
});

// ── RR-04 a failing op is failed_safely; a throwing executor is captured ───────
test("RR-04: non-zero op is failed_safely; a throwing executor never crashes the shift", () => {
  const run = mockOpRunner({ "node scripts/review/kernel-purity-check.mjs": { code: 1, stdout: "", stderr: "violation" } });
  const r1 = runReliefShift({ queue: [{ id: "p", op: "purity.check" }], runOp: run });
  assert.equal(r1.failed_safely.length, 1);
  assert.equal(r1.failed_safely[0].exit_code, 1);
  const boom = () => { throw new Error("spawn boom"); };
  const r2 = runReliefShift({ queue: [{ id: "g", op: "git.status" }], runOp: boom });
  assert.equal(r2.failed_safely.length, 1);
  assert.equal(r2.failed_safely[0].exit_code, null);
});

// ── RR-05 invalid op args are refused, nothing executed ────────────────────────
test("RR-05: an op with invalid args is refused, never executed", () => {
  const run = mockOpRunner({});
  const r = runReliefShift({ queue: [{ id: "t", op: "test.run", args: { paths: ["/etc/passwd"] } }], runOp: run });
  assert.equal(r.refused[0].reason, "invalid_test_paths");
  assert.equal(run.calls.length, 0);
});

// ── RR-06 missing runOp fails closed ──────────────────────────────────────────
test("RR-06: no injected runOp fails closed, executes nothing", () => {
  assert.equal(runReliefShift({ queue: [{ id: "x", op: "git.status" }] }).error, "run_op_required");
});

// ── RR-07 briefing carries the zero-authority invariants ───────────────────────
test("RR-07: the shift briefing carries the hard safety invariants", () => {
  const run = mockOpRunner({ "git status --short": { code: 0, stdout: "x", stderr: "" }, "git diff --check": { code: 1, stdout: "", stderr: "e" } });
  const r = runReliefShift({
    queue: [{ id: "a", op: "git.status" }, { id: "b", op: "git.diff_check" }, { id: "c", op: "git.push" }],
    runOp: run,
    now: "2026-08-13T07:00:00Z",
  });
  assert.equal(r.briefing.done, 1);
  assert.equal(r.briefing.failed_safely, 1);
  assert.equal(r.briefing.unauthorized_actions, 0);
  assert.equal(r.briefing.authority_delta, 0);
});

// ── RR-08 receipt shape via buildWorkReceipt ──────────────────────────────────
test("RR-08: buildWorkReceipt binds op, argv, exit, and an observation hash", () => {
  const resolved = resolveOperation("git.status");
  const rec = buildWorkReceipt({ unit: { id: "u" }, resolved, result: { code: 0, stdout: "hi", stderr: "" }, now: "2026-08-13T05:00:00Z" });
  assert.equal(rec.schema, RELIEF_RECEIPT_SCHEMA);
  assert.equal(rec.op, "git.status");
  assert.deepEqual(rec.argv, ["status", "--short"]);
  assert.equal(rec.ok, true);
});
