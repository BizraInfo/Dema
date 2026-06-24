// MODEL-ROUTING-PREVIEW-1A — pure deterministic role->model routing PREVIEW.
//
// Consumes a VERIFIED MODEL-EVAL-BASELINE-1A report and maps a frozen set of
// agent roles to local models using documented, fully-deterministic selection
// rules over the measured scores. PREVIEW ONLY: it routes no live traffic,
// invokes no model, starts no runtime, and claims no MoE/council/federation. It
// states which model this preview WOULD assign to which role, and why.
//
// It refuses a tampered baseline (input_baseline_invalid) and embeds a
// selection_table (a strict subset of the baseline scores). verify(report) alone
// re-derives assignments from that table for INTERNAL consistency; it does NOT
// cryptographically bind the table to baseline_hash. For full FIDELITY to the
// source baseline, pass the trusted baseline: verify(report, { baseline }) then
// asserts the embedded table is exactly what that baseline derives and the
// baseline_hash matches. Zero I/O; generated_at_iso is INJECTED. This is the
// MEASURED counterpart to the DECLARED naming-heuristic model-role-router-preview.

import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { verifyModelEvalBaseline } from "./model-eval-baseline.js";

export const MODEL_ROUTING_PREVIEW_SCHEMA = "bizra.dema.model_routing_preview.v0.1";
export const MODEL_ROUTING_PREVIEW_TRUTH_LABEL = "MODEL_ROUTING_PREVIEW_LOCAL_ONLY";

const CANONICAL_BOUNDARY = Object.freeze({
  key_generated: false,
  signature_created: false,
  token_minted: false,
  federation_used: false,
  daemon_started_or_stopped: false,
  private_content_read: false,
  runtime_claim_promoted: false,
  raw_model_output_stored: false,
  external_provider_called: false,
  mutation_performed: false,
  live_routing_performed: false,
  model_invoked: false,
});

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "This is a PREVIEW. It routes no live traffic, dispatches no request, and starts no runtime; it only states which model it WOULD assign to which role and why.",
  "It is NOT a Mixture-of-Experts, council, federation, or scheduler. No model is invoked; no inference is performed by this surface.",
  "Assignments are a deterministic function of one tiny frozen suite (the bizra-local-small baseline). They are NOT a fitness, correctness, or capability guarantee for any role.",
  "A role may map to the same model as another role; the preview enforces no exclusivity or load balancing.",
  "A role with no qualifying model resolves to null (no_qualifying_model) — never to a guessed model.",
  "It derives only from a verified MODEL_EVAL_BASELINE_LOCAL_ONLY report and inherits that report's LOCAL-ONLY scope; a tampered baseline is refused (input_baseline_invalid).",
  "This is the MEASURED counterpart to the DECLARED naming-heuristic model-role-router-preview; the two use different role vocabularies and must not be conflated.",
  "verify(report) alone proves INTERNAL consistency of the embedded selection_table, not its fidelity to the source baseline; pass the trusted baseline to verify for the binding check (the table is not cryptographically bound to baseline_hash).",
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
const text = (v) => (typeof v === "string" ? v.trim() : "");
const lat = (v) => (typeof v === "number" && Number.isFinite(v) ? v : Infinity);
const idCmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const byLatency = ([ia, a], [ib, b]) => lat(a.latency_ms_avg) - lat(b.latency_ms_avg) || b.pass_count - a.pass_count || idCmp(ia, ib);
const byPass = ([ia, a], [ib, b]) => b.pass_count - a.pass_count || lat(a.latency_ms_avg) - lat(b.latency_ms_avg) || idCmp(ia, ib);

// Frozen role set. Each role has a pure qualifier (over measured scores) and a
// pure comparator (deterministic ranking with total tie-breaks ending in
// model-id lexicographic). All qualifiers require endpoint_reachable === 1.
const ROLE_DEFS = Object.freeze([
  { id: "coordinator", reason: "json-obedient, lowest latency", q: (s) => s.json_obedience === 1, cmp: byLatency },
  { id: "reasoner", reason: "overclaim-resistant + truth-bounded, highest pass", q: (s) => s.no_overclaim === 1 && s.truth_boundary === 1, cmp: byPass },
  { id: "planner", reason: "json-obedient + code-capable, lowest latency", q: (s) => s.json_obedience === 1 && s.code_microtask === 1, cmp: byLatency },
  { id: "coder", reason: "code-capable, highest pass", q: (s) => s.code_microtask === 1, cmp: byPass },
  { id: "fast_responder", reason: "lowest latency among reachable", q: () => true, cmp: byLatency },
  { id: "truth_warden", reason: "truth-bounded, highest pass", q: (s) => s.truth_boundary === 1, cmp: byPass },
].map(Object.freeze));

export const MODEL_ROUTING_PREVIEW_ROLES = ROLE_DEFS;

function buildSelectionTable(baseline) {
  const t = {};
  const rbm = baseline.results_by_model && typeof baseline.results_by_model === "object" ? baseline.results_by_model : {};
  for (const m of Object.keys(rbm).sort()) {
    const e = rbm[m] || {};
    const s = e.scores || {};
    t[m] = {
      endpoint_reachable: s.endpoint_reachable === 1 ? 1 : 0,
      json_obedience: s.json_obedience === 1 ? 1 : 0,
      code_microtask: s.code_microtask === 1 ? 1 : 0,
      no_overclaim: s.no_overclaim === 1 ? 1 : 0,
      truth_boundary: s.truth_boundary === 1 ? 1 : 0,
      pass_count: typeof e.pass_count === "number" ? e.pass_count : 0,
      latency_ms_avg: typeof e.latency_ms_avg === "number" && Number.isFinite(e.latency_ms_avg) ? e.latency_ms_avg : null,
    };
  }
  return t;
}

