export const NODE0_HOMEBASE_STATE_PREVIEW_SCHEMA = "bizra.dema.node0_homebase_state_preview.v0.1";

const PLAYER = "momo";
const PRIMARY_DEVICE = "MSI laptop";
const COMPANION_DEVICE = "Z Fold 6";

const LOCAL_URP_STATUS = "active_local_only";
const SHARED_URP_STATUS = "locked_preview_only";

const PAT_REGISTRY = Object.freeze([
  Object.freeze({ id: "PAT-1", role: "intent_extractor", scope: "local_only" }),
  Object.freeze({ id: "PAT-2", role: "permission_planner", scope: "local_only" }),
  Object.freeze({ id: "PAT-3", role: "evidence_collector", scope: "local_only" }),
  Object.freeze({ id: "PAT-4", role: "consent_drafter", scope: "local_only" }),
  Object.freeze({ id: "PAT-5", role: "mission_proposer", scope: "local_only" }),
  Object.freeze({ id: "PAT-6", role: "receipt_renderer", scope: "local_only" }),
  Object.freeze({ id: "PAT-7", role: "memory_steward", scope: "local_only" })
]);

const SAT_REGISTRY = Object.freeze([
  Object.freeze({ id: "SAT-1", role: "consent_verifier", verdict_surface: "PERMIT|REJECT|REVIEW|SCORE_ONLY" }),
  Object.freeze({ id: "SAT-2", role: "boundary_auditor", verdict_surface: "PERMIT|REJECT|REVIEW|SCORE_ONLY" }),
  Object.freeze({ id: "SAT-3", role: "ihsan_floor_checker", verdict_surface: "PERMIT|REJECT|REVIEW|SCORE_ONLY" }),
  Object.freeze({ id: "SAT-4", role: "evidence_chain_validator", verdict_surface: "PERMIT|REJECT|REVIEW|SCORE_ONLY" }),
  Object.freeze({ id: "SAT-5", role: "step7_gate_keeper", verdict_surface: "PERMIT|REJECT|REVIEW|SCORE_ONLY" })
]);

const BOUNDARY = Object.freeze({
  runtime: false,
  federation: false,
  mint: false,
  node_connection: false,
  economic_settlement: false,
  raw_data_exchange: false,
  step7_authorization_observed: false,
  filesystem_write_performed: false
});

const BLOCKED_ACTIONS = Object.freeze([
  "connect_node1",
  "shared_urp_publish",
  "runtime_start",
  "federation_start",
  "receipt_mint",
  "capability_mint",
  "step7_mint_without_exact_authorization",
  "raw_data_exchange",
  "economic_settlement"
]);

const NEXT_SAFE_ACTION = "continue_preview_only_readiness";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function buildNode0HomebaseStatePreview() {
  return deepFreeze(clone({
    schema: NODE0_HOMEBASE_STATE_PREVIEW_SCHEMA,
    mode: "PREVIEW_ONLY",
    truth_label: "DECLARED",
    player: PLAYER,
    primary_device: PRIMARY_DEVICE,
    companion_device: COMPANION_DEVICE,
    local_urp_status: LOCAL_URP_STATUS,
    shared_urp_status: SHARED_URP_STATUS,
    pat_registry: PAT_REGISTRY,
    pat_count: PAT_REGISTRY.length,
    sat_registry: SAT_REGISTRY,
    sat_count: SAT_REGISTRY.length,
    boundary: BOUNDARY,
    blocked_actions: BLOCKED_ACTIONS,
    next_safe_action: NEXT_SAFE_ACTION,
    note: "Node0 homebase state preview. No I/O, no mutation, no runtime, no federation, no mint, no node connection. Deterministic output."
  }));
}
