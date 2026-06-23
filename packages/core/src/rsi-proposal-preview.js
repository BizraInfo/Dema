import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { computeProcessRsi, computeSNRValue } from "./process-value-preview.js";

export const RSI_PROPOSAL_PREVIEW_SCHEMA = "bizra.dema.rsi_proposal_preview.v0.1";
export const RSI_SNR_NOT_SUPPLIED_VERDICT = "NOT_SUPPLIED";

const RECOMMENDATIONS = Object.freeze(["PROPOSE", "HOLD", "REJECT"]);

const FORBIDDEN_ACTIONS = Object.freeze([
  { key: "self_change", terms: ["change own code", "modify own code", "autonomous rsi", "recursive improvement live"] },
  { key: "live_loop", terms: ["start runtime loop", "activate runtime loop", "live autopoietic", "background agent"] },
  { key: "external_runtime", terms: ["network call", "connect node", "connect nodes", "federation", "mcp runtime", "a2a runtime"] },
  { key: "economic_activation", terms: ["mint", "token", "reward", "poi activation", "economic settlement"] },
  { key: "authority_material", terms: ["key generation", "generate key", "sign receipt", "sign transaction"] },
]);

const CANONICAL_BOUNDARY = Object.freeze({
  runtime_execution_performed: false,
  file_write_performed: false,
  model_invocation_performed: false,
  network_call_performed: false,
  self_change_performed: false,
  autonomous_loop_started: false,
  signing_performed: false,
  key_generation_performed: false,
  mint_performed: false,
  token_or_reward_activated: false,
  poi_activation_performed: false,
  federation_started: false,
  mcp_runtime_started: false,
  a2a_runtime_started: false,
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function round(value, places = 4) {
  return Number(value.toFixed(places));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeFrameworks(frameworks) {
  if (!Array.isArray(frameworks)) return { malformed: true, values: [] };
  const values = frameworks.map((item) => text(item)).filter(Boolean).map((item) => item.toLowerCase());
  return { malformed: false, values: Object.freeze([...new Set(values)]) };
}

function normalizeEvidenceAnchor(anchor, index) {
  if (typeof anchor === "string" && anchor.trim()) {
    return Object.freeze({ id: `evidence_${index + 1}`, anchor: anchor.trim(), status: "provided" });
  }
  if (anchor && typeof anchor === "object" && !Array.isArray(anchor)) {
    const id = text(anchor.id) || `evidence_${index + 1}`;
    const path = text(anchor.path) || text(anchor.anchor) || text(anchor.ref);
    const status = text(anchor.status) || "provided";
    if (!path) return Object.freeze({ id, anchor: null, status, malformed: true });
    return Object.freeze({ id, anchor: path, status, malformed: false });
  }
  return Object.freeze({ id: `evidence_${index + 1}`, anchor: null, status: "malformed", malformed: true });
}

function normalizeEvidenceAnchors(evidenceAnchors) {
  if (!Array.isArray(evidenceAnchors)) {
    return { malformed: true, values: Object.freeze([]), missing: true };
  }
  const values = evidenceAnchors.map(normalizeEvidenceAnchor);
  return {
    malformed: values.some((item) => item.malformed),
    values: deepFreeze(values.filter((item) => item.anchor)),
    missing: values.filter((item) => item.anchor).length === 0,
  };
}

function normalizeCandidate(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return { malformed: true, reason: "candidate_must_be_object" };
  }
  const proposedAction = text(candidate.proposed_action) || text(candidate.action);
  const name = text(candidate.name) || "unnamed_rsi_candidate";
  const rationale = text(candidate.rationale);
  const expectedOutcome = text(candidate.expected_outcome) || text(candidate.outcome);
  if (!proposedAction) return { malformed: true, reason: "candidate_proposed_action_required", name, proposed_action: proposedAction };
  return { malformed: false, name, proposed_action: proposedAction, rationale, expected_outcome: expectedOutcome };
}

function findForbiddenClaims(candidate, frameworks) {
  const haystack = [candidate.name, candidate.proposed_action, candidate.rationale, candidate.expected_outcome, ...frameworks].join(" ").toLowerCase();
  return FORBIDDEN_ACTIONS.filter((entry) => entry.terms.some((term) => haystack.includes(term))).map((entry) => entry.key);
}

function computeProofHardeningScore({ evidence, frameworks, candidate }) {
  const evidenceScore = clamp(evidence.length / 3, 0, 1);
  const frameworkScore = frameworks.length === 0 ? 0 : clamp(frameworks.length / 4, 0, 1);
  const candidateScore = candidate.rationale && candidate.expected_outcome ? 1 : 0.5;
  return round(0.5 * evidenceScore + 0.3 * frameworkScore + 0.2 * candidateScore);
}

function computeOptionalSnr({ signalEvents, noiseEvents }) {
  const supplied = signalEvents !== undefined || noiseEvents !== undefined;
  if (!supplied) {
    return Object.freeze({
      schema: "bizra.dema.process_snr_preview.v0.1",
      mode: "PREVIEW_ONLY",
      verdict: RSI_SNR_NOT_SUPPLIED_VERDICT,
      score: null,
      signal_count: null,
      noise_count: null,
      total_count: null,
      telemetry_supplied: false,
      reason: "snr_telemetry_not_supplied",
    });
  }
  return deepFreeze({ ...computeSNRValue({ signalEvents: signalEvents ?? [], noiseEvents: noiseEvents ?? [] }), telemetry_supplied: true });
}

function deriveRecommendation({ malformed, missingEvidence, forbiddenClaims, snr, processRsi, proofHardeningScore }) {
  if (malformed || missingEvidence || forbiddenClaims.length > 0) return "REJECT";
  if (processRsi.verdict === "PREVIEW_REJECT") return "HOLD";
  if (snr.telemetry_supplied && snr.verdict === "PREVIEW_REJECT") return "HOLD";
  if (snr.telemetry_supplied && snr.score < 0.5) return "HOLD";
  if (processRsi.score < 45 || proofHardeningScore < 0.5) return "HOLD";
  return "PROPOSE";
}

function deriveReason({ malformedReason, missingEvidence, forbiddenClaims, recommendation, snr }) {
  if (malformedReason) return malformedReason;
  if (missingEvidence) return "missing_evidence";
  if (forbiddenClaims.length > 0) return `forbidden_action_claim:${forbiddenClaims.join(",")}`;
  if (recommendation === "HOLD") return snr.telemetry_supplied && snr.score !== null && snr.score < 0.5 ? "proposal_needs_more_signal" : "proposal_needs_more_proof_or_rsi";
  return snr.telemetry_supplied ? "proposal_is_safe_to_review_with_snr_telemetry" : "proposal_is_safe_to_review_without_snr_telemetry";
}

function weightedScore(components) {
  const active = components.filter((component) => typeof component.score === "number" && Number.isFinite(component.score));
  const weight = active.reduce((sum, component) => sum + component.weight, 0);
  if (weight === 0) return 0;
  return round(active.reduce((sum, component) => sum + component.weight * component.score, 0) / weight);
}

export function buildRsiProposalPreview({ evidenceAnchors = [], currentScores = {}, candidate = {}, targetFrameworks = [], processEvents = [], signalEvents, noiseEvents } = {}) {
  const evidence = normalizeEvidenceAnchors(evidenceAnchors);
  const frameworks = normalizeFrameworks(targetFrameworks);
  const normalizedCandidate = normalizeCandidate(candidate);
  const forbiddenClaims = normalizedCandidate.malformed ? [] : findForbiddenClaims(normalizedCandidate, frameworks.values);
  const processRsi = computeProcessRsi({ events: processEvents });
  const snr = computeOptionalSnr({ signalEvents, noiseEvents });
  const proofHardeningScore = normalizedCandidate.malformed ? 0 : computeProofHardeningScore({ evidence: evidence.values, frameworks: frameworks.values, candidate: normalizedCandidate });
  const malformed = evidence.malformed || frameworks.malformed || normalizedCandidate.malformed;
  const malformedReason = evidence.malformed ? "evidence_anchors_malformed" : frameworks.malformed ? "target_frameworks_must_be_array" : normalizedCandidate.malformed ? normalizedCandidate.reason : null;
  const recommendation = deriveRecommendation({ malformed, missingEvidence: evidence.missing, forbiddenClaims, snr, processRsi, proofHardeningScore });
  const reason = deriveReason({ malformedReason, missingEvidence: evidence.missing, forbiddenClaims, recommendation, snr });
  const rsiReadinessScore = malformed || evidence.missing ? 0 : weightedScore([
    { weight: 0.35, score: snr.telemetry_supplied ? snr.score : null },
    { weight: 0.25, score: processRsi.normalized_score ?? 0 },
    { weight: 0.25, score: proofHardeningScore },
    { weight: 0.15, score: forbiddenClaims.length === 0 ? 1 : 0 },
  ]);

  const body = {
    schema: RSI_PROPOSAL_PREVIEW_SCHEMA,
    truth_label: "RSI_PROPOSAL_PREVIEW_ONLY",
    mode: "PREVIEW_ONLY",
    certifies: false,
    recommendation,
    recommendation_reason: reason,
    candidate: normalizedCandidate.malformed ? { malformed: true, reason: normalizedCandidate.reason } : normalizedCandidate,
    proposed_action: normalizedCandidate.proposed_action ?? null,
    executed_action: null,
    action_executed_by_preview: false,
    evidence_anchors: evidence.values,
    target_frameworks: frameworks.values,
    current_scores: currentScores && typeof currentScores === "object" && !Array.isArray(currentScores) ? currentScores : { malformed: true },
    process_rsi: processRsi,
    snr,
    proof_hardening_score: proofHardeningScore,
    rsi_readiness_score: rsiReadinessScore,
    forbidden_claims: Object.freeze(forbiddenClaims),
    giants_protocol: { status: "DECLARED_PREVIEW", principle: "stand_on_shoulders_before_novelty", validator_live: false, mapped_frameworks: frameworks.values },
    proof_of_truth: { formal: recommendation === "REJECT" ? "bounded_rejection_contract" : "preview_contract_only", cryptographic: "proposal_hash_only_no_signature", empirical: "tests_required_before_merge", economic: "closed_designed_not_live" },
    what_this_proves: Object.freeze(["A candidate improvement can be scored and proposed from supplied evidence.", "The preview separates proposed_action from executed_action.", "Forbidden live-runtime, network, mint, signing, and self-change tripwires reject matching claims.", "SNR is used only when explicit signal/noise telemetry is supplied."]),
    what_this_does_not_prove: Object.freeze(["RSI is not autonomous or live.", "No code is modified by this kernel.", "No model, network, signing, key generation, mint, reward, PoI, MCP, A2A, or federation runtime is activated.", "The forbidden-claim scan is a conservative tripwire, not exhaustive policy enforcement.", "This preview does not certify production readiness or economic value."]),
    checks: Object.freeze([{ check: "evidence_present", pass: !evidence.missing }, { check: "candidate_structured", pass: !normalizedCandidate.malformed }, { check: "target_frameworks_structured", pass: !frameworks.malformed }, { check: "forbidden_claims_absent", pass: forbiddenClaims.length === 0 }, { check: "proposed_action_not_executed", pass: true }, { check: "recommendation_valid", pass: RECOMMENDATIONS.includes(recommendation) }, { check: "snr_not_fabricated", pass: !snr.telemetry_supplied ? snr.score === null : typeof snr.score === "number" }]),
    boundary: { ...CANONICAL_BOUNDARY },
  };
  return deepFreeze({ ...body, proposal_hash: sha256(stableStringify(body)) });
}
