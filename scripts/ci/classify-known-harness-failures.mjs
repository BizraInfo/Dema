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
import { evaluateCheckGateEvidence } from "./check-gate-evidence.mjs";
import { evaluateTapRunEvidence } from "./tap-run-evidence.mjs";

// Explicit allowlist of failures that may be masked as environmental noise.
//
// PROOF-GATE-TEETH-HARDENING-1A · defect 2 (cause-bound masking).
// Masking now requires BOTH:
//   (a) `pattern` matches the `not ok N - <name>` test NAME, AND
//   (b) `cause` matches the environmental signature inside that failure's own
//       TAP diagnostic block.
// Matching the name alone was the hole: `/baseline-l1-diff/i` matched every
// baseline-l1-diff test — including correctness tests (input-validation, the
// 16-key constitutional boundary) — so a genuine regression in one of them was
// silently masked. Requiring the cause in the same block means a real assertion
// failure (no env signature) is NEVER masked; only the true environmental flake
// (which prints EROFS/ENOENT/etc. in its block) is. Fails closed by default.
export const KNOWN_MASKABLE = [
  {
    id: "artifact_011_eros_sandbox",
    reason:
      "EROFS mkdtemp under $HOME — sandbox-only; passes in CI / operator terminal",
    pattern: /isolated preflight CLI clears preview ceremony on fresh home/,
    cause: /EROFS|read-only file system|EPERM|operation not permitted/i,
  },
  // NOTE: integration-check failures are NOT allowlisted. They fail for REAL
  // reasons (command/docs/test-matrix drift), never environmental ones — masking
  // them is exactly the hole this hardening closes. If integration-check fails,
  // fix the wiring (register commands/tests); do not mask it.
  {
    id: "baseline_l1_env",
    reason: "baseline-l1-diff /tmp artifact schema mismatch (CI env)",
    pattern: /baseline-l1-diff|not a baseline_l1/i,
    cause: /EROFS|read-only file system|EPERM|ENOENT|operation not permitted|\/tmp\/|schema mismatch/i,
  },
];

const COVERAGE_THRESHOLD_ERROR =
  /^#\s*Error:\s+.+?\bcoverage does not meet threshold of \d+(?:\.\d+)?%?\./;

/**
 * Pure classification. Returns the verdict plus the enumerated masked and
 * unrecognized failures, so callers (and tests) can reason without process.exit.
 */
// A TAP marker line ends a failure's diagnostic block: the next ok/not ok, any
// `#` comment (summary or subtest), a plan line, or the version header.
function isTapMarkerLine(line) {
  return (
    /^\s*ok \d+/.test(line) ||
    /^\s*not ok \d+/.test(line) ||
    /^\s*#/.test(line) ||
    /^\s*1\.\.\d+/.test(line) ||
    /^\s*TAP version/i.test(line)
  );
}

