// Process Mining Preview — `dema process-mining` slice.
//
// Analogical model: a quiet mirror. The system reads its own decision
// history (git log · memory entries · receipt list · branch state) and
// emits a schema-tagged JSON snapshot of operator-pattern metrics. It
// does not act on what it sees. It does not judge what it sees. It
// surfaces what is there, in the same canonical-boundary envelope as
// every other Dema preview.
//
// This is the L1.5 layer — between L1 (engineering metrics, captured by
// baseline-l1.mjs) and L2 (reasoning-shape, requiring fixture+scorer).
// L1.5 measures OPERATOR-DECISION patterns from session artifacts already
// on disk: commits, branches, memory files, working-tree state.
//
// Operating law applied:
//   The system that cannot see itself cannot improve itself.
//   The system that judges its operator is not a mirror — it is a verdict.
//   A mirror reflects. The operator decides.
//
// Per Key Maker Epistemic Conduct v0.1 §7, this builder emits a Mirror
// key by design: it reflects pattern, never prescribes correction.
//
// Read-only · no chain advance · no receipt mint · no model invocation.
// Deterministic given the same input metrics; no I/O inside the builder.

import { buildPreviewBoundary } from "./preview-boundary.js";

const REQUIRED_BLOCKED_EFFECTS = Object.freeze([
  "runtime_execution",
  "operator_judgment",
  "chain_advance",
  "canonical_minting",
  "federation_invocation",
  "external_network_call",
  "raw_corpus_scan",
]);

const MINING_SCOPE_DEFAULT =
  "git_log + memory_index + working_tree (READ_ONLY · no chain)";

function freezeMetrics(metrics) {
  if (metrics === null || metrics === undefined) {
    return Object.freeze({
      status: "metrics_unavailable",
      hint: "pass metrics object from gather-on-disk caller",
    });
  }
  const safe = {};
  for (const [key, value] of Object.entries(metrics)) {
    if (
      typeof value === "number" ||
      typeof value === "string" ||
      typeof value === "boolean"
    ) {
      safe[key] = value;
    } else if (Array.isArray(value)) {
      safe[key] = Object.freeze(
        value.filter((v) => typeof v === "string").map((v) => String(v)),
      );
    } else {
      // Drop non-primitive non-array values (defense against caller-injected
      // functions, symbols, objects with prototype pollution risk).
    }
  }
  return Object.freeze(safe);
}

function deriveRingStatus({
  ringArtifactsPresent = false,
  externalReviewerForms = 0,
} = {}) {
  if (externalReviewerForms > 0)
    return "Ring 1 earned — external reviewer form on record";
  if (ringArtifactsPresent)
    return "Ring 0 verified; Ring 1 pack sealed; Ring 1 not yet earned";
  return "Ring 0 verified; Ring 1 pack status unknown";
}

function deriveObservableNextStep({
  commitsHeldFromOrigin = 0,
  externalReviewerForms = 0,
  ringArtifactsPresent = false,
} = {}) {
  // OBSERVATIONAL only — never prescriptive. The miner reports what
  // pattern exists; the operator decides what to do.
  if (externalReviewerForms > 0) {
    return "external_reviewer_form_present_observable";
  }
  if (ringArtifactsPresent && commitsHeldFromOrigin > 0) {
    return "ring_1_pack_sealed_observable_and_commits_held_observable";
  }
  if (ringArtifactsPresent) {
    return "ring_1_pack_sealed_observable";
  }
  return "no_ring_1_artifact_observable";
}

export function buildProcessMiningPreview({
  decisionMetrics = null,
  doctrineMetrics = null,
  operatorPatternMetrics = null,
  miningScope = MINING_SCOPE_DEFAULT,
} = {}) {
  const operatorMetrics = operatorPatternMetrics ?? {};
  const ringStatus = deriveRingStatus(operatorMetrics);
  const nextObservable = deriveObservableNextStep(operatorMetrics);

  return Object.freeze({
    schema: "bizra.dema.process_mining_preview.v0.1",
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    mining_scope:
      typeof miningScope === "string" ? miningScope : MINING_SCOPE_DEFAULT,
    decision_metrics: freezeMetrics(decisionMetrics),
    doctrine_metrics: freezeMetrics(doctrineMetrics),
    operator_pattern_metrics: Object.freeze({
      ...freezeMetrics(operatorPatternMetrics),
      ring_advancement_status: ringStatus,
      next_step_observable: nextObservable,
    }),
    blocked_effects: REQUIRED_BLOCKED_EFFECTS,
    self_critique: Object.freeze({
      this_preview_acts_on_data: false,
      this_preview_judges_operator: false,
      this_preview_offers_a_mirror: true,
      this_preview_prescribes_action: false,
    }),
    boundary: buildPreviewBoundary(),
  });
}

// Compact summary view of process mining preview — used by
// `dema process-mining --summary`. Collapses the metric objects to
// counts and surfaces the load-bearing ring_advancement_status string.
export function buildProcessMiningSummary(options = {}) {
  const full = buildProcessMiningPreview(options);
  return Object.freeze({
    schema: "bizra.dema.process_mining_summary.v0.1",
    truth_label: full.truth_label,
    mode: "summary",
    source_schema: full.schema,
    ring_advancement_status:
      full.operator_pattern_metrics.ring_advancement_status,
    next_step_observable: full.operator_pattern_metrics.next_step_observable,
    decision_metric_keys: Object.freeze(Object.keys(full.decision_metrics)),
    doctrine_metric_keys: Object.freeze(Object.keys(full.doctrine_metrics)),
    operator_pattern_metric_keys: Object.freeze(
      Object.keys(full.operator_pattern_metrics),
    ),
    boundary: full.boundary,
  });
}

export const PROCESS_MINING_REQUIRED_BLOCKED_EFFECTS = REQUIRED_BLOCKED_EFFECTS;
