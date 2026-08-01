// PEAK-SELF-LOOP-1A · Ultra-micro proactive self-loop preview (pure compose).
//
// Fuses existing spine kernels without new runtime:
//   · Craftsmanship Witness (MC 10 · RSI · micro-consent · self harness)
//   · Proof-of-Truth Convergence (Formal ‖ Cryptographic ‖ Empirical ‖ Economic)
//   · SNR + Process RSI (signal vs noise · actionable vs speculative)
//   · HHMM lifecycle preview + diffusion amplifier (belief spread across phases)
//   · Event hash table (O(1) lookup of declared signal/noise events)
//   · Shoulders protocol (giants → Dema surfaces · DECLARED mapping only)
//   · Agent-outside-sandbox orchestration posture (PAT/SAT propose · sandbox proves)
//   · Bounded OODA review + RSI proposal gate + micro process-mining ref
//
// NOT autonomous runtime. NOT HHMM engine. NOT economic activation.
// Caller may override declared inputs; defaults describe the delivery-spine slice.

import { buildCraftsmanshipWitnessPreview } from "./craftsmanship-witness-preview.js";
import { buildProofConvergencePreview } from "./proof-convergence-preview.js";
import {
  computeProcessRsi,
  computeSNRValue,
} from "./process-value-preview.js";
import { buildPreviewBoundary } from "./preview-boundary.js";
import { buildSelfLoopOodaCycle } from "./self-loop-ooda.js";
import {
  buildPeakVerificationAdmissionDefault,
  evaluateVerificationAdmission,
} from "./verification-admission.js";
import { buildRsiProposalPreview } from "./rsi-proposal-preview.js";

export const PEAK_SELF_LOOP_PREVIEW_SCHEMA =
  "bizra.dema.peak_self_loop_preview.v0.1";

const HHMM_PHASES = Object.freeze([
  "UNDERSTAND",
  "PLAN",
  "ACT",
  "VERIFY",
  "SETTLE",
]);

const DEFAULT_SIGNAL_EVENTS = Object.freeze([
  Object.freeze({
    id: "ux-first-look-gate",
    type: "gate_passed",
    weight: 1,
    label: "UX first-look gate green",
  }),
  Object.freeze({
    id: "delivery-readiness-gate",
    type: "gate_passed",
    weight: 1,
    label: "Delivery readiness gate green",
  }),
  Object.freeze({
    id: "realm-ux-2",
    type: "clean_commit",
    weight: 1,
    label: "Realm UX-2 menu + wallet + timeline",
  }),
  Object.freeze({
    id: "peak-self-loop-wired",
    type: "clean_commit",
    weight: 1,
    label: "Peak self-loop + Proof Studio dispatch shipped",
  }),
  Object.freeze({
    id: "proof-spine-local-gates",
    type: "gate_passed",
    weight: 1,
    label: "npm test + npm run check + dema harness CLEAN on NODE0",
  }),
  Object.freeze({
    id: "node0-spine-runner-sandbox",
    type: "clean_commit",
    weight: 1,
    label: "Measured proof spine runs inside sandbox only (#312)",
  }),
  Object.freeze({
    id: "billing-lock-local-proof-lane",
    type: "gate_passed",
    weight: 1,
    label: "proof:truth:local-lane READY_LOCAL when vendor billing lock",
  }),
  Object.freeze({
    id: "undo-proven-1a",
    type: "clean_commit",
    weight: 1,
    label: "UNDO-PROVEN-1A measured inverse correction preview",
  }),
  Object.freeze({
    id: "proof-of-spend-1a",
    type: "clean_commit",
    weight: 1,
    label: "PROOF-OF-SPEND-1A founder cost receipt (FOUNDER_COST_MEASURED_NOT_VALUE)",
  }),
]);

const DEFAULT_NOISE_EVENTS = Object.freeze([
  Object.freeze({
    id: "speculative-autonomy",
    type: "runtime_ambiguity",
    weight: 1,
    label: "Rejected: autonomous runtime on greet",
  }),
  Object.freeze({
    id: "vendor-ci-as-sole-truth",
    type: "scope_contamination",
    weight: 1,
    label: "Rejected: GitHub green as only proof witness",
  }),
  Object.freeze({
    id: "mobile-node-actuator-without-adr",
    type: "scope_contamination",
    weight: 1,
    label: "Rejected: phone runs node / LAN admin without MOBILE-NODE-ACCESS ADR",
  }),
]);

