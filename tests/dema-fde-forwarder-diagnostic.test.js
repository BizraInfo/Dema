import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  planDemaFdeForwarderDiagnostic,
  buildDemaFdeForwarderDiagnosticPayload,
  verifyDemaFdeForwarderDiagnostic,
  runDemaFdeForwarderDiagnostic,
  defaultDemaFdeForwarderDiagnosticFixture,
  deriveDemaFdeForwardRouting,
  validateDemaFdeForwarderInput,
  DEMA_FDE_FORWARDER_DIAGNOSTIC_SCHEMA,
  DEMA_FDE_FORWARDER_DIAGNOSTIC_TRUTH_LABEL,
  DEMA_FDE_FORWARDER_DIAGNOSTIC_GO_PHRASE,
  FDE_FORWARD_DESTINATIONS,
  FDE_FORWARDER_BOUNDARY_KEYS,
} from "../packages/core/src/dema-fde-forwarder-diagnostic.js";
import { runDemaFdeForwarderDiagnosticCheck } from "../scripts/review/dema-fde-forwarder-diagnostic-check.mjs";

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

// Fixture helper: clone the canonical fixture with fde_report overrides.
function makeInput(reportOverrides = {}, rest = {}) {
  const fixture = defaultDemaFdeForwarderDiagnosticFixture();
  return {
    fde_report: { ...fixture.fde_report, ...reportOverrides },
    channel: { ...fixture.channel },
    impact: { ...fixture.impact },
    cost: { ...fixture.cost },
    ...rest,
  };
}

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planDemaFdeForwarderDiagnostic({ consent: "wrong", input: {} });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and well-formed input", () => {
  const plan = planDemaFdeForwarderDiagnostic({
    consent: DEMA_FDE_FORWARDER_DIAGNOSTIC_GO_PHRASE,
    input: defaultDemaFdeForwarderDiagnosticFixture(),
  });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildDemaFdeForwarderDiagnosticPayload(
    defaultDemaFdeForwarderDiagnosticFixture(),
  );
  assert.equal(payload.schema, DEMA_FDE_FORWARDER_DIAGNOSTIC_SCHEMA);
  assert.equal(payload.truth_label, DEMA_FDE_FORWARDER_DIAGNOSTIC_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.boundary.execution_allowed, false);
  assert.equal(payload.boundary.live_execution_performed, false);
  // Canonical key set, not just all-values-false (vacuous-boundary trap).
  assert.deepEqual(
    Object.keys(payload.boundary).sort(),
    [...FDE_FORWARDER_BOUNDARY_KEYS].sort(),
  );
});

test("verify accepts a freshly built payload", () => {
  const payload = buildDemaFdeForwarderDiagnosticPayload(
    defaultDemaFdeForwarderDiagnosticFixture(),
  );
  assert.equal(verifyDemaFdeForwarderDiagnostic(payload).ok, true);
});

test("verify rejects a tampered content_hash", () => {
  const payload = buildDemaFdeForwarderDiagnosticPayload(
    defaultDemaFdeForwarderDiagnosticFixture(),
  );
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  assert.equal(verifyDemaFdeForwarderDiagnostic(tampered).ok, false);
});

test("verify rejects a field change that did not update the content_hash", () => {
  const payload = buildDemaFdeForwarderDiagnosticPayload(
    defaultDemaFdeForwarderDiagnosticFixture(),
  );
  const forged = { ...payload, truth_label: "FORGED" };
  assert.equal(verifyDemaFdeForwarderDiagnostic(forged).ok, false);
});

test("verify rejects a forged routing even when the hash is recomputed (launder)", () => {
  const payload = buildDemaFdeForwarderDiagnosticPayload(
    defaultDemaFdeForwarderDiagnosticFixture(),
  );
  const { content_hash: _dropped, ...body } = payload;
  const forgedDestination = FDE_FORWARD_DESTINATIONS.find(
    (d) => d !== payload.routing.destination,
  );
  const forgedBody = {
    ...body,
    routing: { ...body.routing, destination: forgedDestination },
  };
  const laundered = {
    ...forgedBody,
    content_hash: `sha256:${sha256(stableStringify(forgedBody))}`,
  };
  // Self-consistent hash — only whole-body re-derivation from input catches it.
  const verdict = verifyDemaFdeForwarderDiagnostic(laundered);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.blocked_by.includes("body_rederivation_mismatch"));
});

