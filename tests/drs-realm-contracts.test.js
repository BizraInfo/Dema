import test from "node:test";
import assert from "node:assert/strict";

import {
  planDrsRealmContracts,
  buildDrsRealmContractsPayload,
  verifyDrsRealmContracts,
  runDrsRealmContracts,
  admitHello,
  validateResyncSnapshot,
  validateRealmEvent,
  realmEventDigest,
  createProjectionSession,
  applyFrame,
  runRealmTranscript,
  classifyFreshness,
  degradedVisibleState,
  REALM_PROTOCOL,
  REALM_HELLO_SCHEMA,
  REALM_RESYNC_SCHEMA,
  REALM_EVENT_SCHEMA,
  SEMANTIC_STATES,
  REASON_CODES,
  DRS_REALM_CONTRACTS_SCHEMA,
  DRS_REALM_CONTRACTS_TRUTH_LABEL,
  DRS_REALM_CONTRACTS_GO_PHRASE,
} from "../packages/core/src/drs-realm-contracts.js";
import { runDrsRealmContractsCheck } from "../scripts/review/drs-realm-contracts-check.mjs";

const HEX64 = (ch) => ch.repeat(64);
const TS = "2026-08-25T07:44:10.000Z";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePeer() {
  return Object.freeze({ uid: 1000, pid: 12345 });
}

function makeAdmitted() {
  return Object.freeze({
    component: "node0.realm_projection",
    revision: `sha256:${HEX64("a")}`,
    contracts_digest: `sha256:${HEX64("b")}`,
    uid: 1000,
  });
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
    schema: REALM_HELLO_SCHEMA,
    source: makeSource(),
    contracts_digest: `sha256:${HEX64("b")}`,
    authority_delta: 0,
  };
}

function baseSnapshot() {
  return {
    schema: REALM_RESYNC_SCHEMA,
    source: makeSource(),
    sequence_anchor: 1841,
    current_event_digest: `sha256:${HEX64("1")}`,
    issued_at: TS,
    current_snapshot: {
      semantic_state: "IDLE",
      authority_delta: 0,
      reason_codes: [],
    },
    authority_delta: 0,
  };
}

let seq_counter = 1841;
let digest_counter = 2;
function makeEvent({
  state = "IDLE",
  kind = "presence.state_changed",
  session_id = "source-session-77",
  prev = `sha256:${HEX64("1")}`,
  sequence = ++seq_counter,
  sign = true,
} = {}) {
  const event = {
    schema: REALM_EVENT_SCHEMA,
    event_id: `evt-${String(sequence).padStart(4, "0")}`,
    sequence,
    issued_at: TS,
    ttl_ms: 2500,
    source: makeSource(session_id),
    kind,
    authority_delta: 0,
    reason_codes: [],
    payload: {},
    prev_event_digest: prev,
  };
  if (state !== undefined) event.semantic_state = state;
  if (sign) event.event_digest = realmEventDigest(event);
  return event;
}

function missionEvent(state, extras = {}, opts = {}) {
  const event = makeEvent({ state, ...opts });
  event.payload = {
    mission: { mission_id: "mission-001", label: "Node0 qualification", phase: "VERIFY" },
    ...extras,
  };
  if (state === "VERIFYING") {
    event.reason_codes = ["SAT_ACTIVE"];
  }
  event.event_digest = realmEventDigest(event);
  return event;
}

function doneTranscriptEvent() {
  const ev = missionEvent("VERIFIED_DONE");
  ev.evidence_refs = ["receipt:sha256:f25acaed"];
  ev.event_digest = realmEventDigest(ev);
  return ev;
}

function validTranscript() {
  seq_counter = 1841;
  digest_counter = 2;
  const hello = makeHello();
  const snap = baseSnapshot();
  let last = snap.current_event_digest;
  const events = [];
  for (const state of ["THINKING", "WORKING", "VERIFYING"]) {
    const ev = missionEvent(state);
    ev.prev_event_digest = last;
    ev.event_digest = realmEventDigest(ev);
    events.push(ev);
    last = ev.event_digest;
  }
  const done = doneTranscriptEvent();
  done.prev_event_digest = last;
  done.event_digest = realmEventDigest(done);
  events.push(done);
  return [hello, snap, ...events];
}

