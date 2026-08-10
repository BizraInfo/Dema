// MISSION-CORRIDOR-CLOSURE-1A — THE WELD.
//
// Joins the two halves that historically had zero references to each other:
//   packages/mission/src/mission-corridor.js   durable, resumable, hash-chained
//                                              journal — but PREVIEW_ONLY, no execution
//   packages/core/src/omega0-mechanical-closure.js
//                                              consent → lease → MANDATORY anchor →
//                                              bounded effect → in-process judge-free verify →
//                                              seal → Proof Card → replay
//
// DEC-1 LAW: the corridor is the sole canonical mission authority. Omega0 is a bounded
// TRANSACTION the corridor authorises at the execution edge — never a second lifecycle.
//
//   corridor authorises → invokes Omega0 → typed outcome → IN-PROCESS JUDGE-FREE
//   verification → seal → canonical ledger append → durable terminal transition
//
// A successful Omega0 return ALONE must never produce COMPLETE.
//
// PURITY BY INJECTION — no node:fs here. The caller supplies `appendReceipt`
// (canonical-ledger) and `verifyAdmission` (verification-admission), so the kernel
// stays deterministic and tests can model a hostile world directly.
//
// ── DIRECT-KERNEL CEILING · consent is SHAPE-checked, not BINDING-checked ──
//
// MCW-16 closes the absent-registry hole: with no `consentRegistry`, single-use
// cannot be PROVEN, so the route refuses (BLOCKED_MISSING_EVIDENCE). Measured
// adversarially — an absent registry and a non-registry object both fail closed.
//
// It does NOT close forgery. A registry that simply grants still yields
// COMPLETE:
//
//   consentRegistry: { claim: async () => ({ granted: true }) }  → COMPLETED_VERIFIED
//
// This is the SAME ceiling peak-self-loop-preview.js documents for evidence:
// purity forbids this kernel from reading the durable nonce store, so it can
// check that a registry is well-shaped but never that it is telling the truth.
//
// CUTOVER 2026-08-11 (part 2). The injected contract was `{ has, add }` and this
// kernel asked, acted, and then recorded — with the whole Omega0 transaction in
// between. It now takes ONE `claim(nonce)` that commits before the effect and
// proceeds from that decision. The shape moved because the shape was the defect:
// `{ has, add }` was satisfied by a plain `new Set()`, which can never express
// an exclusive commitment.
//
// The production CLI path closes that ceiling through
// `corridor-closure-gatherer.js`: one canonical C1 nonce claim is bound to the
// prepared intent and recovery policy, and the same claim identity is carried
// into the C2 transaction. The single-use guarantee therefore holds ON THE
// BOUND PATH ONLY; this kernel called directly with a hand-made object is still
// shape-checked only.
//
// The two legacy nonce adapters remain compatibility/test surfaces only. The
// production C3 path re-reads the exact canonical C1 claim and never creates a
// second authority marker.
//
// C3 does not make this pure kernel a transaction store. The I/O-tier caller
// persists C2 at the boundaries it actually observes and replays the sealed
// Omega0 card here for the ledger/terminal tail.
//
// Exact current counts live in docs/TESTING.md; no count in this header is a
// release or Node0-closure claim.

import { createHash } from "node:crypto";
import { replaySeal, runMechanicalClosure } from "../../core/src/omega0-mechanical-closure.js";

const __hash = (s) => "sha256:" + createHash("sha256").update(s).digest("hex");
const __rawHash = (s) => createHash("sha256").update(s).digest("hex");

export const MISSION_CORRIDOR_CLOSURE_SCHEMA =
  "bizra.dema.mission_corridor_closure.v0.1";

// Domain separation (DEC-1) — a mission-event signature must not be replayable
// as a seal or a genesis manifest.
export const DOMAIN_MISSION_EVENT = "BIZRA:MISSION_EVENT:v1";
export const DOMAIN_MISSION_SEAL = "BIZRA:MISSION_SEAL:v1";

// The nine failure terminals DEC-1 requires the corridor to EXPRESS.
// Carried as a typed outcome on the terminal event rather than as nine new
// states: adding states would invalidate the three real journals already on
// disk against verifyCorridorJournal. STOPPED/COMPLETE remain the only states.
export const TERMINAL_OUTCOMES = Object.freeze([
  "COMPLETED_VERIFIED",
  "REFUSED_POLICY",
  "BLOCKED_MISSING_CONSENT",
  "BLOCKED_MISSING_EVIDENCE",
  "EXECUTION_FAILED_ROLLED_BACK",
  "VERIFICATION_FAILED_ROLLED_BACK",
  "SEAL_FAILED_NO_COMPLETE",
  "LEDGER_COMMIT_FAILED_NO_COMPLETE",
  "RECOVERY_REQUIRED",
  "ESCALATED_TO_HUMAN",
]);

