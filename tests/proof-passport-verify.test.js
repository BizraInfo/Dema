import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import {
  verifyProofPassport,
  verifyProofPassportFile,
  formatProofPassportVerification,
  PASSPORT_VERIFY_SCHEMA,
} from "../packages/receipts/src/proof-passport-verify.js";
import {
  buildProofPassport,
  PROOF_PASSPORT_SCHEMA,
} from "../packages/receipts/src/proof-passport.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import {
  signArtifact,
  SIGN_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-sign-command.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(REPO_ROOT, "apps/cli/src/index.js");
const ENV = {
  ...process.env,
  NO_COLOR: "1",
  NODE_ENV: "test",
  DEMA_NO_TUI: "1",
};

function freshHome() {
  return mkdtempSync(join(tmpdir(), "dema-passport-verify-"));
}

async function homeWithPassport() {
  const home = freshHome();
  const old = process.env.DEMA_HOME;
  process.env.DEMA_HOME = home;
  await initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE,
    demaHome: home,
  });
  const artifact = join(home, "artifact.txt");
  writeFileSync(artifact, "verify-passport test");
  await signArtifact({
    artifactPath: artifact,
    consent: SIGN_CONSENT_PHRASE,
    demaHome: home,
  });
  const passport = await buildProofPassport(home);
  const passportPath = join(home, "passport.json");
  writeFileSync(passportPath, JSON.stringify(passport, null, 2));
  return {
    home,
    passport,
    passportPath,
    restore: () => {
      if (old) process.env.DEMA_HOME = old;
      else delete process.env.DEMA_HOME;
    },
  };
}

describe("verifyProofPassport", () => {
  it("fails on null input", () => {
    const result = verifyProofPassport(null);
    assert.equal(result.schema, PASSPORT_VERIFY_SCHEMA);
    assert.equal(result.verified, false);
  });

  it("verifies a valid passport", async () => {
    const { passport, restore } = await homeWithPassport();
    try {
      const result = verifyProofPassport(passport);
      assert.equal(result.verified, true);
      assert.equal(result.verdict, "VERIFIED");
      assert.ok(result.checks.every((c) => c.pass));
    } finally {
      restore();
    }
  });

  it("fails on wrong schema", () => {
    const result = verifyProofPassport({
      schema: "wrong.schema",
      passport_hash: "x",
      generated_at: new Date().toISOString(),
    });
    assert.equal(result.verified, false);
    assert.ok(
      result.checks.some((c) => c.name === "schema_matches" && !c.pass),
    );
  });

  it("fails when passport_hash is tampered", async () => {
    const { passport, restore } = await homeWithPassport();
    try {
      const tampered = { ...passport, passport_hash: "0".repeat(64) };
      const result = verifyProofPassport(tampered);
      assert.equal(result.verified, false);
      assert.ok(
        result.checks.some(
          (c) => c.name === "passport_hash_matches" && !c.pass,
        ),
      );
    } finally {
      restore();
    }
  });

  it("fails when receipts array is tampered (hash mismatch)", async () => {
    const { passport, restore } = await homeWithPassport();
    try {
      const tampered = {
        ...passport,
        receipts: [
          ...passport.receipts,
          {
            type: "authorship",
            receipt_filename: "fake.json",
            verdict: "VERIFIED",
          },
        ],
      };
      const result = verifyProofPassport(tampered);
      assert.equal(result.verified, false);
    } finally {
      restore();
    }
  });

  it("fails when boundary flag is wrong", async () => {
    const { passport, restore } = await homeWithPassport();
    try {
      const tampered = {
        ...passport,
        boundary: { ...passport.boundary, network_used: true },
      };
      const result = verifyProofPassport(tampered);
      assert.equal(result.verified, false);
      assert.ok(
        result.checks.some((c) => c.name === "boundary_canonical" && !c.pass),
      );
    } finally {
      restore();
    }
  });

  it("rejects passport with private key material", () => {
    const result = verifyProofPassport({
      schema: PROOF_PASSPORT_SCHEMA,
      passport_hash: "0".repeat(64),
      generated_at: new Date().toISOString(),
      private_key_pem: "-----BEGIN PRIVATE KEY-----\n",
      boundary: {
        passport_signed: false,
        private_key_loaded: false,
        network_used: false,
        federation_used: false,
        token_minted: false,
        legal_identity_asserted: false,
        production_claimed: false,
        receipt_content_included: false,
      },
      receipts: [],
      aggregate: {
        total_receipts: 0,
        verified_count: 0,
        failed_count: 0,
        verdict: "EMPTY",
      },
      truth_label: "LOCAL_PROOF_PASSPORT_EMPTY",
    });
    assert.equal(result.verified, false);
    assert.ok(
      result.checks.some(
        (c) => c.name === "no_private_key_material" && !c.pass,
      ),
    );
  });

  it("fails when aggregate counts disagree with receipts array", async () => {
    const { passport, restore } = await homeWithPassport();
    try {
      const tampered = {
        ...passport,
        aggregate: { ...passport.aggregate, verified_count: 999 },
      };
      const result = verifyProofPassport(tampered);
      assert.equal(result.verified, false);
    } finally {
      restore();
    }
  });

  it("verifier itself does not mutate or touch network", async () => {
    const { passport, restore } = await homeWithPassport();
    try {
      const result = verifyProofPassport(passport);
      assert.equal(result.boundary.network_used, false);
      assert.equal(result.boundary.federation_used, false);
      assert.equal(result.boundary.receipt_mutated, false);
      assert.equal(result.boundary.private_key_loaded, false);
      assert.equal(result.boundary.token_minted, false);
    } finally {
      restore();
    }
  });
});

