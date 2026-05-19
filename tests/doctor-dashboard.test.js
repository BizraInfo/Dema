import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  evaluatePredicates,
  formatDoctorDashboard
} from "../packages/core/src/doctor-dashboard.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function defaultFailStatus() {
  return {
    ready: false,
    consoleReady: false,
    activationGate: "BLOCKED",
    daemonStatus: "unknown",
    findings: ["Node0 adapter not connected"]
  };
}

function defaultOkStatus() {
  return {
    ready: true,
    consoleReady: true,
    activationGate: "EXPLICIT_GO_REQUIRED",
    daemonStatus: "stopped",
    findings: []
  };
}

// ── evaluatePredicates ────────────────────────────────────────────────────────

test("evaluatePredicates: all-fail status → ready+consoleReady predicates have status=fail", () => {
  const preds = evaluatePredicates(defaultFailStatus());
  const ready = preds.find((p) => p.key === "ready");
  const console_ = preds.find((p) => p.key === "consoleReady");
  assert.equal(ready.status, "fail");
  assert.equal(console_.status, "fail");
});

test("evaluatePredicates: all-fail status → failing predicates carry fix fields", () => {
  const preds = evaluatePredicates(defaultFailStatus());
  const failPreds = preds.filter((p) => p.status === "fail");
  assert.ok(failPreds.length >= 2, "at least 2 fail predicates expected");
  for (const p of failPreds) {
    assert.ok(typeof p.fix === "string" && p.fix.length > 0, `fix missing for ${p.key}`);
  }
});

test("evaluatePredicates: all-ok status → all predicates have status=ok", () => {
  const preds = evaluatePredicates(defaultOkStatus());
  for (const p of preds) {
    assert.equal(p.status, "ok", `predicate ${p.key} should be ok`);
  }
});

test("evaluatePredicates: activation gate BLOCKED → fail with fix", () => {
  const preds = evaluatePredicates({ activationGate: "BLOCKED" });
  const gate = preds.find((p) => p.key === "activationGate");
  assert.equal(gate.status, "fail");
  assert.match(gate.fix, /dema setup/);
});

test("evaluatePredicates: daemon running → fail", () => {
  const preds = evaluatePredicates({ ...defaultOkStatus(), daemonStatus: "running" });
  const daemon = preds.find((p) => p.key === "daemonStatus");
  assert.equal(daemon.status, "fail");
  assert.ok(daemon.fix.length > 0);
});

test("evaluatePredicates: gateway unreachable → warn (not fail)", () => {
  const preds = evaluatePredicates({
    ...defaultOkStatus(),
    findings: ["Node0 adapter not connected"]
  });
  const gw = preds.find((p) => p.key === "gatewayProbe");
  assert.equal(gw.status, "warn");
  assert.equal(gw.fix, undefined);
});

test("evaluatePredicates: empty/null status → all predicates render without throw", () => {
  const predsNull = evaluatePredicates(null);
  const predsEmpty = evaluatePredicates({});
  assert.ok(predsNull.length >= 5);
  assert.ok(predsEmpty.length >= 5);
  for (const p of [...predsNull, ...predsEmpty]) {
    assert.ok(typeof p.key === "string");
    assert.ok(typeof p.label === "string");
    assert.ok(["ok", "fail", "warn"].includes(p.status));
  }
});

// ── formatDoctorDashboard ─────────────────────────────────────────────────────

test("formatDoctorDashboard: color=true → contains ANSI escape codes", () => {
  const preds = evaluatePredicates(defaultFailStatus());
  const output = formatDoctorDashboard(preds, { color: true });
  assert.ok(output.includes("\x1b["), "ANSI codes should be present when color=true");
});

test("formatDoctorDashboard: color=false → no ANSI escape codes", () => {
  const preds = evaluatePredicates(defaultFailStatus());
  const output = formatDoctorDashboard(preds, { color: false });
  assert.ok(!output.includes("\x1b["), "ANSI codes must be absent when color=false");
});

test("formatDoctorDashboard: all-fail → output contains 'Verdict: blocked'", () => {
  const preds = evaluatePredicates(defaultFailStatus());
  const output = formatDoctorDashboard(preds, { color: false });
  assert.match(output, /Verdict: blocked/);
});

test("formatDoctorDashboard: all-ok → output contains 'ready and consent-gated'", () => {
  const preds = evaluatePredicates(defaultOkStatus());
  const output = formatDoctorDashboard(preds, { color: false });
  assert.match(output, /ready and consent-gated/);
});

test("formatDoctorDashboard: output contains header and footer hints", () => {
  const preds = evaluatePredicates(defaultFailStatus());
  const output = formatDoctorDashboard(preds, { color: false });
  assert.match(output, /Dema Doctor — Node0 readiness check/);
  assert.match(output, /dema status/);
  assert.match(output, /dema explain doctor/);
});

test("formatDoctorDashboard: all-fail → summary line shows fail count", () => {
  const preds = evaluatePredicates(defaultFailStatus());
  const output = formatDoctorDashboard(preds, { color: false });
  assert.match(output, /predicate.* failed/);
});

test("formatDoctorDashboard: all-ok → summary line shows only OK count", () => {
  const preds = evaluatePredicates(defaultOkStatus());
  const output = formatDoctorDashboard(preds, { color: false });
  assert.match(output, /OK/);
  assert.ok(!output.includes("failed"), "should not show 'failed' when all ok");
});

test("evaluatePredicates: JSON output schema tag present", () => {
  // Simulate --json path produces schema-tagged object.
  const status = defaultFailStatus();
  const predicates = evaluatePredicates(status);
  const json = JSON.parse(
    JSON.stringify({ schema: "bizra.dema.doctor_dashboard.v0.1", predicates })
  );
  assert.equal(json.schema, "bizra.dema.doctor_dashboard.v0.1");
  assert.ok(Array.isArray(json.predicates));
});
