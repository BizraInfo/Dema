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
  listChooseDecisions,
  URP_CHOOSE_LIST_SCHEMA,
} from "../packages/urp/src/choose-list.js";
import {
  buildChooseDecision,
  DECISION_MARK_SHAREABLE,
  DECISION_MARK_LOCAL_ONLY,
  CONSENT_MARK_SHAREABLE,
  CONSENT_MARK_LOCAL_ONLY,
} from "../packages/urp/src/choose-decision.js";
import { saveChooseDecision } from "../packages/urp/src/choose-writer.js";
import { URP_LOCAL_INDEX_SCHEMA } from "../packages/urp/src/local-index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const CLI_PATH = join(REPO_ROOT, "apps", "cli", "src", "index.js");
const FIXED_NOW = new Date("2026-05-28T22:00:00Z");

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
  return mkdtempSync(join(tmpdir(), "dema-ucl-test-"));
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

function validIndex(overrides = {}) {
  return {
    schema: URP_LOCAL_INDEX_SCHEMA,
    mode: "LOCAL_INDEX_ONLY",
    truth_label: "LOCAL_VERIFIED_RESOURCE_INDEX",
    share_status: "MARKED_LOCAL_ONLY",
    source_passport_hash: "a".repeat(64),
    verification_scope: "PASSPORT_ENVELOPE_AND_RECEIPTS",
    resource_class: "WORK_ARTIFACT",
    awareness_level: "A2_METADATA",
    receipts_count: 1,
    artifact_hashes: ["b".repeat(64)],
    author_fingerprints: ["c".repeat(64)],
    entries: [
      {
        receipt_filename: "authorship-abc.json",
        artifact_sha256: "b".repeat(64),
        author_fingerprint: "c".repeat(64),
        truth_label: "LOCAL_AUTHORSHIP_ATTESTED",
      },
    ],
    indexed_at_iso: "2026-05-28T10:00:00Z",
    index_hash: "d".repeat(64),
    ...overrides,
  };
}

async function persistShare(home) {
  const env = buildChooseDecision(validIndex(), {
    decision: DECISION_MARK_SHAREABLE,
    consent: CONSENT_MARK_SHAREABLE,
    now: FIXED_NOW,
  });
  return saveChooseDecision(env, { demaHome: home });
}

async function persistKeep(home) {
  const env = buildChooseDecision(validIndex(), {
    decision: DECISION_MARK_LOCAL_ONLY,
    consent: CONSENT_MARK_LOCAL_ONLY,
    now: FIXED_NOW,
  });
  return saveChooseDecision(env, { demaHome: home });
}

