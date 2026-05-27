import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildURPLocalPreview,
  buildURPLocalSummary,
  buildResourceAllocationCandidate,
  URP_LOCAL_ALLOCATION_SCHEMA_NAME,
  URP_LOCAL_RESOURCE_CATEGORIES,
  URP_LOCAL_REQUIRED_BLOCKED_EFFECTS,
} from "../packages/core/src/urp-local.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";

test("URP-local canonical schema · NODE0_LOCAL_SEED · pool_scope = node0_local_only", () => {
  const u = buildURPLocalPreview();
  assert.equal(u.schema, "bizra.dema.urp_local.v0.1");
  assert.equal(u.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(u.pool_scope, "node0_local_only");
  assert.equal(u.federation_allowed, false);
});

test("URP-local declares 5 resource categories", () => {
  const u = buildURPLocalPreview();
  assert.equal(u.resource_categories.length, 5);
  for (const c of [
    "hardware",
    "data_corpus",
    "knowledge_base",
    "experience_history",
    "skill_library",
  ]) {
    assert.ok(u.resource_categories.includes(c));
  }
});

test("URP-local boundary canonical · deep frozen", () => {
  const u = buildURPLocalPreview();
  assert.ok(isCanonicalBoundary(u.boundary));
  assert.ok(Object.isFrozen(u));
});

test("URP-local with all summaries → all categories data_present=true", () => {
  const u = buildURPLocalPreview({
    hardware_summary: { cpu_cores: 8, memory_gb: 64 },
    data_corpus_summary: { total_messages: 27044 },
    knowledge_base_summary: { memory_entries_count: 100 },
    experience_history_summary: { receipts_count: 3 },
    skill_library_summary: { skills_count: 5 },
  });
  for (const c of URP_LOCAL_RESOURCE_CATEGORIES) {
    assert.equal(u[c].data_present, true);
  }
});

test("URP-local missing summaries → data_present=false for those categories", () => {
  const u = buildURPLocalPreview({
    hardware_summary: { cpu_cores: 8 },
  });
  assert.equal(u.hardware.data_present, true);
  assert.equal(u.data_corpus.data_present, false);
  assert.equal(u.knowledge_base.data_present, false);
});

test("URP-local blocked_effects include allocation_without_consent + sharing_without_typed_go", () => {
  const u = buildURPLocalPreview();
  assert.ok(
    u.blocked_effects.includes(
      "allocate_resource_without_per_resource_consent",
    ),
  );
  assert.ok(
    u.blocked_effects.includes(
      "share_resource_to_node1_or_node2_without_typed_go",
    ),
  );
  assert.ok(u.blocked_effects.includes("federation_invocation"));
});

test("Allocation candidate · valid input → consent phrase generated · allocation_active=false", () => {
  const a = buildResourceAllocationCandidate({
    resource: { id: "gpu-0", category: "hardware" },
    consumer_agent_id: "pat-3-code-apprentice",
    duration_minutes: 30,
    purpose: "compile and test bizra-omega",
  });
  assert.equal(a.schema, URP_LOCAL_ALLOCATION_SCHEMA_NAME);
  assert.equal(a.valid, true);
  assert.equal(a.allocation_active, false);
  assert.match(
    a.consent_phrase,
    /^GO: allocate hardware 'gpu-0' to pat-3-code-apprentice for 30min/,
  );
});

test("Allocation candidate · missing resource → invalid", () => {
  const a = buildResourceAllocationCandidate({
    consumer_agent_id: "pat-1",
    duration_minutes: 10,
    purpose: "test",
  });
  assert.equal(a.valid, false);
  assert.ok(a.violations.includes("no_resource"));
});

test("Allocation candidate · unknown category → invalid", () => {
  const a = buildResourceAllocationCandidate({
    resource: { id: "x", category: "malicious_category" },
    consumer_agent_id: "pat-1",
    duration_minutes: 10,
    purpose: "test",
  });
  assert.equal(a.valid, false);
  assert.ok(a.violations.some((v) => v.includes("unknown_resource_category")));
});

test("Allocation candidate · invalid duration → invalid", () => {
  const a = buildResourceAllocationCandidate({
    resource: { id: "x", category: "hardware" },
    consumer_agent_id: "pat-1",
    duration_minutes: 0,
    purpose: "test",
  });
  assert.equal(a.valid, false);
  assert.ok(a.violations.includes("invalid_duration"));
});

test("Allocation candidate · missing purpose → invalid", () => {
  const a = buildResourceAllocationCandidate({
    resource: { id: "x", category: "hardware" },
    consumer_agent_id: "pat-1",
    duration_minutes: 30,
  });
  assert.equal(a.valid, false);
  assert.ok(a.violations.includes("no_purpose"));
});

test("Adversarial · non-object resource handled gracefully", () => {
  const a = buildResourceAllocationCandidate({
    resource: "not-an-object",
    consumer_agent_id: "pat-1",
    duration_minutes: 30,
    purpose: "x",
  });
  assert.equal(a.valid, false);
});

test("Allocation candidate deep-frozen + canonical boundary", () => {
  const a = buildResourceAllocationCandidate({
    resource: { id: "x", category: "hardware" },
    consumer_agent_id: "pat-1",
    duration_minutes: 30,
    purpose: "test",
  });
  assert.ok(Object.isFrozen(a));
  assert.ok(isCanonicalBoundary(a.boundary));
});

test("Summary + exports", () => {
  const s = buildURPLocalSummary({
    hardware_summary: { cpu_cores: 8 },
  });
  assert.equal(s.categories_with_data.length, 1);
  assert.equal(s.categories_without_data_count, 4);
  assert.ok(JSON.stringify(s, null, 2).split("\n").length <= 40);
  assert.ok(Object.isFrozen(URP_LOCAL_REQUIRED_BLOCKED_EFFECTS));
});
