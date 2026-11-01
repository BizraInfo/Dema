// DEMA-EXPERIENCE-HANDOFF-1A — minimum experience-refinery special case.
// Turns one agent/session evidence bundle into a schema-tagged handoff card
// that SEPARATES measured results from inferred advice (SlopCodeBench lesson).
// Pure: no fs/net/clock; never claims NODE0_CLOSED or RSI live.

export const EXPERIENCE_HANDOFF_SCHEMA = "bizra.dema.experience_handoff_card.v0.1";
export const EXPERIENCE_HANDOFF_TRUTH_LABEL = "DEMA_EXPERIENCE_HANDOFF_PREVIEW_LOCAL";

export const EVIDENCE_LEVELS = Object.freeze([
  "OBSERVED",
  "INFERRED",
  "UNTESTED_ADVICE",
  "UNKNOWN",
]);

export function demaExperienceHandoffBoundary() {
  return Object.freeze({
    execution_allowed: false,
    daemon_started: false,
    network_used: false,
    token_minted: false,
    wallet_accessed: false,
    live_execution_performed: false,
    file_mutation_performed: false,
    model_invocation_performed: false,
  });
}

function asObj(x) {
  return x && typeof x === "object" && !Array.isArray(x) ? x : null;
}

function asStr(x) {
  return typeof x === "string" && x.trim() ? x.trim() : null;
}

function asNum(x) {
  return Number.isFinite(x) ? x : null;
}

/**
 * Build one handoff card. Fail-closed to UNKNOWN when identity fields missing.
 *
 * @param {object} input
 * @param {string} input.session_id
 * @param {string} [input.base_sha]
 * @param {string} [input.head_sha]
 * @param {object} [input.new_behavior]  { passed?, failed?, total?, label? }
 * @param {object} [input.regression]    { passed?, failed?, total?, label? }
 * @param {string[]} [input.structural_changes]
 * @param {number|null} [input.cost_usd]
 * @param {string[]} [input.observed_facts]
 * @param {string[]} [input.inferences]
 * @param {string[]} [input.untested_advice]
 * @param {string[]} [input.open_questions]
 */
export function buildExperienceHandoffCard(input = {}) {
  const session_id = asStr(input.session_id);
  if (!session_id) {
    return Object.freeze({
      schema: EXPERIENCE_HANDOFF_SCHEMA,
      truth_label: EXPERIENCE_HANDOFF_TRUTH_LABEL,
      ok: false,
      reason: "session_id_missing",
      evidence_level: "UNKNOWN",
      authority_delta: 0,
      boundary: demaExperienceHandoffBoundary(),
      what_this_proves: "Fail-closed refusal of a malformed handoff.",
      what_this_does_not_prove: "Any Dema quality improvement or Node0 closure.",
    });
  }

  const new_behavior = asObj(input.new_behavior) || {};
  const regression = asObj(input.regression) || {};
  const structural = Array.isArray(input.structural_changes)
    ? input.structural_changes.filter((s) => typeof s === "string")
    : [];
  const observed = Array.isArray(input.observed_facts)
    ? input.observed_facts.filter((s) => typeof s === "string")
    : [];
  const inferences = Array.isArray(input.inferences)
    ? input.inferences.filter((s) => typeof s === "string")
    : [];
  const advice = Array.isArray(input.untested_advice)
    ? input.untested_advice.filter((s) => typeof s === "string")
    : [];
  const open_questions = Array.isArray(input.open_questions)
    ? input.open_questions.filter((s) => typeof s === "string")
    : [];

  const regFailed = asNum(regression.failed);
  const featureOnlyPass =
    asNum(new_behavior.failed) === 0 &&
    asNum(new_behavior.passed) > 0 &&
    regFailed !== null &&
    regFailed > 0;

  let evidence_level = "UNKNOWN";
  if (observed.length > 0) evidence_level = "OBSERVED";
  else if (inferences.length > 0) evidence_level = "INFERRED";
  else if (advice.length > 0) evidence_level = "UNTESTED_ADVICE";

  return Object.freeze({
    schema: EXPERIENCE_HANDOFF_SCHEMA,
    truth_label: EXPERIENCE_HANDOFF_TRUTH_LABEL,
    ok: true,
    reason: "handoff_projected",
    session_id,
    base_sha: asStr(input.base_sha),
    head_sha: asStr(input.head_sha),
    new_behavior: Object.freeze({
      label: asStr(new_behavior.label) || "new_behavior",
      passed: asNum(new_behavior.passed),
      failed: asNum(new_behavior.failed),
      total: asNum(new_behavior.total),
    }),
    regression: Object.freeze({
      label: asStr(regression.label) || "regression",
      passed: asNum(regression.passed),
      failed: asNum(regression.failed),
      total: asNum(regression.total),
    }),
    structural_changes: Object.freeze(structural),
    cost_usd: asNum(input.cost_usd),
    feature_only_pass_detected: featureOnlyPass === true,
    observed_facts: Object.freeze(observed),
    inferences: Object.freeze(inferences),
    untested_advice: Object.freeze(advice),
    open_questions: Object.freeze(open_questions),
    evidence_level,
    authority_delta: 0,
    boundary: demaExperienceHandoffBoundary(),
    what_this_proves:
      "One experience-refinery handoff card separating observed / inferred / untested advice.",
    what_this_does_not_prove:
      "Maintainability, future repair cost, NODE0_CLOSED, RSI live, or that feature-only green is whole-task success.",
  });
}

export function formatExperienceHandoffCard(card = {}) {
  const lines = [
    `DEMA · EXPERIENCE HANDOFF · ${card.evidence_level || "UNKNOWN"}`,
    `truth_label: ${card.truth_label || EXPERIENCE_HANDOFF_TRUTH_LABEL}`,
    `session: ${card.session_id || "(none)"}`,
    `base→head: ${(card.base_sha || "?").slice(0, 12)} → ${(card.head_sha || "?").slice(0, 12)}`,
    `preview: ${card.what_this_does_not_prove || "(see JSON boundary)"}`,
    "",
    "NEW BEHAVIOR",
    `  ${card.new_behavior?.label}: pass=${card.new_behavior?.passed} fail=${card.new_behavior?.failed} total=${card.new_behavior?.total}`,
    "REGRESSION",
    `  ${card.regression?.label}: pass=${card.regression?.passed} fail=${card.regression?.failed} total=${card.regression?.total}`,
    `  feature_only_pass_detected: ${card.feature_only_pass_detected === true}`,
    "",
    "STRUCTURAL",
    ...((card.structural_changes || []).length
      ? card.structural_changes.map((s) => `  - ${s}`)
      : ["  (none recorded)"]),
    "",
    "OBSERVED",
    ...((card.observed_facts || []).length
      ? card.observed_facts.map((s) => `  - ${s}`)
      : ["  (none)"]),
    "INFERRED",
    ...((card.inferences || []).length
      ? card.inferences.map((s) => `  - ${s}`)
      : ["  (none)"]),
    "UNTESTED ADVICE",
    ...((card.untested_advice || []).length
      ? card.untested_advice.map((s) => `  - ${s}`)
      : ["  (none)"]),
    "OPEN",
    ...((card.open_questions || []).length
      ? card.open_questions.map((s) => `  - ${s}`)
      : ["  (none)"]),
    "",
    `cost_usd=${card.cost_usd ?? "UNKNOWN"} · authority_delta=${card.authority_delta ?? "?"}`,
  ];
  return lines.join("\n");
}
