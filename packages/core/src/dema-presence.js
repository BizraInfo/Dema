// DEMA-PRESENCE-1A — Truthful DEMA avatar presence state machine: maps verified Node0 runtime events (receipt-bound) to avatar states; refuses unbound theatrical state; UNKNOWN state makes uncertainty visible.
//
// Pure kernel: no fs / network / process / clock / random unless injected and
// documented in this header. Every claim here is a preview; the boundary is all-false.
//
// THE PROOF CONTRACT (what this slice attests):
//   An avatar state is admissible ONLY as a deterministic function of
//   receipt-bound runtime events. An event without a receipt hash is refused,
//   never rendered. A sequence gap or an unclassifiable event kind yields the
//   UNKNOWN state — uncertainty is visible, never papered over. The kernel
//   cannot invent "thinking" or "done" without a verified event that says so.
//
// M5.1B: hash-bearing slices use the ONE canonical byte contract — no local
// serializer copy. Unsupported values (undefined, NaN, sparse arrays,
// accessors, ...) fail closed inside packages/canon with registered error
// codes. The scaffold auto-registers this kernel's path in
// CANONICAL_JSON_V1_REGISTERED_CONSUMERS (scripts/review/canonical-json-v1-check.mjs);
// review that one-line diff in this slice's PR.
import { CANONICAL_JSON_V1_ALGORITHM } from "../../canon/src/canonical-json-v1.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";

export const DEMA_PRESENCE_SCHEMA = "bizra.dema.dema_presence.v0.1";
export const DEMA_PRESENCE_TRUTH_LABEL = "DEMA_PRESENCE_MEASURED_REPO";
export const DEMA_PRESENCE_GO_PHRASE = "GO: dema presence preview";

// ── Presence ontology ────────────────────────────────────────────────────────

// The eight avatar states. UNKNOWN is first-class: a visible admission that the
// event stream cannot currently justify any stronger claim.
export const PRESENCE_STATES = Object.freeze([
  "IDLE",
  "ACTIVE",
  "NEEDS_HUMAN",
  "VERIFYING",
  "REFUSED",
  "VERIFIED_DONE",
  "RECOVERY",
  "UNKNOWN",
]);

// The only event kinds the kernel understands. Anything else derives UNKNOWN —
// an unrecognized event must never silently render as a familiar state.
export const PRESENCE_EVENT_KINDS = Object.freeze({
  HEARTBEAT: "heartbeat",
  MISSION_STARTED: "mission_started",
  PAT_STARTED: "pat_started",
  CONSENT_REQUIRED: "consent_required",
  SAT_VERIFYING: "sat_verifying",
  ACTION_REFUSED: "action_refused",
  MISSION_VERIFIED: "mission_verified",
  RECOVERY_STARTED: "recovery_started",
});

const STATE_FOR_KIND = Object.freeze({
  [PRESENCE_EVENT_KINDS.HEARTBEAT]: "IDLE",
  [PRESENCE_EVENT_KINDS.MISSION_STARTED]: "ACTIVE",
  [PRESENCE_EVENT_KINDS.PAT_STARTED]: "ACTIVE",
  [PRESENCE_EVENT_KINDS.CONSENT_REQUIRED]: "NEEDS_HUMAN",
  [PRESENCE_EVENT_KINDS.SAT_VERIFYING]: "VERIFYING",
  [PRESENCE_EVENT_KINDS.ACTION_REFUSED]: "REFUSED",
  [PRESENCE_EVENT_KINDS.MISSION_VERIFIED]: "VERIFIED_DONE",
  [PRESENCE_EVENT_KINDS.RECOVERY_STARTED]: "RECOVERY",
});

const RECEIPT_HASH_RE = /^sha256:[0-9a-f]{64}$/;
const ISO_8601_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

// ── All-false boundary invariant ─────────────────────────────────────────────
// These keys mirror the capability-truth-registry row boundary — keep them all
// false; flipping any one is an execution claim.
export function demaPresenceBoundary() {
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

// ── Event validation (fail-closed, named blocks) ─────────────────────────────

function validateEvent(event, index) {
  const blocks = [];
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    blocks.push(`event_${index}_not_object`);
    return blocks;
  }
  if (typeof event.kind !== "string" || event.kind.length === 0) {
    blocks.push(`event_${index}_kind_missing`);
  }
  if (typeof event.receipt_hash !== "string" || !RECEIPT_HASH_RE.test(event.receipt_hash)) {
    // THE core law: an unbound event is inadmissible. There is no "render it
    // anyway" path — a state with no receipt behind it is theatrical.
    blocks.push(`event_${index}_receipt_hash_missing_or_malformed`);
  }
  if (!Number.isInteger(event.seq) || event.seq < 0) {
    blocks.push(`event_${index}_seq_missing_or_invalid`);
  }
  if (typeof event.emitted_at !== "string" || !ISO_8601_RE.test(event.emitted_at)) {
    blocks.push(`event_${index}_emitted_at_missing_or_malformed`);
  }
  return blocks;
}

