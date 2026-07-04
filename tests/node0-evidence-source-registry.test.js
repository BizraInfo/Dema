import test from "node:test";
import assert from "node:assert/strict";

import {
  planNode0EvidenceSourceRegistry,
  buildNode0EvidenceSourceRegistryPayload,
  verifyNode0EvidenceSourceRegistry,
  runNode0EvidenceSourceRegistry,
  defaultNode0EvidenceSourceRegistryInput,
  NODE0_EVIDENCE_SOURCE_REGISTRY_SCHEMA,
  NODE0_EVIDENCE_SOURCE_REGISTRY_TRUTH_LABEL,
  NODE0_EVIDENCE_SOURCE_REGISTRY_GO_PHRASE,
  NODE0_EVIDENCE_SOURCE_TYPES,
} from "../packages/core/src/node0-evidence-source-registry.js";
import { runNode0EvidenceSourceRegistryCheck } from "../scripts/review/node0-evidence-source-registry-check.mjs";

function fixture(overrides = {}) {
  return {
    ...defaultNode0EvidenceSourceRegistryInput(),
    ...overrides,
  };
}

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planNode0EvidenceSourceRegistry({
    consent: "GO",
    input: fixture(),
  });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and canonical source families", () => {
  const plan = planNode0EvidenceSourceRegistry({
    consent: NODE0_EVIDENCE_SOURCE_REGISTRY_GO_PHRASE,
    input: fixture(),
  });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
  assert.deepEqual(
    [...plan.source_types_seen].sort(),
    [...NODE0_EVIDENCE_SOURCE_TYPES].sort(),
  );
});

test("plan rejects duplicate source IDs and any mint-allowed source", () => {
  const input = fixture({
    sources: [
      ...defaultNode0EvidenceSourceRegistryInput().sources,
      {
        ...defaultNode0EvidenceSourceRegistryInput().sources[0],
        mint_allowed: true,
      },
    ],
  });
  const plan = planNode0EvidenceSourceRegistry({
    consent: NODE0_EVIDENCE_SOURCE_REGISTRY_GO_PHRASE,
    input,
  });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("duplicate_source_id:local_node0_assets"));
  assert.ok(plan.blocked_by.includes("mint_allowed_not_false:local_node0_assets"));
});

test("payload is content-addressed, normalized, and carries an all-false boundary", () => {
  const payload = buildNode0EvidenceSourceRegistryPayload(fixture());
  assert.equal(payload.schema, NODE0_EVIDENCE_SOURCE_REGISTRY_SCHEMA);
  assert.equal(payload.truth_label, NODE0_EVIDENCE_SOURCE_REGISTRY_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.source_count, 8);
  assert.equal(payload.mint_allowed_count, 0);
  assert.deepEqual(
    payload.sources.map((source) => source.source_id),
    [...payload.sources].map((source) => source.source_id).sort(),
  );
  assert.ok(payload.sources.some((source) => source.source_id === "bizra_ai_public_domain"));
  assert.equal(payload.boundary.execution_allowed, false);
  assert.equal(payload.boundary.live_execution_performed, false);
  assert.equal(payload.policy.no_content_read, true);
  assert.equal(payload.policy.no_live_mint, true);
});

test("verify accepts a freshly built payload", () => {
  const payload = buildNode0EvidenceSourceRegistryPayload(fixture());
  const verified = verifyNode0EvidenceSourceRegistry(payload);
  assert.equal(verified.ok, true, verified.blocked_by.join(", "));
  assert.equal(verified.content_hash, payload.content_hash);
});

test("verify rejects a tampered content_hash", () => {
  const payload = buildNode0EvidenceSourceRegistryPayload(fixture());
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  const verified = verifyNode0EvidenceSourceRegistry(tampered);
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("content_hash_mismatch"));
});

test("verify rejects field changes that did not update the content_hash", () => {
  const payload = buildNode0EvidenceSourceRegistryPayload(fixture());
  const forged = {
    ...payload,
    sources: payload.sources.map((source) =>
      source.source_id === "economy_simulator"
        ? { ...source, impact_candidate: true }
        : source,
    ),
  };
  const verified = verifyNode0EvidenceSourceRegistry(forged);
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("content_hash_mismatch"));
});

test("verify rejects a self-consistent simulation source promoted as impact candidate", () => {
  const input = fixture({
    sources: defaultNode0EvidenceSourceRegistryInput().sources.map((source) =>
      source.source_id === "economy_simulator"
        ? { ...source, impact_candidate: true }
        : source,
    ),
  });
  const payload = buildNode0EvidenceSourceRegistryPayload(input);
  const verified = verifyNode0EvidenceSourceRegistry(payload);
  assert.equal(verified.ok, false);
  assert.ok(
    verified.blocked_by.includes(
      "simulation_source_cannot_enter_impact_queue:economy_simulator",
    ),
  );
});

test("review gate closes the loop: plan -> build -> verify -> tamper-reject", () => {
  const result = runNode0EvidenceSourceRegistryCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, NODE0_EVIDENCE_SOURCE_REGISTRY_SCHEMA);
  assert.equal(result.truth_label, NODE0_EVIDENCE_SOURCE_REGISTRY_TRUTH_LABEL);
  assert.equal(result.source_count, 8);
  assert.equal(result.tamper_reject_ok, true);
  assert.equal(result.boundary.token_minted, false);
});

test("orchestrator boundary stays all-false and emits no ingest or mint claim", () => {
  const result = runNode0EvidenceSourceRegistry({
    consent: NODE0_EVIDENCE_SOURCE_REGISTRY_GO_PHRASE,
    input: fixture(),
  });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
  assert.equal(result.boundary.network_used, false);
  assert.equal(result.boundary.token_minted, false);
  assert.equal(result.policy.no_drive_download, true);
  assert.equal(result.policy.no_github_write, true);
  assert.equal(result.policy.no_live_mint, true);
});
