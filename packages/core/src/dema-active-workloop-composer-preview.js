// DEMA-ACTIVE-WORKLOOP-COMPOSER-PREVIEW-1A — the missing bridge organ.
//
// PREVIEW_ONLY. NOT a daemon. NOT live autonomy. It does NOT run any organ,
// execute any task, scan content, mutate files, activate URP, or mint. It is a
// pure REFERENCE-COMPOSITION kernel: it takes references (ids/hashes) to the
// already-shipped Dema organs and composes them into ONE fail-closed operator
// work-envelope that says exactly: what Dema can safely do now, what needs
// consent, what needs approval, what is blocked, and the single next safe action.
//
// It references (does not re-implement) these shipped organs:
//   pain-goal-interview.js · mission.js / mission-loop-preview.js
//   node0-homebase-state-preview.js · node0-nodespace-boundary-preview.js
//   dema-node-space-bonding-file-steward.js · receipt-monitor-preview.js
//   absence-steward-queue-* · absence-steward-return-review.js · receipt previews
//
// Independent anchor: allowed_next_action, blocked_by, requires_approval, and the
// absence/return candidate refs are RE-DERIVED from the declared operator/monitor/
// task state. A forged envelope (e.g. "run_safe_task" while a monitor critical is
// present) is rejected because re-derivation disagrees with the stored fields.

import { createHash } from "node:crypto";

export const DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_SCHEMA =
  "bizra.dema.active_workloop_composer_preview.v0.1";
export const DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_TRUTH_LABEL =
  "DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_MEASURED_REPO";
export const DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_GO_PHRASE =
  "GO: dema active workloop composer preview";
export const DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_MODE = "preview_only";

export const AUTONOMY_LEVELS = Object.freeze(["L0", "L1", "L2", "L3", "L4", "L5"]);
// L3 and above are irreversible-capable / high-blast — they may not auto-run;
// they require explicit operator approval.
const APPROVAL_MIN_INDEX = 3;

export const ALLOWED_NEXT_ACTIONS = Object.freeze([
  "run_safe_task",
  "await_approval",
  "queue_for_absence",
  "return_review",
  "stop_blocked",
]);

const CORE_BODY_KEYS = Object.freeze([
  "schema",
  "truth_label",
  "mode",
  "workloop_id",
  "operator_goal",
  "operator_present",
  "unfinished",
  "returning",
  "pain_goal_ref",
  "mission_ref",
  "boundary_ref",
  "homebase_state_ref",
  "proposed_task_ref",
  "receipt_preview_ref",
  "monitor_status_ref",
  "required_consent",
  "requires_approval",
  "allowed_next_action",
  "absence_queue_candidate_ref",
  "return_review_ref",
  "blocked_by",
  "authority_delta",
  "boundary",
]);

const WHAT_THIS_PROVES = Object.freeze([
  "The shipped Dema organs (pain-goal, mission, homebase, NodeSpace boundary, file steward, receipt preview, monitor, absence queue, return review) compose by reference into one deterministic, content-addressed operator work-envelope.",
  "The envelope is fail-closed: a missing NodeSpace boundary, missing consent, missing receipt preview, a monitor critical, or an irreversible file action all block; an L3+ task requires explicit approval; an absent operator with unfinished work yields an absence-queue candidate; a returning operator yields a return-review candidate.",
  "allowed_next_action, blocked_by, requires_approval and the absence/return candidates are re-derived from the declared state, so a forged envelope that disagrees with its own state is rejected.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "It does not run any organ, execute any task, scan content, mutate files, use the network, start a daemon, activate URP, or mint; boundary is all-false and authority_delta is 0.",
  "It composes references only; it does not prove the referenced organs' own correctness beyond their recorded ids/hashes.",
  "It is not lived impact — it produces a safe work-envelope, not a completed task; real impact begins when a consented reversible action runs and is receipted.",
]);

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freezeDeep(child);
  return value;
}

function isRef(x) {
  return !!x && typeof x === "object" && typeof x.ref_id === "string" && x.ref_id.length > 0;
}

function isMonitorStatus(x) {
  return (
    !!x &&
    typeof x === "object" &&
    Number.isInteger(x.critical_count) &&
    x.critical_count >= 0 &&
    Number.isInteger(x.warning_count) &&
    x.warning_count >= 0
  );
}

function isProposedTask(x) {
  return (
    !!x &&
    typeof x === "object" &&
    typeof x.task_id === "string" &&
    x.task_id.length > 0 &&
    AUTONOMY_LEVELS.includes(x.autonomy_level) &&
    typeof x.irreversible === "boolean" &&
    typeof x.file_action === "boolean"
  );
}

