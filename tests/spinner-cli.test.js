// Integration tests verifying spinner is suppressed in non-TTY / --json contexts.
// execFile runs the CLI in a non-TTY subprocess — spinner must produce zero
// braille characters in captured stdout.

import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);

// Braille spinner frames that must never appear in non-TTY output.
const BRAILLE_PATTERN = /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/;

test("dema models scan --json stdout contains no braille spinner chars", async () => {
  const { stdout } = await execFileAsync("node", [
    cliPath,
    "models",
    "scan",
    "--json",
  ]);
  assert.doesNotMatch(
    stdout,
    BRAILLE_PATTERN,
    "--json output must not contain spinner frames",
  );
  // Also verify it is valid JSON (regression guard).
  assert.doesNotThrow(
    () => JSON.parse(stdout),
    "output must still be valid JSON",
  );
});

test("dema models scan (non-TTY subprocess) stdout contains no braille spinner chars", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "models", "scan"]);
  assert.doesNotMatch(
    stdout,
    BRAILLE_PATTERN,
    "non-TTY human output must not contain spinner frames",
  );
  // The human output must still be present.
  assert.match(stdout, /Dema models scan/);
});
