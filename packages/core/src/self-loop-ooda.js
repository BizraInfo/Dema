import { sha256, stableStringify } from "../../consent/src/consent-common.js";

export const SELF_LOOP_OODA_SCHEMA = "bizra.dema.self_loop_ooda.v0.1";
export const SELF_LOOP_PHASES = Object.freeze(["observe", "orient", "decide", "act", "review"]);

const PHASE_SET = new Set(SELF_LOOP_PHASES);
const TERMINAL_REJECT_TERMS = Object.freeze([
  "autonomous loop",
  "background loop",
  "daemon",
  "self modify",
  "self-modify",
  "execute action",
  "executed action",
  "network call",
  "model call",
  "mint",
  "reward",
  "federation",
  "mcp runtime",
  "a2a runtime",
]);

const CANONICAL_BOUNDARY = Object.freeze({
  runtime_execution_performed: false,
  file_write_performed: false,
  model_invocation_performed: false,
  network_call_performed: false,
  self_modification_performed: false,
  autonomous_loop_started: false,
  action_execution_performed: false,
  daemon_started: false,
  signing_performed: false,
  key_generation_performed: false,
  mint_performed: false,
  token_or_reward_activated: false,
  poi_activation_performed: false,
  federation_started: false,
  mcp_runtime_started: false,
  a2a_runtime_started: false,
});