// Total map from Omega0's 16 BLOCK_REASONS onto corridor terminal outcomes.
// Derived by reading omega0-mechanical-closure.js:47-64, not from memory.
const REASON_TO_OUTCOME = Object.freeze({
  // Authority the corridor should never have granted in the first place.
  lease_required: "REFUSED_POLICY",
  lease_expired: "REFUSED_POLICY",
  lease_scope_violation: "REFUSED_POLICY",
  adapter_incomplete: "REFUSED_POLICY",
  // A plan that changed after consent is a DIFFERENT plan (Omega0 design law 3).
  authority_mismatch: "REFUSED_POLICY",

  consent_required: "BLOCKED_MISSING_CONSENT",

  // Every anchor refusal is an evidence failure: the route cannot prove the
  // receipt chain was not erased, so it must not act.
  anchor_required: "BLOCKED_MISSING_EVIDENCE",
  anchor_inside_scope: "BLOCKED_MISSING_EVIDENCE",
  anchor_malformed: "BLOCKED_MISSING_EVIDENCE",
  anchor_log_forged: "BLOCKED_MISSING_EVIDENCE",
  anchor_erased: "BLOCKED_MISSING_EVIDENCE",
  anchor_truncated: "BLOCKED_MISSING_EVIDENCE",
  anchor_forked: "BLOCKED_MISSING_EVIDENCE",

  effect_failed: "EXECUTION_FAILED_ROLLED_BACK",
  verification_failed: "VERIFICATION_FAILED_ROLLED_BACK",
  // Undo could not restore the pre-state — the world is in an unaccounted
  // shape and only a human may decide what happens next.
  restoration_failed: "RECOVERY_REQUIRED",
});

/**
 * Total map from Omega0's 16 BLOCK_REASONS onto corridor terminal outcomes.
 *
 * `SEALED` carries `reason: null` and deliberately maps to NOTHING — it is a
 * CANDIDATE, not a terminal. Only successful seal + ledger append may produce
 * COMPLETED_VERIFIED, and that decision belongs to runCorridorClosure, not here.
 */
export function mapOmega0ReasonToOutcome(reason) {
  if (reason === null || reason === undefined) return null;
  const outcome = REASON_TO_OUTCOME[reason];
  if (!outcome) {
    // Fail closed: an unrecognised reason must never be silently treated as
    // benign. A new BLOCK_REASON upstream should break this loudly.
    throw new Error(`MCW: unmapped Omega0 BLOCK_REASON: ${String(reason)}`);
  }
  return outcome;
}

/**
 * Authorise one bounded Omega0 transaction from a corridor mission and drive it
 * to a durable terminal transition.
 *
 * @param {object} p
 * @param {object} p.contract        corridor contract
 * @param {string} p.contract_hash
 * @param {Array}  p.journal         existing corridor journal events
 * @param {object} p.mission         { objective, root }
 * @param {object} p.lease           { lease_id, scope_root, expires_at, budget_acts }
 * @param {object} p.consent         { by, ref, plan_hash, nonce }
 * @param {string} p.anchorDir       MANDATORY, outside the leased scope
 * @param {object} p.effect          adapter: propose/apply/undo/manifest
 * @param {number} p.now             injected clock
 * @param {Function} p.appendReceipt injected canonical-ledger append (async)
 * @param {Function} p.verifyAdmission injected judge-free verifier
 * @returns {Promise<object>} { state, terminal_outcome, omega0_card, journal_event,
 *                              ledger_head, receipt_ref, effect_performed }
 */
function terminal(outcome, card, extra = {}) {
  return Object.freeze({
    schema: MISSION_CORRIDOR_CLOSURE_SCHEMA,
    state: outcome === "COMPLETED_VERIFIED" ? "COMPLETE" : "STOPPED",
    terminal_outcome: outcome,
    omega0_card: card ?? null,
    authority_delta: 0,
    ...extra,
  });
}

