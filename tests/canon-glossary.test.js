import test from "node:test";
import assert from "node:assert/strict";
import {
  CANON_GLOSSARY,
  buildExplainPreview,
  formatExplainPreview,
  getPerspective,
} from "../packages/core/src/canon-glossary.js";

const KNOWN_TRUTH_LABELS = new Set(["DECLARED", "MEASURED", "ASSUMED"]);

// ── structural integrity ──────────────────────────────────────────────────────

// `dema doctor` prints "Type `dema explain doctor` for what each predicate
// means." (doctor-dashboard.js:189). Before this entry existed, that command
// answered "I don't have a definition for `doctor` yet." and exited 0 — a
// silent dead end in the most-trafficked first-run surface. This test binds the
// promise to the glossary so the two cannot drift apart again.
test("glossary answers `doctor`, the term dema doctor tells users to look up", () => {
  const entry = CANON_GLOSSARY.get("doctor");
  assert.ok(entry, "doctor entry missing — `dema explain doctor` is a dead end");
  // Must actually explain the predicates, which is what the footer promises.
  for (const predicate of [
    "Activation gate",
    "Daemon",
    "Ready",
    "Console ready",
    "Gateway probe",
  ]) {
    assert.match(
      entry.long,
      new RegExp(predicate.replace(/ /g, "\\s+"), "i"),
      `doctor entry does not explain the "${predicate}" predicate`,
    );
  }
});

test("glossary has at least 28 entries", () => {
  assert.ok(
    CANON_GLOSSARY.size >= 28,
    `expected ≥28, got ${CANON_GLOSSARY.size}`,
  );
});

test("every entry has all required fields", () => {
  const required = [
    "schema",
    "concept",
    "title",
    "short",
    "long",
    "truth_label",
    "see_also",
    "doc_anchor",
  ];
  for (const [key, entry] of CANON_GLOSSARY) {
    for (const field of required) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(entry, field),
        `entry '${key}' missing field '${field}'`,
      );
    }
    assert.ok(
      typeof entry.title === "string" && entry.title.length > 0,
      `title empty for '${key}'`,
    );
    assert.ok(
      typeof entry.short === "string" && entry.short.length > 0,
      `short empty for '${key}'`,
    );
    assert.ok(
      typeof entry.long === "string" && entry.long.length > 0,
      `long empty for '${key}'`,
    );
    assert.ok(Array.isArray(entry.see_also), `see_also not array for '${key}'`);
    assert.ok(
      typeof entry.doc_anchor === "string" && entry.doc_anchor.length > 0,
      `doc_anchor empty for '${key}'`,
    );
  }
});

test("truth_label is from the known set for every entry", () => {
  for (const [key, entry] of CANON_GLOSSARY) {
    assert.ok(
      KNOWN_TRUTH_LABELS.has(entry.truth_label),
      `entry '${key}' has unknown truth_label '${entry.truth_label}'`,
    );
  }
});

test("see_also only references concepts that exist in the glossary (referential integrity)", () => {
  for (const [key, entry] of CANON_GLOSSARY) {
    for (const ref of entry.see_also) {
      assert.ok(
        CANON_GLOSSARY.has(ref),
        `entry '${key}' see_also references missing concept '${ref}'`,
      );
    }
  }
});

test("glossary entries are frozen — mutation is rejected", () => {
  const entry = CANON_GLOSSARY.get("ihsan");
  assert.throws(() => {
    entry.title = "mutated";
  });
});

// ── buildExplainPreview ───────────────────────────────────────────────────────

test("buildExplainPreview('ihsan') returns the matching entry", () => {
  const result = buildExplainPreview("ihsan");
  assert.equal(result.concept, "ihsan");
  assert.equal(result.schema, "bizra.dema.canon_glossary_entry.v0.1");
  assert.ok(result.long.length > 0);
});

test("buildExplainPreview('IHSAN') is case-insensitive", () => {
  const result = buildExplainPreview("IHSAN");
  assert.equal(result.concept, "ihsan");
});

test("buildExplainPreview('al-risala') matches hyphenated concept", () => {
  const result = buildExplainPreview("al-risala");
  assert.equal(result.concept, "al-risala");
  assert.equal(result.title, "الرسالة · The Message");
});

