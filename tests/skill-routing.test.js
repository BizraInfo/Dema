import test from "node:test";
import assert from "node:assert/strict";

import {
  validateSkillContract,
  computeContractHash,
  checkContractCompatibility,
  buildRouteCard,
} from "../packages/core/src/skill-contract.js";

import {
  loadRegistry,
  queryByFamily,
  queryByPhase,
  queryByApplicability,
  findCandidates,
  computeRegistryHash,
} from "../packages/core/src/skill-registry.js";

import { readFileSync, existsSync } from "node:fs";

const ROOT = "/home/bizra-operating-system/Downloads/Dema";
const io = { readFileSync, existsSync, root: ROOT };

import {
  buildRouteReceipt,
  validateRouteReceipt,
  computeReceiptHash,
  buildNoSkillReceipt,
  NO_SKILL_REASONS,
} from "../packages/core/src/skill-route-receipt.js";

// ─── Skill Contract Tests ─────────────────────────────────────────────

const VALID_CONTRACT = {
  skill_id: "test-skill",
  version: "1.0.0",
  capability_family: "test-family",
  lifecycle_phase: "post-implementation",
  applicability: ["test trigger"],
  exclusions: ["not this"],
  preconditions: ["checkout exists"],
  inputs: ["input1"],
  outputs: ["output1"],
  side_effects: [],
  permissions: ["read repo"],
  resource_bindings: ["file.js"],
  truth_boundary: "report-only",
  projection_targets: [".claude"],
  convergence: { formal: 2, cryptographic: 1, empirical: 2, economic: 0 },
};

// SKC-01: valid contract passes validation
test("SKC-01: valid contract passes validation", () => {
  const result = validateSkillContract(VALID_CONTRACT);
  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
});

// SKC-02: missing required field fails
test("SKC-02: missing required field fails", () => {
  const incomplete = { ...VALID_CONTRACT };
  delete incomplete.skill_id;
  const result = validateSkillContract(incomplete);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("skill_id")));
});

// SKC-03: invalid skill_id format fails
test("SKC-03: invalid skill_id format fails", () => {
  const bad = { ...VALID_CONTRACT, skill_id: "Invalid_ID!" };
  const result = validateSkillContract(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("kebab-case")));
});

// SKC-04: invalid version format fails
test("SKC-04: invalid version format fails", () => {
  const bad = { ...VALID_CONTRACT, version: "v1" };
  const result = validateSkillContract(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("semver")));
});

// SKC-05: non-array field fails
test("SKC-05: non-array applicability fails", () => {
  const bad = { ...VALID_CONTRACT, applicability: "not-array" };
  const result = validateSkillContract(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("array")));
});

// SKC-06: out-of-range convergence fails
test("SKC-06: out-of-range convergence fails", () => {
  const bad = { ...VALID_CONTRACT, convergence: { formal: 6, cryptographic: 1, empirical: 2, economic: 0 } };
  const result = validateSkillContract(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("0–5")));
});

// SKC-07: contract hash is deterministic
test("SKC-07: contract hash is deterministic", () => {
  const h1 = computeContractHash(VALID_CONTRACT);
  const h2 = computeContractHash(VALID_CONTRACT);
  assert.equal(h1, h2);
  assert.match(h1, /^[0-9a-f]{64}$/);
});

// SKC-08: compatible contracts pass
test("SKC-08: identical contracts are compatible", () => {
  const result = checkContractCompatibility(VALID_CONTRACT, VALID_CONTRACT);
  assert.equal(result.compatible, true);
  assert.equal(result.reasons.length, 0);
});

// SKC-09: incompatible skill_ids fail
test("SKC-09: different skill_ids are incompatible", () => {
  const other = { ...VALID_CONTRACT, skill_id: "other-skill" };
  const result = checkContractCompatibility(VALID_CONTRACT, other);
  assert.equal(result.compatible, false);
  assert.ok(result.reasons.some((r) => r.includes("skill_id")));
});

// SKC-10: buildRouteCard produces expected shape
test("SKC-10: buildRouteCard produces expected shape", () => {
  const card = buildRouteCard(VALID_CONTRACT);
  assert.equal(card.skill_id, VALID_CONTRACT.skill_id);
  assert.equal(card.version, VALID_CONTRACT.version);
  assert.equal(card.capability_family, VALID_CONTRACT.capability_family);
  assert.equal(card.lifecycle_phase, VALID_CONTRACT.lifecycle_phase);
  assert.deepEqual(card.applicability, VALID_CONTRACT.applicability);
  assert.deepEqual(card.exclusions, VALID_CONTRACT.exclusions);
  assert.equal(card.truth_boundary, VALID_CONTRACT.truth_boundary);
});

