// FATE-AUTHORIZATION-KERNEL-1A — the contract from FATE-BOUNDARY-1B.
//
// Ruling (operator, 2026-08-07): "Human consent establishes permission. FATE
// independently determines whether that permission may become executable
// authority." FATE sits AFTER exact human consent has produced an immutable
// consent receipt and BEFORE any executable authority or nonce claim exists.
//
// The defect this kernel exists to make impossible: packages/fate/src/fate.js is
// 13 lines of `phrase === requiredPhrase`. The quarantined
// corridor-fate-integration-1a produced "two phrase checks, not an independent
// policy decision" because there was no policy kernel to call. So the first law
// is enforced STRUCTURALLY, not by intention.
//
// Every refusal test binds the EXACT reason code. `ok === false` is not an
// assertion — measured four separate times in this estate, most recently in this
// slice's own sibling gate.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  evaluateFateAuthorization,
  verifyFateAuthorization,
  FATE_AUTHORIZATION_SCHEMA,
  FATE_AUTHORIZATION_VERDICTS,
  FATE_CHECK_ORDER,
} from "../packages/fate/src/fate-authorization-kernel.js";

const ROOT = "b89d8718c7d79514e90d07875467e78c590bc2d3";
const SEASON = "sha256:171a2507396b1b6e8d6c5e2ff8bbabac48092c2d80521f135ff467b241565e80";
const NOW = 1_800_000_000_000;

// The independently-resolved truth. The caller never supplies this.
function authority(over = {}) {
  return {
    root: ROOT,
    season_head: SEASON,
    policy_version: "fate.policy.v0.1",
    policy_hash: "p".repeat(64),
    now: NOW,
    ...over,
  };
}

function candidate(over = {}) {
  const base = {
    mission_id: "M-1",
    effect_id: "E-1",
    plan_hash: "a".repeat(64),
    preview_hash: "b".repeat(64),
    risk_class: "reversible_local",
    requested_scope: "/sandbox/root",
    lease: { lease_id: "L", scope_root: "/sandbox/root", expires_at: NOW + 60_000 },
    observed_root: ROOT,
    observed_season_head: SEASON,
    proposer_identity: "actor:typed-intent",
    executor_identity: "habitat:l1-kernel",
    verifier_identity: "sat:independent",
    policy_version: "fate.policy.v0.1",
    fate_policy_verdict: { schema: "bizra.dema.node0_fate_contract.v0.1", verdict: "PERMIT" },
    ...over,
  };
  // consent binds effect+plan+preview; computed unless the test overrides it
  if (!("consent_receipt_hash" in over)) {
    base.consent_receipt_hash = consentBindingFor(base);
  }
  return base;
}

// mirrors the kernel's derivation — a test that reuses the kernel's own helper
// would prove nothing about the binding
import { createHash } from "node:crypto";
function consentBindingFor(c) {
  return createHash("sha256")
    .update(`${c.effect_id}\n${c.plan_hash}\n${c.preview_hash}`)
    .digest("hex");
}

// ── the structural independence law ────────────────────────────────────────

// Comments are stripped first. The law forbids IMPORTING or CALLING the phrase
// helper, not naming it in prose — this repo already paid for that distinction
// once, when kernel-purity flagged a `fetch (` that was documentation.
function codeOnly(path) {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*\/\//.test(l))
    .join("\n");
}

