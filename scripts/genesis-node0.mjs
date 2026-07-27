#!/usr/bin/env node
// BIZRA-GENESIS-NODE0-URP-LOCAL-IGNITION-1A · GENESIS_RUNTIME_SPINE_1A.0
//
//   npm run genesis:node0            start the local constitutional world
//   npm run genesis:node0 -- --no-ui backend only
//   node scripts/genesis-node0.mjs admit --consent "<exact phrase>"
//   node scripts/genesis-node0.mjs verify
//   node scripts/genesis-node0.mjs seal
//
// Everything binds 127.0.0.1. No tunnel, no DNS, no reverse proxy, no public
// deployment. Ctrl-C terminates cleanly and leaves the journal reconstructable.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { URP0_TRUTH_LABEL } from "../packages/genesis/src/urp0-kernel.js";
import { admissionCard, admitHuman0, replayFromDisk, sealBlock0, worldState } from "./genesis/urp0-runtime.mjs";
import { BIND_HOST, DEFAULT_PORT, startUrp0Server } from "./genesis/urp0-server.mjs";
import { resolveStateRootDir } from "./genesis/urp0-store.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UI_DIR = join(REPO_ROOT, "packages", "dema-ui");
const UI_PORT = Number(process.env.GENESIS_UI_PORT ?? 3000);
const API_PORT = Number(process.env.GENESIS_API_PORT ?? DEFAULT_PORT);

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

// 1 — validate prerequisites. Report every gap at once rather than one per run.
function prerequisites({ needUi }) {
  const gaps = [];
  const [major] = process.versions.node.split(".").map(Number);
  if (major < 20) gaps.push(`node_too_old:${process.versions.node}`);
  if (needUi && !existsSync(join(UI_DIR, "node_modules", ".bin", "next"))) {
    gaps.push("dema_ui_dependencies_absent: run `npm install` in packages/dema-ui, or pass --no-ui");
  }
  return gaps;
}

async function serve() {
  const noUi = process.argv.includes("--no-ui");
  const stateRootDir = resolveStateRootDir();

  const gaps = prerequisites({ needUi: !noUi });
  if (gaps.length > 0) {
    console.error(`[genesis] BLOCKED — prerequisites unmet:\n  ${gaps.join("\n  ")}`);
    process.exit(1);
  }

  // 2 — initialize or reconstruct URP-0 from persisted evidence alone.
  const disk = replayFromDisk(stateRootDir);
  if (!disk.ok && disk.events_applied > 0) {
    console.error(`[genesis] BLOCKED — journal will not replay: ${JSON.stringify(disk.blocked_by)}`);
    console.error(`[genesis] evidence preserved at ${stateRootDir} — nothing was reset.`);
    process.exit(1);
  }

  const { server, url } = await startUrp0Server({ stateRootDir, repoRoot: REPO_ROOT, port: API_PORT });

  let ui = null;
  if (!noUi) {
    // Explicit -H 127.0.0.1: Next binds every interface by default, which this
    // runtime may never do.
    ui = spawn(join(UI_DIR, "node_modules", ".bin", "next"), ["dev", "-p", String(UI_PORT), "-H", BIND_HOST], {
      cwd: UI_DIR,
      stdio: "inherit",
      env: { ...process.env, NEXT_PUBLIC_URP0_API: url },
    });
    ui.on("error", (e) => console.error(`[genesis] UI failed to start: ${e.message}`));
  }

  const state = worldState(stateRootDir);
  console.log("");
  console.log(`[genesis] BIZRA WORLD — LOCAL GENESIS`);
  console.log(`[genesis] truth label      ${URP0_TRUTH_LABEL}`);
  console.log(`[genesis] URP-0            ${state.urp.state}  root=${state.urp.state_root ?? "—"}`);
  console.log(`[genesis] human            ${state.human ? state.human.human_id : "NOT ADMITTED"}`);
  console.log(`[genesis] state root dir   ${stateRootDir}`);
  console.log(`[genesis] runtime API      ${url}`);
  console.log(`[genesis] readiness        ${url}/readyz`);
  if (!noUi) console.log(`[genesis] DEMA World Map  http://${BIND_HOST}:${UI_PORT}/realm`);
  console.log(`[genesis] public gateway   false · federation false · mint false`);
  if (!state.human) {
    console.log("");
    console.log(`[genesis] HUMAN-0 is not admitted. Exact consent required:`);
    console.log(`[genesis]   ${admissionCard().required_phrase}`);
  }
  console.log("");

  // 9 — terminate cleanly, preserving reconstructable state.
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    console.log("\n[genesis] stopping — journal left intact and reconstructable.");
    if (ui) ui.kill("SIGTERM");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function admit() {
  const stateRootDir = resolveStateRootDir();
  const phrase = argValue("--consent");
  if (phrase === undefined) {
    console.error(`[genesis] --consent required. Exact phrase:\n  ${admissionCard().required_phrase}`);
    process.exit(1);
  }
  const out = admitHuman0(stateRootDir, { phrase, now_iso: new Date().toISOString() });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}

function verify() {
  const stateRootDir = resolveStateRootDir();
  const disk = replayFromDisk(stateRootDir);
  const state = worldState(stateRootDir);
  console.log(JSON.stringify({
    truth_label: URP0_TRUTH_LABEL,
    state_root_dir: stateRootDir,
    replay: disk,
    urp_state: state.urp.state,
    state_permissions: state.state_permissions,
    block0: state.block0,
  }, null, 2));
  process.exit(disk.ok ? 0 : 1);
}

function seal() {
  const stateRootDir = resolveStateRootDir();
  const out = sealBlock0(stateRootDir, {
    repository_base_commit: argValue("--base") ?? null,
    implementation_commit: argValue("--commit") ?? null,
    constitution_source_hash: argValue("--constitution") ?? null,
    topology_source_hash: argValue("--topology") ?? null,
  });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}

const command = process.argv[2];
if (command === "admit") admit();
else if (command === "verify") verify();
else if (command === "seal") seal();
else await serve();
