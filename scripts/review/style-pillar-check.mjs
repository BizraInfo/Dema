#!/usr/bin/env node
// STYLE-PILLAR-MICRO-1A — stdlib-only style gate (zero-dep safe).
//
// Agent-compat Style pillar cannot use ESLint/Prettier in package.json (zero-dep
// gate fails closed). This gate enforces a minimal mechanical style baseline on
// tracked JS/MJS sources without adding dependencies.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SCHEMA = "bizra.dema.review.style_pillar_gate.v0.1";
export const SLICE_ID = "STYLE-PILLAR-MICRO-1A";

export const DEFAULT_SCAN_ROOTS = Object.freeze([
  "packages",
  "apps",
  "scripts",
  "tests",
  "bin",
]);

const BANNED_STYLE_TOOL_PATTERN =
  /\b(eslint|prettier|@biomejs\/biome|stylelint)\b/i;

export function listJsSourceFiles(root, scanRoots = DEFAULT_SCAN_ROOTS) {
  const files = [];
  for (const scanRoot of scanRoots) {
    const abs = join(root, scanRoot);
    if (!existsSync(abs)) continue;
    walkJs(abs, root, files);
  }
  return files.sort();
}

function walkJs(dir, root, files) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry === ".next") continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walkJs(path, root, files);
    } else if (/\.(js|mjs)$/.test(entry)) {
      files.push(relative(root, path).split("\\").join("/"));
    }
  }
}

export function scanFileStyle(file, body) {
  const findings = [];
  if (body.includes("\r")) {
    findings.push({ rule: "crlf", file, line: 1, detail: "CRLF or bare CR byte present" });
  }
  if (body.length > 0 && !body.endsWith("\n")) {
    findings.push({
      rule: "missing_final_newline",
      file,
      line: body.split("\n").length,
      detail: "File must end with a single LF newline",
    });
  }
  if (body.includes("\t")) {
    findings.push({
      rule: "tab_character",
      file,
      line: lineNumber(body, body.indexOf("\t")),
      detail: "Tab characters are forbidden; use spaces",
    });
  }
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/[ \t]+$/.test(lines[i])) {
      findings.push({
        rule: "trailing_whitespace",
        file,
        line: i + 1,
        detail: "Trailing whitespace on line",
      });
    }
  }
  return findings;
}

function lineNumber(body, index) {
  return body.slice(0, index).split("\n").length;
}

export function evaluateBannedStyleTools(pkg) {
  const hits = [];
  const depKeys = [
    ...Object.keys(pkg?.dependencies ?? {}),
    ...Object.keys(pkg?.devDependencies ?? {}),
  ];
  for (const key of depKeys) {
    if (BANNED_STYLE_TOOL_PATTERN.test(key)) {
      hits.push({ location: "dependencies", name: key });
    }
  }
  for (const [name, value] of Object.entries(pkg?.scripts ?? {})) {
    if (BANNED_STYLE_TOOL_PATTERN.test(String(value))) {
      hits.push({ location: "scripts", name });
    }
  }
  return Object.freeze(hits);
}

export function evaluateStylePillar({
  root,
  scanRoots = DEFAULT_SCAN_ROOTS,
  packageJson = null,
  maxFindings = 25,
} = {}) {
  const files = listJsSourceFiles(root, scanRoots);
  const findings = [];
  for (const file of files) {
    const body = readFileSync(join(root, file), "utf8");
    findings.push(...scanFileStyle(file, body));
    if (findings.length >= maxFindings) break;
  }
  const banned_style_tools = packageJson
    ? evaluateBannedStyleTools(packageJson)
    : Object.freeze([]);
  const style_findings = Object.freeze(findings.slice(0, maxFindings));
  const ok = style_findings.length === 0 && banned_style_tools.length === 0;
  const rules_checked = Object.freeze([
    "lf_line_endings",
    "final_newline",
    "no_trailing_whitespace",
    "no_tab_characters",
    "no_banned_style_tools_in_package_json",
  ]);
  const pillar_score_estimate = ok ? 32 : 8;
  return Object.freeze({
    schema: SCHEMA,
    slice: SLICE_ID,
    ok,
    files_scanned: files.length,
    findings_count: style_findings.length,
    findings: style_findings,
    banned_style_tools,
    rules_checked,
    pillar_score_estimate,
    pillar_note:
      "stdlib micro-gate only; full Style pillar still needs advisory npx ESLint-class path outside check",
    zero_dep_safe: true,
  });
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const packageJson = JSON.parse(
    readFileSync(join(root, "package.json"), "utf8"),
  );
  const report = evaluateStylePillar({ root, packageJson });
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    console.error(
      `[style-pillar] FAIL — ${report.findings_count} style finding(s), ` +
        `${report.banned_style_tools.length} banned tool reference(s).`,
    );
    process.exit(1);
  }
  console.log(
    `[style-pillar] OK — ${report.files_scanned} files scanned; ` +
      `pillar_score_estimate=${report.pillar_score_estimate}/100 (stdlib micro-gate).`,
  );
}
