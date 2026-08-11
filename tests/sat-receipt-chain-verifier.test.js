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
import { shapeReceiptCandidate } from "../packages/core/src/pat-receipt-recorder.js";
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

test("verifyReceiptChain · empty chain → UNKNOWN, never proof", () => {
  const v = verifyReceiptChain({ receipts: [] });
  assert.equal(v.passed, false);
  assert.equal(v.verdict, "empty_chain");
  assert.equal(v.receipt_count, 0);
  assert.equal(v.truth_label, "UNKNOWN");
  assert.equal(v.receipt_shape_ready, false);
  assert.deepEqual(v.violations, ["chain_is_empty_no_proof"]);
});

test("verifyReceiptChain · semantically empty input → UNKNOWN", () => {
  const v = verifyReceiptChain({ receipts: [null, undefined, "not-a-receipt"] });
  assert.equal(v.passed, false);
  assert.equal(v.verdict, "empty_chain");
  assert.equal(v.receipt_count, 0);
  assert.equal(v.truth_label, "UNKNOWN");
  assert.equal(v.receipt_shape_ready, false);
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

test("verifyReceiptChain · reordered chain → violated", () => {
  // Negative control pair: these exact receipts in correct order are verified
  // by "two correctly linked receipts → verified" above. Reversal must fail.
  const v = verifyReceiptChain({
    receipts: [
      { receipt_id: HASH_B, prev_hash: HASH_A },
      { receipt_id: HASH_A, prev_hash: null },
    ],
  });
  assert.equal(v.passed, false);
  assert.equal(v.truth_label, "CHAIN_VIOLATION");
  assert.ok(v.violations.length > 0);
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

// ── NAMESPACE TRAP · pinned, not fixed ──────────────────────────────────────
// Every fixture above uses this verifier's OWN vocabulary: bare 64-hex ids and
// `prev_hash` / `prev_receipt_hash`. The chain the estate actually writes
// (scripts/node0-mumu-loop.mjs → receipts/receipt-chain.v0.1.jsonl) uses
// 16-hex `receipt_id` and `previous_receipt_hash` with a `sha256:` prefix.
//
// Measured 2026-08-10 against the real 11-link chain in DEMA_HOME: this
// verifier returns chain_violated, while `verifyReplay` in
// scripts/node0-mumu-replay.mjs returns ok:true with zero tamper on the same
// bytes. The chain is sound; the reader is looking for different field names.
//
// These two tests pin BOTH directions of the failure. They assert current
// behaviour and take no position on which surface is authoritative — that is
// an operator ruling, not a test's call. They exist so that whoever wires
// receipt_per_transition does not mistake a false red for a real violation.
test("verifyReceiptChain · MISREADS the estate's own chain shape (false red)", () => {
  // Verbatim shape of the on-disk chain, minus payload fields.
  const v = verifyReceiptChain({
    receipts: [
      { receipt_id: "3877b7f1268f8ba9", previous_receipt_hash: null },
      {
        receipt_id: "3374416cf0c63ad9",
        previous_receipt_hash:
          "sha256:e495472d73e9049dbe22c9cad0791d2bb76694980b8d2417672cc73f5e038f0a",
      },
    ],
  });
  assert.equal(v.passed, false, "a sound chain is reported violated");
  assert.ok(v.violations.some((x) => x.includes("invalid_hash_format")));
  // The sharpest part: link 1 DOES carry a predecessor hash on disk, and this
  // verifier reports it missing, because it never reads that field name.
  assert.ok(
    v.violations.some((x) => x.includes("missing_prev_hash_for_non_genesis_receipt")),
  );
});

test("verifyReceiptChain · empty chain refuses (false green closed)", () => {
  // The mirror hazard this test once PINNED — point the verifier at nothing
  // and get a green — is now structurally closed: an empty chain refuses with
  // UNKNOWN (NO_VACUOUS_PROOF, landed via PR #456). Adapters no longer need to
  // rule out the empty case themselves, but `verifyReplay`'s explicit
  // `receipts.length > 0` remains correct defence in depth.
  const v = verifyReceiptChain({ receipts: [] });
  assert.equal(v.passed, false);
  assert.equal(v.truth_label, "UNKNOWN");
});

// ── PAT → SAT SEAM · the boundary this verifier actually serves ─────────────
// Until now pat-receipt-recorder and sat-receipt-chain-verifier were each
// tested alone: 2 test files for the producer, 1 for the verifier, none
// importing both. That gap is structural, not incidental — it is exactly how
// the mumu-chain drift above went unnoticed. A producer and a verifier that
// never meet in a test can drift apart field by field and stay green.
//
// This binds them. It is the one seam the repo's own PAT/SAT separation rule
// treats as load-bearing, so it should fail loudly if either side renames a
// field, changes hash width, or adds a prefix.
test("PAT-6 → SAT-4 seam · a recorded chain verifies end to end", () => {
  const a = shapeReceiptCandidate({ event_schema: "seam.a", prev_receipt_hash: null });
  const b = shapeReceiptCandidate({
    event_schema: "seam.b",
    prev_receipt_hash: a.candidate_hash,
  });

  const v = verifyReceiptChain({ receipts: [a, b] });
  assert.equal(v.verdict, "chain_verified");
  assert.equal(v.passed, true);
  assert.deepEqual([...v.violations], []);
});

test("PAT-6 → SAT-4 seam · the producer's field names are ones the verifier reads", () => {
  // Named explicitly so a rename on either side fails here with a readable
  // reason rather than as a mystery chain_violated.
  const r = shapeReceiptCandidate({ event_schema: "seam.fields" });
  assert.equal(typeof r.candidate_hash, "string", "producer must emit candidate_hash");
  assert.match(r.candidate_hash, /^[a-f0-9]{64}$/, "bare 64-hex, no sha256: prefix");
  assert.ok("prev_receipt_hash" in r, "producer must emit prev_receipt_hash");
});

test("Summary + exports · kernel pre-configured", () => {
  const s = buildSATReceiptChainVerifierSummary();
  const k = buildSATReceiptChainVerifierKernel();
  assert.ok(JSON.stringify(s, null, 2).split("\n").length <= 40);
  assert.equal(k.agent_id, "sat-4-receipt-chain-verifier");
  assert.ok(Object.isFrozen(SAT_RECEIPT_CHAIN_VERIFIER_PERSONA));
});
