import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PROOF_SPINE_GUARD_SCHEMA,
  PROOF_SPINE_REASON_CODES,
  validateProofSpineGuard,
} from "../packages/receipts/src/proof-spine-guard.js";
import {
  PROOF_SPINE_LCC_GUARD_SCHEMA,
  auditProofSpineLayers,
} from "../packages/core/src/proof-spine-lcc-guard.js";
import { loadExampleGLadderLayerIndexInput } from "../scripts/g-ladder-layer-index-mock.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

test("validateProofSpineGuard surfaces all four 1A reason codes for the substrate special case", () => {
  const result = validateProofSpineGuard({
    genesis_receipt: {},
    signature: "",
    decision: "QUARANTINED",
    fresh_state_ed25519: null,
  });

  assert.equal(result.allowed_to_advance, false);
  assert.equal(result.allowed_to_settle, false);
  assert.equal(result.refusal_receipt_allowed, true);
  assert.deepEqual(result.reason_codes, [
    PROOF_SPINE_REASON_CODES.GENESIS_RECEIPT_EMPTY,
    PROOF_SPINE_REASON_CODES.LEDGER_SIGNATURE_EMPTY,
    PROOF_SPINE_REASON_CODES.PULSE_QUARANTINED_NO_SETTLEMENT,
    PROOF_SPINE_REASON_CODES.FRESH_STATE_RECEIPT_UNSIGNED,
  ]);
});

test("validateProofSpineGuard allows healthy signed advance state", () => {
  const result = validateProofSpineGuard({
    genesis_receipt: { seed: "node0" },
    signature: "dGVzdA==",
    decision: "APPROVED",
    fresh_state_ed25519: "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA\n-----END PUBLIC KEY-----",
  });

  assert.equal(result.allowed_to_advance, true);
  assert.equal(result.allowed_to_settle, true);
  assert.equal(result.refusal_receipt_allowed, false);
  assert.deepEqual(result.reason_codes, []);
});

test("validateProofSpineGuard honors UNSIGNED_DEV_ONLY for fresh-state receipts", () => {
  const result = validateProofSpineGuard({
    genesis_receipt: { seed: "node0" },
    signature: "dGVzdA==",
    decision: "APPROVED",
    fresh_state_ed25519: null,
    signature_status: "UNSIGNED_DEV_ONLY",
  });

  assert.equal(result.allowed_to_advance, true);
  assert.notEqual(
    result.reason_codes.includes(
      PROOF_SPINE_REASON_CODES.FRESH_STATE_RECEIPT_UNSIGNED,
    ),
    true,
  );
});

test("validateProofSpineGuard marks signed refusal receipts as valid proof but non-settling", () => {
  const result = validateProofSpineGuard({
    genesis_receipt: { refusal: true },
    signature: "dGVzdA==",
    decision: "REJECTED",
    fresh_state_ed25519: "pk",
    receipt_kind: "refusal",
  });

  assert.equal(result.allowed_to_advance, false);
  assert.equal(result.allowed_to_settle, false);
  assert.equal(result.refusal_receipt_allowed, true);
  assert.ok(
    result.reason_codes.includes(
      PROOF_SPINE_REASON_CODES.PULSE_QUARANTINED_NO_SETTLEMENT,
    ),
  );
});

test("auditProofSpineLayers passes the canonical G-ladder layer manifest against delivery-check", async () => {
  const deliveryCheckSource = await readFile(
    join(repoRoot, "scripts/delivery-check.mjs"),
    "utf8",
  );
  const report = auditProofSpineLayers({
    root: repoRoot,
    layers: loadExampleGLadderLayerIndexInput().layers,
    deliveryCheckSource,
    exists: (path) => existsSync(path),
  });

  assert.equal(report.schema, PROOF_SPINE_LCC_GUARD_SCHEMA);
  assert.equal(report.ok, true);
  assert.equal(report.layer_count, 6);
  assert.deepEqual(report.findings, []);
});

test("auditProofSpineLayers fails closed on missing boundary files and delivery markers", () => {
  const report = auditProofSpineLayers({
    root: repoRoot,
    layers: [
      {
        layer_id: "broken-layer",
        boundary_ref: "docs/missing-proof-spine-layer.md",
        test_scaffold_ref: "tests/missing-proof-spine-layer.test.js",
        mock_ref: "tests/missing-proof-spine-layer-mock.test.js",
        delivery_check_marker: "ADR-999 missing marker integrated: PASS",
        claim_map_status: "PUBLIC_CLAIM",
      },
    ],
    deliveryCheckSource: "ADR-028 atomic impact receipt lifecycle mock integrated: PASS",
    exists: () => false,
  });

  assert.equal(report.ok, false);
  assert.ok(report.findings.length >= 4);
  assert.ok(
    report.findings.some((finding) => finding.code === "missing_file"),
  );
  assert.ok(
    report.findings.some(
      (finding) => finding.code === "marker_not_in_delivery_check",
    ),
  );
  assert.ok(
    report.findings.some(
      (finding) => finding.code === "invalid_claim_map_status",
    ),
  );
});

test("proof-spine guard schemas are stable identifiers", () => {
  assert.equal(
    PROOF_SPINE_GUARD_SCHEMA,
    "bizra.dema.proof_spine_guard.v0.1",
  );
  assert.equal(
    PROOF_SPINE_LCC_GUARD_SCHEMA,
    "bizra.dema.proof_spine_lcc_guard.v0.1",
  );
});
