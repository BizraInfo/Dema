// NODE0-REALM-STATE-KERNEL-1A — Reconstruct Node0 realm state deterministically from an injected hash-chained event history while preserving an all-false execution boundary.
//
// Pure kernel: no fs / network / process / clock / random. Events are injected
// arrays — durable storage is NOT implemented and belongs to a later slice; the
// derived realm state exists only for the duration of a call. Any defect halts
// the reduction fail-closed with a named, canonicalizable block and no partial
// state. Scope events maintain descriptive scope state that may only shrink
// after initialization; no scope event grants execution authority.

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

// Bounded schema-local deep freeze: walks own enumerable properties of plain
// objects/arrays (the only shapes this schema emits or accepts as canonical).
// ponytail: cycle-safe via seen-set; not a repository-wide abstraction.
function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const key of Object.keys(value)) deepFreeze(value[key], seen);
  return Object.freeze(value);
}

// One hashing rule for events, shared by producers, tests and the verifier:
// event_id = sha256 over the canonical bytes of {seq, kind, payload, prev_event}.
// The returned event (payload included) is deep-frozen so hash-bound content
// cannot drift after construction.
export function makeNode0RealmEvent({ seq, kind, payload, prev_event }) {
  const core = { seq, kind, payload, prev_event };
  return deepFreeze({ ...core, event_id: sha256CanonicalJsonV1(core) });
}

// Identity maps are null-prototype: identifiers like "constructor", "toString"
// or "__proto__" are ordinary own keys and can never impersonate inherited
// properties. Existence checks use Object.hasOwn, never truthiness.
function genesisState() {
  return {
    missions: Object.create(null),
    assets: Object.create(null),
    authority_scopes: null,
    head: { seq: 0, event_id: NODE0_REALM_GENESIS_EVENT_ID },
  };
}

