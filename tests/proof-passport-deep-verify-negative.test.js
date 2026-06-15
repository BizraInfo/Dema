import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  verifyProofPassportDeep,
  DEEP_VERIFY_SCHEMA,
} from "../packages/receipts/src/proof-passport-deep-verify.js";
import { buildProofPassport } from "../packages/receipts/src/proof-passport.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import {
  signArtifact,
  SIGN_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-sign-command.js";

const tmpDirs = [];

function freshHome() {
  const d = mkdtempSync(join(tmpdir(), "dema-pp-neg-"));
  tmpDirs.push(d);
  return d;
}

async function homeWithSignedPassport() {
  const home = freshHome();
  const old = process.env.DEMA_HOME;
  process.env.DEMA_HOME = home;
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
  const artifact = join(home, "artifact.txt");
  writeFileSync(artifact, "adversarial test content");
  await signArtifact({
    artifactPath: artifact,
    consent: SIGN_CONSENT_PHRASE,
    demaHome: home,
  });
  const passport = await buildProofPassport(home);
  return {
    home,
    passport,
    receiptsDir: join(home, "receipts"),
    restore: () => {
      if (old) process.env.DEMA_HOME = old;
      else delete process.env.DEMA_HOME;
    },
  };
}

after(() => {
  for (const d of tmpDirs) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
});

describe("verifyProofPassportDeep — receiptsDir boundary adversarial", () => {
  it("rejects empty-string receiptsDir with receipts_dir_required, not VERIFIED", async () => {
    const { passport, restore } = await homeWithSignedPassport();
    try {
      const result = await verifyProofPassportDeep(passport, {
        receiptsDir: "",
      });
      assert.equal(result.schema, DEEP_VERIFY_SCHEMA);
      assert.equal(result.verified, false);
      assert.equal(result.verdict, "FAILED");
      assert.equal(result.error, "receipts_dir_required");
      // top-level must not say VERIFIED — the nested envelope may independently say VERIFIED for its scope
      assert.ok(!result.verdict.includes("VERIFIED"));
    } finally {
      restore();
    }
  });

  it("rejects numeric receiptsDir with receipts_dir_required, not a crash", async () => {
    const { passport, restore } = await homeWithSignedPassport();
    try {
      const result = await verifyProofPassportDeep(passport, {
        receiptsDir: 42,
      });
      assert.equal(result.verified, false);
      assert.equal(result.error, "receipts_dir_required");
    } finally {
      restore();
    }
  });

  it("rejects undefined receiptsDir (no options) with receipts_dir_required", async () => {
    const { passport, restore } = await homeWithSignedPassport();
    try {
      // Pass an envelope-valid passport but omit receiptsDir entirely
      const result = await verifyProofPassportDeep(passport);
      assert.equal(result.verified, false);
      assert.equal(result.error, "receipts_dir_required");
    } finally {
      restore();
    }
  });
});

describe("verifyProofPassportDeep — unsafe filename adversarial", () => {
  it("rejects empty-string receipt_filename → unsafe_filename, not VERIFIED", async () => {
    const { passport, receiptsDir, restore } = await homeWithSignedPassport();
    try {
      const { sha256, stableStringify } =
        await import("../packages/consent/src/consent-common.js");
      const { passport_hash, generated_at, ...body } = passport;
      const tamperedBody = {
        ...body,
        receipts: [{ ...body.receipts[0], receipt_filename: "" }],
      };
      const tampered = {
        ...tamperedBody,
        passport_hash: sha256(stableStringify(tamperedBody)),
        generated_at,
      };
      const result = await verifyProofPassportDeep(tampered, { receiptsDir });
      assert.equal(result.verified, false);
      assert.equal(result.verdict, "FAILED");
      assert.equal(result.receipt_results[0].error, "unsafe_filename");
    } finally {
      restore();
    }
  });

  it("rejects null receipt_filename → unsafe_filename, not a crash", async () => {
    const { passport, receiptsDir, restore } = await homeWithSignedPassport();
    try {
      const { sha256, stableStringify } =
        await import("../packages/consent/src/consent-common.js");
      const { passport_hash, generated_at, ...body } = passport;
      const tamperedBody = {
        ...body,
        receipts: [{ ...body.receipts[0], receipt_filename: null }],
      };
      const tampered = {
        ...tamperedBody,
        passport_hash: sha256(stableStringify(tamperedBody)),
        generated_at,
      };
      const result = await verifyProofPassportDeep(tampered, { receiptsDir });
      assert.equal(result.verified, false);
      assert.equal(result.receipt_results[0].error, "unsafe_filename");
    } finally {
      restore();
    }
  });

  it("rejects backslash-injection filename → unsafe_filename", async () => {
    const { passport, receiptsDir, restore } = await homeWithSignedPassport();
    try {
      const { sha256, stableStringify } =
        await import("../packages/consent/src/consent-common.js");
      const { passport_hash, generated_at, ...body } = passport;
      const tamperedBody = {
        ...body,
        receipts: [
          { ...body.receipts[0], receipt_filename: "evil\\..\\etc\\passwd" },
        ],
      };
      const tampered = {
        ...tamperedBody,
        passport_hash: sha256(stableStringify(tamperedBody)),
        generated_at,
      };
      const result = await verifyProofPassportDeep(tampered, { receiptsDir });
      assert.equal(result.verified, false);
      assert.equal(result.receipt_results[0].error, "unsafe_filename");
    } finally {
      restore();
    }
  });
});

