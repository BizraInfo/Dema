import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const CLI_PATH = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);
const NODE = process.execPath;
const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

test("dema genesis verify-node0 --json emits pre-token schema", async () => {
  const { stdout } = await execFileAsync(NODE, [
    CLI_PATH,
    "genesis",
    "verify-node0",
    "--root",
    REPO_ROOT,
    "--json",
  ]);
  const report = JSON.parse(stdout);
  assert.equal(
    report.schema,
    "bizra.dema.node0_historical_contribution_verification.v0.1",
  );
  assert.equal(
    report.truth_label,
    "NODE0_HISTORICAL_CONTRIBUTION_VERIFICATION_PRE_TOKEN",
  );
  assert.equal(report.boundary.token_minted, false);
  assert.equal(report.boundary.urp_submission_performed, false);
  assert.ok(report.reward_eligibility_preview);
  assert.ok(report.urp_commons_commitment_preview);
});

test("dema genesis verify-node0 human output discloses pre-token boundary", async () => {
  const { stdout } = await execFileAsync(NODE, [
    CLI_PATH,
    "genesis",
    "verify-node0",
    "--root",
    REPO_ROOT,
  ]);
  assert.match(stdout, /PRE-TOKEN VERIFICATION/);
  assert.match(stdout, /no token mint/);
  assert.match(stdout, /founder sadaqah/);
});

test("dema genesis verify-node0 missing --root defaults to cwd", async () => {
  const { stdout } = await execFileAsync(
    NODE,
    [CLI_PATH, "genesis", "verify-node0", "--json"],
    { cwd: REPO_ROOT },
  );
  const report = JSON.parse(stdout);
  assert.equal(report.valid, true);
});
