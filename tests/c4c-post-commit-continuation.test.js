// C4C-01…12 — POST-COMMIT COMPLETION AND DIVERGENCE HANDOFF (Gate C, C4 step C).
//
// Once the ledger commits, a signed receipt asserts what happened. The original
// closure consent still authorizes ONE thing from there: deterministically
// finishing the proof trail of the act it already approved. It authorizes
// nothing whose purpose is to change the world so the world agrees with the
// record.
//
//   original consent
//     ├── may finish recording the already-authorized result
//     └── may NOT manufacture a world that matches the record
//
// THE SLICE IS NOT "ADD RESUME". Resume already existed — evidenceTailPhases
// covers LEDGER_COMMITTED / ANCHORED / RESOLVED and the ledger and anchor
// appenders are already idempotent. What did not exist is the THREE-WAY
// distinction, and specifically its third branch:
//
//   exact artifact already exists          → adopt and continue
//   exact pre-authorized artifact is
//     safely appendable                    → append once and continue
//   world, head, context or evidence
//     diverged                             → mutate NOTHING; a separately
//                                            bounded remediation is required
//
// DIVERGENCE IS NOT RECOVERY. A verified failed restoration proved the world was
// returned and earned the right to ask for STOP consent. A post-commit
// divergence proved only that the record and the world disagree — deciding which
// one moves is a REMEDY CHOICE, and that is exactly what fresh consent is for.
// So divergence never reports RECOVERY_REQUIRED and never offers
// STOP_CONSENT_REQUIRED (C4C-09, C4C-10).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  classifyPostCommitContinuation,
  mapPostCommitClassToCorridor,
  mapRecoveryClassToCorridor,
  POST_COMMIT_CONTINUATION_CLASSES,
  CORRIDOR_RECOVERY_VERDICTS,
} from "../packages/mission/src/mission-corridor-closure.js";
import {
  observePostCommitContinuation,
  buildRenameEffectIntent,
  CORRIDOR_RENAME_RECOVERY_POLICY_HASH,
} from "../packages/mission/src/corridor-closure-gatherer.js";
import { claimConsentNonce } from "../packages/receipts/src/consent-nonce-claim.js";
import {
  openClosureTransaction, appendClosureEvent, replayClosureTransaction,
} from "../packages/receipts/src/mission-closure-transaction.js";

const AT = "2026-08-02T12:00:00.000Z";

/** A post-commit transaction state, exactly the shape replay returns. */
function txState(phase, { terminal = false, terminalOutcome = null } = {}) {
  const upto = ["PREPARED", "EFFECT_INTENT_PERSISTED", "EFFECT_APPLIED",
    "VERIFIED", "SEALED", "LEDGER_COMMITTED", "ANCHORED", "RESOLVED"];
  const events = upto.slice(0, upto.indexOf(phase) + 1).map((p) => ({ phase: p, evidence_refs: [] }));
  return { ok: true, exists: true, phase, terminal, terminal_outcome: terminalOutcome, events };
}

const intact = {
  ledgerEntryExact: true, ledgerConflict: false, ledgerContextIntact: true,
  anchorExact: true, anchorContextIntact: true, worldMatchesReceipt: true,
};

// ── COMPLETION-ONLY CONTINUATION ────────────────────────────────────────────

test("C4C-01: LEDGER_COMMITTED with the exact entry and no anchor appends the anchor once", () => {
  const v = classifyPostCommitContinuation({
    state: txState("LEDGER_COMMITTED"), ...intact, anchorExact: false,
  });
  assert.equal(v.classification, "FORWARD_COMPLETION_ELIGIBLE");
  assert.equal(v.may_append, true);
  assert.equal(v.next_phase, "ANCHORED");
  assert.equal(v.reason, "anchor_appendable_once");
});

test("C4C-02: ANCHORED with a missing terminal appends the exact RESOLVED once", () => {
  const v = classifyPostCommitContinuation({ state: txState("ANCHORED"), ...intact });
  assert.equal(v.classification, "FORWARD_COMPLETION_ELIGIBLE");
  assert.equal(v.may_append, true);
  assert.equal(v.next_phase, "RESOLVED");
  assert.equal(v.reason, "terminal_appendable_once");
});

