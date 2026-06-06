import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  buildUrpResourceOfferPreview,
  URP_RESOURCE_OFFER_PREVIEW_SCHEMA,
} from "../packages/core/src/urp-resource-offer-preview.js";
import {
  SHAREABLE_RESOURCE_TYPES,
  FORBIDDEN_RESOURCE_TYPES,
} from "../packages/core/src/urp-carrying-cost-preview.js";

const modulePath = fileURLToPath(
  new URL(
    "../packages/core/src/urp-resource-offer-preview.js",
    import.meta.url,
  ),
);

const FIXED_NOW = new Date("2026-05-16T12:00:00.000Z");

const VALID_ARGS = Object.freeze({
  resource_id: "skill.investor_pack_drafter",
  resource_type: "skill_pack",
  owner_node: "node0",
  declared_effects: ["read"],
  denied_effects: ["write", "execute", "call"],
  consent_field_required: "resource_id",
  sat_verdict_required: "REVIEW",
  no_raw_data_proof:
    "manifest declares only public templates and rubric metadata; no raw corpus bytes",
  carrying_cost_reference: null,
  now: FIXED_NOW,
});

const BOUNDARY_KEYS = [
  "runtime",
  "federation",
  "mint",
  "shared_urp_publish",
  "economic_settlement",
  "raw_data_exchange",
  "offer_published",
  "ownership_transferred",
];

test("T-01 canonical schema", () => {
  const env = buildUrpResourceOfferPreview({ ...VALID_ARGS });
  assert.equal(env.schema, URP_RESOURCE_OFFER_PREVIEW_SCHEMA);
  assert.equal(env.schema, "bizra.dema.urp_resource_offer_preview.v0.1");
});

test("T-02 PREVIEW_ONLY mode and DECLARED truth label", () => {
  const env = buildUrpResourceOfferPreview({ ...VALID_ARGS });
  assert.equal(env.mode, "PREVIEW_ONLY");
  assert.equal(env.truth_label, "DECLARED");
});

test("T-03 valid envelope shape carries all spec fields", () => {
  const env = buildUrpResourceOfferPreview({ ...VALID_ARGS });
  assert.equal(env.valid, true);
  assert.equal(env.resource_id, "skill.investor_pack_drafter");
  assert.equal(env.resource_type, "skill_pack");
  assert.equal(env.owner_node, "node0");
  assert.deepEqual(env.declared_effects, ["read"]);
  assert.deepEqual(env.denied_effects, ["write", "execute", "call"]);
  assert.equal(env.consent_field_required, "resource_id");
  assert.equal(env.sat_verdict_required, "REVIEW");
  assert.equal(env.settlement, "preview_only");
  assert.equal(env.published, false);
  assert.equal(env.carrying_cost_reference, null);
  assert.equal(typeof env.generated_at, "string");
  assert.equal(env.generated_at, FIXED_NOW.toISOString());
});

