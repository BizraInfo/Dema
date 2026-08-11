// GENESIS-MISSION-TRACE-SEAM-0A — the causality seam of the Genesis Loop.
//
// PURPOSE. Before Dema is allowed to act, she must be able to prove how she
// legitimately arrived at the boundary where action became possible. This
// module makes INTENTION → RISK → PREVIEW → CONSENT_REQUESTED reconstructable
// as a hash-chained causal journal BEFORE any authority or effect exists.
//
// CONSTITUTION (frozen — see /data/bizra/contracts/GENESIS-MISSION-TRACE-SEAM-0A.md):
//
//   TRACE EVENT   = one causal fact           TRACE ≠ AUTHORITY
//   TRACE JOURNAL = ordered causal history    TRACE ≠ RECEIPT
//   RECEIPT       = independently accepted    TRACE ≠ POINTER
//   POINTER       = authoritative now
//
// A trace can never grant. The strongest enforcement is the vocabulary itself:
// `authority_state` has exactly ONE legal value in v0.1 — "NOT_GRANTED" — so a
// forged consent-granted event is not merely rejected, it is UNREPRESENTABLE.
// Even a hand-authored object claiming otherwise fails journal verification.
//
// SUBSTRATE. The journal inherits the mission-corridor journal's laws:
// contract-hash binding on every event, strict sequence continuity, a
// previous_event_hash chain, and body-bound hashes over canonical-json-v1.
// The fail-open event log is deliberately NOT this seam's substrate — an
// explanation channel must never become the causal record of authority's
// approach. Data minimization is structural: events carry commitments
// (hashes/refs), never raw intention text, effect content, or any reasoning
// transcript.
//
// Pure kernel: no fs, no child process, no clock, no ambient store access.
// The spine result arrives from the pure walker; the journal is an array in,
// array out. Failure to record is itself a recorded fact: TRACE_UNAVAILABLE —
// a walk whose causality cannot be recorded may not claim traced success.

import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";
import { walkGenesisMissionSpine } from "./genesis-mission-spine.js";

export const GENESIS_TRACE_EVENT_SCHEMA = "bizra.dema.genesis_mission_trace_event.v0.1";
export const GENESIS_TRACE_TRUTH_LABEL = "GENESIS_TRACE_PREVIEW";

/// Closed event vocabulary. An event type not listed here cannot be built and
/// cannot verify. PREVIEW_REFUSED completes the stage symmetry (every stage has
/// its refusal form); there is deliberately NO effect event and NO granted
/// event — this seam ends at the consent frontier.
export const TRACE_EVENT_TYPES = Object.freeze([
  "INTENTION_ACCEPTED",
  "INTENTION_REFUSED",
  "RISK_CLASSIFIED",
  "RISK_REFUSED",
  "PREVIEW_SEALED",
  "PREVIEW_REFUSED",
  "CONSENT_REQUESTED",
  "CONSENT_BINDING_MISMATCH",
  "CONSENT_REFUSED",
  "TRACE_UNAVAILABLE",
]);

/// v0.1 can express exactly one authority state. Granting happens — if it ever
/// happens — in FATE and the receipt chain, never in a trace.
export const TRACE_AUTHORITY_STATES = Object.freeze(["NOT_GRANTED"]);

const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const spanId = (sequence) => `SP-${String(sequence).padStart(4, "0")}`;

const freezeCommitments = (list) =>
  Object.freeze((Array.isArray(list) ? list : []).map((c) =>
    Object.freeze({ name: String(c?.name ?? ""), hash: String(c?.hash ?? "") })));

