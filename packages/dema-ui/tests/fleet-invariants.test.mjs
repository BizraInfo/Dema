// Fleet invariants — runtime checks against the ONE typed source (fleet-canon.ts,
// zero relative imports, safe under node's native TS stripping) plus static
// reference checks against data.ts / ecosystem.ts (plain text, no import needed).
// Run: node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  FLEET_ROLES,
  PAT_ROLES,
  SAT_ROLES,
  DEMA_ALPHA,
} from "../src/lib/game/fleet-canon.ts";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

test("PAT roles == 7 (derived from PAT_ROLES.length)", () => {
  assert.equal(PAT_ROLES.length, 7);
});

test("SAT roles == 5 (derived from SAT_ROLES.length)", () => {
  assert.equal(SAT_ROLES.length, 5);
});

test("fleet == 12 (derived from FLEET_ROLES.length, and PAT+SAT sum)", () => {
  assert.equal(FLEET_ROLES.length, 12);
  assert.equal(FLEET_ROLES.length, PAT_ROLES.length + SAT_ROLES.length);
});

test("every fleet role's team-derived count matches its bucket array", () => {
  const patCount = FLEET_ROLES.filter((r) => r.team === "PAT").length;
  const satCount = FLEET_ROLES.filter((r) => r.team === "SAT").length;
  assert.equal(patCount, PAT_ROLES.length);
  assert.equal(satCount, SAT_ROLES.length);
});

test("alpha == 1, outside the fleet, team null, not present in FLEET_ROLES", () => {
  assert.equal(DEMA_ALPHA.team, null);
  assert.equal(DEMA_ALPHA.outside_fleet, true);
  assert.equal(
    FLEET_ROLES.some((r) => r.roleId === DEMA_ALPHA.roleId),
    false,
    "DEMA_ALPHA must not be counted inside FLEET_ROLES"
  );
});

test("display identities == 13 (12 fleet + 1 alpha, derived from arrays)", () => {
  const displayIdentities = FLEET_ROLES.length + 1;
  assert.equal(displayIdentities, 13);
});

test("no duplicate role_id across the fleet", () => {
  const ids = FLEET_ROLES.map((r) => r.roleId);
  assert.equal(new Set(ids).size, ids.length);
});

test("data.ts derives fleet fields from fleet-canon (no rival hardcoded roster)", () => {
  const src = read("src/lib/game/data.ts");
  assert.ok(
    /from\s+"\.\/fleet-canon"/.test(src),
    "data.ts must import fleet-canon.ts as its fleet-binding source"
  );
  // no re-hardcoded team/serves/family/truthLabel block should remain — every
  // agent binds via fleetBinding(...) / alphaBinding, not literal fields.
  assert.equal(
    /\n\s*team:\s*"(PAT|SAT)",\n\s*serves:\s*"(user|system)",\n\s*family:\s*"(gemma|deepseek)",/.test(src),
    false,
    "data.ts must not re-hardcode team/serves/family literals — derive via fleetBinding()"
  );
});

test("ecosystem.ts ORG_AGENTS is explicitly labelled as a non-fleet roster", () => {
  const src = read("src/lib/game/ecosystem.ts");
  assert.ok(
    /NON-FLEET/.test(src),
    "ecosystem.ts must label ORG_AGENTS as non-fleet, not a rival authoritative roster"
  );
});
