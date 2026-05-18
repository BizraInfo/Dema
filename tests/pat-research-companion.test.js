import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildPATResearchCompanionPreview,
  buildPATResearchCompanionSummary,
  buildPATResearchCompanionEffectCap,
  buildPATResearchCompanionKernel,
  draftResearchPlan,
  PAT_RESEARCH_COMPANION_SCHEMA_NAME,
  PAT_RESEARCH_COMPANION_PLAN_SCHEMA_NAME,
  PAT_RESEARCH_COMPANION_CONSENT_PHRASE_TEMPLATE,
  PAT_RESEARCH_COMPANION_PERSONA
} from "../packages/core/src/pat-research-companion.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";

test("PAT-2 preview emits canonical schema + truth label", () => {
  const p = buildPATResearchCompanionPreview();
  assert.equal(p.schema, "bizra.dema.pat_research_companion.v0.1");
  assert.equal(p.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(p.mode, "preview_only");
});

test("PAT-2 boundary is canonical 16-key all-false", () => {
  const p = buildPATResearchCompanionPreview();
  assert.ok(isCanonicalBoundary(p.boundary));
});

test("PAT-2 persona declares pat_number=2 and role=research_companion", () => {
  const p = buildPATResearchCompanionPreview();
  assert.equal(p.persona.pat_number, 2);
  assert.equal(p.persona.pat_id, "pat-2-research-companion");
  assert.equal(p.persona.role_name, "research_companion");
});

test("PAT-2 capabilities include query_corpus and request_bounded_web_fetch", () => {
  const p = buildPATResearchCompanionPreview();
  assert.ok(p.persona.primary_capabilities.includes("query_corpus_with_consent"));
  assert.ok(p.persona.primary_capabilities.includes("request_bounded_web_fetch"));
  assert.ok(p.persona.primary_capabilities.includes("synthesize_hash_bound_evidence"));
});

test("PAT-2 refusals include 'never modify corpus' and 'never cache outside dema home'", () => {
  const p = buildPATResearchCompanionPreview();
  assert.ok(p.persona.primary_refusals.includes("modify_corpus_data"));
  assert.ok(p.persona.primary_refusals.includes("cache_findings_outside_dema_home"));
  assert.ok(p.persona.primary_refusals.includes("claim_findings_as_verified_without_source_hash"));
});

test("PAT-2 is deep-frozen at all sub-views", () => {
  const p = buildPATResearchCompanionPreview();
  assert.ok(Object.isFrozen(p));
  assert.ok(Object.isFrozen(p.persona));
  assert.ok(Object.isFrozen(p.refusal_invariants));
});

test("PAT-2 EffectCap valid with research-specific consent template", () => {
  const cap = buildPATResearchCompanionEffectCap();
  assert.equal(cap.valid, true);
  assert.equal(cap.name, "pat_research_companion");
  assert.equal(cap.consent_scope_template, PAT_RESEARCH_COMPANION_CONSENT_PHRASE_TEMPLATE);
});

test("PAT-2 EffectCap blocks corpus-modification and external caching", () => {
  const cap = buildPATResearchCompanionEffectCap();
  assert.ok(cap.blocked_effects.includes("modify_corpus_data"));
  assert.ok(cap.blocked_effects.includes("cache_outside_dema_home"));
  assert.ok(cap.blocked_effects.includes("fetch_without_consent"));
  assert.ok(cap.blocked_effects.includes("claim_unverified_finding_as_verified"));
});

test("PAT-2 kernel pre-configured correctly", () => {
  const k = buildPATResearchCompanionKernel({ mission_intent: "research test" });
  assert.equal(k.agent_id, "pat-2-research-companion");
  assert.equal(k.agent_role, "pat_research_companion");
  assert.equal(k.mission_intent, "research test");
});

test("draftResearchPlan emits canonical plan schema + valid=true with question + sources", () => {
  const plan = draftResearchPlan({
    research_question: "what changed in my receipts this week",
    sources_to_consult: ["~/.dema/receipts/", "corpus://2026-05"]
  });
  assert.equal(plan.schema, "bizra.dema.research_plan.v0.1");
  assert.equal(plan.valid, true);
  assert.equal(plan.refusal_reason, null);
  assert.equal(plan.drafted_by, "pat-2-research-companion");
});

test("draftResearchPlan categorizes sources by type", () => {
  const plan = draftResearchPlan({
    research_question: "test",
    sources_to_consult: [
      "https://example.com/doc",
      "~/.dema/memory/today.json",
      "corpus://archive",
      "random-thing"
    ]
  });
  const cats = plan.sources_to_consult.map((s) => s.category);
  assert.ok(cats.includes("url"));
  assert.ok(cats.includes("local_dema_file"));
  assert.ok(cats.includes("corpus_query"));
  assert.ok(cats.includes("unknown"));
});

test("draftResearchPlan emits per-URL consent phrases when URLs present", () => {
  const plan = draftResearchPlan({
    research_question: "test",
    sources_to_consult: ["https://a.example/x", "https://b.example/y"]
  });
  assert.equal(plan.requires_any_web_consent, true);
  assert.equal(plan.consent_phrases_per_url.length, 2);
  assert.ok(plan.consent_phrases_per_url[0].startsWith("GO: fetch "));
});

test("draftResearchPlan refuses empty question", () => {
  const plan = draftResearchPlan({ research_question: "" });
  assert.equal(plan.valid, false);
  assert.match(plan.refusal_reason, /empty_question/);
});

test("draftResearchPlan refuses empty sources", () => {
  const plan = draftResearchPlan({
    research_question: "test",
    sources_to_consult: []
  });
  assert.equal(plan.valid, false);
  assert.match(plan.refusal_reason, /no_sources/);
});

test("Adversarial · non-string question coerced to empty · refused", () => {
  const plan = draftResearchPlan({ research_question: { malicious: true } });
  assert.equal(plan.valid, false);
});

test("Adversarial · non-array sources defaults to empty · refused", () => {
  const plan = draftResearchPlan({ research_question: "x", sources_to_consult: "not-array" });
  assert.equal(plan.valid, false);
});

test("Adversarial · function/symbol entries in sources filtered", () => {
  const plan = draftResearchPlan({
    research_question: "test",
    sources_to_consult: ["valid", () => "evil", Symbol("x"), 42, "another"]
  });
  assert.equal(plan.sources_to_consult.length, 2);
});

test("Plan output is deep-frozen at all sub-views", () => {
  const plan = draftResearchPlan({
    research_question: "test",
    sources_to_consult: ["https://x"]
  });
  assert.ok(Object.isFrozen(plan));
  assert.ok(Object.isFrozen(plan.sources_to_consult));
  assert.ok(Object.isFrozen(plan.consent_phrases_per_url));
  assert.ok(Object.isFrozen(plan.boundary));
  assert.ok(isCanonicalBoundary(plan.boundary));
});

test("Summary preserves load-bearing fields + canonical boundary", () => {
  const s = buildPATResearchCompanionSummary();
  assert.equal(s.schema, "bizra.dema.pat_research_companion_summary.v0.1");
  assert.equal(s.pat_number, 2);
  assert.equal(s.role_name, "research_companion");
  assert.ok(isCanonicalBoundary(s.boundary));
});

test("Exports + persona constants frozen", () => {
  assert.equal(typeof PAT_RESEARCH_COMPANION_SCHEMA_NAME, "string");
  assert.equal(typeof PAT_RESEARCH_COMPANION_PLAN_SCHEMA_NAME, "string");
  assert.ok(Object.isFrozen(PAT_RESEARCH_COMPANION_PERSONA));
  assert.equal(PAT_RESEARCH_COMPANION_PERSONA.pat_number, 2);
});
