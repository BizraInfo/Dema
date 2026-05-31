// CONVERGENCE-ATTEST-1A · sign + ground the Proof-of-Truth convergence verdict
//
// FLYWHEEL-REPLAY-1B proves a bound canonical task chain converges across the
// four layers (Formal | Cryptographic | Empirical | Economic) — but the verdict
// is ephemeral. This kernel turns it into a signed, content-addressed
// attestation that is LEVEL-B GROUNDED: its verifier re-runs the convergence
// check against the LIVE chain, so the attestation cannot certify a chain that
// has since diverged. Signed ≠ true; grounded = true.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  attestConvergence,
  verifyConvergenceAttestation,
  CONVERGENCE_ATTESTATION_SCHEMA,
} from "../packages/flywheel/src/flywheel-convergence-attestation.js";
import { bindTaskReceiptsToCanonicalChain } from "../packages/receipts/src/canonical-task-binding.js";
import { CANONICAL_RECEIPT_CONSENT_PHRASE } from "../packages/receipts/src/canonical-receipt.js";
import { CANONICAL_LEDGER_RELPATH } from "../packages/receipts/src/canonical-ledger.js";
import { runOneTaskFlywheel } from "../packages/flywheel/src/flywheel-one-task.js";
import { settleOneTaskFlywheelImpact } from "../packages/flywheel/src/flywheel-settlement.js";
import { proposeFlywheelXpGrant } from "../packages/flywheel/src/flywheel-xp-proposal.js";
import { validateXpGrantProposal } from "../packages/flywheel/src/flywheel-sat-validation.js";
import { GUARDED_CLAIM_CONSENT_PHRASE } from "../packages/receipts/src/assumption-guarded-claim.js";
import { buildConsentProof } from "../packages/receipts/src/consent-proof.js";
import {
  generateEd25519Keypair,
  signPayload,
} from "../packages/receipts/src/authorship-signature.js";
import {
  sha256,
  stableStringify,
} from "../packages/consent/src/consent-common.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
  loadPrivateKey,
} from "../packages/receipts/src/authorship-key-store.js";

const A_ENVELOPE = Object.freeze({
  claim_state: "A",
  assumption: "Task is complete.",
  ground: "tests passed.",
  boundary: "Invalid if tests regress.",
  rejectable: true,
});
const BIND_NOW = "2026-05-31T12:00:00.000Z";
const ATTEST_NOW = "2026-05-31T12:05:00.000Z";

async function freshHome() {
  return mkdtemp(join(tmpdir(), "dema-attest-"));
}

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
  return {
    pubkeyPem: consent.signer_public_key_pem,
    flywheelReceipt: flywheel.flywheel_receipt,
    impactEntry: settlement.ledger_entry,
    satReceipt: sat.receipt,
  };
}

function descriptors(t) {
  return [
    {
      body: t.flywheelReceipt,
      truthLabel: "LEVEL_B_GROUNDED",
      whatProves: "A verified action ran and earned a re-derivable score.",
      whatDoesNotProve: "Does not prove settlement or reward.",
    },
    {
      body: t.impactEntry,
      truthLabel: "LEVEL_A_SIGNED",
      whatProves: "A signed IMPACT_CREDIT was minted for the action.",
      whatDoesNotProve: "Does not prove XP granted.",
    },
    {
      body: t.satReceipt,
      truthLabel: "LEVEL_A_SIGNED",
      whatProves: "A SAT-5 agent validated XP eligibility.",
      whatDoesNotProve: "Does not prove XP minted or approved.",
    },
  ];
}

async function boundConvergentChain(home, nonce) {
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
  const t = await task(home, {
    tag: "A",
    actionNow: "2026-05-31T11:00:00.000Z",
    settleNow: "2026-05-31T11:01:00.000Z",
    nonce,
  });
  const r = await bindTaskReceiptsToCanonicalChain({
    taskReceipts: descriptors(t),
    consent: CANONICAL_RECEIPT_CONSENT_PHRASE,
    demaHome: home,
    now: BIND_NOW,
  });
  assert.equal(r.bound, true);
  return t.pubkeyPem;
}

