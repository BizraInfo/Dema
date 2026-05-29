// KEYCONSENT-1B · verdict-attest gate integration tests
//
// Maps Mumu's 9 proof bars to test names. Each bar must reject when the
// invariant fails. Legacy fail-closed phrase discipline is preserved.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  attestVerdict,
  ATTEST_CONSENT_PHRASE,
  VERDICT_RECEIPT_SCHEMA,
  ATTEST_ACTION_TYPE,
} from "../packages/receipts/src/verdict-attest.js";
import { buildConsentProof } from "../packages/receipts/src/consent-proof.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import {
  sha256,
  stableStringify,
} from "../packages/consent/src/consent-common.js";

const VALID_INPUT = Object.freeze({ name: "alice", value: 100 });
const VALID_RULE = "canonical-shape.v0.1";
const FIXED_NOW = "2026-05-29T08:00:30.000Z";
const FIXED_CREATED = "2026-05-29T08:00:00.000Z";
const FIXED_EXPIRES = "2026-05-29T08:05:00.000Z";
const FIXED_EXPIRED = "2026-05-29T08:00:10.000Z"; // before FIXED_NOW
const FIXED_NONCE = "ab".repeat(32);

function inputHashOf(input) {
  return sha256(stableStringify(input));
}

async function freshHomeWithKey() {
  const home = await mkdtemp(join(tmpdir(), "dema-kc1b-test-"));
  await initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE,
    demaHome: home,
  });
  return home;
}

async function buildAttestConsent({
  home,
  input,
  expiresAtIso,
  scopeOverride,
}) {
  const hash = inputHashOf(input);
  return buildConsentProof({
    phrase: ATTEST_CONSENT_PHRASE,
    actionScope: scopeOverride || {
      action_type: ATTEST_ACTION_TYPE,
      target_hash: hash,
      rule_id: VALID_RULE,
    },
    demaHome: home,
    nonce: FIXED_NONCE,
    createdAtIso: FIXED_CREATED,
    expiresAtIso: expiresAtIso || FIXED_EXPIRES,
  });
}