describe("listChooseDecisions — empty + populated", () => {
  it("returns count:0 envelope when choices dir does not exist", async () => {
    const home = freshHome();
    try {
      const r = await listChooseDecisions({ demaHome: home });
      assert.equal(r.schema, URP_CHOOSE_LIST_SCHEMA);
      assert.equal(r.count, 0);
      assert.deepEqual([...r.entries], []);
      assert.equal(r.corruption_detected, false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("returns count:0 envelope when choices dir exists but is empty", async () => {
    const home = freshHome();
    try {
      mkdirSync(join(home, "urp", "choices"), { recursive: true });
      const r = await listChooseDecisions({ demaHome: home });
      assert.equal(r.count, 0);
      assert.equal(r.corruption_detected, false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("lists one persisted choose receipt with all metadata fields populated", async () => {
    const home = freshHome();
    try {
      const w = await persistShare(home);
      assert.equal(w.written, true);
      const r = await listChooseDecisions({ demaHome: home });
      assert.equal(r.count, 1);
      const e = r.entries[0];
      assert.equal(e.filename_hash_matches, true);
      assert.equal(e.body_hash_intact, true);
      assert.equal(e.decision, "MARK_SHAREABLE");
      assert.equal(e.previous_share_status, "MARKED_LOCAL_ONLY");
      assert.equal(e.next_share_status, "CANDIDATE_SHAREABLE");
      assert.equal(e.consent_verified, true);
      assert.match(e.choose_hash, /^[a-f0-9]{64}$/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("lists two distinct receipts (share + keep) sorted by filename, both OK", async () => {
    const home = freshHome();
    try {
      await persistShare(home);
      await persistKeep(home);
      const r = await listChooseDecisions({ demaHome: home });
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
});

describe("listChooseDecisions — non-canonical + corruption", () => {
  it("skips files not matching choose-<sha256>.json pattern", async () => {
    const home = freshHome();
    try {
      await persistShare(home);
      const dir = join(home, "urp", "choices");
      writeFileSync(join(dir, "stray.txt"), "ignore me");
      writeFileSync(
        join(dir, "choose-too-short.json"),
        JSON.stringify({ schema: "x" }),
      );
      const r = await listChooseDecisions({ demaHome: home });
      assert.equal(r.count, 1);
      assert.equal(r.corruption_detected, false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("flags corruption when body bytes are tampered (hash mismatch)", async () => {
    const home = freshHome();
    try {
      const w = await persistShare(home);
      const body = JSON.parse(readFileSync(w.receipt_path, "utf8"));
      body.previous_share_status = "TAMPERED";
      writeFileSync(w.receipt_path, JSON.stringify(body, null, 2));
      const r = await listChooseDecisions({ demaHome: home });
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
      const w = await persistShare(home);
      const dir = join(home, "urp", "choices");
      const fake = join(
        dir,
        "choose-0000000000000000000000000000000000000000000000000000000000000000.json",
      );
      writeFileSync(fake, readFileSync(w.receipt_path));
      rmSync(w.receipt_path);
      const r = await listChooseDecisions({ demaHome: home });
      assert.equal(r.count, 1);
      assert.equal(r.corruption_detected, true);
      assert.equal(r.entries[0].filename_hash_matches, false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("flags wrong_schema when file contains foreign schema content", async () => {
    const home = freshHome();
    try {
      const dir = join(home, "urp", "choices");
      mkdirSync(dir, { recursive: true });
      const fake = join(
        dir,
        "choose-1111111111111111111111111111111111111111111111111111111111111111.json",
      );
      writeFileSync(
        fake,
        JSON.stringify({ schema: "bizra.dema.something_else.v0.1" }),
      );
      const r = await listChooseDecisions({ demaHome: home });
      assert.equal(r.count, 1);
      assert.equal(r.corruption_detected, true);
      assert.equal(r.entries[0].error, "wrong_schema");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("listChooseDecisions — boundary + freeze + no leaks", () => {
  it("envelope frozen with read-only boundary block", async () => {
    const home = freshHome();
    try {
      const r = await listChooseDecisions({ demaHome: home });
      assert.equal(Object.isFrozen(r), true);
      assert.equal(Object.isFrozen(r.entries), true);
      assert.equal(r.boundary.file_write_performed, false);
      assert.equal(r.boundary.network_used, false);
      assert.equal(r.boundary.federation_used, false);
      assert.equal(r.boundary.token_minted, false);
      assert.equal(r.boundary.poi_score_calculated, false);
      assert.equal(r.boundary.economic_claim_made, false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("no forbidden JSON keys in serialized envelope", async () => {
    const home = freshHome();
    try {
      await persistShare(home);
      const r = await listChooseDecisions({ demaHome: home });
      const json = JSON.stringify(r);
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

describe("dema urp choose list CLI", () => {
  it("--json on empty home emits count:0 envelope, exit 0", async () => {
    const home = freshHome();
    try {
      const r = await runCli(["urp", "choose", "list", "--json"], {
        demaHome: home,
      });
      assert.equal(r.exitCode, 0);
      const out = JSON.parse(r.stdout);
      assert.equal(out.schema, URP_CHOOSE_LIST_SCHEMA);
      assert.equal(out.count, 0);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("human output on empty home shows `(none)` + LOCAL ONLY warning", async () => {
    const home = freshHome();
    try {
      const r = await runCli(["urp", "choose", "list"], { demaHome: home });
      assert.equal(r.exitCode, 0);
      assert.match(r.stdout, /URP Choose Receipts: \(none\)/);
      assert.match(r.stdout, /LOCAL ONLY/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("CLI exits 1 when corruption is detected (tampered body)", async () => {
    const home = freshHome();
    try {
      const w = await persistShare(home);
      const body = JSON.parse(readFileSync(w.receipt_path, "utf8"));
      body.next_share_status = "TAMPERED";
      writeFileSync(w.receipt_path, JSON.stringify(body, null, 2));
      const r = await runCli(["urp", "choose", "list", "--json"], {
        demaHome: home,
      });
      assert.equal(r.exitCode, 1);
      const out = JSON.parse(r.stdout);
      assert.equal(out.corruption_detected, true);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("no forbidden JSON keys / no private key markers in CLI output", async () => {
    const home = freshHome();
    try {
      await persistShare(home);
      const r = await runCli(["urp", "choose", "list", "--json"], {
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