// ── C4B2B — MECHANICAL RECOVERY → CORRIDOR VERDICT ──────────────────────────
//
// C4B2A settles a post-effect-boundary failure into a qualified recovery class.
// This is the ONE pure map from that class onto what the corridor may do.
//
// TWO FACTS SHAPE IT.
//
//  1. The corridor is already at CHECKPOINT when a closure runs (COMPLETE is
//     reachable only from CHECKPOINT). So a VERIFIED_ROLLBACK — where the world
//     was restored and nothing happened — must write NOTHING. The mission is
//     healthy and stays exactly where it was. Writing a terminal there would
//     kill a mission that merely declined to complete.
//  2. STOPPED is terminal (`STOPPED: []`). Publishing it permanently ends the
//     corridor, so only a chain that PROVED itself may cause one.
//
// ── RECOGNITION IS NOT AUTHORITY ──
// A qualified RECOVERY_REQUIRED proves that stopping is NECESSARY. It does not
// grant permission to stop. STOP and COMPLETE are separate corridor authorities
// with separate phrases, separate hashed payloads and separate capability scopes
// (`stop_corridor` vs `complete_corridor`), and a closure runs holding a COMPLETE
// claim. Ending the corridor under it would convert a recognition into a kill.
//
// Disclosing the possibility on the consent card does not fix this: disclosure
// is presentational by construction — it is deliberately outside the hashed
// envelope so existing claims stay valid — which is exactly why it grants no
// cryptographically bound stop authority.
//
// So this map NEVER emits a corridor write. Its strongest output is a HANDOFF:
// the corridor stays at CHECKPOINT and the operator is handed the exact existing
// STOP phrase. Only `dema mission corridor stop`, under fresh context-bound STOP
// consent, may append CHECKPOINT → STOPPED.
export const CORRIDOR_RECOVERY_VERDICTS = Object.freeze([
  "STOP_CONSENT_REQUIRED",           // stopping is proven necessary; authority is absent
  "RECONCILIATION_CONSENT_REQUIRED", // the record and the world disagree; nobody is yet authorized to move either
  "CORRIDOR_UNCHANGED",              // leave the corridor exactly where it is
]);

const RECOVERY_CLASS_TO_CORRIDOR = Object.freeze({
  // World restored, nothing happened: the corridor stays at CHECKPOINT and a
  // separately consented fresh attempt is legitimate.
  VERIFIED_ROLLBACK: {
    verdict: "CORRIDOR_UNCHANGED",
    terminal_outcome: null,
    requires_human: false,
    fresh_attempt_permitted: true,
    required_consent_kind: null,
  },
  // Proved itself, and the proof says a human is needed. It earns a HANDOFF,
  // not a kill: nothing is written and the operator is asked for STOP consent.
  RECOVERY_REQUIRED: {
    verdict: "STOP_CONSENT_REQUIRED",
    terminal_outcome: null,
    requires_human: true,
    fresh_attempt_permitted: false,
    required_consent_kind: "STOP",
  },
  // Recovery is required, but this result refused before or during adjudication:
  // nothing was classified, so nothing was proven. Explicit rather than left to
  // the unknown-class fallback — "not cleanly qualified" and "not operationally
  // actionable" are different, and only the first applies here.
  RECOVERY_REQUIRED_UNQUALIFIED: {
    verdict: "CORRIDOR_UNCHANGED",
    terminal_outcome: null,
    requires_human: true,
    fresh_attempt_permitted: false,
    required_consent_kind: null,
  },
  // Evidence or protocol corruption. Needs a human, but has NOT earned the
  // authority to end the corridor by itself.
  INVALID: {
    verdict: "CORRIDOR_UNCHANGED",
    terminal_outcome: null,
    requires_human: true,
    fresh_attempt_permitted: false,
    required_consent_kind: null,
  },
  // Pre-C4B1 history: replayable, never promoted, never a corridor verdict.
  LEGACY_UNQUALIFIED_ROLLBACK: {
    verdict: "CORRIDOR_UNCHANGED",
    terminal_outcome: null,
    requires_human: true,
    fresh_attempt_permitted: false,
    required_consent_kind: null,
  },
  // Settled as something that is not a rollback at all.
  NON_ROLLBACK_TERMINAL: {
    verdict: "CORRIDOR_UNCHANGED",
    terminal_outcome: null,
    requires_human: true,
    fresh_attempt_permitted: false,
    required_consent_kind: null,
  },
  // The transaction completed forward; the normal completion path owns it.
  FORWARD_COMPLETED: {
    verdict: "CORRIDOR_UNCHANGED",
    terminal_outcome: null,
    requires_human: false,
    fresh_attempt_permitted: false,
    required_consent_kind: null,
  },
});