describe("verifyProofPassportDeep — corrupt receipt file adversarial", () => {
  it("returns FAILED when receipt file contains invalid JSON", async () => {
    const { passport, receiptsDir, restore } = await homeWithSignedPassport();
    try {
      const receiptFilename = passport.receipts[0].receipt_filename;
      // Overwrite the receipt with garbage, keeping the filename in place
      writeFileSync(join(receiptsDir, receiptFilename), "NOT_VALID_JSON{{{{");
      const result = await verifyProofPassportDeep(passport, { receiptsDir });
      assert.equal(result.verified, false);
      assert.equal(result.verdict, "FAILED");
      assert.equal(result.receipt_results[0].verified, false);
      assert.equal(result.receipt_results[0].receipt_verified, false);
      // top-level must not be VERIFIED — envelope sub-object may independently be true
      assert.equal(result.verified, false);
      assert.equal(result.verdict, "FAILED");
    } finally {
      restore();
    }
  });

  it("returns FAILED when receipt file is valid JSON but missing signature", async () => {
    const { passport, receiptsDir, restore } = await homeWithSignedPassport();
    try {
      const receiptFilename = passport.receipts[0].receipt_filename;
      // Write a plausible-looking receipt with no signature field
      const fakeSansSignature = {
        schema: "bizra.dema.authorship_receipt.v0.1",
        artifact: { sha256: "a".repeat(64) },
        author: { public_key_fingerprint: "b".repeat(64) },
      };
      writeFileSync(
        join(receiptsDir, receiptFilename),
        JSON.stringify(fakeSansSignature),
      );
      const result = await verifyProofPassportDeep(passport, { receiptsDir });
      assert.equal(result.verified, false);
      assert.equal(result.receipt_results[0].verified, false);
      assert.equal(result.receipt_results[0].receipt_verified, false);
    } finally {
      restore();
    }
  });
});

describe("verifyProofPassportDeep — partial-receipt failure (all-or-nothing)", () => {
  it("FAILED when one of two receipts is missing — no VERIFIED leak", async () => {
    const home = freshHome();
    const old = process.env.DEMA_HOME;
    process.env.DEMA_HOME = home;
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      // Sign two artifacts so the passport carries two receipts
      for (const name of ["a.txt", "b.txt"]) {
        const art = join(home, name);
        writeFileSync(art, `content-${name}`);
        await signArtifact({
          artifactPath: art,
          consent: SIGN_CONSENT_PHRASE,
          demaHome: home,
        });
      }
      const passport = await buildProofPassport(home);
      assert.equal(
        passport.receipts.length,
        2,
        "need 2 receipts for this test",
      );

      // Delete one receipt file so deep-verify cannot find it
      const receiptsDir = join(home, "receipts");
      rmSync(join(receiptsDir, passport.receipts[0].receipt_filename));

      const result = await verifyProofPassportDeep(passport, { receiptsDir });
      assert.equal(result.verified, false);
      assert.equal(result.verdict, "FAILED");
      assert.equal(result.truth_label, "LOCAL_PROOF_PASSPORT_DEEP_FAILED");
      // The surviving receipt may show verified:true but top-level must be false
      assert.equal(
        result.receipt_results.some((r) => r.verified === false),
        true,
      );
      // top-level must not say VERIFIED — envelope sub-object may independently be VERIFIED for its scope
      assert.equal(result.verified, false);
      assert.equal(result.verdict, "FAILED");
    } finally {
      if (old) process.env.DEMA_HOME = old;
      else delete process.env.DEMA_HOME;
    }
  });
});

describe("verifyProofPassportDeep — receipts field type injection", () => {
  it("does not crash or return VERIFIED when passport.receipts is an object (not array)", async () => {
    const home = freshHome();
    // Build a valid empty passport, then manually inject a non-array receipts field.
    // We bypass buildProofPassport and craft a hand-tampered object so the
    // envelope hash is intentionally wrong → envelope_verification_failed path.
    // This confirms the kernel never panics on unexpected type before envelope check.
    const fakePassport = {
      schema: "bizra.dema.proof_passport.v0.1",
      passport_hash: "0".repeat(64),
      generated_at: new Date().toISOString(),
      receipts: { injected: "object" },
      aggregate: {
        total_receipts: 0,
        verified_count: 0,
        failed_count: 0,
        verdict: "EMPTY",
      },
      truth_label: "LOCAL_PROOF_PASSPORT_EMPTY",
      boundary: {},
      subject: { public_key_fingerprints: [] },
    };
    const receiptsDir = freshHome();
    const result = await verifyProofPassportDeep(fakePassport, { receiptsDir });
    // Either envelope fails (most likely) or it reaches receipt iteration without crashing
    assert.equal(result.verified, false);
    assert.ok(!JSON.stringify(result).includes('"verdict":"VERIFIED"'));
  });
});

describe("verifyProofPassportDeep — boundary attestation on all paths", () => {
  it("boundary.private_key_loaded is false on VERIFIED path", async () => {
    const { passport, receiptsDir, restore } = await homeWithSignedPassport();
    try {
      const result = await verifyProofPassportDeep(passport, { receiptsDir });
      assert.equal(result.verified, true);
      assert.equal(result.boundary.private_key_loaded, false);
      assert.equal(result.boundary.signing_performed, false);
      assert.equal(result.boundary.network_used, false);
      assert.equal(result.boundary.token_minted, false);
      assert.equal(result.boundary.federation_used, false);
    } finally {
      restore();
    }
  });

  it("boundary.private_key_loaded is false on FAILED path", async () => {
    const result = await verifyProofPassportDeep(null);
    assert.equal(result.verified, false);
    assert.equal(result.boundary.private_key_loaded, false);
    assert.equal(result.boundary.network_used, false);
    assert.equal(result.boundary.token_minted, false);
  });
});
