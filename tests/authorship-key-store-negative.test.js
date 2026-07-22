import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
  chmodSync,
  rmdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  initAuthorshipKey,
  hasAuthorshipKey,
  loadPrivateKey,
  loadPublicKey,
  keyPaths,
  KEY_INIT_CONSENT_PHRASE,
  KEY_INIT_SCHEMA,
} from "../packages/receipts/src/authorship-key-store.js";

const tempDirs = [];

function freshHome() {
  const dir = mkdtempSync(join(tmpdir(), "dema-ak-neg-"));
  tempDirs.push(dir);
  return dir;
}

after(() => {
  for (const dir of tempDirs) {
    try {
      // restore permissions before cleanup so rmSync can descend
      const keysDir = join(dir, "keys");
      try {
        chmodSync(keysDir, 0o700);
      } catch {
        // dir may not exist
      }
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
});

// ── consent-gate cases ─────────────────────────────────────────────────────

describe("initAuthorshipKey — consent gate adversarial", () => {
  it("force:true without consent is still refused (consent check precedes force)", async () => {
    const home = freshHome();
    const result = await initAuthorshipKey({
      consent: "wrong",
      force: true,
      demaHome: home,
    });
    assert.equal(result.schema, KEY_INIT_SCHEMA);
    assert.equal(result.initialized, false);
    assert.equal(result.error, "consent_required");
    assert.equal(result.boundary.key_persisted, false);
    // no key files written
    const paths = keyPaths(home);
    assert.equal(existsSync(paths.privateKey), false);
    assert.equal(existsSync(paths.publicKey), false);
  });

  it("null consent is refused (not coerced to phrase)", async () => {
    const home = freshHome();
    const result = await initAuthorshipKey({ consent: null, demaHome: home });
    assert.equal(result.initialized, false);
    assert.equal(result.error, "consent_required");
    assert.equal(result.boundary.key_persisted, false);
  });

  it("no arguments at all returns consent_required without throwing", async () => {
    const result = await initAuthorshipKey();
    assert.equal(result.initialized, false);
    assert.equal(result.error, "consent_required");
    assert.equal(result.boundary.key_persisted, false);
  });

  it("consent-fail envelope contains no private key material", async () => {
    const result = await initAuthorshipKey({
      consent: "bad",
      demaHome: freshHome(),
    });
    const json = JSON.stringify(result);
    assert.ok(
      !json.includes("BEGIN PRIVATE KEY"),
      "no PEM private header in consent-fail envelope",
    );
    assert.ok(
      !json.includes("private_key_pem"),
      "no raw key field in consent-fail envelope",
    );
  });
});

// ── symlink-containment adversarial ────────────────────────────────────────

describe("initAuthorshipKey — symlink containment adversarial", () => {
  it("public key file is a symlink outside DEMA_HOME → unsafe_key_path, no key written", async () => {
    const home = freshHome();
    const outside = mkdtempSync(join(tmpdir(), "dema-ak-neg-escape-pub-"));
    tempDirs.push(outside);
    const escapedTarget = join(outside, "escaped-public.pem");
    const paths = keyPaths(home);
    mkdirSync(paths.dir, { recursive: true });
    symlinkSync(escapedTarget, paths.publicKey);

    const result = await initAuthorshipKey({
      consent: KEY_INIT_CONSENT_PHRASE,
      demaHome: home,
    });

    assert.equal(result.initialized, false);
    assert.equal(result.error, "unsafe_key_path");
    assert.equal(result.boundary.key_persisted, false);
    // symlink target must not have been written
    assert.equal(existsSync(escapedTarget), false);
  });

  it("keys directory itself is a symlink → unsafe_key_path", async () => {
    const home = freshHome();
    const outside = mkdtempSync(join(tmpdir(), "dema-ak-neg-dir-sym-"));
    tempDirs.push(outside);
    // plant a real-looking key dir outside home, then symlink keys → outside
    symlinkSync(outside, join(home, "keys"), "dir");

    const result = await initAuthorshipKey({
      consent: KEY_INIT_CONSENT_PHRASE,
      demaHome: home,
    });

    assert.equal(result.initialized, false);
    assert.equal(result.error, "unsafe_key_path");
    assert.equal(result.boundary.key_persisted, false);
    // outside dir must remain empty
    assert.equal(readdirSync(outside).length, 0);
  });

  it("symlink loop on private key path → unsafe_key_path (ELOOP caught)", async () => {
    const home = freshHome();
    const paths = keyPaths(home);
    mkdirSync(paths.dir, { recursive: true });
    // self-referential symlink triggers ELOOP on open O_NOFOLLOW
    symlinkSync(paths.privateKey, paths.privateKey);

    const result = await initAuthorshipKey({
      consent: KEY_INIT_CONSENT_PHRASE,
      demaHome: home,
    });

    assert.equal(result.initialized, false);
    assert.equal(result.error, "unsafe_key_path");
    assert.equal(result.boundary.key_persisted, false);
  });
});

// ── no-clobber / re-init ──────────────────────────────────────────────────

describe("initAuthorshipKey — no-clobber adversarial", () => {
  it("force:true with consent replaces key and emits new fingerprint", async () => {
    const home = freshHome();
    const first = await initAuthorshipKey({
      consent: KEY_INIT_CONSENT_PHRASE,
      demaHome: home,
    });
    assert.equal(first.initialized, true);

    const second = await initAuthorshipKey({
      consent: KEY_INIT_CONSENT_PHRASE,
      force: true,
      demaHome: home,
    });
    assert.equal(second.initialized, true);
    assert.equal(second.boundary.key_persisted, true);
    // A new keypair should produce a different fingerprint (astronomically likely)
    assert.notEqual(
      second.public_key_fingerprint,
      first.public_key_fingerprint,
    );
  });

  it("force:true result envelope contains no private key material", async () => {
    const home = freshHome();
    const result = await initAuthorshipKey({
      consent: KEY_INIT_CONSENT_PHRASE,
      force: true,
      demaHome: home,
    });
    assert.equal(result.initialized, true);
    const json = JSON.stringify(result);
    assert.ok(
      !json.includes("BEGIN PRIVATE KEY"),
      "no PEM private header in force-reinit envelope",
    );
    assert.ok(
      !json.includes("private_key_pem"),
      "no raw key field in force-reinit envelope",
    );
  });
});

// ── loadPrivateKey / loadPublicKey adversarial ─────────────────────────────

describe("loadPrivateKey — adversarial", () => {
  it("returns null for a zero-permission (unreadable) private key file", async () => {
    const home = freshHome();
    const inited = await initAuthorshipKey({
      consent: KEY_INIT_CONSENT_PHRASE,
      demaHome: home,
    });
    // make unreadable by owner — open(O_RDONLY) will fail
    chmodSync(inited.private_key_path, 0o000);
    const result = await loadPrivateKey(home);
    assert.equal(result, null);
  });

  it("returns null for a symlink outside DEMA_HOME pointing to real file", async () => {
    const home = freshHome();
    const outside = mkdtempSync(join(tmpdir(), "dema-ak-neg-load-priv-"));
    tempDirs.push(outside);
    const externalKey = join(outside, "secret.pem");
    // Fixture content is irrelevant: loadPrivateKey rejects on symlink-outside-
    // DEMA_HOME BEFORE reading the file. Deliberately NOT a PEM header so the
    // secret-scanner (gitleaks private-key rule) doesn't flag a fake test fixture.
    writeFileSync(
      externalKey,
      "test-only placeholder; symlink target rejected before read\n",
    );
    const paths = keyPaths(home);
    mkdirSync(paths.dir, { recursive: true });
    symlinkSync(externalKey, paths.privateKey);

    assert.equal(await loadPrivateKey(home), null);
  });
});

describe("loadPublicKey — adversarial", () => {
  it("returns null when public key is a symlink outside DEMA_HOME", async () => {
    const home = freshHome();
    const outside = mkdtempSync(join(tmpdir(), "dema-ak-neg-load-pub-"));
    tempDirs.push(outside);
    const externalPub = join(outside, "public.pem");
    writeFileSync(
      externalPub,
      "-----BEGIN PUBLIC KEY-----\nFAKE\n-----END PUBLIC KEY-----\n",
    );
    const paths = keyPaths(home);
    mkdirSync(paths.dir, { recursive: true });
    symlinkSync(externalPub, paths.publicKey);

    assert.equal(await loadPublicKey(home), null);
  });

  it("returns null for an unreadable public key file", async () => {
    const home = freshHome();
    const inited = await initAuthorshipKey({
      consent: KEY_INIT_CONSENT_PHRASE,
      demaHome: home,
    });
    chmodSync(inited.public_key_path, 0o000);
    assert.equal(await loadPublicKey(home), null);
  });
});

// ── hasAuthorshipKey adversarial ─────────────────────────────────────────

describe("hasAuthorshipKey — adversarial", () => {
  it("returns false when private key file is a symlink (even if target exists)", async () => {
    const home = freshHome();
    const outside = mkdtempSync(join(tmpdir(), "dema-ak-neg-has-sym-"));
    tempDirs.push(outside);
    const externalKey = join(outside, "real.pem");
    writeFileSync(externalKey, "fake-key-content");
    const paths = keyPaths(home);
    mkdirSync(paths.dir, { recursive: true });
    symlinkSync(externalKey, paths.privateKey);

    assert.equal(await hasAuthorshipKey(home), false);
  });

  it("returns false when keys directory does not exist", async () => {
    const home = freshHome();
    // freshHome exists but keys/ subdirectory is never created
    assert.equal(await hasAuthorshipKey(home), false);
  });
});

// ── demaHome type safety ──────────────────────────────────────────────────

describe("initAuthorshipKey — demaHome type safety", () => {
  it("non-string demaHome (number) falls back without crashing, refuses consent", async () => {
    // passes a number — keysDir() will use env/homedir fallback
    // we pass wrong consent so it refuses before touching the real home
    const result = await initAuthorshipKey({ consent: "bad", demaHome: 42 });
    assert.equal(result.initialized, false);
    assert.equal(result.error, "consent_required");
    // no crash
  });

  it("empty-string demaHome falls back without crashing, refuses consent", async () => {
    const result = await initAuthorshipKey({ consent: "", demaHome: "" });
    assert.equal(result.initialized, false);
    assert.equal(result.error, "consent_required");
  });
});
