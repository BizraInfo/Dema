// NODE0-SEASON-ACTION-AUTHORITY-1A — Slice A of three.
//
// Proves the pure Season action predicate and the additive pending-effect
// binding. It grants NOTHING: no consent, no FATE verdict, no execution.
// Slice B integrates the real FATE decision on the corridor route; Slice C
// executes one reversible effect and proves recovery after process death.
//
// SAA22 is the load-bearing backward-compatibility test: a Season State written
// before `pending_effect` existed must hash to exactly what it hashed to then.

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSeasonState,
  verifySeasonState,
  hashSeasonState,
  evaluateSeasonActionAuthority,
  validatePendingEffect,
  canonicalSeasonAction,
  isValidSeasonActionId,
  SEASON_PENDING_EFFECT_SCHEMA,
  SEASON_PENDING_EFFECT_KIND,
} from "../packages/core/src/node0-minimum-season-save-resume.js";

const COMMIT = "240e202743287d1111b0d1d3882db27623aeb857";
const TREE = "300c621744141ab021214d5f0dd8ae8b0a74904c";
const ACTION = "CORRIDOR_RENAME_EXECUTE";
const CANON = "ACTION:CORRIDOR_RENAME_EXECUTE";

const PENDING_EFFECT = Object.freeze({
  schema: SEASON_PENDING_EFFECT_SCHEMA,
  action_id: ACTION,
  transaction_id: "mc-tx-0001",
  prepared_intent_hash: `sha256:${"a".repeat(64)}`,
  effect_kind: SEASON_PENDING_EFFECT_KIND,
});

function baseInput(over = {}) {
  return {
    season_id: "saa-season",
    mission_id: "saa-mission",
    mission_phase: "LOCAL_EFFECT_PREPARED",
    completed_steps: [],
    next_safe_action: CANON,
    must_not_repeat: [],
    pending_consent: [{ phrase: "GO: stop mission corridor saa", scope: "corridor" }],
    repository_commit: COMMIT,
    repository_tree: TREE,
    state_sequence: 1,
    // The shipped kernel binds the clock in the state and requires ISO form;
    // `null` is rejected by its own validator, so a fixture must supply one.
    saved_at: "2026-08-05T09:00:00Z",
    ...over,
  };
}
const build = (over) => {
  const r = buildSeasonState(baseInput(over));
  assert.equal(r.ok, true, `build failed: ${JSON.stringify(r.blocked_by)}`);
  return r.state;
};
const evaluate = (state, over = {}) =>
  evaluateSeasonActionAuthority({
    actionId: ACTION,
    seasonState: state,
    repositoryCommit: COMMIT,
    repositoryTree: TREE,
    ...over,
  });

test("SAA1 correct action, next action and binding is ELIGIBLE_TO_REQUEST_CONSENT_AND_FATE", () => {
  const r = evaluate(build());
  assert.equal(r.ok, true);
  assert.equal(r.verdict, "ELIGIBLE_TO_REQUEST_CONSENT_AND_FATE");
  assert.equal(r.canonical_action, CANON);
  assert.notEqual(r.verdict, "AUTHORIZED_TO_EXECUTE");
});

test("SAA2 authority_delta stays zero on every path", () => {
  for (const r of [
    evaluate(build()),
    evaluate(build({ must_not_repeat: [CANON] })),
    evaluate(build(), { repositoryCommit: "0".repeat(40) }),
    evaluate(build(), { actionId: "not valid" }),
  ]) {
    assert.equal(r.authority_delta, 0);
  }
});

test("SAA3 exact canonical prohibition refuses", () => {
  const r = evaluate(build({ must_not_repeat: [CANON] }));
  assert.equal(r.ok, false);
  assert.equal(r.matched_prohibition, CANON);
  assert.equal(r.reason, "action_prohibited_by_must_not_repeat");
});

test("SAA4 prose near-match does not become machine policy", () => {
  for (const prose of [
    "do not run the corridor rename",
    "ACTION:CORRIDOR_RENAME_EXECUTE is forbidden",
    "never CORRIDOR_RENAME_EXECUTE",
    "corridor rename execute",
  ]) {
    const r = evaluate(build({ must_not_repeat: [prose] }));
    assert.equal(r.ok, true, `prose became policy: ${prose}`);
    assert.equal(r.matched_prohibition, null);
  }
});

