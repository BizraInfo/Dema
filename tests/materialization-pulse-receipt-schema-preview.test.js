import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  planMaterializationPulseReceiptSchemaPreview,
  buildMaterializationPulseReceiptSchemaPreviewPayload,
  verifyMaterializationPulseReceiptSchemaPreview,
  runMaterializationPulseReceiptSchemaPreview,
  evaluatePulseReceipt,
  exampleValidPulse,
  MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_SCHEMA,
  MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_TRUTH_LABEL,
  MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_GO_PHRASE,
} from "../packages/core/src/materialization-pulse-receipt-schema-preview.js";
import { runMaterializationPulseReceiptSchemaPreviewCheck } from "../scripts/review/materialization-pulse-receipt-schema-preview-check.mjs";

const GO = MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_GO_PHRASE;
// Evaluate a pulse (assembled body) directly — returns receipt_ok + receipt_blocked_by.
function assemble(overrides = {}) {
  const r = runMaterializationPulseReceiptSchemaPreview({ consent: GO, input: { pulse: { ...exampleValidPulse(), ...overrides } } });
  return r;
}

// --- scaffold contract ---------------------------------------------------------------------------

test("plan fail-closed without exact consent; eligible with a pulse", () => {
  assert.equal(planMaterializationPulseReceiptSchemaPreview({ consent: "x", input: { pulse: {} } }).eligible, false);
  assert.equal(planMaterializationPulseReceiptSchemaPreview({ consent: GO, input: { pulse: {} } }).eligible, true);
  assert.equal(planMaterializationPulseReceiptSchemaPreview({ consent: GO, input: {} }).eligible, false);
});