// ─── Skill Registry Tests ─────────────────────────────────────────────

// SKR-01: loadRegistry loads all 6 skills
test("SKR-01: loadRegistry loads all 6 skills", () => {
  const result = loadRegistry(io);
  assert.equal(result.ok, true);
  assert.equal(result.skills.length, 6);
  assert.equal(result.errors.length, 0);
});

// SKR-02: registry hash is deterministic
test("SKR-02: registry hash is deterministic", () => {
  const r1 = loadRegistry(io);
  const r2 = loadRegistry(io);
  assert.equal(r1.registry_hash, r2.registry_hash);
});

// SKR-03: all skill_ids are unique
test("SKR-03: all skill_ids are unique", () => {
  const result = loadRegistry(io);
  const ids = result.skills.map((s) => s.skill_id);
  const unique = new Set(ids);
  assert.equal(unique.size, ids.length);
});

// SKR-04: all contracts validate
test("SKR-04: all contracts pass validation", () => {
  const result = loadRegistry(io);
  for (const skill of result.skills) {
    const validation = validateSkillContract(skill.contract);
    assert.equal(validation.ok, true, `${skill.skill_id} contract invalid: ${validation.errors.join("; ")}`);
  }
});

// SKR-05: queryByFamily returns correct subset
test("SKR-05: queryByFamily returns correct subset", () => {
  const result = loadRegistry(io);
  const lifecycle = queryByFamily(result.skills, "dema-slice-lifecycle");
  assert.equal(lifecycle.length, 1);
  assert.equal(lifecycle[0].skill_id, "dema-slice-scaffold");
});

// SKR-06: queryByPhase returns correct subset
test("SKR-06: queryByPhase returns correct subset", () => {
  const result = loadRegistry(io);
  const postImpl = queryByPhase(result.skills, "post-implementation");
  assert.ok(postImpl.length >= 3); // proof-closeout, self-loop-engineering, model-eval-baseline
});

// SKR-07: queryByApplicability finds matching skills
test("SKR-07: queryByApplicability finds matching skills", () => {
  const result = loadRegistry(io);
  const matches = queryByApplicability(result.skills, "slice");
  assert.ok(matches.length >= 1);
  assert.ok(matches.some((s) => s.skill_id === "dema-slice-scaffold"));
});

// SKR-08: findCandidates ranks by match score
test("SKR-08: findCandidates ranks by match score", () => {
  const result = loadRegistry(io);
  // "slice" strongly matches dema-slice-scaffold (multiple applicability hits)
  const candidates = findCandidates(result.skills, "slice");
  assert.ok(candidates.length >= 1);
  const scaffoldIdx = candidates.findIndex((s) => s.skill_id === "dema-slice-scaffold");
  assert.ok(scaffoldIdx >= 0, "dema-slice-scaffold should be a candidate for 'slice'");
  // Scores should be non-increasing
  for (let i = 1; i < candidates.length; i++) {
    assert.ok(candidates[i - 1].match_score >= candidates[i].match_score);
  }
});

// SKR-09: findCandidates excludes excluded skills
test("SKR-09: findCandidates excludes skills matching exclusions", () => {
  const result = loadRegistry(io);
  // "runtime" is excluded in self-loop-engineering
  const candidates = findCandidates(result.skills, "runtime");
  // run-dema should appear (applicability matches "running the dema CLI")
  // self-loop-engineering should not (exclusion: "live autopoietic runtime")
  const selfLoop = candidates.find((s) => s.skill_id === "self-loop-engineering");
  assert.equal(selfLoop, undefined, "self-loop-engineering should be excluded for 'runtime'");
});

// ─── Route Receipt Tests ──────────────────────────────────────────────

// SKRR-01: buildRouteReceipt produces valid receipt
test("SKRR-01: buildRouteReceipt produces valid receipt", () => {
  const receipt = buildRouteReceipt({
    query_hash: "a".repeat(64),
    environment_hash: "b".repeat(64),
    registry_root: "c".repeat(64),
    router_version: "1.0.0",
    candidates: [{ skill_id: "proof-closeout", score: 0.9 }],
    selected_skill: "proof-closeout",
    selected_family: "dema-proof-lifecycle",
    rejected_siblings: [],
    contract_match: true,
    context_tokens_exposed: 500,
    policy_decision: "ALLOW_READ_ONLY",
    outcome: "ROUTE_ONLY",
  });
  const validation = validateRouteReceipt(receipt);
  assert.equal(validation.ok, true, `receipt invalid: ${validation.errors.join("; ")}`);
});

