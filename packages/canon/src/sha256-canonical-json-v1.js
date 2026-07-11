// CANONICAL-JSON-V1-0A — sha256 binding over canonical v1 bytes. Kept separate
// from the pure canonicalizer so the kernel stays crypto-free.

import { createHash } from "node:crypto";

import {
  CANONICAL_JSON_V1_ALGORITHM,
  canonicalizeJsonV1,
} from "./canonical-json-v1.js";
import { CanonicalJsonV1Error } from "./canonical-json-errors.js";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;

export function sha256CanonicalJsonV1(value) {
  const text = canonicalizeJsonV1(value);
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

export function verifyCanonicalJsonHashV1(value, expectedHash) {
  const base = {
    algorithm: CANONICAL_JSON_V1_ALGORITHM,
    hash_algorithm: "sha256",
    text_encoding: "utf-8",
    expected_hash: typeof expectedHash === "string" ? expectedHash : null,
  };
  if (typeof expectedHash !== "string" || !HASH_PATTERN.test(expectedHash)) {
    return Object.freeze({ ...base, ok: false, error_code: "expected_hash_malformed", recomputed_hash: null });
  }
  let recomputed;
  try {
    recomputed = sha256CanonicalJsonV1(value);
  } catch (err) {
    if (err instanceof CanonicalJsonV1Error) {
      return Object.freeze({ ...base, ok: false, error_code: err.code, recomputed_hash: null });
    }
    throw err;
  }
  return Object.freeze({
    ...base,
    ok: recomputed === expectedHash,
    error_code: recomputed === expectedHash ? null : "hash_mismatch",
    recomputed_hash: recomputed,
  });
}
