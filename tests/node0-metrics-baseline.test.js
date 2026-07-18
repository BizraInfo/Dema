import test from "node:test";
import assert from "node:assert/strict";

import {
  planNode0MetricsBaseline,
  buildNode0MetricsBaselinePayload,
  verifyNode0MetricsBaseline,
  runNode0MetricsBaseline,
  deriveNode0BaselineMetrics,
  NODE0_METRICS_BASELINE_SCHEMA,
  NODE0_METRICS_BASELINE_TRUTH_LABEL,
  NODE0_METRICS_BASELINE_GO_PHRASE,
} from "../packages/core/src/node0-metrics-baseline.js";
import {
  makeNode0RealmEvent,
  reduceNode0RealmEvents,
  NODE0_REALM_GENESIS_EVENT_ID,
} from "../packages/core/src/node0-realm-state-kernel.js";
import { runNode0MetricsBaselineCheck } from "../scripts/review/node0-metrics-baseline-check.mjs";
import { sha256CanonicalJsonV1 } from "../packages/canon/src/sha256-canonical-json-v1.js";

// Each test encodes part of the NODE0-METRICS-BASELINE-1A proof contract:
// metrics derive purely from replayed events, bind their derivation seqs,
// UNKNOWN is never zero, and corrupt history yields no metrics at all.

function chain(specs) {
  const events = [];
  let prev = NODE0_REALM_GENESIS_EVENT_ID;
  for (const [kind, payload] of specs) {
    const event = makeNode0RealmEvent({ seq: events.length + 1, kind, payload, prev_event: prev });
    events.push(event);
    prev = event.event_id;
  }
  return events;
}

function fixtureEvents() {
  return chain([
    ["MISSION_DECLARED", { mission_id: "m-done", objective: "complete one bounded mission" }],
    ["MISSION_DECLARED", { mission_id: "m-attempted", objective: "attempt without promotion" }],
    ["AUTHORITY_NARROWED", { scopes: ["read_events", "derive_state"] }],
    ["MISSION_VERDICT", { mission_id: "m-done", verdict: "PASS" }],
    ["ASSET_PROMOTED", { mission_id: "m-done", asset_id: "a-done" }],
  ]);
}

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planNode0MetricsBaseline({ consent: "wrong", input: { events: [] } });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and well-formed input", () => {
  const plan = planNode0MetricsBaseline({ consent: NODE0_METRICS_BASELINE_GO_PHRASE, input: { events: [] } });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("plan blocks input without an events array", () => {
  const plan = planNode0MetricsBaseline({ consent: NODE0_METRICS_BASELINE_GO_PHRASE, input: {} });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("input_events_not_array"));
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildNode0MetricsBaselinePayload({ events: fixtureEvents() });
  assert.equal(payload.schema, NODE0_METRICS_BASELINE_SCHEMA);
  assert.equal(payload.truth_label, NODE0_METRICS_BASELINE_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.boundary.execution_allowed, false);
  assert.equal(payload.boundary.live_execution_performed, false);
});

test("derivation is deterministic: same events produce the same content hash", () => {
  const a = buildNode0MetricsBaselinePayload({ events: fixtureEvents() });
  const b = buildNode0MetricsBaselinePayload({ events: fixtureEvents() });
  assert.equal(a.content_hash, b.content_hash);
});

test("empty history: counts are MEASURED zero, rates are UNKNOWN — never zero", () => {
  const payload = buildNode0MetricsBaselinePayload({ events: [] });
  const m = payload.metrics;
  assert.equal(m.missions_declared.value, 0);
  assert.equal(m.missions_declared.truth_label, "MEASURED");
  assert.deepEqual([...m.missions_declared.derived_from], []);
  assert.equal(m.recovered_value_utilization_rate.value, null);
  assert.equal(m.recovered_value_utilization_rate.truth_label, "UNKNOWN");
  assert.equal(m.recovered_value_utilization_rate.reason, "no_missions_declared");
  assert.equal(m.authority_scopes_count.truth_label, "UNKNOWN");
  assert.equal(m.authority_scopes_count.reason, "authority_never_declared");
});

test("duration metric is honestly UNKNOWN: v0.1 events carry no temporal evidence", () => {
  const payload = buildNode0MetricsBaselinePayload({ events: fixtureEvents() });
  const t = payload.metrics.time_to_first_useful_asset;
  assert.equal(t.value, null);
  assert.equal(t.truth_label, "UNKNOWN");
  assert.equal(t.reason, "no_temporal_evidence_in_v0_1_events");
});

test("fixture metrics bind exact derivation seqs", () => {
  const payload = buildNode0MetricsBaselinePayload({ events: fixtureEvents() });
  const m = payload.metrics;
  assert.equal(m.missions_declared.value, 2);
  assert.deepEqual([...m.missions_declared.derived_from], [1, 2]);
  assert.equal(m.missions_verdict_pass.value, 1);
  assert.deepEqual([...m.missions_verdict_pass.derived_from], [4]);
  assert.equal(m.assets_promoted.value, 1);
  assert.deepEqual([...m.assets_promoted.derived_from], [5]);
  assert.equal(m.authority_scopes_count.value, 2);
});

test("attempted-but-unpromoted mission lowers the utilization rate (denominator counts attempts)", () => {
  const payload = buildNode0MetricsBaselinePayload({ events: fixtureEvents() });
  const rate = payload.metrics.recovered_value_utilization_rate;
  assert.equal(rate.truth_label, "MEASURED");
  assert.equal(rate.value, 0.5);
});

