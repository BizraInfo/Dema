// SAT-VALIDATE-1A · SAT validation receipt for an XP grant proposal.
//
// §19 step-11 closing vertebra. A FLYWHEEL-1D proposal is PENDING because the
// AGENT-SKILL-1A gate refuses to mint XP without a sat_validation_receipt_hash.
// This kernel produces that hash: a SAT-5 agent (Verifier/Compliance/Resource/
// Economist/Evolution) re-derives the XP from the impact entry, enforces the
// §11 "no self-verification" law, and emits one signed SAT validation receipt
// whose content hash is exactly what buildSkillLedger needs.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runOneTaskFlywheel } from "../packages/flywheel/src/flywheel-one-task.js";
import { settleOneTaskFlywheelImpact } from "../packages/flywheel/src/flywheel-settlement.js";
import { proposeFlywheelXpGrant } from "../packages/flywheel/src/flywheel-xp-proposal.js";
import {
  validateXpGrantProposal,
  verifySatValidationReceipt,
  SAT_VALIDATION_RECEIPT_SCHEMA,
} from "../packages/flywheel/src/flywheel-sat-validation.js";
import { buildSkillLedger } from "../packages/agents/src/agent-skill-ledger.js";
import { GUARDED_CLAIM_CONSENT_PHRASE } from "../packages/receipts/src/assumption-guarded-claim.js";
import { buildConsentProof } from "../packages/receipts/src/consent-proof.js";
import { generateEd25519Keypair } from "../packages/receipts/src/authorship-signature.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";

const VALIDATOR = "sat.economist";
const SUBJECT = "pat.builder";
const VALIDATE_NOW = "2026-05-30T17:00:00.000Z";
const CONSENT_EXPIRES = "2026-05-30T17:30:00.000Z";

const A_ENVELOPE = Object.freeze({
  claim_state: "A",
  assumption: "Task X is complete.",
  ground: "tests/x.test.js passed 9/9.",
  boundary: "Invalid if x.test.js regresses.",
  rejectable: true,
});

async function freshHome() {
  return mkdtemp(join(tmpdir(), "dema-sat-validate-"));
}

async function initKey(home) {
  const r = await initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE,
    demaHome: home,
  });
  assert.equal(r.initialized, true);
}

// Produce a verified IMPACT entry + a PENDING XP proposal bound to it.
async function proposeFor(
  home,
  { actionNow, settleNow, nonce, subject = SUBJECT },
) {
  const flywheel = await runOneTaskFlywheel({
    task: "ship SAT-VALIDATE-1A",
    envelope: A_ENVELOPE,
    consent: GUARDED_CLAIM_CONSENT_PHRASE,
    demaHome: home,
    now: actionNow,
  });
  assert.equal(flywheel.completed, true);
  const consent = await buildConsentProof({
    phrase: "MINT LEDGER ENTRY",
    actionScope: {
      action_type: "MINT_LEDGER_ENTRY",
      target_hash: flywheel.flywheel_receipt.receipt_id,
    },
    demaHome: home,
    nonce,
    createdAtIso: settleNow,
    expiresAtIso: CONSENT_EXPIRES,
  });
  assert.equal(consent.built, true);
  const settlement = await settleOneTaskFlywheelImpact({
    flywheelReceipt: flywheel.flywheel_receipt,
    actionReceiptId: flywheel.action_receipt_id,
    consentProof: consent.consent_proof,
    operatorPubkeyPem: consent.signer_public_key_pem,
    demaHome: home,
    now: settleNow,
  });
  assert.equal(settlement.settled, true);
  const proposal = proposeFlywheelXpGrant({
    ledgerEntry: settlement.ledger_entry,
    operatorPubkeyPem: consent.signer_public_key_pem,
    skillId: "proof_engineering",
    agentId: subject,
    createdAtIso: settleNow,
  });
  assert.equal(proposal.proposed, true);
  return {
    proposal,
    entry: settlement.ledger_entry,
    pubkeyPem: consent.signer_public_key_pem,
  };
}

