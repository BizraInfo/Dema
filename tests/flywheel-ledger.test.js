// FLYWHEEL-1C · durable local ledger append tests
//
// Minimal durable settlement slice: take the FLYWHEEL-1B bridge output, append
// the resulting ECON entry to a local ledger file, then verify the whole ledger
// with ECON-1B replay before reporting success.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdir, mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  runOneTaskFlywheel,
  scoreEpistemicGrounding,
} from "../packages/flywheel/src/flywheel-one-task.js";
import {
  appendFlywheelImpactSettlement,
  loadFlywheelImpactLedger,
  verifyFlywheelImpactLedger,
  FLYWHEEL_IMPACT_LEDGER_RELPATH,
  FLYWHEEL_LEDGER_APPEND_SCHEMA,
} from "../packages/flywheel/src/flywheel-ledger.js";
import { GUARDED_CLAIM_CONSENT_PHRASE } from "../packages/receipts/src/assumption-guarded-claim.js";
import { buildConsentProof } from "../packages/receipts/src/consent-proof.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";

const ACTION_NOW_A = "2026-05-30T15:00:00.000Z";
const ACTION_NOW_B = "2026-05-30T15:02:00.000Z";
const SETTLE_NOW_A = "2026-05-30T15:01:00.000Z";
const SETTLE_NOW_B = "2026-05-30T15:03:00.000Z";
const CONSENT_EXPIRES = "2026-05-30T15:10:00.000Z";

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
  return mkdtemp(join(tmpdir(), "dema-flywheel-ledger-"));
}

async function initKey(home) {
  const r = await initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE,
    demaHome: home,
  });
  assert.equal(r.initialized, true);
}

async function runFlywheel(home, envelope, now, task = "ship FLYWHEEL-1C") {
  const r = await runOneTaskFlywheel({
    task,
    envelope,
    consent: GUARDED_CLAIM_CONSENT_PHRASE,
    demaHome: home,
    now,
  });
  assert.equal(r.completed, true);
  return r;
}

async function mintConsent(
  home,
  targetHash,
  now,
  nonce = "c0ffee00".repeat(8),
) {
  const r = await buildConsentProof({
    phrase: "MINT LEDGER ENTRY",
    actionScope: {
      action_type: "MINT_LEDGER_ENTRY",
      target_hash: targetHash,
    },
    demaHome: home,
    nonce,
    createdAtIso: now,
    expiresAtIso: CONSENT_EXPIRES,
  });
  assert.equal(r.built, true);
  return r;
}

