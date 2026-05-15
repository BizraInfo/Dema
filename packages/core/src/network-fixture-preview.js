import {
  NETWORK_PREVIEW_BOUNDARY,
  NETWORK_PREVIEW_SELF_CRITIQUE
} from "./network-blueprint.js";

const SCHEMA = "bizra.dema.offline_network_fixture_preview.v0.1";

const FIXTURE_META = {
  fixture_slot_count: 5,
  live_nodes: 0,
  runtime_nodes: 0,
  sockets_opened: 0,
  named_nodes_introduced: false,
  topology_claim: "none",
  fixture_kind: "static_lab_bench_schematic"
};

const FIXTURE_SLOTS = [
  {
    slot: "slot_0",
    role_target: "Node0",
    named_identity: null,
    state: "baseline_reference_only",
    boundary: "does_not_start_node0_runtime"
  },
  {
    slot: "slot_1",
    role_target: "Node1",
    named_identity: null,
    state: "handoff_contract_placeholder",
    boundary: "does_not_start_node1"
  },
  {
    slot: "slot_2",
    role_target: "Node2",
    named_identity: null,
    state: "propagation_policy_placeholder",
    boundary: "does_not_start_node2"
  },
  {
    slot: "slot_3",
    role_target: "phase_3_simulation_slot",
    named_identity: null,
    state: "unnamed_private_pilot_slot",
    boundary: "shape_only_no_named_node"
  },
  {
    slot: "slot_4",
    role_target: "phase_3_simulation_slot",
    named_identity: null,
    state: "unnamed_private_pilot_slot",
    boundary: "shape_only_no_named_node"
  }
];

const STATIC_RELATIONSHIPS = [
  {
    from: "slot_0",
    to: "slot_1",
    relationship: "handoff_shape_only",
    socket_opened: false,
    handshake_performed: false
  },
  {
    from: "slot_0",
    to: "slot_2",
    relationship: "propagation_policy_shape_only",
    socket_opened: false,
    handshake_performed: false
  },
  {
    from: "slot_1",
    to: "slot_3",
    relationship: "private_pilot_shape_only",
    socket_opened: false,
    handshake_performed: false
  },
  {
    from: "slot_2",
    to: "slot_4",
    relationship: "private_pilot_shape_only",
    socket_opened: false,
    handshake_performed: false
  }
];

const INERT_SCENARIOS = [
  {
    id: "partition_shape",
    purpose: "describe how a future partition case would be represented",
    simulation_status: "describes_shape_only",
    executed: false,
    produces_receipt: false,
    not_executed_because: "no runtime in this repo"
  },
  {
    id: "rejoin_shape",
    purpose: "describe how a future rejoin case would be represented",
    simulation_status: "describes_shape_only",
    executed: false,
    produces_receipt: false,
    not_executed_because: "no runtime in this repo"
  },
  {
    id: "adversarial_slot_input_shape",
    purpose: "describe how malformed future slot input would be refused",
    simulation_status: "describes_shape_only",
    executed: false,
    produces_receipt: false,
    not_executed_because: "no runtime in this repo"
  }
];

const MICRO_COMPLIANCE = [
  {
    control: "no_outbound_sockets",
    statement: "fixture preview opens no outbound sockets",
    verified_by: "boundary.outbound_socket_opened === false"
  },
  {
    control: "no_runtime_start",
    statement: "fixture preview starts no runtime or daemon",
    verified_by: "boundary.runtime_started === false && boundary.daemon_started === false"
  },
  {
    control: "no_receipt_or_capability_mint",
    statement: "fixture preview mints no receipt or capability",
    verified_by: "boundary.receipt_minted === false && boundary.capability_minted === false"
  },
  {
    control: "no_identity_artifact",
    statement: "fixture preview issues no identity artifact",
    verified_by: "boundary.identity_artifact_issued === false"
  },
  {
    control: "no_authorization_text",
    statement: "fixture preview emits no reusable operator authorization text",
    verified_by: "boundary.authorization_phrase_emitted === false"
  },
  {
    control: "no_topology_claim",
    statement: "fixture preview makes no live topology claim",
    verified_by: "fixture.topology_claim === 'none'"
  }
];

const MICRO_CONSENT = {
  preview_scope: "offline fixture preview only",
  current_preview_requires_operator_authorization: false,
  future_live_probe_requires_fresh_current_operator_turn: true,
  phrase_emitted: false,
  approval_recorded: false,
  reusable_authorization_created: false,
  broad_consent_allowed: false
};

const ANALOGICAL_MODEL = {
  analogy: "static lab bench schematic",
  useful_because:
    "a schematic can show slots, refusals, and expected wires without powering a device",
  not_analogous_to: [
    "live network",
    "airport runway",
    "wind tunnel",
    "security testbed"
  ],
  boundary: "paper_model_not_running_system"
};

const SELF_PROACTIVE_HARNESS = {
  mode: "deterministic_preview_checks",
  checks: [
    "report 0 live nodes before any scenario text",
    "report Step 7 blocker before any future liveness probe language",
    "report no named nodes introduced beyond Node0, Node1, and Node2",
    "report no socket, runtime, handshake, mint, or identity artifact",
    "report micro-consent requirements without emitting an authorization phrase"
  ],
  output_boundary: "advisory only; no agent loop, shell command, socket, mint, or authorization text"
};

