import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  evaluatePredicates,
  formatDoctorDashboard,
  doctorVerdict,
  doctorState,
} from "../packages/core/src/doctor-dashboard.js";
import { displayWidth } from "../packages/core/src/display-width.js";

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

// ── DOCTOR-PREVIEW-RESTING-STATE-1A ──────────────────────────────────────────
//
// TASK-036 made doctor tell the truth; it still renders that truth in the
// visual language of failure. On a fresh clone with no runtime bridged,
// `activationGate: BLOCKED` / `ready: false` / `consoleReady: false` are the
// *correct resting state* — the fix prose already says so — yet they print as
// three red ❌ under a red "Verdict: blocked" and exit 1. The first thing an
// evaluator sees is a wall of red on a healthy install.
//
// The softening is gated on one structured signal, fail-closed exactly like
// gatewayProbe: only an explicit `adapter.available === false` (the
// legacy-shellout-unavailable payload, i.e. nothing bridged at all) earns
// "expected". A bridged runtime reporting the same false values is a REAL
// failure and must stay red — otherwise this feature launders every outage.

// Nothing bridged: `createNode0Adapter()` with no env returns exactly this.
function unbridgedStatus() {
  return {
    ...defaultFailStatus(),
    source: "legacy-shellout-unavailable",
    adapter: { mode: "legacy-shellout", available: false },
  };
}

// Same false readiness values, but a runtime IS bridged and reporting them.
function bridgedFailingStatus() {
  return {
    ...defaultFailStatus(),
    source: "legacy-shellout",
    adapter: { mode: "legacy-shellout", available: true },
    gateway: { reachable: false },
  };
}

const byKey = (status, key) =>
  evaluatePredicates(status).find((p) => p.key === key);

for (const key of ["activationGate", "ready", "consoleReady"]) {
  test(`evaluatePredicates: unbridged → ${key} is expected, not fail`, () => {
    assert.equal(byKey(unbridgedStatus(), key).status, "expected");
  });
}

test("evaluatePredicates: unbridged → zero fail predicates", () => {
  const preds = evaluatePredicates(unbridgedStatus());
  assert.deepEqual(
    preds.filter((p) => p.status === "fail").map((p) => p.key),
    [],
  );
});

test("evaluatePredicates: expected predicates carry a note, never a Fix", () => {
  for (const p of evaluatePredicates(unbridgedStatus())) {
    if (p.status !== "expected") continue;
    assert.equal(p.fix, undefined, `${p.key} must not carry a fix`);
    assert.ok(
      typeof p.note === "string" && p.note.length > 0,
      `${p.key} must explain why this is expected`,
    );
  }
});

// THE REGRESSION GUARD. If this ever goes green-by-softening, a real outage
// prints as "healthy" and the evaluator trusts a broken node.
for (const key of ["activationGate", "ready", "consoleReady"]) {
  test(`evaluatePredicates: BRIDGED runtime reporting bad ${key} stays fail`, () => {
    const p = byKey(bridgedFailingStatus(), key);
    assert.equal(p.status, "fail", `${key} softened while a runtime was bridged`);
    assert.ok(p.fix, `${key} must keep its fix when genuinely failing`);
  });
}

// Fail-closed on the signal itself: gateway-http payloads carry no `adapter`
// field at all. Absent ≠ false. Only an explicit false may soften.
test("evaluatePredicates: absent adapter field does not earn expected", () => {
  const preds = evaluatePredicates(defaultFailStatus());
  assert.ok(
    preds.some((p) => p.status === "fail"),
    "undefined adapter.available must not be read as unbridged",
  );
  assert.ok(!preds.some((p) => p.status === "expected"));
});

test("evaluatePredicates: adapter.available true → no expected predicates", () => {
  assert.ok(
    !evaluatePredicates(bridgedFailingStatus()).some(
      (p) => p.status === "expected",
    ),
  );
});

test("formatDoctorDashboard: unbridged verdict is preview-only, not blocked", () => {
  const output = formatDoctorDashboard(evaluatePredicates(unbridgedStatus()), {
    color: false,
  });
  const verdict = output.split("\n").find((l) => l.startsWith("Verdict:"));
  assert.match(verdict, /preview-only/);
  assert.doesNotMatch(verdict, /blocked/);
});

test("formatDoctorDashboard: unbridged prints no ❌ and no 'failed'", () => {
  const output = formatDoctorDashboard(evaluatePredicates(unbridgedStatus()), {
    color: false,
  });
  assert.ok(!output.includes("❌"), "healthy preview install must show no ❌");
  assert.ok(!output.includes("failed"), "nothing failed on a fresh install");
});

test("formatDoctorDashboard: unbridged names how to move the gate", () => {
  const output = formatDoctorDashboard(evaluatePredicates(unbridgedStatus()), {
    color: false,
  });
  assert.match(output, /DEMA_NODE0_ADAPTER|DEMA_GATEWAY_URL/);
});

test("formatDoctorDashboard: bridged failure still prints ❌ and blocked", () => {
  const output = formatDoctorDashboard(
    evaluatePredicates(bridgedFailingStatus()),
    { color: false },
  );
  assert.ok(output.includes("❌"), "a real outage must stay visibly red");
  assert.match(output, /Verdict: blocked/);
});