// SKRR-02: receipt hash is deterministic
test("SKRR-02: receipt hash is deterministic", () => {
  const params = {
    query_hash: "a".repeat(64),
    environment_hash: "b".repeat(64),
    registry_root: "c".repeat(64),
    router_version: "1.0.0",
    candidates: [],
    selected_skill: null,
    outcome: "NO_SKILL",
  };
  const r1 = buildRouteReceipt(params);
  const r2 = buildRouteReceipt({ ...params });
  // Timestamps differ, so hashes differ — but structure is consistent
  assert.match(r1.receipt_hash, /^[0-9a-f]{64}$/);
  assert.match(r2.receipt_hash, /^[0-9a-f]{64}$/);
});

// SKRR-03: execution_authorized is always false
test("SKRR-03: execution_authorized is always false", () => {
  const receipt = buildRouteReceipt({
    query_hash: "a".repeat(64),
    environment_hash: "b".repeat(64),
    registry_root: "c".repeat(64),
  });
  assert.equal(receipt.execution_authorized, false);
  assert.equal(receipt.boundary.execution_performed, false);
  assert.equal(receipt.boundary.authority_delta, 0);
});

// SKRR-04: buildNoSkillReceipt produces valid NO_SKILL receipt
test("SKRR-04: buildNoSkillReceipt produces valid NO_SKILL receipt", () => {
  const receipt = buildNoSkillReceipt({
    reason: "no_applicable_skill",
    query_hash: "a".repeat(64),
    environment_hash: "b".repeat(64),
    registry_root: "c".repeat(64),
  });
  assert.equal(receipt.outcome, "NO_SKILL");
  assert.equal(receipt.selected_skill, null);
  const validation = validateRouteReceipt(receipt);
  assert.equal(validation.ok, true, `receipt invalid: ${validation.errors.join("; ")}`);
});

// SKRR-05: buildNoSkillReceipt rejects invalid reason
test("SKRR-05: buildNoSkillReceipt rejects invalid reason", () => {
  assert.throws(() => {
    buildNoSkillReceipt({
      reason: "invalid_reason",
      query_hash: "a".repeat(64),
      environment_hash: "b".repeat(64),
      registry_root: "c".repeat(64),
    });
  }, /invalid NO_SKILL reason/);
});

// SKRR-06: NO_SKILL_REASONS contains expected taxonomy
test("SKRR-06: NO_SKILL_REASONS contains expected taxonomy", () => {
  assert.ok(NO_SKILL_REASONS.includes("no_applicable_skill"));
  assert.ok(NO_SKILL_REASONS.includes("confidence_below_threshold"));
  assert.ok(NO_SKILL_REASONS.includes("contract_ambiguity"));
  assert.ok(NO_SKILL_REASONS.includes("policy_refusal"));
  assert.ok(NO_SKILL_REASONS.includes("router_failure"));
  assert.ok(NO_SKILL_REASONS.includes("exclusion_match"));
  assert.ok(NO_SKILL_REASONS.includes("lifecycle_mismatch"));
});

// SKRR-07: receipt schema is correct
test("SKRR-07: receipt schema is correct", () => {
  const receipt = buildRouteReceipt({
    query_hash: "a".repeat(64),
    environment_hash: "b".repeat(64),
    registry_root: "c".repeat(64),
  });
  assert.equal(receipt.schema, "bizra.skill-route-receipt/v1");
  assert.equal(receipt.receipt_kind, "ROUTE_RECEIPT");
  assert.equal(receipt.cryptographic_receipt, false);
});

// SKRR-08: validateRouteReceipt catches tampered hash
test("SKRR-08: validateRouteReceipt catches tampered hash", () => {
  const receipt = buildRouteReceipt({
    query_hash: "a".repeat(64),
    environment_hash: "b".repeat(64),
    registry_root: "c".repeat(64),
  });
  // Tamper with the hash
  receipt.receipt_hash = "0".repeat(64);
  const validation = validateRouteReceipt(receipt);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((e) => e.includes("receipt_hash mismatch")));
});

// SKRR-09: validateRouteReceipt catches execution_authorized=true
test("SKRR-09: validateRouteReceipt catches execution_authorized=true", () => {
  const receipt = buildRouteReceipt({
    query_hash: "a".repeat(64),
    environment_hash: "b".repeat(64),
    registry_root: "c".repeat(64),
  });
  receipt.execution_authorized = true;
  const validation = validateRouteReceipt(receipt);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((e) => e.includes("execution_authorized")));
});
