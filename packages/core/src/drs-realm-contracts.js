// DRS-REALM-CONTRACTS-1A — Realm Shell IF-01 wire law.
//
// Freezes the Node0 -> Presence Service projection contract defined by
// BIZRA-DRS-ICD-0A: hello/resync/event schemas, source admission, the
// snapshot-before-stream connection FSM, the sequence + digest-chain contract,
// state-specific evidence constraints, and TTL freshness.
//
// Pure kernel. Effects are injected and documented:
//   - `peer` (uid/pid/exe digest) is caller-supplied SO_PEERCRED observation.
//   - time enters ONLY as caller-supplied `now_ms`; nothing reads a clock.
//   - hashing uses packages/canon sha256-canonical-json-v1 (the ONE byte
//     contract; this file is registered in CANONICAL_JSON_V1_REGISTERED_CONSUMERS).
// No fs / socket / process / random. Every claim here is a preview; the
// boundary is all-false. authority_delta MUST be 0 on every production frame;
// anything else is refused, never defaulted.
//
// Drift rulings pinned for P0 (see docs/02-architecture/DRS_REALM_CONTRACTS_v0_1.md):
//   default_ttl_ms = 2500, heartbeat_interval_ms = 1000 (ICD/DSD majority wins);
//   PROTOCOL_PHASE_VIOLATION is added to the reason-code vocabulary per ICD §91
//   (new codes are lawful BEFORE they appear in a qualified receipt).

import { CANONICAL_JSON_V1_ALGORITHM } from "../../canon/src/canonical-json-v1.js";
import {
  sha256CanonicalJsonV1,
  verifyCanonicalJsonHashV1,
} from "../../canon/src/sha256-canonical-json-v1.js";

export const DRS_REALM_CONTRACTS_SCHEMA = "bizra.dema.drs_realm_contracts.v0.1";
export const DRS_REALM_CONTRACTS_TRUTH_LABEL = "DRS_REALM_CONTRACTS_MEASURED_REPO";
export const DRS_REALM_CONTRACTS_GO_PHRASE = "GO: dema realm contracts wire law";

// ---------------------------------------------------------------------------
// Frozen protocol constants (ICD Appendix F)
// ---------------------------------------------------------------------------

export const REALM_HELLO_SCHEMA = "bizra.realm.hello.v0.1";
export const REALM_RESYNC_SCHEMA = "bizra.realm.resync.v0.1";
export const REALM_EVENT_SCHEMA = "bizra.realm.event.v0.1";

export const REALM_PROTOCOL = Object.freeze({
  hello_schema: REALM_HELLO_SCHEMA,
  resync_schema: REALM_RESYNC_SCHEMA,
  event_schema: REALM_EVENT_SCHEMA,
  transport: "AF_UNIX",
  framing: "U32_BE_LENGTH_PREFIX",
  encoding: "UTF_8_JSON",
  max_frame_bytes: 32768,
  socket_mode: "0600",
  heartbeat_interval_ms: 1000,
  default_ttl_ms: 2500,
});

export const SEMANTIC_STATES = Object.freeze([
  "OFFLINE",
  "IDLE",
  "LISTENING",
  "THINKING",
  "WORKING",
  "NEEDS_HUMAN",
  "VERIFYING",
  "REFUSED",
  "VERIFIED_DONE",
  "RECOVERY",
  "UNKNOWN",
]);

// Active-success states that must NEVER survive lost freshness (no stale
// success); OFFLINE/UNKNOWN degrade per transport state instead.
export const ACTIVE_SUCCESS_STATES = Object.freeze([
  "LISTENING",
  "THINKING",
  "WORKING",
  "NEEDS_HUMAN",
  "VERIFYING",
  "REFUSED",
  "VERIFIED_DONE",
  "RECOVERY",
]);

export const REALM_EVENT_KINDS = Object.freeze([
  "presence.state_changed",
  "mission.summary_changed",
  "attention.changed",
  "resources.sampled",
  "verifier.state_changed",
  "receipt.summary_changed",
  "heartbeat",
]);