test("T-04 forbidden resource type fails closed with forbidden_resource_type", () => {
  for (const type of FORBIDDEN_RESOURCE_TYPES) {
    const env = buildUrpResourceOfferPreview({
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
      `forbidden type ${type} denial.code must match`,
    );
  }
});

test("T-05 unknown resource type fails with unknown_resource_type", () => {
  const env = buildUrpResourceOfferPreview({
    ...VALID_ARGS,
    resource_type: "not_a_real_type",
  });
  assert.equal(env.valid, false);
  assert.equal(env.denial.code, "unknown_resource_type");
});

test("T-06 declared/denied effects overlap rejected", () => {
  const env = buildUrpResourceOfferPreview({
    ...VALID_ARGS,
    declared_effects: ["read", "write"],
    denied_effects: ["write", "execute", "call"],
  });
  assert.equal(env.valid, false);
  assert.equal(env.denial.code, "effect_overlap");
});

test("T-07 effects must be subset of {read, write, execute, call}", () => {
  const env = buildUrpResourceOfferPreview({
    ...VALID_ARGS,
    declared_effects: ["read", "telepathy"],
    denied_effects: ["write", "execute", "call"],
  });
  assert.equal(env.valid, false);
  assert.equal(env.denial.code, "invalid_effect");
});

test("T-08 denied_effects MUST include write, execute, call", () => {
  for (const missing of ["write", "execute", "call"]) {
    const denied = ["write", "execute", "call"].filter((e) => e !== missing);
    const env = buildUrpResourceOfferPreview({
      ...VALID_ARGS,
      denied_effects: denied,
    });
    assert.equal(
      env.valid,
      false,
      `missing ${missing} from denied_effects must reject`,
    );
    assert.equal(
      env.denial.code,
      "denied_effects_incomplete",
      `missing ${missing} must produce denied_effects_incomplete`,
    );
  }
});

test("T-09 consent_field_required must be in MICRO_CONSENT_SHAPE", () => {
  const env = buildUrpResourceOfferPreview({
    ...VALID_ARGS,
    consent_field_required: "nope",
  });
  assert.equal(env.valid, false);
  assert.equal(env.denial.code, "invalid_consent_field");
  // sanity: known fields all accepted
  for (const field of [
    "mission_id",
    "agent_id",
    "resource_id",
    "action",
    "purpose",
    "expires_at",
    "commitment_hash",
  ]) {
    const ok = buildUrpResourceOfferPreview({
      ...VALID_ARGS,
      consent_field_required: field,
    });
    assert.equal(ok.valid, true, `consent field ${field} must be accepted`);
  }
});

test("T-10 sat_verdict_required must be in GateVerdict", () => {
  const env = buildUrpResourceOfferPreview({
    ...VALID_ARGS,
    sat_verdict_required: "MAYBE",
  });
  assert.equal(env.valid, false);
  assert.equal(env.denial.code, "invalid_sat_verdict");
  for (const v of ["PERMIT", "REJECT", "REVIEW", "SCORE_ONLY"]) {
    const ok = buildUrpResourceOfferPreview({
      ...VALID_ARGS,
      sat_verdict_required: v,
    });
    assert.equal(ok.valid, true, `verdict ${v} must be accepted`);
  }
});

test("T-11 no_raw_data_proof must be ≥ 30 chars", () => {
  const env = buildUrpResourceOfferPreview({
    ...VALID_ARGS,
    no_raw_data_proof: "too short",
  });
  assert.equal(env.valid, false);
  assert.equal(env.denial.code, "no_raw_data_proof_too_short");
});

test("T-12 carrying_cost_reference must be null or match /^chal-[0-9a-f]{32}$/", () => {
  const okNull = buildUrpResourceOfferPreview({
    ...VALID_ARGS,
    carrying_cost_reference: null,
  });
  assert.equal(okNull.valid, true);

  const okMatch = buildUrpResourceOfferPreview({
    ...VALID_ARGS,
    carrying_cost_reference: "chal-0123456789abcdef0123456789abcdef",
  });
  assert.equal(okMatch.valid, true);
  assert.equal(
    okMatch.carrying_cost_reference,
    "chal-0123456789abcdef0123456789abcdef",
  );

  const bad = buildUrpResourceOfferPreview({
    ...VALID_ARGS,
    carrying_cost_reference: "chal-not-hex",
  });
  assert.equal(bad.valid, false);
  assert.equal(bad.denial.code, "invalid_carrying_cost_reference");

  const badUpper = buildUrpResourceOfferPreview({
    ...VALID_ARGS,
    carrying_cost_reference: "CHAL-0123456789ABCDEF0123456789ABCDEF",
  });
  assert.equal(badUpper.valid, false);
  assert.equal(badUpper.denial.code, "invalid_carrying_cost_reference");
});

test("T-13 owner_node rejects person-identifier heuristics (@ or :)", () => {
  for (const candidate of [
    "mumu@example.com",
    "user:123",
    "alice@node0",
    "x:y",
    "@handle",
  ]) {
    const env = buildUrpResourceOfferPreview({
      ...VALID_ARGS,
      owner_node: candidate,
    });
    assert.equal(
      env.valid,
      false,
      `person-identifier ${candidate} must be rejected`,
    );
    assert.equal(
      env.denial.code,
      "invalid_owner_node",
      `person-identifier ${candidate} must produce invalid_owner_node`,
    );
  }
  const empty = buildUrpResourceOfferPreview({ ...VALID_ARGS, owner_node: "" });
  assert.equal(empty.valid, false);
  assert.equal(empty.denial.code, "invalid_owner_node");
});

test("T-14 boundary keeps all 8 authority flags false on valid + failure envelopes", () => {
  const validEnv = buildUrpResourceOfferPreview({ ...VALID_ARGS });
  const failureEnv = buildUrpResourceOfferPreview({
    ...VALID_ARGS,
    resource_type: "secrets",
  });
  assert.equal(Object.keys(validEnv.boundary).length, 8);
  assert.equal(Object.keys(failureEnv.boundary).length, 8);
  for (const key of BOUNDARY_KEYS) {
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

test("T-15 all 8 shareable resource types accepted", () => {
  for (const type of SHAREABLE_RESOURCE_TYPES) {
    const env = buildUrpResourceOfferPreview({
      ...VALID_ARGS,
      resource_type: type,
    });
    assert.equal(env.valid, true, `shareable type ${type} must be accepted`);
  }
});

test("T-16 deterministic and deep-frozen", () => {
  const a = buildUrpResourceOfferPreview({ ...VALID_ARGS });
  const b = buildUrpResourceOfferPreview({ ...VALID_ARGS });
  assert.deepEqual(a, b);
  assert.ok(Object.isFrozen(a));
  assert.ok(Object.isFrozen(a.boundary));
  assert.ok(Object.isFrozen(a.declared_effects));
  assert.ok(Object.isFrozen(a.denied_effects));
});

test("T-17 fresh object references per call", () => {
  const a = buildUrpResourceOfferPreview({ ...VALID_ARGS });
  const b = buildUrpResourceOfferPreview({ ...VALID_ARGS });
  assert.notEqual(a, b);
  assert.notEqual(a.boundary, b.boundary);
  assert.notEqual(a.declared_effects, b.declared_effects);
  assert.notEqual(a.denied_effects, b.denied_effects);
});

test("T-18 pure-module imports (no fs/net/http/child_process)", async () => {
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
    !/spawn\(|execSync\(|execFile\(|spawnSync\(|fetch\(/.test(body),
    "module must not invoke processes or network",
  );
});

test("T-19 invariants: settlement preview_only and published false on every valid envelope", () => {
  for (const type of SHAREABLE_RESOURCE_TYPES) {
    const env = buildUrpResourceOfferPreview({
      ...VALID_ARGS,
      resource_type: type,
    });
    assert.equal(env.settlement, "preview_only");
    assert.equal(env.published, false);
  }
});

test("T-20 invalid now Date rejected", () => {
  const env = buildUrpResourceOfferPreview({
    ...VALID_ARGS,
    now: new Date("not-a-date"),
  });
  assert.equal(env.valid, false);
  assert.equal(env.denial.code, "invalid_now");
});
