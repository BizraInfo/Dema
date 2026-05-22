#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  buildUrpSharedRuntimeDiscovery,
  buildUrpSharedStateManifest,
  URP_SHARED_MANIFEST_RELATIVE_PATH
} from "../packages/core/src/urp-shared-runtime-discovery.js";
import { runVerificationPipeline } from "../packages/core/src/multi-agent-orchestrator.js";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);

const CANON_MARKERS = [
  { file: "docs/HOUSE_OF_WISDOM_UKE_URP_CANON_v0_1.md", markers: ["URP shared runtime is connected", "no automatic ingestion"] },
  { file: "docs/CLAIM_REGISTER_v0_1.md", markers: ["DESIGNED_NOT_LIVE"] }
];

async function readTextIfExists(root, relPath) {
  const full = join(root, relPath);
  if (!existsSync(full)) return null;
  return await readFile(full, "utf8");
}

async function checkCanonMarkersAsync(root) {
  const checks = [];
  for (const { file, markers } of CANON_MARKERS) {
    const text = await readTextIfExists(root, file);
    const missing = markers.filter((marker) => !text || !text.includes(marker));
    checks.push({ name: `canon:${file}`, ok: missing.length === 0, file, missing });
  }
  return checks;
}

function formatReport(report, canonChecks) {
  const lines = [
    "DEMA URP Shared Runtime Discovery",
    "",
    `Schema: ${report.schema}`,
    `Mode: ${report.mode}`,
    `Manifest path (under DEMA_HOME): ${URP_SHARED_MANIFEST_RELATIVE_PATH}`,
    `Write sample allowed: ${report.write_boundary_sample.allowed ? "yes (theoretical)" : "no"}`,
    "",
    "Canon doc markers:"
  ];
  for (const check of canonChecks) {
    lines.push(`- ${check.ok ? "PASS" : "FAIL"} ${check.name}`);
    if (!check.ok) lines.push(`  missing: ${check.missing.join(", ")}`);
  }
  lines.push("", "Boundary: discovery-only; no network; no UKE auto-ingest; no PAT private export; no persist.");
  return lines.join("\n");
}

function usage() {
  return [
    "Usage: node scripts/urp-shared-discovery.mjs [--json] [--root DIR]",
    "",
    "Emits the URP shared runtime discovery manifest template and SAT-governed write boundary sample."
  ].join("\n");
}

function valueAfter(argv, flag) {
  const index = argv.indexOf(flag);
  if (index === -1) return null;
  return argv[index + 1] ?? null;
}

async function main(argv = process.argv.slice(2)) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(usage());
    return 0;
  }

  const root = valueAfter(argv, "--root") ?? REPO_ROOT;
  const json = argv.includes("--json");

  const sat_pipeline = runVerificationPipeline({ artifact: buildUrpSharedStateManifest() });
  const discovery = buildUrpSharedRuntimeDiscovery({ sat_pipeline });
  const canonChecks = await checkCanonMarkersAsync(root);
  const ok = canonChecks.every((check) => check.ok);

  const payload = { ok, discovery, canon_checks: canonChecks };

  if (json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(formatReport(discovery, canonChecks));
  }

  return ok ? 0 : 1;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().then((code) => {
    if (code !== 0) process.exitCode = code;
  });
}
