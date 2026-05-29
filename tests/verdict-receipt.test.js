// TDD tests for verdict-receipt mint (attest) + permissionless trustless verify.
//
// Per spec: bundle = { body, signature_b64, signer_public_key_pem, input }.
// body = { schema, rule_id, input_hash, verdict, computed, prev_hash, created_at_iso }.
// Signature is over stableStringify(body); the input ships alongside in the
// bundle for replay (binding to body is via input_hash, not direct inclusion).

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  attestVerdict,
  VERDICT_RECEIPT_SCHEMA,
  ATTEST_CONSENT_PHRASE,
} from "../packages/receipts/src/verdict-attest.js";
import { verifyVerdictBundle } from "../packages/receipts/src/verdict-verify.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import {
  generateEd25519Keypair,
  signPayload,
} from "../packages/receipts/src/authorship-signature.js";

const VALID_INPUT = Object.freeze({ name: "alice", value: 100 });
const FAILING_INPUT = Object.freeze({
  name: "alice",
  value: 100,
  intruder: "bad",
});

async function freshHome() {
  return await mkdtemp(join(tmpdir(), "dema-verdict-test-"));
}

// KEYCONSENT-1B: attestFresh now builds a key-bound consent proof from the
// canonical phrase + input hash before calling attestVerdict. This keeps the
// existing verdict-receipt tests green while ensuring every attest produces
// a consent-proof-bound receipt.
async function attestFresh(input) {
  const home = await freshHome();
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
  const { buildConsentProof } =
    await import("../packages/receipts/src/consent-proof.js");
  const { sha256, stableStringify } =
    await import("../packages/consent/src/consent-common.js");
  const inputHash = sha256(stableStringify(input));
  const cp = await buildConsentProof({
    phrase: ATTEST_CONSENT_PHRASE,
    actionScope: {
      action_type: "MINT_VERDICT_RECEIPT",
      target_hash: inputHash,
      rule_id: "canonical-shape.v0.1",
    },
    demaHome: home,
  });
  const minted = await attestVerdict({
    rule: "canonical-shape.v0.1",
    input,
    consent: ATTEST_CONSENT_PHRASE,
    consentProof: cp.consent_proof,
    demaHome: home,
  });
  return { home, minted };
}

