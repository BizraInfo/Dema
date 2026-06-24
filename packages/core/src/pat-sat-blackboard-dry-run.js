// PAT-SAT-BLACKBOARD-DRY-RUN-1A — PREVIEW_ONLY.
//
// A pure, deterministic kernel modeling a shared-state "blackboard" where PAT
// and SAT phases post entries under a precondition-driven controller.
//
// Coordination here is DESIGNED_NOT_LIVE. This kernel does NOT run any agent,
// invoke any model, advance any chain, mint any receipt, grant any reward, or
// contact any federation/network. There is no runtime, no RSI, no agent RL,
// no autopoietic loop, no model call. The "coordination" is a DETERMINISTIC
// FUNCTION OF THE SEED, not emergent intelligence.
//
// Purity: no fs, no network, no process, no Date/clock, no Math.random.
// Enforced by scripts/review/kernel-purity-check.mjs.

import { buildPreviewBoundary } from "./preview-boundary.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";

export const PAT_SAT_BLACKBOARD_DRY_RUN_SCHEMA =
  "bizra.dema.pat_sat_blackboard_dry_run.v0.1";

export const PAT_SAT_BLACKBOARD_DRY_RUN_TRUTH_LABEL =
  "PAT_SAT_BLACKBOARD_DRY_RUN_LOCAL_ONLY";

// Defensive halting guard. The declared dependency chain quiesces after 8
// posts; this cap is a hard upper bound so a malformed precondition set can
// never spin. It is NOT exercised in normal runs.
export const PAT_SAT_BLACKBOARD_MAX_STEPS = 32;

const ENTRY_TYPE_BY_SOURCE = Object.freeze({
  discover: "proposal",
  draft: "proposal",
  propose: "proposal",
  self_critique: "critique",
  verify: "verdict",
  gate: "constraint",
  refuse_or_permit_preview: "constraint",
  critique: "critique",
});

// Was a given source id already posted to the board?
function posted(board, id) {
  return board.some((entry) => entry.source_id === id);
}

// Step number(s) a source depends on, resolved against the current board.
function depSteps(board, ...sourceIds) {
  return sourceIds
    .map((sid) => {
      const found = board.find((entry) => entry.source_id === sid);
      return found ? found.step : null;
    })
    .filter((step) => step !== null);
}

// Knowledge sources (board writers), fixed priority order, each at most once.
// PAT loop: discover, draft, propose, self_critique.
// SAT loop: verify, gate, refuse_or_permit_preview, critique.
const SOURCES = Object.freeze([
  Object.freeze({
    id: "discover",
    loop: "PAT",
    precondition: (board, seed) => Boolean(seed.pain) && Boolean(seed.goal),
    summary: "PAT discovers candidate framing from the seed pain/goal.",
    depends_on: () => [],
  }),
  Object.freeze({
    id: "draft",
    loop: "PAT",
    precondition: (board) => posted(board, "discover"),
    summary: "PAT drafts a preview proposal from the discovery.",
    depends_on: (board) => depSteps(board, "discover"),
  }),
  Object.freeze({
    id: "propose",
    loop: "PAT",
    precondition: (board) => posted(board, "draft"),
    summary: "PAT proposes the drafted plan to the board.",
    depends_on: (board) => depSteps(board, "draft"),
  }),
  Object.freeze({
    id: "self_critique",
    loop: "PAT",
    precondition: (board) => posted(board, "propose"),
    summary: "PAT self-critiques its own proposal before SAT review.",
    depends_on: (board) => depSteps(board, "propose"),
  }),
  Object.freeze({
    id: "verify",
    loop: "SAT",
    precondition: (board) => posted(board, "propose"),
    summary: "SAT verifies the proposal against declared evidence.",
    depends_on: (board) => depSteps(board, "propose"),
  }),
  Object.freeze({
    id: "gate",
    loop: "SAT",
    precondition: (board) => posted(board, "verify"),
    summary: "SAT applies gate constraints to the verified proposal.",
    depends_on: (board) => depSteps(board, "verify"),
  }),
  Object.freeze({
    id: "refuse_or_permit_preview",
    loop: "SAT",
    precondition: (board) => posted(board, "gate"),
    summary: "SAT records a refuse-or-permit-preview constraint.",
    depends_on: (board) => depSteps(board, "gate"),
  }),
  Object.freeze({
    id: "critique",
    loop: "SAT",
    precondition: (board) => posted(board, "refuse_or_permit_preview"),
    summary: "SAT critiques the permit/refuse decision for the operator.",
    depends_on: (board) => depSteps(board, "refuse_or_permit_preview"),
  }),
]);

function eligibleIds(board, seed) {
  return SOURCES.filter(
    (src) => !posted(board, src.id) && src.precondition(board, seed),
  ).map((src) => src.id);
}