/**
 * Map a post-commit continuation classification onto a corridor verdict.
 *
 * Divergence is deliberately NOT routed through the recovery map. A verified
 * failed restoration proved the world was returned and earned the right to ask
 * for STOP consent. A post-commit divergence proved only that the record and the
 * world disagree — which of them should move is a REMEDY CHOICE, and choosing a
 * remedy is exactly what fresh consent exists for.
 *
 * So this offers no stop, claims no terminal, and writes nothing.
 */
export function mapPostCommitClassToCorridor(classification) {
  if (classification === "FORWARD_COMPLETION_ELIGIBLE") {
    return Object.freeze({
      verdict: "CORRIDOR_UNCHANGED",
      terminal_outcome: null,
      requires_human: false,
      compensation_performed: false,
      fresh_attempt_permitted: false,
      stop_consent_offered: false,
      required_consent_kind: null,
      post_commit_class: classification,
    });
  }
  const known = POST_COMMIT_CONTINUATION_CLASSES.includes(classification);
  return Object.freeze({
    // Everything else needs a human and a separately bounded remediation. Note
    // this is never RECOVERY_REQUIRED and never STOP_CONSENT_REQUIRED.
    verdict: classification === "ALREADY_TERMINAL"
      ? "CORRIDOR_UNCHANGED"
      : "RECONCILIATION_CONSENT_REQUIRED",
    terminal_outcome: null,
    requires_human: classification !== "ALREADY_TERMINAL",
    compensation_performed: false,
    fresh_attempt_permitted: false,
    stop_consent_offered: false,
    required_consent_kind: null,
    post_commit_class: known ? classification : "FORWARD_RECONCILIATION_UNQUALIFIED",
  });
}

/**
 * Map a C4B2A recovery classification onto a corridor verdict.
 *
 * Pure. Decides only what the corridor MAY do; it never writes, and it never
 * decides whether the classification itself was earned — that is C4B2A's.
 *
 * @returns {Readonly<{verdict:string, terminal_outcome:string|null,
 *                     requires_human:boolean, fresh_attempt_permitted:boolean,
 *                     recovery_class:string}>}
 */
export function mapRecoveryClassToCorridor(recoveryClass) {
  const mapped = RECOVERY_CLASS_TO_CORRIDOR[recoveryClass];
  if (!mapped) {
    // Fail closed: an unrecognised class must never reach the corridor, and
    // must never silently look benign.
    return Object.freeze({
      verdict: "CORRIDOR_UNCHANGED",
      terminal_outcome: null,
      requires_human: true,
      fresh_attempt_permitted: false,
      required_consent_kind: null,
      recovery_class: typeof recoveryClass === "string" ? recoveryClass : "UNKNOWN",
    });
  }
  return Object.freeze({ ...mapped, recovery_class: recoveryClass });
}

// ── C4C — POST-COMMIT COMPLETION AND DIVERGENCE ─────────────────────────────
//
// Once the ledger has committed, a signed receipt asserts what happened. From
// there the original consent still authorizes ONE thing: deterministically
// finishing the proof trail of the act it already approved. It authorizes
// nothing whose purpose is to change the world so the world agrees with the
// record.
//
//   original consent
//     ├── may finish recording the already-authorized result
//     └── may NOT manufacture a world that matches the record
//
// So this makes a THREE-WAY distinction, and the third branch is the point:
//
//   exact artifact already exists        → adopt it and continue
//   exact pre-authorized artifact is
//     safely appendable                  → append once and continue
//   world, head, context or evidence
//     diverged                           → mutate NOTHING; a new remediation
//                                          transaction is required
//
// Divergence is NOT recovery. A verified failed restoration and a post-commit
// divergence are different facts: the first proved the world was returned, the
// second proved the record and the world disagree and nobody has yet been
// authorized to decide which one moves.
export const POST_COMMIT_CONTINUATION_CLASSES = Object.freeze([
  "FORWARD_COMPLETION_ELIGIBLE",
  "POST_COMMIT_CONTEXT_DIVERGENCE",
  "POST_COMMIT_WORLD_DIVERGENCE",
  "POST_COMMIT_LEDGER_DIVERGENCE",
  "FORWARD_RECONCILIATION_UNQUALIFIED",
  "ALREADY_TERMINAL",
]);

