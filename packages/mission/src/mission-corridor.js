// DEMA-MISSION-CORRIDOR-0A — persistent mission control plane (PREVIEW_ONLY).
//
// "The model does not remember the mission. The mission remembers itself."
// A corridor is a sealed contract + an append-only, hash-chained journal.
// Status and resume points are PURE derivations over those two artifacts —
// never asserted, always recomputed. This module is control-plane only:
// no worker, no daemon, no execution, no model, no clock (now_iso injected).
//
// Transparent persistence is not a hidden daemon: state lives in disclosed
// files under $DEMA_HOME/missions/<id>/ written by the CLI layer with exact
// consent; this kernel never touches the filesystem.
//
// Serialization: bizra.canonical-json.v1 — the corridor is a NEW hash-bearing
// surface with no promoted legacy artifacts, so it adopts the canonical byte
// contract directly (first registered consumer under the M5.1B policy; see
// CANONICAL_JSON_V1_REGISTERED_CONSUMERS in canonical-json-v1-check.mjs).
// Every persisted body declares its algorithm identity explicitly.

import { CANONICAL_JSON_V1_ALGORITHM } from "../../canon/src/canonical-json-v1.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";
import { buildPreviewBoundary } from "../../core/src/boundary-schema.js";
import {
  buildConsentContext,
  evaluateContextBoundConsent,
} from "../../consent/src/root-bound-consent-envelope-preview.js";

export const MISSION_CORRIDOR_SCHEMA = "bizra.dema.mission_corridor.v0.1";
export const MISSION_CORRIDOR_EVENT_SCHEMA = "bizra.dema.mission_corridor_event.v0.1";
export const MISSION_CORRIDOR_STATUS_SCHEMA = "bizra.dema.mission_corridor_status.v0.1";
export const MISSION_CORRIDOR_TRUTH_LABEL = "PREVIEW_ONLY";

// Closed transition map — an unlisted transition fails closed. STOPPED is
// reachable from every non-terminal state (the kill switch is never blocked).
// CORRIDOR_STATES derives from this map: one source of truth.
export const CORRIDOR_TRANSITIONS = Object.freeze({
  CREATED: Object.freeze(["PREFLIGHT", "STOPPED"]),
  PREFLIGHT: Object.freeze(["PLANNING", "STOPPED"]),
  PLANNING: Object.freeze(["IMPLEMENTING", "STOPPED"]),
  IMPLEMENTING: Object.freeze(["VERIFYING", "STOPPED"]),
  VERIFYING: Object.freeze(["SAT_REVIEW", "REPAIRING", "CI_WAIT", "STOPPED"]),
  SAT_REVIEW: Object.freeze(["REPAIRING", "CI_WAIT", "CHECKPOINT", "STOPPED"]),
  REPAIRING: Object.freeze(["VERIFYING", "STOPPED"]),
  CI_WAIT: Object.freeze(["CHECKPOINT", "REPAIRING", "STOPPED"]),
  CHECKPOINT: Object.freeze(["PLANNING", "COMPLETE", "STOPPED"]),
  STOPPED: Object.freeze([]),
  COMPLETE: Object.freeze([]),
});

export const CORRIDOR_STATES = Object.freeze(Object.keys(CORRIDOR_TRANSITIONS));

const TERMINAL_STATES = Object.freeze(["STOPPED", "COMPLETE"]);
const MERGE_POLICIES = Object.freeze(["checkpoint_required"]);
// path-safe by construction: lowercase kebab, no separators, no dots.
export const MISSION_ID_RE = /^[a-z0-9][a-z0-9-]{2,63}$/;
const SHA40_RE = /^[0-9a-f]{40}$/;
const MAX_OBJECTIVE_CHARS = 2000;
const MAX_TIME_BUDGET_HOURS = 168;
const MAX_REPAIR_BUDGET = 10;

