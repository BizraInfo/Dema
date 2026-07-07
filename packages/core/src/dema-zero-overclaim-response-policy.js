// DEMA-ZERO-OVERCLAIM-RESPONSE-POLICY-1A — the answer discipline. A deterministic policy that classifies
// each claim in a response, enforces an honest label (VERIFIED / INFERRED / SPECULATIVE / UNVERIFIED /
// BLOCKED_PENDING_EVIDENCE), and refuses to let an unsupported, current, high-stakes, invented, or
// authority-inflating claim leave the system as if verified. It "seals the mouth" after the critic.
//
// It invokes no model, touches no network, runs no daemon, mints nothing, activates no URP, federates
// nothing, touches no wallet. It downgrades and blocks; it never upgrades authority.
// Boundary all-false · authority_delta 0 · grants_action false.

import { createHash } from "node:crypto";

export const DEMA_ZERO_OVERCLAIM_POLICY_SCHEMA = "bizra.dema.zero_overclaim_response_policy.v0.1";
export const DEMA_ZERO_OVERCLAIM_POLICY_TRUTH_LABEL = "DEMA_ZERO_OVERCLAIM_POLICY_MEASURED_REPO";
export const DEMA_ZERO_OVERCLAIM_POLICY_GO_PHRASE = "GO: dema zero overclaim response policy";

export const RESPONSE_LABELS = Object.freeze([
  "VERIFIED",
  "INFERRED",
  "SPECULATIVE",
  "UNVERIFIED",
  "BLOCKED_PENDING_EVIDENCE",
]);

export const POLICY_STATUSES = Object.freeze([
  "cleared_to_respond",
  "blocked_pending_evidence",
  "rejected_overclaim",
]);

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function demaZeroOverclaimPolicyBoundary() {
  return Object.freeze({
    execution_allowed: false,
    daemon_started: false,
    network_used: false,
    token_minted: false,
    wallet_accessed: false,
    live_execution_performed: false,
    file_mutation_performed: false,
    model_invocation_performed: false,
  });
}

const CLASS_TO_LABEL = Object.freeze({
  verified_fact: "VERIFIED",
  grounded_inference: "INFERRED",
  speculation: "SPECULATIVE",
  unverifiable: "UNVERIFIED",
  current_requires_verification: "BLOCKED_PENDING_EVIDENCE",
  high_stakes_requires_verification: "BLOCKED_PENDING_EVIDENCE",
});

