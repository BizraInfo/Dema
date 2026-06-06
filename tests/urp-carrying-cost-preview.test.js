import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  buildUrpCarryingCostPreview,
  URP_CARRYING_COST_PREVIEW_SCHEMA,
  SHAREABLE_RESOURCE_TYPES,
  FORBIDDEN_RESOURCE_TYPES,
} from "../packages/core/src/urp-carrying-cost-preview.js";
import { buildBoundaryInvariantCheckReport } from "../scripts/review/boundary-invariant-check.mjs";

const modulePath = fileURLToPath(
  new URL("../packages/core/src/urp-carrying-cost-preview.js", import.meta.url),
);

const FIXED_NOW = new Date("2026-05-16T11:40:00.000Z");

const VALID_ARGS = Object.freeze({
  resource_id: "skill.investor_pack_drafter",
  resource_type: "skill_pack",
  owner_node: "node0",
  self_assessed_value: 100,
  carrying_cost_rate: 0.02,
  license_challenge_allowed: true,
  no_raw_data_proof:
    "skill manifest contains only public templates and rubric metadata",
  now: FIXED_NOW,
});

test("T-01 canonical schema", () => {
  const env = buildUrpCarryingCostPreview({ ...VALID_ARGS });
  assert.equal(env.schema, URP_CARRYING_COST_PREVIEW_SCHEMA);
  assert.equal(env.schema, "bizra.dema.urp_carrying_cost_preview.v0.1");
});

test("T-02 PREVIEW_ONLY and DECLARED", () => {
  const env = buildUrpCarryingCostPreview({ ...VALID_ARGS });
  assert.equal(env.mode, "PREVIEW_ONLY");
  assert.equal(env.truth_label, "DECLARED");
});

test("T-03 valid case has all required fields", () => {
  const env = buildUrpCarryingCostPreview({ ...VALID_ARGS });
  assert.equal(env.valid, true);
  assert.equal(env.resource_id, "skill.investor_pack_drafter");
  assert.equal(env.resource_type, "skill_pack");
  assert.equal(env.owner_node, "node0");
  assert.equal(env.self_assessed_value, 100);
  assert.equal(env.carrying_cost_rate, 0.02);
  assert.equal(env.simulated_carrying_cost, 2); // 100 * 0.02
  assert.equal(env.license_challenge_allowed, true);
  assert.equal(env.forced_transfer, false);
  assert.equal(env.raw_data_shared, false);
  assert.equal(env.settlement, "preview_only");
});

test("T-04 simulated_carrying_cost is computed, not user-supplied", () => {
  const env = buildUrpCarryingCostPreview({
    ...VALID_ARGS,
    simulated_carrying_cost: 999,
  });
  assert.equal(env.simulated_carrying_cost, 2);
});

test("T-05 forbidden resource type returns fail-closed envelope", () => {
  for (const type of [
    "private_conversation",
    "identity_data",
    "family_personal_data",
    "secrets",
    "raw_corpus",
    "unpublished_personal_memory",
    "credentials",
    "finance_data",
  ]) {
    const env = buildUrpCarryingCostPreview({
      ...VALID_ARGS,
      resource_type: type,
    });
    assert.equal(
      env.valid,
      false,
      `forbidden type ${type} must be fail-closed`,
    );
    assert.equal(
      env.denial.code,
      "forbidden_resource_type",
      `forbidden type ${type} must produce forbidden_resource_type denial`,
    );
  }
});

test("T-06 unknown resource type returns fail-closed envelope", () => {
  const env = buildUrpCarryingCostPreview({
    ...VALID_ARGS,
    resource_type: "random_unlisted_type",
  });
  assert.equal(env.valid, false);
  assert.equal(env.denial.code, "unknown_resource_type");
});

test("T-07 invalid value (zero / negative / NaN) is rejected", () => {
  for (const value of [0, -1, NaN, Number.POSITIVE_INFINITY, "not a number"]) {
    const env = buildUrpCarryingCostPreview({
      ...VALID_ARGS,
      self_assessed_value: value,
    });
    assert.equal(env.valid, false, `value ${String(value)} must be rejected`);
    assert.equal(
      env.denial.code,
      "invalid_value",
      `value ${String(value)} must produce invalid_value`,
    );
  }
});

