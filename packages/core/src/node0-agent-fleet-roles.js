// The 12 Node0 agent role contracts (C0). DESIGNED_NOT_LIVE: these are
// accounting objects, not running agents. PAT base family gemma-class,
// SAT base family deepseek-class (classifier-independence).
const SCHEMA = "bizra.node0.agent_role_contract.v0.1";
const AUTH = Object.freeze({
  mint_allowed: false, egress_allowed: false,
  corpus_write_allowed: false, spawn_widens_authority: false,
});
const role = (team, serves, family, spawn_limit) => (role_id) =>
  Object.freeze({
    schema: SCHEMA, role_id, team, serves,
    base_class: Object.freeze({ family, size_class: "3-4B" }),
    adapter_ref: null, spawn_limit, authority: AUTH,
    truth_label: "DESIGNED_NOT_LIVE",
  });
const pat = role("PAT", "user", "gemma", 7);
const sat = role("SAT", "system", "deepseek", 5);

export const AGENT_FLEET_ROLES = Object.freeze([
  pat("pat-1-archivist"), pat("pat-2-extractor"), pat("pat-3-cartographer"),
  pat("pat-4-scout"), pat("pat-5-applicability-engineer"),
  pat("pat-6-reproduction-engineer"), pat("pat-7-scribe"),
  sat("sat-1-provenance"), sat("sat-2-consent-authority"), sat("sat-3-impact"),
  sat("sat-4-security-boundary"), sat("sat-5-governance-admissibility"),
]);

export const DEMA_ALPHA = Object.freeze({
  role_id: "dema-alpha", team: null, serves: "user",
  base_class: Object.freeze({ family: "whiterabbitneo", size_class: "7-8B" }),
  truth_label: "DESIGNED_NOT_LIVE",
});
