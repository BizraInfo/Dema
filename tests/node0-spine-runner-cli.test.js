import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { NODE0_SPINE_RUNNER_GO_PHRASE } from "../packages/core/src/node0-spine-runner.js";

const BIN = fileURLToPath(new URL("../bin/dema", import.meta.url));

test("dema node0 spine run --json completes with exact consent", () => {
  const out = execFileSync(
    "node",
    [
      BIN,
      "node0",
      "spine",
      "run",
      "--consent",
      NODE0_SPINE_RUNNER_GO_PHRASE,
      "--json",
    ],
    {
      env: { ...process.env, NO_COLOR: "1", DEMA_NO_TUI: "1" },
      timeout: 30000,
    },
  ).toString();
  const report = JSON.parse(out);
  assert.equal(report.ok, true);
  assert.equal(report.truth_label, "NODE0_MEASURED_PROOF_SPINE_SANDBOX_RUN");
  assert.match(report.execute_content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.match(report.proof_chain_head_hash, /^sha256:[0-9a-f]{64}$/);
});

test("dema node0 spine run fails closed without --consent", () => {
  assert.throws(
    () =>
      execFileSync("node", [BIN, "node0", "spine", "run", "--json"], {
        env: { ...process.env, NO_COLOR: "1", DEMA_NO_TUI: "1" },
        timeout: 10000,
        stdio: ["ignore", "pipe", "pipe"],
      }),
    (err) => err.status !== 0 && /Usage/.test(String(err.stderr)),
  );
});

test("dema node0 spine run removes auto-created temp sandbox after exit", () => {
  const out = execFileSync(
    "node",
    [
      BIN,
      "node0",
      "spine",
      "run",
      "--consent",
      NODE0_SPINE_RUNNER_GO_PHRASE,
      "--json",
    ],
    {
      env: { ...process.env, NO_COLOR: "1", DEMA_NO_TUI: "1" },
      timeout: 30000,
    },
  ).toString();
  const report = JSON.parse(out);
  assert.equal(report.ok, true);
  assert.ok(report.sandbox_root);
  assert.equal(existsSync(report.sandbox_root), false);
});

test("dema node0 spine run fails closed with wrong --consent", () => {
  assert.throws(
    () =>
      execFileSync(
        "node",
        [BIN, "node0", "spine", "run", "--consent", "wrong", "--json"],
        {
          env: { ...process.env, NO_COLOR: "1", DEMA_NO_TUI: "1" },
          timeout: 10000,
          stdio: ["ignore", "pipe", "pipe"],
        },
      ),
    (err) => {
      if (err.status === 0) return false;
      const report = JSON.parse(String(err.stdout));
      return report.ok === false && report.blocked_by.includes("consent_phrase_mismatch");
    },
  );
});