test("verify rejects a vacuous empty boundary (key-omitting forgery)", () => {
  const payload = buildDemaFdeForwarderDiagnosticPayload(
    defaultDemaFdeForwarderDiagnosticFixture(),
  );
  const { content_hash: _dropped, ...body } = payload;
  const forgedBody = { ...body, boundary: {} };
  const laundered = {
    ...forgedBody,
    content_hash: `sha256:${sha256(stableStringify(forgedBody))}`,
  };
  const verdict = verifyDemaFdeForwarderDiagnostic(laundered);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.blocked_by.includes("boundary_not_canonical_all_false"));
});

test("doxology R1: code failures route to patch_code_proposal", () => {
  for (const cls of ["implementation_defect", "test_drift"]) {
    const payload = buildDemaFdeForwarderDiagnosticPayload(
      makeInput({ failure_class: cls, measured_status: "MEASURED" }),
    );
    assert.equal(payload.routing.destination, "patch_code_proposal");
    assert.deepEqual(payload.routing.fired_doxology_rules, ["R1"]);
  }
});

test("doxology R2: proof failures route to repair_proof_proposal", () => {
  for (const cls of ["proof_gap", "doc_drift"]) {
    const payload = buildDemaFdeForwarderDiagnosticPayload(
      makeInput({ failure_class: cls, measured_status: "MEASURED" }),
    );
    assert.equal(payload.routing.destination, "repair_proof_proposal");
    assert.deepEqual(payload.routing.fired_doxology_rules, ["R2"]);
  }
});

test("doxology R3: world failures route to repair_environment_proposal", () => {
  for (const cls of ["environment_gap", "dependency_gap", "permission_gap"]) {
    const payload = buildDemaFdeForwarderDiagnosticPayload(
      makeInput({ failure_class: cls, measured_status: "MEASURED" }),
    );
    assert.equal(payload.routing.destination, "repair_environment_proposal");
    assert.deepEqual(payload.routing.fired_doxology_rules, ["R3"]);
  }
});

test("doxology R7: CI unavailability is never forwarded as a code failure", () => {
  const payload = buildDemaFdeForwarderDiagnosticPayload(
    makeInput({
      failure_class: "github_actions_billing_lock",
      measured_status: "MEASURED",
      code_implicated: false,
    }),
  );
  assert.equal(payload.routing.destination, "ci_unavailable_operator_action");
  assert.deepEqual(payload.routing.fired_doxology_rules, ["R7"]);
  assert.equal(payload.routing.code_implicated_forwarded, false);
  assert.notEqual(payload.routing.destination, "patch_code_proposal");
});

test("doxology R7: billing lock claiming code_implicated true is rejected outright", () => {
  const plan = planDemaFdeForwarderDiagnostic({
    consent: DEMA_FDE_FORWARDER_DIAGNOSTIC_GO_PHRASE,
    input: makeInput({
      failure_class: "github_actions_billing_lock",
      code_implicated: true,
    }),
  });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("billing_lock_code_implicated_contradiction"));
});

test("boundary violations and insufficient evidence both stop, never forward", () => {
  const halt = buildDemaFdeForwarderDiagnosticPayload(
    makeInput({ failure_class: "boundary_violation", measured_status: "MEASURED" }),
  );
  assert.equal(halt.routing.destination, "halt_boundary_violation");

  const unknownClass = buildDemaFdeForwarderDiagnosticPayload(
    makeInput({ failure_class: "unknown", measured_status: "HYPOTHESIS" }),
  );
  assert.equal(unknownClass.routing.destination, "insufficient_evidence_stop");

  const unknownStatus = buildDemaFdeForwarderDiagnosticPayload(
    makeInput({ failure_class: "implementation_defect", measured_status: "UNKNOWN" }),
  );
  assert.equal(unknownStatus.routing.destination, "insufficient_evidence_stop");
});

