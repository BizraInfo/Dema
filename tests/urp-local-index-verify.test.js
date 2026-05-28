import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  verifyUrpLocalIndexFile,
  URP_LOCAL_INDEX_VERIFICATION_SCHEMA,
} from "../packages/urp/src/local-index-verify.js";
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

const RAW_SENTINEL = "URP_VERIFY_SENTINEL_2c4f8a1e";

function freshHome() {
  return mkdtempSync(join(tmpdir(), "dema-urp-verify-"));
}

async function persistOneIndex(home, sentinel = "default") {
  const prev = process.env.DEMA_HOME;
  process.env.DEMA_HOME = home;
  try {
    await initAuthorshipKey({
      consent: KEY_INIT_CONSENT_PHRASE,
      demaHome: home,
    });
    const artifact = join(home, `art-${sentinel}.txt`);
    writeFileSync(artifact, `${RAW_SENTINEL}-${sentinel}`);
    await signArtifact({
      artifactPath: artifact,
      consent: SIGN_CONSENT_PHRASE,
      demaHome: home,
    });
    const passport = await buildProofPassport(home);
    const build = await buildUrpLocalIndex(passport, {
      receiptsDir: join(home, "receipts"),
    });
    const write = await saveUrpLocalIndex(build, { demaHome: home });
    return write.index_path;
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

describe("verifyUrpLocalIndexFile (pure module)", () => {
  it("returns VERIFIED on a freshly-persisted canonical index file", async () => {
    const home = freshHome();
    try {
      const idxPath = await persistOneIndex(home, "happy");
      const r = await verifyUrpLocalIndexFile(idxPath);
      assert.equal(r.schema, URP_LOCAL_INDEX_VERIFICATION_SCHEMA);
      assert.equal(r.verified, true);
      assert.equal(r.verdict, "VERIFIED");
      assert.equal(
        r.truth_label,
        "LOCAL_VERIFIED_RESOURCE_INDEX_FILE_VERIFIED",
      );
      assert.equal(r.filename_hash_matches, true);
      assert.equal(r.body_hash_intact, true);
      assert.equal(r.mode, "LOCAL_INDEX_ONLY");
      assert.equal(r.share_status, "MARKED_LOCAL_ONLY");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("returns FAILED with missing_path on empty/missing argument", async () => {
    const r1 = await verifyUrpLocalIndexFile("");
    const r2 = await verifyUrpLocalIndexFile(undefined);
    assert.equal(r1.verified, false);
    assert.equal(r1.error, "missing_path");
    assert.equal(r2.verified, false);
    assert.equal(r2.error, "missing_path");
  });

  it("returns FAILED with cannot_read_file on nonexistent path", async () => {
    const r = await verifyUrpLocalIndexFile(
      "/tmp/definitely-not-here-9e8f.json",
    );
    assert.equal(r.verified, false);
    assert.equal(r.error, "cannot_read_file");
  });

  it("returns FAILED with invalid_json on malformed file", async () => {
    const home = freshHome();
    try {
      const bad = join(home, "bad.json");
      writeFileSync(bad, "{not json");
      const r = await verifyUrpLocalIndexFile(bad);
      assert.equal(r.verified, false);
      assert.equal(r.error, "invalid_json");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("returns FAILED with wrong_schema when schema field is foreign", async () => {
    const home = freshHome();
    try {
      const idxPath = await persistOneIndex(home, "schema");
      const body = JSON.parse(readFileSync(idxPath, "utf8"));
      body.schema = "bizra.dema.something_else.v0.1";
      writeFileSync(idxPath, JSON.stringify(body, null, 2));
      const r = await verifyUrpLocalIndexFile(idxPath);
      assert.equal(r.verified, false);
      assert.equal(r.error, "wrong_schema");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("returns FAILED with body_hash_mismatch on tampered numeric field", async () => {
    const home = freshHome();
    try {
      const idxPath = await persistOneIndex(home, "tamper-num");
      const body = JSON.parse(readFileSync(idxPath, "utf8"));
      // Tamper a benign numeric field that doesn't trip schema/mode/share gates
      body.receipts_count = (body.receipts_count ?? 0) + 999;
      writeFileSync(idxPath, JSON.stringify(body, null, 2));
      const r = await verifyUrpLocalIndexFile(idxPath);
      assert.equal(r.verified, false);
      assert.equal(r.error, "body_hash_mismatch");
      assert.ok(r.declared && r.recomputed);
      assert.notEqual(r.declared, r.recomputed);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("returns FAILED with filename_hash_mismatch when file is renamed", async () => {
    const home = freshHome();
    try {
      const idxPath = await persistOneIndex(home, "rename");
      const dir = dirname(idxPath);
      const fakePath = join(
        dir,
        "urp-index-0000000000000000000000000000000000000000000000000000000000000000.json",
      );
      writeFileSync(fakePath, readFileSync(idxPath));
      const r = await verifyUrpLocalIndexFile(fakePath);
      assert.equal(r.verified, false);
      assert.equal(r.error, "filename_hash_mismatch");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("returns VERIFIED with filename_hash_matches=null on non-canonical filename", async () => {
    const home = freshHome();
    try {
      const idxPath = await persistOneIndex(home, "nocanon");
      const copy = join(home, "renamed-out-of-pattern.json");
      writeFileSync(copy, readFileSync(idxPath));
      const r = await verifyUrpLocalIndexFile(copy);
      assert.equal(r.verified, true);
      assert.equal(r.filename_hash_matches, null);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("returns FAILED with forbidden_field_present when private_key is injected", async () => {
    const home = freshHome();
    try {
      const idxPath = await persistOneIndex(home, "forbidden");
      const raw = readFileSync(idxPath, "utf8");
      // Inject a forbidden field at the top level
      const body = JSON.parse(raw);
      body.private_key = "PEM-pretend";
      writeFileSync(idxPath, JSON.stringify(body, null, 2));
      const r = await verifyUrpLocalIndexFile(idxPath);
      assert.equal(r.verified, false);
      assert.equal(r.error, "forbidden_field_present");
      assert.equal(r.field, "private_key");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("envelope is frozen on both VERIFIED and FAILED paths", async () => {
    const home = freshHome();
    try {
      const idxPath = await persistOneIndex(home, "freeze");
      const ok = await verifyUrpLocalIndexFile(idxPath);
      const bad = await verifyUrpLocalIndexFile("/nonexistent.json");
      assert.equal(Object.isFrozen(ok), true);
      assert.equal(Object.isFrozen(bad), true);
      assert.equal(ok.boundary.file_write_performed, false);
      assert.equal(ok.boundary.network_used, false);
      assert.equal(ok.boundary.token_minted, false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("dema urp verify CLI", () => {
  it("exits 1 with usage on missing path", async () => {
    const home = freshHome();
    try {
      const r = await runCli(["urp", "verify"], { demaHome: home });
      assert.equal(r.exitCode, 1);
      assert.match(r.stderr, /Usage: dema urp verify <index\.json>/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("exits 0 with VERIFIED envelope on canonical file (--json)", async () => {
    const home = freshHome();
    try {
      const idxPath = await persistOneIndex(home, "cli-happy");
      const r = await runCli(["urp", "verify", idxPath, "--json"], {
        demaHome: home,
      });
      assert.equal(r.exitCode, 0);
      const out = JSON.parse(r.stdout);
      assert.equal(out.verified, true);
      assert.equal(out.verdict, "VERIFIED");
      assert.equal(
        out.truth_label,
        "LOCAL_VERIFIED_RESOURCE_INDEX_FILE_VERIFIED",
      );
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("human output on VERIFIED includes LOCAL_INDEX_ONLY + MARKED_LOCAL_ONLY + VERIFIED", async () => {
    const home = freshHome();
    try {
      const idxPath = await persistOneIndex(home, "cli-human");
      const r = await runCli(["urp", "verify", idxPath], { demaHome: home });
      assert.equal(r.exitCode, 0);
      assert.match(r.stdout, /URP Local Index Verify: VERIFIED/);
      assert.match(r.stdout, /LOCAL_INDEX_ONLY/);
      assert.match(r.stdout, /MARKED_LOCAL_ONLY/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("exits 1 with FAILED envelope on tampered file", async () => {
    const home = freshHome();
    try {
      const idxPath = await persistOneIndex(home, "cli-tamper");
      const body = JSON.parse(readFileSync(idxPath, "utf8"));
      body.receipts_count = (body.receipts_count ?? 0) + 1;
      writeFileSync(idxPath, JSON.stringify(body, null, 2));
      const r = await runCli(["urp", "verify", idxPath, "--json"], {
        demaHome: home,
      });
      assert.equal(r.exitCode, 1);
      const out = JSON.parse(r.stdout);
      assert.equal(out.verified, false);
      assert.equal(out.verdict, "FAILED");
      assert.match(r.stdout, /body_hash_mismatch|wrong_/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("no private key / no raw artifact content / no forbidden fields in output", async () => {
    const home = freshHome();
    try {
      const idxPath = await persistOneIndex(home, "cli-leak");
      const r = await runCli(["urp", "verify", idxPath, "--json"], {
        demaHome: home,
      });
      const combined = r.stdout + r.stderr;
      assert.equal(combined.includes("BEGIN PRIVATE KEY"), false);
      assert.equal(combined.includes('"private_key":'), false);
      assert.equal(combined.includes('"private_key_pem":'), false);
      assert.equal(combined.includes('"raw_artifact":'), false);
      assert.equal(combined.includes('"artifact_content":'), false);
      assert.equal(combined.includes('"mint_candidate":'), false);
      assert.equal(combined.includes('"token_eligible":'), false);
      assert.equal(combined.includes('"federation_target":'), false);
      assert.equal(combined.includes(RAW_SENTINEL), false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
