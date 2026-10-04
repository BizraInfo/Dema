import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
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

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES_DIR = join(REPO_ROOT, "tests", "fixtures");

function freshHome() {
  return mkdtempSync(join(tmpdir(), "dema-deep-verify-"));
}

async function homeWithSignedPassport() {
  const home = freshHome();
  const old = process.env.DEMA_HOME;
  process.env.DEMA_HOME = home;
  await initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE,
    demaHome: home,
  });
  const artifact = join(home, "artifact.txt");
  writeFileSync(artifact, "deep-verify content");
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

describe("verifyProofPassportDeep", () => {
  it("envelope failure blocks deep verification", async () => {
    const result = await verifyProofPassportDeep(null);
    assert.equal(result.schema, DEEP_VERIFY_SCHEMA);
    assert.equal(result.verified, false);
    assert.equal(result.error, "envelope_verification_failed");
    assert.equal(result.truth_label, "LOCAL_PROOF_PASSPORT_DEEP_FAILED");
  });

  it("returns DEEP_EMPTY for valid empty passport", async () => {
    const home = freshHome();
    const passport = await buildProofPassport(home);
    const result = await verifyProofPassportDeep(passport, {
      receiptsDir: join(home, "receipts"),
    });
    assert.equal(result.verified, true);
    assert.equal(result.verdict, "EMPTY");
    assert.equal(result.truth_label, "LOCAL_PROOF_PASSPORT_DEEP_EMPTY");
    assert.equal(result.receipt_results.length, 0);
  });

  it("passes when passport + receipt match", async () => {
    const { passport, receiptsDir, restore } = await homeWithSignedPassport();
    try {
      const result = await verifyProofPassportDeep(passport, { receiptsDir });
      assert.equal(result.verified, true);
      assert.equal(result.verdict, "VERIFIED");
      assert.equal(result.truth_label, "LOCAL_PROOF_PASSPORT_DEEP_VERIFIED");
      assert.equal(
        result.verification_scope,
        "PASSPORT_ENVELOPE_AND_RECEIPT_SIGNATURE_INTEGRITY_ONLY",
      );
      assert.equal(result.receipt_results.length, 1);
      const r = result.receipt_results[0];
      assert.equal(r.verified, true);
      assert.equal(r.receipt_verified, true);
      assert.equal(r.metadata_match.artifact_sha256, true);
      assert.equal(r.metadata_match.author_fingerprint, true);
      assert.equal(r.metadata_match.verdict, true);
      assert.equal(r.metadata_match.truth_label, true);
      assert.equal(r.metadata_match.verification_scope, true);
      assert.equal(r.metadata_match.trust_state, true);
      assert.equal(r.verification_scope, "SIGNATURE_INTEGRITY_ONLY");
      assert.equal(r.trust_state, "NOT_EVALUATED");
      assert.equal(result.boundary.active_signer_trust_evaluated, false);
    } finally {
      restore();
    }
  });

  it("verifies a frozen v0.1 passport through the explicit legacy integrity path", async () => {
    const home = freshHome();
    const receiptsDir = join(home, "receipts");
    mkdirSync(receiptsDir);
    const receiptFilename = "authorship-frozen-v0.1.json";
    writeFileSync(
      join(receiptsDir, receiptFilename),
      readFileSync(join(FIXTURES_DIR, receiptFilename), "utf8"),
    );
    const passport = JSON.parse(
      readFileSync(
        join(FIXTURES_DIR, "proof-passport-frozen-v0.1.json"),
        "utf8",
      ),
    );

    const result = await verifyProofPassportDeep(passport, { receiptsDir });

    assert.equal(result.verified, true);
    assert.equal(result.schema, DEEP_VERIFY_SCHEMA);
    assert.equal(result.passport_schema, "bizra.dema.proof_passport.v0.1");
    assert.equal(result.legacy_compatibility, true);
    assert.equal(result.receipt_results[0].verified, true);
    assert.equal(
      result.receipt_results[0].verification_scope,
      "SIGNATURE_INTEGRITY_ONLY",
    );
    assert.equal(result.receipt_results[0].trust_state, "NOT_EVALUATED");
  });

  it("rejects a rehashed current passport that claims active signer trust", async () => {
    const { passport, receiptsDir, restore } = await homeWithSignedPassport();
    try {
      const { sha256, stableStringify } =
        await import("../packages/consent/src/consent-common.js");
      const { passport_hash, generated_at, ...body } = passport;
      const hostileBody = {
        ...body,
        verification_scope: "ACTIVE_SIGNER_TRUST",
        boundary: {
          ...body.boundary,
          active_signer_trust_evaluated: true,
          receipt_verification_scope: "ACTIVE_SIGNER_TRUST",
        },
      };
      const hostile = {
        ...hostileBody,
        passport_hash: sha256(stableStringify(hostileBody)),
        generated_at,
      };

      const result = await verifyProofPassportDeep(hostile, { receiptsDir });

      assert.equal(result.verified, false);
      assert.equal(result.error, "envelope_verification_failed");
      assert.ok(
        result.envelope.checks.some(
          (check) =>
            check.name === "integrity_scope_contract" && !check.pass,
        ),
      );
    } finally {
      restore();
    }
  });

  it("rejects an empty rehashed passport with a forged active-trust scope", async () => {
    const home = freshHome();
    const passport = await buildProofPassport(home);
    const { sha256, stableStringify } =
      await import("../packages/consent/src/consent-common.js");
    const { passport_hash, generated_at, ...body } = passport;
    const hostileBody = {
      ...body,
      verification_scope: "ACTIVE_SIGNER_TRUST",
      boundary: {
        ...body.boundary,
        active_signer_trust_evaluated: true,
      },
    };
    const hostile = {
      ...hostileBody,
      passport_hash: sha256(stableStringify(hostileBody)),
      generated_at,
    };

    const result = await verifyProofPassportDeep(hostile, {
      receiptsDir: join(home, "receipts"),
    });

    assert.equal(result.verified, false);
    assert.equal(result.error, "envelope_verification_failed");
  });

  it("fails when receipt file is missing", async () => {
    const { passport, restore } = await homeWithSignedPassport();
    try {
      const result = await verifyProofPassportDeep(passport, {
        receiptsDir: "/nonexistent/dir",
      });
      assert.equal(result.verified, false);
      assert.equal(result.verdict, "FAILED");
      assert.equal(result.receipt_results[0].verified, false);
    } finally {
      restore();
    }
  });

  it("fails when receipt file is tampered", async () => {
    const { passport, receiptsDir, restore } = await homeWithSignedPassport();
    try {
      const receiptPath = join(
        receiptsDir,
        passport.receipts[0].receipt_filename,
      );
      const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
      receipt.artifact.sha256 = "0".repeat(64);
      writeFileSync(receiptPath, JSON.stringify(receipt));
      const result = await verifyProofPassportDeep(passport, { receiptsDir });
      assert.equal(result.verified, false);
    } finally {
      restore();
    }
  });

  it("fails on artifact_sha256 mismatch (passport vs receipt)", async () => {
    const { passport, receiptsDir, restore } = await homeWithSignedPassport();
    try {
      const tampered = {
        ...passport,
        receipts: [
          { ...passport.receipts[0], artifact_sha256: "f".repeat(64) },
        ],
      };
      const result = await verifyProofPassportDeep(tampered, { receiptsDir });
      assert.equal(result.verified, false);
    } finally {
      restore();
    }
  });

  it("fails on author_fingerprint mismatch", async () => {
    const { passport, receiptsDir, restore } = await homeWithSignedPassport();
    try {
      const tampered = {
        ...passport,
        receipts: [
          { ...passport.receipts[0], author_fingerprint: "e".repeat(64) },
        ],
      };
      const result = await verifyProofPassportDeep(tampered, { receiptsDir });
      assert.equal(result.verified, false);
    } finally {
      restore();
    }
  });

  it("fails on verdict mismatch", async () => {
    const { passport, receiptsDir, restore } = await homeWithSignedPassport();
    try {
      const tampered = {
        ...passport,
        receipts: [{ ...passport.receipts[0], verdict: "FAILED" }],
      };
      const result = await verifyProofPassportDeep(tampered, { receiptsDir });
      assert.equal(result.verified, false);
    } finally {
      restore();
    }
  });

  it("fails on truth_label mismatch", async () => {
    const { passport, receiptsDir, restore } = await homeWithSignedPassport();
    try {
      const tampered = {
        ...passport,
        receipts: [{ ...passport.receipts[0], truth_label: "SOMETHING_ELSE" }],
      };
      const result = await verifyProofPassportDeep(tampered, { receiptsDir });
      assert.equal(result.verified, false);
    } finally {
      restore();
    }
  });

  it("rejects path traversal (../) in receipt_filename even when hash matches", async () => {
    const { passport, receiptsDir, restore } = await homeWithSignedPassport();
    try {
      const { sha256, stableStringify } =
        await import("../packages/consent/src/consent-common.js");
      const { passport_hash, generated_at, ...body } = passport;
      const maliciousBody = {
        ...body,
        receipts: [
          { ...body.receipts[0], receipt_filename: "../../etc/passwd" },
        ],
      };
      const malicious = {
        ...maliciousBody,
        passport_hash: sha256(stableStringify(maliciousBody)),
        generated_at,
      };
      const result = await verifyProofPassportDeep(malicious, { receiptsDir });
      assert.equal(result.verified, false);
      assert.equal(result.receipt_results[0].error, "unsafe_filename");
    } finally {
      restore();
    }
  });

  it("rejects nested path in receipt_filename even when hash matches", async () => {
    const { passport, receiptsDir, restore } = await homeWithSignedPassport();
    try {
      const { sha256, stableStringify } =
        await import("../packages/consent/src/consent-common.js");
      const { passport_hash, generated_at, ...body } = passport;
      const maliciousBody = {
        ...body,
        receipts: [
          { ...body.receipts[0], receipt_filename: "subdir/receipt.json" },
        ],
      };
      const malicious = {
        ...maliciousBody,
        passport_hash: sha256(stableStringify(maliciousBody)),
        generated_at,
      };
      const result = await verifyProofPassportDeep(malicious, { receiptsDir });
      assert.equal(result.verified, false);
      assert.equal(result.receipt_results[0].error, "unsafe_filename");
    } finally {
      restore();
    }
  });

  it("no private key material in output", async () => {
    const { passport, receiptsDir, restore } = await homeWithSignedPassport();
    try {
      const result = await verifyProofPassportDeep(passport, { receiptsDir });
      const json = JSON.stringify(result);
      assert.ok(!json.includes("BEGIN PRIVATE KEY"));
      assert.ok(!json.includes("private_key_pem"));
    } finally {
      restore();
    }
  });
});
