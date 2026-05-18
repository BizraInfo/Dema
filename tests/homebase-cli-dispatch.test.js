import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));

async function makeIsolatedHome() {
  return mkdtemp(join(tmpdir(), "dema-homebase-cli-"));
}

function homebaseEnv(home) {
  return {
    ...process.env,
    DEMA_HOME: home,
    DEMA_NODE0_ADAPTER: "",
  };
}

test("TDD-25: `dema --json` emits JSON parseable as HomebasePreview", async () => {
  const home = await makeIsolatedHome();
  try {
    const { stdout } = await execFileAsync("node", [cliPath, "--json"], { env: homebaseEnv(home) });
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.schema, "bizra.dema.homebase_v0_1.v0.1");
    assert.equal(parsed.truth_label, "NODE0_LOCAL_SEED");
    assert.equal(parsed.mode, "preview_only");
    assert.equal(typeof parsed.rendered_at, "string");
    assert.equal(parsed.affordances.length, 6);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("TDD-26: bare `dema` with stdout redirected (non-TTY) emits same JSON shape as --json", async () => {
  const home = await makeIsolatedHome();
  try {
    const { stdout } = await execFileAsync("node", [cliPath], { env: homebaseEnv(home) });
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.schema, "bizra.dema.homebase_v0_1.v0.1");
    assert.equal(parsed.boundary.runtime_execution_performed, false);
    assert.equal(parsed.boundary.federation_invoked, false);
    assert.equal(parsed.boundary.receipt_mint_performed, false);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("TDD-27: bare `dema` with NODE_ENV=test emits JSON (no TUI)", async () => {
  const home = await makeIsolatedHome();
  try {
    const { stdout } = await execFileAsync("node", [cliPath], {
      env: { ...homebaseEnv(home), NODE_ENV: "test" },
    });
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.schema, "bizra.dema.homebase_v0_1.v0.1");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("TDD-28: bare `dema` with DEMA_NO_TUI=1 emits JSON (no TUI)", async () => {
  const home = await makeIsolatedHome();
  try {
    const { stdout } = await execFileAsync("node", [cliPath], {
      env: { ...homebaseEnv(home), DEMA_NO_TUI: "1" },
    });
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.schema, "bizra.dema.homebase_v0_1.v0.1");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("TDD-30: `dema --json | head -1` does not hang on EPIPE · exits cleanly", async () => {
  const home = await makeIsolatedHome();
  try {
    const exitCode = await new Promise((resolve, reject) => {
      const proc = spawn("node", [cliPath, "--json"], { env: homebaseEnv(home) });
      let buf = "";
      proc.stdout.on("data", (chunk) => {
        buf += chunk;
        if (buf.includes("\n")) proc.stdout.destroy();
      });
      proc.on("close", resolve);
      proc.on("error", reject);
      setTimeout(() => {
        proc.kill("SIGKILL");
        reject(new Error("dema hung beyond 5s"));
      }, 5000).unref();
    });
    assert.ok(exitCode === 0 || exitCode === null, `expected 0 or null close-code · got ${exitCode}`);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("ADV: `dema --json` does not crash when ~/.dema/ is missing entirely · partial flag set", async () => {
  const missingHome = join(tmpdir(), `dema-homebase-cli-nonexistent-${process.pid}-${Date.now()}`);
  const { stdout } = await execFileAsync("node", [cliPath, "--json"], {
    env: { ...process.env, DEMA_HOME: missingHome, DEMA_NODE0_ADAPTER: "" },
  });
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.schema, "bizra.dema.homebase_v0_1.v0.1");
  assert.equal(parsed.greeting.has_name, false);
  assert.deepEqual(parsed.memory3.entries, []);
});

test("backwards compat: known subcommands still work · `dema task` still emits task list JSON", async () => {
  const home = await makeIsolatedHome();
  try {
    const { stdout } = await execFileAsync("node", [cliPath, "task"], { env: homebaseEnv(home) });
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.schema, "bizra.dema.task_list.v0.1");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
