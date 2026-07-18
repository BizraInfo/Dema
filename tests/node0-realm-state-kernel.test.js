import test from "node:test";
import assert from "node:assert/strict";

import {
  planNode0RealmStateKernel,
  buildNode0RealmStateKernelPayload,
  verifyNode0RealmStateKernel,
  runNode0RealmStateKernel,
  reduceNode0RealmEvents,
  makeNode0RealmEvent,
  NODE0_REALM_GENESIS_EVENT_ID,
  NODE0_REALM_STATE_KERNEL_SCHEMA,
  NODE0_REALM_STATE_KERNEL_TRUTH_LABEL,
  NODE0_REALM_STATE_KERNEL_GO_PHRASE,
} from "../packages/core/src/node0-realm-state-kernel.js";
import { runNode0RealmStateKernelCheck } from "../scripts/review/node0-realm-state-kernel-check.mjs";

// Each test encodes part of the NODE0-REALM-STATE-KERNEL-1A proof contract:
// deterministic replay of an injected event history into realm state, chain
// integrity, authority monotonicity, verdict-gated promotion, all fail-closed.

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
    ["MISSION_DECLARED", { mission_id: "m1", objective: "close one bounded mission" }],
    ["MISSION_CHECKPOINT", { mission_id: "m1" }],
    ["AUTHORITY_NARROWED", { scopes: ["read_events", "derive_state"] }],
    ["MISSION_VERDICT", { mission_id: "m1", verdict: "PASS" }],
    ["ASSET_PROMOTED", { mission_id: "m1", asset_id: "a1" }],
  ]);
}

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planNode0RealmStateKernel({ consent: "wrong", input: { events: [] } });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and well-formed input", () => {
  const plan = planNode0RealmStateKernel({ consent: NODE0_REALM_STATE_KERNEL_GO_PHRASE, input: { events: [] } });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("plan blocks input without an events array", () => {
  const plan = planNode0RealmStateKernel({ consent: NODE0_REALM_STATE_KERNEL_GO_PHRASE, input: {} });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("input_events_not_array"));
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildNode0RealmStateKernelPayload({ events: fixtureEvents() });
  assert.equal(payload.schema, NODE0_REALM_STATE_KERNEL_SCHEMA);
  assert.equal(payload.truth_label, NODE0_REALM_STATE_KERNEL_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.boundary.execution_allowed, false);
  assert.equal(payload.boundary.live_execution_performed, false);
});

test("replay is deterministic: same events produce the same content hash", () => {
  const a = buildNode0RealmStateKernelPayload({ events: fixtureEvents() });
  const b = buildNode0RealmStateKernelPayload({ events: fixtureEvents() });
  assert.equal(a.content_hash, b.content_hash);
});

test("empty event history reduces to the genesis realm state", () => {
  const result = reduceNode0RealmEvents([]);
  assert.equal(result.ok, true);
  assert.equal(result.events_applied, 0);
  assert.equal(result.state.head.seq, 0);
  assert.equal(result.state.head.event_id, NODE0_REALM_GENESIS_EVENT_ID);
  assert.equal(result.state.authority_scopes, null);
});

test("replay derives missions, assets and head from the event history", () => {
  const result = reduceNode0RealmEvents(fixtureEvents());
  assert.equal(result.ok, true, result.blocked_by.join(", "));
  assert.equal(result.events_applied, 5);
  assert.equal(result.state.head.seq, 5);
  assert.equal(result.state.missions["m1"].verdict, "PASS");
  assert.equal(result.state.assets["a1"].mission_id, "m1");
  assert.deepEqual(result.state.authority_scopes, ["read_events", "derive_state"]);
});

test("an event with missing or non-integer seq halts fail-closed with a canonicalizable halt marker", () => {
  // PR #401 P2 (chatgpt-codex-connector): a missing seq must not flow an
  // undefined/untrusted value into halted_at_seq — the payload must stay
  // canonicalizable and the orchestrator must return an envelope, not throw.
  const missing = reduceNode0RealmEvents([{}]);
  assert.equal(missing.ok, false);
  assert.ok(missing.blocked_by.includes("seq_not_integer"));
  assert.equal(missing.halted_at_seq, null);

  const garbage = reduceNode0RealmEvents([
    { seq: "x", kind: "MISSION_DECLARED", payload: {}, prev_event: NODE0_REALM_GENESIS_EVENT_ID, event_id: "z" },
  ]);
  assert.equal(garbage.ok, false);
  assert.ok(garbage.blocked_by.includes("seq_not_integer"));
  assert.equal(garbage.halted_at_seq, null);

  const result = runNode0RealmStateKernel({
    consent: NODE0_REALM_STATE_KERNEL_GO_PHRASE,
    input: { events: [{}] },
  });
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("seq_not_integer"));
});

