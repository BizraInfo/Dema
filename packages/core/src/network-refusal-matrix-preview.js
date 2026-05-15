import { NETWORK_PREVIEW_BOUNDARY } from "./network-blueprint.js";
import {
  buildOfflineNetworkFixturePreview,
  NETWORK_INERT_SCENARIOS
} from "./network-fixture-preview.js";

const SCHEMA = "bizra.dema.network_refusal_matrix_preview.v0.1";

const REFUSAL_REASONS_BY_SCENARIO = {
  partition_shape: [
    "future_liveness_unknown",
    "cross_slot_receipt_absent",
    "live_probe_not_authorized"
  ],
  rejoin_shape: [
    "rejoin_receipt_absent",
    "cross_slot_chain_unverified",
    "live_probe_not_authorized"
  ],
  adversarial_slot_input_shape: [
    "untrusted_slot_input",
    "schema_or_digest_not_verified",
    "propagation_policy_not_measured"
  ],
  stale_receipt_shape: [
    "receipt_reference_stale",
    "chain_head_not_current",
    "fresh_receipt_read_required"
  ],
  missing_micro_consent_shape: [
    "micro_consent_absent",
    "fresh_current_operator_turn_required",
    "broad_consent_not_allowed"
  ],
  schema_mismatch_shape: [
    "schema_mismatch",
    "contract_version_not_accepted",
    "refusal_receipt_shape_not_minted_here"
  ]
};

const REQUIRED_GATES = [
  "step7_capability_anchor_minted",
  "repeatable_node0_receipts_measured",
  "handoff_contract_committed",
  "micro_consent_present_in_current_turn",
  "governed_runtime_authority_available"
];

const MICRO_COMPLIANCE = [
  {
    control: "matrix_has_zero_execution",
    statement: "matrix preview executes no partition, rejoin, or adversarial scenario",
    verified_by: "boundary.simulation_executed === false"
  },
  {
    control: "matrix_has_zero_sockets",
    statement: "matrix preview opens no sockets",
    verified_by: "boundary.outbound_socket_opened === false"
  },
  {
    control: "matrix_has_zero_mint",
    statement: "matrix preview mints no receipt or capability",
    verified_by: "boundary.receipt_minted === false && boundary.capability_minted === false"
  },
  {
    control: "matrix_has_zero_runtime",
    statement: "matrix preview starts no runtime or daemon",
    verified_by: "boundary.runtime_started === false && boundary.daemon_started === false"
  },
  {
    control: "matrix_has_zero_authorization_text",
    statement: "matrix preview emits no reusable operator authorization text",
    verified_by: "boundary.authorization_phrase_emitted === false"
  },
  {
    control: "matrix_has_no_topology_claim",
    statement: "matrix preview makes no live topology claim",
    verified_by: "fixture.topology_claim === 'none'"
  }
];

const MICRO_CONSENT = {
  preview_scope: "partition rejoin refusal matrix preview only",
  current_preview_requires_operator_authorization: false,
  future_live_probe_requires_fresh_current_operator_turn: true,
  phrase_emitted: false,
  approval_recorded: false,
  reusable_authorization_created: false,
  broad_consent_allowed: false,
  consent_property_model:
    "fresh exact current-turn operator consent is a future gate property, not text emitted by this preview"
};

const ANALOGICAL_MODEL = {
  analogy: "paper truth table for a circuit breaker",
  useful_because:
    "a truth table can show when power must stay off without energizing the circuit",
  not_analogous_to: [
    "live network",
    "switchgear operation",
    "security testbed",
    "runtime simulator"
  ],
  boundary: "paper_matrix_not_running_system"
};

const SELF_CRITIQUE = [
  {
    risk: "matrix rows could be misread as executed simulations",
    mitigation: "every row carries executed=false, socket_opened=false, and receipt_minted=false"
  },
  {
    risk: "refusal reasons could become live policy claims",
    mitigation: "mark decisions as preview refusals until proof gates are measured"
  },
  {
    risk: "micro-consent language could become authorization",
    mitigation: "describe consent as a property gate and emit no reusable phrase"
  },
  {
    risk: "partition and rejoin language could imply federation exists",
    mitigation: "report live_nodes=0, topology_claim=none, and federation_started=false"
  }
];

