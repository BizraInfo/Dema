import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(REPO_ROOT, "apps/cli/src/index.js");
const ENV = {
  ...process.env,
  NO_COLOR: "1",
  NODE_ENV: "test",
  DEMA_NO_TUI: "1",
};

function run(args, opts = {}) {
  const home = mkdtempSync(join(tmpdir(), "dema-auth-cli-"));
  return execFileSync("node", [CLI, ...args], {
    cwd: REPO_ROOT,
    env: { ...ENV, DEMA_HOME: home },
    timeout: 10000,
    ...opts,
  });
}

function runJson(args) {
  return JSON.parse(run(args).toString());
}

describe("dema authorship demo", () => {
  it("returns VERIFIED self-proof in JSON", () => {
    const result = runJson(["authorship", "demo", "--json"]);
    assert.equal(result.schema, "bizra.dema.authorship_demo.v0.1");
    assert.equal(result.mode, "EPHEMERAL_DEMO");
    assert.equal(result.self_verify, "VERIFIED");
    assert.equal(result.receipt.schema, "bizra.dema.authorship_signature.v0.1");
    assert.equal(result.receipt.signature.algorithm, "ed25519");
    assert.equal(result.boundary.key_persisted, false);
    assert.equal(result.boundary.receipt_saved, false);
  });

  it("renders human output without --json", () => {
    const out = run(["authorship", "demo"]).toString();
    assert.match(out, /Ed25519 Authorship Demo/);
    assert.match(out, /Self-verify:.*VERIFIED/);
    assert.match(out, /No keys or receipts were saved/);
  });
});

describe("dema authorship verify", () => {
  it("verifies a valid signed receipt", () => {
    const demo = runJson(["authorship", "demo", "--json"]);
    const tmp = mkdtempSync(join(tmpdir(), "dema-auth-verify-"));
    const receiptPath = join(tmp, "receipt.json");
    writeFileSync(receiptPath, JSON.stringify(demo.receipt, null, 2));

    const result = runJson(["authorship", "verify", receiptPath, "--json"]);
    assert.equal(result.schema, "bizra.dema.authorship_verify_result.v0.1");
    assert.equal(result.verified, true);
    assert.equal(result.verdict, "VERIFIED");
  });

  it("rejects a tampered receipt", () => {
    const demo = runJson(["authorship", "demo", "--json"]);
    const tampered = {
      ...demo.receipt,
      artifact: { ...demo.receipt.artifact, sha256: "0".repeat(64) },
    };
    const tmp = mkdtempSync(join(tmpdir(), "dema-auth-tamper-"));
    const receiptPath = join(tmp, "tampered.json");
    writeFileSync(receiptPath, JSON.stringify(tampered, null, 2));

    try {
      run(["authorship", "verify", receiptPath, "--json"]);
      assert.fail("should have exited non-zero");
    } catch (err) {
      const result = JSON.parse(err.stdout.toString());
      assert.equal(result.verified, false);
      assert.equal(result.verdict, "FAILED");
    }
  });

  it("exits 1 on missing file argument", () => {
    try {
      run(["authorship", "verify"]);
      assert.fail("should have exited non-zero");
    } catch (err) {
      assert.equal(err.status, 1);
    }
  });

  it("exits 1 on nonexistent file", () => {
    try {
      run(["authorship", "verify", "/nonexistent/receipt.json", "--json"]);
      assert.fail("should have exited non-zero");
    } catch (err) {
      const result = JSON.parse(err.stdout.toString());
      assert.equal(result.verified, false);
    }
  });
});
