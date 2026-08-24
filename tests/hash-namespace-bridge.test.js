/**
 * DEMA-HASH-NAMESPACE-BRIDGE-1A tests
 *
 * A cross-namespace digest travels as {alg, digest} and the crossing point is
 * a bridge receipt. Pure tests — no fs, no network, no keys, no mint.
 *
 * Law under test (canon): a cross-surface lookup is only meaningful inside ONE
 * hash namespace — the crossing point must be named. A bare hex digest carries
 * no algorithm, so a BLAKE3 digest pasted into a SHA-256 world is
 * indistinguishable from a corrupt SHA-256. This kernel extends the
 * CRYPTO-AGILITY-1A declared-algorithm law (sig_alg) from signatures to hashes.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash, getHashes } from "node:crypto";

import {
  HASH_BRIDGE_SCHEMA,
  HASH_ALGORITHMS,
  HASH_BRIDGE_REASON_CODES,
  buildHashBinding,
  buildBridgeReceipt,
  verifyBridgeReceipt,
} from "../packages/receipts/src/hash-namespace-bridge.js";
import { sha256Hex } from "../packages/receipts/src/hash-util.js";
import { stableStringify } from "../packages/consent/src/consent-common.js";

const SHA256_DIGEST = sha256Hex("bridge-content");
const BLAKE3_DIGEST = "a".repeat(64); // well-formed, foreign, not recomputable here

// A deterministic stand-in for a real blake3 implementation, injected by the
// caller who HAS one (e.g. the Rust data lake side). The kernel never ships one.
function fakeBlake3Hex(content) {
  // Not blake3 — a keyed stand-in that is deterministic for the test.
  return createHash("sha512").update(`blake3:${content}`).digest("hex").slice(0, 64);
}

describe("DEMA-HASH-NAMESPACE-BRIDGE-1A · measured environment", () => {
  it("node_crypto_has_no_blake3_which_is_why_declared_not_recomputed_exists", () => {
    const blakes = getHashes().filter((h) => /blake/i.test(h));
    assert.ok(!blakes.some((h) => /blake3/i.test(h)));
  });

  it("registry_says_blake3_is_not_locally_recomputable_and_sha256_is", () => {
    assert.equal(HASH_ALGORITHMS.blake3.locally_recomputable, false);
    assert.equal(HASH_ALGORITHMS.sha256.locally_recomputable, true);
  });
});

describe("DEMA-HASH-NAMESPACE-BRIDGE-1A · buildHashBinding", () => {
  it("bare_digest_string_is_refused", () => {
    const res = buildHashBinding(SHA256_DIGEST);
    assert.equal(res.ok, false);
    assert.equal(res.reason, "HASH_BINDING_NOT_OBJECT");
  });

  it("missing_alg_is_refused_as_undeclared", () => {
    const res = buildHashBinding({ digest: SHA256_DIGEST });
    assert.equal(res.ok, false);
    assert.equal(res.reason, "HASH_ALGORITHM_UNDECLARED");
  });

  it("unknown_alg_is_refused", () => {
    const res = buildHashBinding({ alg: "md5", digest: SHA256_DIGEST });
    assert.equal(res.ok, false);
    assert.equal(res.reason, "HASH_ALGORITHM_UNKNOWN");
  });

  it("wrong_length_digest_is_refused_per_algorithm", () => {
    const res = buildHashBinding({ alg: "blake2b512", digest: SHA256_DIGEST });
    assert.equal(res.ok, false);
    assert.equal(res.reason, "HASH_DIGEST_MALFORMED");
  });

  it("non_hex_digest_is_refused", () => {
    const res = buildHashBinding({ alg: "sha256", digest: "z".repeat(64) });
    assert.equal(res.ok, false);
    assert.equal(res.reason, "HASH_DIGEST_MALFORMED");
  });

  it("extra_keys_are_refused_so_widening_is_unrepresentable", () => {
    const res = buildHashBinding({
      alg: "sha256",
      digest: SHA256_DIGEST,
      locally_recomputable: true,
    });
    assert.equal(res.ok, false);
    assert.equal(res.reason, "HASH_BINDING_EXTRA_KEYS");
  });

  it("valid_binding_is_frozen_and_hex_normalized_to_lowercase", () => {
    const res = buildHashBinding({
      alg: "sha256",
      digest: SHA256_DIGEST.toUpperCase(),
    });
    assert.equal(res.ok, true);
    assert.equal(res.binding.alg, "sha256");
    assert.equal(res.binding.digest, SHA256_DIGEST);
    assert.ok(Object.isFrozen(res.binding));
  });

  it("every_refusal_reason_is_a_registered_code", () => {
    const bad = [
      buildHashBinding("bare"),
      buildHashBinding({ digest: SHA256_DIGEST }),
      buildHashBinding({ alg: "md5", digest: SHA256_DIGEST }),
      buildHashBinding({ alg: "sha256", digest: "short" }),
    ];
    for (const res of bad) {
      assert.ok(HASH_BRIDGE_REASON_CODES.includes(res.reason));
    }
  });
});

describe("DEMA-HASH-NAMESPACE-BRIDGE-1A · buildBridgeReceipt", () => {
  const foreign = { alg: "blake3", digest: BLAKE3_DIGEST };
  const localBody = { kind: "data-lake-object", path_hint: "areas/x" };

  it("recomputability_is_computed_inside_never_caller_asserted", () => {
    const res = buildBridgeReceipt({ foreign, localBody });
    assert.equal(res.ok, true);
    assert.equal(res.receipt.foreign_recomputable_here, false);
    const sha = buildBridgeReceipt({
      foreign: { alg: "sha256", digest: SHA256_DIGEST },
      localBody,
    });
    assert.equal(sha.receipt.foreign_recomputable_here, true);
  });

  it("caller_asserting_recomputability_is_refused", () => {
    const res = buildBridgeReceipt({
      foreign,
      localBody,
      foreign_recomputable_here: true,
    });
    assert.equal(res.ok, false);
    assert.equal(res.reason, "RECOMPUTABILITY_NOT_CALLER_ASSERTABLE");
  });

  it("invalid_foreign_binding_is_refused_with_its_binding_reason", () => {
    const res = buildBridgeReceipt({
      foreign: { digest: BLAKE3_DIGEST },
      localBody,
    });
    assert.equal(res.ok, false);
    assert.equal(res.reason, "HASH_ALGORITHM_UNDECLARED");
  });

  it("non_json_safe_local_body_is_refused", () => {
    const res = buildBridgeReceipt({
      foreign,
      localBody: { bad: () => {} },
    });
    assert.equal(res.ok, false);
    assert.equal(res.reason, "LOCAL_BODY_NOT_JSON_SAFE");
  });

  it("bridge_hash_is_sha256_of_the_stable_stringified_body", () => {
    const res = buildBridgeReceipt({ foreign, localBody });
    assert.equal(res.ok, true);
    const { bridge_hash, ...body } = res.receipt;
    assert.equal(bridge_hash, sha256Hex(stableStringify(body)));
    assert.equal(res.receipt.schema, HASH_BRIDGE_SCHEMA);
    assert.ok(Object.isFrozen(res.receipt));
  });
});

describe("DEMA-HASH-NAMESPACE-BRIDGE-1A · verifyBridgeReceipt", () => {
  const foreign = { alg: "blake3", digest: fakeBlake3Hex("lake-object-bytes") };
  const localBody = { kind: "data-lake-object", path_hint: "areas/x" };
  const built = () => buildBridgeReceipt({ foreign, localBody }).receipt;

  it("round_trip_verifies_and_labels_foreign_side_declared_not_recomputed", () => {
    const res = verifyBridgeReceipt(built());
    assert.equal(res.ok, true);
    assert.equal(res.foreign_verdict, "DECLARED_NOT_RECOMPUTED");
    assert.equal(res.bridge_hash_verdict, "RECOMPUTED_OK");
  });

  it("injected_verifier_plus_content_upgrades_to_recomputed_ok", () => {
    const res = verifyBridgeReceipt(built(), {
      content: "lake-object-bytes",
      verifiers: { blake3: fakeBlake3Hex },
    });
    assert.equal(res.ok, true);
    assert.equal(res.foreign_verdict, "RECOMPUTED_OK");
  });

  it("wrong_content_with_verifier_is_a_refusal_not_a_downgrade", () => {
    const res = verifyBridgeReceipt(built(), {
      content: "tampered-bytes",
      verifiers: { blake3: fakeBlake3Hex },
    });
    assert.equal(res.ok, false);
    assert.equal(res.reason, "FOREIGN_DIGEST_MISMATCH");
  });

  it("sha256_foreign_side_is_recomputed_natively_when_content_given", () => {
    const receipt = buildBridgeReceipt({
      foreign: { alg: "sha256", digest: sha256Hex("local-bytes") },
      localBody,
    }).receipt;
    const ok = verifyBridgeReceipt(receipt, { content: "local-bytes" });
    assert.equal(ok.ok, true);
    assert.equal(ok.foreign_verdict, "RECOMPUTED_OK");
    const bad = verifyBridgeReceipt(receipt, { content: "other-bytes" });
    assert.equal(bad.ok, false);
    assert.equal(bad.reason, "FOREIGN_DIGEST_MISMATCH");
  });

  it("tampered_embedded_binding_breaks_the_bridge_hash", () => {
    const receipt = built();
    const tampered = {
      ...receipt,
      foreign: { alg: "blake3", digest: "b".repeat(64) },
    };
    const res = verifyBridgeReceipt(tampered);
    assert.equal(res.ok, false);
    assert.equal(res.reason, "BRIDGE_HASH_MISMATCH");
  });

  it("declared_verdict_is_never_silently_upgraded_without_content", () => {
    const res = verifyBridgeReceipt(built(), {
      verifiers: { blake3: fakeBlake3Hex },
    });
    assert.equal(res.ok, true);
    assert.equal(res.foreign_verdict, "DECLARED_NOT_RECOMPUTED");
  });

  it("malformed_receipt_shapes_fail_closed", () => {
    for (const bad of [null, "receipt", 7, {}, { schema: "wrong" }]) {
      const res = verifyBridgeReceipt(bad);
      assert.equal(res.ok, false);
      assert.equal(res.reason, "BRIDGE_RECEIPT_MALFORMED");
    }
  });
});
