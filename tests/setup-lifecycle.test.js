import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  runSetup,
  checkSetup,
  removeSetup,
  REMOVE_CONSENT_PHRASE,
  EXPECTED_DIRS,
  EXPECTED_FILES,
} from "../packages/installer/src/setup.js";

async function freshHome() {
  return mkdtemp(join(tmpdir(), "dema-setup-test-"));
}

describe("runSetup", () => {
  it("creates dirs and files", async () => {
    const home = await freshHome();
    const result = await runSetup(home);
    assert.equal(result.schema, "bizra.dema.setup.v0.1");
    assert.equal(result.root, home);
    assert.ok(result.created);
    assert.ok(result.createdPaths.length > 0);
  });

  it("is idempotent", async () => {
    const home = await freshHome();
    await runSetup(home);
    const result = await runSetup(home);
    assert.equal(result.created, false);
    assert.equal(result.createdPaths.length, 0);
  });
});

describe("checkSetup", () => {
  it("returns INTACT after setup", async () => {
    const home = await freshHome();
    await runSetup(home);
    const check = await checkSetup(home);
    assert.equal(check.schema, "bizra.dema.setup_check.v0.1");
    assert.equal(check.verdict, "INTACT");
    assert.equal(check.integrity, "VERIFIED");
    assert.equal(check.missing.length, 0);
  });

  it("returns INCOMPLETE on fresh dir", async () => {
    const home = await freshHome();
    const check = await checkSetup(home);
    assert.equal(check.verdict, "INCOMPLETE");
    assert.ok(check.missing.length > 0);
  });

  it("includes sha256 hashes for files", async () => {
    const home = await freshHome();
    await runSetup(home);
    const check = await checkSetup(home);
    const hashes = check.file_hashes;
    assert.ok(Object.keys(hashes).length >= 2);
    for (const hash of Object.values(hashes)) {
      assert.match(hash, /^[a-f0-9]{64}$/);
    }
  });

  it("hashes match file content", async () => {
    const home = await freshHome();
    await runSetup(home);
    const check = await checkSetup(home);
    const profilePath = join(home, "profile.json");
    const profileHash = check.file_hashes[profilePath];
    const { createHash } = await import("node:crypto");
    const content = await readFile(profilePath);
    const expected = createHash("sha256").update(content).digest("hex");
    assert.equal(profileHash, expected);
  });

  it("checks all expected dirs", () => {
    assert.ok(EXPECTED_DIRS.includes("receipts"));
    assert.ok(EXPECTED_DIRS.includes("memory"));
    assert.ok(EXPECTED_DIRS.includes("logs"));
    assert.ok(EXPECTED_DIRS.includes("skills"));
  });

  it("checks all expected files", () => {
    assert.ok(EXPECTED_FILES.includes("profile.json"));
    assert.ok(EXPECTED_FILES.includes("config.local.json"));
  });
});

describe("removeSetup", () => {
  it("requires exact consent phrase", async () => {
    const home = await freshHome();
    await runSetup(home);
    const result = await removeSetup(home, { consent: "wrong" });
    assert.equal(result.removed, false);
    assert.equal(result.reason, "consent_phrase_mismatch");
    assert.equal(result.required_phrase, REMOVE_CONSENT_PHRASE);
  });

  it("dry-run does not remove", async () => {
    const home = await freshHome();
    await runSetup(home);
    const result = await removeSetup(home, {
      consent: REMOVE_CONSENT_PHRASE,
      dryRun: true,
    });
    assert.equal(result.removed, false);
    assert.equal(result.reason, "dry_run");
    assert.equal(result.dry_run, true);
    const check = await checkSetup(home);
    assert.equal(check.verdict, "INTACT");
  });

  it("removes with correct consent", async () => {
    const home = await freshHome();
    await runSetup(home);
    const result = await removeSetup(home, {
      consent: REMOVE_CONSENT_PHRASE,
    });
    assert.equal(result.removed, true);
    assert.equal(result.reason, "consent_verified");
    const check = await checkSetup(home);
    assert.equal(check.verdict, "INCOMPLETE");
  });

  it("handles not_found gracefully", async () => {
    const home = join(tmpdir(), "dema-nonexistent-" + Date.now());
    const result = await removeSetup(home, {
      consent: REMOVE_CONSENT_PHRASE,
    });
    assert.equal(result.removed, false);
    assert.equal(result.reason, "not_found");
  });

  it("REMOVE_CONSENT_PHRASE is exported and non-empty", () => {
    assert.equal(typeof REMOVE_CONSENT_PHRASE, "string");
    assert.ok(REMOVE_CONSENT_PHRASE.length > 5);
  });
});

describe("full lifecycle: install → check → remove → check", () => {
  it("completes the full cycle", async () => {
    const home = await freshHome();

    const setup = await runSetup(home);
    assert.ok(setup.created);

    const check1 = await checkSetup(home);
    assert.equal(check1.verdict, "INTACT");
    assert.equal(check1.integrity, "VERIFIED");

    const dryRemove = await removeSetup(home, {
      consent: REMOVE_CONSENT_PHRASE,
      dryRun: true,
    });
    assert.equal(dryRemove.removed, false);

    const check2 = await checkSetup(home);
    assert.equal(check2.verdict, "INTACT");

    const remove = await removeSetup(home, {
      consent: REMOVE_CONSENT_PHRASE,
    });
    assert.equal(remove.removed, true);

    const check3 = await checkSetup(home);
    assert.equal(check3.verdict, "INCOMPLETE");
  });
});
