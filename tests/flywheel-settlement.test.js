// FLYWHEEL-1B · settlement bridge tests
//
// Minimal bridge for §19 step 10: one verified FLYWHEEL-1A receipt becomes one
// local-only IMPACT ledger entry. This is not a public token economy, not XP,
// not House of Wisdom, and not a full 17-step flywheel.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runOneTaskFlywheel,
  scoreEpistemicGrounding,
} from "../packages/flywheel/src/flywheel-one-task.js";
import {
  settleOneTaskFlywheelImpact,
  FLYWHEEL_SETTLEMENT_SCHEMA,
  IMPACT_AMOUNT_RULE_ID,
} from "../packages/flywheel/src/flywheel-settlement.js";
import { GUARDED_CLAIM_CONSENT_PHRASE } from "../packages/receipts/src/assumption-guarded-claim.js";
import {
  buildConsentProof,
  CONSENT_PROOF_SCHEMA,
} from "../packages/receipts/src/consent-proof.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import { generateEd25519Keypair } from "../packages/receipts/src/authorship-signature.js";

const ACTION_NOW = "2026-05-30T14:00:00.000Z";
const SETTLEMENT_NOW = "2026-05-30T14:01:00.000Z";
const CONSENT_EXPIRES = "2026-05-30T14:05:00.000Z";
const FIXED_NONCE = "facefeed".repeat(8);
const WRONG_TARGET = "f".repeat(64);

const A_ENVELOPE = Object.freeze({
  claim_state: "A",
  assumption: "Task X is complete.",
  ground: "tests/x.test.js passed 9/9.",
  boundary: "Invalid if x.test.js regresses.",
  rejectable: true,
});

async function freshHome() {
  return mkdtemp(join(tmpdir(), "dema-flywheel-settlement-"));
}

async function initKey(home) {
  const r = await initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE,
    demaHome: home,
  });
  assert.equal(r.initialized, true);
}

async function runFlywheel(home) {
  const r = await runOneTaskFlywheel({
    task: "ship FLYWHEEL-1B",
    envelope: A_ENVELOPE,
    consent: GUARDED_CLAIM_CONSENT_PHRASE,
    demaHome: home,
    now: ACTION_NOW,
  });
  assert.equal(r.completed, true);
  return r;
}

async function mintConsent(home, targetHash, overrides = {}) {
  const r = await buildConsentProof({
    phrase: "MINT LEDGER ENTRY",
    actionScope: {
      action_type: "MINT_LEDGER_ENTRY",
      target_hash: targetHash,
    },
    demaHome: home,
    nonce: overrides.nonce ?? FIXED_NONCE,
    createdAtIso: overrides.createdAtIso ?? SETTLEMENT_NOW,
    expiresAtIso: overrides.expiresAtIso ?? CONSENT_EXPIRES,
  });
  assert.equal(r.built, true);
  assert.equal(r.consent_proof.schema, CONSENT_PROOF_SCHEMA);
  return r;
}

