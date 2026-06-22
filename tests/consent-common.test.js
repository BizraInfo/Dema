import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  assertIntentWithinBound,
  MAX_INTENT_BYTES,
  stableStringify,
  sha256,
} from "../packages/consent/src/consent-common.js";

describe("assertIntentWithinBound", () => {
  it("does not throw for intent well under bound", () => {
    assert.doesNotThrow(() => assertIntentWithinBound("a".repeat(100)));
  });

  it("does not throw for intent exactly at bound (inclusive)", () => {
    assert.doesNotThrow(() =>
      assertIntentWithinBound("a".repeat(MAX_INTENT_BYTES)),
    );
  });

  it("throws for intent one byte over bound and error contains byte count", () => {
    const oversized = "a".repeat(MAX_INTENT_BYTES + 1);
    assert.throws(
      () => assertIntentWithinBound(oversized),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(
          err.message.includes(String(MAX_INTENT_BYTES + 1)),
          `expected byte count ${MAX_INTENT_BYTES + 1} in error message: ${err.message}`,
        );
        return true;
      },
    );
  });

  it("throws for multi-byte UTF-8 where char-count < 10240 but byte-count > 10240 (byte-not-char counting)", () => {
    // '€' encodes to 3 bytes in UTF-8.
    // 3414 chars × 3 bytes = 10242 bytes > 10240 limit.
    const euroStr = "€".repeat(3414);
    const byteLen = Buffer.byteLength(euroStr, "utf8");
    assert.ok(
      byteLen > MAX_INTENT_BYTES,
      `precondition: ${byteLen} bytes must exceed ${MAX_INTENT_BYTES}`,
    );
    assert.ok(
      euroStr.length < MAX_INTENT_BYTES,
      `precondition: char count ${euroStr.length} must be below ${MAX_INTENT_BYTES}`,
    );
    assert.throws(
      () => assertIntentWithinBound(euroStr),
      /exceeds maximum length/,
    );
  });

  it("does not throw for null intent (treated as empty string)", () => {
    assert.doesNotThrow(() => assertIntentWithinBound(null));
  });

  it("does not throw for undefined intent (treated as empty string)", () => {
    assert.doesNotThrow(() => assertIntentWithinBound(undefined));
  });

  it("includes the custom context label in the error message", () => {
    const oversized = "a".repeat(MAX_INTENT_BYTES + 1);
    assert.throws(
      () => assertIntentWithinBound(oversized, "Mission"),
      (err) => {
        assert.ok(
          err.message.includes("Mission"),
          `expected "Mission" in error message: ${err.message}`,
        );
        return true;
      },
    );
  });
});

describe("stableStringify", () => {
  it("produces the same output regardless of key insertion order", () => {
    assert.equal(
      stableStringify({ a: 1, b: 2 }),
      stableStringify({ b: 2, a: 1 }),
    );
  });

  it("is deterministic for nested objects with different key order", () => {
    const obj1 = { z: { x: 1, y: 2 }, a: 3 };
    const obj2 = { a: 3, z: { y: 2, x: 1 } };
    assert.equal(stableStringify(obj1), stableStringify(obj2));
  });
});

describe("sha256", () => {
  it("produces the same hash for the same input (deterministic)", () => {
    const input = "hello consent boundary";
    assert.equal(sha256(input), sha256(input));
  });

  it("produces different hashes for different inputs (input-sensitive)", () => {
    assert.notEqual(sha256("hello"), sha256("world"));
  });
});

// AUDIT P2: stableStringify recursed without a depth cap — adversarial or cyclic
// input could exhaust the stack while canonicalizing a body for hashing. The cap
// fails closed (throws) rather than producing a hash for pathological input.
describe("stableStringify depth cap", () => {
  it("throws on input nested deeper than the cap", () => {
    const root = {};
    let cur = root;
    for (let i = 0; i < 200; i++) {
      cur.child = {};
      cur = cur.child;
    }
    assert.throws(() => stableStringify(root), /depth/i);
  });

  it("stringifies normally-nested input unchanged (regression)", () => {
    assert.equal(stableStringify({ a: [1, { b: 2 }] }), '{"a":[1,{"b":2}]}');
    assert.equal(
      stableStringify({ b: 2, a: 1 }),
      stableStringify({ a: 1, b: 2 }),
    );
  });
});
