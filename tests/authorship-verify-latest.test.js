import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import {
  verifyAuthorshipReceiptFile,
  formatAuthorshipVerification,
  VERIFY_RESULT_SCHEMA,
} from "../packages/receipts/src/authorship-verify.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
  loadAuthorshipTrustSnapshot,
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
  return mkdtempSync(join(tmpdir(), "dema-verify-latest-"));
}

async function homeWithSignedReceipt() {
  const home = freshHome();
  const old = process.env.DEMA_HOME;
  process.env.DEMA_HOME = home;
  await initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE,
    demaHome: home,
  });
  const artifact = join(home, "test-artifact.txt");
  writeFileSync(artifact, "verify-latest test content");
  const signResult = await signArtifact({
    artifactPath: artifact,
    consent: SIGN_CONSENT_PHRASE,
    demaHome: home,
  });
  return {
    home,
    signResult,
    restore: () => {
      if (old) process.env.DEMA_HOME = old;
      else delete process.env.DEMA_HOME;
    },
  };
}

describe("verifyAuthorshipReceiptFile", () => {
  it("fails on null path", async () => {
    const result = await verifyAuthorshipReceiptFile(null);
    assert.equal(result.schema, VERIFY_RESULT_SCHEMA);
    assert.equal(result.verified, false);
    assert.equal(result.error, "no_receipt_path");
  });

  it("fails on nonexistent file", async () => {
    const result = await verifyAuthorshipReceiptFile(
      "/nonexistent/receipt.json",
    );
    assert.equal(result.verified, false);
    assert.equal(result.error, "cannot_read_receipt");
  });

  it("fails on non-authorship JSON", async () => {
    const home = freshHome();
    const path = join(home, "fake.json");
    writeFileSync(path, JSON.stringify({ schema: "something.else" }));
    const result = await verifyAuthorshipReceiptFile(path);
    assert.equal(result.verified, false);
    assert.equal(result.error, "not_valid_authorship_receipt");
  });

  it("verifies a valid signed receipt", async () => {
    const { home, signResult, restore } = await homeWithSignedReceipt();
    try {
      const trust = await loadAuthorshipTrustSnapshot(home);
      const result = await verifyAuthorshipReceiptFile(
        signResult.receipt_path,
        trust,
      );
      assert.equal(result.verified, true);
      assert.equal(result.verdict, "VERIFIED");
      assert.equal(result.verification_scope, "ACTIVE_SIGNER_TRUST");
      assert.ok(result.artifact);
      assert.ok(result.author);
      assert.equal(result.receipt_path, signResult.receipt_path);
    } finally {
      restore();
    }
  });

  it("fails on tampered receipt", async () => {
    const { home, signResult, restore } = await homeWithSignedReceipt();
    try {
      const receipt = JSON.parse(readFileSync(signResult.receipt_path, "utf8"));
      receipt.artifact.sha256 = "0".repeat(64);
      writeFileSync(signResult.receipt_path, JSON.stringify(receipt));
      const trust = await loadAuthorshipTrustSnapshot(home);
      const result = await verifyAuthorshipReceiptFile(
        signResult.receipt_path,
        trust,
      );
      assert.equal(result.verified, false);
      assert.equal(result.verdict, "FAILED");
    } finally {
      restore();
    }
  });

  it("boundary confirms read-only discipline", async () => {
    const result = await verifyAuthorshipReceiptFile(null);
    assert.equal(result.boundary.network_used, false);
    assert.equal(result.boundary.mutation_performed, false);
    assert.equal(result.boundary.private_key_loaded, false);
    assert.equal(result.boundary.federation_used, false);
    assert.equal(result.boundary.token_minted, false);
  });
});

describe("formatAuthorshipVerification", () => {
  it("formats VERIFIED result", async () => {
    const { home, signResult, restore } = await homeWithSignedReceipt();
    try {
      const trust = await loadAuthorshipTrustSnapshot(home);
      const result = await verifyAuthorshipReceiptFile(
        signResult.receipt_path,
        trust,
      );
      const text = formatAuthorshipVerification(result);
      assert.match(text, /VERIFIED/);
      assert.match(text, /Artifact:/);
      assert.match(text, /SHA256:/);
      assert.match(text, /Author:/);
    } finally {
      restore();
    }
  });

  it("formats FAILED error result", () => {
    const text = formatAuthorshipVerification({
      verified: false,
      error: "cannot_read_receipt",
    });
    assert.match(text, /FAILED/);
  });
});

describe("dema authorship verify --latest CLI", () => {
  it("exits 1 when no authorship receipts exist", () => {
    const home = freshHome();
    try {
      execFileSync(
        "node",
        [CLI, "authorship", "verify", "--latest", "--json"],
        {
          cwd: REPO_ROOT,
          env: { ...ENV, DEMA_HOME: home },
          timeout: 10000,
        },
      );
      assert.fail("should exit 1");
    } catch (err) {
      const result = JSON.parse(err.stdout.toString());
      assert.equal(result.verified, false);
      assert.equal(result.error, "no_authorship_receipts_found");
    }
  });

  it("returns VERIFIED after key init + sign", async () => {
    const { home, restore } = await homeWithSignedReceipt();
    try {
      const out = execFileSync(
        "node",
        [CLI, "authorship", "verify", "--latest", "--json"],
        {
          cwd: REPO_ROOT,
          env: { ...ENV, DEMA_HOME: home },
          timeout: 10000,
        },
      ).toString();
      const result = JSON.parse(out);
      assert.equal(result.verified, true);
      assert.equal(result.verdict, "VERIFIED");
      assert.ok(result.receipt_path.includes("authorship-"));
    } finally {
      restore();
    }
  });

  it("explicit path verify still works", async () => {
    const { home, signResult, restore } = await homeWithSignedReceipt();
    try {
      const out = execFileSync(
        "node",
        [CLI, "authorship", "verify", signResult.receipt_path, "--json"],
        {
          cwd: REPO_ROOT,
          env: { ...ENV, DEMA_HOME: home },
          timeout: 10000,
        },
      ).toString();
      const result = JSON.parse(out);
      assert.equal(result.verified, true);
      assert.equal(result.verdict, "VERIFIED");
    } finally {
      restore();
    }
  });
});
