// FLYWHEEL-REPLAY-1A · task-coherence verifier (§19 step 17)
//
// RECEIPT-CHAIN-1C binds a task's [action, IMPACT, SAT] receipts into a
// hash-linked canonical chain — but link integrity is NOT semantic coherence.
// verifyCanonicalChain would happily "verify" a Frankenstein chain of three
// individually-valid receipts from three unrelated tasks. This verifier closes
// that hole: it re-derives the cross-references with zero trust, proving the
// three artifacts are ONE coherent verified task.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  verifyTaskCoherence,
  FLYWHEEL_TASK_COHERENCE_SCHEMA,
} from "../packages/flywheel/src/flywheel-task-coherence.js";
import { runOneTaskFlywheel } from "../packages/flywheel/src/flywheel-one-task.js";
import { settleOneTaskFlywheelImpact } from "../packages/flywheel/src/flywheel-settlement.js";
import { proposeFlywheelXpGrant } from "../packages/flywheel/src/flywheel-xp-proposal.js";
import { validateXpGrantProposal } from "../packages/flywheel/src/flywheel-sat-validation.js";
import { GUARDED_CLAIM_CONSENT_PHRASE } from "../packages/receipts/src/assumption-guarded-claim.js";
import { buildConsentProof } from "../packages/receipts/src/consent-proof.js";
import { generateEd25519Keypair } from "../packages/receipts/src/authorship-signature.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";

const A_ENVELOPE = Object.freeze({
  claim_state: "A",
  assumption: "Task is complete.",
  ground: "tests passed.",
  boundary: "Invalid if tests regress.",
  rejectable: true,
});

async function freshHome() {
  return mkdtemp(join(tmpdir(), "dema-coherence-"));
}

// Run one full task; return its three coherent artifacts + the pubkey.
async function task(home, { tag, actionNow, settleNow, nonce }) {
  const flywheel = await runOneTaskFlywheel({
    task: tag,
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
    expiresAtIso: "2026-05-31T23:00:00.000Z",
  });
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
    agentId: "pat.builder",
    createdAtIso: settleNow,
  });
  const sat = await validateXpGrantProposal({
    proposal,
    ledgerEntry: settlement.ledger_entry,
    validatorAgentId: "sat.economist",
    operatorPubkeyPem: consent.signer_public_key_pem,
    demaHome: home,
    createdAtIso: settleNow,
  });
  assert.equal(sat.validated, true);
  return {
    flywheelReceipt: flywheel.flywheel_receipt,
    impactEntry: settlement.ledger_entry,
    satReceipt: sat.receipt,
    pubkeyPem: consent.signer_public_key_pem,
  };
}

