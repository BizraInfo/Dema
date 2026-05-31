// RECEIPT-CHAIN-1C · bind a flywheel task's artifacts into the canonical chain
//
// Phase A: one task's heterogeneous receipts (flywheel action receipt → impact
// ledger entry → SAT validation receipt) become a single replayable canonical
// prev_hash chain. Closes the "proof spine not bound to the flywheel" gap:
// before this, those artifacts lived in separate ledgers; now a stranger can
// replay the whole task as one canonical chain with the public key alone.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  bindTaskReceiptsToCanonicalChain,
  CANONICAL_TASK_BINDING_SCHEMA,
} from "../packages/receipts/src/canonical-task-binding.js";
import {
  CANONICAL_RECEIPT_CONSENT_PHRASE,
  verifyCanonicalChain,
} from "../packages/receipts/src/canonical-receipt.js";
import {
  CANONICAL_LEDGER_RELPATH,
  loadCanonicalLedger,
} from "../packages/receipts/src/canonical-ledger.js";
import { runOneTaskFlywheel } from "../packages/flywheel/src/flywheel-one-task.js";
import { settleOneTaskFlywheelImpact } from "../packages/flywheel/src/flywheel-settlement.js";
import { proposeFlywheelXpGrant } from "../packages/flywheel/src/flywheel-xp-proposal.js";
import { validateXpGrantProposal } from "../packages/flywheel/src/flywheel-sat-validation.js";
import { GUARDED_CLAIM_CONSENT_PHRASE } from "../packages/receipts/src/assumption-guarded-claim.js";
import { buildConsentProof } from "../packages/receipts/src/consent-proof.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
  loadPublicKey,
} from "../packages/receipts/src/authorship-key-store.js";

const ACTION_NOW = "2026-05-31T10:00:00.000Z";
const SETTLE_NOW = "2026-05-31T10:01:00.000Z";
const VALIDATE_NOW = "2026-05-31T10:02:00.000Z";
const BIND_NOW = "2026-05-31T10:03:00.000Z";
const CONSENT_EXPIRES = "2026-05-31T10:30:00.000Z";

const A_ENVELOPE = Object.freeze({
  claim_state: "A",
  assumption: "Task X is complete.",
  ground: "tests/x.test.js passed 9/9.",
  boundary: "Invalid if x.test.js regresses.",
  rejectable: true,
});

async function freshHome() {
  return mkdtemp(join(tmpdir(), "dema-canon-bind-"));
}

// Run one full task and return its three bindable artifacts + the pubkey.
async function oneTask(home) {
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
  const flywheel = await runOneTaskFlywheel({
    task: "ship RECEIPT-CHAIN-1C",
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
    nonce: "b1nd0001".repeat(8),
    createdAtIso: SETTLE_NOW,
    expiresAtIso: CONSENT_EXPIRES,
  });
  const settlement = await settleOneTaskFlywheelImpact({
    flywheelReceipt: flywheel.flywheel_receipt,
    actionReceiptId: flywheel.action_receipt_id,
    consentProof: consent.consent_proof,
    operatorPubkeyPem: consent.signer_public_key_pem,
    demaHome: home,
    now: SETTLE_NOW,
  });
  assert.equal(settlement.settled, true);
  const proposal = proposeFlywheelXpGrant({
    ledgerEntry: settlement.ledger_entry,
    operatorPubkeyPem: consent.signer_public_key_pem,
    skillId: "proof_engineering",
    agentId: "pat.builder",
    createdAtIso: VALIDATE_NOW,
  });
  const sat = await validateXpGrantProposal({
    proposal,
    ledgerEntry: settlement.ledger_entry,
    validatorAgentId: "sat.economist",
    operatorPubkeyPem: consent.signer_public_key_pem,
    demaHome: home,
    createdAtIso: VALIDATE_NOW,
  });
  assert.equal(sat.validated, true);
  return {
    pubkeyPem: consent.signer_public_key_pem,
    taskReceipts: [
      {
        body: flywheel.flywheel_receipt,
        truthLabel: "LEVEL_B_GROUNDED",
        whatProves:
          "A verified action ran and earned a re-derivable grounding score.",
        whatDoesNotProve: "Does not prove the impact was settled or rewarded.",
      },
      {
        body: settlement.ledger_entry,
        truthLabel: "LEVEL_A_SIGNED",
        whatProves: "A signed local IMPACT_CREDIT was minted for the action.",
        whatDoesNotProve: "Does not prove XP was granted or a lesson learned.",
      },
      {
        body: sat.receipt,
        truthLabel: "LEVEL_A_SIGNED",
        whatProves: "A SAT-5 agent validated the XP eligibility of the impact.",
        whatDoesNotProve:
          "Does not prove XP was minted or the operator approved it.",
      },
    ],
  };
}

