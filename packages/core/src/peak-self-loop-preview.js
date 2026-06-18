// PEAK-SELF-LOOP-1A · Ultra-micro proactive self-loop preview (pure compose).
//
// Fuses existing spine kernels without new runtime:
//   · Craftsmanship Witness (MC 10 · RSI · micro-consent · self harness)
//   · Proof-of-Truth Convergence (Formal ‖ Cryptographic ‖ Empirical ‖ Economic)
//   · SNR + Process RSI (signal vs noise · actionable vs speculative)
//   · HHMM lifecycle preview + diffusion amplifier (belief spread across phases)
//   · Event hash table (O(1) lookup of declared signal/noise events)
//   · Shoulders protocol (giants → Dema surfaces · DECLARED mapping only)
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
]);

const DEFAULT_NOISE_EVENTS = Object.freeze([
  Object.freeze({
    id: "speculative-autonomy",
    type: "runtime_ambiguity",
    weight: 1,
    label: "Rejected: autonomous runtime on greet",
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

function buildProactiveSelf({
  snr,
  craftsmanship,
  convergence,
  hhmm,
  consentPhrase,
}) {
  return Object.freeze({
    critique: Object.freeze({
      verdict:
        snr.verdict === "PREVIEW_REJECT" ||
        (snr.score != null && snr.score < 0.5)
          ? "HOLD — noise dominates signal"
          : "CONTINUE — micro-slice discipline holds",
      gaps: Object.freeze([
        convergence.summary.declared > 0
          ? `${convergence.summary.declared} claim(s) still DECLARED convergence`
          : null,
        snr.score != null && snr.score < 0.7
          ? "Raise SNR before next expansion slice"
          : null,
      ].filter(Boolean)),
    }),
    harness: Object.freeze({
      active_gates: Object.freeze([
        "ux-first-look-gate",
        "delivery-readiness-gate",
        "performance-budget-gate",
        "kernel-purity-check",
      ]),
      next_gate: "reviewer PR merge + CI remote green",
    }),
    consent: Object.freeze({
      required_phrase: consentPhrase,
      auto_applied: false,
    }),
    compliance: Object.freeze({
      master_craftsmanship_compliant:
        craftsmanship.master_craftsmanship_compliance.overall_compliant,
      boundary_canonical: true,
    }),
    awareness: Object.freeze({
      truth_label: "NODE0_LOCAL_SEED",
      what_this_proves:
        "Declared self-loop composition is structurally coherent and gate-aligned",
      what_this_does_not_prove:
        "Autonomy, live scoring, HHMM runtime, economic rights, or federation",
    }),
    loop_engineering: Object.freeze({
      hhmm_current: hhmm.peak_phase,
      hhmm_belief: hhmm.diffusion,
      next_safe_transition: "VERIFY → SETTLE after CI green",
      blocked_transitions: Object.freeze([
        "ACT→economic without consent",
        "SETTLE→federation without proof ladder",
      ]),
    }),
  });
}

export function buildPeakSelfLoopPreview({
  signal_events = DEFAULT_SIGNAL_EVENTS,
  noise_events = DEFAULT_NOISE_EVENTS,
  convergence_claims = DEFAULT_CONVERGENCE_CLAIMS,
  rsi_signal_inputs = [],
  slice_history = null,
  consent_phrase = "GO: act on peak-self-loop suggestion",
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
        id: "pat-council-route-runtime-dispatch",
        text: "Add consent-gated PAT dispatch boundary from council-route preview (no silent runtime)",
        evidence:
          "UX-3 preview maps seats to pat-* ids; ADK templates exist; corpus baseline ratcheted 123→117",
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
  });

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
    what_this_proves:
      "Peak ultra-micro self-loop preview composes SNR, convergence, HHMM diffusion, and MC witness without runtime",
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
    `  compliance:  MC ${preview.proactive_self.compliance.master_craftsmanship_compliant ? "OK" : "GAP"}`,
    `  awareness:   ${preview.proactive_self.awareness.what_this_proves}`,
    `  loop:        ${preview.proactive_self.loop_engineering.hhmm_current} → ${preview.proactive_self.loop_engineering.next_safe_transition}`,
    "",
    `Engine: ${preview.snr_autonomous_engine.selected} (preview ranking, not live agent)`,
    `RSI: ${preview.autonomous_rsi.merged_verdict}`,
    "",
    preview.what_this_does_not_prove,
    "",
  ];
  return lines.join("\n");
}