describe("FLYWHEEL-REPLAY-1A · verifyTaskCoherence", () => {
  it("happy: one real task's three artifacts are coherent", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const t = await task(home, {
        tag: "A",
        actionNow: "2026-05-31T11:00:00.000Z",
        settleNow: "2026-05-31T11:01:00.000Z",
        nonce: "c0herent1".repeat(8).slice(0, 64),
      });
      const r = verifyTaskCoherence({
        flywheelReceipt: t.flywheelReceipt,
        impactEntry: t.impactEntry,
        satReceipt: t.satReceipt,
        operatorPubkeyPem: t.pubkeyPem,
      });
      assert.equal(r.schema, FLYWHEEL_TASK_COHERENCE_SCHEMA);
      assert.equal(r.coherent, true);
      assert.equal(r.task.flywheel_receipt_id, t.flywheelReceipt.receipt_id);
      assert.equal(r.task.impact_entry_hash, t.impactEntry.entry_hash);
      assert.equal(r.task.impact_amount, t.impactEntry.amount);
      assert.equal(r.task.xp_amount, t.satReceipt.validated_xp_amount);
      assert.ok(Object.isFrozen(r));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("THE FRANKENSTEIN HOLE: task-A action + task-B impact (both individually valid) is INCOHERENT", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const a = await task(home, {
        tag: "A",
        actionNow: "2026-05-31T11:00:00.000Z",
        settleNow: "2026-05-31T11:01:00.000Z",
        nonce: "aaaa0001".repeat(8),
      });
      const b = await task(home, {
        tag: "B",
        actionNow: "2026-05-31T11:05:00.000Z",
        settleNow: "2026-05-31T11:06:00.000Z",
        nonce: "bbbb0002".repeat(8),
      });
      // Frankenstein: A's action, B's impact + SAT. Each receipt is signed and
      // individually verifies — but they are not the same task.
      const r = verifyTaskCoherence({
        flywheelReceipt: a.flywheelReceipt,
        impactEntry: b.impactEntry,
        satReceipt: b.satReceipt,
        operatorPubkeyPem: a.pubkeyPem,
      });
      assert.equal(r.coherent, false);
      assert.equal(r.stage, "cross_reference");
      assert.equal(r.reason, "impact_not_derived_from_action");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("incoherent: SAT receipt bound to a different impact", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const a = await task(home, {
        tag: "A",
        actionNow: "2026-05-31T11:00:00.000Z",
        settleNow: "2026-05-31T11:01:00.000Z",
        nonce: "aaaa0003".repeat(8),
      });
      const b = await task(home, {
        tag: "B",
        actionNow: "2026-05-31T11:05:00.000Z",
        settleNow: "2026-05-31T11:06:00.000Z",
        nonce: "bbbb0004".repeat(8),
      });
      // A's action + A's impact, but B's SAT receipt (validates B's impact).
      const r = verifyTaskCoherence({
        flywheelReceipt: a.flywheelReceipt,
        impactEntry: a.impactEntry,
        satReceipt: b.satReceipt,
        operatorPubkeyPem: a.pubkeyPem,
      });
      assert.equal(r.coherent, false);
      assert.equal(r.stage, "cross_reference");
      assert.equal(r.reason, "sat_not_bound_to_impact");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: forged flywheel score is rejected before cross-reference", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const t = await task(home, {
        tag: "A",
        actionNow: "2026-05-31T11:00:00.000Z",
        settleNow: "2026-05-31T11:01:00.000Z",
        nonce: "aaaa0005".repeat(8),
      });
      const r = verifyTaskCoherence({
        flywheelReceipt: { ...t.flywheelReceipt, score: 1.0 },
        impactEntry: t.impactEntry,
        satReceipt: t.satReceipt,
        operatorPubkeyPem: t.pubkeyPem,
      });
      assert.equal(r.coherent, false);
      assert.equal(r.stage, "flywheel_replay");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: foreign pubkey fails the SAT signature check", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const t = await task(home, {
        tag: "A",
        actionNow: "2026-05-31T11:00:00.000Z",
        settleNow: "2026-05-31T11:01:00.000Z",
        nonce: "aaaa0006".repeat(8),
      });
      const foreign = generateEd25519Keypair();
      const r = verifyTaskCoherence({
        flywheelReceipt: t.flywheelReceipt,
        impactEntry: t.impactEntry,
        satReceipt: t.satReceipt,
        operatorPubkeyPem: foreign.public_key_pem,
      });
      assert.equal(r.coherent, false);
      // impact verify happens before sat verify; either signature stage is valid
      assert.ok(r.stage === "impact_verify" || r.stage === "sat_verify");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("micro-compliance: success and failure envelopes declare pure verifier boundaries", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const t = await task(home, {
        tag: "A",
        actionNow: "2026-05-31T11:00:00.000Z",
        settleNow: "2026-05-31T11:01:00.000Z",
        nonce: "aaaa0007".repeat(8),
      });
      const success = verifyTaskCoherence({
        flywheelReceipt: t.flywheelReceipt,
        impactEntry: t.impactEntry,
        satReceipt: t.satReceipt,
        operatorPubkeyPem: t.pubkeyPem,
      });
      assert.deepEqual(success.boundary, {
        local_only: true,
        file_write_performed: false,
        operator_dema_home_mutated: false,
        network_used: false,
        federation_used: false,
        public_economic_claim_made: false,
        public_transfer_performed: false,
        marketplace_used: false,
        house_of_wisdom_mutated: false,
        performance_delta_recorded: false,
        full_node0_complete_claimed: false,
        private_key_material_returned: false,
      });

      const failure = verifyTaskCoherence({
        flywheelReceipt: { ...t.flywheelReceipt, score: 1.0 },
        impactEntry: t.impactEntry,
        satReceipt: t.satReceipt,
        operatorPubkeyPem: t.pubkeyPem,
      });
      assert.deepEqual(failure.boundary, success.boundary);
      assert.equal(JSON.stringify(success).includes("PRIVATE KEY"), false);
      assert.equal(JSON.stringify(failure).includes("PRIVATE KEY"), false);
      assert.ok(Object.isFrozen(success.boundary));
      assert.ok(Object.isFrozen(failure.boundary));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
