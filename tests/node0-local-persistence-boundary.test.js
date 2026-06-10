/**
 * ADR-036 Node0 Local Persistence Boundary - Test-only scaffold
 * [PROTOTYPE]
 * [DESIGNED_NOT_LIVE]
 * TEST_BOUNDARY_ONLY
 *
 * This scaffold proves the Section 3 data/persistence boundary document exists
 * and carries local-only persistence constraints. It does not implement a
 * receipt log, digest log, layer index writer, schema migration engine,
 * backup/restore, rollback, Data Lake mutation, public publication, token
 * logic, contract logic, marketplace behavior, or Shariah-compliance claim.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const adr = () =>
  readFileSync(
    new URL(
      "../docs/06-adr/ADR-036-node0-local-persistence-boundary.md",
      import.meta.url,
    ),
    "utf8",
  );

test("ADR-036 defines the local persistence boundary without writer implementation", () => {
  const text = adr();
  assert.match(text, /local persistence boundary/i);
  assert.match(text, /No implementation/i);
  assert.match(text, /No filesystem writes/i);
  assert.match(text, /\[PROTOTYPE\]/);
  assert.match(text, /\[DESIGNED_NOT_LIVE\]/);
  assert.match(text, /LOCAL_ONLY/);
});

test("ADR-036 defines what may be stored locally", () => {
  const text = adr();
  for (const allowed of [
    "append-only receipt log expectation",
    "local digest log expectation",
    "local layer index file expectation",
    "schema migration plan",
    "runtime trace ID",
    "proof gaps",
    "still-blocked invariants",
  ]) {
    assert.match(text, new RegExp(allowed, "i"));
  }
});

test("ADR-036 defines what must never be stored", () => {
  const text = adr();
  for (const forbidden of [
    "credentials",
    "private keys",
    "tokens",
    "raw secrets",
    "public URL",
    "reward authorization",
    "contract call",
    "marketplace signal",
    "Shariah-compliant label",
  ]) {
    assert.match(text, new RegExp(forbidden, "i"));
  }
});

test("ADR-036 carries append-only receipt, digest, and layer-index boundaries", () => {
  const text = adr();
  assert.match(text, /append-only receipt log/i);
  assert.match(text, /local digest log/i);
  assert.match(text, /local layer index file/i);
  assert.match(text, /boundary approval/i);
  assert.match(text, /schema migrations/i);
});

test("ADR-036 carries backup, restore, corruption, rollback, retention, and privacy boundaries", () => {
  const text = adr();
  assert.match(text, /backup and restore/i);
  assert.match(text, /corruption detection/i);
  assert.match(text, /rollback/i);
  assert.match(text, /data retention policy/i);
  assert.match(text, /local privacy policy/i);
});

test("ADR-036 blocks Data Lake mutation and all public or economic activation", () => {
  const text = adr();
  assert.match(text, /Prevent Data Lake mutation/i);
  assert.match(text, /NO_DATA_LAKE_MUTATION/);
  assert.match(text, /NO_NODE1/);
  assert.match(text, /NO_PUBLIC_URP_BRIDGE/);
  assert.match(text, /NO_TOKEN_LOGIC/);
  assert.match(text, /NO_SHARIAH_COMPLIANCE_CLAIM/);
});

test("ADR-036 next micro remains scaffold only", () => {
  const text = adr();
  assert.match(text, /GO: NODE0 LOCAL PERSISTENCE TEST SCAFFOLD/);
  assert.doesNotMatch(text, /GO: NODE0 LOCAL PERSISTENCE IMPLEMENTATION/);
});
