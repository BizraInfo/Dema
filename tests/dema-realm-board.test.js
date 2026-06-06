import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  gatherDemaRealmBoard,
  renderDemaRealmBoard,
  STAGES,
  DEMA_REALM_QUEST_BOARD_SCHEMA,
} from "../packages/core/src/dema-realm-board.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const CLI_PATH = join(REPO_ROOT, "apps", "cli", "src", "index.js");
const FIXED_NOW = new Date("2026-05-28T15:00:00Z");

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
  return mkdtempSync(join(tmpdir(), "dema-realm-board-test-"));
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

describe("gatherDemaRealmBoard — built-in default (no override file)", () => {
  it("returns BUILT_IN_SESSION_LEDGER source + LOCAL_REALM_QUEST_BOARD truth label", async () => {
    const home = freshHome();
    try {
      const b = await gatherDemaRealmBoard({ demaHome: home, now: FIXED_NOW });
      assert.equal(b.schema, DEMA_REALM_QUEST_BOARD_SCHEMA);
      assert.equal(b.source, "BUILT_IN_SESSION_LEDGER");
      assert.equal(b.truth_label, "LOCAL_REALM_QUEST_BOARD");
      assert.deepEqual(
        [...b.stages],
        ["SEED", "PREFLIGHT", "FORGE", "VERIFY", "CLOSEOUT", "ARCHIVE"],
      );
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("built-in default reflects the actual session ledger (9 in ARCHIVE, UX-1B ACTIVE in FORGE)", async () => {
    const home = freshHome();
    try {
      const b = await gatherDemaRealmBoard({ demaHome: home, now: FIXED_NOW });
      assert.ok(
        b.stage_counts.ARCHIVE >= 9,
        "ARCHIVE should hold at least 9 closed slices",
      );
      const archiveIds = b.buckets.ARCHIVE.map((q) => q.id);
      for (const expected of [
        "URP-3.1A",
        "URP-3.1B",
        "URP-3.1C",
        "URP-3.1C+",
        "URP-3.1C-ter",
        "URP-3.1D",
        "URP-4.0",
        "URP-4.1A",
        "UX-1A",
      ]) {
        assert.ok(archiveIds.includes(expected), `ARCHIVE missing ${expected}`);
      }
      const forgeIds = b.buckets.FORGE.map((q) => q.id);
      assert.ok(
        forgeIds.includes("UX-1B"),
        "UX-1B (this slice) should be in FORGE",
      );
      const ux1b = b.buckets.FORGE.find((q) => q.id === "UX-1B");
      assert.equal(ux1b.status, "ACTIVE");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("gatherDemaRealmBoard — operator override file", () => {
  it("reads $DEMA_HOME/realm/quest-board.json when present, flips source + truth label", async () => {
    const home = freshHome();
    try {
      mkdirSync(join(home, "realm"), { recursive: true });
      writeFileSync(
        join(home, "realm", "quest-board.json"),
        JSON.stringify({
          quests: [
            {
              id: "OP-001",
              title: "Pick a coffee bean",
              stage: "SEED",
              status: "READY",
              assigned_agent: "Operator",
              blockers: [],
            },
            {
              id: "OP-002",
              title: "Brew it",
              stage: "FORGE",
              status: "ACTIVE",
              assigned_agent: "Operator",
              blockers: [],
            },
          ],
        }),
      );
      const b = await gatherDemaRealmBoard({ demaHome: home, now: FIXED_NOW });
      assert.equal(b.source, "OPERATOR_LOCAL_FILE");
      assert.equal(b.truth_label, "LOCAL_OPERATOR_QUEST_BOARD");
      assert.equal(b.quests.length, 2);
      assert.equal(b.buckets.SEED[0].id, "OP-001");
      assert.equal(b.buckets.FORGE[0].id, "OP-002");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("malformed override file falls back to built-in default safely", async () => {
    const home = freshHome();
    try {
      mkdirSync(join(home, "realm"), { recursive: true });
      writeFileSync(
        join(home, "realm", "quest-board.json"),
        "{ this is not valid json",
      );
      const b = await gatherDemaRealmBoard({ demaHome: home, now: FIXED_NOW });
      assert.equal(b.source, "BUILT_IN_SESSION_LEDGER");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("override with quest having invalid stage falls back to built-in default", async () => {
    const home = freshHome();
    try {
      mkdirSync(join(home, "realm"), { recursive: true });
      writeFileSync(
        join(home, "realm", "quest-board.json"),
        JSON.stringify({
          quests: [
            {
              id: "BAD",
              title: "wrong stage",
              stage: "MOON_LANDING",
              status: "ACTIVE",
            },
          ],
        }),
      );
      const b = await gatherDemaRealmBoard({ demaHome: home, now: FIXED_NOW });
      assert.equal(b.source, "BUILT_IN_SESSION_LEDGER");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("gatherDemaRealmBoard — boundary + freeze + no leaks", () => {
  it("envelope frozen with 10-flag false boundary block", async () => {
    const home = freshHome();
    try {
      const b = await gatherDemaRealmBoard({ demaHome: home, now: FIXED_NOW });
      assert.equal(Object.isFrozen(b), true);
      assert.equal(Object.isFrozen(b.quests), true);
      assert.equal(Object.isFrozen(b.buckets), true);
      assert.equal(b.boundary.file_write_performed, false);
      assert.equal(b.boundary.network_used, false);
      assert.equal(b.boundary.federation_used, false);
      assert.equal(b.boundary.share_decision_made, false);
      assert.equal(b.boundary.poi_score_calculated, false);
      assert.equal(b.boundary.token_minted, false);
      assert.equal(b.boundary.economic_claim_made, false);
      assert.equal(b.boundary.private_key_loaded, false);
      assert.equal(b.boundary.raw_artifact_included, false);
      assert.equal(b.boundary.mutation_performed, false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("no forbidden JSON keys in serialized built-in default", async () => {
    const home = freshHome();
    try {
      const b = await gatherDemaRealmBoard({ demaHome: home, now: FIXED_NOW });
      const json = JSON.stringify(b);
      for (const field of FORBIDDEN_FIELDS) {
        assert.equal(
          json.includes(`"${field}":`),
          false,
          `envelope must not include "${field}" as a JSON key`,
        );
      }
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("renderDemaRealmBoard (no color)", () => {
  it("includes all 6 stage headers with counts in parentheses", async () => {
    const home = freshHome();
    try {
      const b = await gatherDemaRealmBoard({ demaHome: home, now: FIXED_NOW });
      const out = renderDemaRealmBoard(b, { useColor: false });
      for (const s of STAGES) {
        assert.match(
          out,
          new RegExp(`${s}\\s+\\(\\d+\\)`),
          `missing stage header for ${s}`,
        );
      }
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("renders DEMA REALM · MISSION BOARD header + truth label footer", async () => {
    const home = freshHome();
    try {
      const b = await gatherDemaRealmBoard({ demaHome: home, now: FIXED_NOW });
      const out = renderDemaRealmBoard(b, { useColor: false });
      assert.match(out, /DEMA REALM · MISSION BOARD/);
      assert.match(out, /truth: LOCAL_REALM_QUEST_BOARD/);
      // Ultra-micro Realm Party roster coverage (vision + giants: WoW/AgentCraft units + Hermes presence + current assigned_agent)
      assert.match(out, /ACTIVE PARTY \/ MAJLIS/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("empty stage renders em-dash placeholder, not crash", async () => {
    const home = freshHome();
    try {
      const b = await gatherDemaRealmBoard({ demaHome: home, now: FIXED_NOW });
      const out = renderDemaRealmBoard(b, { useColor: false });
      assert.match(out, /PREFLIGHT\s+\(0\)\s*\n\s*—/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("dema realm board CLI", () => {
  it("--json on empty home emits BUILT_IN_SESSION_LEDGER envelope, exit 0", async () => {
    const home = freshHome();
    try {
      const r = await runCli(["realm", "board", "--json"], { demaHome: home });
      assert.equal(r.exitCode, 0);
      const out = JSON.parse(r.stdout);
      assert.equal(out.schema, DEMA_REALM_QUEST_BOARD_SCHEMA);
      assert.equal(out.source, "BUILT_IN_SESSION_LEDGER");
      assert.ok(out.quests.length > 0);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("--no-color human render includes board header + lifecycle columns + UX-1B ACTIVE", async () => {
    const home = freshHome();
    try {
      const r = await runCli(["realm", "board", "--no-color"], {
        demaHome: home,
      });
      assert.equal(r.exitCode, 0);
      assert.match(r.stdout, /DEMA REALM · MISSION BOARD/);
      assert.match(r.stdout, /FORGE\s+\(\d+\)/);
      assert.match(r.stdout, /UX-1B\s+ACTIVE/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("no forbidden JSON keys / no private key markers in CLI output", async () => {
    const home = freshHome();
    try {
      const r = await runCli(["realm", "board", "--json"], { demaHome: home });
      const combined = r.stdout + r.stderr;
      assert.equal(combined.includes("BEGIN PRIVATE KEY"), false);
      for (const field of FORBIDDEN_FIELDS) {
        assert.equal(combined.includes(`"${field}":`), false);
      }
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
