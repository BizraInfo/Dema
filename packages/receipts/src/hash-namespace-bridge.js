// DEMA-HASH-NAMESPACE-BRIDGE-1A · a cross-namespace digest travels as
// {alg, digest} and the crossing point is a bridge receipt.
//
// Canon: a cross-surface lookup is only meaningful inside ONE hash namespace —
// the crossing point must be named. A bare hex digest carries no algorithm, so
// a BLAKE3 digest pasted into a SHA-256 world is indistinguishable from a
// corrupt SHA-256. This kernel extends the CRYPTO-AGILITY-1A declared-algorithm
// law (sig_alg, canonical-receipt v0.2) from signatures to hashes:
//
//   - every digest that crosses a namespace travels as a self-describing
//     {alg, digest} binding; a bare digest is unrepresentable;
//   - the crossing itself is a bridge receipt: a sha256-addressed body that
//     embeds the foreign binding AS DATA, so the sha256 spine commits to the
//     foreign digest and it cannot be stripped or swapped without breaking the
//     bridge receipt's own hash;
//   - recomputability is a MEASURED property of this runtime, computed inside
//     the build path, never caller-asserted (measured 2026-08-20: node:crypto
//     has blake2b512/blake2s256 but NO blake3);
//   - verification labels the foreign side honestly: DECLARED_NOT_RECOMPUTED
//     unless the caller supplies the original content and, for foreign
//     algorithms, an injected verifier. The asymmetry is reported, never hidden.
//
// Reuses (no new crypto, no new deps): sha256Hex (hash-util), stableStringify
// (consent-common). Pure kernel: no fs, no network, no keys, no mint.

import { createHash } from "node:crypto";
import { sha256Hex } from "./hash-util.js";
import { stableStringify } from "../../consent/src/consent-common.js";

export const HASH_BRIDGE_SCHEMA = "bizra.dema.hash_namespace_bridge.v0.1";

// Known namespaces. `locally_recomputable` is a fact about THIS runtime's
// node:crypto, pinned by test — blake3 stays false until an implementation is
// deliberately vendored (it would be the kernel's first such decision).
// `node_name` is the node:crypto identifier for recomputable algorithms.
export const HASH_ALGORITHMS = Object.freeze({
  sha256: Object.freeze({
    digest_hex_length: 64,
    locally_recomputable: true,
    node_name: "sha256",
  }),
  blake2b512: Object.freeze({
    digest_hex_length: 128,
    locally_recomputable: true,
    node_name: "blake2b512",
  }),
  blake2s256: Object.freeze({
    digest_hex_length: 64,
    locally_recomputable: true,
    node_name: "blake2s256",
  }),
  blake3: Object.freeze({
    digest_hex_length: 64,
    locally_recomputable: false,
    node_name: null,
  }),
});

export const HASH_BRIDGE_REASON_CODES = Object.freeze([
  "HASH_BINDING_NOT_OBJECT",
  "HASH_ALGORITHM_UNDECLARED",
  "HASH_ALGORITHM_UNKNOWN",
  "HASH_DIGEST_MALFORMED",
  "HASH_BINDING_EXTRA_KEYS",
  "RECOMPUTABILITY_NOT_CALLER_ASSERTABLE",
  "LOCAL_BODY_NOT_JSON_SAFE",
  "BRIDGE_RECEIPT_MALFORMED",
  "BRIDGE_HASH_MISMATCH",
  "FOREIGN_DIGEST_MISMATCH",
  "FOREIGN_VERIFIER_INVALID",
]);

const HEX_RE = /^[0-9a-f]+$/;

function fail(reason) {
  return { ok: false, reason };
}

