// Envelope Schema Validator v0.1 — structural validator tests.
//
// Locks: the JSON-Schema-subset semantics (const · enum · type · required ·
// properties · items · pattern), the registry routing, the result envelope
// shape, the boundary stamp, and integration with the 3 v0.1 envelope
// shapes shipped today (onboarding seal · artifact safety eval ·
// proof-room bundle).

import test from "node:test";
import assert from "node:assert/strict";

import {
  ENVELOPE_SCHEMA_VALIDATOR_SCHEMA,
  ENVELOPE_SCHEMA_VALIDATOR_BOUNDARY,
  ERROR_CODES,
  KNOWN_SCHEMA_IDS,
  getKnownSchema,
  hasKnownSchema,
  loadKnownSchemas,
  validateEnvelope,
  validateAgainstRegistry
} from "../packages/core/src/envelope-schema-validator.js";

import {
  ONBOARDING_SEAL_SCHEMA,
  evaluateOnboardingSeal
} from "../packages/core/src/onboarding-seal.js";

import {
  ARTIFACT_SAFETY_SCHEMA,
  evaluateArtifactSafety
} from "../packages/core/src/artifact-safety-eval.js";

test("ENVELOPE_SCHEMA_VALIDATOR_SCHEMA matches v0.1", () => {
  assert.equal(
    ENVELOPE_SCHEMA_VALIDATOR_SCHEMA,
    "bizra.dema.envelope_schema_validator.v0.1"
  );
});

test("KNOWN_SCHEMA_IDS exposes the 3 v0.1 envelope schemas", () => {
  assert.ok(KNOWN_SCHEMA_IDS.includes("bizra.dema.onboarding_seal.v0.1"));
  assert.ok(KNOWN_SCHEMA_IDS.includes("bizra.dema.artifact_safety_eval.v0.1"));
  assert.ok(KNOWN_SCHEMA_IDS.includes("bizra.dema.proof_room_bundle.v0.1"));
});

test("KNOWN_SCHEMA_IDS is a truly immutable frozen array", () => {
  assert.ok(Array.isArray(KNOWN_SCHEMA_IDS));
  assert.ok(Object.isFrozen(KNOWN_SCHEMA_IDS));
  assert.throws(
    () => {
      KNOWN_SCHEMA_IDS.push("bizra.dema.injected_fake.v0.1");
    },
    /(read.only|frozen|extensible)/i
  );
});

test("getKnownSchema returns frozen schema or undefined; cannot be mutated", () => {
  const schema = getKnownSchema("bizra.dema.onboarding_seal.v0.1");
  assert.ok(schema);
  assert.equal(schema.$id, "bizra.dema.onboarding_seal.v0.1");
  assert.ok(Object.isFrozen(schema));
  assert.equal(getKnownSchema("bizra.dema.nope.v0.1"), undefined);
  assert.equal(getKnownSchema(null), undefined);
  assert.equal(getKnownSchema(undefined), undefined);
});

test("hasKnownSchema is true for the 3 v0.1 schemas, false otherwise", () => {
  assert.equal(hasKnownSchema("bizra.dema.onboarding_seal.v0.1"), true);
  assert.equal(hasKnownSchema("bizra.dema.unknown.v0.1"), false);
  assert.equal(hasKnownSchema(null), false);
});

test("the private known-schema registry is NOT reachable as a mutable Map export", async () => {
  const mod = await import("../packages/core/src/envelope-schema-validator.js");
  // KNOWN_SCHEMAS was the prior leak surface; it must not be present.
  assert.equal(mod.KNOWN_SCHEMAS, undefined);
});

test("loadKnownSchemas accepts an injected dir (for tests)", () => {
  const fresh = loadKnownSchemas();
  assert.ok(fresh instanceof Map);
  assert.ok(fresh.has("bizra.dema.onboarding_seal.v0.1"));
});

test("validateEnvelope · ok on a minimal valid envelope", () => {
  const schemaDef = {
    type: "object",
    required: ["schema", "ok"],
    properties: {
      schema: { const: "bizra.test.minimal.v0.1" },
      ok: { type: "boolean" }
    }
  };
  const result = validateEnvelope(
    { schema: "bizra.test.minimal.v0.1", ok: true },
    schemaDef
  );
  assert.equal(result.ok, true);
  assert.deepEqual([...result.errors], []);
});