test("C4C-03: an uncertain ledger append whose exact entry exists is adopted, not duplicated", () => {
  const v = classifyPostCommitContinuation({
    state: txState("LEDGER_COMMITTED"), ...intact, anchorExact: true,
  });
  assert.equal(v.classification, "FORWARD_COMPLETION_ELIGIBLE");
  assert.equal(v.reason, "anchor_already_present_adopt", "adopt rather than write a second");
  assert.equal(v.may_append, true);
});

test("C4C-04: an uncertain anchor append whose exact anchor exists is adopted", () => {
  const v = classifyPostCommitContinuation({ state: txState("ANCHORED"), ...intact });
  assert.equal(v.classification, "FORWARD_COMPLETION_ELIGIBLE");
  // The appender is idempotent, so "already present" and "appendable once"
  // converge on the same single artifact.
  assert.equal(v.may_append, true);
});

// ── DIVERGENCE — MUTATE NOTHING ─────────────────────────────────────────────

test("C4C-05: a changed ledger head with the exact entry absent diverges and writes nothing", () => {
  for (const state of [txState("LEDGER_COMMITTED"), txState("ANCHORED")]) {
    const v = classifyPostCommitContinuation({ ...intact, state, ledgerEntryExact: false });
    assert.equal(v.classification, "POST_COMMIT_CONTEXT_DIVERGENCE");
    assert.equal(v.may_append, false);
  }
  const moved = classifyPostCommitContinuation({
    state: txState("LEDGER_COMMITTED"), ...intact, ledgerContextIntact: false,
  });
  assert.equal(moved.classification, "POST_COMMIT_CONTEXT_DIVERGENCE");
  assert.equal(moved.reason, "ledger_context_changed");
  assert.equal(moved.may_append, false);
});

test("C4C-06: a changed anchor head with the exact anchor absent diverges and writes nothing", () => {
  const absent = classifyPostCommitContinuation({
    state: txState("ANCHORED"), ...intact, anchorExact: false,
  });
  assert.equal(absent.classification, "POST_COMMIT_CONTEXT_DIVERGENCE");
  assert.equal(absent.reason, "committed_anchor_absent");
  assert.equal(absent.may_append, false);

  const moved = classifyPostCommitContinuation({
    state: txState("ANCHORED"), ...intact, anchorContextIntact: false,
  });
  assert.equal(moved.classification, "POST_COMMIT_CONTEXT_DIVERGENCE");
  assert.equal(moved.reason, "anchor_context_changed");
  assert.equal(moved.may_append, false);
});

test("C4C-07: a receipt/world mismatch never compensates", () => {
  for (const state of [txState("LEDGER_COMMITTED"), txState("ANCHORED")]) {
    const v = classifyPostCommitContinuation({ ...intact, state, worldMatchesReceipt: false });
    assert.equal(v.classification, "POST_COMMIT_WORLD_DIVERGENCE");
    assert.equal(v.reason, "observed_world_differs_from_receipt");
    assert.equal(v.may_append, false, "making the world match the record is compensation");
  }
  // A world that cannot be observed is UNKNOWN, never optimistically true.
  const blind = classifyPostCommitContinuation({
    ...intact, state: txState("LEDGER_COMMITTED"), worldMatchesReceipt: undefined,
  });
  assert.equal(blind.classification, "FORWARD_RECONCILIATION_UNQUALIFIED");
  assert.equal(blind.may_append, false);
});

test("C4C-07b: conflicting ledger material is its own class and outranks everything", () => {
  const v = classifyPostCommitContinuation({
    state: txState("LEDGER_COMMITTED"), ...intact, ledgerConflict: true,
  });
  assert.equal(v.classification, "POST_COMMIT_LEDGER_DIVERGENCE");
  assert.equal(v.may_append, false);
  // Checked before world and context, because two records claiming one
  // transaction cannot be resolved by looking harder at either.
  const withEverythingBroken = classifyPostCommitContinuation({
    state: txState("ANCHORED"), ...intact,
    ledgerConflict: true, worldMatchesReceipt: false, ledgerContextIntact: false,
  });
  assert.equal(withEverythingBroken.classification, "POST_COMMIT_LEDGER_DIVERGENCE");
});

