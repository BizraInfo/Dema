#!/usr/bin/env node
// NODE0-URP-GENESIS-ROOT-COMPOSITION-GATE-PREVIEW-1A — review gate. Builds a real signed genesis-root
// descriptor, composes it with the example URP resource-family surfaces, and emits the verdict.

import { pathToFileURL } from "node:url";

import { generateEd25519Keypair } from "../../packages/receipts/src/authorship-signature.js";
import { buildNode0ProofChainLinkPayload } from "../../packages/core/src/node0-proof-chain-link.js";
import { signChainHead, NODE0_SIGNED_CHAIN_HEAD_GO_PHRASE } from "../../packages/core/src/node0-signed-chain-head.js";
import {
  buildNode0UrpGenesisRootActivationPreviewPayload,
  exampleGenesisRootInput,
} from "../../packages/core/src/node0-urp-genesis-root-activation-preview.js";
import {
  runNode0UrpGenesisRootCompositionGatePreview,
  exampleCompositionInput,
  node0UrpGenesisRootCompositionGatePreviewBoundary,
  NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_SCHEMA,
  NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_TRUTH_LABEL,
  NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_GO_PHRASE,
} from "../../packages/core/src/node0-urp-genesis-root-composition-gate-preview.js";

const JSON_MODE = process.argv.includes("--json");

// Ephemeral keypair generated HERE (the gate), injected into the pure genesis kernel via the signed
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

export function buildExampleGenesisRootPacket() {
  return buildNode0UrpGenesisRootActivationPreviewPayload(exampleGenesisRootInput(buildSignedChainHead()));
}

export function runNode0UrpGenesisRootCompositionGatePreviewCheck() {
  return runNode0UrpGenesisRootCompositionGatePreview({
    consent: NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_GO_PHRASE,
    input: exampleCompositionInput(buildExampleGenesisRootPacket()),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0UrpGenesisRootCompositionGatePreviewCheck();
  const boundaryAllFalse = Object.values(node0UrpGenesisRootCompositionGatePreviewBoundary()).every(
    (v) => v === false,
  );

  if (JSON_MODE) {
    console.log(
      JSON.stringify(
        {
          schema: result.schema,
          status: result.status,
          ok: result.ok,
          content_hash: result.content_hash,
          composed_surface_count: result.composed_surface_count,
          composition_ready: result.composition_ready,
          boundary_all_false: boundaryAllFalse,
          mint_allowed: result.mint_allowed,
          live_urp: result.live_urp,
          federation: result.federation,
          daemon: result.daemon,
          network: result.network,
          what_this_proves: result.what_this_proves,
          what_this_does_not_prove: result.what_this_does_not_prove,
          blocked_by: result.blocked_by,
        },
        null,
        2,
      ),
    );
  } else {
    console.log("DEMA - NODE0-URP-GENESIS-ROOT-COMPOSITION-GATE-PREVIEW-1A");
    console.log(`  schema: ${NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_SCHEMA}`);
    console.log(`  truth: ${NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_TRUTH_LABEL}`);
    console.log(`  status: ${result.status}`);
    console.log(`  content_hash: ${result.content_hash}`);
    console.log(`  composed_surface_count: ${result.composed_surface_count}`);
    console.log(`  boundary_all_false: ${boundaryAllFalse}`);
    console.log(`  mint_allowed: ${result.mint_allowed} | live_urp: ${result.live_urp} | federation: ${result.federation} | daemon: ${result.daemon} | network: ${result.network}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
