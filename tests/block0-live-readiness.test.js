import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateKeyPairSync } from "node:crypto";

import {
  BLOCK0_LIVE_READINESS_SCHEMA,
  assessBlock0LiveReadiness,
} from "../packages/genesis/src/block0-live-readiness.js";

// BLOCK0-LIVE-READINESS · read-only seal-ceremony precheck tests.
//
// The honest finding this kernel encodes: a Block0 seal is intrinsically a
// signing ceremony. 11 of 12 prerequisite slots require the operator's PRIVATE
// Ed25519 key to PRODUCE their signed proof; only `poi_rule` is verifier-only.
// This assessor never loads the private key, never signs, never persists, never
// seals — it reports what the ceremony will require from the live home.

function operatorPubkeyPem() {
  const { publicKey } = generateKeyPairSync("ed25519");
  return publicKey.export({ type: "spki", format: "pem" });
}

const SIGNING_SLOTS = [
  "node0_identity",
  "urp_resource_status",
  "dema_realm_state",
  "performance_baseline",
  "house_of_wisdom_first_lesson",
  "pat_profile",
  "sat_profile",
  "canonical_receipt_ledger_root",
  "genesis_local_token_ledger_root",
  "keyconsent_integration",
  "full_flywheel_run",
];

test("BLOCK0_LIVE_READINESS_SCHEMA is the versioned schema id", () => {
  assert.equal(
    BLOCK0_LIVE_READINESS_SCHEMA,
    "bizra.dema.block0_live_readiness.v0.1",
  );
});

test("with operator pubkey: poi_rule verifiable now, 11 slots need signing", async () => {
  const report = await assessBlock0LiveReadiness({
    operatorPubkeyPem: operatorPubkeyPem(),
  });
  assert.ok(Object.isFrozen(report));
  assert.equal(report.schema, BLOCK0_LIVE_READINESS_SCHEMA);
  assert.equal(report.operator_pubkey_present, true);
  assert.equal(report.poi_rule_verifiable, true);
  assert.equal(report.slots.poi_rule.status, "VERIFIABLE_NOW");
  assert.equal(report.slots.poi_rule.needs_private_key, false);
  // every other slot requires the operator's private key (a signing ceremony).
  for (const slot of SIGNING_SLOTS) {
    assert.equal(report.slots[slot].status, "NEEDS_OPERATOR_SIGNING");
    assert.equal(report.slots[slot].needs_private_key, true);
  }
  assert.equal(report.needs_operator_signing_count, 11);
  assert.equal(report.ceremony_required, true);
  assert.deepEqual(report.read_only_verifiable_slots, ["poi_rule"]);
});

test("boundary is read-only: no private key, no sign, no persist, no seal", async () => {
  const report = await assessBlock0LiveReadiness({
    operatorPubkeyPem: operatorPubkeyPem(),
  });
  assert.ok(Object.isFrozen(report.boundary));
  assert.equal(report.boundary.read_only, true);
  assert.equal(report.boundary.private_key_loaded, false);
  assert.equal(report.boundary.proofs_produced, false);
  assert.equal(report.boundary.manifest_signed, false);
  assert.equal(report.boundary.block0_sealed, false);
  assert.equal(report.boundary.network_used, false);
});

test("no operator pubkey (empty home, none provided): pubkey absent, poi_rule not verifiable", async () => {
  const home = mkdtempSync(join(tmpdir(), "dema-live-readiness-"));
  try {
    const report = await assessBlock0LiveReadiness({ demaHome: home });
    assert.equal(report.operator_pubkey_present, false);
    assert.equal(report.poi_rule_verifiable, false);
    assert.equal(report.slots.poi_rule.status, "ABSENT_OR_DRIFTED");
    // signing slots still classified as needing the operator's key.
    assert.equal(report.needs_operator_signing_count, 11);
    assert.equal(report.ceremony_required, true);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("poi_rule version drift → not verifiable (honest drift detection)", async () => {
  const report = await assessBlock0LiveReadiness({
    operatorPubkeyPem: operatorPubkeyPem(),
    poiRuleVersion: "9.9.9",
  });
  assert.equal(report.operator_pubkey_present, true);
  assert.equal(report.poi_rule_verifiable, false);
  assert.equal(report.slots.poi_rule.status, "ABSENT_OR_DRIFTED");
});
