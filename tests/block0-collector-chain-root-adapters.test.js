// LEDGER-ROOT-ADAPT · Block0 chain-root ledger adapters
//
// Adds adapter kind:"chain_root" so a slot's proof is an ARRAY of ledger entries
// whose deterministic chain root is re-derived by an EXISTING pure verifier, and
// the slot hash is the verifier's returned chain_root_hash:
//   canonical_receipt_ledger_root_hash   via verifyCanonicalChain  (RECEIPT-CHAIN-1A)
//   genesis_local_token_ledger_root_hash via verifyLedgerReplay    (ECON-1B)
//
// PROOF BOUNDARY: proves the SUPPLIED chain replays to a deterministic signed
// root. Does NOT prove the chain is complete/authoritative, nor any public token
// activity (genesis_local_token = LOCAL simulation only).

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectBlock0PrerequisiteStatus } from "../packages/genesis/src/block0-prerequisite-status-collector.js";
import { judgeBlock0FromProofs } from "../packages/genesis/src/block0-judge-from-proofs.js";
import {
  buildCanonicalReceipt,
  CANONICAL_RECEIPT_CONSENT_PHRASE,
} from "../packages/receipts/src/canonical-receipt.js";
import { buildLedgerEntry } from "../packages/econ/src/dual-token-ledger.js";
import {
  buildBlock0Manifest,
  BLOCK0_ACTION_TYPE,
} from "../packages/genesis/src/block0-manifest.js";
import { buildConsentProof } from "../packages/receipts/src/consent-proof.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
  loadPublicKey,
} from "../packages/receipts/src/authorship-key-store.js";
import {
  sha256,
  stableStringify,
} from "../packages/consent/src/consent-common.js";

const CREATED = "2026-06-01T17:00:00.000Z";
const H = (s) => sha256(`ledger-root-fixture:${s}`);
const RECEIPT_SLOT = "canonical_receipt_ledger_root_hash";
const TOKEN_SLOT = "genesis_local_token_ledger_root_hash";

async function freshHome() {
  return mkdtemp(join(tmpdir(), "dema-ledger-root-"));
}

// Real signed canonical-receipt chain (2 entries, prev_hash linked).
async function buildReceiptChain(home) {
  const r0 = await buildCanonicalReceipt({
    canonicalBody: { step: 0, note: "genesis" },
    prevHash: null,
    truthLabel: "MEASURED_LOCAL",
    whatProves: "the operator authored this body",
    whatDoesNotProve: "nothing public",
    consent: CANONICAL_RECEIPT_CONSENT_PHRASE,
    demaHome: home,
    now: "2026-06-01T16:00:00.000Z",
  });
  assert.equal(r0.built, true, r0.error);
  const r1 = await buildCanonicalReceipt({
    canonicalBody: { step: 1, note: "second" },
    prevHash: r0.receipt.receipt_id,
    truthLabel: "MEASURED_LOCAL",
    whatProves: "the operator authored this body",
    whatDoesNotProve: "nothing public",
    consent: CANONICAL_RECEIPT_CONSENT_PHRASE,
    demaHome: home,
    now: "2026-06-01T16:00:01.000Z",
  });
  assert.equal(r1.built, true, r1.error);
  return [r0.receipt, r1.receipt];
}

// Real signed local token-ledger chain (2 entries, prev_hash linked).
async function buildTokenChain(home) {
  const cp = await buildConsentProof({
    phrase: "MINT LEDGER ENTRY",
    actionScope: {
      action_type: "MINT_LEDGER_ENTRY",
      target_hash: "f".repeat(64),
    },
    demaHome: home,
    nonce: "tokchain".repeat(8),
    createdAtIso: "2026-06-01T15:59:00.000Z",
    expiresAtIso: "2026-06-01T16:04:00.000Z",
  });
  assert.equal(cp.built, true, cp.error);
  const e0 = await buildLedgerEntry({
    entry_type: "RESOURCE_DEBIT",
    token_class: "RESOURCE",
    amount: 5,
    evidence_receipt_hashes: ["a".repeat(64)],
    prev_hash: null,
    consentProof: cp.consent_proof,
    demaHome: home,
    createdAtIso: "2026-06-01T16:00:00.000Z",
  });
  assert.ok(e0.entry_hash, `e0 build failed: ${e0.error}`);
  const e1 = await buildLedgerEntry({
    entry_type: "RESOURCE_DEBIT",
    token_class: "RESOURCE",
    amount: 7,
    evidence_receipt_hashes: ["b".repeat(64)],
    prev_hash: e0.entry_hash,
    consentProof: cp.consent_proof,
    demaHome: home,
    createdAtIso: "2026-06-01T16:00:01.000Z",
  });
  assert.ok(e1.entry_hash, `e1 build failed: ${e1.error}`);
  return [e0, e1];
}

