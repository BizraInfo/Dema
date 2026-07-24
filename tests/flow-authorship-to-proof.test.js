import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

// TRACK 3 · Behavioral-flow harness — the authorship → proof lifecycle chain.
//
// One persistent DEMA_HOME threaded through:
//   setup → authorship key init → sign → receipts → latest →
//   proof passport → proof passport verify --deep
// plus the fail-closed consent gate, the empty-passport boundary, and on-disk
// tamper detection. This is the multi-step behavioral coverage the audit flagged
// as thin — every step persists real state the next step consumes.

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(REPO_ROOT, "apps/cli/src/index.js");
const BASE_ENV = {
  ...process.env,
  NO_COLOR: "1",
  NODE_ENV: "test",
  DEMA_NO_TUI: "1",
};

const KEY_CONSENT = "GENERATE AUTHORSHIP KEY";
const SIGN_CONSENT = "SIGN AUTHORSHIP RECEIPT";

function run(home, args) {
  const r = spawnSync("node", [CLI, ...args], {
    cwd: REPO_ROOT,
    env: { ...BASE_ENV, DEMA_HOME: home },
    encoding: "utf8",
    timeout: 15000,
  });
  return { stdout: r.stdout || "", stderr: r.stderr || "", status: r.status };
}

function runJson(home, args, { status = 0 } = {}) {
  const r = run(home, args);
  assert.equal(
    r.status,
    status,
    `expected \`${args.join(" ")}\` to exit ${status}, got ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`,
  );
  return JSON.parse(r.stdout);
}

function setupHome() {
  const home = mkdtempSync(join(tmpdir(), "dema-flow-auth-"));
  runJson(home, ["setup", "--json"]);
  return home;
}

// Build a passport into a file inside the home and return the path.
function writePassport(home, options) {
  const passport = runJson(home, ["proof", "passport", "--json"], options);
  const path = join(home, "passport.json");
  writeFileSync(path, JSON.stringify(passport, null, 2));
  return path;
}

function receiptFiles(home) {
  try {
    return readdirSync(join(home, "receipts")).filter((f) =>
      f.startsWith("authorship-"),
    );
  } catch {
    return [];
  }
}

describe("flow: consent-gated authorship → proof passport (persistent home)", () => {
  it("fail-closed: signing without the exact consent phrase writes no receipt", () => {
    const home = setupHome();
    try {
      writeFileSync(join(home, "a.txt"), "hello bizra proof");
      const res = runJson(
        home,
        ["authorship", "sign", join(home, "a.txt"), "--json"],
        { status: 1 },
      );
      assert.equal(res.signed, false);
      assert.equal(res.error, "consent_required");
      assert.equal(res.required_phrase, SIGN_CONSENT);
      assert.equal(res.boundary.receipt_written, false);
      // No receipt landed on disk.
      assert.equal(receiptFiles(home).length, 0);
      assert.deepEqual(runJson(home, ["receipts", "--json"]), []);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("happy path: key init → sign → receipts → latest → passport → deep verify VERIFIED", () => {
    const home = setupHome();
    try {
      // 1. Persist an Ed25519 authorship key (consent-gated).
      const keyInit = runJson(home, [
        "authorship",
        "key",
        "init",
        "--consent",
        KEY_CONSENT,
        "--json",
      ]);
      assert.equal(keyInit.initialized, true);
      assert.equal(keyInit.boundary.key_persisted, true);
      assert.match(keyInit.public_key_fingerprint, /^[0-9a-f]{64}$/);
      const fingerprint = keyInit.public_key_fingerprint;

      // 2. Sign a real artifact (consent-gated) — receipt persists.
      writeFileSync(join(home, "a.txt"), "hello bizra proof");
      const sign = runJson(home, [
        "authorship",
        "sign",
        join(home, "a.txt"),
        "--consent",
        SIGN_CONSENT,
        "--json",
      ]);
      assert.equal(sign.signed, true);
      assert.equal(sign.boundary.receipt_written, true);
      assert.equal(receiptFiles(home).length, 1);

      // 3. The receipt store now lists exactly one receipt.
      const receipts = runJson(home, ["receipts", "--json"]);
      assert.equal(receipts.length, 1);

      // 4. `latest` resolves it.
      const latest = runJson(home, ["authorship", "latest", "--json"]);
      assert.equal(latest.found, true);
      assert.ok(latest.receipt_filename.startsWith("authorship-"));

      // 5. The passport aggregates the receipt and verifies it.
      const passport = runJson(home, ["proof", "passport", "--json"]);
      assert.equal(passport.schema, "bizra.dema.proof_passport.v0.2");
      assert.equal(passport.aggregate.total_receipts, 1);
      assert.equal(passport.aggregate.verified_count, 1);
      assert.equal(passport.aggregate.verdict, "ALL_VERIFIED");
      assert.ok(
        passport.subject.public_key_fingerprints.includes(fingerprint),
        "passport subject must carry the operator key fingerprint",
      );

      // 6. Deep verify re-checks every receipt signature against the passport.
      const passportPath = writePassport(home);
      const deep = runJson(home, [
        "proof",
        "passport",
        "verify",
        passportPath,
        "--deep",
        "--json",
      ]);
      assert.equal(deep.verified, true);
      assert.equal(deep.verdict, "VERIFIED");
      assert.equal(deep.truth_label, "LOCAL_PROOF_PASSPORT_DEEP_VERIFIED");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("boundary: an empty home yields an EMPTY passport and DEEP_EMPTY verify", () => {
    const home = setupHome();
    try {
      const passport = runJson(home, ["proof", "passport", "--json"], {
        status: 1,
      });
      assert.equal(passport.aggregate.total_receipts, 0);
      assert.equal(passport.aggregate.verdict, "EMPTY");

      const passportPath = writePassport(home, { status: 1 });
      const deep = runJson(home, [
        "proof",
        "passport",
        "verify",
        passportPath,
        "--deep",
        "--json",
      ]);
      assert.equal(deep.verdict, "EMPTY");
      assert.equal(deep.truth_label, "LOCAL_PROOF_PASSPORT_DEEP_EMPTY");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("tamper detection: mutating a signed receipt on disk fails deep verification", () => {
    const home = setupHome();
    try {
      runJson(home, [
        "authorship",
        "key",
        "init",
        "--consent",
        KEY_CONSENT,
        "--json",
      ]);
      writeFileSync(join(home, "a.txt"), "hello bizra proof");
      runJson(home, [
        "authorship",
        "sign",
        join(home, "a.txt"),
        "--consent",
        SIGN_CONSENT,
        "--json",
      ]);

      // Tamper the persisted receipt's Ed25519 signature value.
      const files = receiptFiles(home);
      assert.equal(files.length, 1);
      const receiptPath = join(home, "receipts", files[0]);
      const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
      const sig = receipt.signature.value;
      receipt.signature.value = (sig[0] === "A" ? "B" : "A") + sig.slice(1);
      writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));

      // Rebuild the passport over the tampered store and deep-verify.
      const passportPath = writePassport(home, { status: 1 });
      const deep = runJson(
        home,
        ["proof", "passport", "verify", passportPath, "--deep", "--json"],
        { status: 1 },
      );
      assert.equal(deep.verified, false);
      assert.equal(deep.verdict, "FAILED");
      assert.equal(deep.truth_label, "LOCAL_PROOF_PASSPORT_DEEP_FAILED");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
