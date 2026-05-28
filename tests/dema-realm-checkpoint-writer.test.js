import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  statSync,
  existsSync,
  rmSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  saveDemaRealmCheckpoint,
  DEMA_REALM_CHECKPOINT_SAVE_RESULT_SCHEMA,
} from "../packages/core/src/dema-realm-checkpoint-writer.js";
import { gatherDemaRealmCheckpoint } from "../packages/core/src/dema-realm-checkpoint.js";

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
  return mkdtempSync(join(tmpdir(), "dema-cpw-test-"));
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

describe("saveDemaRealmCheckpoint — happy paths", () => {
  it("first save writes checkpoint + creates timeline with 1 event", async () => {
    const home = freshHome();
    try {
      const r = await saveDemaRealmCheckpoint(
        {
          label: "UX-2B Checkpoint Writer",
          stage: "ARCHIVE",
          nextGear: "UX-1D Council Chamber",
          resumeCommand: "dema realm board",
        },
        { demaHome: home, now: FIXED_NOW },
      );
      assert.equal(r.schema, DEMA_REALM_CHECKPOINT_SAVE_RESULT_SCHEMA);
      assert.equal(r.saved, true);
      assert.equal(r.truth_label, "LOCAL_CHECKPOINT_SAVED");
      assert.equal(r.timeline_total_events, 1);
      assert.equal(r.timeline_event_appended.label, "UX-2B Checkpoint Writer");
      assert.ok(existsSync(r.checkpoint_path));
      assert.ok(existsSync(r.timeline_path));
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("file modes are 0o600 on both checkpoint + timeline", async () => {
    const home = freshHome();
    try {
      const r = await saveDemaRealmCheckpoint(
        { label: "x" },
        { demaHome: home, now: FIXED_NOW },
      );
      assert.equal(r.mode_octal, "0o600");
      assert.equal(statSync(r.checkpoint_path).mode & 0o777, 0o600);
      assert.equal(statSync(r.timeline_path).mode & 0o777, 0o600);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("second save overwrites checkpoint + appends timeline (2 events total)", async () => {
    const home = freshHome();
    try {
      await saveDemaRealmCheckpoint(
        { label: "first", stage: "FORGE" },
        { demaHome: home, now: FIXED_NOW },
      );
      const r2 = await saveDemaRealmCheckpoint(
        { label: "second", stage: "ARCHIVE", nextGear: "UX-1D" },
        { demaHome: home, now: FIXED_NOW },
      );
      assert.equal(r2.timeline_total_events, 2);
      const cp = JSON.parse(readFileSync(r2.checkpoint_path, "utf8"));
      assert.equal(cp.label, "second");
      assert.equal(cp.stage, "ARCHIVE");
      const tl = JSON.parse(readFileSync(r2.timeline_path, "utf8"));
      assert.equal(tl.events.length, 2);
      assert.equal(tl.events[0].label, "first");
      assert.equal(tl.events[1].label, "second");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("UX-2B writer + UX-1C reader form a closed loop (write → read same state)", async () => {
    const home = freshHome();
    try {
      await saveDemaRealmCheckpoint(
        {
          label: "loop test",
          stage: "FORGE",
          nextGear: "next thing",
          resumeCommand: "dema realm board",
        },
        { demaHome: home, now: FIXED_NOW },
      );
      const read = await gatherDemaRealmCheckpoint({
        demaHome: home,
        now: FIXED_NOW,
      });
      assert.equal(read.checkpoint_present, true);
      assert.equal(read.checkpoint.label, "loop test");
      assert.equal(read.checkpoint.stage, "FORGE");
      assert.equal(read.checkpoint.next_gear, "next thing");
      assert.equal(read.checkpoint.resume_command, "dema realm board");
      assert.equal(read.timeline_present, true);
      assert.equal(read.timeline.length, 1);
      assert.equal(read.timeline[0].label, "loop test");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("custom --timeline-label is preferred over checkpoint label when supplied", async () => {
    const home = freshHome();
    try {
      const r = await saveDemaRealmCheckpoint(
        {
          label: "checkpoint label",
          timelineLabel: "different timeline label",
        },
        { demaHome: home, now: FIXED_NOW },
      );
      assert.equal(r.timeline_event_appended.label, "different timeline label");
      const cp = JSON.parse(readFileSync(r.checkpoint_path, "utf8"));
      assert.equal(cp.label, "checkpoint label");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("defaults resume_command to `dema realm board` when not supplied", async () => {
    const home = freshHome();
    try {
      const r = await saveDemaRealmCheckpoint(
        { label: "x" },
        { demaHome: home, now: FIXED_NOW },
      );
      assert.equal(r.checkpoint.resume_command, "dema realm board");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("saveDemaRealmCheckpoint — validation + failure paths", () => {
  it("missing label returns saved:false with missing_label error, no files written", async () => {
    const home = freshHome();
    try {
      const r = await saveDemaRealmCheckpoint(
        {},
        { demaHome: home, now: FIXED_NOW },
      );
      assert.equal(r.saved, false);
      assert.equal(r.error, "missing_label");
      assert.equal(
        existsSync(join(home, "realm", "last-checkpoint.json")),
        false,
      );
      assert.equal(existsSync(join(home, "realm", "timeline.json")), false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("empty-string label returns missing_label", async () => {
    const home = freshHome();
    try {
      const r = await saveDemaRealmCheckpoint(
        { label: "" },
        { demaHome: home, now: FIXED_NOW },
      );
      assert.equal(r.saved, false);
      assert.equal(r.error, "missing_label");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("label > 200 chars returns label_too_long with received_length", async () => {
    const home = freshHome();
    try {
      const r = await saveDemaRealmCheckpoint(
        { label: "x".repeat(201) },
        { demaHome: home, now: FIXED_NOW },
      );
      assert.equal(r.saved, false);
      assert.equal(r.error, "label_too_long");
      assert.equal(r.max_length, 200);
      assert.equal(r.received_length, 201);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("malformed pre-existing timeline.json is overwritten with fresh events array", async () => {
    const home = freshHome();
    try {
      const { mkdirSync, writeFileSync } = await import("node:fs");
      mkdirSync(join(home, "realm"), { recursive: true });
      writeFileSync(join(home, "realm", "timeline.json"), "{not valid json");
      const r = await saveDemaRealmCheckpoint(
        { label: "x" },
        { demaHome: home, now: FIXED_NOW },
      );
      assert.equal(r.saved, true);
      assert.equal(r.timeline_total_events, 1);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("saveDemaRealmCheckpoint — boundary + no leaks", () => {
  it("success envelope boundary is honest: file_write_performed:true + mutation_performed:true, all others false", async () => {
    const home = freshHome();
    try {
      const r = await saveDemaRealmCheckpoint(
        { label: "x" },
        { demaHome: home, now: FIXED_NOW },
      );
      assert.equal(r.boundary.file_write_performed, true);
      assert.equal(r.boundary.mutation_performed, true);
      assert.equal(r.boundary.network_used, false);
      assert.equal(r.boundary.federation_used, false);
      assert.equal(r.boundary.share_decision_made, false);
      assert.equal(r.boundary.poi_score_calculated, false);
      assert.equal(r.boundary.token_minted, false);
      assert.equal(r.boundary.economic_claim_made, false);
      assert.equal(r.boundary.private_key_loaded, false);
      assert.equal(r.boundary.raw_artifact_included, false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("failure envelope boundary is all-false (no write performed)", async () => {
    const home = freshHome();
    try {
      const r = await saveDemaRealmCheckpoint(
        {},
        { demaHome: home, now: FIXED_NOW },
      );
      assert.equal(r.boundary.file_write_performed, false);
      assert.equal(r.boundary.mutation_performed, false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("no forbidden JSON keys in success envelope or persisted files", async () => {
    const home = freshHome();
    try {
      const r = await saveDemaRealmCheckpoint(
        { label: "loop label", stage: "FORGE", nextGear: "next" },
        { demaHome: home, now: FIXED_NOW },
      );
      const envelopeJson = JSON.stringify(r);
      const checkpointJson = readFileSync(r.checkpoint_path, "utf8");
      const timelineJson = readFileSync(r.timeline_path, "utf8");
      for (const field of FORBIDDEN_FIELDS) {
        assert.equal(envelopeJson.includes(`"${field}":`), false);
        assert.equal(checkpointJson.includes(`"${field}":`), false);
        assert.equal(timelineJson.includes(`"${field}":`), false);
      }
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("envelope is frozen on both success and failure paths", async () => {
    const home = freshHome();
    try {
      const ok = await saveDemaRealmCheckpoint(
        { label: "x" },
        { demaHome: home, now: FIXED_NOW },
      );
      const bad = await saveDemaRealmCheckpoint(
        {},
        { demaHome: home, now: FIXED_NOW },
      );
      assert.equal(Object.isFrozen(ok), true);
      assert.equal(Object.isFrozen(bad), true);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("dema realm checkpoint save CLI", () => {
  it("happy save with --label exits 0 + human output contains LOCAL_CHECKPOINT_SAVED", async () => {
    const home = freshHome();
    try {
      const r = await runCli(
        [
          "realm",
          "checkpoint",
          "save",
          "--label",
          "UX-2B test",
          "--stage",
          "ARCHIVE",
        ],
        { demaHome: home },
      );
      assert.equal(r.exitCode, 0);
      assert.match(r.stdout, /Checkpoint saved\./);
      assert.match(r.stdout, /LOCAL_CHECKPOINT_SAVED/);
      assert.match(r.stdout, /Mode:\s+0o600/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("--json save emits schema-tagged envelope, exit 0", async () => {
    const home = freshHome();
    try {
      const r = await runCli(
        ["realm", "checkpoint", "save", "--label", "json test", "--json"],
        { demaHome: home },
      );
      assert.equal(r.exitCode, 0);
      const out = JSON.parse(r.stdout);
      assert.equal(out.schema, DEMA_REALM_CHECKPOINT_SAVE_RESULT_SCHEMA);
      assert.equal(out.saved, true);
      assert.equal(out.boundary.file_write_performed, true);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("save without --label exits 1, no files written", async () => {
    const home = freshHome();
    try {
      const r = await runCli(["realm", "checkpoint", "save"], {
        demaHome: home,
      });
      assert.equal(r.exitCode, 1);
      assert.match(r.stderr, /missing_label/);
      assert.equal(
        existsSync(join(home, "realm", "last-checkpoint.json")),
        false,
      );
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