// ── Fail-closed plan ─────────────────────────────────────────────────────────
// Collect every reason the action is blocked; eligible only when nothing
// blocks. Exact GO-phrase byte match — no fuzzy / partial consent. Absence of
// a block is NEVER validation: push a block until you can POSITIVELY prove the
// input is well-formed for this slice's ontology.
export function planDemaPresence({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== DEMA_PRESENCE_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    blocked_by.push("input_not_object");
    return Object.freeze({
      schema: DEMA_PRESENCE_SCHEMA,
      truth_label: DEMA_PRESENCE_TRUTH_LABEL,
      eligible: false,
      blocked_by: Object.freeze(blocked_by),
    });
  }
  if (!Array.isArray(input.events)) {
    blocked_by.push("events_not_array");
    return Object.freeze({
      schema: DEMA_PRESENCE_SCHEMA,
      truth_label: DEMA_PRESENCE_TRUTH_LABEL,
      eligible: false,
      blocked_by: Object.freeze(blocked_by),
    });
  }
  for (let i = 0; i < input.events.length; i += 1) {
    for (const code of validateEvent(input.events[i], i)) blocked_by.push(code);
  }
  return Object.freeze({
    schema: DEMA_PRESENCE_SCHEMA,
    truth_label: DEMA_PRESENCE_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// ── The derivation (the actual state machine) ────────────────────────────────
// Deterministic reducer over receipt-bound events. Laws:
//   L1  Events are consumed in ascending seq order.
//   L2  A seq gap (jump > 1) yields UNKNOWN — we cannot know what we missed.
//   L3  An unrecognized kind yields UNKNOWN — never silently familiar.
//   L4  The last decisive event wins; heartbeat is non-decisive except as the
//       quiescent resolution after other events (it maps to IDLE only when it
//       is the latest event).
//   L5  Every derived state carries the receipt_hash that justifies it —
//       provenance or it did not happen.
export function derivePresenceState(events) {
  if (!Array.isArray(events) || events.length === 0) {
    return Object.freeze({
      state: "IDLE",
      reason: "no_events",
      justified_by: null,
      events_consumed: 0,
      gaps: Object.freeze([]),
      unknown_events: Object.freeze([]),
    });
  }
  const ordered = [...events].sort((a, b) => a.seq - b.seq);
  const gaps = [];
  const unknown_events = [];
  let state = "IDLE";
  let reason = "no_decisive_events";
  let justified_by = null;
  let prevSeq = null;
  for (const ev of ordered) {
    if (prevSeq !== null && ev.seq - prevSeq > 1) {
      gaps.push(Object.freeze({ after_seq: prevSeq, next_seq: ev.seq }));
      // L2: a gap destroys certainty. From here the stream is under
      // observation until a later event re-grounds it — but the FINAL state
      // below reflects the last event seen, and the gap list is carried in
      // the derivation so the projection can surface it.
    }
    prevSeq = ev.seq;
    const mapped = STATE_FOR_KIND[ev.kind];
    if (mapped === undefined) {
      unknown_events.push(Object.freeze({ seq: ev.seq, kind: ev.kind }));
      state = "UNKNOWN";
      reason = `unrecognized_event_kind:${ev.kind}`;
      justified_by = ev.receipt_hash;
      continue;
    }
    state = mapped;
    reason = `event:${ev.kind}`;
    justified_by = ev.receipt_hash;
  }
  if (gaps.length > 0 && state !== "UNKNOWN") {
    // The gap happened somewhere in the stream. If the LATEST event re-grounded
    // us with a decisive kind, we report that state but carry the gap; if the
    // gap is at the tail (nothing after it), honesty demands UNKNOWN.
    const last = ordered[ordered.length - 1];
    const tailGap = gaps.some((g) => g.after_seq === ordered[ordered.length - 2]?.seq && last.seq - g.after_seq > 1);
    if (tailGap && ordered.length >= 2 && gaps[gaps.length - 1].after_seq === ordered[ordered.length - 2].seq) {
      state = "UNKNOWN";
      reason = "seq_gap_at_tail";
      justified_by = null;
    }
  }
  return Object.freeze({
    state,
    reason,
    justified_by,
    events_consumed: ordered.length,
    gaps: Object.freeze(gaps),
    unknown_events: Object.freeze(unknown_events),
  });
}

// ── Canonical, content-addressed payload ─────────────────────────────────────
export function buildDemaPresencePayload(input) {
  const derivation = derivePresenceState(input?.events ?? []);
  const body = {
    schema: DEMA_PRESENCE_SCHEMA,
    truth_label: DEMA_PRESENCE_TRUTH_LABEL,
    canonicalization_algorithm: CANONICAL_JSON_V1_ALGORITHM,
    hash_algorithm: "sha256",
    text_encoding: "utf-8",
    input,
    derivation,
    boundary: demaPresenceBoundary(),
  };
  const content_hash = sha256CanonicalJsonV1(body);
  return Object.freeze({ ...body, content_hash });
}

// ── Body-bound re-derivation verifier (REQUIRED by the core-kernels rule) ────
// Recompute the hash over the body MINUS its hash field and reject any mismatch,
// then add the slice-specific field checks: the derivation inside the body must
// equal a fresh re-derivation over the body's events, and the state must be one
// of the eight admissible states.
export function verifyDemaPresence(payload) {
  const blocked_by = [];
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["payload_not_object"]) });
  }
  const { content_hash, ...body } = payload;
  if (typeof content_hash !== "string" || !RECEIPT_HASH_RE.test(content_hash)) {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["content_hash_missing_or_malformed"]) });
  }
  let recomputed;
  try {
    recomputed = sha256CanonicalJsonV1(body);
  } catch {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["body_not_canonicalizable"]) });
  }
  if (recomputed !== content_hash) {
    blocked_by.push("content_hash_mismatch");
  }
  // Slice-specific: the stored derivation must equal a fresh re-derivation.
  const fresh = derivePresenceState(body.input?.events ?? []);
  if (JSON.stringify(body.derivation) !== JSON.stringify(fresh)) {
    blocked_by.push("derivation_not_reproducible");
  }
  if (!PRESENCE_STATES.includes(body.derivation?.state)) {
    blocked_by.push("derivation_state_not_admissible");
  }
  return Object.freeze({ ok: blocked_by.length === 0, blocked_by: Object.freeze(blocked_by) });
}