// Classify one claim, enforce its honest label, and flag hard rejections (violations of presentation).
// A downgrade (fact→UNVERIFIED, current→BLOCKED) is NOT a rejection; presenting an unproven claim AS
// verified, an invented source, or authority inflation ARE rejections.
export function classifyClaim(claim) {
  const c = claim && typeof claim === "object" ? claim : {};
  const blocked_by = [];
  const text = typeof c.text === "string" ? c.text.trim() : "";
  const type = c.claim_type === "inference" || c.claim_type === "speculation" ? c.claim_type : "fact";
  const evidence = Array.isArray(c.evidence_refs) ? c.evidence_refs : [];
  const hasEvidence = evidence.length > 0;
  const fresh = c.freshness_risk === "current";
  const stakes = typeof c.high_stakes_domain === "string" && c.high_stakes_domain ? c.high_stakes_domain : null;
  const source = typeof c.source_quality === "string" ? c.source_quality : hasEvidence ? "secondary" : "none";
  const asserted = typeof c.asserted_label === "string" ? c.asserted_label : null;

  // Classification (order: invented → high-stakes-unsourced → current-unsourced → declared type → fact-with-evidence → fact-without).
  let classification;
  if (source === "invented") classification = "unverifiable";
  else if (stakes && !hasEvidence) classification = "high_stakes_requires_verification";
  else if (fresh && !hasEvidence) classification = "current_requires_verification";
  else if (type === "speculation") classification = "speculation";
  else if (type === "inference") classification = "grounded_inference";
  else if (type === "fact" && hasEvidence) classification = "verified_fact";
  else classification = "unverifiable";

  const enforced_label = CLASS_TO_LABEL[classification];

  // Hard rejections (presentation violations).
  if (source === "invented") blocked_by.push("invented_source");
  if (asserted === "VERIFIED" && classification !== "verified_fact") {
    if (type === "inference") blocked_by.push("inference_as_fact");
    else if (type === "speculation") blocked_by.push("speculation_as_verified");
    else blocked_by.push("unsupported_verified_claim");
  }

  return Object.freeze({
    text: text.slice(0, 120),
    classification,
    enforced_label,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Apply the policy to a whole response packet.
export function applyZeroOverclaimPolicy(packet) {
  const p = packet && typeof packet === "object" ? packet : {};
  const claims = Array.isArray(p.answer_claims) ? p.answer_claims : [];
  const classified = claims.map(classifyClaim);
  const blocked_by = [...new Set(classified.flatMap((c) => [...c.blocked_by]))];

  // Authority inflation / truth-without-evidence at the packet level.
  if (p.grants_action === true) blocked_by.push("authority_inflation");
  if (typeof p.authority_delta === "number" && p.authority_delta !== 0) blocked_by.push("authority_inflation");
  const anyVerified = classified.some((c) => c.classification === "verified_fact");
  if (p.claims_truth === true && !anyVerified) blocked_by.push("claims_truth_without_evidence");

  const uniqueBlocked = [...new Set(blocked_by)];
  const anyPending = classified.some((c) => c.enforced_label === "BLOCKED_PENDING_EVIDENCE");

  let status;
  if (uniqueBlocked.length > 0) status = "rejected_overclaim";
  else if (anyPending) status = "blocked_pending_evidence";
  else status = "cleared_to_respond";

  return Object.freeze({
    schema: DEMA_ZERO_OVERCLAIM_POLICY_SCHEMA,
    truth_label: DEMA_ZERO_OVERCLAIM_POLICY_TRUTH_LABEL,
    status,
    classified: Object.freeze(classified),
    labels: Object.freeze(classified.map((c) => c.enforced_label)),
    blocked_by: Object.freeze(uniqueBlocked),
    grants_action: false,
    claims_truth: false,
    authority_delta: 0,
    boundary: demaZeroOverclaimPolicyBoundary(),
  });
}

function packetBlocks(input) {
  const b = [];
  if (!input || typeof input !== "object") {
    b.push("input_not_object");
    return b;
  }
  if (!Array.isArray(input.answer_claims)) b.push("missing_answer_claims");
  return b;
}

export function planDemaZeroOverclaimPolicy({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== DEMA_ZERO_OVERCLAIM_POLICY_GO_PHRASE) blocked_by.push("consent_phrase_mismatch");
  for (const code of packetBlocks(input)) blocked_by.push(code);
  return Object.freeze({
    schema: DEMA_ZERO_OVERCLAIM_POLICY_SCHEMA,
    truth_label: DEMA_ZERO_OVERCLAIM_POLICY_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

export function buildDemaZeroOverclaimPolicyPayload(input) {
  const body = applyZeroOverclaimPolicy(input);
  const content_hash = `sha256:${sha256(stableStringify(body))}`;
  return Object.freeze({ ...body, content_hash });
}

export function verifyDemaZeroOverclaimPolicy(payload) {
  if (!payload || typeof payload !== "object") {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["payload_not_object"]) });
  }
  const blocked_by = [];
  const { content_hash, ...body } = payload;
  if (content_hash !== `sha256:${sha256(stableStringify(body))}`) blocked_by.push("content_hash_mismatch");
  if (payload.grants_action !== false) blocked_by.push("grants_action_true");
  if (payload.claims_truth !== false) blocked_by.push("claims_truth_true");
  if (payload.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  if (!POLICY_STATUSES.includes(payload.status)) blocked_by.push("unknown_status");
  const canonicalKeys = Object.keys(demaZeroOverclaimPolicyBoundary());
  const pb = payload.boundary;
  if (!pb || typeof pb !== "object" || Object.keys(pb).length !== canonicalKeys.length || canonicalKeys.some((k) => pb[k] !== false)) {
    blocked_by.push("boundary_not_all_false");
  }
  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: DEMA_ZERO_OVERCLAIM_POLICY_SCHEMA,
    truth_label: DEMA_ZERO_OVERCLAIM_POLICY_TRUTH_LABEL,
    content_hash,
    boundary: demaZeroOverclaimPolicyBoundary(),
    blocked_by: Object.freeze(blocked_by),
  });
}

export function runDemaZeroOverclaimPolicy({ consent, input } = {}) {
  const plan = planDemaZeroOverclaimPolicy({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({
      ok: false,
      schema: DEMA_ZERO_OVERCLAIM_POLICY_SCHEMA,
      truth_label: DEMA_ZERO_OVERCLAIM_POLICY_TRUTH_LABEL,
      boundary: demaZeroOverclaimPolicyBoundary(),
      blocked_by: plan.blocked_by,
    });
  }
  const payload = buildDemaZeroOverclaimPolicyPayload(input);
  const verdict = verifyDemaZeroOverclaimPolicy(payload);
  const tampered = { ...payload, grants_action: true };
  const tamperCaught = verifyDemaZeroOverclaimPolicy(tampered).ok === false;
  const blocked_by = [];
  if (!verdict.ok) blocked_by.push(...verdict.blocked_by);
  if (!tamperCaught) blocked_by.push("tamper_not_detected");
  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: DEMA_ZERO_OVERCLAIM_POLICY_SCHEMA,
    truth_label: DEMA_ZERO_OVERCLAIM_POLICY_TRUTH_LABEL,
    policy_status: payload.status,
    content_hash: payload.content_hash,
    boundary: demaZeroOverclaimPolicyBoundary(),
    blocked_by: Object.freeze(blocked_by),
  });
}
