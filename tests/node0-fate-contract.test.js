// NODE0-FATE-CONTRACT-1A — the independent constitutional policy decision.
//
// The load-bearing test is P1: FATE must be able to REFUSE an effect a human
// has already consented to. If every human-approved effect passes, this layer
// is decoration and the previous slice's mistake has simply been renamed.
//
// P2 is its mirror: FATE must not be reachable as a consent check. It never
// sees a phrase, and it never imports packages/fate/src/fate.js.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  evaluateFatePolicy,
  assessReversibility,
  assessBlastRadius,
  NODE0_FATE_CONTRACT_SCHEMA,
  FATE_PERMIT_MEANS,
  FATE_REFUSAL_REASONS,
  PERMITTED_EFFECT_KINDS,
  FATE_POLICY_VERSION,
} from "../packages/core/src/node0-fate-contract.js";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const KERNEL = `${REPO}packages/core/src/node0-fate-contract.js`;

const eligible = (over = {}) => ({
  ok: true,
  verdict: "ELIGIBLE_TO_REQUEST_CONSENT_AND_FATE",
  action_id: "CORRIDOR_RENAME_EXECUTE",
  canonical_action: "ACTION:CORRIDOR_RENAME_EXECUTE",
  repository_binding_valid: true,
  consent_still_required: true,
  fate_still_required: true,
  authority_delta: 0,
  ...over,
});

const goodEffect = (over = {}) => ({
  kind: "bounded_local_rename",
  root: "missions/m1",
  from: "a.txt",
  to: "b.txt",
  undoable: true,
  inverse_kind: "bounded_local_rename",
  before_hash: `sha256:${"a".repeat(64)}`,
  before_manifest: [{ path: "a.txt", size: 12 }],
  authority_delta: 0,
  ...over,
});

function assertGrantsNothing(d) {
  assert.equal(d.authority_delta, 0);
  assert.equal(d.grants_consent, false);
  assert.equal(d.grants_execution, false);
  assert.equal(d.consent_still_required, true);
  assert.equal(d.nonce_still_required, true);
  assert.equal(d.effect_executed, false);
  assert.ok(Object.isFrozen(d));
}

// ── P1 · THE INDEPENDENCE PROPERTY ─────────────────────────────────────────

test("P1 FATE refuses an effect a human has already consented to", () => {
  // The human has typed the exact phrase; consent is not in question. FATE
  // still refuses, because the effect cannot be proven undoable.
  const humanConsented = { phrase_matched: true, consent_context_hash: "sha256:deadbeef" };
  assert.equal(humanConsented.phrase_matched, true, "control: consent is granted in this scenario");

  const d = evaluateFatePolicy({
    seasonAuthority: eligible(),
    effect: goodEffect({ undoable: false, inverse_kind: undefined }),
  });
  assert.equal(d.verdict, "REFUSE");
  assert.equal(d.reason, "effect_not_reversible");
  assertGrantsNothing(d);

  // Control: the SAME consented scenario with a reversible effect PERMITs, so
  // the refusal above is a property of the effect, not a blanket denial.
  const ok = evaluateFatePolicy({ seasonAuthority: eligible(), effect: goodEffect() });
  assert.equal(ok.verdict, "PERMIT");
});

