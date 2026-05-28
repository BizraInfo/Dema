import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
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
import { buildUrpLocalIndex } from "../packages/urp/src/local-index.js";
import { saveUrpLocalIndex } from "../packages/urp/src/local-index-writer.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const CLI_PATH = join(REPO_ROOT, "apps", "cli", "src", "index.js");

const FORBIDDEN_FIELDS = [
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

function freshHome() {
  return mkdtempSync(join(tmpdir(), "dema-ucc-test-"));
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

async function buildIndexFixture(home) {
  const prev = process.env.DEMA_HOME;
  process.env.DEMA_HOME = home;
  try {
    await initAuthorshipKey({
      consent: KEY_INIT_CONSENT_PHRASE,
      demaHome: home,
    });
    const art = join(home, "art-for-choose.txt");
    writeFileSync(art, "alpha-choose-fixture-" + Date.now());
    await signArtifact({
      artifactPath: art,
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

describe("dema urp choose CLI — happy paths", () => {
  it("MARK_SHAREABLE with correct consent persists choose receipt at mode 0o600, exit 0", async () => {
    const home = freshHome();
    try {
      const idxPath = await buildIndexFixture(home);
      const r = await runCli(
        [
          "urp",
          "choose",
          idxPath,
          "--decision",
          "MARK_SHAREABLE",
          "--consent",
          "MARK URP ENTRY SHAREABLE",
          "--json",
        ],
        { demaHome: home },
      );
      assert.equal(r.exitCode, 0);
      const out = JSON.parse(r.stdout);
      assert.equal(out.schema, "bizra.dema.urp_choose_cli_result.v0.1");
      assert.equal(out.chosen, true);
      assert.equal(out.written, true);
      assert.equal(out.decision, "MARK_SHAREABLE");
      assert.equal(out.previous_share_status, "MARKED_LOCAL_ONLY");
      assert.equal(out.next_share_status, "CANDIDATE_SHAREABLE");
      assert.equal(out.mode_octal, "0o600");
      assert.match(
        out.receipt_path,
        /\/urp\/choices\/choose-[a-f0-9]{64}\.json$/,
      );
      assert.ok(existsSync(out.receipt_path));
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("MARK_LOCAL_ONLY with correct consent persists receipt, exit 0", async () => {
    const home = freshHome();
    try {
      const idxPath = await buildIndexFixture(home);
      const r = await runCli(
        [
          "urp",
          "choose",
          idxPath,
          "--decision",
          "MARK_LOCAL_ONLY",
          "--consent",
          "MARK URP ENTRY LOCAL-ONLY",
          "--json",
        ],
        { demaHome: home },
      );
      assert.equal(r.exitCode, 0);
      const out = JSON.parse(r.stdout);
      assert.equal(out.chosen, true);
      assert.equal(out.written, true);
      assert.equal(out.decision, "MARK_LOCAL_ONLY");
      assert.equal(out.next_share_status, "MARKED_LOCAL_ONLY");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("human output includes LOCAL ONLY warning + no-external-share language", async () => {
    const home = freshHome();
    try {
      const idxPath = await buildIndexFixture(home);
      const r = await runCli(
        [
          "urp",
          "choose",
          idxPath,
          "--decision",
          "MARK_SHAREABLE",
          "--consent",
          "MARK URP ENTRY SHAREABLE",
        ],
        { demaHome: home },
      );
      assert.equal(r.exitCode, 0);
      assert.match(r.stdout, /Choose receipt persisted/);
      assert.match(r.stdout, /No external share performed/);
      assert.match(r.stdout, /LOCAL ONLY/);
      assert.match(r.stdout, /no network/);
      assert.match(r.stdout, /no federation/);
      assert.match(r.stdout, /no mint/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("second choose with same args is idempotent (already_existed:true)", async () => {
    const home = freshHome();
    try {
      const idxPath = await buildIndexFixture(home);
      const args = [
        "urp",
        "choose",
        idxPath,
        "--decision",
        "MARK_SHAREABLE",
        "--consent",
        "MARK URP ENTRY SHAREABLE",
        "--json",
      ];
      const r1 = await runCli(args, { demaHome: home });
      const r2 = await runCli(args, { demaHome: home });
      assert.equal(r1.exitCode, 0);
      assert.equal(r2.exitCode, 0);
      const o1 = JSON.parse(r1.stdout);
      const o2 = JSON.parse(r2.stdout);
      assert.equal(o1.already_existed, false);
      assert.equal(o2.already_existed, true);
      assert.equal(o1.receipt_path, o2.receipt_path);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("dema urp choose CLI — validation failures", () => {
  it("missing index path exits 1 with usage on stderr", async () => {
    const home = freshHome();
    try {
      const r = await runCli(["urp", "choose"], { demaHome: home });
      assert.equal(r.exitCode, 1);
      assert.match(r.stderr, /Usage: dema urp choose <index\.json>/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("missing --decision exits 1", async () => {
    const home = freshHome();
    try {
      const idxPath = await buildIndexFixture(home);
      const r = await runCli(["urp", "choose", idxPath], { demaHome: home });
      assert.equal(r.exitCode, 1);
      assert.match(r.stderr, /--decision is required/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("invalid --decision value exits 1", async () => {
    const home = freshHome();
    try {
      const idxPath = await buildIndexFixture(home);
      const r = await runCli(
        [
          "urp",
          "choose",
          idxPath,
          "--decision",
          "MARK_ANYTHING_ELSE",
          "--consent",
          "MARK URP ENTRY SHAREABLE",
        ],
        { demaHome: home },
      );
      assert.equal(r.exitCode, 1);
      assert.match(r.stderr, /invalid --decision/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("missing --consent exits 1 with consent_required_or_mismatch", async () => {
    const home = freshHome();
    try {
      const idxPath = await buildIndexFixture(home);
      const r = await runCli(
        ["urp", "choose", idxPath, "--decision", "MARK_SHAREABLE", "--json"],
        { demaHome: home },
      );
      assert.equal(r.exitCode, 1);
      const out = JSON.parse(r.stdout);
      assert.equal(out.chosen, false);
      assert.equal(out.error, "consent_required_or_mismatch");
      assert.equal(out.expected_consent, "MARK URP ENTRY SHAREABLE");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("wrong --consent phrase exits 1 with consent_required_or_mismatch", async () => {
    const home = freshHome();
    try {
      const idxPath = await buildIndexFixture(home);
      const r = await runCli(
        [
          "urp",
          "choose",
          idxPath,
          "--decision",
          "MARK_SHAREABLE",
          "--consent",
          "wrong phrase",
          "--json",
        ],
        { demaHome: home },
      );
      assert.equal(r.exitCode, 1);
      const out = JSON.parse(r.stdout);
      assert.equal(out.chosen, false);
      assert.equal(out.error, "consent_required_or_mismatch");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("nonexistent index path exits 1 with cannot_read_index", async () => {
    const home = freshHome();
    try {
      const r = await runCli(
        [
          "urp",
          "choose",
          join(home, "nope.json"),
          "--decision",
          "MARK_SHAREABLE",
          "--consent",
          "MARK URP ENTRY SHAREABLE",
          "--json",
        ],
        { demaHome: home },
      );
      assert.equal(r.exitCode, 1);
      const out = JSON.parse(r.stdout);
      assert.equal(out.chosen, false);
      assert.equal(out.error, "cannot_read_index");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("invalid JSON in index file exits 1 with invalid_index_json", async () => {
    const home = freshHome();
    try {
      const bad = join(home, "bad.json");
      writeFileSync(bad, "{not json");
      const r = await runCli(
        [
          "urp",
          "choose",
          bad,
          "--decision",
          "MARK_SHAREABLE",
          "--consent",
          "MARK URP ENTRY SHAREABLE",
          "--json",
        ],
        { demaHome: home },
      );
      assert.equal(r.exitCode, 1);
      const out = JSON.parse(r.stdout);
      assert.equal(out.error, "invalid_index_json");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("foreign-schema index file: kernel rejects with wrong_schema, no receipt written", async () => {
    const home = freshHome();
    try {
      const foreign = join(home, "foreign.json");
      writeFileSync(
        foreign,
        JSON.stringify({ schema: "bizra.dema.something_else.v0.1" }),
      );
      const r = await runCli(
        [
          "urp",
          "choose",
          foreign,
          "--decision",
          "MARK_SHAREABLE",
          "--consent",
          "MARK URP ENTRY SHAREABLE",
          "--json",
        ],
        { demaHome: home },
      );
      assert.equal(r.exitCode, 1);
      const out = JSON.parse(r.stdout);
      assert.equal(out.chosen, false);
      assert.equal(out.error, "wrong_schema");
      const choicesDir = join(home, "urp", "choices");
      const wrote = existsSync(choicesDir)
        ? readdirSync(choicesDir).filter((f) => f.startsWith("choose-"))
        : [];
      assert.equal(
        wrote.length,
        0,
        "no choose receipt should be written on kernel rejection",
      );
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("dema urp choose CLI — no leaks", () => {
  it("no private key / no raw artifact / no forbidden JSON keys in output (happy path)", async () => {
    const home = freshHome();
    try {
      const idxPath = await buildIndexFixture(home);
      const r = await runCli(
        [
          "urp",
          "choose",
          idxPath,
          "--decision",
          "MARK_SHAREABLE",
          "--consent",
          "MARK URP ENTRY SHAREABLE",
          "--json",
        ],
        { demaHome: home },
      );
      const combined = r.stdout + r.stderr;
      assert.equal(combined.includes("BEGIN PRIVATE KEY"), false);
      for (const field of FORBIDDEN_FIELDS) {
        assert.equal(
          combined.includes(`"${field}":`),
          false,
          `output must not include "${field}" as a JSON key`,
        );
      }
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("persisted choose receipt file has no forbidden JSON keys", async () => {
    const home = freshHome();
    try {
      const idxPath = await buildIndexFixture(home);
      const r = await runCli(
        [
          "urp",
          "choose",
          idxPath,
          "--decision",
          "MARK_SHAREABLE",
          "--consent",
          "MARK URP ENTRY SHAREABLE",
          "--json",
        ],
        { demaHome: home },
      );
      const out = JSON.parse(r.stdout);
      const persistedJson = readFileSync(out.receipt_path, "utf8");
      for (const field of FORBIDDEN_FIELDS) {
        assert.equal(
          persistedJson.includes(`"${field}":`),
          false,
          `persisted receipt must not include "${field}" as a JSON key`,
        );
      }
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