const DEFAULT_CONVERGENCE_CLAIMS = Object.freeze([
  Object.freeze({
    id: "delivery-spine-face",
    statement: "Bare dema renders human-first companion home",
    rails: {
      formal: "spec_plus_test",
      cryptographic: "schema_only",
      empirical: "passing_tests",
      economic: "not_applicable",
    },
  }),
  Object.freeze({
    id: "realm-peak-ux",
    statement: "Realm hub menu dispatch + wallet intent ledger",
    rails: {
      formal: "spec_plus_test",
      cryptographic: "schema_only",
      empirical: "passing_tests",
      economic: "designed_not_live",
    },
  }),
  Object.freeze({
    id: "agent-outside-sandbox-orchestration",
    statement:
      "Agent/orchestrator proposes outside sandbox; governed spine proves inside sandbox",
    rails: {
      formal: "spec_plus_test",
      cryptographic: "schema_only",
      empirical: "passing_tests",
      economic: "not_applicable",
    },
  }),
  Object.freeze({
    id: "proof-of-spend-founder-cost",
    statement:
      "External spend CSV yields verifiable monthly burn claim under FOUNDER_COST_MEASURED_NOT_VALUE",
    rails: {
      formal: "spec_plus_test",
      cryptographic: "receipt_sealed_local",
      empirical: "operator_sealed_receipt",
      economic: "measured_not_value",
    },
  }),
]);