describe("RECEIPT-CHAIN-1C · bindTaskReceiptsToCanonicalChain", () => {
  it("happy: binds one task's 3 artifacts into a single replayable canonical chain", async () => {
    const home = await freshHome();
    try {
      const { taskReceipts, pubkeyPem } = await oneTask(home);
      const r = await bindTaskReceiptsToCanonicalChain({
        taskReceipts,
        consent: CANONICAL_RECEIPT_CONSENT_PHRASE,
        demaHome: home,
        now: BIND_NOW,
      });

      assert.equal(r.schema, CANONICAL_TASK_BINDING_SCHEMA);
      assert.equal(r.bound, true);
      assert.equal(r.chain_length, 3);
      assert.equal(r.receipt_ids.length, 3);
      assert.equal(r.replay.verified, true);
      assert.equal(r.replay.total_entries, 3);

      // The ledger on disk is one prev_hash chain; a stranger replays it.
      const entries = await loadCanonicalLedger({ demaHome: home });
      assert.equal(entries.length, 3);
      assert.equal(entries[0].prev_hash, null);
      assert.equal(entries[1].prev_hash, entries[0].receipt_id);
      assert.equal(entries[2].prev_hash, entries[1].receipt_id);
      const v = verifyCanonicalChain({ entries, pubkeyPem });
      assert.equal(v.verified, true);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("tamper: corrupting any bound entry fails the canonical replay", async () => {
    const home = await freshHome();
    try {
      const { taskReceipts } = await oneTask(home);
      const r = await bindTaskReceiptsToCanonicalChain({
        taskReceipts,
        consent: CANONICAL_RECEIPT_CONSENT_PHRASE,
        demaHome: home,
        now: BIND_NOW,
      });
      assert.equal(r.bound, true);

      const path = join(home, CANONICAL_LEDGER_RELPATH);
      const lines = (await readFile(path, "utf8")).trim().split("\n");
      const mid = JSON.parse(lines[1]);
      mid.truth_label = "CANONICAL"; // tamper a signed body field
      lines[1] = JSON.stringify(mid);
      await writeFile(path, lines.join("\n") + "\n");

      const reloaded = await loadCanonicalLedger({ demaHome: home });
      const pubkey = await loadPublicKey(home);
      const v = verifyCanonicalChain({ entries: reloaded, pubkeyPem: pubkey });
      assert.equal(v.verified, false);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: wrong consent binds nothing and writes no ledger", async () => {
    const home = await freshHome();
    try {
      const { taskReceipts } = await oneTask(home);
      const r = await bindTaskReceiptsToCanonicalChain({
        taskReceipts,
        consent: "GO: whatever",
        demaHome: home,
        now: BIND_NOW,
      });
      assert.equal(r.bound, false);
      assert.equal(r.error, "consent_required");
      assert.deepEqual(await loadCanonicalLedger({ demaHome: home }), []);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: empty task receipts is rejected", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const r = await bindTaskReceiptsToCanonicalChain({
        taskReceipts: [],
        consent: CANONICAL_RECEIPT_CONSENT_PHRASE,
        demaHome: home,
        now: BIND_NOW,
      });
      assert.equal(r.bound, false);
      assert.equal(r.error, "task_receipts_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: a JSON-unsafe body is rejected up front, leaving no half-bound chain", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const r = await bindTaskReceiptsToCanonicalChain({
        taskReceipts: [
          {
            body: { schema: "x", nope: () => 1 }, // function -> not JSON-safe
            truthLabel: "LEVEL_A_SIGNED",
            whatProves: "x",
            whatDoesNotProve: "y",
          },
        ],
        consent: CANONICAL_RECEIPT_CONSENT_PHRASE,
        demaHome: home,
        now: BIND_NOW,
      });
      assert.equal(r.bound, false);
      assert.equal(r.error, "task_receipt_body_invalid");
      assert.deepEqual(await loadCanonicalLedger({ demaHome: home }), []);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: missing now refuses nondeterministic binding", async () => {
    const home = await freshHome();
    try {
      const { taskReceipts } = await oneTask(home);
      const r = await bindTaskReceiptsToCanonicalChain({
        taskReceipts,
        consent: CANONICAL_RECEIPT_CONSENT_PHRASE,
        demaHome: home,
      });
      assert.equal(r.bound, false);
      assert.equal(r.error, "created_at_iso_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
