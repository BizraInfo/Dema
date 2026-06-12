#!/usr/bin/env node
/**
 * [G8 FIXTURE REMOTE GATE ISOLATION] — hardened v2 (per GO: harden the G8 classifier)
 *
 * Original purpose: let remote CI classify a small set of known pre-existing
 * environmental harness failures as B-bucket noise (exit 0 for gate purposes)
 * without ever hiding NEW failures.
 *
 * HARDENING (2026-06-12): the prior version detected "known signatures" by
 * matching their error strings ANYWHERE in the (30k-line) log — including the
 * passing-test output that mentions `integration-check.test.js:46` and
 * `baseline_l1.v0.1`. Combined with a `reportedFailCount <= 2` heuristic, this
 * masked ANY <=2 failures as "known B-bucket" regardless of which tests actually
 * failed (e.g. it masked the unrelated `artifact-011` EROFS failure while
 * claiming the two known issues). That is how a real regression could hide.
 *
 * Now: masking is decided per ACTUAL `not ok` line, matched by test NAME against
 * an explicit allowlist (KNOWN_MASKABLE). Every masked failure is enumerated by
 * name with its reason. ANY `not ok` line that does not match the allowlist is
 * UNRECOGNIZED and the gate FAILS CLOSED (exit 1) — surfacing the named test so
 * an operator can fix it or, if genuinely environmental, add it to the allowlist.
 *
 * This file is CI tooling only. No product logic.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// Explicit allowlist of failures that may be masked as environmental noise.
// Each is matched against the `not ok N - <name>` line by test name.
export const KNOWN_MASKABLE = [
  {
    id: "artifact_011_eros_sandbox",
    reason:
      "EROFS mkdtemp under $HOME — sandbox-only; passes in CI / operator terminal",
    pattern: /isolated preflight CLI clears preview ceremony on fresh home/,
  },
  // NOTE: integration-check failures are NOT allowlisted. They fail for REAL
  // reasons (command/docs/test-matrix drift), never environmental ones — masking
  // them is exactly the hole this hardening closes. If integration-check fails,
  // fix the wiring (register commands/tests); do not mask it.
  {
    id: "baseline_l1_env",
    reason: "baseline-l1-diff /tmp artifact schema mismatch (CI env)",
    pattern: /baseline-l1-diff|not a baseline_l1/i,
  },
];

/**
 * Pure classification. Returns the verdict plus the enumerated masked and
 * unrecognized failures, so callers (and tests) can reason without process.exit.
 */
