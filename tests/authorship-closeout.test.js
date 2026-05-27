import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import {
  buildAuthorshipCloseout,
  formatAuthorshipCloseout,
  CLOSEOUT_SCHEMA,
} from "../packages/receipts/src/authorship-closeout.js";
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
  return mkdtempSync(join(tmpdir(), "dema-closeout-test-"));
}

async function homeWithSignedReceipt() {
  const home = freshHome();
  const old = process.env.DEMA_HOME;
  process.env.DEMA_HOME = home;
  await initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE,
    demaHome: home,
  });
  const artifact = join(home, "closeout-artifact.txt");
  writeFileSync(artifact, "closeout test content");
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

describe("buildAuthorshipCloseout", () => {
  it("returns NO_AUTHORSHIP_RECEIPTS on empty home", async () => {
    const closeout = await buildAuthorshipCloseout(freshHome());
    assert.equal(closeout.schema, CLOSEOUT_SCHEMA);
    assert.equal(closeout.found, false);
    assert.equal(closeout.verified, false);
    assert.equal(closeout.truth_label, "NO_AUTHORSHIP_RECEIPTS");
  });

  it("returns VERIFIED closeout after signing", async () => {
    const { home, restore } = await homeWithSignedReceipt();
    try {
      const closeout = await buildAuthorshipCloseout(home);
      assert.equal(closeout.found, true);
      assert.equal(closeout.verified, true);
      assert.equal(closeout.verdict, "VERIFIED");
      assert.equal(closeout.truth_label, "VERIFIED_LOCAL_AUTHORSHIP_RECEIPT");
      assert.ok(closeout.artifact);
      assert.ok(closeout.author);
      assert.match(closeout.public_key_fingerprint, /^[a-f0-9]{64}$/);
      assert.ok(closeout.receipt_path.includes("authorship-"));
    } finally {
      restore();
    }
  });

  it("returns FAILED closeout on tampered receipt", async () => {
    const { home, signResult, restore } = await homeWithSignedReceipt();
    try {
      const receipt = JSON.parse(readFileSync(signResult.receipt_path, "utf8"));
      receipt.artifact.sha256 = "0".repeat(64);
      writeFileSync(signResult.receipt_path, JSON.stringify(receipt));
      const closeout = await buildAuthorshipCloseout(home);
      assert.equal(closeout.found, true);
      assert.equal(closeout.verified, false);
      assert.equal(closeout.verdict, "FAILED");
      assert.equal(closeout.truth_label, "FAILED_LOCAL_AUTHORSHIP_RECEIPT");
    } finally {
      restore();
    }
  });

  it("boundary confirms no signing and no key access", async () => {
    const closeout = await buildAuthorshipCloseout(freshHome());
    assert.equal(closeout.boundary.signing_performed, false);
    assert.equal(closeout.boundary.private_key_loaded, false);
    assert.equal(closeout.boundary.receipt_mutated, false);
    assert.equal(closeout.boundary.network_used, false);
    assert.equal(closeout.boundary.federation_used, false);
    assert.equal(closeout.boundary.token_minted, false);
    assert.equal(closeout.boundary.verification_performed, true);
    assert.equal(closeout.boundary.summary_generated, true);
  });
});

describe("formatAuthorshipCloseout", () => {
  it("formats no-receipts message", () => {
    const text = formatAuthorshipCloseout({
      found: false,
      truth_label: "NO_AUTHORSHIP_RECEIPTS",
    });
    assert.match(text, /No receipts found/);
  });

  it("formats VERIFIED closeout", async () => {
    const { home, restore } = await homeWithSignedReceipt();
    try {
      const closeout = await buildAuthorshipCloseout(home);
      const text = formatAuthorshipCloseout(closeout);
      assert.match(text, /VERIFIED/);
      assert.match(text, /Artifact:/);
      assert.match(text, /SHA256:/);
      assert.match(text, /Author:/);
      assert.match(text, /Fingerprint:/);
      assert.match(text, /Truth label:/);
    } finally {
      restore();
    }
  });
});

describe("dema authorship closeout CLI", () => {
  it("exits 1 when no receipts", () => {
    const home = freshHome();
    try {
      execFileSync("node", [CLI, "authorship", "closeout", "--json"], {
        cwd: REPO_ROOT,
        env: { ...ENV, DEMA_HOME: home },
        timeout: 10000,
      });
      assert.fail("should exit 1");
    } catch (err) {
      const result = JSON.parse(err.stdout.toString());
      assert.equal(result.found, false);
      assert.equal(result.truth_label, "NO_AUTHORSHIP_RECEIPTS");
    }
  });

  it("returns VERIFIED closeout after sign", async () => {
    const { home, restore } = await homeWithSignedReceipt();
    try {
      const out = execFileSync(
        "node",
        [CLI, "authorship", "closeout", "--json"],
        {
          cwd: REPO_ROOT,
          env: { ...ENV, DEMA_HOME: home },
          timeout: 10000,
        },
      ).toString();
      const result = JSON.parse(out);
      assert.equal(result.verified, true);
      assert.equal(result.truth_label, "VERIFIED_LOCAL_AUTHORSHIP_RECEIPT");
    } finally {
      restore();
    }
  });
});
