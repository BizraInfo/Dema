// SELF-AWARENESS-KERNEL-1A
//
// A deterministic kernel that computes the system's structured, EVIDENCE-BOUND
// account of its own capabilities — and, crucially, its own BLIND SPOTS. Each
// declared capability is classified as:
//   EVIDENCED   — backed by at least one evidence anchor
//   BLIND_SPOT  — claimed but with NO evidence anchor (the un-self-aware part)
//   NOT_KNOWN   — explicitly marked as a known-unknown (honest limit)
//
// This is "self-awareness" only in the ZANN sense: knowing what it can and cannot
// prove about itself. It is NOT consciousness, NOT sentience, NOT subjective
// introspection, and performs no runtime/model/network/execution. claims_consciousness
// is false and verifySelfAwarenessReport fails closed if that is ever flipped.

import { sha256, stableStringify } from "../../consent/src/consent-common.js";

export const SELF_AWARENESS_REPORT_SCHEMA = "bizra.dema.self_awareness_report.v0.1";

export const SELF_AWARENESS_STATUSES = Object.freeze([
  "EVIDENCED",
  "BLIND_SPOT",
  "NOT_KNOWN",
]);

const CANONICAL_BOUNDARY = Object.freeze({
  runtime_execution_performed: false,
  introspection_runtime_performed: false,
  file_write_performed: false,
  model_invocation_performed: false,
  network_call_performed: false,
  self_modification_performed: false,
  autonomous_loop_started: false,
  signing_performed: false,
  key_generation_performed: false,
  mint_performed: false,
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

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function reject(reason_code, details = {}) {
  return deepFreeze({ valid: false, rejected: true, reason_code, ...details });
}

function normalizeEvidence(evidence) {
  if (!Array.isArray(evidence)) return Object.freeze([]);
  return Object.freeze([...new Set(evidence.map(text).filter(Boolean))].sort());
}

function slug(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function normalizeSelfCapability(capability, index = 0) {
  if (!capability || typeof capability !== "object" || Array.isArray(capability)) {
    return reject("capability_malformed", { index });
  }
  const name = text(capability.name);
  if (!name) return reject("name_required", { index });
  const claim = text(capability.claim);
  if (!claim) return reject("claim_required", { index, name });
  const id = slug(capability.id) || slug(name) || `capability_${index + 1}`;
  const evidence = normalizeEvidence(capability.evidence ?? capability.evidence_anchors);
  const knownUnknown = capability.known_unknown === true;
  const status = knownUnknown
    ? "NOT_KNOWN"
    : evidence.length > 0
      ? "EVIDENCED"
      : "BLIND_SPOT";
  const body = { id, name, claim, evidence, known_unknown: knownUnknown, status };
  return deepFreeze({ ...body, capability_hash: sha256(stableStringify(body)) });
}

function summarize(capabilities) {
  const counts = { EVIDENCED: 0, BLIND_SPOT: 0, NOT_KNOWN: 0 };
  for (const c of capabilities) counts[c.status] += 1;
  return counts;
}

export function buildSelfAwarenessReport({ capabilities = [], namespace = "node0" } = {}) {
  if (!Array.isArray(capabilities)) return reject("capabilities_must_be_array");
  if (capabilities.length === 0) return reject("capabilities_empty");

  const normalized = [];
  const seenIds = new Set();
  for (let i = 0; i < capabilities.length; i += 1) {
    const n = normalizeSelfCapability(capabilities[i], i);
    if (!n.capability_hash) return n;
    if (seenIds.has(n.id)) return reject("duplicate_capability_id", { id: n.id });
    seenIds.add(n.id);
    normalized.push(n);
  }
  normalized.sort((a, b) => a.id.localeCompare(b.id));

  const counts = summarize(normalized);
  const declared = normalized.length;
  const blind_spots = normalized
    .filter((c) => c.status === "BLIND_SPOT")
    .map((c) => Object.freeze({ id: c.id, name: c.name, claim: c.claim }));

  const body = {
    schema: SELF_AWARENESS_REPORT_SCHEMA,
    truth_label: "SELF_AWARENESS_REPORT_LIVE_KERNEL",
    mode: "DETERMINISTIC_SELF_KNOWLEDGE_ONLY",
    claims_consciousness: false,
    namespace: text(namespace) || "node0",
    statuses: SELF_AWARENESS_STATUSES,
    capabilities: normalized,
    declared_count: declared,
    evidenced_count: counts.EVIDENCED,
    blind_spot_count: counts.BLIND_SPOT,
    not_known_count: counts.NOT_KNOWN,
    self_knowledge_coverage: counts.EVIDENCED / declared,
    coverage_formula: "evidenced_count / declared_count",
    blind_spots,
    boundary: { ...CANONICAL_BOUNDARY },
    what_this_proves: Object.freeze([
      "The system can enumerate its own declared capabilities and classify each as evidenced, a blind spot, or a known-unknown.",
      "The self-knowledge coverage is a shown ratio (evidenced / declared) over caller-supplied evidence anchors.",
      "Blind spots — claims with no evidence — are surfaced explicitly rather than hidden.",
    ]),
    what_this_does_not_prove: Object.freeze([
      "This is NOT consciousness, sentience, or subjective introspection — it is a deterministic evidence ledger about the system.",
      "It does not verify that the cited evidence is itself true; it indexes caller-supplied claims and anchors.",
      "It performs no runtime, model call, network, signing, mint, or federation.",
    ]),
  };

  return deepFreeze({ ...body, report_hash: sha256(stableStringify(body)) });
}

export function verifySelfAwarenessReport(report) {
  if (!report || typeof report !== "object" || Array.isArray(report)) return reject("report_malformed");
  const blocked_by = [];
  if (report.schema !== SELF_AWARENESS_REPORT_SCHEMA) blocked_by.push("schema_mismatch");
  if (report.truth_label !== "SELF_AWARENESS_REPORT_LIVE_KERNEL") blocked_by.push("truth_label_mismatch");
  if (report.claims_consciousness !== false) blocked_by.push("consciousness_overclaim");

  if (!report.boundary || typeof report.boundary !== "object") blocked_by.push("boundary_missing");
  else {
    for (const [k, v] of Object.entries(report.boundary)) {
      if (v !== false) blocked_by.push(`boundary_not_false:${k}`);
    }
  }

  const caps = Array.isArray(report.capabilities) ? report.capabilities : null;
  if (!caps) blocked_by.push("capabilities_missing");
  else {
    const ids = new Set();
    for (const c of caps) {
      if (!c || typeof c !== "object") {
        blocked_by.push("capability_malformed");
        continue;
      }
      if (ids.has(c.id)) blocked_by.push(`duplicate_capability_id:${c.id}`);
      ids.add(c.id);
      if (!SELF_AWARENESS_STATUSES.includes(c.status)) blocked_by.push(`status_invalid:${c.id}`);
      // Re-derive the status invariant — verify must not trust a stored status. Without
      // this, a forged {evidence:[], status:"EVIDENCED", <valid hash>} would launder a
      // blind spot into EVIDENCED and inflate self_knowledge_coverage (the kernel's
      // headline property). Mirrors normalizeSelfCapability's derivation exactly.
      const expectedStatus = c.known_unknown === true
        ? "NOT_KNOWN"
        : Array.isArray(c.evidence) && c.evidence.filter(Boolean).length > 0
          ? "EVIDENCED"
          : "BLIND_SPOT";
      if (c.status !== expectedStatus) blocked_by.push(`status_mismatch:${c.id ?? "unknown"}`);
      const { capability_hash, ...cbody } = c;
      if (!capability_hash || sha256(stableStringify(cbody)) !== capability_hash) {
        blocked_by.push(`capability_hash_mismatch:${c.id ?? "unknown"}`);
      }
    }
    // counts + coverage must reconcile with the capabilities array
    const counts = summarize(caps.filter((c) => c && SELF_AWARENESS_STATUSES.includes(c.status)));
    if (report.evidenced_count !== counts.EVIDENCED) blocked_by.push("evidenced_count_mismatch");
    if (report.blind_spot_count !== counts.BLIND_SPOT) blocked_by.push("blind_spot_count_mismatch");
    if (report.not_known_count !== counts.NOT_KNOWN) blocked_by.push("not_known_count_mismatch");
    if (report.declared_count !== caps.length) blocked_by.push("declared_count_mismatch");
    if (caps.length > 0 && report.self_knowledge_coverage !== counts.EVIDENCED / caps.length) {
      blocked_by.push("coverage_mismatch");
    }
  }

  const { report_hash, ...body } = report;
  if (!report_hash || sha256(stableStringify(body)) !== report_hash) blocked_by.push("report_hash_mismatch");

  if (blocked_by.length > 0) return deepFreeze({ valid: false, rejected: true, reason_code: "self_awareness_report_invalid", blocked_by });
  return deepFreeze({ valid: true, rejected: false, reason_code: "self_awareness_report_valid", report_hash: report.report_hash });
}
