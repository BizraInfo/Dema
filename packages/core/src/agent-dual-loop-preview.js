import { buildPreviewBoundary } from "./preview-boundary.js";
import {
  computeProcessRsi,
  computeSNRValue,
} from "./process-value-preview.js";
import { buildProofConvergencePreview } from "./proof-convergence-preview.js";

export const AGENT_DUAL_LOOP_PREVIEW_SCHEMA =
  "bizra.dema.agent_dual_loop_preview.v0.1";

const HHMM_PHASES = Object.freeze([
  "UNDERSTAND",
  "PLAN",
  "ACT",
  "VERIFY",
  "SETTLE",
]);

const DEFAULT_MICRO_SLICES = Object.freeze([
  Object.freeze({
    id: "pat-sat-dual-loop-preview-1a",
    actionability: 5,
    proof_strength: 4,
    noise: 1,
    recommended_phase: "VERIFY",
    next_step: "implement_preview_eval_only_dual_loop",
  }),
  Object.freeze({
    id: "live-pat-sat-runtime",
    actionability: 2,
    proof_strength: 1,
    noise: 5,
    recommended_phase: "HOLD",
    next_step: "block_runtime_until_pat_sat_proof_gates",
  }),
  Object.freeze({
    id: "reward-token-activation",
    actionability: 1,
    proof_strength: 1,
    noise: 6,
    recommended_phase: "HOLD",
    next_step: "keep_reward_token_language_quarantined",
  }),
]);

const DEFAULT_REWARD_REFS = Object.freeze([]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function finiteNonNegative(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function normalizeMicroSlice(slice, index) {
  const id =
    slice && typeof slice.id === "string" && slice.id
      ? slice.id
      : `micro-slice-${index}`;
  const actionability = finiteNonNegative(slice?.actionability)
    ? slice.actionability
    : 0;
  const proofStrength = finiteNonNegative(slice?.proof_strength)
    ? slice.proof_strength
    : 0;
  const noise = finiteNonNegative(slice?.noise) ? slice.noise : 0;
  const score = actionability + proofStrength;
  return Object.freeze({
    id,
    actionability,
    proof_strength: proofStrength,
    noise,
    score,
    recommended_phase:
      typeof slice?.recommended_phase === "string"
        ? slice.recommended_phase
        : "VERIFY",
    next_step:
      typeof slice?.next_step === "string"
        ? slice.next_step
        : "continue_verified_micro_slice",
  });
}

function rankMicroSlices(microSlices) {
  const source = Array.isArray(microSlices)
    ? microSlices
    : [...DEFAULT_MICRO_SLICES];
  const ranking = source
    .map(normalizeMicroSlice)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.noise !== b.noise) return a.noise - b.noise;
      return a.id.localeCompare(b.id);
    });
  return Object.freeze(ranking);
}

function buildPatLoop(selected) {
  return Object.freeze({
    status: "DESIGNED_NOT_LIVE",
    role: "personal_agentic_team_preview",
    loop: Object.freeze(["discover", "draft", "propose", "self_critique"]),
    proposes: selected.next_step,
    self_critique: Object.freeze({
      confidence: "bounded_preview",
      limitation: "PAT-7 is not a live autonomous swarm in this repo.",
    }),
    runtime_agent_executed: false,
    model_invoked: false,
  });
}

function buildSatLoop(selected, rewardLens) {
  const blocksReward =
    rewardLens.signal_status === "BLOCKED_BY_BOUNDARY" ||
    rewardLens.signal_status === "NO_REWARD_REFS";
  return Object.freeze({
    status: "DESIGNED_NOT_LIVE",
    role: "sovereign_agentic_team_preview",
    loop: Object.freeze([
      "verify",
      "gate",
      "refuse_or_permit_preview",
      "critique",
    ]),
    verifies: selected.id,
    gate_verdict: blocksReward ? "PERMIT_PREVIEW_REFUSE_REWARD" : "PERMIT_PREVIEW_ONLY",
    blocking_rail: blocksReward ? "economic" : "runtime_activation",
    critique: Object.freeze({
      confidence: "bounded_preview",
      limitation:
        "SAT-5 verifier runtime is not live; this surface only models the governance loop.",
    }),
    runtime_agent_executed: false,
    model_invoked: false,
  });
}