// All-false boundary invariant.
export function demaActiveWorkloopComposerPreviewBoundary() {
  return Object.freeze({
    execution_performed: false,
    arbitrary_task_executed: false,
    daemon_started: false,
    network_used: false,
    file_mutation_performed: false,
    content_read_performed: false,
    model_invocation_performed: false,
    urp_write_performed: false,
    token_minted: false,
    wallet_accessed: false,
  });
}

function boundaryAllFalse(boundary) {
  if (!boundary || typeof boundary !== "object") return false;
  const canonical = demaActiveWorkloopComposerPreviewBoundary();
  const expected = Object.keys(canonical).sort();
  const actual = Object.keys(boundary).sort();
  if (expected.length !== actual.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (expected[i] !== actual[i]) return false;
    if (boundary[expected[i]] !== false) return false;
  }
  return true;
}

// Positive structural validation — the only source of "well-formed".
export function activeWorkloopValidationBlocks(input) {
  const blocked = [];
  if (!input || typeof input !== "object") {
    blocked.push("input_not_object");
    return blocked;
  }
  if (typeof input.operator_goal !== "string" || input.operator_goal.length === 0) {
    blocked.push("operator_goal_missing");
  }
  if (typeof input.operator_present !== "boolean") blocked.push("operator_present_invalid");
  if (typeof input.unfinished !== "boolean") blocked.push("unfinished_invalid");
  if (typeof input.returning !== "boolean") blocked.push("returning_invalid");
  if (!isRef(input.pain_goal_ref)) blocked.push("pain_goal_ref_missing");
  if (!isRef(input.mission_ref)) blocked.push("mission_ref_missing");
  if (!isRef(input.boundary_ref)) blocked.push("boundary_missing");
  if (!isRef(input.homebase_state_ref)) blocked.push("homebase_state_ref_missing");
  if (!isRef(input.receipt_preview_ref)) blocked.push("receipt_preview_missing");
  if (!isMonitorStatus(input.monitor_status)) blocked.push("monitor_status_invalid");
  if (!isProposedTask(input.proposed_task)) blocked.push("proposed_task_invalid");
  return blocked;
}

// The single source of derived truth. Reads a normalized state object (built
// payload or normalized input) and re-derives every conclusion. Used by build
// AND verify so a forged conclusion is caught.
export function deriveActiveWorkloopState(s) {
  const semantic_blocks = [];
  const crit = s.monitor_status_ref?.critical_count ?? 0;
  if (crit > 0) semantic_blocks.push("monitor_critical");
  if (s.proposed_task_ref?.irreversible === true) {
    semantic_blocks.push("irreversible_file_action");
  }

  const aidx = AUTONOMY_LEVELS.indexOf(s.proposed_task_ref?.autonomy_level);
  const requires_approval = aidx >= APPROVAL_MIN_INDEX;

  const absence_queue_candidate_ref =
    s.operator_present === false && s.unfinished === true
      ? { ref_id: `absence-queue-candidate:${s.proposed_task_ref?.task_id ?? "task"}` }
      : null;
  const return_review_ref =
    s.operator_present === true && s.returning === true
      ? { ref_id: `return-review-candidate:${s.workloop_id ?? "workloop"}` }
      : null;

  let allowed_next_action;
  if (semantic_blocks.length > 0) allowed_next_action = "stop_blocked";
  else if (s.operator_present === false && s.unfinished === true)
    allowed_next_action = "queue_for_absence";
  else if (s.operator_present === true && s.returning === true)
    allowed_next_action = "return_review";
  else if (requires_approval) allowed_next_action = "await_approval";
  else allowed_next_action = "run_safe_task";

  return {
    semantic_blocks,
    requires_approval,
    allowed_next_action,
    absence_queue_candidate_ref,
    return_review_ref,
    proceed_allowed: semantic_blocks.length === 0,
  };
}

