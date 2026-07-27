// DEMA-MISSION-WORKER-HANDOFF-0A
//
// Minimum provable model-substitution case. A worker replacement compiles into
// the existing Node0 hash-chained realm log as a governed MISSION_CHECKPOINT.
// No parallel state machine, model router, persistence layer, or new authority.
//
// PREVIEW ONLY: the caller injects the prior event history and an external
// consent-receipt hash. This kernel does not persist, sign, execute, select a
// model, or prove independent authenticity.

import {
  makeNode0RealmEvent,
  reduceNode0RealmEvents,
} from "./node0-realm-state-kernel.js";

export const DEMA_MISSION_WORKER_HANDOFF_SCHEMA =
  "bizra.dema.mission_worker_handoff.v0.1";
export const DEMA_MISSION_WORKER_HANDOFF_TRUTH_LABEL =
  "DEMA_MISSION_WORKER_HANDOFF_PREVIEW";
export const DEMA_MISSION_WORKER_HANDOFF_GO_PHRASE =
  "GO: dema mission worker handoff preview";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const HANDOFF_REASONS = Object.freeze([
  "capability_mismatch",
  "capacity_exhausted",
  "operator_reassignment",
  "provider_unavailable",
]);
const INPUT_KEYS = Object.freeze([
  "acceptance",
  "authority_delta",
  "consent_receipt_hash",
  "events",
  "evidence_refs",
  "from_worker",
  "handoff_reason",
  "mission_id",
  "prohibited_effects",
  "to_worker",
]);
const WORKER_KEYS = Object.freeze(["capability_class", "worker_ref"]);
const SNAPSHOT_KEYS = Object.freeze([
  "acceptance_criteria_hash",
  "consent_scope_hash",
  "mission_contract_hash",
  "source_checkpoint_hash",
]);
const CONTINUITY_KEYS = Object.freeze([
  "acceptance_criteria_preserved",
  "authority_preserved",
  "consent_scope_preserved",
  "mission_contract_preserved",
  "source_checkpoint_preserved",
  "worker_changed",
]);
const OUTPUT_KEYS = Object.freeze([
  "authority_delta",
  "boundary",
  "continuity_status",
  "event_history",
  "handoff_event_id",
  "replay",
  "schema",
  "truth_label",
]);
const EVENT_KEYS = Object.freeze(["event_id", "kind", "payload", "prev_event", "seq"]);
const HANDOFF_PAYLOAD_KEYS = Object.freeze([
  "acceptance",
  "authority_delta",
  "checkpoint_type",
  "consent_receipt_hash",
  "continuity_proof",
  "evidence_refs",
  "from_worker",
  "handoff_reason",
  "mission_id",
  "prohibited_effects",
  "to_worker",
]);
const REPLAY_KEYS = Object.freeze(["blocked_by", "events_applied", "head", "ok"]);
const HEAD_KEYS = Object.freeze(["event_id", "seq"]);

function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const key of Object.keys(value)) deepFreeze(value[key], seen);
  return Object.freeze(value);
}

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  if (Object.getOwnPropertySymbols(value).length !== 0) return false;
  for (const name of Object.getOwnPropertyNames(value)) {
    const desc = Object.getOwnPropertyDescriptor(value, name);
    if (!desc || desc.get || desc.set || !desc.enumerable) return false;
  }
  return true;
}

