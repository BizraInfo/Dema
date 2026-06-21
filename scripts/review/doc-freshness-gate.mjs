#!/usr/bin/env node
// DOC-FRESHNESS-START-HERE-DERIVE-1A — read-only review check.
//
// Fails if a CURATED living doc asserts a hardcoded current-state test count
// (e.g. "2618/2618 tests PASS", "4977/4977 tests", "4959 tests pass"). Living
// docs must point to the live verification command (`npm test` / `npm run
// check` / `docs/TESTING.md`) instead of carrying a number that silently goes
// stale the moment a test lands.
//
// Why (status generated from state, never asserted): hand-maintained counts are
// a treadmill — refreshing a stale anchor just defers the next drift. The fix is
// to delete the asserted number and point to the live source; this gate makes
// that discipline mechanical rather than a matter of vigilance.
//
// Scope (a bound carries its scope): only the CURATED_LIVING_DOCS below are
// scanned. Frozen historical docs — ADRs ("at this ADR's authoring"), GTM
// snapshots, audits, archive, docs/audits/ — are intentionally NOT scanned;
// their point-in-time counts are legitimate records, not drift. The curated
// list is the source of truth for "which docs must stay derived"; a renamed
// curated doc is surfaced as `missing_docs` so the list cannot silently rot.
//
// Discovery (from repo root):  node scripts/review/doc-freshness-gate.mjs
import { readFileSync } from "node:fs";
import { join, isAbsolute, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");

export const SCHEMA = "bizra.dema.review.doc_freshness.v0.1";

// Living docs that present CURRENT state and therefore must not hand-maintain a
// test count. Extend as new living docs appear (frozen docs stay out).
export const CURATED_LIVING_DOCS = Object.freeze([
  "docs/THIRD_FACT_CURRENT_STATE_DELTA.md",
  "docs/00_START_HERE.md",
]);

// A hardcoded test-count assertion: a slash form `N/N tests|passing` or a bare
// `N tests|passing` (3-6 digit count). Pointers like `npm test` /
// `docs/TESTING.md` carry no digit-before-tests and never match. Global so every
// assertion on a line is reported.
export const TEST_COUNT_RE =
  /\b\d{2,6}\s*\/\s*\d{2,6}\s*(?:tests?|passing)\b|\b\d{3,6}\s+(?:tests?|passing)\b/gi;

export const VIOLATION_CODE = "hardcoded_test_count_in_living_doc";

export function checkDocFreshness({
  repoRoot = REPO_ROOT,
  curatedDocs = CURATED_LIVING_DOCS,
} = {}) {
  const violations = [];
  const missing_docs = [];
  let scanned_count = 0;

  for (const rel of curatedDocs) {
    const abs = isAbsolute(rel) ? rel : join(repoRoot, rel);
    let content;
    try {
      content = readFileSync(abs, "utf8");
    } catch {
      missing_docs.push(rel);
      continue;
    }
    scanned_count += 1;
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      for (const m of lines[i].matchAll(TEST_COUNT_RE)) {
        violations.push(
          Object.freeze({
            file: rel,
            line: i + 1,
            match: m[0].trim(),
            code: VIOLATION_CODE,
            reason:
              "living doc asserts a hardcoded test count — replace with a pointer to `npm test` / `npm run check` / `docs/TESTING.md`",
          }),
        );
      }
    }
  }

  const ok = violations.length === 0;
  return Object.freeze({
    schema: SCHEMA,
    ok,
    read_only: true,
    curated_docs: Object.freeze([...curatedDocs]),
    scanned_count,
    violations: Object.freeze(violations),
    violation_count: violations.length,
    missing_docs: Object.freeze(missing_docs),
  });
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const repoRoot = argValue("--repo-root") || REPO_ROOT;
  const report = checkDocFreshness({ repoRoot });
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(
      `doc-freshness: ${report.ok ? "OK" : "VIOLATIONS"} · scanned ${report.scanned_count} living doc(s) · ${report.violation_count} hardcoded count(s)${report.missing_docs.length ? ` · ${report.missing_docs.length} missing` : ""}`,
    );
    for (const v of report.violations) {
      console.log(`  ✗ ${v.file}:${v.line} asserts "${v.match}" — point to npm test / docs/TESTING.md`);
    }
    for (const d of report.missing_docs) {
      console.log(`  ⚠ curated living doc missing: ${d} (update CURATED_LIVING_DOCS)`);
    }
  }
  if (!report.ok) process.exit(1);
}
