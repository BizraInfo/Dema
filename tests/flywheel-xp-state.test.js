// FLYWHEEL-1F · durable local XP state append tests.
//
// Minimal §19 step-11 durability slice: take the FLYWHEEL-1E bridge output,
// append a replayable skill-ledger state record under DEMA_HOME, then verify
// the whole XP state chain before reporting success.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { runOneTaskFlywheel } from "../packages/flywheel/src/flywheel-one-task.js";
import { settleOneTaskFlywheelImpact } from "../packages/flywheel/src/flywheel-settlement.js";
import { proposeFlywheelXpGrant } from "../packages/flywheel/src/flywheel-xp-proposal.js";
import { validateXpGrantProposal } from "../packages/flywheel/src/flywheel-sat-validation.js";
import { buildFlywheelXpMintConsentScope } from "../packages/flywheel/src/flywheel-xp-mint.js";
import {
  appendFlywheelXpState,
  loadFlywheelXpState,
  verifyFlywheelXpState,
  FLYWHEEL_XP_STATE_APPEND_SCHEMA,
  FLYWHEEL_XP_STATE_RELPATH,
} from "../packages/flywheel/src/flywheel-xp-state.js";
import { GUARDED_CLAIM_CONSENT_PHRASE } from "../packages/receipts/src/assumption-guarded-claim.js";
import { buildConsentProof } from "../packages/receipts/src/consent-proof.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";

const SUBJECT = "pat.builder";
const VALIDATOR = "sat.economist";
const ACTION_NOW_A = "2026-05-31T07:00:00.000Z";
const ACTION_NOW_B = "2026-05-31T07:10:00.000Z";
const SETTLE_NOW_A = "2026-05-31T07:01:00.000Z";
const SETTLE_NOW_B = "2026-05-31T07:11:00.000Z";
const VALIDATE_NOW_A = "2026-05-31T07:02:00.000Z";
const VALIDATE_NOW_B = "2026-05-31T07:12:00.000Z";
const MINT_NOW_A = "2026-05-31T07:03:00.000Z";
const MINT_NOW_B = "2026-05-31T07:13:00.000Z";
const EXPIRES_A = "2026-05-31T07:30:00.000Z";
const EXPIRES_B = "2026-05-31T07:40:00.000Z";

const A_ENVELOPE = Object.freeze({
  claim_state: "A",
  assumption: "Task X is complete.",
  ground: "tests/x.test.js passed 9/9.",
  boundary: "Invalid if x.test.js regresses.",
  rejectable: true,
});

const V_ENVELOPE = Object.freeze({
  claim_state: "V",
  evidence_refs: ["tests/x.test.js"],
});

async function freshHome() {
  return mkdtemp(join(tmpdir(), "dema-flywheel-xp-state-"));
}

async function initKey(home) {
  const r = await initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE,
    demaHome: home,
  });
  assert.equal(r.initialized, true);
}

async function buildReadyContext({
  home,
  task,
  envelope,
  actionNow,
  settleNow,
  validateNow,
  settleNonce,
}) {
  const flywheel = await runOneTaskFlywheel({
    task,
    envelope,
    consent: GUARDED_CLAIM_CONSENT_PHRASE,
    demaHome: home,
    now: actionNow,
  });
  assert.equal(flywheel.completed, true);

  const settleConsent = await buildConsentProof({
    phrase: "MINT LEDGER ENTRY",
    actionScope: {
      action_type: "MINT_LEDGER_ENTRY",
      target_hash: flywheel.flywheel_receipt.receipt_id,
    },
    demaHome: home,
    nonce: settleNonce,
    createdAtIso: settleNow,
    expiresAtIso: EXPIRES_A,
  });
  assert.equal(settleConsent.built, true);

  const settlement = await settleOneTaskFlywheelImpact({
    flywheelReceipt: flywheel.flywheel_receipt,
    actionReceiptId: flywheel.action_receipt_id,
    consentProof: settleConsent.consent_proof,
    operatorPubkeyPem: settleConsent.signer_public_key_pem,
    demaHome: home,
    now: settleNow,
    prevLedgerHash: null,
  });
  assert.equal(settlement.settled, true);

  const proposal = proposeFlywheelXpGrant({
    ledgerEntry: settlement.ledger_entry,
    operatorPubkeyPem: settleConsent.signer_public_key_pem,
    skillId: "proof_engineering",
    agentId: SUBJECT,
    createdAtIso: validateNow,
  });
  assert.equal(proposal.proposed, true);

  const sat = await validateXpGrantProposal({
    proposal,
    ledgerEntry: settlement.ledger_entry,
    validatorAgentId: VALIDATOR,
    operatorPubkeyPem: settleConsent.signer_public_key_pem,
    demaHome: home,
    createdAtIso: validateNow,
  });
  assert.equal(sat.validated, true);

  return {
    ledgerEntry: settlement.ledger_entry,
    proposal,
    satReceipt: sat.receipt,
    pubkeyPem: settleConsent.signer_public_key_pem,
  };
}

