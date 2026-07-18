// ============================================================================
// FLEET CANON — ONE typed source for the 12-role BIZRA Node0 agent fleet
// (7 PAT + 5 SAT) + the DEMA_ALPHA face, outside the fleet.
//
// This mirrors (does NOT import) the real kernel shape at
// packages/core/src/node0-agent-fleet-roles.js — role_id spellings match,
// but this is a UI-presentation source, not the live kernel.
//
// truth_label / live_status are always DESIGNED_NOT_LIVE: these are
// accounting objects, not running agents. game/data.ts derives its
// AGENTS presentation list from this array; it is not a rival source.
// ============================================================================

export type FleetTeam = "PAT" | "SAT" | null;

export interface FleetRole {
  roleId: string;
  team: FleetTeam;
  serves: "user" | "system";
  family: string;
  truth_label: "DESIGNED_NOT_LIVE";
  live_status: "DESIGNED_NOT_LIVE";
}

function patRole(roleId: string): FleetRole {
  return {
    roleId,
    team: "PAT",
    serves: "user",
    family: "gemma",
    truth_label: "DESIGNED_NOT_LIVE",
    live_status: "DESIGNED_NOT_LIVE",
  };
}

function satRole(roleId: string): FleetRole {
  return {
    roleId,
    team: "SAT",
    serves: "system",
    family: "deepseek",
    truth_label: "DESIGNED_NOT_LIVE",
    live_status: "DESIGNED_NOT_LIVE",
  };
}

// 7 PAT roles (user-serving, gemma family)
export const PAT_ROLES: FleetRole[] = [
  patRole("pat-1-archivist"),
  patRole("pat-2-extractor"),
  patRole("pat-3-cartographer"),
  patRole("pat-4-scout"),
  patRole("pat-5-applicability-engineer"),
  patRole("pat-6-reproduction-engineer"),
  patRole("pat-7-scribe"),
];

// 5 SAT roles (system-serving, deepseek family)
export const SAT_ROLES: FleetRole[] = [
  satRole("sat-1-provenance"),
  satRole("sat-2-consent-authority"),
  satRole("sat-3-impact"),
  satRole("sat-4-security-boundary"),
  satRole("sat-5-governance-admissibility"),
];

// The 12-role fleet — canonical order, PAT then SAT.
export const FLEET_ROLES: FleetRole[] = [...PAT_ROLES, ...SAT_ROLES];

// DEMA_ALPHA — the 13th display identity. team:null, outside_fleet:true.
// Not counted in FLEET_ROLES; presents, never governs.
export interface DemaAlpha extends FleetRole {
  roleId: "dema-alpha";
  team: null;
  outside_fleet: true;
}

export const DEMA_ALPHA: DemaAlpha = {
  roleId: "dema-alpha",
  team: null,
  serves: "user",
  family: "whiterabbitneo",
  truth_label: "DESIGNED_NOT_LIVE",
  live_status: "DESIGNED_NOT_LIVE",
  outside_fleet: true,
};

export const fleetRoleById = (roleId: string): FleetRole | undefined =>
  FLEET_ROLES.find((r) => r.roleId === roleId);
