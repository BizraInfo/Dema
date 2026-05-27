import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildPATReceiptRecorderPreview,
  buildPATReceiptRecorderSummary,
  buildPATReceiptRecorderEffectCap,
  buildPATReceiptRecorderKernel,
  shapeReceiptCandidate,
  verifyReceiptHash,
  PAT_RECEIPT_RECORDER_PERSONA,
} from "../packages/core/src/pat-receipt-recorder.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";

test("PAT-6 canonical schema · pat_number=6", () => {
  const p = buildPATReceiptRecorderPreview();
  assert.equal(p.schema, "bizra.dema.pat_receipt_recorder.v0.1");
  assert.equal(p.persona.pat_number, 6);
  assert.equal(p.persona.role_name, "receipt_recorder");
});

test("PAT-6 boundary canonical + deep frozen", () => {
  const p = buildPATReceiptRecorderPreview();
  assert.ok(isCanonicalBoundary(p.boundary));
  assert.ok(Object.isFrozen(p));
});

test("PAT-6 refusals: never mint · never advance chain · never sign · never modify", () => {
  const p = buildPATReceiptRecorderPreview();
  assert.ok(p.persona.primary_refusals.includes("mint_canonical_receipt"));
  assert.ok(p.persona.primary_refusals.includes("advance_chain"));
  assert.ok(
    p.persona.primary_refusals.includes("sign_receipt_without_consent"),
  );
  assert.ok(p.persona.primary_refusals.includes("modify_existing_receipt"));
  assert.ok(p.persona.primary_refusals.includes("forge_prev_hash_chain"));
});

test("PAT-6 EffectCap blocks mint · advance-chain · modify-existing · forge-prev-hash", () => {
  const cap = buildPATReceiptRecorderEffectCap();
  assert.equal(cap.valid, true);
  assert.ok(cap.blocked_effects.includes("mint_canonical_receipt"));
  assert.ok(cap.blocked_effects.includes("advance_chain"));
  assert.ok(cap.blocked_effects.includes("modify_existing_receipt"));
  assert.ok(cap.blocked_effects.includes("forge_prev_hash_chain"));
});

test("PAT-6 kernel pre-configured", () => {
  const k = buildPATReceiptRecorderKernel({
    mission_intent: "shape candidate",
  });
  assert.equal(k.agent_id, "pat-6-receipt-recorder");
});

test("shapeReceiptCandidate · valid input → 64-char sha256 hash", () => {
  const c = shapeReceiptCandidate({
    event_schema: "test.event.v0.1",
    event_summary: { x: 1, y: "abc" },
  });
  assert.equal(c.schema, "bizra.dema.receipt_candidate.v0.1");
  assert.equal(c.valid, true);
  assert.equal(typeof c.candidate_hash, "string");
  assert.equal(c.candidate_hash.length, 64);
});

test("shapeReceiptCandidate · deterministic hash given same input", () => {
  const a = shapeReceiptCandidate({
    event_schema: "test.event.v0.1",
    event_summary: { x: 1, y: "abc" },
  });
  const b = shapeReceiptCandidate({
    event_schema: "test.event.v0.1",
    event_summary: { x: 1, y: "abc" },
  });
  assert.equal(a.candidate_hash, b.candidate_hash);
});

test("shapeReceiptCandidate · different summary keys → different hash", () => {
  const a = shapeReceiptCandidate({
    event_schema: "x.v0.1",
    event_summary: { k1: 1 },
  });
  const b = shapeReceiptCandidate({
    event_schema: "x.v0.1",
    event_summary: { k2: 1 },
  });
  assert.notEqual(a.candidate_hash, b.candidate_hash);
});

test("shapeReceiptCandidate · chain_advance_performed=false ALWAYS · receipt_minted=false ALWAYS", () => {
  const c = shapeReceiptCandidate({
    event_schema: "x.v0.1",
    event_summary: { x: 1 },
  });
  assert.equal(c.chain_advance_performed, false);
  assert.equal(c.receipt_minted, false);
  assert.equal(c.requires_consent_to_mint, true);
  assert.match(c.consent_phrase_for_mint, /^GO: mint receipt at [a-f0-9]{64}$/);
});

test("shapeReceiptCandidate · prev_hash propagated · chain_position_inferred=true", () => {
  const prev = "abc123".padEnd(64, "0");
  const c = shapeReceiptCandidate({
    event_schema: "x.v0.1",
    event_summary: { x: 1 },
    prev_receipt_hash: prev,
  });
  assert.equal(c.prev_receipt_hash, prev);
  assert.equal(c.chain_position_inferred, true);
});

test("shapeReceiptCandidate · refuses missing event_schema", () => {
  const c = shapeReceiptCandidate({ event_summary: { x: 1 } });
  assert.equal(c.valid, false);
  assert.match(c.refusal_reason, /missing_event_schema/);
});

test("shapeReceiptCandidate · refuses empty event_summary", () => {
  const c = shapeReceiptCandidate({ event_schema: "x.v0.1" });
  assert.equal(c.valid, false);
  assert.match(c.refusal_reason, /empty_event_summary/);
});

test("shapeReceiptCandidate · invalid action_class coerced to 'preview'", () => {
  const c = shapeReceiptCandidate({
    event_schema: "x.v0.1",
    event_summary: { x: 1 },
    action_class: "malicious_class",
  });
  assert.equal(c.action_class, "preview");
});

test("shapeReceiptCandidate · invalid truth_label coerced to NODE0_LOCAL_SEED", () => {
  const c = shapeReceiptCandidate({
    event_schema: "x.v0.1",
    event_summary: { x: 1 },
    truth_label_for_action: "MADE_UP_LABEL",
  });
  assert.equal(c.truth_label, "NODE0_LOCAL_SEED");
});

test("Adversarial · non-string event_schema coerced to empty · refused", () => {
  const c = shapeReceiptCandidate({
    event_schema: { malicious: true },
    event_summary: { x: 1 },
  });
  assert.equal(c.valid, false);
});

test("verifyReceiptHash · 64-char hex declared → format_ok_unverified", () => {
  const v = verifyReceiptHash({
    receipt: { receipt_id: "a".repeat(64) },
  });
  assert.equal(v.hash_format_valid, true);
  assert.equal(v.verification_status, "declared_format_ok_content_unverified");
});

test("verifyReceiptHash · wrong-length declared → format_invalid", () => {
  const v = verifyReceiptHash({
    receipt: { receipt_id: "short" },
  });
  assert.equal(v.hash_format_valid, false);
  assert.match(v.verification_status, /declared_format_invalid/);
});

test("Receipt candidate deep-frozen + canonical boundary", () => {
  const c = shapeReceiptCandidate({
    event_schema: "x.v0.1",
    event_summary: { x: 1 },
  });
  assert.ok(Object.isFrozen(c));
  assert.ok(isCanonicalBoundary(c.boundary));
});

test("Summary fits within line budget · exports frozen", () => {
  const s = buildPATReceiptRecorderSummary();
  assert.ok(JSON.stringify(s, null, 2).split("\n").length <= 40);
  assert.ok(Object.isFrozen(PAT_RECEIPT_RECORDER_PERSONA));
  assert.equal(PAT_RECEIPT_RECORDER_PERSONA.pat_number, 6);
});