// The phases at which forward completion is even a question. Before the ledger
// commits there is no committed record to complete, and C4B2A owns that region.
const POST_COMMIT_PHASES = Object.freeze(["LEDGER_COMMITTED", "ANCHORED"]);

const unqualified = (reason) => Object.freeze({
  classification: "FORWARD_RECONCILIATION_UNQUALIFIED", reason, may_append: false,
});
const diverged = (classification, reason) => Object.freeze({
  classification, reason, may_append: false,
});

/**
 * Classify what may lawfully happen next for a post-commit transaction.
 *
 * PURE. Every input is an already-made observation; this decides, it never
 * looks and never writes. `may_append` is true only for completion-only
 * continuation of the exact, already-frozen, already-authorized artifact.
 *
 * @param {object}  p.state             replayed C2 transaction
 * @param {boolean} p.ledgerEntryExact  the exact intended ledger entry is present
 * @param {boolean} p.ledgerConflict    the ledger holds conflicting material for this transaction
 * @param {boolean} p.ledgerContextIntact the expected ledger predecessor still holds
 * @param {boolean} p.anchorExact       the exact intended anchor record is present
 * @param {boolean} p.anchorContextIntact the expected anchor predecessor still holds
 * @param {boolean} p.worldMatchesReceipt the observed world still equals what the receipt asserts
 * @returns {Readonly<{classification:string, reason:string, may_append:boolean,
 *                     next_phase?:string}>}
 */
export function classifyPostCommitContinuation({
  state,
  ledgerEntryExact,
  ledgerConflict = false,
  ledgerContextIntact = true,
  anchorExact,
  anchorContextIntact = true,
  worldMatchesReceipt,
} = {}) {
  if (!state?.ok || state.exists !== true) return unqualified("c2_transaction_unverifiable");

  // An already-settled transaction is returned as-is; replay must never mutate.
  if (state.terminal === true) {
    return Object.freeze({
      classification: "ALREADY_TERMINAL",
      reason: `already_${String(state.terminal_outcome ?? "resolved").toLowerCase()}`,
      may_append: false,
    });
  }
  if (!POST_COMMIT_PHASES.includes(state.phase)) {
    return unqualified(`not_post_commit:${state.phase ?? "none"}`);
  }

  // ── divergence, checked before ANY continuation ──
  // A conflicting ledger is the gravest: two records claim the same transaction.
  if (ledgerConflict === true) {
    return diverged("POST_COMMIT_LEDGER_DIVERGENCE", "ledger_holds_conflicting_material");
  }
  // The record says the world is X. If the world is Y, the ONLY lawful automatic
  // act is none: making them agree is compensation, and compensation is a new
  // world-changing act that this consent never covered.
  if (worldMatchesReceipt === false) {
    return diverged("POST_COMMIT_WORLD_DIVERGENCE", "observed_world_differs_from_receipt");
  }
  // A moved head means the artifact we were authorized to append is no longer
  // the artifact that would result.
  if (ledgerContextIntact === false) {
    return diverged("POST_COMMIT_CONTEXT_DIVERGENCE", "ledger_context_changed");
  }
  if (anchorContextIntact === false) {
    return diverged("POST_COMMIT_CONTEXT_DIVERGENCE", "anchor_context_changed");
  }
  if (worldMatchesReceipt !== true) return unqualified("world_observation_unavailable");

  if (state.phase === "LEDGER_COMMITTED") {
    if (ledgerEntryExact !== true) {
      return diverged("POST_COMMIT_CONTEXT_DIVERGENCE", "committed_ledger_entry_absent");
    }
    // Adopt-or-append are the same lawful continuation; the appender is
    // idempotent, so an anchor already present is adopted rather than duplicated.
    return Object.freeze({
      classification: "FORWARD_COMPLETION_ELIGIBLE",
      reason: anchorExact === true ? "anchor_already_present_adopt" : "anchor_appendable_once",
      may_append: true,
      next_phase: "ANCHORED",
    });
  }

  // ANCHORED: both committed artifacts must still be exactly the ones bound.
  if (ledgerEntryExact !== true) {
    return diverged("POST_COMMIT_CONTEXT_DIVERGENCE", "committed_ledger_entry_absent");
  }
  if (anchorExact !== true) {
    return diverged("POST_COMMIT_CONTEXT_DIVERGENCE", "committed_anchor_absent");
  }
  return Object.freeze({
    classification: "FORWARD_COMPLETION_ELIGIBLE",
    reason: "terminal_appendable_once",
    may_append: true,
    next_phase: "RESOLVED",
  });
}

