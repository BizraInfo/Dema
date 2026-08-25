import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);

async function runUnknownCommand(command) {
  let error;
  try {
    await execFileAsync("node", [cliPath, command], {
      env: { ...process.env, NODE_ENV: "test" },
    });
  } catch (caught) {
    error = caught;
  }
  assert.ok(error, `${command} must reject at the direct CLI boundary`);
  assert.equal(error.code, 1);
  return error;
}

test("dema tell → suggests memory show bizra-context and help", async () => {
  const error = await runUnknownCommand("tell");
  assert.match(error.stdout, /Did you mean/);
  assert.match(error.stdout, /memory show bizra-context/);
  assert.match(error.stdout, /dema help/);
});

test("dema staus → suggests status", async () => {
  const error = await runUnknownCommand("staus");
  assert.match(error.stdout, /Did you mean/);
  assert.match(error.stdout, /dema status/);
});

test("dema xyzqwerty → couldn't find a close match message", async () => {
  const error = await runUnknownCommand("xyzqwerty");
  assert.match(error.stdout, /couldn't find a close match/);
});
