import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  planSat5ConstitutionalVerifierSetPreview,
  buildSat5ConstitutionalVerifierSetPreviewPayload,
  verifySat5ConstitutionalVerifierSetPreview,
  runSat5ConstitutionalVerifierSetPreview,
  SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_SCHEMA,
  SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_TRUTH_LABEL,
  SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_GO_PHRASE,
} from "../packages/core/src/sat5-constitutional-verifier-set-preview.js";
import { runSat5ConstitutionalVerifierSetPreviewCheck } from "../scripts/review/sat5-constitutional-verifier-set-preview-check.mjs";

// RED-FIRST: each test encodes part of the SAT5-CONSTITUTIONAL-VERIFIER-SET-PREVIEW-1A proof contract. They fail until
// the kernel bodies are implemented. Build to green — do not soften the asserts.

// A Node0 outcome that passes all five SAT verifiers.
const CLEAN_OUTCOME = {
  subject: "node0",
  receipt: { claimed_content_hash: "sha256:abc123", body_hash_rederived: "sha256:abc123" },
  consent: { phrase_present: true, exact_match: true },
  impact: { mint_claim: false, cost_called_value: false, simulated_impact_as_real: false, unverified_impact_claimed: false },
  blast: { blast_radius: "low", reversible: true, backup_present: false },
  doctrine: { truth_label_present: true, boundary_all_false: true, forbidden_claims: [] },
};

const FIXTURE_INPUT = { outcome: CLEAN_OUTCOME };

// Deep-clone + mutate one nested facet to build a failing fixture.
const withOutcome = (patch) => ({
  outcome: {
    ...CLEAN_OUTCOME,
    receipt: { ...CLEAN_OUTCOME.receipt, ...(patch.receipt || {}) },
    consent: { ...CLEAN_OUTCOME.consent, ...(patch.consent || {}) },
    impact: { ...CLEAN_OUTCOME.impact, ...(patch.impact || {}) },
    blast: { ...CLEAN_OUTCOME.blast, ...(patch.blast || {}) },
    doctrine: { ...CLEAN_OUTCOME.doctrine, ...(patch.doctrine || {}) },
  },
});
const runOf = (inp) => runSat5ConstitutionalVerifierSetPreview({ consent: SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_GO_PHRASE, input: inp });
const verdictOf = (j, id) => j.verifiers.find((v) => v.id === id).verdict;

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planSat5ConstitutionalVerifierSetPreview({ consent: "wrong", input: {} });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and well-formed input", () => {
  const plan = planSat5ConstitutionalVerifierSetPreview({ consent: SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_GO_PHRASE, input: FIXTURE_INPUT });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildSat5ConstitutionalVerifierSetPreviewPayload(FIXTURE_INPUT);
  assert.equal(payload.schema, SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_SCHEMA);
  assert.equal(payload.truth_label, SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.boundary.execution_allowed, false);
  assert.equal(payload.boundary.live_execution_performed, false);
});

test("verify accepts a freshly built payload", () => {
  const payload = buildSat5ConstitutionalVerifierSetPreviewPayload(FIXTURE_INPUT);
  assert.equal(verifySat5ConstitutionalVerifierSetPreview(payload).ok, true);
});

test("verify rejects a tampered content_hash", () => {
  const payload = buildSat5ConstitutionalVerifierSetPreviewPayload(FIXTURE_INPUT);
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  assert.equal(verifySat5ConstitutionalVerifierSetPreview(tampered).ok, false);
});

test("verify rejects a field change that did not update the content_hash", () => {
  // Internal-consistency check: a field changed but the stored hash did not, so
  // recompute-over-body must differ from content_hash.
  //
  // NOTE the harder launder this scaffold does NOT yet defend against: changing a
  // field AND recomputing the hash so the body is self-consistent. Internal
  // consistency alone cannot catch that — you need an INDEPENDENT anchor
  // (a signature over the payload, or an externally measured state hash). When
  // this slice gains one, add a test that forges + recomputes and still expects
  // rejection. Until then, do not claim launder-resistance.
  const payload = buildSat5ConstitutionalVerifierSetPreviewPayload(FIXTURE_INPUT);
  const forged = { ...payload, truth_label: "FORGED" };
  assert.equal(verifySat5ConstitutionalVerifierSetPreview(forged).ok, false);
});

