// Atomic publication + fail-closed reading for proof-worker fact files.
//
// WHY THIS EXISTS. The runtime-mission and worker-handoff workers each learned
// this the hard way and each fixed it privately with a local `emit`:
//
//     "Measured under load: one of two parallel fresh-extraction qualifications
//      failed RMA-08 with 'Unexpected end of JSON input' while the same file
//      passed 5/5 in isolation."
//
// The RECOVERY family never received that fix. Its writers call writeFileSync
// straight at the final pathname and its readers are bare
// `existsSync(f) ? JSON.parse(readFileSync(f)) : null`, so a driver polling
// every 25ms can open the file between creation and completion, read a prefix,
// and throw out of the poll loop. Measured 2026-08-14: fresh extraction A of
// candidate a5f8a77a failed RCA-02 with exactly that error while byte-identical
// extraction B passed, and the same test passed 6/6 in isolation.
//
//     FIXED_AT_ONE_PATH != DEFECT_CLASS_CLOSED
//
// rename(2) within one directory is atomic, so a reader sees either the old
// complete file or the new complete one — never a prefix.

import { writeFileSync, readFileSync, existsSync, renameSync } from "node:fs";

/** Publish `value` at `finalPath` atomically: whole file, or nothing. */
export function writeFactsAtomic(finalPath, value, { space = 2 } = {}) {
  const tmp = `${finalPath}.partial`;
  writeFileSync(tmp, `${JSON.stringify(value, null, space)}\n`);
  renameSync(tmp, finalPath);
}

/**
 * Read a fact file only when it is complete.
 *
 * Returns null for "not ready" — absent, or mid-publication. A caller polling
 * this must bound its wait (every caller here already does, via `until`), so a
 * durably malformed artifact surfaces as a timeout naming what was waited for,
 * never as a silent pass. It is deliberately NOT the caller's job to
 * distinguish transient from durable here: with atomic publication above, the
 * transient window does not exist for files we write, and this guard exists so
 * a foreign or interrupted writer cannot crash the poll loop.
 */
export function readFactsWhenComplete(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}
