const SCHEMA = "bizra.dema.node_network_blueprint.v0.1";

const RELATED_SCHEMAS = [
  "bizra.dema.mission_preview.v0.1",
  "bizra.dema.diagnostics_mission_plan.v0.1",
  "bizra.dema.safety_report_preview.v0.1"
];

const CURRENT_STATE = {
  stage: "node0_plus_dema_local",
  summary:
    "Node0 and Dema are local-first preview surfaces. Node1 and Node2 are not connected.",
  gtm_position:
    "Lighthouse alpha for Sovereign Local AI Node Setup + Safety Audit."
};

const FULL_STACK_LAYERS = [
  {
    id: "product_face",
    owner: "Dema",
    responsibility: "operator CLI, local setup, previews, status, receipts viewer",
    readiness: "measured_local_preview"
  },
  {
    id: "runtime_authority",
    owner: "Node0 / bizra-omega",
    responsibility: "bounded execution, receipt issuance, proof authority",
    readiness: "upstream_required"
  },
  {
    id: "consent_plane",
    owner: "FATE / Amana contracts",
    responsibility: "exact consent scopes, commitments, EffectCap decisions",
    readiness: "contract_first"
  },
  {
    id: "evidence_plane",
    owner: "Node0 receipts",
    responsibility: "hash-linked evidence, replay, audit trail",
    readiness: "first_bounded_receipt_pending"
  },
  {
    id: "network_plane",
    owner: "future Node1 / Node2 handoff",
    responsibility: "federation handshake after Node0 has repeatable local receipts",
    readiness: "blocked_until_node0_receipts_repeat"
  },
  {
    id: "gtm_plane",
    owner: "Dema",
    responsibility: "proof-safe offer language and operator onboarding",
    readiness: "private_lighthouse_only"
  }
];

const READINESS_GATES = [
  {
    id: "node0.local_contracts_landed",
    target: "Node0",
    status: "pending",
    requirement: "Amana contract surfaces are merged and reviewed under exact proof scope."
  },
  {
    id: "node0.bounded_receipt_repeatable",
    target: "Node0",
    status: "blocked",
    requirement: "One boring local diagnostic can produce repeatable governed receipts."
  },
  {
    id: "node1.handoff_contract_defined",
    target: "Node1",
    status: "blocked",
    requirement: "Define handoff request, consent, receipt, rollback, and refusal schemas."
  },
  {
    id: "node1.read_only_probe",
    target: "Node1",
    status: "blocked",
    requirement: "Allow only read-only liveness probe after Node0 receipt repeatability."
  },
  {
    id: "node2.propagation_policy",
    target: "Node2",
    status: "blocked",
    requirement: "Define what cannot propagate: secrets, private data, unsigned claims, and rewards."
  },
  {
    id: "gtm.claim_gate_green",
    target: "GTM",
    status: "review",
    requirement: "Offer copy remains limited to local setup, safety audit, and explicit proof gaps."
  }
];

const LIFECYCLE = [
  {
    phase: "specify",
    output: "node handoff contracts and refusal conditions"
  },
  {
    phase: "prove_locally",
    output: "repeatable Node0 diagnostic receipt before any network handoff"
  },
  {
    phase: "simulate",
    output: "offline Node1/Node2 fixtures with no sockets"
  },
  {
    phase: "authorize",
    output: "exact consent phrase and EffectCap gate for the first live probe"
  },
  {
    phase: "observe",
    output: "receipt-backed monitoring and rollback receipt on failure"
  }
];

const GTM_BLOCKERS = [
  {
    code: "node0.first_bounded_receipt_pending",
    severity: "launch_blocker",
    note: "Node1/Node2 connection cannot start until Node0 proves repeatable local receipts."
  },
  {
    code: "handoff.schema_missing",
    severity: "launch_blocker",
    note: "No Node1/Node2 handoff schema is committed yet."
  },
  {
    code: "network.safety_policy_missing",
    severity: "review",
    note: "Propagation denylist and rollback receipt policy must exist before live probes."
  }
];

const PROPOSED_NEXT_ACTIONS = [
  {
    id: "publish_amana_contracts_pr",
    action:
      "Prepare the already verified Amana contracts PR draft; do not publish without explicit operator authorization."
  },
  {
    id: "add_node_handoff_contract_spec",
    action: "Define Node1/Node2 handoff request, refusal, consent, and receipt schemas."
  },
  {
    id: "build_offline_network_fixture",
    action: "Create an offline fixture that simulates Node1/Node2 state without sockets."
  }
];

const BOUNDARY = {
  scope: "read-only-preview",
  inference_invoked: false,
  execution_enabled: false,
  mutation_performed: false,
  capability_minted: false,
  receipt_minted: false,
  daemon_started: false,
  network_connection_attempted: false,
  federation_initiated: false,
  node_handshake_performed: false,
  outbound_socket_opened: false,
  identity_artifact_issued: false
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function buildNetworkBlueprint() {
  return {
    schema: SCHEMA,
    mode: "PREVIEW_ONLY",
    related_schemas: clone(RELATED_SCHEMAS),
    current_state: clone(CURRENT_STATE),
    full_stack_layers: clone(FULL_STACK_LAYERS),
    readiness_gates: clone(READINESS_GATES),
    lifecycle: clone(LIFECYCLE),
    gtm_blockers: clone(GTM_BLOCKERS),
    proposed_next_actions: clone(PROPOSED_NEXT_ACTIONS),
    boundary: clone(BOUNDARY)
  };
}

function appendRows(lines, rows, render) {
  for (const row of rows) lines.push(`  - ${render(row)}`);
}

export function formatNetworkBlueprint(blueprint) {
  const lines = [
    "DEMA Node Network Blueprint",
    "",
    `Mode: ${blueprint.mode}`,
    `State: ${blueprint.current_state.stage}`,
    `Summary: ${blueprint.current_state.summary}`,
    `GTM: ${blueprint.current_state.gtm_position}`,
    "",
    "Full-stack layers:"
  ];

  appendRows(
    lines,
    blueprint.full_stack_layers,
    (layer) => `${layer.id}  owner="${layer.owner}"  readiness="${layer.readiness}"`
  );

  lines.push("");
  lines.push("Readiness gates:");
  appendRows(
    lines,
    blueprint.readiness_gates,
    (gate) => `${gate.status}: ${gate.id} (${gate.target}) - ${gate.requirement}`
  );

  lines.push("");
  lines.push("Lifecycle:");
  appendRows(lines, blueprint.lifecycle, (phase) => `${phase.phase}: ${phase.output}`);

  lines.push("");
  lines.push("GTM blockers:");
  appendRows(
    lines,
    blueprint.gtm_blockers,
    (blocker) => `${blocker.severity}: ${blocker.code} - ${blocker.note}`
  );

  lines.push("");
  lines.push("Proposed next actions:");
  appendRows(lines, blueprint.proposed_next_actions, (item) => `${item.id}: ${item.action}`);

  lines.push("");
  lines.push(
    "Boundary: preview-only; no network connection; no federation; no handshake; no execution; no mutation; no receipt minted."
  );

  return lines.join("\n");
}
