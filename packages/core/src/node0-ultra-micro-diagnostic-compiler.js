// NODE0-ULTRA-MICRO-DIAGNOSTIC-COMPILER-1A
// Pure diagnostic compiler: no fs/network/process/clock/effects/authority.

import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { verifyNode0ProofOfTruthControlPlane } from "./node0-proof-of-truth-control-plane.js";

export const NODE0_ULTRA_MICRO_DIAGNOSTIC_COMPILER_SCHEMA =
  "bizra.dema.node0_ultra_micro_diagnostic_compiler.v0.1";
export const NODE0_ULTRA_MICRO_DIAGNOSTIC_COMPILER_TRUTH_LABEL =
  "PREVIEW_ONLY_DIAGNOSTIC_NO_AUTHORITY";

export const CANONICAL_STAGES = Object.freeze([
  "SIGNAL_ESTATE",
  "SNR",
  "VERIFICATION",
  "AMPLIFICATION",
  "MAXIMIZATION",
  "EXECUTION",
  "RECEIPT",
]);
export const HEALTH_STATES = Object.freeze(["HEALTHY", "DEGRADED", "PATHOLOGIC"]);
export const OBSERVATION_ALPHABET = Object.freeze([
  "clean",
  "dry_run",
  "unmeasured_cost",
  "refusal",
  "launder_risk",
  "self_attested",
  "unbound",
  "nonconformant",
  "stale_evidence",
  "infra_failure",
  "code_failure",
]);

const MAX_EPISODES = 256;
const DEFAULT_SNR_KEEP = 3;
const MAX_SNR_KEEP = 7;
const MODEL_VERSION = "hhmm-health-v0.1-hand-specified-prior";
const STAGE_SALIENCE = Object.freeze({
  SIGNAL_ESTATE: 0.75,
  SNR: 0.9,
  VERIFICATION: 1.15,
  AMPLIFICATION: 1,
  MAXIMIZATION: 1,
  EXECUTION: 1.45,
  RECEIPT: 1.7,
  UNKNOWN: 1,
});
const INITIAL = Object.freeze({ HEALTHY: 0.78, DEGRADED: 0.17, PATHOLOGIC: 0.05 });
const TRANSITION = Object.freeze({
  HEALTHY: Object.freeze({ HEALTHY: 0.9, DEGRADED: 0.09, PATHOLOGIC: 0.01 }),
  DEGRADED: Object.freeze({ HEALTHY: 0.18, DEGRADED: 0.7, PATHOLOGIC: 0.12 }),
  PATHOLOGIC: Object.freeze({ HEALTHY: 0.04, DEGRADED: 0.16, PATHOLOGIC: 0.8 }),
});
const EMISSION = Object.freeze({
  HEALTHY: Object.freeze({
    clean: 0.92, dry_run: 0.28, unmeasured_cost: 0.2, refusal: 0.48,
    launder_risk: 0.03, self_attested: 0.02, unbound: 0.03, nonconformant: 0.02,
  }),
  DEGRADED: Object.freeze({
    clean: 0.45, dry_run: 0.6, unmeasured_cost: 0.58, refusal: 0.58,
    launder_risk: 0.34, self_attested: 0.25, unbound: 0.3, nonconformant: 0.32,
  }),
  PATHOLOGIC: Object.freeze({
    clean: 0.08, dry_run: 0.42, unmeasured_cost: 0.5, refusal: 0.34,
    launder_risk: 0.93, self_attested: 0.94, unbound: 0.9, nonconformant: 0.91,
  }),
});
const HYPOTHESIS_RULES = Object.freeze({
  launder_risk: Object.freeze({ id: "failure_laundering_risk", severity: 5, cost: 1 }),
  self_attested: Object.freeze({ id: "independence_collapse", severity: 5, cost: 1 }),
  unbound: Object.freeze({ id: "artifact_binding_gap", severity: 5, cost: 1 }),
  nonconformant: Object.freeze({ id: "control_flow_drift", severity: 4, cost: 2 }),
  unmeasured_cost: Object.freeze({ id: "economic_evidence_gap", severity: 3, cost: 1 }),
  refusal: Object.freeze({ id: "authority_or_policy_refusal", severity: 2, cost: 1 }),
  dry_run: Object.freeze({ id: "simulation_not_effect", severity: 2, cost: 1 }),
  stale_evidence: Object.freeze({ id: "stale_evidence_boundary", severity: 4, cost: 1 }),
  infra_failure: Object.freeze({ id: "infrastructure_unavailable", severity: 3, cost: 1 }),
  code_failure: Object.freeze({ id: "code_defect_candidate", severity: 3, cost: 2 }),
});

