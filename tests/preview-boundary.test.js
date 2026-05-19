import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildPreviewBoundary,
  isCanonicalBoundary,
  isCanonicalBoundaryShape,
  PREVIEW_BOUNDARY_CANONICAL_KEYS
} from "../packages/core/src/preview-boundary.js";

const EXPECTED_KEYS = [
  "filesystem_write_performed",
  "network_used",
  "runtime_execution_performed",
  "model_loaded",
  "model_invocation_performed",
  "prompt_executed",
  "external_call_performed",
  "raw_corpus_scan_performed",
  "raw_data_included",
  "tool_executed",
  "chain_advance_performed",
  "receipt_mint_performed",
  "federation_invoked",
  "node_connection_performed",
  "public_network_used",
  "consent_collected"
];

test("buildPreviewBoundary emits all 16 canonical keys", () => {
  const b = buildPreviewBoundary();
  const keys = Object.keys(b).sort();
  assert.deepEqual(keys, [...EXPECTED_KEYS].sort());
});

test("buildPreviewBoundary pins every value to false", () => {
  const b = buildPreviewBoundary();
  for (const k of EXPECTED_KEYS) {
    assert.equal(b[k], false, `${k} must be false`);
  }
});

test("buildPreviewBoundary returns a frozen object", () => {
  const b = buildPreviewBoundary();
  assert.equal(Object.isFrozen(b), true);
});

test("buildPreviewBoundary returns a fresh object on each call", () => {
  const b1 = buildPreviewBoundary();
  const b2 = buildPreviewBoundary();
  // Same content, different references — caller can't mutate one and affect the other
  assert.notStrictEqual(b1, b2);
  assert.deepEqual(b1, b2);
});

test("PREVIEW_BOUNDARY_CANONICAL_KEYS exports the canonical list (frozen)", () => {
  assert.equal(PREVIEW_BOUNDARY_CANONICAL_KEYS.length, 16);
  assert.equal(Object.isFrozen(PREVIEW_BOUNDARY_CANONICAL_KEYS), true);
});

test("isCanonicalBoundary accepts a canonical boundary", () => {
  const b = buildPreviewBoundary();
  assert.equal(isCanonicalBoundary(b), true);
});

test("isCanonicalBoundary rejects boundaries with wrong key set", () => {
  // Missing a key
  const missing = Object.freeze({
    ...buildPreviewBoundary(),
    // Override by reconstructing without consent_collected
  });
  // Construct a non-canonical key set:
  const partial = Object.freeze(Object.fromEntries(
    EXPECTED_KEYS.slice(0, 15).map((k) => [k, false])
  ));
  assert.equal(isCanonicalBoundary(partial), false);
});

test("isCanonicalBoundary rejects boundaries with extra keys", () => {
  const extra = Object.freeze({
    ...buildPreviewBoundary(),
    sneaky_extra_key: false
  });
  assert.equal(isCanonicalBoundary(extra), false);
});

test("isCanonicalBoundary rejects boundaries with any value=true", () => {
  // Can't actually mutate a frozen object; construct fresh with a true value
  const evil = Object.freeze(Object.fromEntries(
    EXPECTED_KEYS.map((k) => [k, k === "filesystem_write_performed" ? true : false])
  ));
  assert.equal(isCanonicalBoundary(evil), false);
});

test("isCanonicalBoundary rejects non-frozen boundaries", () => {
  const unfrozen = Object.fromEntries(EXPECTED_KEYS.map((k) => [k, false]));
  assert.equal(isCanonicalBoundary(unfrozen), false);
});

test("isCanonicalBoundary rejects null/undefined/non-object", () => {
  assert.equal(isCanonicalBoundary(null), false);
  assert.equal(isCanonicalBoundary(undefined), false);
  assert.equal(isCanonicalBoundary("not an object"), false);
  assert.equal(isCanonicalBoundary(42), false);
});

test("Canonical key set has no duplicates", () => {
  const set = new Set(EXPECTED_KEYS);
  assert.equal(set.size, EXPECTED_KEYS.length);
});

test("isCanonicalBoundaryShape accepts canonical-shape objects without requiring freeze", () => {
  // JSON.parse'd boundary: non-frozen, but canonical key set + all-false
  const fromJSON = JSON.parse(JSON.stringify(buildPreviewBoundary()));
  assert.equal(Object.isFrozen(fromJSON), false, "JSON round-trip strips freeze");
  assert.equal(isCanonicalBoundaryShape(fromJSON), true,
    "shape-only verifier must accept non-frozen canonical inputs");
});

test("isCanonicalBoundaryShape still rejects extra keys, missing keys, truthy values", () => {
  const extra = JSON.parse(JSON.stringify({ ...buildPreviewBoundary(), sneaky: false }));
  assert.equal(isCanonicalBoundaryShape(extra), false);

  const partial = Object.fromEntries(EXPECTED_KEYS.slice(0, 15).map((k) => [k, false]));
  assert.equal(isCanonicalBoundaryShape(partial), false);

  const truthyValue = Object.fromEntries(EXPECTED_KEYS.map((k) => [k, k === "filesystem_write_performed"]));
  assert.equal(isCanonicalBoundaryShape(truthyValue), false);
});

test("isCanonicalBoundary remains strict (rejects non-frozen even if shape is canonical)", () => {
  // Confirm the two functions diverge precisely on freeze: same shape, different freeze status
  const frozen = buildPreviewBoundary();
  const unfrozen = JSON.parse(JSON.stringify(frozen));
  assert.equal(isCanonicalBoundary(frozen), true);
  assert.equal(isCanonicalBoundary(unfrozen), false, "strict variant requires freeze");
  assert.equal(isCanonicalBoundaryShape(frozen), true);
  assert.equal(isCanonicalBoundaryShape(unfrozen), true, "shape variant accepts both");
});

test("Canonical keys follow naming convention (snake_case, no caps, ends in performed/used/included/loaded/executed/invoked/advanced/collected/minted)", () => {
  const validSuffixes = [
    "_performed", "_used", "_included", "_loaded", "_executed",
    "_invoked", "_advanced", "_collected", "_minted"
  ];
  for (const k of EXPECTED_KEYS) {
    assert.match(k, /^[a-z_]+$/, `${k} must be snake_case`);
    const hasValidSuffix = validSuffixes.some((s) => k.endsWith(s));
    assert.equal(hasValidSuffix, true, `${k} must end in an action-past-tense suffix`);
  }
});