test("corrupt history yields no metrics: payload fail-closed, run surfaces the reducer block", () => {
  const events = chain([
    ["MISSION_DECLARED", { mission_id: "m1", objective: "x" }],
    ["ASSET_PROMOTED", { mission_id: "m1", asset_id: "a1" }],
  ]);
  const payload = buildNode0MetricsBaselinePayload({ events });
  assert.equal(payload.replay.ok, false);
  assert.equal(payload.metrics, null);
  const result = runNode0MetricsBaseline({ consent: NODE0_METRICS_BASELINE_GO_PHRASE, input: { events } });
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("asset_promotion_without_pass_verdict"));
});

test("derive unit: every metric is MEASURED-with-evidence or UNKNOWN-with-reason", () => {
  const events = fixtureEvents();
  const { state } = reduceNode0RealmEvents(events);
  const metrics = deriveNode0BaselineMetrics(events, state);
  for (const [name, metric] of Object.entries(metrics)) {
    const measured = metric.truth_label === "MEASURED" && metric.value !== null && Array.isArray(metric.derived_from);
    const unknownShape = metric.truth_label === "UNKNOWN" && metric.value === null && typeof metric.reason === "string";
    assert.ok(measured || unknownShape, `metric ${name} violates the shape law`);
  }
});

test("verify accepts a freshly built payload", () => {
  const payload = buildNode0MetricsBaselinePayload({ events: fixtureEvents() });
  assert.equal(verifyNode0MetricsBaseline(payload).ok, true);
});

test("verify rejects a tampered content_hash", () => {
  const payload = buildNode0MetricsBaselinePayload({ events: fixtureEvents() });
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  assert.equal(verifyNode0MetricsBaseline(tampered).ok, false);
});

test("verify rejects a field change that did not update the content_hash", () => {
  // Internal-consistency check only — same declared limit as the realm kernel:
  // a forger who changes a field AND recomputes the hash is not caught here;
  // the independent anchor (signature / external state hash) is a later slice.
  const payload = buildNode0MetricsBaselinePayload({ events: fixtureEvents() });
  const forged = { ...payload, truth_label: "FORGED" };
  assert.equal(verifyNode0MetricsBaseline(forged).ok, false);
});

function rehash(payload) {
  const { content_hash, ...body } = payload;
  return Object.freeze({ ...body, content_hash: sha256CanonicalJsonV1(body) });
}

test("verifier rejects forged-and-rehashed payloads on every declared invariant", () => {
  const payload = buildNode0MetricsBaselinePayload({ events: fixtureEvents() });
  const failedPayload = buildNode0MetricsBaselinePayload({
    events: chain([
      ["MISSION_DECLARED", { mission_id: "m1", objective: "x" }],
      ["ASSET_PROMOTED", { mission_id: "m1", asset_id: "a1" }],
    ]),
  });
  const casesToCode = [
    [rehash({ ...payload, canonicalization_algorithm: "wrong.canon.v9" }), "canonicalization_algorithm_mismatch"],
    [rehash({ ...payload, hash_algorithm: "md5" }), "hash_algorithm_mismatch"],
    [rehash({ ...payload, text_encoding: "utf-16" }), "text_encoding_mismatch"],
    [rehash({ ...payload, schema: "bizra.dema.other.v9" }), "schema_mismatch"],
    [rehash({ ...payload, truth_label: "FORGED" }), "truth_label_mismatch"],
    [rehash({ ...payload, boundary: { ...payload.boundary, execution_allowed: true } }), "boundary_shape_invalid"],
    [rehash({ ...payload, metrics: null }), "metrics_missing_for_ok_replay"],
    [rehash({ ...failedPayload, metrics: payload.metrics }), "metrics_present_for_failed_replay"],
  ];
  for (const [forged, code] of casesToCode) {
    const verdict = verifyNode0MetricsBaseline(forged);
    assert.equal(verdict.ok, false, code);
    assert.ok(verdict.blocked_by.includes(code), `${code}: got ${verdict.blocked_by}`);
  }
});

test("payload replay receipt is frozen — mutation throws and verify is unaffected", () => {
  const payload = buildNode0MetricsBaselinePayload({ events: fixtureEvents() });
  assert.throws(() => { payload.replay.ok = false; }, TypeError);
  assert.throws(() => { payload.metrics.missions_declared.value = 99; }, TypeError);
  assert.equal(verifyNode0MetricsBaseline(payload).ok, true);
});

test("malformed event content fails closed through the shared reducer — no throw", () => {
  const result = runNode0MetricsBaseline({
    consent: NODE0_METRICS_BASELINE_GO_PHRASE,
    input: { events: [{ seq: 1, kind: "MISSION_DECLARED", payload: { bad: undefined }, prev_event: "GENESIS", event_id: "sha256:" + "0".repeat(64) }] },
  });
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("event_not_canonicalizable"));
});

test("review gate closes the loop: build -> verify -> tamper-reject", () => {
  const result = runNode0MetricsBaselineCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, NODE0_METRICS_BASELINE_SCHEMA);
  assert.equal(result.truth_label, NODE0_METRICS_BASELINE_TRUTH_LABEL);
  assert.equal(result.metrics.recovered_value_utilization_rate.value, 0.5);
});

test("orchestrator boundary stays all-false (no execution authority)", () => {
  const result = runNode0MetricsBaseline({
    consent: NODE0_METRICS_BASELINE_GO_PHRASE,
    input: { events: fixtureEvents() },
  });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
  assert.equal(result.boundary.live_execution_performed, false);
});
