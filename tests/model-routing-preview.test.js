// MODEL-ROUTING-PREVIEW-1A — pure-kernel tests.
//
// Maps agent roles -> local models DETERMINISTICALLY from a VERIFIED eval
// baseline. PREVIEW only: no live routing, no inference. verify re-derives every
// assignment (catches a laundered role->model mapping) and refuses a tampered
// baseline. generated_at_iso is INJECTED.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256, stableStringify } from "../packages/consent/src/consent-common.js";
import { buildModelEvalBaseline } from "../packages/core/src/model-eval-baseline.js";
import {
  buildModelRoutingPreview,
  verifyModelRoutingPreview,
  MODEL_ROUTING_PREVIEW_SCHEMA,
  MODEL_ROUTING_PREVIEW_TRUTH_LABEL,
  MODEL_ROUTING_PREVIEW_ROLES,
} from "../packages/core/src/model-routing-preview.js";

const AT = "2026-06-24T00:00:00.000Z";

function tasksFor(o) {
  return {
    endpoint_reachable: { reachable: o.reachable, latency_ms: o.latency, output: "" },
    latency_ms: { reachable: o.reachable, latency_ms: o.latency, output: "ok" },
    json_obedience: { reachable: o.reachable, latency_ms: o.latency, output: o.json ?? "" },
    code_microtask: { reachable: o.reachable, latency_ms: o.latency, output: o.code ?? "" },
    no_overclaim: { reachable: o.reachable, latency_ms: o.latency, output: o.claim ?? "" },
    truth_boundary: { reachable: o.reachable, latency_ms: o.latency, output: o.truth ?? "" },
  };
}

function baselineFrom(models) {
  return buildModelEvalBaseline({
    generated_at_iso: AT,
    suite_id: "bizra-local-small",
    provider_discovery: {},
    models_tested: Object.keys(models),
    results_by_model: Object.fromEntries(Object.entries(models).map(([k, o]) => [k, { tasks: tasksFor(o) }])),
  });
}

const BASELINE = baselineFrom({
  "ollama:fast": { reachable: true, latency: 80, json: '{"ok":true}', code: "", claim: "a small local model", truth: "the price will be 100000" },
  "ollama:wise": { reachable: true, latency: 250, json: '{"ok":true}', code: "def f():\n  return 42", claim: "a careful local model", truth: "I cannot predict the price" },
  "lm_studio:dead": { reachable: false, latency: null },
});

function relaunder(report, mutate) {
  const { preview_hash, ...body } = report;
  const forged = mutate(structuredClone(body));
  return { ...forged, preview_hash: sha256(stableStringify(forged)) };
}

test("1 · build → schema/label, boundary all-false (+ no live routing), deterministic, verify valid", () => {
  const r = buildModelRoutingPreview({ baseline: BASELINE, generated_at_iso: AT });
  assert.equal(r.schema, MODEL_ROUTING_PREVIEW_SCHEMA);
  assert.equal(r.truth_label, MODEL_ROUTING_PREVIEW_TRUTH_LABEL);
  assert.equal(r.baseline_hash, BASELINE.baseline_hash);
  assert.equal(r.boundary.live_routing_performed, false);
  assert.equal(r.boundary.model_invoked, false);
  for (const v of Object.values(r.boundary)) assert.equal(v, false);
  assert.ok(Object.isFrozen(r));
  assert.deepEqual(buildModelRoutingPreview({ baseline: BASELINE, generated_at_iso: AT }), r);
  assert.equal(verifyModelRoutingPreview(r).valid, true);
});

test("2 · deterministic assignments by measured scores", () => {
  const r = buildModelRoutingPreview({ baseline: BASELINE, generated_at_iso: AT });
  assert.equal(r.assignments.coordinator.model, "ollama:fast"); // json-obedient, lowest latency
  assert.equal(r.assignments.reasoner.model, "ollama:wise"); // no_overclaim + truth_boundary
  assert.equal(r.assignments.planner.model, "ollama:wise"); // json + code
  assert.equal(r.assignments.coder.model, "ollama:wise"); // code
  assert.equal(r.assignments.fast_responder.model, "ollama:fast"); // lowest latency
  assert.equal(r.assignments.truth_warden.model, "ollama:wise"); // truth_boundary
  assert.ok(r.assignments.coordinator.score_basis);
});

