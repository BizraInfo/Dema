import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
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
const CLI = join(REPO_ROOT, "apps/cli/src/index.js");
const ENV = {
  ...process.env,
  NO_COLOR: "1",
  NODE_ENV: "test",
  DEMA_NO_TUI: "1",
};

function freshHome() {
  return mkdtempSync(join(tmpdir(), "dema-deep-cli-"));
}

async function homeWithSignedPassportFile() {
  const home = freshHome();
  const old = process.env.DEMA_HOME;
  process.env.DEMA_HOME = home;
  await initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE,
    demaHome: home,
  });
  const artifact = join(home, "artifact.txt");
  writeFileSync(artifact, "deep cli content");
  await signArtifact({
    artifactPath: artifact,
    consent: SIGN_CONSENT_PHRASE,
    demaHome: home,
  });
  const passport = await buildProofPassport(home);
  const passportPath = join(home, "passport.json");
  writeFileSync(passportPath, JSON.stringify(passport, null, 2));
  return {
    home,
    passport,
    passportPath,
    receiptsDir: join(home, "receipts"),
    restore: () => {
      if (old) process.env.DEMA_HOME = old;
      else delete process.env.DEMA_HOME;
    },
  };
}

describe("dema proof passport verify (envelope-only, no --deep)", () => {
  it("envelope verify still works unchanged", async () => {
    const { passportPath, restore } = await homeWithSignedPassportFile();
    try {
      const out = execFileSync(
        "node",
        [CLI, "proof", "passport", "verify", passportPath, "--json"],
        { cwd: REPO_ROOT, env: ENV, timeout: 10000 },
      ).toString();
      const result = JSON.parse(out);
      assert.equal(result.verified, true);
      assert.equal(result.verification_scope, "PASSPORT_ENVELOPE_ONLY");
    } finally {
      restore();
    }
  });
});

describe("dema proof passport verify --deep", () => {
  it("returns VERIFIED on valid passport + receipts dir", async () => {
    const { passportPath, receiptsDir, restore } =
      await homeWithSignedPassportFile();
    try {
      const out = execFileSync(
        "node",
        [
          CLI,
          "proof",
          "passport",
          "verify",
          passportPath,
          "--deep",
          "--receipts-dir",
          receiptsDir,
          "--json",
        ],
        { cwd: REPO_ROOT, env: ENV, timeout: 10000 },
      ).toString();
      const result = JSON.parse(out);
      assert.equal(
        result.schema,
        "bizra.dema.proof_passport_deep_verification.v0.1",
      );
      assert.equal(result.verified, true);
      assert.equal(result.verdict, "VERIFIED");
      assert.equal(result.verification_scope, "PASSPORT_ENVELOPE_AND_RECEIPTS");
      assert.equal(result.truth_label, "LOCAL_PROOF_PASSPORT_DEEP_VERIFIED");
    } finally {
      restore();
    }
  });

  it("uses DEMA_HOME/receipts when --receipts-dir absent", async () => {
    const { passportPath, home, restore } = await homeWithSignedPassportFile();
    try {
      const out = execFileSync(
        "node",
        [CLI, "proof", "passport", "verify", passportPath, "--deep", "--json"],
        {
          cwd: REPO_ROOT,
          env: { ...ENV, DEMA_HOME: home },
          timeout: 10000,
        },
      ).toString();
      const result = JSON.parse(out);
      assert.equal(result.verified, true);
    } finally {
      restore();
    }
  });

  it("exits 1 on missing receipt file", async () => {
    const { passportPath, restore } = await homeWithSignedPassportFile();
    try {
      try {
        execFileSync(
          "node",
          [
            CLI,
            "proof",
            "passport",
            "verify",
            passportPath,
            "--deep",
            "--receipts-dir",
            "/nonexistent/dir",
            "--json",
          ],
          { cwd: REPO_ROOT, env: ENV, timeout: 10000 },
        );
        assert.fail("should exit 1");
      } catch (err) {
        const result = JSON.parse(err.stdout.toString());
        assert.equal(result.verified, false);
        assert.equal(result.verdict, "FAILED");
      }
    } finally {
      restore();
    }
  });

  it("exits 1 on tampered receipt file", async () => {
    const { passportPath, receiptsDir, passport, restore } =
      await homeWithSignedPassportFile();
    try {
      const receiptPath = join(
        receiptsDir,
        passport.receipts[0].receipt_filename,
      );
      const r = JSON.parse(readFileSync(receiptPath, "utf8"));
      r.artifact.sha256 = "0".repeat(64);
      writeFileSync(receiptPath, JSON.stringify(r));
      try {
        execFileSync(
          "node",
          [
            CLI,
            "proof",
            "passport",
            "verify",
            passportPath,
            "--deep",
            "--receipts-dir",
            receiptsDir,
            "--json",
          ],
          { cwd: REPO_ROOT, env: ENV, timeout: 10000 },
        );
        assert.fail("should exit 1");
      } catch (err) {
        const result = JSON.parse(err.stdout.toString());
        assert.equal(result.verified, false);
      }
    } finally {
      restore();
    }
  });

  it("human output includes Deep Verification and scope", async () => {
    const { passportPath, receiptsDir, restore } =
      await homeWithSignedPassportFile();
    try {
      const out = execFileSync(
        "node",
        [
          CLI,
          "proof",
          "passport",
          "verify",
          passportPath,
          "--deep",
          "--receipts-dir",
          receiptsDir,
        ],
        { cwd: REPO_ROOT, env: ENV, timeout: 10000 },
      ).toString();
      assert.match(out, /Proof Passport Deep Verification: VERIFIED/);
      assert.match(out, /Scope:\s+PASSPORT_ENVELOPE_AND_RECEIPTS/);
      assert.match(out, /Truth:\s+LOCAL_PROOF_PASSPORT_DEEP_VERIFIED/);
    } finally {
      restore();
    }
  });

  it("no private key material in output", async () => {
    const { passportPath, receiptsDir, restore } =
      await homeWithSignedPassportFile();
    try {
      const out = execFileSync(
        "node",
        [
          CLI,
          "proof",
          "passport",
          "verify",
          passportPath,
          "--deep",
          "--receipts-dir",
          receiptsDir,
          "--json",
        ],
        { cwd: REPO_ROOT, env: ENV, timeout: 10000 },
      ).toString();
      assert.ok(!out.includes("BEGIN PRIVATE KEY"));
      assert.ok(!out.includes("private_key_pem"));
    } finally {
      restore();
    }
  });
});