function isValidIso(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

// Algorithm identity carried by every persisted corridor body (contract and
// journal events) so future verifiers never have to guess the byte contract.
const CANONICALIZATION_IDENTITY = Object.freeze({
  canonicalization_algorithm: CANONICAL_JSON_V1_ALGORITHM,
  hash_algorithm: "sha256",
  text_encoding: "utf-8",
});


export function buildMissionContract({
  mission_id,
  objective,
  base_sha,
  permitted_actions,
  merge_policy,
  time_budget_hours,
  repair_budget_per_slice,
  stop_conditions,
  created_at_iso,
} = {}) {
  const blocked_by = [];
  if (typeof mission_id !== "string" || !MISSION_ID_RE.test(mission_id)) {
    blocked_by.push("mission_id_invalid");
  }
  if (typeof objective !== "string" || objective.trim().length === 0 || objective.length > MAX_OBJECTIVE_CHARS) {
    blocked_by.push("objective_invalid");
  }
  if (typeof base_sha !== "string" || !SHA40_RE.test(base_sha)) {
    blocked_by.push("base_sha_invalid");
  }
  if (
    !Array.isArray(permitted_actions) ||
    permitted_actions.length === 0 ||
    permitted_actions.some((a) => typeof a !== "string" || a.trim().length === 0)
  ) {
    blocked_by.push("permitted_actions_invalid");
  }
  if (!MERGE_POLICIES.includes(merge_policy)) {
    blocked_by.push("merge_policy_invalid");
  }
  if (
    typeof time_budget_hours !== "number" ||
    !Number.isFinite(time_budget_hours) ||
    time_budget_hours <= 0 ||
    time_budget_hours > MAX_TIME_BUDGET_HOURS
  ) {
    blocked_by.push("time_budget_invalid");
  }
  if (
    !Number.isInteger(repair_budget_per_slice) ||
    repair_budget_per_slice < 0 ||
    repair_budget_per_slice > MAX_REPAIR_BUDGET
  ) {
    blocked_by.push("repair_budget_invalid");
  }
  if (
    !Array.isArray(stop_conditions) ||
    stop_conditions.length === 0 ||
    stop_conditions.some((s) => typeof s !== "string" || s.trim().length === 0)
  ) {
    blocked_by.push("stop_conditions_invalid");
  }
  if (!isValidIso(created_at_iso)) {
    blocked_by.push("created_at_invalid");
  }

  if (blocked_by.length > 0) {
    return Object.freeze({
      schema: MISSION_CORRIDOR_SCHEMA,
      truth_label: MISSION_CORRIDOR_TRUTH_LABEL,
      ok: false,
      blocked_by: Object.freeze(blocked_by),
      contract: null,
      contract_hash: null,
      boundary: buildPreviewBoundary(),
    });
  }

  const contract = Object.freeze({
    schema: MISSION_CORRIDOR_SCHEMA,
    ...CANONICALIZATION_IDENTITY,
    mission_id,
    objective,
    base_sha,
    permitted_actions: Object.freeze([...permitted_actions]),
    merge_policy,
    time_budget_hours,
    repair_budget_per_slice,
    stop_conditions: Object.freeze([...stop_conditions]),
    created_at_iso,
  });
  return Object.freeze({
    schema: MISSION_CORRIDOR_SCHEMA,
    truth_label: MISSION_CORRIDOR_TRUTH_LABEL,
    ok: true,
    blocked_by: Object.freeze([]),
    contract,
    contract_hash: sha256CanonicalJsonV1(contract),
    boundary: buildPreviewBoundary(),
  });
}

export function appendCorridorEvent({ contract_hash, journal, event } = {}) {
  const blocked_by = [];
  if (typeof contract_hash !== "string" || !/^sha256:[0-9a-f]{64}$/.test(contract_hash)) {
    blocked_by.push("contract_hash_invalid");
  }
  if (!Array.isArray(journal)) blocked_by.push("journal_not_array");
  if (!event || typeof event !== "object") blocked_by.push("event_not_object");
  if (blocked_by.length > 0) {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(blocked_by), event: null, journal: null });
  }

  const { state, at_iso, note, branch, head_sha, failing_gate, next_command, requires_human, repair_rounds_used } =
    event;
  if (!CORRIDOR_STATES.includes(state)) blocked_by.push("state_unknown");
  if (!isValidIso(at_iso)) blocked_by.push("at_iso_invalid");

  const last = journal.length > 0 ? journal[journal.length - 1] : null;
  if (!last) {
    if (state !== "CREATED") blocked_by.push("first_event_must_be_created");
  } else {
    if (TERMINAL_STATES.includes(last.state)) blocked_by.push("corridor_terminal");
    else if (CORRIDOR_STATES.includes(state) && !CORRIDOR_TRANSITIONS[last.state].includes(state)) {
      blocked_by.push("transition_not_allowed");
    }
    if (isValidIso(at_iso) && Date.parse(at_iso) < Date.parse(last.at_iso)) {
      blocked_by.push("at_iso_not_monotonic");
    }
    if (last.contract_hash !== contract_hash) blocked_by.push("contract_hash_changed");
  }

  const prevRounds = last ? last.repair_rounds_used : 0;
  const rounds = repair_rounds_used === undefined ? prevRounds : repair_rounds_used;
  if (!Number.isInteger(rounds) || rounds < 0) blocked_by.push("repair_rounds_invalid");
  else if (rounds < prevRounds) blocked_by.push("repair_rounds_decreased");

  if (blocked_by.length > 0) {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(blocked_by), event: null, journal: null });
  }

  const body = {
    schema: MISSION_CORRIDOR_EVENT_SCHEMA,
    ...CANONICALIZATION_IDENTITY,
    contract_hash,
    index: journal.length,
    prev_hash: last ? last.event_hash : null,
    state,
    at_iso,
    branch: branch ?? null,
    head_sha: head_sha ?? null,
    failing_gate: failing_gate ?? null,
    next_command: next_command ?? null,
    // STOPPED always requires a human: the kill switch ends the corridor and
    // only the operator can open the next one (SAT observation on 4407189).
    requires_human: requires_human === true || state === "STOPPED",
    repair_rounds_used: rounds,
    note: note ?? null,
  };
  const sealed = Object.freeze({ ...body, event_hash: sha256CanonicalJsonV1(body) });
  return Object.freeze({
    ok: true,
    blocked_by: Object.freeze([]),
    event: sealed,
    journal: Object.freeze([...journal, sealed]),
  });
}

