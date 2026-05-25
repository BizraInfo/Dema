import { createHash } from "node:crypto";
import { mkdir, writeFile, rename, unlink, realpath } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { buildHarnessIntegrationSummary } from "../../core/src/harness-integration.js";
import { buildNode0HomebaseStatePreview } from "../../core/src/node0-homebase-state-preview.js";
import { checkSetup } from "../../installer/src/setup.js";

const SCHEMA = "bizra.dema.node0_witness_receipt.v0.1";
const TRUTH_LABEL = "LOCAL_OPERATOR_WITNESS";
const CONSENT_PHRASE = "WITNESS NODE0 STATE";

export { CONSENT_PHRASE as WITNESS_CONSENT_PHRASE };

export async function buildWitnessAttestation({ now = new Date() } = {}) {
  const harness = buildHarnessIntegrationSummary();
  const topology = buildNode0HomebaseStatePreview();
  const home = process.env.DEMA_HOME || join(homedir(), ".dema");
  const setup = await checkSetup(home);

  const attests = {
    node: "Node0",
    connected_nodes: 1,
    pat_count: topology.pat_count ?? 7,
    sat_count: topology.sat_count ?? 5,
    urp_status: "active_locked_local_only",
    harness_verdict: harness.verdict ?? "UNKNOWN",
    harness_gates: harness.gates ?? "?",
    harness_gaps: harness.critique_gaps ?? 0,
    setup_integrity: setup.verdict ?? "UNKNOWN",
    epistemic_ground: "topology_canon",
    federation: false,
    token_claim: false,
    model_invocation: false,
    public_network: false,
  };

  const content_hash = sha256(stableStringify(attests));

  return {
    schema: SCHEMA,
    truth_label: TRUTH_LABEL,
    witnessed_at: now.toISOString(),
    attests,
    content_hash,
    boundary: {
      filesystem_write_performed: false,
      network_used: false,
      runtime_execution_performed: false,
      model_loaded: false,
      model_invocation_performed: false,
      prompt_executed: false,
      external_call_performed: false,
      raw_corpus_scan_performed: false,
      raw_data_included: false,
      tool_executed: false,
      chain_advance_performed: false,
      receipt_mint_performed: false,
      federation_invoked: false,
      node_connection_performed: false,
      public_network_used: false,
      consent_collected: false,
    },
  };
}

export async function saveWitnessReceipt({
  consent = "",
  dryRun = false,
  now = new Date(),
} = {}) {
  const attestation = await buildWitnessAttestation({ now });

  if (consent !== CONSENT_PHRASE) {
    return {
      ...attestation,
      saved: false,
      reason: "consent_phrase_mismatch",
      required_phrase: CONSENT_PHRASE,
      dry_run: dryRun,
    };
  }

  if (dryRun) {
    return {
      ...attestation,
      saved: false,
      reason: "dry_run",
      dry_run: true,
    };
  }

  attestation.boundary.filesystem_write_performed = true;
  attestation.boundary.consent_collected = true;

  const home = process.env.DEMA_HOME || join(homedir(), ".dema");
  const receiptsDir = join(home, "receipts");
  await mkdir(receiptsDir, { recursive: true });

  const realDir = await realpath(receiptsDir);
  const content = JSON.stringify(attestation, null, 2) + "\n";
  const fileHash = createHash("sha256").update(content).digest("hex");
  const fileName = `witness-${fileHash.slice(0, 16)}.json`;
  const finalPath = join(realDir, fileName);
  const tmpPath = finalPath + ".tmp";

  try {
    await writeFile(tmpPath, content, { encoding: "utf8", flag: "wx" });
    await rename(tmpPath, finalPath);
  } catch (err) {
    try {
      await unlink(tmpPath);
    } catch {}
    throw err;
  }

  return {
    ...attestation,
    saved: true,
    reason: "consent_verified",
    path: finalPath,
    file_hash: fileHash,
    dry_run: false,
  };
}

export function formatWitnessReceipt(receipt) {
  const lines = [
    "NODE0 SELF-WITNESS RECEIPT v0.1",
    "",
    `Truth label: ${receipt.truth_label}`,
    `Witnessed:   ${receipt.witnessed_at}`,
    `Content hash: ${receipt.content_hash}`,
    "",
    "Attests:",
  ];

  for (const [key, value] of Object.entries(receipt.attests)) {
    lines.push(`  ${key}: ${value}`);
  }

  lines.push("");

  if (receipt.saved) {
    lines.push(`Saved to: ${receipt.path}`);
    lines.push(`File hash: ${receipt.file_hash}`);
  } else if (receipt.reason === "dry_run") {
    lines.push("Mode: dry-run (no file written)");
  } else if (receipt.reason === "consent_phrase_mismatch") {
    lines.push(`Consent required: --consent "${receipt.required_phrase}"`);
  }

  lines.push("");
  lines.push(
    "Boundary: local-only witness. No federation, no token, no model, no public network.",
  );

  return lines.join("\n");
}
