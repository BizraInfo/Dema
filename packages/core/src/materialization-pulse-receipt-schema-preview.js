// MATERIALIZATION-PULSE-RECEIPT-SCHEMA-PREVIEW-1A — Pure preview-only canonical Pulse receipt envelope.
//
// The "missing middle": the atomic transaction receipt that binds ONE Materialization Pulse. It links
// the two truth membranes — input_safety (the corpus-sanitizer verdict) and claim_binding (the
// public-metric claim-gate verdict) — together with niyyah, plan, FATE, and execution, under an
// all-false boundary and an explicit does_not_prove list, content-addressed as one hash.
//
// It ASSEMBLES and VERIFIES the envelope; it runs no pulse. The referenced sub-receipts
// (sanitizer_receipt, claim_gate_receipt, plan_root, exec_merkle) are injected HASHES — this kernel
// binds them, it does not re-run the sub-gates. Consistency rules it enforces (operator's §8):
//   - a sealed pulse MUST reference both the sanitizer and the claim gate,
//   - a sealed pulse whose sanitizer verdict was BLOCKED is illegal (must be aborted),
//   - claims_public_safe may be true ONLY if the claim gate REJECTED zero public claims,
//   - mint_allowed / federation_live / authority_delta > 0 are always rejected,
//   - does_not_prove must include live_urp / mint / federation.
//
// Pure kernel: no fs / network / process / clock / random. No execution.

import { createHash } from "node:crypto";

export const MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_SCHEMA = "bizra.dema.materialization_pulse_receipt_schema_preview.v0.1";
export const MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_TRUTH_LABEL = "MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_MEASURED_REPO";
export const MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_GO_PHRASE = "GO: materialization pulse receipt schema preview";

export const PULSE_RECEIPT_BODY_SCHEMA = "bizra.materialization_pulse_receipt.v0.1";
export const SANITIZER_VERDICTS = Object.freeze(["ALLOWED", "QUARANTINED", "BLOCKED"]);
export const FATE_VERDICTS = Object.freeze(["PERMIT", "PERMIT_WITH_CONFIRMATION", "REVIEW", "REJECT"]);
export const EXECUTION_MODES = Object.freeze(["preview", "local_readonly", "reversible_local", "external_gated"]);
export const PULSE_STATUSES = Object.freeze(["sealed", "aborted"]);
export const REQUIRED_DOES_NOT_PROVE = Object.freeze(["live_urp", "federation", "mint", "wallet", "economic_settlement"]);

const HASH_RE = /^sha256:[0-9a-f]{64}$/;

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

// The Pulse boundary — the operator's §7 six-key set (distinct from the kernel's own meta-boundary).
export function pulseReceiptBoundary() {
  return Object.freeze({
    execution_allowed: false,
    network_used: false,
    model_invocation_performed: false,
    wallet_used: false,
    mint_allowed: false,
    federation_live: false,
  });
}

function pulseBoundaryAllFalse(b) {
  const keys = Object.keys(pulseReceiptBoundary());
  return (
    !!b && typeof b === "object" && !Array.isArray(b) &&
    Object.keys(b).length === keys.length && keys.every((k) => b[k] === false)
  );
}