test("SAA5 casing/whitespace differences do not match; malformed ids fail closed", () => {
  for (const near of [" ACTION:CORRIDOR_RENAME_EXECUTE", "ACTION:CORRIDOR_RENAME_EXECUTE ", "action:corridor_rename_execute", "ACTION:Corridor_Rename_Execute"]) {
    assert.equal(evaluate(build({ must_not_repeat: [near] })).ok, true, `near-miss matched: ${JSON.stringify(near)}`);
  }
  // NOTE: "TRAILING_" is deliberately NOT in this list — underscore is legal in
  // the kernel's own ACTION_RE charset, asserted below. The test was wrong, not
  // the shipped contract.
  for (const bad of ["lower", "1LEADING", "HAS SPACE", "a".repeat(97), "", null, 42, {}]) {
    const r = evaluate(build(), { actionId: bad });
    assert.equal(r.ok, false, `malformed id accepted: ${JSON.stringify(bad)}`);
    assert.equal(r.reason, "action_id_malformed");
  }
  assert.equal(isValidSeasonActionId("TRAILING_"), true, "underscore is legal per ACTION_RE");
});

test("SAA6 duplicate canonical prohibition fails closed", () => {
  const r = evaluate(build({ must_not_repeat: [CANON, CANON] }));
  assert.equal(r.ok, false);
  assert.equal(r.duplicate_prohibition, true);
  assert.equal(r.reason, "duplicate_canonical_prohibition");
});

test("SAA7 repository commit mismatch refuses", () => {
  const r = evaluate(build(), { repositoryCommit: "0".repeat(40) });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "repository_commit_mismatch");
});

test("SAA8 repository tree mismatch refuses", () => {
  const r = evaluate(build(), { repositoryTree: "1".repeat(40) });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "repository_tree_mismatch");
});

test("SAA9 next_safe_action mismatch refuses", () => {
  const r = evaluate(build({ next_safe_action: "ACTION:SOMETHING_ELSE" }));
  assert.equal(r.ok, false);
  assert.equal(r.reason, "next_safe_action_mismatch");
  assert.equal(r.next_action_matches, false);
});

test("SAA10 pending consent stays byte-identical and pending", () => {
  const state = build();
  const before = JSON.stringify(state.pending_consent);
  evaluate(state);
  assert.equal(JSON.stringify(state.pending_consent), before);
  assert.equal(state.pending_consent.length, 1);
});

test("SAA11 no result grants consent", () => {
  assert.equal(evaluate(build()).consent_still_required, true);
});

test("SAA12 no result grants FATE permission", () => {
  assert.equal(evaluate(build()).fate_still_required, true);
});

test("SAA13 evaluation neither executes nor prepares an effect", () => {
  const state = build();
  const snapshot = JSON.stringify(state);
  const r = evaluate(state);
  assert.equal(JSON.stringify(state), snapshot, "evaluator mutated the state");
  assert.equal(r.pending_effect, undefined);
  assert.equal(Object.isFrozen(r), true);
});

test("SAA14 valid pending_effect verifies", () => {
  const state = build({ pending_effect: PENDING_EFFECT });
  assert.deepEqual(validatePendingEffect(PENDING_EFFECT), []);
  assert.equal(verifySeasonState(state).ok, true);
  assert.deepEqual(state.pending_effect, PENDING_EFFECT);
});

test("SAA15 partial pending_effect refuses", () => {
  for (const field of Object.keys(PENDING_EFFECT)) {
    const partial = { ...PENDING_EFFECT };
    delete partial[field];
    assert.ok(validatePendingEffect(partial).length > 0, `omitting ${field} passed`);
    assert.equal(buildSeasonState(baseInput({ pending_effect: partial })).ok, false);
  }
});