test("review gate closes the loop: build -> verify -> tamper-reject", () => {
  const result = runSat5ConstitutionalVerifierSetPreviewCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_SCHEMA);
  assert.equal(result.truth_label, SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_TRUTH_LABEL);
});

test("orchestrator boundary stays all-false (no execution authority)", () => {
  const result = runSat5ConstitutionalVerifierSetPreview({ consent: SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_GO_PHRASE, input: FIXTURE_INPUT });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
  assert.equal(result.boundary.live_execution_performed, false);
});

// ── The five verifiers, each failing its own way ──────────────────────────

test("clean outcome: all five SAT verifiers PASS and the set is ADMISSIBLE", () => {
  const r = runOf(FIXTURE_INPUT);
  assert.equal(r.ok, true, r.blocked_by?.join(", "));
  for (const id of ["SAT-1", "SAT-2", "SAT-3", "SAT-4", "SAT-5"]) assert.equal(verdictOf(r.judgment, id), "PASS", id);
  assert.equal(r.judgment.set_verdict, "ADMISSIBLE");
  assert.equal(r.judgment.admissible, true);
});

test("SAT-1 receipt/hash: a hash mismatch FAILS and rejects the set", () => {
  const r = runOf(withOutcome({ receipt: { body_hash_rederived: "sha256:DIFFERENT" } }));
  assert.equal(verdictOf(r.judgment, "SAT-1"), "FAIL");
  assert.equal(r.judgment.admissible, false);
  assert.ok(r.judgment.failing_verifiers.includes("SAT-1"));
});

test("SAT-2 consent/FATE: absent or inexact consent FAILS", () => {
  const r = runOf(withOutcome({ consent: { exact_match: false } }));
  assert.equal(verdictOf(r.judgment, "SAT-2"), "FAIL");
  assert.equal(r.judgment.admissible, false);
});

test("SAT-3 impact/no-riba: any riba/zann tripwire FAILS", () => {
  const mint = runOf(withOutcome({ impact: { mint_claim: true } }));
  assert.equal(verdictOf(mint.judgment, "SAT-3"), "FAIL");
  assert.ok(mint.judgment.verifiers.find((v) => v.id === "SAT-3").reasons.includes("riba_zann:mint_claim"));
  const cost = runOf(withOutcome({ impact: { cost_called_value: true } }));
  assert.equal(verdictOf(cost.judgment, "SAT-3"), "FAIL");
});

test("SAT-4 security/blast-radius: high blast with no backup FAILS; high with backup+reversible PASSES", () => {
  const bad = runOf(withOutcome({ blast: { blast_radius: "high", reversible: true, backup_present: false } }));
  assert.equal(verdictOf(bad.judgment, "SAT-4"), "FAIL");
  const ok = runOf(withOutcome({ blast: { blast_radius: "high", reversible: true, backup_present: true } }));
  assert.equal(verdictOf(ok.judgment, "SAT-4"), "PASS");
});

test("SAT-5 governance/doctrine: a forbidden claim or missing truth label FAILS", () => {
  const fc = runOf(withOutcome({ doctrine: { forbidden_claims: ["public_safe"] } }));
  assert.equal(verdictOf(fc.judgment, "SAT-5"), "FAIL");
  assert.ok(fc.judgment.verifiers.find((v) => v.id === "SAT-5").reasons.includes("forbidden_claim:public_safe"));
  const nolabel = runOf(withOutcome({ doctrine: { truth_label_present: false } }));
  assert.equal(verdictOf(nolabel.judgment, "SAT-5"), "FAIL");
});

