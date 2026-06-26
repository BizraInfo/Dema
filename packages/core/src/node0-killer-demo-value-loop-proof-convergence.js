// NODE0-KILLER-DEMO-VALUE-LOOP-PROOF-CONVERGENCE-1A — pure compose gate.
//
// Integrates killer-demo CLI envelope, Proof-of-Truth Convergence grading,
// hermetic control-plane reference, SNR framing, and proactive ultra-micro
// self-loop declarations. Preview-only — no runtime, network, mint, or activation.

import { buildPreviewBoundary } from "./preview-boundary.js";
import {
  buildNode0KillerDemoValueLoopCli,
  verifyNode0KillerDemoValueLoopCli,
  NODE0_KILLER_DEMO_VALUE_LOOP_CLI_SCHEMA,
  NODE0_KILLER_DEMO_VALUE_LOOP_CLI_TRUTH_LABEL,
} from "./node0-killer-demo-value-loop-cli.js";
import {
  buildProofConvergencePreview,
  PROOF_CONVERGENCE_PREVIEW_SCHEMA,
} from "./proof-convergence-preview.js";
import {
  computeSNRValue,
  computeProcessRsi,
} from "./process-value-preview.js";
import {
  runNode0ProofOfTruthControlPlane,
  HERMETIC_CONTROL_PLANE_FIXTURE,
  NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_SCHEMA,
  NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_TRUTH_LABEL,
} from "./node0-proof-of-truth-control-plane.js";
import {
  buildNode0ProofSnapshotAttachment,
  verifyNode0ProofSnapshotAttachment,
  NODE0_PROOF_SNAPSHOT_ATTACHMENT_SCHEMA,
} from "./node0-proof-snapshot-attachment.js";

export const NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_SCHEMA =
  "bizra.dema.node0_killer_demo_value_loop_proof_convergence.v0.1";

export const NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_TRUTH_LABEL =
  "NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_PREVIEW_ONLY";

export const NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_COMMAND =
  "dema demo node0-value-loop convergence --json";

export const KILLER_DEMO_PROOF_CONVERGENCE_CLAIMS = Object.freeze([
  Object.freeze({
    id: "killer-demo-compose-gate",
    statement: "Scan modes through Node Space ontology compose gate verifies",
    rails: Object.freeze({
      formal: "spec_plus_test",
      cryptographic: "hash_bound",
      empirical: "passing_tests",
      economic: "designed_not_live",
    }),
  }),
  Object.freeze({
    id: "killer-demo-cli-surface",
    statement: "dema demo node0-value-loop exposes preview envelope",
    rails: Object.freeze({
      formal: "spec_plus_test",
      cryptographic: "schema_only",
      empirical: "passing_tests",
      economic: "designed_not_live",
    }),
  }),
  Object.freeze({
    id: "metadata-first-default",
    statement: "Default scan mode is metadata-only across device constellation",
    rails: Object.freeze({
      formal: "declared_spec",
      cryptographic: "schema_only",
      empirical: "passing_tests",
      economic: "designed_not_live",
    }),
  }),
  Object.freeze({
    id: "proof-control-plane-local",
    statement: "Local proof ledger caps release at READY_LOCAL",
    rails: Object.freeze({
      formal: "machine_checked",
      cryptographic: "hash_bound",
      empirical: "passing_tests",
      economic: "local_only",
    }),
  }),
  Object.freeze({
    id: "pre-token-economic-boundary",
    statement: "No live token, wallet, URP, or Node0 activation implied",
    rails: Object.freeze({
      formal: "spec_plus_test",
      cryptographic: "not_applicable",
      empirical: "passing_tests",
      economic: "designed_not_live",
    }),
  }),
]);

const SNR_SIGNAL_EVENTS = Object.freeze([
  Object.freeze({ id: "killer-demo-compose-gate", weight: 1 }),
  Object.freeze({ id: "killer-demo-cli-check", weight: 1 }),
  Object.freeze({ id: "proof-truth-hermetic-check", weight: 1 }),
  Object.freeze({ id: "proof-convergence-claims", weight: 1 }),
]);

const SNR_NOISE_EVENTS = Object.freeze([
  Object.freeze({ id: "autonomous-runtime-overclaim", weight: 1 }),
  Object.freeze({ id: "live-token-overclaim", weight: 1 }),
  Object.freeze({ id: "speculative-hhmm-engine", weight: 1 }),
]);

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freezeDeep(child);
  return value;
}

