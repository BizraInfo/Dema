// N0-MUMU-CLI-1 · read-only CLI surface over the sealed Node0 Mumu closed loop.
//
// Dema is the face: it READS and REPORTS the loop's receipt chain. It does NOT
// run the governed runtime (that stays `npm run node0`) and never mutates the
// chain. These builders back `dema node0 mumu status` and `dema node0 mumu
// verify`. Stdlib only; no network/shell imports. See ADR-037.

import { resolve, join } from "node:path";
import { readReceiptChain, verifyReplay } from "./node0-mumu-replay.mjs";

export const SCHEMA_PREFIX = "bizra.dema.node0_mumu";

// Declared GENESIS single-node invariants (ADR-037 §Network mode). The drift
// guard in tests binds these to the loop's persisted state/network-mode.v0.1.json.
export const NETWORK_MODE = Object.freeze({
  network_mode: "GENESIS_SINGLE_NODE_ACTIVE_NETWORK",
  node_count: 1,
  external_federation_active: false,
  global_kernel_active_locally: true,
  local_urp_active: true,
  public_network_claim: false,
  token_minted: false,
  wallet_used: false,
  network_used: false,
});

// Read-only boundary stamp. Reading + hash-verifying a chain is project
// verification, not governed runtime execution (canonical key stays false).
function readOnlyBoundary() {
  return {
    read_only: true,
    runtime_execution_performed: false,
    token_minted: false,
    file_content_read: false,
  };
}

export function defaultOutDir() {
  return resolve(join("artifacts", "node0", "mumu"));
}

export function buildMumuStatus({ outDir = defaultOutDir() } = {}) {
  const abs = resolve(outDir);
  const receipts = readReceiptChain(abs);
  const chainPresent = receipts.length > 0;
  return {
    schema: `${SCHEMA_PREFIX}_cli_status.v0.1`,
    loop_available: true,
    out_dir: abs,
    chain_present: chainPresent,
    receipt_count: receipts.length,
    network_mode: NETWORK_MODE,
    boundary: readOnlyBoundary(),
    next_step: chainPresent
      ? "dema node0 mumu verify"
      : "run the governed loop: `npm run node0 -- --root <dir> --metadata-only`",
  };
}

export function buildMumuVerify({ outDir = defaultOutDir() } = {}) {
  const abs = resolve(outDir);
  const receipts = readReceiptChain(abs);
  if (receipts.length === 0) {
    return {
      schema: `${SCHEMA_PREFIX}_cli_verify.v0.1`,
      chain_present: false,
      verdict: "ABSENT",
      boundary: readOnlyBoundary(),
      note: "No receipt chain found. Run `npm run node0` first.",
    };
  }
  const replay = verifyReplay({ outDir: abs });
  return {
    schema: `${SCHEMA_PREFIX}_cli_verify.v0.1`,
    chain_present: true,
    verdict: replay.ok ? "VERIFIED" : "TAMPERED",
    replay,
    boundary: readOnlyBoundary(),
  };
}
