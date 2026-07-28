import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  evaluatePredicates,
  formatDoctorDashboard,
} from "../packages/core/src/doctor-dashboard.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function defaultFailStatus() {
  return {
    ready: false,
    consoleReady: false,
    activationGate: "BLOCKED",
    daemonStatus: "unknown",
    findings: ["Node0 adapter not connected"],
  };
}

// An all-ok node has an explicitly reachable gateway. This fixture used to rely
// on `findings: []` alone, which passed only because the gatewayProbe predicate
// inferred reachability from the absence of a substring — the defect TASK-036
// closes. Reachability is now asserted, not inferred.
function defaultOkStatus() {
  return {
    ready: true,
    consoleReady: true,
    activationGate: "EXPLICIT_GO_REQUIRED",
    daemonStatus: "stopped",
    findings: [],
    gateway: { reachable: true },
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
    assert.ok(
      typeof p.fix === "string" && p.fix.length > 0,
      `fix missing for ${p.key}`,
    );
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
  assert.ok(typeof gate.fix === "string" && gate.fix.length > 0);
});

// TASK-036 defect 1: `dema setup` cannot move the activation gate. defaultStatus()
// hardcodes activationGate:"BLOCKED" and setup never touches it; only the operator
// bridge reports a different gate. Pointing the operator at setup is a dead end.
test("evaluatePredicates: BLOCKED gate fix names the operator bridge, not `dema setup`", () => {
  const preds = evaluatePredicates({ activationGate: "BLOCKED" });
  const gate = preds.find((p) => p.key === "activationGate");
  assert.doesNotMatch(
    gate.fix,
    /dema setup/,
    "setup cannot move the gate; advising it strands the operator",
  );
  assert.match(
    gate.fix,
    /DEMA_NODE0_ADAPTER|DEMA_GATEWAY_URL|DEMA_NODE0_STATUS_COMMAND/,
    "fix must name the bridge that actually reports the gate",
  );
});

test("evaluatePredicates: not-ready fix does not point at `dema setup` either", () => {
  const preds = evaluatePredicates({ ...defaultOkStatus(), ready: false });
  const ready = preds.find((p) => p.key === "ready");
  assert.equal(ready.status, "fail");
  assert.doesNotMatch(
    ready.fix,
    /dema setup/,
    "`ready` is reported by the adapter; setup does not set it",
  );
});

test("evaluatePredicates: daemon running → fail", () => {
  const preds = evaluatePredicates({
    ...defaultOkStatus(),
    daemonStatus: "running",
  });
  const daemon = preds.find((p) => p.key === "daemonStatus");
  assert.equal(daemon.status, "fail");
  assert.ok(daemon.fix.length > 0);
});

// ── gatewayProbe (TASK-036 defect 2) ─────────────────────────────────────────
//
// The predicate used to synthesize reachability by sniffing the free-text
// findings array for "not connected". It opened no socket, so it claimed
// "reachable" for any payload that merely worded its failure differently — or
// carried no findings at all. Reachability now comes from the structured
// `status.gateway.reachable` field the adapter already populates, and the claim
// is fail-closed: nothing short of an explicit `true` prints "reachable".

const gw = (status) =>
  evaluatePredicates(status).find((p) => p.key === "gatewayProbe");

test("gatewayProbe: gateway.reachable=true → ok", () => {
  const p = gw({ ...defaultOkStatus(), gateway: { reachable: true } });
  assert.equal(p.status, "ok");
  assert.match(p.value, /reachable/);
});

test("gatewayProbe: gateway.reachable=false → warn (not fail), not claimed reachable", () => {
  const p = gw({ ...defaultOkStatus(), gateway: { reachable: false } });
  assert.equal(p.status, "warn");
  assert.equal(p.fix, undefined, "warn-only by design");
  assert.doesNotMatch(p.value, /^reachable/);
});

// Adversarial input (a): nothing probed, so nothing may be claimed. The
// predicate reports n/a — like the Daemon predicate's "n/a-via-gateway" — which
// keeps a healthy legacy-bridge node able to reach a green verdict without
// asserting a reachability it never measured.
test("gatewayProbe: no gateway configured → n/a, never the bare 'reachable' claim", () => {
  const p = gw({ ...defaultOkStatus(), findings: [], gateway: undefined });
  assert.equal(p.status, "ok");
  assert.match(p.value, /n\/a/);
  assert.doesNotMatch(
    p.value,
    /\breachable\b/,
    "must not claim reachability that was never measured",
  );
});

// Adversarial input (b): a real failure worded differently than the old sniff.
// A genuine gateway failure always populates gateway.reachable=false (proven by
// the dead-gateway CLI test), so prose alone must not drive the predicate — but
// it must not manufacture a "reachable" claim either.
test("gatewayProbe: explicit failure findings worded differently → no reachable claim", () => {
  const p = gw({
    ...defaultOkStatus(),
    gateway: undefined,
    findings: ["gateway refused connection at 127.0.0.1:8000 — ECONNREFUSED"],
  });
  assert.doesNotMatch(p.value, /\breachable\b/);
});

// The structured field is authoritative even when findings prose disagrees.
test("gatewayProbe: gateway.reachable=false wins over silent findings", () => {
  const p = gw({ ...defaultOkStatus(), findings: [], gateway: { reachable: false } });
  assert.equal(p.status, "warn");
  assert.doesNotMatch(p.value, /^reachable/);
});

// The old sniffed substring no longer drives the predicate at all.
test("gatewayProbe: legacy 'not connected' finding does not drive the predicate", () => {
  const sniffed = gw({
    ...defaultOkStatus(),
    gateway: undefined,
    findings: ["Node0 adapter not connected"],
  });
  const silent = gw({ ...defaultOkStatus(), gateway: undefined, findings: [] });
  assert.equal(
    sniffed.value,
    silent.value,
    "findings prose must not change the reachability verdict",
  );
  assert.equal(sniffed.fix, undefined, "warn-only by design, never a fix");
});

// A healthy legacy bridge (no gateway concept) must still reach a green verdict.
test("formatDoctorDashboard: healthy legacy bridge with no gateway → ready and consent-gated", () => {
  const preds = evaluatePredicates({
    ...defaultOkStatus(),
    gateway: undefined,
  });
  const output = formatDoctorDashboard(preds, { color: false });
  assert.match(output, /ready and consent-gated/);
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
  assert.ok(
    output.includes("\x1b["),
    "ANSI codes should be present when color=true",
  );
});

test("formatDoctorDashboard: color=false → no ANSI escape codes", () => {
  const preds = evaluatePredicates(defaultFailStatus());
  const output = formatDoctorDashboard(preds, { color: false });
  assert.ok(
    !output.includes("\x1b["),
    "ANSI codes must be absent when color=false",
  );
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
    JSON.stringify({ schema: "bizra.dema.doctor_dashboard.v0.1", predicates }),
  );
  assert.equal(json.schema, "bizra.dema.doctor_dashboard.v0.1");
  assert.ok(Array.isArray(json.predicates));
});
