// AUTOPOIETIC-TRACE-GATE-1A — Outer harness over TMPK/Truth-Spine traces.
//
// Season peak outer loop (PREVIEW): traces → hypotheses → ONE bounded proposal
// → apply only under exact-string consent. Complements TMPK (inner kernel).
// HHMM phases = SIGNAL_ESTATE…RECEIPT representation; hash table = type counts;
// diffusion = soft SNR mass; graph-of-thoughts = typed edge DAG from the chain.
//
// NOT RSI-live · NOT singularity · NOT OS FATE · authority_delta = 0 always.
// Simulated impact cannot mint. Unavailable infrastructure is not a code bug.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { buildPreviewBoundary } from "./preview-boundary.js";

export const AUTOPOIETIC_TRACE_GATE_SCHEMA =
  "bizra.dema.autopoietic_trace_gate.v0.1";
export const AUTOPOIETIC_TRACE_GATE_TRUTH_LABEL =
  "AUTOPOIETIC_TRACE_GATE_PREVIEW_ONLY";

export const CONSENT_PHRASE =
  "GO: apply autopoietic proposal under attenuated lease";

/** HHMM-as-representation of the SIGNAL→…→RECEIPT estate (not a neural HMM). */
export const HHMM_PHASES = Object.freeze([
  "SIGNAL_ESTATE",
  "SNR",
  "VERIFICATION",
  "AMPLIFICATION",
  "MAXIMIZATION",
  "EXECUTION",
  "RECEIPT",
]);

export const FORBIDDEN_OVERCLAIMS = Object.freeze([
  "NODE0_CLOSED",
  "RSI_LIVE",
  "RSI_PRIMORDIAL_ACTIVATION",
  "SINGULARITY_LIVE",
  "SINGULARITY_PULSE",
  "AUTOPOIETIC_RUNTIME_LIVE",
  "federation_live",
]);

const TYPE_SNR = Object.freeze({
  "BLOCKED_FOR_HUMAN": 1.0,
  "blocked.no_admissible_transition": 0.95,
  "repair.applied": 0.85,
  "terminal.done": 0.8,
  "transition.applied": 0.55,
  "lease.issue": 0.25,
  "mission.start": 0.2,
});

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function freezeDeep(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const v of Object.values(value)) freezeDeep(v);
    Object.freeze(value);
  }
  return value;
}

/**
 * Canonical JSON matching TMPK TruthSpine seal (sort_keys + compact separators).
 * Provenance twin of packages/tmpk/tmpk.py TruthSpine.seal / verify_chain.
 *
 * `t_ns` may arrive as a decimal string (see parseChainText) so Node does not
 * round integers beyond Number.MAX_SAFE_INTEGER — emit as a raw JSON int.
 */
export function canonicalJson(value, key = null) {
  if (
    typeof value === "string" &&
    key === "t_ns" &&
    /^\d+$/.test(value)
  ) {
    return value;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item, null)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k], k)}`)
    .join(",")}}`;
}

/**
 * Seal one chain record the same way TMPK does (for fixtures / corroboration).
 * @param {string} prev
 * @param {object} fields — must not include prev/hash; t_ns optional
 */
export function sealChainRecord(prev, fields = {}) {
  const rec = { ...fields, prev, t_ns: fields.t_ns ?? 0 };
  delete rec.hash;
  const hash = sha256Hex(Buffer.from(canonicalJson(rec), "utf8"));
  return { ...rec, hash };
}

/**
 * Independent hash-linkage corroboration (diagnostic contract pillar).
 * Scope: ordering + non-repudiation of written bytes — not writer honesty.
 */
export function verifyChainLinkage(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return freezeDeep({
      ok: false,
      checked: 0,
      broken_at: null,
      reason: "empty_chain",
    });
  }
  let prev = "GENESIS";
  let checked = 0;
  for (const raw of records) {
    if (!raw || typeof raw !== "object") {
      return freezeDeep({
        ok: false,
        checked,
        broken_at: null,
        reason: "non_object_record",
      });
    }
    const claimed = raw.hash;
    if (typeof claimed !== "string" || !/^[a-f0-9]{64}$/.test(claimed)) {
      return freezeDeep({
        ok: false,
        checked,
        broken_at: claimed ?? null,
        reason: "hash_not_sha256_hex",
      });
    }
    const rec = { ...raw };
    delete rec.hash;
    if (rec.prev !== prev) {
      return freezeDeep({
        ok: false,
        checked,
        broken_at: claimed,
        reason: "prev_mismatch",
      });
    }
    const expected = sha256Hex(Buffer.from(canonicalJson(rec), "utf8"));
    if (expected !== claimed) {
      return freezeDeep({
        ok: false,
        checked,
        broken_at: claimed,
        reason: "hash_mismatch",
      });
    }
    prev = claimed;
    checked += 1;
  }
  return freezeDeep({
    ok: true,
    checked,
    broken_at: null,
    reason: null,
  });
}

