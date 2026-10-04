import test from "node:test";
import assert from "node:assert/strict";

import {
  planDrsPresenceReducer,
  buildDrsPresenceReducerPayload,
  verifyDrsPresenceReducer,
  runDrsPresenceReducer,
  deriveRenderRequest,
  sanitizeMissionLabel,
  accessibleLabelKeyFor,
  shortReasonKeyFor,
  SKIN_SEMANTIC_SLOTS,
  SEMANTIC_STATES,
  RENDER_REQUEST_SCHEMA,
  DRS_PRESENCE_REDUCER_SCHEMA,
  DRS_PRESENCE_REDUCER_TRUTH_LABEL,
  DRS_PRESENCE_REDUCER_GO_PHRASE,
} from "../packages/core/src/drs-presence-reducer.js";
import { realmEventDigest } from "../packages/core/src/drs-realm-contracts.js";
import { runDrsPresenceReducerCheck } from "../scripts/review/drs-presence-reducer-check.mjs";

const HEX64 = (ch) => ch.repeat(64);
const TS = "2026-08-25T07:44:10.000Z";

// ---------------------------------------------------------------------------
// Fixtures (wire-law-legal by construction; every digest derived, never pasted)
// ---------------------------------------------------------------------------

function makePeer() {
  return { uid: 1000, pid: 12345 };
}
function makeAdmitted() {
  return {
    component: "node0.realm_projection",
    revision: `sha256:${HEX64("a")}`,
    contracts_digest: `sha256:${HEX64("b")}`,
    uid: 1000,
  };
}
function makeSource(session_id = "source-session-77") {
  return {
    component: "node0.realm_projection",
    revision: `sha256:${HEX64("a")}`,
    pid: 12345,
    session_id,
  };
}
function makeHello() {
  return {
    schema: "bizra.realm.hello.v0.1",
    source: makeSource(),
    contracts_digest: `sha256:${HEX64("b")}`,
    authority_delta: 0,
  };
}
function baseSnapshot(state = "IDLE") {
  return {
    schema: "bizra.realm.resync.v0.1",
    source: makeSource(),
    sequence_anchor: 1841,
    current_event_digest: `sha256:${HEX64("1")}`,
    issued_at: TS,
    current_snapshot: { semantic_state: state, authority_delta: 0, reason_codes: [] },
    authority_delta: 0,
  };
}

let seq = 1841;
let last_digest = null;

// Build one event correctly signed against the current chain head.
function signedEvent({
  state = undefined,
  kind = "presence.state_changed",
  extra = {},
  reason_codes = [],
  evidence_refs = null,
  ttl_ms = 2500,
  at_ms = undefined,
} = {}) {
  const ev = {
    schema: "bizra.realm.event.v0.1",
    event_id: `evt-${++seq}`,
    sequence: seq,
    issued_at: TS,
    ttl_ms,
    source: makeSource(),
    kind,
    authority_delta: 0,
    reason_codes,
    payload: extra,
    prev_event_digest: last_digest ?? `sha256:${HEX64("1")}`,
    ...(at_ms !== undefined ? { __now_ms__: at_ms } : {}),
  };
  if (state !== undefined) ev.semantic_state = state;
  if (evidence_refs !== null) ev.evidence_refs = evidence_refs;
  const { event_digest, ...body } = ev;
  ev.event_digest = realmEventDigest(body);
  last_digest = ev.event_digest;
  return ev;
}

function missionExtras() {
  return { mission: { mission_id: "mission-001", label: "Node0 qualification", phase: "VERIFY" } };
}

// HELLO -> snapshot IDLE -> THINKING -> WORKING -> VERIFYING -> VERIFIED_DONE.
function goldenTranscript() {
  seq = 1841;
  last_digest = null;
  const snap = baseSnapshot();
  last_digest = snap.current_event_digest;
  return [
    makeHello(),
    snap,
    signedEvent({ state: "THINKING", extra: missionExtras(), at_ms: 1000 }),
    signedEvent({ state: "WORKING", extra: missionExtras(), at_ms: 2000 }),
    signedEvent({ state: "VERIFYING", reason_codes: ["SAT_ACTIVE"], extra: missionExtras(), at_ms: 3000 }),
    signedEvent({
      state: "VERIFIED_DONE",
      extra: missionExtras(),
      evidence_refs: ["receipt:sha256:f25acaed"],
      at_ms: 4000,
    }),
  ];
}