export async function runCorridorClosure(p = {}) {
  const {
    mission, lease, consent, anchorDir, effect, now = 0,
    appendReceipt, verifyAdmission, seal, legacy_refs, contract,
  } = p;

  // ── DEC-1: one canonical mission identity. A lifecycle caller may not mint a
  // second one by supplying its own id instead of the corridor's.
  if (!contract?.mission_id) {
    throw new Error(
      "MCW: canonical mission_id required — mission-lifecycle holds no mission authority",
    );
  }

  // ── Consent is structural, never narrative. A model's opinion that the
  // operator "clearly approved" is not a consent ref (MCW-13).
  if (!consent?.by || !consent?.ref) {
    return terminal("BLOCKED_MISSING_CONSENT", null);
  }

  // ── Single-use consent. The registry is REQUIRED, not optional: without it
  // the kernel cannot PROVE this consent is unused, and unprovable is not
  // permission. Missing evidence is UNKNOWN, never PASS (MCW-16).
  const registry = p.consentRegistry;
  if (!registry || typeof registry.claim !== "function") {
    return terminal("BLOCKED_MISSING_EVIDENCE", null, {
      reason_detail: "consent_registry_absent_single_use_unprovable",
    });
  }
  // ONE call. The authority commits here and the transaction below proceeds FROM
  // that committed decision — it is never re-asked, and nothing is recorded
  // afterwards. The old contract asked `has`, ran the entire Omega0 transaction,
  // and only then called `add`; two missions holding one nonce both answered
  // "unused", both acted, and the loser learned it had spent authority it never
  // held when its `add` threw. That arbitrated the RECORD, never the ACT.
  //
  // That the old contract was satisfied by a plain `new Set()` is the tell: a Set
  // can say "was it there" and "put it there" and cannot say "commit exclusively,
  // and tell me whether I hold it". The shape was the defect, so swapping the
  // writer underneath has/add could not have fixed it.
  const consentKey = consent.nonce ?? consent.ref;
  const consentClaim = await registry.claim(consentKey);
  if (!consentClaim || typeof consentClaim !== "object" || consentClaim.granted !== true) {
    // Not-granted is refusal in every form: a false grant, a mute answer, and a
    // truthy non-object all fail closed. Unprovable is not permission.
    return terminal("REFUSED_POLICY", null, {
      reason_detail: typeof consentClaim?.reason === "string" && consentClaim.reason.length > 0
        ? consentClaim.reason
        : "consent_claim_refused",
    });
  }

  // ── The bounded Omega0 transaction. The ordinary pure-kernel path performs
  // it here. The disk-bound C3 caller may instead supply the SEALED card already
  // recorded in C2; it is accepted only after this kernel replays the seal,
  // observes the post-state, and rebinds mission, consent, lease and plan.
  let card = p.omega0Card;
  if (card !== undefined) {
    let replayed = null;
    let expectedPlanHash = null;
    try {
      replayed = replaySeal(card, effect);
      expectedPlanHash = __rawHash(JSON.stringify(effect.propose()));
    } catch {
      replayed = null;
    }
    const expectedMissionHash = __rawHash(JSON.stringify(mission));
    const expectedConsentHash = __rawHash(JSON.stringify({
      by: consent.by,
      ref: consent.ref,
      plan_hash: expectedPlanHash,
    }));
    if (replayed?.replayed !== true
        || card.mission_hash !== expectedMissionHash
        || card.consent_hash !== expectedConsentHash
        || card.plan_hash !== expectedPlanHash
        || card.lease_id !== lease?.lease_id
        || card.anchor_dir !== anchorDir) {
      return terminal("RECOVERY_REQUIRED", card ?? null, {
        reason_detail: "persisted_omega0_card_binding_mismatch",
      });
    }
  } else {
    card = runMechanicalClosure({ mission, lease, consent, anchorDir, effect, now });
  }

  if (card.status !== "SEALED") {
    return terminal(mapOmega0ReasonToOutcome(card.reason), card);
  }

  // SEALED is a CANDIDATE. Everything below must also succeed.
  //
  // Nothing is recorded here. Consent was committed before the effect; a second
  // write after it would be the old check-then-act pair wearing a new name.

  // ── IN-PROCESS JUDGE-FREE verification. The proposer and certifier identifiers
  // differ, so the actor does not certify itself — but both run inside THIS
  // process and trust boundary. That is structural separation, NOT organisational,
  // cryptographic or remote independence. Never call it "independently verified".
  const v = verifyAdmission?.({ card, mission, lease });
  if (!v?.admitted) {
    // C4D: the injected undo may be ASYNC — the owned adapter re-derives
    // ownership from disk before delegating. Firing it without `await` let this
    // corridor publish a verified rollback before knowing whether the undo was
    // authorized, or whether it happened at all, and orphaned its rejection into
    // an unhandledRejection. The governing distinction is:
    //
    //   undo requested ≠ undo authorized ≠ undo completed ≠ before-state verified
    //
    // Only the last may justify a *_ROLLED_BACK outcome. Awaiting an INJECTED
    // adapter costs no purity: this kernel still imports no node:fs, no ownership
    // module, no process inspection, and knows nothing of fencing tokens.
    //
    // `undo` itself must stay SYNCHRONOUS: Omega0's reversibility probe calls it
    // at omega0-mechanical-closure.js:347/401/414/721 inside NON-async functions
    // and hashes the world on the very next line. An async `undo` returns a
    // pending Promise there, the restore has not happened when the hash is taken,
    // reversibility fails and every card comes back BLOCKED. Measured: admission
    // was never even reached. So ownership rides a SEPARATE async `undoOwned`,
    // used only here — after the effect boundary, where a fresh fence is required.
    const verificationReason = v?.reason ?? "not_admitted";
    const restore = typeof effect?.undoOwned === "function"
      ? () => effect.undoOwned()
      : (typeof effect?.undo === "function" ? () => effect.undo() : null);
    let undoCompleted = false;
    try {
      if (restore === null) {
        return terminal("RECOVERY_REQUIRED", card, {
          reason_detail: "verification_failure_restoration_absent",
          verification_reason: verificationReason,
        });
      }
      await restore();
      undoCompleted = true;
    } catch (err) {
      // Disclose the sanitized CODE only — never a message, stack, path,
      // ownership claim or fencing token.
      return terminal("RECOVERY_REQUIRED", card, {
        reason_detail: "verification_failure_restoration_unverified",
        restoration_error: typeof err?.code === "string" ? err.code : "restoration_failed",
        verification_reason: verificationReason,
      });
    }
    if (!undoCompleted) {
      return terminal("RECOVERY_REQUIRED", card, {
        reason_detail: "verification_failure_restoration_absent",
        verification_reason: verificationReason,
      });
    }
    return terminal("VERIFICATION_FAILED_ROLLED_BACK", card, {
      verification_reason: verificationReason,
    });
  }

  // ── Seal.
  let sealed;
  try {
    sealed = seal ? seal(card) : { seal_head: card.seal_head };
  } catch (e) {
    return terminal("SEAL_FAILED_NO_COMPLETE", card, { error: String(e?.message ?? e) });
  }

  // ── Canonical ledger. Note appendCanonicalReceipt is itself consent-gated,
  // so consent is carried all the way through rather than ending at the seal.
  let ledger;
  try {
    ledger = await appendReceipt({
      canonicalBody: {
        domain: DOMAIN_MISSION_SEAL,
        mission_id: contract.mission_id,
        seal_head: sealed.seal_head,
        before_hash: card.before_hash,
        after_hash: card.after_hash,
        ...(p.transactionBinding ? {
          closure_transaction_id: p.transactionBinding.transaction_id,
          consent_claim_hash: p.transactionBinding.consent_claim_hash,
          prepared_intent_hash: p.transactionBinding.prepared_intent_hash,
        } : {}),
      },
      // MEASURED_LOCAL, never MEASURED: this closure is measured on ONE local
      // host. Nothing here is remotely verified, and the canonical receipt
      // vocabulary has no bare "MEASURED" for exactly that reason.
      truthLabel: "MEASURED_LOCAL",
      consent,
    });
    if (!ledger?.ok) throw new Error("ledger append refused");
  } catch (e) {
    return terminal("LEDGER_COMMIT_FAILED_NO_COMPLETE", card, {
      error: String(e?.message ?? e),
    });
  }

  // ── Durable terminal transition. Only now may COMPLETE exist.
  // The event is hash-chained to its predecessor so a fresh process can detect
  // reorder / deletion / mutation / fork without trusting the writer (MCW-10/11).
  const prior = Array.isArray(p.journal) ? p.journal : [];
  const body = {
    domain: DOMAIN_MISSION_EVENT,
    index: prior.length,
    prev_hash: prior.length ? prior[prior.length - 1].event_hash : null,
    contract_hash: p.contract_hash,
    state: "COMPLETE",
    terminal_outcome: "COMPLETED_VERIFIED",
    mission_id: contract.mission_id,
    seal_head: sealed.seal_head,
    ledger_head: ledger.head,
    ledger_length: ledger.length ?? null,
  };
  const journal_event = Object.freeze({ ...body, event_hash: __hash(JSON.stringify(body)) });

  return terminal("COMPLETED_VERIFIED", card, {
    journal_event,
    persisted_journal: Object.freeze([...prior, journal_event]),
    persisted_ledger: Object.freeze([{ head: ledger.head, mission_id: contract.mission_id }]),
    ledger_head: ledger.head,
    ledger_length: ledger.length ?? null,
    effect_performed: true,
    legacy_refs: (legacy_refs ?? []).map((l) =>
      Object.freeze({ ...l, migration_status: "PROVENANCE_ONLY" }),
    ),
  });
}

