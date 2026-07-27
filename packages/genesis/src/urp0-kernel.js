// BIZRA-GENESIS-NODE0-URP-LOCAL-IGNITION-1A · GENESIS_RUNTIME_SPINE_1A.0
//
// URP-0 authoritative local state: the pure, deterministic core of the first
// running local constitutional world. Events in -> world state + state root out.
//
// PURE KERNEL: no fs / net / http / child_process / clock / random. Every input
// is injected. The durable store (scripts/genesis/urp0-store.mjs), the bounded
// filesystem gatherer (scripts/genesis/urp0-scan.mjs) and the loopback server
// (scripts/genesis/urp0-server.mjs) are the I/O tier and live outside packages/.
//
// Hash contract: the ONE canonical byte contract (canonical-json.v1 + sha256).
// No local serializer copy. Arrays are capped at 1024 by that contract, so this
// kernel folds observations into counters and never inlines per-entry lists.

import { CANONICAL_JSON_V1_ALGORITHM } from "../../canon/src/canonical-json-v1.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";

export const URP0_KERNEL_SCHEMA = "bizra.genesis.urp0_kernel.v0.1";
export const URP0_TRUTH_LABEL = "LOCAL_CANDIDATE";

export const URP0_GENESIS_EVENT_ID = "GENESIS";
export const URP0_HUMAN_ID = "HUMAN-0";
export const URP0_NODE_ID = "NODE0";
export const URP0_ID = "URP-0";
export const URP0_MISSION_ID = "BIZRA-GENESIS-LOCAL-MISSION-0";
export const URP0_RESOURCE_OFFER_ID = "NODE0-GENESIS-RESOURCE-OFFER-0";
export const URP0_BLOCK0_ID = "BIZRA-BLOCK0-LOCAL-CANDIDATE";

// The eleven URP-0 lifecycle events, in the only order the constitution admits.
export const URP0_EVENT_KINDS = Object.freeze([
  "HUMAN_REGISTERED",
  "NODE_REGISTERED",
  "SAT_SET_REGISTERED",
  "RESOURCE_OFFER_REGISTERED",
  "MISSION_DECLARED",
  "CONSENT_REQUESTED",
  "MISSION_AUTHORIZED",
  "MISSION_EXECUTED",
  "SAT_JUDGMENT_RECORDED",
  "RECEIPT_RECORDED",
  "BLOCK0_CANDIDATE_SEALED",
]);

// The authoritative SAT-5 lane set. NOT the obsolete
// Guardian/Reasoner/Builder/Critic/Archivist council — that set is a different
// (declared-only) surface and is constitutionally rejected here.
export const URP0_SAT_LANES = Object.freeze([
  Object.freeze({ id: "SAT-1", lane: "receipt_and_provenance_integrity" }),
  Object.freeze({ id: "SAT-2", lane: "consent_and_fate" }),
  Object.freeze({ id: "SAT-3", lane: "impact_ethics_and_no_riba" }),
  Object.freeze({ id: "SAT-4", lane: "security_and_blast_radius" }),
  Object.freeze({ id: "SAT-5", lane: "governance_and_doctrine" }),
]);

// Human-0 carries no privilege. Every one of these MUST be false in the
// admission contract — a true value is a founder-bypass claim and fails closed.
export const URP0_HUMAN_DENIED_POWERS = Object.freeze([
  "founder_bypass",
  "self_approval",
  "sat_exemption",
  "mint_authority",
  "treasury_authority",
  "unbounded_resource_authority",
]);

export const URP0_HUMAN_ROLES = Object.freeze(["ARCHITECT", "FIRST_USER"]);

// Runtime boundary. All false, always. Flipping one is an execution claim.
export function urp0Boundary() {
  return Object.freeze({
    public_gateway_enabled: false,
    federation_used: false,
    node1_admitted: false,
    token_minted: false,
    treasury_action_performed: false,
    founder_valuation_performed: false,
    source_mutation_performed: false,
    file_contents_read: false,
    symlink_followed: false,
    network_used: false,
    unrestricted_shell_used: false,
    model_invocation_performed: false,
  });
}

function isNonEmptyString(v) {
  return typeof v === "string" && v !== "";
}