// Hello frame carrying its injected admission envelope, for direct FSM tests.
function helloFrame() {
  const hello = makeHello();
  return { ...hello, __admission__: { hello, peer: makePeer(), admitted: makeAdmitted() } };
}

test("protocol constants are frozen and match the ICD", () => {
  assert.equal(REALM_PROTOCOL.transport, "AF_UNIX");
  assert.equal(REALM_PROTOCOL.framing, "U32_BE_LENGTH_PREFIX");
  assert.equal(REALM_PROTOCOL.max_frame_bytes, 32768);
  assert.equal(REALM_PROTOCOL.socket_mode, "0600");
  assert.equal(REALM_PROTOCOL.heartbeat_interval_ms, 1000);
  assert.equal(REALM_PROTOCOL.default_ttl_ms, 2500);
  assert.equal(SEMANTIC_STATES.length, 11);
  for (const set of [SEMANTIC_STATES, REASON_CODES]) {
    assert.equal(Object.isFrozen(set), true);
  }
});

// ---------------------------------------------------------------------------
// Universal slice contract
// ---------------------------------------------------------------------------

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planDrsRealmContracts({ consent: "wrong", input: {} });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan refuses malformed input shape even with exact consent", () => {
  const bad = planDrsRealmContracts({
    consent: DRS_REALM_CONTRACTS_GO_PHRASE,
    input: { transcript: "nope" },
  });
  assert.equal(bad.eligible, false);
  assert.ok(bad.blocked_by.includes("input_transcript_not_array"));

  const good = planDrsRealmContracts({
    consent: DRS_REALM_CONTRACTS_GO_PHRASE,
    input: { transcript: [], admitted: makeAdmitted(), peer: makePeer() },
  });
  assert.equal(good.eligible, true, good.blocked_by.join(", "));
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildDrsRealmContractsPayload({ transcript: [] });
  assert.equal(payload.schema, DRS_REALM_CONTRACTS_SCHEMA);
  assert.equal(payload.truth_label, DRS_REALM_CONTRACTS_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.boundary.execution_allowed, false);
  assert.equal(payload.boundary.live_execution_performed, false);
});

test("verify accepts a freshly built payload", () => {
  const payload = buildDrsRealmContractsPayload({ transcript: [] });
  assert.equal(verifyDrsRealmContracts(payload).ok, true);
});

test("verify rejects a tampered content_hash", () => {
  const payload = buildDrsRealmContractsPayload({ transcript: [] });
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  assert.equal(verifyDrsRealmContracts(tampered).ok, false);
});

test("verify rejects a field change that did not update the content_hash", () => {
  const payload = buildDrsRealmContractsPayload({ transcript: [] });
  const forged = { ...payload, truth_label: "FORGED" };
  assert.equal(verifyDrsRealmContracts(forged).ok, false);
});

test("review gate closes the loop: build -> verify -> tamper-reject over a golden transcript", () => {
  const result = runDrsRealmContractsCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, DRS_REALM_CONTRACTS_SCHEMA);
  assert.equal(result.truth_label, DRS_REALM_CONTRACTS_TRUTH_LABEL);
  assert.equal(result.walk.visible_state, "VERIFIED_DONE");
});

test("orchestrator boundary stays all-false (no execution authority)", () => {
  const result = runDrsRealmContracts({
    consent: DRS_REALM_CONTRACTS_GO_PHRASE,
    input: { transcript: [] },
  });
  assert.equal(result.ok, true, result.blocked_by.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
  assert.equal(result.boundary.live_execution_performed, false);
});

test("orchestrator reports wire-law blocks instead of passing silently", () => {
  const frames = validTranscript();
  frames[2].semantic_state = "REFUSED"; // no refusal reason codes -> invalid
  frames[2].event_digest = realmEventDigest(
    (({ event_digest, ...body }) => body)(frames[2]),
  );
  // keep the chain consistent so the ONLY failure is the state constraint
  for (let i = 3; i < frames.length; i++) {
    frames[i].prev_event_digest = frames[i - 1].event_digest ?? frames[i - 1].current_event_digest;
    if (frames[i].event_digest) frames[i].event_digest = realmEventDigest(frames[i]);
  }
  const result = runDrsRealmContracts({
    consent: DRS_REALM_CONTRACTS_GO_PHRASE,
    input: { transcript: frames, admitted: makeAdmitted(), peer: makePeer() },
  });
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.some((b) => b.includes("SCHEMA_INVALID")), result.blocked_by.join(", "));
});

