import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  buildConsentHashTablePreview,
  CONSENT_HASH_LOOKUP_PREVIEW_SCHEMA,
  CONSENT_HASH_TABLE_PREVIEW_SCHEMA,
  formatConsentHashTablePreview,
  lookupConsentHashTablePreview,
  verifyConsentHashTablePreview
} from "../packages/consent/src/consent-hash-preview.js";
import { sha256, stableStringify } from "../packages/consent/src/consent-common.js";
import { buildConsentPlanPreview } from "../packages/consent/src/consent-planner.js";

const modulePath = fileURLToPath(new URL("../packages/consent/src/consent-hash-preview.js", import.meta.url));
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));
const checkPath = fileURLToPath(new URL("../scripts/check.mjs", import.meta.url));
const architecturePath = fileURLToPath(new URL("../docs/ARCHITECTURE.md", import.meta.url));
const fixedNow = new Date("2026-05-15T00:00:00.000Z");
const expiresAt = "2026-05-16T00:00:00.000Z";

function makePlan(overrides = {}) {
  return {
    schema: "bizra.dema.consent_plan_preview.v0.1",
    commitment_hash: "plan-hash-test",
    permissions: [
      {
        resource_id: "file:auth.py",
        action: "read",
        purpose: "inspect referenced file for mission context",
        reason: "file path mentioned in intent",
        confidence: 0.78,
        requires_human_consent: false
      },
      {
        resource_id: "file:auth.py",
        action: "write",
        purpose: "apply requested change only to referenced file",
        reason: "write verb plus explicit file path",
        confidence: 0.78,
        requires_human_consent: true
      },
      {
        resource_id: "command:pytest",
        action: "execute",
        purpose: "verify mission result with bounded test command",
        reason: "pytest mentioned in intent",
        confidence: 0.84,
        requires_human_consent: true
      }
    ],
    ...overrides
  };
}

function build(overrides = {}) {
  return buildConsentHashTablePreview({
    plan: makePlan(),
    expiresAt,
    now: fixedNow,
    ...overrides
  });
}

test("buildConsentHashTablePreview emits a schema-tagged preview without authority", () => {
  const table = build();

  assert.equal(table.schema, CONSENT_HASH_TABLE_PREVIEW_SCHEMA);
  assert.equal(table.mode, "PREVIEW_ONLY");
  assert.equal(table.truth_label, "DECLARED");
  assert.equal(table.valid, true);
  assert.equal(table.boundary.approval_recorded, false);
  assert.equal(table.boundary.runtime_execution, false);
  assert.equal(table.boundary.execution_enabled, false);
  assert.equal(table.boundary.mutation_performed, false);
  assert.equal(table.boundary.filesystem_write_performed, false);
  assert.equal(table.boundary.capability_minted, false);
  assert.equal(table.boundary.receipt_minted, false);
  assert.equal(table.boundary.network_connection_attempted, false);
  assert.equal(table.boundary.federation_initiated, false);
  assert.equal(table.boundary.step7_mint_performed, false);
  assert.match(table.commitment_hash, /^sha256:[0-9a-f]{64}$/);
});

test("builder can derive the table from current consent plan intent", () => {
  const table = buildConsentHashTablePreview({
    intent: "Audit Downloads and send to Slack",
    expiresAt,
    now: fixedNow
  });

  assert.equal(table.source.plan_schema, "bizra.dema.consent_plan_preview.v0.1");
  assert.ok(table.entries.some((entry) => entry.key === "path:Downloads:read"));
  assert.ok(table.entries.some((entry) => entry.key === "service:slack:call"));
});

test("commitment is deterministic, JSON-safe, and fresh", () => {
  const first = build();
  const second = build();

  assert.equal(first.commitment_hash, second.commitment_hash);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first);

  first.entries[0].purpose = "mutated";
  first.boundary.execution_enabled = true;
  const third = build();

  assert.notEqual(third.entries[0].purpose, "mutated");
  assert.equal(third.boundary.execution_enabled, false);
});

test("permissions normalize into exact keys and source permission hashes", () => {
  const table = build();
  const keys = table.entries.map((entry) => entry.key);

  assert.deepEqual(keys, [
    "command:pytest:execute",
    "file:auth.py:read",
    "file:auth.py:write"
  ]);

  const readEntry = table.entries.find((entry) => entry.key === "file:auth.py:read");
  assert.equal(readEntry.resource_type, "file");
  assert.equal(readEntry.resource_id, "auth.py");
  assert.equal(readEntry.operation, "read");
  assert.equal(readEntry.expires_at, expiresAt);

  const original = makePlan().permissions[0];
  assert.equal(readEntry.source_permission_hash, `sha256:${sha256(stableStringify(original))}`);
});