export function verifyCorridorJournal({ contract, contract_hash, journal } = {}) {
  const blocked_by = [];
  if (!contract || typeof contract !== "object") blocked_by.push("contract_missing");
  else if (sha256CanonicalJsonV1(contract) !== contract_hash) blocked_by.push("contract_hash_mismatch");
  if (!Array.isArray(journal) || journal.length === 0) blocked_by.push("journal_empty");
  if (blocked_by.length > 0) return Object.freeze({ ok: false, blocked_by: Object.freeze(blocked_by) });

  let prevHash = null;
  let prevAt = null;
  let prevState = null;
  let prevRounds = 0;
  journal.forEach((e, i) => {
    // hash covers everything EXCEPT event_hash itself
    const { event_hash: _stored, ...bodyOnly } = e;
    if (sha256CanonicalJsonV1(bodyOnly) !== e.event_hash) blocked_by.push(`event_hash_mismatch:${i}`);
    if (e.index !== i) blocked_by.push(`index_mismatch:${i}`);
    if (e.prev_hash !== prevHash) blocked_by.push(`prev_hash_mismatch:${i}`);
    if (e.contract_hash !== contract_hash) blocked_by.push(`contract_hash_mismatch:${i}`);
    if (i === 0) {
      if (e.state !== "CREATED") blocked_by.push("first_event_must_be_created");
    } else {
      if (TERMINAL_STATES.includes(prevState)) blocked_by.push(`event_after_terminal:${i}`);
      else if (!CORRIDOR_TRANSITIONS[prevState]?.includes(e.state)) blocked_by.push(`transition_not_allowed:${i}`);
      if (Date.parse(e.at_iso) < Date.parse(prevAt)) blocked_by.push(`at_iso_not_monotonic:${i}`);
      if (e.repair_rounds_used < prevRounds) blocked_by.push(`repair_rounds_decreased:${i}`);
    }
    prevHash = e.event_hash;
    prevAt = e.at_iso;
    prevState = e.state;
    prevRounds = e.repair_rounds_used;
  });
  return Object.freeze({ ok: blocked_by.length === 0, blocked_by: Object.freeze(blocked_by) });
}

