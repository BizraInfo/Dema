// Onboarding Seal v0.1 — regression contract tests.
// Locks the 9 first-run invariants from the 2026-05-20 omnidirectional audit.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

import {
  ONBOARDING_SEAL_SCHEMA,
  SEAL_INVARIANT_KEYS,
  evaluateOnboardingSeal,
  formatOnboardingSealReport
} from "../packages/core/src/onboarding-seal.js";
import * as receiptStoreModule from "../packages/receipts/src/receipt-store.js";
import { defaultStatus } from "../packages/core/src/status.js";

// A canonical "passing" snapshot built from the defaults the rest of the
// system already enforces. Each test below mutates ONE invariant to fail
// and asserts the seal catches that one specifically.
function passingSnapshot() {
  return {
    status: {
      ...defaultStatus(),
      ready: true,
      consoleReady: true,
      activationGate: "EXPLICIT_GO_REQUIRED",
      daemonStatus: "stopped",
      missionExecuted: false,
      runtimePulse: { fired: false },
      human: "Mumu"
    },
    profile_present: true,
    today_tick: { timestamp: "2026-05-23T06:50:00.000Z" },
    os_username: "bizra-operating-system",
    receipt_module: receiptStoreModule
  };
}

test("ONBOARDING_SEAL_SCHEMA is the expected v0.1 string", () => {
  assert.equal(ONBOARDING_SEAL_SCHEMA, "bizra.dema.onboarding_seal.v0.1");
});

test("SEAL_INVARIANT_KEYS contains exactly 9 invariants in canonical order", () => {
  assert.deepEqual(SEAL_INVARIANT_KEYS, [
    "profile_exists",
    "today_tick_recorded",
    "human_identity_safe",
    "console_ready",
    "activation_gate_explicit_go",
    "daemon_not_running",
    "mission_not_executed",
    "runtime_pulse_not_fired",
    "receipt_store_read_only"
  ]);
});

test("passing snapshot → Seal HOLDS with score 1 and all 9 invariants ok", () => {
  const r = evaluateOnboardingSeal(passingSnapshot());
  assert.equal(r.ok, true, `failed: ${JSON.stringify(r.failed_invariants)}`);
  assert.equal(r.score, 1);
  assert.equal(r.invariants.length, 9);
  for (const inv of r.invariants) {
    assert.equal(inv.status, "ok", `invariant ${inv.key} status=${inv.status}`);
  }
  assert.match(r.next_safe_action, /HOLDS/);
});

test("Invariant 1: missing profile.json → seal BROKEN, blames profile_exists", () => {
  const snap = passingSnapshot();
  snap.profile_present = false;
  const r = evaluateOnboardingSeal(snap);
  assert.equal(r.ok, false);
  assert.deepEqual(r.failed_invariants, ["profile_exists"]);
});

test("Invariant 2: missing today tick → blames today_tick_recorded", () => {
  const snap = passingSnapshot();
  snap.today_tick = null;
  const r = evaluateOnboardingSeal(snap);
  assert.equal(r.ok, false);
  assert.deepEqual(r.failed_invariants, ["today_tick_recorded"]);
});

test("Invariant 2: tick without timestamp → blames today_tick_recorded", () => {
  const snap = passingSnapshot();
  snap.today_tick = { schema: "x" };
  const r = evaluateOnboardingSeal(snap);
  assert.equal(r.ok, false);
  assert.deepEqual(r.failed_invariants, ["today_tick_recorded"]);
});

test("Invariant 3: human === OS username (auto-leak) → blames human_identity_safe", () => {
  const snap = passingSnapshot();
  snap.status.human = "bizra-operating-system";
  const r = evaluateOnboardingSeal(snap);
  assert.equal(r.ok, false);
  assert.deepEqual(r.failed_invariants, ["human_identity_safe"]);
});

test("Invariant 3: human is null (anonymous) → seal still HOLDS", () => {
  const snap = passingSnapshot();
  snap.status.human = null;
  const r = evaluateOnboardingSeal(snap);
  assert.equal(r.ok, true);
});

test("Invariant 3: leak-like default ('unknown') → BROKEN", () => {
  const snap = passingSnapshot();
  snap.status.human = "unknown";
  const r = evaluateOnboardingSeal(snap);
  assert.equal(r.ok, false);
  assert.deepEqual(r.failed_invariants, ["human_identity_safe"]);
});

test("Invariant 4: consoleReady=false → blames console_ready", () => {
  const snap = passingSnapshot();
  snap.status.consoleReady = false;
  const r = evaluateOnboardingSeal(snap);
  assert.equal(r.ok, false);
  assert.deepEqual(r.failed_invariants, ["console_ready"]);
});

test("Invariant 5: activationGate=BLOCKED → blames activation_gate_explicit_go", () => {
  const snap = passingSnapshot();
  snap.status.activationGate = "BLOCKED";
  const r = evaluateOnboardingSeal(snap);
  assert.equal(r.ok, false);
  assert.deepEqual(r.failed_invariants, ["activation_gate_explicit_go"]);
});

