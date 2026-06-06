// LLM Capacity Insight Preview
//
// Ranks candidate next steps for evidence-grounded reasoning work. It does
// not activate a model, reveal hidden reasoning, execute tools, modify files,
// mint receipts, or cross any hard-stop gate. "Capacity" here means an
// operator-visible preview of which safe micro-step has the strongest
// signal-to-noise profile under SAPE axes.

import { buildPreviewBoundary } from "./preview-boundary.js";

const SCHEMA = "bizra.dema.llm_capacity_insight_preview.v0.1";

const SAPE_AXES = Object.freeze([
  "signal_preservation",
  "abstraction_lift",
  "proof_convergence",
  "ethical_ihsan_grounding",
  "symbolic_neural_bridge",
  "rare_circuit_probe",
  "logic_creative_tension",
]);

const PROOF_AXES = Object.freeze([
  "formal",
  "cryptographic",
  "empirical",
  "economic",
]);

const HARD_STOP_GATES = Object.freeze([
  "none",
  "ci_workflow",
  "shared_branch",
  "destructive_git",
  "github_post",
  "release_publish",
  "identity_artifact",
  "runtime_daemon",
  "node_connection",
  "timestamp_upgrade",
]);

const ACTION_KINDS = Object.freeze([
  "preview",
  "authorization_request",
  "documentation",
  "implementation",
  "verification",
  "runtime",
]);

const DEFAULT_ABSTAIN_STEP = Object.freeze({
  id: "collect-minimal-evidence-bundle",
  title: "Collect the smallest evidence bundle before ranking implementation",
  action_kind: "preview",
  hard_stop_gate: "none",
  execution_allowed: false,
  why: "No valid candidate evidence was supplied; preview abstains instead of inventing a step.",
});

function clampUnit(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function cleanString(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 160) : fallback;
}

function sanitizeAxes(input, axes) {
  const source = input && typeof input === "object" ? input : {};
  return Object.freeze(
    Object.fromEntries(axes.map((axis) => [axis, clampUnit(source[axis])])),
  );
}

function sanitizeProof(input) {
  const source = input && typeof input === "object" ? input : {};
  return Object.freeze(
    Object.fromEntries(PROOF_AXES.map((axis) => [axis, source[axis] === true])),
  );
}

function proofPoints(proof) {
  return PROOF_AXES.reduce((sum, axis) => sum + (proof[axis] ? 100 : 0), 0);
}

function axisPoints(axes) {
  return SAPE_AXES.reduce((sum, axis) => sum + Math.round(axes[axis] * 100), 0);
}

function hardStopGate(value) {
  return HARD_STOP_GATES.includes(value) ? value : "none";
}

function actionKind(value) {
  return ACTION_KINDS.includes(value) ? value : "preview";
}

function sanitizeCandidate(candidate, index) {
  if (!candidate || typeof candidate !== "object") return null;
  const id = cleanString(candidate.id, null);
  if (id === null) return null;

  const gate = hardStopGate(candidate.hard_stop_gate);
  const kind = actionKind(candidate.action_kind);
  const sape = sanitizeAxes(candidate.sape, SAPE_AXES);
  const proof = sanitizeProof(candidate.proof);
  const signal = clampUnit(candidate.actionable_architectural_signal);
  const noise = clampUnit(candidate.speculative_implementation_noise);
  const crossesHardStop = gate !== "none" && kind !== "authorization_request";
  const executionAllowed = gate === "none" && kind !== "runtime";

  const signalPoints =
    Math.round(signal * 400) + axisPoints(sape) + proofPoints(proof);
  const noisePoints = Math.round(noise * 300) + (kind === "runtime" ? 250 : 0);
  const score = crossesHardStop
    ? -100000 + signalPoints - noisePoints
    : signalPoints - noisePoints;

  return Object.freeze({
    id,
    title: cleanString(candidate.title, id),
    index,
    action_kind: kind,
    hard_stop_gate: gate,
    hard_stop_crossing_disqualified: crossesHardStop,
    execution_allowed: executionAllowed,
    actionable_architectural_signal: signal,
    speculative_implementation_noise: noise,
    proof,
    sape,
    snr_score: score,
    rank_reason: crossesHardStop
      ? "disqualified_until_explicit_authorization"
      : "ranked_preview_only_by_signal_minus_noise",
  });
}

