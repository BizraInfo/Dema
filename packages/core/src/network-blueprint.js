const SCHEMA = "bizra.dema.node_network_blueprint.v0.1";

const RELATED_SCHEMAS = [
  "bizra.dema.mission_preview.v0.1",
  "bizra.dema.diagnostics_mission_plan.v0.1",
  "bizra.dema.safety_report_preview.v0.1",
];

const CURRENT_STATE = {
  stage: "node0_plus_dema_local",
  summary:
    "Node0 and Dema are local-first preview surfaces. Node1/Node2 and later multi-node phases are not connected.",
  gtm_position:
    "Lighthouse alpha for Sovereign Local AI Node Setup + Safety Audit.",
};

const CANONICAL_EXPANSION_PHASES = [
  {
    id: "phase_0",
    label: "CANDIDATE_CANONICAL",
    scope: "single-node Node0 sovereign runtime candidate",
    readiness: "current_preview_only",
  },
  {
    id: "phase_1",
    label: "PLANNED",
    scope: "second-node membrane-mediated handshake",
    readiness: "blocked_until_node0_receipts_repeat",
  },
  {
    id: "phase_2",
    label: "PLANNED",
    scope: "SAT-5 operational inside one shared URP at multi-node scale",
    readiness: "blocked_until_second_node_proves_local_receipts",
  },
  {
    id: "phase_3",
    label: "PLANNED",
    scope: "opt-in federated cognition via membrane and Shared Reflex Registry",
    readiness: "blocked_until_private_pilot_receipts_cross_verify",
  },
  {
    id: "phase_4",
    label: "DIRECTIONAL",
    scope: "long-range decentralized self-growing agentic ecosystem",
    readiness: "direction_only_not_a_product_claim",
  },
];

const FULL_STACK_LAYERS = [
  {
    id: "product_face",
    owner: "Dema",
    responsibility:
      "operator CLI, local setup, previews, status, receipts viewer",
    readiness: "measured_local_preview",
  },
  {
    id: "runtime_authority",
    owner: "Node0 / bizra-omega",
    responsibility: "bounded execution, receipt issuance, proof authority",
    readiness: "upstream_required",
  },
  {
    id: "consent_plane",
    owner: "FATE / Amana contracts",
    responsibility: "exact consent scopes, commitments, EffectCap decisions",
    readiness: "contract_first",
  },
  {
    id: "evidence_plane",
    owner: "Node0 receipts",
    responsibility: "hash-linked evidence, replay, audit trail",
    readiness: "first_bounded_receipt_pending",
  },
  {
    id: "network_plane",
    owner: "future Node1 / Node2 handoff and phase-gated multi-node pilot",
    responsibility:
      "federation handshake after Node0 has repeatable local receipts",
    readiness: "blocked_until_node0_receipts_repeat",
  },
  {
    id: "gtm_plane",
    owner: "Dema",
    responsibility: "proof-safe offer language and operator onboarding",
    readiness: "private_lighthouse_only",
  },
];

const READINESS_GATES = [
  {
    id: "node0.local_contracts_landed",
    target: "Node0",
    status: "pending",
    requirement:
      "Amana contract surfaces are merged and reviewed under exact proof scope.",
  },
  {
    id: "node0.bounded_receipt_repeatable",
    target: "Node0",
    status: "blocked",
    requirement:
      "One boring local diagnostic can produce repeatable governed receipts.",
  },
  {
    id: "node0.step7_capability_anchor",
    target: "Node0",
    status: "blocked",
    requirement:
      "Step 7 single capability anchor is minted exactly once by governed local tooling after fresh operator authorization.",
  },
  {
    id: "node1.handoff_contract_defined",
    target: "Node1",
    status: "blocked",
    requirement:
      "Define handoff request, consent, receipt, rollback, and refusal schemas.",
  },
  {
    id: "node1.read_only_probe",
    target: "Node1",
    status: "blocked",
    requirement:
      "Define preview-only schema for a future read-only liveness probe; probe implementation does not live in this repo.",
  },
  {
    id: "node2.propagation_policy",
    target: "Node2",
    status: "blocked",
    requirement:
      "Define what cannot propagate: secrets, private data, unsigned claims, and rewards.",
  },
  {
    id: "phase_3.private_pilot_framework",
    target: "phase_3",
    status: "blocked",
    requirement:
      "Define private pilot validation for multiple independent operators only after Node0 and second-node proof gates are measured.",
  },
  {
    id: "phase_4.public_network_boundary",
    target: "phase_4",
    status: "blocked",
    requirement:
      "Keep public network language directional until private pilot receipts cross-verify without trusted infrastructure.",
  },
  {
    id: "gtm.claim_gate_green",
    target: "GTM",
    status: "review",
    requirement:
      "Offer copy remains limited to local setup, safety audit, and explicit proof gaps.",
  },
];

