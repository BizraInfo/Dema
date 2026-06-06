import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  buildMcpCapabilityDescriptorPreview,
  MCP_CAPABILITY_DESCRIPTOR_PREVIEW_SCHEMA,
} from "../packages/consent/src/mcp-capability-descriptor-preview.js";

const modulePath = fileURLToPath(
  new URL(
    "../packages/consent/src/mcp-capability-descriptor-preview.js",
    import.meta.url,
  ),
);

const FIXED_NOW = new Date("2026-05-16T12:00:00.000Z");
const VALID_ARGS = {
  tool_id: "filesystem-reader",
  declared_effects: ["read"],
  denied_effects: ["write", "execute", "call"],
  resource_type: "file",
  consent_field_required: "resource_id",
  sat_verdict_required: "PERMIT",
  now: FIXED_NOW,
};

const OPERATIONS_LIST = ["read", "write", "execute", "call"];
const RESOURCE_TYPES_LIST = ["file", "path", "command", "service"];
const MICRO_CONSENT_SHAPE_LIST = [
  "mission_id",
  "agent_id",
  "resource_id",
  "action",
  "purpose",
  "expires_at",
  "commitment_hash",
];
const GATE_VERDICT_LIST = ["PERMIT", "REJECT", "REVIEW", "SCORE_ONLY"];

test("T-01 builder emits canonical schema, PREVIEW_ONLY mode, DECLARED truth_label", () => {
  const d = buildMcpCapabilityDescriptorPreview(VALID_ARGS);
  assert.equal(d.schema, MCP_CAPABILITY_DESCRIPTOR_PREVIEW_SCHEMA);
  assert.equal(d.schema, "bizra.dema.mcp_capability_descriptor_preview.v0.1");
  assert.equal(d.mode, "PREVIEW_ONLY");
  assert.equal(d.truth_label, "DECLARED");
  assert.equal(d.valid, true);
});

test("T-02 valid descriptor has all required envelope fields", () => {
  const d = buildMcpCapabilityDescriptorPreview(VALID_ARGS);
  assert.equal(d.source, "mcp");
  assert.equal(d.tool_id, VALID_ARGS.tool_id);
  assert.deepEqual(d.declared_effects, VALID_ARGS.declared_effects);
  assert.deepEqual(d.denied_effects, VALID_ARGS.denied_effects);
  assert.equal(d.resource_type, VALID_ARGS.resource_type);
  assert.equal(d.consent_field_required, VALID_ARGS.consent_field_required);
  assert.equal(d.sat_verdict_required, VALID_ARGS.sat_verdict_required);
  assert.equal(d.generated_at, FIXED_NOW.toISOString());
  assert.equal(typeof d.boundary, "object");
});

test("T-03 declared_effects ∩ denied_effects must be empty (fail-closed)", () => {
  const d = buildMcpCapabilityDescriptorPreview({
    ...VALID_ARGS,
    declared_effects: ["read", "write"],
    denied_effects: ["write", "call"],
  });
  assert.equal(d.valid, false);
  assert.ok(d.denial);
  assert.equal(d.denial.code, "effects_overlap");
});

test("T-04 every entry of declared_effects must be in OPERATIONS", () => {
  for (const bad of [["bogus"], ["read", "nope"], [""]]) {
    const d = buildMcpCapabilityDescriptorPreview({
      ...VALID_ARGS,
      declared_effects: bad,
    });
    assert.equal(
      d.valid,
      false,
      `declared_effects ${JSON.stringify(bad)} should be rejected`,
    );
    assert.ok(d.denial);
  }
  for (const op of OPERATIONS_LIST) {
    const d = buildMcpCapabilityDescriptorPreview({
      ...VALID_ARGS,
      declared_effects: [op],
      denied_effects: OPERATIONS_LIST.filter((x) => x !== op),
      // execute/call defensive rule: require REVIEW verdict
      sat_verdict_required:
        op === "execute" || op === "call" ? "REVIEW" : "PERMIT",
    });
    assert.equal(d.valid, true, `OPERATIONS member ${op} should be accepted`);
  }
});

