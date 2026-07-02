import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  planNode0LocalClosureReadiness,
  buildNode0LocalClosureReadinessPayload,
  verifyNode0LocalClosureReadiness,
  runNode0LocalClosureReadiness,
  defaultNode0LocalClosureReadinessInput,
  NODE0_LOCAL_CLOSURE_READINESS_SCHEMA,
  NODE0_LOCAL_CLOSURE_READINESS_TRUTH_LABEL,
  NODE0_LOCAL_CLOSURE_READINESS_GO_PHRASE,
} from "../packages/core/src/node0-local-closure-readiness.js";
import {
  NODE0_SPACE_INDEX_SCHEMA,
  buildNode0HashConsentPhrase,
} from "../packages/core/src/node0-space-index.js";
import {
  buildNode0EvidenceSourceRegistryPayload,
  defaultNode0EvidenceSourceRegistryInput,
} from "../packages/core/src/node0-evidence-source-registry.js";
import { runNode0LocalClosureReadinessCheck } from "../scripts/review/node0-local-closure-readiness-check.mjs";

const ROOT_HASH = `sha256:${"a".repeat(64)}`;

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function contentHash(body) {
  return `sha256:${createHash("sha256").update(stableStringify(body), "utf8").digest("hex")}`;
}

function indexEnvelope(overrides = {}) {
  return {
    schema: NODE0_SPACE_INDEX_SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "metadata_only_index",
    root: {
      display: "/node0",
      normalized_path_hash: ROOT_HASH,
      hash_consent_phrase: buildNode0HashConsentPhrase(ROOT_HASH),
    },
    summary: {
      records_count: 9,
      files_count: 6,
      dirs_count: 2,
      symlinks_count: 1,
      denied_count: 1,
      duplicate_candidate_group_count: 2,
      total_indexed_bytes: 2048,
      truncated: false,
    },
    duplicate_candidate_groups: [
      {
        group_type: "size_collision_weak",
        confidence: "weak",
        content_confirmed: false,
        size_bytes: 128,
        members: ["a.md", "b.md"],
      },
      {
        group_type: "size_collision_weak",
        confidence: "weak",
        content_confirmed: false,
        size_bytes: 256,
        members: ["c.json", "d.json"],
      },
    ],
    consent: {
      content_hash_required: false,
      required_phrase: buildNode0HashConsentPhrase(ROOT_HASH),
      provided: false,
      accepted: false,
    },
    boundary: {
      scanned_root_mutated: false,
      file_content_read: false,
      content_hash_performed: false,
      network_used: false,
      delete_or_move_performed: false,
      token_minted: false,
      wallet_accessed: false,
      federation_invoked: false,
      urp_submission_performed: false,
      symlink_followed: false,
    },
    ...overrides,
  };
}

function fixture(overrides = {}) {
  return {
    registry: buildNode0EvidenceSourceRegistryPayload(
      defaultNode0EvidenceSourceRegistryInput(),
    ),
    index: indexEnvelope(),
    ...overrides,
  };
}

test("default fixture composes the measured source registry and metadata index", () => {
  const input = defaultNode0LocalClosureReadinessInput();
  assert.equal(input.registry.source_count, 8);
  assert.equal(input.registry.mint_allowed_count, 0);
  assert.equal(input.index.schema, NODE0_SPACE_INDEX_SCHEMA);
  assert.equal(input.index.mode, "metadata_only_index");
});

test("plan is fail-closed without exact consent or required inputs", () => {
  const plan = planNode0LocalClosureReadiness({ consent: "GO", input: {} });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
  assert.ok(plan.blocked_by.includes("registry_missing"));
  assert.ok(plan.blocked_by.includes("index_missing"));
});

