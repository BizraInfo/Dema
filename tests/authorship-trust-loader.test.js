import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  activeKeyPaths,
  AUTHORSHIP_TRUST_SNAPSHOT_SCHEMA,
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
  loadActiveKeyPair,
  loadAuthorshipTrustSnapshot,
} from "../packages/receipts/src/authorship-key-store.js";
import { sha256 } from "../packages/receipts/src/authorship-signature.js";

async function initializedHome() {
  const home = mkdtempSync(join(tmpdir(), "dema-authorship-trust-home-"));
  const result = await initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE,
    demaHome: home,
    now: "2026-07-24T00:00:00.000Z",
  });
  assert.equal(result.initialized, true);
  return home;
}

describe("public-only authorship trust snapshot loader", () => {
  it("loads the active public trust snapshot from an explicit fixture home", async () => {
    const home = await initializedHome();
    const pair = await loadActiveKeyPair(home);

    const snapshot = await loadAuthorshipTrustSnapshot(home);

    assert.equal(snapshot.schema, AUTHORSHIP_TRUST_SNAPSHOT_SCHEMA);
    assert.equal(snapshot.active_fingerprint, pair.fingerprint);
    assert.equal(snapshot.active_public_key_pem, pair.public_key_pem);
    assert.deepEqual(snapshot.retired_fingerprints, []);
  });

  it("does not read or require the active private key", async () => {
    const home = await initializedHome();
    const pair = await loadActiveKeyPair(home);
    const privatePath = join(pair.generation_path, "private.pem");
    renameSync(privatePath, `${privatePath}.fixture-preserved`);
    mkdirSync(privatePath);

    const snapshot = await loadAuthorshipTrustSnapshot(home);
    const signingPair = await loadActiveKeyPair(home);

    assert.equal(snapshot.schema, AUTHORSHIP_TRUST_SNAPSHOT_SCHEMA);
    assert.equal(snapshot.active_fingerprint, pair.fingerprint);
    assert.equal(signingPair.ok, false);
    assert.equal(signingPair.error, "generation_unsafe");
  });

  it("rejects an active fingerprint recorded as retired", async () => {
    const home = await initializedHome();
    const pair = await loadActiveKeyPair(home);
    writeFileSync(
      activeKeyPaths(home).retiredRegistry,
      JSON.stringify({ retired: [{ fingerprint: pair.fingerprint }] }),
    );

    const snapshot = await loadAuthorshipTrustSnapshot(home);

    assert.equal(snapshot.ok, false);
    assert.equal(snapshot.error, "retired_generation");
  });

  it("requires a rotated pointer's previous generation in the retirement registry", async () => {
    const home = await initializedHome();
    const paths = activeKeyPaths(home);
    const pointer = JSON.parse(readFileSync(paths.activePointer, "utf8"));
    const previousFingerprint = "a".repeat(64);
    writeFileSync(
      paths.activePointer,
      JSON.stringify({
        ...pointer,
        previous_generation: previousFingerprint,
      }),
    );

    const missingRegistryTrust = await loadAuthorshipTrustSnapshot(home);
    const missingRegistryPair = await loadActiveKeyPair(home);
    assert.equal(missingRegistryTrust.ok, false);
    assert.equal(missingRegistryTrust.error, "retired_registry_incomplete");
    assert.equal(missingRegistryPair.ok, false);
    assert.equal(missingRegistryPair.error, "retired_registry_incomplete");

    writeFileSync(
      paths.retiredRegistry,
      JSON.stringify({
        retired: [{ fingerprint: previousFingerprint }],
      }),
    );

    const snapshot = await loadAuthorshipTrustSnapshot(home);
    const signingPair = await loadActiveKeyPair(home);
    assert.equal(snapshot.schema, AUTHORSHIP_TRUST_SNAPSHOT_SCHEMA);
    assert.deepEqual(snapshot.retired_fingerprints, [previousFingerprint]);
    assert.equal(signingPair.ok, true);
  });

  it("fails closed on a malformed retired registry", async () => {
    const home = await initializedHome();
    writeFileSync(activeKeyPaths(home).retiredRegistry, "{corrupt");

    const snapshot = await loadAuthorshipTrustSnapshot(home);

    assert.equal(snapshot.ok, false);
    assert.equal(snapshot.error, "retired_registry_unreadable");
  });

  it("makes malformed retirement entries an explicit fail-closed condition", async () => {
    const home = await initializedHome();
    writeFileSync(
      activeKeyPaths(home).retiredRegistry,
      JSON.stringify({ retired: [{ fingerprint: "not-a-fingerprint" }] }),
    );

    const snapshot = await loadAuthorshipTrustSnapshot(home);
    const signingPair = await loadActiveKeyPair(home);

    assert.equal(snapshot.ok, false);
    assert.equal(snapshot.error, "retired_registry_unreadable");
    assert.equal(signingPair.ok, false);
    assert.equal(signingPair.error, "retired_registry_unreadable");
  });

  it("rejects a malformed active pointer", async () => {
    const home = await initializedHome();
    writeFileSync(activeKeyPaths(home).activePointer, "{corrupt");

    const snapshot = await loadAuthorshipTrustSnapshot(home);

    assert.equal(snapshot.ok, false);
    assert.equal(snapshot.error, "malformed_pointer");
  });

  it("rejects a symlinked generations root that escapes the keys directory", async () => {
    const sourceHome = await initializedHome();
    const sourcePaths = activeKeyPaths(sourceHome);
    const escapedHome = mkdtempSync(
      join(tmpdir(), "dema-authorship-trust-escaped-home-"),
    );
    const escapedPaths = activeKeyPaths(escapedHome);
    mkdirSync(escapedPaths.dir, { recursive: true });
    symlinkSync(sourcePaths.generationsDir, escapedPaths.generationsDir);
    writeFileSync(
      escapedPaths.activePointer,
      readFileSync(sourcePaths.activePointer, "utf8"),
    );

    const snapshot = await loadAuthorshipTrustSnapshot(escapedHome);
    const signingPair = await loadActiveKeyPair(escapedHome);

    assert.equal(snapshot.ok, false);
    assert.equal(snapshot.error, "pointer_escape");
    assert.equal(signingPair.ok, false);
    assert.equal(signingPair.error, "pointer_escape");
  });

  it("rejects public metadata that no longer binds the public key bytes", async () => {
    const home = await initializedHome();
    const pair = await loadActiveKeyPair(home);
    const metadataPath = join(pair.generation_path, "metadata.json");
    const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
    metadata.public_content_hash = "0".repeat(64);
    writeFileSync(metadataPath, JSON.stringify(metadata));

    const snapshot = await loadAuthorshipTrustSnapshot(home);

    assert.equal(snapshot.ok, false);
    assert.equal(snapshot.error, "content_hash_mismatch");
  });

  it("rejects public bytes that hash correctly but are not an Ed25519 key", async () => {
    const home = await initializedHome();
    const pair = await loadActiveKeyPair(home);
    const publicPath = join(pair.generation_path, "public.pem");
    const metadataPath = join(pair.generation_path, "metadata.json");
    const invalidPublic = "not-a-public-key";
    const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
    metadata.public_content_hash = sha256(invalidPublic);
    writeFileSync(publicPath, invalidPublic);
    writeFileSync(metadataPath, JSON.stringify(metadata));

    const snapshot = await loadAuthorshipTrustSnapshot(home);

    assert.equal(snapshot.ok, false);
    assert.equal(snapshot.error, "public_key_invalid");
  });
});
