#!/usr/bin/env node
// Non-generic-vocabulary check
// Operationalizes criterion L of the Dema UX Proof Harness
// (docs/02-architecture/dema-ux-proof-harness.md):
//   "L. Non-generic language — No generic-agent vocabulary
//   ('agent swarm', 'AI employee', 'autonomous magic',
//   'growth dashboard', 'prompt runner') do not appear in
//   any rendered string."
//
// Scans user-facing surface for forbidden phrases. Read-only audit.
// Fails closed on any finding. Parallels canon-check.mjs +
// boundary-invariant-check.mjs.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, "..", "..");

const FORBIDDEN_PHRASES = Object.freeze([
  "agent swarm",
  "AI employee",
  "autonomous magic",
  "growth dashboard",
  "prompt runner",
]);

const SCAN_PATHS = Object.freeze([
  "apps/cli/src",
  "README.md",
  "docs/USER_LIFECYCLE.md",
  "docs/FIRST_RUN_WIZARD.md",
  "docs/PRODUCT.md",
  "docs/ECOSYSTEM.md",
  "docs/GTM.md",
  "docs/02-architecture/dema-tui-onboarding-design.md",
]);

const EXCLUDED_PATHS = new Set([
  "scripts/review/non-generic-vocabulary-check.mjs",
  "tests/non-generic-vocabulary-check.test.js",
  "docs/02-architecture/dema-ux-proof-harness.md",
]);

const SOURCE_EXTENSIONS = new Set([".js", ".mjs", ".md"]);

function extension(path) {
  const dot = path.lastIndexOf(".");
  return dot >= 0 ? path.slice(dot) : "";
}

function walk(dir, root, files) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git") continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, root, files);
    else if (SOURCE_EXTENSIONS.has(extension(entry))) {
      const rel = relative(root, path).split("\\").join("/");
      if (!EXCLUDED_PATHS.has(rel)) files.push(rel);
    }
  }
}

function listScanFiles(root = REPO_ROOT) {
  const files = [];
  for (const entry of SCAN_PATHS) {
    const absolute = join(root, entry);
    if (!existsSync(absolute)) continue;
    const stat = statSync(absolute);
    if (stat.isDirectory()) walk(absolute, root, files);
    else if (SOURCE_EXTENSIONS.has(extension(entry))) {
      if (!EXCLUDED_PATHS.has(entry)) files.push(entry);
    }
  }
  return files;
}

function lineFor(body, index) {
  return body.slice(0, index).split("\n").length;
}

export function findGenericVocabularyViolations(body, filePath) {
  const violations = [];
  const haystack = body.toLowerCase();
  for (const phrase of FORBIDDEN_PHRASES) {
    const needle = phrase.toLowerCase();
    let from = 0;
    while (true) {
      const index = haystack.indexOf(needle, from);
      if (index < 0) break;
      const line = lineFor(body, index);
      const snippetStart = Math.max(0, index - 30);
      const snippet = body
        .slice(snippetStart, index + needle.length + 30)
        .replace(/\s+/g, " ")
        .trim();
      violations.push({
        file: filePath,
        line,
        phrase,
        snippet: snippet.slice(0, 160),
      });
      from = index + needle.length;
    }
  }
  return violations;
}

export function buildNonGenericVocabularyCheckReport(root = REPO_ROOT) {
  const files = listScanFiles(root);
  const fileResults = [];
  const allViolations = [];
  for (const file of files) {
    const absolute = join(root, file);
    const body = readFileSync(absolute, "utf8");
    const violations = findGenericVocabularyViolations(body, file);
    fileResults.push({
      file,
      violations_count: violations.length,
      ok: violations.length === 0,
    });
    for (const v of violations) allViolations.push(v);
  }
  return {
    schema: "bizra.dema.review.non_generic_vocabulary_check.v0.1",
    mode: "READ_ONLY_AUDIT",
    ok: allViolations.length === 0,
    root,
    forbidden_phrases: FORBIDDEN_PHRASES,
    scan_paths: SCAN_PATHS,
    files_scanned: files.length,
    files_clean: fileResults.filter((f) => f.ok).length,
    files_violated: fileResults.filter((f) => !f.ok).length,
    files: fileResults,
    violations: allViolations,
    boundary: {
      read_only_audit: true,
      runtime_execution: false,
      mutation_performed: false,
      receipt_minted: false,
      filesystem_write_performed: false,
      ci_modified: false,
    },
    note: "Operationalizes UX Proof Harness criterion L. Read-only audit; no mutation. Forbidden phrases come from the harness verbatim. Excludes the harness doc + this script + its test (self-trigger avoidance).",
  };
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const report = buildNonGenericVocabularyCheckReport();
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}