test("payload is content-addressed with an all-false meta boundary", () => {
  const p = buildMaterializationPulseReceiptSchemaPreviewPayload({ pulse: exampleValidPulse() });
  assert.match(p.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(p.boundary.model_invocation_performed, false);
});

test("verify accepts a fresh payload; rejects tamper", () => {
  const p = buildMaterializationPulseReceiptSchemaPreviewPayload({ pulse: exampleValidPulse() });
  assert.equal(verifyMaterializationPulseReceiptSchemaPreview(p).ok, true, verifyMaterializationPulseReceiptSchemaPreview(p).blocked_by.join(","));
  assert.equal(verifyMaterializationPulseReceiptSchemaPreview({ ...p, truth_label: "X" }).ok, false);
  assert.equal(verifyMaterializationPulseReceiptSchemaPreview({ ...p, content_hash: `sha256:${"0".repeat(64)}` }).ok, false);
});

test("review gate assembles a valid preview pulse (receipt_ok true)", () => {
  const r = runMaterializationPulseReceiptSchemaPreviewCheck();
  assert.equal(r.ok, true, r.blocked_by?.join(","));
  assert.equal(r.receipt_ok, true, r.receipt_blocked_by?.join(","));
});

// --- the operator's 10 acceptance tests ----------------------------------------------------------

test("10. valid preview pulse passes with all-false boundary", () => {
  const r = assemble();
  assert.equal(r.receipt_ok, true, r.receipt_blocked_by?.join(","));
  assert.equal(r.pulse_status, "sealed");
});

test("1. reject a pulse receipt without a sanitizer reference", () => {
  const r = assemble({ input_safety: { verdict: "ALLOWED" } }); // no sanitizer_receipt
  assert.equal(r.receipt_ok, false);
  assert.ok(r.receipt_blocked_by.includes("missing_sanitizer_reference"));
});

test("2. reject a SEALED pulse whose sanitizer verdict is BLOCKED", () => {
  const r = assemble({ input_safety: { sanitizer_receipt: `sha256:${"b".repeat(64)}`, verdict: "BLOCKED" }, pulse_status: "sealed" });
  assert.equal(r.receipt_ok, false);
  assert.ok(r.receipt_blocked_by.includes("sealed_pulse_over_blocked_input"));
});

test("2b. a BLOCKED input is fine if the pulse is ABORTED", () => {
  const r = assemble({ input_safety: { sanitizer_receipt: `sha256:${"b".repeat(64)}`, verdict: "BLOCKED" }, pulse_status: "aborted", claims_public_safe: false });
  assert.equal(r.receipt_ok, true, r.receipt_blocked_by?.join(","));
});

test("3. reject a pulse receipt without a claim-binding reference", () => {
  const r = assemble({ claim_binding: { rejected_count: 0, unknown_count: 0 } }); // no claim_gate_receipt
  assert.equal(r.receipt_ok, false);
  assert.ok(r.receipt_blocked_by.includes("missing_claim_gate_reference"));
});

test("4. reject claims_public_safe:true while the claim gate REJECTED public claims", () => {
  const r = assemble({ claim_binding: { claim_gate_receipt: `sha256:${"e".repeat(64)}`, rejected_count: 2, unknown_count: 0 }, claims_public_safe: true });
  assert.equal(r.receipt_ok, false);
  assert.ok(r.receipt_blocked_by.includes("public_safe_with_rejected_claims"));
});

test("5. reject fate.mint_allowed:true", () => {
  const r = assemble({ fate: { verdict: "PERMIT", authority_delta: 0, grants_action: false, mint_allowed: true } });
  assert.equal(r.receipt_ok, false);
  assert.ok(r.receipt_blocked_by.includes("fate_mint_allowed_true"));
});

test("6. reject federation_live:true (pulse boundary key flip)", () => {
  const payload = buildMaterializationPulseReceiptSchemaPreviewPayload({ pulse: exampleValidPulse() });
  const tampered = { ...payload.receipt, boundary: { ...payload.receipt.boundary, federation_live: true } };
  assert.equal(evaluatePulseReceipt(tampered).ok, false);
  assert.ok(evaluatePulseReceipt(tampered).blocked_by.includes("pulse_boundary_not_all_false"));
});

test("7. reject authority_delta > 0", () => {
  const r = assemble({ fate: { verdict: "PERMIT", authority_delta: 1, grants_action: false, mint_allowed: false } });
  assert.equal(r.receipt_ok, false);
  assert.ok(r.receipt_blocked_by.includes("authority_delta_nonzero"));
});

test("8. content hash is deterministic across identical inputs", () => {
  const a = buildMaterializationPulseReceiptSchemaPreviewPayload({ pulse: exampleValidPulse() });
  const b = buildMaterializationPulseReceiptSchemaPreviewPayload({ pulse: exampleValidPulse() });
  assert.equal(a.content_hash, b.content_hash);
});

test("9. does_not_prove exists and includes live_urp / mint / federation", () => {
  const p = buildMaterializationPulseReceiptSchemaPreviewPayload({ pulse: exampleValidPulse() });
  for (const req of ["live_urp", "mint", "federation"]) {
    assert.ok(p.receipt.does_not_prove.includes(req), `does_not_prove must include ${req}`);
  }
});

// --- launder resistance + purity -----------------------------------------------------------------

test("verify rejects a forged receipt_ok (broken receipt laundered to ok)", () => {
  const bad = buildMaterializationPulseReceiptSchemaPreviewPayload({ pulse: { ...exampleValidPulse(), input_safety: { verdict: "ALLOWED" } } });
  assert.equal(bad.receipt_ok, false); // missing sanitizer ref
  const forged = { ...bad, receipt_ok: true };
  // content_hash still matches body only if we also recompute; here receipt_ok flip breaks the hash bind AND the re-derive
  assert.equal(verifyMaterializationPulseReceiptSchemaPreview(forged).ok, false);
});

test("a malformed pulse still RUNS (run.ok true) but receipt_ok is false", () => {
  const r = assemble({ niyyah: {} });
  assert.equal(r.ok, true); // the envelope kernel ran + self-verified
  assert.equal(r.receipt_ok, false);
  assert.ok(r.receipt_blocked_by.includes("missing_niyyah_hash"));
});

// --- branch coverage: default/error sides -------------------------------------------------------

test("verify rejects a non-object payload (packet_not_object)", () => {
  assert.equal(verifyMaterializationPulseReceiptSchemaPreview(null).ok, false);
  assert.equal(verifyMaterializationPulseReceiptSchemaPreview("x").ok, false);
  assert.ok(verifyMaterializationPulseReceiptSchemaPreview(null).blocked_by.includes("packet_not_object"));
});

test("run returns blocked_pending_consent on a wrong consent phrase", () => {
  const r = runMaterializationPulseReceiptSchemaPreview({ consent: "nope", input: { pulse: exampleValidPulse() } });
  assert.equal(r.ok, false);
  assert.equal(r.status, "blocked_pending_consent");
  assert.equal(r.boundary.execution_allowed, false);
  assert.ok(r.blocked_by.includes("consent_phrase_mismatch"));
});

test("an empty pulse takes every default and reports every missing-part reason", () => {
  const p = buildMaterializationPulseReceiptSchemaPreviewPayload({ pulse: {} });
  // defaults applied
  assert.equal(p.receipt.prev_pulse, null);
  assert.equal(p.receipt.pulse_status, "sealed");
  assert.equal(p.receipt.execution.mode, "preview");
  assert.equal(p.receipt.plan.rejected_branch_count, 0);
  assert.equal(p.receipt.claims_public_safe, false);
  assert.equal(p.receipt.fate.authority_delta, 0);
  // and the evaluation catches the missing required parts
  assert.equal(p.receipt_ok, false);
  for (const code of ["missing_pulse_id", "missing_mission_id", "missing_niyyah_hash", "missing_sanitizer_reference", "missing_plan_root", "fate_verdict_invalid", "missing_claim_gate_reference"]) {
    assert.ok(p.receipt_blocked_by.includes(code), `expected ${code}`);
  }
});

test("evaluatePulseReceipt fails closed on null/empty and on each malformed field", () => {
  assert.equal(evaluatePulseReceipt(null).ok, false);
  assert.equal(evaluatePulseReceipt({}).ok, false);
  const base = () => ({ ...exampleValidPulse(), schema: "bizra.materialization_pulse_receipt.v0.1", boundary: { execution_allowed: false, network_used: false, model_invocation_performed: false, wallet_used: false, mint_allowed: false, federation_live: false }, does_not_prove: ["live_urp", "federation", "mint", "wallet", "economic_settlement"] });
  const bad = (patch) => evaluatePulseReceipt({ ...base(), ...patch }).blocked_by;
  assert.ok(bad({ prev_pulse: "not-a-hash" }).includes("prev_pulse_malformed"));
  assert.ok(bad({ plan: { plan_root: `sha256:${"c".repeat(64)}`, rejected_branch_count: -1 } }).includes("rejected_branch_count_invalid"));
  assert.ok(bad({ fate: { verdict: "NOPE", authority_delta: 0, grants_action: false, mint_allowed: false } }).includes("fate_verdict_invalid"));
  assert.ok(bad({ fate: { verdict: "PERMIT", authority_delta: 0, grants_action: true, mint_allowed: false } }).includes("grants_action_true"));
  assert.ok(bad({ execution: { mode: "warp", exec_merkle: null } }).includes("execution_mode_invalid"));
  assert.ok(bad({ execution: { mode: "preview", exec_merkle: "bad" } }).includes("exec_merkle_malformed"));
  assert.ok(bad({ claim_binding: { claim_gate_receipt: `sha256:${"e".repeat(64)}`, rejected_count: -1, unknown_count: 0 } }).includes("rejected_count_invalid"));
  assert.ok(bad({ claim_binding: { claim_gate_receipt: `sha256:${"e".repeat(64)}`, rejected_count: 0, unknown_count: -1 } }).includes("unknown_count_invalid"));
  assert.ok(bad({ pulse_status: "weird" }).includes("pulse_status_invalid"));
  assert.ok(bad({ does_not_prove: ["mint"] }).includes("does_not_prove_missing:live_urp"));
  assert.ok(bad({ does_not_prove: "nope" }).includes("does_not_prove_missing"));
  assert.ok(bad({ input_safety: { sanitizer_receipt: `sha256:${"b".repeat(64)}`, verdict: "NOPE" } }).includes("sanitizer_verdict_invalid"));
  assert.ok(bad({ schema: "wrong" }).includes("pulse_schema_mismatch"));
});

test("an explicit aborted status with an ALLOWED verdict is still well-formed", () => {
  const r = runMaterializationPulseReceiptSchemaPreview({ consent: GO, input: { pulse: { ...exampleValidPulse(), pulse_status: "aborted", claims_public_safe: false } } });
  assert.equal(r.receipt_ok, true, r.receipt_blocked_by?.join(","));
  assert.equal(r.pulse_status, "aborted");
});

test("kernel remains pure: no fs / network / process / clock / random", () => {
  const src = readFileSync(
    fileURLToPath(new URL("../packages/core/src/materialization-pulse-receipt-schema-preview.js", import.meta.url)),
    "utf8",
  );
  assert.doesNotMatch(src, /node:fs|node:net|node:child_process|node:http|node:dns/);
  assert.doesNotMatch(src, /Math\.random|Date\.now|new Date\(/);
  assert.doesNotMatch(src, /process\.(env|argv|exit)/);
});
