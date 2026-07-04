#!/usr/bin/env node
// Smoke driver for the `dema` CLI (@bizra/dema-root, bin/dema).
//
// Runs a representative READ-ONLY subset of the command surface under a
// throwaway DEMA_HOME so it never touches real receipts/state, asserts exit
// codes + expected output markers, and exits non-zero if anything regresses.
//
// This is the agent path: `node .claude/skills/run-dema/driver.mjs`.
// It deliberately avoids consent-gated / mutating commands (urp launch-5sat,
// node0 mumu consent, authorship sign, …) — those require EXACT consent strings
// and must never be driven with a guessed phrase.
//
// Every command here was run by hand this session and exited 0.

import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const binDema = join(repoRoot, "bin", "dema");

// Isolate all local state in a throwaway home so smoke runs are side-effect-free.
const demaHome = mkdtempSync(join(tmpdir(), "dema-smoke-"));
const env = { ...process.env, DEMA_HOME: demaHome };

// { argv, marker } — marker is a substring stdout must contain (null = any
// non-empty stdout). All must exit 0.
const CHECKS = [
  { argv: ["help"], marker: "Dema — Sovereign AI Node Companion" },
  { argv: ["help", "preview"], marker: null },
  { argv: ["welcome"], marker: null },
  { argv: ["readiness"], marker: null },
  { argv: ["state"], marker: null },
  {
    argv: ["peak-self-loop", "--json"],
    marker: "bizra.dema.peak_self_loop_preview",
  },
];

let failed = 0;
for (const { argv, marker } of CHECKS) {
  const r = spawnSync(process.execPath, [binDema, ...argv], {
    env,
    encoding: "utf8",
  });
  const out = (r.stdout || "") + (r.stderr || "");
  const okExit = r.status === 0;
  const okMarker = marker ? out.includes(marker) : out.trim().length > 0;
  const ok = okExit && okMarker;
  if (!ok) failed += 1;
  const label = `dema ${argv.join(" ")}`;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}` +
      (ok ? "" : `  (exit=${r.status}${marker && !okMarker ? `, missing "${marker}"` : ""})`),
  );
}

// peak-self-loop --json must additionally parse and expose the all-false boundary.
const json = spawnSync(process.execPath, [binDema, "peak-self-loop", "--json"], {
  env,
  encoding: "utf8",
});
try {
  const doc = JSON.parse(json.stdout);
  const boundaryFalse =
    doc.boundary &&
    Object.values(doc.boundary).every((v) => v === false);
  const ok = doc.mode === "preview_only" && boundaryFalse;
  if (!ok) failed += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"}  peak-self-loop --json: mode=preview_only + boundary all-false`,
  );
} catch (e) {
  failed += 1;
  console.log(`FAIL  peak-self-loop --json did not parse: ${e.message}`);
}

console.log(
  `\n${failed === 0 ? "OK" : "FAILED"} — ${CHECKS.length + 1} checks, ${failed} failure(s). DEMA_HOME=${demaHome}`,
);
process.exit(failed === 0 ? 0 : 1);