// HELLO -> snapshot -> exactly one signed event.
function singleEventTranscript(evOpts, snapshotState = "IDLE") {
  seq = 1841;
  last_digest = null;
  const snap = baseSnapshot(snapshotState);
  last_digest = snap.current_event_digest;
  return [makeHello(), snap, signedEvent(evOpts)];
}

test("skin-slot table covers all 11 semantic states", () => {
  for (const s of SEMANTIC_STATES) {
    assert.ok(SKIN_SEMANTIC_SLOTS[s], `missing slot for ${s}`);
  }
  assert.equal(Object.keys(SKIN_SEMANTIC_SLOTS).length, 11);
});

test("i18n key grammar is pinned", () => {
  assert.equal(accessibleLabelKeyFor("VERIFIED_DONE"), "presence.state.VERIFIED_DONE");
  assert.equal(shortReasonKeyFor("SAT_ACTIVE"), "reason.SAT_ACTIVE");
  assert.equal(shortReasonKeyFor(null), null);
});

test("mission label sanitization: newlines removed, hard-capped at 120 scalars", () => {
  assert.equal(sanitizeMissionLabel("line1\nline2\tX"), "line1 line2 X");
  assert.equal(sanitizeMissionLabel("ع".repeat(200)).length, 120);
  assert.equal(sanitizeMissionLabel(""), null);
  assert.equal(sanitizeMissionLabel(42), null);
});

// ---------------------------------------------------------------------------
// Universal slice contract
// ---------------------------------------------------------------------------

test("plan is fail-closed without exact consent or with malformed input", () => {
  const noConsent = planDrsPresenceReducer({ consent: "wrong", input: {} });
  assert.equal(noConsent.eligible, false);
  assert.ok(noConsent.blocked_by.includes("consent_phrase_mismatch"));

  const badInput = planDrsPresenceReducer({
    consent: DRS_PRESENCE_REDUCER_GO_PHRASE,
    input: { transcript: 9, now_ms: -5 },
  });
  assert.equal(badInput.eligible, false);
  assert.ok(badInput.blocked_by.includes("input_transcript_not_array"));
  assert.ok(badInput.blocked_by.includes("input_now_ms_invalid"));
});

test("payload is content-addressed with an all-false boundary", () => {
  const payload = buildDrsPresenceReducerPayload({ transcript: [] });
  assert.equal(payload.schema, DRS_PRESENCE_REDUCER_SCHEMA);
  assert.equal(payload.truth_label, DRS_PRESENCE_REDUCER_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.boundary.execution_allowed, false);
  assert.equal(payload.render_request.schema, RENDER_REQUEST_SCHEMA);
});

test("verify accepts fresh payload; rejects hash tamper, field forge, render-schema swap", () => {
  const payload = buildDrsPresenceReducerPayload({ transcript: [] });
  assert.equal(verifyDrsPresenceReducer(payload).ok, true);
  assert.equal(
    verifyDrsPresenceReducer({ ...payload, content_hash: `sha256:${"0".repeat(64)}` }).ok,
    false,
  );
  assert.equal(verifyDrsPresenceReducer({ ...payload, truth_label: "FORGED" }).ok, false);
  assert.equal(
    verifyDrsPresenceReducer({
      ...payload,
      render_request: { ...payload.render_request, schema: "x" },
    }).ok,
    false,
  );
});

// ---------------------------------------------------------------------------
// Derivation laws
// ---------------------------------------------------------------------------

test("G-02 end-to-end: golden transcript reduces to VERIFIED_DONE with evidence + slot", () => {
  const d = deriveRenderRequest({
    transcript: goldenTranscript(),
    admission: makeAdmitted(),
    peer: makePeer(),
    now_ms: 4500,
  });
  assert.equal(d.ok, true, d.blocked_by.join(", "));
  assert.equal(d.render_request.semantic_state, "VERIFIED_DONE");
  assert.equal(d.render_request.skin_slot, "VerifiedCompletion");
  assert.deepEqual([...d.render_request.evidence_refs], ["receipt:sha256:f25acaed"]);
  assert.equal(d.render_request.freshness, "Fresh");
  assert.equal(d.render_request.mission_label, "Node0 qualification");
  assert.equal(d.render_request.mission_phase, "VERIFY");
  assert.equal(d.render_request.simulated, false);
  assert.equal(d.render_request.accessible_label_key, "presence.state.VERIFIED_DONE");
});