function boundaryAllFalse(boundary) {
  if (!boundary || typeof boundary !== "object") return false;
  return Object.values(boundary).every((v) => v === false);
}

function buildProactiveUltraMicroSelfLoop({ snr, convergence }) {
  const converged = convergence?.summary?.converged ?? 0;
  const total = convergence?.summary?.total ?? 0;
  return freezeDeep({
    critique: Object.freeze({
      verdict: snr?.dominant === "signal" ? "SIGNAL_DOMINANT" : "NOISE_FLOOD_HOLD",
      note: "Ultra-micro self-critique over killer-demo proof compose — preview only.",
    }),
    harness: Object.freeze({
      active_gates: Object.freeze([
        "node0-killer-demo-value-loop-compose-gate.mjs",
        "node0-killer-demo-value-loop-cli-check.mjs",
        "node0-proof-of-truth-control-plane-check.mjs",
        "node0-proof-snapshot-attachment-check.mjs",
        "node0-ci-evidence-attestation-check.mjs",
      ]),
      posture: "preview_only",
    }),
    consent: Object.freeze({
      required_phrase: "GO: preview killer demo proof convergence only",
      exact_string: true,
      collected: false,
    }),
    compliance: Object.freeze({
      no_autonomous_runtime: true,
      no_token_mint: true,
      no_network: true,
      preview_only: true,
    }),
    awareness: Object.freeze({
      what_this_proves: Object.freeze([
        "Killer-demo stack composes with four-rail proof convergence grading.",
        "Gathered proof:truth snapshot attaches with honest READY_LOCAL / BLOCKED discipline.",
      ]),
      what_this_does_not_prove: Object.freeze([
        "Not autonomous RSI, agent RL, or live HHMM inference.",
        "Not remote release, public-safe publication, or economic activation.",
      ]),
    }),
    loop_engineering: Object.freeze({
      hhmm_phase_hint: "VERIFY",
      next_safe_transition:
        converged === total && total > 0
          ? "Strengthen weakest convergence claim or supply verified CI evidence attestation"
          : "Strengthen weakest convergence claim before advancing",
      diffusion_reasoning: "preview_only_not_engine",
    }),
  });
}

function buildControlPlaneReferenceFromAttachment(proof_snapshot_attachment) {
  const ledger = proof_snapshot_attachment?.ledger;
  const summary = proof_snapshot_attachment?.ledger_summary ?? {};
  return freezeDeep({
    schema: NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_SCHEMA,
    truth_label: NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_TRUTH_LABEL,
    ok: proof_snapshot_attachment?.control_plane_verified?.ok === true,
    release_verdict: summary.release_verdict ?? ledger?.release_verdict ?? "BLOCKED",
    receipt_hash: summary.receipt_hash ?? ledger?.receipt_hash ?? null,
    commit: summary.commit ?? ledger?.commit ?? null,
    hermetic: proof_snapshot_attachment?.snapshot_source === "hermetic",
    gathered: proof_snapshot_attachment?.snapshot_source === "gathered",
    ready_local_eligible: proof_snapshot_attachment?.ready_local_eligible === true,
    preview_only: true,
  });
}

function buildControlPlaneReference() {
  const result = runNode0ProofOfTruthControlPlane({ ...HERMETIC_CONTROL_PLANE_FIXTURE });
  return freezeDeep({
    schema: NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_SCHEMA,
    truth_label: NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_TRUTH_LABEL,
    ok: result.ok,
    release_verdict: result.ledger?.release_verdict ?? "BLOCKED",
    receipt_hash: result.ledger?.receipt_hash ?? null,
    hermetic: true,
    preview_only: true,
  });
}

