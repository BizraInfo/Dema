#!/usr/bin/env node
// DEMA-ROOT-CLAUSE-TRACE-REGISTRY-PREVIEW-1A — review gate. Reads the hand-reviewed
// Three-Root Canon clause registry JSON, builds a valid three-root trace and asserts
// it PERMITs, then asserts an incomplete-roots trace BLOCKs. Emits the verdict.

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

import {
  loadClauseRegistry,
  runRootClauseTracePreview,
  ROOT_CLAUSE_TRACE_SCHEMA,
  ROOT_CLAUSE_TRACE_EVAL_SCHEMA,
  ROOT_CLAUSE_TRACE_TRUTH_LABEL,
} from "../../packages/consent/src/root-clause-trace-preview.js";

const JSON_MODE = process.argv.includes("--json");

const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = join(
  __dirname,
  "..",
  "..",
  "docs",
  "canon",
  "BIZRA_ROOT_CLAUSE_REGISTRY_v0_1.json",
);

export function runRootClauseTracePreviewCheck() {
  const registry = loadClauseRegistry(
    JSON.parse(readFileSync(REGISTRY_PATH, "utf8")),
  );
  return runRootClauseTracePreview({ registry });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runRootClauseTracePreviewCheck();

  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA - DEMA-ROOT-CLAUSE-TRACE-REGISTRY-PREVIEW-1A");
    console.log(`  trace_schema: ${ROOT_CLAUSE_TRACE_SCHEMA}`);
    console.log(`  eval_schema: ${ROOT_CLAUSE_TRACE_EVAL_SCHEMA}`);
    console.log(`  truth: ${ROOT_CLAUSE_TRACE_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
