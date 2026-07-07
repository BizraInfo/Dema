import test from "node:test";
import assert from "node:assert/strict";

import {
  socraticInterrogate,
  planDemaSocraticCriticPreview,
  buildDemaSocraticCriticPreviewPayload,
  verifyDemaSocraticCriticPreview,
  runDemaSocraticCriticPreview,
  CRITIC_STATUSES,
  DEMA_SOCRATIC_CRITIC_PREVIEW_GO_PHRASE,
  DEMA_SOCRATIC_CRITIC_PREVIEW_SCHEMA,
} from "../packages/core/src/dema-socratic-critic-process-supervision-preview.js";
import { runDemaSocraticCriticPreviewCheck } from "../scripts/review/dema-socratic-critic-process-supervision-preview-check.mjs";

const VALID = {
  claim: "The IHSAN floor equals 0.95 across Python and Rust.",
  causal_path: [{ from: "constants.py", to: "0.95" }, { from: "rust source", to: "0.95" }],
  constraints: [{ id: "cross_lang_sync", satisfied: true }],
  evidence_refs: ["core/integration/constants.py", "rust/src/constants.rs"],
  certainty: "high",
  falsifier: "Either source reads a value other than 0.95.",
};

test("a well-formed hypothesis that survives interrogation → ready_for_sat", () => {
  const r = socraticInterrogate(VALID);
  assert.equal(r.status, "ready_for_sat");
  assert.equal(r.blocked_by.length, 0, r.blocked_by.join(", "));
});

test("emits all seven Socratic gates", () => {
  const r = socraticInterrogate(VALID);
  for (const g of [
    "clarification_question",
    "constraint_check",
    "causal_path_probe",
    "counterexample_generation",
    "falsification_condition",
    "uncertainty_label",
    "verified_vs_inferred_split",
  ]) {
    assert.ok(g in r.gates, `missing gate ${g}`);
  }
  assert.deepEqual(r.gates.verified_vs_inferred_split, { verified: 2, inferred: 2, unknown: 0 });
});

test("rejected_overclaim when a declared constraint is violated", () => {
  const r = socraticInterrogate({ ...VALID, constraints: [{ id: "no_overclaim", satisfied: false }] });
  assert.equal(r.status, "rejected_overclaim");
  assert.ok(r.blocked_by.includes("constraint_violated"));
});

test("rejected_overclaim when certainty outruns evidence", () => {
  const r = socraticInterrogate({ ...VALID, certainty: "certain", evidence_refs: [] });
  assert.equal(r.status, "rejected_overclaim");
  assert.ok(r.blocked_by.includes("unsupported_certainty"));
});

test("needs_revision on a vacuous claim", () => {
  const r = socraticInterrogate({ ...VALID, claim: "tiny" });
  assert.equal(r.status, "needs_revision");
  assert.ok(r.blocked_by.includes("vacuous_claim"));
});

test("blocked_by_missing_evidence on a missing causal path", () => {
  const r = socraticInterrogate({ ...VALID, causal_path: [] });
  assert.equal(r.status, "blocked_by_missing_evidence");
  assert.ok(r.blocked_by.includes("missing_causal_path"));
});

test("blocked_by_missing_evidence on a missing falsifier", () => {
  const r = socraticInterrogate({ ...VALID, falsifier: "" });
  assert.equal(r.status, "blocked_by_missing_evidence");
  assert.ok(r.blocked_by.includes("missing_falsifier"));
});

test("the critic never grants authority, never claims truth, authority_delta stays 0", () => {
  for (const input of [
    VALID,
    { ...VALID, constraints: [{ id: "x", satisfied: false }] },
    { ...VALID, claim: "tiny" },
    {},
  ]) {
    const r = socraticInterrogate(input);
    assert.equal(r.grants_action, false);
    assert.equal(r.claims_truth, false);
    assert.equal(r.authority_delta, 0);
    assert.ok(CRITIC_STATUSES.includes(r.status));
    assert.notEqual(r.status, "verified");
  }
});

test("payload is content-addressed; verify accepts it and rejects a grants_action tamper", () => {
  const p = buildDemaSocraticCriticPreviewPayload(VALID);
  assert.match(p.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(verifyDemaSocraticCriticPreview(p).ok, true);
  const tampered = { ...p, grants_action: true };
  const v = verifyDemaSocraticCriticPreview(tampered);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("grants_action_true"));
});

test("verify rejects a vacuous boundary and an unknown status", () => {
  const p = buildDemaSocraticCriticPreviewPayload(VALID);
  assert.ok(verifyDemaSocraticCriticPreview({ ...p, boundary: {} }).blocked_by.includes("boundary_not_all_false"));
  assert.ok(verifyDemaSocraticCriticPreview({ ...p, status: "verified" }).blocked_by.includes("unknown_status"));
  assert.equal(verifyDemaSocraticCriticPreview(null).ok, false);
});

test("plan is fail-closed on consent and a malformed hypothesis", () => {
  assert.ok(planDemaSocraticCriticPreview({ consent: "no", input: VALID }).blocked_by.includes("consent_phrase_mismatch"));
  const p = planDemaSocraticCriticPreview({ consent: DEMA_SOCRATIC_CRITIC_PREVIEW_GO_PHRASE, input: { constraints: [] } });
  assert.ok(p.blocked_by.includes("missing_claim"));
});

test("review gate closes the loop → ready_for_sat, ok", () => {
  const r = runDemaSocraticCriticPreviewCheck();
  assert.equal(r.ok, true, r.blocked_by?.join(", "));
  assert.equal(r.critic_status, "ready_for_sat");
  assert.equal(r.schema, DEMA_SOCRATIC_CRITIC_PREVIEW_SCHEMA);
  assert.equal(r.boundary.execution_allowed, false);
});

test("orchestrator is fail-closed without exact consent", () => {
  const r = runDemaSocraticCriticPreview({ consent: "wrong", input: VALID });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("consent_phrase_mismatch"));
});
