#!/usr/bin/env node
// NODE0-RECEIPT-SIGNING-ED25519-1A — attestation bridge proof verifier.

import * as nodeFs from "node:fs";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { generateEd25519Keypair } from "../../packages/receipts/src/authorship-signature.js";
import {
  NODE0_REVERSIBLE_EXECUTE_GATE_PROBE,
} from "../../packages/core/src/node0-reversible-execute-gate.js";
import {
  runNode0ReceiptSigningEd25519,
  NODE0_RECEIPT_SIGNING_ED25519_SCHEMA,
  NODE0_RECEIPT_SIGNING_TRUTH_LABEL,
} from "../../packages/core/src/node0-receipt-signing-ed25519.js";

const JSON_MODE = process.argv.includes("--json");
const NOW = "2026-06-28T18:00:00.000Z";

export function runNode0ReceiptSigningEd25519Check() {
  const sandboxRoot = mkdtempSync(join(tmpdir(), "node0-receipt-sign-check-"));
  try {
    writeFileSync(
      join(sandboxRoot, NODE0_REVERSIBLE_EXECUTE_GATE_PROBE),
      "loop probe payload\n",
    );
    return runNode0ReceiptSigningEd25519({
      fs: nodeFs,
      sandboxRoot,
      now: NOW,
      generateKeypair: generateEd25519Keypair,
    });
  } finally {
    rmSync(sandboxRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0ReceiptSigningEd25519Check();

  if (JSON_MODE) {
    const { receipt: _r, attestation: _a, ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - Node0 receipt signing Ed25519 attestation");
    console.log(`  schema: ${NODE0_RECEIPT_SIGNING_ED25519_SCHEMA}`);
    console.log(`  truth: ${NODE0_RECEIPT_SIGNING_TRUTH_LABEL}`);
    console.log(`  sandbox_root: ${result.sandbox_root}`);
    console.log(`  attestation_signed: ${result.attestation_signed}`);
    console.log(`  verify_ok: ${result.verify_ok}`);
    console.log(`  tamper_content_hash_rejected: ${result.tamper_content_hash_rejected}`);
    console.log(`  tamper_state_hash_rejected: ${result.tamper_state_hash_rejected}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by) {
        console.log(`    ${code}`);
      }
    }
  }

  if (!result.ok) process.exit(1);
}
