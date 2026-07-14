import test from "node:test";
import assert from "node:assert/strict";

import {
  planNode0RoleModelBindingRegistry,
  buildNode0RoleModelBindingRegistryPayload,
  verifyNode0RoleModelBindingRegistry,
  runNode0RoleModelBindingRegistry,
  resolveRoleModelBinding,
  validateCapabilityRecord,
  NODE0_ROLE_MODEL_BINDING_REGISTRY_SCHEMA,
  NODE0_ROLE_MODEL_BINDING_REGISTRY_TRUTH_LABEL,
  NODE0_ROLE_MODEL_BINDING_REGISTRY_GO_PHRASE,
  CAPABILITY_RECORD_SCHEMA,
} from "../packages/core/src/node0-role-model-binding-registry.js";
import { sha256CanonicalJsonV1 } from "../packages/canon/src/sha256-canonical-json-v1.js";
import { runNode0RoleModelBindingRegistryCheck } from "../scripts/review/node0-role-model-binding-registry-check.mjs";

// Fixtures. Role contracts follow agent-role-contract.js exactly. The SAT
// record's evidence sha256/value are the REAL measured judge-C0 artifact
// (/data/bizra/agents/judge-c1/eval-report.deepseek-r1_7b.json, 29.73%
// heldout agreement) — the registry carries evidence; it does not grade it.
const SAT_CONTRACT = Object.freeze({
  schema: "bizra.node0.agent_role_contract.v0.1",
  role_id: "sat-boundary-judge",
  team: "SAT",
  serves: "system",
  base_class: Object.freeze({ family: "deepseek", size_class: "3-4B" }),
  adapter_ref: null,
  spawn_limit: 5,
  authority: Object.freeze({
    mint_allowed: false,
    egress_allowed: false,
    corpus_write_allowed: false,
    spawn_widens_authority: false,
  }),
  truth_label: "DESIGNED_NOT_LIVE",
});

const PAT_CONTRACT = Object.freeze({
  ...SAT_CONTRACT,
  role_id: "pat-code-apprentice",
  team: "PAT",
  serves: "user",
  base_class: Object.freeze({ family: "gemma", size_class: "3-4B" }),
  spawn_limit: 7,
});

const record = (over = {}) => ({
  schema: CAPABILITY_RECORD_SCHEMA,
  record_id: "fixture-deepseek-judge",
  role_id: "sat-boundary-judge",
  lane: "short_sat_judgment",
  model_id: "deepseek-r1:7b",
  backend_id: "ollama-0.20.5",
  family: "deepseek",
  evidence: {
    source_path: "/data/bizra/agents/judge-c1/eval-report.deepseek-r1_7b.json",
    sha256: "9c1a4125b687a854e1f3c4b78fe0face6d5f9b8f2924cc87e721f6a616f00e2b",
    measured_at_iso: "2026-07-14T08:07:00Z",
    metric: "heldout_agreement_pct",
    value: 29.73,
  },
  limitations: ["lane_1_only", "74_item_heldout"],
  resource_envelope: { vram_gb_est: 4.7, ram_gb_est: 2 },
  privacy_class: "LOCAL_ONLY",
  consent_ref: NODE0_ROLE_MODEL_BINDING_REGISTRY_GO_PHRASE,
  verification_state: "MEASURED_LOCAL",
  superseded_by: null,
  contradicted_by: [],
  ...over,
});

const input = (over = {}) => ({
  mode: "SHADOW",
  as_of_iso: "2026-07-15T00:00:00Z",
  max_age_days: 30,
  role_contract: SAT_CONTRACT,
  lane: "short_sat_judgment",
  records: [record()],
  budget: { vram_gb_max: 14, ram_gb_max: 96 },
  pat_bound_families: ["gemma"],
  ...over,
});

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planNode0RoleModelBindingRegistry({ consent: "wrong", input: input() });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and well-formed input", () => {
  const plan = planNode0RoleModelBindingRegistry({ consent: NODE0_ROLE_MODEL_BINDING_REGISTRY_GO_PHRASE, input: input() });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildNode0RoleModelBindingRegistryPayload(input());
  assert.equal(payload.schema, NODE0_ROLE_MODEL_BINDING_REGISTRY_SCHEMA);
  assert.equal(payload.truth_label, NODE0_ROLE_MODEL_BINDING_REGISTRY_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.boundary.execution_allowed, false);
  assert.equal(payload.boundary.live_execution_performed, false);
});

test("verify accepts a freshly built payload", () => {
  const payload = buildNode0RoleModelBindingRegistryPayload(input());
  assert.equal(verifyNode0RoleModelBindingRegistry(payload).ok, true);
});

test("verify rejects a tampered content_hash", () => {
  const payload = buildNode0RoleModelBindingRegistryPayload(input());
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  assert.equal(verifyNode0RoleModelBindingRegistry(tampered).ok, false);
});

test("verify rejects a field change that did not update the content_hash", () => {
  const payload = buildNode0RoleModelBindingRegistryPayload(input());
  const forged = { ...payload, truth_label: "FORGED" };
  assert.equal(verifyNode0RoleModelBindingRegistry(forged).ok, false);
});

