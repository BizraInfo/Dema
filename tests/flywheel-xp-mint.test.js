// FLYWHEEL-1E · operator-approved XP mint bridge tests.
//
// Minimal §19 step-11 closure: FLYWHEEL-1D proposes XP, SAT-VALIDATE-1A
// validates it, and this bridge supplies the operator-approved composition into
// AGENT-SKILL-1A. It builds a signed skill ledger, but does not persist it.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runOneTaskFlywheel } from "../packages/flywheel/src/flywheel-one-task.js";
import { settleOneTaskFlywheelImpact } from "../packages/flywheel/src/flywheel-settlement.js";
import { proposeFlywheelXpGrant } from "../packages/flywheel/src/flywheel-xp-proposal.js";
import { validateXpGrantProposal } from "../packages/flywheel/src/flywheel-sat-validation.js";
import {
  buildFlywheelXpMintConsentScope,
  mintFlywheelXpGrant,
  FLYWHEEL_XP_MINT_SCHEMA,
} from "../packages/flywheel/src/flywheel-xp-mint.js";
import { verifySkillLedger } from "../packages/agents/src/agent-skill-ledger.js";
import { GUARDED_CLAIM_CONSENT_PHRASE } from "../packages/receipts/src/assumption-guarded-claim.js";
import { buildConsentProof } from "../packages/receipts/src/consent-proof.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";

const SUBJECT = "pat.builder";
const VALIDATOR = "sat.economist";
const ACTION_NOW = "2026-05-31T06:00:00.000Z";
const SETTLE_NOW = "2026-05-31T06:01:00.000Z";
const VALIDATE_NOW = "2026-05-31T06:02:00.000Z";
const MINT_NOW = "2026-05-31T06:03:00.000Z";
const EXPIRES = "2026-05-31T06:20:00.000Z";

const A_ENVELOPE = Object.freeze({
  claim_state: "A",
  assumption: "Task X is complete.",
  ground: "tests/x.test.js passed 9/9.",
  boundary: "Invalid if x.test.js regresses.",
  rejectable: true,
});

async function freshHome() {
  return mkdtemp(join(tmpdir(), "dema-flywheel-xp-mint-"));
}

async function initKey(home) {
  const r = await initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE,
    demaHome: home,
  });
  assert.equal(r.initialized, true);
}

async function buildReadyContext(home) {
  const flywheel = await runOneTaskFlywheel({
    task: "ship FLYWHEEL-1E",
    envelope: A_ENVELOPE,
    consent: GUARDED_CLAIM_CONSENT_PHRASE,
    demaHome: home,
    now: ACTION_NOW,
  });
  assert.equal(flywheel.completed, true);

  const settleConsent = await buildConsentProof({
    phrase: "MINT LEDGER ENTRY",
    actionScope: {
      action_type: "MINT_LEDGER_ENTRY",
      target_hash: flywheel.flywheel_receipt.receipt_id,
    },
    demaHome: home,
    nonce: "1e000001".repeat(8),
    createdAtIso: SETTLE_NOW,
    expiresAtIso: EXPIRES,
  });
  assert.equal(settleConsent.built, true);

  const settlement = await settleOneTaskFlywheelImpact({
    flywheelReceipt: flywheel.flywheel_receipt,
    actionReceiptId: flywheel.action_receipt_id,
    consentProof: settleConsent.consent_proof,
    operatorPubkeyPem: settleConsent.signer_public_key_pem,
    demaHome: home,
    now: SETTLE_NOW,
    prevLedgerHash: null,
  });
  assert.equal(settlement.settled, true);

  const proposal = proposeFlywheelXpGrant({
    ledgerEntry: settlement.ledger_entry,
    operatorPubkeyPem: settleConsent.signer_public_key_pem,
    skillId: "proof_engineering",
    agentId: SUBJECT,
    createdAtIso: VALIDATE_NOW,
  });
  assert.equal(proposal.proposed, true);

  const sat = await validateXpGrantProposal({
    proposal,
    ledgerEntry: settlement.ledger_entry,
    validatorAgentId: VALIDATOR,
    operatorPubkeyPem: settleConsent.signer_public_key_pem,
    demaHome: home,
    createdAtIso: VALIDATE_NOW,
  });
  assert.equal(sat.validated, true);

  return {
    ledgerEntry: settlement.ledger_entry,
    proposal,
    satReceipt: sat.receipt,
    pubkeyPem: settleConsent.signer_public_key_pem,
  };
}

async function buildMintConsent(home, context, overrides = {}) {
  const scope = await buildFlywheelXpMintConsentScope({
    proposal: context.proposal,
    ledgerEntry: context.ledgerEntry,
    satValidationReceipt: context.satReceipt,
    operatorPubkeyPem: context.pubkeyPem,
    demaHome: home,
    createdAtIso: MINT_NOW,
  });
  assert.equal(scope.built, true, scope.error);

  const consent = await buildConsentProof({
    phrase: "SIGN AUTHORSHIP RECEIPT",
    actionScope:
      overrides.actionScope ||
      scope.action_scope,
    demaHome: home,
    nonce: overrides.nonce || "1e000002".repeat(8),
    createdAtIso: MINT_NOW,
    expiresAtIso: EXPIRES,
  });
  assert.equal(consent.built, true);
  return consent.consent_proof;
}

