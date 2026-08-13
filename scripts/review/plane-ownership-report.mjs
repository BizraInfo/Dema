#!/usr/bin/env node
/**
 * TEST-PLANE-CLASSIFICATION-1A — read-only. Describes, never judges.
 *
 * The aggregate suite mixes DEVELOPMENT-HARNESS tests into the population used
 * to qualify DEMA runtime slices. `tests/stop-hook-output.test.js` executes the
 * `.codex/` and `.claude/` hook scripts, and `.claude/` is a gitignored local
 * overlay — so harness failures that reproduce at base 4e6d9f40 land inside the
 * number a Dema slice is judged by.
 *
 * THIS REPORTS LANES. IT DOES NOT SET THE BAR. `npm test` is untouched, no
 * assertion is weakened, nothing is skipped or relocated, and no verdict is
 * emitted. A candidate that moves the failing questions outside the exam has
 * not passed the exam; only a separately adopted qualification policy may say
 * "Dema promotion requires lane X". That policy is not here and must not be
 * inferred from a green lane.
 *
 * ATTRIBUTION IS DERIVED, NOT SUBTRACTED. `node --test` TAP carries no file for
 * a subtest, and isolation changes outcomes — measured: `stop-hook-output`
 * passes in a two-file selection and fails in the full run. So a failure is
 * attributed by resolving its subtest name back to the file that declares it,
 * against the ONE real full-run log. A name no file claims, or one two files
 * claim, is UNATTRIBUTED — surfaced, never guessed and never absorbed.
 *
 * Regex matching here uses String.match by deliberate choice:
 * `scripts/review/actuator-check.mjs` forbids the raw-shell execution token to
 * catch child_process misuse, and it scans source text rather than parsing it —
 * so RegExp.prototype's same-named method trips it, and so does a comment that
 * spells the token out. Measured twice on this file: once in the code, once in
 * the sentence explaining the code.
 *
 *   node scripts/review/plane-ownership-report.mjs <full-run.tap> [--json]
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

export const SCHEMA = "bizra.dema.review.test_plane_report.v0.1";
export const DEMA_PLANE = "dema";
export const HARNESS_PLANE = "harness";

// A declaration is a header line: `// plane: harness`. Trailing prose on the
// same line is allowed and expected — the reason a file is harness-plane is
// worth more than the label, and a parser that forbids the reason gets the
// label written without one.
const DECLARED = /^\/\/\s*plane:\s*([a-z-]+)\b/m;

// Provider surface = a path into a provider/harness directory. A Dema test may
// legitimately use such a path as a STRING FIXTURE for its own classifier
// (node0-library-census does), so this predicate does not by itself promote a
// file — it only gates whether an explicit harness declaration is honoured.
const PROVIDER_SURFACE = /\.(?:claude|codex)[/"']/;

/** dema unless the file both declares harness and actually touches provider surface. */
export function classifyFiles(entries) {
  const planes = {};
  const violations = [];
  for (const { file, source } of entries) {
    const declared = source.match(DECLARED)?.[1];
    if (declared === HARNESS_PLANE && !PROVIDER_SURFACE.test(source)) {
      // Fall back to the STRICT lane. Refusing loudly beats honouring a label
      // whose only evidence is the label.
      violations.push({ file, reason: "harness_declared_without_provider_surface" });
      planes[file] = DEMA_PLANE;
      continue;
    }
    if (declared && declared !== HARNESS_PLANE && declared !== DEMA_PLANE) {
      violations.push({ file, reason: `unknown_plane:${declared}` });
      planes[file] = DEMA_PLANE;
      continue;
    }
    planes[file] = declared === HARNESS_PLANE ? HARNESS_PLANE : DEMA_PLANE;
  }
  return { planes, violations };
}

