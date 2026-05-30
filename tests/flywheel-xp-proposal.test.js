// FLYWHEEL-1D · agent XP grant proposal bridge tests
//
// §19 step-11 minimal vertebra: a replay-verified FLYWHEEL-1B/1C IMPACT_CREDIT
// ledger entry becomes one XP grant PROPOSAL — NOT a grant. The proposal is
// pure (no key, no consent, no file write) and is deliberately incomplete:
// it carries a null sat_validation_receipt_hash, so the existing AGENT-SKILL-1A
// kernel REFUSES to mint XP from it until SAT validation + operator approval
// exist. This test pins both the proposal shape AND that the XP gate holds.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runOneTaskFlywheel } from "../packages/flywheel/src/flywheel-one-task.js";
import { settleOneTaskFlywheelImpact } from "../packages/flywheel/src/flywheel-settlement.js";
import {
  proposeFlywheelXpGrant,
  FLYWHEEL_XP_PROPOSAL_SCHEMA,
  XP_FROM_IMPACT_RULE_ID,
} from "../packages/flywheel/src/flywheel-xp-proposal.js";
import { buildSkillLedger } from "../packages/agents/src/agent-skill-ledger.js";
import { buildLedgerEntry } from "../packages/econ/src/dual-token-ledger.js";
import { GUARDED_CLAIM_CONSENT_PHRASE } from "../packages/receipts/src/assumption-guarded-claim.js";
import { buildConsentProof } from "../packages/receipts/src/consent-proof.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";

const ACTION_NOW = "2026-05-30T16:00:00.000Z";
const SETTLE_NOW = "2026-05-30T16:01:00.000Z";
const PROPOSE_NOW = "2026-05-30T16:02:00.000Z";
const CONSENT_EXPIRES = "2026-05-30T16:10:00.000Z";

const A_ENVELOPE = Object.freeze({
  claim_state: "A",
  assumption: "Task X is complete.",
  ground: "tests/x.test.js passed 9/9.",
  boundary: "Invalid if x.test.js regresses.",
  rejectable: true,
});

async function freshHome() {
  return mkdtemp(join(tmpdir(), "dema-flywheel-xp-"));
}

async function initKey(home) {
  const r = await initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE,
    demaHome: home,
  });
  assert.equal(r.initialized, true);
}

async function settledImpact(home) {
  const flywheel = await runOneTaskFlywheel({
    task: "ship FLYWHEEL-1D",
    envelope: A_ENVELOPE,
    consent: GUARDED_CLAIM_CONSENT_PHRASE,
    demaHome: home,
    now: ACTION_NOW,
  });
  assert.equal(flywheel.completed, true);
  const consent = await buildConsentProof({
    phrase: "MINT LEDGER ENTRY",
    actionScope: {
      action_type: "MINT_LEDGER_ENTRY",
      target_hash: flywheel.flywheel_receipt.receipt_id,
    },
    demaHome: home,
    nonce: "1d1d1d1d".repeat(8),
    createdAtIso: SETTLE_NOW,
    expiresAtIso: CONSENT_EXPIRES,
  });
  assert.equal(consent.built, true);
  const settlement = await settleOneTaskFlywheelImpact({
    flywheelReceipt: flywheel.flywheel_receipt,
    actionReceiptId: flywheel.action_receipt_id,
    consentProof: consent.consent_proof,
    operatorPubkeyPem: consent.signer_public_key_pem,
    demaHome: home,
    now: SETTLE_NOW,
  });
  assert.equal(settlement.settled, true);
  return { settlement, pubkeyPem: consent.signer_public_key_pem };
}