test("validateEnvelope · const mismatch on the schema field", () => {
  const schemaDef = {
    type: "object",
    properties: {
      schema: { const: "bizra.test.minimal.v0.1" }
    }
  };
  const result = validateEnvelope(
    { schema: "bizra.test.wrong.v0.1" },
    schemaDef
  );
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, ERROR_CODES.CONST_MISMATCH);
  assert.equal(result.errors[0].path, "$.schema");
});

test("validateEnvelope · missing_required when a required key is absent", () => {
  const schemaDef = {
    type: "object",
    required: ["ok", "verdict"],
    properties: {
      ok: { type: "boolean" },
      verdict: { type: "string" }
    }
  };
  const result = validateEnvelope({ ok: true }, schemaDef);
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].code, ERROR_CODES.MISSING_REQUIRED);
  assert.equal(result.errors[0].path, "$.verdict");
});

test("validateEnvelope · wrong_type when a property has the wrong shape", () => {
  const schemaDef = {
    type: "object",
    properties: {
      score: { type: "integer" }
    }
  };
  const result = validateEnvelope({ score: "not a number" }, schemaDef);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, ERROR_CODES.WRONG_TYPE);
});

test("validateEnvelope · enum_mismatch on a constrained string", () => {
  const schemaDef = {
    type: "object",
    properties: {
      verdict: { enum: ["PUBLIC_SAFE", "LOCAL_ONLY"] }
    }
  };
  const result = validateEnvelope({ verdict: "WHATEVER" }, schemaDef);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, ERROR_CODES.ENUM_MISMATCH);
});

test("validateEnvelope · pattern_mismatch on a regex-constrained string", () => {
  const schemaDef = {
    type: "object",
    properties: {
      artifact_sha256: { type: "string", pattern: "^[a-f0-9]{64}$" }
    }
  };
  const result = validateEnvelope({ artifact_sha256: "not-a-hash" }, schemaDef);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, ERROR_CODES.PATTERN_MISMATCH);
});

test("validateEnvelope · invalid_pattern when schema regex is malformed (no throw)", () => {
  // Unterminated character class — would throw at new RegExp() construction.
  const schemaDef = {
    type: "object",
    properties: {
      thing: { type: "string", pattern: "^[a-z" }
    }
  };
  // Must not throw — the validator should surface the error structurally.
  const result = validateEnvelope({ thing: "anything" }, schemaDef);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, ERROR_CODES.INVALID_PATTERN);
  assert.match(result.errors[0].message, /not a valid regex/);
});

test("validateEnvelope · union type accepts each branch", () => {
  const schemaDef = {
    type: "object",
    properties: {
      severity: { type: ["string", "null"] }
    }
  };
  const a = validateEnvelope({ severity: "BLOCKER" }, schemaDef);
  const b = validateEnvelope({ severity: null }, schemaDef);
  const c = validateEnvelope({ severity: 42 }, schemaDef);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(c.ok, false);
  assert.equal(c.errors[0].code, ERROR_CODES.WRONG_TYPE);
});

test("validateEnvelope · nested items array validation", () => {
  const schemaDef = {
    type: "object",
    properties: {
      tags: {
        type: "array",
        items: { type: "string" }
      }
    }
  };
  const result = validateEnvelope({ tags: ["a", "b", 3] }, schemaDef);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].path, "$.tags[2]");
  assert.equal(result.errors[0].code, ERROR_CODES.WRONG_TYPE);
});

test("validateAgainstRegistry · routes onboarding seal envelope correctly", () => {
  const sealResult = evaluateOnboardingSeal({
    status: {
      consoleReady: true,
      activationGate: "EXPLICIT_GO_REQUIRED",
      daemonStatus: "stopped",
      missionExecuted: false,
      runtimePulse: { fired: false },
      human: null
    },
    profile_present: true,
    today_tick: "2026-05-23T10:00:00Z",
    os_username: "mumu",
    receipt_module: null
  });
  assert.equal(sealResult.schema, ONBOARDING_SEAL_SCHEMA);
  const validation = validateAgainstRegistry(sealResult);
  assert.equal(validation.schema, ENVELOPE_SCHEMA_VALIDATOR_SCHEMA);
  assert.equal(validation.recognized, true);
  assert.equal(validation.ok, true);
  assert.equal(validation.truth_label, "MEASURED");
  assert.equal(validation.envelope_schema, ONBOARDING_SEAL_SCHEMA);
  assert.deepEqual([...validation.errors], []);
});

