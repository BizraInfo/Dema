import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSseStream,
  buildSseStreamEvent,
  verifySseStream,
  serializeSseFrames,
  parseSseFrames,
  planNode0SseEnvelopeStream,
  buildNode0SseEnvelopeStreamPayload,
  verifyNode0SseEnvelopeStream,
  runNode0SseEnvelopeStream,
  NODE0_SSE_ENVELOPE_STREAM_SCHEMA,
  NODE0_SSE_ENVELOPE_STREAM_TRUTH_LABEL,
  NODE0_SSE_ENVELOPE_STREAM_GO_PHRASE,
} from "../packages/core/src/node0-sse-envelope-stream.js";
import { runNode0SseEnvelopeStreamCheck } from "../scripts/review/node0-sse-envelope-stream-check.mjs";

// NODE0-SSE-ENVELOPE-STREAM-1A proof contract. Each negative case is a distinct
// near-miss that a shape-only verifier would accept: gaps, duplicates, tampered
// bytes, state-carrying heartbeats, post-terminal events, unknown kinds.

const FIXTURE_INPUT = {
  stream_id: "prod02-execution-transport",
  frames: [
    { kind: "state", payload: { mission_id: "M1", phase: "CONDUCTION" } },
    { kind: "heartbeat", payload: {} },
    { kind: "stream_end", payload: { reason: "complete" } },
  ],
};

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planNode0SseEnvelopeStream({ consent: "wrong", input: FIXTURE_INPUT });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and well-formed input", () => {
  const plan = planNode0SseEnvelopeStream({ consent: NODE0_SSE_ENVELOPE_STREAM_GO_PHRASE, input: FIXTURE_INPUT });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("plan refuses malformed ontology even under exact consent", () => {
  const badId = planNode0SseEnvelopeStream({
    consent: NODE0_SSE_ENVELOPE_STREAM_GO_PHRASE,
    input: { stream_id: "BAD ID!", frames: [{ kind: "state" }] },
  });
  assert.equal(badId.eligible, false);
  assert.ok(badId.blocked_by.includes("stream_id_malformed"));

  const badKind = planNode0SseEnvelopeStream({
    consent: NODE0_SSE_ENVELOPE_STREAM_GO_PHRASE,
    input: { stream_id: "ok-id", frames: [{ kind: "tick" }] },
  });
  assert.equal(badKind.eligible, false);
  assert.ok(badKind.blocked_by.includes("frame_kind_unknown"));
});

test("payload is content-addressed and carries an all-false boundary + stream commitment", () => {
  const payload = buildNode0SseEnvelopeStreamPayload(FIXTURE_INPUT);
  assert.equal(payload.schema, NODE0_SSE_ENVELOPE_STREAM_SCHEMA);
  assert.equal(payload.truth_label, NODE0_SSE_ENVELOPE_STREAM_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.boundary.execution_allowed, false);
  assert.equal(payload.boundary.live_execution_performed, false);
  assert.equal(payload.stream.event_count, 3);
  assert.equal(payload.stream.terminal_seq, 3);
  assert.match(payload.stream.stream_hash, /^sha256:[0-9a-f]{64}$/);
});

test("verify accepts a freshly built payload", () => {
  const payload = buildNode0SseEnvelopeStreamPayload(FIXTURE_INPUT);
  const v = verifyNode0SseEnvelopeStream(payload);
  assert.equal(v.ok, true, JSON.stringify(v.blocked_by));
  assert.equal(v.event_count, 3);
});

test("verify rejects a tampered content_hash", () => {
  const payload = buildNode0SseEnvelopeStreamPayload(FIXTURE_INPUT);
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  assert.equal(verifyNode0SseEnvelopeStream(tampered).ok, false);
});

test("verify rejects a field change that did not update the content_hash", () => {
  // NOTE the harder launder this scaffold does NOT yet defend against: changing
  // a field AND recomputing the hash so the body is self-consistent. Internal
  // consistency alone cannot catch that — you need an INDEPENDENT anchor.
  const payload = buildNode0SseEnvelopeStreamPayload(FIXTURE_INPUT);
  const forged = { ...payload, truth_label: "FORGED" };
  assert.equal(verifyNode0SseEnvelopeStream(forged).ok, false);
});

test("review gate closes the loop: build -> verify -> tamper-reject", () => {
  const result = runNode0SseEnvelopeStreamCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, NODE0_SSE_ENVELOPE_STREAM_SCHEMA);
  assert.equal(result.truth_label, NODE0_SSE_ENVELOPE_STREAM_TRUTH_LABEL);
});

test("orchestrator boundary stays all-false (no execution authority)", () => {
  const result = runNode0SseEnvelopeStream({ consent: NODE0_SSE_ENVELOPE_STREAM_GO_PHRASE, input: FIXTURE_INPUT });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
  assert.equal(result.boundary.live_execution_performed, false);
});

// ── stream law: construction ────────────────────────────────────────────────