// ── DOCTOR-PREVIEW-RESTING-STATE-1B · machine-truth correction ───────────────
//
// 1A softened the DISPLAY and then also flipped the default EXIT CODE to 0 for
// an unbridged install. That crossed a boundary it had no mandate to cross: the
// exit code is the machine channel, and it answers "is this node operational?"
// For an unbridged node the answer is no. Returning 0 lets any script wrapping
// `dema doctor` conclude a node with no runtime, no readiness and a BLOCKED
// activation gate is healthy — the exact false GREEN this repo exists to stop.
//
// The two consumers are split instead of collapsed:
//   humans read stdout   → calm, accurate, no ❌ wall for an expected state
//   machines read $?     → conservative, nonzero until actually operational
// A caller that specifically wants to validate the preview shell asks for it
// with --preview and gets 0 when the preview environment is intact.
//
// Also closes the warn-only disagreement this suite proved empirically:
// verdict said "blocked" while the process exited 0.

function bridgedWarnOnlyStatus() {
  return {
    ready: true,
    consoleReady: true,
    activationGate: "EXPLICIT_GO_REQUIRED",
    daemonStatus: "stopped",
    findings: [],
    gateway: { reachable: false }, // measured unreachable → warn
  };
}

test("doctorState: unbridged is preview-valid but NOT operational", () => {
  const st = doctorState(evaluatePredicates(unbridgedStatus()));
  assert.equal(st.operational, false, "no runtime bridged is not operational");
  assert.equal(st.preview_environment_valid, true);
  assert.equal(st.repair_required, false, "nothing is broken");
  assert.equal(st.reason, "runtime_not_bridged");
});

test("doctorState: all-ok bridged node is operational", () => {
  const st = doctorState(evaluatePredicates(defaultOkStatus()));
  assert.equal(st.operational, true);
  assert.equal(st.repair_required, false);
});

test("doctorState: bridged failure requires repair and is not operational", () => {
  const st = doctorState(evaluatePredicates(bridgedFailingStatus()));
  assert.equal(st.operational, false);
  assert.equal(st.repair_required, true);
});

test("doctorState: warn-only is not operational (verdict and exit must agree)", () => {
  const st = doctorState(evaluatePredicates(bridgedWarnOnlyStatus()));
  assert.equal(st.operational, false, "a warning must not read as operational");
  assert.equal(st.repair_required, false, "a warning is not a repair");
});

// THE INVARIANT that keeps the two channels from ever drifting again.
test("doctorState: operational is true exactly when verdict is ready and consent-gated", () => {
  for (const s of [
    unbridgedStatus(),
    defaultOkStatus(),
    bridgedFailingStatus(),
    bridgedWarnOnlyStatus(),
    defaultFailStatus(),
  ]) {
    const preds = evaluatePredicates(s);
    assert.equal(
      doctorState(preds).operational,
      doctorVerdict(preds) === "ready and consent-gated",
      "verdict/exit channels disagree",
    );
  }
});

test("doctorVerdict: unbridged verdict never contains the word healthy", () => {
  const v = doctorVerdict(evaluatePredicates(unbridgedStatus()));
  assert.doesNotMatch(v, /healthy/, "an unbridged node has earned no health claim");
  assert.doesNotMatch(v, /ready and consent-gated/);
  assert.match(v, /preview-only/);
});

test("formatDoctorDashboard: unbridged still prints no ❌ and states nothing is broken", () => {
  const output = formatDoctorDashboard(evaluatePredicates(unbridgedStatus()), {
    color: false,
  });
  assert.ok(!output.includes("❌"), "expected state must not render as failure");
  assert.match(output, /Nothing is broken/i);
  assert.match(output, /--preview/, "must name the flag that exits 0");
});

// REGRESSION — Arabic column alignment (transports the real defect).
//
// The pre-fix bug: formatDoctorDashboard padded with `.length`, which counts
// Arabic non-spacing marks as if they occupied columns. A vocalised label was
// therefore padded SHORT by exactly its mark count, shifting the value column
// left and ragging the whole dashboard.
//
// This test deliberately uses a tashkeel-bearing label. A mark-free label
// cannot fail here — it would test the control, not the attack. Every label
// shipped today happens to be mark-free, which is why the defect was latent
// and why the design handoff's vocalised vocabulary would have exposed it.
test("Arabic labels with tashkeel align on rendered columns, not code units", () => {
  const output = formatDoctorDashboard(
    [
      // .length 11 / renders 7 — the 4-mark case measured from the handoff.
      { label: "المُقَرْنَص", value: "BLOCKED", status: "expected" },
      // .length 8 / renders 8 — mark-free, so it sets the column on true width.
      { label: "الجاهزية", value: "false", status: "expected" },
    ],
    { color: false, language_code: "ar" },
  );

  const valueColumn = (needle) => {
    const line = output.split("\n").find((l) => l.includes(needle));
    assert.ok(line, `expected a row containing ${needle}`);
    return displayWidth(line.slice(0, line.indexOf(needle)));
  };

  assert.equal(
    valueColumn("BLOCKED"),
    valueColumn("false"),
    "both values must start at the same rendered column",
  );
});
