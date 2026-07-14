// Pure kernel: validates Node0 agent-fleet role contracts (spec
// docs/superpowers/specs/2026-07-13-node0-agent-fleet-model-architecture-design.md).
// No IO, no clock, no model calls — DESIGNED_NOT_LIVE accounting only.
const SCHEMA = "bizra.node0.agent_role_contract.v0.1";
const TEAMS = Object.freeze({ PAT: { serves: "user", spawn_ceiling: 7 }, SAT: { serves: "system", spawn_ceiling: 5 } });
const AUTHORITY_KEYS = Object.freeze([
  "mint_allowed", "egress_allowed", "corpus_write_allowed", "spawn_widens_authority",
]);
const ROLE_ID_RE = /^(pat|sat)-[a-z0-9][a-z0-9-]*$/;

export function validateAgentRoleContract(c) {
  const blocked_by = [];
  if (!c || typeof c !== "object") return Object.freeze({ ok: false, blocked_by: Object.freeze(["contract_not_object"]) });
  if (c.schema !== SCHEMA) blocked_by.push("schema_invalid");
  if (typeof c.role_id !== "string" || !ROLE_ID_RE.test(c.role_id)) blocked_by.push("role_id_invalid");
  const team = TEAMS[c.team];
  if (!team) blocked_by.push("team_invalid");
  if (team && c.serves !== team.serves) blocked_by.push("serves_team_mismatch");
  if (team && typeof c.role_id === "string" && !c.role_id.startsWith(`${c.team.toLowerCase()}-`)) blocked_by.push("role_id_team_prefix_mismatch");
  if (!c.base_class || typeof c.base_class.family !== "string" || c.base_class.family.length === 0 || typeof c.base_class.size_class !== "string") blocked_by.push("base_class_invalid");
  if (c.adapter_ref !== null && typeof c.adapter_ref !== "string") blocked_by.push("adapter_ref_invalid");
  if (!Number.isInteger(c.spawn_limit) || c.spawn_limit < 0) blocked_by.push("spawn_limit_invalid");
  else if (team && c.spawn_limit > team.spawn_ceiling) blocked_by.push("spawn_limit_exceeds_team_ceiling");
  const auth = c.authority;
  if (!auth || typeof auth !== "object" || AUTHORITY_KEYS.some((k) => typeof auth[k] !== "boolean") || Object.keys(auth).length !== AUTHORITY_KEYS.length) {
    blocked_by.push("authority_shape_invalid");
  } else if (AUTHORITY_KEYS.some((k) => auth[k] === true)) {
    blocked_by.push("authority_flag_true");
  }
  if (c.truth_label !== "DESIGNED_NOT_LIVE") blocked_by.push("truth_label_invalid");
  return Object.freeze({ ok: blocked_by.length === 0, blocked_by: Object.freeze(blocked_by) });
}

export function validateAgentFleet(contracts) {
  const blocked_by = [];
  if (!Array.isArray(contracts)) return Object.freeze({ ok: false, blocked_by: Object.freeze(["fleet_not_array"]), counts: Object.freeze({ pat: 0, sat: 0 }) });
  for (const c of contracts) {
    const r = validateAgentRoleContract(c);
    if (!r.ok) blocked_by.push(`contract_invalid:${c?.role_id ?? "unknown"}`);
  }
  const ids = contracts.map((c) => c?.role_id);
  if (new Set(ids).size !== ids.length) blocked_by.push("role_id_duplicate");
  const pat = contracts.filter((c) => c?.team === "PAT");
  const sat = contracts.filter((c) => c?.team === "SAT");
  if (pat.length !== 7 || sat.length !== 5) blocked_by.push("team_count_invalid");
  const patFamilies = new Set(pat.map((c) => c?.base_class?.family));
  const satFamilies = new Set(sat.map((c) => c?.base_class?.family));
  if ([...patFamilies].some((f) => satFamilies.has(f))) blocked_by.push("base_family_shared_across_teams");
  return Object.freeze({
    ok: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
    counts: Object.freeze({ pat: pat.length, sat: sat.length }),
  });
}
