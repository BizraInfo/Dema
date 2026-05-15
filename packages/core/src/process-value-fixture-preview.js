import { buildTrueValuePreview } from "./process-value-preview.js";

export const PROCESS_VALUE_FIXTURE_PACK_SCHEMA = "bizra.dema.process_value_fixture_pack_preview.v0.1";

const FIXTURE_NOW = "2026-05-15T00:00:00.000Z";

const DEFAULT_FIXTURES = [
  {
    id: "clean_progress",
    processEvents: [{ type: "clean_commit" }, { type: "gate_passed" }, { type: "stable_receipts" }],
    proofSignals: [{ id: "tests", status: "passed" }, { id: "release", status: "passed" }],
    blockers: [],
    now: FIXTURE_NOW
  },
  {
    id: "dirty_step7_gated",
    processEvents: [{ type: "dirty_tree" }, { type: "gate_passed" }],
    proofSignals: [{ id: "step7_command_path", status: "passed" }, { id: "step7_receipt", status: "blocked" }],
    blockers: [{ kind: "step7_ready_unminted", severity: "halt_gate" }],
    now: FIXTURE_NOW
  },
  {
    id: "noisy_failure",
    processEvents: [{ type: "gate_failed" }, { type: "scope_contamination" }],
    proofSignals: [{ id: "single_signal", status: "passed" }],
    blockers: [],
    now: FIXTURE_NOW
  },
  {
    id: "node_connection_blocked",
    processEvents: [{ type: "gate_passed" }, { type: "no_mint_verification" }],
    proofSignals: [{ id: "fixture", status: "passed" }, { id: "refusal_matrix", status: "passed" }],
    blockers: [{ kind: "node_connection_blocked", severity: "halt_gate" }],
    now: FIXTURE_NOW
  },
  {
    id: "malformed_rejected",
    processEvents: [{ type: "gate_passed", weight: Number.NaN }],
    proofSignals: [{ id: "malformed_probe", status: "passed" }],
    blockers: [],
    now: FIXTURE_NOW
  }
];

const EXPECTED_BY_ID = Object.freeze({
  clean_progress: Object.freeze({
    process_state: "proof_process_preview",
    next_safe_action: "continue_verified_micro_slice"
  }),
  dirty_step7_gated: Object.freeze({
    process_state: "process_dirty",
    next_safe_action: "restore_clean_baseline"
  }),
  noisy_failure: Object.freeze({
    process_state: "proof_process_preview",
    next_safe_action: "reduce_noise_before_next_slice"
  }),
  node_connection_blocked: Object.freeze({
    process_state: "node_connection_gated",
    next_safe_action: "continue_preview_only_readiness"
  }),
  malformed_rejected: Object.freeze({
    process_state: "preview_reject",
    next_safe_action: "fix_malformed_process_inputs"
  })
});

const BOUNDARY = Object.freeze({
  runtime_started: false,
  federation_started: false,
  socket_opened: false,
  node_connection_attempted: false,
  receipt_minted: false,
  capability_minted: false,
  authorization_emitted: false,
  filesystem_write_performed: false,
  cli_wired: false,
  push_performed: false
});

const MICRO_COMPLIANCE = Object.freeze([
  Object.freeze({ control: "no_cli_wiring", verified_by: "boundary.cli_wired === false" }),
  Object.freeze({ control: "no_runtime_or_socket", verified_by: "boundary.runtime_started === false && boundary.socket_opened === false" }),
  Object.freeze({ control: "no_node_connection", verified_by: "boundary.node_connection_attempted === false" }),
  Object.freeze({ control: "no_receipt_or_capability_mint", verified_by: "boundary.receipt_minted === false && boundary.capability_minted === false" })
]);

const MICRO_CONSENT = Object.freeze({
  preview_scope: "offline process value fixture pack only",
  current_preview_requires_operator_authorization: false,
  future_mint_or_node_action_requires_fresh_current_operator_turn: true,
  consent_observed_in_preview: false,
  action_authorized_by_preview: false,
  reusable_authorization_created: false
});

const ANALOGICAL_MODEL = Object.freeze({
  analogy: "sealed calibration card deck",
  useful_because: "fixed cards can replay known evidence states without changing the machine being measured",
  not_analogous_to: Object.freeze(["live telemetry", "runtime simulator", "receipt ceremony"]),
  boundary: "fixture_pack_not_process_engine"
});

