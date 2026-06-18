import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);

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

test("bare `dema --json` emits first-look companion JSON", async () => {
  const home = await makeIsolatedHome();
  try {
    const { stdout } = await execFileAsync("node", [cliPath, "--json"], {
      env: homebaseEnv(home),
    });
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.schema, "bizra.dema.first_look_home.v1");
    assert.equal(parsed.mode, "preview_only");
    assert.equal(parsed.simple_actions.length, 3);
    assert.ok(parsed.proof_boundary.what_this_does_not_prove);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("`dema homebase --json` emits HomebasePreview", async () => {
  const home = await makeIsolatedHome();
  try {
    const { stdout } = await execFileAsync(
      "node",
      [cliPath, "homebase", "--json"],
      { env: homebaseEnv(home) },
    );
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

test("bare `dema` with stdout redirected emits first-look JSON", async () => {
  const home = await makeIsolatedHome();
  try {
    const { stdout } = await execFileAsync("node", [cliPath], {
      env: homebaseEnv(home),
    });
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.schema, "bizra.dema.first_look_home.v1");
    assert.equal(parsed.boundary.runtime_execution_performed, false);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("bare `dema` with NODE_ENV=test emits first-look JSON", async () => {
  const home = await makeIsolatedHome();
  try {
    const { stdout } = await execFileAsync("node", [cliPath], {
      env: { ...homebaseEnv(home), NODE_ENV: "test" },
    });
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.schema, "bizra.dema.first_look_home.v1");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("bare `dema` with DEMA_NO_TUI=1 emits first-look JSON", async () => {
  const home = await makeIsolatedHome();
  try {
    const { stdout } = await execFileAsync("node", [cliPath], {
      env: { ...homebaseEnv(home), DEMA_NO_TUI: "1" },
    });
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.schema, "bizra.dema.first_look_home.v1");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("`dema --json | head -1` does not hang on EPIPE", async () => {
  const home = await makeIsolatedHome();
  try {
    const exitCode = await new Promise((resolve, reject) => {
      const proc = spawn("node", [cliPath, "--json"], {
        env: homebaseEnv(home),
      });
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
    assert.ok(
      exitCode === 0 || exitCode === null,
      `expected 0 or null close-code · got ${exitCode}`,
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("ADV: bare `dema --json` does not crash when DEMA_HOME is missing", async () => {
  const missingHome = join(
    tmpdir(),
    `dema-homebase-cli-nonexistent-${process.pid}-${Date.now()}`,
  );
  const { stdout } = await execFileAsync("node", [cliPath, "--json"], {
    env: { ...process.env, DEMA_HOME: missingHome, DEMA_NODE0_ADAPTER: "" },
  });
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.schema, "bizra.dema.first_look_home.v1");
  assert.equal(parsed.greeting.has_name, false);
});

test("backwards compat: `dema task` still emits task list JSON", async () => {
  const home = await makeIsolatedHome();
  try {
    const { stdout } = await execFileAsync("node", [cliPath, "task"], {
      env: homebaseEnv(home),
    });
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.schema, "bizra.dema.task_list.v0.1");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
