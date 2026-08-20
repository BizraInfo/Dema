// NODE0-RECOVERY-OBSERVATION-1A — the proof-only recovery supervisor.
//
// TRUTH LABEL: PROOF_ONLY_RUNTIME_PRODUCER. This CONDUCTS. It observes a
// worker's liveness, detects an unexpected death, decides that recovery is
// required, and starts a replacement. Calling it a passive watcher would be
// false: if it detects a death and starts B, it is conducting recovery.
//
// PLACEMENT (operator ruling 2026-08-10, option 2). It lives BEHIND the governed
// Node0 runtime boundary — `createNode0Adapter()` in
// packages/node-adapter/src/node0-adapter.js, whose far side ADR-042 defines as
// "processes the operator placed on the machine", reached through the
// DEMA_NODE0_STATUS_COMMAND bridge. Dema remains the face: it can only READ this
// runtime, through three verbs (status / listReceipts / proposeBoundedDiagnostic),
// and only when the operator explicitly sets that env var. Nothing in the Dema
// face invokes it, and no Dema-face file was modified to make it reachable.
//
//   node scripts/proof/node0-recovery-supervisor.mjs <DEMA_HOME> [--status]
//
// --status emits the bizra.dema.status.v0.1 shape the governed adapter
// normalizes, so the boundary binding is exercised rather than asserted.
//
// IT MUST NOT CERTIFY THE INVARIANT. It records what it did; a separate observer
// process re-derives the evidence. Per the ruling, the conductor never grades
// its own recovery.
//
// BOUNDARIES: no network, no model, no ambient daemon — it runs one bounded
// mission and exits. authority_delta 0.

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKER = join(HERE, "node0-recovery-worker.mjs");
const DEMA_HOME = process.argv[2];
const STATUS_MODE = process.argv.includes("--status");
const NO_RECOVER = process.argv.includes("--no-recover"); // control: watch, never act
const REQUIRE_DEAD = !process.argv.includes("--recover-while-alive"); // control: ignore liveness

const dir = join(DEMA_HOME, "node0", "recovery");
const p = (n) => join(dir, n);
// Write via tmp+rename: workers and the supervisor die by SIGKILL in this proof,
// and a kill landing mid-write must never leave a torn JSON file for a poller
// (fired in CI as RCA-03 "Unexpected end of JSON input"). rename() is atomic
// within the directory, so readers see the old bytes or the new — never partial.
const write = (n, o) => {
  mkdirSync(dirname(p(n)), { recursive: true });
  const tmp = `${p(n)}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(o, null, 2));
  renameSync(tmp, p(n));
};
const read = (n) => (existsSync(p(n)) ? JSON.parse(readFileSync(p(n), "utf8")) : null);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ── status mode: the ONLY thing the Dema face can see, via the governed adapter
if (STATUS_MODE) {
  const j = read("supervisor-journal.json");
  const b = read("worker-b.json");
  console.log(JSON.stringify({
    ready: Boolean(j?.recovery_completed),
    console_ready: false,
    activation_gate: "BLOCKED",
    daemon_status: "none",
    mission_executed: Boolean(b?.advanced_to_stage),
    runtime_pulse: { fired: Boolean(j?.detected_death) },
    findings: j ? [`proof-only recovery supervisor: ${j.recovery_completed ? "recovery completed" : "in progress"}`] : ["no proof run recorded"],
  }));
  process.exit(0);
}

/// Liveness by OS probe. Signal 0 delivers nothing; it only asks the kernel
/// whether the process still exists. Nobody tells this supervisor anything.
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

const journal = {
  schema: "bizra.dema.node0_recovery_supervisor_journal.v0.1",
  truth_label: "PROOF_ONLY_RUNTIME_PRODUCER",
  supervisor_pid: process.pid,
  told_about_kill: false, // nothing signals or messages this process about the kill
  detection_method: "os_liveness_probe_signal_0",
  detected_death: false,
  decided_recovery: false,
  started_replacement: false,
  replacement_pid: null,
  recovery_completed: false,
  conducts: true,
};
write("supervisor-journal.json", journal);

const a = spawn(process.execPath, [WORKER, "a", DEMA_HOME], { stdio: "ignore" });
journal.spawned_a_pid = a.pid;
write("supervisor-journal.json", journal);

// Wait until A has actually established the mission before watching for its death.
for (let i = 0; i < 400 && !read("worker-a.json"); i++) await wait(25);

// ── the watch loop. It is not told; it looks.
let ticks = 0;
while (ticks < 800) {
  const isAlive = alive(a.pid);
  if (!isAlive || !REQUIRE_DEAD) {
    journal.detected_death = !isAlive;
    journal.detected_at_tick = ticks;
    write("supervisor-journal.json", journal);
    if (NO_RECOVER) break; // control: detect, refuse to act
    journal.decided_recovery = true;
    const b = spawn(process.execPath, [WORKER, "b", DEMA_HOME], { stdio: "ignore" });
    journal.started_replacement = true;
    journal.replacement_pid = b.pid;
    write("supervisor-journal.json", journal);
    await new Promise((res) => b.on("exit", res));
    journal.recovery_completed = Boolean(read("worker-b.json"));
    write("supervisor-journal.json", journal);
    break;
  }
  ticks += 1;
  await wait(25);
}

if (alive(a.pid)) a.kill("SIGKILL"); // never leave a child behind
write("supervisor-journal.json", journal);
process.exit(0);
