import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import {
  buildProofPassport,
  formatProofPassport,
  PROOF_PASSPORT_SCHEMA,
} from "../packages/receipts/src/proof-passport.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import {
  signArtifact,
  SIGN_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-sign-command.js";
import {
  sha256,
  stableStringify,
} from "../packages/consent/src/consent-common.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(REPO_ROOT, "apps/cli/src/index.js");
const ENV = {
  ...process.env,
  NO_COLOR: "1",
  NODE_ENV: "test",
  DEMA_NO_TUI: "1",
};

function freshHome() {
  return mkdtempSync(join(tmpdir(), "dema-passport-test-"));
}

async function homeWithSignedReceipt() {
  const home = freshHome();
  const old = process.env.DEMA_HOME;
  process.env.DEMA_HOME = home;
  await initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE,
    demaHome: home,
  });
  const artifact = join(home, "passport-artifact.txt");
  writeFileSync(artifact, "passport test content");
  await signArtifact({
    artifactPath: artifact,
    consent: SIGN_CONSENT_PHRASE,
    demaHome: home,
  });
  return {
    home,
    restore: () => {
      if (old) process.env.DEMA_HOME = old;
      else delete process.env.DEMA_HOME;
    },
  };
}

describe("buildProofPassport", () => {
  it("returns EMPTY when no receipts exist", async () => {
    const passport = await buildProofPassport(freshHome());
    assert.equal(passport.schema, PROOF_PASSPORT_SCHEMA);
    assert.equal(passport.aggregate.verdict, "EMPTY");
    assert.equal(passport.truth_label, "LOCAL_PROOF_PASSPORT_EMPTY");
    assert.equal(passport.aggregate.total_receipts, 0);
  });

  it("returns ALL_VERIFIED with one valid receipt", async () => {
    const { home, restore } = await homeWithSignedReceipt();
    try {
      const passport = await buildProofPassport(home);
      assert.equal(passport.aggregate.verdict, "ALL_VERIFIED");
      assert.equal(passport.truth_label, "LOCAL_PROOF_PASSPORT_ALL_VERIFIED");
      assert.equal(passport.aggregate.total_receipts, 1);
      assert.equal(passport.aggregate.verified_count, 1);
      assert.equal(passport.aggregate.failed_count, 0);
      assert.equal(
        passport.verification_scope,
        "SIGNATURE_INTEGRITY_ONLY",
      );
      assert.equal(passport.receipts[0].verdict, "VERIFIED");
      assert.equal(
        passport.receipts[0].verification_scope,
        "SIGNATURE_INTEGRITY_ONLY",
      );
      assert.equal(passport.receipts[0].trust_state, "NOT_EVALUATED");
      assert.equal(passport.boundary.active_signer_trust_evaluated, false);
      assert.equal(passport.subject.public_key_fingerprints.length, 1);
      assert.match(
        passport.subject.public_key_fingerprints[0],
        /^[a-f0-9]{64}$/,
      );
      assert.match(passport.receipts[0].author_fingerprint, /^[a-f0-9]{64}$/);
    } finally {
      restore();
    }
  });

  it("returns NONE_VERIFIED when receipt is tampered", async () => {
    const { home, restore } = await homeWithSignedReceipt();
    try {
      const receiptsDir = join(home, "receipts");
      const { readdirSync } = await import("node:fs");
      const files = readdirSync(receiptsDir).filter((f) =>
        f.startsWith("authorship-"),
      );
      const receiptPath = join(receiptsDir, files[0]);
      const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
      receipt.artifact.sha256 = "0".repeat(64);
      writeFileSync(receiptPath, JSON.stringify(receipt));

      const passport = await buildProofPassport(home);
      assert.equal(passport.aggregate.verdict, "NONE_VERIFIED");
      assert.equal(passport.truth_label, "LOCAL_PROOF_PASSPORT_NONE_VERIFIED");
      assert.equal(passport.receipts[0].verdict, "FAILED");
    } finally {
      restore();
    }
  });

  it("passport_hash recomputes deterministically", async () => {
    const { home, restore } = await homeWithSignedReceipt();
    try {
      const passport = await buildProofPassport(home);
      const { passport_hash, generated_at, ...body } = passport;
      const recomputed = sha256(stableStringify(body));
      assert.equal(passport_hash, recomputed);
    } finally {
      restore();
    }
  });

  it("no private key material in passport", async () => {
    const { home, restore } = await homeWithSignedReceipt();
    try {
      const passport = await buildProofPassport(home);
      const json = JSON.stringify(passport);
      assert.ok(!json.includes("BEGIN PRIVATE KEY"));
      assert.ok(!json.includes("private_key_pem"));
    } finally {
      restore();
    }
  });

  it("no raw artifact content in passport", async () => {
    const { home, restore } = await homeWithSignedReceipt();
    try {
      const passport = await buildProofPassport(home);
      const json = JSON.stringify(passport);
      assert.ok(!json.includes("passport test content"));
    } finally {
      restore();
    }
  });

  it("boundary forbids network/federation/token/legal/production", async () => {
    const passport = await buildProofPassport(freshHome());
    assert.equal(passport.boundary.passport_generated, true);
    assert.equal(passport.boundary.passport_signed, false);
    assert.equal(passport.boundary.private_key_loaded, false);
    assert.equal(passport.boundary.network_used, false);
    assert.equal(passport.boundary.federation_used, false);
    assert.equal(passport.boundary.token_minted, false);
    assert.equal(passport.boundary.legal_identity_asserted, false);
    assert.equal(passport.boundary.production_claimed, false);
    assert.equal(passport.boundary.receipt_content_included, false);
  });
});

