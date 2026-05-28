import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  rmSync,
  mkdirSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  listUrpLocalIndexes,
  URP_LOCAL_INDEX_LIST_SCHEMA,
} from "../packages/urp/src/local-index-list.js";
import { buildUrpLocalIndex } from "../packages/urp/src/local-index.js";
import { saveUrpLocalIndex } from "../packages/urp/src/local-index-writer.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import {
  signArtifact,
  SIGN_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-sign-command.js";
import { buildProofPassport } from "../packages/receipts/src/proof-passport.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const CLI_PATH = join(REPO_ROOT, "apps", "cli", "src", "index.js");

function freshHome() {
  return mkdtempSync(join(tmpdir(), "dema-urp-list-"));
}

async function indexOnePassport(home, sentinel) {
  const prev = process.env.DEMA_HOME;
  process.env.DEMA_HOME = home;
  try {
    if (!readdirSync(home).includes("keys")) {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
    }
    const artifact = join(home, `art-${sentinel}.txt`);
    writeFileSync(artifact, `content-${sentinel}`);
    await signArtifact({
      artifactPath: artifact,
      consent: SIGN_CONSENT_PHRASE,
      demaHome: home,
    });
    const passport = await buildProofPassport(home);
    const build = await buildUrpLocalIndex(passport, {
      receiptsDir: join(home, "receipts"),
    });
    return await saveUrpLocalIndex(build, { demaHome: home });
  } finally {
    if (prev) process.env.DEMA_HOME = prev;
    else delete process.env.DEMA_HOME;
  }
}

function runCli(argv, { demaHome } = {}) {
  return new Promise((resolveOne) => {
    const child = spawn(process.execPath, [CLI_PATH, ...argv], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        DEMA_HOME: demaHome,
        DEMA_NO_TUI: "1",
        NODE_ENV: "test",
        NO_COLOR: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (b) => (stdout += b.toString("utf8")));
    child.stderr.on("data", (b) => (stderr += b.toString("utf8")));
    child.on("close", (code) => resolveOne({ exitCode: code, stdout, stderr }));
  });
}

