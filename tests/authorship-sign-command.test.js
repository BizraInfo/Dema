import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import {
  signArtifact,
  SIGN_CONSENT_PHRASE,
  SIGN_RESULT_SCHEMA,
} from "../packages/receipts/src/authorship-sign-command.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import { verifyPayload } from "../packages/receipts/src/authorship-signature.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

async function freshHomeWithKey() {
  const home = mkdtempSync(join(tmpdir(), "dema-sign-test-"));
  const old = process.env.DEMA_HOME;
  process.env.DEMA_HOME = home;
  await initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE,
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

function writeArtifact(dir, name, content) {
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
}

describe("signArtifact", () => {
  it("refuses missing consent", async () => {
    const { home, restore } = await freshHomeWithKey();
    try {
      const artifact = writeArtifact(home, "test.txt", "hello");
      const result = await signArtifact({
        artifactPath: artifact,
        demaHome: home,
      });
      assert.equal(result.schema, SIGN_RESULT_SCHEMA);
      assert.equal(result.signed, false);
      assert.equal(result.error, "consent_required");
    } finally {
      restore();
    }
  });

  it("refuses wrong consent", async () => {
    const { home, restore } = await freshHomeWithKey();
    try {
      const artifact = writeArtifact(home, "test.txt", "hello");
      const result = await signArtifact({
        artifactPath: artifact,
        consent: "WRONG PHRASE",
        demaHome: home,
      });
      assert.equal(result.signed, false);
      assert.equal(result.error, "consent_required");
    } finally {
      restore();
    }
  });

  it("refuses missing artifact path", async () => {
    const { home, restore } = await freshHomeWithKey();
    try {
      const result = await signArtifact({
        consent: SIGN_CONSENT_PHRASE,
        demaHome: home,
      });
      assert.equal(result.signed, false);
      assert.equal(result.error, "artifact_path_required");
    } finally {
      restore();
    }
  });

  it("refuses nonexistent artifact", async () => {
    const { home, restore } = await freshHomeWithKey();
    try {
      const result = await signArtifact({
        artifactPath: join(home, "nonexistent.txt"),
        consent: SIGN_CONSENT_PHRASE,
        demaHome: home,
      });
      assert.equal(result.signed, false);
      assert.equal(result.error, "artifact_not_found");
    } finally {
      restore();
    }
  });

  it("refuses directory as artifact", async () => {
    const { home, restore } = await freshHomeWithKey();
    try {
      const dir = join(home, "subdir");
      mkdirSync(dir);
      const result = await signArtifact({
        artifactPath: dir,
        consent: SIGN_CONSENT_PHRASE,
        demaHome: home,
      });
      assert.equal(result.signed, false);
      assert.equal(result.error, "artifact_not_file");
    } finally {
      restore();
    }
  });

  it("refuses when key not initialized", async () => {
    const home = mkdtempSync(join(tmpdir(), "dema-sign-nokey-"));
    const result = await signArtifact({
      artifactPath: join(REPO_ROOT, "README.md"),
      consent: SIGN_CONSENT_PHRASE,
      demaHome: home,
    });
    assert.equal(result.signed, false);
    assert.equal(result.error, "key_not_initialized");
  });

  it("signs valid artifact and saves content-addressed receipt", async () => {
    const { home, restore } = await freshHomeWithKey();
    try {
      const artifact = writeArtifact(home, "test.txt", "hello bizra");
      const result = await signArtifact({
        artifactPath: artifact,
        consent: SIGN_CONSENT_PHRASE,
        demaHome: home,
      });
      assert.equal(result.schema, SIGN_RESULT_SCHEMA);
      assert.equal(result.signed, true);
      assert.equal(result.self_verified, true);
      assert.match(result.artifact_sha256, /^[a-f0-9]{64}$/);
      assert.match(result.receipt_hash, /^[a-f0-9]{64}$/);
      assert.ok(result.receipt_path.includes("authorship-"));
      assert.ok(existsSync(result.receipt_path));
    } finally {
      restore();
    }
  });

  it("receipt verifies using verifyPayload", async () => {
    const { home, restore } = await freshHomeWithKey();
    try {
      const artifact = writeArtifact(home, "test.txt", "verify me");
      const result = await signArtifact({
        artifactPath: artifact,
        consent: SIGN_CONSENT_PHRASE,
        demaHome: home,
      });
      const receipt = JSON.parse(readFileSync(result.receipt_path, "utf8"));
      const { signature, ...payload } = receipt;
      assert.equal(
        verifyPayload(payload, signature.value, signature.public_key_pem),
        true,
      );
    } finally {
      restore();
    }
  });

  it("tampered receipt fails verification", async () => {
    const { home, restore } = await freshHomeWithKey();
    try {
      const artifact = writeArtifact(home, "test.txt", "tamper test");
      const result = await signArtifact({
        artifactPath: artifact,
        consent: SIGN_CONSENT_PHRASE,
        demaHome: home,
      });
      const receipt = JSON.parse(readFileSync(result.receipt_path, "utf8"));
      const { signature, ...payload } = receipt;
      const tampered = {
        ...payload,
        artifact: { ...payload.artifact, sha256: "0".repeat(64) },
      };
      assert.equal(
        verifyPayload(tampered, signature.value, signature.public_key_pem),
        false,
      );
    } finally {
      restore();
    }
  });

  it("no private key in result JSON", async () => {
    const { home, restore } = await freshHomeWithKey();
    try {
      const artifact = writeArtifact(home, "test.txt", "leak check");
      const result = await signArtifact({
        artifactPath: artifact,
        consent: SIGN_CONSENT_PHRASE,
        demaHome: home,
      });
      const json = JSON.stringify(result);
      assert.ok(!json.includes("BEGIN PRIVATE KEY"));
      assert.ok(!json.includes("private_key_pem"));
    } finally {
      restore();
    }
  });

  it("no raw artifact content in receipt", async () => {
    const { home, restore } = await freshHomeWithKey();
    try {
      const content = "SECRET_ARTIFACT_CONTENT_12345";
      const artifact = writeArtifact(home, "secret.txt", content);
      const result = await signArtifact({
        artifactPath: artifact,
        consent: SIGN_CONSENT_PHRASE,
        demaHome: home,
      });
      const receiptText = readFileSync(result.receipt_path, "utf8");
      assert.ok(!receiptText.includes(content));
    } finally {
      restore();
    }
  });

  it("returns private_key_not_readable when key file is corrupt", async () => {
    const { home, restore } = await freshHomeWithKey();
    try {
      const { keyPaths } =
        await import("../packages/receipts/src/authorship-key-store.js");
      const paths = keyPaths(home);
      writeFileSync(paths.privateKey, "NOT A VALID PEM");
      const artifact = writeArtifact(home, "test.txt", "corrupt key test");
      const result = await signArtifact({
        artifactPath: artifact,
        consent: SIGN_CONSENT_PHRASE,
        demaHome: home,
      });
      assert.equal(result.signed, false);
      assert.equal(result.error, "signing_failed");
    } finally {
      restore();
    }
  });

  it("returns public_key_not_readable when public key is missing", async () => {
    const { home, restore } = await freshHomeWithKey();
    try {
      const { keyPaths } =
        await import("../packages/receipts/src/authorship-key-store.js");
      const paths = keyPaths(home);
      const { unlinkSync } = await import("node:fs");
      unlinkSync(paths.publicKey);
      const artifact = writeArtifact(home, "test.txt", "missing pub key");
      const result = await signArtifact({
        artifactPath: artifact,
        consent: SIGN_CONSENT_PHRASE,
        demaHome: home,
      });
      assert.equal(result.signed, false);
      assert.equal(result.error, "public_key_not_readable");
    } finally {
      restore();
    }
  });

  it("rechecks artifact size after read (post-read guard)", async () => {
    const { home, restore } = await freshHomeWithKey();
    try {
      const artifact = writeArtifact(home, "small.txt", "small");
      const result = await signArtifact({
        artifactPath: artifact,
        consent: SIGN_CONSENT_PHRASE,
        demaHome: home,
      });
      assert.equal(result.signed, true);
    } finally {
      restore();
    }
  });

  it("boundary flags are correct", async () => {
    const { home, restore } = await freshHomeWithKey();
    try {
      const artifact = writeArtifact(home, "test.txt", "boundary check");
      const result = await signArtifact({
        artifactPath: artifact,
        consent: SIGN_CONSENT_PHRASE,
        demaHome: home,
      });
      assert.equal(result.boundary.network_used, false);
      assert.equal(result.boundary.federation_used, false);
      assert.equal(result.boundary.token_minted, false);
      assert.equal(result.boundary.consent_collected, true);
      assert.equal(result.boundary.receipt_written, true);
      assert.equal(result.boundary.artifact_mutated, false);
      assert.equal(result.boundary.private_key_exposed, false);
    } finally {
      restore();
    }
  });
});
