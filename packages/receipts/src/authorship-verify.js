import { readFile } from "node:fs/promises";
import { createPublicKey } from "node:crypto";
import {
  verifyPayload,
  AUTHORSHIP_SCHEMA,
  sha256,
} from "./authorship-signature.js";
import {
  AUTHORSHIP_TRUST_SNAPSHOT_SCHEMA,
  isSpkiPublicKeyPem,
} from "./authorship-key-store.js";

export const VERIFY_RESULT_SCHEMA = "bizra.dema.authorship_verify_result.v0.2";
export const INTEGRITY_VERIFY_RESULT_SCHEMA =
  "bizra.dema.authorship_verify_result.v0.1";
export { AUTHORSHIP_TRUST_SNAPSHOT_SCHEMA };

const BOUNDARY = Object.freeze({
  network_used: false,
  mutation_performed: false,
  private_key_loaded: false,
  federation_used: false,
  token_minted: false,
});

const SHA256_HEX = /^[0-9a-f]{64}$/;
const SAFE_PUBLIC_TEXT = /^[^\u0000-\u001f\u007f]{1,4096}$/;
const REQUIRED_KEY_TYPE = "ed25519";
const SIGNATURE_INTEGRITY_SCOPE = "SIGNATURE_INTEGRITY_ONLY";
const ACTIVE_SIGNER_TRUST_SCOPE = "ACTIVE_SIGNER_TRUST";

export async function verifyAuthorshipReceiptFile(receiptPath, trustSnapshot) {
  if (!receiptPath || typeof receiptPath !== "string") {
    return failResult("no_receipt_path");
  }

  let raw;
  try {
    raw = JSON.parse(await readFile(receiptPath, "utf8"));
  } catch {
    return failResult("cannot_read_receipt", { path: receiptPath });
  }

  const result = verifyAuthorshipReceipt(raw, trustSnapshot);
  return Object.freeze({
    ...result,
    receipt_path: receiptPath,
  });
}

export function verifyAuthorshipReceipt(receipt, trustSnapshot) {
  const preliminaryAudit = deriveFingerprintAudit(receipt, trustSnapshot);
  const inspected = inspectReceipt(receipt);
  if (!inspected.ok) {
    return Object.freeze({
      ...inspected.result,
      ...preliminaryAudit,
    });
  }
  const { signature, payload, embedded } = inspected;
  const claimedFingerprint = payload.author?.public_key_fingerprint;
  const trust = validateTrustSnapshot(trustSnapshot);
  const audit = fingerprintAudit({
    claimedFingerprint,
    embeddedFingerprint: embedded.fingerprint,
    trustedFingerprint: trust.ok ? trust.active.fingerprint : null,
  });
  if (!trustSnapshot) {
    return failResult("external_trust_required", {
      ...receiptDetails(payload),
      ...audit,
      trust_state: "UNKNOWN",
    });
  }
  if (!trust.ok) {
    return failResult("external_trust_invalid", {
      ...receiptDetails(payload),
      ...audit,
      external_trust_error: trust.sourceError,
      trust_state: "UNKNOWN",
    });
  }

  if (
    !SHA256_HEX.test(claimedFingerprint ?? "") ||
    claimedFingerprint !== embedded.fingerprint
  ) {
    return failResult("public_key_fingerprint_mismatch", {
      ...receiptDetails(payload),
      ...audit,
      trust_state: "UNTRUSTED",
    });
  }

  let embeddedSignatureValid;
  try {
    embeddedSignatureValid = verifyPayload(
      payload,
      signature.value,
      signature.public_key_pem,
    );
  } catch {
    embeddedSignatureValid = false;
  }
  if (!embeddedSignatureValid) {
    return failResult("signature_invalid", {
      ...receiptDetails(payload),
      ...audit,
      trust_state: trust.retiredFingerprints.has(embedded.fingerprint)
        ? "RETIRED"
        : embedded.fingerprint === trust.active.fingerprint
          ? "ACTIVE_TRUSTED"
          : "UNTRUSTED",
    });
  }

  if (trust.retiredFingerprints.has(embedded.fingerprint)) {
    return failResult("signer_retired", {
      ...receiptDetails(payload),
      ...audit,
      trust_state: "RETIRED",
    });
  }

  if (
    embedded.fingerprint !== trust.active.fingerprint ||
    !embedded.der.equals(trust.active.der)
  ) {
    return failResult("signer_not_trusted", {
      ...receiptDetails(payload),
      ...audit,
      trust_state: "UNTRUSTED",
    });
  }

  let verified;
  try {
    verified = verifyPayload(
      payload,
      signature.value,
      trustSnapshot.active_public_key_pem,
    );
  } catch {
    verified = false;
  }
  if (!verified) {
    return failResult("signature_invalid", {
      ...receiptDetails(payload),
      ...audit,
      trust_state: "ACTIVE_TRUSTED",
    });
  }

  return Object.freeze({
    schema: VERIFY_RESULT_SCHEMA,
    verified: true,
    verdict: "VERIFIED",
    verification_scope: ACTIVE_SIGNER_TRUST_SCOPE,
    ...receiptDetails(payload),
    ...audit,
    trust_state: "ACTIVE_TRUSTED",
    boundary: BOUNDARY,
  });
}