describe("CONVERGENCE-ATTEST-1A · attestConvergence", () => {
  it("happy: a convergent chain yields a signed, Level-B-verifiable attestation", async () => {
    const home = await freshHome();
    try {
      const pubkeyPem = await boundConvergentChain(home, "att00001".repeat(8));
      const r = await attestConvergence({
        demaHome: home,
        operatorPubkeyPem: pubkeyPem,
        now: ATTEST_NOW,
      });
      assert.equal(r.schema, CONVERGENCE_ATTESTATION_SCHEMA);
      assert.equal(r.attested, true);
      assert.equal(r.attestation.layers.formal, true);
      assert.equal(r.attestation.layers.economic, true);
      assert.match(r.attestation.attestation_id, /^[a-f0-9]{64}$/);
      assert.match(r.attestation.canonical_chain_root, /^[a-f0-9]{64}$/);
      assert.equal(r.attestation.task_count, 1);

      const v = await verifyConvergenceAttestation({
        attestation: r.attestation,
        demaHome: home,
        pubkeyPem,
      });
      assert.equal(v.verified, true);
      assert.equal(v.level, "B");
      assert.ok(Object.isFrozen(r.attestation));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("THE GROUNDING CATCH: tampering the chain AFTER attesting passes Level-A but fails Level-B", async () => {
    const home = await freshHome();
    try {
      const pubkeyPem = await boundConvergentChain(home, "att00002".repeat(8));
      const r = await attestConvergence({
        demaHome: home,
        operatorPubkeyPem: pubkeyPem,
        now: ATTEST_NOW,
      });
      assert.equal(r.attested, true);

      // Tamper a bound entry AFTER the attestation was signed. The attestation
      // itself is untouched, so its own signature (Level-A) still verifies — but
      // the convergence it certifies no longer re-derives (Level-B).
      const path = join(home, CANONICAL_LEDGER_RELPATH);
      const lines = (await readFile(path, "utf8")).trim().split("\n");
      const e = JSON.parse(lines[1]);
      e.truth_label = "CANONICAL";
      lines[1] = JSON.stringify(e);
      await writeFile(path, lines.join("\n") + "\n");

      const v = await verifyConvergenceAttestation({
        attestation: r.attestation,
        demaHome: home,
        pubkeyPem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.level_a_signature_valid, true); // the signed claim is intact
      assert.equal(v.stage, "grounding"); // but it no longer grounds
      assert.equal(v.reason, "live_chain_not_convergent");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: a non-convergent (Frankenstein) chain cannot be attested", async () => {
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
        nonce: "att00003".repeat(8),
      });
      const b = await task(home, {
        tag: "B",
        actionNow: "2026-05-31T11:05:00.000Z",
        settleNow: "2026-05-31T11:06:00.000Z",
        nonce: "att00004".repeat(8),
      });
      await bindTaskReceiptsToCanonicalChain({
        taskReceipts: [descriptors(a)[0], descriptors(b)[1], descriptors(b)[2]],
        consent: CANONICAL_RECEIPT_CONSENT_PHRASE,
        demaHome: home,
        now: BIND_NOW,
      });
      const r = await attestConvergence({
        demaHome: home,
        operatorPubkeyPem: a.pubkeyPem,
        now: ATTEST_NOW,
      });
      assert.equal(r.attested, false);
      assert.equal(r.error, "not_convergent");
      assert.equal(r.convergence.convergent, false);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: missing createdAtIso refuses a nondeterministic attestation", async () => {
    const home = await freshHome();
    try {
      const pubkeyPem = await boundConvergentChain(home, "att00005".repeat(8));
      const r = await attestConvergence({
        demaHome: home,
        operatorPubkeyPem: pubkeyPem,
      });
      assert.equal(r.attested, false);
      assert.equal(r.error, "created_at_iso_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("verifier rejects a foreign-key-signed attestation at Level-A", async () => {
    const home = await freshHome();
    try {
      const pubkeyPem = await boundConvergentChain(home, "att00006".repeat(8));
      const r = await attestConvergence({
        demaHome: home,
        operatorPubkeyPem: pubkeyPem,
        now: ATTEST_NOW,
      });
      const foreign = generateEd25519Keypair();
      const v = await verifyConvergenceAttestation({
        attestation: r.attestation,
        demaHome: home,
        pubkeyPem: foreign.public_key_pem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.stage, "signature");
      assert.equal(v.reason, "signature_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("attestation envelope carries no private-key or public-economy material", async () => {
    const home = await freshHome();
    try {
      const pubkeyPem = await boundConvergentChain(home, "att00007".repeat(8));
      const r = await attestConvergence({
        demaHome: home,
        operatorPubkeyPem: pubkeyPem,
        now: ATTEST_NOW,
      });
      const s = JSON.stringify(r);
      for (const forbidden of [
        "PRIVATE KEY",
        '"private_key":',
        '"private_key_pem":',
        '"exchange_value":',
        '"public_mint":',
        '"public_transfer":',
      ]) {
        assert.equal(s.includes(forbidden), false, forbidden);
      }
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("GROUNDING IS TOTAL: a re-signed attestation with a wrong task_count passes Level-A but fails Level-B", async () => {
    const home = await freshHome();
    try {
      const pubkeyPem = await boundConvergentChain(home, "att00008".repeat(8));
      const r = await attestConvergence({
        demaHome: home,
        operatorPubkeyPem: pubkeyPem,
        now: ATTEST_NOW,
      });
      assert.equal(r.attested, true);

      // Forge: bump task_count, then re-sign with the operator's own key and
      // recompute the content address. Level-A is therefore valid — but the
      // value no longer re-derives from the live chain.
      const privateKeyPem = await loadPrivateKey(home);
      const { attestation_id, attestation_signature_b64, ...body } =
        r.attestation;
      const forgedBody = { ...body, task_count: body.task_count + 5 };
      const forged = {
        ...forgedBody,
        attestation_id: sha256(stableStringify(forgedBody)),
        attestation_signature_b64: signPayload(forgedBody, privateKeyPem),
      };
      const v = await verifyConvergenceAttestation({
        attestation: forged,
        demaHome: home,
        pubkeyPem,
      });
      assert.equal(v.verified, false);
      assert.equal(v.level_a_signature_valid, true);
      assert.equal(v.stage, "grounding");
      assert.equal(v.reason, "task_count_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("verifier fails closed (no crash) on a malformed external pubkey", async () => {
    const home = await freshHome();
    try {
      const pubkeyPem = await boundConvergentChain(home, "att00009".repeat(8));
      const r = await attestConvergence({
        demaHome: home,
        operatorPubkeyPem: pubkeyPem,
        now: ATTEST_NOW,
      });
      const v = await verifyConvergenceAttestation({
        attestation: r.attestation,
        demaHome: home,
        // contains the marker but is not a valid PEM body
        pubkeyPem:
          "-----BEGIN PUBLIC KEY-----\nnot-a-real-key\n-----END PUBLIC KEY-----",
      });
      assert.equal(v.verified, false);
      assert.equal(v.stage, "signature");
      assert.equal(v.reason, "signature_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: a rotated local key (no longer == operatorPubkeyPem) refuses to attest", async () => {
    const home = await freshHome();
    try {
      const pubkeyPem = await boundConvergentChain(home, "att0000a".repeat(8));
      // Rotate the local key AFTER binding: delete keys + re-init a new pair.
      await rm(join(home, "keys"), { recursive: true, force: true });
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      // The chain still converges under the ORIGINAL operator key, but the local
      // signing key now differs — the attestation would be unverifiable.
      const r = await attestConvergence({
        demaHome: home,
        operatorPubkeyPem: pubkeyPem,
        now: ATTEST_NOW,
      });
      assert.equal(r.attested, false);
      assert.equal(r.error, "operator_key_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