test("buildExplainPreview('unknown-concept') returns matched:false with suggestions array", () => {
  const result = buildExplainPreview("unknown-concept");
  assert.equal(result.matched, false);
  assert.ok(Array.isArray(result.suggestions));
});

test("buildExplainPreview('') returns listing mode", () => {
  const result = buildExplainPreview("");
  assert.equal(result.mode, "listing");
  assert.ok(result.count >= 28);
  assert.ok(Array.isArray(result.concepts));
});

test("buildExplainPreview(null) returns listing mode", () => {
  const result = buildExplainPreview(null);
  assert.equal(result.mode, "listing");
  assert.ok(result.count >= 28);
});

test("buildExplainPreview(undefined) returns listing mode", () => {
  const result = buildExplainPreview(undefined);
  assert.equal(result.mode, "listing");
});

// ── adversarial ───────────────────────────────────────────────────────────────

test("adversarial: prototype pollution attempt '__proto__' is safe", () => {
  const before = Object.prototype.toString;
  const result = buildExplainPreview("__proto__");
  // Should not crash and should not match (no concept named __proto__)
  assert.equal(result.matched, false);
  assert.equal(Object.prototype.toString, before, "prototype was mutated");
});

test("adversarial: very long input (5000 chars) is safe — returns not-found without crash", () => {
  const longInput = "a".repeat(5000);
  const result = buildExplainPreview(longInput);
  // Long input triggers the >200 char guard
  assert.equal(result.matched, false);
  assert.deepEqual(result.suggestions, []);
});

test("adversarial: unicode / RTL input handled gracefully", () => {
  // Arabic input that is not a known concept
  const result = buildExplainPreview("مرحبا");
  assert.equal(result.matched, false);
  assert.ok(Array.isArray(result.suggestions));
});

test("close-match: 'ishan' (1-char typo) suggests 'ihsan'", () => {
  const result = buildExplainPreview("ishan");
  assert.equal(result.matched, false);
  assert.ok(
    result.suggestions.includes("ihsan"),
    `suggestions: ${result.suggestions}`,
  );
});

// ── formatExplainPreview ──────────────────────────────────────────────────────

test("formatExplainPreview produces non-empty string for valid entry", () => {
  const entry = buildExplainPreview("pat");
  const formatted = formatExplainPreview(entry);
  assert.ok(typeof formatted === "string" && formatted.length > 0);
  assert.ok(
    formatted.includes("Truth label"),
    "expected 'Truth label' in output",
  );
  assert.ok(formatted.includes("See also"), "expected 'See also' in output");
});

test("formatExplainPreview listing mode includes 'Available concepts'", () => {
  const listing = buildExplainPreview(null);
  const formatted = formatExplainPreview(listing);
  assert.ok(formatted.includes("Available concepts"));
  assert.ok(formatted.includes("dema explain"));
});

test("formatExplainPreview not-found mode includes suggestion hint", () => {
  const notFound = buildExplainPreview("xyz-not-real");
  const formatted = formatExplainPreview(notFound);
  assert.ok(formatted.includes("don't have a definition"));
  assert.ok(formatted.includes("dema explain"));
});

test("formatExplainPreview with null input returns error string without throwing", () => {
  const result = formatExplainPreview(null);
  assert.ok(typeof result === "string");
  assert.ok(result.includes("Error"));
});

// ── perspectives: 8 seed concepts have all 4 perspectives ────────────────────

const SEED_CONCEPTS = [
  "bizra",
  "dema",
  "node0",
  "urp",
  "pat",
  "sat",
  "fate",
  "receipt",
];

test("all 8 seed concepts have a perspectives block", () => {
  for (const concept of SEED_CONCEPTS) {
    const entry = CANON_GLOSSARY.get(concept);
    assert.ok(
      entry &&
        typeof entry.perspectives === "object" &&
        entry.perspectives !== null,
      `'${concept}' missing perspectives block`,
    );
  }
});

