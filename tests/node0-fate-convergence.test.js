// FATE-CONVERGENCE-1A — the composite ordering contract.
//
// Ruling FATE-BOUNDARY-1B: FATE has two independent stages with human
// sovereignty between them.
//
//   Season → FATE_POLICY → preview → EXACT CONSENT → ConsentReceipt
//          → FATE_AUTHORIZATION → NONCE_ELIGIBLE   ← and STOP
//
// This suite does NOT re-test either kernel's local semantics — they own those
// (15 + 24 tests). It proves the COMPOSITION cannot be reordered or collapsed:
// that a stage which must not run, did not run.
//
// Ordering is therefore proven with COUNTING SPIES, not inferred from a return
// value. "Stage 2 was not called" is an assertion about calls; asserting only on
// the terminal state would pass even if stage 2 ran and its result was discarded.
//
// Every refusal binds the EXACT reason. `ok === false` is not an assertion —
// measured five times in this estate now.

import test from "node:test";
import assert from "node:assert/strict";

import {
  composeFateConvergence,
  verifyFateConvergence,
  CONVERGENCE_SCHEMA,
  CONVERGENCE_STATES,
} from "../packages/core/src/node0-fate-convergence.js";

const ROOT = "b89d8718c7d79514e90d07875467e78c590bc2d3";
const SEASON = "sha256:171a2507396b1b6e8d6c5e2ff8bbabac48092c2d80521f135ff467b241565e80";
const NOW = 1_800_000_000_000;
const PHRASE = "GO: rename one bounded local file";
const POLICY_SCHEMA = "bizra.dema.node0_fate_contract.v0.1";

// ── injected stages, each counting its own calls ───────────────────────────
function spies(over = {}) {
  const calls = { policy: 0, consent: 0, authorization: 0 };
  return {
    calls,
    stages: {
      evaluatePolicy: (...a) => { calls.policy += 1; return (over.policy ?? (() => ({ schema: POLICY_SCHEMA, verdict: "PERMIT" })))(...a); },
      evaluateConsent: (...a) => { calls.consent += 1; return (over.consent ?? ((c) => ({ accepted: c.phrase === PHRASE })))(...a); },
      evaluateAuthorization: (...a) => { calls.authorization += 1; return (over.authorization ?? (() => ({ verdict: "ALLOW", reason: "ALLOW", candidate_hash: "h".repeat(64) })))(...a); },
    },
  };
}

function input(over = {}) {
  return {
    effect: { effect_id: "E-1", kind: "bounded_local_rename", src: "a.txt", dst: "b.txt" },
    season_authority: { head: SEASON, eligible: true },
    preview_hash: "b".repeat(64),
    plan_hash: "a".repeat(64),
    consent: { phrase: PHRASE, receipt_hash: null },
    authority_context: { root: ROOT, season_head: SEASON, policy_version: "fate.policy.v0.1", policy_hash: "p".repeat(64), now: NOW },
    ...over,
  };
}

const ZERO = (r) => {
  assert.equal(r.nonce_claimed, false);
  assert.equal(r.effect_executed, false);
  assert.equal(r.mutation_performed, false);
  assert.equal(r.authority_delta, 0);
  assert.equal(r.mint_allowed, false);
};

// ── C1–C2 · stage 1 governs whether the human is even asked ────────────────

test("C1: stage-1 REFUSE — the human is never asked, stage 2 never runs", () => {
  const s = spies({ policy: () => ({ schema: POLICY_SCHEMA, verdict: "REFUSE", reason: "EFFECT_KIND_NOT_PERMITTED" }) });
  const r = composeFateConvergence(input(), s.stages);
  assert.equal(r.state, "REFUSED_POLICY");
  assert.equal(s.calls.consent, 0, "consent evaluator must not run after a policy refusal");
  assert.equal(s.calls.authorization, 0, "authorization must not run after a policy refusal");
  assert.equal(r.nonce_eligible, false);
  ZERO(r);
});

test("C2: stage-1 PERMIT, consent absent -> CONSENT_REQUIRED, stage 2 never runs", () => {
  const s = spies();
  const r = composeFateConvergence(input({ consent: null }), s.stages);
  assert.equal(r.state, "CONSENT_REQUIRED");
  assert.equal(s.calls.authorization, 0);
  ZERO(r);
});

// ── C3–C4 · consent is sovereign and context-bound ─────────────────────────

test("C3: wrong exact consent -> BLOCKED_CONSENT, stage 2 never runs", () => {
  const s = spies();
  const r = composeFateConvergence(input({ consent: { phrase: "go ahead", receipt_hash: null } }), s.stages);
  assert.equal(r.state, "BLOCKED_CONSENT");
  assert.equal(r.reason, "BLOCKED_CONSENT_PHRASE");
  assert.equal(s.calls.authorization, 0);
  ZERO(r);
});

test("C4: consent bound to the WRONG preview -> BLOCKED_CONSENT_BINDING, not a generic false", () => {
  const s = spies();
  const r = composeFateConvergence(
    input({ consent: { phrase: PHRASE, receipt_hash: "f".repeat(64) } }),
    s.stages,
  );
  assert.equal(r.state, "BLOCKED_CONSENT");
  assert.equal(r.reason, "BLOCKED_CONSENT_BINDING");
  assert.equal(s.calls.authorization, 0);
});

// ── C5–C12 · stage 2 reasons surface intact ────────────────────────────────