export function deriveCorridorStatus({ contract, contract_hash, journal, now_iso } = {}) {
  const verdict = verifyCorridorJournal({ contract, contract_hash, journal });
  const blocked_by = [...verdict.blocked_by];
  if (!isValidIso(now_iso)) blocked_by.push("now_iso_invalid");
  if (blocked_by.length > 0) {
    return Object.freeze({
      schema: MISSION_CORRIDOR_STATUS_SCHEMA,
      truth_label: MISSION_CORRIDOR_TRUTH_LABEL,
      ok: false,
      blocked_by: Object.freeze(blocked_by),
      boundary: buildPreviewBoundary(),
    });
  }

  const last = journal[journal.length - 1];
  const leaseEndMs = Date.parse(contract.created_at_iso) + contract.time_budget_hours * 3600 * 1000;
  const lease_expired = Date.parse(now_iso) > leaseEndMs;
  const repair_budget_remaining = contract.repair_budget_per_slice - last.repair_rounds_used;
  const terminal = TERMINAL_STATES.includes(last.state);

  // latest non-null of each resume field wins, walking the whole chain
  const resume = { branch: null, head_sha: null, failing_gate: null, next_command: null };
  for (const e of journal) {
    for (const k of Object.keys(resume)) if (e[k] !== null && e[k] !== undefined) resume[k] = e[k];
  }

  const requires_human = last.requires_human === true || lease_expired || repair_budget_remaining < 0;
  if (lease_expired) blocked_by.push("lease_expired");
  if (repair_budget_remaining < 0) blocked_by.push("repair_budget_exceeded");
  if (last.requires_human === true) blocked_by.push("human_decision_required");

  return Object.freeze({
    schema: MISSION_CORRIDOR_STATUS_SCHEMA,
    truth_label: MISSION_CORRIDOR_TRUTH_LABEL,
    ok: true,
    mission_id: contract.mission_id,
    contract_hash,
    state: last.state,
    terminal,
    lease_expired,
    repair_budget_remaining,
    requires_human,
    resume_point: Object.freeze(resume),
    events: journal.length,
    blocked_by: Object.freeze(blocked_by),
    boundary: buildPreviewBoundary(),
  });
}

// ---------------------------------------------------------------------------
// Root-bound consent (S2 reconciliation) — ROOT_BOUND_CONSENT_ENVELOPE_PREVIEW_REUSED.
// The existing consent-envelope preview kernel is imported UNMODIFIED; this
// module only derives the corridor's exact consent context. A phrase alone
// never authorizes a corridor write: consent binds mission id, contract hash,
// capability scope, mission root, action class, nonce, and expiry, and the
// operator commits to the derived consent_context_hash BEFORE the write.
// Pure: everything injected (nonce, expiry, now); no clock, no fs, no network.

export const CORRIDOR_STOP_REQUEST_SCHEMA = "bizra.dema.mission_corridor_stop_request.v0.1";
export const CORRIDOR_WRITE_ACTION_CLASS = "C3_LOCAL_WRITE";
const CONTRACT_HASH_RE = /^sha256:[0-9a-f]{64}$/;

export function corridorRequiredPhrase(kind, mission_id) {
  return kind === "STOP"
    ? `GO: stop mission corridor ${mission_id}`
    : `GO: start mission corridor ${mission_id}`;
}