export async function verifyAuthorshipReceiptIntegrityFile(receiptPath) {
  if (!receiptPath || typeof receiptPath !== "string") {
    return integrityFail("no_receipt_path");
  }

  let raw;
  try {
    raw = JSON.parse(await readFile(receiptPath, "utf8"));
  } catch {
    return integrityFail("cannot_read_receipt", { path: receiptPath });
  }

  const result = verifyAuthorshipReceiptIntegrity(raw);
  return Object.freeze({
    ...result,
    receipt_path: receiptPath,
  });
}

// Compatibility verifier for portable/history-only surfaces. It proves that
// the payload matches the embedded signature and fingerprint; it explicitly
// does NOT establish that the signer is active, trusted, or non-retired.
export function verifyAuthorshipReceiptIntegrity(receipt) {
  const inspected = inspectReceipt(receipt, {
    fail: integrityFail,
  });
  if (!inspected.ok) return inspected.result;
  const { signature, payload, embedded } = inspected;
  const claimedFingerprint = payload.author?.public_key_fingerprint;
  const audit = fingerprintAudit({
    claimedFingerprint,
    embeddedFingerprint: embedded.fingerprint,
    trustedFingerprint: null,
  });

  if (
    !SHA256_HEX.test(claimedFingerprint ?? "") ||
    claimedFingerprint !== embedded.fingerprint
  ) {
    return integrityFail("public_key_fingerprint_mismatch", {
      ...receiptDetails(payload),
      ...audit,
      trust_state: "NOT_EVALUATED",
    });
  }

  let verified;
  try {
    verified = verifyPayload(
      payload,
      signature.value,
      signature.public_key_pem,
    );
  } catch {
    verified = false;
  }
  if (!verified) {
    return integrityFail("signature_invalid", {
      ...receiptDetails(payload),
      ...audit,
      trust_state: "NOT_EVALUATED",
    });
  }

  return Object.freeze({
    schema: INTEGRITY_VERIFY_RESULT_SCHEMA,
    verified: true,
    verdict: "VERIFIED",
    verification_scope: SIGNATURE_INTEGRITY_SCOPE,
    ...receiptDetails(payload),
    ...audit,
    trust_state: "NOT_EVALUATED",
    boundary: BOUNDARY,
  });
}

export function formatAuthorshipVerification(result) {
  if (!result.verified && result.error) {
    const lines = [
      `FAILED: ${result.error}`,
      `  Scope:    ${result.verification_scope ?? "unknown"}`,
    ];
    if (result.trust_state) {
      lines.push(`  Trust:    ${result.trust_state}`);
    }
    return lines.join("\n");
  }
  const lines = [
    `Authorship Verification: ${result.verdict}`,
    `  Scope:    ${result.verification_scope ?? "unknown"}`,
    `  Trust:    ${result.trust_state ?? "unknown"}`,
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
    verification_scope: ACTIVE_SIGNER_TRUST_SCOPE,
    error,
    ...details,
    boundary: BOUNDARY,
  });
}

function integrityFail(error, details = {}) {
  return Object.freeze({
    schema: INTEGRITY_VERIFY_RESULT_SCHEMA,
    verified: false,
    verdict: "FAILED",
    verification_scope: SIGNATURE_INTEGRITY_SCOPE,
    ...details,
    error,
    boundary: BOUNDARY,
  });
}

function inspectReceipt(receipt, { fail = failResult } = {}) {
  if (
    !receipt ||
    typeof receipt !== "object" ||
    Array.isArray(receipt) ||
    receipt.schema !== AUTHORSHIP_SCHEMA ||
    !receipt.signature ||
    typeof receipt.signature !== "object"
  ) {
    return Object.freeze({
      ok: false,
      result: fail("not_valid_authorship_receipt"),
    });
  }

  const { signature, ...payload } = receipt;
  if (
    signature.algorithm !== REQUIRED_KEY_TYPE ||
    payload.author?.key_type !== REQUIRED_KEY_TYPE
  ) {
    return Object.freeze({
      ok: false,
      result: fail("unsupported_signer_algorithm", receiptDetails(payload)),
    });
  }
  if (
    typeof signature.value !== "string" ||
    typeof signature.public_key_pem !== "string"
  ) {
    return Object.freeze({
      ok: false,
      result: fail("not_valid_authorship_receipt", receiptDetails(payload)),
    });
  }

  const embedded = publicKeyIdentity(signature.public_key_pem);
  if (!embedded.ok) {
    return Object.freeze({
      ok: false,
      result: fail("embedded_public_key_invalid", {
        ...receiptDetails(payload),
        ...fingerprintAudit({
          claimedFingerprint: payload.author?.public_key_fingerprint,
          embeddedFingerprint: null,
          trustedFingerprint: null,
        }),
      }),
    });
  }

  return Object.freeze({
    ok: true,
    signature,
    payload,
    embedded,
  });
}

