#!/usr/bin/env node
/**
 * SPRINT-QUALITY-WATCHDOG-1A — unattended quality pulse for Dema-clean.
 *
 * Runs while the founder rests: outsider loop + focused first-run/outsider
 * tests + release-readiness evaluate. Writes a JSON receipt under
 * /data/bizra/logs/dema-sprint-watchdog/ (or DEMA_WATCHDOG_LOG_DIR).
 *
 * Exit 0 = pulse GREEN. Exit 1 = drift / RED (systemd will record failure).
 * Does NOT push, merge, mint, start dema daemons, or mutate ~/.dema.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { runOutsiderFirstRunLoop } from "./outsider-first-run-loop.mjs";
import {
  buildReleaseReadinessReport,
  evaluateReleaseReadiness,
  exitCodeFromEvaluation,
} from "../release-readiness.mjs";

export const WATCHDOG_SCHEMA = "bizra.dema.sprint_quality_watchdog.v0.1";
export const WATCHDOG_TRUTH_LABEL = "SPRINT_QUALITY_WATCHDOG_LOCAL_PULSE";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEFAULT_LOG_DIR = "/data/bizra/logs/dema-sprint-watchdog";

function runNode(args, { timeoutMs = 120_000 } = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: REPO,
    encoding: "utf8",
    timeout: timeoutMs,
    env: { ...process.env, DEMA_NO_TUI: "1", NO_COLOR: "1" },
  });
  return {
    exitCode: result.status ?? -1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function gitHead() {
  const r = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: REPO,
    encoding: "utf8",
  });
  return (r.stdout || "").trim() || "UNKNOWN";
}

function gitDirty() {
  const r = spawnSync("git", ["status", "--porcelain"], {
    cwd: REPO,
    encoding: "utf8",
  });
  return (r.stdout || "").trim().length > 0;
}

/**
 * One watchdog pulse. Pure orchestration + disk receipts only.
 */
export async function runSprintQualityWatchdog({
  logDir = process.env.DEMA_WATCHDOG_LOG_DIR || DEFAULT_LOG_DIR,
  now = new Date(),
} = {}) {
  mkdirSync(logDir, { recursive: true });
  const started = now.toISOString();
  const head = gitHead();
  const dirty = gitDirty();
  const checks = [];

  // 1) Outsider local loop
  let outsider;
  try {
    outsider = runOutsiderFirstRunLoop();
    checks.push({
      id: "outsider_first_run_loop",
      ok: outsider.ok === true,
      detail: { doctor_exit: outsider.doctor_exit, schema: outsider.schema },
    });
  } catch (error) {
    checks.push({
      id: "outsider_first_run_loop",
      ok: false,
      detail: { error: String(error?.message || error) },
    });
  }

  // 2) Focused tests that pin the outsider + release-teeth contract.
  // Do NOT include delivery-check here: it runs git diff --check and goes RED
  // on any dirty worktree whitespace — that is operator WIP noise, not sprint
  // shape drift. delivery-check stays an explicit pre-push gate.
  const testRun = runNode(
    [
      "--test",
      "tests/outsider-first-run-loop.test.js",
      "tests/first-run.test.js",
      "tests/release-readiness.test.js",
    ],
    { timeoutMs: 180_000 },
  );
  checks.push({
    id: "focused_gate_suite",
    ok: testRun.exitCode === 0,
    detail: { exitCode: testRun.exitCode },
  });

  // 3) Release readiness evaluate (score + CLI teeth stay honest)
  let release;
  try {
    const report = await buildReleaseReadinessReport({});
    const evaluation = evaluateReleaseReadiness(report);
    release = {
      ok: evaluation.ok === true,
      exitCode: exitCodeFromEvaluation(evaluation),
      score: report.readiness_score,
      reasons: evaluation.reasons,
    };
    checks.push({
      id: "release_readiness_evaluate",
      ok: evaluation.ok === true,
      detail: release,
    });
  } catch (error) {
    checks.push({
      id: "release_readiness_evaluate",
      ok: false,
      detail: { error: String(error?.message || error) },
    });
  }

  const ok = checks.every((c) => c.ok === true);
  const receipt = {
    schema: WATCHDOG_SCHEMA,
    truth_label: WATCHDOG_TRUTH_LABEL,
    started_at: started,
    finished_at: new Date().toISOString(),
    ok,
    repo: REPO,
    head,
    dirty_tree: dirty,
    checks,
    boundary: {
      network: false,
      mint: false,
      push: false,
      merge: false,
      operator_home_mutated: false,
      authority_delta: 0,
    },
    what_this_proves:
      "Periodic local quality pulse: outsider loop + focused gates + release evaluate",
    what_this_does_not_prove:
      "Unattended agent coding, Node0 runtime green doctor, remote CI, or push",
  };

  const body = `${JSON.stringify(receipt)}\n`;
  const hash = createHash("sha256").update(body).digest("hex");
  receipt.receipt_sha256 = hash;
  const stamped = `${JSON.stringify(receipt)}\n`;

  const day = started.slice(0, 10);
  const jsonlPath = join(logDir, `${day}.jsonl`);
  const latestPath = join(logDir, "LATEST.json");
  appendFileSync(jsonlPath, stamped, "utf8");
  writeFileSync(latestPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");

  return receipt;
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    const receipt = await runSprintQualityWatchdog();
    console.log(JSON.stringify(receipt, null, 2));
    process.exitCode = receipt.ok ? 0 : 1;
  } catch (error) {
    console.error(String(error?.stack || error));
    process.exitCode = 1;
  }
}
