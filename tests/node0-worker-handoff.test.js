// NODE0-WORKER-HANDOFF-1A — the contract for `worker_is_replaceable`.
//
// The invariant asks: "If a worker exits, can another resume from the checkpoint?"
// That is a question about a TRANSITION BETWEEN TWO PROCESSES, which is why no
// point-in-time health probe can answer it and why the review gate cannot settle
// it from source. Four facts, all of them already producible by instruments in
// this tree, are jointly necessary:
//
//   1. the predecessor checkpointed   (season head at sequence N)
//   2. the predecessor actually DIED  (process identity, boot-id bound)
//   3. the successor FENCED it out    (DEAD_OWNER_TAKEOVER, token supersedes)
//   4. the successor resumed THAT checkpoint, not a fresh season (chain link)
//
// Drop any one and the remaining three describe something that is not a handoff.
// These tests exist to name each of those four near-misses out loud, because each
// one is a plausible thing to mistake for success.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildWorkerHandoffObservation,
  verifyWorkerHandoffHash,
  isCleanEligibleHandoff,
  WORKER_HANDOFF_VERDICTS,
  WORKER_HANDOFF_EVIDENCE_CLASSES,
  CLEAN_ELIGIBLE_HANDOFF_VERDICTS,
  NODE0_WORKER_HANDOFF_SCHEMA,
  NODE0_WORKER_HANDOFF_SCOPE,
} from "../packages/core/src/node0-worker-handoff.js";

/// A deterministic stand-in for a real digest. The kernel must never import one:
/// an injected hash is what makes the classification replayable byte-for-byte.
const hash = (facts) => `test:${JSON.stringify(facts).length}:${JSON.stringify(facts).slice(0, 24)}`;

/// Every fact present and correct. Each test below removes or corrupts exactly one.
function provenFacts(over = {}) {
  return {
    evidenceClass: "OBSERVED",
    predecessor: {
      worker_id: "worker-A",
      pid: 4101,
      boot_identity_hash: "boot:aaa",
      exited: true,
      checkpoint_sequence: 7,
      checkpoint_head_hash: "head:seq7",
      season_id: "season-1",
    },
    successor: {
      worker_id: "worker-B",
      pid: 4102,
      boot_identity_hash: "boot:aaa",
      claim_kind: "DEAD_OWNER_TAKEOVER",
      predecessor_fence_status: "STALE_OWNER_FENCED",
      fencing_token: 2,
      predecessor_fencing_token: 1,
      resumed_sequence: 8,
      resumed_from_head_hash: "head:seq7",
      season_id: "season-1",
    },
    observedAt: "2026-08-09T00:00:00.000Z",
    hash,
    ...over,
  };
}

const verdictOf = (over) => buildWorkerHandoffObservation(provenFacts(over)).verdict;

test("WHO-01 the verdict and evidence vocabularies are closed and frozen", () => {
  assert.ok(Object.isFrozen(WORKER_HANDOFF_VERDICTS));
  assert.ok(Object.isFrozen(WORKER_HANDOFF_EVIDENCE_CLASSES));
  assert.ok(Object.isFrozen(CLEAN_ELIGIBLE_HANDOFF_VERDICTS));
  // Exactly one verdict may support closure. A second one is how "nearly" becomes
  // "proven" without anyone deciding to allow it.
  assert.deepEqual(CLEAN_ELIGIBLE_HANDOFF_VERDICTS, ["HANDOFF_PROVEN"]);
  for (const v of CLEAN_ELIGIBLE_HANDOFF_VERDICTS) {
    assert.ok(WORKER_HANDOFF_VERDICTS.includes(v));
  }
  // The scope is the term the closure registry requires. It is exported so an
  // adapter can IMPORT it instead of retyping it — NCG-09 exists because the
  // first adapter retyped its own.
  assert.equal(NODE0_WORKER_HANDOFF_SCOPE, "node0_runtime_worker_handoff");
});

test("WHO-02 nothing observed is NOT_ATTEMPTED, never a negative result", () => {
  // "No handoff was tried" and "a handoff was tried and failed" are different
  // facts. Collapsing them would let an unrun proof read as a refuted one.
  const o = buildWorkerHandoffObservation({ hash });
  assert.equal(o.verdict, "NOT_ATTEMPTED");
  assert.equal(isCleanEligibleHandoff(o), false);
});

test("WHO-03 a predecessor that never died is not a handoff, whatever else is true", () => {
  // THE CENTRAL REFUSAL. Two live workers sharing a checkpoint is concurrency.
  // It can look identical in the artefact — same takeover, same resume, same
  // chain — and it proves nothing about replaceability.
  assert.equal(
    verdictOf({ predecessor: { ...provenFacts().predecessor, exited: false } }),
    "PREDECESSOR_STILL_LIVE",
  );
});