// Fail-closed plan. Exact GO byte match + positive structural validation.
export function planDemaActiveWorkloopComposerPreview({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  blocked_by.push(...activeWorkloopValidationBlocks(input));
  return Object.freeze({
    schema: DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_SCHEMA,
    truth_label: DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

function pickCoreBody(source) {
  const core = {};
  for (const key of CORE_BODY_KEYS) core[key] = source[key];
  return core;
}

export function computeActiveWorkloopContentHash(coreBodyLike) {
  return `sha256:${sha256(stableStringify(pickCoreBody(coreBodyLike)))}`;
}

// Content-addressed work-envelope. Structural preconditions must already hold
// (planned eligible); this composes the references and the derived conclusions.
export function buildDemaActiveWorkloopComposerPreviewPayload(input) {
  const task = input.proposed_task;
  const proposed_task_ref = {
    ref_id: task.task_id,
    autonomy_level: task.autonomy_level,
    irreversible: task.irreversible,
    file_action: task.file_action,
  };
  const monitor_status_ref = {
    critical_count: input.monitor_status.critical_count,
    warning_count: input.monitor_status.warning_count,
  };
  const workloop_id =
    typeof input.workloop_id === "string" && input.workloop_id.length > 0
      ? input.workloop_id
      : `workloop:${task.task_id}`;

  const state = deriveActiveWorkloopState({
    workloop_id,
    operator_present: input.operator_present,
    unfinished: input.unfinished,
    returning: input.returning,
    monitor_status_ref,
    proposed_task_ref,
  });

  const coreBody = {
    schema: DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_SCHEMA,
    truth_label: DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_TRUTH_LABEL,
    mode: DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_MODE,
    workloop_id,
    operator_goal: input.operator_goal,
    operator_present: input.operator_present,
    unfinished: input.unfinished,
    returning: input.returning,
    pain_goal_ref: input.pain_goal_ref,
    mission_ref: input.mission_ref,
    boundary_ref: input.boundary_ref,
    homebase_state_ref: input.homebase_state_ref,
    proposed_task_ref,
    receipt_preview_ref: input.receipt_preview_ref,
    monitor_status_ref,
    required_consent: DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_GO_PHRASE,
    requires_approval: state.requires_approval,
    allowed_next_action: state.allowed_next_action,
    absence_queue_candidate_ref: state.absence_queue_candidate_ref,
    return_review_ref: state.return_review_ref,
    blocked_by: state.semantic_blocks,
    authority_delta: 0,
    boundary: demaActiveWorkloopComposerPreviewBoundary(),
  };

  const content_hash = computeActiveWorkloopContentHash(coreBody);
  return freezeDeep({
    ...coreBody,
    content_hash,
    workloop_hash: content_hash,
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
  });
}

// Body-bound re-derivation verifier.
export function verifyDemaActiveWorkloopComposerPreview(payload) {
  const blocked_by = [];
  if (!payload || typeof payload !== "object") {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["payload_not_object"]) });
  }

  const content_hash = payload.content_hash;
  if (typeof content_hash !== "string" || !/^sha256:[0-9a-f]{64}$/.test(content_hash)) {
    blocked_by.push("content_hash_malformed");
  } else if (computeActiveWorkloopContentHash(payload) !== content_hash) {
    blocked_by.push("content_hash_mismatch");
  }

  // Independent re-derivation of every conclusion from the declared state.
  const state = deriveActiveWorkloopState(payload);
  if (state.allowed_next_action !== payload.allowed_next_action) {
    blocked_by.push("allowed_next_action_not_rederivable");
  }
  if (state.requires_approval !== payload.requires_approval) {
    blocked_by.push("requires_approval_not_rederivable");
  }
  if (stableStringify(state.semantic_blocks) !== stableStringify(payload.blocked_by)) {
    blocked_by.push("blocked_by_not_rederivable");
  }
  if (
    stableStringify(state.absence_queue_candidate_ref) !==
    stableStringify(payload.absence_queue_candidate_ref)
  ) {
    blocked_by.push("absence_queue_candidate_not_rederivable");
  }
  if (stableStringify(state.return_review_ref) !== stableStringify(payload.return_review_ref)) {
    blocked_by.push("return_review_ref_not_rederivable");
  }

  if (!ALLOWED_NEXT_ACTIONS.includes(payload.allowed_next_action)) {
    blocked_by.push("allowed_next_action_out_of_vocab");
  }
  if (payload.required_consent !== DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_GO_PHRASE) {
    blocked_by.push("required_consent_invalid");
  }
  if (!boundaryAllFalse(payload.boundary)) blocked_by.push("boundary_not_all_false");
  if (payload.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  if (payload.mode !== DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_MODE) blocked_by.push("mode_invalid");
  if (payload.workloop_hash !== content_hash) blocked_by.push("workloop_hash_mismatch");

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_SCHEMA,
    truth_label: DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_TRUTH_LABEL,
    content_hash: typeof content_hash === "string" ? content_hash : null,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Runtime launder probe: forge the next action to "run_safe_task", recompute the
// hash, and assert verify STILL rejects when the true state does not support it.
function tamperProbeRejects(payload) {
  const trueState = deriveActiveWorkloopState(payload);
  // Vacuously satisfied when the true state already permits a safe run.
  if (trueState.allowed_next_action === "run_safe_task" && trueState.semantic_blocks.length === 0) {
    return true;
  }
  const forgedCore = { ...pickCoreBody(payload), allowed_next_action: "run_safe_task", blocked_by: [] };
  const forgedHash = computeActiveWorkloopContentHash(forgedCore);
  const forged = freezeDeep({ ...forgedCore, content_hash: forgedHash, workloop_hash: forgedHash });
  return verifyDemaActiveWorkloopComposerPreview(forged).ok === false;
}

// Orchestrator: plan -> build -> verify -> tamper-reject. Returns the envelope.
export function runDemaActiveWorkloopComposerPreview({ consent, input } = {}) {
  const boundary = demaActiveWorkloopComposerPreviewBoundary();
  const base = {
    schema: DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_SCHEMA,
    truth_label: DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_TRUTH_LABEL,
    mode: DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_MODE,
    boundary,
  };

  const plan = planDemaActiveWorkloopComposerPreview({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({ ...base, ok: false, proceed_allowed: false, blocked_by: plan.blocked_by });
  }

  const payload = buildDemaActiveWorkloopComposerPreviewPayload(input);
  const verified = verifyDemaActiveWorkloopComposerPreview(payload);
  const probeOk = tamperProbeRejects(payload);

  const blocked_by = [...verified.blocked_by, ...payload.blocked_by];
  if (!probeOk) blocked_by.push("tamper_probe_did_not_reject");

  // proceed_allowed is false when a semantic hard block (monitor critical /
  // irreversible) is present. The envelope is still returned for inspection.
  const proceed_allowed = payload.blocked_by.length === 0;
  const ok = verified.ok && probeOk && proceed_allowed;

  return Object.freeze({
    ...base,
    ok,
    proceed_allowed,
    workloop_id: payload.workloop_id,
    operator_goal: payload.operator_goal,
    operator_present: payload.operator_present,
    pain_goal_ref: payload.pain_goal_ref,
    mission_ref: payload.mission_ref,
    boundary_ref: payload.boundary_ref,
    homebase_state_ref: payload.homebase_state_ref,
    proposed_task_ref: payload.proposed_task_ref,
    receipt_preview_ref: payload.receipt_preview_ref,
    monitor_status_ref: payload.monitor_status_ref,
    required_consent: payload.required_consent,
    requires_approval: payload.requires_approval,
    allowed_next_action: payload.allowed_next_action,
    absence_queue_candidate_ref: payload.absence_queue_candidate_ref,
    return_review_ref: payload.return_review_ref,
    content_hash: payload.content_hash,
    workloop_hash: payload.workloop_hash,
    authority_delta: payload.authority_delta,
    what_this_proves: payload.what_this_proves,
    what_this_does_not_prove: payload.what_this_does_not_prove,
    blocked_by: Object.freeze(blocked_by),
  });
}

// ---------------------------------------------------------------------------
// Fixtures shared by the review gate and the mirrored test.
// ---------------------------------------------------------------------------

// Present operator, reversible L2 task, clean monitor: the happy path — Dema can
// run the safe part now.
export const DEMA_ACTIVE_WORKLOOP_CANONICAL_FIXTURE = freezeDeep({
  workloop_id: "workloop:triage-2026-07-06",
  operator_goal: "organize my BIZRA workspace",
  operator_present: true,
  unfinished: false,
  returning: false,
  pain_goal_ref: { ref_id: "pain-goal:workspace-clutter", ref_hash: `sha256:${"1".repeat(64)}` },
  mission_ref: { ref_id: "mission:workspace-triage" },
  boundary_ref: { ref_id: "boundary:node0-nodespace", snapshot_hash: `sha256:${"2".repeat(64)}` },
  homebase_state_ref: { ref_id: "homebase:node0" },
  receipt_preview_ref: { ref_id: "receipt-preview:triage" },
  monitor_status: { critical_count: 0, warning_count: 0 },
  proposed_task: {
    task_id: "task:triage-report",
    autonomy_level: "L2",
    irreversible: false,
    file_action: false,
  },
});

// Malicious fixture: a monitor critical is present, so the composer must refuse a
// run and surface stop_blocked.
export const DEMA_ACTIVE_WORKLOOP_MALICIOUS_FIXTURE = freezeDeep({
  ...DEMA_ACTIVE_WORKLOOP_CANONICAL_FIXTURE,
  monitor_status: { critical_count: 1, warning_count: 0 },
});
