// Node0 state preview — first implementation slice of `dema state --json`.
//
// Truth-safe: emits a frozen object tagged with schema bizra.dema.node0_state.v0.1
// and truth_label NODE0_LOCAL_SEED. All runtime / federation / mint / public
// boundaries are pinned to false. Source-of-truth for Node0 + DEMA Goal v0.2.

import { buildPreviewBoundary } from "./preview-boundary.js";

const NODE0_STATE_TRUTH_LABEL = "NODE0_LOCAL_SEED";

export function buildNode0StatePreview({ operator = "MoMo" } = {}) {
  return Object.freeze({
    schema: "bizra.dema.node0_state.v0.1",
    truth_label: NODE0_STATE_TRUTH_LABEL,
    operator,
    node: "Node0",
    mission_centered: true,
    runtime: Object.freeze({
      autonomous_daemon: false,
      federation: false,
      minting: false,
      public_network: false
    }),
    pat: Object.freeze({
      status: "planned_or_preview",
      owner: "human",
      loyalty: "user_mission"
    }),
    sat: Object.freeze({
      status: "policy_preview_or_stub",
      owner: "system",
      loyalty: "system_integrity"
    }),
    local_models: Object.freeze({
      status: "inventory_or_available",
      role: "bounded_supporting_resource",
      routing_allowed: false
    }),
    shared_urp: Object.freeze({
      status: "locked_preview"
    }),
    next_safe_action: "open_homebase_view",
    boundary: buildPreviewBoundary()
  });
}