function rankCandidates(candidates) {
  return Object.freeze(
    [...candidates].sort((a, b) => {
      if (b.snr_score !== a.snr_score) return b.snr_score - a.snr_score;
      return a.index - b.index;
    }),
  );
}

function evidenceStatus(rawCandidates, sanitized) {
  if (!Array.isArray(rawCandidates) || rawCandidates.length === 0)
    return "missing";
  if (sanitized.length === 0) return "invalid";
  return "present";
}

function buildPeakMicroStep(status, ranked) {
  if (status !== "present" || ranked.length === 0) return DEFAULT_ABSTAIN_STEP;
  const winner = ranked[0];
  if (winner.hard_stop_gate !== "none") {
    return Object.freeze({
      id: winner.id,
      title: `Request explicit authorization before: ${winner.title}`,
      action_kind: "authorization_request",
      hard_stop_gate: winner.hard_stop_gate,
      execution_allowed: false,
      why: "The highest-signal item is gated; the safe micro-step is authorization or restoration, not execution.",
    });
  }
  return Object.freeze({
    id: winner.id,
    title: winner.title,
    action_kind: winner.action_kind,
    hard_stop_gate: winner.hard_stop_gate,
    execution_allowed: winner.execution_allowed,
    why: "Highest derived SNR/SAPE score among valid preview candidates.",
  });
}

export function buildLlmCapacityInsightPreview({ candidates = [] } = {}) {
  const sanitized = Array.isArray(candidates)
    ? candidates
        .map((candidate, index) => sanitizeCandidate(candidate, index))
        .filter(Boolean)
    : [];
  const status = evidenceStatus(candidates, sanitized);
  const ranked = rankCandidates(sanitized);

  return Object.freeze({
    schema: SCHEMA,
    truth_label: "DERIVED",
    mode: "PREVIEW_ONLY",
    certifies: false,
    evidence_status: status,
    frameworks: Object.freeze({
      snr: "Signal = actionable architectural insight; Noise = speculative implementation.",
      sape_axes: SAPE_AXES,
      proof_axes: PROOF_AXES,
      ihsan_rule:
        "Do not cross a hard-stop gate; surface authorization or abstain.",
    }),
    reasoning_pattern: Object.freeze([
      "classify_evidence",
      "score_signal_noise",
      "demote_hard_stop_crossing",
      "select_minimal_safe_micro_step",
      "verify_before_claim",
    ]),
    hidden_golden_gems: Object.freeze([
      "A hard stop can be high signal without being executable.",
      "The smallest safe step is often authorization clarity, not more code.",
      "Preview-ranked abstractions must stay DERIVED until receipts or empirical gates converge.",
    ]),
    ranked_candidates: ranked,
    peak_micro_step: buildPeakMicroStep(status, ranked),
    boundary: buildPreviewBoundary(),
  });
}

export function formatLlmCapacityInsightPreview(preview) {
  const lines = [
    "DEMA LLM Capacity Insight Preview",
    "",
    `Schema: ${preview.schema}`,
    `Truth: ${preview.truth_label}`,
    `Mode: ${preview.mode}`,
    `Evidence: ${preview.evidence_status}`,
    `Peak micro-step: ${preview.peak_micro_step.title}`,
    `Execution allowed: ${preview.peak_micro_step.execution_allowed ? "yes" : "no"}`,
    "",
    "Top candidates:",
  ];

  for (const candidate of preview.ranked_candidates.slice(0, 5)) {
    lines.push(
      `- ${candidate.id}: score=${candidate.snr_score}; gate=${candidate.hard_stop_gate}; ${candidate.rank_reason}`,
    );
  }

  lines.push("");
  lines.push(
    "Boundary: preview-only; no runtime, network, model call, receipt mint, or CI workflow mutation.",
  );
  return lines.join("\n");
}

export const LLM_CAPACITY_SAPE_AXES = SAPE_AXES;
export const LLM_CAPACITY_HARD_STOP_GATES = HARD_STOP_GATES;
