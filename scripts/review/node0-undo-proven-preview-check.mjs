#!/usr/bin/env node
// NODE0-UNDO-PROVEN-1A — measured inverse correction preview gate.

import * as nodeFs from "node:fs";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  runNode0UndoProvenPreviewGate,
  NODE0_UNDO_PROVEN_PREVIEW_SCHEMA,
  NODE0_UNDO_PROVEN_PREVIEW_TRUTH_LABEL,
} from "../../packages/core/src/node0-undo-proven-preview.js";
import {
  NODE0_REVERSIBLE_EXECUTE_GATE_PROBE,
} from "../../packages/core/src/node0-reversible-execute-gate.js";

const JSON_MODE = process.argv.includes("--json");
const NOW = "2026-06-30T12:00:00.000Z";

export function runNode0UndoProvenPreviewCheck() {
  const sandboxRoot = mkdtempSync(join(tmpdir(), "node0-undo-proven-check-"));
  try {
    writeFileSync(
      join(sandboxRoot, NODE0_REVERSIBLE_EXECUTE_GATE_PROBE),
      "undo proven probe payload\n",
    );
    return runNode0UndoProvenPreviewGate({ fs: nodeFs, sandboxRoot, now: NOW });
  } finally {
    rmSync(sandboxRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0UndoProvenPreviewCheck();

  if (JSON_MODE) {
    const { gate: _g, preview: _p, ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA · Node0 undo-proven preview");
    console.log(`  schema: ${NODE0_UNDO_PROVEN_PREVIEW_SCHEMA}`);
    console.log(`  truth: ${NODE0_UNDO_PROVEN_PREVIEW_TRUTH_LABEL}`);
    console.log(`  undo_proven: ${result.undo_proven}`);
    console.log(`  preview_hash: ${result.preview_hash}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by) {
        console.log(`    ${code}`);
      }
    }
  }

  if (!result.ok) process.exit(1);
}
