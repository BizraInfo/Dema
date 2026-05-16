import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  buildA2aMessageEnvelopePreview,
  A2A_MESSAGE_ENVELOPE_PREVIEW_SCHEMA,
  A2A_MESSAGE_TYPES
} from "../packages/consent/src/a2a-message-envelope-preview.js";

const modulePath = fileURLToPath(new URL("../packages/consent/src/a2a-message-envelope-preview.js", import.meta.url));

const FIXED_NOW = new Date("2026-05-16T11:30:00.000Z");
const VALID_ARGS = {
  from: "pat.architect",
  to: "sat.evidence_guardian",
  mission_id: "M-001",
  message_type: "verification_request",
  effect_level: ["read"],
  claims: ["claim-001", "claim-002"],
  now: FIXED_NOW
};

test("T-01 builder emits canonical schema and PREVIEW_ONLY", () => {
  const env = buildA2aMessageEnvelopePreview(VALID_ARGS);
  assert.equal(env.schema, A2A_MESSAGE_ENVELOPE_PREVIEW_SCHEMA);
  assert.equal(env.schema, "bizra.dema.a2a_message_envelope_preview.v0.1");
  assert.equal(env.mode, "PREVIEW_ONLY");
  assert.equal(env.truth_label, "DECLARED");
  assert.equal(env.valid, true);
});

test("T-02 valid envelope carries every required field", () => {
  const env = buildA2aMessageEnvelopePreview(VALID_ARGS);
  assert.equal(env.from, "pat.architect");
  assert.equal(env.to, "sat.evidence_guardian");
  assert.equal(env.mission_id, "M-001");
  assert.equal(env.message_type, "verification_request");
  assert.deepEqual(env.effect_level, ["read"]);
  assert.deepEqual(env.claims, ["claim-001", "claim-002"]);
  assert.equal(env.generated_at, FIXED_NOW.toISOString());
});

test("T-03 authority_transfer and dispatched are constant-false invariants", () => {
  const env = buildA2aMessageEnvelopePreview(VALID_ARGS);
  assert.equal(env.authority_transfer, false);
  assert.equal(env.dispatched, false);
});

test("T-04 A2A_MESSAGE_TYPES is the frozen canonical enum", () => {
  assert.ok(Object.isFrozen(A2A_MESSAGE_TYPES));
  assert.deepEqual([...A2A_MESSAGE_TYPES], [
    "verification_request",
    "status_query",
    "evidence_share",
    "consent_review_request"
  ]);
  for (const mt of A2A_MESSAGE_TYPES) {
    const env = buildA2aMessageEnvelopePreview({ ...VALID_ARGS, message_type: mt });
    assert.equal(env.valid, true);
    assert.equal(env.message_type, mt);
  }
});

test("T-05 invalid from/to (empty or equal) fail closed", () => {
  for (const bad of [
    { from: "" },
    { to: "" },
    { from: "agent.a", to: "agent.a" },
    { from: 42 },
    { to: null }
  ]) {
    const env = buildA2aMessageEnvelopePreview({ ...VALID_ARGS, ...bad });
    assert.equal(env.valid, false);
    assert.ok(env.denial, "must include denial reason");
  }
});

test("T-06 invalid mission_id fails closed", () => {
  for (const bad of [{ mission_id: "" }, { mission_id: null }, { mission_id: 0 }]) {
    const env = buildA2aMessageEnvelopePreview({ ...VALID_ARGS, ...bad });
    assert.equal(env.valid, false);
    assert.equal(env.denial.code, "invalid_mission_id");
  }
});

test("T-07 unknown message_type rejected", () => {
  const env = buildA2aMessageEnvelopePreview({ ...VALID_ARGS, message_type: "rogue_type" });
  assert.equal(env.valid, false);
  assert.equal(env.denial.code, "invalid_message_type");
});

test("T-08 effect_level outside read-only subset rejected", () => {
  for (const bad of [["write"], ["execute"], ["call"], ["read", "write"], ["mutate"]]) {
    const env = buildA2aMessageEnvelopePreview({ ...VALID_ARGS, effect_level: bad });
    assert.equal(env.valid, false, `effect_level ${JSON.stringify(bad)} must reject`);
    assert.equal(env.denial.code, "invalid_effect_level");
  }
});

