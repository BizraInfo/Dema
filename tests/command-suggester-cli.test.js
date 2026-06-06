import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);

test("dema tell → suggests memory show bizra-context and help", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "tell"], {
    env: { ...process.env, NODE_ENV: "test" },
  });
  assert.match(stdout, /Did you mean/);
  assert.match(stdout, /memory show bizra-context/);
  assert.match(stdout, /dema help/);
});

test("dema staus → suggests status", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "staus"], {
    env: { ...process.env, NODE_ENV: "test" },
  });
  assert.match(stdout, /Did you mean/);
  assert.match(stdout, /dema status/);
});

test("dema xyzqwerty → couldn't find a close match message", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "xyzqwerty"], {
    env: { ...process.env, NODE_ENV: "test" },
  });
  assert.match(stdout, /couldn't find a close match/);
});