// Run the deterministic control loop, producing board + coordination_trace.
function runControlLoop(seed) {
  const board = [];
  const coordination_trace = [];
  let step = 0;
  let capReached = false;

  for (;;) {
    if (step >= PAT_SAT_BLACKBOARD_MAX_STEPS) {
      capReached = true;
      break;
    }
    const eligible = eligibleIds(board, seed);
    if (eligible.length === 0) break; // QUIESCENCE

    // Pick FIRST eligible in fixed priority order.
    const chosenId = eligible[0];
    const src = SOURCES.find((s) => s.id === chosenId);
    step += 1;
    const depends_on = src.depends_on(board);
    board.push({
      step,
      source_id: src.id,
      loop: src.loop,
      entry_type: ENTRY_TYPE_BY_SOURCE[src.id],
      summary: src.summary,
      depends_on,
    });
    coordination_trace.push({
      step,
      chosen: chosenId,
      reason: `precondition satisfied; first eligible in priority order (${src.loop} loop)`,
      eligible,
    });
  }

  return { board, coordination_trace, capReached };
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      deepFreeze(value[key]);
    }
  }
  return value;
}

export function buildPatSatBlackboardDryRun({ pain = null, goal = null } = {}) {
  const normPain = typeof pain === "string" && pain.trim() ? pain : null;
  const normGoal = typeof goal === "string" && goal.trim() ? goal : null;
  const seed = { pain: normPain, goal: normGoal };

  const { board, coordination_trace, capReached } = runControlLoop(seed);

  let final_state;
  if (!normPain || !normGoal) {
    final_state = "BLOCKED_INTERVIEW_INCOMPLETE";
  } else if (capReached) {
    final_state = "CAP_REACHED";
  } else {
    final_state = "QUIESCENT_CONSENT_READY";
  }

  const next_safe_actions =
    final_state === "QUIESCENT_CONSENT_READY"
      ? [
          "operator reviews the board entries",
          "operator may request a consent plan preview (still preview-only)",
        ]
      : final_state === "BLOCKED_INTERVIEW_INCOMPLETE"
        ? [
            "provide a non-empty --pain",
            "provide a non-empty --goal",
          ]
        : ["inspect coordination_trace for the halting cause"];

  const boundary = Object.freeze({
    ...buildPreviewBoundary(),
    live_coordination_performed: false,
    agent_runtime_executed: false,
    model_invoked: false,
  });

  const what_this_proves = [
    "a deterministic precondition-driven controller can sequence PAT and SAT board posts from a seed",
    "the dependency chain quiesces at a consent-ready critique without any runtime effect",
  ];

  const what_this_does_not_prove = [
    "this is NOT a live PAT/SAT runtime",
    "no agent executed",
    "no model invoked",
    "no reward, token, PoI, or federation",
    "coordination is a DETERMINISTIC FUNCTION OF THE SEED, not emergent intelligence or RSI",
    "preconditions are declared scaffolding, not learned",
  ];

  const envelopeWithoutHash = {
    schema: PAT_SAT_BLACKBOARD_DRY_RUN_SCHEMA,
    truth_label: PAT_SAT_BLACKBOARD_DRY_RUN_TRUTH_LABEL,
    seed,
    board,
    coordination_trace,
    final_state,
    next_safe_actions,
    boundary,
    what_this_proves,
    what_this_does_not_prove,
  };

  const preview_hash = sha256(stableStringify(envelopeWithoutHash));

  return deepFreeze({ ...envelopeWithoutHash, preview_hash });
}

export function verifyPatSatBlackboardDryRun(report) {
  const blocked_by = [];

  if (!report || typeof report !== "object") {
    return { ok: false, blocked_by: ["report_not_object"] };
  }

  const seed = report.seed ?? {};
  const expected = buildPatSatBlackboardDryRun({
    pain: seed.pain ?? null,
    goal: seed.goal ?? null,
  });

  if (report.truth_label !== expected.truth_label) {
    blocked_by.push("truth_label_mismatch");
  }

  // Boundary must be all-false.
  const boundary = report.boundary;
  const boundaryAllFalse =
    boundary &&
    typeof boundary === "object" &&
    Object.values(boundary).every((v) => v === false);
  if (!boundaryAllFalse) {
    blocked_by.push("boundary_not_all_false");
  }

  // Board must match the re-derived board exactly.
  if (stableStringify(report.board) !== stableStringify(expected.board)) {
    blocked_by.push("board_relaundered");
  }

  // Coordination trace must match the re-derived trace exactly.
  if (
    stableStringify(report.coordination_trace) !==
    stableStringify(expected.coordination_trace)
  ) {
    blocked_by.push("trace_mismatch");
  }

  // Preview hash must match a fresh re-derivation of the honest envelope.
  if (report.preview_hash !== expected.preview_hash) {
    blocked_by.push("preview_hash_mismatch");
  }

  // Body-bound catch-all: every envelope field is a pure function of the seed,
  // so the full body (minus preview_hash) must equal the freshly re-derived
  // envelope. This closes laundering of fields the specific checks above do not
  // cover — e.g. a forged final_state ("FAKE_LIVE_EXECUTED"), next_safe_actions,
  // what_this_does_not_prove, or a stealth extra all-false boundary key — that
  // leaves the honest preview_hash untouched.
  const { preview_hash: _reportHash, ...reportBody } = report;
  const { preview_hash: _expectedHash, ...expectedBody } = expected;
  if (stableStringify(reportBody) !== stableStringify(expectedBody)) {
    blocked_by.push("envelope_relaundered");
  }

  return { ok: blocked_by.length === 0, blocked_by };
}