test("T-09 effect_level accepts [] and [\"read\"] only", () => {
  const empty = buildA2aMessageEnvelopePreview({ ...VALID_ARGS, effect_level: [] });
  assert.equal(empty.valid, true);
  assert.deepEqual(empty.effect_level, []);
  const read = buildA2aMessageEnvelopePreview({ ...VALID_ARGS, effect_level: ["read"] });
  assert.equal(read.valid, true);
  assert.deepEqual(read.effect_level, ["read"]);
});

test("T-10 claims must be an array of strings; non-array or non-string entries reject", () => {
  for (const bad of [{ claims: "claim-001" }, { claims: null }, { claims: [1, 2] }, { claims: ["ok", null] }]) {
    const env = buildA2aMessageEnvelopePreview({ ...VALID_ARGS, ...bad });
    assert.equal(env.valid, false, `claims=${JSON.stringify(bad.claims)} must reject`);
    assert.equal(env.denial.code, "invalid_claims");
  }
  const empty = buildA2aMessageEnvelopePreview({ ...VALID_ARGS, claims: [] });
  assert.equal(empty.valid, true);
  assert.deepEqual(empty.claims, []);
});

test("T-11 invalid now Date fails closed", () => {
  for (const bad of [{ now: "2026-05-16" }, { now: null }, { now: new Date("not-a-date") }]) {
    const env = buildA2aMessageEnvelopePreview({ ...VALID_ARGS, ...bad });
    assert.equal(env.valid, false);
    assert.equal(env.denial.code, "invalid_now");
  }
});

test("T-12 boundary holds all 7 authority flags false", () => {
  const env = buildA2aMessageEnvelopePreview(VALID_ARGS);
  for (const key of [
    "runtime",
    "federation",
    "mint",
    "a2a_network_call_made",
    "network_used",
    "authority_transferred",
    "cross_node_handoff_executed"
  ]) {
    assert.equal(env.boundary[key], false, `boundary.${key} must be false`);
  }
});

test("T-13 fail-closed envelope still carries schema + boundary", () => {
  const env = buildA2aMessageEnvelopePreview({ ...VALID_ARGS, mission_id: "" });
  assert.equal(env.schema, A2A_MESSAGE_ENVELOPE_PREVIEW_SCHEMA);
  assert.equal(env.mode, "PREVIEW_ONLY");
  assert.equal(env.truth_label, "DECLARED");
  assert.equal(env.valid, false);
  assert.equal(env.boundary.runtime, false);
  assert.equal(env.boundary.authority_transferred, false);
  assert.equal(env.boundary.cross_node_handoff_executed, false);
});

test("T-14 envelope is deeply frozen", () => {
  const env = buildA2aMessageEnvelopePreview(VALID_ARGS);
  assert.ok(Object.isFrozen(env));
  assert.ok(Object.isFrozen(env.boundary));
  assert.ok(Object.isFrozen(env.effect_level));
  assert.ok(Object.isFrozen(env.claims));
});

test("T-15 deterministic: same args produce deeply-equal envelope with fresh references", () => {
  const a = buildA2aMessageEnvelopePreview(VALID_ARGS);
  const b = buildA2aMessageEnvelopePreview(VALID_ARGS);
  assert.deepEqual(a, b);
  assert.notEqual(a, b, "must be a fresh top-level object per call");
  assert.notEqual(a.boundary, b.boundary, "boundary must be a fresh frozen reference per call");
  assert.notEqual(a.claims, b.claims, "claims array must be fresh per call");
});

test("T-16 module is pure (no fs/http/net/child_process imports)", async () => {
  const body = await readFile(modulePath, "utf8");
  assert.ok(!/from ['"]node:fs/.test(body), "must not import node:fs");
  assert.ok(!/from ['"]node:http/.test(body), "must not import node:http");
  assert.ok(!/from ['"]node:net/.test(body), "must not import node:net");
  assert.ok(!/from ['"]node:child_process/.test(body), "must not import node:child_process");
  assert.ok(!/spawn\(|execSync\(|execFile\(|spawnSync\(|fetch\(/.test(body), "must not call spawn/exec/fetch");
});