test("invalid permissions and revocations become denials without throwing", () => {
  const table = build({
    plan: makePlan({
      permissions: [
        ...makePlan().permissions,
        null,
        { resource_id: "socket:prod", action: "read", purpose: "bad resource" },
        { resource_id: "file:auth.py", action: "delete", purpose: "bad operation" },
        { resource_id: "file:   ", action: "read", purpose: "blank resource tail" },
        { resource_id: "file:auth.py", action: "read" }
      ]
    }),
    revoked: [
      null,
      { key: "file:auth.py:write", revoked_at: "bad", reason: "x" },
      { key: "file:auth.py:write", revoked_at: fixedNow.toISOString() }
    ]
  });

  assert.equal(table.valid, false);
  assert.deepEqual(table.denials.map((item) => item.code), [
    "invalid_permission",
    "unknown_resource_type",
    "unknown_operation",
    "missing_resource_id",
    "missing_purpose",
    "invalid_revocation",
    "invalid_revoked_at",
    "missing_revocation_reason"
  ]);
});

test("expiresAt is required but expired scopes are represented for lookup denial", () => {
  const missing = buildConsentHashTablePreview({
    plan: makePlan(),
    now: fixedNow
  });
  assert.equal(missing.valid, false);
  assert.ok(missing.denials.every((item) => item.code === "missing_expiry"));
  assert.equal(missing.entries.length, 0);

  const expired = build({ expiresAt: "2026-05-14T00:00:00.000Z" });
  assert.equal(expired.valid, true);
  assert.equal(expired.entries.length, 3);
  assert.equal(
    lookupConsentHashTablePreview(expired, {
      resource_type: "file",
      resource_id: "auth.py",
      operation: "read"
    }, { now: fixedNow }).reason,
    "expired_scope"
  );
});

test("invalid now input returns preview denials instead of throwing", () => {
  const fromPlan = build({ now: null });
  assert.equal(fromPlan.valid, false);
  assert.equal(fromPlan.denials[0].code, "invalid_now");

  const fromInvalidDate = build({ now: new Date("not-a-date") });
  assert.equal(fromInvalidDate.valid, false);
  assert.equal(fromInvalidDate.denials[0].code, "invalid_now");

  const fromIntent = buildConsentHashTablePreview({
    intent: "Fix auth.py",
    expiresAt,
    now: "invalid"
  });
  assert.equal(fromIntent.valid, false);
  assert.equal(fromIntent.denials[0].code, "invalid_now");

  const lookup = lookupConsentHashTablePreview(build(), {
    resource_type: "file",
    resource_id: "auth.py",
    operation: "read"
  }, { now: null });
  assert.equal(lookup.allowed, false);
  assert.equal(lookup.not_an_authorization, true);
  assert.equal(lookup.reason, "invalid_now");

  assert.equal(
    lookupConsentHashTablePreview(build(), {
      resource_type: "file",
      resource_id: "auth.py",
      operation: "read"
    }, { now: 123 }).reason,
    "invalid_now"
  );
});

test("verification recomputes commitment and detects entry tampering", () => {
  const table = build();
  assert.equal(verifyConsentHashTablePreview(table).ok, true);

  const tampered = {
    ...table,
    entries: table.entries.map((entry) => (
      entry.key === "file:auth.py:read" ? { ...entry, purpose: "changed" } : entry
    ))
  };
  const verdict = verifyConsentHashTablePreview(tampered);

  assert.equal(verdict.schema, "bizra.dema.consent_hash_table_verification_preview.v0.1");
  assert.equal(verdict.ok, false);
  assert.equal(verdict.actual_commitment_hash, table.commitment_hash);
});

test("lookup is exact, non-authorizing, and deny-by-default", () => {
  const table = build();
  const allowed = lookupConsentHashTablePreview(table, {
    resource_type: "file",
    resource_id: "auth.py",
    operation: "read"
  }, { now: fixedNow });

  assert.equal(allowed.schema, CONSENT_HASH_LOOKUP_PREVIEW_SCHEMA);
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.not_an_authorization, true);
  assert.equal(allowed.reason, "exact_consent_scope_found");

  assert.equal(
    lookupConsentHashTablePreview(table, {
      resource_type: "file",
      resource_id: "auth.py",
      operation: "execute"
    }, { now: fixedNow }).reason,
    "permission_not_found"
  );
  assert.equal(
    lookupConsentHashTablePreview(table, {
      resource_type: "socket",
      resource_id: "prod",
      operation: "read"
    }, { now: fixedNow }).reason,
    "unknown_resource_type"
  );
  assert.equal(
    lookupConsentHashTablePreview(table, null, { now: fixedNow }).reason,
    "invalid_request"
  );
});