test("build derives seqs, chains hashes, and commits to the final event hash", () => {
  const s = buildSseStream({ streamId: FIXTURE_INPUT.stream_id, frames: FIXTURE_INPUT.frames });
  assert.deepEqual(s.events.map((e) => e.seq), [1, 2, 3]);
  assert.equal(s.events[0].previous_event_hash, null); // genesis binds nothing
  assert.equal(s.events[1].previous_event_hash, s.events[0].event_hash);
  assert.equal(s.events[2].previous_event_hash, s.events[1].event_hash);
  assert.equal(s.stream_hash, s.events[2].event_hash);
  assert.equal(s.terminal_seq, 3);
});

test("every event hash is reproducible from its own body minus the hash field", () => {
  const s = buildSseStream({ streamId: "x", frames: [{ kind: "heartbeat", payload: {} }, { kind: "stream_end", payload: {} }] });
  for (const ev of s.events) {
    const again = buildSseStreamEvent({
      streamId: ev.stream_id, seq: ev.seq, kind: ev.kind, payload: ev.payload, previousEventHash: ev.previous_event_hash,
    });
    assert.equal(again.event_hash, ev.event_hash); // determinism: same bytes -> same address
  }
});

// ── stream law: verification refusals (each near-miss is named) ─────────────

function eventsFrom(frames) {
  return buildSseStream({ streamId: FIXTURE_INPUT.stream_id, frames }).events;
}
const HAPPY = eventsFrom(FIXTURE_INPUT.frames);

test("gap detection: dropping an interior event breaks seq AND chain linkage", () => {
  const gapped = [HAPPY[0], HAPPY[2]];
  const v = verifySseStream(gapped);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.some((b) => b.includes("seq_gap_or_duplicate")));
  assert.ok(v.blocked_by.some((b) => b.includes("chain_break")));
});

test("tamper evidence: flipping one payload byte without rehashing is caught", () => {
  const mutated = HAPPY.map((e, i) =>
    i === 0 ? { ...e, payload: { ...e.payload, phase: "TAMPERED" } } : e,
  );
  const v = verifySseStream(mutated);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("event_1:event_hash_mismatch"));
});

test("post-terminal event is refused; missing terminal is refused", () => {
  const after = [...HAPPY, { ...HAPPY[1], seq: 4, previous_event_hash: HAPPY[2].event_hash }];
  // note: the appended event keeps valid chain linkage — it must STILL be refused
  const vAfter = verifySseStream(after);
  assert.equal(vAfter.ok, false);
  assert.ok(vAfter.blocked_by.includes("event_4:after_terminal"));

  const noEnd = HAPPY.slice(0, 2);
  const vNoEnd = verifySseStream(noEnd);
  assert.equal(vNoEnd.ok, false);
  assert.ok(vNoEnd.blocked_by.includes("terminal_missing"));
});

test("unknown event kind is refused, not tolerated", () => {
  const weird = HAPPY.map((e, i) => (i === 1 ? { ...e, kind: "tick" } : e));
  const v = verifySseStream(weird);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("event_2:event_kind_unknown"));
  assert.ok(v.blocked_by.includes("event_2:event_hash_mismatch"));
});

test("heartbeat carrying application state is refused", () => {
  const heavy = buildSseStream({
    streamId: FIXTURE_INPUT.stream_id,
    frames: [...FIXTURE_INPUT.frames],
  });
  // construct directly to bypass builder refusal — the VERIFIER owns this law
  const smuggled = [
    { ...heavy.events[0] },
    { ...heavy.events[1], payload: { keepalive_hint: "x" } },
    { ...heavy.events[2] },
  ];
  const v = verifySseStream(smuggled);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("event_2:heartbeat_carries_state"));
});

test("empty and non-array inputs refuse cleanly", () => {
  assert.equal(verifySseStream([]).blocked_by.includes("events_empty"), true);
  assert.equal(verifySseStream(null).blocked_by.includes("events_empty"), true);
});

// ── SSE wire layer: serialization round-trip ────────────────────────────────

test("serialize -> parse round-trips envelopes byte-semantically", () => {
  const wire = serializeSseFrames(HAPPY);
  assert.match(wire, /^event: state\nid: 1\ndata: \{/);
  assert.ok(wire.endsWith("\n\n") || wire.includes("\n\n"));

  const parsed = parseSseFrames(wire);
  assert.equal(parsed.ok, true, parsed.blocked_by?.join(", "));
  assert.deepEqual(parsed.events, HAPPY);

  // and the round-tripped stream still verifies — reconnecting clients can re-prove order+integrity
  assert.equal(verifySseStream(parsed.events).ok, true);
});

test("wire parser refuses incomplete and mismatched frames", () => {
  const partial = "event: state\nid: 1\n"; // no data line, no terminator blank
  const r1 = parseSseFrames(partial);
  assert.equal(r1.ok, false);
  assert.ok(r1.blocked_by.some((b) => b.startsWith("frame_1:")));

  const wire = serializeSseFrames(HAPPY);
  const lied = wire.replace("id: 2", "id: 9");
  const r2 = parseSseFrames(lied);
  assert.equal(r2.ok, false);
  assert.ok(r2.blocked_by.includes("frame_2:id_seq_mismatch"));
});
