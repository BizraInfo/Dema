import test from "node:test";
import assert from "node:assert/strict";

import {
  applyZeroOverclaimPolicy,
  classifyClaim,
  planDemaZeroOverclaimPolicy,
  buildDemaZeroOverclaimPolicyPayload,
  verifyDemaZeroOverclaimPolicy,
  runDemaZeroOverclaimPolicy,
  POLICY_STATUSES,
  DEMA_ZERO_OVERCLAIM_POLICY_GO_PHRASE,
  DEMA_ZERO_OVERCLAIM_POLICY_SCHEMA,
} from "../packages/core/src/dema-zero-overclaim-response-policy.js";
import { runDemaZeroOverclaimPolicyCheck } from "../scripts/review/dema-zero-overclaim-response-policy-check.mjs";

const verifiedClaim = { text: "The IHSAN floor is 0.95.", claim_type: "fact", evidence_refs: ["constants.py"], source_quality: "primary", asserted_label: "VERIFIED" };
const inferenceClaim = { text: "The sources are likely synced.", claim_type: "inference", evidence_refs: ["gate"], asserted_label: "INFERRED" };
const speculationClaim = { text: "It might change next year.", claim_type: "speculation" };
const unsupportedFact = { text: "X equals Y.", claim_type: "fact", evidence_refs: [] };
const currentClaim = { text: "Today's rate is 3.67.", claim_type: "fact", freshness_risk: "current", evidence_refs: [] };
const highStakesClaim = { text: "This dosage is safe.", claim_type: "fact", high_stakes_domain: "medical", evidence_refs: [] };
const inventedClaim = { text: "Per study Z (2026).", claim_type: "fact", source_quality: "invented", evidence_refs: ["z"] };

const packet = (claims, extra = {}) => ({ answer_claims: claims, ...extra });

test("verified claim with evidence passes → cleared_to_respond / VERIFIED", () => {
  const r = applyZeroOverclaimPolicy(packet([verifiedClaim]));
  assert.equal(r.status, "cleared_to_respond");
  assert.equal(r.labels[0], "VERIFIED");
  assert.equal(r.blocked_by.length, 0);
});

test("inference requires the INFERRED label", () => {
  assert.equal(classifyClaim(inferenceClaim).enforced_label, "INFERRED");
});

test("speculation requires the SPECULATIVE label", () => {
  assert.equal(classifyClaim(speculationClaim).enforced_label, "SPECULATIVE");
});

test("an unsupported fact is downgraded to UNVERIFIED (honestly labeled, not shipped as fact)", () => {
  const r = applyZeroOverclaimPolicy(packet([unsupportedFact]));
  assert.equal(r.labels[0], "UNVERIFIED");
});

test("a current claim without verification blocks", () => {
  const r = applyZeroOverclaimPolicy(packet([currentClaim]));
  assert.equal(r.labels[0], "BLOCKED_PENDING_EVIDENCE");
  assert.equal(r.status, "blocked_pending_evidence");
});

test("a high-stakes claim without a source blocks", () => {
  const r = applyZeroOverclaimPolicy(packet([highStakesClaim]));
  assert.equal(r.labels[0], "BLOCKED_PENDING_EVIDENCE");
  assert.equal(r.status, "blocked_pending_evidence");
});

test("an invented citation is rejected", () => {
  const r = applyZeroOverclaimPolicy(packet([inventedClaim]));
  assert.equal(r.status, "rejected_overclaim");
  assert.ok(r.blocked_by.includes("invented_source"));
});

test("inference presented as VERIFIED is rejected", () => {
  const r = applyZeroOverclaimPolicy(packet([{ ...inferenceClaim, asserted_label: "VERIFIED" }]));
  assert.equal(r.status, "rejected_overclaim");
  assert.ok(r.blocked_by.includes("inference_as_fact"));
});

test("speculation presented as VERIFIED is rejected", () => {
  const r = applyZeroOverclaimPolicy(packet([{ ...speculationClaim, asserted_label: "VERIFIED" }]));
  assert.equal(r.status, "rejected_overclaim");
  assert.ok(r.blocked_by.includes("speculation_as_verified"));
});

test("authority inflation is rejected", () => {
  assert.ok(applyZeroOverclaimPolicy(packet([verifiedClaim], { grants_action: true })).blocked_by.includes("authority_inflation"));
  assert.ok(applyZeroOverclaimPolicy(packet([verifiedClaim], { authority_delta: 1 })).blocked_by.includes("authority_inflation"));
  assert.ok(applyZeroOverclaimPolicy(packet([unsupportedFact], { claims_truth: true })).blocked_by.includes("claims_truth_without_evidence"));
});

test("policy output preserves the all-false boundary and no authority", () => {
  const r = applyZeroOverclaimPolicy(packet([verifiedClaim]));
  assert.equal(r.grants_action, false);
  assert.equal(r.claims_truth, false);
  assert.equal(r.authority_delta, 0);
  assert.ok(Object.values(r.boundary).every((v) => v === false));
  assert.ok(POLICY_STATUSES.includes(r.status));
});

test("payload is content-addressed and stable; verify rejects a grants_action and a boundary tamper", () => {
  const p1 = buildDemaZeroOverclaimPolicyPayload(packet([verifiedClaim, inferenceClaim]));
  const p2 = buildDemaZeroOverclaimPolicyPayload(packet([verifiedClaim, inferenceClaim]));
  assert.equal(p1.content_hash, p2.content_hash);
  assert.match(p1.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(verifyDemaZeroOverclaimPolicy(p1).ok, true);
  assert.ok(verifyDemaZeroOverclaimPolicy({ ...p1, grants_action: true }).blocked_by.includes("grants_action_true"));
  assert.ok(verifyDemaZeroOverclaimPolicy({ ...p1, boundary: {} }).blocked_by.includes("boundary_not_all_false"));
  assert.equal(verifyDemaZeroOverclaimPolicy(null).ok, false);
});

test("plan is fail-closed on consent and a malformed packet", () => {
  assert.ok(planDemaZeroOverclaimPolicy({ consent: "no", input: packet([]) }).blocked_by.includes("consent_phrase_mismatch"));
  assert.ok(planDemaZeroOverclaimPolicy({ consent: DEMA_ZERO_OVERCLAIM_POLICY_GO_PHRASE, input: {} }).blocked_by.includes("missing_answer_claims"));
});

test("review gate closes the loop → cleared_to_respond, ok; orchestrator fail-closed without consent", () => {
  const r = runDemaZeroOverclaimPolicyCheck();
  assert.equal(r.ok, true, r.blocked_by?.join(", "));
  assert.equal(r.policy_status, "cleared_to_respond");
  assert.equal(r.schema, DEMA_ZERO_OVERCLAIM_POLICY_SCHEMA);
  const blocked = runDemaZeroOverclaimPolicy({ consent: "wrong", input: packet([verifiedClaim]) });
  assert.equal(blocked.ok, false);
  assert.ok(blocked.blocked_by.includes("consent_phrase_mismatch"));
});