// Kernel-authored attestation — lifted to module consts so verify can re-derive them
// (the anti-overclaim self-description is load-bearing; the cycle_hash backstop alone
// would let a forger invert it with a recomputed hash).
const WHAT_THIS_PROVES = Object.freeze([
  "A supplied OODA cycle can be normalized into an ordered, deterministic review structure.",
  "Each phase is evidence-bound and content-addressed.",
  "The kernel can recommend a next bounded review cycle without executing any action.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "This is not an autonomous loop, daemon, scheduler, planner, or runtime executor.",
  "It does not execute the ACT phase; it only records a proposed action if supplied.",
  "It does not read files, write files, call a model, call a network, sign, mint, reward, activate PoI, or federate.",
  "It does not prove the supplied evidence is true; it binds the cycle to caller-supplied anchors.",
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEvidence(evidence) {
  if (!Array.isArray(evidence)) return Object.freeze([]);
  return Object.freeze([...new Set(evidence.map(text).filter(Boolean))].sort());
}

function reject(reason_code, details = {}) {
  return deepFreeze({ valid: false, rejected: true, reason_code, ...details });
}

function containsOverclaim(...values) {
  const haystack = values.flat().map((value) => text(value).toLowerCase()).join(" ");
  return TERMINAL_REJECT_TERMS.filter((term) => haystack.includes(term));
}

export function normalizeSelfLoopStep(step, index = 0) {
  if (!step || typeof step !== "object" || Array.isArray(step)) return reject("step_malformed", { index });
  const phase = text(step.phase).toLowerCase();
  if (!PHASE_SET.has(phase)) return reject("phase_unknown", { phase, index });
  const claim = text(step.claim);
  if (!claim) return reject("claim_required", { phase, index });
  const evidence = normalizeEvidence(step.evidence ?? step.evidence_anchors);
  if (evidence.length === 0) return reject("evidence_required", { phase, index });
  const proposedAction = text(step.proposed_action ?? step.proposedAction);
  const executed = step.executed === true || step.action_executed === true;
  if (phase === "act" && executed) return reject("act_phase_must_not_execute", { phase, index });
  const overclaims = containsOverclaim(claim, proposedAction, evidence);
  if (overclaims.length > 0) return reject("self_loop_overclaim", { phase, overclaims });
  const body = {
    phase,
    claim,
    evidence,
    proposed_action: phase === "act" ? proposedAction : proposedAction || null,
    executed: false,
  };
  return deepFreeze({ ...body, step_hash: sha256(stableStringify(body)) });
}

function sortSteps(a, b) {
  return SELF_LOOP_PHASES.indexOf(a.phase) - SELF_LOOP_PHASES.indexOf(b.phase);
}

function summarizeSteps(steps) {
  const byPhase = Object.fromEntries(SELF_LOOP_PHASES.map((phase) => [phase, null]));
  for (const step of steps) byPhase[step.phase] = step;
  return byPhase;
}

function computePhaseCoverage(steps) {
  return steps.length / SELF_LOOP_PHASES.length;
}

function formatCoverage(value) {
  return Number(value.toFixed(4));
}

function deriveRecommendation({ valid, overclaims, missingPhases, coverage }) {
  if (!valid || overclaims.length > 0) return "REJECT";
  if (missingPhases.length > 0 || coverage < 1) return "HOLD";
  return "PROPOSE_NEXT_BOUNDED_CYCLE";
}

export function buildSelfLoopOodaCycle({ steps = [], cycle_id = "self-loop-ooda-1a", previous_cycle_hash = null } = {}) {
  if (!Array.isArray(steps)) return reject("steps_must_be_array");
  if (steps.length === 0) return reject("steps_empty");
  const normalized = [];
  const seen = new Set();
  for (let i = 0; i < steps.length; i += 1) {
    const n = normalizeSelfLoopStep(steps[i], i);
    if (!n.step_hash) return n;
    if (seen.has(n.phase)) return reject("duplicate_phase", { phase: n.phase });
    seen.add(n.phase);
    normalized.push(n);
  }
  normalized.sort(sortSteps);
  const missingPhases = SELF_LOOP_PHASES.filter((phase) => !seen.has(phase));
  const overclaims = [];
  const coverage = formatCoverage(computePhaseCoverage(normalized));
  const valid = normalized.length > 0 && overclaims.length === 0;
  const recommendation = deriveRecommendation({ valid, overclaims, missingPhases, coverage });

  const body = {
    schema: SELF_LOOP_OODA_SCHEMA,
    truth_label: "SELF_LOOP_OODA_BOUNDED_KERNEL",
    mode: "DETERMINISTIC_REVIEW_CYCLE_ONLY",
    cycle_id: text(cycle_id) || "self-loop-ooda-1a",
    previous_cycle_hash: text(previous_cycle_hash) || null,
    phases: SELF_LOOP_PHASES,
    phase_count: normalized.length,
    required_phase_count: SELF_LOOP_PHASES.length,
    phase_coverage: coverage,
    phase_coverage_formula: `${normalized.length}/${SELF_LOOP_PHASES.length}`,
    missing_phases: Object.freeze(missingPhases),
    steps: normalized,
    steps_by_phase: summarizeSteps(normalized),
    recommendation,
    proposed_next_cycle: recommendation === "PROPOSE_NEXT_BOUNDED_CYCLE",
    action_executed_by_kernel: false,
    autonomous_loop_started: false,
    boundary: { ...CANONICAL_BOUNDARY },
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
  };

  return deepFreeze({ ...body, cycle_hash: sha256(stableStringify(body)) });
}

export function verifySelfLoopOodaCycle(cycle) {
  if (!cycle || typeof cycle !== "object" || Array.isArray(cycle)) return reject("cycle_malformed");
  const blocked_by = [];
  if (cycle.schema !== SELF_LOOP_OODA_SCHEMA) blocked_by.push("schema_mismatch");
  if (cycle.truth_label !== "SELF_LOOP_OODA_BOUNDED_KERNEL") blocked_by.push("truth_label_mismatch");
  if (cycle.mode !== "DETERMINISTIC_REVIEW_CYCLE_ONLY") blocked_by.push("mode_mismatch");
  if (!Array.isArray(cycle.phases) || stableStringify(cycle.phases) !== stableStringify(SELF_LOOP_PHASES)) blocked_by.push("phases_mismatch");
  if (!cycle.boundary || typeof cycle.boundary !== "object") blocked_by.push("boundary_missing");
  else {
    for (const [key, value] of Object.entries(cycle.boundary)) {
      if (value !== false) blocked_by.push(`boundary_not_false:${key}`);
    }
  }
  if (cycle.autonomous_loop_started !== false) blocked_by.push("autonomous_loop_started");
  if (cycle.action_executed_by_kernel !== false) blocked_by.push("action_execution_overclaim");
  // re-derive the kernel-authored attestation — verify must not trust stored prose.
  if (cycle.required_phase_count !== SELF_LOOP_PHASES.length) blocked_by.push("required_phase_count_mismatch");
  if (stableStringify(cycle.what_this_proves) !== stableStringify(WHAT_THIS_PROVES)) blocked_by.push("what_this_proves_mismatch");
  if (stableStringify(cycle.what_this_does_not_prove) !== stableStringify(WHAT_THIS_DOES_NOT_PROVE)) blocked_by.push("what_this_does_not_prove_mismatch");

  if (!Array.isArray(cycle.steps)) blocked_by.push("steps_missing");
  else {
    const seen = new Set();
    for (const step of cycle.steps) {
      if (!step || typeof step !== "object") {
        blocked_by.push("step_malformed");
        continue;
      }
      if (!PHASE_SET.has(step.phase)) blocked_by.push(`phase_unknown:${step.phase}`);
      if (seen.has(step.phase)) blocked_by.push(`duplicate_phase:${step.phase}`);
      seen.add(step.phase);
      if (!Array.isArray(step.evidence) || step.evidence.length === 0) blocked_by.push(`evidence_required:${step.phase ?? "unknown"}`);
      if (step.executed !== false) blocked_by.push(`step_executed_overclaim:${step.phase ?? "unknown"}`);
      const overclaims = containsOverclaim(step.claim, step.proposed_action, step.evidence);
      if (overclaims.length > 0) blocked_by.push(`self_loop_overclaim:${step.phase}:${overclaims.join(",")}`);
      const { step_hash, ...stepBody } = step;
      if (!step_hash || sha256(stableStringify(stepBody)) !== step_hash) blocked_by.push(`step_hash_mismatch:${step.phase ?? "unknown"}`);
    }
    const expectedMissing = SELF_LOOP_PHASES.filter((phase) => !seen.has(phase));
    if (stableStringify(expectedMissing) !== stableStringify(cycle.missing_phases ?? [])) blocked_by.push("missing_phases_mismatch");
    const expectedCoverage = formatCoverage(cycle.steps.length / SELF_LOOP_PHASES.length);
    if (cycle.phase_coverage !== expectedCoverage) blocked_by.push("phase_coverage_mismatch");
    if (cycle.phase_coverage_formula !== `${cycle.steps.length}/${SELF_LOOP_PHASES.length}`) blocked_by.push("phase_coverage_formula_mismatch");
    if (cycle.phase_count !== cycle.steps.length) blocked_by.push("phase_count_mismatch");
    const expectedByPhase = summarizeSteps(cycle.steps);
    if (stableStringify(expectedByPhase) !== stableStringify(cycle.steps_by_phase)) blocked_by.push("steps_by_phase_mismatch");
    // Re-derive recommendation — verify must not trust a stored recommendation. A built
    // cycle is always valid + overclaim-free (overclaims reject at normalize time), so a
    // genuine recommendation is HOLD (incomplete) or PROPOSE_NEXT (all phases). This stops
    // a HOLD->PROPOSE_NEXT laundering with a recomputed cycle_hash (cf. #235 status re-derive).
    const expectedRecommendation =
      expectedMissing.length > 0 || expectedCoverage < 1 ? "HOLD" : "PROPOSE_NEXT_BOUNDED_CYCLE";
    if (cycle.recommendation !== expectedRecommendation) blocked_by.push("recommendation_mismatch");
    if (cycle.proposed_next_cycle !== (expectedRecommendation === "PROPOSE_NEXT_BOUNDED_CYCLE")) {
      blocked_by.push("proposed_next_cycle_mismatch");
    }
  }

  const { cycle_hash, ...body } = cycle;
  if (!cycle_hash || sha256(stableStringify(body)) !== cycle_hash) blocked_by.push("cycle_hash_mismatch");
  if (blocked_by.length > 0) return deepFreeze({ valid: false, rejected: true, reason_code: "self_loop_ooda_invalid", blocked_by });
  return deepFreeze({ valid: true, rejected: false, reason_code: "self_loop_ooda_valid", cycle_hash: cycle.cycle_hash, phase_coverage: cycle.phase_coverage });
}
