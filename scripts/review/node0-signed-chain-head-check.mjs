#!/usr/bin/env node
// NODE0-SIGNED-CHAIN-HEAD-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import { generateEd25519Keypair } from "../../packages/receipts/src/authorship-signature.js";
import {
  runNode0SignedChainHead,
  NODE0_SIGNED_CHAIN_HEAD_SCHEMA,
  NODE0_SIGNED_CHAIN_HEAD_TRUTH_LABEL,
} from "../../packages/core/src/node0-signed-chain-head.js";

const JSON_MODE = process.argv.includes("--json");

export function runNode0SignedChainHeadCheck() {
  // Inject an ephemeral keypair (no persistent custody) and a fixed receipt-anchor
  // fixture so the gate is deterministic except for the signature value.
  return runNode0SignedChainHead({ generateKeypair: generateEd25519Keypair });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0SignedChainHeadCheck();

  if (JSON_MODE) {
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - NODE0-SIGNED-CHAIN-HEAD-1A");
    console.log(`  schema: ${NODE0_SIGNED_CHAIN_HEAD_SCHEMA}`);
    console.log(`  truth: ${NODE0_SIGNED_CHAIN_HEAD_TRUTH_LABEL}`);
    console.log(`  attestation_signed: ${result.attestation_signed}`);
    console.log(`  verify_ok: ${result.verify_ok}`);
    console.log(`  bind_ok: ${result.bind_ok}`);
    console.log(`  tamper_chain_bind_rejected: ${result.tamper_chain_bind_rejected}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
