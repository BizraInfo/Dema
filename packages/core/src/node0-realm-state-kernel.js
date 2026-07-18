// NODE0-REALM-STATE-KERNEL-1A — Reconstruct Node0 realm state deterministically from durable event history while preserving an all-false execution boundary.
//
// Pure kernel: no fs / network / process / clock / random. Events are injected
// arrays; durable storage is a later slice. The realm state is DERIVED — the
// event history is the only truth, and any defect halts the reduction fail-closed
// with a named block. Authority may only narrow (monotonicity); a worker claim
// never mutates state without a recorded verdict.

// M5.1B: hash-bearing slices use the ONE canonical byte contract — no local
// serializer copy. Unsupported values (undefined, NaN, sparse arrays,
// accessors, ...) fail closed inside packages/canon with registered error
// codes. The scaffold auto-registers this kernel's path in
// CANONICAL_JSON_V1_REGISTERED_CONSUMERS (scripts/review/canonical-json-v1-check.mjs);
// review that one-line diff in this slice's PR.
import { CANONICAL_JSON_V1_ALGORITHM } from "../../canon/src/canonical-json-v1.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";

export const NODE0_REALM_STATE_KERNEL_SCHEMA = "bizra.dema.node0_realm_state_kernel.v0.1";
export const NODE0_REALM_STATE_KERNEL_TRUTH_LABEL = "NODE0_REALM_STATE_KERNEL_MEASURED_REPO";
export const NODE0_REALM_STATE_KERNEL_GO_PHRASE = "GO: node0 realm state kernel preview";

export const NODE0_REALM_GENESIS_EVENT_ID = "GENESIS";

export const NODE0_REALM_EVENT_KINDS = Object.freeze([
  "MISSION_DECLARED",
  "MISSION_CHECKPOINT",
  "MISSION_VERDICT",
  "ASSET_PROMOTED",
  "AUTHORITY_NARROWED",
]);

// All-false boundary invariant. These keys mirror the capability-truth-registry
// row boundary — keep them all false; flipping any one is an execution claim.
export function node0RealmStateKernelBoundary() {
  return Object.freeze({
    execution_allowed: false,
    daemon_started: false,
    network_used: false,
    token_minted: false,
    wallet_accessed: false,
    live_execution_performed: false,
    file_mutation_performed: false,
    model_invocation_performed: false,
  });
}

// One hashing rule for events, shared by producers, tests and the verifier:
// event_id = sha256 over the canonical bytes of {seq, kind, payload, prev_event}.
export function makeNode0RealmEvent({ seq, kind, payload, prev_event }) {
  const core = { seq, kind, payload, prev_event };
  return Object.freeze({ ...core, event_id: sha256CanonicalJsonV1(core) });
}

function genesisState() {
  return {
    missions: {},
    assets: {},
    authority_scopes: null,
    head: { seq: 0, event_id: NODE0_REALM_GENESIS_EVENT_ID },
  };
}

function freezeState(state) {
  return Object.freeze({
    missions: Object.freeze({ ...state.missions }),
    assets: Object.freeze({ ...state.assets }),
    authority_scopes:
      state.authority_scopes === null ? null : Object.freeze([...state.authority_scopes]),
    head: Object.freeze({ ...state.head }),
  });
}

