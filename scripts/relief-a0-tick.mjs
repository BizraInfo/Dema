#!/usr/bin/env node
/**
 * A0 relief tick — run one shift of read-only work and print the briefing.
 *
 * This is the thin executor the pure runner was written to accept. The kernel
 * (`dema-relief-runner.js`) decides WHAT may run; this file only knows HOW to
 * spawn it. Keeping those apart is the point: the disposition rule lives in a
 * tested kernel, not in a script somebody edits under pressure.
 *
 * A0 is the read-only tier. It requires NO standing lease and mutates nothing.
 * Any capability declaring a stronger effect is queued for the sovereign with
 * the reason attached, so the queue shows what a lease would release rather
 * than asking for one in advance.
 *
 * The queue deliberately carries NEGATIVE CONTROLS — unregistered ops, a shell
 * injection, a path traversal, and an op lying about its own effect class. A
 * tick that ran only the safe things would prove nothing about the boundary.
 *
 *   node scripts/relief-a0-tick.mjs [--json] [--include-tests]
 */

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { listCapabilities } from "../packages/core/src/dema-relief-capabilities.js";
import { runReliefShift } from "../packages/core/src/dema-relief-runner.js";
import { formatReliefBriefing } from "../packages/core/src/dema-founder-relief-loop.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const wantJson = argv.includes("--json");
const includeTests = argv.includes("--include-tests");

/**
 * shell:false, fixed cwd, bounded time and output. The runner hands over an
 * argv array it derived from its own registry; nothing here interpolates a
 * caller string into a command.
 */
function runOp(file, argvArr) {
  const r = spawnSync(file, argvArr, {
    cwd: REPO,
    encoding: "utf8",
    timeout: 180_000,
    maxBuffer: 8 * 1024 * 1024,
    shell: false,
  });
  return {
    code: r.status,
    stdout: (r.stdout || "").slice(0, 4000),
    stderr: (r.stderr || "").slice(0, 2000),
  };
}

// listCapabilities() returns op NAMES. The effect is declared by the registry
// at resolve time and is never carried on the listing — so we queue every
// registered op and let the kernel decide what may run. Authority comes from
// the registry, never from the caller assembling this queue.
const registered = listCapabilities();
const queue = [
  ...registered
    .filter((op) => (includeTests ? true : op !== "test.run"))
    .map((op) => ({ id: `a0:${op}`, op })),
  { id: "ctl:unregistered-push", op: "git.push" },
  { id: "ctl:shell-injection", op: "git.status; rm -rf /" },
  { id: "ctl:path-traversal", op: "../../evil" },
  { id: "ctl:label-lie", op: "disk.destroy", args: { effect_class: "read_only" } },
];

const now = new Date().toISOString();
const shift = runReliefShift({ queue, runOp, now });

if (wantJson) {
  console.log(JSON.stringify({ at: now, registered, shift }, null, 2));
  process.exit(0);
}

const p = (s = "") => console.log(s);
p("");
p("  A0 RELIEF TICK — read-only · no lease required · nothing mutated");
p("  " + "=".repeat(68));
p(`  registered: ${registered.length}   queued: ${queue.length}   at ${now}`);
p("");
p("  COMPLETED");
for (const r of shift.completed) {
  p(`    ok      ${String(r.op ?? r.unit_id).padEnd(20)} exit=${r.exit_code ?? 0}`);
}
if (!shift.completed.length) p("    (none)");
p("");
p("  FAILED SAFELY (ran, non-zero, captured — not a crash)");
for (const r of shift.failed_safely) {
  p(`    fail    ${String(r.op ?? r.unit_id).padEnd(20)} exit=${r.exit_code}`);
}
if (!shift.failed_safely.length) p("    (none)");
p("");
p("  REFUSED (negative controls — the boundary must hold here)");
for (const r of shift.refused) {
  p(`    refuse  ${String(r.op ?? "").slice(0, 26).padEnd(28)} ${r.reason}`);
}
if (!shift.refused.length) {
  p("    (none) — WARNING: the controls did not fire, so this tick proved nothing");
}
p("");
p("  QUEUED FOR SOVEREIGN (what a lease would release)");
for (const r of shift.sovereign_queue) {
  p(`    queue   ${String(r.op).padEnd(20)} ${r.authority}  ${r.reason}`);
}
if (!shift.sovereign_queue.length) {
  p("    (none) — no capability declaring a stronger effect is registered yet,");
  p("    so there is nothing an A1 lease would currently unlock.");
}
p("");
p("  BRIEFING");
for (const l of String(formatReliefBriefing(shift.briefing)).split("\n")) p("    " + l);
p("");
p(`  authority_delta: ${shift.authority_delta}`);
p("");

// A refused control that failed to refuse is the only thing that makes this
// tick a failure. Work that ran and returned non-zero is a finding, not a fault.
const controlsFired = shift.refused.length >= 4;
process.exit(controlsFired ? 0 : 1);