test("plan is eligible with exact consent and valid registry plus index", () => {
  const plan = planNode0LocalClosureReadiness({
    consent: NODE0_LOCAL_CLOSURE_READINESS_GO_PHRASE,
    input: fixture(),
  });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("payload reports local closure gates without claiming impact or mint", () => {
  const payload = buildNode0LocalClosureReadinessPayload(fixture());
  assert.equal(payload.schema, NODE0_LOCAL_CLOSURE_READINESS_SCHEMA);
  assert.equal(payload.truth_label, NODE0_LOCAL_CLOSURE_READINESS_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.readiness_status, "READY_FOR_HASH_CONSENT");
  assert.equal(payload.operator_topology.human_nodes, 1);
  assert.equal(payload.operator_topology.machine_nodes, 1);
  assert.equal(payload.operator_topology.pat_scope, "LOCAL_ONLY");
  assert.equal(payload.operator_topology.sat_visibility, "METADATA_ONLY_AFTER_APPLY");
  assert.equal(payload.sources.source_count, 8);
  assert.equal(payload.sources.impact_candidate_count, 6);
  assert.equal(payload.sources.mint_allowed_count, 0);
  assert.equal(payload.index.records_count, 9);
  assert.equal(payload.index.weak_duplicate_candidate_group_count, 2);
  assert.equal(payload.next_action.kind, "CONTENT_HASH_CONSENT");
  assert.equal(payload.next_action.exact_phrase, buildNode0HashConsentPhrase(ROOT_HASH));
  assert.equal(payload.mint.live_mint_allowed, false);
  assert.equal(payload.mint.preview_mint_allowed, false);
  assert.equal(payload.mint.reason, "POI_NOT_VERIFIED");
  assert.equal(payload.boundary.execution_allowed, false);
  assert.equal(payload.boundary.live_execution_performed, false);
});

test("pipeline order preserves PAT local work before SAT metadata visibility", () => {
  const payload = buildNode0LocalClosureReadinessPayload(fixture());
  assert.deepEqual(
    payload.pipeline.map((stage) => `${stage.id}:${stage.status}`),
    [
      "source_registry:READY",
      "metadata_index:READY",
      "content_hash_scan:CONSENT_REQUIRED",
      "dedup_plan:BLOCKED_UNTIL_HASH_SCAN",
      "reorg_plan:BLOCKED_UNTIL_DEDUP_PLAN",
      "apply_reorg:BLOCKED_UNTIL_EXACT_PLAN_CONSENT",
      "sat_summary:BLOCKED_UNTIL_APPLY_COMPLETE",
      "proof_of_impact:BLOCKED_UNTIL_VERIFIED_IMPACT",
      "mint:BLOCKED_NO_LIVE_MINT",
    ],
  );
});

test("impact queue candidates remain review-only and never mint-eligible", () => {
  const payload = buildNode0LocalClosureReadinessPayload(fixture());
  assert.equal(payload.impact_queue.length, 6);
  assert.ok(
    payload.impact_queue.every(
      (entry) =>
        entry.queue_status === "REVIEW_CANDIDATE_ONLY" &&
        entry.impact_verified === false &&
        entry.mint_allowed === false,
    ),
  );
  assert.equal(
    payload.impact_queue.some((entry) => entry.source_id === "economy_simulator"),
    false,
  );
});

test("verify accepts a freshly built payload and rejects stale-hash tampering", () => {
  const payload = buildNode0LocalClosureReadinessPayload(fixture());
  assert.equal(verifyNode0LocalClosureReadiness(payload).ok, true);
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  const verified = verifyNode0LocalClosureReadiness(tampered);
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("content_hash_mismatch"));
});

test("verify rejects self-consistent payloads that promote live minting", () => {
  const payload = buildNode0LocalClosureReadinessPayload(fixture());
  const { content_hash: _oldHash, ...body } = payload;
  const forgedBody = {
    ...body,
    mint: {
      ...body.mint,
      live_mint_allowed: true,
      reason: "FORGED",
    },
  };
  const forged = { ...forgedBody, content_hash: contentHash(forgedBody) };
  const verified = verifyNode0LocalClosureReadiness(forged);
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("live_mint_not_false"));
});

test("content-hash index advances next action to dedup plan without SAT or mint", () => {
  const payload = buildNode0LocalClosureReadinessPayload(
    fixture({
      index: indexEnvelope({
        mode: "content_hash_index",
        duplicate_candidate_groups: [
          {
            group_type: "content_hash_match",
            confidence: "strong",
            content_confirmed: true,
            content_hash: `sha256:${"b".repeat(64)}`,
            members: ["a.md", "b.md"],
          },
        ],
        consent: {
          content_hash_required: true,
          required_phrase: buildNode0HashConsentPhrase(ROOT_HASH),
          provided: true,
          accepted: true,
        },
        boundary: {
          ...indexEnvelope().boundary,
          file_content_read: true,
          content_hash_performed: true,
        },
      }),
    }),
  );
  assert.equal(payload.readiness_status, "READY_FOR_DEDUP_PLAN");
  assert.equal(payload.index.strong_duplicate_candidate_group_count, 1);
  assert.equal(payload.next_action.kind, "DEDUP_PLAN_PREVIEW");
  assert.equal(payload.pipeline[2].status, "READY");
  assert.equal(payload.pipeline[3].status, "READY_FOR_PLAN_ONLY");
  assert.equal(payload.pipeline[6].status, "BLOCKED_UNTIL_APPLY_COMPLETE");
  assert.equal(payload.mint.live_mint_allowed, false);
});

test("review gate closes the loop: plan, build, verify, tamper-reject", () => {
  const result = runNode0LocalClosureReadinessCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, NODE0_LOCAL_CLOSURE_READINESS_SCHEMA);
  assert.equal(result.truth_label, NODE0_LOCAL_CLOSURE_READINESS_TRUTH_LABEL);
  assert.equal(result.readiness_status, "READY_FOR_HASH_CONSENT");
  assert.equal(result.tamper_reject_ok, true);
  assert.equal(result.boundary.token_minted, false);
});

test("orchestrator boundary stays all-false and returns no external-action claim", () => {
  const result = runNode0LocalClosureReadiness({
    consent: NODE0_LOCAL_CLOSURE_READINESS_GO_PHRASE,
    input: fixture(),
  });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
  assert.equal(result.boundary.network_used, false);
  assert.equal(result.boundary.token_minted, false);
  assert.equal(result.boundary.file_mutation_performed, false);
  assert.equal(result.mint.live_mint_allowed, false);
});
