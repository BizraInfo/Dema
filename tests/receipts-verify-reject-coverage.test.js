// RECEIPTS-VERIFY-REJECT-COVERAGE-1A · in-process coverage of the live
// verification CLI reject contracts.
//
// `dema consent verify` (runConsentVerifyCli) and `dema verify-grounded`
// (runVerifyGroundedCli) were exercised only via SPAWNED child processes
// (dema-consent-cli / verdict-cli), which --experimental-test-coverage cannot
// attribute — so their structured rejection branches read ~28% covered despite
// integration tests existing. These tests assert the exact frozen reject shapes
// in-process. Permissionless verification: bad args + absent file paths only —
// no signing, no Block0 seal, no token/PoI, no consent collection.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runConsentVerifyCli } from "../packages/receipts/src/consent-verify-command.js";
import { runVerifyGroundedCli } from "../packages/receipts/src/verdict-verify-command.js";

function freshDir() {
  return mkdtempSync(join(tmpdir(), "rvr-"));
}
async function withDir(fn) {
  const dir = freshDir();
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// --- consent verify (runConsentVerifyCli) reject branches ---

test("consent verify: missing proofPath → frozen missing_proof_path", async () => {
  const r = await runConsentVerifyCli({});
  assert.equal(r.verified, false);
  assert.equal(r.rejected, true);
  assert.equal(r.reason, "missing_proof_path");
  assert.equal(r.required, "<proof.json>");
  assert.ok(Object.isFrozen(r));
});

test("consent verify: missing pubkeyPath → missing_pubkey_path", async () => {
  const r = await runConsentVerifyCli({ proofPath: "proof.json" });
  assert.equal(r.reason, "missing_pubkey_path");
  assert.equal(r.required, "--pubkey <external-pem-path>");
});

test("consent verify: unreadable proof file → proof_read_failed with details", async () => {
  await withDir(async (dir) => {
    const r = await runConsentVerifyCli({
      proofPath: join(dir, "absent-proof.json"),
      pubkeyPath: join(dir, "k.pem"),
    });
    assert.equal(r.reason, "proof_read_failed");
    assert.ok(typeof r.details === "string" && r.details.length > 0);
  });
});

test("consent verify: valid proof but unreadable pubkey → pubkey_read_failed", async () => {
  await withDir(async (dir) => {
    const proof = join(dir, "proof.json");
    writeFileSync(
      proof,
      JSON.stringify({ action_scope: { action_type: "x", target_hash: "y" } }),
    );
    const r = await runConsentVerifyCli({
      proofPath: proof,
      pubkeyPath: join(dir, "absent.pem"),
    });
    assert.equal(r.reason, "pubkey_read_failed");
    assert.ok(r.details.length > 0);
    assert.ok(Object.isFrozen(r));
  });
});

// --- verify-grounded (runVerifyGroundedCli) reject branches ---

test("verify-grounded: missing bundlePath → frozen missing_bundle_path", async () => {
  const r = await runVerifyGroundedCli({});
  assert.equal(r.verified, false);
  assert.equal(r.rejected, true);
  assert.equal(r.reason, "missing_bundle_path");
  assert.equal(r.required, "<bundle.json>");
  assert.ok(Object.isFrozen(r));
});

test("verify-grounded: missing pubkeyPath → missing_pubkey_path", async () => {
  const r = await runVerifyGroundedCli({ bundlePath: "bundle.json" });
  assert.equal(r.reason, "missing_pubkey_path");
  assert.equal(r.required, "--pubkey <external-pem-path>");
});

test("verify-grounded: missing ruleId → missing_rule_id", async () => {
  const r = await runVerifyGroundedCli({
    bundlePath: "bundle.json",
    pubkeyPath: "k.pem",
  });
  assert.equal(r.reason, "missing_rule_id");
  assert.equal(r.required, "--rule <rule_id>");
});

test("verify-grounded: unreadable bundle → bundle_read_failed with details", async () => {
  await withDir(async (dir) => {
    const r = await runVerifyGroundedCli({
      bundlePath: join(dir, "absent-bundle.json"),
      pubkeyPath: join(dir, "k.pem"),
      ruleId: "rule.v0.1",
    });
    assert.equal(r.reason, "bundle_read_failed");
    assert.ok(typeof r.details === "string" && r.details.length > 0);
  });
});

test("verify-grounded: valid bundle but unreadable pubkey → pubkey_read_failed", async () => {
  await withDir(async (dir) => {
    const bundle = join(dir, "bundle.json");
    writeFileSync(bundle, JSON.stringify({ rule_id: "rule.v0.1" }));
    const r = await runVerifyGroundedCli({
      bundlePath: bundle,
      pubkeyPath: join(dir, "absent.pem"),
      ruleId: "rule.v0.1",
    });
    assert.equal(r.reason, "pubkey_read_failed");
    assert.ok(r.details.length > 0);
  });
});