// Stable P0 reason-code registry (ICD §90) + one documented extension.
export const REASON_CODES = Object.freeze([
  "SOURCE_UNAVAILABLE",
  "SOURCE_UNADMITTED",
  "SOURCE_REVISION_MISMATCH",
  "SOURCE_PID_MISMATCH",
  "SOURCE_EXECUTABLE_MISMATCH",
  "SOURCE_IDENTITY_UNKNOWN",
  "SOURCE_SESSION_CHANGED",
  "CONTRACTS_DIGEST_MISMATCH",
  "SCHEMA_UNSUPPORTED",
  "SCHEMA_INVALID",
  "FRAME_EMPTY",
  "FRAME_OVERSIZE",
  "FRAME_MALFORMED",
  "SEQUENCE_GAP",
  "SEQUENCE_ROLLBACK",
  "DUPLICATE_CONTRADICTION",
  "DIGEST_MISMATCH",
  "DIGEST_CHAIN_BROKEN",
  "EVENT_EXPIRED",
  "AUTHORITY_DELTA_NONZERO",
  "MISSION_BINDING_MISSING",
  "REQUIRED_EVIDENCE_REF_MISSING",
  "QUEUE_OVERFLOW",
  "RESYNC_REQUIRED",
  "SHELL_UNAVAILABLE",
  "SHELL_TIMEOUT",
  "SHELL_BAD_EXIT",
  "SHELL_RESPONSE_INVALID",
  "SHELL_UPSTREAM_DRIFT",
  "PLUGIN_UNAVAILABLE",
  "RENDER_FAILED",
  "SIMULATED_FIXTURE",
  // Documented extension (pre-qualification): phase violation on the wire.
  "PROTOCOL_PHASE_VIOLATION",
]);

// Controlled subsets used by the state-specific evidence constraints.
// SAT_* markers are justified by the ICD resync example ("SAT_ACTIVE") and the
// PRD/TRD SAT status values (ACTIVE/PENDING/UNKNOWN/CONTRADICTED).
export const VERIFICATION_REASON_CODES = Object.freeze([
  "SAT_ACTIVE",
  "SAT_PENDING",
  "SAT_UNKNOWN",
  "SAT_CONTRADICTED",
]);
export const REFUSAL_REASON_CODES = Object.freeze([
  "SOURCE_UNADMITTED",
  "SOURCE_REVISION_MISMATCH",
  "SOURCE_EXECUTABLE_MISMATCH",
  "CONTRACTS_DIGEST_MISMATCH",
  "SCHEMA_UNSUPPORTED",
  "SCHEMA_INVALID",
  "AUTHORITY_DELTA_NONZERO",
  "MISSION_BINDING_MISSING",
  "REQUIRED_EVIDENCE_REF_MISSING",
  "FRAME_EMPTY",
  "FRAME_OVERSIZE",
  "FRAME_MALFORMED_UTF8",
  "FRAME_JSON_INVALID",
]);
export const RECOVERY_REASON_CODES = Object.freeze([
  "SOURCE_UNAVAILABLE",
  "SOURCE_SESSION_CHANGED",
  "RESYNC_REQUIRED",
]);

// Field limits (ICD §7).
export const FIELD_LIMITS = Object.freeze({
  event_id_bytes: 128,
  mission_id_bytes: 256,
  component_id_bytes: 128,
  source_session_bytes: 128,
  revision_bytes: 256,
  reason_code_chars: 64,
  evidence_ref_bytes: 512,
  mission_label_scalars: 120,
  correlation_id_bytes: 128,
});

// Frame limits (ICD §13): the length prefix is uint32 big-endian and the
// payload is N bytes of UTF-8 JSON. An oversize length is refused BEFORE the
// payload is decoded — at this kernel boundary that means before any
// string materialization or JSON parse, not merely before dispatch.
export const REALM_FRAME_LIMITS = Object.freeze({
  min_frame_bytes: 1,
  max_frame_bytes: 32768,
});

// ICD §6.1 + §13 decode law (conformance cases C16, C17): every JSON payload
// is UTF-8; invalid UTF-8 is refused by name. This is the pure decode layer
// between the transport frame and the object-level admission functions above:
// Rust (.04) owns the socket, this kernel owns the LAW the socket must obey.
const STRICT_UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });
export function decodeRealmFrame(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError("decodeRealmFrame expects a Uint8Array frame");
  }
  if (bytes.byteLength < REALM_FRAME_LIMITS.min_frame_bytes) {
    return freezeShallow({ ok: false, reason_code: "FRAME_EMPTY" });
  }
  if (bytes.byteLength > REALM_FRAME_LIMITS.max_frame_bytes) {
    return freezeShallow({ ok: false, reason_code: "FRAME_OVERSIZE" });
  }
  let text;
  try {
    text = STRICT_UTF8_DECODER.decode(bytes);
  } catch {
    return freezeShallow({ ok: false, reason_code: "FRAME_MALFORMED_UTF8" });
  }
  try {
    return freezeShallow({ ok: true, value: JSON.parse(text) });
  } catch {
    return freezeShallow({ ok: false, reason_code: "FRAME_JSON_INVALID" });
  }
}