// Derive the exact consent envelope for a corridor write. START binds the
// full contract as payload; STOP binds a stop-request body that carries the
// existing contract hash, so a start consent can never authorize a stop (and
// vice versa) even for the same mission.
export function buildCorridorConsentContext({
  kind,
  mission_id,
  contract_hash,
  permitted_actions,
  mission_root,
  nonce,
  expires_at,
} = {}) {
  const blocked_by = [];
  if (kind !== "START" && kind !== "STOP") blocked_by.push("consent_kind_invalid");
  if (typeof mission_id !== "string" || !MISSION_ID_RE.test(mission_id)) blocked_by.push("mission_id_invalid");
  if (typeof contract_hash !== "string" || !CONTRACT_HASH_RE.test(contract_hash)) blocked_by.push("contract_hash_invalid");
  if (
    kind === "START" &&
    (!Array.isArray(permitted_actions) || permitted_actions.length === 0)
  ) {
    blocked_by.push("permitted_actions_invalid");
  }
  if (typeof mission_root !== "string" || mission_root.trim().length === 0) blocked_by.push("mission_root_invalid");
  if (blocked_by.length > 0) {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(blocked_by), envelope: null });
  }

  const payload_hash =
    kind === "START"
      ? contract_hash
      : sha256CanonicalJsonV1({
          schema: CORRIDOR_STOP_REQUEST_SCHEMA,
          ...CANONICALIZATION_IDENTITY,
          mission_id,
          contract_hash,
          requested_state: "STOPPED",
        });
  const envelope = buildConsentContext({
    proposal_hash: contract_hash,
    action_class: CORRIDOR_WRITE_ACTION_CLASS,
    capability_scope_hash: sha256CanonicalJsonV1({
      kind,
      permitted_actions: kind === "START" ? [...permitted_actions] : ["stop_corridor"],
    }),
    payload_hash,
    root_set_hash: sha256CanonicalJsonV1({ roots: [mission_root] }),
    nonce,
    expires_at,
    required_phrase: corridorRequiredPhrase(kind, mission_id),
  });
  return Object.freeze({ ok: true, blocked_by: Object.freeze([]), envelope });
}

// Fail-closed corridor write consent. The operator supplies the phrase, nonce,
// expiry, and the consent_context_hash they approved; this re-derives the
// envelope from the ACTUAL context about to be written and blocks on any
// difference (changed contract, mission root, scope, kind, nonce, expiry) —
// so a captured phrase cannot be replayed against a different write.
export function evaluateCorridorWriteConsent({
  kind,
  mission_id,
  contract_hash,
  permitted_actions,
  mission_root,
  phrase,
  nonce,
  expires_at,
  consent_context_hash,
  now,
  used_nonces = [],
} = {}) {
  const built = buildCorridorConsentContext({
    kind, mission_id, contract_hash, permitted_actions, mission_root, nonce, expires_at,
  });
  if (!built.ok) {
    return Object.freeze({
      ok: false,
      blocked_by: built.blocked_by,
      verdict: "BLOCK",
      consent_context_hash: null,
      required_phrase: null,
      authority_delta: 0,
    });
  }
  const envelope = built.envelope;
  const blocked_by = [];
  if (typeof consent_context_hash !== "string" || consent_context_hash.length === 0) {
    blocked_by.push("consent_context_missing");
  } else if (consent_context_hash !== envelope.consent_context_hash) {
    blocked_by.push("consent_context_mismatch");
  }
  const evaluated = evaluateContextBoundConsent({
    envelope,
    presented: {
      phrase,
      proposal_hash: envelope.proposal_hash,
      payload_hash: envelope.payload_hash,
      capability_scope_hash: envelope.capability_scope_hash,
      root_set_hash: envelope.root_set_hash,
      action_class: envelope.action_class,
    },
    now,
    usedNonces: used_nonces,
  });
  blocked_by.push(...evaluated.blocked_by);
  const ok = blocked_by.length === 0 && evaluated.accepted;
  return Object.freeze({
    ok,
    blocked_by: Object.freeze(blocked_by),
    verdict: ok ? "PERMIT_PREVIEW" : "BLOCK",
    consent_context_hash: envelope.consent_context_hash,
    required_phrase: envelope.required_phrase,
    authority_delta: 0,
  });
}