function freezeState(state) {
  const missions = Object.create(null);
  for (const key of Object.keys(state.missions)) missions[key] = Object.freeze({ ...state.missions[key] });
  const assets = Object.create(null);
  for (const key of Object.keys(state.assets)) assets[key] = Object.freeze({ ...state.assets[key] });
  return Object.freeze({
    missions: Object.freeze(missions),
    assets: Object.freeze(assets),
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
    // seq halts with a null position so the diagnostic envelope stays
    // canonicalizable (canonical-json-v1 fails closed on undefined) and run()
    // returns an envelope instead of throwing. (PR #401 P2 repair.)
    if (!Number.isInteger(seq)) return halt(["seq_not_integer"], null, applied);
    if (seq !== expectedSeq) return halt(["seq_not_contiguous"], seq, applied);
    if (!NODE0_REALM_EVENT_KINDS.includes(kind)) return halt(["kind_unknown"], seq, applied);
    if (!payload || typeof payload !== "object") return halt(["payload_not_object"], seq, applied);
    if (prev_event !== state.head.event_id) return halt(["prev_event_mismatch"], seq, applied);
    // Non-canonical event content (undefined, NaN, cycles, accessors, non-plain
    // objects, ...) is a named replay defect, not an escaping exception. Only
    // the canon contract's coded errors are absorbed; anything else rethrows.
    let rederivedId = null;
    try {
      rederivedId = sha256CanonicalJsonV1({ seq, kind, payload, prev_event });
    } catch (error) {
      if (typeof error?.code !== "string") throw error;
      return halt(["event_not_canonicalizable"], seq, applied);
    }
    if (event_id !== rederivedId) return halt(["event_id_mismatch"], seq, applied);

    if (kind === "MISSION_DECLARED") {
      if (typeof payload.mission_id !== "string" || payload.mission_id === "") {
        return halt(["mission_id_missing"], seq, applied);
      }
      if (typeof payload.objective !== "string" || payload.objective === "") {
        return halt(["objective_missing"], seq, applied);
      }
      if (Object.hasOwn(state.missions, payload.mission_id)) {
        return halt(["mission_already_declared"], seq, applied);
      }
      state.missions[payload.mission_id] = { status: "DECLARED", objective: payload.objective };
    } else if (kind === "MISSION_CHECKPOINT") {
      if (typeof payload.mission_id !== "string" || !Object.hasOwn(state.missions, payload.mission_id)) {
        return halt(["mission_not_declared"], seq, applied);
      }
      state.missions[payload.mission_id].last_checkpoint_seq = seq;
    } else if (kind === "MISSION_VERDICT") {
      if (typeof payload.mission_id !== "string" || !Object.hasOwn(state.missions, payload.mission_id)) {
        return halt(["mission_not_declared"], seq, applied);
      }
      if (payload.verdict !== "PASS" && payload.verdict !== "FAIL") {
        return halt(["verdict_invalid"], seq, applied);
      }
      state.missions[payload.mission_id].verdict = payload.verdict;
    } else if (kind === "ASSET_PROMOTED") {
      // A worker's "done" claim never becomes an asset: promotion requires a
      // recorded PASS verdict on the mission first.
      if (typeof payload.asset_id !== "string" || payload.asset_id === "") {
        return halt(["asset_id_missing"], seq, applied);
      }
      if (typeof payload.mission_id !== "string" || !Object.hasOwn(state.missions, payload.mission_id)) {
        return halt(["mission_not_declared"], seq, applied);
      }
      if (state.missions[payload.mission_id].verdict !== "PASS") {
        return halt(["asset_promotion_without_pass_verdict"], seq, applied);
      }
      if (Object.hasOwn(state.assets, payload.asset_id)) {
        return halt(["asset_already_promoted"], seq, applied);
      }
      state.assets[payload.asset_id] = { mission_id: payload.mission_id, promoted_at_seq: seq };
    } else if (kind === "AUTHORITY_NARROWED") {
      // Descriptive scope state: the FIRST scope event initializes it;
      // subsequent scope events may only remove scopes. This state never
      // grants execution authority (the boundary stays all-false regardless).
      const scopes = payload.scopes;
      if (!Array.isArray(scopes) || scopes.some((s) => typeof s !== "string")) {
        return halt(["authority_scopes_invalid"], seq, applied);
      }
      const unique = new Set(scopes);
      if (unique.size !== scopes.length) return halt(["authority_scopes_duplicate"], seq, applied);
      if (state.authority_scopes !== null) {
        const current = new Set(state.authority_scopes);
        if (scopes.some((s) => !current.has(s))) {
          return halt(["authority_widening_rejected"], seq, applied);
        }
      }
      // Stored sorted: reordered but set-equal scope events normalize to one
      // deterministic state representation.
      state.authority_scopes = [...unique].sort();
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
// in `replay` (fail-closed) and realm_state stays null — never partial. All
// nested payload structure is frozen beneath the frozen outer object.
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
    replay: Object.freeze({
      ok: replayResult.ok,
      blocked_by: replayResult.blocked_by,
      halted_at_seq: replayResult.halted_at_seq,
      events_applied: replayResult.events_applied,
    }),
    realm_state: replayResult.ok ? replayResult.state : null,
    boundary: node0RealmStateKernelBoundary(),
  };
  const content_hash = sha256CanonicalJsonV1(body);
  return Object.freeze({ ...body, content_hash });
}

// Body-bound re-derivation verifier: recompute the hash over the WHOLE body minus
// its hash field and reject any mismatch, then check the slice's semantic
// invariants with stable block codes. Internal semantic invariants are checked;
// independent authenticity is NOT proved — an attacker controlling every
// semantically permitted field and recomputing the hash still requires an
// external signature or anchor to detect (a later slice).
export function verifyNode0RealmStateKernel(payload) {
  const blocked_by = [];
  if (!payload || typeof payload !== "object") {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["payload_not_object"]) });
  }
  const { content_hash, ...body } = payload;
  if (payload.schema !== NODE0_REALM_STATE_KERNEL_SCHEMA) blocked_by.push("schema_mismatch");
  if (payload.truth_label !== NODE0_REALM_STATE_KERNEL_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  if (payload.canonicalization_algorithm !== CANONICAL_JSON_V1_ALGORITHM) {
    blocked_by.push("canonicalization_algorithm_mismatch");
  }
  if (payload.hash_algorithm !== "sha256") blocked_by.push("hash_algorithm_mismatch");
  if (payload.text_encoding !== "utf-8") blocked_by.push("text_encoding_mismatch");
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
  if (payload.replay && payload.replay.ok === false && payload.realm_state !== null) {
    blocked_by.push("realm_state_present_for_failed_replay");
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
