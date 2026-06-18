import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const CLI_PATH = join(REPO_ROOT, "apps", "cli", "src", "index.js");

function runCli(argv, env = {}) {
  return new Promise((resolvePromise, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(process.execPath, [CLI_PATH, ...argv], {
      env: { ...process.env, DEMA_NO_TUI: "1", DEMA_NODE0_ADAPTER: "local", ...env },
    });
    child.stdout.on("data", (d) => {
      stdout += d;
    });
    child.stderr.on("data", (d) => {
      stderr += d;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolvePromise({ code, stdout, stderr });
    });
  });
}

test("UX3B-CLI-01: council-dispatch without consent returns consent_required JSON", async () => {
  const { code, stdout } = await runCli([
    "realm",
    "council-dispatch",
    "--seat",
    "Builder",
    "--json",
  ]);
  assert.equal(code, 0);
  const out = JSON.parse(stdout);
  assert.equal(out.schema, "bizra.dema.council_seat_pat_dispatch_preview.v0.1");
  assert.equal(out.dispatch_status, "consent_required");
  assert.equal(out.pat_agent_id, "pat-engineer");
});

test("UX3B-CLI-02: council-dispatch with exact consent returns dispatched preview", async () => {
  const { code, stdout } = await runCli([
    "realm",
    "council-dispatch",
    "--seat",
    "Guardian",
    "--consent",
    "GO: dispatch PAT from council seat Guardian",
    "--json",
  ]);
  assert.equal(code, 0);
  const out = JSON.parse(stdout);
  assert.equal(out.dispatch_status, "dispatched_preview_only");
  assert.equal(out.contract_valid, true);
  assert.equal(out.boundary.runtime_execution_performed, false);
});

test("UX3B-CLI-03: council-dispatch human output mentions preview only", async () => {
  const { code, stdout } = await runCli([
    "realm",
    "council-dispatch",
    "--seat",
    "Guardian",
    "--consent",
    "GO: dispatch PAT from council seat Guardian",
  ]);
  assert.equal(code, 0);
  assert.match(stdout, /preview only/i);
  assert.match(stdout, /pat-auditor/);
});
