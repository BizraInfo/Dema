// KEYCONSENT-1C · dema consent prove + dema consent verify CLI surfaces
//
// Maps PDF §6 KEYCONSENT-1C requirements (6 items) to test names:
//   - dema consent prove
//   - dema consent verify
//   - Human output
//   - JSON output
//   - No private key leakage
//   - No token/PoI/economy claims
//
// Pure CLI wrappers on the KEYCONSENT-1A kernel (buildConsentProof +
// verifyConsentProof). No new cryptographic primitive; no integration with
// existing mutation gates (that is KEYCONSENT-1B-bis for other gates);
// no nonce registry (KEYCONSENT-2); no token/PoI/economy field anywhere.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateEd25519Keypair } from "../packages/receipts/src/authorship-signature.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import { runConsentProveCli } from "../packages/receipts/src/consent-prove-command.js";

const CLI_PATH = "apps/cli/src/index.js";
const VALID_PHRASE = "SIGN AUTHORSHIP RECEIPT";

// Generation store: the public key lives inside the active generation dir,
// selected by keys/active-key.json — not at the legacy flat path.
async function activePubkeyPath(home) {
  const pointer = JSON.parse(
    await readFile(join(home, "keys", "active-key.json"), "utf8"),
  );
  return join(home, "keys", pointer.generation_path, "public.pem");
}
const VALID_ACTION_TYPE = "MINT_VERDICT_RECEIPT";
const VALID_TARGET_HASH = "a".repeat(64);

