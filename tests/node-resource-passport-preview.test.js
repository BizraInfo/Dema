import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  buildNodeResourcePassportPreview,
  NODE_RESOURCE_PASSPORT_PREVIEW_SCHEMA,
} from "../packages/core/src/node-resource-passport-preview.js";
import { PREVIEW_BOUNDARY_CANONICAL_KEYS } from "../packages/core/src/preview-boundary.js";

const MODULE_PATH = fileURLToPath(
  new URL("../packages/core/src/node-resource-passport-preview.js", import.meta.url),
);

const nodeRegistryPreview = Object.freeze({
  registry_state: Object.freeze({
    accepted: Object.freeze([
      Object.freeze({
        node_ordinal: 0,
        node_label: "Node0",
        status: "accepted_primary",
      }),
    ]),
    primary_node_count: 1,
  }),
});

const urpLocalPreview = Object.freeze({
  hardware: Object.freeze({
    cpu_cores: 8,
    disk_free_gb: 512,
    data_present: true,
  }),
  knowledge_base: Object.freeze({
    memory_entries_count: 42,
    adr_count: 19,
    canon_docs_count: 7,
    data_present: true,
  }),
});

const proofPassportSummary = Object.freeze({
  aggregate: Object.freeze({
    verdict: "ALL_VERIFIED",
    total_receipts: 3,
    verified_count: 3,
    failed_count: 0,
  }),
});

const sharedUrpWorldPreview = Object.freeze({
  status: "locked_preview_only",
  node_count: 4,
});

function buildSubject(overrides = {}) {
  return buildNodeResourcePassportPreview({
    nodeRegistryPreview,
    urpLocalPreview,
    proofPassportSummary,
    sharedUrpWorldPreview,
    ...overrides,
  });
}

function assertDeepFrozen(value, label = "value") {
  assert.equal(Object.isFrozen(value), true, `${label} must be frozen`);
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === "object") {
      assertDeepFrozen(child, `${label}.${key}`);
    }
  }
}

function assertAllFalseBoundary(boundary) {
  for (const key of PREVIEW_BOUNDARY_CANONICAL_KEYS) {
    assert.equal(boundary[key], false, `boundary.${key} must be false`);
  }
  for (const key of [
    "secret_read",
    "file_write_performed",
    "token_minted",
    "reward_emitted",
    "poi_score_calculated",
    "federation_used",
    "runtime_pat_sat_activated",
    "urp_offer_emitted",
  ]) {
    assert.equal(boundary[key], false, `boundary.${key} must be false`);
  }
}

test("node resource passport preview emits exact schema, truth label, and frozen output", () => {
  const passport = buildSubject();

  assert.equal(
    passport.schema,
    "bizra.dema.node_resource_passport_preview.v0.1",
  );
  assert.equal(passport.schema, NODE_RESOURCE_PASSPORT_PREVIEW_SCHEMA);
  assert.equal(passport.truth_label, "NODE_RESOURCE_PASSPORT_PREVIEW_ONLY");
  assert.equal(passport.mode, "preview_only");
  assert.equal(passport.valid, true);
  assertDeepFrozen(passport, "passport");
});

test("node identity is ordinal-only and agent counts stay PAT-7/SAT-5 preview", () => {
  const passport = buildSubject();

  assert.deepEqual(passport.node_identity, {
    node_role: "NODE0_SEED",
    node_ordinal: 0,
    identity_disclosure: "ORDINAL_ONLY",
  });
  assert.equal(passport.agent_capacity.local_pat_count, 7);
  assert.equal(passport.agent_capacity.system_sat_count, 5);
  assert.equal(passport.agent_capacity.runtime_status, "DESIGNED_NOT_LIVE");
  assert.equal(JSON.stringify(passport).includes("candidate_name"), false);
});

test("proof status is passthrough from the proof passport summary, not recomputed", () => {
  const passport = buildSubject();

  assert.deepEqual(passport.proof_status, {
    source: "proof_passport_summary",
    verdict: "ALL_VERIFIED",
    receipt_count: 3,
    verified_count: 3,
    failed_count: 0,
  });
});

test("capacity classes are coarse bands only and do not leak exact hardware metrics", () => {
  const passport = buildSubject();
  const encoded = JSON.stringify(passport);

  assert.deepEqual(passport.capacity_classes, {
    compute: "medium",
    storage: "medium",
    models: "unknown",
    knowledge_corpus: "small",
  });
  assert.equal(encoded.includes("cpu_cores"), false);
  assert.equal(encoded.includes("disk_free_gb"), false);
  assert.equal(encoded.includes("512"), false);
});

test("contribution candidacy is declarative-only with no offer or consent", () => {
  const passport = buildSubject();

  assert.deepEqual(passport.contribution_candidacy.candidate_types, [
    "compute",
    "storage",
    "knowledge",
    "action",
    "verification",
    "community",
  ]);
  assert.equal(passport.contribution_candidacy.offer_emitted, false);
  assert.equal(passport.contribution_candidacy.consent_requested, false);
});

test("reward, PoI, token, URP, and federation stay designed-not-live with blockers", () => {
  const passport = buildSubject();

  assert.equal(
    passport.reward_candidate_lens.reward_candidate_eligible,
    false,
  );
  assert.equal(
    passport.reward_candidate_lens.reward_runtime_status,
    "DESIGNED_NOT_LIVE",
  );
  assert.equal(
    passport.reward_candidate_lens.poi_runtime_status,
    "DESIGNED_NOT_LIVE",
  );
  assert.equal(
    passport.reward_candidate_lens.token_mint_status,
    "DESIGNED_NOT_LIVE",
  );
  assert.deepEqual(passport.reward_candidate_lens.blocked_by, [
    "no SAT verification runtime",
    "no PoI settlement runtime",
    "no economic rail settlement",
    "no token mint runtime",
  ]);
  assert.equal(passport.urp.submission_status, "DESIGNED_NOT_LIVE");
  assert.equal(passport.urp.federation_status, "DESIGNED_NOT_LIVE");
});

test("boundary flags are all false including domain-specific forest risks", () => {
  const passport = buildSubject();

  assertAllFalseBoundary(passport.boundary);
});

test("what_this_does_not_prove blocks token, federation, and economic overclaim", () => {
  const passport = buildSubject();
  const nonProof = passport.what_this_does_not_prove.join(" ");

  assert.match(nonProof, /URP submission is live/i);
  assert.match(nonProof, /Federation is active/i);
  assert.match(nonProof, /reward has been earned/i);
  assert.match(nonProof, /PoI settlement exists/i);
  assert.match(nonProof, /token can be minted/i);
  assert.match(nonProof, /Economic value has been created/i);
});

test("malformed input surfaces fail closed with explicit blocker and no effects", () => {
  const passport = buildSubject({ proofPassportSummary: "bad-input" });

  assert.equal(passport.valid, false);
  assert.equal(passport.status, "REFUSED_PREVIEW_INPUT_INVALID");
  assert.deepEqual(passport.blocked_by, ["invalid_proof_passport_summary"]);
  assertAllFalseBoundary(passport.boundary);
});

test("node resource passport preview module imports no fs, net, child process, os, or http APIs", () => {
  const source = readFileSync(MODULE_PATH, "utf8");

  assert.doesNotMatch(source, /node:(fs|fs\/promises|net|http|https|child_process|os)\b/);
  assert.doesNotMatch(source, /from\s+["']node:(fs|fs\/promises|net|http|https|child_process|os)["']/);
});
