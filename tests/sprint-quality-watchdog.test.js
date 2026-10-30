import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  WATCHDOG_SCHEMA,
  WATCHDOG_TRUTH_LABEL,
  runSprintQualityWatchdog,
} from "../scripts/proof/sprint-quality-watchdog.mjs";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(
  new URL("../scripts/proof/sprint-quality-watchdog.mjs", import.meta.url),
);

test("runSprintQualityWatchdog writes LATEST receipt and returns schema", async () => {
  const logDir = await mkdtemp(join(tmpdir(), "dema-watchdog-"));
  try {
    const receipt = await runSprintQualityWatchdog({ logDir });
    assert.equal(receipt.schema, WATCHDOG_SCHEMA);
    assert.equal(receipt.truth_label, WATCHDOG_TRUTH_LABEL);
    assert.equal(receipt.boundary.authority_delta, 0);
    assert.equal(receipt.boundary.push, false);
    assert.ok(Array.isArray(receipt.checks));
    assert.ok(receipt.checks.some((c) => c.id === "outsider_first_run_loop"));
    const latest = JSON.parse(await readFile(join(logDir, "LATEST.json"), "utf8"));
    assert.equal(latest.receipt_sha256, receipt.receipt_sha256);
    // Pulse may be RED if release evaluate fails on this worktree; schema must still land.
    assert.equal(typeof receipt.ok, "boolean");
  } finally {
    await rm(logDir, { recursive: true, force: true });
  }
});

test("sprint-quality-watchdog.mjs CLI emits JSON receipt", async () => {
  const logDir = await mkdtemp(join(tmpdir(), "dema-watchdog-cli-"));
  try {
    const { stdout } = await execFileAsync(
      "node",
      [scriptPath],
      {
        encoding: "utf8",
        env: { ...process.env, DEMA_WATCHDOG_LOG_DIR: logDir },
      },
    ).catch((error) => ({ stdout: error.stdout ?? "" }));
    const receipt = JSON.parse(stdout);
    assert.equal(receipt.schema, WATCHDOG_SCHEMA);
  } finally {
    await rm(logDir, { recursive: true, force: true });
  }
});