const RFC3339_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;
const REASON_CODE_RE = /^[A-Z][A-Z0-9_]*$/;

const TEXT_ENCODER = new TextEncoder();
function utf8Len(v) {
  return TEXT_ENCODER.encode(v).length;
}
function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function isNonNegativeInt(v) {
  return Number.isInteger(v) && v >= 0;
}

function freezeShallow(v) {
  return Object.isFrozen(v) ? v : Object.freeze(v);
}

function result(ok, reason_code = null, extra = {}) {
  return freezeShallow({ ok, reason_code, ...extra });
}

// ---------------------------------------------------------------------------
// Primitive validators
// ---------------------------------------------------------------------------

export function isValidSemanticState(v) {
  return SEMANTIC_STATES.includes(v);
}

export function isValidReasonCode(v) {
  if (typeof v !== "string") return false;
  if (!REASON_CODE_RE.test(v)) return false;
  if (v.length > FIELD_LIMITS.reason_code_chars) return false;
  return true;
}

export function isValidDigest(v) {
  return typeof v === "string" && /^sha256:[0-9a-f]{64}$/.test(v);
}

export function isValidRfc3339Timestamp(v) {
  return typeof v === "string" && RFC3339_RE.test(v);
}

// authority_delta is load-bearing on EVERY production envelope: missing,
// non-integer and nonzero all refuse; there is NO default-to-zero shim.
export function checkAuthorityDelta(v) {
  if (typeof v !== "number" || !Number.isInteger(v)) return "missing";
  if (v !== 0) return "nonzero";
  return "ok";
}

