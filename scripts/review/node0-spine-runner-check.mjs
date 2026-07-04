#!/usr/bin/env node
// NODE0-SPINE-RUNNER-CLI-1A — review gate for the measured proof spine operator path.

import * as nodeFs from "node:fs";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { generateEd25519Keypair } from "../../packages/receipts/src/authorship-signature.js";
import {
  runNode0SpineRunner,
  NODE0_SPINE_RUNNER_SCHEMA,
  NODE0_SPINE_RUNNER_TRUTH_LABEL,
  NODE0_SPINE_RUNNER_GO_PHRASE,
} from "../../packages/core/src/node0-spine-runner.js";
import {
  NODE0_REVERSIBLE_EXECUTE_GATE_PROBE,
} from "../../packages/core/src/node0-reversible-execute-gate.js";

const JSON_MODE = process.argv.includes("--json");
const NOW = "2026-06-28T18:00:00.000Z";

export function runNode0SpineRunnerCheck() {
  const sandboxRoot = mkdtempSync(join(tmpdir(), "node0-spine-runner-check-"));
  try {
    writeFileSync(
      join(sandboxRoot, NODE0_REVERSIBLE_EXECUTE_GATE_PROBE),
      "loop probe payload\n",
    );
    return runNode0SpineRunner({
      fs: nodeFs,
      sandboxRoot,
      consent: NODE0_SPINE_RUNNER_GO_PHRASE,
      now: NOW,
      generateKeypair: generateEd25519Keypair,
      proveUndo: true,
    });
  } finally {
    rmSync(sandboxRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0SpineRunnerCheck();

  if (JSON_MODE) {
    const {
      execute_receipt: _r,
      receipt_attestation: _a,
      proof_chain: _c,
      chain_head_attestation: _h,
      ...json
    } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - NODE0-SPINE-RUNNER-CLI-1A");
    console.log(`  schema: ${NODE0_SPINE_RUNNER_SCHEMA}`);
    console.log(`  truth: ${NODE0_SPINE_RUNNER_TRUTH_LABEL}`);
    console.log(`  sandbox_root: ${result.sandbox_root}`);
    console.log(`  execute_content_hash: ${result.execute_content_hash}`);
    console.log(`  proof_chain_head_hash: ${result.proof_chain_head_hash}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) {
        console.log(`    ${code}`);
      }
    }
  }

  if (!result.ok) process.exit(1);
}
