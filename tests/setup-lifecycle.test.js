import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  symlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { homedir, tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
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

const REPO_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);

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

  it("uninstalls a relative setup root after the process cwd changes", async () => {
    const sandbox = await freshHome();
    const originalCwd = process.cwd();
    try {
      process.chdir(sandbox);
      await runSetup("relative-home");
      process.chdir(tmpdir());

      const home = join(sandbox, "relative-home");
      const result = await removeSetup(home, {
        consent: REMOVE_CONSENT_PHRASE,
        dryRun: true,
      });

      assert.equal(result.removed, false);
      assert.equal(result.reason, "dry_run");
      assert.ok(result.would_remove.includes(join(home, ".dema-root.json")));
    } finally {
      process.chdir(originalCwd);
    }
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

  it("removes only Dema-owned setup paths, preserving unrelated files", async () => {
    const home = await freshHome();
    const unrelatedPath = join(home, "operator-notes.txt");
    await writeFile(unrelatedPath, "keep me\n");
    await runSetup(home);

    const result = await removeSetup(home, {
      consent: REMOVE_CONSENT_PHRASE,
    });

    assert.equal(result.removed, true);
    assert.equal(await readFile(unrelatedPath, "utf8"), "keep me\n");
    const check = await checkSetup(home);
    assert.equal(check.verdict, "INCOMPLETE");
  });

  it("preserves pre-existing contents inside setup-named directories", async () => {
    const home = await freshHome();
    const existingLogs = join(home, "logs");
    await mkdir(existingLogs, { recursive: true });
    const sentinelPath = join(existingLogs, "preexisting.log");
    await writeFile(sentinelPath, "not owned by dema\n");
    await runSetup(home);

    const result = await removeSetup(home, {
      consent: REMOVE_CONSENT_PHRASE,
    });

    assert.equal(result.removed, true);
    assert.equal(await readFile(sentinelPath, "utf8"), "not owned by dema\n");
  });

  it("handles not_found gracefully", async () => {
    const home = join(tmpdir(), "dema-nonexistent-" + Date.now());
    const result = await removeSetup(home, {
      consent: REMOVE_CONSENT_PHRASE,
    });
    assert.equal(result.removed, false);
    assert.equal(result.reason, "not_found");
  });

  it("refuses filesystem root before dry-run planning", async () => {
    const result = await removeSetup("/", {
      consent: REMOVE_CONSENT_PHRASE,
      dryRun: true,
    });
    assert.equal(result.removed, false);
    assert.equal(result.reason, "unsafe_remove_root");
  });

  it("refuses operator home before dry-run planning", async () => {
    const result = await removeSetup(homedir(), {
      consent: REMOVE_CONSENT_PHRASE,
      dryRun: true,
    });
    assert.equal(result.removed, false);
    assert.equal(result.reason, "unsafe_remove_root");
  });

  it("refuses repository root before dry-run planning", async () => {
    const result = await removeSetup(REPO_ROOT, {
      consent: REMOVE_CONSENT_PHRASE,
      dryRun: true,
    });
    assert.equal(result.removed, false);
    assert.equal(result.reason, "unsafe_remove_root");
  });

  it("refuses empty explicit root before default fallback", async () => {
    const result = await removeSetup("", {
      consent: REMOVE_CONSENT_PHRASE,
      dryRun: true,
    });
    assert.equal(result.removed, false);
    assert.equal(result.reason, "unsafe_remove_root");
  });

  it("refuses symlinked roots before dry-run planning", async () => {
    const realHome = await freshHome();
    await runSetup(realHome);
    const linkRoot = `${realHome}-link`;
    await symlink(realHome, linkRoot, "dir");

    const result = await removeSetup(linkRoot, {
      consent: REMOVE_CONSENT_PHRASE,
      dryRun: true,
    });
    assert.equal(result.removed, false);
    assert.equal(result.reason, "unsafe_remove_root");

    const check = await checkSetup(realHome);
    assert.equal(check.verdict, "INTACT");
  });

  it("refuses existing directories that are not Dema setup roots", async () => {
    const arbitraryRoot = await freshHome();

    const result = await removeSetup(arbitraryRoot, {
      consent: REMOVE_CONSENT_PHRASE,
      dryRun: true,
    });
    assert.equal(result.removed, false);
    assert.equal(result.reason, "unsafe_remove_root");
  });

  it("refuses fake Dema-shaped directories without valid setup schemas", async () => {
    const fakeRoot = await freshHome();
    await Promise.all(
      EXPECTED_DIRS.map((dir) => mkdir(join(fakeRoot, dir), { recursive: true })),
    );
    await writeFile(
      join(fakeRoot, "profile.json"),
      JSON.stringify({ schema: "not.dema.profile.v0.1" }),
    );
    await writeFile(
      join(fakeRoot, "config.local.json"),
      JSON.stringify({ schema: "not.dema.config.v0.1" }),
    );

    const result = await removeSetup(fakeRoot, {
      consent: REMOVE_CONSENT_PHRASE,
      dryRun: true,
    });
    assert.equal(result.removed, false);
    assert.equal(result.reason, "unsafe_remove_root");
  });

  it("refuses fake valid-schema roots without a Dema root marker", async () => {
    const fakeRoot = await freshHome();
    await Promise.all(
      EXPECTED_DIRS.map((dir) => mkdir(join(fakeRoot, dir), { recursive: true })),
    );
    await writeFile(
      join(fakeRoot, "profile.json"),
      JSON.stringify({ schema: "bizra.dema.profile.v0.1" }),
    );
    await writeFile(
      join(fakeRoot, "config.local.json"),
      JSON.stringify({ schema: "bizra.dema.local_config.v0.1" }),
    );

    const result = await removeSetup(fakeRoot, {
      consent: REMOVE_CONSENT_PHRASE,
      dryRun: true,
    });
    assert.equal(result.removed, false);
    assert.equal(result.reason, "unsafe_remove_root");
  });

  it("refuses Dema root markers bound to a different path", async () => {
    const fakeRoot = await freshHome();
    await Promise.all(
      EXPECTED_DIRS.map((dir) => mkdir(join(fakeRoot, dir), { recursive: true })),
    );
    await writeFile(
      join(fakeRoot, "profile.json"),
      JSON.stringify({ schema: "bizra.dema.profile.v0.1" }),
    );
    await writeFile(
      join(fakeRoot, "config.local.json"),
      JSON.stringify({ schema: "bizra.dema.local_config.v0.1" }),
    );
    await writeFile(
      join(fakeRoot, ".dema-root.json"),
      JSON.stringify({
        schema: "bizra.dema.root_marker.v0.1",
        root_id: "copied-marker",
        root: join(fakeRoot, "..", "other-dema-root"),
      }),
    );

    const result = await removeSetup(fakeRoot, {
      consent: REMOVE_CONSENT_PHRASE,
      dryRun: true,
    });
    assert.equal(result.removed, false);
    assert.equal(result.reason, "unsafe_remove_root");
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
