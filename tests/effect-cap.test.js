import test from "node:test";
import assert from "node:assert/strict";

import { decideEffectCap } from "../packages/capabilities/src/effect-cap.js";
import { buildConsentHashTable } from "../packages/consent/src/consent-hash-table.js";

const NOW = new Date("2026-05-14T10:00:00.000Z");
const FUTURE = "2026-05-14T11:00:00.000Z";

function table() {
  return buildConsentHashTable({
    permissions: [
      {
        resource_type: "command",
        resource_id: "npm-test",
        operation: "execute",
        purpose: "run bounded verification command",
        expires_at: FUTURE
      }
    ],
    now: NOW
  });
}

function request(overrides = {}) {
  return {
    resource_type: "command",
    resource_id: "npm-test",
    operation: "execute",
    purpose: "verify mission result",
    ...overrides
  };
}

test("EffectCap decision is schema-tagged and preview-only", () => {
  const consentTable = table();
  const decision = decideEffectCap({
    request: request(),
    consentTable,
    committed_hash: consentTable.commitment_hash,
    now: NOW
  });

  assert.equal(decision.schema, "bizra.dema.effect_cap_decision.v0.1");
  assert.equal(decision.mode, "PREVIEW_ONLY");
  assert.equal(decision.allowed, true);
  assert.equal(decision.boundary.capability_minted, false);
  assert.equal(decision.boundary.execution_enabled, false);
});

test("EffectCap denies without a committed consent hash", () => {
  const decision = decideEffectCap({
    request: request(),
    consentTable: table(),
    now: NOW
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "missing_committed_hash");
});

test("EffectCap re-verifies live ConsentHashTable hash on every decision", () => {
  const consentTable = table();
  const mutated = JSON.parse(JSON.stringify(consentTable));
  mutated.entries[0].purpose = "expanded command authority";

  const decision = decideEffectCap({
    request: request(),
    consentTable: mutated,
    committed_hash: consentTable.commitment_hash,
    now: NOW
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "consent_table_hash_mismatch");
});

test("EffectCap denies exact-scope misses and malformed attempts", () => {
  const consentTable = table();

  assert.equal(
    decideEffectCap({
      request: request({ resource_id: "npm-run-check" }),
      consentTable,
      committed_hash: consentTable.commitment_hash,
      now: NOW
    }).reason,
    "permission_not_found"
  );
  assert.equal(
    decideEffectCap({
      request: request({ operation: "spawn" }),
      consentTable,
      committed_hash: consentTable.commitment_hash,
      now: NOW
    }).reason,
    "unknown_operation"
  );
  assert.equal(
    decideEffectCap({
      request: request({ purpose: "" }),
      consentTable,
      committed_hash: consentTable.commitment_hash,
      now: NOW
    }).reason,
    "missing_purpose"
  );
});

test("EffectCap output survives JSON round trip", () => {
  const consentTable = table();
  const decision = decideEffectCap({
    request: request(),
    consentTable,
    committed_hash: consentTable.commitment_hash,
    now: NOW
  });
  const roundTrip = JSON.parse(JSON.stringify(decision));

  assert.equal(roundTrip.schema, "bizra.dema.effect_cap_decision.v0.1");
  assert.equal(roundTrip.boundary.execution_enabled, false);
});
