// NODE0-RECOVERY-OBSERVATION-1A — the classification contract for
// `recovery_after_worker_exit` <- node0_runtime_kill_resume.
//
// NOT ML. NOT runtime. NOT the supervisor. This kernel judges facts it is
// handed; it never spawns, watches, reads a file or kills anything. The
// conducting supervisor lives behind the governed Node0 boundary
// (ADR-042 operator bridge) and the INDEPENDENT OBSERVER — not the supervisor —
// is the only party allowed to supply these facts.
//
// WHAT THE ROW ACTUALLY ASKS. Not "did a replacement run?" but "did the loop
// resume WITHOUT HUMAN HANDS?" So the refusals are organised around every way a
// recovery can look autonomous without being it:
//
//   NO_SUPERVISOR               nothing was watching, so nothing decided
//   HARNESS_STARTED_REPLACEMENT the script always intended to start B
//   SUPERVISOR_WAS_TOLD         being handed the news is not detection
//   DEATH_NOT_DETECTED          it never observed the thing it reacted to
//   RECOVERY_NOT_DECIDED        it observed and did nothing
//   PREDECESSOR_STILL_LIVE      replacing a living worker is not recovery
//   HUMAN_RECOVERY_MARKER       a human hand was in the home the whole time
//   SELF_CERTIFIED              the supervisor graded its own work
//
// AND THE CONTROLS ARE PART OF THE VERDICT. If a home with no supervisor
// recovered anyway, or a harness-started run was accepted by this same kernel,
// or a live predecessor triggered a replacement, then autonomous detection is
// decorative rather than load-bearing. Those are CONTROL_DID_NOT_DISCRIMINATE,
// never silent passes.
//
// Pure: no fs, no network, no process, no clock, no random, no model call.

export const NODE0_RECOVERY_OBSERVATION_SCHEMA =
  "bizra.dema.node0_recovery_observation.v0.1";

/// Exported so an adapter IMPORTS the term rather than retyping it.
export const NODE0_RUNTIME_KILL_RESUME_SCOPE = "node0_runtime_kill_resume";

/// The ownership transaction id the worker and the observer must agree on. It
/// lives HERE, in the pure kernel, because importing it from the worker would
/// execute a runtime: that module has top-level side effects by design.
export const NODE0_RECOVERY_TRANSACTION_ID = "node0-recovery-proof";

export const RECOVERY_EVIDENCE_CLASSES = Object.freeze([
  "OBSERVED",
  "OPERATOR_ASSERTED",
  "TEST_INJECTION",
  "NONE",
]);

export const RECOVERY_VERDICTS = Object.freeze([
  "NOT_ATTEMPTED",
  "NOT_OBSERVED",
  "OPERATOR_ASSERTED_ONLY",
  "CONTROL_NOT_RUN",
  "CONTROL_DID_NOT_DISCRIMINATE",
  "SELF_CERTIFIED",
  "NO_SUPERVISOR",
  "SUPERVISOR_WAS_TOLD",
  "DEATH_NOT_DETECTED",
  "RECOVERY_NOT_DECIDED",
  "PREDECESSOR_STILL_LIVE",
  "NOT_KILLED",
  "HARNESS_STARTED_REPLACEMENT",
  "CHECKPOINT_INVALID",
  "MISSION_IDENTITY_CHANGED",
  "CONTRACT_HASH_MISMATCH",
  "CHECKPOINT_LINEAGE_BROKEN",
  "NO_LEGAL_TRANSITION",
  "STALE_NOT_FENCED",
  "AUTHORITY_WIDENED",
  "HUMAN_RECOVERY_MARKER",
  "HUMAN_INTERVENED",
  "RECOVERY_AFTER_EXIT_PROVEN",
]);

const CLEAN = "RECOVERY_AFTER_EXIT_PROVEN";
const FENCED = "STALE_OWNER_FENCED";
const isStr = (v) => typeof v === "string" && v.length > 0;
const isInt = (v) => Number.isInteger(v) && v >= 0;

/// The three controls that make autonomy load-bearing. Each must have been RUN
/// and must have come out the discriminating way.
const CONTROL_KEYS = Object.freeze([
  "no_supervisor_recovered",
  "harness_started_b_accepted",
  "alive_a_triggered_b",
]);