const HANDOFF_CONTRACT_PREVIEW = [
  {
    id: "handoff.request",
    owner: "governed runtime",
    shape:
      "schema-tagged request containing node role, consent scope reference, receipt root, and refusal policy",
    repo_boundary: "documented_only_not_executed",
  },
  {
    id: "handoff.refusal",
    owner: "Dema preview",
    shape:
      "fail-closed reasons for missing consent, missing receipt proof, schema mismatch, or propagation denial",
    repo_boundary: "may_be_rendered_as_static_preview",
  },
  {
    id: "handoff.consent",
    owner: "FATE / Amana contracts",
    shape: "exact narrow consent commitment for one future handoff attempt",
    repo_boundary: "no_approval_or_authorization_phrase_emitted",
  },
  {
    id: "handoff.receipt_read_verification",
    owner: "receipts / evidence handoff",
    shape:
      "read-only inspection of an already-issued receipt, including schema, producer, digest, and chain linkage",
    repo_boundary: "Dema_reads_governed_runtime_issues",
  },
  {
    id: "handoff.rollback",
    owner: "governed runtime",
    shape: "rollback receipt shape for a failed future probe",
    repo_boundary: "shape_only_no_receipt_mint",
  },
];

const OFFLINE_INTEGRATION_HARNESS = [
  {
    id: "fixture.node0_receipt_inventory",
    purpose: "capture receipt inventory shape without writing receipts",
    status: "preview_ready",
  },
  {
    id: "fixture.node1_candidate_state",
    purpose: "represent a second-node candidate as static JSON with no sockets",
    status: "blocked_until_contract_spec",
  },
  {
    id: "matrix.refusal_cases",
    purpose:
      "enumerate missing consent, schema mismatch, tampered digest, and propagation-denied cases",
    status: "blocked_until_contract_spec",
  },
  {
    id: "matrix.boundary_assertions",
    purpose:
      "prove every preview path has zero execution, zero mutation, zero socket, and zero receipt mint",
    status: "preview_ready",
  },
];

const SELF_PROACTIVE_HARNESS = {
  mode: "deterministic_preview_checks",
  checks: [
    "surface Step 7 anchor blocker before any handoff claim",
    "surface repeatable Node0 receipt blocker before any liveness probe",
    "surface missing handoff contract before any fixture is treated as connectivity",
    "surface propagation denylist before any multi-node pilot language",
  ],
  output_boundary:
    "advisory strings only; no agent loop, no shell command, no network call, no authorization text",
};

export const NETWORK_PREVIEW_SELF_CRITIQUE = [
  {
    risk: "preview readiness could be mistaken for permission",
    mitigation:
      "keep Node1, Node2, phase_3, and phase_4 gates blocked while Node0 proof gates are blocked",
  },
  {
    risk: "offline fixture could be mistaken for a live probe",
    mitigation:
      "fixtures are static contract examples only and must never open sockets",
  },
  {
    risk: "receipt inspection could drift into receipt issuance",
    mitigation: "Dema reads receipt handoffs; governed runtime issues receipts",
  },
  {
    risk: "planning text could become an authorization source",
    mitigation:
      "do not emit operator authorization phrases or reusable consent strings",
  },
];

const LIFECYCLE = [
  {
    phase: "specify",
    output: "node handoff contracts and refusal conditions",
  },
  {
    phase: "prove_locally",
    output: "repeatable Node0 diagnostic receipt before any network handoff",
  },
  {
    phase: "simulate",
    output: "offline Node1/Node2 fixtures with no sockets",
  },
  {
    phase: "authorize",
    output: "exact consent phrase and EffectCap gate for the first live probe",
  },
  {
    phase: "observe",
    output: "receipt-backed monitoring and rollback receipt on failure",
  },
];

const GTM_BLOCKERS = [
  {
    code: "node0.first_bounded_receipt_pending",
    severity: "launch_blocker",
    note: "Node1/Node2 connection cannot start until Node0 proves repeatable local receipts.",
  },
  {
    code: "node0.step7_capability_anchor_pending",
    severity: "launch_blocker",
    note: "The Step 7 single capability anchor command path is ready, but the append-only receipt remains unminted.",
  },
  {
    code: "handoff.schema_missing",
    severity: "launch_blocker",
    note: "No Node1/Node2 handoff schema is committed yet.",
  },
  {
    code: "network.safety_policy_missing",
    severity: "review",
    note: "Propagation denylist and rollback receipt policy must exist before live probes.",
  },
  {
    code: "canon.multi_node_language_guard",
    severity: "review",
    note: "Use Node1/Node2 and canonical phase labels; do not invent additional named nodes in Dema preview copy.",
  },
];

