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

test("UX3-CLI-01: dema realm council-route --seat Builder --json emits routed preview", async () => {
  const { code, stdout } = await runCli([
    "realm",
    "council-route",
    "--seat",
    "Builder",
    "--json",
  ]);
  assert.equal(code, 0);
  const out = JSON.parse(stdout);
  assert.equal(out.schema, "bizra.dema.council_seat_pat_routing_preview.v0.1");
  assert.equal(out.selected_seat, "Builder");
  assert.equal(out.pat_agent_id, "pat-engineer");
});

test("UX3-CLI-02: dema realm council-route renders human table without --json", async () => {
  const { code, stdout } = await runCli(["realm", "council-route"]);
  assert.equal(code, 0);
  assert.match(stdout, /Guardian/);
  assert.match(stdout, /pat-auditor/);
});