test("AUTH-01: LAW 1 — the kernel does not import or call the consent phrase helper", () => {
  const code = codeOnly("packages/fate/src/fate-authorization-kernel.js");
  assert.equal(/evaluateConsent\s*\(|from\s+["'"'"'].*fate\.js["'"'"']/.test(code), false,
    "FATE must not parse or duplicate the human consent phrase as its policy decision");
  assert.equal(/requiredPhrase|phrase\s*===/.test(code), false,
    "no phrase comparison may appear in the policy kernel");
  // control: the stripper must not have eaten the file
  assert.ok(code.includes("export function evaluateFate"), "comment stripper removed real code");
});

test("AUTH-02: the kernel is pure — no fs, clock, network or randomness", () => {
  const src = codeOnly("packages/fate/src/fate-authorization-kernel.js");
  for (const forbidden of ["node:fs", "node:net", "node:http", "child_process", "Date.now", "Math.random"]) {
    assert.equal(src.includes(forbidden), false, `kernel must not use ${forbidden}`);
  }
});

// ── verdicts ───────────────────────────────────────────────────────────────

test("AUTH-03: valid consent + valid root -> ALLOW", () => {
  const v = evaluateFateAuthorization(candidate(), authority());
  assert.equal(v.verdict, "ALLOW");
  assert.equal(v.reason, "ALLOW");
  assert.equal(v.authority_root, ROOT);
  assert.ok(v.candidate_hash);
  assert.equal(v.schema, FATE_AUTHORIZATION_SCHEMA);
});

test("AUTH-04: phrase valid, root wrong -> DENY_ROOT_MISMATCH", () => {
  const v = evaluateFateAuthorization(candidate({ observed_root: "c".repeat(40) }), authority());
  assert.equal(v.verdict, "DENY");
  assert.equal(v.reason, "DENY_ROOT_MISMATCH");
});

test("AUTH-05: season mismatch -> DENY_SEASON_MISMATCH", () => {
  const v = evaluateFateAuthorization(candidate({ observed_season_head: "sha256:deadbeef" }), authority());
  assert.equal(v.verdict, "DENY");
  assert.equal(v.reason, "DENY_SEASON_MISMATCH");
});

test("AUTH-06: root valid, consent bound to a DIFFERENT preview -> DENY_CONSENT_BINDING", () => {
  const c = candidate();
  c.preview_hash = "z".repeat(64); // consent hash now binds the old preview
  const v = evaluateFateAuthorization(c, authority());
  assert.equal(v.verdict, "DENY");
  assert.equal(v.reason, "DENY_CONSENT_BINDING");
});

test("AUTH-07: LAW 2 — caller supplies its own expected root -> rejected", () => {
  // the exact defect measured in corridor-fate-integration-1a:
  // state.repository_commit passed as the EXPECTED commit, so x !== x never fired
  const v = evaluateFateAuthorization(candidate({ expected_root: ROOT }), authority());
  assert.equal(v.verdict, "DENY");
  assert.equal(v.reason, "DENY_CALLER_NOMINATED_AUTHORITY");
});

test("AUTH-08: LAW 3 — caller supplies alternate Season state -> rejected", () => {
  const v = evaluateFateAuthorization(candidate({ season_state_override: "anything" }), authority());
  assert.equal(v.verdict, "DENY");
  assert.equal(v.reason, "DENY_CALLER_NOMINATED_AUTHORITY");
});

test("AUTH-09: expired lease -> DENY_LEASE_EXPIRED", () => {
  const v = evaluateFateAuthorization(
    candidate({ lease: { lease_id: "L", scope_root: "/sandbox/root", expires_at: NOW - 1 } }),
    authority(),
  );
  assert.equal(v.verdict, "DENY");
  assert.equal(v.reason, "DENY_LEASE_EXPIRED");
});

test("AUTH-10: scope mismatch -> DENY_SCOPE", () => {
  const v = evaluateFateAuthorization(candidate({ requested_scope: "/elsewhere" }), authority());
  assert.equal(v.verdict, "DENY");
  assert.equal(v.reason, "DENY_SCOPE");
});

test("AUTH-11: proposer == certifier -> DENY_INDEPENDENCE", () => {
  const v = evaluateFateAuthorization(
    candidate({ proposer_identity: "same", verifier_identity: "same" }),
    authority(),
  );
  assert.equal(v.verdict, "DENY");
  assert.equal(v.reason, "DENY_INDEPENDENCE");
});

test("AUTH-12: missing policy evidence -> UNVERIFIABLE, never DENY and never ALLOW", () => {
  const v = evaluateFateAuthorization(candidate(), authority({ policy_hash: undefined }));
  assert.equal(v.verdict, "UNVERIFIABLE");
  assert.equal(v.reason, "UNVERIFIABLE_POLICY_EVIDENCE_ABSENT");
});

test("AUTH-13: absent authority context -> UNVERIFIABLE, fail closed", () => {
  assert.equal(evaluateFateAuthorization(candidate(), null).verdict, "UNVERIFIABLE");
  assert.equal(evaluateFateAuthorization(candidate(), undefined).reason, "UNVERIFIABLE_AUTHORITY_CONTEXT_ABSENT");
});

test("AUTH-14: LAW 4 — no verdict ever grants authority", () => {
  const cases = [
    evaluateFateAuthorization(candidate(), authority()),                                  // ALLOW
    evaluateFateAuthorization(candidate({ observed_root: "x".repeat(40) }), authority()), // DENY
    evaluateFateAuthorization(candidate(), null),                                         // UNVERIFIABLE
  ];
  for (const v of cases) {
    assert.equal(v.effect_performed, false);
    assert.equal(v.authority_delta, 0);
    assert.equal(v.mint_allowed, false);
  }
});

// ── forgery ────────────────────────────────────────────────────────────────

test("AUTH-15: a forged ALLOW is rejected by re-derivation", () => {
  const denied = evaluateFateAuthorization(candidate({ observed_root: "y".repeat(40) }), authority());
  assert.equal(verifyFateAuthorization(denied, candidate({ observed_root: "y".repeat(40) }), authority()), true);
  const forged = { ...denied, verdict: "ALLOW", reason: "ALLOW" };
  assert.equal(
    verifyFateAuthorization(forged, candidate({ observed_root: "y".repeat(40) }), authority()),
    false,
    "flipping the verdict must not survive re-derivation",
  );
});

test("AUTH-16: a verdict re-derived against a DIFFERENT candidate is rejected", () => {
  const v = evaluateFateAuthorization(candidate(), authority());
  assert.equal(verifyFateAuthorization(v, candidate({ effect_id: "E-2" }), authority()), false);
});

// ── determinism and ordering ───────────────────────────────────────────────

test("AUTH-17: DIFFERENTIAL REFUSAL — break two gates, the earlier one speaks", () => {
  // ordering is observable, so it is pinned. Root precedes consent-binding.
  const both = candidate({ observed_root: "w".repeat(40), preview_hash: "z".repeat(64) });
  assert.equal(evaluateFateAuthorization(both, authority()).reason, "DENY_ROOT_MISMATCH");
  assert.ok(FATE_CHECK_ORDER.indexOf("root") < FATE_CHECK_ORDER.indexOf("consent_binding"));
  // and caller-nominated authority precedes everything substantive
  assert.equal(FATE_CHECK_ORDER.indexOf("caller_nominated") < FATE_CHECK_ORDER.indexOf("root"), true);
});

test("AUTH-18: deterministic — same inputs, identical verdict object", () => {
  assert.deepEqual(evaluateFateAuthorization(candidate(), authority()), evaluateFateAuthorization(candidate(), authority()));
});

test("AUTH-19: the verdict vocabulary is exactly three values", () => {
  assert.deepEqual([...FATE_AUTHORIZATION_VERDICTS].sort(), ["ALLOW", "DENY", "UNVERIFIABLE"]);
});

// ── the composite laws from FATE-BOUNDARY-1B ───────────────────────────────

test("AUTH-20: consent receipt absent -> UNVERIFIABLE_CONSENT_EVIDENCE_ABSENT", () => {
  // This kernel is the POST-consent gate. With no consent artifact it must not
  // silently become the pre-consent policy layer that PR #452 legitimately owns.
  const c = candidate();
  delete c.consent_receipt_hash;
  const v = evaluateFateAuthorization(c, authority());
  assert.equal(v.verdict, "UNVERIFIABLE");
  assert.equal(v.reason, "UNVERIFIABLE_CONSENT_EVIDENCE_ABSENT");
  assert.notEqual(v.verdict, "ALLOW");
});

test("AUTH-21: valid consent but stage-1 policy did not PERMIT -> DENY_POLICY_PRECONDITION", () => {
  const v = evaluateFateAuthorization(
    candidate({ fate_policy_verdict: { schema: "bizra.dema.node0_fate_contract.v0.1", verdict: "REFUSE" } }),
    authority(),
  );
  assert.equal(v.verdict, "DENY");
  assert.equal(v.reason, "DENY_POLICY_PRECONDITION");
});

test("AUTH-22: a stage-1 verdict under the WRONG schema cannot satisfy the precondition", () => {
  const v = evaluateFateAuthorization(
    candidate({ fate_policy_verdict: { schema: "some.other.schema.v1", verdict: "PERMIT" } }),
    authority(),
  );
  assert.equal(v.reason, "DENY_POLICY_PRECONDITION");
});

test("AUTH-23: the pinned stage-1 tokens match PR #452's real contract", () => {
  // read from feat/node0-bridge-readiness-correction-1b via gh api on 2026-08-07.
  // If PR #452 changes these, this test is the tripwire — not a silent drift.
  const src = readFileSync("packages/fate/src/fate-authorization-kernel.js", "utf8");
  assert.match(src, /FATE_POLICY_SCHEMA_EXPECTED = "bizra\.dema\.node0_fate_contract\.v0\.1"/);
  assert.match(src, /FATE_POLICY_PERMIT = "PERMIT"/);
});

test("AUTH-24: the precondition is inside the candidate hash — a forged PERMIT changes it", () => {
  const permit = evaluateFateAuthorization(candidate(), authority());
  const refuse = evaluateFateAuthorization(
    candidate({ fate_policy_verdict: { schema: "bizra.dema.node0_fate_contract.v0.1", verdict: "REFUSE" } }),
    authority(),
  );
  assert.notEqual(permit.candidate_hash, refuse.candidate_hash,
    "swapping the stage-1 verdict must change the bound hash");
});