// A mission is keyed by id AND attempt. A refused consent leaves THAT attempt
// permanently refused on the record; the operator retries under a fresh attempt
// identifier rather than appending success to a failed one. Without this, one
// mistyped phrase would poison the mission id for the life of the world.
export function urp0MissionKey(mission_id, attempt_id) {
  return `${mission_id}#${attempt_id}`;
}

// One hashing rule for events, shared by producer, store, replay and SAT-1:
// event_id = sha256 over the canonical bytes of {seq, kind, payload, prev_event}.
export function urp0EventId({ seq, kind, payload, prev_event }) {
  return sha256CanonicalJsonV1({ seq, kind, payload, prev_event });
}

export function makeUrp0Event({ seq, kind, payload, prev_event }) {
  const core = { seq, kind, payload, prev_event };
  return Object.freeze({ ...core, event_id: urp0EventId(core) });
}

// The exact consent phrase for the genesis mission. Bound to the canonical root
// and the mission contract hash: a different root or contract yields a different
// required phrase, so consent can never be transplanted between missions.
export function urp0MissionConsentPhrase({ mission_id, canonical_root, contract_hash }) {
  return `GO: execute ${mission_id} metadata-only within ${canonical_root} under ${contract_hash}`;
}

export function urp0ConsentContextHash(context) {
  return sha256CanonicalJsonV1(context);
}

function genesisState() {
  return {
    urp_id: URP0_ID,
    urp_state: "INITIALIZING",
    human: null,
    node: null,
    sat_set: null,
    resource_offer: null,
    missions: Object.create(null),
    consent_requests: Object.create(null),
    used_nonces: [],
    receipts: Object.create(null),
    block0: null,
    head: { seq: 0, event_id: URP0_GENESIS_EVENT_ID },
  };
}

function freezeMap(map) {
  const out = Object.create(null);
  for (const key of Object.keys(map).sort()) out[key] = Object.freeze({ ...map[key] });
  return Object.freeze(out);
}

function freezeState(state) {
  return Object.freeze({
    urp_id: state.urp_id,
    urp_state: state.urp_state,
    human: state.human === null ? null : Object.freeze({ ...state.human }),
    node: state.node === null ? null : Object.freeze({ ...state.node }),
    sat_set: state.sat_set === null ? null : Object.freeze({ ...state.sat_set }),
    resource_offer: state.resource_offer === null ? null : Object.freeze({ ...state.resource_offer }),
    missions: freezeMap(state.missions),
    consent_requests: freezeMap(state.consent_requests),
    used_nonces: Object.freeze([...state.used_nonces].sort()),
    receipts: freezeMap(state.receipts),
    block0: state.block0 === null ? null : Object.freeze({ ...state.block0 }),
    head: Object.freeze({ ...state.head }),
  });
}

// The deterministic world-state root. Same events in -> same root out, on any
// machine, in any process, after any restart. This is the value restart-replay
// compares.
export function urp0StateRoot(state) {
  return sha256CanonicalJsonV1(state);
}