/**
 * Preserve oversized JSON integers (esp. TMPK `t_ns`) as decimal strings so
 * JSON.parse does not silently round them (breaks hash corroboration).
 */
function protectLargeIntegers(line) {
  return String(line).replace(/"t_ns"\s*:\s*(\d{16,})/g, '"t_ns":"$1"');
}

/**
 * Parse Truth Spine / TMPK chain.jsonl text into records.
 * @param {string} text
 * @returns {{ records: object[], parse_errors: number }}
 */
export function parseChainText(text) {
  const records = [];
  let parse_errors = 0;
  for (const line of String(text || "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(protectLargeIntegers(line)));
    } catch {
      parse_errors += 1;
    }
  }
  return { records, parse_errors };
}

/**
 * Read chain from disk path (caller-owned path; no DEMA_HOME mutation).
 * @param {string} path
 */
export function loadChainFile(path) {
  const text = readFileSync(path, "utf8");
  return parseChainText(text);
}

/**
 * Process-mine chain records → hash table, GoT edges, diffusion mass.
 */
export function mineChain(records) {
  const hash_table = Object.create(null);
  const edges = [];
  let prevType = "GENESIS";
  for (const rec of records) {
    const t = typeof rec?.type === "string" ? rec.type : "unknown";
    hash_table[t] = (hash_table[t] || 0) + 1;
    edges.push(
      Object.freeze({ from: prevType, to: t, hash: rec.hash || null })
    );
    prevType = t;
  }

  const diffusion = {};
  let mass = 0;
  for (const [t, n] of Object.entries(hash_table)) {
    const w = (TYPE_SNR[t] ?? 0.1) * n;
    diffusion[t] = w;
    mass += w;
  }
  if (mass > 0) {
    for (const k of Object.keys(diffusion)) diffusion[k] /= mass;
  }

  const ranked = Object.entries(diffusion)
    .sort((a, b) => b[1] - a[1])
    .map(([type, score]) => Object.freeze({ type, score }));

  return freezeDeep({
    event_count: records.length,
    hash_table,
    graph_of_thoughts: { nodes: Object.keys(hash_table), edges },
    diffusion_ranked: ranked,
    top_signal: ranked[0] || null,
  });
}

function classifyOutcome(records) {
  const types = new Set(records.map((r) => r?.type));
  if (types.has("terminal.done")) {
    return {
      outcome: "TERMINAL_DONE",
      dema_fde: "INWARD_PATH_CLOSED",
      hhmm_phase: "RECEIPT",
    };
  }
  if (types.has("BLOCKED_FOR_HUMAN")) {
    return {
      outcome: "BLOCKED_FOR_HUMAN",
      dema_fde: "OUTWARD_OR_NO_ADMISSIBLE",
      hhmm_phase: "VERIFICATION",
    };
  }
  return {
    outcome: "PARTIAL_OR_UNKNOWN",
    dema_fde: "UNKNOWN",
    hhmm_phase: "SIGNAL_ESTATE",
  };
}

