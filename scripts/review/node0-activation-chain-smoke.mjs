#!/usr/bin/env node
// NODE0-ACTIVATION-CHAIN-SMOKE-1A — read-only CLI smoke for activation chain + self-loop.

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildNode0ActivationChainSmokeReport,
  verifyNode0ActivationChainSmokeReport,
  SMOKE_GOAL,
  SMOKE_PAIN,
} from "../../packages/core/src/node0-activation-chain-smoke.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const JSON_MODE = process.argv.includes("--json");

function cleanBridgeEnv(env = process.env) {
  const next = { ...env, NO_COLOR: "1", DEMA_NO_TUI: "1" };
  for (const key of [
    "DEMA_NODE0_ADAPTER",
    "DEMA_GATEWAY_URL",
    "DEMA_NODE0_STATUS_COMMAND",
    "DEMA_OLLAMA_URL",
    "DEMA_LM_STUDIO_URL",
    "DEMA_LLAMACPP_URL",
  ]) {
    delete next[key];
  }
  return next;
}

export function runNode0ActivationChainSmoke({
  root = REPO_ROOT,
  execFile = execFileSync,
  expectSelfLoop = true,
} = {}) {
  const cli = join(root, "apps/cli/src/index.js");
  const args = [
    cli,
    "node0",
    "chain",
    "--pain",
    SMOKE_PAIN,
    "--goal",
    SMOKE_GOAL,
    "--json",
  ];
  if (expectSelfLoop) args.push("--self-loop");

  let chainReport;
  let parseError = null;
  try {
    const stdout = execFile("node", args, {
      cwd: root,
      env: cleanBridgeEnv(),
      encoding: "utf8",
      timeout: 60_000,
    });
    chainReport = JSON.parse(stdout);
  } catch (err) {
    parseError = err?.message ?? String(err);
  }

  const smokeReport = buildNode0ActivationChainSmokeReport({
    report: chainReport,
    expectSelfLoop,
  });
  if (parseError) {
    return Object.freeze({
      ok: false,
      parse_error: parseError,
      smoke: smokeReport,
      chain: chainReport ?? null,
      verified: verifyNode0ActivationChainSmokeReport(smokeReport),
    });
  }

  const verified = verifyNode0ActivationChainSmokeReport(smokeReport);
  return Object.freeze({
    ok: smokeReport.ok && verified.ok,
    parse_error: null,
    smoke: smokeReport,
    chain: chainReport,
    verified,
  });
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const result = runNode0ActivationChainSmoke();
  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA · node0 activation chain smoke (read-only)");
    console.log(`  self_loop: ${result.smoke.expect_self_loop}`);
    console.log(`  chain_status: ${result.chain?.chain_status ?? "—"}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (result.parse_error) {
      console.log(`    parse_error: ${result.parse_error}`);
    }
    for (const finding of result.smoke.findings) {
      console.log(`    ${finding.code}: ${finding.message}`);
    }
  }
  if (!result.ok) process.exit(1);
}