const SELF_PROACTIVE_HARNESS = Object.freeze({
  mode: "deterministic_fixture_replay",
  checks: Object.freeze([
    "feed only canned evidence states into Process Value Preview",
    "compare default outputs against golden expected states",
    "keep malformed pack rejection separate from malformed inner fixture rejection",
    "emit no CLI route, no mint, no socket, and no node connection"
  ])
});

const SELF_CRITIQUE = Object.freeze([
  Object.freeze({
    risk: "fixtures could be mistaken for live process telemetry",
    mitigation: "emit offline fixture scope and all authority boundaries false"
  }),
  Object.freeze({
    risk: "expected results could become self-graded",
    mitigation: "compare default fixture outputs against module-owned golden expectations"
  }),
  Object.freeze({
    risk: "malformed inner fixture could be confused with malformed pack shape",
    mitigation: "use distinct fixture-level preview_reject and pack-level PREVIEW_REJECT states"
  })
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function validNow(value) {
  return typeof value === "string" && Number.isFinite(new Date(value).getTime());
}

function validateFixtures(fixtures) {
  if (!Array.isArray(fixtures) || fixtures.length === 0) return { ok: false, reason: "fixtures_must_be_non_empty_array" };
  for (const fixture of fixtures) {
    if (!fixture || typeof fixture !== "object" || Array.isArray(fixture)) return { ok: false, reason: "fixture_must_be_object" };
    if (!Object.hasOwn(EXPECTED_BY_ID, fixture.id)) return { ok: false, reason: "fixture_id_not_allowlisted" };
    if (!Array.isArray(fixture.processEvents)) return { ok: false, reason: "fixture_process_events_must_be_array" };
    if (!Array.isArray(fixture.proofSignals)) return { ok: false, reason: "fixture_proof_signals_must_be_array" };
    if (!Array.isArray(fixture.blockers)) return { ok: false, reason: "fixture_blockers_must_be_array" };
    if (!validNow(fixture.now)) return { ok: false, reason: "fixture_now_must_be_iso_datetime" };
  }
  return { ok: true, reason: null };
}

function rejectPack(reason) {
  return deepFreeze({
    schema: PROCESS_VALUE_FIXTURE_PACK_SCHEMA,
    mode: "PREVIEW_ONLY",
    verdict: "PREVIEW_REJECT",
    fixture_count: 0,
    entries: [],
    boundary: clone(BOUNDARY),
    micro_compliance: clone(MICRO_COMPLIANCE),
    micro_consent: clone(MICRO_CONSENT),
    analogical_model: clone(ANALOGICAL_MODEL),
    self_proactive_harness: clone(SELF_PROACTIVE_HARNESS),
    self_critique: clone(SELF_CRITIQUE),
    reason
  });
}

function buildEntry(fixture) {
  const preview = buildTrueValuePreview({
    processEvents: clone(fixture.processEvents),
    proofSignals: clone(fixture.proofSignals),
    blockers: clone(fixture.blockers),
    now: fixture.now
  });
  const expected = EXPECTED_BY_ID[fixture.id];
  return {
    id: fixture.id,
    fixture: clone(fixture),
    preview_summary: {
      process_state: preview.process_state,
      next_safe_action: preview.next_safe_action,
      momentum: preview.momentum,
      true_value_score: preview.true_value_score,
      risk_level: preview.risk_level
    },
    expected,
    expected_match:
      preview.process_state === expected.process_state &&
      preview.next_safe_action === expected.next_safe_action,
    boundary: clone(BOUNDARY)
  };
}

export function buildProcessValueFixturePackPreview({ fixtures = DEFAULT_FIXTURES } = {}) {
  const validation = validateFixtures(fixtures);
  if (!validation.ok) return rejectPack(validation.reason);
  const entries = fixtures.map(buildEntry);
  return deepFreeze({
    schema: PROCESS_VALUE_FIXTURE_PACK_SCHEMA,
    mode: "PREVIEW_ONLY",
    verdict: "PARTIAL_PLACEHOLDER",
    fixture_count: entries.length,
    entries,
    all_expected_matched: entries.every((entry) => entry.expected_match),
    boundary: clone(BOUNDARY),
    micro_compliance: clone(MICRO_COMPLIANCE),
    micro_consent: clone(MICRO_CONSENT),
    analogical_model: clone(ANALOGICAL_MODEL),
    self_proactive_harness: clone(SELF_PROACTIVE_HARNESS),
    self_critique: clone(SELF_CRITIQUE),
    note: "Offline fixture pack replays canned process evidence for review only; it does not wire CLI, mint receipts, connect nodes, or start runtime."
  });
}