test("fail-closed: ABSTAIN (missing hash evidence) is not admissible", () => {
  const r = runOf(withOutcome({ receipt: { claimed_content_hash: "", body_hash_rederived: "" } }));
  assert.equal(verdictOf(r.judgment, "SAT-1"), "ABSTAIN");
  assert.equal(r.judgment.admissible, false);
});

// ── The constitutional law: SAT judges Node0, never serves it ─────────────

test("SAT judges Node0 and does not serve it; the judgment is inert", () => {
  const r = runOf(FIXTURE_INPUT);
  assert.equal(r.judgment.subject, "node0");
  assert.equal(r.judgment.judges_node0, true);
  assert.equal(r.judgment.serves_node0, false);
  assert.equal(r.judgment.live_sat_agent, false);
  assert.equal(r.judgment.authority_delta, 0);
  assert.equal(r.judgment.mint_allowed, false);
  assert.equal(r.judgment.urp_live, false);
});

test("verify rejects a forged ADMISSIBLE: a FAIL flipped to PASS with a recomputed hash", () => {
  const payload = buildSat5ConstitutionalVerifierSetPreviewPayload(withOutcome({ impact: { mint_claim: true } }));
  const forced = {
    ...payload.judgment,
    verifiers: payload.judgment.verifiers.map((v) => ({ ...v, verdict: "PASS", reasons: [] })),
    set_verdict: "ADMISSIBLE",
    admissible: true,
    failing_verifiers: [],
  };
  const { content_hash: _drop, ...body } = { ...payload, judgment: forced };
  const laundered = verifySat5ConstitutionalVerifierSetPreview({ ...body, content_hash: rehash(body) });
  assert.equal(laundered.ok, false);
  assert.ok(laundered.blocked_by.includes("judgment_not_rederivable"));
});

test("verify rejects a serves_node0 breach even when self-consistent", () => {
  const payload = buildSat5ConstitutionalVerifierSetPreviewPayload(FIXTURE_INPUT);
  const breached = { ...payload.judgment, serves_node0: true };
  const { content_hash: _drop, ...body } = { ...payload, judgment: breached };
  const laundered = verifySat5ConstitutionalVerifierSetPreview({ ...body, content_hash: rehash(body) });
  assert.equal(laundered.ok, false);
  assert.ok(
    laundered.blocked_by.includes("judgment_not_rederivable") || laundered.blocked_by.includes("must_not_serve_node0"),
  );
});

test("plan refuses a non-node0 subject and malformed facets", () => {
  const notNode0 = { outcome: { ...CLEAN_OUTCOME, subject: "node1" } };
  const p1 = planSat5ConstitutionalVerifierSetPreview({ consent: SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_GO_PHRASE, input: notNode0 });
  assert.equal(p1.eligible, false);
  assert.ok(p1.blocked_by.includes("subject_must_be_node0"));
  const badImpact = { outcome: { ...CLEAN_OUTCOME, impact: { mint_claim: false } } };
  const p2 = planSat5ConstitutionalVerifierSetPreview({ consent: SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_GO_PHRASE, input: badImpact });
  assert.equal(p2.eligible, false);
  assert.ok(p2.blocked_by.includes("impact_invalid"));
});

test("determinism: same outcome, same content hash", () => {
  const a = buildSat5ConstitutionalVerifierSetPreviewPayload(FIXTURE_INPUT);
  const b = buildSat5ConstitutionalVerifierSetPreviewPayload(FIXTURE_INPUT);
  assert.equal(a.content_hash, b.content_hash);
});

// Recompute a content hash the same way the kernel does, for launder fixtures.
function rehash(body) {
  const stable = (v) => {
    if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
    if (v && typeof v === "object") {
      return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
    }
    return JSON.stringify(v);
  };
  return `sha256:${createHash("sha256").update(stable(body), "utf8").digest("hex")}`;
}
