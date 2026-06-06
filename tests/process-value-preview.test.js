import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildTrueValuePreview,
  computeProcessRsi,
  computeSNRValue,
} from "../packages/core/src/process-value-preview.js";

const fixedNow = new Date("2026-05-15T00:00:00.000Z");

const proofSignals = [
  { id: "evidence_chain_commit", status: "passed" },
  { id: "network_preview_commit", status: "passed" },
  { id: "fixture_preview_commit", status: "passed" },
  { id: "step7_receipt", status: "blocked" },
];

const invariantBlockedActions = [
  "runtime_start",
  "federation_start",
  "node_connection",
  "receipt_mint",
  "capability_mint",
  "authorization_emit",
  "step7_mint_without_exact_authorization",
];

const forbiddenAuthorizationPatterns = [
  /\bI authorize\b/i,
  /GO:\s*Step\s*7/i,
  /--authorize\s+["'][^"']+["']/i,
];

test("computeProcessRsi treats clean proof progress as high momentum", () => {
  const rsi = computeProcessRsi({
    events: [
      { type: "clean_commit" },
      { type: "gate_passed" },
      { type: "stable_receipts" },
      { type: "no_mint_verification" },
    ],
  });

  assert.equal(rsi.schema, "bizra.dema.process_rsi_preview.v0.1");
  assert.equal(rsi.mode, "PREVIEW_ONLY");
  assert.equal(rsi.verdict, "PARTIAL_PLACEHOLDER");
  assert.equal(rsi.score, 100);
  assert.equal(rsi.proof_gain, 4);
  assert.equal(rsi.proof_loss, 0);
});

test("computeProcessRsi lowers momentum for failures and dirty scope", () => {
  const rsi = computeProcessRsi({
    events: [
      { type: "clean_commit" },
      { type: "gate_failed" },
      { type: "dirty_tree" },
      { type: "receipt_drift" },
    ],
  });

  assert.equal(rsi.score, 25);
  assert.equal(rsi.proof_gain, 1);
  assert.equal(rsi.proof_loss, 3);
});

test("computeProcessRsi handles neutral and malformed inputs explicitly", () => {
  assert.equal(computeProcessRsi({ events: [] }).score, 50);
  assert.equal(
    computeProcessRsi({ events: [{ type: "gate_passed" }], window: 0 }).verdict,
    "PREVIEW_REJECT",
  );
  assert.equal(
    computeProcessRsi({ events: [{ type: "gate_passed", weight: Infinity }] })
      .verdict,
    "PREVIEW_REJECT",
  );
  assert.equal(
    computeProcessRsi({ events: [{ type: "gate_failed" }], window: 20 })
      .events_considered,
    1,
  );
});

test("computeSNRValue separates signal from noise", () => {
  const high = computeSNRValue({ signalEvents: [1, 2, 3], noiseEvents: [1] });
  const low = computeSNRValue({ signalEvents: [1], noiseEvents: [1, 2, 3] });

  assert.equal(high.schema, "bizra.dema.process_snr_preview.v0.1");
  assert.equal(high.score, 0.75);
  assert.equal(low.score, 0.25);
  assert.equal(computeSNRValue({ signalEvents: 0, noiseEvents: 0 }).score, 0);
  assert.equal(
    computeSNRValue({ signalEvents: -1, noiseEvents: 0 }).verdict,
    "PREVIEW_REJECT",
  );
});

test("buildTrueValuePreview reports Step 7 ready but unminted as improving but gated", () => {
  const preview = buildTrueValuePreview({
    processEvents: [
      { type: "clean_commit" },
      { type: "gate_passed" },
      { type: "no_mint_verification" },
    ],
    proofSignals,
    blockers: [{ kind: "step7_ready_unminted", severity: "halt_gate" }],
    now: fixedNow,
  });

  assert.equal(preview.schema, "bizra.dema.true_value_preview.v0.1");
  assert.equal(preview.mode, "PREVIEW_ONLY");
  assert.equal(preview.certifies, false);
  assert.equal(preview.process_state, "node0_proof_ready_step7_gated");
  assert.equal(preview.momentum, "improving_but_gated");
  assert.equal(preview.next_safe_action, "hold_step7_ceremony");
  assert.equal(preview.next_safe_action_allowed, true);
  assert.ok(preview.true_value_score > 0.7);
  assert.deepEqual(preview.blocked_actions, invariantBlockedActions);
  assert.equal(preview.self_proactive_harness.mode, "DETERMINISTIC_PREVIEW");
  assert.equal(
    preview.self_proactive_harness.recommended_micro_action,
    preview.next_safe_action,
  );
  assert.equal(preview.step7_hold_posture.status, "HOLD");
  assert.equal(preview.step7_hold_posture.ceremony_allowed_by_preview, false);
  assert.equal(
    preview.step7_hold_posture.authorization_observed_in_current_turn,
    false,
  );
  assert.equal(preview.step7_hold_posture.authorization_phrase_emitted, false);
  assert.equal(
    preview.step7_hold_posture.receipt_mint_allowed_by_preview,
    false,
  );
  assert.equal(preview.micro_compliance.preview_only, true);
  assert.equal(preview.micro_compliance.step7_hold_enforced, true);
  assert.equal(preview.micro_compliance.authorization_phrase_emitted, false);
  assert.equal(preview.micro_consent.action_authorized_by_preview, false);
  assert.equal(
    preview.micro_consent
      .future_step7_mint_requires_fresh_current_operator_turn,
    true,
  );
  assert.equal(preview.micro_consent.reusable_authorization_created, false);
  assert.equal(preview.micro_consent.broad_consent_allowed, false);
  assert.equal(preview.analogical_model.model, "process_cockpit_not_engine");
  assert.equal(preview.boundary.receipt_minted, false);
  assert.equal(preview.boundary.runtime_started, false);
  assert.equal(preview.boundary.node_connection_attempted, false);
  assert.equal(preview.boundary.step7_authorization_observed, false);
  assert.equal(
    preview.checks.find((check) => check.check === "step7_hold_boundary").pass,
    true,
  );
});