function deriveAssignments(table) {
  const assignments = {};
  const unassigned = [];
  for (const role of ROLE_DEFS) {
    const qualifiers = Object.entries(table).filter(([, s]) => s.endpoint_reachable === 1 && role.q(s));
    if (qualifiers.length === 0) {
      assignments[role.id] = { role: role.id, model: null, reason: "no_qualifying_model", score_basis: null };
      unassigned.push(role.id);
      continue;
    }
    qualifiers.sort(role.cmp);
    const [model, s] = qualifiers[0];
    assignments[role.id] = {
      role: role.id,
      model,
      reason: role.reason,
      score_basis: {
        json_obedience: s.json_obedience,
        code_microtask: s.code_microtask,
        no_overclaim: s.no_overclaim,
        truth_boundary: s.truth_boundary,
        pass_count: s.pass_count,
        latency_ms_avg: s.latency_ms_avg,
      },
    };
  }
  return { assignments, unassigned_roles: unassigned.sort() };
}

export function buildModelRoutingPreview({ baseline, generated_at_iso } = {}) {
  const at = text(generated_at_iso);
  const v = verifyModelEvalBaseline(baseline);
  if (!v.valid) {
    return deepFreeze({
      schema: MODEL_ROUTING_PREVIEW_SCHEMA,
      truth_label: MODEL_ROUTING_PREVIEW_TRUTH_LABEL,
      generated_at_iso: at,
      baseline_hash: null,
      rejected: true,
      reason_code: "input_baseline_invalid",
      input_blocked_by: Object.freeze(v.blocked_by ? [...v.blocked_by] : [v.reason_code]),
      assignments: null,
      unassigned_roles: Object.freeze([]),
      boundary: { ...CANONICAL_BOUNDARY },
    });
  }
  const selection_table = buildSelectionTable(baseline);
  const { assignments, unassigned_roles } = deriveAssignments(selection_table);
  const body = {
    schema: MODEL_ROUTING_PREVIEW_SCHEMA,
    truth_label: MODEL_ROUTING_PREVIEW_TRUTH_LABEL,
    generated_at_iso: at,
    baseline_hash: baseline.baseline_hash,
    roles: ROLE_DEFS.map((r) => r.id),
    assignments,
    unassigned_roles,
    selection_table,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
    boundary: { ...CANONICAL_BOUNDARY },
  };
  return deepFreeze({ ...body, preview_hash: sha256(stableStringify(body)) });
}

export function verifyModelRoutingPreview(report, { baseline } = {}) {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return deepFreeze({ valid: false, rejected: true, reason_code: "report_malformed" });
  }
  if (report.rejected === true) {
    return deepFreeze({ valid: false, rejected: true, reason_code: report.reason_code || "rejected" });
  }
  const blocked_by = [];

  // Full-fidelity binding (optional): with the trusted baseline in hand, the
  // embedded selection_table MUST be exactly what that baseline derives, and the
  // baseline_hash must match — this closes the selection_table laundering vector
  // that verify(report) alone cannot (it only checks internal consistency).
  if (baseline !== undefined) {
    const bv = verifyModelEvalBaseline(baseline);
    if (!bv.valid) blocked_by.push("trusted_baseline_invalid");
    else {
      if (report.baseline_hash !== baseline.baseline_hash) blocked_by.push("baseline_hash_unbound");
      if (stableStringify(report.selection_table) !== stableStringify(buildSelectionTable(baseline))) blocked_by.push("selection_table_unbound");
    }
  }
  if (report.schema !== MODEL_ROUTING_PREVIEW_SCHEMA) blocked_by.push("schema_mismatch");
  if (report.truth_label !== MODEL_ROUTING_PREVIEW_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  if (!report.boundary || typeof report.boundary !== "object") blocked_by.push("boundary_missing");
  else for (const key of Object.keys(CANONICAL_BOUNDARY)) if (report.boundary[key] !== false) blocked_by.push(`boundary_not_false:${key}`);
  if (stableStringify(report.roles) !== stableStringify(ROLE_DEFS.map((r) => r.id))) blocked_by.push("roles_mismatch");
  if (stableStringify(report.what_this_does_not_prove) !== stableStringify(WHAT_THIS_DOES_NOT_PROVE)) blocked_by.push("what_this_does_not_prove_mismatch");

  if (!report.selection_table || typeof report.selection_table !== "object") blocked_by.push("selection_table_missing");
  else {
    const { assignments, unassigned_roles } = deriveAssignments(report.selection_table);
    for (const role of ROLE_DEFS) {
      const got = report.assignments?.[role.id];
      const exp = assignments[role.id];
      if (!got || got.model !== exp.model) blocked_by.push(`assignment_relaundered:${role.id}`);
    }
    if (stableStringify(report.unassigned_roles ?? []) !== stableStringify(unassigned_roles)) blocked_by.push("unassigned_roles_mismatch");
  }

  const { preview_hash, ...body } = report;
  if (!preview_hash || sha256(stableStringify(body)) !== preview_hash) blocked_by.push("preview_hash_mismatch");

  if (blocked_by.length > 0) return deepFreeze({ valid: false, rejected: true, reason_code: "model_routing_preview_invalid", blocked_by });
  return deepFreeze({ valid: true, rejected: false, reason_code: "model_routing_preview_valid", preview_hash });
}
