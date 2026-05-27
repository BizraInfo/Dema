import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildPATMemoryCuratorPreview,
  buildPATMemoryCuratorSummary,
  buildPATMemoryCuratorEffectCap,
  buildPATMemoryCuratorKernel,
  classifyMemoryEntry,
  PAT_MEMORY_CURATOR_PERSONA,
  PAT_MEMORY_CURATOR_CANONICAL_CATEGORIES,
} from "../packages/core/src/pat-memory-curator.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";

test("PAT-4 preview canonical schema + persona pat_number=4", () => {
  const p = buildPATMemoryCuratorPreview();
  assert.equal(p.schema, "bizra.dema.pat_memory_curator.v0.1");
  assert.equal(p.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(p.persona.pat_number, 4);
  assert.equal(p.persona.role_name, "memory_curator");
});

test("PAT-4 boundary canonical + deep frozen", () => {
  const p = buildPATMemoryCuratorPreview();
  assert.ok(isCanonicalBoundary(p.boundary));
  assert.ok(Object.isFrozen(p));
});

test("PAT-4 refusals: never delete · never move without consent · never edit", () => {
  const p = buildPATMemoryCuratorPreview();
  assert.ok(p.persona.primary_refusals.includes("delete_memory_entries"));
  assert.ok(
    p.persona.primary_refusals.includes("move_entries_without_consent"),
  );
  assert.ok(p.persona.primary_refusals.includes("edit_entry_content"));
});

test("PAT-4 EffectCap blocks delete · edit · move-without-consent · merge-silently", () => {
  const cap = buildPATMemoryCuratorEffectCap();
  assert.equal(cap.valid, true);
  assert.ok(cap.blocked_effects.includes("delete_memory_entry"));
  assert.ok(cap.blocked_effects.includes("edit_memory_entry_content"));
  assert.ok(cap.blocked_effects.includes("move_entry_without_consent"));
  assert.ok(cap.blocked_effects.includes("merge_entries_silently"));
});

test("PAT-4 kernel pre-configured correctly", () => {
  const k = buildPATMemoryCuratorKernel({ mission_intent: "classify entries" });
  assert.equal(k.agent_id, "pat-4-memory-curator");
});

test("PAT-4 declares 5 canonical memory categories", () => {
  const p = buildPATMemoryCuratorPreview();
  assert.equal(p.canonical_memory_categories.length, 5);
  for (const cat of [
    "user",
    "feedback",
    "project",
    "reference",
    "uncategorized",
  ]) {
    assert.ok(p.canonical_memory_categories.includes(cat));
  }
});

test("classifyMemoryEntry · feedback_xxx → feedback category · high confidence with frontmatter", () => {
  const c = classifyMemoryEntry({
    entry_name: "feedback_law_of_assumption",
    entry_type_frontmatter: "feedback",
  });
  assert.equal(c.schema, "bizra.dema.memory_classification.v0.1");
  assert.equal(c.suggested_category, "feedback");
  assert.equal(c.classification_confidence, "high");
});

test("classifyMemoryEntry · project_xxx → project category · medium confidence without frontmatter", () => {
  const c = classifyMemoryEntry({ entry_name: "project_some_thing" });
  assert.equal(c.suggested_category, "project");
  assert.equal(c.classification_confidence, "medium");
});

test("classifyMemoryEntry · unknown name → uncategorized · low confidence", () => {
  const c = classifyMemoryEntry({ entry_name: "random-thing-no-prefix" });
  assert.equal(c.suggested_category, "uncategorized");
  assert.equal(c.classification_confidence, "low");
});

test("classifyMemoryEntry · frontmatter wins over name when both present", () => {
  const c = classifyMemoryEntry({
    entry_name: "feedback_something",
    entry_type_frontmatter: "project",
  });
  assert.equal(c.suggested_category, "project");
  assert.equal(c.inferred_from_name, "feedback");
  assert.equal(c.inferred_from_frontmatter, "project");
});

test("classifyMemoryEntry · current category differs from suggested → requires consent", () => {
  const c = classifyMemoryEntry({
    entry_name: "feedback_x",
    current_category: "project",
  });
  assert.equal(c.requires_consent_to_apply, true);
  assert.match(
    c.consent_phrase,
    /GO: move 'feedback_x' from 'project' to 'feedback'/,
  );
});

test("classifyMemoryEntry · current category matches suggested → no consent needed", () => {
  const c = classifyMemoryEntry({
    entry_name: "feedback_x",
    current_category: "feedback",
  });
  assert.equal(c.requires_consent_to_apply, false);
  assert.equal(c.consent_phrase, null);
});

test("Adversarial · non-canonical frontmatter value falls back to name-based inference", () => {
  const c = classifyMemoryEntry({
    entry_name: "feedback_x",
    entry_type_frontmatter: "malicious_category",
  });
  assert.equal(c.suggested_category, "feedback");
  assert.equal(c.inferred_from_frontmatter, null);
});

test("Adversarial · non-string inputs coerced to empty", () => {
  const c = classifyMemoryEntry({ entry_name: { malicious: true } });
  assert.equal(c.entry_name, "");
  assert.equal(c.suggested_category, "uncategorized");
  assert.equal(c.receipt_shape_ready, false);
});

test("Classification output is deep-frozen + canonical boundary", () => {
  const c = classifyMemoryEntry({ entry_name: "project_x" });
  assert.ok(Object.isFrozen(c));
  assert.ok(Object.isFrozen(c.canonical_categories));
  assert.ok(isCanonicalBoundary(c.boundary));
});

test("Summary fits within line budget", () => {
  const s = buildPATMemoryCuratorSummary();
  const lines = JSON.stringify(s, null, 2).split("\n").length;
  assert.ok(lines <= 40);
});

test("Exports + persona frozen", () => {
  assert.ok(Object.isFrozen(PAT_MEMORY_CURATOR_PERSONA));
  assert.equal(PAT_MEMORY_CURATOR_PERSONA.pat_number, 4);
  assert.equal(PAT_MEMORY_CURATOR_CANONICAL_CATEGORIES.length, 5);
});