export function classifyFailures(content) {
  const failMatch = content.match(/# fail\s+(\d+)/);
  const reportedFailCount = failMatch ? parseInt(failMatch[1], 10) : 0;

  const notOk = [...content.matchAll(/^\s*not ok (\d+) - (.+?)\s*$/gm)].map(
    (m) => ({ num: Number(m[1]), name: m[2] }),
  );

  const recognized = [];
  const unrecognized = [];
  for (const f of notOk) {
    const hit = KNOWN_MASKABLE.find((k) => k.pattern.test(f.name));
    if (hit) recognized.push({ ...f, id: hit.id, reason: hit.reason });
    else unrecognized.push(f);
  }

  const cleanRun = reportedFailCount === 0 && notOk.length === 0;
  const verdict = unrecognized.length === 0 ? "PASS" : "FAIL";

  return {
    reportedFailCount,
    notOk,
    recognized,
    unrecognized,
    cleanRun,
    verdict,
  };
}

/**
 * Freshness binding (GO: G8-HARDEN-TEST-LOG-FRESHNESS).
 *
 * Law: a verifier must verify its evidence freshness before verifying the result.
 * The stale-/tmp trap: when `tee` writes to a read-only path it fails silently,
 * leaving the classifier to read a STALE log (yesterday's run) or none at all.
 * An empty log used to classify as a "clean run" (0 fail, 0 not-ok → exit 0),
 * so a failed capture read as a green gate. That is a false green and it can also
 * hide the real current failure.
 *
 * A log is "bound" to a real run only if it is non-empty AND carries TAP markers
 * a node --test run actually emits (ok / not ok / `# tests N` / `1..N`). Anything
 * else — empty, truncated, or unrelated text — is not this run's evidence and must
 * fail closed rather than be classified.
 */
export function evaluateLogFreshness(content) {
  if (!content || !content.trim()) {
    return {
      bound: false,
      reason:
        "empty log — test output was not captured (tee may have failed to a read-only path)",
    };
  }
  const hasTapMarker =
    /^\s*ok \d+/m.test(content) ||
    /^\s*not ok \d+/m.test(content) ||
    /^#\s*tests\s+\d+/m.test(content) ||
    /^\s*1\.\.\d+/m.test(content);
  if (!hasTapMarker) {
    return {
      bound: false,
      reason:
        "no TAP markers (ok / not ok / `# tests N` / `1..N`) — log is stale, truncated, or not a test run",
    };
  }
  return { bound: true, reason: "log carries TAP run markers" };
}

const USAGE = `Usage:
  node scripts/ci/classify-known-harness-failures.mjs --log <file>
  node scripts/ci/classify-known-harness-failures.mjs --stdin   # or pipe to stdin
`;

function parseArgs(argv) {
  let logPath = null;
  let useStdin = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--log" && argv[i + 1]) {
      logPath = argv[++i];
    } else if (argv[i] === "--stdin" || argv[i] === "-") {
      useStdin = true;
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log(USAGE);
      process.exit(0);
    }
  }
  if (!logPath && !useStdin && process.stdin.isTTY) {
    console.error(USAGE);
    process.exit(2);
  }
  return { logPath, useStdin };
}

function main() {
  const { logPath, useStdin } = parseArgs(process.argv.slice(2));

  let content;
  try {
    content = readFileSync(logPath ? logPath : 0, "utf8");
  } catch (err) {
    console.error(
      `[G8 FRESHNESS] cannot read log ${
        logPath ? `'${logPath}'` : "(stdin)"
      }: ${err.code || err.message}. The run's evidence is missing — failing closed. Exit 1.`,
    );
    process.exit(1);
  }

  const freshness = evaluateLogFreshness(content);
  if (!freshness.bound) {
    console.error(
      `[G8 FRESHNESS] log is not bound to a real run: ${freshness.reason}.`,
    );
    console.error(
      "[G8 FRESHNESS] A stale or empty log must never pass as a clean run. Exit 1.",
    );
    process.exit(1);
  }

  const r = classifyFailures(content);

  console.log("[G8 GATE] classify-known-harness-failures (hardened v2)");
  console.log(`[G8 GATE] reported # fail: ${r.reportedFailCount}`);
  console.log(`[G8 GATE] raw not-ok lines: ${r.notOk.length}`);

  if (r.cleanRun) {
    console.log("[G8 GATE] Clean run: 0 failures, 0 not-ok lines. Exit 0.");
    process.exit(0);
  }

  if (r.recognized.length) {
    console.log(
      `\n[G8 MASKED] ${r.recognized.length} failure(s) masked as known environmental noise (enumerated by name):`,
    );
    for (const f of r.recognized) {
      console.log(`  - not ok ${f.num} - ${f.name}  [${f.id}: ${f.reason}]`);
    }
  }

  if (r.unrecognized.length) {
    console.error(
      `\n[G8 UNRECOGNIZED] ${r.unrecognized.length} failure(s) are NOT on the allowlist — failing closed:`,
    );
    for (const f of r.unrecognized) {
      console.error(`  - not ok ${f.num} - ${f.name}`);
    }
    console.error(
      "\n[G8 GATE] A real or new failure is present (or add it to KNOWN_MASKABLE if genuinely environmental). Exit 1.",
    );
    process.exit(1);
  }

  console.log(
    "\n[G8 GATE] All failures are named, allowlisted environmental noise. Exit 0.",
  );
  process.exit(0);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