// ---------------------------------------------------------------------------
// IF-01 admission conformance (C01..C06, C18, cross-user)
// ---------------------------------------------------------------------------

function admissionVerdict(overrides = {}) {
  return admitHello({
    hello: overrides.hello ?? makeHello(),
    peer: overrides.peer ?? makePeer(),
    admitted: overrides.admitted ?? makeAdmitted(),
  });
}

test("C01: valid HELLO is admitted", () => {
  const v = admissionVerdict();
  assert.equal(v.ok, true, v.reason_code);
  assert.equal(v.session_id, "source-session-77");
});

test("C02: wrong UID (cross-user) is refused SOURCE_UNADMITTED", () => {
  const v = admissionVerdict({ peer: { uid: 1337, pid: 12345 } });
  assert.equal(v.ok, false);
  assert.equal(v.reason_code, "SOURCE_UNADMITTED");
});

test("C03: peer PID != payload PID is refused SOURCE_PID_MISMATCH", () => {
  const v = admissionVerdict({ peer: { uid: 1000, pid: 999 } });
  assert.equal(v.ok, false);
  assert.equal(v.reason_code, "SOURCE_PID_MISMATCH");
});

test("C04: wrong source revision is refused SOURCE_REVISION_MISMATCH", () => {
  const hello = makeHello();
  hello.source.revision = `sha256:${HEX64("f")}`;
  const v = admissionVerdict({ hello });
  assert.equal(v.ok, false);
  assert.equal(v.reason_code, "SOURCE_REVISION_MISMATCH");
});

test("C05: wrong contracts digest is refused CONTRACTS_DIGEST_MISMATCH", () => {
  const hello = makeHello();
  hello.contracts_digest = `sha256:${HEX64("c")}`;
  const v = admissionVerdict({ hello });
  assert.equal(v.ok, false);
  assert.equal(v.reason_code, "CONTRACTS_DIGEST_MISMATCH");
});

test("C06: nonzero authority_delta is refused AUTHORITY_DELTA_NONZERO", () => {
  const hello = makeHello();
  hello.authority_delta = 1;
  const v = admissionVerdict({ hello });
  assert.equal(v.ok, false);
  assert.equal(v.reason_code, "AUTHORITY_DELTA_NONZERO");
});

test("missing authority_delta refuses instead of defaulting to zero", () => {
  const hello = makeHello();
  delete hello.authority_delta;
  const v = admissionVerdict({ hello });
  assert.equal(v.ok, false);
  assert.equal(v.reason_code, "SCHEMA_INVALID");
});

test("unsupported schema major is refused SCHEMA_UNSUPPORTED", () => {
  const hello = makeHello();
  hello.schema = "bizra.realm.hello.v9.9";
  const v = admissionVerdict({ hello });
  assert.equal(v.ok, false);
  assert.equal(v.reason_code, "SCHEMA_UNSUPPORTED");
});

test("executable-digest requirement fails closed when identity cannot be established", () => {
  const admitted = { ...makeAdmitted(), require_executable_digest: true };
  const v = admissionVerdict({ admitted });
  assert.equal(v.ok, false);
  assert.equal(v.reason_code, "SOURCE_IDENTITY_UNKNOWN");

  const ok = admissionVerdict({
    admitted,
    peer: { uid: 1000, pid: 12345, exe_sha256: HEX64("e") },
  });
  assert.equal(ok.ok, true, ok.reason_code);
});

// ---------------------------------------------------------------------------
// Snapshot-before-stream FSM (C07, C08) + snapshot validation
// ---------------------------------------------------------------------------

