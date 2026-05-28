import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  statSync,
  existsSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  saveUrpLocalIndex,
  URP_INDEX_WRITE_RESULT_SCHEMA,
} from "../packages/urp/src/local-index-writer.js";
import { buildUrpLocalIndex } from "../packages/urp/src/local-index.js";
import { buildProofPassport } from "../packages/receipts/src/proof-passport.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import {
  signArtifact,
  SIGN_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-sign-command.js";

const FIXED_NOW = new Date("2026-05-28T12:00:00Z");

function freshHome() {
  return mkdtempSync(join(tmpdir(), "dema-urp-writer-"));
}

async function buildValidIndex() {
  const home = freshHome();
  const old = process.env.DEMA_HOME;
  process.env.DEMA_HOME = home;
  await initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE,
    demaHome: home,
  });
  const artifact = join(home, "urp-write-artifact.txt");
  writeFileSync(artifact, "urp writer content");
  await signArtifact({
    artifactPath: artifact,
    consent: SIGN_CONSENT_PHRASE,
    demaHome: home,
  });
  const passport = await buildProofPassport(home);
  const indexResult = await buildUrpLocalIndex(passport, {
    receiptsDir: join(home, "receipts"),
    now: FIXED_NOW,
  });
  return {
    home,
    indexResult,
    restore: () => {
      if (old) process.env.DEMA_HOME = old;
      else delete process.env.DEMA_HOME;
    },
  };
}

describe("saveUrpLocalIndex", () => {
  it("writes content-addressed file from valid index", async () => {
    const { home, indexResult, restore } = await buildValidIndex();
    try {
      const result = await saveUrpLocalIndex(indexResult, { demaHome: home });
      assert.equal(result.schema, URP_INDEX_WRITE_RESULT_SCHEMA);
      assert.equal(result.written, true);
      assert.match(result.index_path, /urp-index-[a-f0-9]{64}\.json$/);
      assert.ok(existsSync(result.index_path));
      assert.match(result.index_hash, /^[a-f0-9]{64}$/);
    } finally {
      restore();
    }
  });

  it("file mode is 0o600", async () => {
    const { home, indexResult, restore } = await buildValidIndex();
    try {
      const result = await saveUrpLocalIndex(indexResult, { demaHome: home });
      const mode = statSync(result.index_path).mode & 0o777;
      assert.equal(mode, 0o600);
      assert.equal(result.mode_octal, "0o600");
    } finally {
      restore();
    }
  });

  it("read-back hash matches index_hash", async () => {
    const { home, indexResult, restore } = await buildValidIndex();
    try {
      const result = await saveUrpLocalIndex(indexResult, { demaHome: home });
      assert.equal(result.verified_after_write, true);
      const persisted = JSON.parse(readFileSync(result.index_path, "utf8"));
      assert.equal(persisted.index_hash, result.index_hash);
    } finally {
      restore();
    }
  });

  it("rejects indexed:false result envelope", async () => {
    const home = freshHome();
    const result = await saveUrpLocalIndex(
      {
        schema: "bizra.dema.urp_local_index_result.v0.1",
        indexed: false,
        error: "deep_verification_failed",
      },
      { demaHome: home },
    );
    assert.equal(result.written, false);
    assert.equal(result.error, "indexed_false_envelope");
  });

  it("rejects wrong schema", async () => {
    const home = freshHome();
    const result = await saveUrpLocalIndex(
      { schema: "not.real", mode: "LOCAL_INDEX_ONLY" },
      { demaHome: home },
    );
    assert.equal(result.written, false);
    assert.equal(result.error, "wrong_schema");
  });

  it("rejects private_key field", async () => {
    const { home, indexResult, restore } = await buildValidIndex();
    try {
      const malicious = {
        ...indexResult.index,
        private_key: "fake-pem",
      };
      const result = await saveUrpLocalIndex(malicious, { demaHome: home });
      assert.equal(result.written, false);
      assert.equal(result.error, "forbidden_field_present");
    } finally {
      restore();
    }
  });

  it("rejects token/economic field", async () => {
    const { home, indexResult, restore } = await buildValidIndex();
    try {
      const malicious = {
        ...indexResult.index,
        mint_candidate: true,
      };
      const result = await saveUrpLocalIndex(malicious, { demaHome: home });
      assert.equal(result.written, false);
      assert.equal(result.error, "forbidden_field_present");
      assert.equal(result.field, "mint_candidate");
    } finally {
      restore();
    }
  });

  it("persisted file contains no raw artifact content", async () => {
    const { home, indexResult, restore } = await buildValidIndex();
    try {
      const result = await saveUrpLocalIndex(indexResult, { demaHome: home });
      const persisted = readFileSync(result.index_path, "utf8");
      assert.ok(!persisted.includes("urp writer content"));
    } finally {
      restore();
    }
  });

  it("persisted file contains no full receipt JSON or private key", async () => {
    const { home, indexResult, restore } = await buildValidIndex();
    try {
      const result = await saveUrpLocalIndex(indexResult, { demaHome: home });
      const persisted = readFileSync(result.index_path, "utf8");
      assert.ok(!persisted.includes("BEGIN PRIVATE KEY"));
      assert.ok(!persisted.includes("private_key_pem"));
      assert.ok(!persisted.includes('"full_receipt_json":'));
    } finally {
      restore();
    }
  });

  it("boundary flags are correct on success", async () => {
    const { home, indexResult, restore } = await buildValidIndex();
    try {
      const result = await saveUrpLocalIndex(indexResult, { demaHome: home });
      assert.equal(result.boundary.file_write_performed, true);
      assert.equal(result.boundary.private_key_loaded, false);
      assert.equal(result.boundary.raw_artifact_included, false);
      assert.equal(result.boundary.full_receipt_json_included, false);
      assert.equal(result.boundary.network_used, false);
      assert.equal(result.boundary.federation_used, false);
      assert.equal(result.boundary.token_minted, false);
      assert.equal(result.boundary.poi_score_calculated, false);
      assert.equal(result.boundary.economic_claim_made, false);
    } finally {
      restore();
    }
  });

  it("boundary flags are correct on failure (no file write)", async () => {
    const home = freshHome();
    const result = await saveUrpLocalIndex(
      { schema: "not.real" },
      { demaHome: home },
    );
    assert.equal(result.boundary.file_write_performed, false);
  });

  it("rejects hash_mismatch when declared index_hash diverges", async () => {
    const { home, indexResult, restore } = await buildValidIndex();
    try {
      const tampered = {
        ...indexResult.index,
        index_hash: "0".repeat(64),
      };
      const result = await saveUrpLocalIndex(tampered, { demaHome: home });
      assert.equal(result.written, false);
      assert.equal(result.error, "hash_mismatch");
    } finally {
      restore();
    }
  });
});
