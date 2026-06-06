import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);

function runSetupJson(demaHome) {
  return new Promise((resolve, reject) => {
    execFile(
      "node",
      [cliPath, "setup", "--json"],
      {
        env: { ...process.env, DEMA_HOME: demaHome },
        timeout: 10000,
      },
      (err, stdout, stderr) => {
        if (err) {
          reject(
            new Error(
              `setup --json failed: ${err.message}\nstdout: ${stdout}\nstderr: ${stderr}`,
            ),
          );
          return;
        }
        resolve({ stdout, stderr });
      },
    );
  });
}

test("setup --json outputs valid JSON with existing schema", async () => {
  const demaHome = await mkdtemp(join(tmpdir(), "dema-wizard-cli-"));
  const { stdout } = await runSetupJson(demaHome);
  const output = JSON.parse(stdout);
  assert.equal(output.schema, "bizra.dema.setup.v0.1");
  assert.equal(output.boundaries.noHiddenDaemon, true);
  assert.equal(output.boundaries.missionExecuted, false);
  assert.equal(output.boundaries.artifact011Issued, false);
  assert.ok(output.untouched.includes("runtime pulse"));
});

test("setup --json with DEMA_HOME writes profile.json with correct schema", async () => {
  const demaHome = await mkdtemp(join(tmpdir(), "dema-wizard-cli-profile-"));
  await runSetupJson(demaHome);
  const profileRaw = await readFile(join(demaHome, "profile.json"), "utf8");
  const profile = JSON.parse(profileRaw);
  assert.equal(profile.schema, "bizra.dema.profile.v0.1");
  assert.equal(profile.hidden_autonomy, false);
  assert.ok("memory_consent" in profile);
  assert.ok("created_at" in profile);
});

test("setup --json stdout contains no wizard prompts", async () => {
  const demaHome = await mkdtemp(join(tmpdir(), "dema-wizard-cli-noprompt-"));
  const { stdout } = await runSetupJson(demaHome);
  assert.doesNotMatch(stdout, /Q1 of 5/);
  assert.doesNotMatch(stdout, /preferred name/);
  assert.doesNotMatch(stdout, /Daughter Test/);
});
