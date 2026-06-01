// ATTEST-1B · durable convergence-attestation ledger
//
// CONVERGENCE-ATTEST-1A produces a signed, Level-B-grounded attestation but is
// pure (no write). This makes the seal persistent: verify → ATTEST → seal →
// APPEND → replay. A valid, currently-grounded attestation + key-bound consent
// is appended to a durable, content-addressed, operator-signed prev_hash chain.
// Fail-closed before every write.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendConvergenceAttestation,
  loadConvergenceAttestationLedger,
  verifyConvergenceAttestationLedger,
  CONVERGENCE_ATTESTATION_LEDGER_SCHEMA,
  ATTESTATION_LEDGER_RELPATH,
  APPEND_ATTESTATION_ACTION_TYPE,
} from "../packages/flywheel/src/flywheel-attestation-ledger.js";
import { attestConvergence } from "../packages/flywheel/src/flywheel-convergence-attestation.js";
import { bindTaskReceiptsToCanonicalChain } from "../packages/receipts/src/canonical-task-binding.js";
import { CANONICAL_RECEIPT_CONSENT_PHRASE } from "../packages/receipts/src/canonical-receipt.js";
import { runOneTaskFlywheel } from "../packages/flywheel/src/flywheel-one-task.js";
import { settleOneTaskFlywheelImpact } from "../packages/flywheel/src/flywheel-settlement.js";
import { proposeFlywheelXpGrant } from "../packages/flywheel/src/flywheel-xp-proposal.js";
import { validateXpGrantProposal } from "../packages/flywheel/src/flywheel-sat-validation.js";
import { GUARDED_CLAIM_CONSENT_PHRASE } from "../packages/receipts/src/assumption-guarded-claim.js";
import { buildConsentProof } from "../packages/receipts/src/consent-proof.js";
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
const BIND_NOW = "2026-06-01T12:00:00.000Z";
const ATTEST_NOW = "2026-06-01T12:05:00.000Z";
const APPEND_NOW = "2026-06-01T12:06:00.000Z";
const CONSENT_EXPIRES = "2026-06-01T12:30:00.000Z";

async function freshHome() {
  return mkdtemp(join(tmpdir(), "dema-attest-ledger-"));
}

async function task(home, { tag, actionNow, settleNow, nonce }) {
  const flywheel = await runOneTaskFlywheel({
    task: tag,
    envelope: A_ENVELOPE,
    consent: GUARDED_CLAIM_CONSENT_PHRASE,
    demaHome: home,
    now: actionNow,
  });
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
    descriptors: [
      {
        body: flywheel.flywheel_receipt,
        truthLabel: "LEVEL_B_GROUNDED",
        whatProves: "verified action",
        whatDoesNotProve: "not settlement",
      },
      {
        body: settlement.ledger_entry,
        truthLabel: "LEVEL_A_SIGNED",
        whatProves: "signed impact",
        whatDoesNotProve: "not xp",
      },
      {
        body: sat.receipt,
        truthLabel: "LEVEL_A_SIGNED",
        whatProves: "sat validated",
        whatDoesNotProve: "not minted",
      },
    ],
  };
}

// Bind N tasks into the canonical chain; return the operator pubkey.
async function buildChain(home, count) {
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
  let pubkeyPem;
  for (let i = 0; i < count; i += 1) {
    const t = await task(home, {
      tag: `T${i}`,
      actionNow: `2026-06-01T11:0${i}:00.000Z`,
      settleNow: `2026-06-01T11:1${i}:00.000Z`,
      nonce: `chain${i}`.padEnd(8, "0").repeat(8).slice(0, 64),
    });
    pubkeyPem = t.pubkeyPem;
    const b = await bindTaskReceiptsToCanonicalChain({
      taskReceipts: t.descriptors,
      consent: CANONICAL_RECEIPT_CONSENT_PHRASE,
      demaHome: home,
      now: BIND_NOW,
    });
    assert.equal(b.bound, true);
  }
  return pubkeyPem;
}

async function freshAttestation(home, pubkeyPem, now = ATTEST_NOW) {
  const r = await attestConvergence({
    demaHome: home,
    operatorPubkeyPem: pubkeyPem,
    now,
  });
  assert.equal(r.attested, true, r.error);
  return r.attestation;
}

async function appendConsent(home, attestationId, nonce, now = APPEND_NOW) {
  const r = await buildConsentProof({
    phrase: "APPEND CONVERGENCE ATTESTATION",
    actionScope: {
      action_type: APPEND_ATTESTATION_ACTION_TYPE,
      target_hash: attestationId,
    },
    demaHome: home,
    nonce,
    createdAtIso: now,
    expiresAtIso: CONSENT_EXPIRES,
  });
  assert.equal(r.built, true);
  return r.consent_proof;
}

