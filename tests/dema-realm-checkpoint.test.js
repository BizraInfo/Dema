import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  gatherDemaRealmCheckpoint,
  renderDemaRealmCheckpoint,
  DEMA_REALM_CHECKPOINT_JOURNAL_SCHEMA,
} from "../packages/core/src/dema-realm-checkpoint.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const CLI_PATH = join(REPO_ROOT, "apps", "cli", "src", "index.js");
const FIXED_NOW = new Date("2026-05-28T20:54:00Z");

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
  return mkdtempSync(join(tmpdir(), "dema-realm-cp-test-"));
}

function writeCheckpoint(home, obj) {
  mkdirSync(join(home, "realm"), { recursive: true });
  writeFileSync(
    join(home, "realm", "last-checkpoint.json"),
    JSON.stringify(obj),
  );
}

function writeTimeline(home, events) {
  mkdirSync(join(home, "realm"), { recursive: true });
  writeFileSync(
    join(home, "realm", "timeline.json"),
    JSON.stringify({ events }),
  );
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

describe("gatherDemaRealmCheckpoint — absent state", () => {
  it("returns CHECKPOINT_ABSENT truth label + null checkpoint when file missing", async () => {
    const home = freshHome();
    try {
      const s = await gatherDemaRealmCheckpoint({
        demaHome: home,
        now: FIXED_NOW,
      });
      assert.equal(s.schema, DEMA_REALM_CHECKPOINT_JOURNAL_SCHEMA);
      assert.equal(s.truth_label, "CHECKPOINT_ABSENT");
      assert.equal(s.checkpoint_present, false);
      assert.equal(s.checkpoint, null);
      assert.equal(s.timeline_present, false);
      assert.deepEqual([...s.timeline], []);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("malformed checkpoint JSON safely treated as absent", async () => {
    const home = freshHome();
    try {
      mkdirSync(join(home, "realm"), { recursive: true });
      writeFileSync(join(home, "realm", "last-checkpoint.json"), "{not json");
      const s = await gatherDemaRealmCheckpoint({
        demaHome: home,
        now: FIXED_NOW,
      });
      assert.equal(s.truth_label, "CHECKPOINT_ABSENT");
      assert.equal(s.checkpoint_present, false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("checkpoint with missing label treated as absent", async () => {
    const home = freshHome();
    try {
      writeCheckpoint(home, { stage: "FORGE" });
      const s = await gatherDemaRealmCheckpoint({
        demaHome: home,
        now: FIXED_NOW,
      });
      assert.equal(s.truth_label, "CHECKPOINT_ABSENT");
      assert.equal(s.checkpoint_present, false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("gatherDemaRealmCheckpoint — present state", () => {
  it("returns LOCAL_CHECKPOINT_DECLARED + full checkpoint fields", async () => {
    const home = freshHome();
    try {
      writeCheckpoint(home, {
        label: "UX-1B Dema Realm Mission Board",
        stage: "ARCHIVE",
        truth_label: "UX_1B_DEMA_REALM_MISSION_BOARD_REMOTE_CI_VERIFIED",
        resume_command: "dema realm board",
        next_gear: "UX-1C Checkpoint Journal",
        sealed_at_iso: "2026-05-28T20:54:00Z",
      });
      const s = await gatherDemaRealmCheckpoint({
        demaHome: home,
        now: FIXED_NOW,
      });
      assert.equal(s.truth_label, "LOCAL_CHECKPOINT_DECLARED");
      assert.equal(s.checkpoint_present, true);
      assert.equal(s.checkpoint.label, "UX-1B Dema Realm Mission Board");
      assert.equal(s.checkpoint.stage, "ARCHIVE");
      assert.equal(s.checkpoint.resume_command, "dema realm board");
      assert.equal(s.checkpoint.next_gear, "UX-1C Checkpoint Journal");
      assert.equal(s.checkpoint.sealed_at_iso, "2026-05-28T20:54:00Z");
      assert.equal(
        s.checkpoint.raw_truth_label,
        "UX_1B_DEMA_REALM_MISSION_BOARD_REMOTE_CI_VERIFIED",
      );
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("defaults resume_command to `dema realm board` when absent", async () => {
    const home = freshHome();
    try {
      writeCheckpoint(home, { label: "anything" });
      const s = await gatherDemaRealmCheckpoint({
        demaHome: home,
        now: FIXED_NOW,
      });
      assert.equal(s.checkpoint.resume_command, "dema realm board");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("accepts next_quest as alias for next_gear (back-compat)", async () => {
    const home = freshHome();
    try {
      writeCheckpoint(home, { label: "x", next_quest: "URP-4.1B" });
      const s = await gatherDemaRealmCheckpoint({
        demaHome: home,
        now: FIXED_NOW,
      });
      assert.equal(s.checkpoint.next_gear, "URP-4.1B");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("gatherDemaRealmCheckpoint — timeline", () => {
  it("reads timeline.json when present + valid", async () => {
    const home = freshHome();
    try {
      writeCheckpoint(home, { label: "x" });
      writeTimeline(home, [
        { at: "20:08", label: "UX-1A Home verified" },
        { at: "20:32", label: "UX-1B Board pushed" },
      ]);
      const s = await gatherDemaRealmCheckpoint({
        demaHome: home,
        now: FIXED_NOW,
      });
      assert.equal(s.timeline_present, true);
      assert.equal(s.timeline.length, 2);
      assert.equal(s.timeline[0].at, "20:08");
      assert.equal(s.timeline[1].label, "UX-1B Board pushed");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("malformed timeline.json treated as absent", async () => {
    const home = freshHome();
    try {
      mkdirSync(join(home, "realm"), { recursive: true });
      writeFileSync(join(home, "realm", "timeline.json"), "{not valid");
      const s = await gatherDemaRealmCheckpoint({
        demaHome: home,
        now: FIXED_NOW,
      });
      assert.equal(s.timeline_present, false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("timeline event missing required fields → entire timeline treated as absent", async () => {
    const home = freshHome();
    try {
      mkdirSync(join(home, "realm"), { recursive: true });
      writeFileSync(
        join(home, "realm", "timeline.json"),
        JSON.stringify({ events: [{ at: "x" }] }),
      );
      const s = await gatherDemaRealmCheckpoint({
        demaHome: home,
        now: FIXED_NOW,
      });
      assert.equal(s.timeline_present, false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("gatherDemaRealmCheckpoint — boundary + freeze + no leaks", () => {
  it("envelope frozen with 10-flag false boundary block", async () => {
    const home = freshHome();
    try {
      const s = await gatherDemaRealmCheckpoint({
        demaHome: home,
        now: FIXED_NOW,
      });
      assert.equal(Object.isFrozen(s), true);
      assert.equal(Object.isFrozen(s.timeline), true);
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

  it("no forbidden JSON keys in serialized envelope (present path)", async () => {
    const home = freshHome();
    try {
      writeCheckpoint(home, {
        label: "x",
        next_gear: "y",
        sealed_at_iso: "2026-05-28T20:54:00Z",
      });
      const s = await gatherDemaRealmCheckpoint({
        demaHome: home,
        now: FIXED_NOW,
      });
      const json = JSON.stringify(s);
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

describe("renderDemaRealmCheckpoint (no color)", () => {
  it("absent state renders header + No checkpoint found + Truth + Path + timeline placeholder", async () => {
    const home = freshHome();
    try {
      const s = await gatherDemaRealmCheckpoint({
        demaHome: home,
        now: FIXED_NOW,
      });
      const out = renderDemaRealmCheckpoint(s, { useColor: false });
      assert.match(out, /DEMA REALM · CHECKPOINT JOURNAL/);
      assert.match(out, /No checkpoint found\./);
      assert.match(out, /Truth:\s+CHECKPOINT_ABSENT/);
      assert.match(out, /Journey timeline:/);
      assert.match(out, /no persisted timeline yet/);
      assert.match(out, /checkpoint save/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("present state renders Label + Stage + Truth + Resume + Next + Sealed", async () => {
    const home = freshHome();
    try {
      writeCheckpoint(home, {
        label: "UX-1B Dema Realm Mission Board",
        stage: "ARCHIVE",
        resume_command: "dema realm board",
        next_gear: "UX-1C",
        sealed_at_iso: "2026-05-28T20:54:00Z",
      });
      const s = await gatherDemaRealmCheckpoint({
        demaHome: home,
        now: FIXED_NOW,
      });
      const out = renderDemaRealmCheckpoint(s, { useColor: false });
      assert.match(out, /Last Checkpoint:/);
      assert.match(out, /Label:\s+UX-1B Dema Realm Mission Board/);
      assert.match(out, /Stage:\s+ARCHIVE/);
      assert.match(out, /Truth:\s+LOCAL_CHECKPOINT_DECLARED/);
      assert.match(out, /Resume:\s+dema realm board/);
      assert.match(out, /Next:\s+UX-1C/);
      assert.match(out, /Sealed:\s+2026-05-28T20:54:00Z/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("present timeline renders journey tree with latest highlighted", async () => {
    const home = freshHome();
    try {
      writeCheckpoint(home, {
        label: "x",
        resume_command: "dema realm board",
      });
      writeTimeline(home, [
        { at: "20:08", label: "UX-1A Home verified" },
        { at: "20:32", label: "UX-1B Board pushed" },
      ]);
      const s = await gatherDemaRealmCheckpoint({
        demaHome: home,
        now: FIXED_NOW,
      });
      const out = renderDemaRealmCheckpoint(s, { useColor: false });
      assert.match(out, /2 events recorded/);
      assert.match(out, /├─ ○ 20:08 · UX-1A Home verified/);
      assert.match(out, /└─ ● 20:32 · UX-1B Board pushed/);
      assert.match(out, /Resume from latest:/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("dema realm checkpoint CLI", () => {
  it("--json on empty home emits CHECKPOINT_ABSENT envelope, exit 0", async () => {
    const home = freshHome();
    try {
      const r = await runCli(["realm", "checkpoint", "--json"], {
        demaHome: home,
      });
      assert.equal(r.exitCode, 0);
      const out = JSON.parse(r.stdout);
      assert.equal(out.schema, DEMA_REALM_CHECKPOINT_JOURNAL_SCHEMA);
      assert.equal(out.truth_label, "CHECKPOINT_ABSENT");
      assert.equal(out.checkpoint_present, false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("--no-color human render shows DEMA REALM · CHECKPOINT JOURNAL header", async () => {
    const home = freshHome();
    try {
      const r = await runCli(["realm", "checkpoint", "--no-color"], {
        demaHome: home,
      });
      assert.equal(r.exitCode, 0);
      assert.match(r.stdout, /DEMA REALM · CHECKPOINT JOURNAL/);
      assert.match(r.stdout, /Journey timeline:/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("no private key / no forbidden JSON keys in output", async () => {
    const home = freshHome();
    try {
      writeCheckpoint(home, { label: "x" });
      const r = await runCli(["realm", "checkpoint", "--json"], {
        demaHome: home,
      });
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
