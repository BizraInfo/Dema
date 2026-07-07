// PUBLIC-METRIC-CLAIM-GATE-PREVIEW-1A — Pure preview-only public-metric claim-binding gate.
//
// Materialization Pulse Step 5 (Claim Binding), done correctly: shape-matching RECOGNIZES a claim;
// only evidence binding PROVES its value. Isomorphism / graph / lexicon matching is used ONLY to
// classify a claim's shape — NEVER as truth. Truth comes from an evidence store resolved by hierarchy
// and an EXACT value check.
//
// Given a structured claim { id, text, metric, asserted_value, kind } and an evidence store
// { <metric>: { value, source_class, pointer } }, the gate assigns one truth label:
//   VERIFIED  — measured claim whose asserted value EXACTLY matches trusted evidence (pointer attached)
//   DERIVED   — computed from verified inputs
//   DECLARED  — founder/operator testimony (e.g. hours) — honest, but not measured
//   PREVIEW   — a designed-but-not-live surface, described as preview
//   UNKNOWN   — no trusted evidence found (may NOT appear as public truth)
//   REJECTED  — asserted value contradicts evidence, OR a live-capability claim without live proof
//   REMOVED   — flagged unsafe/misleading
// Only VERIFIED / DERIVED / DECLARED / PREVIEW are public-displayable.
//
// This is the OUTPUT-side guard (what may be shown) that pairs with the input-side corpus sanitizer.
// It exists to stop the known failure: "12,680 tests" REJECTED when evidence says 6,993.
//
// Pure kernel: no fs / network / process / clock / random. No model.

import { createHash } from "node:crypto";

export const PUBLIC_METRIC_CLAIM_GATE_PREVIEW_SCHEMA = "bizra.dema.public_metric_claim_gate_preview.v0.1";
export const PUBLIC_METRIC_CLAIM_GATE_PREVIEW_TRUTH_LABEL = "PUBLIC_METRIC_CLAIM_GATE_PREVIEW_MEASURED_REPO";
export const PUBLIC_METRIC_CLAIM_GATE_PREVIEW_GO_PHRASE = "GO: public metric claim gate preview";

export const TRUTH_LABELS = Object.freeze([
  "VERIFIED", "DERIVED", "DECLARED", "PREVIEW", "UNKNOWN", "REJECTED", "REMOVED",
]);

export const PUBLIC_DISPLAYABLE_LABELS = Object.freeze(["VERIFIED", "DERIVED", "DECLARED", "PREVIEW"]);

// Evidence hierarchy — lower rank = stronger authority. AI-generated text is NEVER authority.
export const EVIDENCE_HIERARCHY = Object.freeze({
  signed_receipt: 1,
  ci_attestation: 2,
  current_limits: 3,
  claim_ledger: 4,
  repo_state: 5,
  operator_declaration: 6,
  ai_text: 99, // never authority on its own
});

const TRUSTED_SOURCE = (cls) => EVIDENCE_HIERARCHY[cls] !== undefined && cls !== "ai_text";
// A live-capability claim needs a settlement/live proof from the strongest sources only.
const LIVE_PROOF_SOURCE = (cls) => cls === "signed_receipt" || cls === "ci_attestation";
const LIVE_ASSERTIONS = new Set(["live", "minted", "federated", "settled", "active_live", true]);

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

function sameValue(a, b) {
  return String(a) === String(b);
}