test("verify rejects a forged decision even when the content_hash is recomputed (independent anchor)", () => {
  const payload = buildNode0RoleModelBindingRegistryPayload(input({ budget: { vram_gb_max: 2, ram_gb_max: 96 } }));
  assert.equal(payload.decision.status, "REJECTED");
  const { content_hash, ...body } = payload;
  const launderedBody = {
    ...body,
    decision: { ...payload.decision, status: "BOUND_SHADOW", reasons: [], chosen_record_id: "fixture-deepseek-judge" },
  };
  const laundered = { ...launderedBody, content_hash: sha256CanonicalJsonV1(launderedBody) };
  const verdict = verifyNode0RoleModelBindingRegistry(laundered);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.blocked_by.includes("decision_not_rederivable"));
});

test("review gate closes the loop: build -> verify -> tamper-reject", () => {
  const result = runNode0RoleModelBindingRegistryCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, NODE0_ROLE_MODEL_BINDING_REGISTRY_SCHEMA);
  assert.equal(result.truth_label, NODE0_ROLE_MODEL_BINDING_REGISTRY_TRUTH_LABEL);
});

test("orchestrator boundary stays all-false (no execution authority)", () => {
  const result = runNode0RoleModelBindingRegistry({ consent: NODE0_ROLE_MODEL_BINDING_REGISTRY_GO_PHRASE, input: input() });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
  assert.equal(result.boundary.live_execution_performed, false);
});

// --- binding resolution: positive ---

test("valid shadow binding resolves deterministically to the evidence-bearing record", () => {
  const a = resolveRoleModelBinding(input());
  const b = resolveRoleModelBinding(input());
  assert.equal(a.status, "BOUND_SHADOW");
  assert.equal(a.chosen_record_id, "fixture-deepseek-judge");
  assert.equal(sha256CanonicalJsonV1(a), sha256CanonicalJsonV1(b));
});

test("CANDIDATE mode binds as BOUND_CANDIDATE, never as activation", () => {
  const d = resolveRoleModelBinding(input({ mode: "CANDIDATE" }));
  assert.equal(d.status, "BOUND_CANDIDATE");
});

// --- binding resolution: fail-closed negatives ---

test("activation-style mode is rejected (no mode outside SHADOW/CANDIDATE)", () => {
  const d = resolveRoleModelBinding(input({ mode: "ACTIVE" }));
  assert.equal(d.status, "REJECTED");
  assert.ok(d.reasons.includes("mode_not_shadow_or_candidate"));
});

test("unknown input keys fail closed (no smuggled authority fields)", () => {
  const d = resolveRoleModelBinding(input({ requested_authority: { mint_allowed: true } }));
  assert.equal(d.status, "REJECTED");
  assert.ok(d.reasons.includes("input_unknown_key:requested_authority"));
});

test("invalid role contract is rejected (authority flag true)", () => {
  const bad = { ...SAT_CONTRACT, authority: { ...SAT_CONTRACT.authority, mint_allowed: true } };
  const d = resolveRoleModelBinding(input({ role_contract: bad }));
  assert.equal(d.status, "REJECTED");
  assert.ok(d.reasons.includes("role_contract_invalid"));
});

test("unknown lane is rejected", () => {
  const d = resolveRoleModelBinding(input({ lane: "world_domination" }));
  assert.equal(d.status, "REJECTED");
  assert.ok(d.reasons.includes("lane_unknown"));
});

test("PAT role binding to the SAT judgment lane is rejected (PAT cannot take SAT authority)", () => {
  const d = resolveRoleModelBinding(input({ role_contract: PAT_CONTRACT, records: [record({ role_id: "pat-code-apprentice", family: "gemma" })] }));
  assert.equal(d.status, "REJECTED");
  assert.ok(d.reasons.includes("pat_lane_forbidden_sat_authority"));
});

test("SAT role binding to a mission-operating lane is rejected (SAT judges, never operates)", () => {
  const d = resolveRoleModelBinding(input({ lane: "code_and_reproduction", records: [record({ lane: "code_and_reproduction" })] }));
  assert.equal(d.status, "REJECTED");
  assert.ok(d.reasons.includes("sat_lane_forbidden_mission_operation"));
});

test("stale evidence is rejected", () => {
  const d = resolveRoleModelBinding(input({ as_of_iso: "2026-09-15T00:00:00Z" }));
  assert.equal(d.status, "REJECTED");
  assert.ok(d.reasons.includes("no_eligible_capability_record"));
  assert.ok(d.evaluated[0].reasons.includes("evidence_stale"));
});

test("evidence dated in the future of as_of is rejected", () => {
  const d = resolveRoleModelBinding(input({ as_of_iso: "2026-07-14T00:00:00Z" }));
  assert.ok(d.evaluated[0].reasons.includes("evidence_from_future"));
  assert.equal(d.status, "REJECTED");
});