const BOUNDARY = {
  ...NETWORK_PREVIEW_BOUNDARY,
  local_state_written: false,
  matrix_file_written: false,
  simulation_executed: false,
  scenario_emitted_authorization_phrase: false,
  topology_claim_made: false
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildMatrixEntry(scenario) {
  return {
    id: scenario.id,
    observed_input: scenario.purpose,
    preview_decision: "describe_refusal_only",
    future_live_decision: "refuse_until_gate_measured",
    executed: false,
    socket_opened: false,
    handshake_performed: false,
    federation_started: false,
    receipt_minted: false,
    refusal_reasons: clone(REFUSAL_REASONS_BY_SCENARIO[scenario.id] ?? ["unmapped_shape_refused"]),
    required_gates_before_live_action: clone(REQUIRED_GATES),
    source_scenario_status: scenario.simulation_status
  };
}

function buildSelfProactiveHarness(matrix) {
  return {
    mode: "computed_preview_checks",
    checks: [
      {
        check: "every row is not executed",
        passed: matrix.every((entry) => entry.executed === false)
      },
      {
        check: "every row opens no socket",
        passed: matrix.every((entry) => entry.socket_opened === false)
      },
      {
        check: "every row mints no receipt",
        passed: matrix.every((entry) => entry.receipt_minted === false)
      },
      {
        check: "every row refuses future live action until gates are measured",
        passed: matrix.every((entry) => entry.future_live_decision === "refuse_until_gate_measured")
      }
    ],
    output_boundary:
      "computed booleans only; no agent loop, shell command, socket, mint, or authorization text"
  };
}

export function buildNetworkRefusalMatrixPreview() {
  const fixturePreview = buildOfflineNetworkFixturePreview();
  const matrix = NETWORK_INERT_SCENARIOS.map(buildMatrixEntry);
  return {
    schema: SCHEMA,
    mode: "PREVIEW_ONLY",
    fixture: {
      fixture_slot_count: fixturePreview.fixture.fixture_slot_count,
      live_nodes: fixturePreview.fixture.live_nodes,
      runtime_nodes: fixturePreview.fixture.runtime_nodes,
      topology_claim: fixturePreview.fixture.topology_claim,
      named_nodes_introduced: fixturePreview.fixture.named_nodes_introduced
    },
    matrix,
    micro_compliance: clone(MICRO_COMPLIANCE),
    micro_consent: clone(MICRO_CONSENT),
    analogical_model: clone(ANALOGICAL_MODEL),
    self_proactive_harness: buildSelfProactiveHarness(matrix),
    self_critique: clone(SELF_CRITIQUE),
    boundary: clone(BOUNDARY)
  };
}

function appendRows(lines, rows, render) {
  for (const row of rows) lines.push(`  - ${render(row)}`);
}

export function formatNetworkRefusalMatrixPreview(preview) {
  const lines = [
    "DEMA Network Refusal Matrix Preview",
    "",
    `Mode: ${preview.mode}; 0 live nodes; 0 sockets; 0 receipts minted`,
    `Fixture slots: ${preview.fixture.fixture_slot_count}`,
    `Topology claim: ${preview.fixture.topology_claim}`,
    "",
    "Refusal matrix:"
  ];

  appendRows(
    lines,
    preview.matrix,
    (entry) => `${entry.id}: ${entry.preview_decision}; future=${entry.future_live_decision}; executed=${entry.executed}`
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
  appendRows(
    lines,
    preview.self_proactive_harness.checks,
    (item) => `${item.passed}: ${item.check}`
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
    "Boundary: preview-only; no partition executed; no rejoin executed; no sockets; no federation; no runtime; no receipt minted."
  );

  return lines.join("\n");
}