const BLOCKERS = [
  {
    id: "node0.step7_capability_anchor_pending",
    severity: "halt_gate",
    status: "blocked",
    note: "Step 7 command path is ready, but its append-only receipt remains unminted."
  },
  {
    id: "node0.repeatable_receipts_pending",
    severity: "halt_gate",
    status: "blocked",
    note: "Repeatable governed Node0 bounded diagnostic receipts are not yet measured."
  },
  {
    id: "node1.node2_contracts_missing",
    severity: "design_gate",
    status: "blocked",
    note: "Handoff, refusal, propagation, and rollback schemas are not execution-ready."
  },
  {
    id: "phase_3.private_pilot_not_authorized",
    severity: "halt_gate",
    status: "blocked",
    note: "Private pilot and live probe work remain outside this repo until proof gates pass."
  }
];

const FIXTURE_SELF_CRITIQUE = [
  {
    risk: "fixture slots could be misread as live nodes",
    mitigation: "emit live_nodes: 0, runtime_nodes: 0, topology_claim: none, and 0 sockets"
  },
  {
    risk: "unnamed phase slots could become invented topology names",
    mitigation: "keep named_identity null and forbid invented ordinal nodes or alphabetic peer aliases"
  },
  {
    risk: "scenario text could be misread as executed security simulation",
    mitigation: "mark every scenario executed: false and produces_receipt: false"
  },
  {
    risk: "micro-consent text could become authorization",
    mitigation: "emit requirements only and no reusable authorization phrase"
  }
];

const BOUNDARY = {
  ...NETWORK_PREVIEW_BOUNDARY,
  local_state_written: false,
  fixture_file_written: false,
  simulation_executed: false,
  scenario_emitted_authorization_phrase: false,
  topology_claim_made: false
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function buildOfflineNetworkFixturePreview() {
  return {
    schema: SCHEMA,
    mode: "PREVIEW_ONLY",
    fixture: clone(FIXTURE_META),
    slots: clone(FIXTURE_SLOTS),
    static_relationships: clone(STATIC_RELATIONSHIPS),
    inert_scenarios: clone(INERT_SCENARIOS),
    micro_compliance: clone(MICRO_COMPLIANCE),
    micro_consent: clone(MICRO_CONSENT),
    analogical_model: clone(ANALOGICAL_MODEL),
    self_proactive_harness: clone(SELF_PROACTIVE_HARNESS),
    blockers: clone(BLOCKERS),
    self_critique: [
      ...clone(NETWORK_PREVIEW_SELF_CRITIQUE),
      ...clone(FIXTURE_SELF_CRITIQUE)
    ],
    boundary: clone(BOUNDARY)
  };
}

function appendRows(lines, rows, render) {
  for (const row of rows) lines.push(`  - ${render(row)}`);
}

export function formatOfflineNetworkFixturePreview(preview) {
  const lines = [
    "DEMA Offline Network Fixture Preview",
    "",
    `Mode: ${preview.mode}; 0 live nodes; 0 sockets`,
    `Fixture slots: ${preview.fixture.fixture_slot_count}`,
    `Topology claim: ${preview.fixture.topology_claim}`,
    `Named nodes introduced: ${preview.fixture.named_nodes_introduced}`,
    "",
    "Fixture slots:"
  ];

  appendRows(
    lines,
    preview.slots,
    (slot) => `${slot.slot}: target="${slot.role_target}" state="${slot.state}" boundary="${slot.boundary}"`
  );

  lines.push("");
  lines.push("Inert scenarios:");
  appendRows(
    lines,
    preview.inert_scenarios,
    (scenario) => `${scenario.id}: ${scenario.simulation_status}; executed=${scenario.executed}; receipt=${scenario.produces_receipt}`
  );

  lines.push("");
  lines.push("Micro-compliance:");
  appendRows(
    lines,
    preview.micro_compliance,
    (control) => `${control.control}: ${control.verified_by}`
  );

  lines.push("");
  lines.push("Micro-consent:");
  lines.push(`  - scope: ${preview.micro_consent.preview_scope}`);
  lines.push(`  - phrase emitted: ${preview.micro_consent.phrase_emitted}`);
  lines.push(`  - approval recorded: ${preview.micro_consent.approval_recorded}`);

  lines.push("");
  lines.push("Analogical model:");
  lines.push(`  - ${preview.analogical_model.analogy}: ${preview.analogical_model.useful_because}`);
  lines.push(`  - boundary: ${preview.analogical_model.boundary}`);

  lines.push("");
  lines.push("Self-proactive harness:");
  appendRows(lines, preview.self_proactive_harness.checks, (check) => check);

  lines.push("");
  lines.push("Blockers:");
  appendRows(
    lines,
    preview.blockers,
    (blocker) => `${blocker.status}: ${blocker.id} (${blocker.severity}) - ${blocker.note}`
  );

  lines.push("");
  lines.push("Self-critique:");
  appendRows(
    lines,
    preview.self_critique,
    (item) => `${item.risk} -> ${item.mitigation}`
  );

  lines.push("");
  lines.push(
    "Boundary: preview-only; no live nodes; no sockets; no federation; no handshake; no runtime; no daemon; no receipt minted."
  );

  return lines.join("\n");
}