function buildHypotheses(mine, classification, parse_errors, linkage) {
  const hyps = [];
  hyps.push({
    id: "H_chain_completeness",
    claim: "Chain lines were parseable and non-empty",
    status: mine.event_count > 0 && parse_errors === 0 ? "ADMISSIBLE" : "FAIL",
    scope: "this_chain_file_only",
    completeness: parse_errors === 0 ? "complete_parse" : "partial_parse",
  });
  hyps.push({
    id: "H_chain_linkage",
    claim: "Prev/hash linkage corroborates under TMPK-compatible canonical JSON",
    status: linkage.ok ? "ADMISSIBLE" : "FAIL",
    scope: "cryptographic_ordering_only",
    completeness: linkage.ok ? "full_chain" : linkage.reason || "broken",
  });
  hyps.push({
    id: "H_outcome",
    claim: `Observed outcome class is ${classification.outcome}`,
    status: linkage.ok ? "ADMISSIBLE" : "ADMISSIBLE_TYPE_ONLY",
    scope: linkage.ok
      ? "type_presence_plus_linkage"
      : "type_presence_in_chain_uncorroborated",
    completeness: "type_set_only",
  });
  hyps.push({
    id: "H_not_rsi",
    claim: "Trace mining does not activate RSI or singularity",
    status: "ADMISSIBLE",
    scope: "constitutional",
    completeness: "axiom",
  });
  if (classification.outcome === "BLOCKED_FOR_HUMAN") {
    hyps.push({
      id: "H_outward_blocker",
      claim: "Human judgment required; do not launder as inward repair",
      status: linkage.ok ? "ADMISSIBLE" : "ADMISSIBLE_TYPE_ONLY",
      scope: "DEMA_FDE",
      completeness: "blocker_present",
    });
  }
  return freezeDeep(hyps);
}

/**
 * Promote only after parse + linkage corroboration (diagnostic contract).
 * Type mining alone never yields AUTHORITATIVE_DIAGNOSTIC.
 */
export function decideInsightPromotion({
  parse_errors = 0,
  event_count = 0,
  linkage,
} = {}) {
  if (event_count <= 0 || parse_errors > 0) {
    return freezeDeep({
      level: "FAIL",
      reason: "incomplete_or_unparseable_trace",
    });
  }
  if (!linkage?.ok) {
    return freezeDeep({
      level: "ADMISSIBLE_TRACE_ONLY",
      reason: linkage?.reason || "linkage_uncorroborated",
    });
  }
  return freezeDeep({
    level: "AUTHORITATIVE_DIAGNOSTIC",
    reason: "provenance_parse_and_linkage_corroborated",
  });
}

function buildProposal(mine, classification) {
  const top = mine.top_signal?.type || "unknown";
  if (classification.outcome === "BLOCKED_FOR_HUMAN") {
    return freezeDeep({
      id: "P_diagnose_outward",
      kind: "DIAGNOSE_ONLY",
      action: "surface_blocker_to_human",
      snr_score: mine.top_signal?.score ?? 0,
      top_signal_type: top,
      applies_system_change: false,
      requires_consent: true,
      rationale:
        "Outward/blocked traces amplify diagnosis, never silent self-repair.",
    });
  }
  if (classification.outcome === "TERMINAL_DONE") {
    return freezeDeep({
      id: "P_seal_review",
      kind: "REVIEW_ONLY",
      action: "verify_chain_independently_then_stop",
      snr_score: mine.top_signal?.score ?? 0,
      top_signal_type: top,
      applies_system_change: false,
      requires_consent: true,
      rationale:
        "Terminal seal is evidence of ordering, not trust or RSI activation.",
    });
  }
  return freezeDeep({
    id: "P_continue_inner_kernel",
    kind: "CONTINUE_INNER",
    action: "re_run_tmpk_under_fresh_lease",
    snr_score: mine.top_signal?.score ?? 0,
    top_signal_type: top,
    applies_system_change: false,
    requires_consent: true,
    rationale: "Partial chain — next SNR act is another bounded TMPK run.",
  });
}

/**
 * Compose gate preview from chain records (caller-supplied; no ambient FS).
 */
export function buildAutopoieticTraceGate({
  records = [],
  parse_errors = 0,
  source_ref = "caller_supplied",
  gate_id = "autopoietic-trace-gate-1a",
} = {}) {
  const mine = mineChain(records);
  const classification = classifyOutcome(records);
  const linkage = verifyChainLinkage(records);
  const hypotheses = buildHypotheses(
    mine,
    classification,
    parse_errors,
    linkage
  );
  const insight_promotion = decideInsightPromotion({
    parse_errors,
    event_count: mine.event_count,
    linkage,
  });
  const proposal = buildProposal(mine, classification);

  const signal_estate = Object.freeze(
    HHMM_PHASES.map((phase, i) =>
      Object.freeze({
        phase,
        index: i,
        active: phase === classification.hhmm_phase,
      })
    )
  );

  const body = {
    schema: AUTOPOIETIC_TRACE_GATE_SCHEMA,
    truth_label: AUTOPOIETIC_TRACE_GATE_TRUTH_LABEL,
    mode: "PREVIEW_ONLY",
    authority_delta: 0,
    gate_id,
    source_ref,
    signal_estate,
    process_mining: mine,
    linkage,
    insight_promotion,
    classification,
    hypotheses,
    proposal,
    forbidden_overclaims: FORBIDDEN_OVERCLAIMS,
    consent_phrase: CONSENT_PHRASE,
    boundary: buildPreviewBoundary({
      content_read: true,
      filesystem_write_performed: false,
      receipt_mint_performed: false,
      tool_executed: false,
      model_invocation_performed: false,
    }),
    not_established: Object.freeze([
      "RSI_LIVE",
      "SINGULARITY_LIVE",
      "OS_level_FATE",
      "proposal_applied",
      "economic_value",
      "insight_truth_beyond_chain_types",
      "writer_honesty",
    ]),
  };

  const gate_digest = `sha256:${sha256Hex(
    Buffer.from(JSON.stringify(body), "utf8")
  )}`;
  return freezeDeep({ ...body, gate_digest });
}