it("consent prove wrapper reports in-memory, saved, refused, and failed-write outcomes", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-kc1c-wrapper-contract-"));
  try {
    const initialized = await initAuthorshipKey({
      consent: KEY_INIT_CONSENT_PHRASE,
      demaHome: home,
    });
    assert.equal(initialized.initialized, true);

    const input = {
      phrase: VALID_PHRASE,
      actionType: VALID_ACTION_TYPE,
      targetHash: VALID_TARGET_HASH,
      demaHome: home,
    };
    const inMemory = await runConsentProveCli(input);
    assert.equal(inMemory.built, true);
    assert.equal(inMemory.out_path, undefined);

    const outPath = join(home, "proof.json");
    const saved = await runConsentProveCli({
      ...input,
      ruleId: "consent-prove-cli-test",
      outPath,
    });
    assert.equal(saved.built, true);
    assert.equal(saved.out_path, outPath);
    const written = JSON.parse(await readFile(outPath, "utf8"));
    assert.equal(written.action_scope.rule_id, "consent-prove-cli-test");

    const failedWrite = await runConsentProveCli({
      ...input,
      outPath: join(home, "missing", "proof.json"),
    });
    assert.equal(failedWrite.built, true);
    assert.equal(failedWrite.error, "consent_proof_write_failed");

    const refused = await runConsentProveCli({
      ...input,
      phrase: "",
      outPath: join(home, "refused.json"),
    });
    assert.equal(refused.built, false);
    assert.equal(refused.out_path, undefined);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

function runCli(argv, env = {}) {
  return new Promise((resolve) => {
    const child = spawn("node", [CLI_PATH, ...argv], {
      env: {
        ...process.env,
        DEMA_NO_TUI: "1",
        NODE_ENV: "test",
        NO_COLOR: "1",
        ...env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (b) => (stdout += b.toString("utf8")));
    child.stderr.on("data", (b) => (stderr += b.toString("utf8")));
    child.on("close", (code) => resolve({ exitCode: code, stdout, stderr }));
  });
}

describe("dema consent prove · CLI surface (KEYCONSENT-1C requirements 1-4)", () => {
  it("REQ-1+4: prove with all required flags + --json → exit 0, JSON envelope with consent_proof", async () => {
    const home = await mkdtemp(join(tmpdir(), "dema-kc1c-prove-"));
    try {
      await runCli(
        [
          "authorship",
          "key",
          "init",
          "--consent",
          "GENERATE AUTHORSHIP KEY",
          "--json",
        ],
        { DEMA_HOME: home },
      );
      const r = await runCli(
        [
          "consent",
          "prove",
          "--phrase",
          VALID_PHRASE,
          "--action-type",
          VALID_ACTION_TYPE,
          "--target-hash",
          VALID_TARGET_HASH,
          "--rule-id",
          "canonical-shape.v0.1",
          "--json",
        ],
        { DEMA_HOME: home },
      );
      assert.equal(r.exitCode, 0, `stderr: ${r.stderr}`);
      const j = JSON.parse(r.stdout);
      assert.equal(j.built, true);
      assert.equal(j.consent_proof.schema, "bizra.dema.consent_proof.v0.1");
      assert.equal(j.consent_proof.consent_phrase, VALID_PHRASE);
      assert.equal(j.consent_proof.action_scope.action_type, VALID_ACTION_TYPE);
      assert.equal(j.consent_proof.action_scope.target_hash, VALID_TARGET_HASH);
      assert.ok(/^[a-f0-9]{64}$/.test(j.consent_proof.consent_proof_hash));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("REQ-3: prove without --json → exit 0, human output with hash + scope (no JSON braces)", async () => {
    const home = await mkdtemp(join(tmpdir(), "dema-kc1c-prove-human-"));
    try {
      await runCli(
        [
          "authorship",
          "key",
          "init",
          "--consent",
          "GENERATE AUTHORSHIP KEY",
          "--json",
        ],
        { DEMA_HOME: home },
      );
      const r = await runCli(
        [
          "consent",
          "prove",
          "--phrase",
          VALID_PHRASE,
          "--action-type",
          VALID_ACTION_TYPE,
          "--target-hash",
          VALID_TARGET_HASH,
        ],
        { DEMA_HOME: home },
      );
      assert.equal(r.exitCode, 0, `stderr: ${r.stderr}`);
      assert.ok(r.stdout.includes("Consent Proof"));
      assert.ok(r.stdout.includes(VALID_ACTION_TYPE));
      // Human output should NOT be JSON
      assert.ok(!r.stdout.trim().startsWith("{"));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("REQ-1: prove with --out <path> → consent proof JSON saved to disk + bundle path surfaced", async () => {
    const home = await mkdtemp(join(tmpdir(), "dema-kc1c-prove-out-"));
    const outPath = join(home, "proof.json");
    try {
      await runCli(
        [
          "authorship",
          "key",
          "init",
          "--consent",
          "GENERATE AUTHORSHIP KEY",
          "--json",
        ],
        { DEMA_HOME: home },
      );
      const r = await runCli(
        [
          "consent",
          "prove",
          "--phrase",
          VALID_PHRASE,
          "--action-type",
          VALID_ACTION_TYPE,
          "--target-hash",
          VALID_TARGET_HASH,
          "--out",
          outPath,
          "--json",
        ],
        { DEMA_HOME: home },
      );
      assert.equal(r.exitCode, 0);
      const saved = JSON.parse(await readFile(outPath, "utf8"));
      assert.equal(saved.schema, "bizra.dema.consent_proof.v0.1");
      assert.ok(/^[a-f0-9]{64}$/.test(saved.consent_proof_hash));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: --out write failure returns non-zero and exposes the write error", async () => {
    const home = await mkdtemp(join(tmpdir(), "dema-kc1c-prove-write-failure-"));
    const outPath = join(home, "missing", "proof.json");
    try {
      await runCli(
        [
          "authorship",
          "key",
          "init",
          "--consent",
          "GENERATE AUTHORSHIP KEY",
          "--json",
        ],
        { DEMA_HOME: home },
      );
      const r = await runCli(
        [
          "consent",
          "prove",
          "--phrase",
          VALID_PHRASE,
          "--action-type",
          VALID_ACTION_TYPE,
          "--target-hash",
          VALID_TARGET_HASH,
          "--out",
          outPath,
          "--json",
        ],
        { DEMA_HOME: home },
      );
      assert.equal(r.exitCode, 1);
      const result = JSON.parse(r.stdout);
      assert.equal(result.built, true);
      assert.equal(result.error, "consent_proof_write_failed");
      assert.match(result.details, /ENOENT/);

      const human = await runCli(
        [
          "consent",
          "prove",
          "--phrase",
          VALID_PHRASE,
          "--action-type",
          VALID_ACTION_TYPE,
          "--target-hash",
          VALID_TARGET_HASH,
          "--out",
          outPath,
        ],
        { DEMA_HOME: home },
      );
      assert.equal(human.exitCode, 1);
      assert.match(human.stderr, /consent_proof_write_failed/);
      assert.doesNotMatch(human.stdout, /Consent Proof/);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("REQ-5: NO PRIVATE KEY material in prove output (JSON OR human)", async () => {
    const home = await mkdtemp(join(tmpdir(), "dema-kc1c-no-leak-"));
    try {
      await runCli(
        [
          "authorship",
          "key",
          "init",
          "--consent",
          "GENERATE AUTHORSHIP KEY",
          "--json",
        ],
        { DEMA_HOME: home },
      );
      for (const flags of [["--json"], []]) {
        const r = await runCli(
          [
            "consent",
            "prove",
            "--phrase",
            VALID_PHRASE,
            "--action-type",
            VALID_ACTION_TYPE,
            "--target-hash",
            VALID_TARGET_HASH,
            ...flags,
          ],
          { DEMA_HOME: home },
        );
        assert.equal(r.exitCode, 0);
        const blob = r.stdout + r.stderr;
        assert.ok(
          !blob.includes("PRIVATE KEY"),
          `output must not contain PRIVATE KEY marker (flags=${flags.join(" ") || "human"})`,
        );
        assert.ok(
          !blob.includes("PKCS8"),
          `output must not contain PKCS8 marker (flags=${flags.join(" ") || "human"})`,
        );
      }
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("REQ-6: NO token/PoI/economy field anywhere in prove output (JSON)", async () => {
    const home = await mkdtemp(join(tmpdir(), "dema-kc1c-no-econ-"));
    try {
      await runCli(
        [
          "authorship",
          "key",
          "init",
          "--consent",
          "GENERATE AUTHORSHIP KEY",
          "--json",
        ],
        { DEMA_HOME: home },
      );
      const r = await runCli(
        [
          "consent",
          "prove",
          "--phrase",
          VALID_PHRASE,
          "--action-type",
          VALID_ACTION_TYPE,
          "--target-hash",
          VALID_TARGET_HASH,
          "--json",
        ],
        { DEMA_HOME: home },
      );
      assert.equal(r.exitCode, 0);
      const FORBIDDEN = [
        "token_minted",
        "poi_score",
        "economic_claim",
        "reward",
        "mint_candidate",
        "token_eligible",
        "bzc",
        "imp",
      ];
      for (const f of FORBIDDEN) {
        assert.ok(
          !r.stdout.includes(`"${f}"`),
          `prove output must not contain "${f}" key`,
        );
      }
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-closed: wrong phrase → exit 1, error consent_phrase_required (or consent gate error)", async () => {
    const home = await mkdtemp(join(tmpdir(), "dema-kc1c-wrong-phrase-"));
    try {
      await runCli(
        [
          "authorship",
          "key",
          "init",
          "--consent",
          "GENERATE AUTHORSHIP KEY",
          "--json",
        ],
        { DEMA_HOME: home },
      );
      const r = await runCli(
        [
          "consent",
          "prove",
          "--phrase",
          "", // empty
          "--action-type",
          VALID_ACTION_TYPE,
          "--target-hash",
          VALID_TARGET_HASH,
          "--json",
        ],
        { DEMA_HOME: home },
      );
      assert.equal(r.exitCode, 1);
      const j = JSON.parse(r.stdout);
      assert.equal(j.built, false);
      assert.equal(j.error, "consent_phrase_required");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fail-safe: no signing key on disk → exit 1, error no_authorship_key", async () => {
    const home = await mkdtemp(join(tmpdir(), "dema-kc1c-no-key-"));
    try {
      // Do NOT init key
      const r = await runCli(
        [
          "consent",
          "prove",
          "--phrase",
          VALID_PHRASE,
          "--action-type",
          VALID_ACTION_TYPE,
          "--target-hash",
          VALID_TARGET_HASH,
          "--json",
        ],
        { DEMA_HOME: home },
      );
      assert.equal(r.exitCode, 1);
      const j = JSON.parse(r.stdout);
      assert.equal(j.built, false);
      assert.equal(j.error, "no_authorship_key");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("dema consent verify · CLI surface (KEYCONSENT-1C requirements 2,3,4,5,6)", () => {
  it("REQ-2+4: verify a valid proof with external pubkey + --json → exit 0, verified:true", async () => {
    const home = await mkdtemp(join(tmpdir(), "dema-kc1c-verify-"));
    const proofPath = join(home, "proof.json");
    try {
      await runCli(
        [
          "authorship",
          "key",
          "init",
          "--consent",
          "GENERATE AUTHORSHIP KEY",
          "--json",
        ],
        { DEMA_HOME: home },
      );
      // prove
      await runCli(
        [
          "consent",
          "prove",
          "--phrase",
          VALID_PHRASE,
          "--action-type",
          VALID_ACTION_TYPE,
          "--target-hash",
          VALID_TARGET_HASH,
          "--out",
          proofPath,
          "--json",
        ],
        { DEMA_HOME: home },
      );
      const pubkeyPath = await activePubkeyPath(home);
      // verify
      const r = await runCli(
        ["consent", "verify", proofPath, "--pubkey", pubkeyPath, "--json"],
        {},
      );
      assert.equal(r.exitCode, 0, `stderr: ${r.stderr}`);
      const j = JSON.parse(r.stdout);
      assert.equal(j.verified, true);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("REQ-3: verify without --json → exit 0, human output containing VERIFIED", async () => {
    const home = await mkdtemp(join(tmpdir(), "dema-kc1c-verify-human-"));
    const proofPath = join(home, "proof.json");
    try {
      await runCli(
        [
          "authorship",
          "key",
          "init",
          "--consent",
          "GENERATE AUTHORSHIP KEY",
          "--json",
        ],
        { DEMA_HOME: home },
      );
      await runCli(
        [
          "consent",
          "prove",
          "--phrase",
          VALID_PHRASE,
          "--action-type",
          VALID_ACTION_TYPE,
          "--target-hash",
          VALID_TARGET_HASH,
          "--out",
          proofPath,
          "--json",
        ],
        { DEMA_HOME: home },
      );
      const pubkeyPath = await activePubkeyPath(home);
      const r = await runCli(
        ["consent", "verify", proofPath, "--pubkey", pubkeyPath],
        {},
      );
      assert.equal(r.exitCode, 0);
      assert.ok(r.stdout.includes("VERIFIED"));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("REJECT: verify with WRONG external pubkey → exit 1, reason consent_signature_invalid", async () => {
    const home = await mkdtemp(join(tmpdir(), "dema-kc1c-verify-wrong-key-"));
    const proofPath = join(home, "proof.json");
    const wrongPubkeyPath = join(home, "wrong.pem");
    try {
      await runCli(
        [
          "authorship",
          "key",
          "init",
          "--consent",
          "GENERATE AUTHORSHIP KEY",
          "--json",
        ],
        { DEMA_HOME: home },
      );
      await runCli(
        [
          "consent",
          "prove",
          "--phrase",
          VALID_PHRASE,
          "--action-type",
          VALID_ACTION_TYPE,
          "--target-hash",
          VALID_TARGET_HASH,
          "--out",
          proofPath,
          "--json",
        ],
        { DEMA_HOME: home },
      );
      const wrongKey = generateEd25519Keypair();
      await writeFile(wrongPubkeyPath, wrongKey.public_key_pem);
      const r = await runCli(
        ["consent", "verify", proofPath, "--pubkey", wrongPubkeyPath, "--json"],
        {},
      );
      assert.equal(r.exitCode, 1);
      const j = JSON.parse(r.stdout);
      assert.equal(j.verified, false);
      assert.equal(j.reason, "consent_signature_invalid");

      const human = await runCli(
        ["consent", "verify", proofPath, "--pubkey", wrongPubkeyPath],
        {},
      );
      assert.equal(human.exitCode, 1);
      assert.match(human.stderr, /REJECTED:consent_signature_invalid/);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("REQ-5: verify output contains NO PRIVATE KEY material (JSON or human)", async () => {
    const home = await mkdtemp(join(tmpdir(), "dema-kc1c-verify-no-leak-"));
    const proofPath = join(home, "proof.json");
    try {
      await runCli(
        [
          "authorship",
          "key",
          "init",
          "--consent",
          "GENERATE AUTHORSHIP KEY",
          "--json",
        ],
        { DEMA_HOME: home },
      );
      await runCli(
        [
          "consent",
          "prove",
          "--phrase",
          VALID_PHRASE,
          "--action-type",
          VALID_ACTION_TYPE,
          "--target-hash",
          VALID_TARGET_HASH,
          "--out",
          proofPath,
          "--json",
        ],
        { DEMA_HOME: home },
      );
      const pubkeyPath = await activePubkeyPath(home);
      for (const flags of [["--json"], []]) {
        const r = await runCli(
          ["consent", "verify", proofPath, "--pubkey", pubkeyPath, ...flags],
          {},
        );
        assert.equal(r.exitCode, 0);
        const blob = r.stdout + r.stderr;
        assert.ok(
          !blob.includes("PRIVATE KEY"),
          `verify output must not leak PRIVATE KEY (flags=${flags.join(" ") || "human"})`,
        );
      }
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("REQ-6: verify output contains NO token/PoI/economy keys (JSON)", async () => {
    const home = await mkdtemp(join(tmpdir(), "dema-kc1c-verify-no-econ-"));
    const proofPath = join(home, "proof.json");
    try {
      await runCli(
        [
          "authorship",
          "key",
          "init",
          "--consent",
          "GENERATE AUTHORSHIP KEY",
          "--json",
        ],
        { DEMA_HOME: home },
      );
      await runCli(
        [
          "consent",
          "prove",
          "--phrase",
          VALID_PHRASE,
          "--action-type",
          VALID_ACTION_TYPE,
          "--target-hash",
          VALID_TARGET_HASH,
          "--out",
          proofPath,
          "--json",
        ],
        { DEMA_HOME: home },
      );
      const pubkeyPath = await activePubkeyPath(home);
      const r = await runCli(
        ["consent", "verify", proofPath, "--pubkey", pubkeyPath, "--json"],
        {},
      );
      assert.equal(r.exitCode, 0);
      const FORBIDDEN = [
        "token_minted",
        "poi_score",
        "economic_claim",
        "reward",
        "mint_candidate",
        "token_eligible",
      ];
      for (const f of FORBIDDEN) {
        assert.ok(
          !r.stdout.includes(`"${f}"`),
          `verify output must not contain "${f}" key`,
        );
      }
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

// MOBILE second-factor CLI — wires the mobile-qr-challenge-preview kernel.
// Canon: the phone shows a phrase, the operator types it back, the laptop
// verifies; the phone holds/sends/executes nothing authoritative. Preview-only.
describe("dema consent mobile-challenge · CLI surface", () => {
  it("issue --json emits a valid challenge with a challenge_id and a 6-digit phrase", async () => {
    const r = await runCli([
      "consent",
      "mobile-challenge",
      "issue",
      "--mission-id",
      "m-1",
      "--action",
      "preview_status",
      "--purpose",
      "confirm on phone",
      "--json",
    ]);
    assert.equal(r.exitCode, 0, r.stderr);
    const c = JSON.parse(r.stdout);
    assert.equal(c.valid, true);
    assert.match(c.challenge_id, /^chal-/);
    assert.match(c.phrase, /^\d{6}$/);
    assert.equal(c.boundary.phone_authority_granted, false);
  });

  it("verify accepts the correct typed phrase and refuses a wrong one", async () => {
    const home = await mkdtemp(join(tmpdir(), "dema-mqr-"));
    try {
      const issued = await runCli([
        "consent", "mobile-challenge", "issue",
        "--mission-id", "m-2", "--action", "preview_status", "--purpose", "p", "--json",
      ]);
      const challenge = JSON.parse(issued.stdout);
      const path = join(home, "challenge.json");
      await writeFile(path, JSON.stringify(challenge));

      const ok = await runCli([
        "consent", "mobile-challenge", "verify",
        "--challenge", path, "--phrase", challenge.phrase, "--json",
      ]);
      assert.equal(ok.exitCode, 0, ok.stderr);
      assert.equal(JSON.parse(ok.stdout).ok, true);

      const missingPhrase = await runCli([
        "consent", "mobile-challenge", "verify",
        "--challenge", path, "--json",
      ]);
      assert.equal(missingPhrase.exitCode, 1);
      assert.equal(JSON.parse(missingPhrase.stdout).reason, "missing_phrase");
      assert.equal(JSON.parse(missingPhrase.stdout).not_an_authorization, true);

      const bad = await runCli([
        "consent", "mobile-challenge", "verify",
        "--challenge", path, "--phrase", "000000", "--json",
      ]);
      assert.equal(bad.exitCode, 1);
      assert.equal(JSON.parse(bad.stdout).reason, "phrase_mismatch");

      const badHuman = await runCli([
        "consent", "mobile-challenge", "verify",
        "--challenge", path, "--phrase", "000000",
      ]);
      assert.equal(badHuman.exitCode, 1);
      assert.match(badHuman.stdout, /REJECTED:phrase_mismatch/);
      assert.match(badHuman.stdout, /typed phrase does not match challenge phrase/);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("issue with a missing required field fails closed (exit 1, valid:false)", async () => {
    const r = await runCli([
      "consent", "mobile-challenge", "issue", "--mission-id", "m-3", "--json",
    ]);
    assert.equal(r.exitCode, 1);
    assert.equal(JSON.parse(r.stdout).valid, false);
  });

  it("verify without a challenge path fails closed with an actionable error", async () => {
    const r = await runCli(["consent", "mobile-challenge", "verify"]);
    assert.equal(r.exitCode, 1);
    assert.match(r.stdout, /REJECTED:challenge_unreadable/);
    assert.match(r.stdout, /cannot read --challenge <missing>/);
  });

  it("human issue refusal explains the missing field and exits nonzero", async () => {
    const r = await runCli([
      "consent", "mobile-challenge", "issue",
      "--mission-id", "m-5", "--purpose", "p",
    ]);
    assert.equal(r.exitCode, 1, r.stderr);
    assert.match(r.stdout, /Mobile challenge FAILED: invalid_action/);
    assert.match(r.stdout, /action must be a non-empty string/);
  });

  it("human issue output shows the phrase and the preview-only boundary note", async () => {
    const r = await runCli([
      "consent", "mobile-challenge", "issue",
      "--mission-id", "m-4", "--action", "preview_status", "--purpose", "p",
    ]);
    assert.equal(r.exitCode, 0, r.stderr);
    assert.match(r.stdout, /phrase/i);
    assert.match(r.stdout, /preview/i);
  });

  it("unknown consent command fails closed and lists supported paths", async () => {
    const r = await runCli(["consent", "unknown"]);
    assert.equal(r.exitCode, 1);
    assert.match(r.stderr, /Unknown consent command/);
    assert.match(r.stderr, /mobile-challenge issue\|verify/);
  });
});