function buildRewardCandidateLens(rewardRefs) {
  if (!Array.isArray(rewardRefs) || rewardRefs.length === 0) {
    return Object.freeze({
      status: "DESIGNED_NOT_LIVE",
      signal_status: "NO_REWARD_REFS",
      verified_reference_count: 0,
      future_training_signal_allowed: false,
      reward_emitted: false,
      policy_updated: false,
      token_minted: false,
      blocked_reason: "missing_reward_references",
    });
  }

  const normalized = rewardRefs.map((ref, index) =>
    Object.freeze({
      id:
        ref && typeof ref.id === "string" && ref.id
          ? ref.id
          : `reward-ref-${index}`,
      status: typeof ref?.status === "string" ? ref.status : "unknown",
      proof_tier:
        typeof ref?.proof_tier === "string" ? ref.proof_tier : "unverified",
    }),
  );
  const unsafe = normalized.filter(
    (ref) =>
      ref.status === "emit_reward" ||
      ref.status === "mint_token" ||
      ref.status === "update_policy" ||
      ref.proof_tier !== "verified_replayable",
  );

  if (unsafe.length > 0) {
    return Object.freeze({
      status: "RESEARCH_QUARANTINE",
      signal_status: "BLOCKED_BY_BOUNDARY",
      verified_reference_count: normalized.length - unsafe.length,
      unsafe_reference_count: unsafe.length,
      unsafe_refs: Object.freeze(unsafe),
      future_training_signal_allowed: false,
      reward_emitted: false,
      policy_updated: false,
      token_minted: false,
      blocked_reason: "unsafe_or_unverified_reward_reference",
    });
  }

  return Object.freeze({
    status: "DESIGNED_NOT_LIVE",
    signal_status: "VERIFIED_REFS_CANDIDATE_ONLY",
    verified_reference_count: normalized.length,
    refs: Object.freeze(normalized),
    future_training_signal_allowed: true,
    future_training_signal_note:
      "Verified/replayable reward references may become future evaluation inputs only.",
    reward_emitted: false,
    policy_updated: false,
    token_minted: false,
  });
}

function buildProofRails(selected, rewardLens) {
  const economicEvidence =
    rewardLens.signal_status === "VERIFIED_REFS_CANDIDATE_ONLY"
      ? "designed_not_live"
      : "none";
  const convergence = buildProofConvergencePreview({
    claims: [
      {
        id: selected.id,
        statement:
          "PAT/SAT dual-loop coordinator preview is structurally bounded.",
        rails: {
          formal: "spec_plus_test",
          cryptographic: "schema_only",
          empirical: "passing_tests",
          economic: economicEvidence,
        },
      },
    ],
  });
  const rails = convergence.claims[0].rails;
  return Object.freeze({
    formal: rails.formal,
    cryptographic: rails.cryptographic,
    empirical: rails.empirical,
    economic: rails.economic,
    source_schema: convergence.schema,
    convergence: convergence.claims[0].convergence,
    blocking_rail:
      rails.economic.level < rails.formal.level ? "economic" : "none",
  });
}

function buildHhmmState(selected, snrScore) {
  const phase = HHMM_PHASES.includes(selected.recommended_phase)
    ? selected.recommended_phase
    : "VERIFY";
  const base = 1 / HHMM_PHASES.length;
  const boost = finiteNonNegative(snrScore) ? Math.min(snrScore, 1) * 0.1 : 0;
  const raw = HHMM_PHASES.map((p) => base + (p === phase ? boost : 0));
  const total = raw.reduce((sum, value) => sum + value, 0);
  const diffusion = HHMM_PHASES.map((p, index) =>
    Object.freeze({
      phase: p,
      belief: Number((raw[index] / total).toFixed(4)),
    }),
  );
  return Object.freeze({
    mode: "preview_diffusion_not_runtime_engine",
    phases: HHMM_PHASES,
    phase,
    diffusion: Object.freeze(diffusion),
  });
}

function buildBoundary() {
  return Object.freeze({
    ...buildPreviewBoundary(),
    model_invoked: false,
    receipt_minted: false,
    token_minted: false,
    federation_performed: false,
    reward_emitted: false,
    policy_updated: false,
    private_key_read: false,
    block0_sealed: false,
    identity_binding_performed: false,
    poi_reward_emitted: false,
  });
}