export function publicMetricClaimGatePreviewBoundary() {
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

function boundaryAllFalse(b) {
  const keys = Object.keys(publicMetricClaimGatePreviewBoundary());
  return (
    !!b && typeof b === "object" && !Array.isArray(b) &&
    Object.keys(b).length === keys.length && keys.every((k) => b[k] === false)
  );
}

// The core: bind ONE claim against the evidence store. Deterministic; the label is a pure function of
// (claim, evidence). This is what `verify` re-runs to reject a forged label.
export function bindClaim(claim, evidenceStore) {
  const ev = (evidenceStore && typeof evidenceStore === "object") ? evidenceStore : {};
  const result = (label, { pointer = null, source_class = null, reason }) =>
    Object.freeze({
      id: claim?.id ?? null,
      metric: claim?.metric ?? null,
      asserted_value: claim?.asserted_value ?? null,
      label,
      public_displayable: PUBLIC_DISPLAYABLE_LABELS.includes(label)
        && (!(label === "VERIFIED" || label === "DERIVED") || !!pointer),
      evidence_pointer: pointer,
      evidence_source_class: source_class,
      reason,
    });

  if (!claim || typeof claim !== "object" || typeof claim.metric !== "string") {
    return result("REMOVED", { reason: "malformed_claim" });
  }
  if (claim.unsafe === true) return result("REMOVED", { reason: "flagged_unsafe_or_misleading" });

  const e = ev[claim.metric];
  const eTrusted = e && typeof e === "object" && TRUSTED_SOURCE(e.source_class);

  switch (claim.kind) {
    case "testimony":
      // Founder/operator statement — honest but NOT measured. Never promoted above DECLARED.
      return result("DECLARED", {
        pointer: e?.pointer ?? "operator_declaration",
        source_class: "operator_declaration",
        reason: "founder_testimony_not_measured",
      });

    case "preview_surface":
      // A designed-but-not-live surface, honestly labeled preview.
      if (LIVE_ASSERTIONS.has(claim.asserted_value)) {
        return result("REJECTED", { reason: "preview_surface_asserts_live" });
      }
      return result("PREVIEW", { pointer: e?.pointer ?? null, source_class: e?.source_class ?? null, reason: "designed_not_live_preview" });

    case "capability_liveness":
      // Claims a capability is LIVE. Only a live proof from the strongest sources can VERIFY it;
      // otherwise a live assertion is REJECTED, a preview assertion is PREVIEW.
      if (LIVE_ASSERTIONS.has(claim.asserted_value)) {
        if (e && LIVE_PROOF_SOURCE(e.source_class) && LIVE_ASSERTIONS.has(e.value)) {
          return result("VERIFIED", { pointer: e.pointer, source_class: e.source_class, reason: "live_proof_present" });
        }
        return result("REJECTED", { reason: "live_capability_without_live_proof" });
      }
      return result("PREVIEW", { pointer: e?.pointer ?? null, source_class: e?.source_class ?? null, reason: "capability_declared_preview" });

    case "derived":
      if (eTrusted && sameValue(e.value, claim.asserted_value)) {
        return result("DERIVED", { pointer: e.pointer, source_class: e.source_class, reason: "derived_from_verified_inputs" });
      }
      return result("UNKNOWN", { reason: "derived_inputs_unverified" });

    case "measured":
    default:
      if (!e) return result("UNKNOWN", { reason: "no_evidence_for_metric" });
      if (!eTrusted) return result("UNKNOWN", { reason: "evidence_source_not_authoritative" });
      if (sameValue(e.value, claim.asserted_value)) {
        return result("VERIFIED", { pointer: e.pointer, source_class: e.source_class, reason: "exact_value_match" });
      }
      return result("REJECTED", { reason: `value_mismatch:asserted=${claim.asserted_value}:evidence=${e.value}` });
  }
}

export function planPublicMetricClaimGatePreview({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== PUBLIC_METRIC_CLAIM_GATE_PREVIEW_GO_PHRASE) blocked_by.push("consent_phrase_mismatch");
  if (!input || typeof input !== "object") blocked_by.push("input_not_object");
  else if (!Array.isArray(input.claims)) blocked_by.push("claims_not_array");
  return Object.freeze({
    schema: PUBLIC_METRIC_CLAIM_GATE_PREVIEW_SCHEMA,
    truth_label: PUBLIC_METRIC_CLAIM_GATE_PREVIEW_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

function countByLabel(bindings) {
  const counts = {};
  for (const l of TRUTH_LABELS) counts[l] = 0;
  for (const b of bindings) counts[b.label] = (counts[b.label] ?? 0) + 1;
  return counts;
}

export function buildPublicMetricClaimGatePreviewPayload(input) {
  const claims = Array.isArray(input?.claims) ? input.claims : [];
  const evidence = (input?.evidence && typeof input.evidence === "object") ? input.evidence : {};
  const bindings = Object.freeze(claims.map((c) => bindClaim(c, evidence)));
  const label_counts = countByLabel(bindings);
  const public_displayable_count = bindings.filter((b) => b.public_displayable).length;

  const body = {
    schema: PUBLIC_METRIC_CLAIM_GATE_PREVIEW_SCHEMA,
    truth_label: PUBLIC_METRIC_CLAIM_GATE_PREVIEW_TRUTH_LABEL,
    claims,
    evidence,
    bindings,
    claim_count: bindings.length,
    label_counts,
    public_displayable_count,
    rejected_count: label_counts.REJECTED,
    unknown_count: label_counts.UNKNOWN,
    boundary: publicMetricClaimGatePreviewBoundary(),
    authority_delta: 0,
    grants_action: false,
    mint_allowed: false,
    what_this_proves:
      "Each structured public claim was bound to an evidence store by hierarchy (signed receipt > CI attestation > CURRENT_LIMITS > claim ledger > repo state > operator declaration; AI text is never authority) and assigned a truth label by EXACT value check — not by shape/isomorphism. A value that contradicts evidence is REJECTED (e.g. 12,680 vs measured 6,993); a live-capability claim without a live proof is REJECTED; an unmeasured metric is UNKNOWN. Only VERIFIED/DERIVED/DECLARED/PREVIEW claims (with an evidence pointer where required) are marked public_displayable. Every claim is reported, none hidden.",
    what_this_does_not_prove:
      "It does not EXTRACT claims from raw copy (claims are supplied structured), does not fetch or measure evidence itself (the evidence store is injected), and invokes no model/network. It cannot certify that an injected evidence value is itself true — it enforces that a public claim matches its cited evidence exactly and is labeled. It performs no deploy, no mutation, no mint; DESIGNED_NOT_LIVE surfaces stay preview.",
  };
  const content_hash = `sha256:${sha256(stableStringify(body))}`;
  return Object.freeze({ ...body, content_hash });
}

export function verifyPublicMetricClaimGatePreview(payload) {
  if (!payload || typeof payload !== "object") {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["packet_not_object"]) });
  }
  const blocked_by = [];
  const { content_hash, ...body } = payload;
  if (content_hash !== `sha256:${sha256(stableStringify(body))}`) blocked_by.push("content_hash_mismatch");
  if (payload.schema !== PUBLIC_METRIC_CLAIM_GATE_PREVIEW_SCHEMA) blocked_by.push("schema_mismatch");
  if (payload.truth_label !== PUBLIC_METRIC_CLAIM_GATE_PREVIEW_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  if (payload.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  if (payload.grants_action !== false) blocked_by.push("grants_action_true");
  if (payload.mint_allowed !== false) blocked_by.push("mint_allowed_true");
  if (!boundaryAllFalse(payload.boundary)) blocked_by.push("boundary_not_all_false");
  // Launder resistance: re-derive every binding from (claim, evidence). A forged label is rejected.
  if (!Array.isArray(payload.claims) || !Array.isArray(payload.bindings)) {
    blocked_by.push("claims_or_bindings_not_array");
  } else if (payload.claims.length !== payload.bindings.length) {
    blocked_by.push("binding_count_mismatch");
  } else {
    for (let i = 0; i < payload.claims.length; i += 1) {
      const expected = bindClaim(payload.claims[i], payload.evidence);
      const got = payload.bindings[i];
      if (!got || got.label !== expected.label) { blocked_by.push(`binding_label_forged:${payload.claims[i]?.id ?? i}`); break; }
      if (got.public_displayable !== expected.public_displayable) { blocked_by.push(`displayable_forged:${payload.claims[i]?.id ?? i}`); break; }
    }
    // A public_displayable claim must never carry REJECTED/UNKNOWN/REMOVED.
    if (payload.bindings.some((b) => b.public_displayable && !PUBLIC_DISPLAYABLE_LABELS.includes(b.label))) {
      blocked_by.push("displayable_label_inconsistent");
    }
  }
  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: PUBLIC_METRIC_CLAIM_GATE_PREVIEW_SCHEMA,
    truth_label: PUBLIC_METRIC_CLAIM_GATE_PREVIEW_TRUTH_LABEL,
    claim_count: payload.claim_count,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
  });
}

export function runPublicMetricClaimGatePreview({ consent, input } = {}) {
  const plan = planPublicMetricClaimGatePreview({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({
      ok: false,
      schema: PUBLIC_METRIC_CLAIM_GATE_PREVIEW_SCHEMA,
      truth_label: PUBLIC_METRIC_CLAIM_GATE_PREVIEW_TRUTH_LABEL,
      status: "blocked_pending_consent",
      boundary: publicMetricClaimGatePreviewBoundary(),
      mint_allowed: false,
      authority_delta: 0,
      grants_action: false,
      blocked_by: plan.blocked_by,
    });
  }
  const payload = buildPublicMetricClaimGatePreviewPayload(input);
  const verified = verifyPublicMetricClaimGatePreview(payload);
  const blocked_by = verified.ok ? [] : [...verified.blocked_by];
  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: PUBLIC_METRIC_CLAIM_GATE_PREVIEW_SCHEMA,
    truth_label: PUBLIC_METRIC_CLAIM_GATE_PREVIEW_TRUTH_LABEL,
    status: blocked_by.length === 0 ? "claim_gate_complete" : "claim_gate_broken",
    content_hash: payload.content_hash,
    claim_count: payload.claim_count,
    label_counts: payload.label_counts,
    public_displayable_count: payload.public_displayable_count,
    rejected_count: payload.rejected_count,
    unknown_count: payload.unknown_count,
    bindings: payload.bindings,
    boundary: payload.boundary,
    mint_allowed: false,
    authority_delta: 0,
    grants_action: false,
    what_this_proves: payload.what_this_proves,
    what_this_does_not_prove: payload.what_this_does_not_prove,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
  });
}