// The kernel's OWN meta-boundary (standard 8-key: this kernel invocation did nothing live).
export function materializationPulseReceiptSchemaPreviewBoundary() {
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

function metaBoundaryAllFalse(b) {
  const keys = Object.keys(materializationPulseReceiptSchemaPreviewBoundary());
  return !!b && typeof b === "object" && !Array.isArray(b) && Object.keys(b).length === keys.length && keys.every((k) => b[k] === false);
}

// Deterministic structural validation of an assembled Pulse-receipt body (the §8 acceptance rules).
export function evaluatePulseReceipt(body) {
  const blocked_by = [];
  const b = (body && typeof body === "object") ? body : {};

  if (b.schema !== PULSE_RECEIPT_BODY_SCHEMA) blocked_by.push("pulse_schema_mismatch");
  if (typeof b.pulse_id !== "string" || b.pulse_id === "") blocked_by.push("missing_pulse_id");
  if (typeof b.mission_id !== "string" || b.mission_id === "") blocked_by.push("missing_mission_id");
  if (!(b.prev_pulse === null || HASH_RE.test(b.prev_pulse))) blocked_by.push("prev_pulse_malformed");

  // niyyah
  if (!b.niyyah || !HASH_RE.test(b.niyyah.hash)) blocked_by.push("missing_niyyah_hash");

  // input_safety — MUST reference the sanitizer; a sealed pulse cannot carry a BLOCKED verdict.
  const is = b.input_safety;
  if (!is || !HASH_RE.test(is.sanitizer_receipt)) blocked_by.push("missing_sanitizer_reference");
  else if (!SANITIZER_VERDICTS.includes(is.verdict)) blocked_by.push("sanitizer_verdict_invalid");
  if (is && is.verdict === "BLOCKED" && b.pulse_status !== "aborted") blocked_by.push("sealed_pulse_over_blocked_input");

  // plan
  if (!b.plan || !HASH_RE.test(b.plan.plan_root)) blocked_by.push("missing_plan_root");
  else if (!Number.isInteger(b.plan.rejected_branch_count) || b.plan.rejected_branch_count < 0) blocked_by.push("rejected_branch_count_invalid");

  // fate
  const f = b.fate;
  if (!f || !FATE_VERDICTS.includes(f.verdict)) blocked_by.push("fate_verdict_invalid");
  if (!f || f.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  if (!f || f.grants_action !== false) blocked_by.push("grants_action_true");
  if (!f || f.mint_allowed !== false) blocked_by.push("fate_mint_allowed_true");

  // execution
  if (!b.execution || !EXECUTION_MODES.includes(b.execution.mode)) blocked_by.push("execution_mode_invalid");
  if (b.execution && !(b.execution.exec_merkle === null || HASH_RE.test(b.execution.exec_merkle))) blocked_by.push("exec_merkle_malformed");

  // claim_binding — MUST reference the claim gate; public-safe requires zero REJECTED public claims.
  const cb = b.claim_binding;
  if (!cb || !HASH_RE.test(cb.claim_gate_receipt)) blocked_by.push("missing_claim_gate_reference");
  else {
    if (!Number.isInteger(cb.rejected_count) || cb.rejected_count < 0) blocked_by.push("rejected_count_invalid");
    if (!Number.isInteger(cb.unknown_count) || cb.unknown_count < 0) blocked_by.push("unknown_count_invalid");
    if (b.claims_public_safe === true && cb.rejected_count > 0) blocked_by.push("public_safe_with_rejected_claims");
  }

  // pulse boundary + does_not_prove
  if (!pulseBoundaryAllFalse(b.boundary)) blocked_by.push("pulse_boundary_not_all_false");
  if (!Array.isArray(b.does_not_prove)) blocked_by.push("does_not_prove_missing");
  else {
    for (const req of ["live_urp", "mint", "federation"]) {
      if (!b.does_not_prove.includes(req)) blocked_by.push(`does_not_prove_missing:${req}`);
    }
  }
  if (!PULSE_STATUSES.includes(b.pulse_status)) blocked_by.push("pulse_status_invalid");

  return Object.freeze({ ok: blocked_by.length === 0, blocked_by: Object.freeze([...new Set(blocked_by)]) });
}

export function planMaterializationPulseReceiptSchemaPreview({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_GO_PHRASE) blocked_by.push("consent_phrase_mismatch");
  if (!input || typeof input !== "object") blocked_by.push("input_not_object");
  else if (!input.pulse || typeof input.pulse !== "object") blocked_by.push("missing_pulse");
  return Object.freeze({
    schema: MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_SCHEMA,
    truth_label: MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Assemble the canonical Pulse-receipt body from injected parts, fill defaults, content-address it.
export function buildMaterializationPulseReceiptSchemaPreviewPayload(input) {
  const p = input?.pulse ?? {};
  const is = p.input_safety ?? {};
  const cb = p.claim_binding ?? {};
  const status = p.pulse_status ?? (is.verdict === "BLOCKED" ? "aborted" : "sealed");

  const receipt = {
    schema: PULSE_RECEIPT_BODY_SCHEMA,
    pulse_id: p.pulse_id ?? null,
    mission_id: p.mission_id ?? null,
    prev_pulse: p.prev_pulse ?? null,
    pulse_status: status,
    niyyah: { hash: p.niyyah?.hash ?? null, truth_label: p.niyyah?.truth_label ?? "DECLARED" },
    input_safety: { sanitizer_receipt: is.sanitizer_receipt ?? null, verdict: is.verdict ?? null },
    plan: { plan_root: p.plan?.plan_root ?? null, rejected_branch_count: p.plan?.rejected_branch_count ?? 0 },
    fate: {
      verdict: p.fate?.verdict ?? null,
      authority_delta: p.fate?.authority_delta ?? 0,
      grants_action: p.fate?.grants_action ?? false,
      mint_allowed: p.fate?.mint_allowed ?? false,
    },
    execution: { mode: p.execution?.mode ?? "preview", exec_merkle: p.execution?.exec_merkle ?? null },
    claim_binding: {
      claim_gate_receipt: cb.claim_gate_receipt ?? null,
      rejected_count: cb.rejected_count ?? 0,
      unknown_count: cb.unknown_count ?? 0,
    },
    claims_public_safe: p.claims_public_safe ?? false,
    boundary: pulseReceiptBoundary(),
    does_not_prove: [...REQUIRED_DOES_NOT_PROVE],
  };
  const evaluation = evaluatePulseReceipt(receipt);

  const body = {
    schema: MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_SCHEMA,
    truth_label: MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_TRUTH_LABEL,
    receipt,
    receipt_ok: evaluation.ok,
    receipt_blocked_by: evaluation.blocked_by,
    boundary: materializationPulseReceiptSchemaPreviewBoundary(),
    authority_delta: 0,
    grants_action: false,
    mint_allowed: false,
    what_this_proves:
      "A canonical Materialization Pulse receipt was assembled and content-addressed: it binds one pulse's niyyah, input_safety (corpus-sanitizer verdict), plan, FATE verdict, execution mode, and claim_binding (claim-gate verdict) under an all-false Pulse boundary and an explicit does_not_prove list. The envelope enforces the atomicity/consistency rules: a sealed pulse must reference BOTH membranes; a sealed pulse over a BLOCKED sanitizer verdict is illegal; claims_public_safe requires zero REJECTED public claims; mint/federation/authority_delta violations are rejected.",
    what_this_does_not_prove:
      "It RUNS no pulse and re-runs no sub-gate — sanitizer_receipt / claim_gate_receipt / plan_root / exec_merkle are injected hashes it BINDS, not payloads it re-verifies. It cannot prove the referenced sub-receipts are themselves valid, only that the envelope is well-formed and internally consistent. No execution, no live URP, no mint, no wallet, no federation, no network, no model.",
  };
  const content_hash = `sha256:${sha256(stableStringify(body))}`;
  return Object.freeze({ ...body, content_hash });
}

export function verifyMaterializationPulseReceiptSchemaPreview(payload) {
  if (!payload || typeof payload !== "object") {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["packet_not_object"]) });
  }
  const blocked_by = [];
  const { content_hash, ...body } = payload;
  if (content_hash !== `sha256:${sha256(stableStringify(body))}`) blocked_by.push("content_hash_mismatch");
  if (payload.schema !== MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_SCHEMA) blocked_by.push("schema_mismatch");
  if (payload.truth_label !== MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  if (payload.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  if (payload.grants_action !== false) blocked_by.push("grants_action_true");
  if (payload.mint_allowed !== false) blocked_by.push("mint_allowed_true");
  if (!metaBoundaryAllFalse(payload.boundary)) blocked_by.push("boundary_not_all_false");
  // Re-derive the receipt evaluation — a forged receipt_ok is rejected.
  const evaluation = evaluatePulseReceipt(payload.receipt);
  if (payload.receipt_ok !== evaluation.ok) blocked_by.push("receipt_ok_forged");
  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_SCHEMA,
    truth_label: MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_TRUTH_LABEL,
    receipt_ok: evaluation.ok,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
  });
}

// A pure example of a VALID preview pulse (all-false boundary, both membranes referenced, ALLOWED).
export function exampleValidPulse() {
  const h = (c) => `sha256:${c.repeat(64)}`;
  return {
    pulse_id: "pulse-0001",
    mission_id: "node0-local-mission-aaaaaaaa",
    prev_pulse: null,
    niyyah: { hash: h("a"), truth_label: "DECLARED" },
    input_safety: { sanitizer_receipt: h("b"), verdict: "ALLOWED" },
    plan: { plan_root: h("c"), rejected_branch_count: 2 },
    fate: { verdict: "PERMIT", authority_delta: 0, grants_action: false, mint_allowed: false },
    execution: { mode: "local_readonly", exec_merkle: h("d") },
    claim_binding: { claim_gate_receipt: h("e"), rejected_count: 0, unknown_count: 1 },
    claims_public_safe: true,
    pulse_status: "sealed",
  };
}

export function runMaterializationPulseReceiptSchemaPreview({ consent, input } = {}) {
  const plan = planMaterializationPulseReceiptSchemaPreview({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({
      ok: false,
      schema: MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_SCHEMA,
      truth_label: MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_TRUTH_LABEL,
      status: "blocked_pending_consent",
      boundary: materializationPulseReceiptSchemaPreviewBoundary(),
      mint_allowed: false,
      authority_delta: 0,
      grants_action: false,
      blocked_by: plan.blocked_by,
    });
  }
  const payload = buildMaterializationPulseReceiptSchemaPreviewPayload(input);
  const verified = verifyMaterializationPulseReceiptSchemaPreview(payload);
  const blocked_by = verified.ok ? [] : [...verified.blocked_by];
  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_SCHEMA,
    truth_label: MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_TRUTH_LABEL,
    // run.ok means the ENVELOPE kernel ran + self-verified; receipt_ok says whether the assembled
    // Pulse receipt is itself well-formed (a malformed pulse still runs, receipt_ok false).
    status: blocked_by.length === 0 ? "pulse_receipt_schema_complete" : "pulse_receipt_schema_broken",
    content_hash: payload.content_hash,
    receipt_ok: payload.receipt_ok,
    receipt_blocked_by: payload.receipt_blocked_by,
    pulse_status: payload.receipt.pulse_status,
    receipt: payload.receipt,
    boundary: payload.boundary,
    mint_allowed: false,
    authority_delta: 0,
    grants_action: false,
    what_this_proves: payload.what_this_proves,
    what_this_does_not_prove: payload.what_this_does_not_prove,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
  });
}