test("C07: incremental before snapshot closes PROTOCOL_PHASE_VIOLATION", () => {
  let s = createProjectionSession();
  s = applyFrame(s, helloFrame()).session;
  const step = applyFrame(s, makeEvent());
  assert.equal(step.close, "PROTOCOL_PHASE_VIOLATION");
  assert.equal(step.session.phase, "CLOSED");
  assert.equal(step.session.visible_state, "UNKNOWN");
});

test("C08: valid HELLO then valid snapshot commits projection and enters STREAMING", () => {
  const walk = runRealmTranscript({
    transcript: [makeHello(), baseSnapshot()],
    admission: makeAdmitted(),
    peer: makePeer(),
  });
  assert.equal(walk.ok, true, walk.blocks.join(", "));
  assert.equal(walk.final_phase, "STREAMING");
  assert.equal(walk.visible_state, "IDLE");
});

test("snapshot bound to a different session is refused SOURCE_SESSION_CHANGED", () => {
  let s = applyFrame(createProjectionSession(), helloFrame()).session;
  const snap = baseSnapshot();
  snap.source.session_id = "other-session";
  const step = applyFrame(s, snap);
  assert.equal(step.close, "SOURCE_SESSION_CHANGED");
});

test("snapshot resources must be finite percents; unavailable is not zero", () => {
  const snap = baseSnapshot();
  snap.current_snapshot.resources = {
    cpu_percent: Number.NaN,
    gpu_percent: null,
    ram_percent: null,
    observed_at: TS,
  };
  const v = validateResyncSnapshot({ snapshot: snap, hello: null });
  assert.equal(v.ok, false);

  const okSnap = baseSnapshot();
  okSnap.current_snapshot.resources = {
    cpu_percent: null,
    gpu_percent: null,
    ram_percent: null,
    observed_at: TS,
  };
  assert.equal(validateResyncSnapshot({ snapshot: okSnap, hello: null }).ok, true);
});

test("snapshot semantic states carry their required constraints", () => {
  const verifying = baseSnapshot();
  verifying.current_snapshot.semantic_state = "VERIFYING";
  assert.equal(validateResyncSnapshot({ snapshot: verifying, hello: null }).ok, false);
  verifying.current_snapshot.reason_codes = ["SAT_ACTIVE"];
  assert.equal(validateResyncSnapshot({ snapshot: verifying, hello: null }).ok, true);

  const working = baseSnapshot();
  working.current_snapshot.semantic_state = "WORKING";
  assert.equal(validateResyncSnapshot({ snapshot: working, hello: null }).ok, false);
  working.current_snapshot.mission = { mission_id: "mission-001" };
  assert.equal(validateResyncSnapshot({ snapshot: working, hello: null }).ok, true);
});

// ---------------------------------------------------------------------------
// Incremental events: chain, sequence, duplicates, evidence (C09..C14, C19)
// ---------------------------------------------------------------------------

function streamingSession() {
  const walk = runRealmTranscript({
    transcript: [makeHello(), baseSnapshot()],
    admission: makeAdmitted(),
    peer: makePeer(),
  });
  assert.equal(walk.ok, true);
  let s = createProjectionSession();
  s = applyFrame(s, helloFrame()).session;
  s = applyFrame(s, baseSnapshot()).session;
  return s;
}

test("C09: valid next event is accepted and advances cursor + visible state", () => {
  const ev = missionEvent("WORKING", {}, { sequence: 1842 });
  const step = applyFrame(streamingSession(), ev);
  assert.equal(step.accepted, true);
  assert.equal(step.close, null);
  assert.equal(step.session.last_sequence, ev.sequence);
  assert.equal(step.session.last_event_digest, ev.event_digest);
  assert.equal(step.session.visible_state, "WORKING");
});

test("C10: duplicate sequence with identical digest is idempotently ignored", () => {
  const first = missionEvent("WORKING", {}, { sequence: 1842 });
  let s = applyFrame(streamingSession(), first).session;
  const replay = {
    ...JSON.parse(JSON.stringify(first)),
    event_digest: first.event_digest,
  };
  const step = applyFrame(s, replay);
  assert.equal(step.accepted, false);
  assert.equal(step.duplicate_ignored, true);
  assert.equal(step.close, null);
  assert.equal(step.session.duplicates_ignored, 1);
});

