// DEMA-TRACE-DIAGNOSTIC-CONTRACT-1A
//
// Moat kernel: every important system contract is observable, testable,
// diagnosable across code / runtime / production. Each trace is admissible
// evidence ONLY with explicit scope, completeness, and correlation limits.
// Promotion of a trace-derived conclusion to an authoritative diagnostic
// insight requires the complete four-rail contract:
//
//   provenance      — where the trace came from, what it observed, hash-bound
//   consistency      — traces do not contradict without disambiguation
//   disambiguation   — alternative hypotheses enumerated (graph of thoughts)
//   corroboration    — independent re-derivation / replay
//
// Treat incomplete traces as REMAIN_TRACE (honest, not promoted). Treat
// provenance-failed traces as BLOCKED (inadmissible). Only ALL-FOUR PASS
// yields INSIGHT_AUTHORIZED.
//
// The autopoietic spine (traces -> hypotheses -> bounded proposals ->
// verified reversible transitions) is modeled as an event-driven state
// machine; this kernel is the promotion gate between "traces" and
// "hypotheses produce proposals". It does not execute proposals.
//
// Pure · deterministic · deep-frozen · all-false preview boundary.
// No fs, network, clock, random, model, token, wallet, daemon, federation.

import { createHash } from "node:crypto";
import { buildPreviewBoundary } from "./preview-boundary.js";

export const DEMA_TRACE_DIAGNOSTIC_CONTRACT_SCHEMA =
  "bizra.dema.trace_diagnostic_contract.v0.1";
export const DEMA_TRACE_DIAGNOSTIC_CONTRACT_TRUTH_LABEL =
  "DEMA_TRACE_DIAGNOSTIC_CONTRACT_PREVIEW_ONLY";
export const DEMA_TRACE_DIAGNOSTIC_CONTRACT_GO_PHRASE =
  "GO: trace diagnostic contract";
export const DEMA_TRACE_DIAGNOSTIC_CONTRACT_STAGE =
  "TRACE_DIAGNOSTIC_PROMOTION_GATE";

export const PROMOTION_STATUSES = Object.freeze([
  "INSIGHT_AUTHORIZED",
  "REMAIN_TRACE",
  "BLOCKED",
]);

export const TRACE_COMPLETENESS_VALUES = Object.freeze([
  "COMPLETE",
  "PARTIAL",
  "SCOPED",
]);

