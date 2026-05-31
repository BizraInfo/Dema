// FLYWHEEL-REPLAY-1B · Proof-of-Truth convergence over the bound canonical chain
//
// RECEIPT-CHAIN-1C binds a task's [action, IMPACT, SAT] receipts into the
// canonical chain (formal + cryptographic). FLYWHEEL-REPLAY-1A proves loose
// artifacts are one coherent task (empirical + economic). Nothing yet runs ALL
// FOUR layers on the PERSISTED chain — so a Frankenstein bundle binds and
// verifyCanonicalLedger passes. This verifier closes that: it loads the bound
// chain and returns one convergent verdict across Formal | Cryptographic |
// Empirical | Economic.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  verifyConvergentTaskChain,
  FLYWHEEL_TASK_CONVERGENCE_SCHEMA,
} from "../packages/flywheel/src/flywheel-task-convergence.js";
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
const BIND_NOW = "2026-05-31T12:00:00.000Z";

async function freshHome() {
  return mkdtemp(join(tmpdir(), "dema-convergence-"));
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

async function bind(home, descs) {
  const r = await bindTaskReceiptsToCanonicalChain({
    taskReceipts: descs,
    consent: CANONICAL_RECEIPT_CONSENT_PHRASE,
    demaHome: home,
    now: BIND_NOW,
  });
  assert.equal(r.bound, true);
}

describe("FLYWHEEL-REPLAY-1B · verifyConvergentTaskChain", () => {
  it("happy: a coherent bound task converges across all four layers", async () => {
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
        nonce: "c0nv0001".repeat(8),
      });
      await bind(home, descriptors(t));

      const r = await verifyConvergentTaskChain({
        demaHome: home,
        pubkeyPem: t.pubkeyPem,
      });
      assert.equal(r.schema, FLYWHEEL_TASK_CONVERGENCE_SCHEMA);
      assert.equal(r.convergent, true);
      assert.equal(r.layers.formal, true);
      assert.equal(r.layers.cryptographic, true);
      assert.equal(r.layers.empirical, true);
      assert.equal(r.layers.economic, true);
      assert.equal(r.task.flywheel_receipt_id, t.flywheelReceipt.receipt_id);
      assert.equal(r.chain_length, 3);
      assert.ok(Object.isFrozen(r));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("THE CONVERGENCE CATCH: a Frankenstein chain binds + chain-verifies but is NOT empirically convergent", async () => {
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
        nonce: "fra0001a".repeat(8),
      });
      const b = await task(home, {
        tag: "B",
        actionNow: "2026-05-31T11:05:00.000Z",
        settleNow: "2026-05-31T11:06:00.000Z",
        nonce: "fra0002b".repeat(8),
      });
      // Bind A's action + B's impact + B's SAT — every receipt is signed-valid,
      // so the canonical chain (formal+cryptographic) verifies fine.
      await bind(home, [
        descriptors(a)[0],
        descriptors(b)[1],
        descriptors(b)[2],
      ]);

      const r = await verifyConvergentTaskChain({
        demaHome: home,
        pubkeyPem: a.pubkeyPem,
      });
      assert.equal(r.convergent, false);
      assert.equal(r.layers.formal, true); // hash chain still valid
      assert.equal(r.layers.cryptographic, true); // signatures still valid
      assert.equal(r.layers.empirical, false); // the catch
      assert.equal(r.stage, "coherence");
      assert.equal(r.reason, "impact_not_derived_from_action");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("formal/cryptographic fail: tampering a bound entry breaks convergence at the chain layer", async () => {
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
        nonce: "tamp0001".repeat(8),
      });
      await bind(home, descriptors(t));

      const path = join(home, CANONICAL_LEDGER_RELPATH);
      const lines = (await readFile(path, "utf8")).trim().split("\n");
      const e = JSON.parse(lines[1]);
      e.truth_label = "CANONICAL";
      lines[1] = JSON.stringify(e);
      await writeFile(path, lines.join("\n") + "\n");

      const r = await verifyConvergentTaskChain({
        demaHome: home,
        pubkeyPem: t.pubkeyPem,
      });
      assert.equal(r.convergent, false);
      assert.equal(r.stage, "canonical_chain");
      assert.equal(r.layers.formal, false);
      // Signatures were never reached (structure checked first) — must not be
      // claimed converged.
      assert.equal(r.layers.cryptographic, false);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("MULTI-SEGMENT: a later Frankenstein task is NOT masked by an earlier coherent one", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      // Segment 1: a fully coherent task A.
      const a = await task(home, {
        tag: "A",
        actionNow: "2026-05-31T11:00:00.000Z",
        settleNow: "2026-05-31T11:01:00.000Z",
        nonce: "seg0001a".repeat(8),
      });
      await bind(home, descriptors(a));
      // Segment 2: a Frankenstein — C's action with D's impact + SAT.
      const c = await task(home, {
        tag: "C",
        actionNow: "2026-05-31T11:10:00.000Z",
        settleNow: "2026-05-31T11:11:00.000Z",
        nonce: "seg0002c".repeat(8),
      });
      const d = await task(home, {
        tag: "D",
        actionNow: "2026-05-31T11:20:00.000Z",
        settleNow: "2026-05-31T11:21:00.000Z",
        nonce: "seg0003d".repeat(8),
      });
      await bind(home, [
        descriptors(c)[0],
        descriptors(d)[1],
        descriptors(d)[2],
      ]);

      const r = await verifyConvergentTaskChain({
        demaHome: home,
        pubkeyPem: a.pubkeyPem,
      });
      assert.equal(r.convergent, false);
      assert.equal(r.stage, "coherence");
      assert.equal(r.reason, "impact_not_derived_from_action");
      assert.equal(r.segment_index, 1); // the SECOND segment is the bad one
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: a chain missing a required artifact does not converge", async () => {
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
        nonce: "miss0001".repeat(8),
      });
      // bind only action + IMPACT (no SAT)
      await bind(home, [descriptors(t)[0], descriptors(t)[1]]);

      const r = await verifyConvergentTaskChain({
        demaHome: home,
        pubkeyPem: t.pubkeyPem,
      });
      assert.equal(r.convergent, false);
      assert.equal(r.stage, "extract");
      assert.equal(r.reason, "missing_task_artifact_sat");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: an empty chain does not converge", async () => {
    const home = await freshHome();
    try {
      const r = await verifyConvergentTaskChain({
        demaHome: home,
        pubkeyPem:
          "-----BEGIN PUBLIC KEY-----\nmissing\n-----END PUBLIC KEY-----",
      });
      assert.equal(r.convergent, false);
      assert.equal(r.stage, "canonical_chain");
      assert.equal(r.reason, "empty_chain");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
