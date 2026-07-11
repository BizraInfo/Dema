import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

import {
  CANONICAL_JSON_V1_ALGORITHM,
  MAX_CANONICAL_DEPTH,
  MAX_CANONICAL_BYTES,
  MAX_OBJECT_KEYS,
  MAX_ARRAY_LENGTH,
  MAX_STRING_BYTES,
  canonicalizeJsonV1,
  assertCanonicalJsonValueV1,
} from "../packages/canon/src/canonical-json-v1.js";
import {
  CANONICAL_JSON_V1_ERROR_CODES,
  CanonicalJsonV1Error,
} from "../packages/canon/src/canonical-json-errors.js";
import {
  sha256CanonicalJsonV1,
  verifyCanonicalJsonHashV1,
} from "../packages/canon/src/sha256-canonical-json-v1.js";
import {
  runCanonicalJsonV1Check,
  buildGeneratorValue,
  buildInvalidValue,
} from "../scripts/review/canonical-json-v1-check.mjs";
import {
  PREVIEW_BOUNDARY_CANONICAL_KEYS,
  buildPreviewBoundary,
} from "../packages/core/src/boundary-schema.js";

const VALID = JSON.parse(
  readFileSync(new URL("../packages/canon/vectors/canonical-json-v1-valid.json", import.meta.url), "utf8"),
);
const INVALID = JSON.parse(
  readFileSync(new URL("../packages/canon/vectors/canonical-json-v1-invalid.json", import.meta.url), "utf8"),
);

