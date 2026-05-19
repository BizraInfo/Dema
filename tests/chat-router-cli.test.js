import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));

async function makeDemaHome() {
  const demaHome = await mkdtemp(join(tmpdir(), "dema-chat-cli-"));
  await mkdir(join(demaHome, "memory"), { recursive: true });
  // Minimal profile so onboarding reads don't crash.
  await writeFile(
    join(demaHome, "profile.json"),
    JSON.stringify({ preferred_name: "Tester" })
  );
  return demaHome;
}

function runChat(stdinLines, demaHome) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "node",
      [cliPath, "chat"],
      {
        env: {
          ...process.env,
          DEMA_BANNER_INTERACTIVE: "0",
          DEMA_HOME: demaHome,
          NODE_ENV: "test"
        },
        timeout: 10000
      },
      (err, stdout, stderr) => {
        if (err && err.killed) {
          reject(new Error(`Process timed out. stdout: ${stdout}`));
          return;
        }
        // Non-zero exit is acceptable — chat exits on EOF after "exit".
        resolve({ stdout, stderr });
      }
    );
    // Write all lines then close stdin to trigger EOF.
    child.stdin.write(stdinLines.join("\n") + "\n");
    child.stdin.end();
  });
}

test("'what is bizra\\nexit' → stdout contains BIZRA and concept response", async () => {
  const demaHome = await makeDemaHome();
  const { stdout } = await runChat(["what is bizra", "exit"], demaHome);
  assert.match(stdout, /BIZRA/);
  assert.match(stdout, /I can answer that from my local knowledge/);
});

test("'stauts\\nexit' → stdout contains 'Did you mean' and 'status'", async () => {
  const demaHome = await makeDemaHome();
  const { stdout } = await runChat(["stauts", "exit"], demaHome);
  assert.match(stdout, /Did you mean/);
  assert.match(stdout, /status/);
});

test("'hello\\nexit' → stdout contains 'not a chat agent yet'", async () => {
  const demaHome = await makeDemaHome();
  const { stdout } = await runChat(["hello", "exit"], demaHome);
  assert.match(stdout, /not a chat agent yet/);
});