describe("KEYCONSENT-1B · verdict-attest gate · positive path", () => {
  it("BAR-1: valid consent proof + correct phrase + key present → attested:true, body.consent_proof_hash present, bundle ships consent_proof", async () => {
    const home = await freshHomeWithKey();
    try {
      const cp = await buildAttestConsent({ home, input: VALID_INPUT });
      const r = await attestVerdict({
        rule: VALID_RULE,
        input: VALID_INPUT,
        consent: ATTEST_CONSENT_PHRASE,
        consentProof: cp.consent_proof,
        demaHome: home,
        now: FIXED_NOW,
      });
      assert.equal(r.attested, true);
      assert.equal(
        r.body.consent_proof_hash,
        cp.consent_proof.consent_proof_hash,
      );
      assert.deepEqual(r.consent_proof, cp.consent_proof);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("BAR-7: receipt body explicitly references consent_proof_hash (sha256 hex)", async () => {
    const home = await freshHomeWithKey();
    try {
      const cp = await buildAttestConsent({ home, input: VALID_INPUT });
      const r = await attestVerdict({
        rule: VALID_RULE,
        input: VALID_INPUT,
        consent: ATTEST_CONSENT_PHRASE,
        consentProof: cp.consent_proof,
        demaHome: home,
        now: FIXED_NOW,
      });
      assert.equal(r.attested, true);
      assert.ok(/^[a-f0-9]{64}$/.test(r.body.consent_proof_hash));
      assert.equal(
        r.body.consent_proof_hash,
        cp.consent_proof.consent_proof_hash,
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("BAR-8: result envelope contains no PRIVATE KEY material", async () => {
    const home = await freshHomeWithKey();
    try {
      const cp = await buildAttestConsent({ home, input: VALID_INPUT });
      const r = await attestVerdict({
        rule: VALID_RULE,
        input: VALID_INPUT,
        consent: ATTEST_CONSENT_PHRASE,
        consentProof: cp.consent_proof,
        demaHome: home,
        now: FIXED_NOW,
      });
      const envStr = JSON.stringify(r);
      assert.ok(
        !envStr.includes("PRIVATE KEY"),
        "result must contain no PRIVATE KEY marker",
      );
      assert.ok(
        !envStr.includes("PKCS8"),
        "result must contain no PKCS8 marker",
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("BAR-9: boundary stays clean — no network/federation/token/share/economic fields true", async () => {
    const home = await freshHomeWithKey();
    try {
      const cp = await buildAttestConsent({ home, input: VALID_INPUT });
      const r = await attestVerdict({
        rule: VALID_RULE,
        input: VALID_INPUT,
        consent: ATTEST_CONSENT_PHRASE,
        consentProof: cp.consent_proof,
        demaHome: home,
        now: FIXED_NOW,
      });
      assert.equal(r.attested, true);
      assert.equal(r.boundary.network_used, false);
      assert.equal(r.boundary.federation_used, false);
      assert.equal(r.boundary.token_minted, false);
      assert.equal(r.boundary.share_published, false);
      assert.equal(r.boundary.economic_claim_made, false);
      assert.equal(r.boundary.poi_score_calculated, false);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("KEYCONSENT-1B · verdict-attest gate · negative paths (bars 2-6 + legacy)", () => {
  it("BAR-2: missing consent proof → attested:false, error consent_proof_required", async () => {
    const home = await freshHomeWithKey();
    try {
      const r = await attestVerdict({
        rule: VALID_RULE,
        input: VALID_INPUT,
        consent: ATTEST_CONSENT_PHRASE,
        // consentProof omitted
        demaHome: home,
        now: FIXED_NOW,
      });
      assert.equal(r.attested, false);
      assert.equal(r.error, "consent_proof_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("BAR-3: tampered consent proof body (consent_phrase mutated) → attested:false, error consent_proof_consent_proof_hash_mismatch", async () => {
    const home = await freshHomeWithKey();
    try {
      const cp = await buildAttestConsent({ home, input: VALID_INPUT });
      const tampered = Object.freeze({
        ...cp.consent_proof,
        consent_phrase: "DIFFERENT PHRASE",
      });
      const r = await attestVerdict({
        rule: VALID_RULE,
        input: VALID_INPUT,
        consent: ATTEST_CONSENT_PHRASE,
        consentProof: tampered,
        demaHome: home,
        now: FIXED_NOW,
      });
      assert.equal(r.attested, false);
      // verifyConsentProof catches hash mismatch first (before sig verify)
      assert.equal(r.error, "consent_proof_consent_proof_hash_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("BAR-4: consent proof signed by a DIFFERENT operator key (foreign) → attested:false, error consent_proof_consent_signature_invalid", async () => {
    const home = await freshHomeWithKey();
    const otherHome = await mkdtemp(join(tmpdir(), "dema-kc1b-other-"));
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: otherHome,
      });
      const cpFromOther = await buildAttestConsent({
        home: otherHome,
        input: VALID_INPUT,
      });
      // attest using OUR key but their consent proof
      const r = await attestVerdict({
        rule: VALID_RULE,
        input: VALID_INPUT,
        consent: ATTEST_CONSENT_PHRASE,
        consentProof: cpFromOther.consent_proof,
        demaHome: home, // our key
        now: FIXED_NOW,
      });
      assert.equal(r.attested, false);
      // verifyConsentProof: hash check passes (body intact); sig check fails
      // because our pubkey ≠ signer of consent body
      assert.equal(r.error, "consent_proof_consent_signature_invalid");
    } finally {
      await rm(otherHome, { recursive: true, force: true });
      await rm(home, { recursive: true, force: true });
    }
  });

  it("BAR-5: expired consent proof (now > expires_at_iso) → attested:false, error consent_proof_consent_expired", async () => {
    const home = await freshHomeWithKey();
    try {
      const cp = await buildAttestConsent({
        home,
        input: VALID_INPUT,
        expiresAtIso: FIXED_EXPIRED,
      });
      const r = await attestVerdict({
        rule: VALID_RULE,
        input: VALID_INPUT,
        consent: ATTEST_CONSENT_PHRASE,
        consentProof: cp.consent_proof,
        demaHome: home,
        now: FIXED_NOW,
      });
      assert.equal(r.attested, false);
      assert.equal(r.error, "consent_proof_consent_expired");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("BAR-6: consent_scope.target_hash != input_hash → attested:false, error consent_proof_consent_scope_mismatch", async () => {
    const home = await freshHomeWithKey();
    try {
      const cp = await buildAttestConsent({
        home,
        input: VALID_INPUT,
        scopeOverride: {
          action_type: ATTEST_ACTION_TYPE,
          target_hash: "ff".repeat(32), // wrong target
          rule_id: VALID_RULE,
        },
      });
      const r = await attestVerdict({
        rule: VALID_RULE,
        input: VALID_INPUT,
        consent: ATTEST_CONSENT_PHRASE,
        consentProof: cp.consent_proof,
        demaHome: home,
        now: FIXED_NOW,
      });
      assert.equal(r.attested, false);
      assert.equal(r.error, "consent_proof_consent_scope_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("BAR-6b: consent_scope.action_type != MINT_VERDICT_RECEIPT → attested:false, error consent_proof_consent_scope_mismatch", async () => {
    const home = await freshHomeWithKey();
    try {
      const cp = await buildAttestConsent({
        home,
        input: VALID_INPUT,
        scopeOverride: {
          action_type: "MARK_URP_SHAREABLE", // wrong action_type
          target_hash: inputHashOf(VALID_INPUT),
          rule_id: VALID_RULE,
        },
      });
      const r = await attestVerdict({
        rule: VALID_RULE,
        input: VALID_INPUT,
        consent: ATTEST_CONSENT_PHRASE,
        consentProof: cp.consent_proof,
        demaHome: home,
        now: FIXED_NOW,
      });
      assert.equal(r.attested, false);
      assert.equal(r.error, "consent_proof_consent_scope_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("legacy preservation: wrong phrase still fires BEFORE consent proof check (defense in depth)", async () => {
    const home = await freshHomeWithKey();
    try {
      const cp = await buildAttestConsent({ home, input: VALID_INPUT });
      const r = await attestVerdict({
        rule: VALID_RULE,
        input: VALID_INPUT,
        consent: "WRONG_PHRASE", // legacy phrase mismatch
        consentProof: cp.consent_proof, // proof is valid
        demaHome: home,
        now: FIXED_NOW,
      });
      assert.equal(r.attested, false);
      // Legacy gate fires first → consent_required (not consent_proof_*)
      assert.equal(r.error, "consent_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
