// SIMPLIFY-RECEIPTS-HASH-1A — test-first.
// Proves the shared receipt content-hash helper that replaces five byte-
// identical local `sha256Hex` definitions across packages/receipts/src/*-save.js.
// Known-answer vectors lock the algorithm so the consolidation is provably
// behavior-preserving (receipt hashes cannot drift).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sha256Hex } from "../packages/receipts/src/hash-util.js";

test("sha256Hex matches the canonical empty-string SHA-256 vector", () => {
  assert.equal(
    sha256Hex(""),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
});

test('sha256Hex matches the canonical "abc" SHA-256 vector', () => {
  assert.equal(
    sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("sha256Hex output is 64 lowercase hex chars and deterministic", () => {
  const a = sha256Hex("bizra-dema-receipt-content");
  const b = sha256Hex("bizra-dema-receipt-content");
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(a, b);
});

test("sha256Hex is byte-equivalent to the inlined receipt-saver implementation", () => {
  // The exact expression the five savers carried locally — consolidation MUST
  // produce an identical digest or every receipt hash would drift.
  const content = JSON.stringify({ schema: "x", body: [1, 2, 3] });
  const inlined = createHash("sha256").update(content).digest("hex");
  assert.equal(sha256Hex(content), inlined);
});
