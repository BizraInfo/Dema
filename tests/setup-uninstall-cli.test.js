import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import {
  runSetup,
  checkSetup,
  REMOVE_CONSENT_PHRASE,
} from "../packages/installer/src/setup.js";

const CLI = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function runUninstall(env) {
  const result = spawnSync(
    "node",
    [
      CLI,
      "uninstall",
      "--dry-run",
      "--consent",
      REMOVE_CONSENT_PHRASE,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, DEMA_NO_TUI: "1", ...env },
    },
  );
  return {
    ...result,
    payload: JSON.parse(result.stdout),
  };
}

test("CLI uninstall refuses repository DEMA_HOME before dry-run planning", () => {
  const result = runUninstall({ DEMA_HOME: REPO_ROOT });

  assert.equal(result.status, 1);
  assert.equal(result.payload.removed, false);
  assert.equal(result.payload.reason, "unsafe_remove_root");
  assert.equal(result.payload.dry_run, true);
});

test("CLI uninstall dry-run still works for a valid Dema setup root", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-uninstall-cli-test-"));
  await runSetup(home);

  const result = runUninstall({ DEMA_HOME: home });

  assert.equal(result.status, 0);
  assert.equal(result.payload.removed, false);
  assert.equal(result.payload.reason, "dry_run");
  assert.ok(result.payload.would_remove.includes(join(home, "profile.json")));
  assert.ok(result.payload.would_remove.includes(join(home, ".dema-root.json")));
  assert.ok(result.payload.would_remove.includes(join(home, "receipts")));

  const check = await checkSetup(home);
  assert.equal(check.verdict, "INTACT");
});