function freezeDeep(v) {
  if (!v || typeof v !== "object" || Object.isFrozen(v)) return v;
  for (const child of Object.values(v)) freezeDeep(child);
  return Object.freeze(v);
}
function plain(v) {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return false;
  const p = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null;
}
function text(v, label) {
  if (typeof v !== "string" || v.trim() === "") throw new TypeError(label + " must be a non-empty string");
  return v.trim();
}
function nonneg(v) {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}
function kBound(v) {
  if (v === undefined) return DEFAULT_SNR_KEEP;
  if (!Number.isInteger(v) || v < 1 || v > MAX_SNR_KEEP) {
    throw new RangeError("snr_keep must be an integer in [1, " + MAX_SNR_KEEP + "]");
  }
  return v;
}
function typed(type, value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  return type + ":" + value.trim();
}
function stageSequence(trace) {
  if (Array.isArray(trace)) return trace.filter((x) => typeof x === "string").map((x) => x.trim());
  if (plain(trace)) return Object.keys(trace);
  return [];
}

function conformance(sequence) {
  if (sequence.length === 0) {
    return freezeDeep({
      status: "UNKNOWN",
      prefix_conformant: false,
      complete: false,
      missing: [...CANONICAL_STAGES],
      repeated: [],
      execution_without_verification: false,
    });
  }
  const counts = new Map();
  for (const s of sequence) counts.set(s, (counts.get(s) ?? 0) + 1);
  const repeated = [...counts].filter(([, n]) => n > 1).map(([s]) => s).sort();
  const expected = CANONICAL_STAGES.slice(0, sequence.length);
  const prefix =
    repeated.length === 0 &&
    sequence.every((s, i) => CANONICAL_STAGES.includes(s) && expected[i] === s);
  const ex = sequence.indexOf("EXECUTION");
  const ver = sequence.indexOf("VERIFICATION");
  const missing = CANONICAL_STAGES.filter((s) => !sequence.includes(s));
  const complete = prefix && sequence.length === CANONICAL_STAGES.length && missing.length === 0;
  return freezeDeep({
    status: prefix ? (complete ? "COMPLETE" : "HALTED_CONFORMANT") : "NONCONFORMANT",
    prefix_conformant: prefix,
    complete,
    missing,
    repeated,
    execution_without_verification: ex !== -1 && (ver === -1 || ver > ex),
  });
}

function classifyFailure(ep) {
  const f = plain(ep.failure) ? ep.failure : {};
  const kind = typeof f.kind === "string" ? f.kind.toUpperCase() : "";
  // DEMA-1A ordering: REFUSAL -> STALE -> INFRA -> CODE -> UNKNOWN.
  if (kind === "REFUSAL" || f.refused === true || ep.consent?.granted === false || ep.policy_refused === true) return "REFUSAL";
  if (kind === "STALE" || f.stale === true || ep.verification_stale === true) return "STALE";
  if (kind === "INFRA" || f.infrastructure === true || f.rc === 124 || f.rc === 127) return "INFRA";
  if (kind === "CODE" || f.code === true || ep.outcome === "ERROR") return "CODE";
  if (kind === "UNKNOWN") return "UNKNOWN";
  return null;
}
function finding(ref, observation, reason, stage, severity) {
  return freezeDeep({
    evidence_ref: ref,
    observation,
    reason,
    stage: CANONICAL_STAGES.includes(stage) ? stage : "UNKNOWN",
    severity,
  });
}