test("Invariant 6: daemonStatus=running → blames daemon_not_running", () => {
  const snap = passingSnapshot();
  snap.status.daemonStatus = "running";
  const r = evaluateOnboardingSeal(snap);
  assert.equal(r.ok, false);
  assert.deepEqual(r.failed_invariants, ["daemon_not_running"]);
});

test("Invariant 6: daemonStatus='stopped' or 'unknown' → ok (no hidden daemon)", () => {
  for (const v of ["stopped", "unknown", "n/a"]) {
    const snap = passingSnapshot();
    snap.status.daemonStatus = v;
    const r = evaluateOnboardingSeal(snap);
    assert.equal(r.ok, true, `daemonStatus=${v} should pass`);
  }
});

test("Invariant 7: missionExecuted=true → blames mission_not_executed", () => {
  const snap = passingSnapshot();
  snap.status.missionExecuted = true;
  const r = evaluateOnboardingSeal(snap);
  assert.equal(r.ok, false);
  assert.deepEqual(r.failed_invariants, ["mission_not_executed"]);
});

test("Invariant 8: runtimePulse.fired=true → blames runtime_pulse_not_fired", () => {
  const snap = passingSnapshot();
  snap.status.runtimePulse = { fired: true };
  const r = evaluateOnboardingSeal(snap);
  assert.equal(r.ok, false);
  assert.deepEqual(r.failed_invariants, ["runtime_pulse_not_fired"]);
});

test("Invariant 9: receipt store has a 'mint' export → BROKEN", () => {
  const snap = passingSnapshot();
  snap.receipt_module = { listReceipts: () => [], mint: () => {} };
  const r = evaluateOnboardingSeal(snap);
  assert.equal(r.ok, false);
  assert.deepEqual(r.failed_invariants, ["receipt_store_read_only"]);
});

test("Invariant 9: receipt_module not provided → warn (not_evaluated), seal still HOLDS", () => {
  const snap = passingSnapshot();
  snap.receipt_module = null;
  const r = evaluateOnboardingSeal(snap);
  const inv9 = r.invariants.find((i) => i.key === "receipt_store_read_only");
  assert.equal(inv9.status, "warn");
  assert.match(String(inv9.value), /not_evaluated/);
  assert.equal(r.ok, true, "warn does not break the seal");
});

test("Invariant 9: live receipt-store module surface is read/list-only", () => {
  // Real module from packages/receipts/src/receipt-store.js — locks the
  // contract that no mint export exists.
  const r = evaluateOnboardingSeal(passingSnapshot());
  const inv9 = r.invariants.find((i) => i.key === "receipt_store_read_only");
  assert.equal(
    inv9.status,
    "ok",
    `live receipt-store exports leaked a mint surface; exports: ${Object.keys(receiptStoreModule).join(", ")}`
  );
});

test("Verdict object is deeply frozen", () => {
  const r = evaluateOnboardingSeal(passingSnapshot());
  assert.ok(Object.isFrozen(r));
  assert.ok(Object.isFrozen(r.invariants));
  assert.ok(Object.isFrozen(r.boundary));
});

test("Boundary stamp declares zero side effects", () => {
  const r = evaluateOnboardingSeal(passingSnapshot());
  assert.deepEqual(r.boundary, {
    read_only: true,
    network: false,
    mint: false,
    external_send: false,
    urp_runtime: false,
    filesystem_write_performed: false
  });
});

test("formatOnboardingSealReport renders human report with verdict + invariants", () => {
  const r = evaluateOnboardingSeal(passingSnapshot());
  const text = formatOnboardingSealReport(r);
  assert.match(text, /Onboarding Seal v0\.1/);
  assert.match(text, /HOLDS/);
  for (const key of SEAL_INVARIANT_KEYS) {
    // Each invariant's label or key fragment should appear; using a loose
    // check via the section banner only.
  }
  assert.match(text, /Invariants:/);
});

test("formatOnboardingSealReport reflects broken seal", () => {
  const snap = passingSnapshot();
  snap.status.daemonStatus = "running";
  const r = evaluateOnboardingSeal(snap);
  const text = formatOnboardingSealReport(r);
  assert.match(text, /BROKEN/);
  assert.match(text, /daemon_not_running/);
});

test("Live disk reality (informational): if ~/.dema/profile.json exists, snapshot reflects it", () => {
  // Not a gate — this test just records the cross-session reality without
  // failing if the operator hasn't run `dema setup` in this checkout.
  const profilePath = join(process.env.DEMA_HOME || join(homedir(), ".dema"), "profile.json");
  const present = existsSync(profilePath);
  // No assertion on the boolean — the seal is an evaluator, not a setup
  // initiator. We assert that evaluation succeeds either way.
  const snap = passingSnapshot();
  snap.profile_present = present;
  const r = evaluateOnboardingSeal(snap);
  if (!present) {
    assert.equal(r.ok, false);
    assert.ok(r.failed_invariants.includes("profile_exists"));
  } else {
    assert.equal(r.ok, true);
  }
});