test("doxology R5/R6/R8 guards hold on every routing", () => {
  const payload = buildDemaFdeForwarderDiagnosticPayload(
    defaultDemaFdeForwarderDiagnosticFixture(),
  );
  assert.equal(payload.doxology_guards.mint_blocked, true);
  assert.equal(payload.doxology_guards.simulated_impact_declared, true);
  assert.equal(payload.doxology_guards.cost_forwarded_as, "cost_only_never_value");
  assert.equal(payload.doxology_guards.connected_claim_made, false);
  // Fixture channel is unregistered: never pretend it is connected.
  assert.equal(payload.doxology_guards.channel_status, "UNREGISTERED_NOT_CONNECTED");

  // A declared-registered channel still earns no connectivity claim.
  const declared = buildDemaFdeForwarderDiagnosticPayload(
    makeInput({}, { channel: { name: "phone", registered: true } }),
  );
  assert.equal(
    declared.doxology_guards.channel_status,
    "DECLARED_REGISTERED_NOT_VERIFIED",
  );
  assert.equal(declared.doxology_guards.connected_claim_made, false);

  // No channel declared at all.
  const bare = buildDemaFdeForwarderDiagnosticPayload(
    makeInput({}, { channel: undefined, impact: undefined, cost: undefined }),
  );
  assert.equal(bare.doxology_guards.channel_status, "NO_CHANNEL");
  assert.equal(bare.doxology_guards.mint_blocked, true);
  assert.equal(bare.doxology_guards.cost_forwarded_as, "no_measured_cost_declared");
});

test("autopatch claims are rejected at validation", () => {
  const validation = validateDemaFdeForwarderInput(
    makeInput({ eligible_for_autopatch: true }),
  );
  assert.ok(validation.blocked_by.includes("autopatch_claim_rejected"));
});

test("every derivable destination is in the closed vocabulary (no mint/execute route exists)", () => {
  const fixture = defaultDemaFdeForwarderDiagnosticFixture();
  const classes = [
    "implementation_defect",
    "test_drift",
    "doc_drift",
    "environment_gap",
    "dependency_gap",
    "permission_gap",
    "proof_gap",
    "boundary_violation",
    "github_actions_billing_lock",
    "unknown",
  ];
  for (const cls of classes) {
    const routing = deriveDemaFdeForwardRouting({
      ...fixture,
      fde_report: {
        ...fixture.fde_report,
        failure_class: cls,
        measured_status: "MEASURED",
        code_implicated: cls === "github_actions_billing_lock" ? false : null,
      },
    });
    assert.ok(
      FDE_FORWARD_DESTINATIONS.includes(routing.destination),
      `${cls} -> ${routing.destination}`,
    );
    assert.equal(routing.proposal_only, true);
    assert.equal(routing.executed, false);
    assert.ok(!/mint|execute|autopatch|deploy|merge/.test(routing.destination));
  }
});

test("review gate closes the loop: build -> verify -> tamper-reject", () => {
  const result = runDemaFdeForwarderDiagnosticCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, DEMA_FDE_FORWARDER_DIAGNOSTIC_SCHEMA);
  assert.equal(result.truth_label, DEMA_FDE_FORWARDER_DIAGNOSTIC_TRUTH_LABEL);
});

test("orchestrator boundary stays all-false (no execution authority)", () => {
  const result = runDemaFdeForwarderDiagnostic({
    consent: DEMA_FDE_FORWARDER_DIAGNOSTIC_GO_PHRASE,
    input: defaultDemaFdeForwarderDiagnosticFixture(),
  });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
  assert.equal(result.boundary.live_execution_performed, false);
  assert.ok(FDE_FORWARD_DESTINATIONS.includes(result.destination));
});