function mineEpisode(raw, index) {
  if (!plain(raw)) throw new TypeError("episodes[" + index + "] must be a plain record");
  const id = text(raw.id, "episodes[" + index + "].id");
  const sequence = stageSequence(raw.stage_trace);
  const flow = conformance(sequence);
  const failureKind = classifyFailure(raw);
  const artifacts = Array.isArray(raw.artifact_hashes)
    ? raw.artifact_hashes.filter((x) => typeof x === "string" && x.trim() !== "").slice(0, 64)
    : [];
  const last = sequence.at(-1) ?? "UNKNOWN";
  const outward = raw.boundary_attempted === true || raw.authority_consulted === true || raw.effects_started === true;
  const findings = [];

  if (!flow.prefix_conformant) findings.push(finding(id, "nonconformant", "stage_trace_not_canonical_prefix", last, 4));
  if (failureKind === "REFUSAL") findings.push(finding(id, "refusal", "authority_or_policy_refused", last, 2));
  if (failureKind === "STALE") findings.push(finding(id, "stale_evidence", "verification_or_evidence_stale", last, 4));
  if (failureKind === "INFRA") findings.push(finding(id, "infra_failure", "infrastructure_unavailable_not_code_failure", last, 3));
  if (failureKind === "CODE") findings.push(finding(id, "code_failure", "code_failure_candidate", last, 3));
  if (outward && failureKind && raw.failure_recorded !== true) {
    findings.push(finding(id, "launder_risk", "outward_failure_unrecorded", last, 5));
  }
  if (raw.simulated === true || raw.dry_run === true) {
    findings.push(finding(id, "dry_run", "simulated_or_dry_run", last, 2));
    if (raw.mintable === true || (nonneg(raw.realized_value) && raw.realized_value > 0)) {
      findings.push(finding(id, "launder_risk", "simulated_impact_would_mint", last, 5));
    }
  }
  if (raw.effects_started === true && raw.consent?.granted !== true) {
    findings.push(finding(id, "launder_risk", "effect_started_without_consent", "EXECUTION", 5));
  }
  if (raw.self_consent === true || raw.consent?.source === "self") {
    findings.push(finding(id, "launder_risk", "self_consent_is_not_fate_authority", "EXECUTION", 5));
  }
  if (typeof raw.actor_id === "string" && raw.actor_id !== "" && raw.actor_id === raw.attestor) {
    findings.push(finding(id, "self_attested", "actor_equals_attestor", "VERIFICATION", 5));
  }
  if ((raw.outcome === "CROSSED" || raw.effects_started === true) && artifacts.length === 0) {
    findings.push(finding(id, "unbound", "crossing_has_no_bound_artifact", "EXECUTION", 5));
  }
  if (nonneg(raw.realized_value) && raw.realized_value > 0 && !nonneg(raw.measured_cost)) {
    findings.push(finding(id, "unmeasured_cost", "value_claim_without_measured_cost", "RECEIPT", 3));
  }
  if (findings.length === 0) findings.push(finding(id, "clean", "no_detector_fired", flow.complete ? "RECEIPT" : last, 0));

  return freezeDeep({
    id,
    intent: typeof raw.intent === "string" ? raw.intent : "",
    boundary: typeof raw.boundary === "string" ? raw.boundary : "",
    actor_id: typeof raw.actor_id === "string" ? raw.actor_id : "",
    attestor: typeof raw.attestor === "string" ? raw.attestor : "",
    artifact_hashes: artifacts,
    sequence,
    conformance: flow,
    failure_kind: failureKind,
    findings,
  });
}

function processMine(episodes) {
  const variants = new Map();
  const follows = new Map();
  for (const ep of episodes) {
    const variant = ep.sequence.join(" -> ") || "<missing_trace>";
    variants.set(variant, (variants.get(variant) ?? 0) + 1);
    for (let i = 0; i + 1 < ep.sequence.length; i += 1) {
      const edge = ep.sequence[i] + " -> " + ep.sequence[i + 1];
      follows.set(edge, (follows.get(edge) ?? 0) + 1);
    }
  }
  return freezeDeep({
    variants: [...variants].map(([variant, count]) => ({ variant, count })).sort((a, b) => b.count - a.count || a.variant.localeCompare(b.variant)),
    directly_follows: [...follows].map(([edge, count]) => ({ edge, count })).sort((a, b) => b.count - a.count || a.edge.localeCompare(b.edge)),
  });
}
function logp(p) { return Math.log(Math.max(p, Number.MIN_VALUE)); }
function logSumExp(xs) {
  const m = Math.max(...xs);
  let sum = 0;
  for (const x of xs) sum += Math.exp(x - m);
  return m + Math.log(sum);
}

