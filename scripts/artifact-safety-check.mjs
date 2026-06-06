#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

import {
  evaluateArtifactSafety,
  formatArtifactSafetyReport,
} from "../packages/core/src/artifact-safety-eval.js";

function usage() {
  return [
    "Usage: node scripts/artifact-safety-check.mjs --artifact <abs-path> [--json]",
    "",
    "Read-only Layer 1 eval: path leakage, secret-like strings, claim boundary.",
    "Exits 0 only when verdict is PUBLIC_SAFE (share-safe external mode).",
    "LOCAL_ONLY, LEAKAGE_DETECTED, CLAIM_BOUNDARY_VIOLATION, SCHEMA_VIOLATION → exit 1.",
  ].join("\n");
}

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const artifactPath = argValue("--artifact");
  const jsonOut = process.argv.includes("--json");

  if (!artifactPath) {
    process.stderr.write(`${usage()}\n`);
    process.exit(2);
  }
  if (!isAbsolute(artifactPath)) {
    process.stderr.write(
      "artifact-safety-check: --artifact must be an absolute path\n",
    );
    process.exit(2);
  }

  const resolved = resolve(artifactPath);
  const raw = await readFile(resolved, "utf8");
  let input = raw;
  if (resolved.endsWith(".json")) {
    try {
      input = JSON.parse(raw);
    } catch (error) {
      process.stderr.write(
        `artifact-safety-check: invalid JSON: ${error.message}\n`,
      );
      process.exit(2);
    }
  }

  const beforeHash = evaluateArtifactSafety(input).artifact_sha256;
  const result = evaluateArtifactSafety(input, { external_share_mode: true });
  const afterHash = evaluateArtifactSafety(input).artifact_sha256;
  if (beforeHash !== afterHash) {
    process.stderr.write(
      "artifact-safety-check: input mutated during scan (refusing)\n",
    );
    process.exit(2);
  }

  if (jsonOut) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatArtifactSafetyReport(result)}\n`);
  }

  process.exit(result.verdict === "PUBLIC_SAFE" ? 0 : 1);
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  main().catch((error) => {
    process.stderr.write(`artifact-safety-check: ${error.message}\n`);
    process.exit(2);
  });
}
