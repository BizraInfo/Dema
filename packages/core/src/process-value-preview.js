export const PROCESS_RSI_PREVIEW_SCHEMA = "bizra.dema.process_rsi_preview.v0.1";
export const PROCESS_SNR_PREVIEW_SCHEMA = "bizra.dema.process_snr_preview.v0.1";
export const TRUE_VALUE_PREVIEW_SCHEMA = "bizra.dema.true_value_preview.v0.1";

const POSITIVE_EVENT_TYPES = new Set([
  "clean_commit",
  "gate_passed",
  "stable_receipts",
  "blocker_reduced",
  "clean_replay",
  "no_mint_verification",
  "release_readiness_clean"
]);

const NEGATIVE_EVENT_TYPES = new Set([
  "gate_failed",
  "dirty_tree",
  "receipt_drift",
  "unauthorized_mint_attempt",
  "runtime_ambiguity",
  "unresolved_blocker",
  "scope_contamination"
]);

const INVARIANT_BLOCKED_ACTIONS = Object.freeze([
  "runtime_start",
  "federation_start",
  "node_connection",
  "receipt_mint",
  "capability_mint",
  "authorization_emit",
  "step7_mint_without_exact_authorization"
]);

const NEXT_SAFE_ACTIONS = Object.freeze([
  "fix_malformed_process_inputs",
  "restore_clean_baseline",
  "hold_step7_or_prepare_exact_authorized_ceremony",
  "continue_preview_only_readiness",
  "reduce_noise_before_next_slice",
  "continue_verified_micro_slice"
]);

const STEP7_BLOCKER_KINDS = new Set([
  "step7_ready_unminted",
  "step7_unauthorized",
  "step7_anchor_pending"
]);

const NODE_BLOCKER_KINDS = new Set([
  "node_connection_blocked",
  "node1_connection_blocked",
  "federation_blocked"
]);

const UNSAFE_BLOCKER_KINDS = new Set([
  "step7_unauthorized",
  "node_connection_blocked",
  "node1_connection_blocked",
  "federation_blocked",
  "runtime_blocked",
  "receipt_mint_blocked",
  "capability_mint_blocked",
  "unauthorized_mint_attempt"
]);

const PROOF_SIGNAL_STATUSES = new Set([
  "passed",
  "pass",
  "measured",
  "blocked",
  "pending",
  "failed",
  "missing"
]);

const PASSING_PROOF_SIGNAL_STATUSES = new Set(["passed", "pass", "measured"]);

