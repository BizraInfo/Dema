import test from "node:test";
import assert from "node:assert/strict";

import {
  assessDesignCanon,
  runDemaIsnadModernDesignCanonCheck,
  REQUIRED_MARKERS,
  REQUIRED_SECTIONS,
  DEMA_ISNAD_MODERN_DESIGN_CANON_SCHEMA,
  DEMA_ISNAD_MODERN_DESIGN_CANON_TRUTH_LABEL,
} from "../scripts/review/dema-isnad-modern-design-canon-check.mjs";

const goodDesignSystem =
  REQUIRED_MARKERS.join("\n") +
  "\nBoundary: no live runtime, no GUI/TUI implementation, no mint, no URP, no federation.";
const goodBlueprint = REQUIRED_SECTIONS.join("\n");
const goodReceipt = "DESIGN_CANON_DOCS_ONLY receipt";

function good(overrides = {}) {
  return { designSystem: goodDesignSystem, blueprint: goodBlueprint, receipt: goodReceipt, ...overrides };
}

test("the real design-canon docs pass the gate (docs-only, no runtime)", () => {
  const r = runDemaIsnadModernDesignCanonCheck();
  assert.equal(r.ok, true, r.blocked_by.join(", "));
  assert.equal(r.docs_only, true);
  assert.equal(r.schema, DEMA_ISNAD_MODERN_DESIGN_CANON_SCHEMA);
  assert.equal(r.truth_label, DEMA_ISNAD_MODERN_DESIGN_CANON_TRUTH_LABEL);
});

test("passes on a well-formed injected fixture", () => {
  const r = assessDesignCanon(good());
  assert.equal(r.ok, true, r.blocked_by.join(", "));
});

test("fails closed when a doctrine marker is missing", () => {
  const missing = REQUIRED_MARKERS[0];
  const r = assessDesignCanon(good({ designSystem: goodDesignSystem.replace(missing, "REDACTED") }));
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes(`missing_marker:${missing}`));
});

test("fails closed when a cockpit UX section is missing", () => {
  const missing = REQUIRED_SECTIONS[0];
  const r = assessDesignCanon(good({ blueprint: goodBlueprint.replace(missing, "REDACTED") }));
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes(`missing_section:${missing}`));
});

test("fails closed on an affirmative overclaim", () => {
  const r = assessDesignCanon(good({ receipt: `${goodReceipt}\nthe TUI runtime shipped and minting is live` }));
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.some((c) => c.startsWith("forbidden_claim:")));
});

test("negations (no live runtime / no GUI-TUI implementation / no mint) do NOT false-positive", () => {
  const r = assessDesignCanon(good());
  assert.ok(!r.blocked_by.some((c) => c.startsWith("forbidden_claim:")), r.blocked_by.join(", "));
});

test("fails closed when a canon doc is absent", () => {
  const one = assessDesignCanon({ designSystem: "", blueprint: goodBlueprint, receipt: goodReceipt });
  assert.equal(one.ok, false);
  assert.ok(one.blocked_by.includes("design_system_doc_missing"));
  const none = assessDesignCanon({});
  assert.equal(none.ok, false);
  assert.ok(none.blocked_by.includes("blueprint_doc_missing"));
  assert.ok(none.blocked_by.includes("receipt_doc_missing"));
  assert.equal(none.docs_only, true);
});