export function decodeNode0DiagnosticHHMM(observations, memo = new Map()) {
  if (!Array.isArray(observations)) throw new TypeError("observations must be an array");
  if (!(memo instanceof Map)) throw new TypeError("memo must be a Map");
  if (observations.length === 0) {
    return freezeDeep({
      model: MODEL_VERSION,
      state: "UNKNOWN",
      normalized_map_weight: 0,
      path: [],
      memo_hits: 0,
      parameter_source: "hand_specified_prior_not_trained",
    });
  }

  let previous = Object.fromEntries(HEALTH_STATES.map((s) => [s, logp(INITIAL[s])]));
  const prefixes = [];
  let rolling = sha256(MODEL_VERSION + ":genesis");
  let hits = 0;

  for (let step = 0; step < observations.length; step += 1) {
    const raw = observations[step];
    const obs = typeof raw === "string" ? raw : raw?.observation;
    const stage = typeof raw === "string" ? "UNKNOWN" : raw?.stage ?? "UNKNOWN";
    if (!OBSERVATION_ALPHABET.includes(obs)) throw new RangeError("unsupported HHMM observation: " + String(obs));
    rolling = sha256(rolling + "\u0000" + stableStringify({ observation: obs, stage }));
    prefixes.push(rolling);
    const next = {};

    for (const state of HEALTH_STATES) {
      const key = [MODEL_VERSION, rolling, step, state].join("|");
      if (memo.has(key)) {
        next[state] = memo.get(key).score;
        hits += 1;
        continue;
      }
      let best = -Infinity;
      let from = null;
      for (const prior of HEALTH_STATES) {
        const score = previous[prior] + logp(TRANSITION[prior][state]);
        if (score > best) { best = score; from = prior; }
      }
      const score = best + logp(EMISSION[state][obs]) * (STAGE_SALIENCE[stage] ?? 1);
      memo.set(key, Object.freeze({ score, from }));
      next[state] = score;
    }
    previous = next;
  }

  let state = HEALTH_STATES[0];
  for (const s of HEALTH_STATES.slice(1)) if (previous[s] > previous[state]) state = s;
  const denom = logSumExp(HEALTH_STATES.map((s) => previous[s]));
  const path = Array(observations.length);
  let cursor = state;
  for (let step = observations.length - 1; step >= 0; step -= 1) {
    path[step] = cursor;
    const key = [MODEL_VERSION, prefixes[step], step, cursor].join("|");
    cursor = memo.get(key)?.from ?? cursor;
  }
  return freezeDeep({
    model: MODEL_VERSION,
    state,
    normalized_map_weight: Number(Math.exp(previous[state] - denom).toFixed(6)),
    path,
    memo_hits: hits,
    parameter_source: "hand_specified_prior_not_trained",
  });
}

function buildHypergraph(episodes) {
  return freezeDeep({
    edges: episodes.map((ep) => freezeDeep({
      id: "edge:" + ep.id,
      evidence_ref: ep.id,
      nodes: [...new Set([
        typed("episode", ep.id), typed("intent", ep.intent), typed("boundary", ep.boundary),
        typed("actor", ep.actor_id), typed("attestor", ep.attestor), typed("failure", ep.failure_kind),
        ...ep.artifact_hashes.map((x) => typed("artifact", x)),
        ...ep.findings.map((x) => typed("finding", x.observation)),
      ].filter(Boolean))].sort(),
    })),
  });
}
function queryNodes(query) {
  if (!plain(query)) return [];
  return [
    typed("intent", query.intent), typed("boundary", query.boundary),
    typed("actor", query.actor_id), typed("attestor", query.attestor),
    typed("failure", query.failure_kind),
    ...(Array.isArray(query.artifact_hashes) ? query.artifact_hashes.map((x) => typed("artifact", x)) : []),
    ...(Array.isArray(query.findings) ? query.findings.map((x) => typed("finding", x)) : []),
  ].filter(Boolean);
}
export function recallNode0DiagnosticHypergraph(graph, query = {}, limit = 5) {
  if (!plain(graph) || !Array.isArray(graph.edges)) throw new TypeError("graph.edges must be an array");
  const wanted = new Set(queryNodes(query));
  if (wanted.size === 0) return freezeDeep([]);
  return freezeDeep(graph.edges.map((edge) => {
    const matches = edge.nodes.filter((node) => wanted.has(node));
    return {
      edge_id: edge.id,
      evidence_ref: edge.evidence_ref,
      matches: matches.sort(),
      matched_count: matches.length,
      matched_types: new Set(matches.map((node) => node.split(":", 1)[0])).size,
      edge_width: edge.nodes.length,
    };
  }).filter((row) => row.matched_count > 0).sort((a, b) =>
    b.matched_types - a.matched_types ||
    b.matched_count - a.matched_count ||
    a.edge_width - b.edge_width ||
    a.edge_id.localeCompare(b.edge_id)
  ).slice(0, limit));
}