function sha256Hex(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

test("limits are the measured-headroom constants from the M5.0 inventory baseline", () => {
  assert.equal(MAX_CANONICAL_DEPTH, 64);
  assert.equal(MAX_CANONICAL_BYTES, 1048576);
  assert.equal(MAX_OBJECT_KEYS, 256);
  assert.equal(MAX_ARRAY_LENGTH, 1024);
  assert.equal(MAX_STRING_BYTES, 65536);
  assert.equal(CANONICAL_JSON_V1_ALGORITHM, "bizra.canonical-json.v1");
});

test("every valid vector produces the exact authored bytes and sha256", () => {
  assert.ok(VALID.vectors.length >= 15, "at least 15 valid vectors");
  for (const v of VALID.vectors) {
    const input = v.generator ? buildGeneratorValue(v.generator) : v.value;
    const text = canonicalizeJsonV1(input);
    if (v.expected_canonical !== undefined) {
      assert.equal(text, v.expected_canonical, v.id);
    }
    if (v.expected_byte_length !== undefined) {
      assert.equal(Buffer.byteLength(text, "utf8"), v.expected_byte_length, v.id);
    }
    assert.equal(`sha256:${sha256Hex(text)}`, v.expected_sha256, v.id);
    assert.equal(sha256CanonicalJsonV1(input), v.expected_sha256, v.id);
  }
});

test("repeated serialization is byte-identical across the corpus", () => {
  for (const v of VALID.vectors) {
    const input = v.generator ? buildGeneratorValue(v.generator) : v.value;
    const a = canonicalizeJsonV1(input);
    const b = canonicalizeJsonV1(input);
    const c = canonicalizeJsonV1(input);
    assert.ok(a === b && b === c, v.id);
  }
});

test("key order independence: v10 and v11 pin identical bytes", () => {
  const v10 = VALID.vectors.find((v) => v.id === "v10-key-order-a");
  const v11 = VALID.vectors.find((v) => v.id === "v11-key-order-b");
  assert.equal(v10.expected_canonical, v11.expected_canonical);
  assert.equal(v10.expected_sha256, v11.expected_sha256);
  assert.equal(canonicalizeJsonV1(v10.value), canonicalizeJsonV1(v11.value));
});

test("every invalid vector fails closed with the exact error code", () => {
  assert.ok(INVALID.vectors.length >= 24, "at least 24 invalid vectors");
  for (const v of INVALID.vectors) {
    const input = buildInvalidValue(v.construct);
    assert.throws(
      () => canonicalizeJsonV1(input),
      (err) => err instanceof CanonicalJsonV1Error && err.code === v.expected_error_code,
      `${v.id} expected ${v.expected_error_code}`,
    );
    assert.throws(
      () => assertCanonicalJsonValueV1(input),
      (err) => err instanceof CanonicalJsonV1Error && err.code === v.expected_error_code,
      `${v.id} assert path`,
    );
  }
});

test("all emitted error codes belong to the frozen registry", () => {
  assert.ok(Object.isFrozen(CANONICAL_JSON_V1_ERROR_CODES));
  for (const v of INVALID.vectors) {
    assert.ok(
      CANONICAL_JSON_V1_ERROR_CODES.includes(v.expected_error_code),
      `${v.expected_error_code} registered`,
    );
  }
});

test("accessor properties are rejected without executing the getter", () => {
  let executed = false;
  const o = {};
  Object.defineProperty(o, "g", {
    enumerable: true,
    get() {
      executed = true;
      return 1;
    },
  });
  assert.throws(
    () => canonicalizeJsonV1(o),
    (err) => err.code === "object_accessor_property",
  );
  assert.equal(executed, false, "getter must not run");
});

test("input is not mutated and frozen input is accepted", () => {
  const input = Object.freeze({ b: Object.freeze([1, 2]), a: "x" });
  const text = canonicalizeJsonV1(input);
  assert.equal(text, '{"a":"x","b":[1,2]}');
  const mutable = { b: [1, 2], a: "x" };
  const snapshot = JSON.stringify(mutable);
  canonicalizeJsonV1(mutable);
  assert.equal(JSON.stringify(mutable), snapshot, "input unchanged");
});

test("null-prototype objects are accepted as plain", () => {
  const o = Object.create(null);
  o.b = 2;
  o.a = 1;
  assert.equal(canonicalizeJsonV1(o), '{"a":1,"b":2}');
});

test("keys sort by Unicode code point, not UTF-16 code units", () => {
  // U+FFFF sorts BEFORE U+1F600 by code point; UTF-16 code-unit order says the
  // opposite (0xFFFF > 0xD83D). This pins the contract's code-point rule.
  const o = { "\u{1F600}": 1, "￿": 2 };
  assert.equal(canonicalizeJsonV1(o), '{"￿":2,"\u{1F600}":1}');
});

test("negative zero normalizes to 0 at any position", () => {
  assert.equal(canonicalizeJsonV1(-0), "0");
  assert.equal(canonicalizeJsonV1({ n: -0 }), '{"n":0}');
  assert.equal(canonicalizeJsonV1([-0]), "[0]");
});

test("legacy divergence regression pin: v1 rejects what legacy serializers disagreed on", () => {
  // M5.0 measured: legacy group A emits {"a":undefined,"b":1} (invalid JSON),
  // legacy group B emits {"b":1}. v1 refuses the input entirely.
  assert.throws(() => canonicalizeJsonV1({ a: undefined, b: 1 }), (e) => e.code === "value_undefined");
  assert.throws(() => canonicalizeJsonV1([undefined]), (e) => e.code === "value_undefined");
});

test("hash format and verify round-trip", () => {
  const h = sha256CanonicalJsonV1({ a: 1 });
  assert.match(h, /^sha256:[0-9a-f]{64}$/);
  const ok = verifyCanonicalJsonHashV1({ a: 1 }, h);
  assert.equal(ok.ok, true);
  assert.equal(ok.algorithm, CANONICAL_JSON_V1_ALGORITHM);
  assert.equal(ok.hash_algorithm, "sha256");

  const bad = verifyCanonicalJsonHashV1({ a: 2 }, h);
  assert.equal(bad.ok, false);

  const malformed = verifyCanonicalJsonHashV1({ a: 1 }, "sha256:zzz");
  assert.equal(malformed.ok, false);
  assert.equal(malformed.error_code, "expected_hash_malformed");

  const invalidValue = verifyCanonicalJsonHashV1({ a: undefined }, h);
  assert.equal(invalidValue.ok, false);
  assert.equal(invalidValue.error_code, "value_undefined");
});

test("review gate passes with all-false canonical boundary and zero authority delta", () => {
  const result = runCanonicalJsonV1Check();
  assert.equal(result.ok, true, JSON.stringify(result.blocked_by ?? []));
  assert.equal(result.truth_label, "PREVIEW_ONLY");
  assert.equal(result.authority_delta, 0);
  // Guard against the vacuous all-false trap: compare the FULL canonical key set.
  assert.deepEqual(
    Object.keys(result.boundary).sort(),
    [...PREVIEW_BOUNDARY_CANONICAL_KEYS].sort(),
  );
  assert.deepEqual(result.boundary, buildPreviewBoundary());
  for (const key of PREVIEW_BOUNDARY_CANONICAL_KEYS) {
    assert.equal(result.boundary[key], false, key);
  }
});