test("T-05 every entry of denied_effects must be in OPERATIONS", () => {
  const d = buildMcpCapabilityDescriptorPreview({
    ...VALID_ARGS,
    denied_effects: ["write", "garbage"],
  });
  assert.equal(d.valid, false);
  assert.ok(d.denial);
});

test("T-06 resource_type must be in RESOURCE_TYPES", () => {
  for (const rt of RESOURCE_TYPES_LIST) {
    const d = buildMcpCapabilityDescriptorPreview({
      ...VALID_ARGS,
      resource_type: rt,
    });
    assert.equal(
      d.valid,
      true,
      `RESOURCE_TYPES member ${rt} should be accepted`,
    );
  }
  for (const bad of ["socket", "", "FILE", null]) {
    const d = buildMcpCapabilityDescriptorPreview({
      ...VALID_ARGS,
      resource_type: bad,
    });
    assert.equal(
      d.valid,
      false,
      `resource_type ${JSON.stringify(bad)} should be rejected`,
    );
    assert.ok(d.denial);
  }
});

test("T-07 consent_field_required must be in MICRO_CONSENT_SHAPE or null", () => {
  for (const field of MICRO_CONSENT_SHAPE_LIST) {
    const d = buildMcpCapabilityDescriptorPreview({
      ...VALID_ARGS,
      consent_field_required: field,
    });
    assert.equal(
      d.valid,
      true,
      `MICRO_CONSENT_SHAPE member ${field} should be accepted`,
    );
  }
  const dNull = buildMcpCapabilityDescriptorPreview({
    ...VALID_ARGS,
    consent_field_required: null,
  });
  assert.equal(dNull.valid, true);
  assert.equal(dNull.consent_field_required, null);

  for (const bad of ["bogus_field", "", "MISSION_ID"]) {
    const d = buildMcpCapabilityDescriptorPreview({
      ...VALID_ARGS,
      consent_field_required: bad,
    });
    assert.equal(
      d.valid,
      false,
      `consent_field_required ${JSON.stringify(bad)} should be rejected`,
    );
    assert.ok(d.denial);
  }
});

test("T-08 sat_verdict_required must be in GateVerdict", () => {
  for (const verdict of GATE_VERDICT_LIST) {
    const d = buildMcpCapabilityDescriptorPreview({
      ...VALID_ARGS,
      // when verdict is REVIEW, declared_effects can include execute/call; otherwise only read/write
      declared_effects: ["read"],
      denied_effects: ["write", "execute", "call"],
      sat_verdict_required: verdict,
    });
    assert.equal(
      d.valid,
      true,
      `GateVerdict member ${verdict} should be accepted`,
    );
  }
  for (const bad of ["ALLOW", "permit", "", null]) {
    const d = buildMcpCapabilityDescriptorPreview({
      ...VALID_ARGS,
      sat_verdict_required: bad,
    });
    assert.equal(
      d.valid,
      false,
      `sat_verdict_required ${JSON.stringify(bad)} should be rejected`,
    );
    assert.ok(d.denial);
  }
});

test("T-09 invocable_now is always false (v0.1 invariant)", () => {
  const d = buildMcpCapabilityDescriptorPreview(VALID_ARGS);
  assert.equal(d.invocable_now, false);
});

test("T-10 boundary contains all 8 authority flags, all false", () => {
  const d = buildMcpCapabilityDescriptorPreview(VALID_ARGS);
  for (const key of [
    "runtime",
    "federation",
    "mint",
    "mcp_server_invoked",
    "network_used",
    "credential_persisted",
    "authority_imported",
    "remote_access_granted",
  ]) {
    assert.equal(d.boundary[key], false, `boundary.${key} must be false`);
  }
  assert.equal(Object.keys(d.boundary).length, 8);
});

test("T-11 deterministic: same inputs produce deeply-equal output", () => {
  const a = buildMcpCapabilityDescriptorPreview(VALID_ARGS);
  const b = buildMcpCapabilityDescriptorPreview(VALID_ARGS);
  assert.deepEqual(a, b);
});

