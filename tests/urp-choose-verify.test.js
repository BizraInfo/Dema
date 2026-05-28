import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join, dirname, resolve, basename } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  verifyChooseReceiptFile,
  URP_CHOOSE_VERIFY_RESULT_SCHEMA,
} from "../packages/urp/src/choose-verify.js";
import {
  buildChooseDecision,
  URP_CHOOSE_RECEIPT_SCHEMA,
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

function freshHome() {
  return mkdtempSync(join(tmpdir(), "dema-ucv-test-"));
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

async function persistOne(home, decision = DECISION_MARK_SHAREABLE) {
  const consent =
    decision === DECISION_MARK_SHAREABLE
      ? CONSENT_MARK_SHAREABLE
      : CONSENT_MARK_LOCAL_ONLY;
  const env = buildChooseDecision(validIndex(), {
    decision,
    consent,
    now: FIXED_NOW,
  });
  return saveChooseDecision(env, { demaHome: home });
}

describe("verifyChooseReceiptFile — happy paths", () => {
  it("VERIFIED on freshly-persisted canonical choose receipt", async () => {
    const home = freshHome();
    try {
      const w = await persistOne(home);
      const r = await verifyChooseReceiptFile(w.receipt_path);
      assert.equal(r.schema, URP_CHOOSE_VERIFY_RESULT_SCHEMA);
      assert.equal(r.verified, true);
      assert.equal(r.verdict, "VERIFIED");
      assert.equal(r.truth_label, "LOCAL_CHOOSE_RECEIPT_FILE_VERIFIED");
      assert.equal(r.filename_hash_matches, true);
      assert.equal(r.body_hash_intact, true);
      assert.equal(r.decision, "MARK_SHAREABLE");
      assert.equal(r.previous_share_status, "MARKED_LOCAL_ONLY");
      assert.equal(r.next_share_status, "CANDIDATE_SHAREABLE");
      assert.equal(r.consent_verified, true);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("VERIFIED on MARK_LOCAL_ONLY receipt", async () => {
    const home = freshHome();
    try {
      const w = await persistOne(home, DECISION_MARK_LOCAL_ONLY);
      const r = await verifyChooseReceiptFile(w.receipt_path);
      assert.equal(r.verified, true);
      assert.equal(r.decision, "MARK_LOCAL_ONLY");
      assert.equal(r.next_share_status, "MARKED_LOCAL_ONLY");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("non-canonical filename: VERIFIED with filename_hash_matches:null", async () => {
    const home = freshHome();
    try {
      const w = await persistOne(home);
      const renamed = join(home, "renamed-out-of-pattern.json");
      writeFileSync(renamed, readFileSync(w.receipt_path));
      const r = await verifyChooseReceiptFile(renamed);
      assert.equal(r.verified, true);
      assert.equal(r.filename_hash_matches, null);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("verifyChooseReceiptFile — validation fail-fast layers", () => {
  it("missing_path on empty/undefined input", async () => {
    const r1 = await verifyChooseReceiptFile("");
    const r2 = await verifyChooseReceiptFile(undefined);
    assert.equal(r1.verified, false);
    assert.equal(r1.error, "missing_path");
    assert.equal(r2.verified, false);
    assert.equal(r2.error, "missing_path");
  });

  it("cannot_read_file on nonexistent path", async () => {
    const r = await verifyChooseReceiptFile("/tmp/definitely-not-here.json");
    assert.equal(r.verified, false);
    assert.equal(r.error, "cannot_read_file");
  });

  it("invalid_json on malformed file", async () => {
    const home = freshHome();
    try {
      const bad = join(home, "bad.json");
      writeFileSync(bad, "{not json");
      const r = await verifyChooseReceiptFile(bad);
      assert.equal(r.verified, false);
      assert.equal(r.error, "invalid_json");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("wrong_schema on foreign schema content", async () => {
    const home = freshHome();
    try {
      const bad = join(home, "x.json");
      writeFileSync(
        bad,
        JSON.stringify({ schema: "bizra.dema.something_else.v0.1" }),
      );
      const r = await verifyChooseReceiptFile(bad);
      assert.equal(r.verified, false);
      assert.equal(r.error, "wrong_schema");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("chosen_false on envelope where chosen:false", async () => {
    const home = freshHome();
    try {
      const bad = join(home, "x.json");
      writeFileSync(
        bad,
        JSON.stringify({ schema: URP_CHOOSE_RECEIPT_SCHEMA, chosen: false }),
      );
      const r = await verifyChooseReceiptFile(bad);
      assert.equal(r.verified, false);
      assert.equal(r.error, "chosen_false");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("invalid_decision on invalid decision value", async () => {
    const home = freshHome();
    try {
      const bad = join(home, "x.json");
      writeFileSync(
        bad,
        JSON.stringify({
          schema: URP_CHOOSE_RECEIPT_SCHEMA,
          chosen: true,
          decision: "MARK_ANYTHING_ELSE",
        }),
      );
      const r = await verifyChooseReceiptFile(bad);
      assert.equal(r.verified, false);
      assert.equal(r.error, "invalid_decision");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("consent_not_verified on consent_verified:false", async () => {
    const home = freshHome();
    try {
      const bad = join(home, "x.json");
      writeFileSync(
        bad,
        JSON.stringify({
          schema: URP_CHOOSE_RECEIPT_SCHEMA,
          chosen: true,
          decision: "MARK_SHAREABLE",
          consent_verified: false,
        }),
      );
      const r = await verifyChooseReceiptFile(bad);
      assert.equal(r.verified, false);
      assert.equal(r.error, "consent_not_verified");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("body_hash_mismatch on tampered persisted receipt", async () => {
    const home = freshHome();
    try {
      const w = await persistOne(home);
      const body = JSON.parse(readFileSync(w.receipt_path, "utf8"));
      body.next_share_status = "TAMPERED";
      writeFileSync(w.receipt_path, JSON.stringify(body, null, 2));
      const r = await verifyChooseReceiptFile(w.receipt_path);
      assert.equal(r.verified, false);
      assert.equal(r.error, "body_hash_mismatch");
      assert.ok(r.declared && r.recomputed);
      assert.notEqual(r.declared, r.recomputed);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("filename_hash_mismatch on renamed file with canonical pattern but wrong hash", async () => {
    const home = freshHome();
    try {
      const w = await persistOne(home);
      const dir = dirname(w.receipt_path);
      const fake = join(
        dir,
        "choose-0000000000000000000000000000000000000000000000000000000000000000.json",
      );
      writeFileSync(fake, readFileSync(w.receipt_path));
      const r = await verifyChooseReceiptFile(fake);
      assert.equal(r.verified, false);
      assert.equal(r.error, "filename_hash_mismatch");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("verifyChooseReceiptFile — forbidden-field gate (BEFORE hash check)", () => {
  it("forbidden_field_present FIRES BEFORE body_hash_mismatch (kernel-tampered-to-leak takes priority)", async () => {
    const home = freshHome();
    try {
      const w = await persistOne(home);
      const body = JSON.parse(readFileSync(w.receipt_path, "utf8"));
      body.private_key = "PEM-pretend";
      writeFileSync(w.receipt_path, JSON.stringify(body, null, 2));
      const r = await verifyChooseReceiptFile(w.receipt_path);
      assert.equal(r.verified, false);
      // CRITICAL: must be forbidden_field_present, NOT body_hash_mismatch
      // (per writer-forbidden-field-check-before-hash-recompute discipline)
      assert.equal(r.error, "forbidden_field_present");
      assert.equal(r.field, "private_key");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("forbidden mint_candidate detected with semantic error", async () => {
    const home = freshHome();
    try {
      const w = await persistOne(home);
      const body = JSON.parse(readFileSync(w.receipt_path, "utf8"));
      body.mint_candidate = true;
      writeFileSync(w.receipt_path, JSON.stringify(body, null, 2));
      const r = await verifyChooseReceiptFile(w.receipt_path);
      assert.equal(r.error, "forbidden_field_present");
      assert.equal(r.field, "mint_candidate");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("verifyChooseReceiptFile — boundary + freeze + no leaks", () => {
  it("envelope frozen on both VERIFIED and FAILED paths", async () => {
    const home = freshHome();
    try {
      const w = await persistOne(home);
      const ok = await verifyChooseReceiptFile(w.receipt_path);
      const bad = await verifyChooseReceiptFile("/nonexistent.json");
      assert.equal(Object.isFrozen(ok), true);
      assert.equal(Object.isFrozen(bad), true);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("success boundary: file_read:true + write/mutation false + all economic flags false", async () => {
    const home = freshHome();
    try {
      const w = await persistOne(home);
      const r = await verifyChooseReceiptFile(w.receipt_path);
      assert.equal(r.boundary.file_read_performed, true);
      assert.equal(r.boundary.file_write_performed, false);
      assert.equal(r.boundary.mutation_performed, false);
      assert.equal(r.boundary.network_used, false);
      assert.equal(r.boundary.federation_used, false);
      assert.equal(r.boundary.token_minted, false);
      assert.equal(r.boundary.poi_score_calculated, false);
      assert.equal(r.boundary.economic_claim_made, false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("dema urp choose verify CLI", () => {
  it("missing path exits 1 with usage on stderr", async () => {
    const home = freshHome();
    try {
      const r = await runCli(["urp", "choose", "verify"], { demaHome: home });
      assert.equal(r.exitCode, 1);
      assert.match(
        r.stderr,
        /Usage: dema urp choose verify <choose-receipt\.json>/,
      );
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("VERIFIED file exits 0 + --json includes schema/decision/transition", async () => {
    const home = freshHome();
    try {
      const w = await persistOne(home);
      const r = await runCli(
        ["urp", "choose", "verify", w.receipt_path, "--json"],
        {
          demaHome: home,
        },
      );
      assert.equal(r.exitCode, 0);
      const out = JSON.parse(r.stdout);
      assert.equal(out.verdict, "VERIFIED");
      assert.equal(out.decision, "MARK_SHAREABLE");
      assert.equal(out.next_share_status, "CANDIDATE_SHAREABLE");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("--no-color human output includes VERIFIED + LOCAL ONLY warning", async () => {
    const home = freshHome();
    try {
      const w = await persistOne(home);
      const r = await runCli(["urp", "choose", "verify", w.receipt_path], {
        demaHome: home,
      });
      assert.equal(r.exitCode, 0);
      assert.match(r.stdout, /URP Choose Verify: VERIFIED/);
      assert.match(r.stdout, /LOCAL ONLY/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
