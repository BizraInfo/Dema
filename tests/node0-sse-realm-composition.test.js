import test from "node:test";
import assert from "node:assert/strict";

import {
  consumeSseRealmComposition,
  runNode0RealmSseComposition,
  NODE0_REALM_SSE_COMPOSITION_GO_PHRASE,
  NODE0_REALM_SSE_COMPOSITION_SCHEMA,
} from "../packages/core/src/node0-sse-realm-composition.js";

import {
  buildSseStream,
  serializeSseFrames,
} from "../packages/core/src/node0-sse-envelope-stream.js";

import {
  buildFixtureTranscript,
} from "../packages/core/src/drs-fixture-publisher.js";

const HEX64 = (ch) => ch.repeat(64);
const NOW_MS = Date.parse("2026-08-25T12:00:00.000Z") + 500;

function makeAdmitted() {
  return {
    component: "node0.realm_projection.fixture",
    revision: `sha256:${HEX64("f")}`,
    contracts_digest: `sha256:${HEX64("d")}`,
    uid: 1000,
  };
}
const ADMITTED = makeAdmitted();
const PEER = { uid: 1000, pid: 1 };
const HASH = (o) => {
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(JSON.stringify(o))) {
    h ^= b; h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fnv1a:${h.toString(16).padStart(8, "0")}`;
};
const CONSUME = (sse_text) =>
  consumeSseRealmComposition({ sse_text, admitted: ADMITTED, peer: PEER, now_ms: NOW_MS, hash: HASH });

function sseFromFrames(frames, streamId = "node0.realm_projection.fixture.sse") {
  const stream = buildSseStream({
    streamId,
    frames: [
      ...frames.map((payload) => ({ kind: "state", payload })),
      { kind: "stream_end", payload: {} },
    ],
  });
  return { text: serializeSseFrames(stream.events), events: stream.events };
}

function goldenSse() {
  const fixture = buildFixtureTranscript({ scenario: "mission_work", admitted: ADMITTED, peer: PEER });
  assert.equal(fixture.ok, true);
  return sseFromFrames(fixture.transcript);
}

// ── the join law ─────────────────────────────────────────────────────────────

test("NSC-01 happy path: one transcript rides SSE end-to-end to VERIFIED_DONE + render", () => {
  const r = CONSUME(goldenSse().text);
  assert.equal(r.ok, true, r.blocked_by.join(","));
  assert.equal(r.layers.sse_chain, "VERIFIED");
  assert.equal(r.visible_state, "VERIFIED_DONE");
  assert.equal(r.render && r.render.semantic_state, "VERIFIED_DONE");
  // simulation survives the whole pipe — a fixture can NEVER render as truth
  assert.equal(r.simulated, true);
});

test("NSC-02 seq gap in the stream renders UNKNOWN with a named sse-chain block", () => {
  const { text } = goldenSse();
  // drop the third SSE frame's data line content by rebuilding without one event:
  const blocks = text.split("\n\n").filter(Boolean);
  blocks.splice(2, 1); // remove one middle frame -> seq gap at parse level
  const r = CONSUME(blocks.join("\n\n") + "\n\n");
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.some((b) => b.startsWith("sse:") || b.startsWith("sse-chain:")), r.blocked_by);
  assert.equal(r.visible_state, "UNKNOWN");
});

test("NSC-03 tampered realm body keeps its stored digest mismatch through the pipe", () => {
  const { events } = goldenSse();
  const victim = JSON.parse(JSON.stringify(events[3]));
  victim.payload.ttl_ms = 999999; // body edited WITHOUT re-deriving realm digest
  const text = serializeSseStreamEvents([events[0], events[1], events[2], victim, ...events.slice(4)]);
  const r = CONSUME(text);
  assert.equal(r.visible_state, "UNKNOWN");
  assert.ok(
    r.blocked_by.some((b) => b.includes("DIGEST_MISMATCH") || b.startsWith("sse-chain:")),
    r.blocked_by,
  );
});

test("NSC-04 oversize realm payload refuses FRAME_OVERSIZE at the join", () => {
  const big = { schema: "bizra.realm.event.v0.1", pad: "p".repeat(33000) };
  const { text } = sseFromFrames([big]);
  const r = CONSUME(text);
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("frame:FRAME_OVERSIZE"), r.blocked_by);
  assert.equal(r.visible_state, "UNKNOWN");
});

test("NSC-05 JOIN CEILING: a non-object realm payload cannot reach the frame layer — the chain refuses it first", () => {
  // With honest transport hashes, FRAME_JSON_INVALID is unreachable through
  // this composition: anything that survives verifySseStream has an object
  // payload by law. The code stays for direct-bytes consumers (Rust .04 will
  // reuse the same export on raw socket bytes, where it is reachable).
  const stream = buildSseStream({
    streamId: "s.nsc5",
    frames: [{ kind: "state", payload: { schema: "x" } }],
  });
  // corrupt the payload into a non-JSON realm frame while keeping SSE parseable:
  const ev = JSON.parse(JSON.stringify(stream.events[0]));
  ev.payload = "not-an-object";
  const text = serializeSseStreamEvents([ev]);
  const r = CONSUME(text);
  assert.equal(r.ok, false);
  assert.ok(
    r.blocked_by.some((b) => b.startsWith("sse-chain:")),
    `the CHAIN layer must own this refusal: ${r.blocked_by}`,
  );
  assert.ok(!r.blocked_by.some((b) => b.startsWith("frame:")), "frame layer must not run past a broken chain");
  assert.equal(r.layers.realm_projection, "NOT_REACHED");
  assert.equal(r.visible_state, "UNKNOWN");
});

test("NSC-06 heartbeat purity: liveness-only stream yields UNKNOWN/OFFLINE render, no state", () => {
  const stream = buildSseStream({
    streamId: "s.nsc6",
    frames: [{ kind: "heartbeat", payload: {} }, { kind: "stream_end", payload: {} }],
  });
  const r = CONSUME(serializeSseFrames(stream.events));
  assert.ok(["UNKNOWN", "OFFLINE"].includes(r.render?.visible_state ?? "UNKNOWN"));
  assert.notEqual(r.visible_state, "VERIFIED_DONE");
});

test("NSC-07 exactly-one-terminal: post-terminal frames are refused at the chain layer", () => {
  const fixture = buildFixtureTranscript({ scenario: "mission_work", admitted: ADMITTED, peer: PEER });
  const stream = buildSseStream({
    streamId: "s.nsc7",
    frames: [...fixture.transcript.map((payload) => ({ kind: "state", payload })), { kind: "stream_end", payload: {} }, { kind: "state", payload: { schema: "bizra.realm.event.v0.1" } }],
  });
  const r = CONSUME(serializeSseFrames(stream.events));
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.some((b) => b.startsWith("sse-chain:")), r.blocked_by);
});

test("NSC-08 orchestrator: consent gate + tamper probe close the loop", () => {
  const fixture = buildFixtureTranscript({ scenario: "mission_work", admitted: ADMITTED, peer: PEER });
  const { text } = sseFromFrames(fixture.transcript);
  const out = runNode0RealmSseComposition({
    consent: NODE0_REALM_SSE_COMPOSITION_GO_PHRASE,
    input: { sse_text: text, admitted: ADMITTED, peer: PEER, now_ms: NOW_MS },
  });
  assert.equal(out.ok, true, JSON.stringify(out.blocked_by));
  assert.equal(out.schema, NODE0_REALM_SSE_COMPOSITION_SCHEMA);
  assert.equal(out.boundary.execution_allowed, false);
  assert.equal(out.boundary.mint_allowed, false);
  // tamper probe already ran inside; re-verify determinism
  const out2 = runNode0RealmSseComposition({
    consent: NODE0_REALM_SSE_COMPOSITION_GO_PHRASE,
    input: { sse_text: text, admitted: ADMITTED, peer: PEER, now_ms: NOW_MS },
  });
  assert.equal(out.content_hash, out2.content_hash, "content-addressed and deterministic");
});

test("NSC-09 consent gate is exact-string: wrong phrase halts before any layer runs", () => {
  const { text } = goldenSse();
  const out = runNode0RealmSseComposition({
    consent: "GO: something else entirely",
    input: { sse_text: text, admitted: ADMITTED, peer: PEER, now_ms: NOW_MS },
  });
  assert.equal(out.ok, false);
  assert.deepEqual(out.blocked_by, ["HALTED_FATE"]);
});

test("NSC-10 MUTATION CONTROL: flipping one byte in the wire text changes the envelope hash", () => {
  const good = CONSUME(goldenSse().text);
  const base = goldenSse().text;
  const badText = base.slice(0, -2) + "x\n\n"; // corrupt the tail block
  const bad = CONSUME(badText);
  assert.notEqual(good.content_hash, bad.content_hash);
});

// helper: rebuild serialized SSE text from edited event objects (hashes intact)
function serializeSseStreamEvents(events) {
  return serializeSseFrames(events);
}