test("all 8 seed concepts have non-empty simple perspective (≥10 chars)", () => {
  for (const concept of SEED_CONCEPTS) {
    const text = getPerspective(concept, "simple");
    assert.ok(
      typeof text === "string" && text.length >= 10,
      `'${concept}' simple perspective empty or too short`,
    );
  }
});

test("all 8 seed concepts have non-empty technical perspective (≥50 chars)", () => {
  for (const concept of SEED_CONCEPTS) {
    const text = getPerspective(concept, "technical");
    assert.ok(
      typeof text === "string" && text.length >= 50,
      `'${concept}' technical perspective empty or too short (got: ${text})`,
    );
  }
});

test("all 8 seed concepts have non-empty game perspective (≥30 chars)", () => {
  for (const concept of SEED_CONCEPTS) {
    const text = getPerspective(concept, "game");
    assert.ok(
      typeof text === "string" && text.length >= 30,
      `'${concept}' game perspective empty or too short`,
    );
  }
});

test("all 8 seed concepts have non-empty arabic perspective (≥30 chars)", () => {
  for (const concept of SEED_CONCEPTS) {
    const text = getPerspective(concept, "arabic");
    assert.ok(
      typeof text === "string" && text.length >= 30,
      `'${concept}' arabic perspective empty or too short`,
    );
  }
});

test("arabic perspectives contain Arabic Unicode block characters (؀-ۿ)", () => {
  const arabicRange = /[؀-ۿ]/;
  for (const concept of SEED_CONCEPTS) {
    const text = getPerspective(concept, "arabic");
    assert.ok(
      arabicRange.test(text),
      `'${concept}' arabic perspective contains no Arabic Unicode characters`,
    );
  }
});

// ── non-seed concepts have only simple perspective ───────────────────────────

const NON_SEED_CONCEPTS = [
  "ihsan",
  "adl",
  "riba-zero",
  "zann-zero",
  "third-fact",
];

test("non-seed concepts return null for technical perspective", () => {
  for (const concept of NON_SEED_CONCEPTS) {
    const text = getPerspective(concept, "technical");
    assert.equal(
      text,
      null,
      `'${concept}' should not have a technical perspective`,
    );
  }
});

test("non-seed concepts return null for arabic perspective", () => {
  for (const concept of NON_SEED_CONCEPTS) {
    const text = getPerspective(concept, "arabic");
    assert.equal(
      text,
      null,
      `'${concept}' should not have an arabic perspective`,
    );
  }
});

test("non-seed concepts return null for game perspective", () => {
  for (const concept of NON_SEED_CONCEPTS) {
    const text = getPerspective(concept, "game");
    assert.equal(text, null, `'${concept}' should not have a game perspective`);
  }
});

// ── getPerspective: basic contract ───────────────────────────────────────────

test("getPerspective returns text for present perspective (bizra/technical)", () => {
  const text = getPerspective("bizra", "technical");
  assert.ok(typeof text === "string" && text.length > 0);
});

test("getPerspective returns null for absent perspective (ihsan/technical)", () => {
  const result = getPerspective("ihsan", "technical");
  assert.equal(result, null);
});

test("getPerspective is case-insensitive on concept name", () => {
  const lower = getPerspective("dema", "simple");
  const upper = getPerspective("DEMA", "simple");
  assert.equal(lower, upper);
  assert.ok(typeof lower === "string" && lower.length > 0);
});

// ── adversarial: getPerspective ───────────────────────────────────────────────

test("adversarial: invalid perspective name returns null", () => {
  assert.equal(getPerspective("bizra", "hacker"), null);
  assert.equal(getPerspective("bizra", ""), null);
  assert.equal(getPerspective("bizra", "__proto__"), null);
});

test("adversarial: prototype pollution via getPerspective is safe", () => {
  const before = Object.prototype.toString;
  const result = getPerspective("__proto__", "simple");
  assert.equal(result, null);
  assert.equal(
    Object.prototype.toString,
    before,
    "prototype was mutated by getPerspective",
  );
});

test("adversarial: non-string inputs to getPerspective return null", () => {
  assert.equal(getPerspective(null, "simple"), null);
  assert.equal(getPerspective("bizra", null), null);
  assert.equal(getPerspective(42, "simple"), null);
});
