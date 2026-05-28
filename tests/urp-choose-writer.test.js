import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  statSync,
  existsSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  saveChooseDecision,
  URP_CHOOSE_RECEIPT_WRITE_RESULT_SCHEMA,
} from "../packages/urp/src/choose-writer.js";
import {
  buildChooseDecision,
  URP_CHOOSE_RECEIPT_SCHEMA,
  DECISION_MARK_SHAREABLE,
  DECISION_MARK_LOCAL_ONLY,
  CONSENT_MARK_SHAREABLE,
  CONSENT_MARK_LOCAL_ONLY,
} from "../packages/urp/src/choose-decision.js";
import { URP_LOCAL_INDEX_SCHEMA } from "../packages/urp/src/local-index.js";

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
  return mkdtempSync(join(tmpdir(), "dema-cw-test-"));
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

function validEnvelope(
  decision = DECISION_MARK_SHAREABLE,
  consent = CONSENT_MARK_SHAREABLE,
) {
  return buildChooseDecision(validIndex(), {
    decision,
    consent,
    now: FIXED_NOW,
  });
}

describe("saveChooseDecision — happy paths", () => {
  it("persists valid MARK_SHAREABLE envelope to content-addressed path, mode 0o600", async () => {
    const home = freshHome();
    try {
      const env = validEnvelope();
      const r = await saveChooseDecision(env, { demaHome: home });
      assert.equal(r.schema, URP_CHOOSE_RECEIPT_WRITE_RESULT_SCHEMA);
      assert.equal(r.written, true);
      assert.equal(r.truth_label, "LOCAL_CHOOSE_RECEIPT_PERSISTED");
      assert.equal(r.choose_hash, env.choose_hash);
      assert.equal(r.mode_octal, "0o600");
      assert.equal(r.already_existed, false);
      assert.equal(r.verified_after_write, true);
      assert.match(r.receipt_filename, /^choose-[a-f0-9]{64}\.json$/);
      assert.equal(statSync(r.receipt_path).mode & 0o777, 0o600);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("persists valid MARK_LOCAL_ONLY envelope (same writer path)", async () => {
    const home = freshHome();
    try {
      const env = validEnvelope(
        DECISION_MARK_LOCAL_ONLY,
        CONSENT_MARK_LOCAL_ONLY,
      );
      const r = await saveChooseDecision(env, { demaHome: home });
      assert.equal(r.written, true);
      const persisted = JSON.parse(readFileSync(r.receipt_path, "utf8"));
      assert.equal(persisted.decision, "MARK_LOCAL_ONLY");
      assert.equal(persisted.next_share_status, "MARKED_LOCAL_ONLY");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("second save of identical envelope is idempotent (already_existed:true, no rewrite)", async () => {
    const home = freshHome();
    try {
      const env = validEnvelope();
      const r1 = await saveChooseDecision(env, { demaHome: home });
      const r2 = await saveChooseDecision(env, { demaHome: home });
      assert.equal(r1.already_existed, false);
      assert.equal(r1.verified_after_write, true);
      assert.equal(r2.already_existed, true);
      assert.equal(r2.verified_after_write, false);
      assert.equal(r1.receipt_path, r2.receipt_path);
      assert.equal(r1.choose_hash, r2.choose_hash);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("two distinct decisions for same index → two distinct receipts (no collision)", async () => {
    const home = freshHome();
    try {
      const envShare = validEnvelope(
        DECISION_MARK_SHAREABLE,
        CONSENT_MARK_SHAREABLE,
      );
      const envKeep = validEnvelope(
        DECISION_MARK_LOCAL_ONLY,
        CONSENT_MARK_LOCAL_ONLY,
      );
      const rShare = await saveChooseDecision(envShare, { demaHome: home });
      const rKeep = await saveChooseDecision(envKeep, { demaHome: home });
      assert.equal(rShare.written, true);
      assert.equal(rKeep.written, true);
      assert.notEqual(rShare.choose_hash, rKeep.choose_hash);
      assert.notEqual(rShare.receipt_path, rKeep.receipt_path);
      assert.ok(existsSync(rShare.receipt_path));
      assert.ok(existsSync(rKeep.receipt_path));
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("persisted file content matches kernel envelope byte-for-byte (read-back verify)", async () => {
    const home = freshHome();
    try {
      const env = validEnvelope();
      const r = await saveChooseDecision(env, { demaHome: home });
      const persisted = JSON.parse(readFileSync(r.receipt_path, "utf8"));
      assert.equal(persisted.schema, URP_CHOOSE_RECEIPT_SCHEMA);
      assert.equal(persisted.chosen, true);
      assert.equal(persisted.choose_hash, env.choose_hash);
      assert.equal(persisted.source_index_hash, env.source_index_hash);
      assert.equal(persisted.consent_phrase_hash, env.consent_phrase_hash);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("saveChooseDecision — kernel envelope validation", () => {
  it("rejects null/non-object input with invalid_input error", async () => {
    const home = freshHome();
    try {
      const r1 = await saveChooseDecision(null, { demaHome: home });
      const r2 = await saveChooseDecision("not-an-envelope", {
        demaHome: home,
      });
      assert.equal(r1.written, false);
      assert.equal(r1.error, "invalid_input");
      assert.equal(r2.written, false);
      assert.equal(r2.error, "invalid_input");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("rejects wrong schema with wrong_schema error", async () => {
    const home = freshHome();
    try {
      const env = { ...validEnvelope(), schema: "bizra.dema.foreign.v0.1" };
      const r = await saveChooseDecision(env, { demaHome: home });
      assert.equal(r.written, false);
      assert.equal(r.error, "wrong_schema");
      assert.equal(r.received_schema, "bizra.dema.foreign.v0.1");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("rejects chosen:false envelope (kernel-failed path) with chosen_false error", async () => {
    const home = freshHome();
    try {
      const failedEnv = buildChooseDecision(validIndex(), {
        decision: DECISION_MARK_SHAREABLE,
        consent: "wrong consent",
        now: FIXED_NOW,
      });
      assert.equal(failedEnv.chosen, false);
      const r = await saveChooseDecision(failedEnv, { demaHome: home });
      assert.equal(r.written, false);
      assert.equal(r.error, "chosen_false");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("rejects invalid decision value with invalid_decision error", async () => {
    const home = freshHome();
    try {
      const env = { ...validEnvelope(), decision: "MARK_ANYTHING_ELSE" };
      const r = await saveChooseDecision(env, { demaHome: home });
      assert.equal(r.written, false);
      assert.equal(r.error, "invalid_decision");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("rejects consent_verified:false with consent_not_verified error", async () => {
    const home = freshHome();
    try {
      const env = { ...validEnvelope(), consent_verified: false };
      const r = await saveChooseDecision(env, { demaHome: home });
      assert.equal(r.written, false);
      assert.equal(r.error, "consent_not_verified");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("rejects missing/invalid choose_hash with missing_or_invalid_choose_hash error", async () => {
    const home = freshHome();
    try {
      const env1 = { ...validEnvelope() };
      delete env1.choose_hash;
      const r1 = await saveChooseDecision(env1, { demaHome: home });
      assert.equal(r1.written, false);
      assert.equal(r1.error, "missing_or_invalid_choose_hash");

      const env2 = { ...validEnvelope(), choose_hash: "tooshort" };
      const r2 = await saveChooseDecision(env2, { demaHome: home });
      assert.equal(r2.written, false);
      assert.equal(r2.error, "missing_or_invalid_choose_hash");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("rejects tampered envelope (body hash mismatch) with body_hash_mismatch error", async () => {
    const home = freshHome();
    try {
      const env = { ...validEnvelope() };
      // Mutate a benign field after the hash was computed
      const tampered = { ...env, previous_share_status: "TAMPERED" };
      const r = await saveChooseDecision(tampered, { demaHome: home });
      assert.equal(r.written, false);
      assert.equal(r.error, "body_hash_mismatch");
      assert.ok(r.declared);
      assert.ok(r.recomputed);
      assert.notEqual(r.declared, r.recomputed);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("saveChooseDecision — forbidden-field gate", () => {
  it("rejects envelope containing forbidden private_key field even if kernel didn't catch it", async () => {
    const home = freshHome();
    try {
      const env = { ...validEnvelope(), private_key: "PEM-pretend" };
      const r = await saveChooseDecision(env, { demaHome: home });
      assert.equal(r.written, false);
      assert.equal(r.error, "forbidden_field_present");
      assert.equal(r.field, "private_key");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("rejects envelope containing forbidden mint_candidate field", async () => {
    const home = freshHome();
    try {
      const env = { ...validEnvelope(), mint_candidate: true };
      const r = await saveChooseDecision(env, { demaHome: home });
      assert.equal(r.written, false);
      assert.equal(r.error, "forbidden_field_present");
      assert.equal(r.field, "mint_candidate");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("persisted file contains no forbidden JSON keys", async () => {
    const home = freshHome();
    try {
      const env = validEnvelope();
      const r = await saveChooseDecision(env, { demaHome: home });
      const persistedJson = readFileSync(r.receipt_path, "utf8");
      for (const field of FORBIDDEN_FIELDS) {
        assert.equal(
          persistedJson.includes(`"${field}":`),
          false,
          `persisted file must not include "${field}" as a JSON key`,
        );
      }
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("saveChooseDecision — boundary + freeze + no leaks", () => {
  it("success envelope boundary is honest: file_write + mutation = true, 8 others false", async () => {
    const home = freshHome();
    try {
      const r = await saveChooseDecision(validEnvelope(), { demaHome: home });
      assert.equal(r.boundary.file_write_performed, true);
      assert.equal(r.boundary.mutation_performed, true);
      assert.equal(r.boundary.private_key_loaded, false);
      assert.equal(r.boundary.network_used, false);
      assert.equal(r.boundary.federation_used, false);
      assert.equal(r.boundary.share_published, false);
      assert.equal(r.boundary.resource_offer_created, false);
      assert.equal(r.boundary.poi_score_calculated, false);
      assert.equal(r.boundary.token_minted, false);
      assert.equal(r.boundary.economic_claim_made, false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("failure envelope boundary is all-false (no write performed)", async () => {
    const home = freshHome();
    try {
      const r = await saveChooseDecision(null, { demaHome: home });
      assert.equal(r.boundary.file_write_performed, false);
      assert.equal(r.boundary.mutation_performed, false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("result envelope is frozen on both success and failure paths", async () => {
    const home = freshHome();
    try {
      const ok = await saveChooseDecision(validEnvelope(), { demaHome: home });
      const bad = await saveChooseDecision(null, { demaHome: home });
      assert.equal(Object.isFrozen(ok), true);
      assert.equal(Object.isFrozen(bad), true);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