test("C4C-08: a retry supplying modified evidence cannot beat the frozen transaction", () => {
  // Pre-ledger and unknown phases are not this function's region at all: it
  // refuses rather than accepting a caller's framing of where the work is.
  for (const phase of ["PREPARED", "EFFECT_APPLIED", "VERIFIED", "SEALED"]) {
    const v = classifyPostCommitContinuation({ ...intact, state: txState(phase) });
    assert.equal(v.classification, "FORWARD_RECONCILIATION_UNQUALIFIED");
    assert.match(v.reason, /^not_post_commit:/);
    assert.equal(v.may_append, false);
  }
  for (const state of [null, undefined, {}, { ok: false }, { ok: true, exists: false }]) {
    const v = classifyPostCommitContinuation({ ...intact, state });
    assert.equal(v.classification, "FORWARD_RECONCILIATION_UNQUALIFIED");
    assert.equal(v.may_append, false);
  }
});

test("C4C-09: divergence never returns RECOVERY_REQUIRED", () => {
  for (const c of ["POST_COMMIT_CONTEXT_DIVERGENCE", "POST_COMMIT_WORLD_DIVERGENCE",
    "POST_COMMIT_LEDGER_DIVERGENCE", "FORWARD_RECONCILIATION_UNQUALIFIED"]) {
    const v = mapPostCommitClassToCorridor(c);
    assert.notEqual(v.post_commit_class, "RECOVERY_REQUIRED");
    assert.notEqual(v.post_commit_class, "RECOVERY_REQUIRED_UNQUALIFIED");
    assert.equal(v.terminal_outcome, null);
    assert.equal(v.compensation_performed, false);
  }
  // The two vocabularies are disjoint — a post-commit class can never be read
  // as a recovery class.
  for (const c of POST_COMMIT_CONTINUATION_CLASSES) {
    assert.notEqual(mapRecoveryClassToCorridor(c).verdict, "STOP_CONSENT_REQUIRED",
      `${c} must not be mistakable for a qualified recovery`);
  }
});

test("C4C-10: divergence never offers STOP_CONSENT_REQUIRED", () => {
  for (const c of ["POST_COMMIT_CONTEXT_DIVERGENCE", "POST_COMMIT_WORLD_DIVERGENCE",
    "POST_COMMIT_LEDGER_DIVERGENCE", "FORWARD_RECONCILIATION_UNQUALIFIED", "NOT_A_CLASS"]) {
    const v = mapPostCommitClassToCorridor(c);
    assert.equal(v.verdict, "RECONCILIATION_CONSENT_REQUIRED");
    assert.equal(v.stop_consent_offered, false);
    assert.equal(v.required_consent_kind, null);
    assert.equal(v.requires_human, true);
    assert.equal(v.fresh_attempt_permitted, false);
  }
  assert.ok(CORRIDOR_RECOVERY_VERDICTS.includes("RECONCILIATION_CONSENT_REQUIRED"));
  // Eligible completion needs no human and offers no stop either.
  const ok = mapPostCommitClassToCorridor("FORWARD_COMPLETION_ELIGIBLE");
  assert.equal(ok.verdict, "CORRIDOR_UNCHANGED");
  assert.equal(ok.requires_human, false);
  assert.equal(ok.stop_consent_offered, false);
});

test("C4C-11: no original effect retry is reachable from the post-commit surface", () => {
  const src = readFileSync(
    join(process.cwd(), "packages/mission/src/corridor-closure-gatherer.js"), "utf8",
  );
  const start = src.indexOf("export async function observePostCommitContinuation");
  const end = src.indexOf("\n// ── C4B2B.1", start);
  assert.ok(start > 0 && end > start);
  const body = src.slice(start, end);
  for (const forbidden of ["effect.apply", "effect.undo", "restoreToBeforeState",
    "appendCanonicalReceipt", "appendClosureAnchor", "appendCorridorEvent",
    "appendClosureEvent", "recordConsentNonce"]) {
    assert.ok(!body.includes(forbidden), `the observer must not reach ${forbidden}`);
  }
  // It reads the world only through the seal replay, which is non-mutating.
  assert.ok(body.includes("replaySeal("), "world observation is a seal replay");
});

