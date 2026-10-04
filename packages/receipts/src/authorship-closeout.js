import { findLatestAuthorshipReceipt } from "./authorship-latest.js";
import { verifyAuthorshipReceiptFile } from "./authorship-verify.js";
import {
  AUTHORSHIP_TRUST_SNAPSHOT_SCHEMA,
  loadAuthorshipTrustSnapshot,
} from "./authorship-key-store.js";

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
      boundary: Object.freeze({
        ...BOUNDARY,
        external_trust_load_attempted: false,
        public_trust_snapshot_loaded: false,
      }),
    });
  }

  const trustSnapshot = await loadAuthorshipTrustSnapshot(demaHome);
  const verification = await verifyAuthorshipReceiptFile(
    latest.path,
    trustSnapshot,
  );

  const truthLabel = verification.verified
    ? "VERIFIED_ACTIVE_SIGNER_AUTHORSHIP_RECEIPT"
    : "FAILED_ACTIVE_SIGNER_AUTHORSHIP_RECEIPT";

  return Object.freeze({
    schema: CLOSEOUT_SCHEMA,
    found: true,
    verified: verification.verified,
    verdict: verification.verdict,
    error: verification.error ?? null,
    verification_scope: verification.verification_scope,
    trust_state: verification.trust_state ?? "UNKNOWN",
    truth_label: truthLabel,
    receipt_path: latest.path,
    receipt_filename: latest.filename,
    artifact: verification.artifact ?? null,
    author: verification.author ?? null,
    public_key_fingerprint: verification.claimed_fingerprint ?? null,
    claimed_fingerprint: verification.claimed_fingerprint ?? null,
    embedded_fingerprint: verification.embedded_fingerprint ?? null,
    trusted_fingerprint: verification.trusted_fingerprint ?? null,
    trust_loader_error:
      trustSnapshot.schema === AUTHORSHIP_TRUST_SNAPSHOT_SCHEMA
        ? null
        : (trustSnapshot.error ?? "load_failed"),
    boundary: Object.freeze({
      ...BOUNDARY,
      external_trust_load_attempted: true,
      public_trust_snapshot_loaded:
        trustSnapshot.schema === AUTHORSHIP_TRUST_SNAPSHOT_SCHEMA,
    }),
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
