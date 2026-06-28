#!/usr/bin/env node
// NODE0-REVERSIBLE-EXECUTE-GATE-1A - sandbox execute + undo proof verifier.

import * as nodeFs from "node:fs";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  runNode0ReversibleExecuteGate,
  NODE0_REVERSIBLE_EXECUTE_GATE_SCHEMA,
  NODE0_REVERSIBLE_EXECUTE_TRUTH_LABEL,
  NODE0_REVERSIBLE_EXECUTE_GATE_PROBE,
} from "../../packages/core/src/node0-reversible-execute-gate.js";

const JSON_MODE = process.argv.includes("--json");
const NOW = "2026-06-28T18:00:00.000Z";

export function runNode0ReversibleExecuteGateCheck() {
  const sandboxRoot = mkdtempSync(join(tmpdir(), "node0-exec-gate-check-"));
  try {
    writeFileSync(join(sandboxRoot, NODE0_REVERSIBLE_EXECUTE_GATE_PROBE), "loop probe payload\n");
    return runNode0ReversibleExecuteGate({ fs: nodeFs, sandboxRoot, now: NOW });
  } finally {
    rmSync(sandboxRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0ReversibleExecuteGateCheck();

  if (JSON_MODE) {
    const { receipt: _r, undo: _u, ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - Node0 reversible execute gate");
    console.log(`  schema: ${NODE0_REVERSIBLE_EXECUTE_GATE_SCHEMA}`);
    console.log(`  truth: ${NODE0_REVERSIBLE_EXECUTE_TRUTH_LABEL}`);
    console.log(`  sandbox_root: ${result.sandbox_root}`);
    console.log(`  undo_proven: ${result.undo_proven}`);
    console.log(`  content_hash: ${result.content_hash}`);
    console.log(`  state_hash: ${result.state_hash}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by) {
        console.log(`    ${code}`);
      }
    }
  }

  if (!result.ok) process.exit(1);
}