test("C4C-12: observation mutates no committed transaction history", async () => {
  const demaHome = await mkdtemp(join(tmpdir(), "c4c-"));
  const estate = join(demaHome, "estate");
  await mkdir(estate, { recursive: true });
  await writeFile(join(estate, "a.draft.json"), "{}\n");
  const prepared = buildRenameEffectIntent({ scopeRoot: estate, from: "a.draft.json", to: "a.sealed.json" });
  const cr = await claimConsentNonce({
    nonce: "c4c", actionClass: "C3_LOCAL_WRITE", actionKind: "COMPLETE", missionId: "m",
    contractHash: `sha256:${"c".repeat(64)}`, consentContextHash: `sha256:${"d".repeat(64)}`,
    transactionId: "c4c-tx", checkpointEventHash: `sha256:${"e".repeat(64)}`,
    preparedIntentHash: prepared.prepared_intent_hash,
    recoveryPolicyHash: CORRIDOR_RENAME_RECOVERY_POLICY_HASH, claimedAtIso: AT, demaHome,
  });
  await openClosureTransaction({ claim: cr.claim, demaHome, atIso: AT });
  const before = await replayClosureTransaction({ demaHome, transactionId: "c4c-tx" });

  const observed = await observePostCommitContinuation({ demaHome, claim: cr.claim, effect: null });
  // A transaction that never reached the ledger is not this surface's region.
  assert.equal(observed.classification, "FORWARD_RECONCILIATION_UNQUALIFIED");
  assert.equal(observed.may_append, false);

  const after = await replayClosureTransaction({ demaHome, transactionId: "c4c-tx" });
  assert.equal(after.sequence, before.sequence, "no event may be appended by observing");
  assert.equal(after.head_event_hash, before.head_event_hash, "the head may not move");
  // A remediation would be a NEW transaction; the committed one is untouched.
  assert.deepEqual(after.events.map((e) => e.event_hash), before.events.map((e) => e.event_hash));
});

test("C4C-13: the observer reports the observations its verdict rests on", async () => {
  const demaHome = await mkdtemp(join(tmpdir(), "c4c-obs-"));
  const estate = join(demaHome, "estate");
  await mkdir(estate, { recursive: true });
  await writeFile(join(estate, "a.draft.json"), "{}\n");
  const prepared = buildRenameEffectIntent({ scopeRoot: estate, from: "a.draft.json", to: "a.sealed.json" });
  const cr = await claimConsentNonce({
    nonce: "c4c2", actionClass: "C3_LOCAL_WRITE", actionKind: "COMPLETE", missionId: "m",
    contractHash: `sha256:${"c".repeat(64)}`, consentContextHash: `sha256:${"d".repeat(64)}`,
    transactionId: "c4c-tx2", checkpointEventHash: `sha256:${"e".repeat(64)}`,
    preparedIntentHash: prepared.prepared_intent_hash,
    recoveryPolicyHash: CORRIDOR_RENAME_RECOVERY_POLICY_HASH, claimedAtIso: AT, demaHome,
  });
  await openClosureTransaction({ claim: cr.claim, demaHome, atIso: AT });
  const st = await replayClosureTransaction({ demaHome, transactionId: "c4c-tx2" });
  await appendClosureEvent({
    demaHome, transactionId: "c4c-tx2",
    expectedSequence: st.sequence + 1, expectedPreviousEventHash: st.head_event_hash,
    phase: "EFFECT_INTENT_PERSISTED",
    evidenceRefs: [{
      schema: "bizra.dema.corridor_rename_intent_evidence.v1",
      prepared_intent_hash: prepared.prepared_intent_hash,
      recovery_policy_hash: CORRIDOR_RENAME_RECOVERY_POLICY_HASH,
      checkpoint_event_hash: cr.claim.checkpoint_event_hash,
      intent: prepared.intent,
    }],
    atIso: AT,
  });
  const observed = await observePostCommitContinuation({ demaHome, claim: cr.claim, effect: null });
  assert.equal(observed.classification, "FORWARD_RECONCILIATION_UNQUALIFIED");
  assert.match(observed.reason, /^not_post_commit:EFFECT_INTENT_PERSISTED$/);
  // An empty ledger is not silently read as agreement.
  assert.equal(observed.observed.ledger_entry_exact, false);
  assert.equal(observed.observed.ledger_conflict, false);
  assert.equal(observed.observed.world_matches_receipt, null, "no seal, so UNKNOWN not true");
  assert.ok(observed.transaction_state, "the state it decided on travels with the verdict");
});