test("WHO-04 a dead worker with no checkpoint leaves nothing to resume", () => {
  assert.equal(
    verdictOf({ predecessor: { ...provenFacts().predecessor, checkpoint_sequence: null, checkpoint_head_hash: null } }),
    "NO_CHECKPOINT",
  );
});

test("WHO-05 the successor must have fenced the predecessor, not merely outlived it", () => {
  // A successor that acquired without fencing cannot prove the predecessor is
  // barred from writing again — so the state it resumed is not exclusively its own.
  assert.equal(
    verdictOf({ successor: { ...provenFacts().successor, predecessor_fence_status: "OWNERSHIP_STATUS_UNVERIFIABLE" } }),
    "FENCE_NOT_TRANSFERRED",
  );
  // A fencing token that does not supersede is the same failure wearing a number.
  assert.equal(
    verdictOf({ successor: { ...provenFacts().successor, fencing_token: 1, predecessor_fencing_token: 1 } }),
    "FENCE_NOT_TRANSFERRED",
  );
});

test("WHO-06 starting a fresh season is not resuming a checkpoint", () => {
  // The most flattering near-miss: the successor comes up healthy and works.
  // It began again. Nothing was carried across the exit.
  assert.equal(
    verdictOf({ successor: { ...provenFacts().successor, season_id: "season-2" } }),
    "RESUMED_FROM_FRESH_STATE",
  );
  assert.equal(
    verdictOf({ successor: { ...provenFacts().successor, resumed_sequence: 1, resumed_from_head_hash: null } }),
    "RESUMED_FROM_FRESH_STATE",
  );
});

test("WHO-07 the resumed state must chain to the predecessor's actual head", () => {
  // Right season, right sequence, wrong parent: the successor resumed SOMETHING,
  // but not what the predecessor last committed.
  assert.equal(
    verdictOf({ successor: { ...provenFacts().successor, resumed_from_head_hash: "head:other" } }),
    "CHAIN_BROKEN",
  );
  // A successor that rewinds behind the checkpoint has also broken the chain.
  assert.equal(
    verdictOf({ successor: { ...provenFacts().successor, resumed_sequence: 7 } }),
    "CHAIN_BROKEN",
  );
});

test("WHO-08 all four facts together, and only then, prove the handoff", () => {
  const o = buildWorkerHandoffObservation(provenFacts());
  assert.equal(o.verdict, "HANDOFF_PROVEN");
  assert.equal(isCleanEligibleHandoff(o), true);
  assert.deepEqual(o.blocked_by, []);
  assert.equal(o.scope, NODE0_WORKER_HANDOFF_SCOPE);
  assert.equal(o.schema, NODE0_WORKER_HANDOFF_SCHEMA);
});

test("WHO-09 an injected or asserted observation can never support closure", () => {
  // Composition must be testable without becoming evidence. A fixture that could
  // promote itself is the whole attack.
  for (const cls of ["TEST_INJECTION", "OPERATOR_ASSERTED", "NONE"]) {
    const o = buildWorkerHandoffObservation(provenFacts({ evidenceClass: cls }));
    assert.equal(isCleanEligibleHandoff(o), false, `${cls} must not be clean-eligible`);
    assert.notEqual(o.verdict, "HANDOFF_PROVEN", `${cls} must not reach HANDOFF_PROVEN`);
  }
});

test("WHO-10 the hash covers the facts and excludes the clock", () => {
  const a = buildWorkerHandoffObservation(provenFacts({ observedAt: "2026-08-09T00:00:00.000Z" }));
  const b = buildWorkerHandoffObservation(provenFacts({ observedAt: "2031-01-01T00:00:00.000Z" }));
  // Two identical observations taken years apart must bind to the same witness.
  assert.equal(a.observation_hash, b.observation_hash);
  assert.equal(verifyWorkerHandoffHash(a, hash), true);
  // Re-derivation, not trust: a carried hash that does not recompute is refused.
  assert.equal(verifyWorkerHandoffHash({ ...a, observation_hash: "forged" }, hash), false);
  // And a fact edited after the fact must break it.
  assert.equal(verifyWorkerHandoffHash({ ...a, verdict: "NOT_ATTEMPTED" }, hash), false);
});

test("WHO-11 the kernel grants nothing on any path", () => {
  for (const over of [
    {},
    { predecessor: { ...provenFacts().predecessor, exited: false } },
    { evidenceClass: "TEST_INJECTION" },
  ]) {
    const o = buildWorkerHandoffObservation(provenFacts(over));
    assert.equal(o.authority_delta, 0);
    assert.equal(o.activation_performed, false);
  }
  assert.equal(buildWorkerHandoffObservation({ hash }).authority_delta, 0);
});

test("WHO-12 an absent injected hash is refused rather than defaulted", () => {
  // A kernel that silently supplied its own digest would make every observation
  // unverifiable by anyone who did not already trust it.
  assert.throws(() => buildWorkerHandoffObservation({ evidenceClass: "OBSERVED" }), TypeError);
  assert.throws(() => verifyWorkerHandoffHash({}, undefined), TypeError);
});
