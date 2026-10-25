import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { readOwner, resolveTrustedRequirement } from "../src/app/api/mission/trusted-requirement.ts";
import { readTrustedOwnerFixture } from "./trusted-requirement-fixtures.mjs";
import { evaluateTaskRequirement } from "../../core/src/bizra-prompt-mission-bridge.js";

const NOW = "2026-10-13T20:30:00.000Z";
const MISSION = "BIZRA-GENESIS-LOCAL-MISSION-0";
const policy = () => process.env.BIZRA_1TR1_TEST_POLICY_FILE
  ? fs.readFileSync(process.env.BIZRA_1TR1_TEST_POLICY_FILE) : Buffer.from(JSON.stringify({
  schema: "bizra.node0.1tr1.test_policy.v1", id: "NODE0-MOMO-TRUSTED-REQUIREMENT-ROUTE-INTEGRATION-1T-R1",
  authority_ref: "GO NODE0-MOMO-TRUSTED-REQUIREMENT-ROUTE-INTEGRATION-1T-R1",
  scope: "ISOLATED_NONEXECUTING_TEST_ONLY", task_id: MISSION, required_operation: "METADATA_INVENTORY_READ_ONLY",
  valid_from: "2026-10-13T20:26:59.532196Z", expires_at: "2026-10-13T21:56:59.532196Z", revoked: false,
}));

test("pinned owner snapshots preserve brief mismatch and production-policy refusal", () => {
  const read_owner = readTrustedOwnerFixture;
  const negative = resolveTrustedRequirement("TASK-075.26", { read_owner });
  assert.equal(evaluateTaskRequirement(negative, NOW).verdict, "BLOCKED_UNSUPPORTED_OPERATION");
  const positive = resolveTrustedRequirement(MISSION, { read_owner });
  assert.equal(positive.policy, null);
  assert.equal(evaluateTaskRequirement(positive, NOW).verdict, "PRODUCTION_REQUIREMENT_POLICY_UNBOUND");
  assert.equal(resolveTrustedRequirement("/arbitrary/caller/path", { read_owner }), null);
  assert.equal(resolveTrustedRequirement(undefined, { read_owner }), null);
});

test("explicit test dependency binds raw policy bytes and produces only a preview", () => {
  const bytes = policy();
  const requirement = resolveTrustedRequirement(MISSION, { read_owner: readTrustedOwnerFixture, test_policy_bytes: bytes });
  assert.equal(requirement.policy.hash, "sha256:" + createHash("sha256").update(bytes).digest("hex"));
  assert.equal(evaluateTaskRequirement(requirement, NOW).verdict, "OPERATION_MATCH_PREVIEW_ONLY");
  assert.equal(requirement.execution_allowed, false);
  assert.equal(requirement.authority_delta, 0);
  assert.throws(() => resolveTrustedRequirement(MISSION, { read_owner: readTrustedOwnerFixture, test_policy_bytes: Buffer.from("{}") }), /TEST_POLICY_INVALID/);
  assert.throws(() => resolveTrustedRequirement(MISSION, { read_owner: readTrustedOwnerFixture, test_policy_bytes: Buffer.from("{") }));
});

test("drifted, oversized, malformed and unavailable owners cannot bind", () => {
  for (const read_owner of [
    () => Buffer.from("forged owner"), () => Buffer.alloc(262145),
    () => "not bytes", () => { throw Error("ELOOP"); }, () => { throw Error("ENOENT"); },
  ]) assert.throws(() => resolveTrustedRequirement(MISSION, { read_owner }));
});

test("owner fixtures refuse paths outside the pinned set", () => {
  assert.throws(() => readTrustedOwnerFixture("/unexpected/owner"), /TEST_OWNER_FIXTURE_UNAVAILABLE/);
});

test("exact fixed task title improves refusal classification without admitting missing task identity", () => {
  const negative = resolveTrustedRequirement(undefined, {
    read_owner: readTrustedOwnerFixture,
    source_text: "Source-cited Node0 status brief through one governed mission",
  });
  assert.equal(evaluateTaskRequirement(negative, NOW).verdict, "BLOCKED_UNSUPPORTED_OPERATION");
  assert.equal(resolveTrustedRequirement(undefined, {
    read_owner: readTrustedOwnerFixture,
    source_text: "Inventory BIZRA metadata.",
  }), null);
});

test("actual directory-descriptor reader rejects symlinks, nonregular files and oversize", () => {
  const root = fs.mkdtempSync(join(tmpdir(), "trusted-owner-"));
  try {
    const file = join(root, "owner");
    fs.writeFileSync(file, "owned bytes", { mode: 0o600 });
    assert.equal(readOwner(file).toString(), "owned bytes");
    fs.symlinkSync(file, join(root, "link"));
    fs.symlinkSync(root, join(root, "parent-link"));
    assert.throws(() => readOwner(join(root, "link")));
    assert.throws(() => readOwner(join(root, "parent-link", "owner")));
    assert.throws(() => readOwner(root));
    fs.writeFileSync(file, Buffer.alloc(262145));
    assert.throws(() => readOwner(file), /TRUSTED_OWNER_SIZE_INVALID/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("actual reader detects bytes changing during its bounded read", () => {
  const root = fs.mkdtempSync(join(tmpdir(), "trusted-owner-drift-"));
  try {
    const file = join(root, "owner");
    fs.writeFileSync(file, "owned bytes", { mode: 0o600 });
    assert.throws(
      () => readOwner(file, {
        readSync: (...args) => {
          const count = fs.readSync(...args);
          fs.appendFileSync(file, "changed");
          return count;
        },
      }),
      /TRUSTED_OWNER_SOURCE_DRIFT/,
    );
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