describe("FLYWHEEL-1C · durable impact ledger append", () => {
  it("happy: appends first settlement as replay-verified genesis entry", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const flywheel = await runFlywheel(home, A_ENVELOPE, ACTION_NOW_A);
      const consent = await mintConsent(
        home,
        flywheel.flywheel_receipt.receipt_id,
        SETTLE_NOW_A,
      );

      const r = await appendFlywheelImpactSettlement({
        flywheelReceipt: flywheel.flywheel_receipt,
        actionReceiptId: flywheel.action_receipt_id,
        consentProof: consent.consent_proof,
        operatorPubkeyPem: consent.signer_public_key_pem,
        demaHome: home,
        now: SETTLE_NOW_A,
      });

      assert.equal(r.schema, FLYWHEEL_LEDGER_APPEND_SCHEMA);
      assert.equal(r.appended, true);
      assert.equal(
        r.truth_label,
        "LOCAL_FLYWHEEL_IMPACT_LEDGER_APPEND_VERIFIED",
      );
      assert.equal(r.length, 1);
      assert.equal(r.ledger_entry.prev_hash, null);
      assert.equal(r.ledger_entry.amount, scoreEpistemicGrounding("A") * 100);
      assert.equal(r.replay.verified, true);
      assert.equal(r.replay.total_entries, 1);
      assert.equal(r.replay.chain_root_hash, r.ledger_entry.entry_hash);
      assert.equal(r.path.endsWith(FLYWHEEL_IMPACT_LEDGER_RELPATH), true);
      assert.equal(r.boundary.file_write_performed, true);
      assert.equal(r.boundary.operator_dema_home_mutated, true);
      assert.equal(r.boundary.network_used, false);
      assert.equal(r.boundary.public_economic_claim_made, false);

      const loaded = await loadFlywheelImpactLedger({ demaHome: home });
      assert.equal(loaded.length, 1);
      assert.equal(loaded[0].entry_hash, r.ledger_entry.entry_hash);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: re-settling the same flywheel receipt is rejected as a duplicate", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const flywheel = await runFlywheel(home, A_ENVELOPE, ACTION_NOW_A);
      const consent = await mintConsent(
        home,
        flywheel.flywheel_receipt.receipt_id,
        SETTLE_NOW_A,
      );
      const first = await appendFlywheelImpactSettlement({
        flywheelReceipt: flywheel.flywheel_receipt,
        actionReceiptId: flywheel.action_receipt_id,
        consentProof: consent.consent_proof,
        operatorPubkeyPem: consent.signer_public_key_pem,
        demaHome: home,
        now: SETTLE_NOW_A,
      });
      assert.equal(first.appended, true);

      // Same action, fresh still-valid consent — must NOT mint a second
      // IMPACT_CREDIT (would inflate the ledger while replay still verifies).
      const dupConsent = await mintConsent(
        home,
        flywheel.flywheel_receipt.receipt_id,
        SETTLE_NOW_B,
        "dup00001".repeat(8),
      );
      const dup = await appendFlywheelImpactSettlement({
        flywheelReceipt: flywheel.flywheel_receipt,
        actionReceiptId: flywheel.action_receipt_id,
        consentProof: dupConsent.consent_proof,
        operatorPubkeyPem: dupConsent.signer_public_key_pem,
        demaHome: home,
        now: SETTLE_NOW_B,
      });
      assert.equal(dup.appended, false);
      assert.equal(dup.error, "duplicate_settlement");
      assert.equal(
        (await loadFlywheelImpactLedger({ demaHome: home })).length,
        1,
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("chains the second settlement to the first and verifies the full ledger", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const first = await runFlywheel(home, A_ENVELOPE, ACTION_NOW_A, "a");
      const firstConsent = await mintConsent(
        home,
        first.flywheel_receipt.receipt_id,
        SETTLE_NOW_A,
        "a1".repeat(32),
      );
      const a = await appendFlywheelImpactSettlement({
        flywheelReceipt: first.flywheel_receipt,
        actionReceiptId: first.action_receipt_id,
        consentProof: firstConsent.consent_proof,
        operatorPubkeyPem: firstConsent.signer_public_key_pem,
        demaHome: home,
        now: SETTLE_NOW_A,
      });
      assert.equal(a.appended, true);

      const second = await runFlywheel(home, V_ENVELOPE, ACTION_NOW_B, "b");
      const secondConsent = await mintConsent(
        home,
        second.flywheel_receipt.receipt_id,
        SETTLE_NOW_B,
        "b2".repeat(32),
      );
      const b = await appendFlywheelImpactSettlement({
        flywheelReceipt: second.flywheel_receipt,
        actionReceiptId: second.action_receipt_id,
        consentProof: secondConsent.consent_proof,
        operatorPubkeyPem: secondConsent.signer_public_key_pem,
        demaHome: home,
        now: SETTLE_NOW_B,
      });

      assert.equal(b.appended, true);
      assert.equal(b.length, 2);
      assert.equal(b.ledger_entry.prev_hash, a.ledger_entry.entry_hash);
      assert.equal(b.ledger_entry.amount, 100);
      assert.equal(b.replay.verified, true);
      assert.equal(b.replay.total_entries, 2);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("refuses to extend a corrupt ledger and does not append", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const flywheel = await runFlywheel(home, A_ENVELOPE, ACTION_NOW_A);
      const consent = await mintConsent(
        home,
        flywheel.flywheel_receipt.receipt_id,
        SETTLE_NOW_A,
      );
      const first = await appendFlywheelImpactSettlement({
        flywheelReceipt: flywheel.flywheel_receipt,
        actionReceiptId: flywheel.action_receipt_id,
        consentProof: consent.consent_proof,
        operatorPubkeyPem: consent.signer_public_key_pem,
        demaHome: home,
        now: SETTLE_NOW_A,
      });
      assert.equal(first.appended, true);

      const path = join(home, FLYWHEEL_IMPACT_LEDGER_RELPATH);
      const [line] = (await readFile(path, "utf8")).trim().split("\n");
      const entry = JSON.parse(line);
      entry.amount = 999;
      await writeFile(path, JSON.stringify(entry) + "\n");

      const nextFlywheel = await runFlywheel(home, V_ENVELOPE, ACTION_NOW_B);
      const nextConsent = await mintConsent(
        home,
        nextFlywheel.flywheel_receipt.receipt_id,
        SETTLE_NOW_B,
        "b3".repeat(32),
      );
      const r = await appendFlywheelImpactSettlement({
        flywheelReceipt: nextFlywheel.flywheel_receipt,
        actionReceiptId: nextFlywheel.action_receipt_id,
        consentProof: nextConsent.consent_proof,
        operatorPubkeyPem: nextConsent.signer_public_key_pem,
        demaHome: home,
        now: SETTLE_NOW_B,
      });

      assert.equal(r.appended, false);
      assert.equal(r.error, "ledger_chain_broken");
      assert.equal(r.reason, "entry_hash_mismatch");
      assert.equal(
        (await loadFlywheelImpactLedger({ demaHome: home })).length,
        1,
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: bad consent does not create the ledger file", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const flywheel = await runFlywheel(home, A_ENVELOPE, ACTION_NOW_A);
      const consent = await mintConsent(home, "f".repeat(64), SETTLE_NOW_A);

      const r = await appendFlywheelImpactSettlement({
        flywheelReceipt: flywheel.flywheel_receipt,
        actionReceiptId: flywheel.action_receipt_id,
        consentProof: consent.consent_proof,
        operatorPubkeyPem: consent.signer_public_key_pem,
        demaHome: home,
        now: SETTLE_NOW_A,
      });

      assert.equal(r.appended, false);
      assert.equal(r.stage, "settlement");
      assert.equal(r.error, "consent_scope_mismatch");
      assert.deepEqual(await loadFlywheelImpactLedger({ demaHome: home }), []);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: non-JSON ledger is unreadable, not empty", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const path = join(home, FLYWHEEL_IMPACT_LEDGER_RELPATH);
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      await writeFile(path, "not json\n", { encoding: "utf8" });

      const flywheel = await runFlywheel(home, A_ENVELOPE, ACTION_NOW_A);
      const consent = await mintConsent(
        home,
        flywheel.flywheel_receipt.receipt_id,
        SETTLE_NOW_A,
      );
      const r = await appendFlywheelImpactSettlement({
        flywheelReceipt: flywheel.flywheel_receipt,
        actionReceiptId: flywheel.action_receipt_id,
        consentProof: consent.consent_proof,
        operatorPubkeyPem: consent.signer_public_key_pem,
        demaHome: home,
        now: SETTLE_NOW_A,
      });

      assert.equal(r.appended, false);
      assert.equal(r.error, "ledger_unreadable");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("verified append envelope contains no public-economy or private-key material", async () => {
    const home = await freshHome();
    try {
      await initKey(home);
      const flywheel = await runFlywheel(home, A_ENVELOPE, ACTION_NOW_A);
      const consent = await mintConsent(
        home,
        flywheel.flywheel_receipt.receipt_id,
        SETTLE_NOW_A,
      );
      const r = await appendFlywheelImpactSettlement({
        flywheelReceipt: flywheel.flywheel_receipt,
        actionReceiptId: flywheel.action_receipt_id,
        consentProof: consent.consent_proof,
        operatorPubkeyPem: consent.signer_public_key_pem,
        demaHome: home,
        now: SETTLE_NOW_A,
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

  it("verifyFlywheelImpactLedger returns verified empty chain when file is absent", async () => {
    const home = await freshHome();
    try {
      const r = await verifyFlywheelImpactLedger({
        demaHome: home,
        pubkeyPem:
          "-----BEGIN PUBLIC KEY-----\nmissing\n-----END PUBLIC KEY-----",
      });
      assert.equal(r.verified, true);
      assert.equal(r.total_entries, 0);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
