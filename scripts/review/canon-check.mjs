#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_REGISTRY = "docs/canon/canon_registry.json";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function listMarkdownFiles(dir, root = dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git") continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...listMarkdownFiles(path, root));
    } else if (entry.endsWith(".md")) {
      files.push(relative(root, path).split("\\").join("/"));
    }
  }
  return files;
}

function lineNumber(body, index) {
  return body.slice(0, index).split("\n").length;
}

function phraseFindings({ root, registry, markdownFiles }) {
  const findings = [];
  for (const file of markdownFiles) {
    const body = readFileSync(join(root, file), "utf8");
    for (const rule of registry.forbidden_topology_phrases ?? []) {
      if ((rule.allowed_files ?? []).includes(file)) continue;
      let index = body.indexOf(rule.phrase);
      while (index >= 0) {
        findings.push({
          file,
          line: lineNumber(body, index),
          phrase: rule.phrase
        });
        index = body.indexOf(rule.phrase, index + rule.phrase.length);
      }
    }
  }
  return findings;
}

export function buildCanonCheckReport({
  root = process.cwd(),
  registryPath = DEFAULT_REGISTRY
} = {}) {
  const fullRegistryPath = join(root, registryPath);
  if (!existsSync(fullRegistryPath)) {
    throw new Error(`Canon registry not found: ${registryPath}`);
  }

  const registry = readJson(fullRegistryPath);
  const missingFiles = (registry.required_files ?? []).filter((file) => !existsSync(join(root, file)));
  const canonicalFile = join(root, "docs/canon/BIZRA_TOPOLOGY_CANON.md");
  const canonicalBody = existsSync(canonicalFile) ? readFileSync(canonicalFile, "utf8") : "";
  const canonicalSentencePresent = canonicalBody.includes(registry.canonical_sentence);
  const markdownFiles = listMarkdownFiles(join(root, "docs"), root);
  const forbiddenFindings = phraseFindings({ root, registry, markdownFiles });

  const ok = missingFiles.length === 0 && canonicalSentencePresent && forbiddenFindings.length === 0;
  return {
    schema: "bizra.dema.review.canon_check.v0.1",
    ok,
    registry: registryPath,
    truth_label: registry.truth_label,
    canonical_sentence_present: canonicalSentencePresent,
    required_files_checked: registry.required_files ?? [],
    missing_files: missingFiles,
    forbidden_topology_findings: forbiddenFindings,
    boundary: {
      read_only_audit: true,
      runtime_execution: false,
      federation_started: false,
      receipt_minted: false,
      ci_modified: false
    }
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const report = buildCanonCheckReport();
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}