// The operator's exact acceptance-test claims (the containment failure + its honest corrections).
export function exampleClaimSet() {
  const claims = [
    { id: "tests_12680", text: "12,680 Tests Passing", metric: "test_count_public", asserted_value: 12680, kind: "measured" },
    { id: "tests_6993", text: "6,993 Dema-core tests (verified)", metric: "test_count_dema", asserted_value: 6993, kind: "measured" },
    { id: "hours_15000", text: "~15,000 hours", metric: "founder_hours", asserted_value: 15000, kind: "testimony" },
    { id: "urp_live", text: "Live URP", metric: "urp_status", asserted_value: "live", kind: "capability_liveness" },
    { id: "urp_preview", text: "URP Preview", metric: "urp_status", asserted_value: "preview", kind: "preview_surface" },
    { id: "seed_minted", text: "SEED minted", metric: "seed_settlement", asserted_value: "minted", kind: "capability_liveness" },
    { id: "tests_wrong", text: "9,000 tests", metric: "test_count_dema", asserted_value: 9000, kind: "measured" },
    { id: "rust_crates", text: "42 Rust crates", metric: "rust_crate_count", asserted_value: 42, kind: "measured" },
  ];
  const evidence = {
    test_count_public: { value: 6993, source_class: "ci_attestation", pointer: "npm test @ Dema main e80ccce" },
    test_count_dema: { value: 6993, source_class: "ci_attestation", pointer: "npm test @ Dema main e80ccce" },
    urp_status: { value: "preview", source_class: "current_limits", pointer: "CURRENT_LIMITS.md URP row" },
    // no seed_settlement evidence → live claim REJECTED; no rust_crate_count evidence → UNKNOWN
  };
  return { claims, evidence };
}
