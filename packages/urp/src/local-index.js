import { verifyProofPassportDeep } from "../../receipts/src/proof-passport-deep-verify.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";

export const URP_LOCAL_INDEX_SCHEMA = "bizra.dema.urp_local_index.v0.1";
export const URP_LOCAL_INDEX_RESULT_SCHEMA =
  "bizra.dema.urp_local_index_result.v0.1";

const FAIL_BOUNDARY = Object.freeze({
  private_key_loaded: false,
  file_write_performed: false,
  raw_artifact_included: false,
  full_receipt_json_included: false,
  personal_memory_included: false,
  network_used: false,
  federation_used: false,
  token_minted: false,
  poi_score_calculated: false,
  economic_claim_made: false,
});

const PASS_BOUNDARY = Object.freeze({
  private_key_loaded: false,
  file_write_performed: false,
  raw_artifact_included: false,
  full_receipt_json_included: false,
  personal_memory_included: false,
  network_used: false,
  federation_used: false,
  token_minted: false,
  poi_score_calculated: false,
  economic_claim_made: false,
});

export async function buildUrpLocalIndex(
  passport,
  { receiptsDir, now = new Date() } = {},
) {
  const verification = await verifyProofPassportDeep(passport, { receiptsDir });

  if (!verification.verified) {
    return Object.freeze({
      schema: URP_LOCAL_INDEX_RESULT_SCHEMA,
      indexed: false,
      error: "deep_verification_failed",
      verification,
      boundary: FAIL_BOUNDARY,
    });
  }

  const receipts = passport.receipts ?? [];
  const artifactHashes = receipts
    .filter((r) => r.verdict === "VERIFIED")
    .map((r) => r.artifact_sha256)
    .filter((h) => typeof h === "string")
    .sort();

  const authorFingerprints = [
    ...new Set(
      receipts
        .filter((r) => r.verdict === "VERIFIED")
        .map((r) => r.author_fingerprint)
        .filter((f) => typeof f === "string"),
    ),
  ].sort();

  const entries = receipts
    .filter((r) => r.verdict === "VERIFIED")
    .map((r) =>
      Object.freeze({
        receipt_filename: r.receipt_filename,
        artifact_sha256: r.artifact_sha256,
        author_fingerprint: r.author_fingerprint,
        truth_label: r.truth_label,
      }),
    );

  const body = {
    schema: URP_LOCAL_INDEX_SCHEMA,
    mode: "LOCAL_INDEX_ONLY",
    truth_label: "LOCAL_VERIFIED_RESOURCE_INDEX",
    source_passport_hash: passport.passport_hash ?? null,
    verification_scope: verification.verification_scope,
    active_signer_trust_evaluated: false,
    resource_class: "WORK_ARTIFACT",
    awareness_level: "A2_METADATA",
    share_status: "MARKED_LOCAL_ONLY",
    receipts_count: entries.length,
    artifact_hashes: Object.freeze(artifactHashes),
    author_fingerprints: Object.freeze(authorFingerprints),
    entries: Object.freeze(entries),
    indexed_at_iso: now.toISOString(),
    boundary: PASS_BOUNDARY,
  };

  const { indexed_at_iso, ...stableBody } = body;
  const indexHash = sha256(stableStringify(stableBody));

  return Object.freeze({
    schema: URP_LOCAL_INDEX_RESULT_SCHEMA,
    indexed: true,
    index: Object.freeze({
      ...body,
      index_hash: indexHash,
    }),
    boundary: PASS_BOUNDARY,
  });
}
