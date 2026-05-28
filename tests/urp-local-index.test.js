import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  buildUrpLocalIndex,
  URP_LOCAL_INDEX_SCHEMA,
  URP_LOCAL_INDEX_RESULT_SCHEMA,
} from "../packages/urp/src/local-index.js";
import { buildProofPassport } from "../packages/receipts/src/proof-passport.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import {
  signArtifact,
  SIGN_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-sign-command.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXED_NOW = new Date("2026-05-28T12:00:00Z");

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
  return mkdtempSync(join(tmpdir(), "dema-urp-index-"));
}

async function homeWithSignedPassport() {
  const home = freshHome();
  const old = process.env.DEMA_HOME;
  process.env.DEMA_HOME = home;
  await initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE,
    demaHome: home,
  });
  const artifact = join(home, "urp-test-artifact.txt");
  writeFileSync(artifact, "urp index test content");
  await signArtifact({
    artifactPath: artifact,
    consent: SIGN_CONSENT_PHRASE,
    demaHome: home,
  });
  const passport = await buildProofPassport(home);
  return {
    home,
    passport,
    receiptsDir: join(home, "receipts"),
    restore: () => {
      if (old) process.env.DEMA_HOME = old;
      else delete process.env.DEMA_HOME;
    },
  };
}

describe("buildUrpLocalIndex", () => {
  it("returns indexed object on valid deep-verified passport", async () => {
    const { passport, receiptsDir, restore } = await homeWithSignedPassport();
    try {
      const result = await buildUrpLocalIndex(passport, {
        receiptsDir,
        now: FIXED_NOW,
      });
      assert.equal(result.schema, URP_LOCAL_INDEX_RESULT_SCHEMA);
      assert.equal(result.indexed, true);
      assert.equal(result.index.schema, URP_LOCAL_INDEX_SCHEMA);
      assert.equal(result.index.receipts_count, 1);
      assert.equal(result.index.entries.length, 1);
    } finally {
      restore();
    }
  });

  it("returns indexed:false when deep verification fails", async () => {
    const result = await buildUrpLocalIndex(
      { schema: "not.real" },
      {
        receiptsDir: "/nonexistent",
        now: FIXED_NOW,
      },
    );
    assert.equal(result.indexed, false);
    assert.equal(result.error, "deep_verification_failed");
    assert.equal(result.schema, URP_LOCAL_INDEX_RESULT_SCHEMA);
    assert.equal(result.index, undefined);
  });

  it("empty deep-verified passport returns empty local index, not mint/share claim", async () => {
    const home = freshHome();
    const passport = await buildProofPassport(home);
    const result = await buildUrpLocalIndex(passport, {
      receiptsDir: join(home, "receipts"),
      now: FIXED_NOW,
    });
    assert.equal(result.indexed, true);
    assert.equal(result.index.receipts_count, 0);
    assert.equal(result.index.entries.length, 0);
    assert.equal(result.index.share_status, "MARKED_LOCAL_ONLY");
    const json = JSON.stringify(result);
    for (const field of FORBIDDEN_FIELDS) {
      assert.ok(
        !json.includes(`"${field}":`),
        `forbidden field appeared: ${field}`,
      );
    }
  });

  it("index_hash is deterministic with fixed now", async () => {
    const { passport, receiptsDir, restore } = await homeWithSignedPassport();
    try {
      const a = await buildUrpLocalIndex(passport, {
        receiptsDir,
        now: FIXED_NOW,
      });
      const b = await buildUrpLocalIndex(passport, {
        receiptsDir,
        now: new Date("2099-01-01T00:00:00Z"),
      });
      assert.equal(a.index.index_hash, b.index.index_hash);
      assert.notEqual(a.index.indexed_at_iso, b.index.indexed_at_iso);
    } finally {
      restore();
    }
  });

  it("resource_class is WORK_ARTIFACT", async () => {
    const { passport, receiptsDir, restore } = await homeWithSignedPassport();
    try {
      const result = await buildUrpLocalIndex(passport, {
        receiptsDir,
        now: FIXED_NOW,
      });
      assert.equal(result.index.resource_class, "WORK_ARTIFACT");
    } finally {
      restore();
    }
  });

  it("awareness_level is A2_METADATA", async () => {
    const { passport, receiptsDir, restore } = await homeWithSignedPassport();
    try {
      const result = await buildUrpLocalIndex(passport, {
        receiptsDir,
        now: FIXED_NOW,
      });
      assert.equal(result.index.awareness_level, "A2_METADATA");
    } finally {
      restore();
    }
  });

  it("share_status is MARKED_LOCAL_ONLY", async () => {
    const { passport, receiptsDir, restore } = await homeWithSignedPassport();
    try {
      const result = await buildUrpLocalIndex(passport, {
        receiptsDir,
        now: FIXED_NOW,
      });
      assert.equal(result.index.share_status, "MARKED_LOCAL_ONLY");
    } finally {
      restore();
    }
  });

  it("mode is LOCAL_INDEX_ONLY and truth_label is LOCAL_VERIFIED_RESOURCE_INDEX", async () => {
    const { passport, receiptsDir, restore } = await homeWithSignedPassport();
    try {
      const result = await buildUrpLocalIndex(passport, {
        receiptsDir,
        now: FIXED_NOW,
      });
      assert.equal(result.index.mode, "LOCAL_INDEX_ONLY");
      assert.equal(result.index.truth_label, "LOCAL_VERIFIED_RESOURCE_INDEX");
      assert.equal(
        result.index.verification_scope,
        "PASSPORT_ENVELOPE_AND_RECEIPTS",
      );
    } finally {
      restore();
    }
  });

  it("no private key material appears in result", async () => {
    const { passport, receiptsDir, restore } = await homeWithSignedPassport();
    try {
      const result = await buildUrpLocalIndex(passport, {
        receiptsDir,
        now: FIXED_NOW,
      });
      const json = JSON.stringify(result);
      assert.ok(!json.includes("BEGIN PRIVATE KEY"));
      assert.ok(!json.includes("private_key_pem"));
    } finally {
      restore();
    }
  });

  it("no raw artifact content appears in result", async () => {
    const { passport, receiptsDir, restore } = await homeWithSignedPassport();
    try {
      const result = await buildUrpLocalIndex(passport, {
        receiptsDir,
        now: FIXED_NOW,
      });
      const json = JSON.stringify(result);
      assert.ok(!json.includes("urp index test content"));
    } finally {
      restore();
    }
  });

  it("no forbidden economic/token/federation fields appear", async () => {
    const { passport, receiptsDir, restore } = await homeWithSignedPassport();
    try {
      const result = await buildUrpLocalIndex(passport, {
        receiptsDir,
        now: FIXED_NOW,
      });
      const json = JSON.stringify(result);
      for (const field of FORBIDDEN_FIELDS) {
        assert.ok(
          !json.includes(`"${field}":`),
          `forbidden field appeared: ${field}`,
        );
      }
    } finally {
      restore();
    }
  });

  it("boundary flags are correct on success", async () => {
    const { passport, receiptsDir, restore } = await homeWithSignedPassport();
    try {
      const result = await buildUrpLocalIndex(passport, {
        receiptsDir,
        now: FIXED_NOW,
      });
      assert.equal(result.boundary.private_key_loaded, false);
      assert.equal(result.boundary.file_write_performed, false);
      assert.equal(result.boundary.raw_artifact_included, false);
      assert.equal(result.boundary.full_receipt_json_included, false);
      assert.equal(result.boundary.personal_memory_included, false);
      assert.equal(result.boundary.network_used, false);
      assert.equal(result.boundary.federation_used, false);
      assert.equal(result.boundary.token_minted, false);
      assert.equal(result.boundary.poi_score_calculated, false);
      assert.equal(result.boundary.economic_claim_made, false);
    } finally {
      restore();
    }
  });

  it("result and index are frozen", async () => {
    const { passport, receiptsDir, restore } = await homeWithSignedPassport();
    try {
      const result = await buildUrpLocalIndex(passport, {
        receiptsDir,
        now: FIXED_NOW,
      });
      assert.ok(Object.isFrozen(result));
      assert.ok(Object.isFrozen(result.index));
      assert.ok(Object.isFrozen(result.index.entries));
      assert.ok(Object.isFrozen(result.boundary));
    } finally {
      restore();
    }
  });
});