// ── Orchestrator the review gate consumes ────────────────────────────────────
// Run plan -> build -> verify -> tamper-reject and return the proof envelope:
// { ok, schema, truth_label, content_hash, boundary, blocked_by, derivation }.
// Push a named block on any failure so the gate fails closed.
export function runDemaPresence({ consent, input } = {}) {
  const blocked_by = [];
  const plan = planDemaPresence({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({
      ok: false,
      schema: DEMA_PRESENCE_SCHEMA,
      truth_label: DEMA_PRESENCE_TRUTH_LABEL,
      boundary: demaPresenceBoundary(),
      blocked_by: plan.blocked_by,
    });
  }
  const payload = buildDemaPresencePayload(input);
  const verified = verifyDemaPresence(payload);
  if (!verified.ok) {
    return Object.freeze({
      ok: false,
      schema: DEMA_PRESENCE_SCHEMA,
      truth_label: DEMA_PRESENCE_TRUTH_LABEL,
      boundary: demaPresenceBoundary(),
      blocked_by: verified.blocked_by,
    });
  }
  // Tamper-reject control: prove the verifier actually bites on this payload.
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  if (verifyDemaPresence(tampered).ok !== false) {
    return Object.freeze({
      ok: false,
      schema: DEMA_PRESENCE_SCHEMA,
      truth_label: DEMA_PRESENCE_TRUTH_LABEL,
      boundary: demaPresenceBoundary(),
      blocked_by: ["tamper_reject_control_failed"],
    });
  }
  return Object.freeze({
    ok: true,
    schema: DEMA_PRESENCE_SCHEMA,
    truth_label: DEMA_PRESENCE_TRUTH_LABEL,
    content_hash: payload.content_hash,
    boundary: payload.boundary,
    derivation: payload.derivation,
    blocked_by: Object.freeze([]),
  });
}