const stage2Cases = [
  ["C5",  "UNVERIFIABLE", "UNVERIFIABLE_POLICY_EVIDENCE_ABSENT",  "UNVERIFIABLE_AUTHORIZATION"],
  ["C6",  "DENY",         "DENY_ROOT_MISMATCH",                   "DENIED_AUTHORIZATION"],
  ["C7",  "DENY",         "DENY_SEASON_MISMATCH",                 "DENIED_AUTHORIZATION"],
  ["C8",  "DENY",         "DENY_CALLER_NOMINATED_AUTHORITY",      "DENIED_AUTHORIZATION"],
  ["C9",  "DENY",         "DENY_LEASE_EXPIRED",                   "DENIED_AUTHORIZATION"],
  ["C10", "DENY",         "DENY_SCOPE",                           "DENIED_AUTHORIZATION"],
  ["C11", "DENY",         "DENY_INDEPENDENCE",                    "DENIED_AUTHORIZATION"],
  ["C12", "DENY",         "DENY_POLICY_PRECONDITION",             "DENIED_AUTHORIZATION"],
];
for (const [id, verdict, reason, state] of stage2Cases) {
  test(`${id}: stage-2 ${reason} -> ${state}, exact reason preserved, no eligibility`, () => {
    const s = spies({ authorization: () => ({ verdict, reason, candidate_hash: "h".repeat(64) }) });
    const r = composeFateConvergence(input(), s.stages);
    assert.equal(r.state, state);
    assert.equal(r.reason, reason, "the underlying stage-2 reason must survive composition");
    assert.equal(r.nonce_eligible, false);
    ZERO(r);
  });
}

// ── C13–C14 · the positive path, and what it still does not grant ──────────

test("C13: full valid composition -> NONCE_ELIGIBLE", () => {
  const s = spies();
  const r = composeFateConvergence(input(), s.stages);
  assert.equal(r.state, "NONCE_ELIGIBLE");
  assert.equal(r.nonce_eligible, true);
  assert.equal(s.calls.policy, 1);
  assert.equal(s.calls.consent, 1);
  assert.equal(s.calls.authorization, 1);
  assert.equal(r.schema, CONVERGENCE_SCHEMA);
  assert.ok(r.convergence_hash);
});

test("C14: NONCE_ELIGIBLE still grants nothing", () => {
  ZERO(composeFateConvergence(input(), spies().stages));
});

// ── C15–C16 · differential ordering under simultaneous failure ─────────────

test("C15: stage 1 AND consent both invalid -> the STAGE-1 refusal speaks", () => {
  const s = spies({ policy: () => ({ schema: POLICY_SCHEMA, verdict: "REFUSE", reason: "X" }) });
  const r = composeFateConvergence(input({ consent: { phrase: "wrong", receipt_hash: null } }), s.stages);
  assert.equal(r.state, "REFUSED_POLICY");
  assert.equal(s.calls.consent, 0, "the later stage must not even be consulted");
  assert.equal(s.calls.authorization, 0);
});

test("C16: consent AND stage 2 would both fail -> the CONSENT refusal speaks", () => {
  const s = spies({ authorization: () => ({ verdict: "DENY", reason: "DENY_ROOT_MISMATCH" }) });
  const r = composeFateConvergence(input({ consent: { phrase: "wrong", receipt_hash: null } }), s.stages);
  assert.equal(r.state, "BLOCKED_CONSENT");
  assert.equal(s.calls.authorization, 0);
});

// ── C17–C18 · sealing and the authority invariant ──────────────────────────

test("C17: tampering with the convergence verdict fails verification", () => {
  const r = composeFateConvergence(input(), spies().stages);
  assert.equal(verifyFateConvergence(r), true);
  assert.equal(verifyFateConvergence({ ...r, state: "NONCE_ELIGIBLE", nonce_eligible: true, convergence_hash: "0".repeat(64) }), false);
  const denied = composeFateConvergence(input({ consent: null }), spies().stages);
  assert.equal(verifyFateConvergence({ ...denied, state: "NONCE_ELIGIBLE", nonce_eligible: true }), false,
    "promoting a refusal to eligibility must not survive re-derivation");
});

test("C18: NO terminal state ever increases authority", () => {
  const all = [
    composeFateConvergence(input(), spies({ policy: () => ({ schema: POLICY_SCHEMA, verdict: "REFUSE" }) }).stages),
    composeFateConvergence(input({ consent: null }), spies().stages),
    composeFateConvergence(input({ consent: { phrase: "no", receipt_hash: null } }), spies().stages),
    composeFateConvergence(input(), spies({ authorization: () => ({ verdict: "DENY", reason: "DENY_SCOPE" }) }).stages),
    composeFateConvergence(input(), spies({ authorization: () => ({ verdict: "UNVERIFIABLE", reason: "UNVERIFIABLE_POLICY_EVIDENCE_ABSENT" }) }).stages),
    composeFateConvergence(input(), spies().stages),
  ];
  assert.equal(all.length, 6, "every terminal class is exercised");
  for (const r of all) ZERO(r);
  assert.deepEqual([...new Set(all.map((r) => r.state))].sort(), [...CONVERGENCE_STATES].sort());
});

test("C19: the composer performs no IO, reads no clock, uses no randomness", () => {
  const src = readFileSyncCodeOnly("packages/core/src/node0-fate-convergence.js");
  for (const f of ["node:fs", "node:net", "node:http", "child_process", "Date.now", "Math.random"]) {
    assert.equal(src.includes(f), false, `composer must not use ${f}`);
  }
  assert.ok(src.includes("export function composeFateConvergence"), "stripper ate the file");
});

import { readFileSync } from "node:fs";
function readFileSyncCodeOnly(p) {
  return readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
}