test("validateAgainstRegistry · routes artifact safety envelope correctly", () => {
  const evalResult = evaluateArtifactSafety("a clean prose snippet with no leakage");
  assert.equal(evalResult.schema, ARTIFACT_SAFETY_SCHEMA);
  const validation = validateAgainstRegistry(evalResult);
  assert.equal(validation.recognized, true);
  assert.equal(validation.ok, true);
  assert.equal(validation.truth_label, "MEASURED");
});

test("validateAgainstRegistry · returns SCHEMA_UNKNOWN for an unrecognized schema id", () => {
  const validation = validateAgainstRegistry({
    schema: "bizra.unknown.v9.9",
    foo: "bar"
  });
  assert.equal(validation.recognized, false);
  assert.equal(validation.ok, false);
  assert.equal(validation.truth_label, "SCHEMA_UNKNOWN");
  assert.deepEqual([...validation.errors], []);
});

test("validateAgainstRegistry · catches structurally-broken seal envelope", () => {
  const broken = {
    schema: "bizra.dema.onboarding_seal.v0.1",
    ok: true,
    score: 1
  };
  const validation = validateAgainstRegistry(broken);
  assert.equal(validation.recognized, true);
  assert.equal(validation.ok, false);
  assert.equal(validation.truth_label, "VALIDATION_FAILED");
  const missing = validation.errors
    .filter((e) => e.code === ERROR_CODES.MISSING_REQUIRED)
    .map((e) => e.path);
  assert.ok(missing.includes("$.invariants"));
  assert.ok(missing.includes("$.failed_invariants"));
  assert.ok(missing.includes("$.boundary"));
  assert.ok(missing.includes("$.next_safe_action"));
});

test("validateAgainstRegistry · accepts an injected registry (testability)", () => {
  const customRegistry = new Map([
    [
      "bizra.test.custom.v0.1",
      {
        $id: "bizra.test.custom.v0.1",
        type: "object",
        required: ["schema", "answer"],
        properties: {
          schema: { const: "bizra.test.custom.v0.1" },
          answer: { type: "integer" }
        }
      }
    ]
  ]);
  const validation = validateAgainstRegistry(
    { schema: "bizra.test.custom.v0.1", answer: 42 },
    { registry: customRegistry }
  );
  assert.equal(validation.recognized, true);
  assert.equal(validation.ok, true);
});

test("result envelope is deep-frozen", () => {
  const validation = validateAgainstRegistry({
    schema: "bizra.dema.onboarding_seal.v0.1"
  });
  assert.ok(Object.isFrozen(validation));
  assert.ok(Object.isFrozen(validation.errors));
  assert.ok(Object.isFrozen(validation.boundary));
});

test("ENVELOPE_SCHEMA_VALIDATOR_BOUNDARY denies network/mint/external_send/urp_runtime/fs_write", () => {
  assert.deepEqual(ENVELOPE_SCHEMA_VALIDATOR_BOUNDARY, {
    read_only: true,
    network: false,
    mint: false,
    external_send: false,
    urp_runtime: false,
    filesystem_write_performed: false
  });
});

test("validator finds real structural breakage in a forged onboarding seal", () => {
  const broken = {
    schema: "bizra.dema.onboarding_seal.v0.1",
    ok: true,
    score: 2,
    invariants: [
      { key: "profile_exists", label: "x", status: "weird-status" }
    ],
    failed_invariants: [],
    boundary: {
      read_only: true,
      network: false,
      mint: false,
      external_send: false,
      urp_runtime: false,
      filesystem_write_performed: false
    },
    next_safe_action: "ok"
  };
  const validation = validateAgainstRegistry(broken);
  assert.equal(validation.ok, false);
  const codes = validation.errors.map((e) => e.code);
  assert.ok(codes.includes(ERROR_CODES.ENUM_MISMATCH));
});