function eventBody({
  trace_id, sequence, previous_event_hash, mission_id, mission_contract_hash,
  stage, event_type, causation_id, correlation_id, retry_of,
  input_commitments, output_commitments, preview_hash, consent_ref, outcome,
}) {
  return {
    schema: GENESIS_TRACE_EVENT_SCHEMA,
    truth_label: GENESIS_TRACE_TRUTH_LABEL,
    trace_id,
    span_id: spanId(sequence),
    parent_span_id: sequence > 1 ? spanId(sequence - 1) : null,
    sequence,
    previous_event_hash: previous_event_hash ?? null,
    mission_id,
    mission_contract_hash,
    stage,
    event_type,
    causation_id,
    correlation_id,
    retry_of: retry_of ?? null,
    input_commitments: freezeCommitments(input_commitments),
    output_commitments: freezeCommitments(output_commitments),
    preview_hash: preview_hash ?? null,
    authority_state: "NOT_GRANTED",
    consent_ref: consent_ref ?? null,
    outcome: outcome ?? null,
  };
}

/**
 * Build one causal fact. Fail-closed: an event outside the closed vocabularies
 * cannot be built at all.
 */
export function buildTraceEvent(args = {}) {
  if (!TRACE_EVENT_TYPES.includes(args.event_type)) {
    return Object.freeze({ ok: false, reason: "event_type_invalid", event: null });
  }
  // Callers may not select an authority state; only the single legal value is
  // representable. Passing anything else is an attempted forgery, named as such.
  if (args.authority_state !== undefined && args.authority_state !== "NOT_GRANTED") {
    return Object.freeze({ ok: false, reason: "authority_state_invalid", event: null });
  }
  if (typeof args.trace_id !== "string" || args.trace_id.length === 0) {
    return Object.freeze({ ok: false, reason: "trace_id_invalid", event: null });
  }
  if (!Number.isInteger(args.sequence) || args.sequence < 1) {
    return Object.freeze({ ok: false, reason: "sequence_invalid", event: null });
  }
  if (typeof args.mission_contract_hash !== "string" || !HASH_RE.test(args.mission_contract_hash)) {
    return Object.freeze({ ok: false, reason: "mission_contract_hash_invalid", event: null });
  }
  const body = eventBody(args);
  const event = Object.freeze({ ...body, event_hash: `sha256:${sha256CanonicalJsonV1(body).replace(/^sha256:/, "")}` });
  return Object.freeze({ ok: true, reason: null, event });
}

/**
 * Append one event to a journal. Pure: array in, array out. The fence laws are
 * the corridor journal's — strict sequence continuity and an unbroken
 * previous_event_hash chain, bound to one mission contract.
 */
export function appendTraceEvent({ journal, event, mission_contract_hash } = {}) {
  if (!Array.isArray(journal)) return Object.freeze({ ok: false, reason: "journal_not_array", journal: null });
  if (!event || typeof event !== "object") return Object.freeze({ ok: false, reason: "event_invalid", journal: null });
  if (event.mission_contract_hash !== mission_contract_hash) {
    return Object.freeze({ ok: false, reason: "contract_hash_mismatch", journal: null });
  }
  const expectedSeq = journal.length + 1;
  if (event.sequence !== expectedSeq) return Object.freeze({ ok: false, reason: "sequence_discontinuity", journal: null });
  const expectedPrev = journal.length === 0 ? null : journal[journal.length - 1].event_hash;
  if ((event.previous_event_hash ?? null) !== expectedPrev) {
    return Object.freeze({ ok: false, reason: "previous_event_hash_mismatch", journal: null });
  }
  return Object.freeze({ ok: true, reason: null, journal: Object.freeze([...journal, event]) });
}

/**
 * Verify a journal's causal integrity: every event re-derives its own hash,
 * the chain is unbroken, sequences are continuous, vocabularies are closed,
 * and every event is bound to the one mission contract. An empty journal is a
 * VALID CHAIN (nothing occurred) — but see verifyCausalMission: an empty chain
 * is never a completed causal mission.
 */