test("buildTrueValuePreview lowers true value when operational noise rises", () => {
  const lowNoise = buildTrueValuePreview({
    processEvents: [{ type: "clean_commit" }, { type: "gate_passed" }],
    proofSignals,
    blockers: [],
    now: fixedNow,
  });
  const highNoise = buildTrueValuePreview({
    processEvents: [
      { type: "clean_commit" },
      { type: "gate_failed" },
      { type: "dirty_tree" },
      { type: "scope_contamination" },
    ],
    proofSignals,
    blockers: [],
    now: fixedNow,
  });

  assert.ok(lowNoise.true_value_score > highNoise.true_value_score);
  assert.equal(highNoise.momentum, "declining");
});

test("buildTrueValuePreview keeps node connection blocked until proof gates pass", () => {
  const preview = buildTrueValuePreview({
    processEvents: [{ type: "gate_passed" }],
    proofSignals,
    blockers: [{ kind: "node_connection_blocked", severity: "halt_gate" }],
    now: fixedNow,
  });

  assert.equal(preview.process_state, "node_connection_gated");
  assert.equal(preview.next_safe_action, "continue_preview_only_readiness");
  assert.ok(preview.blocked_actions.includes("node_connection"));
  assert.equal(preview.boundary.federation_started, false);
});

test("buildTrueValuePreview suggests clean baseline before gated ceremonies", () => {
  const preview = buildTrueValuePreview({
    processEvents: [{ type: "dirty_tree" }],
    proofSignals,
    blockers: [{ kind: "step7_ready_unminted", severity: "halt_gate" }],
    now: fixedNow,
  });

  assert.equal(preview.process_state, "process_dirty");
  assert.equal(preview.next_safe_action, "restore_clean_baseline");
});

test("buildTrueValuePreview fails closed for malformed inputs", () => {
  const preview = buildTrueValuePreview({
    processEvents: [{ type: "gate_passed", weight: Number.NaN }],
    proofSignals,
    blockers: [{ note: "missing kind" }],
    now: fixedNow,
  });

  assert.equal(preview.process_state, "preview_reject");
  assert.equal(preview.true_value_score, null);
  assert.equal(preview.risk_level, "high");
  assert.equal(preview.next_safe_action, "fix_malformed_process_inputs");
  assert.equal(preview.ihsan_safety, null);
  assert.equal(preview.self_critique.confidence, "rejected");
  assert.equal(preview.micro_compliance.fail_closed_on_malformed_input, true);
  assert.equal(
    preview.snr_interpretation,
    "rejected_until_inputs_are_structured",
  );
  assert.equal(
    preview.checks.find((check) => check.check === "blockers_structured").pass,
    false,
  );
});

test("buildTrueValuePreview fails closed across each malformed input family", () => {
  const malformedProcessEvents = buildTrueValuePreview({
    processEvents: [{ type: "gate_passed", weight: Number.NaN }],
    proofSignals,
    blockers: [],
    now: fixedNow,
  });
  const malformedProofSignals = buildTrueValuePreview({
    processEvents: [{ type: "gate_passed" }],
    proofSignals: [{ id: "missing_status" }],
    blockers: [],
    now: fixedNow,
  });
  const malformedBlockers = buildTrueValuePreview({
    processEvents: [{ type: "gate_passed" }],
    proofSignals,
    blockers: [{ kind: "node_connection_blocked", severity: "unknown" }],
    now: fixedNow,
  });
  const malformedNow = buildTrueValuePreview({
    processEvents: [{ type: "gate_passed" }],
    proofSignals,
    blockers: [],
    now: "not-a-date",
  });

  for (const preview of [
    malformedProcessEvents,
    malformedProofSignals,
    malformedBlockers,
    malformedNow,
  ]) {
    assert.equal(preview.process_state, "preview_reject");
    assert.equal(preview.true_value_score, null);
    assert.equal(preview.ihsan_safety, null);
  }
  assert.equal(malformedNow.checked_at, null);
  assert.equal(
    malformedNow.checks.find((check) => check.check === "checked_at_valid")
      .pass,
    false,
  );
});

