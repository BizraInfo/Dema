#!/usr/bin/env node
/**
 * OUTSIDER-FIRST-RUN-LOOP-1A — one hermetic command an outsider (or sleeping
 * founder) can run to prove the local companion loop without a global `dema`
 * on PATH and without mutating ~/.dema.
 *
 * Exit 0 = loop completed with honest doctor block allowed on a fresh home.
 * Exit 1 = a step that must succeed failed, or the harness itself broke.
 *
 * Boundary: no network, no mint, no daemon start, no foreign-repo writes.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const OUTSIDER_LOOP_SCHEMA = "bizra.dema.outsider_first_run_loop.v0.1";
export const OUTSIDER_LOOP_TRUTH_LABEL = "OUTSIDER_FIRST_RUN_LOOP_MEASURED_LOCAL";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEMA_BIN = join(REPO, "bin/dema");
const NODE_DIR = dirname(process.execPath);

export function leanEnv(home) {
  const env = {
    ...process.env,
    PATH: `/usr/bin:/bin:${NODE_DIR}`,
    DEMA_HOME: home,
    DEMA_NO_TUI: "1",
    NO_COLOR: "1",
    NODE_ENV: "test",
  };
  // Proof claims network:false — strip operator bridge URLs so status/doctor
  // cannot reach a live gateway from ambient process.env.
  for (const key of [
    "DEMA_GATEWAY_URL",
    "DEMA_NODE0_ADAPTER",
    "DEMA_NODE0_STATUS_COMMAND",
    "DEMA_LLAMACPP_URL",
    "DEMA_OLLAMA_URL",
    "DEMA_LMSTUDIO_URL",
  ]) {
    delete env[key];
  }
  return env;
}

function runStep(home, argv, { allowFail = false } = {}) {
  const result = spawnSync(process.execPath, [DEMA_BIN, ...argv], {
    cwd: REPO,
    encoding: "utf8",
    timeout: 60_000,
    env: leanEnv(home),
  });
  const exitCode = result.status ?? -1;
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  if (!allowFail && exitCode !== 0) {
    throw new Error(
      `step failed: node bin/dema ${argv.join(" ")} exited ${exitCode}\n${stderr || stdout}`,
    );
  }
  return {
    argv: ["node", "bin/dema", ...argv],
    exitCode,
    stdout_bytes: Buffer.byteLength(stdout, "utf8"),
    stdout_head: stdout.slice(0, 240),
    ok: allowFail ? exitCode === 0 || exitCode === 1 : exitCode === 0,
  };
}

/**
 * Drive the outsider-proof local loop against a disposable DEMA_HOME.
 */
export function runOutsiderFirstRunLoop({ home } = {}) {
  const owned = home === undefined;
  const loopHome = owned ? mkdtempSync(join(tmpdir(), "dema-outsider-loop-")) : home;
  const steps = [];
  const boundary = Object.freeze({
    network: false,
    mint: false,
    daemon_started: false,
    operator_home_mutated: false,
    global_dema_required: false,
    authority_delta: 0,
  });

  try {
    steps.push(runStep(loopHome, ["--version"]));
    steps.push(runStep(loopHome, ["welcome"]));
    steps.push(runStep(loopHome, ["setup"]));
    steps.push(runStep(loopHome, ["status"]));
    steps.push(runStep(loopHome, ["doctor"], { allowFail: true }));
    steps.push(runStep(loopHome, ["first-run", "--plan-only", "--json"]));

    const doctor = steps.find((s) => s.argv.includes("doctor"));
    const version = steps[0];
    const ok =
      steps.every((s) => s.ok) &&
      typeof version.stdout_head === "string" &&
      /dema\s+\d/i.test(version.stdout_head);

    return Object.freeze({
      schema: OUTSIDER_LOOP_SCHEMA,
      truth_label: OUTSIDER_LOOP_TRUTH_LABEL,
      ok,
      steps: Object.freeze(steps.map((s) => Object.freeze({ ...s }))),
      doctor_may_exit_1: true,
      doctor_exit: doctor?.exitCode ?? null,
      path_policy: "PATH=/usr/bin:/bin:<nodeDir> — global dema must not be required",
      dema_home: loopHome,
      owned_temp_home: owned,
      boundary,
      what_this_proves:
        "Zero-install node bin/dema welcome→setup→status→doctor(+first-run plan) completes under reduced PATH without touching ~/.dema",
      what_this_does_not_prove:
        "Node0 runtime readiness, green doctor, CI hermetic suite, push/merge, or corpus absorption",
    });
  } finally {
    if (owned) {
      try {
        rmSync(loopHome, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    }
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    const report = runOutsiderFirstRunLoop();
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.ok ? 0 : 1;
  } catch (error) {
    console.error(String(error?.stack || error));
    process.exitCode = 1;
  }
}
