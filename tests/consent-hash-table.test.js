import test from "node:test";
import assert from "node:assert/strict";

import {
  buildConsentHashTable,
  lookupConsent,
  verifyConsentHashTable
} from "../packages/consent/src/consent-hash-table.js";

const NOW = new Date("2026-05-14T10:00:00.000Z");
const FUTURE = "2026-05-14T11:00:00.000Z";
const PAST = "2026-05-14T09:00:00.000Z";

function scope(overrides = {}) {
  return {
    resource_type: "file",
    resource_id: "auth.py",
    operation: "read",
    purpose: "inspect target file",
    expires_at: FUTURE,
    ...overrides
  };
}

function request(overrides = {}) {
  return {
    resource_type: "file",
    resource_id: "auth.py",
    operation: "read",
    purpose: "attempt bounded effect",
    ...overrides
  };
}

test("ConsentHashTable compiles exact schema-tagged lookup records", () => {
  const table = buildConsentHashTable({
    permissions: [scope(), scope({ operation: "write", purpose: "patch target file" })],
    now: NOW
  });

  assert.equal(table.schema, "bizra.dema.consent_hash_table.v0.1");
  assert.equal(table.mode, "PREVIEW_ONLY");
  assert.equal(table.valid, true);
  assert.equal(table.boundary.execution_enabled, false);
  assert.match(table.commitment_hash, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(table.entries.map((entry) => entry.key), [
    "file:auth.py:read",
    "file:auth.py:write"
  ]);

  const found = lookupConsent(table, request(), { now: NOW });
  assert.equal(found.allowed, true);
  assert.equal(found.key, "file:auth.py:read");
});

test("ConsentHashTable denies invalid resource, operation, purpose, expiry, and expired scope", () => {
  const table = buildConsentHashTable({
    permissions: [
      scope({ resource_type: "gateway" }),
      scope({ operation: "delete" }),
      scope({ purpose: "" }),
      scope({ expires_at: "" }),
      scope({ expires_at: PAST })
    ],
    now: NOW
  });

  assert.equal(table.valid, false);
  assert.deepEqual(table.denials.map((item) => item.code), [
    "unknown_resource_type",
    "unknown_operation",
    "missing_purpose",
    "missing_expiry",
    "expired_scope"
  ]);
});

test("ConsentHashTable lookup is exact and does not widen similar paths", () => {
  const table = buildConsentHashTable({ permissions: [scope()], now: NOW });

  assert.equal(lookupConsent(table, request({ resource_id: "auth.py" }), { now: NOW }).allowed, true);
  assert.equal(lookupConsent(table, request({ resource_id: "Auth.py" }), { now: NOW }).allowed, false);
  assert.equal(lookupConsent(table, request({ resource_id: "auth.py/" }), { now: NOW }).allowed, false);
  assert.equal(lookupConsent(table, request({ operation: "write" }), { now: NOW }).allowed, false);
});

test("ConsentHashTable treats hostile keys as data without prototype collision", () => {
  const table = buildConsentHashTable({
    permissions: [scope({ resource_id: "__proto__", purpose: "inspect literal key" })],
    now: NOW
  });

  assert.equal(table.valid, true);
  assert.equal(Object.prototype.operation, undefined);
  assert.equal(
    lookupConsent(table, request({ resource_id: "__proto__" }), { now: NOW }).allowed,
    true
  );

  const invalid = buildConsentHashTable({
    permissions: [scope({ resource_id: { toString: () => "__proto__" } })],
    now: NOW
  });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.denials[0].code, "missing_resource_id");
});

test("ConsentHashTable commitment detects mutation after compile", () => {
  const table = buildConsentHashTable({ permissions: [scope()], now: NOW });
  const mutated = JSON.parse(JSON.stringify(table));
  mutated.entries[0].purpose = "expanded purpose";

  const integrity = verifyConsentHashTable(mutated);
  assert.equal(integrity.ok, false);
  assert.equal(
    lookupConsent(mutated, request(), { now: NOW }).reason,
    "commitment_hash_mismatch"
  );
});

test("ConsentHashTable outputs survive JSON round trip", () => {
  const table = buildConsentHashTable({ permissions: [scope()], now: NOW });
  const roundTrip = JSON.parse(JSON.stringify(table));

  assert.equal(roundTrip.schema, "bizra.dema.consent_hash_table.v0.1");
  assert.equal(verifyConsentHashTable(roundTrip).ok, true);
});