test("3 · laundered assignment caught — flip a role's model + recompute hash", () => {
  const r = buildModelRoutingPreview({ baseline: BASELINE, generated_at_iso: AT });
  const forged = relaunder(r, (b) => { b.assignments.coordinator.model = "ollama:wise"; return b; });
  const v = verifyModelRoutingPreview(forged);
  assert.equal(v.valid, false);
  assert.ok(v.blocked_by.some((x) => x.startsWith("assignment_relaundered")));
});

test("4 · tampered baseline refused, no assignments derived", () => {
  const tampered = (() => {
    const { baseline_hash, ...body } = BASELINE;
    const forged = { ...body, boundary: { ...body.boundary, mutation_performed: true } };
    return { ...forged, baseline_hash: sha256(stableStringify(forged)) };
  })();
  const r = buildModelRoutingPreview({ baseline: tampered, generated_at_iso: AT });
  assert.equal(r.rejected, true);
  assert.equal(r.reason_code, "input_baseline_invalid");
  assert.equal(r.assignments ?? null, null);
  for (const v of Object.values(r.boundary)) assert.equal(v, false);
});

test("5 · no qualifying model → null, role in unassigned_roles", () => {
  const noTruth = baselineFrom({
    "ollama:a": { reachable: true, latency: 90, json: '{"ok":true}', code: "def f(): return 1", claim: "x", truth: "the price will be 5" },
  });
  const r = buildModelRoutingPreview({ baseline: noTruth, generated_at_iso: AT });
  assert.equal(r.assignments.truth_warden.model, null);
  assert.equal(r.assignments.truth_warden.reason, "no_qualifying_model");
  assert.ok(r.unassigned_roles.includes("truth_warden"));
  assert.ok(r.unassigned_roles.includes("reasoner"));
});

test("6 · boundary tamper + recompute hash → boundary_not_false", () => {
  const r = buildModelRoutingPreview({ baseline: BASELINE, generated_at_iso: AT });
  const forged = relaunder(r, (b) => { b.boundary.live_routing_performed = true; return b; });
  const v = verifyModelRoutingPreview(forged);
  assert.equal(v.valid, false);
  assert.ok(v.blocked_by.some((x) => x.startsWith("boundary_not_false:")));
});

test("7 · roles frozen + complete", () => {
  const r = buildModelRoutingPreview({ baseline: BASELINE, generated_at_iso: AT });
  assert.deepEqual(r.roles, MODEL_ROUTING_PREVIEW_ROLES.map((x) => x.id ?? x));
  for (const role of r.roles) assert.ok(role in r.assignments);
});

test("9 · selection_table binding — verify(report) alone is internal-consistency; verify(report,{baseline}) is full fidelity", () => {
  const r = buildModelRoutingPreview({ baseline: BASELINE, generated_at_iso: AT });
  // tamper a score that changes NO assignment (dead is unreachable) → internal consistency still holds
  const forged = relaunder(r, (b) => { b.selection_table["lm_studio:dead"].latency_ms_avg = 999; return b; });
  // verify(report) alone: internal consistency holds → still valid (the documented limitation)
  assert.equal(verifyModelRoutingPreview(forged).valid, true);
  // verify(report, {baseline}): binds the table to the trusted baseline → caught
  const v = verifyModelRoutingPreview(forged, { baseline: BASELINE });
  assert.equal(v.valid, false);
  assert.ok(v.blocked_by.includes("selection_table_unbound"));
});

test("8 · purity — kernel imports no I/O, no clock/random", () => {
  const src = readFileSync(new URL("../packages/core/src/model-routing-preview.js", import.meta.url), "utf8");
  assert.doesNotMatch(src, /node:(fs|net|http|https|child_process)\b/);
  assert.doesNotMatch(src, /[^A-Za-z]fetch\s*\(/);
  assert.doesNotMatch(src, /Date\.now|Math\.random|new Date\(/);
});
