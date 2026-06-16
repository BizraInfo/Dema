import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  FOUNDATION_PERSIST_CONSENT_PHRASE,
  FOUNDATION_EPHEMERAL_PHRASE,
  BOOTSTRAP_FOUNDATION_PERSIST_SCHEMA,
} from "../packages/core/src/bootstrap-foundation-persist.js";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const CLI = join(REPO_ROOT, "apps/cli/src/index.js");

function freshHome() {
  return mkdtempSync(join(tmpdir(), "dema-fcli-"));
}

// Captures both success (exit 0) and refusal (exit 1) without throwing.
function runCLI(args, home) {
  try {
    const stdout = execFileSync("node", [CLI, ...args], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        NO_COLOR: "1",
        NODE_ENV: "test",
        DEMA_NO_TUI: "1",
        DEMA_HOME: home,
      },
      timeout: 15000,
    }).toString();
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.status ?? 1, stdout: (e.stdout ?? "").toString() };
  }
}

test("foundation create --consent GO --json → writes the foundation under DEMA_HOME (exit 0)", () => {
  const home = freshHome();
  const { code, stdout } = runCLI(
    [
      "foundation",
      "create",
      "--consent",
      FOUNDATION_PERSIST_CONSENT_PHRASE,
      "--json",
    ],
    home,
  );
  assert.equal(code, 0);
  const env = JSON.parse(stdout);
  assert.equal(env.schema, BOOTSTRAP_FOUNDATION_PERSIST_SCHEMA);
  assert.equal(env.persisted, true);
  assert.ok(existsSync(join(home, "profile.json")), "profile.json written");
  assert.ok(existsSync(join(home, "config.local.json")), "config written");
  assert.ok(existsSync(join(home, "receipts")), "receipts dir written");
});

test("foundation create (no consent) → consent moment, exit 1, nothing written", () => {
  const home = freshHome();
  const { code, stdout } = runCLI(["foundation", "create"], home);
  assert.equal(code, 1, "no consent → action not performed");
  assert.ok(
    stdout.includes(FOUNDATION_PERSIST_CONSENT_PHRASE),
    "consent moment shows the exact grant phrase",
  );
  assert.deepEqual(readdirSync(home), [], "no write without consent");
});

test("foundation create --consent SKIP → ephemeral, nothing saved, exit 0", () => {
  const home = freshHome();
  const { code, stdout } = runCLI(
    ["foundation", "create", "--consent", FOUNDATION_EPHEMERAL_PHRASE],
    home,
  );
  assert.equal(code, 0);
  assert.ok(/nothing was saved/i.test(stdout));
  assert.deepEqual(readdirSync(home), [], "ephemeral writes nothing");
});

test("foundation create --consent GO --dry-run → no write", () => {
  const home = freshHome();
  const { code } = runCLI(
    [
      "foundation",
      "create",
      "--consent",
      FOUNDATION_PERSIST_CONSENT_PHRASE,
      "--dry-run",
    ],
    home,
  );
  assert.equal(code, 0);
  assert.deepEqual(readdirSync(home), [], "dry run writes nothing");
});