/** name -> files declaring it. Two files means ambiguous, not "pick one". */
export function buildNameIndex(entries) {
  const index = new Map();
  for (const { file, source } of entries) {
    for (const m of source.matchAll(/\b(?:test|it)\s*\(\s*(["'`])((?:\\.|(?!\1).)*)\1/g)) {
      const name = m[2].replace(/\\(.)/g, "$1");
      if (!index.has(name)) index.set(name, new Set());
      index.get(name).add(file);
    }
  }
  return index;
}

const totalsOf = (tap) => {
  const n = (key) => {
    const m = tap.match(new RegExp(`^# ${key} (\\d+)$`, "m"));
    return m ? Number(m[1]) : null;
  };
  const [tests, pass, fail] = [n("tests"), n("pass"), n("fail")];
  if (tests === null || pass === null || fail === null) return null;
  // A SKIP is not a PASS. Measured: under a scrubbed HOME the suite reports
  // `pass 9594 / fail 0` out of 9597 because three tests opted out — a lane
  // report that showed only failures would render that as complete. These keys
  // are optional in TAP, so absent means zero, never unknown-as-clean.
  return { tests, pass, fail, skipped: n("skipped") ?? 0, todo: n("todo") ?? 0, cancelled: n("cancelled") ?? 0 };
};

export function buildTestPlaneReport({ entries, tap }) {
  const global = typeof tap === "string" ? totalsOf(tap) : null;
  if (!global) {
    // Fail closed. A log we cannot read totals from must not render as a clean
    // report — an empty result from a broken parser looks exactly like a pass.
    return Object.freeze({ schema: SCHEMA, report_derivable: false, reason: "tap_totals_unreadable" });
  }
  const { planes, violations } = classifyFiles(entries);
  const index = buildNameIndex(entries);

  const lanes = { [DEMA_PLANE]: { failures: [] }, [HARNESS_PLANE]: { failures: [] } };
  const unattributed = [];
  for (const m of tap.matchAll(/^not ok \d+ - (.*)$/gm)) {
    const name = m[1].trim();
    const owners = index.get(name);
    if (!owners || owners.size !== 1) {
      unattributed.push(name);
      continue;
    }
    lanes[planes[[...owners][0]]].failures.push(name);
  }

  for (const lane of Object.values(lanes)) Object.freeze(lane.failures);
  return Object.freeze({
    schema: SCHEMA,
    report_derivable: true,
    global,
    planes: lanes,
    unattributed,
    violations,
    file_counts: Object.values(planes).reduce(
      (acc, p) => ({ ...acc, [p]: (acc[p] ?? 0) + 1 }),
      {},
    ),
    // Stated, not implied: this artifact has no opinion about the bar.
    qualification_verdict: null,
    boundary: {
      read_only_audit: true,
      decides_qualification: false,
      mutates_test_execution: false,
      weakens_assertion: false,
    },
  });
}

function main() {
  const [logPath, ...flags] = process.argv.slice(2);
  if (!logPath) {
    console.error("usage: plane-ownership-report.mjs <full-run.tap> [--json]");
    process.exit(2);
  }
  const repo = fileURLToPath(new URL("../..", import.meta.url));
  const entries = execFileSync("git", ["ls-files", "tests/*.test.js"], { cwd: repo, encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .map((file) => ({ file, source: readFileSync(join(repo, file), "utf8") }));

  const report = buildTestPlaneReport({ entries, tap: readFileSync(logPath, "utf8") });
  if (flags.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else if (!report.report_derivable) {
    console.log(`test-plane: NO REPORT — ${report.reason}`);
  } else {
    const { global: g, planes: p, unattributed: u, violations: v, file_counts: fc } = report;
    const unrun = g.skipped + g.todo + g.cancelled;
    console.log(`GLOBAL (authoritative, verbatim from the run): ${g.pass}/${g.tests} pass, ${g.fail} fail`);
    console.log(
      unrun
        ? `  NOT RUN: ${unrun} (skipped ${g.skipped}, todo ${g.todo}, cancelled ${g.cancelled}) — a skip is not a pass`
        : "  NOT RUN: 0 — every test in the population reported a result",
    );
    for (const [lane, { failures }] of Object.entries(p)) {
      console.log(`  lane ${lane.padEnd(8)} files=${fc[lane] ?? 0} failures=${failures.length}`);
      for (const f of failures) console.log(`      - ${f}`);
    }
    if (u.length) console.log(`  UNATTRIBUTED failures=${u.length}`);
    for (const f of u) console.log(`      - ${f}`);
    for (const { file, reason } of v) console.log(`  VIOLATION ${file}: ${reason}`);
    console.log("  qualification verdict: NONE — lanes describe, they do not set the bar.");
  }
  process.exit(report.report_derivable ? 0 : 1);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) main();