const PROPOSED_NEXT_ACTIONS = [
  {
    id: "publish_amana_contracts_pr",
    action:
      "Prepare the already verified Amana contracts PR draft; do not publish without explicit operator authorization.",
  },
  {
    id: "add_node_handoff_contract_spec",
    action:
      "Define Node1/Node2 handoff request, refusal, consent, and receipt-read schemas.",
  },
  {
    id: "build_offline_network_fixture",
    action:
      "Create an offline fixture that simulates Node1/Node2 state without sockets.",
  },
  {
    id: "keep_step7_gate_explicit",
    action:
      "Keep the Step 7 anchor blocker visible until an operator chooses a fresh authorized ceremony.",
  },
];

export const NETWORK_PREVIEW_BOUNDARY = {
  scope: "read-only-preview",
  inference_invoked: false,
  execution_enabled: false,
  mutation_performed: false,
  runtime_started: false,
  capability_minted: false,
  receipt_minted: false,
  daemon_started: false,
  network_connection_attempted: false,
  federation_initiated: false,
  node_handshake_performed: false,
  outbound_socket_opened: false,
  identity_artifact_issued: false,
  downstream_node_started: false,
  liveness_probe_implemented: false,
  authorization_phrase_emitted: false,
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
    canonical_expansion_phases: clone(CANONICAL_EXPANSION_PHASES),
    full_stack_layers: clone(FULL_STACK_LAYERS),
    readiness_gates: clone(READINESS_GATES),
    handoff_contract_preview: clone(HANDOFF_CONTRACT_PREVIEW),
    offline_integration_harness: clone(OFFLINE_INTEGRATION_HARNESS),
    self_proactive_harness: clone(SELF_PROACTIVE_HARNESS),
    self_critique: clone(NETWORK_PREVIEW_SELF_CRITIQUE),
    lifecycle: clone(LIFECYCLE),
    gtm_blockers: clone(GTM_BLOCKERS),
    proposed_next_actions: clone(PROPOSED_NEXT_ACTIONS),
    boundary: clone(NETWORK_PREVIEW_BOUNDARY),
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
    "Full-stack layers:",
  ];

  appendRows(
    lines,
    blueprint.full_stack_layers,
    (layer) =>
      `${layer.id}  owner="${layer.owner}"  readiness="${layer.readiness}"`,
  );

  lines.push("");
  lines.push("Canonical expansion phases:");
  appendRows(
    lines,
    blueprint.canonical_expansion_phases,
    (phase) =>
      `${phase.id} ${phase.label} - ${phase.scope} (${phase.readiness})`,
  );

  lines.push("");
  lines.push("Readiness gates:");
  appendRows(
    lines,
    blueprint.readiness_gates,
    (gate) =>
      `${gate.status}: ${gate.id} (${gate.target}) - ${gate.requirement}`,
  );

  lines.push("");
  lines.push("Handoff contract preview:");
  appendRows(
    lines,
    blueprint.handoff_contract_preview,
    (contract) =>
      `${contract.id} owner="${contract.owner}" boundary="${contract.repo_boundary}"`,
  );

  lines.push("");
  lines.push("Offline integration harness:");
  appendRows(
    lines,
    blueprint.offline_integration_harness,
    (item) => `${item.status}: ${item.id} - ${item.purpose}`,
  );

  lines.push("");
  lines.push("Self-proactive harness:");
  appendRows(lines, blueprint.self_proactive_harness.checks, (check) => check);
  lines.push(
    `  - boundary: ${blueprint.self_proactive_harness.output_boundary}`,
  );

  lines.push("");
  lines.push("Lifecycle:");
  appendRows(
    lines,
    blueprint.lifecycle,
    (phase) => `${phase.phase}: ${phase.output}`,
  );

  lines.push("");
  lines.push("GTM blockers:");
  appendRows(
    lines,
    blueprint.gtm_blockers,
    (blocker) => `${blocker.severity}: ${blocker.code} - ${blocker.note}`,
  );

  lines.push("");
  lines.push("Proposed next actions:");
  appendRows(
    lines,
    blueprint.proposed_next_actions,
    (item) => `${item.id}: ${item.action}`,
  );

  lines.push("");
  lines.push("Self-critique:");
  appendRows(
    lines,
    blueprint.self_critique,
    (item) => `${item.risk} -> ${item.mitigation}`,
  );

  lines.push("");
  lines.push(
    "Boundary: preview-only; no network connection; no federation; no handshake; no execution; no mutation; no receipt minted.",
  );

  return lines.join("\n");
}