export function buildNode0KillerDemoValueLoopProofConvergence({
  claims = KILLER_DEMO_PROOF_CONVERGENCE_CLAIMS,
  proof_snapshot_audit = null,
} = {}) {
  const proof_snapshot_attachment = proof_snapshot_audit
    ? buildNode0ProofSnapshotAttachment({ auditResult: proof_snapshot_audit })
    : null;
  const killer_demo_cli = buildNode0KillerDemoValueLoopCli();
  const killer_demo_verified = verifyNode0KillerDemoValueLoopCli(killer_demo_cli);
  const proof_convergence = buildProofConvergencePreview({ claims });
  const control_plane = proof_snapshot_attachment
    ? buildControlPlaneReferenceFromAttachment(proof_snapshot_attachment)
    : buildControlPlaneReference();
  const snrRaw = computeSNRValue({
    signalEvents: SNR_SIGNAL_EVENTS.map((e) => ({ type: "gate_passed", weight: e.weight })),
    noiseEvents: SNR_NOISE_EVENTS.map((e) => ({ type: "runtime_ambiguity", weight: e.weight })),
  });
  const snr = Object.freeze({
    signal_count: snrRaw.signal_count,
    noise_count: snrRaw.noise_count,
    score: snrRaw.score,
    dominant: snrRaw.score >= 0.5 ? "signal" : "noise",
  });
  const process_rsi = computeProcessRsi({
    events: [
      ...SNR_SIGNAL_EVENTS.map((e) => ({ type: "gate_passed", weight: e.weight })),
      ...SNR_NOISE_EVENTS.map((e) => ({ type: "runtime_ambiguity", weight: e.weight })),
    ],
    window: 14,
  });
  const snrDominates = snrRaw.score != null && snrRaw.score >= 0.5;
  const rsiHealthy =
    process_rsi.malformed_events === 0 &&
    process_rsi.score != null &&
    process_rsi.score >= 40;
  const proactive_self = buildProactiveUltraMicroSelfLoop({ snr, convergence: proof_convergence });

  const converged = proof_convergence.summary?.converged ?? 0;
  const total = proof_convergence.summary?.total ?? 0;
  let compose_status = "PREVIEW_COMPOSED";
  if (!killer_demo_verified.ok) compose_status = "BLOCKED";
  else if (!proof_snapshot_attachment) compose_status = "BLOCKED";
  else if (verifyNode0ProofSnapshotAttachment(proof_snapshot_attachment).ok !== true) {
    compose_status = "BLOCKED";
  } else if (proof_snapshot_attachment.ready_local_eligible) {
    compose_status =
      converged < total ? "PROOF_ATTACHED_PARTIAL_CONVERGENCE" : "PROOF_ATTACHED_READY_LOCAL";
  } else if (converged < total) {
    compose_status = "PROOF_ATTACHED_ADVISORY_BLOCKED";
  } else {
    compose_status = "PROOF_ATTACHED_ADVISORY_BLOCKED";
  }

  return freezeDeep({
    schema: NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_SCHEMA,
    truth_label: NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_TRUTH_LABEL,
    command: NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_COMMAND,
    compose_status,
    proof_snapshot_attachment,
    killer_demo_cli: Object.freeze({
      schema: NODE0_KILLER_DEMO_VALUE_LOOP_CLI_SCHEMA,
      truth_label: NODE0_KILLER_DEMO_VALUE_LOOP_CLI_TRUTH_LABEL,
      verified_ok: killer_demo_verified.ok,
      demo_stage: killer_demo_cli.demo_stage,
      value_loop_summary: killer_demo_cli.value_loop_summary,
    }),
    proof_convergence,
    control_plane_reference: control_plane,
    snr_framework: Object.freeze({
      signal_count: snr.signal_count,
      noise_count: snr.noise_count,
      score: snr.score,
      dominant: snr.dominant,
      interpretation: "Signal = gate-backed architectural insight; Noise = runtime/economic overclaim",
    }),
    process_rsi,
    hhmm_hint: Object.freeze({
      current_phase: "VERIFY",
      note: "Hierarchical phase hint only — not a live HHMM engine",
    }),
    proactive_self,
    autonomous_rsi: Object.freeze({
      process_rsi: process_rsi.score,
      process_rsi_normalized: process_rsi.normalized_score,
      merged_verdict:
        snrDominates && rsiHealthy
          ? "CONTINUE_MICRO_SLICE"
          : "HOLD_AND_REDUCE_NOISE",
      merged_preview: true,
      not_autonomous_runtime: true,
      not_agent_rl: true,
      reward_verified: false,
    }),
    what_this_proves: Object.freeze([
      "Killer-demo value loop integrates with four-rail Proof-of-Truth Convergence preview.",
      "Gathered proof:truth snapshot attaches with honest release verdict and advisory rails.",
      "SNR framing favors actionable gate evidence over speculative runtime claims.",
    ]),
    what_this_does_not_prove: Object.freeze([
      "Not BIZRA Node0 activation, Singularity Pulse, or autopoietic live runtime.",
      "Not agent RL with verified reward or primordial perception protocols.",
      "Convergence grades curated claims — not a live production certification.",
    ]),
    boundary: buildPreviewBoundary(),
    boundaries: buildPreviewBoundary(),
  });
}