test("C11: duplicate sequence with different digest contradicts and closes", () => {
  const first = missionEvent("WORKING", {}, { sequence: 1842 });
  let s = applyFrame(streamingSession(), first).session;
  const forged = missionEvent("VERIFYING", {}, { sequence: 1842 });
  const step = applyFrame(s, forged);
  assert.equal(step.close, "DUPLICATE_CONTRADICTION");
});

test("C12: lower sequence is a rollback contradiction", () => {
  const e1 = missionEvent("WORKING", {}, { sequence: 1842 });
  let s = applyFrame(streamingSession(), e1).session;
  const older = missionEvent("THINKING", {}, { sequence: 1841 });
  older.prev_event_digest = e1.prev_event_digest;
  older.event_digest = realmEventDigest(older);
  const step = applyFrame(s, older);
  assert.equal(step.close, "SEQUENCE_ROLLBACK");
});

test("C13: skipped sequence is a gap and closes into resync-required UNKNOWN", () => {
  const ev = missionEvent("WORKING", {}, { sequence: 1847 });
  const step = applyFrame(streamingSession(), ev);
  assert.equal(step.close, "SEQUENCE_GAP");
  assert.equal(step.session.closed_reason, "SEQUENCE_GAP");
  assert.equal(step.session.visible_state, "UNKNOWN");
});

test("C14: broken digest chain is refused DIGEST_CHAIN_BROKEN", () => {
  const ev = missionEvent("WORKING", {}, { sequence: 1842 });
  ev.prev_event_digest = `sha256:${HEX64("9")}`;
  ev.event_digest = realmEventDigest(ev);
  const step = applyFrame(streamingSession(), ev);
  assert.equal(step.close, "DIGEST_CHAIN_BROKEN");
});

test("event digest binds the whole event body minus event_digest", () => {
  const ev = missionEvent("WORKING");
  const tampered = { ...ev, ttl_ms: ev.ttl_ms + 1 };
  assert.notEqual(realmEventDigest(tampered), ev.event_digest);
  assert.equal(realmEventDigest(ev), ev.event_digest);
});

test("C19: VERIFIED_DONE without mission binding or evidence ref is refused", () => {
  const bare = makeEvent({ state: "VERIFIED_DONE" });
  const v = validateRealmEvent(bare);
  assert.equal(v.ok, false);
  assert.equal(v.reason_code, "MISSION_BINDING_MISSING");

  const withMission = missionEvent("VERIFIED_DONE");
  assert.equal(validateRealmEvent(withMission).reason_code, "REQUIRED_EVIDENCE_REF_MISSING");

  const full = doneTranscriptEvent();
  assert.equal(validateRealmEvent(full).ok, true, validateRealmEvent(full).reason_code);
});

test("heartbeat carries no semantic state and keeps the previous visible state", () => {
  const hb = makeEvent({ state: undefined, kind: "heartbeat", sequence: 1842 });
  const v = validateRealmEvent(hb);
  assert.equal(v.ok, true, v.reason_code);
  const step = applyFrame(streamingSession(), hb);
  assert.equal(step.accepted, true);
  assert.equal(step.session.visible_state, "IDLE");
});

test("oversize/malformed fields are refused before display", () => {
  const big = makeEvent({});
  big.event_id = "x".repeat(129);
  assert.equal(validateRealmEvent(big).ok, false);

  const longLabel = makeEvent({});
  longLabel.payload = { mission: { mission_id: "m", label: "ع".repeat(121) } };
  assert.equal(validateRealmEvent(longLabel).ok, false);

  const badCode = makeEvent({});
  badCode.reason_codes = ["lowercase_not_allowed"];
  assert.equal(validateRealmEvent(badCode).ok, false);

  assert.equal(REASON_CODES.includes("SIMULATED_FIXTURE"), true);
  assert.equal(REALM_PROTOCOL.max_frame_bytes, 32768);
});

test("unknown event kinds are SCHEMA_UNSUPPORTED", () => {
  const ev = makeEvent({ kind: "avatar.dance_party" });
  assert.equal(validateRealmEvent(ev).ok, false);
  assert.equal(validateRealmEvent(ev).reason_code, "SCHEMA_UNSUPPORTED");
});