// Deterministic proof loop for the review gate: contract → full happy path →
// derived status → tamper rejection. Pure; fixed timestamps.
export function runMissionCorridorFixture() {
  const blocked_by = [];
  const c = buildMissionContract({
    mission_id: "fixture-corridor",
    objective: "corridor fixture proof loop",
    base_sha: "0".repeat(40),
    permitted_actions: ["analyze", "branch", "edit", "test", "commit", "push", "open_draft_pr"],
    merge_policy: "checkpoint_required",
    time_budget_hours: 8,
    repair_budget_per_slice: 2,
    stop_conditions: ["historical_hash_change", "gate_weakened"],
    created_at_iso: "2026-01-01T00:00:00.000Z",
  });
  if (!c.ok) blocked_by.push("fixture_contract_failed");

  let journal = [];
  const path = [
    "CREATED", "PREFLIGHT", "PLANNING", "IMPLEMENTING", "VERIFYING",
    "SAT_REVIEW", "CI_WAIT", "CHECKPOINT", "COMPLETE",
  ];
  path.forEach((state, i) => {
    const r = appendCorridorEvent({
      contract_hash: c.contract_hash,
      journal,
      event: {
        state,
        at_iso: `2026-01-01T0${Math.min(i, 9)}:00:00.000Z`,
        branch: "feat/fixture",
        head_sha: "0".repeat(40),
        next_command: `step ${i + 1}`,
      },
    });
    if (!r.ok) blocked_by.push(`fixture_append_failed:${state}`);
    else journal = r.journal;
  });

  const status = deriveCorridorStatus({
    contract: c.contract,
    contract_hash: c.contract_hash,
    journal,
    now_iso: "2026-01-01T09:00:00.000Z",
  });
  if (!status.ok || status.state !== "COMPLETE" || !status.terminal) blocked_by.push("fixture_status_wrong");

  const tampered = [...journal];
  tampered[3] = { ...tampered[3], next_command: "forged" };
  if (verifyCorridorJournal({ contract: c.contract, contract_hash: c.contract_hash, journal: tampered }).ok) {
    blocked_by.push("fixture_tamper_not_rejected");
  }

  // Consent probe: root-bound consent permits the exact context and blocks a
  // swapped context (a phrase alone must never authorize a different write).
  const consentArgs = {
    kind: "START",
    mission_id: "fixture-corridor",
    contract_hash: c.contract_hash,
    permitted_actions: [...c.contract.permitted_actions],
    mission_root: "/fixture/dema-home/missions/fixture-corridor",
    nonce: "fixture-nonce-1",
    expires_at: "2026-01-01T12:00:00.000Z",
  };
  const consentCtx = buildCorridorConsentContext(consentArgs);
  if (!consentCtx.ok) blocked_by.push("fixture_consent_context_failed");
  const permit = evaluateCorridorWriteConsent({
    ...consentArgs,
    phrase: corridorRequiredPhrase("START", "fixture-corridor"),
    consent_context_hash: consentCtx.ok ? consentCtx.envelope.consent_context_hash : "",
    now: "2026-01-01T00:30:00.000Z",
  });
  if (!permit.ok) blocked_by.push("fixture_consent_not_permitted");
  const replayed = evaluateCorridorWriteConsent({
    ...consentArgs,
    mission_root: "/somewhere/else",
    phrase: corridorRequiredPhrase("START", "fixture-corridor"),
    consent_context_hash: consentCtx.ok ? consentCtx.envelope.consent_context_hash : "",
    now: "2026-01-01T00:30:00.000Z",
  });
  if (replayed.ok) blocked_by.push("fixture_consent_replay_not_blocked");

  return Object.freeze({
    schema: MISSION_CORRIDOR_SCHEMA,
    truth_label: MISSION_CORRIDOR_TRUTH_LABEL,
    ok: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
    contract_hash: c.contract_hash,
    events: journal.length,
    boundary: buildPreviewBoundary(),
  });
}
