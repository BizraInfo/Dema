import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  gatherDemaRealmWallet,
  renderDemaRealmWallet,
  DEMA_REALM_WALLET_SCHEMA,
} from "../packages/core/src/dema-realm-wallet.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const CLI_PATH = join(REPO_ROOT, "apps", "cli", "src", "index.js");
const FIXED_NOW = new Date("2026-06-18T12:00:00Z");

const FORBIDDEN_FIELDS = [
  "private_key",
  "raw_artifact",
  "mint_candidate",
  "token_eligible",
  "federation_target",
  "bzc",
  "imp",
];

function freshHome() {
  return mkdtempSync(join(tmpdir(), "dema-realm-wallet-test-"));
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

describe("gatherDemaRealmWallet — built-in ledger", () => {
  it("returns LOCAL_INTENT_LEDGER_DECLARED with genesis intents", async () => {
    const home = freshHome();
    try {
      const s = await gatherDemaRealmWallet({ demaHome: home, now: FIXED_NOW });
      assert.equal(s.schema, DEMA_REALM_WALLET_SCHEMA);
      assert.equal(s.truth_label, "LOCAL_INTENT_LEDGER_DECLARED");
      assert.equal(s.source, "BUILT_IN_GENESIS_LEDGER");
      assert.ok(s.intents.length >= 4);
      assert.equal(s.boundary.token_minted, false);
      assert.equal(s.boundary.economic_claim_made, false);
      assert.match(s.disclaimer, /no Shariah certification/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("operator wallet-intents.json overrides built-in when valid", async () => {
    const home = freshHome();
    try {
      mkdirSync(join(home, "realm"), { recursive: true });
      writeFileSync(
        join(home, "realm", "wallet-intents.json"),
        JSON.stringify({
          intents: [
            {
              id: "custom",
              label: "Custom local intent",
              status: "DECLARED",
              truth_label: "LOCAL_ONLY",
            },
          ],
        }),
      );
      const s = await gatherDemaRealmWallet({ demaHome: home, now: FIXED_NOW });
      assert.equal(s.source, "OPERATOR_LOCAL_FILE");
      assert.equal(s.truth_label, "LOCAL_OPERATOR_INTENT_LEDGER");
      assert.equal(s.intents.length, 1);
      assert.equal(s.intents[0].label, "Custom local intent");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("malformed operator file falls back to built-in", async () => {
    const home = freshHome();
    try {
      mkdirSync(join(home, "realm"), { recursive: true });
      writeFileSync(join(home, "realm", "wallet-intents.json"), "{bad");
      const s = await gatherDemaRealmWallet({ demaHome: home, now: FIXED_NOW });
      assert.equal(s.source, "BUILT_IN_GENESIS_LEDGER");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("renderDemaRealmWallet (no color)", () => {
  it("renders header, principles, intents, disclaimer", async () => {
    const home = freshHome();
    try {
      const s = await gatherDemaRealmWallet({ demaHome: home, now: FIXED_NOW });
      const out = renderDemaRealmWallet(s, { useColor: false });
      assert.match(out, /DEMA REALM · RESOURCE WALLET/);
      assert.match(out, /Riba-zero/);
      assert.match(out, /Token \/ mint surfaces/);
      assert.match(out, /BLOCKED/);
      assert.match(out, /no Shariah certification/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("dema realm wallet CLI", () => {
  it("--json emits schema envelope, exit 0", async () => {
    const home = freshHome();
    try {
      const r = await runCli(["realm", "wallet", "--json"], { demaHome: home });
      assert.equal(r.exitCode, 0);
      const out = JSON.parse(r.stdout);
      assert.equal(out.schema, DEMA_REALM_WALLET_SCHEMA);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("no forbidden economic leak fields in JSON", async () => {
    const home = freshHome();
    try {
      const r = await runCli(["realm", "wallet", "--json"], { demaHome: home });
      const json = r.stdout;
      for (const field of FORBIDDEN_FIELDS) {
        assert.equal(json.includes(`"${field}":`), false);
      }
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("dema realm go menu dispatch", () => {
  it("go 4 opens wallet surface", async () => {
    const home = freshHome();
    try {
      const r = await runCli(["realm", "go", "4", "--no-color"], {
        demaHome: home,
      });
      assert.equal(r.exitCode, 0);
      assert.match(r.stdout, /DEMA REALM · RESOURCE WALLET/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("go 99 exits non-zero with helpful error", async () => {
    const home = freshHome();
    try {
      const r = await runCli(["realm", "go", "99"], { demaHome: home });
      assert.notEqual(r.exitCode, 0);
      assert.match(r.stderr, /Unknown menu key/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