// ---------------------------------------------------------------------------
// Freshness / no stale success (C15) + reconnect (C20)
// ---------------------------------------------------------------------------

test("C15: freshness classes and stale-success degradation", () => {
  assert.equal(classifyFreshness({ connected: false, age_ms: 0 }), "Disconnected");
  assert.equal(classifyFreshness({ connected: true, age_ms: 500 }), "Fresh");
  assert.equal(classifyFreshness({ connected: true, age_ms: 1500 }), "Aging");
  assert.equal(classifyFreshness({ connected: true, age_ms: 2501 }), "Stale");
  assert.equal(degradedVisibleState("VERIFIED_DONE", "Stale"), "UNKNOWN");
  assert.equal(degradedVisibleState("VERIFIED_DONE", "Disconnected"), "OFFLINE");
  assert.equal(degradedVisibleState("VERIFIED_DONE", "Fresh"), "VERIFIED_DONE");
});

test("reconnect requires a fresh session: old cursor never continues (C20)", () => {
  // Old session dies; a NEW session object starts at HELLO_EXPECTED.
  const revived = createProjectionSession();
  assert.equal(revived.phase, "HELLO_EXPECTED");
  assert.equal(revived.visible_state, "OFFLINE");
  // An incremental event offered to the fresh session is a phase violation.
  const step = applyFrame(revived, makeEvent());
  assert.equal(step.close, "PROTOCOL_PHASE_VIOLATION");
});

// ---------------------------------------------------------------------------
// Golden scenarios G-01..G-05
// ---------------------------------------------------------------------------

test("G-01 normal idle: hello -> snapshot IDLE -> heartbeats stays fresh idle", () => {
  seq_counter = 1841;
  const snap = baseSnapshot();
  const hb1 = makeEvent({ state: undefined, kind: "heartbeat" });
  delete hb1.semantic_state;
  hb1.prev_event_digest = snap.current_event_digest;
  hb1.__now_ms__ = 1000;
  hb1.event_digest = realmEventDigest(hb1);
  const walk = runRealmTranscript({
    transcript: [makeHello(), snap, hb1],
    admission: makeAdmitted(),
    peer: makePeer(),
    now_ms: 1500,
  });
  assert.equal(walk.ok, true, walk.blocks.join(", "));
  assert.equal(walk.visible_state, "IDLE");
  assert.equal(walk.freshness, "Fresh");
});

test("G-02 mission work: THINKING -> WORKING -> VERIFYING -> VERIFIED_DONE in order", () => {
  const walk = runRealmTranscript({
    transcript: validTranscript(),
    admission: makeAdmitted(),
    peer: makePeer(),
  });
  assert.equal(walk.ok, true, walk.blocks.join(", "));
  assert.equal(walk.visible_state, "VERIFIED_DONE");
});

test("G-03 refusal renders REFUSED without crashing the session", () => {
  seq_counter = 1841;
  const snap = baseSnapshot();
  const refused = missionEvent("REFUSED");
  refused.reason_codes = ["MISSION_BINDING_MISSING"];
  refused.prev_event_digest = snap.current_event_digest;
  refused.event_digest = realmEventDigest(refused);
  const walk = runRealmTranscript({
    transcript: [makeHello(), snap, refused],
    admission: makeAdmitted(),
    peer: makePeer(),
  });
  assert.equal(walk.ok, true, walk.blocks.join(", "));
  assert.equal(walk.visible_state, "REFUSED");
  assert.equal(walk.final_phase, "STREAMING");
});

test("G-04 recovery path: RECOVERY requires a recovery-class reason code", () => {
  const recovering = makeEvent({ state: "RECOVERY" });
  assert.equal(validateRealmEvent(recovering).ok, false);
  recovering.reason_codes = ["RESYNC_REQUIRED"];
  recovering.payload = { mission: { mission_id: "mission-001" } };
  recovering.event_digest = realmEventDigest(recovering);
  assert.equal(validateRealmEvent(recovering).ok, true);
});