describe("H19.1.1 hardening — determinism and portability", () => {
  it("multi-receipt passport_hash is order-independent", async () => {
    const home = freshHome();
    const old = process.env.DEMA_HOME;
    process.env.DEMA_HOME = home;
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      for (let i = 0; i < 3; i += 1) {
        const artifact = join(home, `artifact-${i}.txt`);
        writeFileSync(artifact, `content-${i}`);
        await signArtifact({
          artifactPath: artifact,
          consent: SIGN_CONSENT_PHRASE,
          demaHome: home,
        });
      }
      const a = await buildProofPassport(home);
      const b = await buildProofPassport(home);
      const stripVolatile = ({ generated_at, ...rest }) => rest;
      assert.deepEqual(stripVolatile(a), stripVolatile(b));
      assert.equal(a.passport_hash, b.passport_hash);
      assert.equal(a.aggregate.total_receipts, 3);
      assert.equal(a.subject.public_key_fingerprints.length, 1);
    } finally {
      if (old) process.env.DEMA_HOME = old;
      else delete process.env.DEMA_HOME;
    }
  });

  it("passport_hash is stable across re-builds (H19.1.2)", async () => {
    const { home, restore } = await homeWithSignedReceipt();
    try {
      const a = await buildProofPassport(home);
      await new Promise((r) => setTimeout(r, 10));
      const b = await buildProofPassport(home);
      assert.notEqual(a.generated_at, b.generated_at);
      assert.equal(a.passport_hash, b.passport_hash);
    } finally {
      restore();
    }
  });

  it("empty passport_hash is also stable", async () => {
    const homeA = freshHome();
    const homeB = freshHome();
    const a = await buildProofPassport(homeA);
    const b = await buildProofPassport(homeB);
    assert.equal(a.passport_hash, b.passport_hash);
    assert.equal(a.aggregate.verdict, "EMPTY");
  });

  it("preserves author fingerprint when local public key is removed", async () => {
    const { home, restore } = await homeWithSignedReceipt();
    try {
      // Layout-agnostic: drop ALL local key material (legacy flat files and
      // the generation store alike) — the passport must verify from the
      // receipt's embedded material alone.
      const { rmSync } = await import("node:fs");
      rmSync(join(home, "keys"), { recursive: true, force: true });

      const passport = await buildProofPassport(home);
      assert.equal(passport.aggregate.verdict, "ALL_VERIFIED");
      assert.equal(passport.subject.public_key_fingerprints.length, 1);
      assert.match(
        passport.subject.public_key_fingerprints[0],
        /^[a-f0-9]{64}$/,
      );
    } finally {
      restore();
    }
  });
});

describe("formatProofPassport", () => {
  it("formats empty passport", () => {
    const text = formatProofPassport({
      aggregate: { verdict: "EMPTY" },
      receipts: [],
    });
    assert.match(text, /No authorship receipts found/);
  });

  it("formats ALL_VERIFIED passport", async () => {
    const { home, restore } = await homeWithSignedReceipt();
    try {
      const passport = await buildProofPassport(home);
      const text = formatProofPassport(passport);
      assert.match(text, /ALL_VERIFIED/);
      assert.match(text, /Fingerprints:/);
      assert.match(text, /Verified:\s+1/);
    } finally {
      restore();
    }
  });
});

describe("dema proof passport CLI", () => {
  it("returns EMPTY passport on fresh home", () => {
    const home = freshHome();
    try {
      execFileSync("node", [CLI, "proof", "passport", "--json"], {
        cwd: REPO_ROOT,
        env: { ...ENV, DEMA_HOME: home },
        timeout: 10000,
      });
      assert.fail("should exit 1");
    } catch (err) {
      const result = JSON.parse(err.stdout.toString());
      assert.equal(result.truth_label, "LOCAL_PROOF_PASSPORT_EMPTY");
    }
  });

  it("returns ALL_VERIFIED after key init + sign", async () => {
    const { home, restore } = await homeWithSignedReceipt();
    try {
      const out = execFileSync("node", [CLI, "proof", "passport", "--json"], {
        cwd: REPO_ROOT,
        env: { ...ENV, DEMA_HOME: home },
        timeout: 10000,
      }).toString();
      const result = JSON.parse(out);
      assert.equal(result.truth_label, "LOCAL_PROOF_PASSPORT_ALL_VERIFIED");
      assert.equal(result.aggregate.verified_count, 1);
      assert.match(result.passport_hash, /^[a-f0-9]{64}$/);
    } finally {
      restore();
    }
  });
});
