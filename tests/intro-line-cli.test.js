// Integration tests for the intro-line feature (Task #9).
//
// All tests run against an isolated DEMA_HOME to avoid touching ~/.dema.
// Non-TTY subprocess always receives JSON homebase output but the intro is
// prepended on stderr OR stdout before the JSON blob when the operator is new.
// Because execFileAsync captures stdout, we verify the raw stdout string —
// the intro is printed to stdout before the JSON blob.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);

async function freshEnv() {
  const root = await mkdtemp(join(tmpdir(), "dema-intro-cli-"));
  return {
    root,
    env: {
      ...process.env,
      DEMA_HOME: root,
      DEMA_NODE0_ADAPTER: "",
      // NODE_ENV=test suppresses TUI; non-TTY subprocess also does this naturally.
    },
  };
}

async function writeCounter(root, seenCount, suppressedBy = "count-cap") {
  await mkdir(join(root, "state"), { recursive: true });
  await writeFile(
    join(root, "state", "intro-seen-count.json"),
    JSON.stringify(
      {
        schema: "bizra.dema.intro_state.v0.1",
        seenCount,
        lastSeen: new Date().toISOString(),
        suppressedBy,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
}

test("bare dema with empty tmpdir → stderr contains 'local-first sovereign-AI node companion' (non-TTY sends intro to stderr)", async () => {
  const { root, env } = await freshEnv();
  try {
    const result = await execFileAsync("node", [cliPath], { env }).catch(
      (e) => e,
    );
    // Non-TTY mode routes intro to stderr so stdout stays JSON-parseable.
    assert.ok(
      result.stderr.includes("local-first sovereign-AI node companion"),
      `Expected intro in stderr. Got stderr:\n${result.stderr}\nstdout:\n${result.stdout}`,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("after 3 bare dema runs → 4th run does NOT contain intro text in stderr", async () => {
  const { root, env } = await freshEnv();
  try {
    // Pre-load counter at 3 (cap reached).
    await writeCounter(root, 3, "count-cap");
    const result = await execFileAsync("node", [cliPath], { env }).catch(
      (e) => e,
    );
    assert.ok(
      !result.stderr.includes("local-first sovereign-AI node companion"),
      `Expected intro absent on 4th run. Got stderr:\n${result.stderr}`,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("dema today (no flags) → stdout does NOT contain 'undefined'", async () => {
  const { root, env } = await freshEnv();
  try {
    const result = await execFileAsync("node", [cliPath, "today"], {
      env,
    }).catch((e) => e);
    assert.ok(
      !result.stdout.includes("undefined"),
      `'undefined' found in dema today output. Got:\n${result.stdout}`,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
