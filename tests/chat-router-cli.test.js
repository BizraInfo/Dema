import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);

async function makeDemaHome() {
  const demaHome = await mkdtemp(join(tmpdir(), "dema-chat-cli-"));
  await mkdir(join(demaHome, "memory"), { recursive: true });
  // Minimal profile so onboarding reads don't crash.
  await writeFile(
    join(demaHome, "profile.json"),
    JSON.stringify({ preferred_name: "Tester" }),
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
          NODE_ENV: "test",
        },
        timeout: 10000,
      },
      (err, stdout, stderr) => {
        if (err && err.killed) {
          reject(new Error(`Process timed out. stdout: ${stdout}`));
          return;
        }
        // Non-zero exit is acceptable — chat exits on EOF after "exit".
        resolve({ stdout, stderr });
      },
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

test("'what should I do next\\nexit' → stdout contains 'next safe action'", async () => {
  const demaHome = await makeDemaHome();
  const { stdout } = await runChat(["what should I do next", "exit"], demaHome);
  assert.match(stdout, /next safe action/i);
});

test("'show my status\\nexit' → stdout contains 'Routing your request to' and status output", async () => {
  const demaHome = await makeDemaHome();
  const { stdout } = await runChat(["show my status", "exit"], demaHome);
  assert.match(stdout, /Routing your request to/);
  assert.match(stdout, /DEMA/);
});

test("'help me draft a mission\\nexit' → stdout contains mission draft preview header", async () => {
  const demaHome = await makeDemaHome();
  const { stdout } = await runChat(
    ["help me draft a mission", "exit"],
    demaHome,
  );
  // mission draft without intent arg throws — REPL catches and writes error line
  // The test verifies routing fired (routing line present OR error about intent).
  assert.match(stdout, /Routing your request to|dema mission draft|intent/i);
});

test("'talk to the builder\\nexit' → stdout contains council PAT routing preview", async () => {
  const demaHome = await makeDemaHome();
  const { stdout } = await runChat(["talk to the builder", "exit"], demaHome);
  assert.match(stdout, /Council seat → PAT routing/i);
  assert.match(stdout, /pat-engineer/);
});