describe("FLYWHEEL-1B · settleOneTaskFlywheelImpact", () => {
  it("happy: verified flywheel receipt + scoped consent -> one verified local IMPACT ledger entry", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const flywheel = await runFlywheel(home);
      const consent = await mintConsent(
        home,
        flywheel.flywheel_receipt.receipt_id,
      );

      const r = await settleOneTaskFlywheelImpact({
        flywheelReceipt: flywheel.flywheel_receipt,
        actionReceiptId: flywheel.action_receipt_id,
        consentProof: consent.consent_proof,
        operatorPubkeyPem: consent.signer_public_key_pem,
        demaHome: home,
        now: SETTLEMENT_NOW,
        createdAtIso: SETTLEMENT_NOW,
      });

      assert.equal(r.schema, FLYWHEEL_SETTLEMENT_SCHEMA);
      assert.equal(r.settled, true);
      assert.equal(r.truth_label, "LOCAL_FLYWHEEL_SETTLEMENT_BRIDGE_VERIFIED");
      assert.equal(r.amount_rule_id, IMPACT_AMOUNT_RULE_ID);
      assert.equal(r.settlement.amount, 60);
      assert.equal(r.settlement.flywheel_receipt_id, flywheel.flywheel_receipt.receipt_id);
      assert.equal(r.flywheel_replay.replayed, true);
      assert.equal(r.ledger_entry.entry_type, "IMPACT_CREDIT");
      assert.equal(r.ledger_entry.token_class, "IMPACT");
      assert.equal(r.ledger_entry.amount, 60);
      assert.deepEqual(r.ledger_entry.evidence_receipt_hashes, [
        flywheel.flywheel_receipt.receipt_id,
      ]);
      assert.equal(r.ledger_verification.verified, true);
      assert.equal(r.boundary.local_only, true);
      assert.equal(r.boundary.file_write_performed, false);
      assert.equal(r.boundary.network_used, false);
      assert.equal(r.boundary.federation_used, false);
      assert.equal(r.boundary.public_economic_claim_made, false);
      assert.equal(r.boundary.exchange_value_claimed, false);
      assert.equal(r.boundary.public_transfer_performed, false);
      assert.equal(r.boundary.private_key_loaded_for_local_signature, true);
      assert.ok(Object.isFrozen(r));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("links to a supplied previous ledger hash for non-genesis settlement", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const flywheel = await runFlywheel(home);
      const consent = await mintConsent(
        home,
        flywheel.flywheel_receipt.receipt_id,
      );
      const prevLedgerHash = "c".repeat(64);

      const r = await settleOneTaskFlywheelImpact({
        flywheelReceipt: flywheel.flywheel_receipt,
        actionReceiptId: flywheel.action_receipt_id,
        consentProof: consent.consent_proof,
        operatorPubkeyPem: consent.signer_public_key_pem,
        demaHome: home,
        now: SETTLEMENT_NOW,
        createdAtIso: SETTLEMENT_NOW,
        prevLedgerHash,
      });

      assert.equal(r.settled, true);
      assert.equal(r.ledger_entry.prev_hash, prevLedgerHash);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: forged flywheel score rejects before ledger entry build", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const flywheel = await runFlywheel(home);
      const consent = await mintConsent(
        home,
        flywheel.flywheel_receipt.receipt_id,
      );
      const forged = { ...flywheel.flywheel_receipt, score: 1.0 };

      const r = await settleOneTaskFlywheelImpact({
        flywheelReceipt: forged,
        actionReceiptId: flywheel.action_receipt_id,
        consentProof: consent.consent_proof,
        operatorPubkeyPem: consent.signer_public_key_pem,
        demaHome: home,
        now: SETTLEMENT_NOW,
        createdAtIso: SETTLEMENT_NOW,
      });

      assert.equal(r.settled, false);
      assert.equal(r.stage, "flywheel_replay");
      assert.equal(r.error, "score_rederivation_mismatch");
      assert.equal(r.ledger_entry, undefined);
      assert.equal(r.boundary.private_key_loaded_for_local_signature, false);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: missing consent proof rejects before ledger entry build", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const flywheel = await runFlywheel(home);

      const r = await settleOneTaskFlywheelImpact({
        flywheelReceipt: flywheel.flywheel_receipt,
        actionReceiptId: flywheel.action_receipt_id,
        operatorPubkeyPem: "-----BEGIN PUBLIC KEY-----\nmissing\n-----END PUBLIC KEY-----",
        demaHome: home,
        now: SETTLEMENT_NOW,
        createdAtIso: SETTLEMENT_NOW,
      });

      assert.equal(r.settled, false);
      assert.equal(r.stage, "consent");
      assert.equal(r.error, "consent_proof_missing_or_malformed");
      assert.equal(r.ledger_entry, undefined);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: consent proof for the wrong flywheel target is rejected", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const flywheel = await runFlywheel(home);
      const consent = await mintConsent(home, WRONG_TARGET);

      const r = await settleOneTaskFlywheelImpact({
        flywheelReceipt: flywheel.flywheel_receipt,
        actionReceiptId: flywheel.action_receipt_id,
        consentProof: consent.consent_proof,
        operatorPubkeyPem: consent.signer_public_key_pem,
        demaHome: home,
        now: SETTLEMENT_NOW,
        createdAtIso: SETTLEMENT_NOW,
      });

      assert.equal(r.settled, false);
      assert.equal(r.stage, "consent");
      assert.equal(r.error, "consent_scope_mismatch");
      assert.equal(r.ledger_entry, undefined);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: expired consent proof is rejected", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const flywheel = await runFlywheel(home);
      const consent = await mintConsent(home, flywheel.flywheel_receipt.receipt_id, {
        expiresAtIso: "2026-05-30T14:00:30.000Z",
      });

      const r = await settleOneTaskFlywheelImpact({
        flywheelReceipt: flywheel.flywheel_receipt,
        actionReceiptId: flywheel.action_receipt_id,
        consentProof: consent.consent_proof,
        operatorPubkeyPem: consent.signer_public_key_pem,
        demaHome: home,
        now: SETTLEMENT_NOW,
        createdAtIso: SETTLEMENT_NOW,
      });

      assert.equal(r.settled, false);
      assert.equal(r.stage, "consent");
      assert.equal(r.error, "consent_expired");
      assert.equal(r.ledger_entry, undefined);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: external public key mismatch rejects the consent proof", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const flywheel = await runFlywheel(home);
      const consent = await mintConsent(
        home,
        flywheel.flywheel_receipt.receipt_id,
      );
      const other = generateEd25519Keypair();

      const r = await settleOneTaskFlywheelImpact({
        flywheelReceipt: flywheel.flywheel_receipt,
        actionReceiptId: flywheel.action_receipt_id,
        consentProof: consent.consent_proof,
        operatorPubkeyPem: other.public_key_pem,
        demaHome: home,
        now: SETTLEMENT_NOW,
        createdAtIso: SETTLEMENT_NOW,
      });

      assert.equal(r.settled, false);
      assert.equal(r.stage, "consent");
      assert.equal(r.error, "consent_signature_invalid");
      assert.equal(r.ledger_entry, undefined);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: missing createdAtIso/now refuses nondeterministic settlement", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const flywheel = await runFlywheel(home);
      const consent = await mintConsent(
        home,
        flywheel.flywheel_receipt.receipt_id,
      );

      const r = await settleOneTaskFlywheelImpact({
        flywheelReceipt: flywheel.flywheel_receipt,
        actionReceiptId: flywheel.action_receipt_id,
        consentProof: consent.consent_proof,
        operatorPubkeyPem: consent.signer_public_key_pem,
        demaHome: home,
      });

      assert.equal(r.settled, false);
      assert.equal(r.stage, "input");
      assert.equal(r.error, "created_at_iso_required");
      assert.equal(r.ledger_entry, undefined);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("success envelope contains no public-economy or private-key material", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const flywheel = await runFlywheel(home);
      const consent = await mintConsent(
        home,
        flywheel.flywheel_receipt.receipt_id,
      );
      const r = await settleOneTaskFlywheelImpact({
        flywheelReceipt: flywheel.flywheel_receipt,
        actionReceiptId: flywheel.action_receipt_id,
        consentProof: consent.consent_proof,
        operatorPubkeyPem: consent.signer_public_key_pem,
        demaHome: home,
        now: SETTLEMENT_NOW,
      });

      const s = JSON.stringify(r);
      for (const forbidden of [
        "PRIVATE KEY",
        '"private_key":',
        '"private_key_pem":',
        '"exchange_value":',
        '"fiat_value":',
        '"public_mint":',
        '"market_price":',
        '"federation_target":',
        '"settlement_target":',
        '"transfer_target":',
        '"public_transfer":',
      ]) {
        assert.equal(s.includes(forbidden), false, forbidden);
      }
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