export function verifyTraceJournal({ journal, mission_contract_hash } = {}) {
  if (!Array.isArray(journal)) return Object.freeze({ ok: false, reason: "journal_not_array" });
  let prevHash = null;
  for (let i = 0; i < journal.length; i += 1) {
    const e = journal[i];
    if (!e || typeof e !== "object") return Object.freeze({ ok: false, reason: `event_${i + 1}_invalid` });
    if (e.schema !== GENESIS_TRACE_EVENT_SCHEMA) return Object.freeze({ ok: false, reason: "unknown_schema" });
    if (!TRACE_EVENT_TYPES.includes(e.event_type)) return Object.freeze({ ok: false, reason: "event_type_invalid" });
    if (!TRACE_AUTHORITY_STATES.includes(e.authority_state)) {
      return Object.freeze({ ok: false, reason: "authority_state_invalid" });
    }
    if (e.mission_contract_hash !== mission_contract_hash) {
      return Object.freeze({ ok: false, reason: "contract_hash_mismatch" });
    }
    if (e.sequence !== i + 1) return Object.freeze({ ok: false, reason: "sequence_discontinuity" });
    if (e.span_id !== spanId(i + 1)) return Object.freeze({ ok: false, reason: "span_id_mismatch" });
    if ((e.previous_event_hash ?? null) !== prevHash) {
      return Object.freeze({ ok: false, reason: "previous_event_hash_mismatch" });
    }
    const { event_hash, ...rest } = e;
    let recomputed;
    try {
      recomputed = `sha256:${sha256CanonicalJsonV1(rest).replace(/^sha256:/, "")}`;
    } catch {
      return Object.freeze({ ok: false, reason: "event_hash_underivable" });
    }
    if (recomputed !== event_hash) return Object.freeze({ ok: false, reason: "event_hash_mismatch" });
    prevHash = event_hash;
  }
  return Object.freeze({ ok: true, reason: null, length: journal.length });
}

/**
 * T-14 — the empty-trace false-green guard. A verifier handed an empty (or
 * stage-incomplete) journal may never report a completed causal mission. This
 * is the trace-plane twin of the receipt-chain lesson: no evidence is not
 * evidence of success, and zero required stages must not make emptiness a pass.
 */
export function verifyCausalMission({ journal, mission_contract_hash, required_stages } = {}) {
  if (!Array.isArray(journal) || journal.length === 0 ||
      !Array.isArray(required_stages) || required_stages.length === 0) {
    return Object.freeze({ ok: false, reason: "causal_mission_empty_no_proof" });
  }
  const chain = verifyTraceJournal({ journal, mission_contract_hash });
  if (!chain.ok) return chain;
  const present = new Set(journal.map((e) => e.event_type));
  const missing = required_stages.filter((s) => !present.has(s));
  if (missing.length > 0) {
    return Object.freeze({ ok: false, reason: `causal_stage_missing:${missing.join(",")}` });
  }
  return Object.freeze({ ok: true, reason: null });
}