const SHOULDERS_PROTOCOL = Object.freeze([
  Object.freeze({
    giant: "MMORPG realm continuity",
    dema_surface: "dema realm · checkpoint · board",
    truth_label: "SHIPPED_LOCAL",
  }),
  Object.freeze({
    giant: "Pi.dev personal companion",
    dema_surface: "dema first-look home",
    truth_label: "SHIPPED_LOCAL",
  }),
  Object.freeze({
    giant: "OpenClaw bounded tools",
    dema_surface: "consent-gated file/web access previews",
    truth_label: "DECLARED",
  }),
  Object.freeze({
    giant: "Hermes-style routing",
    dema_surface: "dema chat · command suggester",
    truth_label: "PARTIAL",
  }),
  Object.freeze({
    giant: "Islamic finance ethics layer",
    dema_surface: "dema realm wallet · riba-zero boundary",
    truth_label: "GENESIS_TEST_MODE",
  }),
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function buildEventHashTable(signalEvents, noiseEvents) {
  const table = {};
  for (const e of signalEvents) {
    const id = e.id || e.type;
    table[id] = Object.freeze({
      snr_class: "signal",
      type: e.type,
      weight: e.weight ?? 1,
      label: e.label ?? e.type,
    });
  }
  for (const e of noiseEvents) {
    const id = e.id || `noise:${e.type}`;
    table[id] = Object.freeze({
      snr_class: "noise",
      type: e.type,
      weight: e.weight ?? 1,
      label: e.label ?? e.type,
    });
  }
  return Object.freeze(table);
}

function diffuseHhmmBelief(snrScore, phases = HHMM_PHASES) {
  const n = phases.length;
  const base = 1 / n;
  const boost = snrScore == null ? 0 : clamp(snrScore, 0, 1) * 0.15;
  const weights = phases.map((phase, i) => {
    const centerBias = 1 - Math.abs(i - (n - 1) / 2) / (n / 2);
    return base + boost * centerBias;
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  return Object.freeze(
    phases.map((phase, i) =>
      Object.freeze({
        phase,
        belief: round(weights[i] / sum, 4),
      }),
    ),
  );
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function round(v, places = 4) {
  return Number(v.toFixed(places));
}

function selectHighestSnrEngine(snr, rsi, convergence) {
  const candidates = [
    {
      id: "snr_framework",
      score: snr.score ?? 0,
      reason: "Signal = actionable architectural insight",
    },
    {
      id: "process_rsi",
      score: rsi.score == null ? 0 : rsi.score / 100,
      reason: "Recursive self-improvement from declared events",
    },
    {
      id: "proof_convergence_floor",
      score: (convergence.summary.weakest_claim ? 0.2 : 0) + snr.score * 0.5,
      reason: "Weakest-rail bounded convergence",
    },
  ];
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  return Object.freeze({
    selected: sorted[0].id,
    ranking: Object.freeze(sorted),
    autonomous_label: "DECLARED_PREVIEW_ONLY_NOT_RUNTIME",
  });
}

function buildAgentOrchestrationPosture({ ciAdvisoryBlocked = false } = {}) {
  return Object.freeze({
    doctrine: "agent_outside_sandbox_not_inside",
    analogy: Object.freeze({
      model: "air_traffic_control",
      mapping:
        "Controller (agent/orchestrator/PAT-SAT) plans and routes outside the runway; aircraft (governed sandbox execute) moves only under clearance and leaves receipts on the strip.",
      useful_because:
        "Separates proposal authority from mutation authority so supply-chain or billing shocks cannot be mistaken for code failure.",
      not_analogous_to: Object.freeze([
        "autonomous agent with shell inside the sandbox",
        "LLM executing operator files without consent",
      ]),
      boundary: "preview_mapping_only_not_runtime_posture",
    }),
    roles: Object.freeze({
      outside_sandbox: Object.freeze([
        "PAT propose · plan · decompose",
        "SAT verify · boundary · doctrine",
        "dema orchestrator verify (read-only pipeline)",
        "peak-self-loop · harness · process-mining mirror",
      ]),
      inside_sandbox: Object.freeze([
        "node0 spine runner measured execute",
        "reversible rename + backup + undo proof",
        "receipt signing attestation (keys outside repo)",
      ]),
    }),
    signing_authority_ne_execution_authority: true,
    operator_mutation_outside_sandbox: false,
    local_proof_lane_when_ci_advisory_blocked: ciAdvisoryBlocked,
    what_this_proves:
      "Orchestration posture is declared: propose outside, prove inside, consent between",
    what_this_does_not_prove:
      "Live PAT/SAT runtime, autonomous loops, or operator-wide mutation",
  });
}

function buildReasoningModesPreview({ snr, convergence }) {
  const weakest = convergence?.summary?.weakest_claim ?? "unknown";
  return Object.freeze({
    sequential: Object.freeze({
      mode: "SEQUENTIAL_REASONING_PREVIEW",
      chain: Object.freeze([
        "Observe disk + gates (no zann)",
        "Orient to proof-spine backlog rank",
        "Decide micro-slice with exact consent",
        "Verify npm test / check / harness",
        "Settle receipt or HOLD expansion",
      ]),
      current_step: snr?.score != null && snr.score >= 0.5 ? "Decide micro-slice" : "Reduce noise",
    }),
    analogical: Object.freeze({
      model: "game_master_outside_world",
      mapping:
        "Dema is rulebook + map legend; sandbox is the arena; agent never becomes the arena.",
      boundary: "analogy_not_evidence",
    }),
    critical: Object.freeze({
      mode: "CRITICAL_THINKING_PREVIEW",
      questions: Object.freeze([
        "What proves this claim on disk?",
        "Is CI failure code or environment (billing lock)?",
        `Weakest convergence claim: ${weakest}`,
      ]),
    }),
    creative: Object.freeze({
      mode: "ULTRA_CREATIVE_PREVIEW_BOUNDED",
      constraint: "Creativity must name a verifiable next slice, not mythology",
      allowed_outputs: Object.freeze([
        "micro-slice id + consent phrase + gate command",
      ]),
      forbidden_outputs: Object.freeze([
        "autonomous runtime",
        "live AGI",
        "skip consent",
      ]),
    }),
  });
}

function buildMicroProcessMiningRef() {
  return Object.freeze({
    spine_command: "dema process-mining",
    harness_command: "dema harness --summary --json",
    mode: "preview_only",
    acts_on_data: false,
    offers_mirror: true,
    blocked_effects: Object.freeze(["operator_judgment"]),
    integration_note:
      "Mirror operator patterns; pair with harness self-proactive block for gate posture",
  });
}

function buildPeakOodaReviewCycle() {
  return buildSelfLoopOodaCycle({
    cycle_id: "peak-self-loop-ultra-micro-1a",
    steps: [
      {
        phase: "observe",
        claim: "Local gates and remote CI advisory state are distinguishable",
        evidence: [
          "packages/core/src/dema-fde-dual-diagnostic.js",
          "npm test",
          "runner_id=0 billing lock pattern",
        ],
      },
      {
        phase: "orient",
        claim: "Agent-outside-sandbox posture ranks LOCAL proof before vendor merge",
        evidence: [
          "packages/core/src/node0-spine-runner.js",
          "docs/CURRENT_LIMITS.md READY_LOCAL cap",
        ],
      },
      {
        phase: "decide",
        claim: "Next bounded slice uses micro-consent and sandbox execute only",
        evidence: ["packages/fate/src/fate.js", "PEAK-SELF-LOOP-1A"],
      },
      {
        phase: "act",
        claim: "Kernel records proposed sandbox slice only; does not execute",
        evidence: ["packages/core/src/self-loop-ooda.js action_executed_by_kernel:false"],
        proposed_action: "GO: run measured proof spine in sandbox",
      },
      {
        phase: "review",
        claim: "Self-critique + harness must pass before expansion",
        evidence: [
          "packages/core/src/harness-integration.js",
          "dema peak-self-loop --json",
        ],
      },
    ],
  });
}

function buildIntegrationRsiGate({ signalEvents, noiseEvents, processEvents }) {
  return buildRsiProposalPreview({
    evidenceAnchors: [
      "packages/core/src/peak-self-loop-preview.js",
      "tests/peak-self-loop-preview.test.js",
      "packages/core/src/harness-integration.js",
    ],
    candidate: {
      title: "Peak ultra-micro integration: agent outside sandbox compose",
      summary:
        "Compose proactive harness, micro-consent, OODA review, and process-mining ref without runtime",
      proposed_action: "Extend peak-self-loop preview surface only",
    },
    targetFrameworks: ["self-loop-engineering", "proof-closeout"],
    processEvents,
    signalEvents,
    noiseEvents,
  });
}

function buildProactiveSelf({
  snr,
  craftsmanship,
  convergence,
  hhmm,
  consentPhrase,
  ciAdvisoryBlocked = false,
  companionDeviceConnected = false,
  proposed_act = "",
  verifier = "",
  proposer = "",
  certifier = "",
  verifier_bindings = {},
}) {
  const localHarnessGates = Object.freeze([
    "ux-first-look-gate",
    "delivery-readiness-gate",
    "performance-budget-gate",
    "kernel-purity-check",
    "dema-harness-integration",
    "node0-proof-of-truth-control-plane-check",
    "peak-verify-admission",
  ]);
  const nextGate = ciAdvisoryBlocked
    ? "DONE_LOCAL slices + operator seal; remote CI advisory when billing clears"
    : "reviewer PR merge + CI remote green";

  const verification_admission =
    text(proposed_act) || text(verifier)
      ? evaluateVerificationAdmission({
          proposed_act,
          verifier,
          proposer,
          certifier,
          bindings: verifier_bindings,
        })
      : buildPeakVerificationAdmissionDefault();

  return Object.freeze({
    critique: Object.freeze({
      verdict:
        snr.verdict === "PREVIEW_REJECT" ||
        (snr.score != null && snr.score < 0.5)
          ? "HOLD — noise dominates signal"
          : "CONTINUE — micro-slice discipline holds",
      gaps: Object.freeze(
        [
          convergence.summary.declared > 0
            ? `${convergence.summary.declared} claim(s) still DECLARED convergence`
            : null,
          snr.score != null && snr.score < 0.7
            ? "Raise SNR before next expansion slice"
            : null,
          ciAdvisoryBlocked
            ? "Remote CI advisory blocked — continue LOCAL proof lane"
            : null,
          !companionDeviceConnected
            ? "Mobile companion declared (Z Fold 6) but not connected — export-and-index bridge only"
            : null,
          verification_admission.self_verifiable !== true
            ? `VERIFY admission refused (${verification_admission.refusal_reason}) — output not eligible as next INPUT`
            : null,
        ].filter(Boolean),
      ),
      limitation:
        "Self-critique is deterministic compose over declared gates — not live agent reflection",
    }),
    harness: Object.freeze({
      active_gates: localHarnessGates,
      next_gate: nextGate,
      self_proactive_posture: "preview_only",
      commands: Object.freeze([
        "dema harness --summary --json",
        "npm test",
        "npm run check",
        "dema peak-self-loop --json",
      ]),
    }),
    consent: Object.freeze({
      required_phrase: consentPhrase,
      auto_applied: false,
      exact_string_required_for_gated_actions: true,
      broad_consent_allowed: false,
      consent_observed_in_preview: false,
    }),
    compliance: Object.freeze({
      master_craftsmanship_compliant:
        craftsmanship.master_craftsmanship_compliance.overall_compliant,
      boundary_canonical: true,
      preview_only: true,
      no_autonomous_runtime: true,
      no_network: true,
      no_token_mint: true,
      reinsert_requires_judge_free_admission: true,
      reinsert_eligible: verification_admission.reinsert_eligible === true,
    }),
    verification_admission,
    awareness: Object.freeze({
      truth_label: "NODE0_LOCAL_SEED",
      what_this_proves:
        "Declared self-loop composition is structurally coherent and gate-aligned; VERIFY admission is judge-free",
      what_this_does_not_prove:
        "Autonomy, live scoring, HHMM runtime, economic rights, federation, or closed re-insert loop",
    }),
    loop_engineering: Object.freeze({
      hhmm_current: hhmm.peak_phase,
      hhmm_belief: hhmm.diffusion,
      next_safe_transition: ciAdvisoryBlocked
        ? "VERIFY locally → SETTLE receipt → await remote advisory"
        : "VERIFY → SETTLE after CI green",
      blocked_transitions: Object.freeze([
        "ACT→economic without consent",
        "SETTLE→federation without proof ladder",
        "ACT→operator mutation outside sandbox",
        "ACT→mobile node control without ADR",
        "EVAL→INPUT without judge-free admission",
      ]),
    }),
  });
}

function buildUltraMicroComposeMap() {
  return Object.freeze({
    id: "peak-ultra-micro-compose-1a",
    subsystems: Object.freeze([
      "proactive_self.critique",
      "proactive_self.harness",
      "proactive_self.consent",
      "proactive_self.compliance",
      "proactive_self.verification_admission",
      "reasoning_modes.sequential",
      "reasoning_modes.analogical",
      "reasoning_modes.critical",
      "reasoning_modes.creative",
      "micro_process_mining",
      "agent_orchestration",
      "self_loop_ooda",
      "rsi_integration_gate",
      "craftsmanship_witness",
    ]),
    agent_posture: "outside_sandbox_proposes_inside_sandbox_proves",
    mode: "preview_only",
  });
}

function buildProofSpineBacklogRank() {
  return Object.freeze([
    Object.freeze({
      rank: 1,
      slice: "PROOF-OF-SPEND-1A",
      status: "SHIPPED_BRANCH",
      next_command: "dema corpus spend --file <abs_csv> --consent GO: content_read <path>",
    }),
    Object.freeze({
      rank: 2,
      slice: "STYLE-PILLAR-MICRO-1A",
      status: "SHIPPED_BRANCH",
      next_command: "npm run check (style-pillar-check.mjs wired)",
    }),
    Object.freeze({
      rank: 3,
      slice: "MOBILE-COMPANION-REGISTER-1A",
      status: "SHIPPED_BRANCH",
      next_command:
        "dema node-registry companion-register --consent \"GO register companion device Z Fold 6 for Node0\" --json",
    }),
  ]);
}

export function buildPeakSelfLoopPreview({
  signal_events = DEFAULT_SIGNAL_EVENTS,
  noise_events = DEFAULT_NOISE_EVENTS,
  convergence_claims = DEFAULT_CONVERGENCE_CLAIMS,
  rsi_signal_inputs = [],
  slice_history = null,
  consent_phrase = "GO: act on peak-self-loop suggestion",
  ci_advisory_blocked = false,
  companion_device_connected = false,
  proposed_act = "",
  verifier = "",
  proposer = "",
  certifier = "",
  verifier_bindings = {},
} = {}) {
  const signalEvents = Array.isArray(signal_events)
    ? signal_events
    : [...DEFAULT_SIGNAL_EVENTS];
  const noiseEvents = Array.isArray(noise_events)
    ? noise_events
    : [...DEFAULT_NOISE_EVENTS];

  const snr = computeSNRValue({
    signalEvents: signalEvents.map((e) => ({ type: e.type, weight: e.weight })),
    noiseEvents: noiseEvents.map((e) => ({ type: e.type, weight: e.weight })),
  });

  const processEvents = [
    ...signalEvents.map((e) => ({ type: e.type, weight: e.weight })),
    ...noiseEvents.map((e) => ({ type: e.type, weight: e.weight })),
  ];
  const rsi = computeProcessRsi({ events: processEvents, window: 14 });

  const convergence = buildProofConvergencePreview({
    claims: convergence_claims,
  });

  const craftsmanship = buildCraftsmanshipWitnessPreview({
    rsi_signal_inputs,
    slice_history,
    next_slice_signals: [
      {
        id: "style-pillar-micro-1a",
        text: "Stdlib-only style-pillar-check in npm run check (zero-dep gate safe)",
        evidence:
          "docs/ROADMAP.md rank 5 · scripts/review/zero-dep-gate.mjs blocks naive ESLint in package.json",
      },
      {
        id: "mobile-companion-export-bridge",
        text: "Bridge mobile via export folder + dema scan; register companion only after ADR",
        evidence:
          "docs/02-architecture/dema-mobile-qr-consent-v0.md · companion_device_count:0 default",
      },
    ],
  });

  const event_hash_table = buildEventHashTable(signalEvents, noiseEvents);
  const diffusion = diffuseHhmmBelief(snr.score);
  const peakPhase = diffusion.reduce((best, row) =>
    row.belief > best.belief ? row : best,
  ).phase;

  const hhmm = Object.freeze({
    phases: HHMM_PHASES,
    diffusion,
    peak_phase: peakPhase,
    mode: "preview_diffusion_not_runtime_engine",
  });

  const snr_framework = Object.freeze({
    signal_definition: "actionable architectural insight",
    noise_definition: "speculative implementation detail",
    score: snr.score,
    verdict: snr.verdict,
    signal_count: signalEvents.length,
    noise_count: noiseEvents.length,
  });

  const snrDominates =
    snr.verdict !== "PREVIEW_REJECT" &&
    snr.score != null &&
    snr.score >= 0.5;
  const rsiHealthy =
    rsi.malformed_events === 0 &&
    rsi.score != null &&
    rsi.score >= 40;
  const autonomous_rsi = Object.freeze({
    process_rsi: rsi.score,
    process_rsi_normalized: rsi.normalized_score,
    craftsmanship_rsi_count: craftsmanship.rsi_signals.length,
    merged_verdict:
      snrDominates && rsiHealthy
        ? "CONTINUE_MICRO_SLICE"
        : "HOLD_AND_REDUCE_NOISE",
    not_autonomous_runtime: true,
  });

  const engine = selectHighestSnrEngine(snr, rsi, convergence);

  const proactive_self = buildProactiveSelf({
    snr,
    craftsmanship,
    convergence,
    hhmm,
    consentPhrase: consent_phrase,
    ciAdvisoryBlocked: ci_advisory_blocked === true,
    companionDeviceConnected: companion_device_connected === true,
    proposed_act,
    verifier,
    proposer,
    certifier,
    verifier_bindings,
  });

  const agent_orchestration = buildAgentOrchestrationPosture({
    ciAdvisoryBlocked: ci_advisory_blocked === true,
  });
  const reasoning_modes = buildReasoningModesPreview({ snr, convergence });
  const micro_process_mining = buildMicroProcessMiningRef();
  const self_loop_ooda = buildPeakOodaReviewCycle();
  const rsi_integration_gate = buildIntegrationRsiGate({
    signalEvents: signalEvents.map((e) => ({ type: e.type, weight: e.weight })),
    noiseEvents: noiseEvents.map((e) => ({ type: e.type, weight: e.weight })),
    processEvents,
  });
  const ultra_micro_compose = buildUltraMicroComposeMap();
  const proof_spine_backlog = buildProofSpineBacklogRank();

  return deepFreeze({
    schema: PEAK_SELF_LOOP_PREVIEW_SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    receipt_shape_ready: true,
    snr_framework,
    proof_of_truth_convergence: convergence,
    hhmm,
    event_hash_table,
    diffusion_reasoning_amplifier: Object.freeze({
      description:
        "Spreads belief mass across HHMM phases from SNR score (preview math only)",
      peak_phase: peakPhase,
      belief: diffusion,
    }),
    craftsmanship_witness: craftsmanship,
    autonomous_rsi,
    shoulders_protocol: Object.freeze({
      selection_rule: "highest_snr_actionable_micro_slice_first",
      refs: SHOULDERS_PROTOCOL,
    }),
    snr_autonomous_engine: engine,
    proactive_self,
    agent_orchestration,
    reasoning_modes,
    micro_process_mining,
    self_loop_ooda,
    rsi_integration_gate,
    ultra_micro_compose,
    proof_spine_backlog,
    what_this_proves:
      "Peak ultra-micro self-loop preview composes SNR, convergence, HHMM diffusion, MC witness, agent-outside-sandbox posture, OODA review, and RSI gate without runtime",
    what_this_does_not_prove:
      "Live autonomy, HHMM engine execution, economic activation, or cryptographic seal",
    boundary: buildPreviewBoundary(),
  });
}

export function renderPeakSelfLoopPreview(preview, { useColor = false } = {}) {
  const lines = [
    "DEMA · PEAK SELF-LOOP (ultra-micro preview)",
    "",
    `SNR: ${preview.snr_framework.score ?? "—"} (${preview.snr_framework.verdict})`,
    `  Signal: ${preview.snr_framework.signal_definition}`,
    `  Noise:  ${preview.snr_framework.noise_definition}`,
    "",
    "Proof-of-Truth Convergence:",
    `  claims=${preview.proof_of_truth_convergence.summary.total} · converged=${preview.proof_of_truth_convergence.summary.converged} · partial=${preview.proof_of_truth_convergence.summary.partial}`,
    "",
    "HHMM diffusion (preview):",
    ...preview.hhmm.diffusion.map(
      (r) => `  ${r.phase.padEnd(10)} ${(r.belief * 100).toFixed(1)}%`,
    ),
    `  peak phase: ${preview.hhmm.peak_phase}`,
    "",
    "Proactive self-loop:",
    `  critique:    ${preview.proactive_self.critique.verdict}`,
    `  harness:     ${preview.proactive_self.harness.active_gates.length} gates active`,
    `  consent:     ${preview.proactive_self.consent.required_phrase}`,
    `  compliance:  MC ${preview.proactive_self.compliance.master_craftsmanship_compliant ? "OK" : "GAP"} · reinsert ${preview.proactive_self.compliance.reinsert_eligible ? "ELIGIBLE" : "BLOCKED"}`,
    `  admission:   self_verifiable=${preview.proactive_self.verification_admission.self_verifiable} · ${preview.proactive_self.verification_admission.refusal_reason ?? preview.proactive_self.verification_admission.named_verifier ?? "awaiting_act"}`,
    `  awareness:   ${preview.proactive_self.awareness.what_this_proves}`,
    `  loop:        ${preview.proactive_self.loop_engineering.hhmm_current} → ${preview.proactive_self.loop_engineering.next_safe_transition}`,
    "",
    "Agent outside sandbox:",
    `  doctrine: ${preview.agent_orchestration.doctrine}`,
    `  analogy:  ${preview.agent_orchestration.analogy.model}`,
    `  local_lane_when_ci_blocked: ${preview.agent_orchestration.local_proof_lane_when_ci_advisory_blocked}`,
    "",
    "OODA review:",
    `  recommendation: ${preview.self_loop_ooda.recommendation ?? preview.self_loop_ooda.reason_code}`,
    `  act executed:   ${preview.self_loop_ooda.action_executed_by_kernel === false}`,
    "",
    "Reasoning modes (preview):",
    `  sequential: ${preview.reasoning_modes.sequential.current_step}`,
    `  analogical: ${preview.reasoning_modes.analogical.model}`,
    `  critical:   weakest claim → ${preview.reasoning_modes.critical.questions[2]}`,
    "",
    "RSI integration gate:",
    `  ${preview.rsi_integration_gate.recommendation} — ${preview.rsi_integration_gate.recommendation_reason}`,
    "",
    `Engine: ${preview.snr_autonomous_engine.selected} (preview ranking, not live agent)`,
    `RSI: ${preview.autonomous_rsi.merged_verdict}`,
    "",
    preview.what_this_does_not_prove,
    "",
  ];
  return lines.join("\n");
}