function validateSourceIdentity(source) {
  if (!isPlainObject(source)) return "SOURCE_IDENTITY_UNKNOWN";
  const { component, revision, pid, session_id } = source;
  if (typeof component !== "string" || component.length === 0) {
    return "SOURCE_IDENTITY_UNKNOWN";
  }
  if (utf8Len(component) > FIELD_LIMITS.component_id_bytes) {
    return "SOURCE_IDENTITY_UNKNOWN";
  }
  if (typeof revision !== "string" || utf8Len(revision) > FIELD_LIMITS.revision_bytes) {
    return "SOURCE_IDENTITY_UNKNOWN";
  }
  if (!Number.isInteger(pid) || pid <= 0) return "SOURCE_PID_MISMATCH";
  if (
    typeof session_id !== "string" ||
    session_id.length === 0 ||
    utf8Len(session_id) > FIELD_LIMITS.source_session_bytes
  ) {
    return "SOURCE_IDENTITY_UNKNOWN";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Admission — ICD §17..§20
// ---------------------------------------------------------------------------

// `peer` is the injected SO_PEERCRED observation: { uid, pid, exe_sha256? }.
// `admitted` declares the qualification-pinned source: { component, revision,
// contracts_digest, uid, require_executable_digest? }.
// Same UID alone is NEVER sufficient identity.
export function admitHello({ hello, peer, admitted } = {}) {
  if (!isPlainObject(hello)) return result(false, "SCHEMA_INVALID");
  if (hello.schema !== REALM_HELLO_SCHEMA) {
    return result(false, "SCHEMA_UNSUPPORTED");
  }
  const delta = checkAuthorityDelta(hello.authority_delta);
  if (delta === "missing") return result(false, "SCHEMA_INVALID");
  if (delta === "nonzero") return result(false, "AUTHORITY_DELTA_NONZERO");

  if (!isPlainObject(peer) || !Number.isInteger(peer.uid) || !Number.isInteger(peer.pid)) {
    return result(false, "SOURCE_IDENTITY_UNKNOWN");
  }

  const identity_error = validateSourceIdentity(hello.source);
  if (identity_error) return result(false, identity_error);

  if (!isPlainObject(admitted)) return result(false, "SOURCE_UNADMITTED");
  if (peer.uid !== admitted.uid) return result(false, "SOURCE_UNADMITTED");
  if (peer.pid !== hello.source.pid) return result(false, "SOURCE_PID_MISMATCH");
  if (hello.source.component !== admitted.component) {
    return result(false, "SOURCE_UNADMITTED");
  }
  if (hello.source.revision !== admitted.revision) {
    return result(false, "SOURCE_REVISION_MISMATCH");
  }
  if (!isValidDigest(admitted.contracts_digest)) {
    return result(false, "CONTRACTS_DIGEST_MISMATCH");
  }
  if (hello.contracts_digest !== admitted.contracts_digest) {
    return result(false, "CONTRACTS_DIGEST_MISMATCH");
  }
  if (admitted.require_executable_digest === true) {
    if (
      typeof peer.exe_sha256 !== "string" ||
      !new RegExp(`^${peer.uid === undefined ? "" : ""}[0-9a-f]{64}$`).test(peer.exe_sha256)
    ) {
      // Identity cannot be established at the declared strictness: refuse,
      // never silently downgrade (ICD §18).
      return result(false, "SOURCE_IDENTITY_UNKNOWN");
    }
  }
  return result(true, null, { session_id: hello.source.session_id });
}

// ---------------------------------------------------------------------------
// Resync snapshot — ICD §21..§23
// ---------------------------------------------------------------------------

function validateStateConstraints(state, body) {
  // Returns a reason code when the state-specific requirement is unmet, else null.
  switch (state) {
    case "OFFLINE":
    case "IDLE":
    case "LISTENING":
    case "THINKING":
      return null;
    case "WORKING": {
      const id = body.mission ? body.mission.mission_id : body.mission_id;
      return typeof id === "string" && id.length > 0 &&
        utf8Len(id) <= FIELD_LIMITS.mission_id_bytes
        ? null
        : "MISSION_BINDING_MISSING";
    }
    case "NEEDS_HUMAN": {
      const attention = body.attention;
      const countOk = isPlainObject(attention) &&
        Number.isInteger(attention.count) && attention.count > 0;
      if (countOk) return null;
      const codes = Array.isArray(body.reason_codes) ? body.reason_codes : [];
      return codes.some((c) => isValidReasonCode(c)) ? null : "SCHEMA_INVALID";
    }
    case "VERIFYING": {
      const codes = Array.isArray(body.reason_codes) ? body.reason_codes : [];
      return codes.some((c) => VERIFICATION_REASON_CODES.includes(c))
        ? null
        : "SCHEMA_INVALID";
    }
    case "REFUSED": {
      // Any registry-valid code counts as a refusal/policy marker (ICD §27);
      // the refusal SUBSET above names the codes that specifically imply policy
      // refusals. Presence of at least one valid code is the constraint.
      const codes = Array.isArray(body.reason_codes) ? body.reason_codes : [];
      return codes.some((c) => isValidReasonCode(c)) ? null : "SCHEMA_INVALID";
    }
    case "VERIFIED_DONE": {
      const id = body.mission ? body.mission.mission_id : body.mission_id;
      const idOk = typeof id === "string" && id.length > 0 &&
        utf8Len(id) <= FIELD_LIMITS.mission_id_bytes;
      const refs = Array.isArray(body.evidence_refs) ? body.evidence_refs : [];
      const refsOk = refs.length >= 1 && refs.every(
        (r) => typeof r === "string" && utf8Len(r) <= FIELD_LIMITS.evidence_ref_bytes,
      );
      if (!idOk) return "MISSION_BINDING_MISSING";
      if (!refsOk) return "REQUIRED_EVIDENCE_REF_MISSING";
      return null;
    }
    case "RECOVERY":
    case "UNKNOWN": {
      const codes = Array.isArray(body.reason_codes) ? body.reason_codes : [];
      const pool = state === "RECOVERY" ? RECOVERY_REASON_CODES : null;
      return codes.some((c) =>
        isValidReasonCode(c) && (pool === null || pool.includes(c)),
      )
        ? null
        : "SCHEMA_INVALID";
    }
    default:
      return "SCHEMA_INVALID";
  }
}

export function validateResyncSnapshot({ snapshot, hello }) {
  if (!isPlainObject(snapshot)) return result(false, "SCHEMA_INVALID");
  if (snapshot.schema !== REALM_RESYNC_SCHEMA) {
    return result(false, "SCHEMA_UNSUPPORTED");
  }
  const delta = checkAuthorityDelta(snapshot.authority_delta);
  if (delta === "missing") return result(false, "SCHEMA_INVALID");
  if (delta === "nonzero") return result(false, "AUTHORITY_DELTA_NONZERO");
  if (!isValidRfc3339Timestamp(snapshot.issued_at)) {
    return result(false, "SCHEMA_INVALID");
  }
  if (!isPlainObject(snapshot.source)) return result(false, "SOURCE_IDENTITY_UNKNOWN");
  if (hello && isPlainObject(hello.source)) {
    if (snapshot.source.session_id !== hello.source.session_id) {
      return result(false, "SOURCE_SESSION_CHANGED");
    }
    if (snapshot.source.revision !== hello.source.revision) {
      return result(false, "SOURCE_REVISION_MISMATCH");
    }
  }
  if (!Number.isInteger(snapshot.sequence_anchor) || snapshot.sequence_anchor < 0) {
    return result(false, "SEQUENCE_GAP");
  }
  if (!isValidDigest(snapshot.current_event_digest)) {
    return result(false, "DIGEST_MISMATCH");
  }
  const cur = snapshot.current_snapshot;
  if (!isPlainObject(cur)) return result(false, "SCHEMA_INVALID");
  const curDelta = checkAuthorityDelta(cur.authority_delta);
  if (curDelta !== "ok") {
    return result(false, curDelta === "nonzero" ? "AUTHORITY_DELTA_NONZERO" : "SCHEMA_INVALID");
  }
  if (!isValidSemanticState(cur.semantic_state)) return result(false, "SCHEMA_INVALID");
  if (cur.semantic_state !== "OFFLINE") {
    const violation = validateStateConstraints(cur.semantic_state, cur);
    if (violation) return result(false, violation);
  }
  if (cur.resources !== undefined) {
    const r = cur.resources;
    if (!isPlainObject(r)) return result(false, "SCHEMA_INVALID");
    for (const key of ["cpu_percent", "gpu_percent", "ram_percent"]) {
      const v = r[key];
      if (v === undefined || v === null) continue;
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100) {
        return result(false, "SCHEMA_INVALID");
      }
    }
    if (!isValidRfc3339Timestamp(r.observed_at)) return result(false, "SCHEMA_INVALID");
  }
  return result(true, null, {
    sequence_anchor: snapshot.sequence_anchor,
    current_event_digest: snapshot.current_event_digest,
    semantic_state: cur.semantic_state,
  });
}

// ---------------------------------------------------------------------------
// Incremental events — ICD §24..§32
// ---------------------------------------------------------------------------

export function validateRealmEvent(event) {
  if (!isPlainObject(event)) return result(false, "SCHEMA_INVALID");
  if (event.schema !== REALM_EVENT_SCHEMA) return result(false, "SCHEMA_UNSUPPORTED");
  const delta = checkAuthorityDelta(event.authority_delta);
  if (delta === "missing") return result(false, "SCHEMA_INVALID");
  if (delta === "nonzero") return result(false, "AUTHORITY_DELTA_NONZERO");

  if (
    typeof event.event_id !== "string" ||
    event.event_id.length === 0 ||
    utf8Len(event.event_id) > FIELD_LIMITS.event_id_bytes
  ) {
    return result(false, "SCHEMA_INVALID");
  }
  if (!Number.isInteger(event.sequence) || event.sequence < 0) {
    return result(false, "SEQUENCE_GAP");
  }
  if (!isValidRfc3339Timestamp(event.issued_at)) return result(false, "SCHEMA_INVALID");
  if (!Number.isInteger(event.ttl_ms) || event.ttl_ms <= 0) {
    return result(false, "SCHEMA_INVALID");
  }
  const identity_error = validateSourceIdentity(event.source);
  if (identity_error) return result(false, identity_error);

  if (!REALM_EVENT_KINDS.includes(event.kind)) return result(false, "SCHEMA_UNSUPPORTED");
  if (event.kind === "presence.state_changed") {
    if (!isValidSemanticState(event.semantic_state)) return result(false, "SCHEMA_INVALID");
  } else if (event.semantic_state !== undefined) {
    if (!isValidSemanticState(event.semantic_state)) return result(false, "SCHEMA_INVALID");
  }
  if (event.correlation_id !== undefined) {
    if (
      typeof event.correlation_id !== "string" ||
      utf8Len(event.correlation_id) > FIELD_LIMITS.correlation_id_bytes
    ) {
      return result(false, "SCHEMA_INVALID");
    }
  }
  const codes = event.reason_codes;
  if (codes !== undefined) {
    if (!Array.isArray(codes)) return result(false, "SCHEMA_INVALID");
    for (const c of codes) {
      if (!isValidReasonCode(c)) return result(false, "SCHEMA_INVALID");
    }
  }
  if (event.evidence_refs !== undefined) {
    if (!Array.isArray(event.evidence_refs)) return result(false, "SCHEMA_INVALID");
    for (const r of event.evidence_refs) {
      if (typeof r !== "string" || utf8Len(r) > FIELD_LIMITS.evidence_ref_bytes) {
        return result(false, "REQUIRED_EVIDENCE_REF_MISSING");
      }
    }
  }
  if (event.payload !== undefined && !isPlainObject(event.payload)) {
    return result(false, "SCHEMA_INVALID");
  }
  if (!isValidDigest(event.prev_event_digest)) return result(false, "DIGEST_MISMATCH");
  if (!isValidDigest(event.event_digest)) return result(false, "DIGEST_MISMATCH");
  // Integrity law: the carried digest must equal the re-derived canonical
  // digest of this exact body. A tampered body with a stale signature refuses
  // here regardless of chain position.
  if (realmEventDigest(event) !== event.event_digest) {
    return result(false, "DIGEST_MISMATCH");
  }

  const effective_state = event.semantic_state;
  if (effective_state !== undefined && effective_state !== "OFFLINE") {
    const view = { ...event, mission: event.payload?.mission ?? event.mission_id, attention: event.payload?.attention };
    const violation = validateStateConstraints(effective_state, view);
    if (violation === "MISSION_BINDING_MISSING") return result(false, violation);
    if (violation === "REQUIRED_EVIDENCE_REF_MISSING") return result(false, violation);
    if (violation) return result(false, violation);
  }
  return result(true, null, { sequence: event.sequence });
}

export function realmEventDigest(event) {
  const { event_digest, ...body } = event;
  return sha256CanonicalJsonV1(body);
}

// ---------------------------------------------------------------------------
// Connection FSM + projection cursor — ICD §14, §28..§33, §102..§103
// ---------------------------------------------------------------------------

export function createProjectionSession() {
  return freezeShallow({
    phase: "HELLO_EXPECTED",
    session_id: null,
    revision: null,
    contracts_digest: null,
    last_sequence: null,
    last_event_digest: null,
    visible_state: "OFFLINE",
    freshness_connected: false,
    closed_reason: null,
    duplicates_ignored: 0,
  });
}

const CLOSE_RESULT = (session, code) => ({
  accepted: false,
  close: code,
  session: freezeShallow({
    ...session,
    phase: "CLOSED",
    closed_reason: code,
    visible_state: "UNKNOWN",
    freshness_connected: false,
  }),
});

export function applyFrame(session, frame) {
  if (!isPlainObject(frame) || typeof frame.schema !== "string") {
    return CLOSE_RESULT(session, "FRAME_MALFORMED");
  }
  if (session.phase === "CLOSED") {
    return CLOSE_RESULT(session, "SESSION_CLOSED");
  }

  if (session.phase === "HELLO_EXPECTED") {
    if (frame.schema !== REALM_HELLO_SCHEMA) {
      return CLOSE_RESULT(session, "PROTOCOL_PHASE_VIOLATION");
    }
    const verdict = admitHello(frame.__admission__);
    if (!verdict.ok) return CLOSE_RESULT(session, verdict.reason_code);
    return {
      accepted: true,
      close: null,
      session: freezeShallow({
        ...session,
        phase: "SNAPSHOT_EXPECTED",
        session_id: verdict.session_id,
        revision: frame.source.revision,
        contracts_digest: frame.contracts_digest,
      }),
    };
  }

  if (session.phase === "SNAPSHOT_EXPECTED") {
    if (frame.schema !== REALM_RESYNC_SCHEMA) {
      return CLOSE_RESULT(session, "PROTOCOL_PHASE_VIOLATION");
    }
    const verdict = validateResyncSnapshot({
      snapshot: frame,
      hello: { source: { session_id: session.session_id, revision: session.revision } },
    });
    if (!verdict.ok) return CLOSE_RESULT(session, verdict.reason_code);
    return {
      accepted: true,
      close: null,
      session: freezeShallow({
        ...session,
        phase: "STREAMING",
        last_sequence: verdict.sequence_anchor,
        last_event_digest: verdict.current_event_digest,
        visible_state: verdict.semantic_state,
        freshness_connected: true,
      }),
    };
  }

  // STREAMING
  if (frame.schema !== REALM_EVENT_SCHEMA) {
    return CLOSE_RESULT(session, "PROTOCOL_PHASE_VIOLATION");
  }
  if (frame.source.session_id !== session.session_id) {
    return CLOSE_RESULT(session, "SOURCE_SESSION_CHANGED");
  }
  const verdict = validateRealmEvent(frame);
  if (!verdict.ok) return CLOSE_RESULT(session, verdict.reason_code);

  // Sequence classification precedes the chain check so that a byte-identical
  // replay of the LAST accepted event is idempotently ignored rather than
  // misread as a broken chain (ICD §28 table order).
  const expected = session.last_sequence + 1;
  if (frame.sequence === session.last_sequence) {
    // Duplicate: idempotent iff byte-identical digest, contradiction otherwise.
    if (frame.event_digest === session.last_event_digest) {
      return {
        accepted: false,
        duplicate_ignored: true,
        close: null,
        session: freezeShallow({
          ...session,
          duplicates_ignored: session.duplicates_ignored + 1,
        }),
      };
    }
    return CLOSE_RESULT(session, "DUPLICATE_CONTRADICTION");
  }
  if (frame.sequence < session.last_sequence) {
    return CLOSE_RESULT(session, "SEQUENCE_ROLLBACK");
  }
  if (frame.sequence > expected) {
    return CLOSE_RESULT(session, "SEQUENCE_GAP");
  }

  if (frame.prev_event_digest !== session.last_event_digest) {
    return CLOSE_RESULT(session, "DIGEST_CHAIN_BROKEN");
  }

  const next_visible = frame.semantic_state !== undefined
    ? frame.semantic_state
    : session.visible_state;
  return {
    accepted: true,
    duplicate_ignored: false,
    close: null,
    session: freezeShallow({
      ...session,
      last_sequence: frame.sequence,
      last_event_digest: frame.event_digest,
      visible_state: next_visible,
      freshness_connected: true,
    }),
  };
}

// ---------------------------------------------------------------------------
// Freshness — ICD §31, §103 (no stale success)
// ---------------------------------------------------------------------------

export function classifyFreshness({ connected, age_ms, ttl_ms = REALM_PROTOCOL.default_ttl_ms }) {
  if (connected !== true) return "Disconnected";
  if (!Number.isFinite(age_ms) || age_ms < 0) return "Stale";
  if (age_ms <= REALM_PROTOCOL.heartbeat_interval_ms) return "Fresh";
  if (age_ms <= ttl_ms) return "Aging";
  return "Stale";
}

// A stale/disconnected freshness degrades ANY retained state — a previous
// successful render is never evidence of current success.
export function degradedVisibleState(semantic_state, freshness) {
  if (freshness === "Disconnected") return "OFFLINE";
  if (freshness === "Stale") return "UNKNOWN";
  return semantic_state;
}

// ---------------------------------------------------------------------------
// Transcript walker — drives the whole wire law over an ordered frame list.
//
// Clock discipline: `now_ms` is the ONLY time input (injected). Frames may
// carry an optional integer `__now_ms__` observation marker; without any
// injected time the walker reports age 0 (fresh) — it never invents a clock.
// ---------------------------------------------------------------------------

export function runRealmTranscript({ transcript, admission, peer, now_ms } = {}) {
  const blocks = [];
  let session = createProjectionSession();
  let frames = Array.isArray(transcript) ? transcript : [];
  let last_observed_ms = null;

  const observed = (frame) =>
    frame && Number.isInteger(frame.__now_ms__) ? frame.__now_ms__ : last_observed_ms;

  frames.forEach((frame, index) => {
    if (session.phase === "CLOSED") {
      blocks.push(`frame_${index}:closed_after:${session.closed_reason}`);
      return;
    }
    let enriched = frame;
    if (isPlainObject(frame) && frame.schema === REALM_HELLO_SCHEMA) {
      enriched = { ...frame, __admission__: { hello: frame, peer, admitted: admission } };
    }
    const step = applyFrame(session, enriched);
    session = step.session;
    if (step.close) {
      blocks.push(`frame_${index}:${step.close}`);
      return;
    }
    if (step.accepted && isPlainObject(frame)) {
      const mark = observed(frame);
      if (mark !== null && mark !== undefined) last_observed_ms = mark;
    }
  });

  const age_ms = now_ms !== undefined && Number.isFinite(now_ms)
    ? now_ms - (last_observed_ms ?? now_ms)
    : 0;
  const freshness = classifyFreshness({
    connected: session.freshness_connected,
    age_ms,
  });
  // A protocol-closed session already degraded its visible state to UNKNOWN at
  // close time (integrity breach is not a mere transport loss); freshness
  // degradation applies only to sessions still reporting live truth.
  const visible_state = session.phase === "CLOSED"
    ? session.visible_state
    : degradedVisibleState(session.visible_state, freshness);

  return freezeShallow({
    ok: blocks.length === 0,
    blocks: freezeShallow(blocks),
    final_phase: session.phase,
    visible_state,
    freshness,
    duplicates_ignored: session.duplicates_ignored,
    closed_reason: session.closed_reason,
  });
}

// ---------------------------------------------------------------------------
// Universal slice contract (consent gate, content addressing, verification)
// ---------------------------------------------------------------------------

export function drsRealmContractsBoundary() {
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

function validateInputShape(input) {
  const blocked_by = [];
  if (input.transcript !== undefined && !Array.isArray(input.transcript)) {
    blocked_by.push("input_transcript_not_array");
  }
  if (input.admitted !== undefined && !isPlainObject(input.admitted)) {
    blocked_by.push("input_admitted_not_object");
  }
  if (input.peer !== undefined && !isPlainObject(input.peer)) {
    blocked_by.push("input_peer_not_object");
  }
  return blocked_by;
}

export function planDrsRealmContracts({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== DRS_REALM_CONTRACTS_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    blocked_by.push("input_not_object");
  } else {
    blocked_by.push(...validateInputShape(input));
  }
  return Object.freeze({
    schema: DRS_REALM_CONTRACTS_SCHEMA,
    truth_label: DRS_REALM_CONTRACTS_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

export function buildDrsRealmContractsPayload(input) {
  const body = {
    schema: DRS_REALM_CONTRACTS_SCHEMA,
    truth_label: DRS_REALM_CONTRACTS_TRUTH_LABEL,
    canonicalization_algorithm: CANONICAL_JSON_V1_ALGORITHM,
    hash_algorithm: "sha256",
    text_encoding: "utf-8",
    input,
    boundary: drsRealmContractsBoundary(),
  };
  const content_hash = sha256CanonicalJsonV1(body);
  return Object.freeze({ ...body, content_hash });
}

export function verifyDrsRealmContracts(payload) {
  if (!isPlainObject(payload)) {
    return Object.freeze({ ok: false, reason: "payload_not_object" });
  }
  const { content_hash, ...body } = payload;
  const hash_check = verifyCanonicalJsonHashV1(body, content_hash);
  if (!hash_check.ok) {
    return Object.freeze({ ok: false, reason: hash_check.error_code });
  }
  if (body.schema !== DRS_REALM_CONTRACTS_SCHEMA) {
    return Object.freeze({ ok: false, reason: "schema_mismatch" });
  }
  if (body.truth_label !== DRS_REALM_CONTRACTS_TRUTH_LABEL) {
    return Object.freeze({ ok: false, reason: "truth_label_mismatch" });
  }
  for (const [key, value] of Object.entries(drsRealmContractsBoundary())) {
    if (body.boundary?.[key] !== value) {
      return Object.freeze({ ok: false, reason: `boundary_violation:${key}` });
    }
  }
  return Object.freeze({ ok: true, reason: null });
}

export function runDrsRealmContracts({ consent, input } = {}) {
  const plan = planDrsRealmContracts({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({
      ok: false,
      schema: DRS_REALM_CONTRACTS_SCHEMA,
      truth_label: DRS_REALM_CONTRACTS_TRUTH_LABEL,
      boundary: drsRealmContractsBoundary(),
      blocked_by: plan.blocked_by,
    });
  }

  const blocked_by = [];
  const walk = runRealmTranscript({
    transcript: input.transcript ?? [],
    admission: input.admitted ?? {},
    peer: input.peer ?? {},
  });
  if (!walk.ok) blocked_by.push(...walk.blocks);

  const payload = buildDrsRealmContractsPayload(input);
  const verified = verifyDrsRealmContracts(payload);
  if (!verified.ok) blocked_by.push(`verify_failed:${verified.reason}`);

  // Internal negative control: a tampered copy MUST fail verification.
  const tampered = { ...payload, truth_label: "TAMPER_PROBE" };
  if (verifyDrsRealmContracts(tampered).ok) {
    blocked_by.push("tamper_probe_passed");
  }

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: DRS_REALM_CONTRACTS_SCHEMA,
    truth_label: DRS_REALM_CONTRACTS_TRUTH_LABEL,
    content_hash: payload.content_hash,
    boundary: drsRealmContractsBoundary(),
    blocked_by: Object.freeze(blocked_by),
    walk,
  });
}