// Deterministic fail-closed reduction: events -> realm state. Halts at the first
// defect with a named block and the offending seq; exposes NO partial state on
// failure. Same events in, same state out — no clock, no randomness.
export function reduceNode0RealmEvents(events) {
  const halt = (blocked_by, seq, applied) =>
    Object.freeze({
      ok: false,
      blocked_by: Object.freeze(blocked_by),
      halted_at_seq: seq,
      events_applied: applied,
    });

  if (!Array.isArray(events)) return halt(["events_not_array"], null, 0);

  const state = genesisState();
  let applied = 0;

  for (const event of events) {
    const expectedSeq = state.head.seq + 1;
    if (!event || typeof event !== "object") return halt(["event_not_object"], expectedSeq, applied);
    const { seq, kind, payload, prev_event, event_id } = event;
    // Untrusted seq never reaches the halt marker: a missing or non-integer
    // seq halts with a null position so the payload stays canonicalizable
    // (canonical-json-v1 fails closed on undefined) and run() returns an
    // envelope instead of throwing. (PR #401 P2 repair.)
    if (!Number.isInteger(seq)) return halt(["seq_not_integer"], null, applied);
    if (seq !== expectedSeq) return halt(["seq_not_contiguous"], seq, applied);
    if (!NODE0_REALM_EVENT_KINDS.includes(kind)) return halt(["kind_unknown"], seq, applied);
    if (!payload || typeof payload !== "object") return halt(["payload_not_object"], seq, applied);
    if (prev_event !== state.head.event_id) return halt(["prev_event_mismatch"], seq, applied);
    if (event_id !== sha256CanonicalJsonV1({ seq, kind, payload, prev_event })) {
      return halt(["event_id_mismatch"], seq, applied);
    }

    if (kind === "MISSION_DECLARED") {
      if (typeof payload.mission_id !== "string" || payload.mission_id === "") {
        return halt(["mission_id_missing"], seq, applied);
      }
      if (typeof payload.objective !== "string" || payload.objective === "") {
        return halt(["objective_missing"], seq, applied);
      }
      if (state.missions[payload.mission_id]) return halt(["mission_already_declared"], seq, applied);
      state.missions[payload.mission_id] = { status: "DECLARED", objective: payload.objective };
    } else if (kind === "MISSION_CHECKPOINT") {
      const mission = state.missions[payload.mission_id];
      if (!mission) return halt(["mission_not_declared"], seq, applied);
      mission.last_checkpoint_seq = seq;
    } else if (kind === "MISSION_VERDICT") {
      const mission = state.missions[payload.mission_id];
      if (!mission) return halt(["mission_not_declared"], seq, applied);
      if (payload.verdict !== "PASS" && payload.verdict !== "FAIL") {
        return halt(["verdict_invalid"], seq, applied);
      }
      mission.verdict = payload.verdict;
    } else if (kind === "ASSET_PROMOTED") {
      // A worker's "done" claim never becomes an asset: promotion requires a
      // recorded PASS verdict on the mission first.
      if (typeof payload.asset_id !== "string" || payload.asset_id === "") {
        return halt(["asset_id_missing"], seq, applied);
      }
      const mission = state.missions[payload.mission_id];
      if (!mission) return halt(["mission_not_declared"], seq, applied);
      if (mission.verdict !== "PASS") return halt(["asset_promotion_without_pass_verdict"], seq, applied);
      if (state.assets[payload.asset_id]) return halt(["asset_already_promoted"], seq, applied);
      state.assets[payload.asset_id] = { mission_id: payload.mission_id, promoted_at_seq: seq };
    } else if (kind === "AUTHORITY_NARROWED") {
      const scopes = payload.scopes;
      if (!Array.isArray(scopes) || scopes.some((s) => typeof s !== "string")) {
        return halt(["authority_scopes_invalid"], seq, applied);
      }
      if (state.authority_scopes !== null) {
        const current = new Set(state.authority_scopes);
        if (scopes.some((s) => !current.has(s))) {
          return halt(["authority_widening_rejected"], seq, applied);
        }
      }
      state.authority_scopes = [...scopes];
    }

    state.head = { seq, event_id };
    applied += 1;
  }

  return Object.freeze({
    ok: true,
    blocked_by: Object.freeze([]),
    halted_at_seq: null,
    events_applied: applied,
    state: freezeState(state),
  });
}

