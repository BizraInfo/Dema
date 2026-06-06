import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildSATReceiptChainVerifierPreview,
  buildSATReceiptChainVerifierEffectCap,
  buildSATReceiptChainVerifierKernel,
  buildSATReceiptChainVerifierSummary,
  verifyReceiptChain,
  SAT_RECEIPT_CHAIN_VERIFIER_PERSONA,
} from "../packages/core/src/sat-receipt-chain-verifier.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);

test("SAT-4 canonical schema · sat_number=4", () => {
  const p = buildSATReceiptChainVerifierPreview();
  assert.equal(p.schema, "bizra.dema.sat_receipt_chain_verifier.v0.1");
  assert.equal(p.persona.sat_number, 4);
});

test("SAT-4 boundary canonical · refusals enumerated", () => {
  const p = buildSATReceiptChainVerifierPreview();
  assert.ok(isCanonicalBoundary(p.boundary));
  assert.ok(p.persona.primary_refusals.includes("modify_receipts"));
  assert.ok(p.persona.primary_refusals.includes("waive_chain_verification"));
});

test("SAT-4 EffectCap valid", () => {
  const cap = buildSATReceiptChainVerifierEffectCap();
  assert.equal(cap.valid, true);
  assert.ok(cap.blocked_effects.includes("modify_receipt"));
});

test("verifyReceiptChain · empty chain → trivially compliant", () => {
  const v = verifyReceiptChain({ receipts: [] });
  assert.equal(v.passed, true);
  assert.equal(v.verdict, "empty_chain");
  assert.equal(v.receipt_count, 0);
});

test("verifyReceiptChain · single genesis receipt with null prev → verified", () => {
  const v = verifyReceiptChain({
    receipts: [{ receipt_id: HASH_A, prev_hash: null }],
  });
  assert.equal(v.passed, true);
  assert.equal(v.verdict, "chain_verified");
});

test("verifyReceiptChain · single genesis with 'genesis' prev_hash → verified", () => {
  const v = verifyReceiptChain({
    receipts: [{ receipt_id: HASH_A, prev_hash: "genesis" }],
  });
  assert.equal(v.passed, true);
});

test("verifyReceiptChain · two correctly linked receipts → verified", () => {
  const v = verifyReceiptChain({
    receipts: [
      { receipt_id: HASH_A, prev_hash: null },
      { receipt_id: HASH_B, prev_hash: HASH_A },
    ],
  });
  assert.equal(v.passed, true);
  assert.equal(v.receipt_count, 2);
  assert.equal(v.link_results[1].links_to_previous, true);
});

test("verifyReceiptChain · prev_hash mismatch → violated", () => {
  const v = verifyReceiptChain({
    receipts: [
      { receipt_id: HASH_A, prev_hash: null },
      { receipt_id: HASH_B, prev_hash: HASH_C }, // should be HASH_A
    ],
  });
  assert.equal(v.passed, false);
  assert.ok(v.violations.some((vio) => vio.includes("prev_hash_mismatch")));
});

test("verifyReceiptChain · invalid hash format → violated", () => {
  const v = verifyReceiptChain({
    receipts: [{ receipt_id: "not-a-hash", prev_hash: null }],
  });
  assert.equal(v.passed, false);
  assert.ok(v.violations.some((vio) => vio.includes("invalid_hash_format")));
});

test("verifyReceiptChain · missing prev_hash on non-genesis → violated", () => {
  const v = verifyReceiptChain({
    receipts: [
      { receipt_id: HASH_A, prev_hash: null },
      { receipt_id: HASH_B }, // no prev_hash field
    ],
  });
  assert.equal(v.passed, false);
  assert.ok(v.violations.some((vio) => vio.includes("missing_prev_hash")));
});

test("verifyReceiptChain · receipt without any hash field → violated", () => {
  const v = verifyReceiptChain({
    receipts: [{ some_other_field: "value" }],
  });
  assert.equal(v.passed, false);
  assert.ok(v.violations.some((vio) => vio.includes("no_hash_field")));
});

test("verifyReceiptChain · accepts content_hash or candidate_hash as alternate hash field", () => {
  const v = verifyReceiptChain({
    receipts: [{ candidate_hash: HASH_A, prev_receipt_hash: null }],
  });
  assert.equal(v.passed, true);
});

test("Verdict deep-frozen + canonical boundary", () => {
  const v = verifyReceiptChain({ receipts: [] });
  assert.ok(Object.isFrozen(v));
  assert.ok(Object.isFrozen(v.violations));
  assert.ok(isCanonicalBoundary(v.boundary));
});

test("Summary + exports · kernel pre-configured", () => {
  const s = buildSATReceiptChainVerifierSummary();
  const k = buildSATReceiptChainVerifierKernel();
  assert.ok(JSON.stringify(s, null, 2).split("\n").length <= 40);
  assert.equal(k.agent_id, "sat-4-receipt-chain-verifier");
  assert.ok(Object.isFrozen(SAT_RECEIPT_CHAIN_VERIFIER_PERSONA));
});