test("a broken hash chain halts the replay fail-closed", () => {
  const events = fixtureEvents();
  const broken = [...events];
  broken[2] = makeNode0RealmEvent({
    seq: 3,
    kind: "AUTHORITY_NARROWED",
    payload: { scopes: ["read_events"] },
    prev_event: "sha256:" + "0".repeat(64),
  });
  const result = reduceNode0RealmEvents(broken);
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("prev_event_mismatch"));
  assert.equal(result.halted_at_seq, 3);
  assert.equal(result.state, undefined);
});

test("a forged event_id halts the replay fail-closed", () => {
  const events = fixtureEvents();
  const forged = [...events];
  forged[1] = { ...events[1], event_id: "sha256:" + "f".repeat(64) };
  const result = reduceNode0RealmEvents(forged);
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("event_id_mismatch"));
});

test("an unknown event kind halts the replay fail-closed", () => {
  const events = chain([["MISSION_DECLARED", { mission_id: "m1", objective: "x" }]]);
  const alien = makeNode0RealmEvent({
    seq: 2,
    kind: "MISSION_DECLARED",
    payload: { mission_id: "m2", objective: "y" },
    prev_event: events[0].event_id,
  });
  const result = reduceNode0RealmEvents([events[0], { ...alien, kind: "REALM_TELEPORT", event_id: alien.event_id }]);
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("kind_unknown"));
});

test("authority may only narrow — widening is rejected", () => {
  const events = chain([
    ["AUTHORITY_NARROWED", { scopes: ["read_events"] }],
    ["AUTHORITY_NARROWED", { scopes: ["read_events", "write_everything"] }],
  ]);
  const result = reduceNode0RealmEvents(events);
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("authority_widening_rejected"));
  assert.equal(result.halted_at_seq, 2);
});

test("asset promotion without a PASS verdict is rejected", () => {
  const events = chain([
    ["MISSION_DECLARED", { mission_id: "m1", objective: "x" }],
    ["ASSET_PROMOTED", { mission_id: "m1", asset_id: "a1" }],
  ]);
  const result = reduceNode0RealmEvents(events);
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("asset_promotion_without_pass_verdict"));
});

test("verify accepts a freshly built payload", () => {
  const payload = buildNode0RealmStateKernelPayload({ events: fixtureEvents() });
  assert.equal(verifyNode0RealmStateKernel(payload).ok, true);
});

test("verify rejects a tampered content_hash", () => {
  const payload = buildNode0RealmStateKernelPayload({ events: fixtureEvents() });
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  assert.equal(verifyNode0RealmStateKernel(tampered).ok, false);
});

test("verify rejects a field change that did not update the content_hash", () => {
  // Internal-consistency check: a field changed but the stored hash did not, so
  // recompute-over-body must differ from content_hash.
  //
  // NOTE the harder launder this slice does NOT yet defend against: changing a
  // field AND recomputing the hash so the body is self-consistent. Internal
  // consistency alone cannot catch that — you need an INDEPENDENT anchor
  // (a signature over the payload, or an externally measured state hash). When
  // this slice gains one, add a test that forges + recomputes and still expects
  // rejection. Until then, do not claim launder-resistance.
  const payload = buildNode0RealmStateKernelPayload({ events: fixtureEvents() });
  const forged = { ...payload, truth_label: "FORGED" };
  assert.equal(verifyNode0RealmStateKernel(forged).ok, false);
});

test("a failed replay yields a null realm_state in the payload (fail-closed)", () => {
  const events = chain([
    ["MISSION_DECLARED", { mission_id: "m1", objective: "x" }],
    ["ASSET_PROMOTED", { mission_id: "m1", asset_id: "a1" }],
  ]);
  const payload = buildNode0RealmStateKernelPayload({ events });
  assert.equal(payload.replay.ok, false);
  assert.equal(payload.realm_state, null);
});

test("review gate closes the loop: build -> verify -> tamper-reject", () => {
  const result = runNode0RealmStateKernelCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, NODE0_REALM_STATE_KERNEL_SCHEMA);
  assert.equal(result.truth_label, NODE0_REALM_STATE_KERNEL_TRUTH_LABEL);
});

test("orchestrator boundary stays all-false (no execution authority)", () => {
  const result = runNode0RealmStateKernel({
    consent: NODE0_REALM_STATE_KERNEL_GO_PHRASE,
    input: { events: fixtureEvents() },
  });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
  assert.equal(result.boundary.live_execution_performed, false);
});

test("orchestrator surfaces replay defects as named blocks", () => {
  const events = chain([
    ["AUTHORITY_NARROWED", { scopes: ["a"] }],
    ["AUTHORITY_NARROWED", { scopes: ["a", "b"] }],
  ]);
  const result = runNode0RealmStateKernel({
    consent: NODE0_REALM_STATE_KERNEL_GO_PHRASE,
    input: { events },
  });
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("authority_widening_rejected"));
});