export function verifyNode0KillerDemoValueLoopProofConvergence(composed) {
  const blocked_by = [];

  if (!composed || composed.schema !== NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_SCHEMA) {
    blocked_by.push("invalid_schema");
    return freezeDeep({ ok: false, blocked_by });
  }
  if (composed.truth_label !== NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_TRUTH_LABEL) {
    blocked_by.push("invalid_truth_label");
  }
  if (composed.command !== NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_COMMAND) {
    blocked_by.push("invalid_command");
  }
  if (composed.killer_demo_cli?.verified_ok !== true) {
    blocked_by.push("killer_demo_cli_not_verified");
  }
  if (composed.proof_snapshot_attachment?.schema !== NODE0_PROOF_SNAPSHOT_ATTACHMENT_SCHEMA) {
    blocked_by.push("proof_snapshot_attachment_missing");
  } else {
    const attachmentVerified = verifyNode0ProofSnapshotAttachment(
      composed.proof_snapshot_attachment,
    );
    if (!attachmentVerified.ok) {
      blocked_by.push("proof_snapshot_attachment_invalid");
      for (const code of attachmentVerified.blocked_by) {
        blocked_by.push(`proof_snapshot_${code}`);
      }
    }
  }
  if (!composed.control_plane_reference?.release_verdict) {
    blocked_by.push("control_plane_release_verdict_missing");
  }
  if (composed.control_plane_reference?.gathered !== true) {
    blocked_by.push("control_plane_not_gathered");
  }
  if (composed.proof_convergence?.schema !== PROOF_CONVERGENCE_PREVIEW_SCHEMA) {
    blocked_by.push("invalid_proof_convergence_schema");
  }
  if ((composed.proof_convergence?.summary?.total ?? 0) < 1) {
    blocked_by.push("proof_convergence_empty");
  }
  if (composed.autonomous_rsi?.not_autonomous_runtime !== true) {
    blocked_by.push("autonomous_runtime_overclaim");
  }
  if (composed.autonomous_rsi?.not_agent_rl !== true) {
    blocked_by.push("agent_rl_overclaim");
  }
  if (!boundaryAllFalse(composed.boundary)) {
    blocked_by.push("boundary_not_all_false");
  }
  if (!boundaryAllFalse(composed.boundaries)) {
    blocked_by.push("boundaries_not_all_false");
  }
  if (composed.compose_status === "BLOCKED") {
    blocked_by.push("compose_status_blocked");
  }

  const ps = composed.proactive_self;
  if (!ps?.consent?.required_phrase) blocked_by.push("proactive_consent_missing");
  if (ps?.compliance?.no_autonomous_runtime !== true) {
    blocked_by.push("proactive_compliance_autonomy");
  }

  return freezeDeep({ ok: blocked_by.length === 0, blocked_by });
}

export function runNode0KillerDemoValueLoopProofConvergence(params = {}) {
  const composed = buildNode0KillerDemoValueLoopProofConvergence(params);
  const verified = verifyNode0KillerDemoValueLoopProofConvergence(composed);
  return freezeDeep({
    ok: verified.ok,
    schema: NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_SCHEMA,
    truth_label: NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_TRUTH_LABEL,
    verified,
    compose_status: composed.compose_status,
    convergence_summary: composed.proof_convergence?.summary ?? {},
    proof_snapshot_attached: composed.proof_snapshot_attachment != null,
    ready_local_eligible: composed.proof_snapshot_attachment?.ready_local_eligible ?? false,
    release_verdict: composed.control_plane_reference?.release_verdict ?? "BLOCKED",
    composed,
  });
}

export function formatNode0KillerDemoValueLoopProofConvergence(composed) {
  const summary = composed.proof_convergence?.summary ?? {};
  return [
    "DEMA · Node0 killer demo proof convergence (preview-only)",
    `  schema: ${composed.schema}`,
    `  truth: ${composed.truth_label}`,
    `  compose_status: ${composed.compose_status}`,
    `  convergence: ${summary.converged ?? 0}/${summary.total ?? 0} CONVERGED`,
    `  control_plane: ${composed.control_plane_reference?.release_verdict ?? "UNKNOWN"}`,
    `  proof_attached: ${composed.proof_snapshot_attachment != null}`,
    `  ready_local_eligible: ${composed.proof_snapshot_attachment?.ready_local_eligible ?? false}`,
    `  snr: ${composed.snr_framework?.dominant ?? "UNKNOWN"}`,
  ].join("\n");
}