describe("FLYWHEEL-1D · proposeFlywheelXpGrant", () => {
  it("happy: verified IMPACT_CREDIT entry -> PENDING XP proposal bound to its evidence hash", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const { settlement, pubkeyPem } = await settledImpact(home);
      const entry = settlement.ledger_entry;

      const r = proposeFlywheelXpGrant({
        ledgerEntry: entry,
        operatorPubkeyPem: pubkeyPem,
        skillId: "proof_engineering",
        agentId: "builder",
        createdAtIso: PROPOSE_NOW,
      });

      assert.equal(r.schema, FLYWHEEL_XP_PROPOSAL_SCHEMA);
      assert.equal(r.proposed, true);
      assert.equal(r.status, "PENDING_SAT_VALIDATION");
      assert.equal(r.truth_label, "LOCAL_FLYWHEEL_XP_PROPOSAL_PENDING_SAT");
      assert.equal(r.xp_rule_id, XP_FROM_IMPACT_RULE_ID);
      // 1:1 impact-amount -> XP (entry.amount === 60 for an A-state task)
      assert.equal(r.proposed_skill_grant.xp_amount, entry.amount);
      assert.equal(r.proposed_skill_grant.skill_id, "proof_engineering");
      assert.equal(
        r.proposed_skill_grant.evidence_impact_receipt_hash,
        entry.entry_hash,
      );
      // The gap that keeps this a proposal, not a grant:
      assert.equal(r.proposed_skill_grant.sat_validation_receipt_hash, null);
      assert.equal(r.agent_id, "builder");
      assert.equal(r.boundary.xp_granted, false);
      assert.equal(r.boundary.file_write_performed, false);
      assert.equal(r.boundary.network_used, false);
      assert.equal(r.boundary.public_economic_claim_made, false);
      assert.equal(r.boundary.consent_required, false);
      assert.ok(Object.isFrozen(r));
      assert.ok(Object.isFrozen(r.proposed_skill_grant));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("THE GATE HOLDS: feeding the proposal's grant to buildSkillLedger refuses to mint XP", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const { settlement, pubkeyPem } = await settledImpact(home);

      const proposal = proposeFlywheelXpGrant({
        ledgerEntry: settlement.ledger_entry,
        operatorPubkeyPem: pubkeyPem,
        skillId: "proof_engineering",
        agentId: "builder",
        createdAtIso: PROPOSE_NOW,
      });
      assert.equal(proposal.proposed, true);

      // Try to mint XP directly from the proposal — the existing AGENT-SKILL-1A
      // gate must reject because sat_validation_receipt_hash is null.
      const minted = await buildSkillLedger({
        agent_id: proposal.agent_id,
        skill_grants: [proposal.proposed_skill_grant],
        consentProof: {}, // structural gate fires before consent verification
        demaHome: home,
        createdAtIso: PROPOSE_NOW,
      });
      assert.equal(minted.built, false);
      assert.equal(minted.error, "reward_without_validation");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: tampered impact entry (forged amount) is rejected before proposal", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const { settlement, pubkeyPem } = await settledImpact(home);
      const forged = { ...settlement.ledger_entry, amount: 999 };

      const r = proposeFlywheelXpGrant({
        ledgerEntry: forged,
        operatorPubkeyPem: pubkeyPem,
        skillId: "proof_engineering",
        agentId: "builder",
        createdAtIso: PROPOSE_NOW,
      });

      assert.equal(r.proposed, false);
      assert.equal(r.stage, "impact_verify");
      assert.equal(r.error, "impact_entry_unverified");
      assert.equal(r.proposed_skill_grant, undefined);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: a genuinely-signed RESOURCE_DEBIT entry is not an impact credit", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      // Build a REAL signed RESOURCE_DEBIT entry so verification passes and the
      // not_an_impact_credit guard is the thing that rejects (not the signature).
      const cp = await buildConsentProof({
        phrase: "MINT LEDGER ENTRY",
        actionScope: {
          action_type: "MINT_LEDGER_ENTRY",
          target_hash: "f".repeat(64),
        },
        demaHome: home,
        nonce: "resource0".repeat(8).slice(0, 64),
        createdAtIso: SETTLE_NOW,
        expiresAtIso: CONSENT_EXPIRES,
      });
      assert.equal(cp.built, true);
      const resourceEntry = await buildLedgerEntry({
        entry_type: "RESOURCE_DEBIT",
        token_class: "RESOURCE",
        amount: 5,
        evidence_receipt_hashes: ["a".repeat(64)],
        prev_hash: null,
        consentProof: cp.consent_proof,
        demaHome: home,
        createdAtIso: SETTLE_NOW,
      });
      assert.equal(resourceEntry.error, undefined);

      const r = proposeFlywheelXpGrant({
        ledgerEntry: resourceEntry,
        operatorPubkeyPem: cp.signer_public_key_pem,
        skillId: "proof_engineering",
        agentId: "builder",
        createdAtIso: PROPOSE_NOW,
      });
      assert.equal(r.proposed, false);
      assert.equal(r.stage, "impact_verify");
      assert.equal(r.error, "not_an_impact_credit");
      assert.equal(r.proposed_skill_grant, undefined);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: missing createdAtIso refuses nondeterministic proposal", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const { settlement, pubkeyPem } = await settledImpact(home);
      const r = proposeFlywheelXpGrant({
        ledgerEntry: settlement.ledger_entry,
        operatorPubkeyPem: pubkeyPem,
        skillId: "proof_engineering",
        agentId: "builder",
      });
      assert.equal(r.proposed, false);
      assert.equal(r.stage, "input");
      assert.equal(r.error, "created_at_iso_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: missing skillId / agentId is rejected", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const { settlement, pubkeyPem } = await settledImpact(home);
      const noSkill = proposeFlywheelXpGrant({
        ledgerEntry: settlement.ledger_entry,
        operatorPubkeyPem: pubkeyPem,
        agentId: "builder",
        createdAtIso: PROPOSE_NOW,
      });
      assert.equal(noSkill.proposed, false);
      assert.equal(noSkill.error, "skill_id_required");

      const noAgent = proposeFlywheelXpGrant({
        ledgerEntry: settlement.ledger_entry,
        operatorPubkeyPem: pubkeyPem,
        skillId: "proof_engineering",
        createdAtIso: PROPOSE_NOW,
      });
      assert.equal(noAgent.proposed, false);
      assert.equal(noAgent.error, "agent_id_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("proposal envelope contains no public-economy or private-key material", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const { settlement, pubkeyPem } = await settledImpact(home);
      const r = proposeFlywheelXpGrant({
        ledgerEntry: settlement.ledger_entry,
        operatorPubkeyPem: pubkeyPem,
        skillId: "proof_engineering",
        agentId: "builder",
        createdAtIso: PROPOSE_NOW,
      });
      assert.equal(r.proposed, true);
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
        '"public_transfer":',
      ]) {
        assert.equal(s.includes(forbidden), false, forbidden);
      }
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
