import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildNode0ActivationLadder,
  verifyNode0ActivationLadder,
  NODE0_ACTIVATION_LADDER,
  NODE0_ACTIVATION_LADDER_SCHEMA,
  NODE0_ACTIVATION_LADDER_TRUTH_LABEL,
} from "../packages/core/src/node0-activation-ladder.js";

const PREVIEW_IDS = NODE0_ACTIVATION_LADDER.filter(
  (r) => r.tier === "preview",
).map((r) => r.id);

function allShipped() {
  const evidence = {};
  for (const id of PREVIEW_IDS) {
    evidence[id] = { kernel_present: true, marker_present: true };
  }
  return evidence;
}

test("constants and ladder shape are stable", () => {
  assert.equal(
    NODE0_ACTIVATION_LADDER_SCHEMA,
    "bizra.dema.node0_activation_ladder.v0.1",
  );
  assert.equal(
    NODE0_ACTIVATION_LADDER_TRUTH_LABEL,
    "NODE0_ACTIVATION_LADDER_LOCAL_ONLY",
  );
  assert.equal(PREVIEW_IDS.length, 8);
  const gated = NODE0_ACTIVATION_LADDER.filter((r) => r.tier === "gated");
  assert.deepEqual(
    gated.map((r) => r.id),
    ["activate"],
  );
});

test("all evidence present -> every preview rung SHIPPED, activate GATED", () => {
  const report = buildNode0ActivationLadder({ evidence: allShipped() });
  for (const r of report.rungs) {
    if (r.tier === "preview") assert.equal(r.status, "SHIPPED");
    else assert.equal(r.status, "GATED_OPERATOR_ONLY");
  }
  assert.deepEqual(report.summary, {
    shipped: 8,
    partial: 0,
    missing: 0,
    gated: 1,
  });
  assert.equal(report.next_gated_rung, "activate");
});

test("missing kernel -> MISSING; marker absent on a marker rung -> PARTIAL", () => {
  const evidence = allShipped();
  evidence.observe = { kernel_present: false, marker_present: false };
  evidence.talk_hint = { kernel_present: true, marker_present: false };
  const report = buildNode0ActivationLadder({ evidence });
  const byId = Object.fromEntries(report.rungs.map((r) => [r.id, r.status]));
  assert.equal(byId.observe, "MISSING");
  assert.equal(byId.talk_hint, "PARTIAL");
  assert.equal(report.summary.missing, 1);
  assert.equal(report.summary.partial, 1);
});

test("gated rung is always GATED, ignoring forged present evidence", () => {
  const evidence = allShipped();
  evidence.activate = { kernel_present: true, marker_present: true };
  const report = buildNode0ActivationLadder({ evidence });
  const activate = report.rungs.find((r) => r.id === "activate");
  assert.equal(activate.status, "GATED_OPERATOR_ONLY");
  assert.deepEqual(activate.evidence, {
    kernel_present: false,
    marker_present: false,
  });
});

test("boundary is all-false and disclaimers present", () => {
  const report = buildNode0ActivationLadder({ evidence: allShipped() });
  assert.ok(Object.values(report.boundary).every((v) => v === false));
  const text = report.what_this_does_not_prove.join(" | ");
  assert.match(text, /SHIPPED means the surface EXISTS on disk/);
  assert.match(text, /no runtime is activated/);
  assert.match(text, /operator GO outside this repo/);
});

test("verify on an honest report is ok", () => {
  const report = buildNode0ActivationLadder({ evidence: allShipped() });
  const v = verifyNode0ActivationLadder(report);
  assert.equal(v.ok, true);
  assert.deepEqual(v.blocked_by, []);
});

test("forgery: upgraded rung status is blocked (body-bound)", () => {
  const evidence = allShipped();
  evidence.observe = { kernel_present: false, marker_present: false };
  const report = buildNode0ActivationLadder({ evidence });
  const forged = structuredClone(report);
  forged.rungs.find((r) => r.id === "observe").status = "SHIPPED";
  const v = verifyNode0ActivationLadder(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("ladder_relaundered"));
});

test("forgery: tampered summary is blocked", () => {
  const report = buildNode0ActivationLadder({ evidence: allShipped() });
  const forged = structuredClone(report);
  forged.summary.shipped = 99;
  const v = verifyNode0ActivationLadder(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("ladder_relaundered"));
});

test("forgery: flipped boundary key is blocked", () => {
  const report = buildNode0ActivationLadder({ evidence: allShipped() });
  const forged = structuredClone(report);
  const k = Object.keys(forged.boundary)[0];
  forged.boundary[k] = true;
  const v = verifyNode0ActivationLadder(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("boundary_not_all_false"));
});

test("forgery: tampered report_hash is blocked", () => {
  const report = buildNode0ActivationLadder({ evidence: allShipped() });
  const forged = structuredClone(report);
  forged.report_hash = "0".repeat(64);
  const v = verifyNode0ActivationLadder(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("report_hash_mismatch"));
});

test("returned report is deep-frozen", () => {
  const report = buildNode0ActivationLadder({ evidence: allShipped() });
  assert.ok(Object.isFrozen(report));
  assert.ok(Object.isFrozen(report.rungs));
  assert.ok(Object.isFrozen(report.rungs[0]));
  assert.ok(Object.isFrozen(report.boundary));
  assert.ok(Object.isFrozen(report.summary));
});