/**
 * Apply proposal — only under exact consent. Never mutates system state.
 * Returns a sealed decision receipt (preview); does not mint economic impact.
 */
export function applyAutopoieticProposal(gate, consent) {
  if (!gate || gate.schema !== AUTOPOIETIC_TRACE_GATE_SCHEMA) {
    return freezeDeep({
      ok: false,
      reason: "invalid_gate",
      applied: false,
      authority_delta: 0,
    });
  }
  if (consent !== CONSENT_PHRASE) {
    return freezeDeep({
      ok: false,
      reason: "CONSENT_MISSING_OR_MISMATCH",
      applied: false,
      expected_phrase: CONSENT_PHRASE,
      authority_delta: 0,
      dema_fde: "missing_consent_stops_action",
    });
  }
  // Even with consent, this preview gate never applies a system change.
  return freezeDeep({
    ok: true,
    reason: "CONSENT_ACK_PREVIEW_NO_MUTATION",
    applied: false,
    proposal_id: gate.proposal?.id,
    action_acknowledged: gate.proposal?.action,
    system_change: false,
    authority_delta: 0,
    note: "Consent acknowledges the proposal; PREVIEW_ONLY still forbids mutation.",
  });
}

export function refuseOverclaim(label) {
  const hit = FORBIDDEN_OVERCLAIMS.includes(label);
  return freezeDeep({
    ok: !hit,
    label,
    reason: hit
      ? "Forbidden season overclaim — preview gate refuses promotion"
      : null,
  });
}

export function verifyAutopoieticTraceGate(gate) {
  const errors = [];
  if (!gate || gate.schema !== AUTOPOIETIC_TRACE_GATE_SCHEMA) {
    errors.push("schema");
  }
  if (gate?.truth_label !== AUTOPOIETIC_TRACE_GATE_TRUTH_LABEL) {
    errors.push("truth_label");
  }
  if (gate?.authority_delta !== 0) errors.push("authority_delta");
  if (gate?.mode !== "PREVIEW_ONLY") errors.push("mode");
  if (!gate?.proposal?.requires_consent) errors.push("proposal_consent");
  if (gate?.proposal?.applies_system_change === true) {
    errors.push("proposal_must_not_mutate");
  }
  if (!gate?.linkage || typeof gate.linkage.ok !== "boolean") {
    errors.push("linkage_missing");
  }
  if (
    !gate?.insight_promotion ||
    !["FAIL", "ADMISSIBLE_TRACE_ONLY", "AUTHORITATIVE_DIAGNOSTIC"].includes(
      gate.insight_promotion.level
    )
  ) {
    errors.push("insight_promotion_missing");
  }
  if (
    gate?.insight_promotion?.level === "AUTHORITATIVE_DIAGNOSTIC" &&
    gate?.linkage?.ok !== true
  ) {
    errors.push("authoritative_without_linkage");
  }
  for (const label of FORBIDDEN_OVERCLAIMS) {
    if (JSON.stringify(gate).includes(`"${label}":true`)) {
      errors.push(`overclaim:${label}`);
    }
  }
  return freezeDeep({ ok: errors.length === 0, errors });
}

export function runAutopoieticTraceGateGate(input = {}) {
  const gate = buildAutopoieticTraceGate(input);
  const v = verifyAutopoieticTraceGate(gate);
  return freezeDeep({ ok: v.ok, gate, verify: v });
}