function diffuse(findings, episodes) {
  const byId = new Map();
  const epMap = new Map(episodes.map((ep) => [ep.id, ep]));
  for (const f of findings) {
    if (f.observation === "clean") continue;
    const rule = HYPOTHESIS_RULES[f.observation];
    if (!rule) continue;
    const c = byId.get(rule.id) ?? {
      id: rule.id, severity: rule.severity, cost: rule.cost,
      evidence: new Set(), reasons: new Set(), boundaries: new Set(), stages: new Set(),
    };
    c.evidence.add(f.evidence_ref);
    c.reasons.add(f.reason);
    c.stages.add(f.stage);
    const boundary = epMap.get(f.evidence_ref)?.boundary;
    if (boundary) c.boundaries.add(boundary);
    byId.set(rule.id, c);
  }
  return [...byId.values()].map((c) => {
    const n = c.evidence.size;
    const corroboration = Math.max(1, c.boundaries.size + c.stages.size);
    return freezeDeep({
      id: c.id,
      severity: c.severity,
      evidence_refs: [...c.evidence].sort(),
      reasons: [...c.reasons].sort(),
      boundaries: [...c.boundaries].sort(),
      stages: [...c.stages].sort(),
      evidence_count: n,
      diagnostic_priority: Number(((c.severity * n * (1 + Math.log2(corroboration + 1))) / c.cost).toFixed(6)),
    });
  }).filter((c) => c.evidence_count > 0).sort((a, b) =>
    b.diagnostic_priority - a.diagnostic_priority ||
    b.severity - a.severity ||
    a.id.localeCompare(b.id)
  );
}

function proofConvergence(ledger) {
  if (!ledger) {
    return freezeDeep({
      available: false, ledger_verified: false, converged: false,
      channels: { formal: false, cryptographic: false, empirical: false, economic: false },
      dissenting: ["formal", "cryptographic", "empirical", "economic"],
      blocked_by: ["proof_ledger_missing"],
    });
  }
  const verified = verifyNode0ProofOfTruthControlPlane(ledger);
  const channels = Object.freeze({
    formal: verified.ok && ledger.formal?.status === "PASS",
    cryptographic: verified.ok && ledger.cryptographic?.status === "PASS",
    empirical: verified.ok && ledger.empirical?.status === "PASS",
    economic: verified.ok && ledger.economic?.status === "PASS",
  });
  const dissenting = Object.entries(channels).filter(([, ok]) => ok !== true).map(([name]) => name);
  return freezeDeep({
    available: true,
    ledger_verified: verified.ok,
    converged: verified.ok && dissenting.length === 0,
    channels,
    dissenting,
    blocked_by: [...verified.blocked_by],
  });
}