export function classifyFailures(content) {
  // Parse line-by-line so each `not ok` carries its diagnostic block (the lines
  // until the next TAP marker). Per-line `(.+)$` is linear (the `.` excludes
  // newline, `$` anchors line end) — no polynomial backtracking (CodeQL
  // js/polynomial-redos). `.trim()` preserves the old trailing-whitespace strip.
  const lines = content.split(/\r?\n/);
  const notOk = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)not ok (\d+)(?:\s+-\s*(.*))?\s*$/);
    if (!m) continue;
    const blockLines = [];
    for (let j = i + 1; j < lines.length && !isTapMarkerLine(lines[j]); j++) {
      blockLines.push(lines[j]);
    }
    notOk.push({
      num: Number(m[2]),
      name: (m[3] ?? "").trim(),
      block: blockLines.join("\n"),
      topLevel: m[1].length === 0,
      lineIndex: i,
    });
  }

  const {
    complete,
    reportedFailCount,
    inconsistentFailureCount,
    uncapturedFailures,
  } = evaluateTapRunEvidence(lines, notOk.at(-1)?.lineIndex ?? -1);
  const coverageThresholdFailures = lines
    .filter((line) => COVERAGE_THRESHOLD_ERROR.test(line))
    .map((line) => line.replace(/^#\s*/, "").trim());

  const recognized = [];
  const unrecognized = [];
  for (const f of notOk) {
    // Mask only when the test NAME is allowlisted AND the environmental CAUSE
    // signature appears in this failure's own diagnostic block. A real assertion
    // failure (no env signature) is never masked, even if its name matches.
    const hit = f.topLevel && f.name
      ? KNOWN_MASKABLE.find(
          (k) => k.pattern.test(f.name) && k.cause.test(f.block),
        )
      : null;
    if (hit) recognized.push({ ...f, id: hit.id, reason: hit.reason });
    else unrecognized.push(f);
  }

  const cleanRun =
    complete &&
    inconsistentFailureCount === 0 &&
    reportedFailCount === 0 &&
    notOk.length === 0 &&
    coverageThresholdFailures.length === 0;
  // Fail closed when the summary reports more failures than we captured as named
  // `not ok` lines (a runner error or an unparseable failure). An uncaptured
  // failure is real — it must never pass as clean just because it had no name.
  const verdict =
    complete &&
    inconsistentFailureCount === 0 &&
    unrecognized.length === 0 &&
    uncapturedFailures === 0 &&
    coverageThresholdFailures.length === 0
      ? "PASS"
      : "FAIL";

  return {
    reportedFailCount,
    notOk,
    recognized,
    unrecognized,
    coverageThresholdFailures,
    cleanRun,
    complete,
    uncapturedFailures,
    inconsistentFailureCount,
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
  node scripts/ci/classify-known-harness-failures.mjs --log <file> [--check-exit <n>] [--require-check-gate-evidence --check-gate-evidence <jsonl>]
  node scripts/ci/classify-known-harness-failures.mjs --stdin   # or pipe to stdin

--check-exit <n>: the REAL exit status of the command that produced the log
(forwarded by scripts/ci/run-with-classifier.mjs). A nonzero n with a clean TAP
log means a NON-TAP gate failed after the tests — that must fail closed, never
be read as a pass (CHECK-EXIT-INTEGRITY-1B).

--require-check-gate-evidence: require a bounded out-of-band start + terminal
record whose terminal event agrees with --check-exit. This mode is for
scripts/check.mjs only; standalone test/coverage masking remains compatible.
`;

function parseArgs(argv) {
  let logPath = null;
  let useStdin = false;
  let checkExit = null;
  let requireCheckGateEvidence = false;
  let checkGateEvidence = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--log" && argv[i + 1]) {
      logPath = argv[++i];
    } else if (argv[i] === "--check-exit") {
      const raw = argv[++i];
      if (raw === undefined) {
        checkExit = Number.NaN;
        continue;
      }
      const numeric = Number(raw);
      checkExit =
        /^\d+$/.test(raw) && Number.isSafeInteger(numeric)
          ? numeric
          : Number.NaN;
    } else if (argv[i] === "--require-check-gate-evidence") {
      requireCheckGateEvidence = true;
    } else if (
      argv[i] === "--check-gate-evidence" &&
      argv[i + 1] !== undefined
    ) {
      checkGateEvidence = argv[++i];
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
  return {
    logPath,
    useStdin,
    checkExit,
    requireCheckGateEvidence,
    checkGateEvidence,
  };
}

function main() {
  const {
    logPath,
    checkExit,
    requireCheckGateEvidence,
    checkGateEvidence,
  } = parseArgs(process.argv.slice(2));

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

  if (Number.isNaN(checkExit)) {
    console.error(
      "[G8 EXIT] --check-exit must be a non-negative safe integer; failing closed.",
    );
    process.exit(1);
  }

  let checkGateFailure = null;
  if (requireCheckGateEvidence) {
    const assessment = evaluateCheckGateEvidence({
      content: checkGateEvidence,
      checkExit,
    });
    if (!assessment.ok) {
      console.error(
        `[G8 GATE EXIT EVIDENCE] ${assessment.reason}; failing closed.`,
      );
      process.exit(1);
    }
    checkGateFailure = assessment.failure;
    if (checkGateFailure?.mask_policy === "authoritative") {
      console.error(
        `\n[G8 NON-TAP EXIT] gate ${checkGateFailure.index}: ${checkGateFailure.command.join(" ")} exited ${checkGateFailure.exit_code}; failing closed.`,
      );
      process.exit(1);
    }
    // In check-owner mode, `complete` is the aggregate proof: check.mjs emitted
    // it only after every declared child returned zero. TAP-capable child gates
    // (the raw test command and coverage) run through their own classifier and
    // isolated log before returning to the owner. Reclassifying their
    // concatenated stdout here would destroy that command boundary and let one
    // run's trailer complete another run.
    if (checkGateFailure === null) {
      console.log(
        "[G8 GATE EXIT EVIDENCE] aggregate check emitted start + complete; every declared gate returned zero after per-command TAP classification. Exit 0.",
      );
      process.exit(0);
    }
  }

  // Node's ordinary test-failure status is exactly 1. Any larger status can be
  // a runner/internal error and is authoritative even if the captured text also
  // contains an allowlisted environmental failure.
  if (checkExit !== null && checkExit > 1) {
    console.error(
      `\n[G8 EXIT] the gated command exited ${checkExit}; only exit 1 is eligible for enumerated TAP masking. Failing closed. Exit 1.`,
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

  // Completeness gate: every TAP run needs a coherent plan plus full Node
  // tests/pass/fail trailer. A neighbouring run cannot complete a truncated one.
  if (!r.complete) {
    console.error(
      "[G8 GATE] TAP evidence is incomplete or has inconsistent run trailers (TAP version, 1..N, # tests, # pass, # fail). A partial run must never pass as clean. Exit 1.",
    );
    process.exit(1);
  }

  if (r.inconsistentFailureCount > 0) {
    console.error(
      `\n[G8 GATE] top-level not-ok count contradicts the reported # fail total by ${r.inconsistentFailureCount}. Failing closed. Exit 1.`,
    );
    process.exit(1);
  }

  if (r.cleanRun) {
    // CHECK-EXIT-INTEGRITY-1B: a clean TAP log cannot excuse a nonzero command
    // exit — the failure was a NON-TAP gate (review/performance/etc.) running
    // after the tests. The old `cmd | tee; classifier` wiring laundered exactly
    // this case into exit 0. Failure must never be laundered into progress.
    if (checkExit !== null && checkExit !== 0) {
      console.error(
        `\n[G8 EXIT] the gated command exited ${checkExit} but the log shows a clean TAP run — a non-TAP gate failed after green tests. Failing closed. Exit 1.`,
      );
      process.exit(1);
    }
    console.log("[G8 GATE] Clean run: 0 failures, 0 not-ok lines. Exit 0.");
    process.exit(0);
  }

  if (r.coverageThresholdFailures.length) {
    console.error(
      `\n[G8 COVERAGE] ${r.coverageThresholdFailures.length} native coverage threshold failure(s) detected — failing closed:`,
    );
    for (const failure of r.coverageThresholdFailures) {
      console.error(`  - ${failure}`);
    }
    console.error(
      "\n[G8 GATE] Native coverage threshold errors are gate failures even when TAP reports zero failed tests. Exit 1.",
    );
    process.exit(1);
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

  if (r.uncapturedFailures > 0) {
    console.error(
      `\n[G8 GATE] ${r.uncapturedFailures} reported failure(s) had no parseable 'not ok' line (runner error or unnamed failure). Failing closed — an uncaptured failure is still a failure. Exit 1.`,
    );
    process.exit(1);
  }

  if (r.recognized.length > 0 && checkExit !== 1) {
    console.error(
      `\n[G8 EXIT] enumerated TAP masking requires the producing command's exact exit 1; received ${
        checkExit === null ? "no exit evidence" : checkExit
      }. Failing closed. Exit 1.`,
    );
    process.exit(1);
  }

  // Only standalone, isolated test/coverage logs reach this masking branch.
  // Check-owner success returned on start + complete; every terminal aggregate
  // failure, including legacy tap_allowlist evidence, failed above.
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
