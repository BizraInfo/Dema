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
// Serialization: shared consent-common stableStringify (the repo-standard
// legacy algorithm, 88 importers). Migration to bizra.canonical-json.v1 is
// M5.2+ scope — deliberately NOT adopted here while the adoption freeze holds.

import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { buildPreviewBoundary } from "../../core/src/boundary-schema.js";

export const MISSION_CORRIDOR_SCHEMA = "bizra.dema.mission_corridor.v0.1";
export const MISSION_CORRIDOR_EVENT_SCHEMA = "bizra.dema.mission_corridor_event.v0.1";
export const MISSION_CORRIDOR_STATUS_SCHEMA = "bizra.dema.mission_corridor_status.v0.1";
export const MISSION_CORRIDOR_TRUTH_LABEL = "PREVIEW_ONLY";

export const CORRIDOR_STATES = Object.freeze([
  "CREATED",
  "PREFLIGHT",
  "PLANNING",
  "IMPLEMENTING",
  "VERIFYING",
  "SAT_REVIEW",
  "REPAIRING",
  "CI_WAIT",
  "CHECKPOINT",
  "STOPPED",
  "COMPLETE",
]);

// Closed transition map — an unlisted transition fails closed. STOPPED is
// reachable from every non-terminal state (the kill switch is never blocked).
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

const TERMINAL_STATES = Object.freeze(["STOPPED", "COMPLETE"]);
const MERGE_POLICIES = Object.freeze(["checkpoint_required"]);
// path-safe by construction: lowercase kebab, no separators, no dots.
const MISSION_ID_RE = /^[a-z0-9][a-z0-9-]{2,63}$/;
const SHA40_RE = /^[0-9a-f]{40}$/;
const MAX_OBJECTIVE_CHARS = 2000;
const MAX_TIME_BUDGET_HOURS = 168;
const MAX_REPAIR_BUDGET = 10;

function isValidIso(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function contentHash(body) {
  return `sha256:${sha256(stableStringify(body))}`;
}

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
    contract_hash: contentHash(contract),
    boundary: buildPreviewBoundary(),
  });
}

function eventBody(fields) {
  // hash covers everything EXCEPT event_hash itself
  const { event_hash, ...body } = fields;
  return body;
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
    contract_hash,
    index: journal.length,
    prev_hash: last ? last.event_hash : null,
    state,
    at_iso,
    branch: branch ?? null,
    head_sha: head_sha ?? null,
    failing_gate: failing_gate ?? null,
    next_command: next_command ?? null,
    requires_human: requires_human === true,
    repair_rounds_used: rounds,
    note: note ?? null,
  };
  const sealed = Object.freeze({ ...body, event_hash: contentHash(body) });
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
  else if (contentHash(contract) !== contract_hash) blocked_by.push("contract_hash_mismatch");
  if (!Array.isArray(journal) || journal.length === 0) blocked_by.push("journal_empty");
  if (blocked_by.length > 0) return Object.freeze({ ok: false, blocked_by: Object.freeze(blocked_by) });

  let prevHash = null;
  let prevAt = null;
  let prevState = null;
  let prevRounds = 0;
  journal.forEach((e, i) => {
    if (contentHash(eventBody(e)) !== e.event_hash) blocked_by.push(`event_hash_mismatch:${i}`);
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