function isPlainObject(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function isJsonSafe(value) {
  if (value === null) return true;
  const t = typeof value;
  if (t === "string" || t === "boolean") return true;
  if (t === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonSafe);
  if (isPlainObject(value)) return Object.values(value).every(isJsonSafe);
  return false;
}

/**
 * Validate one {alg, digest} pair. Fail-closed; exact reason codes; the only
 * accepted shape is exactly the two keys — widening is unrepresentable.
 */
export function buildHashBinding(input) {
  if (!isPlainObject(input)) return fail("HASH_BINDING_NOT_OBJECT");
  if (!("alg" in input) || typeof input.alg !== "string" || input.alg === "") {
    return fail("HASH_ALGORITHM_UNDECLARED");
  }
  const spec = HASH_ALGORITHMS[input.alg];
  if (!spec) return fail("HASH_ALGORITHM_UNKNOWN");
  const extra = Object.keys(input).filter((k) => k !== "alg" && k !== "digest");
  if (extra.length > 0) return fail("HASH_BINDING_EXTRA_KEYS");
  if (typeof input.digest !== "string") return fail("HASH_DIGEST_MALFORMED");
  const digest = input.digest.toLowerCase();
  if (digest.length !== spec.digest_hex_length || !HEX_RE.test(digest)) {
    return fail("HASH_DIGEST_MALFORMED");
  }
  return { ok: true, binding: Object.freeze({ alg: input.alg, digest }) };
}

/**
 * Build the crossing point: a sha256-addressed body embedding the foreign
 * binding as data. `foreign_recomputable_here` is computed from the registry
 * inside this path — a caller supplying it (top-level or smuggled) is refused.
 */
export function buildBridgeReceipt(input) {
  if (!isPlainObject(input)) return fail("BRIDGE_RECEIPT_MALFORMED");
  if ("foreign_recomputable_here" in input) {
    return fail("RECOMPUTABILITY_NOT_CALLER_ASSERTABLE");
  }
  const bound = buildHashBinding(input.foreign);
  if (!bound.ok) return bound;
  if (!isPlainObject(input.localBody) || !isJsonSafe(input.localBody)) {
    return fail("LOCAL_BODY_NOT_JSON_SAFE");
  }
  const body = {
    schema: HASH_BRIDGE_SCHEMA,
    foreign: { alg: bound.binding.alg, digest: bound.binding.digest },
    foreign_recomputable_here:
      HASH_ALGORITHMS[bound.binding.alg].locally_recomputable,
    local_body: input.localBody,
  };
  const bridge_hash = sha256Hex(stableStringify(body));
  return {
    ok: true,
    receipt: Object.freeze({
      ...body,
      foreign: Object.freeze(body.foreign),
      bridge_hash,
    }),
  };
}

function recomputeForeignDigest(receipt, content, verifiers) {
  const alg = receipt.foreign.alg;
  const verifier = verifiers && verifiers[alg];
  if (verifier !== undefined) {
    if (typeof verifier !== "function") {
      return { verdict: "FOREIGN_VERIFIER_INVALID" };
    }
    const got = verifier(content);
    if (typeof got !== "string") return { verdict: "FOREIGN_VERIFIER_INVALID" };
    return {
      verdict:
        got.toLowerCase() === receipt.foreign.digest
          ? "RECOMPUTED_OK"
          : "FOREIGN_DIGEST_MISMATCH",
    };
  }
  const spec = HASH_ALGORITHMS[alg];
  if (spec && spec.locally_recomputable) {
    const got = createHash(spec.node_name).update(content).digest("hex");
    return {
      verdict:
        got === receipt.foreign.digest
          ? "RECOMPUTED_OK"
          : "FOREIGN_DIGEST_MISMATCH",
    };
  }
  return { verdict: "DECLARED_NOT_RECOMPUTED" };
}

/**
 * Verify a bridge receipt. Always recomputes the sha256 side (tamper on any
 * embedded byte breaks it). The foreign side upgrades to RECOMPUTED_OK only
 * with the original content — via node:crypto for recomputable algorithms, or
 * an injected verifier for foreign ones. Without content it stays
 * DECLARED_NOT_RECOMPUTED: reported, never hidden, never silently upgraded.
 */
export function verifyBridgeReceipt(receipt, options = {}) {
  if (
    !isPlainObject(receipt) ||
    receipt.schema !== HASH_BRIDGE_SCHEMA ||
    !isPlainObject(receipt.foreign) ||
    typeof receipt.bridge_hash !== "string" ||
    !isPlainObject(receipt.local_body) ||
    typeof receipt.foreign_recomputable_here !== "boolean"
  ) {
    return fail("BRIDGE_RECEIPT_MALFORMED");
  }
  const bound = buildHashBinding(receipt.foreign);
  if (!bound.ok) return fail("BRIDGE_RECEIPT_MALFORMED");

  const body = {
    schema: receipt.schema,
    foreign: { alg: receipt.foreign.alg, digest: receipt.foreign.digest },
    foreign_recomputable_here: receipt.foreign_recomputable_here,
    local_body: receipt.local_body,
  };
  if (sha256Hex(stableStringify(body)) !== receipt.bridge_hash) {
    return fail("BRIDGE_HASH_MISMATCH");
  }

  let foreign_verdict = "DECLARED_NOT_RECOMPUTED";
  if (options.content !== undefined) {
    const res = recomputeForeignDigest(receipt, options.content, options.verifiers);
    if (res.verdict === "FOREIGN_DIGEST_MISMATCH") {
      return fail("FOREIGN_DIGEST_MISMATCH");
    }
    if (res.verdict === "FOREIGN_VERIFIER_INVALID") {
      return fail("FOREIGN_VERIFIER_INVALID");
    }
    foreign_verdict = res.verdict;
  }

  return {
    ok: true,
    bridge_hash_verdict: "RECOMPUTED_OK",
    foreign_verdict,
  };
}