test("T-12 fresh references: same inputs produce distinct object references (no shared mutation)", () => {
  const a = buildMcpCapabilityDescriptorPreview(VALID_ARGS);
  const b = buildMcpCapabilityDescriptorPreview(VALID_ARGS);
  assert.notStrictEqual(a, b);
  assert.notStrictEqual(a.declared_effects, b.declared_effects);
  assert.notStrictEqual(a.denied_effects, b.denied_effects);
  assert.notStrictEqual(a.boundary, b.boundary);
});

test("T-13 descriptor is deeply frozen", () => {
  const d = buildMcpCapabilityDescriptorPreview(VALID_ARGS);
  assert.ok(Object.isFrozen(d));
  assert.ok(Object.isFrozen(d.boundary));
  assert.ok(Object.isFrozen(d.declared_effects));
  assert.ok(Object.isFrozen(d.denied_effects));
});

test("T-14 fail-closed on invalid tool_id (empty, non-string, missing)", () => {
  for (const bad of [
    { tool_id: "" },
    { tool_id: "   " },
    { tool_id: null },
    { tool_id: 42 },
    { tool_id: undefined },
  ]) {
    const d = buildMcpCapabilityDescriptorPreview({ ...VALID_ARGS, ...bad });
    assert.equal(d.valid, false);
    assert.ok(d.denial);
    assert.equal(d.invocable_now, false);
    assert.equal(d.boundary.runtime, false);
  }
});

test("T-15 defensive rule: declared_effects containing execute or call requires sat_verdict REVIEW", () => {
  for (const op of ["execute", "call"]) {
    const denied = OPERATIONS_LIST.filter((x) => x !== op);
    const dBad = buildMcpCapabilityDescriptorPreview({
      ...VALID_ARGS,
      declared_effects: [op],
      denied_effects: denied,
      sat_verdict_required: "PERMIT",
    });
    assert.equal(dBad.valid, false, `${op} without REVIEW must fail-closed`);
    assert.equal(dBad.denial.code, "execute_or_call_requires_review");

    const dOk = buildMcpCapabilityDescriptorPreview({
      ...VALID_ARGS,
      declared_effects: [op],
      denied_effects: denied,
      sat_verdict_required: "REVIEW",
    });
    assert.equal(dOk.valid, true);
  }
});

test("T-16 fail-closed envelope keeps invocable_now=false and boundary all false", () => {
  const d = buildMcpCapabilityDescriptorPreview({
    ...VALID_ARGS,
    resource_type: "bogus",
  });
  assert.equal(d.valid, false);
  assert.equal(d.invocable_now, false);
  for (const key of [
    "runtime",
    "federation",
    "mint",
    "mcp_server_invoked",
    "network_used",
    "credential_persisted",
    "authority_imported",
    "remote_access_granted",
  ]) {
    assert.equal(
      d.boundary[key],
      false,
      `fail-closed boundary.${key} must be false`,
    );
  }
});

test("T-17 module is pure (no fs/http/net/child_process imports, no spawn/exec)", async () => {
  const body = await readFile(modulePath, "utf8");
  assert.ok(!/from ['"]node:fs/.test(body), "must not import node:fs");
  assert.ok(!/from ['"]node:http/.test(body), "must not import node:http");
  assert.ok(!/from ['"]node:net/.test(body), "must not import node:net");
  assert.ok(
    !/from ['"]node:child_process/.test(body),
    "must not import node:child_process",
  );
  assert.ok(
    !/spawn\(|execSync\(|execFile\(|spawnSync\(|exec\(/.test(body),
    "must not call spawn/exec*",
  );
});

test("T-18 invalid now (not a Date) produces fail-closed envelope", () => {
  for (const bad of [
    { now: "2026-05-16" },
    { now: 1715865600000 },
    { now: new Date("invalid") },
    { now: null },
  ]) {
    const d = buildMcpCapabilityDescriptorPreview({ ...VALID_ARGS, ...bad });
    assert.equal(
      d.valid,
      false,
      `now ${JSON.stringify(bad.now)} should be rejected`,
    );
    assert.ok(d.denial);
  }
});
