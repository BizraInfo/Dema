import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  gatherDemaRealmState,
  renderBootSequence,
  renderHomeFrame,
  renderMenu,
  renderDemaRealmHome,
  DEMA_REALM_HOME_SCHEMA,
  REALM_MENU_ITEMS,
  realmMenuItemByKey,
} from "../packages/core/src/dema-realm-home.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const CLI_PATH = join(REPO_ROOT, "apps", "cli", "src", "index.js");
const FIXED_NOW = new Date("2026-05-28T15:00:00Z");

function freshHome() {
  return mkdtempSync(join(tmpdir(), "dema-realm-test-"));
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

describe("gatherDemaRealmState — empty DEMA_HOME (seed state)", () => {
  it("returns honest UNINITIALIZED/ABSENT/NONE statuses, sovereign seed not awake", async () => {
    const home = freshHome();
    try {
      const s = await gatherDemaRealmState({ demaHome: home, now: FIXED_NOW });
      assert.equal(s.schema, DEMA_REALM_HOME_SCHEMA);
      assert.equal(s.operator, "Operator");
      assert.equal(s.role, "Sovereign Builder");
      assert.equal(s.identity.status, "UNINITIALIZED");
      assert.equal(s.identity.label, "not yet initialized");
      assert.equal(s.last_checkpoint.present, false);
      assert.equal(s.last_checkpoint.text, "—");
      assert.equal(s.seed_awake, false);
      assert.equal(
        s.awakened_line,
        "The sovereign seed awaits initialization.",
      );
      assert.equal(s.boot_steps.length, 7);
      assert.equal(s.boot_steps[0].status, "UNINITIALIZED");
      assert.equal(s.boot_steps[1].status, "ABSENT");
      assert.equal(s.boot_steps[2].status, "NONE");
      assert.equal(s.boot_steps[3].status, "DECLARED");
      assert.equal(s.boot_steps[4].status, "EMPTY");
      assert.equal(s.boot_steps[5].status, "OFF");
      assert.equal(s.boot_steps[6].status, "LIVE");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("gatherDemaRealmState — H18 key initialized", () => {
  it("identity is VERIFIED + Ed25519 verified + seed awake = true", async () => {
    const home = freshHome();
    const prev = process.env.DEMA_HOME;
    process.env.DEMA_HOME = home;
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const s = await gatherDemaRealmState({ demaHome: home, now: FIXED_NOW });
      assert.equal(s.identity.status, "VERIFIED");
      assert.equal(s.identity.label, "Ed25519 verified");
      assert.equal(s.seed_awake, true);
      assert.equal(s.awakened_line, "The sovereign seed is awake.");
      assert.equal(s.boot_steps[0].status, "VERIFIED");
      assert.equal(s.boot_steps[1].status, "PRESENT");
    } finally {
      if (prev) process.env.DEMA_HOME = prev;
      else delete process.env.DEMA_HOME;
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("gatherDemaRealmState — checkpoint present", () => {
  it("last_checkpoint.text reads label, board status becomes READY", async () => {
    const home = freshHome();
    try {
      mkdirSync(join(home, "realm"), { recursive: true });
      writeFileSync(
        join(home, "realm", "last-checkpoint.json"),
        JSON.stringify({
          label: "URP-4.1A Pure Choose Decision Kernel",
          next_quest: "URP-4.1B",
        }),
      );
      const s = await gatherDemaRealmState({ demaHome: home, now: FIXED_NOW });
      assert.equal(s.last_checkpoint.present, true);
      assert.equal(
        s.last_checkpoint.text,
        "URP-4.1A Pure Choose Decision Kernel",
      );
      assert.equal(s.boot_steps[2].status, "FOUND");
      // Rebind (2026-08-14): the quest board step reads DEMA_HOME/missions,
      // not checkpoint presence. A checkpoint with zero missions is EMPTY —
      // the old READY here was a proxy that overclaimed.
      assert.equal(s.boot_steps[4].status, "EMPTY");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("operator name + role read from ~/.dema/memory/profile.json when present", async () => {
    const home = freshHome();
    try {
      mkdirSync(join(home, "memory"), { recursive: true });
      writeFileSync(
        join(home, "memory", "profile.json"),
        JSON.stringify({ preferred_name: "MuMu", role: "First Architect" }),
      );
      const s = await gatherDemaRealmState({ demaHome: home, now: FIXED_NOW });
      assert.equal(s.operator, "MuMu");
      assert.equal(s.role, "First Architect");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  // The canonical profile written by setup lives at DEMA_HOME/profile.json —
  // that is what operator-profile.js reads and what a real ~/.dema contains.
  // This surface read only the legacy memory/ copy, so every real node fell
  // through to the "Operator" default and the boot card never said the
  // operator's name. dema-first-look-home.js already resolves both, canonical
  // first; this pins the same order here.
  it("operator name read from the canonical DEMA_HOME/profile.json", async () => {
    const home = freshHome();
    try {
      writeFileSync(
        join(home, "profile.json"),
        JSON.stringify({
          schema: "bizra.dema.profile.v0.1",
          preferred_name: "Mumu",
        }),
      );
      const s = await gatherDemaRealmState({ demaHome: home, now: FIXED_NOW });
      assert.equal(s.operator, "Mumu");
      assert.equal(s.role, "First Architect");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  // Realm-card bindings (2026-08-14): the card printed "—"/EMPTY while a real
  // ~/.dema held 18 receipts and 4 missions, and the closure ledger verdict
  // never reached the surface. Same defect class as the profile path above:
  // real data on disk, no binding to the card.
  it("counts receipt json files from DEMA_HOME/receipts", async () => {
    const home = freshHome();
    try {
      mkdirSync(join(home, "receipts"), { recursive: true });
      writeFileSync(join(home, "receipts", "a.json"), "{}");
      writeFileSync(join(home, "receipts", "b.json"), "{}");
      writeFileSync(join(home, "receipts", "c.json"), "{}");
      writeFileSync(join(home, "receipts", "notes.txt"), "not a receipt");
      const s = await gatherDemaRealmState({ demaHome: home, now: FIXED_NOW });
      assert.equal(s.receipts.count, 3);
      const frame = renderHomeFrame(s, { useColor: false });
      assert.match(frame, /Receipts: 3/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("empty home reads receipts 0, missions 0, quest board EMPTY", async () => {
    const home = freshHome();
    try {
      const s = await gatherDemaRealmState({ demaHome: home, now: FIXED_NOW });
      assert.equal(s.receipts.count, 0);
      assert.equal(s.missions.count, 0);
      assert.equal(s.boot_steps[4].status, "EMPTY");
      const frame = renderHomeFrame(s, { useColor: false });
      assert.match(frame, /Receipts: 0/);
      assert.match(frame, /Missions: 0/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("quest board READY comes from missions on disk, not the checkpoint", async () => {
    const home = freshHome();
    try {
      mkdirSync(join(home, "missions", "m-alpha"), { recursive: true });
      mkdirSync(join(home, "missions", "m-beta"), { recursive: true });
      writeFileSync(join(home, "missions", "m-alpha", "contract.json"), "{}");
      // no checkpoint file on purpose — READY must not depend on it
      const s = await gatherDemaRealmState({ demaHome: home, now: FIXED_NOW });
      assert.equal(s.missions.count, 2);
      assert.equal(s.last_checkpoint.present, false);
      assert.equal(s.boot_steps[4].status, "READY");
      const frame = renderHomeFrame(s, { useColor: false });
      assert.match(frame, /Missions: 2/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  // "Always remembers where it was" — measured 2026-08-14: the shipped
  // `dema realm checkpoint save` has never been run on the real node, and
  // nothing on the card teaches it. An absent checkpoint must carry the exact
  // seal command; a present one must not nag.
  it("absent checkpoint teaches the seal command; present checkpoint does not", async () => {
    const home = freshHome();
    try {
      const bare = await gatherDemaRealmState({ demaHome: home, now: FIXED_NOW });
      assert.match(
        renderHomeFrame(bare, { useColor: false }),
        /dema realm checkpoint save/,
      );

      mkdirSync(join(home, "realm"), { recursive: true });
      writeFileSync(
        join(home, "realm", "last-checkpoint.json"),
        JSON.stringify({ label: "somewhere real" }),
      );
      const sealed = await gatherDemaRealmState({ demaHome: home, now: FIXED_NOW });
      const frame = renderHomeFrame(sealed, { useColor: false });
      assert.match(frame, /somewhere real/);
      assert.doesNotMatch(frame, /checkpoint save/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("an injected closure report reaches the card; absent stays an honest dash", async () => {
    const home = freshHome();
    try {
      const withReport = await gatherDemaRealmState({
        demaHome: home,
        now: FIXED_NOW,
        closureReport: {
          verdict: "CLOSED",
          satisfied_count: 10,
          violated_count: 0,
          unknown_count: 0,
          total: 10,
        },
      });
      assert.equal(withReport.closure.verdict, "CLOSED");
      assert.equal(withReport.closure.satisfied_count, 10);
      assert.match(
        renderHomeFrame(withReport, { useColor: false }),
        /Closure ledger: CLOSED · 10\/10/,
      );

      const without = await gatherDemaRealmState({
        demaHome: home,
        now: FIXED_NOW,
      });
      assert.equal(without.closure, null);
      assert.match(
        renderHomeFrame(without, { useColor: false }),
        /Closure ledger: —/,
      );
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("canonical profile.json wins over a stale legacy memory/profile.json", async () => {
    const home = freshHome();
    try {
      writeFileSync(
        join(home, "profile.json"),
        JSON.stringify({ preferred_name: "Canonical" }),
      );
      mkdirSync(join(home, "memory"), { recursive: true });
      writeFileSync(
        join(home, "memory", "profile.json"),
        JSON.stringify({ preferred_name: "Legacy" }),
      );
      const s = await gatherDemaRealmState({ demaHome: home, now: FIXED_NOW });
      assert.equal(s.operator, "Canonical");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("gatherDemaRealmState — boundary + freeze discipline", () => {
  it("envelope is frozen and boundary block has all 10 runtime/economic flags false", async () => {
    const home = freshHome();
    try {
      const s = await gatherDemaRealmState({ demaHome: home, now: FIXED_NOW });
      assert.equal(Object.isFrozen(s), true);
      assert.equal(Object.isFrozen(s.boot_steps), true);
      assert.equal(Object.isFrozen(s.menu_options), true);
      assert.equal(Object.isFrozen(s.menu_items), true);
      assert.equal(s.boundary.file_write_performed, false);
      assert.equal(s.boundary.network_used, false);
      assert.equal(s.boundary.federation_used, false);
      assert.equal(s.boundary.share_decision_made, false);
      assert.equal(s.boundary.poi_score_calculated, false);
      assert.equal(s.boundary.token_minted, false);
      assert.equal(s.boundary.economic_claim_made, false);
      assert.equal(s.boundary.private_key_loaded, false);
      assert.equal(s.boundary.raw_artifact_included, false);
      assert.equal(s.boundary.mutation_performed, false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("renderBootSequence + renderHomeFrame + renderMenu (no color)", () => {
  it("renderBootSequence emits 7 [n/7] lines + DEMA NODE0 BOOT header", async () => {
    const home = freshHome();
    try {
      const s = await gatherDemaRealmState({ demaHome: home, now: FIXED_NOW });
      const out = renderBootSequence(s, { useColor: false });
      assert.ok(out.includes("DEMA NODE0 BOOT"));
      for (let i = 1; i <= 7; i++) {
        assert.match(out, new RegExp(`\\[${i}/7\\]`));
      }
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("renderHomeFrame includes BIZRA NODE0 · DEMA HOME + operator + identity + checkpoint", async () => {
    const home = freshHome();
    try {
      mkdirSync(join(home, "memory"), { recursive: true });
      writeFileSync(
        join(home, "memory", "profile.json"),
        JSON.stringify({ preferred_name: "MuMu" }),
      );
      const s = await gatherDemaRealmState({ demaHome: home, now: FIXED_NOW });
      const out = renderHomeFrame(s, { useColor: false });
      assert.ok(out.includes("BIZRA NODE0 · DEMA HOME"));
      assert.ok(out.includes("MuMu"));
      assert.ok(out.includes("Identity:"));
      assert.ok(out.includes("Last checkpoint:"));
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("renderMenu includes numbered keys, commands, and go dispatch hint", async () => {
    const home = freshHome();
    try {
      const s = await gatherDemaRealmState({ demaHome: home, now: FIXED_NOW });
      const out = renderMenu(s, { useColor: false });
      assert.ok(out.includes("[1]"));
      assert.ok(out.includes("Continue from Last Checkpoint"));
      assert.ok(out.includes("dema realm checkpoint"));
      assert.ok(out.includes("Resource Wallet"));
      assert.ok(out.includes("dema realm wallet"));
      assert.ok(out.includes("dema realm go <n>"));
      assert.equal(out.includes("preview-only in v0"), false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("realmMenuItemByKey resolves menu dispatch targets", () => {
    assert.equal(realmMenuItemByKey("2")?.realm_sub, "board");
    assert.equal(realmMenuItemByKey("5")?.realm_sub, "proof-studio");
    assert.equal(realmMenuItemByKey("9"), null);
    assert.equal(REALM_MENU_ITEMS.length, 5);
  });

  it("renderDemaRealmHome composes boot + frame + menu in one pass", async () => {
    const home = freshHome();
    try {
      const s = await gatherDemaRealmState({ demaHome: home, now: FIXED_NOW });
      const out = renderDemaRealmHome(s, { useColor: false });
      assert.ok(out.includes("DEMA NODE0 BOOT"));
      assert.ok(out.includes("BIZRA NODE0 · DEMA HOME"));
      assert.ok(out.includes("[1]"));
      assert.ok(out.includes("Continue from Last Checkpoint"));
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("dema realm CLI", () => {
  it("--json emits schema-tagged envelope with seed_awake:false on empty DEMA_HOME, exit 0", async () => {
    const home = freshHome();
    try {
      const r = await runCli(["realm", "--json"], { demaHome: home });
      assert.equal(r.exitCode, 0);
      const out = JSON.parse(r.stdout);
      assert.equal(out.schema, DEMA_REALM_HOME_SCHEMA);
      assert.equal(out.seed_awake, false);
      assert.equal(out.identity.status, "UNINITIALIZED");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("human render --no-color includes all required atmospheric anchors, exit 0", async () => {
    const home = freshHome();
    try {
      const r = await runCli(["realm", "--no-color"], { demaHome: home });
      assert.equal(r.exitCode, 0);
      assert.match(r.stdout, /DEMA NODE0 BOOT/);
      assert.match(r.stdout, /BIZRA NODE0 · DEMA HOME/);
      assert.match(
        r.stdout,
        /sovereign seed awaits initialization|sovereign seed is awake/,
      );
      assert.match(r.stdout, /\[2\]/);
      assert.match(r.stdout, /dema realm go <n>/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("no private key / raw artifact / forbidden-economic field in output", async () => {
    const home = freshHome();
    try {
      const r = await runCli(["realm", "--json"], { demaHome: home });
      const combined = r.stdout + r.stderr;
      assert.equal(combined.includes("BEGIN PRIVATE KEY"), false);
      assert.equal(combined.includes('"private_key":'), false);
      assert.equal(combined.includes('"raw_artifact":'), false);
      assert.equal(combined.includes('"mint_candidate":'), false);
      assert.equal(combined.includes('"token_eligible":'), false);
      assert.equal(combined.includes('"federation_target":'), false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