// Fail-closed plan. Collect every reason the action is blocked; eligible only
// when nothing blocks. Exact GO-phrase byte match — no fuzzy / partial consent.
export function planNode0RealmStateKernel({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== NODE0_REALM_STATE_KERNEL_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  if (!input || typeof input !== "object") {
    blocked_by.push("input_not_object");
  } else if (!Array.isArray(input.events)) {
    blocked_by.push("input_events_not_array");
  }
  return Object.freeze({
    schema: NODE0_REALM_STATE_KERNEL_SCHEMA,
    truth_label: NODE0_REALM_STATE_KERNEL_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Canonical, content-addressed payload: the derived realm state plus its replay
// receipt, bound by one hash over the whole body. Reduction defects are carried
// in `replay` (fail-closed) and realm_state stays null — never partial.
export function buildNode0RealmStateKernelPayload(input) {
  const events = input && typeof input === "object" && Array.isArray(input.events) ? input.events : null;
  const replayResult =
    events === null
      ? Object.freeze({ ok: false, blocked_by: Object.freeze(["input_events_not_array"]), halted_at_seq: null, events_applied: 0 })
      : reduceNode0RealmEvents(events);
  const body = {
    schema: NODE0_REALM_STATE_KERNEL_SCHEMA,
    truth_label: NODE0_REALM_STATE_KERNEL_TRUTH_LABEL,
    canonicalization_algorithm: CANONICAL_JSON_V1_ALGORITHM,
    hash_algorithm: "sha256",
    text_encoding: "utf-8",
    replay: {
      ok: replayResult.ok,
      blocked_by: replayResult.blocked_by,
      halted_at_seq: replayResult.halted_at_seq,
      events_applied: replayResult.events_applied,
    },
    realm_state: replayResult.ok ? replayResult.state : null,
    boundary: node0RealmStateKernelBoundary(),
  };
  const content_hash = sha256CanonicalJsonV1(body);
  return Object.freeze({ ...body, content_hash });
}

// Body-bound re-derivation verifier: recompute the hash over the WHOLE body minus
// its hash field and reject any mismatch, then check the slice invariants. A field
// change without a hash update fails on rederivation; schema/label/boundary drift
// fails on the invariant checks.
export function verifyNode0RealmStateKernel(payload) {
  const blocked_by = [];
  if (!payload || typeof payload !== "object") {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["payload_not_object"]) });
  }
  const { content_hash, ...body } = payload;
  if (payload.schema !== NODE0_REALM_STATE_KERNEL_SCHEMA) blocked_by.push("schema_mismatch");
  if (payload.truth_label !== NODE0_REALM_STATE_KERNEL_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  const expectedBoundary = node0RealmStateKernelBoundary();
  const boundary = payload.boundary;
  const boundaryValid =
    boundary &&
    typeof boundary === "object" &&
    Object.keys(expectedBoundary).length === Object.keys(boundary).length &&
    Object.entries(expectedBoundary).every(([key, value]) => boundary[key] === value);
  if (!boundaryValid) blocked_by.push("boundary_shape_invalid");
  if (payload.replay && payload.replay.ok === true && payload.realm_state === null) {
    blocked_by.push("replay_state_inconsistent");
  }
  let rederived = null;
  try {
    rederived = sha256CanonicalJsonV1(body);
  } catch {
    blocked_by.push("body_not_canonicalizable");
  }
  if (rederived !== null && rederived !== content_hash) blocked_by.push("content_hash_mismatch");
  return Object.freeze({ ok: blocked_by.length === 0, blocked_by: Object.freeze(blocked_by) });
}

// Orchestrator the review gate consumes. plan -> reduce/build -> verify ->
// tamper-reject, returning the proof envelope. Any failure returns a named
// block so the gate fails closed.
export function runNode0RealmStateKernel({ consent, input } = {}) {
  const fail = (blocked_by) =>
    Object.freeze({
      ok: false,
      schema: NODE0_REALM_STATE_KERNEL_SCHEMA,
      truth_label: NODE0_REALM_STATE_KERNEL_TRUTH_LABEL,
      blocked_by: Object.freeze(blocked_by),
      boundary: node0RealmStateKernelBoundary(),
    });

  const plan = planNode0RealmStateKernel({ consent, input });
  if (!plan.eligible) return fail([...plan.blocked_by]);

  const payload = buildNode0RealmStateKernelPayload(input);
  if (!payload.replay.ok) return fail([...payload.replay.blocked_by]);

  const verdict = verifyNode0RealmStateKernel(payload);
  if (!verdict.ok) return fail([...verdict.blocked_by]);

  const tampered = verifyNode0RealmStateKernel({ ...payload, truth_label: "FORGED" });
  if (tampered.ok !== false) return fail(["tamper_check_failed"]);

  return Object.freeze({
    ok: true,
    schema: NODE0_REALM_STATE_KERNEL_SCHEMA,
    truth_label: NODE0_REALM_STATE_KERNEL_TRUTH_LABEL,
    content_hash: payload.content_hash,
    boundary: node0RealmStateKernelBoundary(),
    blocked_by: Object.freeze([]),
    replay: payload.replay,
  });
}
