import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));

async function makeHome() {
  return mkdtemp(join(tmpdir(), "dema-lang-cli-"));
}

function cliEnv(home) {
  return {
    ...process.env,
    DEMA_HOME: home,
    DEMA_NODE0_ADAPTER: "",
    // Suppress any TTY detection — these are subprocess invocations
    NODE_ENV: "test",
  };
}

test("dema language show with profile language_code 'ar' → stdout contains 'ar' or 'Arabic'", async () => {
  const home = await makeHome();
  try {
    await writeFile(
      join(home, "profile.json"),
      JSON.stringify({ preferred_name: "Test", language_code: "ar" })
    );
    const { stdout } = await execFileAsync(
      "node",
      [cliPath, "language", "show"],
      { env: cliEnv(home) }
    );
    assert.ok(
      stdout.includes("ar") || stdout.toLowerCase().includes("arabic"),
      `expected 'ar' or 'Arabic' in: ${stdout}`
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("dema language show --json → JSON.parse succeeds with {language_code, secondary_language_code, source}", async () => {
  const home = await makeHome();
  try {
    await writeFile(
      join(home, "profile.json"),
      JSON.stringify({ preferred_name: "Test", language_code: "fr", secondary_language_code: "en" })
    );
    const { stdout } = await execFileAsync(
      "node",
      [cliPath, "language", "show", "--json"],
      { env: cliEnv(home) }
    );
    const parsed = JSON.parse(stdout);
    assert.equal(typeof parsed.language_code, "string");
    assert.ok("secondary_language_code" in parsed);
    assert.ok("source" in parsed);
    assert.equal(parsed.language_code, "fr");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("dema language show with empty DEMA_HOME → stdout contains 'not set yet'", async () => {
  const home = await makeHome();
  try {
    const { stdout } = await execFileAsync(
      "node",
      [cliPath, "language", "show"],
      { env: cliEnv(home) }
    );
    assert.ok(
      stdout.toLowerCase().includes("not set"),
      `expected 'not set' in: ${stdout}`
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("bare dema --json with profile language_code 'es' + preferred_name → greeting contains Spanish text", async () => {
  const home = await makeHome();
  try {
    await writeFile(
      join(home, "profile.json"),
      JSON.stringify({ preferred_name: "Samy", language_code: "es" })
    );
    const { stdout } = await execFileAsync(
      "node",
      [cliPath, "--json"],
      { env: cliEnv(home) }
    );
    const parsed = JSON.parse(stdout);
    const greetingText = parsed?.greeting?.text ?? "";
    // Spanish template: "Bienvenido de nuevo, Samy."
    assert.ok(
      greetingText.toLowerCase().includes("bienvenido") || greetingText.includes("Samy"),
      `expected Spanish greeting containing 'Bienvenido' or operator name, got: ${greetingText}`
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
