export const SHARED_URP_WORLD_PREVIEW_SCHEMA = "bizra.dema.shared_urp_world_preview.v0.1";

const NODES = Object.freeze([
  Object.freeze({ id: "node1", status: "ghost_hold", reachable: false, federation_open: false }),
  Object.freeze({ id: "node2", status: "ghost_hold", reachable: false, federation_open: false }),
  Object.freeze({ id: "node3", status: "ghost_hold", reachable: false, federation_open: false }),
  Object.freeze({ id: "node4", status: "ghost_hold", reachable: false, federation_open: false })
]);

const BOUNDARY = Object.freeze({
  raw_data_exchange: false,
  runtime_delegation: false,
  federation: false,
  economic_settlement: false,
  shared_urp_publish: false,
  cross_node_receipt_emission: false,
  node_connection_attempted: false,
  filesystem_write_performed: false
});

const BLOCKED_ACTIONS = Object.freeze([
  "connect_node1",
  "shared_urp_publish",
  "runtime_start",
  "federation_start",
  "raw_data_exchange",
  "economic_settlement",
  "cross_node_receipt_emit"
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

export function buildSharedUrpWorldPreview() {
  return deepFreeze(clone({
    schema: SHARED_URP_WORLD_PREVIEW_SCHEMA,
    mode: "PREVIEW_ONLY",
    truth_label: "DECLARED",
    status: "locked_preview_only",
    nodes: NODES,
    node_count: NODES.length,
    resource_offers: [],
    skill_offers: [],
    knowledge_pack_manifests: [],
    impact_events: [],
    boundary: BOUNDARY,
    blocked_actions: BLOCKED_ACTIONS,
    next_safe_action: NEXT_SAFE_ACTION,
    unlock_condition: "Node0 bounded diagnostic must close before any shared-URP action is meaningful",
    note: "Shared URP world preview. The world engine is locked. Nodes 1-4 are ghost/hold. No raw data exchange, no runtime delegation, no federation, no economic settlement. Deterministic output."
  }));
}
