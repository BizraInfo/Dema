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
//
// The banner is printed only after BOTH listeners are confirmed serving. An
// earlier version printed it first and then let Next die of EADDRINUSE behind
// it, advertising a /realm URL that served nothing.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { URP0_TRUTH_LABEL } from "../packages/genesis/src/urp0-kernel.js";
import { admissionCard, admitHuman0, replayFromDisk, sealBlock0, worldState } from "./genesis/urp0-runtime.mjs";
import { BIND_HOST, DEFAULT_PORT, DEFAULT_UI_PORT, startUrp0Server } from "./genesis/urp0-server.mjs";
import { resolveStateRootDir } from "./genesis/urp0-store.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UI_DIR = join(REPO_ROOT, "packages", "dema-ui");
const UI_PORT = Number(process.env.GENESIS_UI_PORT ?? DEFAULT_UI_PORT);
const API_PORT = Number(process.env.GENESIS_API_PORT ?? DEFAULT_PORT);

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

// Is this loopback port bindable right now? Answered by actually binding it and
// letting go — the only check that agrees with what the servers will experience.
// Inherently racy against a process that grabs the port in the gap; that race is
// caught by the readiness wait, not by this.
export function portFree(port, host = BIND_HOST) {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(false));
    probe.once("listening", () => probe.close(() => resolve(true)));
    probe.listen(port, host);
  });
}

// 1 — validate prerequisites. Report every gap at once rather than one per run.
export async function preflight({ needUi, uiPort = UI_PORT, apiPort = API_PORT, uiDir = UI_DIR } = {}) {
  const gaps = [];
  const [major] = process.versions.node.split(".").map(Number);
  if (major < 20) gaps.push(`node_too_old:${process.versions.node}`);
  if (needUi && !existsSync(join(uiDir, "node_modules", ".bin", "next"))) {
    gaps.push("dema_ui_dependencies_absent: run `npm install` in packages/dema-ui, or pass --no-ui");
  }
  if (!(await portFree(apiPort))) {
    gaps.push(`api_port_in_use:${apiPort} — find the holder with \`ss -tlnp | grep :${apiPort}\`, or set GENESIS_API_PORT`);
  }
  if (needUi && !(await portFree(uiPort))) {
    gaps.push(`ui_port_in_use:${uiPort} — find the holder with \`ss -tlnp | grep :${uiPort}\`, or set GENESIS_UI_PORT`);
  }
  return gaps;
}

// Poll until the UI answers, or the child dies, or we run out of patience.
// Returns a named reason rather than a bare boolean so the caller can say what
// went wrong.
async function waitForUi(url, child, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) return `ui_exited_code_${child.exitCode}`;
    try {
      const res = await fetch(url);
      if (res.status < 500) return "ready";
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return "ui_timeout";
}

async function serve() {
  const noUi = process.argv.includes("--no-ui");
  const stateRootDir = resolveStateRootDir();

  const gaps = await preflight({ needUi: !noUi });
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

  // The API's CORS allowlist is derived from the port the UI will actually use.
  const { server, url } = await startUrp0Server({
    stateRootDir,
    worldCell: process.argv.includes("--world-cell"),
    repoRoot: REPO_ROOT,
    port: API_PORT,
    uiPort: UI_PORT,
  });

  let ui = null;
  let closing = false;
  const shutdown = (code = 0, message = "\n[genesis] stopping — journal left intact and reconstructable.") => {
    if (closing) return;
    closing = true;
    console.log(message);
    if (ui && ui.exitCode === null) ui.kill("SIGTERM");
    server.close(() => process.exit(code));
    setTimeout(() => process.exit(code), 3000).unref();
  };

  if (!noUi) {
    // Explicit -H 127.0.0.1: Next binds every interface by default, which this
    // runtime may never do.
    ui = spawn(join(UI_DIR, "node_modules", ".bin", "next"), ["dev", "-p", String(UI_PORT), "-H", BIND_HOST], {
      cwd: UI_DIR,
      stdio: "inherit",
      env: { ...process.env, NEXT_PUBLIC_URP0_API: url },
    });
    ui.on("error", (e) => shutdown(1, `[genesis] BLOCKED — UI failed to start: ${e.message}`));
    // A dead UI takes the whole runtime down. Leaving the API up while the World
    // Map is gone is how the banner came to advertise a URL that served nothing.
    ui.on("exit", (code) => {
      if (!closing && code !== 0) {
        shutdown(1, `[genesis] BLOCKED — the DEMA UI exited with code ${code}; shutting down the runtime.`);
      }
    });

    const uiState = await waitForUi(`http://${BIND_HOST}:${UI_PORT}/realm`, ui);
    if (uiState !== "ready") {
      shutdown(1, `[genesis] BLOCKED — DEMA UI never became ready (${uiState}).`);
      return;
    }
  }

  // 6/8 — the banner, printed only now that everything above is serving.
  const state = worldState(stateRootDir);
  console.log("");
  console.log(`[genesis] BIZRA WORLD — LOCAL GENESIS`);
  console.log(`[genesis] truth label      ${URP0_TRUTH_LABEL}`);
  console.log(`[genesis] URP-0            ${state.urp.state}  root=${state.urp.state_root ?? "—"}`);
  console.log(`[genesis] human            ${state.human ? state.human.human_id : "NOT ADMITTED"}`);
  console.log(`[genesis] state root dir   ${stateRootDir}`);
  console.log(`[genesis] runtime API      ${url}`);
  console.log(`[genesis] readiness        ${url}/readyz`);
  if (!noUi) console.log(`[genesis] DEMA World Map  http://${BIND_HOST}:${UI_PORT}/realm   [serving]`);
  console.log(`[genesis] public gateway   false · federation false · mint false`);
  if (!state.human) {
    console.log("");
    console.log(`[genesis] HUMAN-0 is not admitted. Exact consent required:`);
    console.log(`[genesis]   ${admissionCard().required_phrase}`);
  }
  console.log("");

  // 9 — terminate cleanly, preserving reconstructable state.
  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));
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

// Entrypoint guard so the helpers above stay importable by tests.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const command = process.argv[2];
  if (command === "admit") admit();
  else if (command === "verify") verify();
  else if (command === "seal") seal();
  else await serve();
}
