import { readFile } from "node:fs/promises";
import { verifyPayload, AUTHORSHIP_SCHEMA } from "./authorship-signature.js";

export const VERIFY_RESULT_SCHEMA = "bizra.dema.authorship_verify_result.v0.1";

const BOUNDARY = Object.freeze({
  network_used: false,
  mutation_performed: false,
  private_key_loaded: false,
  federation_used: false,
  token_minted: false,
});

export async function verifyAuthorshipReceiptFile(receiptPath) {
  if (!receiptPath || typeof receiptPath !== "string") {
    return failResult("no_receipt_path");
  }

  let raw;
  try {
    raw = JSON.parse(await readFile(receiptPath, "utf8"));
  } catch {
    return failResult("cannot_read_receipt", { path: receiptPath });
  }

  if (raw.schema !== AUTHORSHIP_SCHEMA || !raw.signature) {
    return failResult("not_valid_authorship_receipt", { path: receiptPath });
  }

  const { signature, ...payload } = raw;
  let ok;
  try {
    ok = verifyPayload(payload, signature.value, signature.public_key_pem);
  } catch {
    ok = false;
  }

  return Object.freeze({
    schema: VERIFY_RESULT_SCHEMA,
    verified: ok,
    verdict: ok ? "VERIFIED" : "FAILED",
    receipt_path: receiptPath,
    artifact: payload.artifact,
    author: payload.author,
    boundary: BOUNDARY,
  });
}

export function formatAuthorshipVerification(result) {
  if (!result.verified && result.error) {
    return `FAILED: ${result.error}`;
  }
  const lines = [
    `Authorship Verification: ${result.verdict}`,
    `  Artifact: ${result.artifact?.path ?? "unknown"}`,
    `  SHA256:   ${result.artifact?.sha256 ?? "unknown"}`,
    `  Author:   ${result.author?.node ?? "unknown"} (${result.author?.key_type ?? "unknown"})`,
  ];
  if (result.receipt_path) {
    lines.push(`  Receipt:  ${result.receipt_path}`);
  }
  return lines.join("\n");
}

function failResult(error, details = {}) {
  return Object.freeze({
    schema: VERIFY_RESULT_SCHEMA,
    verified: false,
    verdict: "FAILED",
    error,
    ...details,
    boundary: BOUNDARY,
  });
}