/**
 * Resume law — a restarted process must reconstruct exact terminal state from the
 * journal + ledger alone, never repeating an effect and never appending a duplicate
 * receipt.
 */
export async function resumeCorridorClosure(p = {}) {
  // Resume asks the authority NOTHING of its own. It runs the same closure and
  // re-reads the one committed decision that run already made.
  //
  // A separate probe here would have been a second check-then-act — the exact
  // shape this cutover removes, reintroduced on the recovery path. Because the
  // claim commits BEFORE the effect, a spent authority refuses at the consent
  // gate and the effect is never reached, so "no replay" is enforced by the same
  // gate that enforces single use rather than by a second opinion about it.
  //
  // The distinction resume adds is interpretive, not authoritative: for a fresh
  // caller a spent nonce is a refusal, while for a restart it is the durability
  // signal that the prior attempt already acted (MCW-05) and already appended
  // (MCW-06). Same fact, same decision, different reading.
  const r = await runCorridorClosure(p);
  if (r?.terminal_outcome !== "REFUSED_POLICY") return r;
  if (r.reason_detail !== "consent_already_consumed") return r;

  return Object.freeze({
    schema: MISSION_CORRIDOR_CLOSURE_SCHEMA,
    state: "STOPPED",
    terminal_outcome: "RECOVERY_REQUIRED",
    resumed: true,
    effect_performed: false,   // by THIS call — the prior call performed it
    receipt_appended: false,   // no duplicate append
    authority_delta: 0,
    reason_detail: "transaction_already_committed_no_replay",
  });
}