test("malformed evidence hash is rejected", () => {
  const d = resolveRoleModelBinding(input({ records: [record({ evidence: { ...record().evidence, sha256: "not-a-hash" } })] }));
  assert.equal(d.status, "REJECTED");
  assert.ok(d.evaluated[0].reasons.includes("evidence_sha256_invalid"));
});

test("superseded record is rejected", () => {
  const d = resolveRoleModelBinding(input({ records: [record({ superseded_by: "fixture-newer" })] }));
  assert.equal(d.status, "REJECTED");
  assert.ok(d.evaluated[0].reasons.includes("record_superseded"));
});

test("contradicted record is rejected", () => {
  const d = resolveRoleModelBinding(input({ records: [record({ contradicted_by: ["fixture-counter-evidence"] })] }));
  assert.equal(d.status, "REJECTED");
  assert.ok(d.evaluated[0].reasons.includes("record_contradicted"));
});

test("binding beyond the resource budget is rejected", () => {
  const d = resolveRoleModelBinding(input({ budget: { vram_gb_max: 2, ram_gb_max: 96 } }));
  assert.equal(d.status, "REJECTED");
  assert.ok(d.evaluated[0].reasons.includes("budget_exceeded"));
});

test("missing privacy class fails record validation", () => {
  const r = record();
  delete r.privacy_class;
  assert.equal(validateCapabilityRecord(r).ok, false);
  assert.ok(validateCapabilityRecord(r).blocked_by.includes("privacy_class_missing"));
});

test("non-local privacy class is rejected", () => {
  const d = resolveRoleModelBinding(input({ records: [record({ privacy_class: "PUBLIC" })] }));
  assert.equal(d.status, "REJECTED");
  assert.ok(d.evaluated[0].reasons.includes("privacy_class_not_local_only"));
});

test("missing consent ref is rejected", () => {
  const d = resolveRoleModelBinding(input({ records: [record({ consent_ref: "" })] }));
  assert.equal(d.status, "REJECTED");
  assert.ok(d.evaluated[0].reasons.includes("consent_ref_missing"));
});

test("SAT family shared with a PAT-bound family is rejected (classifier independence)", () => {
  const d = resolveRoleModelBinding(input({ pat_bound_families: ["deepseek"] }));
  assert.equal(d.status, "REJECTED");
  assert.ok(d.evaluated[0].reasons.includes("sat_family_shared_with_pat"));
});

test("SAT binding without the PAT family set ABSTAINs (independence unverifiable, never a fabricated pass)", () => {
  const i = input();
  delete i.pat_bound_families;
  const d = resolveRoleModelBinding(i);
  assert.equal(d.status, "ABSTAIN");
  assert.ok(d.reasons.includes("independence_unverifiable"));
});

test("measured family contradicting the designed family surfaces as REQUIRES_HUMAN, never silently bound", () => {
  // The real fork: qwen3:4b measured 58.11% (best family-eligible judge) but the
  // C0 contract designs SAT=deepseek. Code must not resolve this; the operator must.
  const qwen = record({
    record_id: "fixture-qwen-judge",
    model_id: "qwen3:4b",
    family: "qwen",
    evidence: {
      source_path: "/data/bizra/agents/judge-c1/eval-report.qwen3_4b.json",
      sha256: "3f134418d8804f20aa2bf5a613b845899864b9a8e9a5a582d748dddb6a49d2e3",
      measured_at_iso: "2026-07-14T08:07:00Z",
      metric: "heldout_agreement_pct",
      value: 58.11,
    },
  });
  const d = resolveRoleModelBinding(input({ records: [qwen] }));
  assert.equal(d.status, "REQUIRES_HUMAN");
  assert.ok(d.reasons.includes("spec_reopen_required"));
  assert.equal(d.chosen_record_id, null);
});

test("two eligible records are ambiguous and fail closed (ranking is a later measured slice)", () => {
  const d = resolveRoleModelBinding(input({ records: [record(), record({ record_id: "fixture-deepseek-judge-2" })] }));
  assert.equal(d.status, "REJECTED");
  assert.ok(d.reasons.includes("ambiguous_multiple_eligible_records"));
});

test("non-SAT lane with only DESIGN_ONLY evidence refuses to bind (unmeasured lanes fail closed)", () => {
  // Lane-4 fixture: proves the registry refuses to bind where no measurement
  // exists — the honest state of every lane except short_sat_judgment today.
  const d = resolveRoleModelBinding(input({
    role_contract: PAT_CONTRACT,
    lane: "code_and_reproduction",
    records: [record({ role_id: "pat-code-apprentice", lane: "code_and_reproduction", family: "gemma", verification_state: "DESIGN_ONLY" })],
  }));
  assert.equal(d.status, "REJECTED");
  assert.ok(d.evaluated[0].reasons.includes("verification_state_ineligible"));
});

test("empty record set is rejected, not abstained (missing evidence is a rejection)", () => {
  const d = resolveRoleModelBinding(input({ records: [] }));
  assert.equal(d.status, "REJECTED");
  assert.ok(d.reasons.includes("no_eligible_capability_record"));
});
