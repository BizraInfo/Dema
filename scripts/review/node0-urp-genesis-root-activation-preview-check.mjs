#!/usr/bin/env node
// NODE0-URP-GENESIS-ROOT-ACTIVATION-PREVIEW-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import { generateEd25519Keypair } from "../../packages/receipts/src/authorship-signature.js";
import { buildNode0ProofChainLinkPayload } from "../../packages/core/src/node0-proof-chain-link.js";
import { signChainHead, NODE0_SIGNED_CHAIN_HEAD_GO_PHRASE } from "../../packages/core/src/node0-signed-chain-head.js";
import {
  runNode0UrpGenesisRootActivationPreview,
  exampleGenesisRootInput,
  NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_SCHEMA,
  NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_TRUTH_LABEL,
  NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_GO_PHRASE,
} from "../../packages/core/src/node0-urp-genesis-root-activation-preview.js";

const JSON_MODE = process.argv.includes("--json");

// Ephemeral keypair generated HERE (the gate), injected into the pure kernel via the signed
// chain-head. Binds no live Node0 identity; the real genesis key ceremony is separate + operator-gated.
function buildSignedChainHead() {
  const keys = generateEd25519Keypair();
  const chain = buildNode0ProofChainLinkPayload([`sha256:${"1".repeat(64)}`, `sha256:${"2".repeat(64)}`]);
  return signChainHead({
    chain,
    consent: NODE0_SIGNED_CHAIN_HEAD_GO_PHRASE,
    privateKeyPem: keys.private_key_pem,
    publicKeyPem: keys.public_key_pem,
    publicKeyFingerprint: keys.public_key_fingerprint,
  });
}

export function runNode0UrpGenesisRootActivationPreviewCheck() {
  return runNode0UrpGenesisRootActivationPreview({
    consent: NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_GO_PHRASE,
    input: exampleGenesisRootInput(buildSignedChainHead()),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0UrpGenesisRootActivationPreviewCheck();

  if (JSON_MODE) {
    // Strip heavy/non-summary fields here if the envelope carries them.
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - NODE0-URP-GENESIS-ROOT-ACTIVATION-PREVIEW-1A");
    console.log(`  schema: ${NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_SCHEMA}`);
    console.log(`  truth: ${NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