function hasExactKeys(value, expected) {
  if (!isPlainRecord(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isNonBlank(value) {
  return typeof value === "string" && value.trim() !== "";
}

function isHash(value) {
  return typeof value === "string" && HASH_PATTERN.test(value);
}

function isPlainArray(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false;
  if (Object.getOwnPropertySymbols(value).length !== 0) return false;
  for (const name of Object.getOwnPropertyNames(value)) {
    if (name === "length") continue;
    const index = Number(name);
    if (!Number.isInteger(index) || index < 0 || index >= value.length || String(index) !== name) return false;
    const desc = Object.getOwnPropertyDescriptor(value, name);
    if (!desc || desc.get || desc.set) return false;
  }
  for (let i = 0; i < value.length; i++) if (!Object.prototype.hasOwnProperty.call(value, i)) return false;
  return true;
}

function isStringSet(value, { nonEmpty = true } = {}) {
  if (!isPlainArray(value)) return false;
  if (nonEmpty && value.length === 0) return false;
  const seen = new Set();
  for (const item of value) {
    if (!isNonBlank(item) || seen.has(item)) return false;
    seen.add(item);
  }
  return true;
}

function isSortedStrings(value) {
  return isStringSet(value, { nonEmpty: false }) && value.every((item, index) => index === 0 || value[index - 1] <= item);
}

function validWorker(value) {
  return hasExactKeys(value, WORKER_KEYS) && isNonBlank(value.worker_ref) && isNonBlank(value.capability_class);
}

function validSnapshot(value) {
  return hasExactKeys(value, SNAPSHOT_KEYS) && SNAPSHOT_KEYS.every((key) => isHash(value[key]));
}

function continuityProof(before, after, fromWorker, toWorker, authorityDelta) {
  return Object.freeze({
    acceptance_criteria_preserved: before.acceptance_criteria_hash === after.acceptance_criteria_hash,
    authority_preserved: authorityDelta === 0,
    consent_scope_preserved: before.consent_scope_hash === after.consent_scope_hash,
    mission_contract_preserved: before.mission_contract_hash === after.mission_contract_hash,
    source_checkpoint_preserved: before.source_checkpoint_hash === after.source_checkpoint_hash,
    worker_changed: fromWorker.worker_ref !== toWorker.worker_ref,
  });
}

function proofAllTrue(proof) {
  return hasExactKeys(proof, CONTINUITY_KEYS) && CONTINUITY_KEYS.every((key) => proof[key] === true);
}

function normalizedStringSet(value) {
  return Object.freeze([...value].sort());
}

export function demaMissionWorkerHandoffBoundary() {
  return Object.freeze({
    acceptance_criteria_mutated: false,
    authority_increased: false,
    consent_scope_mutated: false,
    file_write_performed: false,
    live_execution_performed: false,
    mission_contract_mutated: false,
    model_invocation_performed: false,
    network_used: false,
    source_checkpoint_mutated: false,
  });
}

function boundaryAllFalse(boundary) {
  const expected = demaMissionWorkerHandoffBoundary();
  return hasExactKeys(boundary, Object.keys(expected).sort()) && Object.keys(expected).every((key) => boundary[key] === false);
}

function activeValidationBlocks(input) {
  const blocked = [];
  if (!hasExactKeys(input, INPUT_KEYS)) {
    blocked.push("input_shape_invalid");
    return blocked;
  }
  if (!Array.isArray(input.events)) blocked.push("events_not_array");
  if (!isNonBlank(input.mission_id)) blocked.push("mission_id_missing");
  if (!HANDOFF_REASONS.includes(input.handoff_reason)) blocked.push("handoff_reason_invalid");
  if (!validWorker(input.from_worker)) blocked.push("from_worker_invalid");
  if (!validWorker(input.to_worker)) blocked.push("to_worker_invalid");
  if (validWorker(input.from_worker) && validWorker(input.to_worker) && input.from_worker.worker_ref === input.to_worker.worker_ref) blocked.push("worker_not_changed");
  if (!hasExactKeys(input.acceptance, ["after", "before"])) {
    blocked.push("acceptance_shape_invalid");
  } else {
    if (!validSnapshot(input.acceptance.before)) blocked.push("before_snapshot_invalid");
    if (!validSnapshot(input.acceptance.after)) blocked.push("after_snapshot_invalid");
    if (validSnapshot(input.acceptance.before) && validSnapshot(input.acceptance.after)) {
      for (const key of SNAPSHOT_KEYS) if (input.acceptance.before[key] !== input.acceptance.after[key]) blocked.push(`${key}_drift`);
    }
  }
  if (!isHash(input.consent_receipt_hash)) blocked.push("consent_receipt_hash_invalid");
  if (!isStringSet(input.evidence_refs)) blocked.push("evidence_refs_invalid");
  if (!isStringSet(input.prohibited_effects)) blocked.push("prohibited_effects_invalid");
  if (input.authority_delta !== 0) blocked.push("authority_delta_nonzero");

  if (Array.isArray(input.events)) {
    const replay = reduceNode0RealmEvents(input.events);
    if (!replay.ok) {
      blocked.push(...replay.blocked_by.map((code) => `prior_replay:${code}`));
    } else if (!Object.hasOwn(replay.state.missions, input.mission_id)) {
      blocked.push("mission_not_declared");
    } else if (blocked.length === 0) {
      try {
        const before = { ...input.acceptance.before };
        const after = { ...input.acceptance.after };
        makeNode0RealmEvent({
          seq: replay.state.head.seq + 1,
          kind: "MISSION_CHECKPOINT",
          payload: {
            mission_id: input.mission_id,
            checkpoint_type: "WORKER_HANDOFF",
            handoff_reason: input.handoff_reason,
            from_worker: { ...input.from_worker },
            to_worker: { ...input.to_worker },
            acceptance: { before, after },
            consent_receipt_hash: input.consent_receipt_hash,
            evidence_refs: normalizedStringSet(input.evidence_refs),
            prohibited_effects: normalizedStringSet(input.prohibited_effects),
            continuity_proof: continuityProof(before, after, input.from_worker, input.to_worker, input.authority_delta),
            authority_delta: 0,
          },
          prev_event: replay.state.head.event_id,
        });
      } catch (err) {
        blocked.push(`proposed_event_not_canonicalizable:${err?.code ?? "unknown"}`);
      }
    }
  }
  return blocked;
}

export function planDemaMissionWorkerHandoff({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== DEMA_MISSION_WORKER_HANDOFF_GO_PHRASE) blocked_by.push("consent_phrase_mismatch");
  blocked_by.push(...activeValidationBlocks(input));
  return Object.freeze({
    schema: DEMA_MISSION_WORKER_HANDOFF_SCHEMA,
    truth_label: DEMA_MISSION_WORKER_HANDOFF_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

export function buildDemaMissionWorkerHandoffPayload(input) {
  const priorReplay = reduceNode0RealmEvents(input.events);
  if (!priorReplay.ok) throw new Error(`prior replay failed: ${priorReplay.blocked_by.join(",")}`);
  const before = { ...input.acceptance.before };
  const after = { ...input.acceptance.after };
  const fromWorker = { ...input.from_worker };
  const toWorker = { ...input.to_worker };
  const payload = {
    mission_id: input.mission_id,
    checkpoint_type: "WORKER_HANDOFF",
    handoff_reason: input.handoff_reason,
    from_worker: fromWorker,
    to_worker: toWorker,
    acceptance: { before, after },
    consent_receipt_hash: input.consent_receipt_hash,
    evidence_refs: normalizedStringSet(input.evidence_refs),
    prohibited_effects: normalizedStringSet(input.prohibited_effects),
    continuity_proof: continuityProof(before, after, fromWorker, toWorker, input.authority_delta),
    authority_delta: 0,
  };
  const event = makeNode0RealmEvent({
    seq: priorReplay.state.head.seq + 1,
    kind: "MISSION_CHECKPOINT",
    payload,
    prev_event: priorReplay.state.head.event_id,
  });
  const event_history = deepFreeze([...structuredClone(input.events), event]);
  const replay = reduceNode0RealmEvents(event_history);
  return deepFreeze({
    schema: DEMA_MISSION_WORKER_HANDOFF_SCHEMA,
    truth_label: DEMA_MISSION_WORKER_HANDOFF_TRUTH_LABEL,
    continuity_status: "MISSION_CONTINUES",
    event_history,
    handoff_event_id: event.event_id,
    replay: {
      ok: replay.ok,
      blocked_by: replay.blocked_by,
      events_applied: replay.events_applied,
      head: replay.ok ? replay.state.head : null,
    },
    authority_delta: 0,
    boundary: demaMissionWorkerHandoffBoundary(),
  });
}

export function verifyDemaMissionWorkerHandoff(payload) {
  if (!isPlainRecord(payload)) return Object.freeze({ ok: false, blocked_by: Object.freeze(["payload_not_plain_object"]) });
  const blocked_by = [];
  if (!hasExactKeys(payload, OUTPUT_KEYS)) blocked_by.push("payload_shape_invalid");
  if (payload.schema !== DEMA_MISSION_WORKER_HANDOFF_SCHEMA) blocked_by.push("schema_mismatch");
  if (payload.truth_label !== DEMA_MISSION_WORKER_HANDOFF_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  if (payload.continuity_status !== "MISSION_CONTINUES") blocked_by.push("continuity_status_mismatch");
  if (payload.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  if (!boundaryAllFalse(payload.boundary)) blocked_by.push("boundary_not_all_false");
  if (!isPlainArray(payload.event_history) || payload.event_history.length < 2) {
    blocked_by.push("event_history_invalid");
  } else {
    const replay = reduceNode0RealmEvents(payload.event_history);
    if (!replay.ok) {
      blocked_by.push(...replay.blocked_by.map((code) => `replay:${code}`));
    } else {
      const event = payload.event_history[payload.event_history.length - 1];
      const handoff = event.payload;
      if (!hasExactKeys(event, EVENT_KEYS)) blocked_by.push("handoff_event_shape_invalid");
      if (event.kind !== "MISSION_CHECKPOINT") blocked_by.push("handoff_event_kind_invalid");
      if (event.event_id !== payload.handoff_event_id) blocked_by.push("handoff_event_id_mismatch");
      const replaySummaryValid =
        hasExactKeys(payload.replay, REPLAY_KEYS) &&
        payload.replay.ok === true &&
        isPlainArray(payload.replay.blocked_by) &&
        payload.replay.blocked_by.length === 0 &&
        payload.replay.events_applied === replay.events_applied &&
        hasExactKeys(payload.replay.head, HEAD_KEYS) &&
        payload.replay.head.seq === replay.state.head.seq &&
        payload.replay.head.event_id === event.event_id;
      if (!replaySummaryValid) blocked_by.push("replay_summary_mismatch");
      if (!hasExactKeys(handoff, HANDOFF_PAYLOAD_KEYS) || handoff.checkpoint_type !== "WORKER_HANDOFF") {
        blocked_by.push("handoff_payload_invalid");
      } else {
        if (!HANDOFF_REASONS.includes(handoff.handoff_reason)) blocked_by.push("handoff_reason_invalid");
        if (!isNonBlank(handoff.mission_id)) blocked_by.push("mission_id_missing");
        if (!validWorker(handoff.from_worker)) blocked_by.push("from_worker_invalid");
        if (!validWorker(handoff.to_worker)) blocked_by.push("to_worker_invalid");
        if (validWorker(handoff.from_worker) && validWorker(handoff.to_worker) && handoff.from_worker.worker_ref === handoff.to_worker.worker_ref) blocked_by.push("worker_not_changed");
        if (!hasExactKeys(handoff.acceptance, ["after", "before"]) || !validSnapshot(handoff.acceptance.before) || !validSnapshot(handoff.acceptance.after)) {
          blocked_by.push("acceptance_snapshot_invalid");
        } else {
          for (const key of SNAPSHOT_KEYS) if (handoff.acceptance.before[key] !== handoff.acceptance.after[key]) blocked_by.push(`${key}_drift`);
        }
        if (!proofAllTrue(handoff.continuity_proof)) blocked_by.push("continuity_proof_invalid");
        if (handoff.authority_delta !== 0) blocked_by.push("handoff_authority_delta_nonzero");
        if (!isHash(handoff.consent_receipt_hash)) blocked_by.push("consent_receipt_hash_invalid");
        if (!isStringSet(handoff.evidence_refs)) blocked_by.push("evidence_refs_invalid");
        else if (!isSortedStrings(handoff.evidence_refs)) blocked_by.push("evidence_refs_not_sorted");
        if (!isStringSet(handoff.prohibited_effects)) blocked_by.push("prohibited_effects_invalid");
        else if (!isSortedStrings(handoff.prohibited_effects)) blocked_by.push("prohibited_effects_not_sorted");
      }
    }
  }
  return Object.freeze({ ok: blocked_by.length === 0, blocked_by: Object.freeze(blocked_by) });
}

export function runDemaMissionWorkerHandoff({ consent, input } = {}) {
  const fail = (blocked_by) => Object.freeze({
    ok: false,
    schema: DEMA_MISSION_WORKER_HANDOFF_SCHEMA,
    truth_label: DEMA_MISSION_WORKER_HANDOFF_TRUTH_LABEL,
    blocked_by: Object.freeze(blocked_by),
    authority_delta: 0,
    boundary: demaMissionWorkerHandoffBoundary(),
  });
  const plan = planDemaMissionWorkerHandoff({ consent, input });
  if (!plan.eligible) return fail([...plan.blocked_by]);
  const payload = buildDemaMissionWorkerHandoffPayload(input);
  const verdict = verifyDemaMissionWorkerHandoff(payload);
  if (!verdict.ok) return fail([...verdict.blocked_by]);
  return deepFreeze({ ok: true, blocked_by: Object.freeze([]), ...payload });
}

const H1 = `sha256:${"1".repeat(64)}`;
const H2 = `sha256:${"2".repeat(64)}`;
const H3 = `sha256:${"3".repeat(64)}`;
const H4 = `sha256:${"4".repeat(64)}`;
const H5 = `sha256:${"5".repeat(64)}`;
const GENESIS_MISSION_EVENT = makeNode0RealmEvent({
  seq: 1,
  kind: "MISSION_DECLARED",
  payload: {
    mission_id: "MISSION-CONTINUITY-MODEL-SWAP-0A",
    objective: "Restore and preserve a clean professional Dema codebase",
  },
  prev_event: "GENESIS",
});

export const DEMA_MISSION_WORKER_HANDOFF_CANONICAL_FIXTURE = deepFreeze({
  events: [GENESIS_MISSION_EVENT],
  mission_id: "MISSION-CONTINUITY-MODEL-SWAP-0A",
  handoff_reason: "capacity_exhausted",
  from_worker: { worker_ref: "worker:codex", capability_class: "codebase_audit_and_patch" },
  to_worker: { worker_ref: "worker:gpt-5.6-thinking", capability_class: "codebase_audit_and_patch" },
  acceptance: {
    before: { mission_contract_hash: H1, acceptance_criteria_hash: H2, consent_scope_hash: H3, source_checkpoint_hash: H4 },
    after: { mission_contract_hash: H1, acceptance_criteria_hash: H2, consent_scope_hash: H3, source_checkpoint_hash: H4 },
  },
  consent_receipt_hash: H5,
  evidence_refs: ["github:BizraInfo/Dema@efc2b438", "upload:codex-handoff"],
  prohibited_effects: ["branch_delete", "deploy", "merge", "pr_close", "push"],
  authority_delta: 0,
});

export const DEMA_MISSION_WORKER_HANDOFF_AUTHORITY_ATTACK_FIXTURE = deepFreeze({
  ...DEMA_MISSION_WORKER_HANDOFF_CANONICAL_FIXTURE,
  authority_delta: 1,
});

export const DEMA_MISSION_WORKER_HANDOFF_DRIFT_ATTACK_FIXTURE = deepFreeze({
  ...DEMA_MISSION_WORKER_HANDOFF_CANONICAL_FIXTURE,
  acceptance: {
    before: DEMA_MISSION_WORKER_HANDOFF_CANONICAL_FIXTURE.acceptance.before,
    after: { ...DEMA_MISSION_WORKER_HANDOFF_CANONICAL_FIXTURE.acceptance.after, consent_scope_hash: `sha256:${"6".repeat(64)}` },
  },
});