test("no stale success: WORKING past TTL renders UNKNOWN; freshness reads Stale", () => {
  const d = deriveRenderRequest({
    transcript: singleEventTranscript({ state: "WORKING", extra: missionExtras(), at_ms: 1000 }),
    admission: makeAdmitted(),
    peer: makePeer(),
    now_ms: 1000 + 2501,
  });
  assert.equal(d.render_request.freshness, "Stale");
  assert.equal(d.render_request.semantic_state, "UNKNOWN");
  assert.equal(d.render_request.skin_slot, "Unknown");
});

test("refused transcript can only render UNKNOWN, never a familiar state", () => {
  // stale signature: body mutated after signing via ttl override
  const t = singleEventTranscript({ state: "WORKING", extra: missionExtras() });
  const bad = { ...t[2], ttl_ms: 999999 }; // digest no longer matches body
  const d = deriveRenderRequest({
    transcript: [t[0], t[1], bad],
    admission: makeAdmitted(),
    peer: makePeer(),
  });
  assert.equal(d.ok, false);
  assert.ok(d.blocked_by.some((b) => b.includes("DIGEST_MISMATCH")));
  assert.equal(d.render_request.semantic_state, "UNKNOWN");
});

test("resources sampled values pass through; unavailable stays null (never zero)", () => {
  const d = deriveRenderRequest({
    transcript: singleEventTranscript({
      state: undefined,
      kind: "resources.sampled",
      extra: { resources: { cpu_percent: 12.5, gpu_percent: null, ram_percent: 250 } },
      at_ms: 100,
    }),
    admission: makeAdmitted(),
    peer: makePeer(),
    now_ms: 200,
  });
  assert.equal(d.render_request.resources.cpu_percent, 12.5);
  assert.equal(d.render_request.resources.gpu_percent, null); // None, not zero
  assert.equal(d.render_request.resources.ram_percent, null); // out-of-range refused
});

test("attention count survives into NEEDS_HUMAN rendering", () => {
  const d = deriveRenderRequest({
    transcript: singleEventTranscript({
      state: "NEEDS_HUMAN",
      extra: { attention: { count: 3 }, mission: missionExtras().mission },
      at_ms: 100,
    }),
    admission: makeAdmitted(),
    peer: makePeer(),
    now_ms: 200,
  });
  assert.equal(d.render_request.semantic_state, "NEEDS_HUMAN");
  assert.equal(d.render_request.attention_count, 3);
  assert.equal(d.render_request.skin_slot, "HumanAttention");
});

test("heartbeat-only stream after IDLE snapshot keeps IDLE fresh", () => {
  const d = deriveRenderRequest({
    transcript: singleEventTranscript({ state: undefined, kind: "heartbeat", at_ms: 500 }),
    admission: makeAdmitted(),
    peer: makePeer(),
    now_ms: 900,
  });
  assert.equal(d.render_request.semantic_state, "IDLE");
  assert.equal(d.render_request.freshness, "Fresh");
});

// ---------------------------------------------------------------------------
// Orchestrator + review gate
// ---------------------------------------------------------------------------

test("orchestrator returns ok envelope on the golden transcript; boundary all-false", () => {
  const r = runDrsPresenceReducer({
    consent: DRS_PRESENCE_REDUCER_GO_PHRASE,
    input: {
      transcript: goldenTranscript(),
      admission: makeAdmitted(),
      peer: makePeer(),
      now_ms: 4500,
    },
  });
  assert.equal(r.ok, true, r.blocked_by.join(", "));
  assert.equal(r.render_request.semantic_state, "VERIFIED_DONE");
  assert.equal(r.boundary.execution_allowed, false);
  assert.equal(r.boundary.live_execution_performed, false);
});

test("orchestrator fails closed on a dishonest transcript", () => {
  const t = singleEventTranscript({ state: "WORKING", extra: missionExtras() });
  const bad = { ...t[2], ttl_ms: 42 };
  const r = runDrsPresenceReducer({
    consent: DRS_PRESENCE_REDUCER_GO_PHRASE,
    input: { transcript: [t[0], t[1], bad], admission: makeAdmitted(), peer: makePeer() },
  });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.length > 0);
});

test("review gate closes the loop over the golden fixture", () => {
  const result = runDrsPresenceReducerCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, DRS_PRESENCE_REDUCER_SCHEMA);
  assert.equal(result.truth_label, DRS_PRESENCE_REDUCER_TRUTH_LABEL);
  assert.equal(result.render_request?.semantic_state, "VERIFIED_DONE");
});