export function buildAgentDualLoopPreview({
  micro_slices,
  reward_refs = DEFAULT_REWARD_REFS,
} = {}) {
  const ranking = rankMicroSlices(micro_slices);
  const selected = ranking[0] ?? normalizeMicroSlice({}, 0);
  const rewardLens = buildRewardCandidateLens(reward_refs);
  const snrValue = computeSNRValue({
    signalEvents: selected.actionability + selected.proof_strength,
    noiseEvents: selected.noise,
  });
  const rsi = computeProcessRsi({
    events: [
      { type: "gate_passed", weight: selected.proof_strength },
      { type: "clean_commit", weight: selected.actionability },
      {
        type: selected.noise > 0 ? "scope_contamination" : "gate_passed",
        weight: selected.noise,
      },
    ],
  });
  const proofRails = buildProofRails(selected, rewardLens);

  return deepFreeze({
    schema: AGENT_DUAL_LOOP_PREVIEW_SCHEMA,
    truth_label: "PAT_SAT_DUAL_LOOP_PREVIEW_ONLY",
    mode: "preview_only",
    pat7_loop: buildPatLoop(selected),
    sat5_loop: buildSatLoop(selected, rewardLens),
    parallel_merge: Object.freeze({
      status: "MERGED_PREVIEW_ONLY",
      merge_rule: "PAT proposes; SAT gates; SNR ranks; RSI critiques process.",
      selected_micro_slice: selected.id,
      runtime_agents_executed: false,
    }),
    snr_engine: Object.freeze({
      schema: snrValue.schema,
      mode: snrValue.mode,
      signal_definition: "actionable architectural insight",
      noise_definition: "speculative implementation detail",
      selected_micro_slice: selected,
      ranking,
      score: snrValue.score,
      highest_score_autonomous_engine:
        "preview_selector_only_not_autonomous_runtime",
    }),
    rsi_lens: Object.freeze({
      ...rsi,
      process_quality_improved: rsi.score != null && rsi.score >= 50,
      policy_updated: false,
      reward_signal_applied: false,
    }),
    hhmm_state: buildHhmmState(selected, snrValue.score),
    proof_of_truth_convergence: proofRails,
    reward_candidate_lens: rewardLens,
    flywheel_candidate: Object.freeze({
      proof_of_impact: "DESIGNED_NOT_LIVE",
      dual_token: "DESIGNED_NOT_LIVE",
      urp: "DESIGNED_NOT_LIVE",
      ecosystem_flywheel_status: "PREVIEW_ONLY_NOT_ACTIVATED",
    }),
    boundary: buildBoundary(),
    what_this_proves:
      "Dema can model a PAT-7 proposal loop and SAT-5 verification loop as a deterministic preview/eval coordinator.",
    what_this_does_not_prove:
      "Live PAT/SAT autonomy, model invocation, RL policy updates, reward emission, Proof-of-Impact runtime, token minting, federation, or economic activation.",
  });
}

export function formatAgentDualLoopPreview(preview) {
  return [
    "DEMA · PAT/SAT Dual Loop Preview",
    "",
    `Verdict: ${preview.truth_label}`,
    "Mode: preview-only",
    `PAT-7: ${preview.pat7_loop.loop.join(" -> ")} (${preview.pat7_loop.status})`,
    `SAT-5: ${preview.sat5_loop.loop.join(" -> ")} (${preview.sat5_loop.status})`,
    `SNR selected: ${preview.snr_engine.selected_micro_slice.id}`,
    `RSI: ${preview.rsi_lens.score} (policy_updated: ${preview.rsi_lens.policy_updated})`,
    `HHMM: ${preview.hhmm_state.phase}`,
    `Blocking rail: ${preview.proof_of_truth_convergence.blocking_rail}`,
    `Reward lens: ${preview.reward_candidate_lens.status}; no reward emission`,
    "Boundary: no runtime agent execution; no model invocation; no receipt mint; no token or PoI runtime; no federation.",
    "",
    preview.what_this_does_not_prove,
  ].join("\n");
}