test("lookup denies revoked scope before expiry", () => {
  const table = build({
    expiresAt: "2026-05-14T00:00:00.000Z",
    revoked: [
      {
        key: "file:auth.py:read",
        revoked_at: fixedNow.toISOString(),
        reason: "operator narrowed scope"
      }
    ]
  });
  const result = lookupConsentHashTablePreview(table, {
    resource_type: "file",
    resource_id: "auth.py",
    operation: "read"
  }, { now: fixedNow });

  assert.equal(result.allowed, false);
  assert.equal(result.not_an_authorization, true);
  assert.equal(result.reason, "revoked_scope");
});

test("lookup denies when commitment mismatches", () => {
  const table = build();
  const result = lookupConsentHashTablePreview({
    ...table,
    commitment_hash: "sha256:bad"
  }, {
    resource_type: "file",
    resource_id: "auth.py",
    operation: "read"
  }, { now: fixedNow });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "commitment_hash_mismatch");
  assert.equal(result.integrity.ok, false);
});

test("source plan hash is bound but denials are not bound into commitment", () => {
  const table = build();
  const swappedSource = {
    ...table,
    source: {
      ...table.source,
      plan_commitment_hash: "different-plan-hash"
    }
  };
  assert.equal(verifyConsentHashTablePreview(swappedSource).ok, false);

  const withDenials = build({
    plan: makePlan({
      commitment_hash: table.source.plan_commitment_hash,
      permissions: [
        ...makePlan().permissions,
        { resource_id: "bad", action: "read", purpose: "debug denial only" }
      ]
    })
  });
  assert.equal(withDenials.valid, false);
  assert.equal(withDenials.commitment_hash, table.commitment_hash);
});

test("builder does not mutate plan or revoked inputs", () => {
  const plan = makePlan();
  const revoked = [
    {
      key: "file:auth.py:write",
      revoked_at: fixedNow.toISOString(),
      reason: "operator narrowed scope",
      ignored: "drop me"
    }
  ];
  const beforePlan = JSON.stringify(plan);
  const beforeRevoked = JSON.stringify(revoked);

  const table = build({ plan, revoked });

  assert.equal(JSON.stringify(plan), beforePlan);
  assert.equal(JSON.stringify(revoked), beforeRevoked);
  assert.equal(table.revocations[0].ignored, undefined);
});

test("semantic object key order does not affect commitment", () => {
  const permissionA = {
    resource_id: "file:auth.py",
    action: "read",
    purpose: "inspect referenced file for mission context",
    reason: "file path mentioned in intent",
    confidence: 0.78,
    requires_human_consent: false
  };
  const permissionB = {
    requires_human_consent: false,
    confidence: 0.78,
    reason: "file path mentioned in intent",
    purpose: "inspect referenced file for mission context",
    action: "read",
    resource_id: "file:auth.py"
  };

  const first = build({ plan: makePlan({ permissions: [permissionA] }) });
  const second = build({ plan: makePlan({ permissions: [permissionB] }) });

  assert.equal(first.commitment_hash, second.commitment_hash);
});

test("formatConsentHashTablePreview renders plain no-authority text", () => {
  const output = formatConsentHashTablePreview(build());

  assert.match(output, /DEMA ConsentHashTable Preview/);
  assert.match(output, /not an authorization/);
  assert.match(output, /no capability mint/);
  assert.match(output, /no Step 7 mint/);
  assert.doesNotMatch(output, /\x1b\[/);
});

test("consent hash preview source has no external implementation or side-effect imports", async () => {
  const source = await readFile(modulePath, "utf8");

  assert.doesNotMatch(source, /Dema-amana-kernel-contracts|Downloads/);
  assert.doesNotMatch(source, /\brequire\s*\(/);
  assert.doesNotMatch(source, /\bimport\s*\(/);
  assert.doesNotMatch(source, /\bcreateRequire\b/);
  assert.doesNotMatch(source, /from "node:(?:fs|fs\/promises|net|http|https|http2|tls|dgram|dns|child_process|worker_threads|vm|cluster|repl)"/);
  assert.doesNotMatch(source, /\beval\s*\(/);
  assert.doesNotMatch(source, /\bnew\s+Function\s*\(/);
  assert.doesNotMatch(source, /\b(?:writeFile|appendFile|mkdir|rename|unlink|createWriteStream|fetch)\b/);
});

test("pure module slice has no CLI, smoke, or architecture command wiring", async () => {
  const [cliSource, checkSource, architectureSource] = await Promise.all([
    readFile(cliPath, "utf8"),
    readFile(checkPath, "utf8"),
    readFile(architecturePath, "utf8")
  ]);

  assert.doesNotMatch(cliSource, /consent hash preview/);
  assert.doesNotMatch(checkSource, /consent", "hash", "preview/);
  assert.doesNotMatch(architectureSource, /dema consent hash preview/);
});

test("current consent planner commitment remains unchanged", () => {
  const plan = buildConsentPlanPreview({
    intent: "Fix auth.py and run pytest",
    now: fixedNow
  });

  assert.equal(plan.commitment_hash, sha256(stableStringify(plan.permissions)));
});
