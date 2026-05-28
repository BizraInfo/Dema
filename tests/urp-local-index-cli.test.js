import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  mkdtempSync,
  writeFileSync,
  readdirSync,
  existsSync,
  rmSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
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

function runCli(argv, { demaHome, env = {} } = {}) {
  return new Promise((resolveOne) => {
    const child = spawn(process.execPath, [CLI_PATH, ...argv], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        DEMA_HOME: demaHome,
        DEMA_NO_TUI: "1",
        NODE_ENV: "test",
        NO_COLOR: "1",
        ...env,
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

const RAW_ARTIFACT_SENTINEL = "URP_CLI_RAW_ARTIFACT_SENTINEL_8f3a91ce";

async function buildPassportFixture() {
  const home = mkdtempSync(join(tmpdir(), "dema-urp-cli-"));
  const prev = process.env.DEMA_HOME;
  process.env.DEMA_HOME = home;
  try {
    await initAuthorshipKey({
      consent: KEY_INIT_CONSENT_PHRASE,
      demaHome: home,
    });
    const artifactPath = join(home, "urp-cli-artifact.txt");
    writeFileSync(artifactPath, RAW_ARTIFACT_SENTINEL + " " + Date.now());
    await signArtifact({
      artifactPath,
      consent: SIGN_CONSENT_PHRASE,
      demaHome: home,
    });
    const passport = await buildProofPassport(home);
    const passportPath = join(home, "passport.json");
    writeFileSync(passportPath, JSON.stringify(passport, null, 2));
    return { home, passportPath };
  } finally {
    if (prev) process.env.DEMA_HOME = prev;
    else delete process.env.DEMA_HOME;
  }
}

const FORBIDDEN = [
  "private_key",
  "private_key_pem",
  "raw_artifact",
  "artifact_content",
  "full_receipt_json",
  "personal_memory",
  "mint_candidate",
  "token_eligible",
  "reward",
  "bzc",
  "imp",
  "economic_value",
  "federation_target",
];

describe("dema urp index CLI", () => {
  it("exits 1 when --passport is missing", async () => {
    const home = mkdtempSync(join(tmpdir(), "dema-urp-cli-miss-"));
    try {
      const r = await runCli(["urp", "index"], { demaHome: home });
      assert.equal(r.exitCode, 1);
      assert.match(r.stderr, /--passport <passport\.json>/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("exits 1 when passport file is unreadable", async () => {
    const home = mkdtempSync(join(tmpdir(), "dema-urp-cli-unr-"));
    try {
      const r = await runCli(
        ["urp", "index", "--passport", join(home, "nope.json"), "--json"],
        { demaHome: home },
      );
      assert.equal(r.exitCode, 1);
      const out = JSON.parse(r.stdout);
      assert.equal(out.indexed, false);
      assert.equal(out.written, false);
      assert.equal(out.error, "cannot_read_passport");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("exits 1 when passport JSON is invalid", async () => {
    const home = mkdtempSync(join(tmpdir(), "dema-urp-cli-inv-"));
    try {
      const bad = join(home, "bad.json");
      writeFileSync(bad, "{this is not json");
      const r = await runCli(["urp", "index", "--passport", bad, "--json"], {
        demaHome: home,
      });
      assert.equal(r.exitCode, 1);
      const out = JSON.parse(r.stdout);
      assert.equal(out.indexed, false);
      assert.equal(out.written, false);
      assert.equal(out.error, "invalid_passport_json");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("valid passport creates a local index file under $DEMA_HOME/urp/indexes/", async () => {
    const { home, passportPath } = await buildPassportFixture();
    try {
      const r = await runCli(
        ["urp", "index", "--passport", passportPath, "--json"],
        { demaHome: home },
      );
      assert.equal(r.exitCode, 0);
      const indexDir = join(home, "urp", "indexes");
      assert.ok(existsSync(indexDir));
      const files = readdirSync(indexDir).filter((f) =>
        /^urp-index-[a-f0-9]{64}\.json$/.test(f),
      );
      assert.equal(files.length, 1);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("--json output includes schema, index_hash, index_path, truth_label, share_status", async () => {
    const { home, passportPath } = await buildPassportFixture();
    try {
      const r = await runCli(
        ["urp", "index", "--passport", passportPath, "--json"],
        { demaHome: home },
      );
      assert.equal(r.exitCode, 0);
      const out = JSON.parse(r.stdout);
      assert.equal(out.schema, "bizra.dema.urp_local_index_cli_result.v0.1");
      assert.equal(out.indexed, true);
      assert.equal(out.written, true);
      assert.equal(out.truth_label, "LOCAL_VERIFIED_RESOURCE_INDEX");
      assert.equal(out.mode, "LOCAL_INDEX_ONLY");
      assert.equal(out.share_status, "MARKED_LOCAL_ONLY");
      assert.match(out.write_result.index_hash, /^[a-f0-9]{64}$/);
      assert.match(
        out.write_result.index_path,
        /urp-index-[a-f0-9]{64}\.json$/,
      );
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("human output includes LOCAL_INDEX_ONLY and MARKED_LOCAL_ONLY", async () => {
    const { home, passportPath } = await buildPassportFixture();
    try {
      const r = await runCli(["urp", "index", "--passport", passportPath], {
        demaHome: home,
      });
      assert.equal(r.exitCode, 0);
      assert.match(r.stdout, /URP Local Index: WRITTEN/);
      assert.match(r.stdout, /LOCAL_INDEX_ONLY/);
      assert.match(r.stdout, /MARKED_LOCAL_ONLY/);
      assert.match(r.stdout, /LOCAL_VERIFIED_RESOURCE_INDEX/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("failed deep verification writes nothing and exits 1", async () => {
    const { home, passportPath } = await buildPassportFixture();
    try {
      const emptyReceipts = mkdtempSync(join(tmpdir(), "dema-urp-empty-"));
      const r = await runCli(
        [
          "urp",
          "index",
          "--passport",
          passportPath,
          "--receipts-dir",
          emptyReceipts,
          "--json",
        ],
        { demaHome: home },
      );
      assert.equal(r.exitCode, 1);
      const out = JSON.parse(r.stdout);
      assert.equal(out.indexed, false);
      assert.equal(out.written, false);
      assert.equal(out.error, "deep_verification_failed");
      const indexDir = join(home, "urp", "indexes");
      const wrote = existsSync(indexDir)
        ? readdirSync(indexDir).filter((f) => f.startsWith("urp-index-"))
        : [];
      assert.equal(
        wrote.length,
        0,
        "no index file should be written on failure",
      );
      rmSync(emptyReceipts, { recursive: true, force: true });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("no private key material in output", async () => {
    const { home, passportPath } = await buildPassportFixture();
    try {
      const r = await runCli(
        ["urp", "index", "--passport", passportPath, "--json"],
        { demaHome: home },
      );
      const combined = r.stdout + r.stderr;
      // PEM headers in any form
      assert.equal(combined.includes("BEGIN PRIVATE KEY"), false);
      assert.equal(combined.includes("BEGIN ED25519 PRIVATE KEY"), false);
      // Forbidden field names — match the writer's exact `"<field>":` gate
      // (the boundary attestation `"private_key_loaded": false` is NOT a leak)
      assert.equal(combined.includes('"private_key":'), false);
      assert.equal(combined.includes('"private_key_pem":'), false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("no raw artifact content in output", async () => {
    const { home, passportPath } = await buildPassportFixture();
    try {
      const r = await runCli(
        ["urp", "index", "--passport", passportPath, "--json"],
        { demaHome: home },
      );
      const combined = r.stdout + r.stderr;
      // Actual artifact content (sentinel ensures we catch a real leak,
      // not just the word "content" appearing in some field name)
      assert.equal(combined.includes(RAW_ARTIFACT_SENTINEL), false);
      // Forbidden field names — exact `"<field>":` gate
      // (boundary attestations `"raw_artifact_included": false` etc are NOT leaks)
      assert.equal(combined.includes('"raw_artifact":'), false);
      assert.equal(combined.includes('"artifact_content":'), false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("no token/mint/economic/federation fields in output", async () => {
    const { home, passportPath } = await buildPassportFixture();
    try {
      const r = await runCli(
        ["urp", "index", "--passport", passportPath, "--json"],
        { demaHome: home },
      );
      const combined = r.stdout + r.stderr;
      for (const field of FORBIDDEN) {
        assert.equal(
          combined.includes(`"${field}":`),
          false,
          `output must not include forbidden field "${field}"`,
        );
      }
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