// Fail-closed reduction: events -> URP-0 world state. Halts at the FIRST defect
// with a named block and the offending seq, and exposes NO partial state.
// Duplicate events, out-of-order lifecycle steps, broken hash links, replayed
// consent nonces and founder-bypass claims are all named halts.
export function reduceUrp0Events(events) {
  const halt = (blocked_by, seq, applied) =>
    Object.freeze({
      ok: false,
      blocked_by: Object.freeze([blocked_by]),
      halted_at_seq: seq,
      events_applied: applied,
      state: null,
      state_root: null,
    });

  if (!Array.isArray(events)) return halt("events_not_array", null, 0);

  const state = genesisState();
  const seenEventIds = new Set();
  let applied = 0;

  for (const event of events) {
    const expectedSeq = state.head.seq + 1;
    if (!event || typeof event !== "object") return halt("event_not_object", expectedSeq, applied);
    const { seq, kind, payload, prev_event, event_id } = event;

    // Untrusted seq never reaches the halt marker: a non-integer seq halts with
    // a null position so the diagnostic envelope stays canonicalizable.
    if (!Number.isInteger(seq)) return halt("seq_not_integer", null, applied);
    if (seq !== expectedSeq) return halt("seq_not_contiguous", seq, applied);
    if (!URP0_EVENT_KINDS.includes(kind)) return halt("kind_unknown", seq, applied);
    if (!payload || typeof payload !== "object") return halt("payload_not_object", seq, applied);
    if (prev_event !== state.head.event_id) return halt("prev_event_mismatch", seq, applied);

    let rederivedId = null;
    try {
      rederivedId = urp0EventId({ seq, kind, payload, prev_event });
    } catch (error) {
      if (typeof error?.code !== "string") throw error;
      return halt("event_not_canonicalizable", seq, applied);
    }
    if (event_id !== rederivedId) return halt("event_id_mismatch", seq, applied);
    // Duplicate-event rejection is by content identity, not by position: an
    // identical event replayed anywhere in the journal is refused.
    if (seenEventIds.has(event_id)) return halt("duplicate_event", seq, applied);
    seenEventIds.add(event_id);

    const blocked = applyUrp0Event(state, kind, payload, seq);
    if (blocked !== null) return halt(blocked, seq, applied);

    state.head = { seq, event_id };
    applied += 1;
  }

  const frozen = freezeState(state);
  return Object.freeze({
    ok: true,
    blocked_by: Object.freeze([]),
    halted_at_seq: null,
    events_applied: applied,
    state: frozen,
    state_root: urp0StateRoot(frozen),
  });
}