function fingerprintAudit({
  claimedFingerprint,
  embeddedFingerprint,
  trustedFingerprint,
}) {
  return Object.freeze({
    signer_fingerprint: embeddedFingerprint,
    claimed_fingerprint: SHA256_HEX.test(claimedFingerprint ?? "")
      ? claimedFingerprint
      : null,
    embedded_fingerprint: embeddedFingerprint,
    trusted_fingerprint: trustedFingerprint,
  });
}

function deriveFingerprintAudit(receipt, trustSnapshot) {
  const claimedFingerprint =
    receipt &&
    typeof receipt === "object" &&
    !Array.isArray(receipt) &&
    typeof receipt.author?.public_key_fingerprint === "string"
      ? receipt.author.public_key_fingerprint
      : null;
  const embedded =
    receipt &&
    typeof receipt === "object" &&
    !Array.isArray(receipt) &&
    typeof receipt.signature?.public_key_pem === "string"
      ? publicKeyIdentity(receipt.signature.public_key_pem)
      : Object.freeze({ ok: false });
  const trust = validateTrustSnapshot(trustSnapshot);
  return fingerprintAudit({
    claimedFingerprint,
    embeddedFingerprint: embedded.ok ? embedded.fingerprint : null,
    trustedFingerprint: trust.ok ? trust.active.fingerprint : null,
  });
}

function receiptDetails(payload) {
  const artifactPath = safePublicText(payload?.artifact?.path);
  const artifactSha256 = SHA256_HEX.test(payload?.artifact?.sha256 ?? "")
    ? payload.artifact.sha256
    : undefined;
  const authorNode = safePublicText(payload?.author?.node, 256);
  const authorKeyType =
    payload?.author?.key_type === REQUIRED_KEY_TYPE
      ? REQUIRED_KEY_TYPE
      : undefined;
  const authorFingerprint = SHA256_HEX.test(
    payload?.author?.public_key_fingerprint ?? "",
  )
    ? payload.author.public_key_fingerprint
    : undefined;

  return {
    artifact:
      payload?.artifact && typeof payload.artifact === "object"
        ? Object.freeze({
            path: artifactPath,
            sha256: artifactSha256,
          })
        : undefined,
    author:
      payload?.author && typeof payload.author === "object"
        ? Object.freeze({
            node: authorNode,
            key_type: authorKeyType,
            public_key_fingerprint: authorFingerprint,
          })
        : undefined,
  };
}

function safePublicText(value, maxLength = 4096) {
  return typeof value === "string" &&
    value.length <= maxLength &&
    SAFE_PUBLIC_TEXT.test(value) &&
    !value.includes("PRIVATE KEY")
    ? value
    : undefined;
}

function publicKeyIdentity(publicKeyPem) {
  try {
    if (!isSpkiPublicKeyPem(publicKeyPem)) {
      return Object.freeze({ ok: false });
    }
    const key = createPublicKey(publicKeyPem);
    if (key.asymmetricKeyType !== REQUIRED_KEY_TYPE) {
      return Object.freeze({ ok: false });
    }
    const der = key.export({ type: "spki", format: "der" });
    return Object.freeze({
      ok: true,
      der,
      fingerprint: sha256(der.toString("hex")),
    });
  } catch {
    return Object.freeze({ ok: false });
  }
}

function validateTrustSnapshot(snapshot) {
  const expectedKeys = [
    "active_fingerprint",
    "active_public_key_pem",
    "retired_fingerprints",
    "schema",
  ];
  if (
    !snapshot ||
    typeof snapshot !== "object" ||
    Array.isArray(snapshot) ||
    JSON.stringify(Object.keys(snapshot).sort()) !==
      JSON.stringify(expectedKeys) ||
    snapshot.schema !== AUTHORSHIP_TRUST_SNAPSHOT_SCHEMA ||
    typeof snapshot.active_public_key_pem !== "string" ||
    !SHA256_HEX.test(snapshot.active_fingerprint ?? "") ||
    !Array.isArray(snapshot.retired_fingerprints) ||
    snapshot.retired_fingerprints.some(
      (fingerprint) => !SHA256_HEX.test(fingerprint),
    )
  ) {
    return Object.freeze({
      ok: false,
      sourceError: safeErrorCode(snapshot?.error),
    });
  }

  const active = publicKeyIdentity(snapshot.active_public_key_pem);
  if (!active.ok || active.fingerprint !== snapshot.active_fingerprint) {
    return Object.freeze({ ok: false, sourceError: null });
  }
  const retiredFingerprints = new Set(snapshot.retired_fingerprints);
  if (retiredFingerprints.has(active.fingerprint)) {
    return Object.freeze({ ok: false, sourceError: "retired_generation" });
  }

  return Object.freeze({
    ok: true,
    active,
    retiredFingerprints,
  });
}

function safeErrorCode(value) {
  return typeof value === "string" && /^[a-z0-9_]{1,80}$/.test(value)
    ? value
    : null;
}