describe("verifyProofPassportFile", () => {
  it("fails on nonexistent file", async () => {
    const result = await verifyProofPassportFile("/nonexistent/passport.json");
    assert.equal(result.verified, false);
    assert.equal(result.error, "cannot_read_passport");
  });

  it("verifies a passport file", async () => {
    const { passportPath, restore } = await homeWithPassport();
    try {
      const result = await verifyProofPassportFile(passportPath);
      assert.equal(result.verified, true);
      assert.equal(result.passport_path, passportPath);
    } finally {
      restore();
    }
  });

  it("fails on non-JSON file", async () => {
    const home = freshHome();
    const path = join(home, "bad.json");
    writeFileSync(path, "not valid json");
    const result = await verifyProofPassportFile(path);
    assert.equal(result.verified, false);
    assert.equal(result.error, "cannot_read_passport");
  });
});

describe("formatProofPassportVerification", () => {
  it("formats VERIFIED output", async () => {
    const { passport, restore } = await homeWithPassport();
    try {
      const result = verifyProofPassport(passport);
      const text = formatProofPassportVerification(result);
      assert.match(text, /VERIFIED/);
      assert.match(text, /Hash:/);
      assert.match(text, /✓/);
    } finally {
      restore();
    }
  });

  it("formats FAILED output with x marks", () => {
    const result = verifyProofPassport({
      schema: "wrong",
      passport_hash: "x",
      generated_at: new Date().toISOString(),
    });
    const text = formatProofPassportVerification(result);
    assert.match(text, /FAILED/);
    assert.match(text, /✗/);
  });
});

describe("dema proof passport verify CLI", () => {
  it("exits 1 on missing argument", () => {
    try {
      execFileSync("node", [CLI, "proof", "passport", "verify"], {
        cwd: REPO_ROOT,
        env: { ...ENV },
        timeout: 10000,
      });
      assert.fail("should exit 1");
    } catch (err) {
      assert.equal(err.status, 1);
    }
  });

  it("verifies a valid passport file via CLI", async () => {
    const { passportPath, restore } = await homeWithPassport();
    try {
      const out = execFileSync(
        "node",
        [CLI, "proof", "passport", "verify", passportPath, "--json"],
        { cwd: REPO_ROOT, env: ENV, timeout: 10000 },
      ).toString();
      const result = JSON.parse(out);
      assert.equal(result.verified, true);
      assert.equal(result.verdict, "VERIFIED");
    } finally {
      restore();
    }
  });

  it("CLI exits 1 on tampered passport", async () => {
    const { passport, restore } = await homeWithPassport();
    try {
      const home = freshHome();
      const tampered = { ...passport, passport_hash: "0".repeat(64) };
      const tamperedPath = join(home, "tampered.json");
      writeFileSync(tamperedPath, JSON.stringify(tampered));
      try {
        execFileSync(
          "node",
          [CLI, "proof", "passport", "verify", tamperedPath, "--json"],
          { cwd: REPO_ROOT, env: ENV, timeout: 10000 },
        );
        assert.fail("should exit 1");
      } catch (err) {
        const result = JSON.parse(err.stdout.toString());
        assert.equal(result.verified, false);
      }
    } finally {
      restore();
    }
  });
});