async function buildChains(home) {
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
  const pubkeyPem = await loadPublicKey(home);
  const receipts = await buildReceiptChain(home);
  const tokens = await buildTokenChain(home);
  return { pubkeyPem, receipts, tokens };
}

describe("LEDGER-ROOT-ADAPT · chain_root adapters", () => {
  it("happy: valid receipt + token chains become PRODUCER_LIVE; root_hash surfaced", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem, receipts, tokens } = await buildChains(home);
      const r = collectBlock0PrerequisiteStatus({
        proofs: { [RECEIPT_SLOT]: receipts, [TOKEN_SLOT]: tokens },
        operatorPubkeyPem: pubkeyPem,
      });
      assert.equal(r.collected, true, r.error);
      assert.equal(r.status_map[RECEIPT_SLOT], "PRODUCER_LIVE");
      assert.equal(r.status_map[TOKEN_SLOT], "PRODUCER_LIVE");
      assert.equal(r.producer_live_count, 2);
      assert.match(
        r.slot_verification[RECEIPT_SLOT].root_hash,
        /^[a-f0-9]{64}$/,
      );
      assert.equal(
        r.slot_verification[TOKEN_SLOT].root_hash,
        tokens[tokens.length - 1].entry_hash,
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: empty entries → NAMED_ONLY", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem } = await buildChains(home);
      const r = collectBlock0PrerequisiteStatus({
        proofs: { [RECEIPT_SLOT]: [] },
        operatorPubkeyPem: pubkeyPem,
      });
      assert.equal(r.status_map[RECEIPT_SLOT], "NAMED_ONLY");
      assert.equal(r.slot_verification[RECEIPT_SLOT].verified, false);
      assert.equal(r.producer_live_count, 0);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: broken prev_hash chain → NAMED_ONLY", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem, receipts } = await buildChains(home);
      const broken = [receipts[0], { ...receipts[1], prev_hash: H("wrong") }];
      const r = collectBlock0PrerequisiteStatus({
        proofs: { [RECEIPT_SLOT]: broken },
        operatorPubkeyPem: pubkeyPem,
      });
      assert.equal(r.status_map[RECEIPT_SLOT], "NAMED_ONLY");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: tampered receipt body → NAMED_ONLY", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem, receipts } = await buildChains(home);
      const tampered = [{ ...receipts[0], note: "MUTATED" }, receipts[1]];
      const r = collectBlock0PrerequisiteStatus({
        proofs: { [RECEIPT_SLOT]: tampered },
        operatorPubkeyPem: pubkeyPem,
      });
      assert.equal(r.status_map[RECEIPT_SLOT], "NAMED_ONLY");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: wrong external pubkey → both NAMED_ONLY", async () => {
    const home = await freshHome();
    const other = await freshHome();
    try {
      const { receipts, tokens } = await buildChains(home);
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: other,
      });
      const foreign = await loadPublicKey(other);
      const r = collectBlock0PrerequisiteStatus({
        proofs: { [RECEIPT_SLOT]: receipts, [TOKEN_SLOT]: tokens },
        operatorPubkeyPem: foreign,
      });
      assert.equal(r.producer_live_count, 0);
      assert.equal(r.status_map[RECEIPT_SLOT], "NAMED_ONLY");
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(other, { recursive: true, force: true });
    }
  });

  it("judge: manifest committing the real roots → both bound PRODUCER_LIVE", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem, receipts, tokens } = await buildChains(home);
      const collected = collectBlock0PrerequisiteStatus({
        proofs: { [RECEIPT_SLOT]: receipts, [TOKEN_SLOT]: tokens },
        operatorPubkeyPem: pubkeyPem,
      });
      const receiptRoot = collected.slot_verification[RECEIPT_SLOT].root_hash;
      const tokenRoot = collected.slot_verification[TOKEN_SLOT].root_hash;

      const prerequisites = {
        keyconsent_integration_complete: true,
        keyconsent_truth_labels: ["MEASURED:kernel"],
        canonical_receipt_ledger_root_hash: receiptRoot,
        node0_identity_proof_hash: H("node0id"),
        dema_realm_state_proof_hash: H("realm"),
        pat_profile_proof_hashes: [0, 1, 2, 3, 4, 5, 6].map((i) =>
          H(`pat${i}`),
        ),
        sat_profile_proof_hashes: [0, 1, 2, 3, 4].map((i) => H(`sat${i}`)),
        urp_resource_status_proof_hash: H("urp"),
        genesis_local_token_ledger_root_hash: tokenRoot,
        poi_rule_id: "consent_proof_replay_verification.v0.1",
        poi_rule_version: "0.1.0",
        full_flywheel_run_receipt_hash: H("flywheel"),
        performance_baseline_proof_hash: H("perf"),
        house_of_wisdom_first_lesson_proof_hash: H("how"),
      };
      const claim_boundary = {
        public_network_launched: false,
        public_market_value_claimed: false,
        legal_certification_claimed: false,
        shariah_certification_claimed: false,
        node1_enabled: false,
        federation_used: false,
        token_minted_to_humans: false,
      };
      const targetHash = sha256(
        stableStringify({
          prerequisites,
          claim_boundary,
          created_at_iso: CREATED,
        }),
      );
      const seal = await buildConsentProof({
        phrase: "SEAL BLOCK0",
        actionScope: {
          action_type: BLOCK0_ACTION_TYPE,
          target_hash: targetHash,
        },
        demaHome: home,
        nonce: "sealroot".repeat(8),
        createdAtIso: "2026-06-01T16:59:00.000Z",
        expiresAtIso: "2026-06-01T17:04:00.000Z",
      });
      const m = await buildBlock0Manifest({
        prerequisites,
        claimBoundary: claim_boundary,
        consentProof: seal.consent_proof,
        demaHome: home,
        createdAtIso: CREATED,
      });
      assert.equal(m.built, true, `manifest must build: ${m.error}`);

      const r = judgeBlock0FromProofs({
        manifest: m.manifest,
        operatorPubkeyPem: pubkeyPem,
        proofs: { [RECEIPT_SLOT]: receipts, [TOKEN_SLOT]: tokens },
      });
      assert.equal(r.judged, true, r.error);
      assert.equal(r.slot_binding[RECEIPT_SLOT].bound, true);
      assert.equal(r.slot_binding[TOKEN_SLOT].bound, true);
      assert.equal(r.judged_status_map[RECEIPT_SLOT], "PRODUCER_LIVE");
      assert.equal(r.judged_status_map[TOKEN_SLOT], "PRODUCER_LIVE");
      assert.equal(r.bound_live_count, 2);
      assert.equal(r.sealable, false); // still partial — honest
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("judge: manifest committing a wrong root → NAMED_ONLY", async () => {
    const home = await freshHome();
    try {
      const { pubkeyPem, receipts, tokens } = await buildChains(home);
      const collected = collectBlock0PrerequisiteStatus({
        proofs: { [RECEIPT_SLOT]: receipts, [TOKEN_SLOT]: tokens },
        operatorPubkeyPem: pubkeyPem,
      });
      const tokenRoot = collected.slot_verification[TOKEN_SLOT].root_hash;
      const prerequisites = {
        keyconsent_integration_complete: true,
        keyconsent_truth_labels: ["MEASURED:kernel"],
        canonical_receipt_ledger_root_hash: H("WRONG_ROOT"), // wrong
        node0_identity_proof_hash: H("node0id"),
        dema_realm_state_proof_hash: H("realm"),
        pat_profile_proof_hashes: [0, 1, 2, 3, 4, 5, 6].map((i) =>
          H(`pat${i}`),
        ),
        sat_profile_proof_hashes: [0, 1, 2, 3, 4].map((i) => H(`sat${i}`)),
        urp_resource_status_proof_hash: H("urp"),
        genesis_local_token_ledger_root_hash: tokenRoot,
        poi_rule_id: "consent_proof_replay_verification.v0.1",
        poi_rule_version: "0.1.0",
        full_flywheel_run_receipt_hash: H("flywheel"),
        performance_baseline_proof_hash: H("perf"),
        house_of_wisdom_first_lesson_proof_hash: H("how"),
      };
      const claim_boundary = {
        public_network_launched: false,
        public_market_value_claimed: false,
        legal_certification_claimed: false,
        shariah_certification_claimed: false,
        node1_enabled: false,
        federation_used: false,
        token_minted_to_humans: false,
      };
      const targetHash = sha256(
        stableStringify({
          prerequisites,
          claim_boundary,
          created_at_iso: CREATED,
        }),
      );
      const seal = await buildConsentProof({
        phrase: "SEAL BLOCK0",
        actionScope: {
          action_type: BLOCK0_ACTION_TYPE,
          target_hash: targetHash,
        },
        demaHome: home,
        nonce: "sealrot2".repeat(8),
        createdAtIso: "2026-06-01T16:59:00.000Z",
        expiresAtIso: "2026-06-01T17:04:00.000Z",
      });
      const m = await buildBlock0Manifest({
        prerequisites,
        claimBoundary: claim_boundary,
        consentProof: seal.consent_proof,
        demaHome: home,
        createdAtIso: CREATED,
      });
      assert.equal(m.built, true, `manifest must build: ${m.error}`);
      const r = judgeBlock0FromProofs({
        manifest: m.manifest,
        operatorPubkeyPem: pubkeyPem,
        proofs: { [RECEIPT_SLOT]: receipts, [TOKEN_SLOT]: tokens },
      });
      assert.equal(r.slot_binding[RECEIPT_SLOT].bound, false);
      assert.equal(r.judged_status_map[RECEIPT_SLOT], "NAMED_ONLY");
      assert.equal(r.slot_binding[TOKEN_SLOT].bound, true);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