test("G-05 integrity breach: digest contradiction -> UNKNOWN + close + resync required", () => {
  seq_counter = 1841;
  const snap = baseSnapshot();
  const good = missionEvent("WORKING");
  good.prev_event_digest = snap.current_event_digest;
  good.event_digest = realmEventDigest(good);
  const breach = missionEvent("VERIFYING");
  breach.prev_event_digest = good.event_digest;
  // tamper the body WITHOUT re-signing -> stored digest no longer matches body
  breach.ttl_ms = 999999;
  const walk = runRealmTranscript({
    transcript: [makeHello(), snap, good, breach],
    admission: makeAdmitted(),
    peer: makePeer(),
  });
  assert.equal(walk.ok, false);
  assert.match(walk.blocks[0], /DIGEST_MISMATCH|DIGEST_CHAIN_BROKEN/);
  assert.equal(walk.visible_state, "UNKNOWN");
  assert.equal(walk.final_phase, "CLOSED");
});

// ── frame decode law · ICD §6.1 + §13 (C16, C17) ─────────────────────────────
import {
  REALM_FRAME_LIMITS,
  decodeRealmFrame,
} from "../packages/core/src/drs-realm-contracts.js";

test("C16a: a frame at exactly max_frame_bytes is admitted", () => {
  const target = REALM_FRAME_LIMITS.max_frame_bytes;
  let pad = 0;
  let raw = "";
  for (;;) {
    raw = `{"schema":"x","pad":"${"p".repeat(pad)}"}`;
    if (Buffer.byteLength(raw, "utf8") >= target) break;
    pad += 1;
  }
  while (Buffer.byteLength(raw, "utf8") > target) {
    raw = `{"schema":"x","pad":"${"p".repeat(--pad)}"}`;
  }
  assert.equal(Buffer.byteLength(raw, "utf8"), target);
  const r = decodeRealmFrame(new TextEncoder().encode(raw));
  assert.equal(r.ok, true, `boundary frame must pass: ${r.reason_code}`);
  assert.equal(r.value.schema, "x");
});

test("C16b: one byte over is refused FRAME_OVERSIZE", () => {
  const r = decodeRealmFrame(new Uint8Array(REALM_FRAME_LIMITS.max_frame_bytes + 1).fill(0x20));
  assert.equal(r.ok, false);
  assert.equal(r.reason_code, "FRAME_OVERSIZE");
});

test("C16c PRECEDENCE CONTROL: oversize garbage reports OVERSIZE, never anything later", () => {
  const garbage = new Uint8Array(REALM_FRAME_LIMITS.max_frame_bytes + 9).fill(0xff);
  const r = decodeRealmFrame(garbage);
  assert.equal(r.reason_code, "FRAME_OVERSIZE");
});

test("C17: malformed UTF-8 is refused by name; valid multibyte passes", () => {
  for (const bad of [
    [0x22, 0xc0, 0xaf, 0x22], // overlong '/' — classic exploit encoding
    [0x22, 0xe2, 0x82, 0x22], // truncated 3-byte sequence
    [0x22, 0xf5, 0x80, 0x80, 0x80], // out-of-range lead byte
    [0x22, 0xed, 0xa0, 0x80, 0x22], // UTF-8-encoded surrogate (CESU-8)
  ]) {
    const r = decodeRealmFrame(new Uint8Array(bad));
    assert.equal(r.ok, false, `expected refusal for ${bad.map((b) => b.toString(16)).join(" ")}`);
    assert.equal(r.reason_code, "FRAME_MALFORMED_UTF8");
  }
  const good = decodeRealmFrame(
    new TextEncoder().encode('{"schema":"x","label":"أهلاً 👋"}'),
  );
  assert.equal(good.ok, true, "valid multibyte UTF-8 must not be refused");
});

test("frame edges: empty and non-JSON frames refuse by name", () => {
  assert.deepEqual(decodeRealmFrame(new Uint8Array(0)), {
    ok: false,
    reason_code: "FRAME_EMPTY",
  });
  const r = decodeRealmFrame(new TextEncoder().encode("not json at all"));
  assert.equal(r.ok, false);
  assert.equal(r.reason_code, "FRAME_JSON_INVALID");
});
