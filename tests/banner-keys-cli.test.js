import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);

// Non-TTY invocation (execFile default): banner emits JSON, exits 0,
// no hang, no disclaimer text.
test("dema bare (non-TTY · DEMA_BANNER_INTERACTIVE=0) exits 0 without hanging", async () => {
  const { stdout } = await execFileAsync("node", [cliPath], {
    timeout: 5000,
    env: {
      ...process.env,
      DEMA_BANNER_INTERACTIVE: "0",
      NODE_ENV: "test",
    },
  });
  // Non-TTY path emits first-look companion JSON.
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.schema, "bizra.dema.first_look_home.v1");
});

test("dema homebase (non-TTY) still emits technical homebase JSON", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "homebase"], {
    timeout: 5000,
    env: {
      ...process.env,
      DEMA_BANNER_INTERACTIVE: "0",
      NODE_ENV: "test",
    },
  });
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.schema, "bizra.dema.homebase_v0_1.v0.1");
});

test("dema bare (non-TTY) stdout does NOT contain the disclaimer text", async () => {
  const { stdout } = await execFileAsync("node", [cliPath], {
    timeout: 5000,
    env: {
      ...process.env,
      NODE_ENV: "test",
    },
  });
  assert.ok(
    !stdout.includes("keyboard hints only"),
    "disclaimer must be absent from non-TTY output",
  );
});

test("dema bare (DEMA_NO_TUI=1) emits first-look JSON not banner text", async () => {
  const { stdout } = await execFileAsync("node", [cliPath], {
    timeout: 5000,
    env: {
      ...process.env,
      DEMA_NO_TUI: "1",
    },
  });
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.schema, "bizra.dema.first_look_home.v1");
  assert.equal(parsed.mode, "preview_only");
});