describe("FLYWHEEL-1E · mintFlywheelXpGrant", () => {
  it("happy: SAT-validated proposal + scoped consent builds a verified skill ledger", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const context = await buildReadyContext(home);
      const consentProof = await buildMintConsent(home, context);

      const r = await mintFlywheelXpGrant({
        proposal: context.proposal,
        ledgerEntry: context.ledgerEntry,
        satValidationReceipt: context.satReceipt,
        operatorPubkeyPem: context.pubkeyPem,
        consentProof,
        demaHome: home,
        createdAtIso: MINT_NOW,
      });

      assert.equal(r.schema, FLYWHEEL_XP_MINT_SCHEMA);
      assert.equal(r.minted, true, r.error);
      assert.equal(r.truth_label, "LOCAL_FLYWHEEL_XP_MINT_BRIDGE_VERIFIED");
      assert.equal(r.agent_id, SUBJECT);
      assert.equal(r.skill_ledger.agent_id, SUBJECT);
      assert.equal(r.skill_ledger.xp_total, context.ledgerEntry.amount);
      assert.equal(r.skill_ledger_verification.verified, true);
      assert.equal(r.boundary.file_write_performed, false);
      assert.equal(r.boundary.xp_ledger_built, true);
      assert.equal(r.boundary.public_economic_claim_made, false);

      const verified = verifySkillLedger({
        ledger: r.skill_ledger,
        impactReceipts: r.impact_receipts,
        satValidations: [context.satReceipt],
        pubkeyPem: context.pubkeyPem,
      });
      assert.equal(verified.verified, true, verified.reason);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: missing operator consent refuses the XP ledger build", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const context = await buildReadyContext(home);
      const r = await mintFlywheelXpGrant({
        proposal: context.proposal,
        ledgerEntry: context.ledgerEntry,
        satValidationReceipt: context.satReceipt,
        operatorPubkeyPem: context.pubkeyPem,
        demaHome: home,
        createdAtIso: MINT_NOW,
      });
      assert.equal(r.minted, false);
      assert.equal(r.stage, "skill_ledger");
      assert.equal(r.error, "consent_proof_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: wrong consent scope does not mint XP", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const context = await buildReadyContext(home);
      const consentProof = await buildMintConsent(home, context, {
        actionScope: {
          action_type: "MUTATE_AGENT_PROFILE",
          target_hash: "0".repeat(64),
        },
      });
      const r = await mintFlywheelXpGrant({
        proposal: context.proposal,
        ledgerEntry: context.ledgerEntry,
        satValidationReceipt: context.satReceipt,
        operatorPubkeyPem: context.pubkeyPem,
        consentProof,
        demaHome: home,
        createdAtIso: MINT_NOW,
      });
      assert.equal(r.minted, false);
      assert.equal(r.stage, "skill_ledger");
      assert.equal(r.error, "consent_scope_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: SAT validation must be bound to the same subject agent", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const context = await buildReadyContext(home);
      const badSat = {
        ...context.satReceipt,
        subject_agent_id: "pat.teacher",
      };
      const r = await mintFlywheelXpGrant({
        proposal: context.proposal,
        ledgerEntry: context.ledgerEntry,
        satValidationReceipt: badSat,
        operatorPubkeyPem: context.pubkeyPem,
        consentProof: {},
        demaHome: home,
        createdAtIso: MINT_NOW,
      });
      assert.equal(r.minted, false);
      assert.equal(r.stage, "xp_context");
      assert.equal(r.error, "sat_validation_unverified");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: tampered impact entry is rejected before consent is considered", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const context = await buildReadyContext(home);
      const r = await mintFlywheelXpGrant({
        proposal: context.proposal,
        ledgerEntry: { ...context.ledgerEntry, amount: 999 },
        satValidationReceipt: context.satReceipt,
        operatorPubkeyPem: context.pubkeyPem,
        consentProof: {},
        demaHome: home,
        createdAtIso: MINT_NOW,
      });
      assert.equal(r.minted, false);
      assert.equal(r.stage, "xp_context");
      assert.equal(r.error, "impact_entry_unverified");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("success envelope contains no private key or public economy material", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const context = await buildReadyContext(home);
      const consentProof = await buildMintConsent(home, context);
      const r = await mintFlywheelXpGrant({
        proposal: context.proposal,
        ledgerEntry: context.ledgerEntry,
        satValidationReceipt: context.satReceipt,
        operatorPubkeyPem: context.pubkeyPem,
        consentProof,
        demaHome: home,
        createdAtIso: MINT_NOW,
      });
      assert.equal(r.minted, true);
      const s = JSON.stringify(r);
      for (const forbidden of [
        "PRIVATE KEY",
        '"private_key":',
        '"private_key_pem":',
        '"exchange_value":',
        '"fiat_value":',
        '"public_mint":',
        '"market_price":',
        '"public_transfer":',
      ]) {
        assert.equal(s.includes(forbidden), false, forbidden);
      }
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
