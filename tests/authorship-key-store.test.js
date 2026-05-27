import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  initAuthorshipKey,
  hasAuthorshipKey,
  loadPublicKey,
  keyPaths,
  KEY_INIT_CONSENT_PHRASE,
  KEY_INIT_SCHEMA,
} from "../packages/receipts/src/authorship-key-store.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(REPO_ROOT, "apps/cli/src/index.js");

function freshHome() {
  return mkdtempSync(join(tmpdir(), "dema-key-init-"));
}

describe("initAuthorshipKey", () => {
  it("refuses without consent", async () => {
    const home = freshHome();
    const result = await initAuthorshipKey({ demaHome: home });
    assert.equal(result.schema, KEY_INIT_SCHEMA);
    assert.equal(result.initialized, false);
    assert.equal(result.error, "consent_required");
    assert.equal(result.required_phrase, KEY_INIT_CONSENT_PHRASE);
    assert.equal(result.boundary.key_persisted, false);
  });

  it("refuses with wrong consent phrase", async () => {
    const home = freshHome();
    const result = await initAuthorshipKey({
      consent: "wrong phrase",
      demaHome: home,
    });
    assert.equal(result.initialized, false);
    assert.equal(result.error, "consent_required");
  });

  it("generates and persists keypair with correct consent", async () => {
    const home = freshHome();
    const result = await initAuthorshipKey({
      consent: KEY_INIT_CONSENT_PHRASE,
      demaHome: home,
    });
    assert.equal(result.schema, KEY_INIT_SCHEMA);
    assert.equal(result.initialized, true);
    assert.match(result.public_key_fingerprint, /^[a-f0-9]{64}$/);
    assert.ok(result.private_key_path.includes("node0-ed25519.pem"));
    assert.ok(result.public_key_path.includes("node0-ed25519.pub.pem"));
    assert.equal(result.boundary.key_persisted, true);
    assert.equal(result.boundary.network_used, false);
    assert.equal(result.boundary.federation_used, false);
    assert.equal(result.boundary.token_minted, false);
  });

  it("writes private key with mode 0o600", async () => {
    const home = freshHome();
    await initAuthorshipKey({
      consent: KEY_INIT_CONSENT_PHRASE,
      demaHome: home,
    });
    const paths = keyPaths(home);
    const mode = statSync(paths.privateKey).mode & 0o777;
    assert.equal(mode, 0o600);
  });

  it("writes valid PEM files", async () => {
    const home = freshHome();
    await initAuthorshipKey({
      consent: KEY_INIT_CONSENT_PHRASE,
      demaHome: home,
    });
    const paths = keyPaths(home);
    const priv = readFileSync(paths.privateKey, "utf8");
    const pub = readFileSync(paths.publicKey, "utf8");
    assert.ok(priv.startsWith("-----BEGIN PRIVATE KEY-----"));
    assert.ok(pub.startsWith("-----BEGIN PUBLIC KEY-----"));
  });

  it("never includes private key in result JSON", async () => {
    const home = freshHome();
    const result = await initAuthorshipKey({
      consent: KEY_INIT_CONSENT_PHRASE,
      demaHome: home,
    });
    const json = JSON.stringify(result);
    assert.ok(!json.includes("BEGIN PRIVATE KEY"));
    assert.ok(!json.includes("private_key_pem"));
  });

  it("refuses second init without force", async () => {
    const home = freshHome();
    await initAuthorshipKey({
      consent: KEY_INIT_CONSENT_PHRASE,
      demaHome: home,
    });
    const result = await initAuthorshipKey({
      consent: KEY_INIT_CONSENT_PHRASE,
      demaHome: home,
    });
    assert.equal(result.initialized, false);
    assert.equal(result.error, "key_already_exists");
    assert.equal(result.boundary.key_persisted, false);
  });
});

describe("hasAuthorshipKey", () => {
  it("returns false on fresh home", async () => {
    assert.equal(await hasAuthorshipKey(freshHome()), false);
  });

  it("returns true after init", async () => {
    const home = freshHome();
    await initAuthorshipKey({
      consent: KEY_INIT_CONSENT_PHRASE,
      demaHome: home,
    });
    assert.equal(await hasAuthorshipKey(home), true);
  });
});

describe("loadPublicKey", () => {
  it("returns null on fresh home", async () => {
    assert.equal(await loadPublicKey(freshHome()), null);
  });

  it("returns PEM after init", async () => {
    const home = freshHome();
    await initAuthorshipKey({
      consent: KEY_INIT_CONSENT_PHRASE,
      demaHome: home,
    });
    const pem = await loadPublicKey(home);
    assert.ok(pem.startsWith("-----BEGIN PUBLIC KEY-----"));
  });
});

describe("dema authorship key init CLI", () => {
  const ENV = {
    ...process.env,
    NO_COLOR: "1",
    NODE_ENV: "test",
    DEMA_NO_TUI: "1",
  };

  it("exits 1 without consent", () => {
    const home = freshHome();
    try {
      execFileSync("node", [CLI, "authorship", "key", "init", "--json"], {
        cwd: REPO_ROOT,
        env: { ...ENV, DEMA_HOME: home },
        timeout: 10000,
      });
      assert.fail("should exit 1");
    } catch (err) {
      const result = JSON.parse(err.stdout.toString());
      assert.equal(result.initialized, false);
      assert.equal(result.error, "consent_required");
    }
  });

  it("succeeds with correct consent and returns JSON", () => {
    const home = freshHome();
    const out = execFileSync(
      "node",
      [
        CLI,
        "authorship",
        "key",
        "init",
        "--consent",
        KEY_INIT_CONSENT_PHRASE,
        "--json",
      ],
      {
        cwd: REPO_ROOT,
        env: { ...ENV, DEMA_HOME: home },
        timeout: 10000,
      },
    ).toString();
    const result = JSON.parse(out);
    assert.equal(result.initialized, true);
    assert.match(result.public_key_fingerprint, /^[a-f0-9]{64}$/);
    assert.ok(existsSync(result.private_key_path));
  });
});
