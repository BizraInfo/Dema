import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  buildModelRoleRouterPreview,
  MODEL_ROLE_ROUTER_PREVIEW_SCHEMA
} from "../packages/models/src/model-role-router-preview.js";
import { buildBoundaryInvariantCheckReport } from "../scripts/review/boundary-invariant-check.mjs";

const modulePath = fileURLToPath(new URL("../packages/models/src/model-role-router-preview.js", import.meta.url));

const SAMPLE_PROVIDERS = {
  ollama: {
    models: [
      { id: "deepseek-r1:7b", source: "ollama", size_bytes: 4_360_000_000 },
      { id: "qwen3-coder:14b", source: "ollama", size_bytes: 8_000_000_000 },
      { id: "gemma4:e4b", source: "ollama", size_bytes: 4_000_000_000 },
      { id: "nomic-embed-text:latest", source: "ollama", size_bytes: 260_000_000 },
      { id: "vision-multimodal-vl:7b", source: "ollama", size_bytes: 7_500_000_000 }
    ]
  },
  lm_studio: { models: [] },
  downloads: { models: [] }
};

test("T-01 model role router emits the canonical schema", () => {
  const preview = buildModelRoleRouterPreview(SAMPLE_PROVIDERS);
  assert.equal(preview.schema, MODEL_ROLE_ROUTER_PREVIEW_SCHEMA);
  assert.equal(preview.schema, "bizra.dema.model_role_router_preview.v0.1");
});

test("T-02 is PREVIEW_ONLY and DECLARED", () => {
  const preview = buildModelRoleRouterPreview(SAMPLE_PROVIDERS);
  assert.equal(preview.mode, "PREVIEW_ONLY");
  assert.equal(preview.truth_label, "DECLARED");
});

test("T-03 declares exactly 6 roles matching model-routing.js taxonomy", () => {
  const preview = buildModelRoleRouterPreview(SAMPLE_PROVIDERS);
  assert.equal(preview.role_count, 6);
  assert.deepEqual(
    [...preview.role_names].sort(),
    ["coding", "embedding", "fast", "governance", "reasoning", "vision"]
  );
});

test("T-04 every role declares effects_declared and effects_denied", () => {
  const preview = buildModelRoleRouterPreview(SAMPLE_PROVIDERS);
  const VALID_OPS = new Set(["read", "write", "execute", "call"]);
  for (const role of Object.values(preview.roles)) {
    assert.ok(Array.isArray(role.effects_declared));
    assert.ok(Array.isArray(role.effects_denied));
    for (const op of role.effects_declared) assert.ok(VALID_OPS.has(op));
    for (const op of role.effects_denied) assert.ok(VALID_OPS.has(op));
  }
});

test("T-05 every role denies write, execute, and call in v0.1", () => {
  const preview = buildModelRoleRouterPreview(SAMPLE_PROVIDERS);
  for (const role of Object.values(preview.roles)) {
    for (const op of ["write", "execute", "call"]) {
      assert.ok(role.effects_denied.includes(op), `role ${role.role} must deny ${op}`);
      assert.ok(!role.effects_declared.includes(op), `role ${role.role} must NOT declare ${op}`);
    }
  }
});

test("T-06 every role has a valid sat_verdict_required value", () => {
  const preview = buildModelRoleRouterPreview(SAMPLE_PROVIDERS);
  const VALID = new Set(["PERMIT", "REJECT", "REVIEW", "SCORE_ONLY"]);
  for (const role of Object.values(preview.roles)) {
    assert.ok(VALID.has(role.sat_verdict_required), `role ${role.role} verdict invalid`);
  }
});

test("T-07 every role's consent_field_required is in MICRO_CONSENT_SHAPE or null", () => {
  const preview = buildModelRoleRouterPreview(SAMPLE_PROVIDERS);
  const VALID = new Set([
    "mission_id",
    "agent_id",
    "resource_id",
    "action",
    "purpose",
    "expires_at",
    "commitment_hash"
  ]);
  for (const role of Object.values(preview.roles)) {
    const f = role.consent_field_required;
    assert.ok(f === null || VALID.has(f), `role ${role.role} field ${f} invalid`);
  }
});

test("T-08 every role declares local_only=true and prompt_invocation_allowed=false in v0.1", () => {
  const preview = buildModelRoleRouterPreview(SAMPLE_PROVIDERS);
  for (const role of Object.values(preview.roles)) {
    assert.equal(role.local_only, true);
    assert.equal(role.prompt_invocation_allowed, false);
  }
});

test("T-09 every recommendation passes through model-routing.js output shape (model + source + reason) or is null", () => {
  const preview = buildModelRoleRouterPreview(SAMPLE_PROVIDERS);
  for (const role of Object.values(preview.roles)) {
    const r = role.recommendation;
    if (r !== null) {
      assert.ok("model" in r && "source" in r && "reason" in r);
      assert.equal(typeof r.model, "string");
      assert.equal(typeof r.source, "string");
      assert.equal(typeof r.reason, "string");
    }
  }
});

test("T-10 boundary keeps all 9 authority flags false", () => {
  const preview = buildModelRoleRouterPreview(SAMPLE_PROVIDERS);
  for (const key of [
    "runtime",
    "federation",
    "mint",
    "prompt_invoked",
    "model_started",
    "network_used",
    "authority_imported",
    "hook_executed",
    "contract_executed"
  ]) {
    assert.equal(preview.boundary[key], false, `boundary.${key} must be false`);
  }
});

test("T-11 is deterministic and deeply frozen across two calls with same providers", () => {
  const a = buildModelRoleRouterPreview(SAMPLE_PROVIDERS);
  const b = buildModelRoleRouterPreview(SAMPLE_PROVIDERS);
  assert.deepEqual(a, b);
  assert.ok(Object.isFrozen(a));
  assert.ok(Object.isFrozen(a.boundary));
  assert.ok(Object.isFrozen(a.roles));
});

test("T-12 returns fresh objects on each call", () => {
  const a = buildModelRoleRouterPreview(SAMPLE_PROVIDERS);
  const b = buildModelRoleRouterPreview(SAMPLE_PROVIDERS);
  assert.notEqual(a, b);
  assert.notEqual(a.boundary, b.boundary);
  assert.notEqual(a.roles, b.roles);
});

test("T-13 module is pure (no fs/http/net/child_process imports)", async () => {
  const body = await readFile(modulePath, "utf8");
  assert.ok(!/from ['"]node:fs/.test(body));
  assert.ok(!/from ['"]node:http/.test(body));
  assert.ok(!/from ['"]node:net/.test(body));
  assert.ok(!/from ['"]node:child_process/.test(body));
  assert.ok(!/spawn\(|execSync\(|execFile\(|spawnSync\(/.test(body));
});

test("T-14 missing providers argument still produces a valid envelope with null recommendations", () => {
  const preview = buildModelRoleRouterPreview();
  assert.equal(preview.role_count, 6);
  for (const role of Object.values(preview.roles)) {
    assert.equal(role.recommendation, null);
  }
});

test("T-15 boundary-invariant lint passes with the new module included", () => {
  const report = buildBoundaryInvariantCheckReport();
  assert.equal(report.ok, true);
  assert.equal(report.modules_scanned, 24);
  assert.equal(report.modules_clean, 24);
});
