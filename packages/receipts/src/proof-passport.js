import { readdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import { verifyAuthorshipReceiptIntegrityFile } from "./authorship-verify.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";

export const LEGACY_PROOF_PASSPORT_SCHEMA =
  "bizra.dema.proof_passport.v0.1";
export const PROOF_PASSPORT_SCHEMA = "bizra.dema.proof_passport.v0.2";

const BOUNDARY = Object.freeze({
  passport_generated: true,
  passport_signed: false,
  private_key_loaded: false,
  network_used: false,
  federation_used: false,
  token_minted: false,
  legal_identity_asserted: false,
  production_claimed: false,
  receipt_content_included: false,
  active_signer_trust_evaluated: false,
  receipt_verification_scope: "SIGNATURE_INTEGRITY_ONLY",
});

function resolveHome(demaHome) {
  if (typeof demaHome === "string" && demaHome.length > 0) return demaHome;
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

async function findAuthorshipReceipts(home) {
  const receiptsDir = join(home, "receipts");
  try {
    const entries = await readdir(receiptsDir);
    return entries
      .filter((f) => f.startsWith("authorship-") && f.endsWith(".json"))
      .map((f) => join(receiptsDir, f))
      .sort();
  } catch {
    return [];
  }
}

export async function buildProofPassport(demaHome) {
  const home = resolveHome(demaHome);
  const receiptPaths = await findAuthorshipReceipts(home);

  if (receiptPaths.length === 0) {
    const emptyBody = {
      schema: PROOF_PASSPORT_SCHEMA,
      mode: "LOCAL_EXPORT",
      verification_scope: "SIGNATURE_INTEGRITY_ONLY",
      subject: { node: "Node0", public_key_fingerprints: [] },
      receipts: [],
      aggregate: {
        total_receipts: 0,
        verified_count: 0,
        failed_count: 0,
        verdict: "EMPTY",
      },
      boundary: BOUNDARY,
      truth_label: "LOCAL_PROOF_PASSPORT_EMPTY",
    };
    return freeze({
      ...emptyBody,
      passport_hash: sha256(stableStringify(emptyBody)),
      generated_at: new Date().toISOString(),
    });
  }

  const receipts = [];
  const fingerprintSet = new Set();

  for (const path of receiptPaths) {
    const verification = await verifyAuthorshipReceiptIntegrityFile(path);
    const fingerprint = verification.embedded_fingerprint ?? null;
    if (fingerprint && verification.verified) {
      fingerprintSet.add(fingerprint);
    }
    receipts.push({
      type: "authorship",
      receipt_filename: basename(path),
      artifact_path: verification.artifact?.path ?? null,
      artifact_sha256: verification.artifact?.sha256 ?? null,
      signature_algorithm: "ed25519",
      author_fingerprint: fingerprint,
      verdict: verification.verdict,
      verification_scope: verification.verification_scope,
      trust_state: verification.trust_state ?? "NOT_EVALUATED",
      truth_label: verification.verified
        ? "VERIFIED_LOCAL_AUTHORSHIP_RECEIPT"
        : "FAILED_LOCAL_AUTHORSHIP_RECEIPT",
    });
  }

  const verifiedCount = receipts.filter((r) => r.verdict === "VERIFIED").length;
  const failedCount = receipts.length - verifiedCount;

  let aggregateVerdict;
  let truthLabel;
  if (verifiedCount === receipts.length) {
    aggregateVerdict = "ALL_VERIFIED";
    truthLabel = "LOCAL_PROOF_PASSPORT_ALL_VERIFIED";
  } else if (verifiedCount > 0) {
    aggregateVerdict = "PARTIAL";
    truthLabel = "LOCAL_PROOF_PASSPORT_PARTIAL";
  } else {
    aggregateVerdict = "NONE_VERIFIED";
    truthLabel = "LOCAL_PROOF_PASSPORT_NONE_VERIFIED";
  }

  const fingerprints = [...fingerprintSet].sort();

  const passportBody = {
    schema: PROOF_PASSPORT_SCHEMA,
    mode: "LOCAL_EXPORT",
    verification_scope: "SIGNATURE_INTEGRITY_ONLY",
    subject: {
      node: "Node0",
      public_key_fingerprints: fingerprints,
    },
    receipts,
    aggregate: {
      total_receipts: receipts.length,
      verified_count: verifiedCount,
      failed_count: failedCount,
      verdict: aggregateVerdict,
    },
    boundary: BOUNDARY,
    truth_label: truthLabel,
  };

  const passportHash = sha256(stableStringify(passportBody));

  return freeze({
    ...passportBody,
    passport_hash: passportHash,
    generated_at: new Date().toISOString(),
  });
}

export function formatProofPassport(passport) {
  if (passport.aggregate.verdict === "EMPTY") {
    return "Proof Passport: No authorship receipts found.";
  }
  const lines = [
    `Proof Passport: ${passport.aggregate.verdict}`,
    "=".repeat(40),
    `  Node:         ${passport.subject.node}`,
  ];
  const fingerprints = passport.subject.public_key_fingerprints ?? [];
  if (fingerprints.length > 0) {
    lines.push(`  Fingerprints: ${fingerprints.join(", ")}`);
  }
  lines.push(
    `  Receipts:     ${passport.aggregate.total_receipts}`,
    `  Verified:     ${passport.aggregate.verified_count}`,
    `  Failed:       ${passport.aggregate.failed_count}`,
    `  Truth label:  ${passport.truth_label}`,
    `  Passport hash:${passport.passport_hash ? " " + passport.passport_hash : " (none)"}`,
  );
  for (const r of passport.receipts) {
    lines.push(`  - ${r.receipt_filename}: ${r.verdict}`);
  }
  return lines.join("\n");
}

function freeze(obj) {
  return Object.freeze(obj);
}