test("T-08 invalid rate (<=0 or >=1 or NaN) is rejected", () => {
  for (const rate of [0, 1, 1.5, -0.1, NaN]) {
    const env = buildUrpCarryingCostPreview({
      ...VALID_ARGS,
      carrying_cost_rate: rate,
    });
    assert.equal(env.valid, false, `rate ${String(rate)} must be rejected`);
    assert.equal(
      env.denial.code,
      "invalid_rate",
      `rate ${String(rate)} must produce invalid_rate`,
    );
  }
});

test("T-09 missing required strings (resource_id / owner_node / no_raw_data_proof) rejected", () => {
  for (const field of ["resource_id", "owner_node", "no_raw_data_proof"]) {
    const env = buildUrpCarryingCostPreview({ ...VALID_ARGS, [field]: "" });
    assert.equal(env.valid, false, `empty ${field} must be rejected`);
    assert.equal(
      env.denial.code,
      "missing_field",
      `empty ${field} must produce missing_field`,
    );
  }
});

test("T-10 boundary keeps all 9 authority flags false (valid + failure envelopes)", () => {
  const validEnv = buildUrpCarryingCostPreview({ ...VALID_ARGS });
  const failureEnv = buildUrpCarryingCostPreview({
    ...VALID_ARGS,
    resource_type: "secrets",
  });
  const KEYS = [
    "runtime",
    "federation",
    "mint",
    "economic_settlement",
    "forced_transfer_executed",
    "private_memory_accessed",
    "raw_data_exchange",
    "license_issued",
    "shared_urp_published",
  ];
  for (const key of KEYS) {
    assert.equal(
      validEnv.boundary[key],
      false,
      `valid envelope: boundary.${key} must be false`,
    );
    assert.equal(
      failureEnv.boundary[key],
      false,
      `failure envelope: boundary.${key} must be false`,
    );
  }
});

test("T-11 all 8 shareable resource types are accepted", () => {
  for (const type of [
    "skill_pack",
    "knowledge_pack_manifest",
    "model_profile",
    "mission_template",
    "verified_proof_bundle",
    "resource_offer",
    "compute_offer",
    "agent_service_offer",
  ]) {
    const env = buildUrpCarryingCostPreview({
      ...VALID_ARGS,
      resource_type: type,
    });
    assert.equal(env.valid, true, `shareable type ${type} must be accepted`);
  }
});

test("T-12 deterministic and frozen", () => {
  const a = buildUrpCarryingCostPreview({ ...VALID_ARGS });
  const b = buildUrpCarryingCostPreview({ ...VALID_ARGS });
  assert.deepEqual(a, b);
  assert.ok(Object.isFrozen(a));
  assert.ok(Object.isFrozen(a.boundary));
});

test("T-13 fresh objects per call", () => {
  const a = buildUrpCarryingCostPreview({ ...VALID_ARGS });
  const b = buildUrpCarryingCostPreview({ ...VALID_ARGS });
  assert.notEqual(a, b);
  assert.notEqual(a.boundary, b.boundary);
});

test("T-14 pure-module imports", async () => {
  const body = await readFile(modulePath, "utf8");
  assert.ok(!/from ['"]node:fs/.test(body), "module must not import node:fs");
  assert.ok(
    !/from ['"]node:http/.test(body),
    "module must not import node:http",
  );
  assert.ok(!/from ['"]node:net/.test(body), "module must not import node:net");
  assert.ok(
    !/from ['"]node:child_process/.test(body),
    "module must not import node:child_process",
  );
  assert.ok(
    !/spawn\(|execSync\(|execFile\(|spawnSync\(/.test(body),
    "module must not invoke processes",
  );
});

test("T-15 invalid now Date is rejected", () => {
  const env = buildUrpCarryingCostPreview({
    ...VALID_ARGS,
    now: new Date("not-a-date"),
  });
  assert.equal(env.valid, false);
  assert.equal(env.denial.code, "invalid_now");
});

test("T-16 boundary-invariant lint passes with new module included", () => {
  const report = buildBoundaryInvariantCheckReport();
  assert.equal(report.ok, true);
  assert.ok(
    report.modules_scanned > 0,
    `expected at least 26 modules scanned, got ${report.modules_scanned}`,
  );
  assert.equal(report.modules_clean, report.modules_scanned);
});

test("constants are frozen arrays of expected length", () => {
  assert.ok(Object.isFrozen(SHAREABLE_RESOURCE_TYPES));
  assert.ok(Object.isFrozen(FORBIDDEN_RESOURCE_TYPES));
  assert.equal(SHAREABLE_RESOURCE_TYPES.length, 8);
  assert.equal(FORBIDDEN_RESOURCE_TYPES.length, 8);
});