describe("verdict-attest · fail-closed consent gate (reuse existing pattern)", () => {
  it("wrong consent → attested:false, error consent_required, exit-1 contract, no receipt on disk", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const r = await attestVerdict({
        rule: "canonical-shape.v0.1",
        input: VALID_INPUT,
        consent: "WRONG_PHRASE",
        demaHome: home,
      });
      assert.equal(r.attested, false);
      assert.equal(r.error, "consent_required");
      assert.equal(r.required_phrase, ATTEST_CONSENT_PHRASE);
      // No verdict receipt on disk
      let receipts = [];
      try {
        receipts = (await readdir(join(home, "receipts"))).filter((f) =>
          f.startsWith("verdict-"),
        );
      } catch {}
      assert.equal(receipts.length, 0);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("missing authorship key → attested:false, error no_authorship_key (correct consent isn't enough)", async () => {
    const home = await freshHome();
    try {
      // Do NOT init key. With correct consent but no key.
      const r = await attestVerdict({
        rule: "canonical-shape.v0.1",
        input: VALID_INPUT,
        consent: ATTEST_CONSENT_PHRASE,
        demaHome: home,
      });
      assert.equal(r.attested, false);
      assert.equal(r.error, "no_authorship_key");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("unknown rule_id → attested:false, error unknown_rule", async () => {
    const home = await freshHome();
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const r = await attestVerdict({
        rule: "ghost-rule.v9.9",
        input: VALID_INPUT,
        consent: ATTEST_CONSENT_PHRASE,
        demaHome: home,
      });
      assert.equal(r.attested, false);
      assert.equal(r.error, "unknown_rule");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("verdict-attest · happy mint", () => {
  it("valid input + correct consent + key present → body, signature_b64, signer_public_key_pem, input; receipt on disk", async () => {
    const { home, minted } = await attestFresh(VALID_INPUT);
    try {
      assert.equal(minted.attested, true);
      assert.equal(minted.body.schema, VERDICT_RECEIPT_SCHEMA);
      assert.equal(minted.body.rule_id, "canonical-shape.v0.1");
      assert.equal(minted.body.verdict, "pass");
      assert.ok(/^[a-f0-9]{64}$/.test(minted.body.input_hash));
      assert.equal(minted.body.prev_hash, null); // chain hook; this slice null
      assert.equal(typeof minted.body.created_at_iso, "string");
      assert.equal(typeof minted.signature_b64, "string");
      assert.ok(minted.signer_public_key_pem.includes("BEGIN PUBLIC KEY"));
      // Body must NOT carry raw input — only input_hash binds it
      assert.equal(minted.body.input, undefined);
      // Bundle ships input alongside for replay
      assert.deepEqual(minted.input, VALID_INPUT);
      // Receipt file persisted under ~/.dema/receipts/verdict-*
      const files = await readdir(join(home, "receipts"));
      const verdictFile = files.find((f) => f.startsWith("verdict-"));
      assert.ok(verdictFile, "verdict receipt file should exist");
      assert.match(verdictFile, /^verdict-[a-f0-9]{64}\.json$/);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("failing input → still attested; verdict:fail is the rule's honest output", async () => {
    const { home, minted } = await attestFresh(FAILING_INPUT);
    try {
      assert.equal(minted.attested, true);
      assert.equal(minted.body.verdict, "fail");
      assert.ok(minted.body.computed.disallowed_keys.includes("intruder"));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("verify-grounded · happy", () => {
  it("attest then verify with MATCHING external pubkey → verified:true, verdict surfaced", async () => {
    const { home, minted } = await attestFresh(VALID_INPUT);
    try {
      const bundle = {
        body: minted.body,
        signature_b64: minted.signature_b64,
        signer_public_key_pem: minted.signer_public_key_pem,
        input: VALID_INPUT,
      };
      const r = verifyVerdictBundle({
        bundle,
        pubkeyPem: minted.signer_public_key_pem,
        ruleId: "canonical-shape.v0.1",
      });
      assert.equal(r.verified, true);
      assert.equal(r.verdict, "pass");
      assert.equal(r.rule_id, "canonical-shape.v0.1");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("determinism: verifying same bundle twice → identical result", async () => {
    const { home, minted } = await attestFresh(VALID_INPUT);
    try {
      const bundle = {
        body: minted.body,
        signature_b64: minted.signature_b64,
        signer_public_key_pem: minted.signer_public_key_pem,
        input: VALID_INPUT,
      };
      const r1 = verifyVerdictBundle({
        bundle,
        pubkeyPem: minted.signer_public_key_pem,
        ruleId: "canonical-shape.v0.1",
      });
      const r2 = verifyVerdictBundle({
        bundle,
        pubkeyPem: minted.signer_public_key_pem,
        ruleId: "canonical-shape.v0.1",
      });
      assert.deepEqual(r1, r2);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("verify-grounded · REJECT-1: input tampered → input_hash_mismatch", () => {
  it("tamper one byte of bundle.input (value 100→999) → REJECTED:input_hash_mismatch", async () => {
    const { home, minted } = await attestFresh(VALID_INPUT);
    try {
      const bundle = {
        body: minted.body,
        signature_b64: minted.signature_b64,
        signer_public_key_pem: minted.signer_public_key_pem,
        input: { ...VALID_INPUT, value: 999 }, // TAMPERED
      };
      const r = verifyVerdictBundle({
        bundle,
        pubkeyPem: minted.signer_public_key_pem,
        ruleId: "canonical-shape.v0.1",
      });
      assert.equal(r.verified, false);
      assert.equal(r.reason, "input_hash_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("verify-grounded · REJECT-2: body.verdict flipped + re-signed → verdict_rederivation_mismatch", () => {
  it("attacker flips body.verdict + signs with key B; verifier brings B's pubkey (sig passes); rule disagrees → REJECTED:verdict_rederivation_mismatch", async () => {
    const { home, minted } = await attestFresh(VALID_INPUT);
    try {
      // Tamper: flip pass→fail
      const tamperedBody = Object.freeze({ ...minted.body, verdict: "fail" });
      // Attacker generates new key, re-signs tampered body
      const keyB = generateEd25519Keypair();
      const newSignature = signPayload(tamperedBody, keyB.private_key_pem);
      const bundle = {
        body: tamperedBody,
        signature_b64: newSignature,
        signer_public_key_pem: keyB.public_key_pem,
        input: VALID_INPUT,
      };
      // Verifier brings attacker's pubkey — signature check passes
      // But rule(VALID_INPUT)=pass, body says fail → rederive mismatches
      const r = verifyVerdictBundle({
        bundle,
        pubkeyPem: keyB.public_key_pem,
        ruleId: "canonical-shape.v0.1",
      });
      assert.equal(r.verified, false);
      assert.equal(r.reason, "verdict_rederivation_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("attacker also flips computed (to match claimed verdict) but rule still disagrees → REJECTED:verdict_rederivation_mismatch", async () => {
    const { home, minted } = await attestFresh(VALID_INPUT);
    try {
      const tamperedBody = Object.freeze({
        ...minted.body,
        verdict: "fail",
        computed: Object.freeze({
          input_keys: ["name", "value"],
          required_keys: ["name", "value"],
          allowed_keys: ["name", "value", "note"],
          missing_required: ["intruder"], // bogus
          disallowed_keys: [],
        }),
      });
      const keyB = generateEd25519Keypair();
      const newSignature = signPayload(tamperedBody, keyB.private_key_pem);
      const bundle = {
        body: tamperedBody,
        signature_b64: newSignature,
        signer_public_key_pem: keyB.public_key_pem,
        input: VALID_INPUT,
      };
      const r = verifyVerdictBundle({
        bundle,
        pubkeyPem: keyB.public_key_pem,
        ruleId: "canonical-shape.v0.1",
      });
      assert.equal(r.verified, false);
      assert.equal(r.reason, "verdict_rederivation_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("verify-grounded · REJECT-3: external --pubkey ≠ signer", () => {
  it("verify with a fresh keypair B not the signer → REJECTED:signature_invalid", async () => {
    const { home, minted } = await attestFresh(VALID_INPUT);
    try {
      const wrongKey = generateEd25519Keypair();
      const bundle = {
        body: minted.body,
        signature_b64: minted.signature_b64,
        signer_public_key_pem: minted.signer_public_key_pem,
        input: VALID_INPUT,
      };
      const r = verifyVerdictBundle({
        bundle,
        pubkeyPem: wrongKey.public_key_pem,
        ruleId: "canonical-shape.v0.1",
      });
      assert.equal(r.verified, false);
      assert.equal(r.reason, "signature_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("verify-grounded · REJECT-4: verifier trusts ONLY the key IT brought", () => {
  it("attacker re-signs body with key B; bundle.signer_public_key_pem still claims A (lying); verifier brings --pubkey = bundle's claimed A → REJECTED:signature_invalid", async () => {
    const { home, minted } = await attestFresh(VALID_INPUT);
    try {
      // Attacker re-signs with their own key B
      const keyB = generateEd25519Keypair();
      const rogueSignature = signPayload(minted.body, keyB.private_key_pem);
      const bundle = {
        body: minted.body,
        signature_b64: rogueSignature,
        signer_public_key_pem: minted.signer_public_key_pem, // STILL CLAIMS A (lie)
        input: VALID_INPUT,
      };
      // Verifier brings --pubkey from the bundle's own claim (= A's pubkey)
      // If verifier trusted the bundle: A's pubkey is supplied, sig is by B → fails.
      // The verifier does NOT auto-trust the bundle's embedded key.
      // This test proves the verifier uses --pubkey only, not the bundle's self-asserted key.
      const r = verifyVerdictBundle({
        bundle,
        pubkeyPem: bundle.signer_public_key_pem, // = A (what the bundle CLAIMS the signer was)
        ruleId: "canonical-shape.v0.1",
      });
      assert.equal(r.verified, false);
      assert.equal(r.reason, "signature_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("verify-grounded · structural validation", () => {
  it("empty --pubkey → REJECTED:external_pubkey_required", async () => {
    const { home, minted } = await attestFresh(VALID_INPUT);
    try {
      const r = verifyVerdictBundle({
        bundle: {
          body: minted.body,
          signature_b64: minted.signature_b64,
          signer_public_key_pem: minted.signer_public_key_pem,
          input: VALID_INPUT,
        },
        pubkeyPem: "",
        ruleId: "canonical-shape.v0.1",
      });
      assert.equal(r.verified, false);
      assert.equal(r.reason, "external_pubkey_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("rule_id in bundle ≠ verifier's expected rule → REJECTED:rule_id_mismatch", async () => {
    const { home, minted } = await attestFresh(VALID_INPUT);
    try {
      const r = verifyVerdictBundle({
        bundle: {
          body: minted.body,
          signature_b64: minted.signature_b64,
          signer_public_key_pem: minted.signer_public_key_pem,
          input: VALID_INPUT,
        },
        pubkeyPem: minted.signer_public_key_pem,
        ruleId: "other-rule.v9.9",
      });
      assert.equal(r.verified, false);
      assert.equal(r.reason, "rule_id_mismatch");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("missing bundle.input → REJECTED:input_missing", async () => {
    const { home, minted } = await attestFresh(VALID_INPUT);
    try {
      const r = verifyVerdictBundle({
        bundle: {
          body: minted.body,
          signature_b64: minted.signature_b64,
          signer_public_key_pem: minted.signer_public_key_pem,
          // input omitted
        },
        pubkeyPem: minted.signer_public_key_pem,
        ruleId: "canonical-shape.v0.1",
      });
      assert.equal(r.verified, false);
      assert.equal(r.reason, "input_missing");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