export function compileNode0UltraMicroDiagnostic(input = {}) {
  if (!plain(input)) throw new TypeError("input must be a plain record");
  const subjectId = text(input.subject_id, "subject_id");
  const rawEpisodes = input.episodes ?? [];
  if (!Array.isArray(rawEpisodes)) throw new TypeError("episodes must be an array");
  if (rawEpisodes.length > MAX_EPISODES) throw new RangeError("episodes exceeds maximum " + MAX_EPISODES);
  const keep = kBound(input.snr_keep);

  const episodes = rawEpisodes.map(mineEpisode);
  const findings = episodes.flatMap((ep) => ep.findings);
  const observations = findings.map((f) => Object.freeze({ observation: f.observation, stage: f.stage }));
  const latent = decodeNode0DiagnosticHHMM(observations, new Map());
  const graph = buildHypergraph(episodes);
  const candidates = diffuse(findings, episodes);
  const proof = proofConvergence(input.proof_ledger);
  const unknowns = [];
  if (episodes.length === 0) unknowns.push("no_episodes");
  for (const ep of episodes) if (ep.sequence.length === 0) unknowns.push("stage_trace_missing:" + ep.id);
  if (!proof.available) unknowns.push("proof_ledger_missing");
  if (proof.available && !proof.converged) {
    for (const channel of proof.dissenting) unknowns.push("proof_channel_open:" + channel);
  }
  if (latent.state === "UNKNOWN") unknowns.push("latent_health_unknown");
  const contradictions = findings
    .filter((f) => f.observation === "launder_risk")
    .map((f) => f.evidence_ref + ":" + f.reason);

  const body = freezeDeep({
    schema: NODE0_ULTRA_MICRO_DIAGNOSTIC_COMPILER_SCHEMA,
    truth_label: NODE0_ULTRA_MICRO_DIAGNOSTIC_COMPILER_TRUTH_LABEL,
    subject_id: subjectId,
    episode_count: episodes.length,
    process: processMine(episodes),
    latent_health: latent,
    hypergraph: {
      edge_count: graph.edges.length,
      edges: graph.edges,
      recall: recallNode0DiagnosticHypergraph(graph, input.query ?? {}, 5),
    },
    diffusion: {
      mode: "deterministic_evidence_diffusion_not_stochastic_generation",
      candidate_count: candidates.length,
      candidates,
    },
    snr: {
      coupling: "topological_fixed_k",
      keep,
      frontier: candidates.slice(0, keep),
      rejected: candidates.slice(keep).map((c) => c.id),
    },
    reasoning_hierarchy: {
      level_0_observations: observations,
      level_1_findings: findings,
      level_2_hypotheses: candidates,
      level_3_frontier: candidates.slice(0, keep),
    },
    proof_convergence: proof,
    self_harness: {
      rederivable: true,
      self_certified_independence: false,
      hidden_chain_of_thought_required: false,
    },
    compliance: {
      dema_fde_dual_diagnostic_1a: {
        mode: "diagnostic_constraints_only",
        classification_order: ["REFUSAL", "STALE", "INFRA", "CODE", "UNKNOWN"],
        inward_repair_performed: false,
        outward_failure_recording_performed: false,
      },
      self_consent_permitted: false,
      consequential_authority_present: false,
      authority_delta: 0,
      effects_started: 0,
      mintable: false,
      runtime_execution: false,
    },
    critique: {
      unknowns: [...new Set(unknowns)].sort(),
      contradictions: [...new Set(contradictions)].sort(),
      proof_ceiling:
        "DIAGNOSTIC_PREVIEW_ONLY: may prioritize evidence-backed hypotheses; cannot authorize, execute, mint, or certify wisdom.",
    },
  });
  return freezeDeep({ ...body, packet_hash: "sha256:" + sha256(stableStringify(body)) });
}

export function verifyNode0UltraMicroDiagnosticPacket(input, packet) {
  if (!packet || typeof packet !== "object") return freezeDeep({ ok: false, reason: "packet_missing" });
  let expected;
  try { expected = compileNode0UltraMicroDiagnostic(input); }
  catch { return freezeDeep({ ok: false, reason: "input_not_compilable" }); }
  if (packet.schema !== NODE0_ULTRA_MICRO_DIAGNOSTIC_COMPILER_SCHEMA) return freezeDeep({ ok: false, reason: "schema_mismatch" });
  if (packet.truth_label !== NODE0_ULTRA_MICRO_DIAGNOSTIC_COMPILER_TRUTH_LABEL) return freezeDeep({ ok: false, reason: "truth_label_mismatch" });
  if (packet.packet_hash !== expected.packet_hash) return freezeDeep({ ok: false, reason: "packet_hash_mismatch" });
  if (stableStringify(packet) !== stableStringify(expected)) return freezeDeep({ ok: false, reason: "packet_semantics_mismatch" });
  return freezeDeep({ ok: true });
}