const BLOCKER_SEVERITIES = new Set(["halt_gate", "review", "advisory"]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function round(value, places = 4) {
  return Number(value.toFixed(places));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function finiteNonNegative(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function finitePositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function finiteUnitNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function normalizeProcessEvent(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return { malformed: true, event_type: null, gain: 0, loss: 0 };
  }
  const eventType = typeof event.type === "string" ? event.type : null;
  const weight = event.weight === undefined ? 1 : event.weight;
  if (!eventType || !finiteNonNegative(weight)) {
    return { malformed: true, event_type: eventType, gain: 0, loss: 0 };
  }
  if (POSITIVE_EVENT_TYPES.has(eventType)) {
    return { malformed: false, event_type: eventType, gain: weight, loss: 0 };
  }
  if (NEGATIVE_EVENT_TYPES.has(eventType)) {
    return { malformed: false, event_type: eventType, gain: 0, loss: weight };
  }
  return { malformed: false, event_type: eventType, gain: 0, loss: 0 };
}

function rsiFromGainLoss(gain, loss) {
  if (gain === 0 && loss === 0) return 50;
  if (loss === 0 && gain > 0) return 100;
  if (gain === 0 && loss > 0) return 0;
  return clamp(100 - (100 / (1 + (gain / loss))), 0, 100);
}

function failMetric(schema, reason) {
  return {
    schema,
    mode: "PREVIEW_ONLY",
    verdict: "PREVIEW_REJECT",
    score: null,
    normalized_score: null,
    reason
  };
}

export function computeProcessRsi({ events, window = 14 } = {}) {
  if (!Array.isArray(events)) {
    return {
      ...failMetric(PROCESS_RSI_PREVIEW_SCHEMA, "events_must_be_array"),
      window,
      events_considered: 0,
      proof_gain: null,
      proof_loss: null,
      malformed_events: 1
    };
  }
  if (!finitePositiveInteger(window)) {
    return {
      ...failMetric(PROCESS_RSI_PREVIEW_SCHEMA, "window_must_be_positive_integer"),
      window,
      events_considered: 0,
      proof_gain: null,
      proof_loss: null,
      malformed_events: 0
    };
  }

  const consideredEvents = events.slice(-window);
  const normalized = consideredEvents.map(normalizeProcessEvent);
  const malformedEvents = normalized.filter((event) => event.malformed).length;
  if (malformedEvents > 0) {
    return {
      ...failMetric(PROCESS_RSI_PREVIEW_SCHEMA, "malformed_process_event"),
      window,
      events_considered: consideredEvents.length,
      proof_gain: null,
      proof_loss: null,
      malformed_events: malformedEvents
    };
  }

  const proofGain = normalized.reduce((total, event) => total + event.gain, 0);
  const proofLoss = normalized.reduce((total, event) => total + event.loss, 0);
  const score = round(rsiFromGainLoss(proofGain, proofLoss), 2);
  return {
    schema: PROCESS_RSI_PREVIEW_SCHEMA,
    mode: "PREVIEW_ONLY",
    verdict: "PARTIAL_PLACEHOLDER",
    score,
    normalized_score: round(score / 100),
    window,
    events_considered: consideredEvents.length,
    proof_gain: round(proofGain, 4),
    proof_loss: round(proofLoss, 4),
    malformed_events: 0
  };
}

function eventCount(value) {
  if (Array.isArray(value)) return { ok: true, count: value.length };
  if (finiteNonNegative(value)) return { ok: true, count: value };
  return { ok: false, count: null };
}

export function computeSNRValue({ signalEvents = [], noiseEvents = [] } = {}) {
  const signal = eventCount(signalEvents);
  const noise = eventCount(noiseEvents);
  if (!signal.ok || !noise.ok) {
    return {
      ...failMetric(PROCESS_SNR_PREVIEW_SCHEMA, "signal_and_noise_must_be_arrays_or_non_negative_counts"),
      signal_count: signal.count,
      noise_count: noise.count
    };
  }

  const total = signal.count + noise.count;
  const score = total === 0 ? 0 : signal.count / total;
  return {
    schema: PROCESS_SNR_PREVIEW_SCHEMA,
    mode: "PREVIEW_ONLY",
    verdict: "PARTIAL_PLACEHOLDER",
    score: round(score),
    signal_count: signal.count,
    noise_count: noise.count,
    total_count: total
  };
}

function normalizeProofSignal(signal) {
  if (!signal || typeof signal !== "object" || Array.isArray(signal)) {
    return { malformed: true, required: true, passed: false, weight: 0 };
  }
  const weight = signal.weight === undefined ? 1 : signal.weight;
  const status = typeof signal.status === "string" ? signal.status : null;
  if (!finiteNonNegative(weight) || !status || !PROOF_SIGNAL_STATUSES.has(status)) {
    return { malformed: true, required: true, passed: false, weight: 0 };
  }
  return {
    malformed: false,
    required: signal.required !== false,
    passed: PASSING_PROOF_SIGNAL_STATUSES.has(status),
    weight
  };
}

function computeProofCompleteness(proofSignals) {
  if (!Array.isArray(proofSignals)) {
    return { score: null, malformed: true, required_weight: null, passed_weight: null };
  }
  const normalized = proofSignals.map(normalizeProofSignal);
  if (normalized.some((signal) => signal.malformed)) {
    return { score: null, malformed: true, required_weight: null, passed_weight: null };
  }
  const required = normalized.filter((signal) => signal.required);
  const requiredWeight = required.reduce((total, signal) => total + signal.weight, 0);
  const passedWeight = required
    .filter((signal) => signal.passed)
    .reduce((total, signal) => total + signal.weight, 0);
  return {
    score: requiredWeight === 0 ? 0 : round(passedWeight / requiredWeight),
    malformed: false,
    required_weight: round(requiredWeight),
    passed_weight: round(passedWeight)
  };
}

function normalizeBlocker(blocker) {
  if (!blocker || typeof blocker !== "object" || Array.isArray(blocker)) {
    return { malformed: true, kind: "unstructured_blocker", severity: "halt_gate" };
  }
  const kind = typeof blocker.kind === "string" ? blocker.kind : null;
  const severity = typeof blocker.severity === "string" ? blocker.severity : "review";
  return {
    malformed: !kind || !BLOCKER_SEVERITIES.has(severity),
    kind: kind ?? "unstructured_blocker",
    severity
  };
}

function normalizeBlockers(blockers) {
  if (!Array.isArray(blockers)) {
    return { blockers: [{ malformed: true, kind: "unstructured_blocker", severity: "halt_gate" }], malformed: true };
  }
  const normalized = blockers.map(normalizeBlocker);
  return {
    blockers: normalized,
    malformed: normalized.some((blocker) => blocker.malformed)
  };
}

function computeIhsanSafety(normalizedBlockers) {
  if (normalizedBlockers.length === 0) return 1;
  const unsafe = normalizedBlockers.filter((blocker) => (
    blocker.malformed ||
    blocker.severity === "halt_gate" ||
    UNSAFE_BLOCKER_KINDS.has(blocker.kind)
  )).length;
  return round(1 - (unsafe / normalizedBlockers.length));
}

function hasKind(blockers, kindSet) {
  return blockers.some((blocker) => kindSet.has(blocker.kind));
}

function hasProcessEvent(processEvents, eventType) {
  return Array.isArray(processEvents) && processEvents.some((event) => event?.type === eventType);
}

function normalizeNow(now) {
  const candidate = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(candidate.getTime())) {
    return { malformed: true, iso: null };
  }
  return { malformed: false, iso: candidate.toISOString() };
}

function deriveState({ inputMalformed, blockers, processEvents }) {
  if (inputMalformed) return "preview_reject";
  if (hasProcessEvent(processEvents, "dirty_tree")) return "process_dirty";
  if (hasKind(blockers, STEP7_BLOCKER_KINDS)) return "node0_proof_ready_step7_gated";
  if (hasKind(blockers, NODE_BLOCKER_KINDS)) return "node_connection_gated";
  return "proof_process_preview";
}

function deriveRiskLevel({ inputMalformed, trueValueScore, blockers }) {
  if (inputMalformed) return "high";
  if (blockers.some((blocker) => blocker.severity === "halt_gate")) return "medium";
  if (trueValueScore === null || trueValueScore < 0.45) return "high";
  if (trueValueScore < 0.7) return "medium";
  return "low";
}

function deriveMomentum({ inputMalformed, processRsi, trueValueScore, blockers }) {
  if (inputMalformed || processRsi.score === null || trueValueScore === null) return "unknown_rejected";
  if (hasKind(blockers, STEP7_BLOCKER_KINDS) && processRsi.score >= 60) return "improving_but_gated";
  if (processRsi.score >= 65 && trueValueScore >= 0.7 && blockers.length === 0) return "improving";
  if (processRsi.score < 45 || trueValueScore < 0.45) return "declining";
  return "stable";
}

function deriveNextSafeAction({ inputMalformed, processState, snr }) {
  if (inputMalformed) return "fix_malformed_process_inputs";
  if (processState === "process_dirty") return "restore_clean_baseline";
  if (processState === "node0_proof_ready_step7_gated") {
    return "hold_step7_or_prepare_exact_authorized_ceremony";
  }
  if (snr.score !== null && snr.score < 0.5) return "reduce_noise_before_next_slice";
  if (processState === "node_connection_gated") return "continue_preview_only_readiness";
  return "continue_verified_micro_slice";
}

function reasonFor({ processState, inputMalformed }) {
  if (inputMalformed) return "One or more inputs were malformed; preview rejects instead of inventing value.";
  if (processState === "process_dirty") return "Dirty scope makes append-only or gated ceremonies unsafe.";
  if (processState === "node0_proof_ready_step7_gated") {
    return "Step 7 is proof-ready but still exact-authorization and append-only gated.";
  }
  if (processState === "node_connection_gated") {
    return "Node connection remains blocked until proof gates and preview-only readiness checks pass.";
  }
  return "Process evidence is summarized for review only; no authority is granted.";
}

export function buildTrueValuePreview({
  processEvents = [],
  proofSignals = [],
  blockers = [],
  now = new Date()
} = {}) {
  const checkedAt = normalizeNow(now);
  const processRsi = computeProcessRsi({ events: processEvents });
  const signalEvents = Array.isArray(proofSignals)
    ? proofSignals.filter((signal) => PASSING_PROOF_SIGNAL_STATUSES.has(signal?.status))
    : proofSignals;
  const noiseEvents = Array.isArray(processEvents)
    ? processEvents.filter((event) => NEGATIVE_EVENT_TYPES.has(event?.type))
    : processEvents;
  const snr = computeSNRValue({ signalEvents, noiseEvents });
  const proofCompleteness = computeProofCompleteness(proofSignals);
  const normalizedBlockers = normalizeBlockers(blockers);
  const ihsanSafety = normalizedBlockers.malformed
    ? 0
    : computeIhsanSafety(normalizedBlockers.blockers);

  const inputMalformed =
    processRsi.verdict === "PREVIEW_REJECT" ||
    snr.verdict === "PREVIEW_REJECT" ||
    proofCompleteness.malformed ||
    normalizedBlockers.malformed ||
    checkedAt.malformed;

  const trueValueScore = inputMalformed
    ? null
    : round(
      (0.40 * snr.score) +
      (0.25 * processRsi.normalized_score) +
      (0.20 * proofCompleteness.score) +
      (0.15 * ihsanSafety)
    );
  const processState = deriveState({
    inputMalformed,
    blockers: normalizedBlockers.blockers,
    processEvents
  });
  const nextSafeAction = deriveNextSafeAction({ inputMalformed, processState, snr });
  const blockedActions = Object.freeze(clone(INVARIANT_BLOCKED_ACTIONS));

  return {
    schema: TRUE_VALUE_PREVIEW_SCHEMA,
    truth_label: "DECLARED",
    mode: "PREVIEW_ONLY",
    certifies: false,
    checked_at: checkedAt.iso,
    process_state: processState,
    risk_level: deriveRiskLevel({
      inputMalformed,
      trueValueScore,
      blockers: normalizedBlockers.blockers
    }),
    momentum: deriveMomentum({
      inputMalformed,
      processRsi,
      trueValueScore,
      blockers: normalizedBlockers.blockers
    }),
    process_rsi: processRsi,
    snr,
    proof_completeness: proofCompleteness,
    ihsan_safety: inputMalformed ? null : ihsanSafety,
    true_value_score: trueValueScore,
    next_safe_action: nextSafeAction,
    next_safe_action_allowed: NEXT_SAFE_ACTIONS.includes(nextSafeAction),
    blocked_actions: blockedActions,
    reason: reasonFor({ processState, inputMalformed }),
    checks: [
      { check: "process_rsi_valid", pass: processRsi.verdict !== "PREVIEW_REJECT" },
      { check: "snr_valid", pass: snr.verdict !== "PREVIEW_REJECT" },
      { check: "proof_completeness_valid", pass: !proofCompleteness.malformed },
      { check: "blockers_structured", pass: !normalizedBlockers.malformed },
      { check: "checked_at_valid", pass: !checkedAt.malformed },
      { check: "next_safe_action_allowlisted", pass: NEXT_SAFE_ACTIONS.includes(nextSafeAction) },
      { check: "blocked_actions_invariant", pass: INVARIANT_BLOCKED_ACTIONS.every((action) => (
        blockedActions.includes(action)
      )) }
    ],
    boundary: {
      runtime_started: false,
      federation_started: false,
      node_connection_attempted: false,
      receipt_minted: false,
      capability_minted: false,
      authorization_emitted: false,
      filesystem_write_performed: false,
      process_modified: false,
      push_performed: false
    },
    note:
      "Process Value Preview ranks process health for review only. It does not authorize mint, " +
      "federation, node connection, runtime execution, or recursive self-modification."
  };
}