describe("ATTEST-1B · appendConvergenceAttestation", () => {
  it("happy: a grounded attestation + scoped consent appends a durable, replayable entry", async () => {
    const home = await freshHome();
    try {
      const pubkeyPem = await buildChain(home, 1);
      const attestation = await freshAttestation(home, pubkeyPem);
      const consentProof = await appendConsent(
        home,
        attestation.attestation_id,
        "app00001".repeat(8),
      );

      const r = await appendConvergenceAttestation({
        attestation,
        consentProof,
        operatorPubkeyPem: pubkeyPem,
        demaHome: home,
        now: APPEND_NOW,
      });
      assert.equal(r.schema, CONVERGENCE_ATTESTATION_LEDGER_SCHEMA);
      assert.equal(r.appended, true, r.error);
      assert.equal(r.length, 1);
      assert.equal(r.entry.truth_label, "LEVEL_B_GROUNDED_DURABLE");
      assert.equal(r.entry.prev_hash, null);
      assert.equal(r.entry.attestation_id, attestation.attestation_id);
      assert.equal(r.entry.consent_proof_hash, consentProof.consent_proof_hash);
      assert.match(r.entry.entry_hash, /^[a-f0-9]{64}$/);
      assert.equal(r.path.endsWith(ATTESTATION_LEDGER_RELPATH), true);
      assert.equal(r.boundary.local_only, true);
      assert.equal(r.boundary.file_write_performed, true);
      assert.equal(r.boundary.network_used, false);
      assert.equal(r.boundary.public_economic_claim_made, false);

      const loaded = await loadConvergenceAttestationLedger({ demaHome: home });
      assert.equal(loaded.length, 1);
      const v = await verifyConvergenceAttestationLedger({
        demaHome: home,
        pubkeyPem,
      });
      assert.equal(v.verified, true, v.reason);
      assert.equal(v.total_entries, 1);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("chains a second attestation (after the chain grows) and replays both", async () => {
    const home = await freshHome();
    try {
      const pubkeyPem = await buildChain(home, 1);
      const att1 = await freshAttestation(home, pubkeyPem);
      const c1 = await appendConsent(
        home,
        att1.attestation_id,
        "app00002".repeat(8),
      );
      const a1 = await appendConvergenceAttestation({
        attestation: att1,
        consentProof: c1,
        operatorPubkeyPem: pubkeyPem,
        demaHome: home,
        now: APPEND_NOW,
      });
      assert.equal(a1.appended, true);

      // Grow the canonical chain by binding a second task, then attest again.
      await buildChain(home, 1); // appends another task to the same home's chain
      const att2 = await attestConvergence({
        demaHome: home,
        operatorPubkeyPem: pubkeyPem,
        now: "2026-06-01T12:10:00.000Z",
      });
      assert.equal(att2.attested, true);
      assert.notEqual(att2.attestation.attestation_id, att1.attestation_id);
      const c2 = await appendConsent(
        home,
        att2.attestation.attestation_id,
        "app00003".repeat(8),
        "2026-06-01T12:11:00.000Z",
      );
      const a2 = await appendConvergenceAttestation({
        attestation: att2.attestation,
        consentProof: c2,
        operatorPubkeyPem: pubkeyPem,
        demaHome: home,
        now: "2026-06-01T12:11:00.000Z",
      });
      assert.equal(a2.appended, true);
      assert.equal(a2.length, 2);
      assert.equal(a2.entry.prev_hash, a1.entry.entry_hash);

      const v = await verifyConvergenceAttestationLedger({
        demaHome: home,
        pubkeyPem,
      });
      assert.equal(v.verified, true, v.reason);
      assert.equal(v.total_entries, 2);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: missing consent does not append", async () => {
    const home = await freshHome();
    try {
      const pubkeyPem = await buildChain(home, 1);
      const attestation = await freshAttestation(home, pubkeyPem);
      const r = await appendConvergenceAttestation({
        attestation,
        operatorPubkeyPem: pubkeyPem,
        demaHome: home,
        now: APPEND_NOW,
      });
      assert.equal(r.appended, false);
      assert.equal(r.error, "consent_proof_required");
      assert.deepEqual(
        await loadConvergenceAttestationLedger({ demaHome: home }),
        [],
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: an ungrounded attestation (chain tampered after attesting) does not append", async () => {
    const home = await freshHome();
    try {
      const pubkeyPem = await buildChain(home, 1);
      const attestation = await freshAttestation(home, pubkeyPem);
      const consentProof = await appendConsent(
        home,
        attestation.attestation_id,
        "app00004".repeat(8),
      );

      // Tamper the canonical chain → Level-B no longer grounds.
      const path = join(home, "receipts/canonical-ledger.ndjson");
      const lines = (await readFile(path, "utf8")).trim().split("\n");
      const e = JSON.parse(lines[1]);
      e.truth_label = "CANONICAL";
      lines[1] = JSON.stringify(e);
      await writeFile(path, lines.join("\n") + "\n");

      const r = await appendConvergenceAttestation({
        attestation,
        consentProof,
        operatorPubkeyPem: pubkeyPem,
        demaHome: home,
        now: APPEND_NOW,
      });
      assert.equal(r.appended, false);
      assert.equal(r.error, "attestation_not_grounded");
      assert.deepEqual(
        await loadConvergenceAttestationLedger({ demaHome: home }),
        [],
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: a duplicate attestation_id does not append twice", async () => {
    const home = await freshHome();
    try {
      const pubkeyPem = await buildChain(home, 1);
      const attestation = await freshAttestation(home, pubkeyPem);
      const c1 = await appendConsent(
        home,
        attestation.attestation_id,
        "app00005".repeat(8),
      );
      const a1 = await appendConvergenceAttestation({
        attestation,
        consentProof: c1,
        operatorPubkeyPem: pubkeyPem,
        demaHome: home,
        now: APPEND_NOW,
      });
      assert.equal(a1.appended, true);

      const c2 = await appendConsent(
        home,
        attestation.attestation_id,
        "app00006".repeat(8),
      );
      const a2 = await appendConvergenceAttestation({
        attestation,
        consentProof: c2,
        operatorPubkeyPem: pubkeyPem,
        demaHome: home,
        now: APPEND_NOW,
      });
      assert.equal(a2.appended, false);
      assert.equal(a2.error, "duplicate_attestation");
      assert.equal(
        (await loadConvergenceAttestationLedger({ demaHome: home })).length,
        1,
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: never extend a corrupt attestation ledger", async () => {
    const home = await freshHome();
    try {
      const pubkeyPem = await buildChain(home, 1);
      const att = await freshAttestation(home, pubkeyPem);
      const c1 = await appendConsent(
        home,
        att.attestation_id,
        "app00007".repeat(8),
      );
      await appendConvergenceAttestation({
        attestation: att,
        consentProof: c1,
        operatorPubkeyPem: pubkeyPem,
        demaHome: home,
        now: APPEND_NOW,
      });

      const path = join(home, ATTESTATION_LEDGER_RELPATH);
      const line = JSON.parse((await readFile(path, "utf8")).trim());
      line.truth_label = "TAMPERED";
      await writeFile(path, JSON.stringify(line) + "\n");

      // Grow chain + attest a new, genuine attestation, then try to append onto
      // the corrupt ledger → refused.
      await buildChain(home, 1);
      const att2 = await attestConvergence({
        demaHome: home,
        operatorPubkeyPem: pubkeyPem,
        now: "2026-06-01T12:20:00.000Z",
      });
      const c2 = await appendConsent(
        home,
        att2.attestation.attestation_id,
        "app00008".repeat(8),
        "2026-06-01T12:21:00.000Z",
      );
      const r = await appendConvergenceAttestation({
        attestation: att2.attestation,
        consentProof: c2,
        operatorPubkeyPem: pubkeyPem,
        demaHome: home,
        now: "2026-06-01T12:21:00.000Z",
      });
      assert.equal(r.appended, false);
      assert.equal(r.error, "attestation_ledger_chain_broken");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: a correctly-scoped consent with the WRONG phrase does not append", async () => {
    const home = await freshHome();
    try {
      const pubkeyPem = await buildChain(home, 1);
      const attestation = await freshAttestation(home, pubkeyPem);
      // Right action scope + target, but the operator typed a different phrase.
      const wrong = await buildConsentProof({
        phrase: "GO: whatever",
        actionScope: {
          action_type: APPEND_ATTESTATION_ACTION_TYPE,
          target_hash: attestation.attestation_id,
        },
        demaHome: home,
        nonce: "wrongph0".repeat(8),
        createdAtIso: APPEND_NOW,
        expiresAtIso: CONSENT_EXPIRES,
      });
      const r = await appendConvergenceAttestation({
        attestation,
        consentProof: wrong.consent_proof,
        operatorPubkeyPem: pubkeyPem,
        demaHome: home,
        now: APPEND_NOW,
      });
      assert.equal(r.appended, false);
      assert.equal(r.error, "consent_phrase_mismatch");
      assert.equal(r.boundary.file_write_performed, false);
      assert.deepEqual(
        await loadConvergenceAttestationLedger({ demaHome: home }),
        [],
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