function classify(f, evidenceClass) {
  if (!f || typeof f !== "object") return "NOT_ATTEMPTED";
  if (evidenceClass === "OPERATOR_ASSERTED") return "OPERATOR_ASSERTED_ONLY";
  if (evidenceClass !== "OBSERVED") return "NOT_OBSERVED";

  const { supervisor: sup, predecessor: pre, successor: suc, durable: dur, fencing, human, authority, attribution, controls } = f;

  // The supervisor may not grade its own recovery. Checked first, because every
  // fact below is worthless if the party under judgement supplied the verdict.
  if (attribution?.certified_by !== "independent_observer") return "SELF_CERTIFIED";

  if (!controls) return "CONTROL_NOT_RUN";
  for (const k of CONTROL_KEYS) {
    if (typeof controls[k] !== "boolean") return "CONTROL_NOT_RUN";
    if (controls[k] === true) return "CONTROL_DID_NOT_DISCRIMINATE";
  }

  if (!sup || sup.running !== true) return "NO_SUPERVISOR";
  if (sup.told_about_kill !== false) return "SUPERVISOR_WAS_TOLD";
  if (sup.detected_death !== true || !isStr(sup.detection_method)) return "DEATH_NOT_DETECTED";
  if (sup.decided_recovery !== true) return "RECOVERY_NOT_DECIDED";

  if (!pre || pre.exited !== true) return "PREDECESSOR_STILL_LIVE";
  if (pre.killed_with !== "SIGKILL") return "NOT_KILLED";

  if (!suc || suc.started_by !== "supervisor") return "HARNESS_STARTED_REPLACEMENT";
  if (!dur || dur.checkpoint_valid !== true) return "CHECKPOINT_INVALID";
  if (suc.mission_id !== dur.mission_id) return "MISSION_IDENTITY_CHANGED";
  if (suc.contract_hash !== dur.contract_hash) return "CONTRACT_HASH_MISMATCH";
  if (!isStr(suc.resumed_checkpoint_hash) || suc.resumed_checkpoint_hash !== dur.checkpoint_hash) {
    return "CHECKPOINT_LINEAGE_BROKEN";
  }
  if (!isStr(suc.advanced_to_stage) || !isInt(suc.state_seq) || suc.state_seq <= (dur.state_seq ?? 0)) {
    return "NO_LEGAL_TRANSITION";
  }

  if (fencing?.stale_token_result !== FENCED) return "STALE_NOT_FENCED";
  if (!authority || !isStr(authority.before_hash) || authority.before_hash !== authority.after_hash) return "AUTHORITY_WIDENED";
  if (human?.manual_recovery_marker_present !== false) return "HUMAN_RECOVERY_MARKER";
  if (human?.commands_between_death_and_resume !== 0) return "HUMAN_INTERVENED";
  return CLEAN;
}

/**
 * Build one deep-frozen, re-derivable recovery observation.
 *
 * The digest covers the facts and the derived verdict and excludes `observed_at`:
 * two identical recoveries recorded years apart bind to the same witness.
 */
export function buildRecoveryObservation({ facts = null, evidenceClass = "NONE", observedAt = null, executedCodeHash = null, hash } = {}) {
  if (typeof hash !== "function") {
    throw new TypeError("buildRecoveryObservation requires an injected `hash`");
  }
  const cls = RECOVERY_EVIDENCE_CLASSES.includes(evidenceClass) ? evidenceClass : "NONE";
  const f = facts && typeof facts === "object" ? facts : null;

  const body = {
    schema: NODE0_RECOVERY_OBSERVATION_SCHEMA,
    evidence_class: cls,
    scope: NODE0_RUNTIME_KILL_RESUME_SCOPE,
    recovery_verdict: classify(f, cls),
    supervisor_pid: f?.supervisor?.pid ?? null,
    supervisor_running: f?.supervisor?.running ?? null,
    supervisor_told_about_kill: f?.supervisor?.told_about_kill ?? null,
    supervisor_detected_death: f?.supervisor?.detected_death ?? null,
    supervisor_detection_method: f?.supervisor?.detection_method ?? null,
    supervisor_decided_recovery: f?.supervisor?.decided_recovery ?? null,
    predecessor_pid: f?.predecessor?.pid ?? null,
    predecessor_exited: f?.predecessor?.exited ?? null,
    predecessor_killed_with: f?.predecessor?.killed_with ?? null,
    successor_pid: f?.successor?.pid ?? null,
    successor_started_by: f?.successor?.started_by ?? null,
    successor_mission_id: f?.successor?.mission_id ?? null,
    successor_contract_hash: f?.successor?.contract_hash ?? null,
    successor_resumed_checkpoint_hash: f?.successor?.resumed_checkpoint_hash ?? null,
    successor_advanced_to_stage: f?.successor?.advanced_to_stage ?? null,
    successor_state_seq: f?.successor?.state_seq ?? null,
    durable_mission_id: f?.durable?.mission_id ?? null,
    durable_contract_hash: f?.durable?.contract_hash ?? null,
    durable_checkpoint_hash: f?.durable?.checkpoint_hash ?? null,
    durable_checkpoint_valid: f?.durable?.checkpoint_valid ?? null,
    durable_state_seq: f?.durable?.state_seq ?? null,
    stale_token_result: f?.fencing?.stale_token_result ?? null,
    authority_before_hash: f?.authority?.before_hash ?? null,
    authority_after_hash: f?.authority?.after_hash ?? null,
    human_commands_between_death_and_resume: f?.human?.commands_between_death_and_resume ?? null,
    manual_recovery_marker_present: f?.human?.manual_recovery_marker_present ?? null,
    certified_by: f?.attribution?.certified_by ?? null,
    controls: f?.controls ? Object.fromEntries(CONTROL_KEYS.map((k) => [k, f.controls[k] ?? null])) : null,
    executed_code_hash: executedCodeHash,
    authority_delta: 0,
  };

  return Object.freeze({ ...body, observed_at: observedAt, observation_hash: hash(body) });
}

export function verifyRecoveryHash(observation, hash) {
  if (!observation || typeof hash !== "function") return false;
  const { observed_at: _o, observation_hash: carried, ...body } = observation;
  return isStr(carried) && hash(body) === carried;
}

export function isCleanEligibleRecovery(o) {
  return o?.evidence_class === "OBSERVED" && o?.recovery_verdict === CLEAN;
}
