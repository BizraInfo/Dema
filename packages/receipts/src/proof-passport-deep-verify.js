import { join, basename } from "node:path";
import { verifyProofPassport } from "./proof-passport-verify.js";
import { verifyAuthorshipReceiptFile } from "./authorship-verify.js";

export const DEEP_VERIFY_SCHEMA =
  "bizra.dema.proof_passport_deep_verification.v0.1";

const VERIFICATION_SCOPE = "PASSPORT_ENVELOPE_AND_RECEIPTS";
const TRUTH_LABEL_VERIFIED = "LOCAL_PROOF_PASSPORT_DEEP_VERIFIED";
const TRUTH_LABEL_FAILED = "LOCAL_PROOF_PASSPORT_DEEP_FAILED";
const TRUTH_LABEL_EMPTY = "LOCAL_PROOF_PASSPORT_DEEP_EMPTY";

const BOUNDARY = Object.freeze({
  private_key_loaded: false,
  public_key_file_loaded: false,
  signing_performed: false,
  passport_mutated: false,
  receipt_mutated: false,
  network_used: false,
  federation_used: false,
  token_minted: false,
  economic_claim_made: false,
  legal_identity_asserted: false,
  production_claimed: false,
  receipt_files_read: true,
  receipt_signatures_verified: true,
});

function isSafeFilename(filename) {
  if (typeof filename !== "string" || filename.length === 0) return false;
  if (basename(filename) !== filename) return false;
  if (filename.includes("..")) return false;
  if (filename.includes("/") || filename.includes("\\")) return false;
  return true;
}

export async function verifyProofPassportDeep(passport, { receiptsDir } = {}) {
  const envelope = verifyProofPassport(passport);
  if (!envelope.verified) {
    return freeze({
      schema: DEEP_VERIFY_SCHEMA,
      verified: false,
      verdict: "FAILED",
      verification_scope: VERIFICATION_SCOPE,
      truth_label: TRUTH_LABEL_FAILED,
      envelope,
      receipt_results: [],
      boundary: BOUNDARY,
      error: "envelope_verification_failed",
    });
  }

  if (typeof receiptsDir !== "string" || receiptsDir.length === 0) {
    return freeze({
      schema: DEEP_VERIFY_SCHEMA,
      verified: false,
      verdict: "FAILED",
      verification_scope: VERIFICATION_SCOPE,
      truth_label: TRUTH_LABEL_FAILED,
      envelope,
      receipt_results: [],
      boundary: BOUNDARY,
      error: "receipts_dir_required",
    });
  }

  const receipts = passport.receipts ?? [];
  if (receipts.length === 0) {
    return freeze({
      schema: DEEP_VERIFY_SCHEMA,
      verified: true,
      verdict: "EMPTY",
      verification_scope: VERIFICATION_SCOPE,
      truth_label: TRUTH_LABEL_EMPTY,
      envelope,
      receipt_results: [],
      boundary: BOUNDARY,
    });
  }

  const receiptResults = [];
  let allReceiptsOk = true;

  for (const declared of receipts) {
    const filename = declared?.receipt_filename;
    if (!isSafeFilename(filename)) {
      allReceiptsOk = false;
      receiptResults.push(
        Object.freeze({
          receipt_filename: filename ?? null,
          verified: false,
          error: "unsafe_filename",
        }),
      );
      continue;
    }

    const receiptPath = join(receiptsDir, filename);
    const fileResult = await verifyAuthorshipReceiptFile(receiptPath);

    if (!fileResult.verified) {
      allReceiptsOk = false;
      receiptResults.push(
        Object.freeze({
          receipt_filename: filename,
          verified: false,
          receipt_verified: false,
          error: fileResult.error ?? "receipt_verification_failed",
        }),
      );
      continue;
    }

    const artifactMatch =
      declared.artifact_sha256 === fileResult.artifact?.sha256;
    const fingerprintMatch =
      declared.author_fingerprint ===
      (fileResult.author?.public_key_fingerprint ?? null);
    const verdictMatch = declared.verdict === fileResult.verdict;
    const truthLabelMatch =
      declared.truth_label === "VERIFIED_LOCAL_AUTHORSHIP_RECEIPT";

    const metadataMatch = Object.freeze({
      artifact_sha256: artifactMatch,
      author_fingerprint: fingerprintMatch,
      verdict: verdictMatch,
      truth_label: truthLabelMatch,
    });

    const ok =
      artifactMatch && fingerprintMatch && verdictMatch && truthLabelMatch;

    if (!ok) allReceiptsOk = false;

    receiptResults.push(
      Object.freeze({
        receipt_filename: filename,
        verified: ok,
        receipt_verified: true,
        metadata_match: metadataMatch,
      }),
    );
  }

  const verified = allReceiptsOk;
  return freeze({
    schema: DEEP_VERIFY_SCHEMA,
    verified,
    verdict: verified ? "VERIFIED" : "FAILED",
    verification_scope: VERIFICATION_SCOPE,
    truth_label: verified ? TRUTH_LABEL_VERIFIED : TRUTH_LABEL_FAILED,
    envelope,
    receipt_results: Object.freeze(receiptResults),
    boundary: BOUNDARY,
  });
}

function freeze(obj) {
  return Object.freeze(obj);
}
