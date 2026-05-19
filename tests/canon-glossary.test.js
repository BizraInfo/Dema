import test from "node:test";
import assert from "node:assert/strict";
import {
  CANON_GLOSSARY,
  buildExplainPreview,
  formatExplainPreview
} from "../packages/core/src/canon-glossary.js";

const KNOWN_TRUTH_LABELS = new Set(["DECLARED", "MEASURED", "ASSUMED"]);

// ── structural integrity ──────────────────────────────────────────────────────

test("glossary has at least 28 entries", () => {
  assert.ok(CANON_GLOSSARY.size >= 28, `expected ≥28, got ${CANON_GLOSSARY.size}`);
});

test("every entry has all required fields", () => {
  const required = ["schema", "concept", "title", "short", "long", "truth_label", "see_also", "doc_anchor"];
  for (const [key, entry] of CANON_GLOSSARY) {
    for (const field of required) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(entry, field),
        `entry '${key}' missing field '${field}'`
      );
    }
    assert.ok(typeof entry.title === "string" && entry.title.length > 0, `title empty for '${key}'`);
    assert.ok(typeof entry.short === "string" && entry.short.length > 0, `short empty for '${key}'`);
    assert.ok(typeof entry.long === "string" && entry.long.length > 0, `long empty for '${key}'`);
    assert.ok(Array.isArray(entry.see_also), `see_also not array for '${key}'`);
    assert.ok(typeof entry.doc_anchor === "string" && entry.doc_anchor.length > 0, `doc_anchor empty for '${key}'`);
  }
});

test("truth_label is from the known set for every entry", () => {
  for (const [key, entry] of CANON_GLOSSARY) {
    assert.ok(
      KNOWN_TRUTH_LABELS.has(entry.truth_label),
      `entry '${key}' has unknown truth_label '${entry.truth_label}'`
    );
  }
});

test("see_also only references concepts that exist in the glossary (referential integrity)", () => {
  for (const [key, entry] of CANON_GLOSSARY) {
    for (const ref of entry.see_also) {
      assert.ok(
        CANON_GLOSSARY.has(ref),
        `entry '${key}' see_also references missing concept '${ref}'`
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
  assert.ok(result.suggestions.includes("ihsan"), `suggestions: ${result.suggestions}`);
});

// ── formatExplainPreview ──────────────────────────────────────────────────────

test("formatExplainPreview produces non-empty string for valid entry", () => {
  const entry = buildExplainPreview("pat");
  const formatted = formatExplainPreview(entry);
  assert.ok(typeof formatted === "string" && formatted.length > 0);
  assert.ok(formatted.includes("Truth label"), "expected 'Truth label' in output");
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