test("buildTrueValuePreview uses structured blockers rather than Step 7 text matching", () => {
  const textOnly = buildTrueValuePreview({
    processEvents: [{ type: "gate_passed" }],
    proofSignals,
    blockers: [
      {
        kind: "resolved_note",
        severity: "review",
        note: "resolved step7 last week",
      },
    ],
    now: fixedNow,
  });
  const structured = buildTrueValuePreview({
    processEvents: [{ type: "gate_passed" }],
    proofSignals,
    blockers: [{ kind: "step7_ready_unminted", severity: "halt_gate" }],
    now: fixedNow,
  });

  assert.notEqual(textOnly.process_state, "node0_proof_ready_step7_gated");
  assert.equal(structured.process_state, "node0_proof_ready_step7_gated");
  assert.equal(textOnly.ihsan_safety, 1);
});

test("buildTrueValuePreview is deterministic with injected time", () => {
  const input = {
    processEvents: [{ type: "clean_commit" }, { type: "gate_passed" }],
    proofSignals,
    blockers: [{ kind: "step7_ready_unminted", severity: "halt_gate" }],
    now: fixedNow,
  };

  assert.deepEqual(buildTrueValuePreview(input), buildTrueValuePreview(input));
});

test("buildTrueValuePreview always uses allowlisted safe actions and invariant blocks", () => {
  const previews = [
    buildTrueValuePreview({
      processEvents: [{ type: "dirty_tree" }],
      proofSignals,
      blockers: [],
      now: fixedNow,
    }),
    buildTrueValuePreview({
      processEvents: [{ type: "gate_passed" }],
      proofSignals,
      blockers: [],
      now: fixedNow,
    }),
    buildTrueValuePreview({
      processEvents: [{ type: "gate_passed" }],
      proofSignals,
      blockers: [{ kind: "step7_ready_unminted", severity: "halt_gate" }],
      now: fixedNow,
    }),
  ];

  for (const preview of previews) {
    assert.equal(preview.next_safe_action_allowed, true);
    assert.deepEqual(preview.blocked_actions, invariantBlockedActions);
    assert.equal(Object.isFrozen(preview.blocked_actions), true);
    assert.equal(Object.isFrozen(preview.self_proactive_harness), true);
    assert.equal(Object.isFrozen(preview.self_proactive_harness.gates), true);
    assert.equal(
      Object.isFrozen(preview.self_proactive_harness.gates[0]),
      true,
    );
    assert.equal(Object.isFrozen(preview.step7_hold_posture), true);
    assert.equal(Object.isFrozen(preview.micro_compliance), true);
    assert.equal(Object.isFrozen(preview.micro_consent), true);
    assert.equal(
      preview.self_proactive_harness.gates.find(
        (gate) => gate.gate === "node_connection_blocked",
      ).pass,
      true,
    );
    assert.equal(
      preview.self_proactive_harness.gates.find(
        (gate) => gate.gate === "step7_hold_boundary",
      ).pass,
      true,
    );
    assert.equal(preview.micro_compliance.no_runtime, true);
    assert.equal(preview.micro_compliance.no_federation, true);
    assert.equal(preview.micro_compliance.no_node_connection, true);
    assert.equal(preview.micro_compliance.no_receipt_mint, true);
    assert.equal(preview.micro_consent.consent_observed_in_preview, false);
    assert.equal(
      preview.checks.find(
        (check) => check.check === "blocked_actions_invariant",
      ).pass,
      true,
    );
  }
});

test("buildTrueValuePreview emits no reusable Step 7 authorization phrase", () => {
  const preview = buildTrueValuePreview({
    processEvents: [{ type: "gate_passed" }],
    proofSignals,
    blockers: [{ kind: "step7_ready_unminted", severity: "halt_gate" }],
    now: fixedNow,
  });
  const serialized = JSON.stringify(preview);

  for (const pattern of forbiddenAuthorizationPatterns) {
    assert.doesNotMatch(serialized, pattern);
  }
});

test("process value preview source has no runtime, network, or filesystem side effects", async () => {
  const source = await readFile(
    new URL("../packages/core/src/process-value-preview.js", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(
    source,
    /\b(writeFile|appendFile|mkdir|rename|unlink|createWriteStream)\b/,
  );
  assert.doesNotMatch(
    source,
    /\b(fetch|WebSocket|exec|execFile|spawn|spawnSync)\b/,
  );
  assert.doesNotMatch(
    source,
    /from\s+["']node:(net|dgram|http|https|tls|dns|child_process|fs)["']/,
  );
});