test("P2 FATE is not a consent check: no phrase input, no fate.js import", () => {
  const src = readFileSync(KERNEL, "utf8");
  assert.ok(src.length > 1000, "control: kernel source unexpectedly small");
  // It must not import or call the exact-phrase consent helper.
  assert.equal(/^\s*import[\s\S]{0,200}?from\s+["'][^"']*fate\.js["']/m.test(src), false,
    "the policy kernel imports the exact-phrase consent helper");
  assert.equal(/\bevaluateConsent\s*\(/.test(src), false, "the policy kernel calls the consent helper");

  // Supplying a phrase changes nothing — it is not part of the contract.
  const a = evaluateFatePolicy({ seasonAuthority: eligible(), effect: goodEffect() });
  const b = evaluateFatePolicy({
    seasonAuthority: eligible(),
    effect: goodEffect(),
    phrase: "GO: execute corridor rename",
    consent: { by: "operator", ref: "sha256:x" },
  });
  assert.deepEqual(a, b, "a phrase or consent ref altered the policy decision");
});

// ── P3–P6 · season authority is an input, re-verified ───────────────────────

test("P3 missing season authority refuses", () => {
  for (const bad of [undefined, null, {}, [], "ELIGIBLE"]) {
    const d = evaluateFatePolicy({ seasonAuthority: bad, effect: goodEffect() });
    assert.equal(d.verdict, "REFUSE");
    assertGrantsNothing(d);
  }
});

test("P4 an ineligible season verdict refuses", () => {
  const d = evaluateFatePolicy({ seasonAuthority: eligible({ ok: false, verdict: "REFUSED" }), effect: goodEffect() });
  assert.equal(d.reason, "season_authority_not_eligible");
});

test("P5 a forged eligible verdict without repository binding refuses", () => {
  const d = evaluateFatePolicy({
    seasonAuthority: eligible({ repository_binding_valid: false }),
    effect: goodEffect(),
  });
  assert.equal(d.reason, "repository_binding_unverified");
  assertGrantsNothing(d);
});

test("P6 policy version mismatch fails closed", () => {
  const d = evaluateFatePolicy({ seasonAuthority: eligible(), effect: goodEffect(), policyVersion: "v9.9" });
  assert.equal(d.reason, "policy_version_mismatch");
});

// ── P7–P11 · the effect's own shape ────────────────────────────────────────

test("P7 an unknown effect kind refuses — the policy never permits what it cannot judge", () => {
  for (const kind of ["delete_everything", "network_call", "", undefined, 42]) {
    const d = evaluateFatePolicy({ seasonAuthority: eligible(), effect: goodEffect({ kind }) });
    assert.equal(d.verdict, "REFUSE", `accepted unknown kind: ${String(kind)}`);
    assert.equal(d.reason, "effect_kind_unknown");
  }
  assert.deepEqual(PERMITTED_EFFECT_KINDS, ["bounded_local_rename"]);
});

test("P8 an effect carrying authority delta refuses outright", () => {
  for (const delta of [1, -1, 0.5]) {
    const d = evaluateFatePolicy({ seasonAuthority: eligible(), effect: goodEffect({ authority_delta: delta }) });
    assert.equal(d.reason, "authority_delta_nonzero");
    assert.equal(d.authority_delta, 0, "the decision itself must still carry 0");
  }
});

test("P9 an unbound before-state refuses: an unprovable undo is not reversibility", () => {
  for (const over of [
    { before_hash: undefined },
    { before_hash: "not-a-hash" },
    { before_hash: `sha256:${"z".repeat(64)}` },
    { before_manifest: undefined },
    { before_manifest: null },
  ]) {
    const d = evaluateFatePolicy({ seasonAuthority: eligible(), effect: goodEffect(over) });
    assert.equal(d.verdict, "REFUSE", `accepted unbound before-state: ${JSON.stringify(over)}`);
    assert.equal(d.before_state_bound, false);
  }
});

test("P10 an unbounded or escaping blast radius refuses", () => {
  const cases = [
    [{ root: undefined }, "effect_scope_unbounded"],
    [{ from: "/etc/passwd" }, "effect_scope_escapes_root"],
    [{ to: "../../outside" }, "effect_scope_escapes_root"],
    [{ from: "a//b" }, "effect_scope_escapes_root"],
    [{ to: undefined }, "effect_scope_unbounded"],
  ];
  for (const [over, expected] of cases) {
    const d = evaluateFatePolicy({ seasonAuthority: eligible(), effect: goodEffect(over) });
    assert.equal(d.verdict, "REFUSE", `accepted: ${JSON.stringify(over)}`);
    assert.ok(d.blocked_by.includes(expected), `${JSON.stringify(over)} -> ${d.blocked_by.join(",")}`);
  }
});

test("P11 a fully bounded reversible effect PERMITs, and says exactly what that means", () => {
  const d = evaluateFatePolicy({ seasonAuthority: eligible(), effect: goodEffect() });
  assert.equal(d.verdict, "PERMIT");
  assert.equal(d.ok, true);
  assert.equal(d.means, FATE_PERMIT_MEANS);
  assert.equal(d.means, "EFFECT_CONSTITUTIONALLY_PERMISSIBLE");
  assert.equal(d.reversible, true);
  assert.equal(d.before_state_bound, true);
  assert.equal(d.scope_bounded, true);
  assertGrantsNothing(d);
  assert.notEqual(d.means, "AUTHORIZED_TO_EXECUTE");
  assert.notEqual(d.means, "CONSENT_GRANTED");
});

// ── P12–P15 · contract hygiene ─────────────────────────────────────────────

test("P12 every enumerated refusal reason is reachable", () => {
  const seen = new Set();
  const probes = [
    { seasonAuthority: undefined, effect: goodEffect() },
    { seasonAuthority: eligible({ ok: false }), effect: goodEffect() },
    { seasonAuthority: eligible({ repository_binding_valid: false }), effect: goodEffect() },
    { seasonAuthority: eligible(), effect: undefined },
    { seasonAuthority: eligible(), effect: goodEffect({ kind: "nope" }) },
    { seasonAuthority: eligible(), effect: goodEffect({ authority_delta: 3 }) },
    { seasonAuthority: eligible(), effect: goodEffect({ undoable: false, inverse_kind: undefined }) },
    { seasonAuthority: eligible(), effect: goodEffect({ before_hash: undefined, undoable: true }) },
    { seasonAuthority: eligible(), effect: goodEffect({ root: undefined }) },
    { seasonAuthority: eligible(), effect: goodEffect({ from: "../x" }) },
    { seasonAuthority: eligible(), effect: goodEffect(), policyVersion: "v0.0" },
  ];
  for (const p of probes) {
    const d = evaluateFatePolicy(p);
    if (d.reason) seen.add(d.reason);
  }
  const unreachable = FATE_REFUSAL_REASONS.filter((r) => !seen.has(r));
  assert.deepEqual(unreachable, [], `unreachable refusal reasons: ${unreachable.join(", ")}`);
});

test("P13 the kernel is pure: it imports no effect capability", () => {
  const src = readFileSync(KERNEL, "utf8");
  for (const cap of ["node:fs", "node:fs/promises", "node:child_process", "node:net", "node:http", "node:https", "node:crypto"]) {
    assert.equal(src.includes(`from "${cap}"`), false, `kernel imports ${cap}`);
  }
  assert.equal(/Date\.now\(|Math\.random\(/.test(src), false, "kernel reads a clock or randomness");
});

test("P14 the helpers are independently correct", () => {
  assert.equal(assessReversibility(goodEffect()).reversible, true);
  assert.equal(assessReversibility({}).reversible, false);
  assert.equal(assessBlastRadius(goodEffect()).scope_bounded, true);
  assert.equal(assessBlastRadius({ root: "r", from: "../a", to: "b" }).scope_bounded, false);
});

test("P15 no decision ever reads as consent or execution authority", () => {
  const all = [
    evaluateFatePolicy({}),
    evaluateFatePolicy({ seasonAuthority: eligible(), effect: goodEffect() }),
    evaluateFatePolicy({ seasonAuthority: eligible(), effect: goodEffect({ root: undefined }) }),
  ];
  for (const d of all) {
    assertGrantsNothing(d);
    assert.equal(d.schema, NODE0_FATE_CONTRACT_SCHEMA);
    assert.equal(d.policy_version, FATE_POLICY_VERSION);
    assert.ok(["PERMIT", "REFUSE"].includes(d.verdict));
  }
});