async function buildMintConsent({
  home,
  context,
  mintNow,
  nonce,
  expiresAtIso = EXPIRES_A,
  actionScope,
}) {
  const scope = await buildFlywheelXpMintConsentScope({
    proposal: context.proposal,
    ledgerEntry: context.ledgerEntry,
    satValidationReceipt: context.satReceipt,
    operatorPubkeyPem: context.pubkeyPem,
    demaHome: home,
    createdAtIso: mintNow,
  });
  assert.equal(scope.built, true, scope.error);

  const consent = await buildConsentProof({
    phrase: "SIGN AUTHORSHIP RECEIPT",
    actionScope: actionScope || scope.action_scope,
    demaHome: home,
    nonce,
    createdAtIso: mintNow,
    expiresAtIso,
  });
  assert.equal(consent.built, true);
  return consent.consent_proof;
}

async function appendReadyXpState({ home, context, mintNow, nonce }) {
  const consentProof = await buildMintConsent({
    home,
    context,
    mintNow,
    nonce,
  });
  return appendFlywheelXpState({
    proposal: context.proposal,
    ledgerEntry: context.ledgerEntry,
    satValidationReceipt: context.satReceipt,
    operatorPubkeyPem: context.pubkeyPem,
    consentProof,
    demaHome: home,
    createdAtIso: mintNow,
  });
}