describe("listUrpLocalIndexes (pure module)", () => {
  it("returns empty envelope when indexes dir does not exist", async () => {
    const home = freshHome();
    try {
      const r = await listUrpLocalIndexes({ demaHome: home });
      assert.equal(r.schema, URP_LOCAL_INDEX_LIST_SCHEMA);
      assert.equal(r.count, 0);
      assert.deepEqual(r.entries, []);
      assert.equal(r.corruption_detected, false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("returns empty envelope when indexes dir exists but is empty", async () => {
    const home = freshHome();
    try {
      mkdirSync(join(home, "urp", "indexes"), { recursive: true });
      const r = await listUrpLocalIndexes({ demaHome: home });
      assert.equal(r.count, 0);
      assert.equal(r.corruption_detected, false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("lists one written index with all metadata", async () => {
    const home = freshHome();
    try {
      const w = await indexOnePassport(home, "single");
      assert.equal(w.written, true);
      const r = await listUrpLocalIndexes({ demaHome: home });
      assert.equal(r.count, 1);
      const e = r.entries[0];
      assert.equal(e.filename_hash_matches, true);
      assert.equal(e.body_hash_intact, true);
      assert.equal(e.truth_label, "LOCAL_VERIFIED_RESOURCE_INDEX");
      assert.equal(e.share_status, "MARKED_LOCAL_ONLY");
      assert.equal(e.mode, "LOCAL_INDEX_ONLY");
      assert.equal(typeof e.receipts_count, "number");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("lists two distinct indexes sorted by filename", async () => {
    const home = freshHome();
    try {
      await indexOnePassport(home, "one");
      await indexOnePassport(home, "two");
      const r = await listUrpLocalIndexes({ demaHome: home });
      assert.equal(r.count, 2);
      assert.ok(r.entries[0].filename.localeCompare(r.entries[1].filename) < 0);
      for (const e of r.entries) {
        assert.equal(e.filename_hash_matches, true);
        assert.equal(e.body_hash_intact, true);
      }
      assert.equal(r.corruption_detected, false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("skips files not matching urp-index-<sha256>.json pattern", async () => {
    const home = freshHome();
    try {
      await indexOnePassport(home, "real");
      const dir = join(home, "urp", "indexes");
      writeFileSync(join(dir, "stray.txt"), "ignore me");
      writeFileSync(
        join(dir, "urp-index-too-short.json"),
        JSON.stringify({ schema: "x" }),
      );
      const r = await listUrpLocalIndexes({ demaHome: home });
      assert.equal(r.count, 1);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("flags corruption when body bytes are tampered (hash mismatch)", async () => {
    const home = freshHome();
    try {
      await indexOnePassport(home, "tamper");
      const dir = join(home, "urp", "indexes");
      const file = join(dir, readdirSync(dir)[0]);
      const body = JSON.parse(readFileSync(file, "utf8"));
      body.truth_label = "TAMPERED";
      writeFileSync(file, JSON.stringify(body, null, 2));
      const r = await listUrpLocalIndexes({ demaHome: home });
      assert.equal(r.count, 1);
      assert.equal(r.corruption_detected, true);
      assert.equal(r.entries[0].body_hash_intact, false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("flags corruption when filename is renamed to wrong hash", async () => {
    const home = freshHome();
    try {
      await indexOnePassport(home, "rename");
      const dir = join(home, "urp", "indexes");
      const original = join(dir, readdirSync(dir)[0]);
      const fake = join(
        dir,
        "urp-index-0000000000000000000000000000000000000000000000000000000000000000.json",
      );
      writeFileSync(fake, readFileSync(original));
      rmSync(original);
      const r = await listUrpLocalIndexes({ demaHome: home });
      assert.equal(r.count, 1);
      assert.equal(r.corruption_detected, true);
      assert.equal(r.entries[0].filename_hash_matches, false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("envelope is frozen and contains read-only boundary", async () => {
    const home = freshHome();
    try {
      const r = await listUrpLocalIndexes({ demaHome: home });
      assert.equal(Object.isFrozen(r), true);
      assert.equal(Object.isFrozen(r.entries), true);
      assert.equal(r.boundary.file_write_performed, false);
      assert.equal(r.boundary.network_used, false);
      assert.equal(r.boundary.token_minted, false);
      assert.equal(r.boundary.federation_used, false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("dema urp list CLI", () => {
  it("--json on empty dir emits count=0 envelope, exit 0", async () => {
    const home = freshHome();
    try {
      const r = await runCli(["urp", "list", "--json"], { demaHome: home });
      assert.equal(r.exitCode, 0);
      const out = JSON.parse(r.stdout);
      assert.equal(out.schema, URP_LOCAL_INDEX_LIST_SCHEMA);
      assert.equal(out.count, 0);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("human output on empty dir shows (none) + LOCAL_INDEX_ONLY · MARKED_LOCAL_ONLY", async () => {
    const home = freshHome();
    try {
      const r = await runCli(["urp", "list"], { demaHome: home });
      assert.equal(r.exitCode, 0);
      assert.match(r.stdout, /URP Local Indexes: \(none\)/);
      assert.match(r.stdout, /LOCAL_INDEX_ONLY/);
      assert.match(r.stdout, /MARKED_LOCAL_ONLY/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("exits 1 when corruption is detected (tampered body)", async () => {
    const home = freshHome();
    try {
      await indexOnePassport(home, "cli-corrupt");
      const dir = join(home, "urp", "indexes");
      const file = join(dir, readdirSync(dir)[0]);
      const body = JSON.parse(readFileSync(file, "utf8"));
      body.share_status = "MARKED_PUBLIC";
      writeFileSync(file, JSON.stringify(body, null, 2));
      const r = await runCli(["urp", "list", "--json"], { demaHome: home });
      assert.equal(r.exitCode, 1);
      const out = JSON.parse(r.stdout);
      assert.equal(out.corruption_detected, true);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("no private key / no raw artifact / no forbidden fields in output", async () => {
    const home = freshHome();
    try {
      await indexOnePassport(home, "sentinel-leak");
      const r = await runCli(["urp", "list", "--json"], { demaHome: home });
      const combined = r.stdout + r.stderr;
      assert.equal(combined.includes("BEGIN PRIVATE KEY"), false);
      assert.equal(combined.includes('"private_key":'), false);
      assert.equal(combined.includes('"raw_artifact":'), false);
      assert.equal(combined.includes('"mint_candidate":'), false);
      assert.equal(combined.includes('"token_eligible":'), false);
      assert.equal(combined.includes('"federation_target":'), false);
      assert.equal(combined.includes("content-sentinel-leak"), false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
