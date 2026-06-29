import * as nodeFs from "node:fs";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { generateEd25519Keypair } from "../../../../packages/receipts/src/authorship-signature.js";
import {
  runNode0SpineRunner,
  NODE0_SPINE_RUNNER_GO_PHRASE,
  NODE0_SPINE_RUNNER_SCHEMA,
  NODE0_SPINE_RUNNER_TRUTH_LABEL,
} from "../../../../packages/core/src/node0-spine-runner.js";
import {
  NODE0_REVERSIBLE_EXECUTE_GATE_PROBE,
} from "../../../../packages/core/src/node0-reversible-execute-gate.js";

export async function cmdNode0SpineRun(ctx) {
  const { argv } = ctx;
  const wantJson = argv.includes("--json");
  const consentIdx = argv.indexOf("--consent");
  const consent =
    consentIdx !== -1 && argv[consentIdx + 1] ? argv[consentIdx + 1] : undefined;
  const sandboxIdx = argv.indexOf("--sandbox");
  const sandboxArg =
    sandboxIdx !== -1 && argv[sandboxIdx + 1] ? argv[sandboxIdx + 1] : undefined;

  if (!consent) {
    console.error(
      `Usage: dema node0 spine run --consent "${NODE0_SPINE_RUNNER_GO_PHRASE}" [--sandbox <dir>] [--json]`,
    );
    process.exit(1);
  }

  let sandboxRoot = sandboxArg;
  let tempSandbox = false;
  if (!sandboxRoot) {
    sandboxRoot = mkdtempSync(join(tmpdir(), "node0-spine-run-"));
    tempSandbox = true;
  }

  const probePath = join(sandboxRoot, NODE0_REVERSIBLE_EXECUTE_GATE_PROBE);
  if (!nodeFs.existsSync(probePath)) {
    writeFileSync(probePath, "loop probe payload\n");
  }

  const now = new Date().toISOString();
  const result = runNode0SpineRunner({
    fs: nodeFs,
    sandboxRoot,
    consent,
    now,
    generateKeypair: generateEd25519Keypair,
  });

  if (wantJson) {
    const {
      execute_receipt: _r,
      receipt_attestation: _a,
      proof_chain: _c,
      chain_head_attestation: _h,
      ...json
    } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log(`Node0 proof spine run — ${NODE0_SPINE_RUNNER_TRUTH_LABEL}`);
    console.log(`  schema: ${NODE0_SPINE_RUNNER_SCHEMA}`);
    console.log(`  sandbox: ${result.sandbox_root}${tempSandbox ? " (temp)" : ""}`);
    console.log(`  execute: ${result.execute_content_hash ?? "—"}`);
    console.log(`  chain head: ${result.proof_chain_head_hash ?? "—"}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by) {
        console.log(`    ${code}`);
      }
    }
  }

  if (!result.ok) {
    process.exitCode = 1;
  }
}
