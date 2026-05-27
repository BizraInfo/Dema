import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import {
  findLatestAuthorshipReceipt,
  getLatestAuthorshipReceiptSummary,
  AUTHORSHIP_LATEST_SCHEMA,
} from "../packages/receipts/src/authorship-latest.js";
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

function freshHome() {
  return mkdtempSync(join(tmpdir(), "dema-latest-test-"));
}

describe("findLatestAuthorshipReceipt", () => {
  it("returns null when receipts dir missing", async () => {
    assert.equal(await findLatestAuthorshipReceipt(freshHome()), null);
  });

  it("returns null when receipts dir exists but empty", async () => {
    const home = freshHome();
    mkdirSync(join(home, "receipts"));
    assert.equal(await findLatestAuthorshipReceipt(home), null);
  });

  it("ignores non-authorship receipts", async () => {
    const home = freshHome();
    const dir = join(home, "receipts");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "witness-abc123.json"), "{}");
    writeFileSync(join(dir, "mission-health-xyz.json"), "{}");
    assert.equal(await findLatestAuthorshipReceipt(home), null);
  });

  it("ignores malformed filenames", async () => {
    const home = freshHome();
    const dir = join(home, "receipts");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "authorship.json"), "{}");
    writeFileSync(join(dir, "authorship-no-extension"), "{}");
    writeFileSync(join(dir, "not-authorship-abc.json"), "{}");
    assert.equal(await findLatestAuthorshipReceipt(home), null);
  });

  it("returns latest authorship receipt by mtimeMs", async () => {
    const home = freshHome();
    const dir = join(home, "receipts");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "authorship-aaa.json"), "{}");
    writeFileSync(join(dir, "authorship-bbb.json"), "{}");
    const result = await findLatestAuthorshipReceipt(home);
    assert.ok(result);
    assert.ok(result.path.endsWith(".json"));
    assert.ok(result.filename.startsWith("authorship-"));
    assert.ok(typeof result.mtimeMs === "number");
  });
});

describe("getLatestAuthorshipReceiptSummary", () => {
  it("returns found: false safely on empty home", async () => {
    const summary = await getLatestAuthorshipReceiptSummary(freshHome());
    assert.equal(summary.schema, AUTHORSHIP_LATEST_SCHEMA);
    assert.equal(summary.found, false);
    assert.equal(summary.receipt_path, null);
    assert.equal(summary.receipt_filename, null);
    assert.equal(summary.mtime_ms, null);
  });

  it("returns found: true with safe metadata after signing", async () => {
    const home = freshHome();
    const old = process.env.DEMA_HOME;
    process.env.DEMA_HOME = home;
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const artifact = join(home, "test.txt");
      writeFileSync(artifact, "hello");
      await signArtifact({
        artifactPath: artifact,
        consent: SIGN_CONSENT_PHRASE,
        demaHome: home,
      });
      const summary = await getLatestAuthorshipReceiptSummary(home);
      assert.equal(summary.found, true);
      assert.ok(summary.receipt_path.includes("authorship-"));
      assert.ok(summary.receipt_filename.startsWith("authorship-"));
      assert.ok(typeof summary.mtime_ms === "number");
    } finally {
      if (old) process.env.DEMA_HOME = old;
      else delete process.env.DEMA_HOME;
    }
  });

  it("boundary confirms read-only discipline", async () => {
    const summary = await getLatestAuthorshipReceiptSummary(freshHome());
    assert.equal(summary.boundary.read_only, true);
    assert.equal(summary.boundary.private_key_loaded, false);
    assert.equal(summary.boundary.public_key_loaded, false);
    assert.equal(summary.boundary.signature_verified, false);
    assert.equal(summary.boundary.network_used, false);
    assert.equal(summary.boundary.federation_used, false);
    assert.equal(summary.boundary.token_minted, false);
    assert.equal(summary.boundary.receipt_mutated, false);
  });
});

describe("dema authorship latest CLI", () => {
  const ENV = {
    ...process.env,
    NO_COLOR: "1",
    NODE_ENV: "test",
    DEMA_NO_TUI: "1",
  };

  it("exits 1 cleanly when no receipt exists", () => {
    const home = freshHome();
    try {
      execFileSync("node", [CLI, "authorship", "latest", "--json"], {
        cwd: REPO_ROOT,
        env: { ...ENV, DEMA_HOME: home },
        timeout: 10000,
      });
      assert.fail("should exit 1");
    } catch (err) {
      const result = JSON.parse(err.stdout.toString());
      assert.equal(result.found, false);
    }
  });

  it("returns found result after a sign", async () => {
    const home = freshHome();
    await initAuthorshipKey({
      consent: KEY_INIT_CONSENT_PHRASE,
      demaHome: home,
    });
    const artifact = join(home, "artifact.txt");
    writeFileSync(artifact, "sign me");
    await signArtifact({
      artifactPath: artifact,
      consent: SIGN_CONSENT_PHRASE,
      demaHome: home,
    });
    const out = execFileSync("node", [CLI, "authorship", "latest", "--json"], {
      cwd: REPO_ROOT,
      env: { ...ENV, DEMA_HOME: home },
      timeout: 10000,
    }).toString();
    const result = JSON.parse(out);
    assert.equal(result.found, true);
    assert.ok(result.receipt_path.includes("authorship-"));
  });
});
