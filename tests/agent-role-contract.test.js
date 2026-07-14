import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateAgentRoleContract,
  validateAgentFleet,
} from "../packages/core/src/agent-role-contract.js";

const good = Object.freeze({
  schema: "bizra.node0.agent_role_contract.v0.1",
  role_id: "sat-4-security-boundary",
  team: "SAT",
  serves: "system",
  base_class: { family: "deepseek", size_class: "3-4B" },
  adapter_ref: null,
  spawn_limit: 5,
  authority: {
    mint_allowed: false,
    egress_allowed: false,
    corpus_write_allowed: false,
    spawn_widens_authority: false,
  },
  truth_label: "DESIGNED_NOT_LIVE",
});

test("accepts a canonical SAT role contract", () => {
  const r = validateAgentRoleContract(good);
  assert.equal(r.ok, true);
  assert.deepEqual(r.blocked_by, []);
});

test("fail-closed: PAT serving system is blocked", () => {
  const r = validateAgentRoleContract({ ...good, role_id: "pat-x", team: "PAT", serves: "system", spawn_limit: 7 });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("serves_team_mismatch"));
});

test("fail-closed: any true authority flag is blocked", () => {
  const r = validateAgentRoleContract({
    ...good,
    authority: { ...good.authority, mint_allowed: true },
  });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("authority_flag_true"));
});

test("fail-closed: spawn_limit above team ceiling is blocked", () => {
  const r = validateAgentRoleContract({ ...good, spawn_limit: 6 });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("spawn_limit_exceeds_team_ceiling"));
});

test("fail-closed: contract_not_object for non-object input", () => {
  const r1 = validateAgentRoleContract(null);
  assert.equal(r1.ok, false);
  assert.ok(r1.blocked_by.includes("contract_not_object"));
  const r2 = validateAgentRoleContract("not-an-object");
  assert.equal(r2.ok, false);
  assert.ok(r2.blocked_by.includes("contract_not_object"));
});

test("fail-closed: schema_invalid for wrong schema value", () => {
  const r = validateAgentRoleContract({ ...good, schema: "wrong.schema.v0" });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("schema_invalid"));
});

test("fail-closed: role_id_invalid for non-string and malformed role_id", () => {
  const r1 = validateAgentRoleContract({ ...good, role_id: 42 });
  assert.equal(r1.ok, false);
  assert.ok(r1.blocked_by.includes("role_id_invalid"));
  const r2 = validateAgentRoleContract({ ...good, role_id: "SAT-4" });
  assert.equal(r2.ok, false);
  assert.ok(r2.blocked_by.includes("role_id_invalid"));
});

test("fail-closed: team_invalid for unknown team", () => {
  const r = validateAgentRoleContract({ ...good, team: "XAT" });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("team_invalid"));
});

test("fail-closed: role_id_team_prefix_mismatch for wrong prefix", () => {
  const r = validateAgentRoleContract({ ...good, role_id: "pat-4-security", team: "SAT" });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("role_id_team_prefix_mismatch"));
});

test("fail-closed: base_class_invalid for malformed base_class", () => {
  const r1 = validateAgentRoleContract({ ...good, base_class: null });
  assert.equal(r1.ok, false);
  assert.ok(r1.blocked_by.includes("base_class_invalid"));
  const r2 = validateAgentRoleContract({ ...good, base_class: { family: "", size_class: "3-4B" } });
  assert.equal(r2.ok, false);
  assert.ok(r2.blocked_by.includes("base_class_invalid"));
  const r3 = validateAgentRoleContract({ ...good, base_class: { family: "deepseek", size_class: 123 } });
  assert.equal(r3.ok, false);
  assert.ok(r3.blocked_by.includes("base_class_invalid"));
});

test("fail-closed: adapter_ref_invalid for non-null non-string adapter_ref", () => {
  const r = validateAgentRoleContract({ ...good, adapter_ref: 123 });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("adapter_ref_invalid"));
});

test("fail-closed: spawn_limit_invalid for non-integer and negative values", () => {
  const r1 = validateAgentRoleContract({ ...good, spawn_limit: 2.5 });
  assert.equal(r1.ok, false);
  assert.ok(r1.blocked_by.includes("spawn_limit_invalid"));
  const r2 = validateAgentRoleContract({ ...good, spawn_limit: -1 });
  assert.equal(r2.ok, false);
  assert.ok(r2.blocked_by.includes("spawn_limit_invalid"));
});

test("fail-closed: authority_shape_invalid for missing key and extra key", () => {
  const { mint_allowed, ...missingKeyAuthority } = good.authority;
  const r1 = validateAgentRoleContract({ ...good, authority: missingKeyAuthority });
  assert.equal(r1.ok, false);
  assert.ok(r1.blocked_by.includes("authority_shape_invalid"));
  const r2 = validateAgentRoleContract({ ...good, authority: { ...good.authority, extra_flag: false } });
  assert.equal(r2.ok, false);
  assert.ok(r2.blocked_by.includes("authority_shape_invalid"));
});

test("fail-closed: truth_label_invalid for wrong truth_label", () => {
  const r = validateAgentRoleContract({ ...good, truth_label: "MEASURED" });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("truth_label_invalid"));
});

test("fleet: exactly 7 PAT + 5 SAT with disjoint base families", () => {
  const pat = (n) => ({ ...good, role_id: `pat-${n}`, team: "PAT", serves: "user", spawn_limit: 7, base_class: { family: "gemma", size_class: "3-4B" } });
  const sat = (n) => ({ ...good, role_id: `sat-${n}` });
  const fleet = [1, 2, 3, 4, 5, 6, 7].map(pat).concat([1, 2, 3, 4, 5].map(sat));
  const r = validateAgentFleet(fleet);
  assert.equal(r.ok, true);
  assert.deepEqual(r.counts, { pat: 7, sat: 5 });
});

test("fleet fail-closed: shared base family across PAT/SAT is blocked", () => {
  const pat = (n) => ({ ...good, role_id: `pat-${n}`, team: "PAT", serves: "user", spawn_limit: 7, base_class: { family: "deepseek", size_class: "3-4B" } });
  const sat = (n) => ({ ...good, role_id: `sat-${n}` });
  const fleet = [1, 2, 3, 4, 5, 6, 7].map(pat).concat([1, 2, 3, 4, 5].map(sat));
  const r = validateAgentFleet(fleet);
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("base_family_shared_across_teams"));
});

test("fleet fail-closed: duplicate role_id and wrong counts are blocked", () => {
  const r = validateAgentFleet([good, good]);
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("role_id_duplicate"));
  assert.ok(r.blocked_by.includes("team_count_invalid"));
});

test("fleet fail-closed: fleet_not_array for non-array input", () => {
  const r = validateAgentFleet({});
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("fleet_not_array"));
  assert.deepEqual(r.counts, { pat: 0, sat: 0 });
});

test("fleet fail-closed: contract_invalid:<id> propagates an invalid contract in the fleet", () => {
  const pat = (n) => ({ ...good, role_id: `pat-${n}`, team: "PAT", serves: "user", spawn_limit: 7, base_class: { family: "gemma", size_class: "3-4B" } });
  const sat = (n) => ({ ...good, role_id: `sat-${n}` });
  const badPat = { ...pat(1), spawn_limit: 99 };
  const fleet = [badPat, pat(2), pat(3), pat(4), pat(5), pat(6), pat(7)].concat([1, 2, 3, 4, 5].map(sat));
  const r = validateAgentFleet(fleet);
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes(`contract_invalid:${badPat.role_id}`));
});