const HEX64_RE = /^[0-9a-f]{64}$/;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v) ?? "null").join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .flatMap((k) => {
        const ser = stableStringify(value[k]);
        return ser === undefined ? [] : [`${JSON.stringify(k)}:${ser}`];
      });
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256Hex(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function diagnosticHash(body) {
  return `sha256:${sha256Hex(stableStringify(body))}`;
}

function textVal(v) {
  return typeof v === "string" ? v : "";
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// --- rail evaluators -------------------------------------------------------

function evaluateProvenance(trace_set) {
  const blocked = [];
  if (!Array.isArray(trace_set) || trace_set.length === 0) {
    return { ok: false, blocked_by: Object.freeze(["provenance_trace_set_empty"]) };
  }
  const seenIds = new Set();
  for (let i = 0; i < trace_set.length; i++) {
    const t = trace_set[i];
    const prefix = `provenance_trace_${i}`;
    if (!isPlainObject(t)) {
      blocked.push(`${prefix}_malformed`);
      continue;
    }
    if (!textVal(t.trace_id).trim()) blocked.push(`${prefix}_trace_id_missing`);
    else if (seenIds.has(t.trace_id)) blocked.push(`provenance_duplicate_trace_id:${t.trace_id}`);
    else seenIds.add(t.trace_id);

    if (!textVal(t.scope).trim()) blocked.push(`${prefix}_scope_missing`);
    if (!TRACE_COMPLETENESS_VALUES.includes(t.completeness))
      blocked.push(`${prefix}_completeness_invalid:${String(t.completeness)}`);
    if (!textVal(t.correlation_limit).trim())
      blocked.push(`${prefix}_correlation_limit_missing`);
    if (!textVal(t.source_ref).trim()) blocked.push(`${prefix}_source_ref_missing`);
    const h = textVal(t.source_sha256).trim();
    if (!HEX64_RE.test(h)) blocked.push(`${prefix}_source_sha256_invalid`);
    if (!textVal(t.observed_at).trim()) blocked.push(`${prefix}_observed_at_missing`);
    // scope must be explicitly declared — no inferred or empty scope
    if (textVal(t.scope) === "UNKNOWN" || textVal(t.scope) === "*")
      blocked.push(`${prefix}_scope_not_explicit`);
  }
  return { ok: blocked.length === 0, blocked_by: Object.freeze(blocked) };
}

function evaluateConsistency(trace_set, hypothesis_graph) {
  const blocked = [];
  if (!Array.isArray(trace_set)) trace_set = [];
  const traceIds = new Set(trace_set.map((t) => textVal(t?.trace_id)));
  if (!Array.isArray(hypothesis_graph)) {
    blocked.push("consistency_hypothesis_graph_missing");
    return { ok: false, blocked_by: Object.freeze(blocked) };
  }
  for (let i = 0; i < hypothesis_graph.length; i++) {
    const h = hypothesis_graph[i];
    if (!isPlainObject(h)) {
      blocked.push(`consistency_hypothesis_${i}_malformed`);
      continue;
    }
    if (!textVal(h.hypothesis_id).trim())
      blocked.push(`consistency_hypothesis_${i}_id_missing`);
    if (!Array.isArray(h.explains_traces))
      blocked.push(`consistency_hypothesis_${i}_explains_traces_not_array`);
    else {
      for (const ref of h.explains_traces) {
        if (!traceIds.has(ref)) {
          blocked.push(`consistency_unknown_trace_ref:${ref}`);
          break;
        }
      }
    }
  }
  // detect contradictory hypotheses that explain same trace with opposing
  // verdicts — simplified as duplicate explains_traces without disambiguation
  // is handled in disambiguation rail; consistency here only checks referential
  // integrity and duplicate hypothesis ids.
  const hypIds = hypothesis_graph.map((h) => textVal(h?.hypothesis_id));
  if (new Set(hypIds).size !== hypIds.length) blocked.push("consistency_duplicate_hypothesis_id");

  return { ok: blocked.length === 0, blocked_by: Object.freeze(blocked) };
}

function evaluateDisambiguation(hypothesis_graph) {
  const blocked = [];
  if (!Array.isArray(hypothesis_graph) || hypothesis_graph.length === 0) {
    blocked.push("disambiguation_no_hypothesis_graph");
    return { ok: false, blocked_by: Object.freeze(blocked) };
  }
  if (hypothesis_graph.length < 2) {
    blocked.push("disambiguation_requires_at_least_two_hypotheses");
  }
  for (let i = 0; i < hypothesis_graph.length; i++) {
    const h = hypothesis_graph[i];
    if (!isPlainObject(h)) continue;
    if (!textVal(h.hypothesis_id).trim()) blocked.push(`disambiguation_hypothesis_${i}_id_missing`);
    // each hypothesis must declare what it explains — even if empty
    if (!Array.isArray(h.explains_traces)) blocked.push(`disambiguation_hypothesis_${i}_explains_missing`);
    // optional: require alternative enumeration prose — we treat presence of
    // at least 2 hypotheses as satisfying the graph-of-thoughts requirement;
    // a single hypothesis is never sufficient for AUTHORIZED insight.
  }
  return { ok: blocked.length === 0, blocked_by: Object.freeze(blocked) };
}

function evaluateCorroboration(verification) {
  const blocked = [];
  if (!isPlainObject(verification)) {
    blocked.push("corroboration_verification_missing");
    return { ok: false, blocked_by: Object.freeze(blocked) };
  }
  if (verification.replay_performed !== true) blocked.push("corroboration_replay_not_performed");
  const h = textVal(verification.independent_replay_hash).trim();
  if (!HEX64_RE.test(h)) blocked.push("corroboration_replay_hash_invalid");
  if (verification.independent !== true) blocked.push("corroboration_not_independent");
  return { ok: blocked.length === 0, blocked_by: Object.freeze(blocked) };
}

function derivePromotionStatus(rails) {
  if (!rails.provenance.ok) return "BLOCKED";
  if (rails.consistency.ok && rails.disambiguation.ok && rails.corroboration.ok) return "INSIGHT_AUTHORIZED";
  return "REMAIN_TRACE";
}

function normalizeInput(input = {}) {
  const trace_set = Array.isArray(input.trace_set) ? input.trace_set : [];
  const hypothesis_graph = Array.isArray(input.hypothesis_graph) ? input.hypothesis_graph : [];
  const insight_candidate = isPlainObject(input.insight_candidate) ? input.insight_candidate : {};
  const verification = isPlainObject(input.verification) ? input.verification : {};
  return deepFreeze({
    trace_set: Object.freeze(trace_set.map((t) => deepFreeze(isPlainObject(t) ? { ...t } : t))),
    hypothesis_graph: Object.freeze(hypothesis_graph.map((h) => deepFreeze(isPlainObject(h) ? { ...h } : h))),
    insight_candidate: deepFreeze({ ...insight_candidate }),
    verification: deepFreeze({ ...verification }),
  });
}

export function buildTraceDiagnosticContract(input = {}) {
  const normalized = normalizeInput(input);
  const prov = evaluateProvenance(normalized.trace_set);
  const cons = evaluateConsistency(normalized.trace_set, normalized.hypothesis_graph);
  const dis = evaluateDisambiguation(normalized.hypothesis_graph);
  const corr = evaluateCorroboration(normalized.verification);

  const rails = deepFreeze({
    provenance: Object.freeze({ ok: prov.ok, blocked_by: prov.blocked_by }),
    consistency: Object.freeze({ ok: cons.ok, blocked_by: cons.blocked_by }),
    disambiguation: Object.freeze({ ok: dis.ok, blocked_by: dis.blocked_by }),
    corroboration: Object.freeze({ ok: corr.ok, blocked_by: corr.blocked_by }),
  });

  const promotion_status = derivePromotionStatus(rails);
  const blocked_by = deepFreeze([
    ...(!prov.ok ? prov.blocked_by : []),
    ...(!cons.ok ? cons.blocked_by : []),
    ...(!dis.ok ? dis.blocked_by : []),
    ...(!corr.ok ? corr.blocked_by : []),
  ]);

  const body = {
    schema: DEMA_TRACE_DIAGNOSTIC_CONTRACT_SCHEMA,
    truth_label: DEMA_TRACE_DIAGNOSTIC_CONTRACT_TRUTH_LABEL,
    stage: DEMA_TRACE_DIAGNOSTIC_CONTRACT_STAGE,
    trace_set: normalized.trace_set,
    hypothesis_graph: normalized.hypothesis_graph,
    insight_candidate: normalized.insight_candidate,
    verification: normalized.verification,
    rails,
    promotion_status,
    blocked_by,
    boundary: buildPreviewBoundary(),
  };

  return deepFreeze({ ...body, diagnostic_hash: diagnosticHash(body) });
}

export function verifyTraceDiagnosticContract(report) {
  const blocked_by = [];
  if (!report || report.schema !== DEMA_TRACE_DIAGNOSTIC_CONTRACT_SCHEMA) {
    return deepFreeze({ ok: false, blocked_by: Object.freeze(["invalid_schema"]), verification_mode: "semantic_rederivation" });
  }
  if (report.truth_label !== DEMA_TRACE_DIAGNOSTIC_CONTRACT_TRUTH_LABEL) blocked_by.push("invalid_truth_label");
  if (report.stage !== DEMA_TRACE_DIAGNOSTIC_CONTRACT_STAGE) blocked_by.push("invalid_stage");
  if (!PROMOTION_STATUSES.includes(report.promotion_status)) blocked_by.push("invalid_promotion_status");
  if (!report.boundary || typeof report.boundary !== "object") blocked_by.push("boundary_missing");
  else {
    for (const [k, v] of Object.entries(report.boundary)) {
      if (v !== false) blocked_by.push(`boundary_not_false:${k}`);
    }
  }
  // hash must be internal-consistent
  const { diagnostic_hash: _omit, ...hashBody } = report;
  if (report.diagnostic_hash !== diagnosticHash(hashBody)) blocked_by.push("diagnostic_hash_mismatch");

  // semantic rederivation — recompute from carried inputs, require equality
  const hasInputs =
    Array.isArray(report.trace_set) &&
    Array.isArray(report.hypothesis_graph) &&
    report.verification &&
    typeof report.verification === "object" &&
    report.insight_candidate &&
    typeof report.insight_candidate === "object";
  if (!hasInputs) {
    blocked_by.push("inputs_missing_for_rederivation");
  } else {
    const rederived = buildTraceDiagnosticContract({
      trace_set: report.trace_set,
      hypothesis_graph: report.hypothesis_graph,
      insight_candidate: report.insight_candidate,
      verification: report.verification,
    });
    if (rederived.diagnostic_hash !== report.diagnostic_hash) blocked_by.push("semantic_rederivation_mismatch");
    if (rederived.promotion_status !== report.promotion_status) blocked_by.push("promotion_status_mismatch");
    // rails must match as well — catches forger who flips ok but recomputes hash
    if (JSON.stringify(rederived.rails) !== JSON.stringify(report.rails)) blocked_by.push("rails_mismatch");
    if (JSON.stringify(rederived.blocked_by) !== JSON.stringify(report.blocked_by)) blocked_by.push("blocked_by_mismatch");
  }

  return deepFreeze({
    ok: blocked_by.length === 0,
    blocked_by: Object.freeze([...blocked_by]),
    verification_mode: "semantic_rederivation",
  });
}

export function defaultTraceDiagnosticFixture() {
  const trace_set = [
    {
      trace_id: "trace.code_static_001",
      scope: "code::packages/core/src/dema-trace-diagnostic-contract.js",
      completeness: "SCOPED",
      correlation_limit: "static-code only; no runtime, no production",
      source_ref: "packages/core/src/dema-trace-diagnostic-contract.js",
      source_sha256: "a".repeat(64),
      observed_at: "2026-08-26T00:00:00.000Z",
    },
    {
      trace_id: "trace.runtime_harness_001",
      scope: "runtime::npm test",
      completeness: "PARTIAL",
      correlation_limit: "local harness only; single host",
      source_ref: "scripts/check.mjs",
      source_sha256: "b".repeat(64),
      observed_at: "2026-08-26T00:00:00.000Z",
    },
  ];
  return deepFreeze({
    trace_set: Object.freeze(trace_set.map(deepFreeze)),
    hypothesis_graph: Object.freeze([
      Object.freeze({ hypothesis_id: "H1_inward_defect", explains_traces: ["trace.code_static_001"] }),
      Object.freeze({ hypothesis_id: "H2_outward_env", explains_traces: ["trace.runtime_harness_001"] }),
    ]),
    insight_candidate: Object.freeze({ claim: "promotion requires 4 rails", evidence_refs: ["trace.code_static_001"] }),
    verification: Object.freeze({ replay_performed: true, independent: true, independent_replay_hash: "c".repeat(64) }),
  });
}

export function runTraceDiagnosticContractGate({ input = defaultTraceDiagnosticFixture(), report } = {}) {
  const built = report ?? buildTraceDiagnosticContract(input);
  const verified = verifyTraceDiagnosticContract(built);
  return deepFreeze({
    ok: verified.ok && built.promotion_status === "INSIGHT_AUTHORIZED",
    schema: DEMA_TRACE_DIAGNOSTIC_CONTRACT_SCHEMA,
    truth_label: DEMA_TRACE_DIAGNOSTIC_CONTRACT_TRUTH_LABEL,
    promotion_status: built.promotion_status,
    rails: built.rails,
    blocked_by: built.blocked_by,
    diagnostic_hash: built.diagnostic_hash,
    verified,
    report: built,
  });
}
