import { findLatestAuthorshipReceipt } from "./authorship-latest.js";
import { verifyAuthorshipReceiptFile } from "./authorship-verify.js";
import { readFile } from "node:fs/promises";

export const CLOSEOUT_SCHEMA = "bizra.dema.authorship_closeout.v0.1";

const BOUNDARY = Object.freeze({
  signing_performed: false,
  private_key_loaded: false,
  receipt_mutated: false,
  network_used: false,
  federation_used: false,
  token_minted: false,
  verification_performed: true,
  summary_generated: true,
});

export async function buildAuthorshipCloseout(demaHome) {
  const latest = await findLatestAuthorshipReceipt(demaHome);
  if (!latest) {
    return Object.freeze({
      schema: CLOSEOUT_SCHEMA,
      found: false,
      verified: false,
      truth_label: "NO_AUTHORSHIP_RECEIPTS",
      boundary: BOUNDARY,
    });
  }

  const verification = await verifyAuthorshipReceiptFile(latest.path);

  let receipt = null;
  try {
    receipt = JSON.parse(await readFile(latest.path, "utf8"));
  } catch {
    // verification already captured the error
  }

  const truthLabel = verification.verified
    ? "VERIFIED_LOCAL_AUTHORSHIP_RECEIPT"
    : "FAILED_LOCAL_AUTHORSHIP_RECEIPT";

  return Object.freeze({
    schema: CLOSEOUT_SCHEMA,
    found: true,
    verified: verification.verified,
    verdict: verification.verdict,
    truth_label: truthLabel,
    receipt_path: latest.path,
    receipt_filename: latest.filename,
    artifact: verification.artifact ?? null,
    author: verification.author ?? null,
    public_key_fingerprint: receipt?.author?.public_key_fingerprint ?? null,
    boundary: BOUNDARY,
  });
}

export function formatAuthorshipCloseout(closeout) {
  if (!closeout.found) {
    return "Authorship Closeout: No receipts found.";
  }
  const lines = [
    `Authorship Closeout: ${closeout.verdict}`,
    "=".repeat(40),
    `  Receipt:     ${closeout.receipt_filename}`,
    `  Artifact:    ${closeout.artifact?.path ?? "unknown"}`,
    `  SHA256:      ${closeout.artifact?.sha256 ?? "unknown"}`,
    `  Author:      ${closeout.author?.node ?? "unknown"} (${closeout.author?.key_type ?? "unknown"})`,
  ];
  if (closeout.public_key_fingerprint) {
    lines.push(`  Fingerprint: ${closeout.public_key_fingerprint}`);
  }
  lines.push(`  Truth label: ${closeout.truth_label}`);
  return lines.join("\n");
}
