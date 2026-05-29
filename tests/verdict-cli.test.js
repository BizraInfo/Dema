// Integration test for `dema attest` + `dema verify-grounded` CLI surface.
// Spawns the real CLI as a child process and asserts on stdout/stderr/exit.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateEd25519Keypair } from "../packages/receipts/src/authorship-signature.js";

const CLI_PATH = "apps/cli/src/index.js";

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

describe("dema attest + verify-grounded · CLI integration (full vertical)", () => {
  it("attest then verify-grounded round-trip → both exit 0; verifier prints VERIFIED", async () => {
    const home = await mkdtemp(join(tmpdir(), "dema-vcli-"));
    const inputPath = join(home, "input.json");
    const outPath = join(home, "bundle.json");

    try {
      // Init authorship key
      const init = await runCli(
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
      assert.equal(init.exitCode, 0, `init stderr: ${init.stderr}`);

      // Write input file
      await writeFile(inputPath, JSON.stringify({ name: "carol", value: 7 }));

      // Attest
      const attestResult = await runCli(
        [
          "attest",
          "--rule",
          "canonical-shape.v0.1",
          "--input",
          inputPath,
          "--consent",
          "SIGN AUTHORSHIP RECEIPT",
          "--out",
          outPath,
          "--json",
        ],
        { DEMA_HOME: home },
      );
      assert.equal(
        attestResult.exitCode,
        0,
        `attest stderr: ${attestResult.stderr}`,
      );
      const attestJson = JSON.parse(attestResult.stdout);
      assert.equal(attestJson.attested, true);
      assert.equal(attestJson.body.verdict, "pass");

      // Bundle written to --out
      const bundle = JSON.parse(await readFile(outPath, "utf8"));
      assert.equal(bundle.body.verdict, "pass");

      // Pubkey path under DEMA_HOME/keys/
      const pubkeyPath = join(home, "keys", "node0-ed25519.pub.pem");

      // Verify-grounded with matching external pubkey
      const verifyResult = await runCli(
        [
          "verify-grounded",
          outPath,
          "--pubkey",
          pubkeyPath,
          "--rule",
          "canonical-shape.v0.1",
          "--json",
        ],
        {},
      );
      assert.equal(
        verifyResult.exitCode,
        0,
        `verify stderr: ${verifyResult.stderr}`,
      );
      const verifyJson = JSON.parse(verifyResult.stdout);
      assert.equal(verifyJson.verified, true);
      assert.equal(verifyJson.verdict, "pass");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("verify-grounded with WRONG external pubkey → exit 1, reason signature_invalid", async () => {
    const home = await mkdtemp(join(tmpdir(), "dema-vcli-"));
    const inputPath = join(home, "input.json");
    const outPath = join(home, "bundle.json");
    const wrongPubkeyPath = join(home, "wrong-pubkey.pem");

    try {
      // Setup: init key, write input, attest
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
      await writeFile(inputPath, JSON.stringify({ name: "carol", value: 7 }));
      await runCli(
        [
          "attest",
          "--rule",
          "canonical-shape.v0.1",
          "--input",
          inputPath,
          "--consent",
          "SIGN AUTHORSHIP RECEIPT",
          "--out",
          outPath,
          "--json",
        ],
        { DEMA_HOME: home },
      );

      // Generate a wrong pubkey (different from signer)
      const wrongKey = generateEd25519Keypair();
      await writeFile(wrongPubkeyPath, wrongKey.public_key_pem);

      // Verify with wrong pubkey
      const verifyResult = await runCli(
        [
          "verify-grounded",
          outPath,
          "--pubkey",
          wrongPubkeyPath,
          "--rule",
          "canonical-shape.v0.1",
          "--json",
        ],
        {},
      );
      assert.equal(verifyResult.exitCode, 1);
      const verifyJson = JSON.parse(verifyResult.stdout);
      assert.equal(verifyJson.verified, false);
      assert.equal(verifyJson.reason, "signature_invalid");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("attest with WRONG consent → exit 1, error consent_required, no bundle file", async () => {
    const home = await mkdtemp(join(tmpdir(), "dema-vcli-"));
    const inputPath = join(home, "input.json");
    const outPath = join(home, "bundle.json");

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
      await writeFile(inputPath, JSON.stringify({ name: "carol", value: 7 }));

      const r = await runCli(
        [
          "attest",
          "--rule",
          "canonical-shape.v0.1",
          "--input",
          inputPath,
          "--consent",
          "WRONG_PHRASE",
          "--out",
          outPath,
          "--json",
        ],
        { DEMA_HOME: home },
      );
      assert.equal(r.exitCode, 1);
      const j = JSON.parse(r.stdout);
      assert.equal(j.attested, false);
      assert.equal(j.error, "consent_required");

      // Bundle file should NOT exist
      let bundleWritten = true;
      try {
        await readFile(outPath, "utf8");
      } catch {
        bundleWritten = false;
      }
      assert.equal(
        bundleWritten,
        false,
        "bundle file must not be written on failed consent",
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
