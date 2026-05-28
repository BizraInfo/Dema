import { readdir, stat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { verifyAuthorshipReceiptFile } from "./authorship-verify.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { AUTHORSHIP_SCHEMA } from "./authorship-signature.js";
import { loadPublicKey } from "./authorship-key-store.js";
import { createPublicKey } from "node:crypto";

export const PROOF_PASSPORT_SCHEMA = "bizra.dema.proof_passport.v0.1";

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
      .map((f) => join(receiptsDir, f));
  } catch {
    return [];
  }
}

async function getFingerprint(home) {
  const pubPem = await loadPublicKey(home);
  if (!pubPem) return null;
  try {
    return sha256(
      createPublicKey(pubPem)
        .export({ type: "spki", format: "der" })
        .toString("hex"),
    );
  } catch {
    return null;
  }
}

export async function buildProofPassport(demaHome) {
  const home = resolveHome(demaHome);
  const receiptPaths = await findAuthorshipReceipts(home);

  if (receiptPaths.length === 0) {
    return freeze({
      schema: PROOF_PASSPORT_SCHEMA,
      generated_at: new Date().toISOString(),
      mode: "LOCAL_EXPORT",
      subject: { node: "Node0", public_key_fingerprint: null },
      receipts: [],
      aggregate: {
        total_receipts: 0,
        verified_count: 0,
        failed_count: 0,
        verdict: "EMPTY",
      },
      passport_hash: null,
      boundary: BOUNDARY,
      truth_label: "LOCAL_PROOF_PASSPORT_EMPTY",
    });
  }

  const fingerprint = await getFingerprint(home);
  const receipts = [];

  for (const path of receiptPaths) {
    const verification = await verifyAuthorshipReceiptFile(path);
    const filename = path.split("/").pop();
    receipts.push({
      type: "authorship",
      receipt_filename: filename,
      artifact_path: verification.artifact?.path ?? null,
      artifact_sha256: verification.artifact?.sha256 ?? null,
      signature_algorithm: "ed25519",
      verdict: verification.verdict,
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

  const body = {
    schema: PROOF_PASSPORT_SCHEMA,
    generated_at: new Date().toISOString(),
    mode: "LOCAL_EXPORT",
    subject: {
      node: "Node0",
      public_key_fingerprint: fingerprint,
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

  body.passport_hash = sha256(stableStringify(body));

  return freeze(body);
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
  if (passport.subject.public_key_fingerprint) {
    lines.push(`  Fingerprint:  ${passport.subject.public_key_fingerprint}`);
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