describe("FLYWHEEL-1F · durable XP state append", () => {
  it("happy: appends first XP state record and replays the persisted chain", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const context = await buildReadyContext({
        home,
        task: "ship FLYWHEEL-1F",
        envelope: A_ENVELOPE,
        actionNow: ACTION_NOW_A,
        settleNow: SETTLE_NOW_A,
        validateNow: VALIDATE_NOW_A,
        settleNonce: "f1a00001".repeat(8),
      });

      const r = await appendReadyXpState({
        home,
        context,
        mintNow: MINT_NOW_A,
        nonce: "f1a00002".repeat(8),
      });

      assert.equal(r.schema, FLYWHEEL_XP_STATE_APPEND_SCHEMA);
      assert.equal(r.appended, true, r.error);
      assert.equal(r.truth_label, "LOCAL_FLYWHEEL_XP_STATE_APPEND_VERIFIED");
      assert.equal(r.length, 1);
      assert.equal(r.record.prev_state_hash, null);
      assert.equal(r.record.agent_id, SUBJECT);
      assert.equal(r.record.skill_ledger.xp_total, context.ledgerEntry.amount);
      assert.equal(r.replay.verified, true);
      assert.equal(r.replay.total_records, 1);
      assert.equal(r.replay.chain_root_hash, r.record.state_hash);
      assert.equal(r.path.endsWith(FLYWHEEL_XP_STATE_RELPATH), true);
      assert.equal(r.boundary.file_write_performed, true);
      assert.equal(r.boundary.operator_dema_home_mutated, true);
      assert.equal(r.boundary.public_economic_claim_made, false);
      assert.equal(r.boundary.network_used, false);

      const loaded = await loadFlywheelXpState({ demaHome: home });
      assert.equal(loaded.length, 1);
      assert.equal(loaded[0].state_hash, r.record.state_hash);

      const verified = await verifyFlywheelXpState({
        demaHome: home,
        pubkeyPem: context.pubkeyPem,
      });
      assert.equal(verified.verified, true, verified.reason);
      assert.equal(verified.agent_summaries[SUBJECT].xp_total, context.ledgerEntry.amount);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("chains the second XP state record to the first and aggregates replay totals", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const firstContext = await buildReadyContext({
        home,
        task: "a",
        envelope: A_ENVELOPE,
        actionNow: ACTION_NOW_A,
        settleNow: SETTLE_NOW_A,
        validateNow: VALIDATE_NOW_A,
        settleNonce: "a1".repeat(32),
      });
      const first = await appendReadyXpState({
        home,
        context: firstContext,
        mintNow: MINT_NOW_A,
        nonce: "a2".repeat(32),
      });
      assert.equal(first.appended, true);

      const secondContext = await buildReadyContext({
        home,
        task: "b",
        envelope: V_ENVELOPE,
        actionNow: ACTION_NOW_B,
        settleNow: SETTLE_NOW_B,
        validateNow: VALIDATE_NOW_B,
        settleNonce: "b1".repeat(32),
      });
      const second = await appendReadyXpState({
        home,
        context: secondContext,
        mintNow: MINT_NOW_B,
        nonce: "b2".repeat(32),
      });

      assert.equal(second.appended, true, second.error);
      assert.equal(second.length, 2);
      assert.equal(second.record.prev_state_hash, first.record.state_hash);
      assert.equal(second.replay.verified, true);
      assert.equal(second.replay.total_records, 2);
      assert.equal(
        second.replay.agent_summaries[SUBJECT].xp_total,
        firstContext.ledgerEntry.amount + secondContext.ledgerEntry.amount,
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("refuses to extend a corrupt XP state file and preserves the existing line", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const context = await buildReadyContext({
        home,
        task: "a",
        envelope: A_ENVELOPE,
        actionNow: ACTION_NOW_A,
        settleNow: SETTLE_NOW_A,
        validateNow: VALIDATE_NOW_A,
        settleNonce: "c1".repeat(32),
      });
      const first = await appendReadyXpState({
        home,
        context,
        mintNow: MINT_NOW_A,
        nonce: "c2".repeat(32),
      });
      assert.equal(first.appended, true);

      const path = join(home, FLYWHEEL_XP_STATE_RELPATH);
      const [line] = (await readFile(path, "utf8")).trim().split("\n");
      const record = JSON.parse(line);
      record.skill_ledger.xp_total = 999;
      await writeFile(path, `${JSON.stringify(record)}\n`);

      const nextContext = await buildReadyContext({
        home,
        task: "b",
        envelope: V_ENVELOPE,
        actionNow: ACTION_NOW_B,
        settleNow: SETTLE_NOW_B,
        validateNow: VALIDATE_NOW_B,
        settleNonce: "d1".repeat(32),
      });
      const consentProof = await buildMintConsent({
        home,
        context: nextContext,
        mintNow: MINT_NOW_B,
        nonce: "d2".repeat(32),
        expiresAtIso: EXPIRES_B,
      });
      const r = await appendFlywheelXpState({
        proposal: nextContext.proposal,
        ledgerEntry: nextContext.ledgerEntry,
        satValidationReceipt: nextContext.satReceipt,
        operatorPubkeyPem: nextContext.pubkeyPem,
        consentProof,
        demaHome: home,
        createdAtIso: MINT_NOW_B,
      });

      assert.equal(r.appended, false);
      assert.equal(r.error, "xp_state_chain_broken");
      assert.equal(r.reason, "skill_ledger_verification_failed");
      assert.equal((await loadFlywheelXpState({ demaHome: home })).length, 1);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: bad consent does not create the XP state file", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const context = await buildReadyContext({
        home,
        task: "bad consent",
        envelope: A_ENVELOPE,
        actionNow: ACTION_NOW_A,
        settleNow: SETTLE_NOW_A,
        validateNow: VALIDATE_NOW_A,
        settleNonce: "e1".repeat(32),
      });
      const consentProof = await buildMintConsent({
        home,
        context,
        mintNow: MINT_NOW_A,
        nonce: "e2".repeat(32),
        actionScope: {
          action_type: "MUTATE_AGENT_PROFILE",
          target_hash: "0".repeat(64),
        },
      });

      const r = await appendFlywheelXpState({
        proposal: context.proposal,
        ledgerEntry: context.ledgerEntry,
        satValidationReceipt: context.satReceipt,
        operatorPubkeyPem: context.pubkeyPem,
        consentProof,
        demaHome: home,
        createdAtIso: MINT_NOW_A,
      });

      assert.equal(r.appended, false);
      assert.equal(r.stage, "xp_mint");
      assert.equal(r.error, "consent_scope_mismatch");
      assert.deepEqual(await loadFlywheelXpState({ demaHome: home }), []);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: non-JSON XP state is unreadable, not empty", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const path = join(home, FLYWHEEL_XP_STATE_RELPATH);
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      await writeFile(path, "not json\n", { encoding: "utf8" });

      const context = await buildReadyContext({
        home,
        task: "bad file",
        envelope: A_ENVELOPE,
        actionNow: ACTION_NOW_A,
        settleNow: SETTLE_NOW_A,
        validateNow: VALIDATE_NOW_A,
        settleNonce: "f1".repeat(32),
      });
      const consentProof = await buildMintConsent({
        home,
        context,
        mintNow: MINT_NOW_A,
        nonce: "f2".repeat(32),
      });

      const r = await appendFlywheelXpState({
        proposal: context.proposal,
        ledgerEntry: context.ledgerEntry,
        satValidationReceipt: context.satReceipt,
        operatorPubkeyPem: context.pubkeyPem,
        consentProof,
        demaHome: home,
        createdAtIso: MINT_NOW_A,
      });

      assert.equal(r.appended, false);
      assert.equal(r.error, "xp_state_unreadable");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("verified append envelope contains no private-key or public-economy material", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const context = await buildReadyContext({
        home,
        task: "no leaks",
        envelope: A_ENVELOPE,
        actionNow: ACTION_NOW_A,
        settleNow: SETTLE_NOW_A,
        validateNow: VALIDATE_NOW_A,
        settleNonce: "aa".repeat(32),
      });
      const r = await appendReadyXpState({
        home,
        context,
        mintNow: MINT_NOW_A,
        nonce: "bb".repeat(32),
      });
      assert.equal(r.appended, true);

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