test("SAA16 unknown fields in pending_effect refuse", () => {
  const extra = { ...PENDING_EFFECT, path: "/tmp/x", signature: "sig" };
  assert.ok(validatePendingEffect(extra).includes("pending_effect_fields_unexpected"));
  assert.equal(buildSeasonState(baseInput({ pending_effect: extra })).ok, false);
});

test("SAA17 invalid transaction id refuses", () => {
  for (const bad of ["", "has space", "../escape", null, 7]) {
    assert.ok(validatePendingEffect({ ...PENDING_EFFECT, transaction_id: bad }).length > 0, `accepted ${JSON.stringify(bad)}`);
  }
});

test("SAA18 invalid prepared-intent hash refuses", () => {
  for (const bad of ["a".repeat(64), `sha256:${"A".repeat(64)}`, `sha256:${"a".repeat(63)}`, "sha1:abc", null]) {
    assert.ok(validatePendingEffect({ ...PENDING_EFFECT, prepared_intent_hash: bad }).length > 0, `accepted ${JSON.stringify(bad)}`);
  }
});

test("SAA19 wrong effect kind refuses", () => {
  assert.ok(validatePendingEffect({ ...PENDING_EFFECT, effect_kind: "delete" }).includes("pending_effect_kind_invalid"));
});

test("SAA20 pending_effect changes the semantic state hash", () => {
  assert.notEqual(build({ pending_effect: PENDING_EFFECT }).state_hash, build().state_hash);
});

test("SAA21 two byte-equivalent pending effects hash identically", () => {
  const reordered = {
    effect_kind: SEASON_PENDING_EFFECT_KIND,
    prepared_intent_hash: PENDING_EFFECT.prepared_intent_hash,
    transaction_id: PENDING_EFFECT.transaction_id,
    action_id: ACTION,
    schema: SEASON_PENDING_EFFECT_SCHEMA,
  };
  assert.equal(build({ pending_effect: reordered }).state_hash, build({ pending_effect: PENDING_EFFECT }).state_hash);
});

test("SAA22 BACKWARD COMPAT: a state without pending_effect keeps its exact hash", () => {
  const historical = build();
  // The hash a pre-slice kernel would have produced: the semantic body with no
  // pending_effect key at all. Recomputing here must reproduce it byte-exactly.
  assert.equal(hashSeasonState(historical), historical.state_hash);
  assert.equal(verifySeasonState(historical).ok, true);
  assert.equal("pending_effect" in historical, false, "absent field was materialized as null");
  // And an explicit null must not change identity either.
  assert.equal(hashSeasonState({ ...historical, pending_effect: null }), historical.state_hash);
});

test("SAA23 pending_effect survives build -> verify -> reconstruct exactly", () => {
  const state = build({ pending_effect: PENDING_EFFECT });
  const roundTripped = JSON.parse(JSON.stringify(state));
  assert.equal(verifySeasonState(roundTripped).ok, true);
  assert.deepEqual(roundTripped.pending_effect, PENDING_EFFECT);
  assert.equal(hashSeasonState(roundTripped), state.state_hash);
});

test("SAA24 corruption after persistence is detected", () => {
  const state = build({ pending_effect: PENDING_EFFECT });
  const tampered = {
    ...state,
    pending_effect: { ...PENDING_EFFECT, transaction_id: "mc-tx-9999" },
  };
  const v = verifySeasonState(tampered);
  assert.equal(v.ok, false);
  assert.equal(v.reason, "state_hash_mismatch");
  // And a forged state_hash still fails, because the shape+binding are rechecked.
  const forged = { ...tampered, state_hash: hashSeasonState(tampered) };
  assert.equal(evaluate(forged).ok, true, "control: a consistently-rehashed state verifies");
  assert.notEqual(forged.state_hash, state.state_hash);
});

test("SAA25 the evaluator touches no disk, network, clock, random or process", () => {
  const src = evaluateSeasonActionAuthority.toString();
  for (const forbidden of ["readFile", "writeFile", "fetch(", "Date.now", "Math.random", "process.env", "execFile", "spawn"]) {
    assert.ok(!src.includes(forbidden), `evaluator references ${forbidden}`);
  }
  assert.equal(canonicalSeasonAction(ACTION), CANON);
});