// One transition per lifecycle step. Returns a block code, or null on success.
// Every step positively proves its precondition — absence of a block is never
// validation.
function applyUrp0Event(state, kind, payload, seq) {
  if (kind === "HUMAN_REGISTERED") {
    if (state.human !== null) return "duplicate_human_registration";
    if (payload.human_id !== URP0_HUMAN_ID) return "human_id_unexpected";
    if (!Array.isArray(payload.roles) || payload.roles.length !== URP0_HUMAN_ROLES.length) {
      return "human_roles_invalid";
    }
    const roles = [...payload.roles].sort();
    if (!URP0_HUMAN_ROLES.every((r, i) => roles[i] === [...URP0_HUMAN_ROLES].sort()[i])) {
      return "human_roles_invalid";
    }
    // The founder is admitted through the ordinary path, with no privilege.
    for (const power of URP0_HUMAN_DENIED_POWERS) {
      if (payload[power] !== false) return `founder_bypass_claimed:${power}`;
    }
    if (!isNonEmptyString(payload.admission_contract_hash)) return "admission_contract_hash_missing";
    if (!isNonEmptyString(payload.consent_receipt_hash)) return "admission_consent_missing";
    state.human = {
      human_id: payload.human_id,
      roles: [...roles],
      founder_bypass: false,
      self_approval: false,
      sat_exemption: false,
      mint_authority: false,
      treasury_authority: false,
      unbounded_resource_authority: false,
      admission_contract_hash: payload.admission_contract_hash,
      consent_receipt_hash: payload.consent_receipt_hash,
      admitted_at_seq: seq,
    };
    return null;
  }

  if (kind === "NODE_REGISTERED") {
    if (state.human === null) return "human_not_registered";
    if (state.node !== null) return "duplicate_node_registration";
    if (payload.node_id !== URP0_NODE_ID) return "node_id_unexpected";
    if (payload.owner !== state.human.human_id) return "node_owner_mismatch";
    state.node = { node_id: payload.node_id, owner: payload.owner, registered_at_seq: seq };
    return null;
  }

  if (kind === "SAT_SET_REGISTERED") {
    if (state.node === null) return "node_not_registered";
    if (state.sat_set !== null) return "duplicate_sat_set_registration";
    const lanes = payload.lanes;
    if (!Array.isArray(lanes) || lanes.length !== URP0_SAT_LANES.length) return "sat_set_not_five";
    for (const [i, expected] of URP0_SAT_LANES.entries()) {
      if (!lanes[i] || lanes[i].id !== expected.id || lanes[i].lane !== expected.lane) {
        return "sat_lane_mismatch";
      }
    }
    // Truthful labelling is a constitutional requirement, not a display detail.
    if (payload.implementation !== "DETERMINISTIC_CONSTITUTIONAL_VERIFIERS") {
      return "sat_implementation_mislabelled";
    }
    if (payload.autonomous_agents !== false) return "autonomous_sat_claimed";
    state.sat_set = {
      count: lanes.length,
      lanes: lanes.map((l) => `${l.id}:${l.lane}`),
      implementation: payload.implementation,
      autonomous_agents: false,
      status: "ACTIVE_LOCAL",
      registered_at_seq: seq,
    };
    // URP-0 becomes locally active only once human + node + the five verifiers
    // are all on the record.
    state.urp_state = "LOCAL_ACTIVE";
    return null;
  }

  if (kind === "RESOURCE_OFFER_REGISTERED") {
    if (state.sat_set === null) return "sat_set_not_registered";
    if (state.resource_offer !== null) return "duplicate_resource_offer";
    if (payload.resource_offer_id !== URP0_RESOURCE_OFFER_ID) return "resource_offer_id_unexpected";
    const a = payload.allowed;
    if (!a || typeof a !== "object") return "resource_offer_allowed_missing";
    for (const key of ["cpu_threads", "memory_bytes", "storage_write_bytes", "wall_clock_seconds", "max_entries", "max_depth"]) {
      if (!Number.isInteger(a[key]) || a[key] <= 0) return `resource_offer_unbounded:${key}`;
    }
    // Never default to the whole machine: the offer must be a strict fraction of
    // what the node possesses.
    const p = payload.possessed;
    if (!p || typeof p !== "object") return "resource_offer_possessed_missing";
    if (!Number.isInteger(p.cpu_threads) || p.cpu_threads <= 0) return "possessed_cpu_threads_invalid";
    if (!Number.isInteger(p.memory_bytes) || p.memory_bytes <= 0) return "possessed_memory_bytes_invalid";
    if (a.cpu_threads >= p.cpu_threads) return "resource_offer_not_a_fraction:cpu_threads";
    if (a.memory_bytes >= p.memory_bytes) return "resource_offer_not_a_fraction:memory_bytes";
    for (const [key, expected] of Object.entries({
      network: false,
      unrestricted_shell: false,
      unrestricted_filesystem: false,
      per_mission_consent: true,
      revocable: true,
      receipt_required: true,
    })) {
      if (payload[key] !== expected) return `resource_offer_term_invalid:${key}`;
    }
    state.resource_offer = {
      resource_offer_id: payload.resource_offer_id,
      allowed: { ...a },
      possessed: { ...p },
      network: false,
      unrestricted_shell: false,
      unrestricted_filesystem: false,
      per_mission_consent: true,
      revocable: true,
      receipt_required: true,
      offer_hash: sha256CanonicalJsonV1({ allowed: a, possessed: p }),
      registered_at_seq: seq,
    };
    return null;
  }

  if (kind === "MISSION_DECLARED") {
    if (state.resource_offer === null) return "resource_offer_not_registered";
    if (!isNonEmptyString(payload.mission_id)) return "mission_id_missing";
    if (!isNonEmptyString(payload.attempt_id)) return "mission_attempt_id_missing";
    const key = urp0MissionKey(payload.mission_id, payload.attempt_id);
    if (Object.hasOwn(state.missions, key)) return "duplicate_mission_declaration";
    if (!isNonEmptyString(payload.contract_hash)) return "mission_contract_hash_missing";
    if (!isNonEmptyString(payload.canonical_root)) return "mission_root_missing";
    if (payload.metadata_only !== true) return "mission_not_metadata_only";
    if (payload.network !== false) return "mission_network_claimed";
    state.missions[key] = {
      mission_id: payload.mission_id,
      attempt_id: payload.attempt_id,
      contract_hash: payload.contract_hash,
      canonical_root: payload.canonical_root,
      metadata_only: true,
      network: false,
      status: "DECLARED",
      declared_at_seq: seq,
    };
    return null;
  }

  if (kind === "CONSENT_REQUESTED") {
    if (!isNonEmptyString(payload.attempt_id)) return "mission_attempt_id_missing";
    const m = state.missions[urp0MissionKey(payload.mission_id, payload.attempt_id)];
    if (!m) return "mission_not_declared";
    if (m.status !== "DECLARED") return "consent_request_out_of_order";
    if (!isNonEmptyString(payload.consent_context_hash)) return "consent_context_hash_missing";
    if (Object.hasOwn(state.consent_requests, payload.consent_context_hash)) {
      return "duplicate_consent_request";
    }
    if (!isNonEmptyString(payload.required_phrase)) return "required_phrase_missing";
    if (!isNonEmptyString(payload.nonce)) return "consent_nonce_missing";
    if (!isNonEmptyString(payload.created_at_iso)) return "consent_created_at_missing";
    if (!isNonEmptyString(payload.expires_at_iso)) return "consent_expiry_missing";
    if (payload.permitted_operation !== "METADATA_INVENTORY_READ_ONLY") {
      return "permitted_operation_invalid";
    }
    // A nonce may be OFFERED once. Reuse is a replay attempt.
    if (state.used_nonces.includes(payload.nonce)) return "consent_nonce_replayed";
    state.used_nonces.push(payload.nonce);
    state.consent_requests[payload.consent_context_hash] = {
      consent_context_hash: payload.consent_context_hash,
      mission_id: payload.mission_id,
      required_phrase: payload.required_phrase,
      nonce: payload.nonce,
      created_at_iso: payload.created_at_iso,
      expires_at_iso: payload.expires_at_iso,
      permitted_operation: payload.permitted_operation,
      canonical_root: m.canonical_root,
      contract_hash: m.contract_hash,
      consumed: false,
      requested_at_seq: seq,
    };
    m.status = "CONSENT_REQUESTED";
    return null;
  }

  if (kind === "MISSION_AUTHORIZED") {
    if (!isNonEmptyString(payload.attempt_id)) return "mission_attempt_id_missing";
    const m = state.missions[urp0MissionKey(payload.mission_id, payload.attempt_id)];
    if (!m) return "mission_not_declared";
    if (m.status !== "CONSENT_REQUESTED") return "authorization_out_of_order";
    const req = state.consent_requests[payload.consent_context_hash];
    if (!req) return "consent_context_unknown";
    if (req.mission_id !== payload.mission_id) return "consent_context_mission_mismatch";
    if (req.consumed === true) return "consent_context_replayed";
    if (payload.exact_phrase_matched !== true) return "consent_phrase_mismatch";
    if (!isNonEmptyString(payload.authorized_at_iso)) return "authorized_at_missing";
    // Act-time expiry, recorded once. Verification later re-derives against THIS
    // timestamp, never against a live clock — a stale wall clock must not turn a
    // valid past authorization into a failure.
    if (payload.authorized_at_iso > req.expires_at_iso) return "consent_expired";
    if (payload.authorized_at_iso < req.created_at_iso) return "consent_not_yet_valid";
    if (!isNonEmptyString(payload.consent_receipt_hash)) return "consent_receipt_hash_missing";
    req.consumed = true;
    req.authorized_at_iso = payload.authorized_at_iso;
    req.consent_receipt_hash = payload.consent_receipt_hash;
    m.status = "AUTHORIZED";
    m.consent_context_hash = payload.consent_context_hash;
    m.consent_receipt_hash = payload.consent_receipt_hash;
    m.authorized_at_seq = seq;
    return null;
  }

  if (kind === "MISSION_EXECUTED") {
    if (!isNonEmptyString(payload.attempt_id)) return "mission_attempt_id_missing";
    const m = state.missions[urp0MissionKey(payload.mission_id, payload.attempt_id)];
    if (!m) return "mission_not_declared";
    if (m.status !== "AUTHORIZED") return "execution_without_authorization";
    if (!isNonEmptyString(payload.result_hash)) return "mission_result_hash_missing";
    if (payload.metadata_only !== true) return "execution_not_metadata_only";
    if (payload.source_mutated !== false) return "source_mutation_reported";
    if (payload.symlinks_followed !== 0) return "symlink_followed_reported";
    if (payload.network_used !== false) return "network_used_reported";
    m.status = "EXECUTED";
    m.result_hash = payload.result_hash;
    m.executed_at_seq = seq;
    return null;
  }

  if (kind === "SAT_JUDGMENT_RECORDED") {
    if (!isNonEmptyString(payload.attempt_id)) return "mission_attempt_id_missing";
    const m = state.missions[urp0MissionKey(payload.mission_id, payload.attempt_id)];
    if (!m) return "mission_not_declared";
    if (m.status !== "EXECUTED") return "judgment_without_execution";
    if (!isNonEmptyString(payload.judgment_hash)) return "judgment_hash_missing";
    if (!Array.isArray(payload.verifier_verdicts) || payload.verifier_verdicts.length !== 5) {
      return "judgment_not_five_verifiers";
    }
    // Fail closed: one missing, one malformed or one failed verifier refuses.
    for (const [i, expected] of URP0_SAT_LANES.entries()) {
      const v = payload.verifier_verdicts[i];
      if (!v || v.id !== expected.id || v.lane !== expected.lane) return "judgment_verifier_malformed";
      if (v.verdict !== "PASS") return `sat_refused:${expected.id}`;
    }
    if (payload.admissible !== true) return "judgment_not_admissible";
    m.status = "JUDGED";
    m.judgment_hash = payload.judgment_hash;
    m.judged_at_seq = seq;
    return null;
  }

  if (kind === "RECEIPT_RECORDED") {
    if (!isNonEmptyString(payload.attempt_id)) return "mission_attempt_id_missing";
    const m = state.missions[urp0MissionKey(payload.mission_id, payload.attempt_id)];
    if (!m) return "mission_not_declared";
    if (m.status !== "JUDGED") return "receipt_without_judgment";
    if (!isNonEmptyString(payload.receipt_hash)) return "receipt_hash_missing";
    if (Object.hasOwn(state.receipts, payload.receipt_hash)) return "duplicate_receipt";
    if (payload.result_hash !== m.result_hash) return "receipt_result_hash_mismatch";
    if (payload.judgment_hash !== m.judgment_hash) return "receipt_judgment_hash_mismatch";
    state.receipts[payload.receipt_hash] = {
      receipt_hash: payload.receipt_hash,
      mission_id: payload.mission_id,
      result_hash: payload.result_hash,
      judgment_hash: payload.judgment_hash,
      recorded_at_seq: seq,
    };
    m.status = "RECEIPTED";
    m.receipt_hash = payload.receipt_hash;
    return null;
  }

  if (kind === "BLOCK0_CANDIDATE_SEALED") {
    if (state.block0 !== null) return "duplicate_block0_seal";
    if (!isNonEmptyString(payload.attempt_id)) return "mission_attempt_id_missing";
    const m = state.missions[urp0MissionKey(payload.mission_id, payload.attempt_id)];
    if (!m) return "mission_not_declared";
    if (m.status !== "RECEIPTED") return "block0_without_receipt";
    if (!isNonEmptyString(payload.block0_hash)) return "block0_hash_missing";
    if (payload.truth_label !== URP0_TRUTH_LABEL) return "block0_truth_label_invalid";
    if (payload.live_mint !== false || payload.token_created !== false) return "block0_mint_claimed";
    if (payload.internet_gateway !== false || payload.node1_admission !== false) {
      return "block0_network_claimed";
    }
    state.block0 = {
      block0_id: URP0_BLOCK0_ID,
      block0_hash: payload.block0_hash,
      mission_id: payload.mission_id,
      receipt_hash: m.receipt_hash,
      truth_label: URP0_TRUTH_LABEL,
      live_mint: false,
      token_created: false,
      internet_gateway: false,
      node1_admission: false,
      sealed_at_seq: seq,
    };
    return null;
  }

  return "kind_unhandled";
}

// Convenience for the store and the server: reduce, then expose the head state
// root that a restart must reproduce byte-for-byte.
export function urp0Replay(events) {
  const result = reduceUrp0Events(events);
  return Object.freeze({
    schema: URP0_KERNEL_SCHEMA,
    truth_label: URP0_TRUTH_LABEL,
    canonicalization_algorithm: CANONICAL_JSON_V1_ALGORITHM,
    hash_algorithm: "sha256",
    ok: result.ok,
    blocked_by: result.blocked_by,
    halted_at_seq: result.halted_at_seq,
    events_applied: result.events_applied,
    state: result.state,
    state_root: result.state_root,
    boundary: urp0Boundary(),
  });
}
