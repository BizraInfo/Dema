import test from "node:test";
import assert from "node:assert/strict";

import {
  planDemaPresence,
  buildDemaPresencePayload,
  verifyDemaPresence,
  runDemaPresence,
  DEMA_PRESENCE_SCHEMA,
  DEMA_PRESENCE_TRUTH_LABEL,
  DEMA_PRESENCE_GO_PHRASE,
} from "../packages/core/src/dema-presence.js";
import { runDemaPresenceCheck } from "../scripts/review/dema-presence-check.mjs";

// RED-FIRST: each test encodes part of the DEMA-PRESENCE-1A proof contract. They fail until
// the kernel bodies are implemented. Build to green — do not soften the asserts.
// The fixture is a receipt-bound event stream shaped like tonight's Node0 proof chain.

const FIXTURE_INPUT = {
  events: [
    { kind: "heartbeat", receipt_hash: `sha256:${"77fc16c8".padEnd(64, "0")}`, seq: 1, emitted_at: "2026-08-25T03:00:00Z" },
    { kind: "mission_started", receipt_hash: `sha256:${"48a78ce6".padEnd(64, "0")}`, seq: 2, emitted_at: "2026-08-25T04:48:00Z" },
    { kind: "pat_started", receipt_hash: `sha256:${"48a78ce6".padEnd(64, "0")}`, seq: 3, emitted_at: "2026-08-25T04:49:00Z" },
    { kind: "consent_required", receipt_hash: `sha256:${"86ef608b".padEnd(64, "0")}`, seq: 4, emitted_at: "2026-08-25T04:50:00Z" },
    { kind: "sat_verifying", receipt_hash: `sha256:${"049efbce".padEnd(64, "0")}`, seq: 5, emitted_at: "2026-08-25T05:10:00Z" },
    { kind: "mission_verified", receipt_hash: `sha256:${"049efbce".padEnd(64, "0")}`, seq: 6, emitted_at: "2026-08-25T05:12:00Z" },
  ],
};

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planDemaPresence({ consent: "wrong", input: FIXTURE_INPUT });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan refuses an event without a receipt hash (no theatrical state)", () => {
  const unbound = { events: [{ kind: "mission_started", seq: 1, emitted_at: "2026-08-25T03:00:00Z" }] };
  const plan = planDemaPresence({ consent: DEMA_PRESENCE_GO_PHRASE, input: unbound });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("event_0_receipt_hash_missing_or_malformed"));
});

test("plan is eligible with exact consent and well-formed input", () => {
  const plan = planDemaPresence({ consent: DEMA_PRESENCE_GO_PHRASE, input: FIXTURE_INPUT });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildDemaPresencePayload(FIXTURE_INPUT);
  assert.equal(payload.schema, DEMA_PRESENCE_SCHEMA);
  assert.equal(payload.truth_label, DEMA_PRESENCE_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.boundary.execution_allowed, false);
  assert.equal(payload.boundary.live_execution_performed, false);
});

test("derivation maps the last decisive event to the avatar state", () => {
  const payload = buildDemaPresencePayload(FIXTURE_INPUT);
  assert.equal(payload.derivation.state, "VERIFIED_DONE");
  assert.equal(payload.derivation.reason, "event:mission_verified");
  assert.equal(payload.derivation.justified_by, FIXTURE_INPUT.events[5].receipt_hash);
});

test("derivation yields UNKNOWN on a sequence gap (uncertainty is visible)", () => {
  const gapped = {
    events: [
      { kind: "mission_started", receipt_hash: FIXTURE_INPUT.events[1].receipt_hash, seq: 2, emitted_at: "2026-08-25T04:48:00Z" },
      { kind: "mission_verified", receipt_hash: FIXTURE_INPUT.events[5].receipt_hash, seq: 9, emitted_at: "2026-08-25T05:12:00Z" },
    ],
  };
  const payload = buildDemaPresencePayload(gapped);
  assert.equal(payload.derivation.state, "UNKNOWN");
  assert.equal(payload.derivation.reason, "seq_gap_at_tail");
  assert.equal(payload.derivation.gaps.length, 1);
});

test("derivation yields UNKNOWN on an unrecognized event kind (never silently familiar)", () => {
  const alien = {
    events: [
      { kind: "mission_started", receipt_hash: FIXTURE_INPUT.events[1].receipt_hash, seq: 1, emitted_at: "2026-08-25T04:48:00Z" },
      { kind: "spontaneous_enlightenment", receipt_hash: FIXTURE_INPUT.events[2].receipt_hash, seq: 2, emitted_at: "2026-08-25T04:49:00Z" },
    ],
  };
  const payload = buildDemaPresencePayload(alien);
  assert.equal(payload.derivation.state, "UNKNOWN");
  assert.equal(payload.derivation.reason, "unrecognized_event_kind:spontaneous_enlightenment");
});

test("verify accepts a freshly built payload", () => {
  const payload = buildDemaPresencePayload(FIXTURE_INPUT);
  assert.equal(verifyDemaPresence(payload).ok, true);
});

test("verify rejects a tampered content_hash", () => {
  const payload = buildDemaPresencePayload(FIXTURE_INPUT);
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  assert.equal(verifyDemaPresence(tampered).ok, false);
});

test("verify rejects a field change that did not update the content_hash", () => {
  // Internal-consistency check: a field changed but the stored hash did not, so
  // recompute-over-body must differ from content_hash.
  //
  // NOTE the harder launder this scaffold does NOT yet defend against: changing a
  // field AND recomputing the hash so the body is self-consistent. Internal
  // consistency alone cannot catch that — you need an INDEPENDENT anchor
  // (a signature over the payload, or an externally measured state hash). When
  // this slice gains one, add a test that forges + recomputes and still expects
  // rejection. Until then, do not claim launder-resistance.
  const payload = buildDemaPresencePayload(FIXTURE_INPUT);
  const forged = { ...payload, truth_label: "FORGED" };
  assert.equal(verifyDemaPresence(forged).ok, false);
});

test("verify rejects a forged derivation that no longer matches the events", () => {
  // Slice-specific launder attempt: keep the hash consistent-looking but claim
  // a state the event stream does not justify. Re-derivation must catch it.
  const payload = buildDemaPresencePayload(FIXTURE_INPUT);
  const forged = { ...payload, derivation: { ...payload.derivation, state: "VERIFIED_DONE", reason: "event:nothing_happened" } };
  const verdict = verifyDemaPresence(forged);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.blocked_by.includes("derivation_not_reproducible") || verdict.blocked_by.includes("content_hash_mismatch"));
});

test("review gate closes the loop: build -> verify -> tamper-reject", () => {
  const result = runDemaPresenceCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, DEMA_PRESENCE_SCHEMA);
  assert.equal(result.truth_label, DEMA_PRESENCE_TRUTH_LABEL);
});

test("orchestrator boundary stays all-false (no execution authority)", () => {
  const result = runDemaPresence({ consent: DEMA_PRESENCE_GO_PHRASE, input: FIXTURE_INPUT });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
  assert.equal(result.boundary.live_execution_performed, false);
});
