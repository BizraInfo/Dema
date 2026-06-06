#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_SCAN_ROOTS = ["apps", "packages", "scripts"];
const SOURCE_EXTENSIONS = new Set([".js", ".mjs"]);
const EXCLUDED_PATHS = new Set(["scripts/review/actuator-check.mjs"]);

function extension(path) {
  const dot = path.lastIndexOf(".");
  return dot >= 0 ? path.slice(dot) : "";
}

function listSourceFiles(root, scanRoots = DEFAULT_SCAN_ROOTS) {
  const files = [];
  for (const scanRoot of scanRoots) {
    const absolute = join(root, scanRoot);
    if (!existsSync(absolute)) continue;
    walk(absolute, root, files);
  }
  return files.filter((file) => !EXCLUDED_PATHS.has(file));
}

function walk(dir, root, files) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git") continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path, root, files);
    } else if (SOURCE_EXTENSIONS.has(extension(entry))) {
      files.push(relative(root, path).split("\\").join("/"));
    }
  }
}

function lineNumber(body, index) {
  return body.slice(0, index).split("\n").length;
}

function collectRegexFindings(body, file, pattern, label) {
  const findings = [];
  for (const match of body.matchAll(pattern)) {
    findings.push({
      file,
      line: lineNumber(body, match.index),
      label,
      match: match[0],
    });
  }
  return findings;
}

export function analyzeActuatorSource(body, file = "(memory)") {
  const findings = [
    ...collectRegexFindings(
      body,
      file,
      /\bexec\s*\(/g,
      "child_process.exec_raw_shell",
    ),
    ...collectRegexFindings(
      body,
      file,
      /\bexecSync\s*\(/g,
      "child_process.execSync_raw_shell",
    ),
  ];

  const spawnPattern = /\bspawn(?:Sync)?\s*\(([\s\S]{0,320}?)\)/g;
  for (const match of body.matchAll(spawnPattern)) {
    if (/\bshell\s*:\s*true\b/.test(match[1])) {
      findings.push({
        file,
        line: lineNumber(body, match.index),
        label: "child_process.spawn_shell_true",
        match: match[0].split("\n")[0],
      });
    }
  }

  return findings;
}

export function analyzeEffectCapInvariantSource(body, file = "(memory)") {
  const findings = [
    ...collectRegexFindings(
      body,
      file,
      /\bEffectCap\.perform\s*\([^)]*\bexec\b/gi,
      "effectcap.caller_exec_closure",
    ),
    ...collectRegexFindings(
      body,
      file,
      /\beffectingOperation\s*\([^)]*\bexec\b/gi,
      "effectcap.caller_exec_closure",
    ),
    ...collectRegexFindings(
      body,
      file,
      /\bperform\s*\([^;\n]*(?:=>|function\s*\()/gi,
      "effectcap.caller_exec_closure",
    ),
    ...collectRegexFindings(
      body,
      file,
      /\b(eval|Function)\s*\(/g,
      "policy.executable_rule_code",
    ),
  ];

  return findings;
}

export function buildActuatorCheckReport({
  root = process.cwd(),
  scanRoots = DEFAULT_SCAN_ROOTS,
} = {}) {
  const files = listSourceFiles(root, scanRoots);
  const findings = [];
  for (const file of files) {
    const body = readFileSync(join(root, file), "utf8");
    findings.push(
      ...analyzeActuatorSource(body, file),
      ...analyzeEffectCapInvariantSource(body, file),
    );
  }
  return {
    schema: "bizra.dema.review.actuator_check.v0.1",
    ok: findings.length === 0,
    scanned_roots: scanRoots,
    scanned_files: files,
    forbidden_patterns: [
      "child_process.exec",
      "child_process.execSync",
      "child_process.spawn/spawnSync with shell:true",
      "caller-provided EffectCap execution closures",
      "executable policy rule code",
    ],
    allowed_patterns: [
      "execFile/execFileSync with argv array",
      "spawn/spawnSync without shell:true",
    ],
    findings,
    boundary: {
      read_only_audit: true,
      runtime_execution: false,
      mutation_performed: false,
      receipt_minted: false,
    },
  };
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const report = buildActuatorCheckReport();
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}