describe("SAT-VALIDATE-1A · validateXpGrantProposal", () => {
  it("happy: a SAT agent validates the proposal -> signed, re-verifiable receipt", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const { proposal, entry, pubkeyPem } = await proposeFor(home, {
        actionNow: "2026-05-30T16:00:00.000Z",
        settleNow: "2026-05-30T16:01:00.000Z",
        nonce: "5a700001".repeat(8),
      });

      const r = await validateXpGrantProposal({
        proposal,
        ledgerEntry: entry,
        validatorAgentId: VALIDATOR,
        operatorPubkeyPem: pubkeyPem,
        demaHome: home,
        createdAtIso: VALIDATE_NOW,
      });

      assert.equal(r.validated, true);
      assert.equal(r.receipt.schema, SAT_VALIDATION_RECEIPT_SCHEMA);
      assert.equal(r.receipt.verdict, "VALIDATED");
      assert.equal(r.receipt.validator_agent_id, VALIDATOR);
      assert.equal(r.receipt.subject_agent_id, SUBJECT);
      assert.equal(r.receipt.validated_xp_amount, entry.amount);
      assert.equal(r.receipt.evidence_impact_receipt_hash, entry.entry_hash);
      assert.match(r.receipt.receipt_hash, /^[a-f0-9]{64}$/);

      const v = verifySatValidationReceipt({
        receipt: r.receipt,
        pubkeyPem,
      });
      assert.equal(v.verified, true);
      assert.ok(Object.isFrozen(r.receipt));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("THE LOOP CLOSES: the SAT receipt hash unblocks the AGENT-SKILL-1A §11 gate", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const { proposal, entry, pubkeyPem } = await proposeFor(home, {
        actionNow: "2026-05-30T16:00:00.000Z",
        settleNow: "2026-05-30T16:01:00.000Z",
        nonce: "5a700002".repeat(8),
      });
      const r = await validateXpGrantProposal({
        proposal,
        ledgerEntry: entry,
        validatorAgentId: VALIDATOR,
        operatorPubkeyPem: pubkeyPem,
        demaHome: home,
        createdAtIso: VALIDATE_NOW,
      });
      assert.equal(r.validated, true);

      // Before SAT: reward_without_validation. After SAT: the grant carries a
      // real sat_validation_receipt_hash, so the §11 structural gate is
      // SATISFIED and buildSkillLedger advances past it (failing later only at
      // consent verification, which is a different, expected gate).
      const validatedGrant = {
        ...proposal.proposed_skill_grant,
        sat_validation_receipt_hash: r.receipt.receipt_hash,
      };
      const minted = await buildSkillLedger({
        agent_id: proposal.agent_id,
        skill_grants: [validatedGrant],
        consentProof: {},
        demaHome: home,
        createdAtIso: VALIDATE_NOW,
      });
      assert.equal(minted.built, false);
      assert.notEqual(minted.error, "reward_without_validation");
      assert.notEqual(minted.error, "xp_without_proof");
      assert.match(minted.error, /^consent/);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: a SAT agent may not validate its own reward (no self-verification)", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      // Proposal whose SUBJECT is the same SAT agent that would validate it.
      const { proposal, entry, pubkeyPem } = await proposeFor(home, {
        actionNow: "2026-05-30T16:00:00.000Z",
        settleNow: "2026-05-30T16:01:00.000Z",
        nonce: "5a700003".repeat(8),
        subject: VALIDATOR,
      });
      const r = await validateXpGrantProposal({
        proposal,
        ledgerEntry: entry,
        validatorAgentId: VALIDATOR,
        operatorPubkeyPem: pubkeyPem,
        demaHome: home,
        createdAtIso: VALIDATE_NOW,
      });
      assert.equal(r.validated, false);
      assert.equal(r.error, "self_validation_forbidden");
      assert.equal(r.receipt, undefined);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: a non-SAT agent cannot issue a SAT validation", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const { proposal, entry, pubkeyPem } = await proposeFor(home, {
        actionNow: "2026-05-30T16:00:00.000Z",
        settleNow: "2026-05-30T16:01:00.000Z",
        nonce: "5a700004".repeat(8),
      });
      const r = await validateXpGrantProposal({
        proposal,
        ledgerEntry: entry,
        validatorAgentId: "pat.builder",
        operatorPubkeyPem: pubkeyPem,
        demaHome: home,
        createdAtIso: VALIDATE_NOW,
      });
      assert.equal(r.validated, false);
      assert.equal(r.error, "validator_not_sat_agent");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: re-derived XP must equal the proposed XP (anti-inflation)", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const { proposal, entry, pubkeyPem } = await proposeFor(home, {
        actionNow: "2026-05-30T16:00:00.000Z",
        settleNow: "2026-05-30T16:01:00.000Z",
        nonce: "5a700005".repeat(8),
      });
      const inflated = {
        ...proposal,
        proposed_skill_grant: {
          ...proposal.proposed_skill_grant,
          xp_amount: 999,
        },
      };
      const r = await validateXpGrantProposal({
        proposal: inflated,
        ledgerEntry: entry,
        validatorAgentId: VALIDATOR,
        operatorPubkeyPem: pubkeyPem,
        demaHome: home,
        createdAtIso: VALIDATE_NOW,
      });
      assert.equal(r.validated, false);
      assert.equal(r.error, "xp_amount_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: tampered impact entry is rejected before any receipt", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const { proposal, entry, pubkeyPem } = await proposeFor(home, {
        actionNow: "2026-05-30T16:00:00.000Z",
        settleNow: "2026-05-30T16:01:00.000Z",
        nonce: "5a700006".repeat(8),
      });
      const r = await validateXpGrantProposal({
        proposal,
        ledgerEntry: { ...entry, amount: 999 },
        validatorAgentId: VALIDATOR,
        operatorPubkeyPem: pubkeyPem,
        demaHome: home,
        createdAtIso: VALIDATE_NOW,
      });
      assert.equal(r.validated, false);
      assert.equal(r.error, "impact_entry_unverified");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: proposal bound to a different entry is rejected (evidence binding)", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const a = await proposeFor(home, {
        actionNow: "2026-05-30T16:00:00.000Z",
        settleNow: "2026-05-30T16:01:00.000Z",
        nonce: "5a700007".repeat(8),
      });
      const b = await proposeFor(home, {
        actionNow: "2026-05-30T16:05:00.000Z",
        settleNow: "2026-05-30T16:06:00.000Z",
        nonce: "5a700008".repeat(8),
      });
      assert.notEqual(a.entry.entry_hash, b.entry.entry_hash);
      // a's proposal is bound to a.entry, but we hand the validator b.entry.
      const r = await validateXpGrantProposal({
        proposal: a.proposal,
        ledgerEntry: b.entry,
        validatorAgentId: VALIDATOR,
        operatorPubkeyPem: a.pubkeyPem,
        demaHome: home,
        createdAtIso: VALIDATE_NOW,
      });
      assert.equal(r.validated, false);
      assert.equal(r.error, "evidence_binding_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: missing createdAtIso refuses nondeterministic validation", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const { proposal, entry, pubkeyPem } = await proposeFor(home, {
        actionNow: "2026-05-30T16:00:00.000Z",
        settleNow: "2026-05-30T16:01:00.000Z",
        nonce: "5a700009".repeat(8),
      });
      const r = await validateXpGrantProposal({
        proposal,
        ledgerEntry: entry,
        validatorAgentId: VALIDATOR,
        operatorPubkeyPem: pubkeyPem,
        demaHome: home,
      });
      assert.equal(r.validated, false);
      assert.equal(r.error, "created_at_iso_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("verifier rejects a receipt signed under a foreign key", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const { proposal, entry, pubkeyPem } = await proposeFor(home, {
        actionNow: "2026-05-30T16:00:00.000Z",
        settleNow: "2026-05-30T16:01:00.000Z",
        nonce: "5a70000a".repeat(8),
      });
      const r = await validateXpGrantProposal({
        proposal,
        ledgerEntry: entry,
        validatorAgentId: VALIDATOR,
        operatorPubkeyPem: pubkeyPem,
        demaHome: home,
        createdAtIso: VALIDATE_NOW,
      });
      assert.equal(r.validated, true);
      const foreign = generateEd25519Keypair();
      const v = verifySatValidationReceipt({
        receipt: r.receipt,
        pubkeyPem: foreign.public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.reason, "signature_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("receipt envelope contains no private-key or public-economy material", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const { proposal, entry, pubkeyPem } = await proposeFor(home, {
        actionNow: "2026-05-30T16:00:00.000Z",
        settleNow: "2026-05-30T16:01:00.000Z",
        nonce: "5a70000b".repeat(8),
      });
      const r = await validateXpGrantProposal({
        proposal,
        ledgerEntry: entry,
        validatorAgentId: VALIDATOR,
        operatorPubkeyPem: pubkeyPem,
        demaHome: home,
        createdAtIso: VALIDATE_NOW,
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
        '"public_transfer":',
      ]) {
        assert.equal(s.includes(forbidden), false, forbidden);
      }
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