/// Derive the causal event descriptions from one spine result. Pure projection:
/// the spine already carries every stage outcome; the trace commits to hashes,
/// never to content.
function eventsFromSpineResult(result, presentedConsentContextHash) {
  const events = [];
  if (result.stage === "INTENTION") {
    events.push({ event_type: "INTENTION_REFUSED", stage: "INTENTION", outcome: result.reason,
      output_commitments: result.intent_packet_hash ? [{ name: "intent_packet_hash", hash: result.intent_packet_hash }] : [] });
    return events;
  }
  events.push({ event_type: "INTENTION_ACCEPTED", stage: "INTENTION", outcome: "route_eligible",
    output_commitments: [{ name: "intent_packet_hash", hash: result.intent_packet_hash }] });

  if (result.stage === "RISK_ENVELOPE") {
    events.push({ event_type: "RISK_REFUSED", stage: "RISK_ENVELOPE", outcome: result.reason });
    return events;
  }
  events.push({ event_type: "RISK_CLASSIFIED", stage: "RISK_ENVELOPE",
    outcome: [...result.risk_classes].join(",") });

  if (result.stage === "PREVIEW") {
    events.push({ event_type: "PREVIEW_REFUSED", stage: "PREVIEW", outcome: result.reason });
    return events;
  }
  events.push({ event_type: "PREVIEW_SEALED", stage: "PREVIEW", outcome: "sealed",
    preview_hash: result.preview_hash,
    output_commitments: [{ name: "preview_hash", hash: result.preview_hash }] });

  const consent = result.consent;
  const bindingMismatch =
    consent?.consent_presented === true &&
    typeof presentedConsentContextHash === "string" &&
    typeof consent?.consent_context_hash === "string" &&
    presentedConsentContextHash !== consent.consent_context_hash;
  if (bindingMismatch) {
    events.push({ event_type: "CONSENT_BINDING_MISMATCH", stage: "CONSENT_GATE",
      outcome: consent.reason ?? "consent_binding_mismatch",
      preview_hash: result.preview_hash,
      input_commitments: [
        { name: "supplied_binding", hash: presentedConsentContextHash },
        { name: "required_binding", hash: consent.consent_context_hash },
      ] });
    return events;
  }
  if (consent?.verdict === "BLOCK" || consent?.verdict === "REFUSED") {
    events.push({ event_type: "CONSENT_REFUSED", stage: "CONSENT_GATE",
      outcome: `${consent.verdict}:${consent.reason ?? "unknown"}`,
      preview_hash: result.preview_hash,
      input_commitments: consent.consent_context_hash
        ? [{ name: "required_binding", hash: consent.consent_context_hash }] : [] });
    return events;
  }
  // CONSENT_REQUIRED and PERMIT_PREVIEW both journal as the request that was
  // made. Verified consent is deliberately NOT a distinct granted event —
  // authority_state stays NOT_GRANTED, because verified ≠ granted.
  events.push({ event_type: "CONSENT_REQUESTED", stage: "CONSENT_GATE",
    outcome: consent?.consent_verified === true
      ? "EXACT_CONTEXT_BOUND_CONSENT_VERIFIED" : (consent?.verdict ?? "CONSENT_REQUIRED"),
    preview_hash: result.preview_hash,
    input_commitments: consent?.consent_context_hash
      ? [{ name: "required_binding", hash: consent.consent_context_hash }] : [] });
  return events;
}

/**
 * The production seam (T-12): walk the spine AND record its causal history in
 * one act. Removing the trace half turns the production-wiring control RED
 * while the pure journal tests stay GREEN.
 *
 * Failure semantics (T-10): if any event cannot be built or appended, the walk
 * reports TRACE_UNAVAILABLE, its journal is null, and the traced result may
 * NOT claim success — a mission whose approach to authority cannot be
 * reconstructed has not traced-succeeded, whatever the spine said.
 */
export function runTracedSpineWalk({
  trace,
  appendEventFn = appendTraceEvent,
  ...spineArgs
} = {}) {
  const result = walkGenesisMissionSpine(spineArgs);

  const {
    trace_id, mission_id, mission_contract_hash,
    causation_id, correlation_id, retry_of,
  } = trace ?? {};

  let journal = Object.freeze([]);
  try {
    const described = eventsFromSpineResult(result, spineArgs.presentedConsentContextHash);
    for (let i = 0; i < described.length; i += 1) {
      const built = buildTraceEvent({
        ...described[i],
        trace_id, sequence: i + 1,
        previous_event_hash: i === 0 ? null : journal[journal.length - 1].event_hash,
        mission_id, mission_contract_hash, causation_id, correlation_id, retry_of,
      });
      if (!built.ok) throw new Error(`trace_build_failed:${built.reason}`);
      const appended = appendEventFn({ journal, event: built.event, mission_contract_hash });
      if (!appended || appended.ok !== true) {
        throw new Error(`trace_append_failed:${appended?.reason ?? "unknown"}`);
      }
      journal = appended.journal;
    }
  } catch {
    return Object.freeze({
      ok: false,
      trace_status: "TRACE_UNAVAILABLE",
      journal: null,
      result,
    });
  }

  return Object.freeze({
    ok: result.ok === true,
    trace_status: "TRACED",
    journal,
    result,
  });
}
