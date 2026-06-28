#!/usr/bin/env node
// NODE0-PROOF-CHAIN-LINK-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  runNode0ProofChainLink,
  NODE0_PROOF_CHAIN_LINK_SCHEMA,
  NODE0_PROOF_CHAIN_LINK_TRUTH_LABEL,
  NODE0_PROOF_CHAIN_LINK_GO_PHRASE,
} from "../../packages/core/src/node0-proof-chain-link.js";

const JSON_MODE = process.argv.includes("--json");

export function runNode0ProofChainLinkCheck() {
  // Canonical fixture: three #307-style receipt content_hash anchors (>= 2 so the
  // reorder-reject branch exercises). Fixed values keep the gate deterministic.
  const receiptHashes = [
    `sha256:${"1".repeat(64)}`,
    `sha256:${"2".repeat(64)}`,
    `sha256:${"3".repeat(64)}`,
  ];
  return runNode0ProofChainLink({
    consent: NODE0_PROOF_CHAIN_LINK_GO_PHRASE,
    receiptHashes,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0ProofChainLinkCheck();

  if (JSON_MODE) {
    // Strip heavy/non-summary fields here if the envelope carries them.
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - NODE0-PROOF-CHAIN-LINK-1A");
    console.log(`  schema: ${NODE0_PROOF_CHAIN_LINK_SCHEMA}`);
    console.log(`  truth: ${NODE0_PROOF_CHAIN_LINK_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
