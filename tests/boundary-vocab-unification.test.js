import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PREVIEW_BOUNDARY_CANONICAL_KEYS,
  buildPreviewBoundary,
  isCanonicalBoundary,
} from "../packages/core/src/boundary-schema.js";
import {
  BOUNDARY_VOCAB_ADR_ENTRIES,
  BOUNDARY_VOCAB_UNIFICATION_ADR_ID,
  BOUNDARY_EFFECT_SYNONYM_ALIASES,
  BOUNDARY_EFFECT_DISTINCT_PAIRS,
  verifyBoundarySynonymAnnotations,
  allAdrJustifiedBoundaryKeys,
} from "../packages/core/src/boundary-vocab-registry.js";

const MASTER_CRAFTSMANSHIP_PATH =
  "packages/core/src/master-craftsmanship-audit.js";

function sortedKeys(keys) {
  return [...keys].sort();
}

function keysEqual(a, b) {
  return assert.deepEqual(sortedKeys(a), sortedKeys(b));
}

// 1. Canonical source exists and is frozen (mutation throws).
test("canonical boundary keys are frozen and reject mutation", () => {
  assert.equal(Object.isFrozen(PREVIEW_BOUNDARY_CANONICAL_KEYS), true);
  assert.throws(
    () => {
      PREVIEW_BOUNDARY_CANONICAL_KEYS.push("sneaky_key");
    },
    /Cannot add property|read only|object is not extensible/i,
  );
});

// 2. Default boundary is all-false; any true value fails validation.
test("buildPreviewBoundary is all-false and fails canonical validation when tampered", () => {
  const boundary = buildPreviewBoundary();
  for (const key of PREVIEW_BOUNDARY_CANONICAL_KEYS) {
    assert.equal(boundary[key], false, `${key} must default false`);
  }
  assert.equal(isCanonicalBoundary(boundary), true);

  const tampered = Object.freeze({
    ...boundary,
    network_used: true,
  });
  assert.equal(isCanonicalBoundary(tampered), false);
});

// 3. Every ADR registry entry keys match live module exports.
test("ADR registry entries match exported boundary key arrays", () => {
  assert.equal(BOUNDARY_VOCAB_UNIFICATION_ADR_ID, "ADR-BOUNDARY-VOCAB-UNIFICATION-1A");
  assert.ok(BOUNDARY_VOCAB_ADR_ENTRIES.length >= 17);

  for (const entry of BOUNDARY_VOCAB_ADR_ENTRIES) {
    assert.equal(Object.isFrozen(entry.keys), true, `${entry.id} keys must be frozen`);
    assert.ok(entry.keys.length > 0, `${entry.id} must declare keys`);
    assert.ok(entry.rationale.length > 0, `${entry.id} must have rationale`);
    if (entry.classification === "CANONICAL") {
      keysEqual(entry.keys, PREVIEW_BOUNDARY_CANONICAL_KEYS);
    }
  }
});

// 4. No ADR entry carries a key outside {canonical ∪ other ADR-justified keys}.
test("no undocumented boundary keys in ADR registry surfaces", () => {
  const allowed = new Set(allAdrJustifiedBoundaryKeys());
  for (const entry of BOUNDARY_VOCAB_ADR_ENTRIES) {
    for (const key of entry.keys) {
      assert.ok(
        allowed.has(key),
        `undocumented drift: ${entry.id} key ${key} not in justified union`,
      );
    }
  }

  const canonicalEntry = BOUNDARY_VOCAB_ADR_ENTRIES.find(
    (e) => e.classification === "CANONICAL",
  );
  assert.ok(canonicalEntry, "canonical ADR entry required");
  keysEqual(canonicalEntry.keys, PREVIEW_BOUNDARY_CANONICAL_KEYS);
});

// 5. Tamper: altering the canonical list in memory is detectable via freeze + length.
test("tampering canonical boundary list is detectable", () => {
  const before = PREVIEW_BOUNDARY_CANONICAL_KEYS.length;
  let mutationFailed = false;
  try {
    PREVIEW_BOUNDARY_CANONICAL_KEYS[0] = "mutated";
  } catch {
    mutationFailed = true;
  }
  assert.equal(
    PREVIEW_BOUNDARY_CANONICAL_KEYS[0],
    "filesystem_write_performed",
    "frozen array element must not mutate",
  );
  assert.equal(PREVIEW_BOUNDARY_CANONICAL_KEYS.length, before);
  assert.equal(mutationFailed, true);
});

// 6. Import integrity: refactored drift modules reference canonical export, not private copy.
test("master-craftsmanship-audit imports canonical keys instead of private duplicate list", () => {
  const source = readFileSync(MASTER_CRAFTSMANSHIP_PATH, "utf8");
  assert.match(
    source,
    /PREVIEW_BOUNDARY_CANONICAL_KEYS/,
    "must import canonical export from boundary-schema",
  );
  assert.doesNotMatch(
    source,
    /CANONICAL_BOUNDARY_KEY_NAMES/,
    "private duplicate key list must be removed",
  );
  assert.match(
    source,
    /from "\.\/boundary-schema\.js"/,
    "must import from boundary-schema.js",
  );
});

test("synonym aliases are documented and private_content_read is distinct from content_read", () => {
  assert.equal(BOUNDARY_EFFECT_SYNONYM_ALIASES.file_write_performed, "filesystem_write_performed");
  assert.equal(BOUNDARY_EFFECT_SYNONYM_ALIASES.network_call_performed, "network_used");
  assert.deepEqual(verifyBoundarySynonymAnnotations(), []);

  const distinct = BOUNDARY_EFFECT_DISTINCT_PAIRS.find(
    (pair) => pair.domain_key === "private_content_read",
  );
  assert.ok(distinct);
  assert.equal(distinct.related_canonical, "content_read");
  assert.notEqual(
    BOUNDARY_EFFECT_SYNONYM_ALIASES.private_content_read,
    "content_read",
  );
});
