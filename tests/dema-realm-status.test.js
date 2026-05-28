import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  gatherDemaRealmStatus,
  renderDemaRealmStatus,
  DEMA_REALM_LIVE_STATUS_SCHEMA,
} from "../packages/core/src/dema-realm-status.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import {
  signArtifact,
  SIGN_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-sign-command.js";

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
  return mkdtempSync(join(tmpdir(), "dema-realm-status-test-"));
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

describe("gatherDemaRealmStatus — empty home (seed state)", () => {
  it("returns zero counts + UNINITIALIZED identity + sovereign-seed-awaits line", async () => {
    const home = freshHome();
    try {
      const s = await gatherDemaRealmStatus({ demaHome: home, now: FIXED_NOW });
      assert.equal(s.schema, DEMA_REALM_LIVE_STATUS_SCHEMA);
      assert.equal(s.truth_label, "LOCAL_REALM_LIVE_STATUS");
      assert.equal(s.identity_status, "UNINITIALIZED");
      assert.equal(
        s.awakened_line,
        "The sovereign seed awaits initialization.",
      );
      assert.equal(s.authorship_receipts_count, 0);
      assert.equal(s.urp_indexes_count, 0);
      assert.equal(s.checkpoint_present, false);
      assert.equal(s.last_checkpoint_label, null);
      assert.equal(s.timeline_events_count, 0);
      assert.equal(s.most_recent_timeline_event, null);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("gatherDemaRealmStatus — identity present", () => {
  it("identity becomes VERIFIED + sovereign-seed-is-awake line after `authorship key init`", async () => {
    const home = freshHome();
    const prev = process.env.DEMA_HOME;
    process.env.DEMA_HOME = home;
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const s = await gatherDemaRealmStatus({ demaHome: home, now: FIXED_NOW });
      assert.equal(s.identity_status, "VERIFIED");
      assert.equal(s.awakened_line, "The sovereign seed is awake.");
    } finally {
      if (prev) process.env.DEMA_HOME = prev;
      else delete process.env.DEMA_HOME;
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("gatherDemaRealmStatus — authorship + URP counts", () => {
  it("authorship_receipts_count reflects $DEMA_HOME/receipts/authorship-<sha>.json files", async () => {
    const home = freshHome();
    const prev = process.env.DEMA_HOME;
    process.env.DEMA_HOME = home;
    try {
      await initAuthorshipKey({
        consent: KEY_INIT_CONSENT_PHRASE,
        demaHome: home,
      });
      const a1 = join(home, "a1.txt");
      const a2 = join(home, "a2.txt");
      writeFileSync(a1, "alpha");
      writeFileSync(a2, "beta");
      await signArtifact({
        artifactPath: a1,
        consent: SIGN_CONSENT_PHRASE,
        demaHome: home,
      });
      await signArtifact({
        artifactPath: a2,
        consent: SIGN_CONSENT_PHRASE,
        demaHome: home,
      });
      const s = await gatherDemaRealmStatus({ demaHome: home, now: FIXED_NOW });
      assert.equal(s.authorship_receipts_count, 2);
    } finally {
      if (prev) process.env.DEMA_HOME = prev;
      else delete process.env.DEMA_HOME;
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("urp_indexes_count reflects $DEMA_HOME/urp/indexes/urp-index-<sha>.json files", async () => {
    const home = freshHome();
    try {
      const dir = join(home, "urp", "indexes");
      mkdirSync(dir, { recursive: true });
      const sha = (n) => String(n).padStart(64, "0");
      writeFileSync(join(dir, `urp-index-${sha(1)}.json`), "{}");
      writeFileSync(join(dir, `urp-index-${sha(2)}.json`), "{}");
      writeFileSync(join(dir, `urp-index-${sha(3)}.json`), "{}");
      // Stray file outside the canonical pattern → not counted
      writeFileSync(join(dir, "stray.txt"), "ignore me");
      const s = await gatherDemaRealmStatus({ demaHome: home, now: FIXED_NOW });
      assert.equal(s.urp_indexes_count, 3);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("gatherDemaRealmStatus — checkpoint + timeline", () => {
  it("checkpoint present flips checkpoint_present + last_checkpoint_label reads `label`", async () => {
    const home = freshHome();
    try {
      mkdirSync(join(home, "realm"), { recursive: true });
      writeFileSync(
        join(home, "realm", "last-checkpoint.json"),
        JSON.stringify({ label: "UX-2A heartbeat", stage: "FORGE" }),
      );
      const s = await gatherDemaRealmStatus({ demaHome: home, now: FIXED_NOW });
      assert.equal(s.checkpoint_present, true);
      assert.equal(s.last_checkpoint_label, "UX-2A heartbeat");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("timeline counts events + reports most_recent (last in array)", async () => {
    const home = freshHome();
    try {
      mkdirSync(join(home, "realm"), { recursive: true });
      writeFileSync(
        join(home, "realm", "timeline.json"),
        JSON.stringify({
          events: [
            { at: "20:08", label: "UX-1A verified" },
            { at: "20:32", label: "UX-1B pushed" },
            { at: "20:54", label: "UX-1C verified" },
          ],
        }),
      );
      const s = await gatherDemaRealmStatus({ demaHome: home, now: FIXED_NOW });
      assert.equal(s.timeline_events_count, 3);
      assert.deepEqual(
        {
          at: s.most_recent_timeline_event.at,
          label: s.most_recent_timeline_event.label,
        },
        { at: "20:54", label: "UX-1C verified" },
      );
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("malformed checkpoint JSON safely treated as absent", async () => {
    const home = freshHome();
    try {
      mkdirSync(join(home, "realm"), { recursive: true });
      writeFileSync(join(home, "realm", "last-checkpoint.json"), "{not valid");
      const s = await gatherDemaRealmStatus({ demaHome: home, now: FIXED_NOW });
      assert.equal(s.checkpoint_present, false);
      assert.equal(s.last_checkpoint_label, null);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("malformed timeline JSON safely treated as 0 events", async () => {
    const home = freshHome();
    try {
      mkdirSync(join(home, "realm"), { recursive: true });
      writeFileSync(join(home, "realm", "timeline.json"), "{not valid");
      const s = await gatherDemaRealmStatus({ demaHome: home, now: FIXED_NOW });
      assert.equal(s.timeline_events_count, 0);
      assert.equal(s.most_recent_timeline_event, null);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("gatherDemaRealmStatus — boundary + freeze + no leaks", () => {
  it("envelope frozen with 10-flag false boundary block", async () => {
    const home = freshHome();
    try {
      const s = await gatherDemaRealmStatus({ demaHome: home, now: FIXED_NOW });
      assert.equal(Object.isFrozen(s), true);
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

  it("no forbidden JSON keys in serialized envelope", async () => {
    const home = freshHome();
    try {
      const s = await gatherDemaRealmStatus({ demaHome: home, now: FIXED_NOW });
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

describe("renderDemaRealmStatus (no color)", () => {
  it("includes DEMA REALM · LIVE STATUS header + all anchored sections", async () => {
    const home = freshHome();
    try {
      const s = await gatherDemaRealmStatus({ demaHome: home, now: FIXED_NOW });
      const out = renderDemaRealmStatus(s, { useColor: false });
      assert.match(out, /DEMA REALM · LIVE STATUS/);
      assert.match(out, /Identity:/);
      assert.match(out, /Receipts:/);
      assert.match(out, /Checkpoint:/);
      assert.match(out, /Timeline:/);
      assert.match(out, /Boundary:/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("empty home render shows UNINITIALIZED + 0 receipts + no checkpoint + 0 events", async () => {
    const home = freshHome();
    try {
      const s = await gatherDemaRealmStatus({ demaHome: home, now: FIXED_NOW });
      const out = renderDemaRealmStatus(s, { useColor: false });
      assert.match(out, /UNINITIALIZED/);
      assert.match(out, /authorship\s+0/);
      assert.match(out, /URP indexes 0/);
      assert.match(out, /0 events/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("dema realm status CLI", () => {
  it("--json on empty home emits schema-tagged envelope, exit 0", async () => {
    const home = freshHome();
    try {
      const r = await runCli(["realm", "status", "--json"], { demaHome: home });
      assert.equal(r.exitCode, 0);
      const out = JSON.parse(r.stdout);
      assert.equal(out.schema, DEMA_REALM_LIVE_STATUS_SCHEMA);
      assert.equal(out.identity_status, "UNINITIALIZED");
      assert.equal(out.authorship_receipts_count, 0);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("--no-color human render exits 0 + includes anchors", async () => {
    const home = freshHome();
    try {
      const r = await runCli(["realm", "status", "--no-color"], {
        demaHome: home,
      });
      assert.equal(r.exitCode, 0);
      assert.match(r.stdout, /DEMA REALM · LIVE STATUS/);
      assert.match(r.stdout, /awaits initialization/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("no PEM headers / no forbidden JSON keys in output", async () => {
    const home = freshHome();
    try {
      const r = await runCli(["realm", "status", "--json"], { demaHome: home });
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