/**
 * Re-derive every claim of a completed closure from persisted artefacts only.
 * Must NOT trust anything the running process reported.
 */
export function verifyCorridorClosure({ contract, contract_hash, journal, ledger } = {}) {
  const fail = (reason) =>
    Object.freeze({ ok: false, reason, terminal_outcome: null, ledger_membership: false });

  if (!Array.isArray(journal) || journal.length === 0) return fail("journal_absent");

  // Re-derive the chain from the events themselves. Never trust a carried hash:
  // recompute each link from the body that precedes it.
  for (let i = 0; i < journal.length; i += 1) {
    const e = journal[i];
    if (!e || typeof e !== "object") return fail(`event_not_an_object:${i}`);
    if (e.index !== i) return fail(`event_order_broken_at:${i}`);
    const expectedPrev = i === 0 ? null : journal[i - 1].event_hash;
    if (e.prev_hash !== expectedPrev) return fail(`prev_hash_chain_broken_at:${i}`);
    const { event_hash, ...body } = e;
    if (__hash(JSON.stringify(body)) !== event_hash) return fail(`event_hash_mutated_at:${i}`);
  }

  const last = journal[journal.length - 1];
  if (last.contract_hash !== contract_hash) return fail("contract_hash_changed");
  if (last.mission_id !== contract?.mission_id) return fail("mission_id_mismatch");
  if (last.state !== "COMPLETE") return fail(`not_complete:${last.state}`);

  // Ledger membership is re-derived, not asserted by the runner.
  const member = Array.isArray(ledger) && ledger.some((r) => r?.head === last.ledger_head);
  if (!member) return fail("ledger_membership_absent");

  return Object.freeze({
    ok: true,
    terminal_outcome: last.terminal_outcome,
    ledger_membership: true,
    seal_head: last.seal_head,
    ledger_head: last.ledger_head,
  });
}
