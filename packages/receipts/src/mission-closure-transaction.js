// MISSION-CLOSURE-TRANSACTION-1A — the immutable history of ONE closure (Gate C, C2).
//
// C1 (consent-nonce-claim.js) owns the single authority fact: the nonces-v1
// claim. Existence of that file IS consumption. This module records what
// happened AFTER consumption and may never re-decide it. Three distinct facts
// that must never collapse into each other:
//
//   nonce claim exists     authority was irreversibly consumed
//   PREPARED exists        a recoverable transaction was established
//   EFFECT_APPLIED exists  the world-changing operation occurred
//
// ── SUBORDINATE, NOT PARALLEL ──
// The corridor already owns a closed transition map (CORRIDOR_TRANSITIONS,
// packages/mission/src/mission-corridor.js:36-46) and the tree carries an
// explicit law against adding lifecycle states: "nine more states would
// invalidate every corridor journal" (mission-corridor.js:189).
//
// So this log does NOT invent a second lifecycle. It refines the single
// CHECKPOINT → COMPLETE corridor edge and terminates at RESOLVED, carrying one
// of the ten existing TERMINAL_OUTCOMES as DATA — exactly the pattern
// mission-corridor-closure.js:71-86 already uses. There is deliberately no
// CORRIDOR_COMPLETED phase here: two closed maps answering "where is this
// closure" would rebuild, one layer up, the two-authority defect C1 removed.
//
// ── WHY LINK() AND NOT open(wx) ──
// O_EXCL stops two writers owning one filename, but a crash between create and
// write leaves a PARTIAL file at an authoritative path — and immutable events
// may never be repaired in place, so that forces recovery escalation for what
// was only a torn write. Publication is therefore: write a private temp, fsync
// it, hard-link it to the canonical path (link fails if the path exists), fsync
// the directory, unlink the temp. The canonical path only ever appears whole.
// Where link() is unavailable we FAIL CLOSED rather than fall back to rename,
// which would silently overwrite an existing event.
//
// I/O tier by design (allowlisted). All paths under DEMA_HOME. No network.

import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, readdir, link, unlink, open } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

// This module's path is registered in CANONICAL_JSON_V1_REGISTERED_CONSUMERS
// (scripts/review/canonical-json-v1-check.mjs); review that one-line diff in
// this slice's PR.
import { canonicalizeJsonV1 } from "../../canon/src/canonical-json-v1.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";
import { TERMINAL_OUTCOMES } from "../../mission/src/mission-corridor-closure.js";

export const MISSION_CLOSURE_TX_SCHEMA = "bizra.dema.mission_closure_transaction.v1";
export const MISSION_CLOSURE_TX_EVENT_SCHEMA = "bizra.dema.mission_closure_tx_event.v1";
export const MISSION_CLOSURE_TX_DOMAIN = "BIZRA:MISSION_CLOSURE_TX:v1";
export const MISSION_CLOSURE_TX_EVENT_DOMAIN = "BIZRA:MISSION_CLOSURE_TX_EVENT:v1";
export const CANONICALIZATION = "bizra.canonical-json.v1";

export const MISSION_CLOSURE_TX_RELDIR = join("transactions", "mission-closure");

// Closed map. An unlisted transition fails closed. RESOLVED is the ONLY terminal
// and it always carries a corridor TERMINAL_OUTCOME.
export const TX_TRANSITIONS = Object.freeze({
  PREPARED: Object.freeze(["EFFECT_INTENT_PERSISTED", "RESOLVED"]),
  // ROLLBACK_STARTED is reachable from here because the production route crosses
  // the effect boundary BEFORE it appends EFFECT_APPLIED. A crash in that window
  // leaves the world changed while the durable head still reads
  // EFFECT_INTENT_PERSISTED; without this edge that exact state — the one the
  // ordering actually produces — would be unrecoverable by construction.
  // It does NOT weaken the chain: settlement still has to route through
  // ROLLBACK_STARTED → ROLLED_BACK → BEFORE_STATE_VERIFIED, so no rollback can
  // shortcut past its own restoration proof.
  EFFECT_INTENT_PERSISTED: Object.freeze(["EFFECT_APPLIED", "ROLLBACK_STARTED", "RESOLVED"]),
  EFFECT_APPLIED: Object.freeze(["VERIFIED", "ROLLBACK_STARTED"]),
  VERIFIED: Object.freeze(["SEALED", "ROLLBACK_STARTED"]),
  SEALED: Object.freeze(["LEDGER_COMMITTED", "RESOLVED"]),
  LEDGER_COMMITTED: Object.freeze(["ANCHORED", "RESOLVED"]),
  ANCHORED: Object.freeze(["RESOLVED"]),
  ROLLBACK_STARTED: Object.freeze(["ROLLED_BACK", "RECOVERY_REQUIRED"]),
  // ROLLED_BACK keeps its direct RESOLVED edge for REPLAY ONLY. Transactions
  // settled that way before BEFORE_STATE_VERIFIED existed are immutable history;
  // making new writers stricter must not retroactively invalidate them. New
  // appends are governed by TX_APPEND_TRANSITIONS, which removes that edge.
  ROLLED_BACK: Object.freeze(["BEFORE_STATE_VERIFIED", "RESOLVED"]),
  BEFORE_STATE_VERIFIED: Object.freeze(["RESOLVED"]),
  RECOVERY_REQUIRED: Object.freeze(["RESOLVED"]),
  RESOLVED: Object.freeze([]),
});

export const TX_PHASES = Object.freeze(Object.keys(TX_TRANSITIONS));

// ── WHY TWO MAPS ──
// A closed history and a closed writer are different laws. History must stay
// replayable forever; a writer may get stricter over time. One map cannot serve
// both without either invalidating old chains or letting a new rollback settle
// with its restoration proof discarded.
//
// Every append edge MUST be a subset of a replay edge — the writer may narrow
// what history permits, never widen it. Enforced by C4B1-05.
export const TX_APPEND_TRANSITIONS = Object.freeze({
  ...TX_TRANSITIONS,
  // A rollback may only settle THROUGH its restoration proof.
  ROLLED_BACK: Object.freeze(["BEFORE_STATE_VERIFIED"]),
});

// The one evidence shape a BEFORE_STATE_VERIFIED event may carry. C2 records
// internal consistency and provenance — it does not claim it observed the
// filesystem itself. The adapter observed; this binds what it reported.
export const BEFORE_STATE_VERIFIED_EVIDENCE_SCHEMA =
  "bizra.dema.closure_before_state_verified_evidence.v1";

// The durable intent evidence a rollback proof must be re-derived FROM. Written
// by the corridor at EFFECT_INTENT_PERSISTED, before any world change.
export const CORRIDOR_RENAME_INTENT_EVIDENCE_SCHEMA =
  "bizra.dema.corridor_rename_intent_evidence.v1";

// EXACT shape, not a forbidden-field blacklist. A blacklist only excludes the
// smuggled fields somebody already thought of; an immutable receipt must carry
// exactly one small, primitive, canonical object and nothing else.
const RESTORATION_EVIDENCE_KEYS = Object.freeze([
  "schema",
  "prepared_intent_hash",
  "before_hash",
  "restored_hash",
  "restoration_verified",
  "recovery_mode",
  "undo_success_pct",
]);

// Only the modes the helper actually produces. An arbitrary non-empty string
// would let a writer invent a recovery story the kernel cannot produce.
const RESTORATION_RECOVERY_MODES = Object.freeze([
  "ALREADY_BEFORE_STATE",
  "INVERSE_APPLIED",
  "INTERMEDIATE_RESTORED_BACKWARD",
]);

// TWO hash formats exist in this tree and neither is weakened to accept the
// other: omega0 emits RAW 64-hex, while this module and the claim emit TAGGED
// "sha256:<64hex>". before/restored hashes come from omega0; prepared_intent_hash
// comes from the claim. RAW_SHA256_RE / TAGGED_SHA256_RE are declared below and
// reused here rather than redefined.

// The exact key set the descriptor must carry — validated, not merely parsed.
const DESCRIPTOR_KEYS = Object.freeze([
  "schema", "domain", "canonicalization", "transaction_id", "consent_claim_hash",
  "nonce_digest", "mission_id", "contract_hash", "consent_context_hash",
  "checkpoint_event_hash", "action_kind", "action_class", "prepared_intent_hash",
  "recovery_policy_hash", "claimed_at_iso", "transaction_hash",
]);

// The exact key set the durable intent evidence must carry.
const INTENT_EVIDENCE_KEYS = Object.freeze([
  "schema", "prepared_intent_hash", "recovery_policy_hash",
  "checkpoint_event_hash", "intent",
]);

/**
 * Derive ONE authoritative binding context, or nothing.
 *
 * A restoration proof must not merely agree with itself. It must agree with the
 * immutable descriptor, the durable intent event, the intent's ACTUAL bytes, and
 * the transaction_hash carried by the event chain. Every required source is
 * mandatory here: an absent binding is a refusal, never a skipped check. The
 * previous version guarded with `typeof === "string" &&`, which silently turned
 * a missing authority into a passing one.
 *
 * C2 verifies mutual consistency of its own artifacts. It does NOT re-decide
 * consent — C1 remains the sole consumption authority.
 *
 * @returns {{context: object}|{error: string}}
 */
function deriveRollbackBindingContext({ descriptor, events, transactionId } = {}) {
  // ── descriptor integrity ──
  if (!descriptor || typeof descriptor !== "object" || Array.isArray(descriptor)) {
    return { error: "descriptor_not_object" };
  }
  const dKeys = Object.keys(descriptor);
  if (dKeys.length !== DESCRIPTOR_KEYS.length
      || DESCRIPTOR_KEYS.some((k) => !Object.hasOwn(descriptor, k))) {
    return { error: "descriptor_shape_mismatch" };
  }
  if (descriptor.schema !== MISSION_CLOSURE_TX_SCHEMA) return { error: "descriptor_schema_mismatch" };
  if (descriptor.domain !== MISSION_CLOSURE_TX_DOMAIN) return { error: "descriptor_domain_mismatch" };
  if (descriptor.canonicalization !== CANONICALIZATION) return { error: "descriptor_canonicalization_mismatch" };
  if (typeof transactionId === "string" && descriptor.transaction_id !== transactionId) {
    return { error: "descriptor_transaction_id_path_mismatch" };
  }
  if (!TAGGED_SHA256_RE.test(descriptor.transaction_hash)) return { error: "descriptor_transaction_hash_format" };
  if (!TAGGED_SHA256_RE.test(descriptor.prepared_intent_hash)) return { error: "descriptor_prepared_intent_hash_format" };
  if (!TAGGED_SHA256_RE.test(descriptor.recovery_policy_hash)) return { error: "descriptor_recovery_policy_hash_format" };
  if (!TAGGED_SHA256_RE.test(descriptor.checkpoint_event_hash)) return { error: "descriptor_checkpoint_event_hash_format" };

  // Recompute the descriptor hash from its own body: a descriptor edited without
  // matching its hash is refused, and the hash must equal what the chain carries.
  const { transaction_hash: storedTxHash, ...body } = descriptor;
  if (hashDescriptor(body) !== storedTxHash) return { error: "descriptor_hash_mismatch" };
  const chain = events ?? [];
  if (chain.length === 0) return { error: "transaction_chain_empty" };
  if (chain.some((e) => e.transaction_hash !== storedTxHash)) {
    return { error: "descriptor_not_bound_to_event_chain" };
  }

  // ── durable intent event ──
  const intents = chain.filter((e) => e?.phase === "EFFECT_INTENT_PERSISTED");
  if (intents.length !== 1) return { error: "intent_event_not_exactly_one" };
  const refs = intents[0].evidence_refs;
  // Exactly one reference — not "one matching plus unrelated extras".
  if (!Array.isArray(refs) || refs.length !== 1) return { error: "intent_evidence_not_exactly_one" };
  const ref = refs[0];
  if (!ref || typeof ref !== "object" || Array.isArray(ref)) return { error: "intent_evidence_not_object" };
  if (ref.schema !== CORRIDOR_RENAME_INTENT_EVIDENCE_SCHEMA) return { error: "intent_evidence_schema_mismatch" };
  const iKeys = Object.keys(ref);
  if (iKeys.length !== INTENT_EVIDENCE_KEYS.length
      || INTENT_EVIDENCE_KEYS.some((k) => !Object.hasOwn(ref, k))) {
    return { error: "intent_evidence_shape_mismatch" };
  }
  if (!TAGGED_SHA256_RE.test(ref.prepared_intent_hash)) return { error: "intent_prepared_intent_hash_format" };
  if (!TAGGED_SHA256_RE.test(ref.recovery_policy_hash)) return { error: "intent_recovery_policy_hash_format" };
  if (!TAGGED_SHA256_RE.test(ref.checkpoint_event_hash)) return { error: "intent_checkpoint_event_hash_format" };
  if (ref.prepared_intent_hash !== descriptor.prepared_intent_hash) {
    return { error: "intent_prepared_intent_hash_ne_descriptor" };
  }
  if (ref.recovery_policy_hash !== descriptor.recovery_policy_hash) {
    return { error: "intent_recovery_policy_hash_ne_descriptor" };
  }
  if (ref.checkpoint_event_hash !== descriptor.checkpoint_event_hash) {
    return { error: "intent_checkpoint_event_hash_ne_descriptor" };
  }

  // ── the intent's ACTUAL bytes ──
  // Three fields agreeing with each other prove nothing if none of them matches
  // the intent they claim to describe. Re-derived with the EXISTING generator
  // (sha256CanonicalJsonV1), not a second implementation.
  const intent = ref.intent;
  if (!intent || typeof intent !== "object" || Array.isArray(intent)) return { error: "intent_not_object" };
  let rederivedIntentHash;
  try {
    rederivedIntentHash = sha256CanonicalJsonV1(intent);
  } catch {
    return { error: "intent_not_canonicalizable" };
  }
  if (rederivedIntentHash !== ref.prepared_intent_hash) {
    return { error: "intent_hash_not_derived_from_intent_bytes" };
  }

  // ── before_hash re-derived from before_manifest (omega0's RAW contract) ──
  if (!Array.isArray(intent.before_manifest)) return { error: "intent_before_manifest_malformed" };
  if (!RAW_SHA256_RE.test(intent.before_hash ?? "")) return { error: "intent_before_hash_format" };
  let rederivedBeforeHash;
  try {
    rederivedBeforeHash = createHash("sha256")
      .update(JSON.stringify(intent.before_manifest)).digest("hex");
  } catch {
    return { error: "intent_before_manifest_unhashable" };
  }
  if (rederivedBeforeHash !== intent.before_hash) {
    return { error: "intent_before_hash_not_derived_from_manifest" };
  }

  return {
    context: Object.freeze({
      transaction_hash: storedTxHash,
      prepared_intent_hash: descriptor.prepared_intent_hash,
      recovery_policy_hash: descriptor.recovery_policy_hash,
      checkpoint_event_hash: descriptor.checkpoint_event_hash,
      before_hash: intent.before_hash,
      // The verified intent itself: a live recovery path must restore FROM the
      // bytes this function proved, never from a separately-located copy.
      intent,
    }),
  };
}

/**
 * The ONE authoritative rollback context for live recovery.
 *
 * A recovery path that located the intent itself would be a second, weaker
 * validator — and the weaker one becomes the real policy the moment they drift.
 * This reads the descriptor from disk and runs the exact validation replay uses,
 * so the live writer and the replay verifier can never disagree about what
 * "before" means.
 *
 * @returns {Promise<{ok:true, context:object}|{ok:false, reason:string}>}
 */
export async function readRollbackBindingContext({
  demaHome, transactionId, expectedHeadEventHash = null,
} = {}) {
  if (typeof transactionId !== "string" || !TX_ID_RE.test(transactionId)) {
    return Object.freeze({ ok: false, reason: "transaction_id_malformed" });
  }
  const home = resolveHome(demaHome);
  // ALWAYS from disk. A caller-supplied state is a hint about where the caller
  // believes the head was — never the source of descriptor, intent or event
  // authority. Accepting one would let a fabricated snapshot authorise a
  // restoration the disk does not support.
  const replayed = await replayClosureTransaction({ demaHome: home, transactionId });
  if (!replayed?.ok) {
    return Object.freeze({ ok: false, reason: replayed?.reason ?? "transaction_replay_refused" });
  }
  if (!replayed.exists) return Object.freeze({ ok: false, reason: "transaction_not_prepared" });
  const headMismatch = expectedHeadEventHash !== null
    && expectedHeadEventHash !== replayed.head_event_hash;

  let storedDescriptor = null;
  try {
    storedDescriptor = JSON.parse(
      await readFile(join(transactionDir(home, transactionId), "transaction.json"), "utf8"),
    );
  } catch {
    return Object.freeze({ ok: false, reason: "transaction_descriptor_unreadable" });
  }
  const derived = deriveRollbackBindingContext({
    descriptor: storedDescriptor, events: replayed.events, transactionId,
  });
  if (derived.error) {
    return Object.freeze({ ok: false, reason: derived.error, state: replayed, head_mismatch: headMismatch });
  }
  // The FRESH state travels with the context so callers cannot keep acting on
  // the stale snapshot they arrived with.
  return Object.freeze({
    ok: true, context: derived.context, state: replayed, head_mismatch: headMismatch,
  });
}

/**
 * The ONE restoration-evidence validator. Used by append-time validation and by
 * replay-time semantic validation — two copies would drift, and the copy that
 * drifted looser would become the real policy.
 *
 * @param evidenceRefs        the event's evidence_refs
 * @param descriptorIntentHash prepared_intent_hash from transaction.json
 * @param intentBindings      re-derived from the durable intent event
 * @returns {string|null} refusal reason, or null when acceptable
 */
function validateRestorationEvidence(evidenceRefs, context) {
  if (!Array.isArray(evidenceRefs) || evidenceRefs.length !== 1) {
    return "restoration_evidence_not_exactly_one";
  }
  const ev = evidenceRefs[0];
  if (!ev || typeof ev !== "object" || Array.isArray(ev)) return "restoration_evidence_not_object";
  if (ev.schema !== BEFORE_STATE_VERIFIED_EVIDENCE_SCHEMA) return "restoration_evidence_schema_mismatch";

  // Exact key set — no unknown key, no missing key.
  const keys = Object.keys(ev);
  if (keys.length !== RESTORATION_EVIDENCE_KEYS.length) return "restoration_evidence_shape_mismatch";
  for (const k of RESTORATION_EVIDENCE_KEYS) {
    if (!Object.hasOwn(ev, k)) return `restoration_evidence_missing_field:${k}`;
  }
  for (const k of keys) {
    if (!RESTORATION_EVIDENCE_KEYS.includes(k)) return `restoration_evidence_unknown_field:${k}`;
  }
  // Primitives only — no nested object or array may ride inside a receipt.
  for (const k of keys) {
    const v = ev[k];
    if (v !== null && typeof v === "object") return `restoration_evidence_nonprimitive:${k}`;
  }

  if (ev.restoration_verified !== true) return "restoration_not_verified";
  if (!RAW_SHA256_RE.test(ev.before_hash)) return "restoration_before_hash_format";
  if (!RAW_SHA256_RE.test(ev.restored_hash)) return "restoration_restored_hash_format";
  if (!TAGGED_SHA256_RE.test(ev.prepared_intent_hash)) return "restoration_prepared_intent_hash_format";
  if (ev.restored_hash !== ev.before_hash) return "restored_hash_ne_before_hash";
  if (!RESTORATION_RECOVERY_MODES.includes(ev.recovery_mode)) return "restoration_recovery_mode_unknown";
  if (ev.undo_success_pct !== 100) return "restoration_undo_success_pct_invalid";

  // Cross-binding: agreement with itself is not evidence. The context is fully
  // validated or absent — there is no "binding present but optional" state.
  if (!context) return "restoration_binding_context_unavailable";
  if (ev.prepared_intent_hash !== context.prepared_intent_hash) {
    return "restoration_prepared_intent_hash_mismatch";
  }
  if (ev.before_hash !== context.before_hash) return "restoration_before_hash_not_bound_to_intent";
  return null;
}

// ── C4B2A HARDENING — EXACT ROLLBACK EVIDENCE ──
// Immutable evidence carries bounded CODES, never exception text. A raw
// `err.message` can embed absolute paths, operand bytes or stack fragments, and
// an immutable event is exactly the artifact you cannot redact afterwards.
//
// These schemas are validated at append AND replay, but only when a ref
// actually claims one of them: chains written before they existed carry other
// shapes and must stay replayable forever.
// v2, not v1: this shape's KEY SET changed when the premature terminal freeze
// was replaced by (recovery_objective, rollback_success_outcome,
// recovery_fallback_outcome). A schema name is a contract, and mutating its keys
// while keeping its version is the silent drift this estate keeps paying for.
// Safe to renumber rather than dual-alias because nothing carrying the v1 shape
// was ever published — no committed fixture or durable chain references it.
export const CORRIDOR_ROLLBACK_STARTED_EVIDENCE_SCHEMA =
  "bizra.dema.corridor_rollback_started_evidence.v2";
export const CORRIDOR_ROLLBACK_COMPLETED_EVIDENCE_SCHEMA =
  "bizra.dema.corridor_rollback_completed_evidence.v1";
export const CORRIDOR_ROLLBACK_RECOVERY_EVIDENCE_SCHEMA =
  "bizra.dema.corridor_rollback_recovery_evidence.v1";
export const CORRIDOR_ROLLBACK_TERMINAL_EVIDENCE_SCHEMA =
  "bizra.dema.corridor_rollback_terminal_evidence.v1";

export const ROLLBACK_FAILURE_STAGES = Object.freeze([
  "EFFECT_APPLY", "EFFECT_APPLIED_PERSISTENCE", "MECHANICAL_FINALIZE",
  "VERIFICATION_PERSISTENCE", "SEAL_PERSISTENCE", "UNKNOWN",
]);

export const ROLLBACK_FAILURE_REASON_CODES = Object.freeze([
  "EFFECT_FAILED", "VERIFICATION_FAILED", "RESTORATION_FAILED",
  "ADAPTER_INCOMPLETE", "AUTHORITY_MISMATCH", "EVENT_PERSISTENCE_FAILED",
  "DURABILITY_UNCERTAIN", "UNKNOWN",
]);

export const ROLLBACK_RESTORATION_REASON_CODES = Object.freeze([
  "RESTORATION_NOT_ATTEMPTED", "RESTORATION_WORLD_UNRECOGNISED",
  "RESTORATION_HASH_MISMATCH", "RESTORATION_INVERSE_FAILED",
  "RESTORATION_BACKWARD_FAILED", "RESTORATION_IDENTITY_MISMATCH",
  "RESTORATION_OBSERVATION_FAILED", "RESTORATION_UNAVAILABLE", "UNKNOWN",
]);

// The only terminals a VERIFIED rollback may carry.
export const ROLLBACK_TERMINAL_OUTCOMES = Object.freeze([
  "EXECUTION_FAILED_ROLLED_BACK",
  "VERIFICATION_FAILED_ROLLED_BACK",
  "SEAL_FAILED_NO_COMPLETE",
]);

// ── FREEZE THE CAUSE. MEASURE THE RECOVERY. ──
// An earlier design froze a single `intended_terminal_outcome` at
// ROLLBACK_STARTED and then demanded that a qualified RECOVERY_REQUIRED chain
// had already intended RECOVERY_REQUIRED. That is impossible by construction:
// whether restoration succeeds is not known when the adjudication is written.
//
// What may be frozen is the CAUSE and the OBJECTIVE, plus the two outcomes the
// measurement can select between. The recovery result itself is measured, and
// may degrade monotonically from "rollback intended" to "human needed" — never
// the other way.
export const ROLLBACK_RECOVERY_OBJECTIVES = Object.freeze(["RESTORE_EXACT_BEFORE_STATE"]);
export const ROLLBACK_FALLBACK_OUTCOME = "RECOVERY_REQUIRED";

const ROLLBACK_STARTED_KEYS = Object.freeze([
  "schema", "transaction_hash", "prepared_intent_hash",
  "failure_stage", "failure_reason_code",
  "recovery_objective", "rollback_success_outcome", "recovery_fallback_outcome",
]);
const ROLLED_BACK_KEYS = Object.freeze([
  "schema", "prepared_intent_hash", "before_hash", "restored_hash", "recovery_mode",
]);
const ROLLBACK_RECOVERY_KEYS = Object.freeze([
  "schema", "prepared_intent_hash", "failure_reason_code", "restoration_reason_code",
]);
const ROLLBACK_TERMINAL_KEYS = Object.freeze([
  "schema", "prepared_intent_hash", "terminal_outcome",
]);

/** Exact shape, primitives only — the same discipline as restoration evidence. */
function validateExactEvidence(refs, schema, keys, checks) {
  if (!Array.isArray(refs) || refs.length !== 1) return `${schema}:not_exactly_one`;
  const ev = refs[0];
  if (!ev || typeof ev !== "object" || Array.isArray(ev)) return `${schema}:not_object`;
  const present = Object.keys(ev);
  if (present.length !== keys.length) return `${schema}:shape_mismatch`;
  for (const k of keys) if (!Object.hasOwn(ev, k)) return `${schema}:missing_field:${k}`;
  for (const k of present) {
    if (!keys.includes(k)) return `${schema}:unknown_field:${k}`;
    const v = ev[k];
    if (v !== null && typeof v === "object") return `${schema}:nonprimitive:${k}`;
  }
  return checks(ev);
}

/** A phase's refs claim a rollback schema only if one of them says so. */
const claimsSchema = (refs, schema) =>
  Array.isArray(refs) && refs.some((r) => r?.schema === schema);

export function validateRollbackStartedEvidence(refs, context) {
  return validateExactEvidence(refs, CORRIDOR_ROLLBACK_STARTED_EVIDENCE_SCHEMA, ROLLBACK_STARTED_KEYS, (ev) => {
    if (!TAGGED_SHA256_RE.test(ev.transaction_hash)) return "rollback_started_transaction_hash_format";
    if (!TAGGED_SHA256_RE.test(ev.prepared_intent_hash)) return "rollback_started_prepared_intent_hash_format";
    if (!ROLLBACK_FAILURE_STAGES.includes(ev.failure_stage)) return "rollback_started_failure_stage_unknown";
    if (!ROLLBACK_FAILURE_REASON_CODES.includes(ev.failure_reason_code)) return "rollback_started_reason_code_unknown";
    if (!ROLLBACK_RECOVERY_OBJECTIVES.includes(ev.recovery_objective)) {
      return "rollback_started_recovery_objective_unknown";
    }
    // The success outcome is CONDITIONAL on exact restoration, so it may only be
    // one of the three rollback terminals — never RECOVERY_REQUIRED, which is
    // what the measurement selects when restoration does not hold.
    if (!ROLLBACK_TERMINAL_OUTCOMES.includes(ev.rollback_success_outcome)) {
      return "rollback_started_success_outcome_unknown";
    }
    if (ev.recovery_fallback_outcome !== ROLLBACK_FALLBACK_OUTCOME) {
      return "rollback_started_fallback_outcome_invalid";
    }
    if (!context) return null;
    if (ev.transaction_hash !== context.transaction_hash) return "rollback_started_transaction_hash_mismatch";
    if (ev.prepared_intent_hash !== context.prepared_intent_hash) return "rollback_started_prepared_intent_hash_mismatch";
    return null;
  });
}

export function validateRolledBackEvidence(refs, context) {
  return validateExactEvidence(refs, CORRIDOR_ROLLBACK_COMPLETED_EVIDENCE_SCHEMA, ROLLED_BACK_KEYS, (ev) => {
    if (!TAGGED_SHA256_RE.test(ev.prepared_intent_hash)) return "rolled_back_prepared_intent_hash_format";
    if (!RAW_SHA256_RE.test(ev.before_hash)) return "rolled_back_before_hash_format";
    if (!RAW_SHA256_RE.test(ev.restored_hash)) return "rolled_back_restored_hash_format";
    if (ev.restored_hash !== ev.before_hash) return "rolled_back_restored_hash_ne_before_hash";
    if (!RESTORATION_RECOVERY_MODES.includes(ev.recovery_mode)) return "rolled_back_recovery_mode_unknown";
    if (!context) return null;
    if (ev.prepared_intent_hash !== context.prepared_intent_hash) return "rolled_back_prepared_intent_hash_mismatch";
    if (ev.before_hash !== context.before_hash) return "rolled_back_before_hash_not_bound_to_intent";
    return null;
  });
}

export function validateRollbackRecoveryEvidence(refs, context) {
  return validateExactEvidence(refs, CORRIDOR_ROLLBACK_RECOVERY_EVIDENCE_SCHEMA, ROLLBACK_RECOVERY_KEYS, (ev) => {
    if (!TAGGED_SHA256_RE.test(ev.prepared_intent_hash)) return "rollback_recovery_prepared_intent_hash_format";
    if (!ROLLBACK_FAILURE_REASON_CODES.includes(ev.failure_reason_code)) return "rollback_recovery_reason_code_unknown";
    if (!ROLLBACK_RESTORATION_REASON_CODES.includes(ev.restoration_reason_code)) {
      return "rollback_recovery_restoration_code_unknown";
    }
    if (context && ev.prepared_intent_hash !== context.prepared_intent_hash) {
      return "rollback_recovery_prepared_intent_hash_mismatch";
    }
    return null;
  });
}

export function validateRollbackTerminalEvidence(refs, context, expectedOutcome = null) {
  return validateExactEvidence(refs, CORRIDOR_ROLLBACK_TERMINAL_EVIDENCE_SCHEMA, ROLLBACK_TERMINAL_KEYS, (ev) => {
    if (!TAGGED_SHA256_RE.test(ev.prepared_intent_hash)) return "rollback_terminal_prepared_intent_hash_format";
    if (!TERMINAL_OUTCOMES.includes(ev.terminal_outcome)) return "rollback_terminal_outcome_unknown";
    // The receipt may not disagree with the event it settles.
    if (expectedOutcome !== null && ev.terminal_outcome !== expectedOutcome) {
      return "rollback_terminal_outcome_ne_event_outcome";
    }
    if (context && ev.prepared_intent_hash !== context.prepared_intent_hash) {
      return "rollback_terminal_prepared_intent_hash_mismatch";
    }
    return null;
  });
}

// ── APPEND POLICY IS NOT REPLAY POLICY ──
// Compatibility belongs to replay; strictness belongs to writers. A NEW writer
// must never obtain legacy privileges by OMITTING the schema that would have
// constrained it, so the PHASE — and for RESOLVED the terminal outcome — decides
// whether the current evidence law applies. The evidence never gets a vote on
// whether it is going to be checked.
const ROLLBACK_PHASE_EVIDENCE = Object.freeze({
  ROLLBACK_STARTED: [CORRIDOR_ROLLBACK_STARTED_EVIDENCE_SCHEMA, validateRollbackStartedEvidence],
  ROLLED_BACK: [CORRIDOR_ROLLBACK_COMPLETED_EVIDENCE_SCHEMA, validateRolledBackEvidence],
  BEFORE_STATE_VERIFIED: [BEFORE_STATE_VERIFIED_EVIDENCE_SCHEMA, validateRestorationEvidence],
  RECOVERY_REQUIRED: [CORRIDOR_ROLLBACK_RECOVERY_EVIDENCE_SCHEMA, validateRollbackRecoveryEvidence],
});

/** RESOLVED outcomes that are rollback claims and so need rollback evidence. */
const ROLLBACK_RESOLVED_OUTCOMES = Object.freeze([
  ...ROLLBACK_TERMINAL_OUTCOMES, "RECOVERY_REQUIRED",
]);

/** Does this write fall under the current rollback evidence law? Phase decides. */
export function appendRequiresRollbackEvidence(phase, terminalOutcome = null) {
  if (Object.hasOwn(ROLLBACK_PHASE_EVIDENCE, phase)) return true;
  return phase === "RESOLVED" && ROLLBACK_RESOLVED_OUTCOMES.includes(terminalOutcome);
}

/**
 * The strict law for NEW rollback writes. Unconditional: an absent, wrong,
 * legacy, duplicated or padded evidence array is a refusal, not a fallback.
 */
export function validateRollbackEvidenceForAppend({
  phase, terminalOutcome = null, evidenceRefs, context, events = null,
} = {}) {
  const entry = ROLLBACK_PHASE_EVIDENCE[phase];
  if (entry) return entry[1](evidenceRefs, context);
  if (phase === "RESOLVED" && ROLLBACK_RESOLVED_OUTCOMES.includes(terminalOutcome)) {
    const invalid = validateRollbackTerminalEvidence(evidenceRefs, context, terminalOutcome);
    if (invalid !== null) return invalid;
    // A rollback terminal must equal one of the two outcomes the FIRST
    // adjudication froze — the conditional success one, or the fallback.
    if (Array.isArray(events)) {
      const started = events.find((e) => e.phase === "ROLLBACK_STARTED");
      if (!started) return "rollback_terminal_without_adjudication";
      const bad = validateRollbackStartedEvidence(started.evidence_refs, context);
      if (bad !== null) return bad;
      const adj = started.evidence_refs[0];
      const permitted = terminalOutcome === ROLLBACK_FALLBACK_OUTCOME
        ? adj.recovery_fallback_outcome
        : adj.rollback_success_outcome;
      if (terminalOutcome !== permitted) return "rollback_terminal_ne_durable_adjudication";
    }
  }
  return null;
}

/**
 * A chain is CURRENT once it carries any C4B2A marker. From that point every
 * rollback phase in it must satisfy the current law — one current marker must
 * never let the remaining phases fall back to legacy interpretation, which is
 * exactly how a half-legacy chain would launder itself into qualification.
 */
function isCurrentRollbackChain(events) {
  const schemas = [
    ...Object.values(ROLLBACK_PHASE_EVIDENCE).map(([schema]) => schema),
    CORRIDOR_ROLLBACK_TERMINAL_EVIDENCE_SCHEMA,
  ];
  return events.some((e) =>
    e.phase === "BEFORE_STATE_VERIFIED"
    || schemas.some((schema) => claimsSchema(e.evidence_refs, schema)));
}

// Success is not a phase you may assert — it is a position in the chain. The
// ledger may commit and the anchor still fail; only ANCHORED has proven the
// receipt chain was not erased.
const COMPLETED_VERIFIED_PREDECESSOR = "ANCHORED";

// ── TERMINAL PREDECESSOR LAW — NEW APPENDS ONLY ──
// A terminal outcome is a claim about how the transaction ended, so the phase it
// settles FROM is part of that claim: "rolled back" is only true if a
// restoration proof precedes it. These rules bind the writer.
//
// They are deliberately NOT enforced during replay. Chains settled before
// BEFORE_STATE_VERIFIED existed carry a direct ROLLED_BACK → RESOLVED edge and
// are immutable history; enforcing a newer, stricter law against them would
// retroactively invalidate honest receipts. Same split, same reason, as
// TX_APPEND_TRANSITIONS.
const TERMINAL_OUTCOME_APPEND_PREDECESSORS = Object.freeze({
  COMPLETED_VERIFIED: COMPLETED_VERIFIED_PREDECESSOR,
  EXECUTION_FAILED_ROLLED_BACK: "BEFORE_STATE_VERIFIED",
  VERIFICATION_FAILED_ROLLED_BACK: "BEFORE_STATE_VERIFIED",
  RECOVERY_REQUIRED: "RECOVERY_REQUIRED",
});

// SEAL_FAILED_NO_COMPLETE is conditional: it is a rollback claim only when the
// transaction actually crossed the effect boundary. A seal that failed before
// any world change has nothing to have rolled back, and must keep settling
// directly.
const crossedEffectBoundary = (events) => events.some((e) => e.phase === "EFFECT_APPLIED");

function requiredTerminalPredecessor(terminalOutcome, events) {
  if (Object.hasOwn(TERMINAL_OUTCOME_APPEND_PREDECESSORS, terminalOutcome)) {
    return TERMINAL_OUTCOME_APPEND_PREDECESSORS[terminalOutcome];
  }
  if (terminalOutcome === "SEAL_FAILED_NO_COMPLETE" && crossedEffectBoundary(events)) {
    return "BEFORE_STATE_VERIFIED";
  }
  return null;
}

// transaction_id becomes a directory name. Anything that could climb out of the
// store is refused before it is ever joined to a path.
const TX_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const EVENT_FILE_RE = /^(\d{6})\.json$/;
const TEMP_FILE_RE = /^\.tmp-[A-Za-z0-9._-]+$/;
const RAW_SHA256_RE = /^[0-9a-f]{64}$/;
const TAGGED_SHA256_RE = /^sha256:[0-9a-f]{64}$/;
const EVENT_FIELDS = Object.freeze([
  "schema", "domain", "canonicalization", "transaction_id", "sequence",
  "phase", "terminal_outcome", "previous_event_hash", "consent_claim_hash",
  "transaction_hash", "evidence_refs", "at_iso", "semantic_evidence_hash",
  "event_hash",
]);
const EVENT_FIELDS_SORTED = Object.freeze([...EVENT_FIELDS].sort());

const sha256 = (s) => "sha256:" + createHash("sha256").update(s).digest("hex");

function resolveHome(demaHome) {
  if (typeof demaHome === "string" && demaHome.length > 0) return demaHome;
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

const transactionDir = (home, txId) => join(home, MISSION_CLOSURE_TX_RELDIR, txId);
const eventsDirOf = (home, txId) => join(transactionDir(home, txId), "events");
const eventName = (seq) => `${String(seq).padStart(6, "0")}.json`;

const refuse = (reason, extra = {}) => Object.freeze({ ok: false, reason, ...extra });

/** Descriptor body, derived ENTIRELY from the immutable claim. */
function descriptorBody(claim) {
  return {
    schema: MISSION_CLOSURE_TX_SCHEMA,
    domain: MISSION_CLOSURE_TX_DOMAIN,
    canonicalization: CANONICALIZATION,
    transaction_id: claim.transaction_id,
    consent_claim_hash: claim.claim_hash,
    nonce_digest: claim.nonce_digest,
    mission_id: claim.mission_id ?? null,
    contract_hash: claim.contract_hash ?? null,
    consent_context_hash: claim.consent_context_hash ?? null,
    checkpoint_event_hash: claim.checkpoint_event_hash ?? null,
    action_kind: claim.action_kind ?? null,
    action_class: claim.action_class ?? null,
    prepared_intent_hash: claim.prepared_intent_hash ?? null,
    recovery_policy_hash: claim.recovery_policy_hash ?? null,
    claimed_at_iso: claim.claimed_at_iso ?? null,
  };
}

const hashDescriptor = (body) => sha256(MISSION_CLOSURE_TX_DOMAIN + "\0" + canonicalizeJsonV1(body));

/**
 * Authority- and evidence-bearing fields ONLY. at_iso is excluded on purpose:
 * two workers racing the identical transition read different clocks, and byte
 * equality would make the idempotent path unreachable — every benign race would
 * escalate as a conflict.
 */
function semanticBody(e) {
  return {
    domain: e.domain,
    transaction_id: e.transaction_id,
    sequence: e.sequence,
    phase: e.phase,
    terminal_outcome: e.terminal_outcome,
    previous_event_hash: e.previous_event_hash,
    consent_claim_hash: e.consent_claim_hash,
    transaction_hash: e.transaction_hash,
    evidence_refs: e.evidence_refs,
  };
}

const hashSemantic = (e) =>
  sha256(MISSION_CLOSURE_TX_EVENT_DOMAIN + ":SEM\0" + canonicalizeJsonV1(semanticBody(e)));

const hashEvent = (e) => {
  const { event_hash: _drop, ...rest } = e;
  return sha256(MISSION_CLOSURE_TX_EVENT_DOMAIN + "\0" + canonicalizeJsonV1(rest));
};

const canonicalErrorCode = (err) =>
  typeof err?.code === "string" && err.code.length > 0 ? err.code : "canonicalization_failed";

function isCanonicalIso(value) {
  if (typeof value !== "string") return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function validateStoredEvent(body, {
  transactionId,
  sequence,
  previousEventHash,
  bindings = null,
} = {}) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return "event_shape_mismatch";
  }
  let keys;
  try {
    keys = Object.keys(body).sort();
  } catch {
    return "event_shape_mismatch";
  }
  if (keys.length !== EVENT_FIELDS_SORTED.length
    || keys.some((key, index) => key !== EVENT_FIELDS_SORTED[index])) {
    return "event_shape_mismatch";
  }
  if (body.schema !== MISSION_CLOSURE_TX_EVENT_SCHEMA) return "event_schema_mismatch";
  if (body.domain !== MISSION_CLOSURE_TX_EVENT_DOMAIN) return "event_domain_mismatch";
  if (body.canonicalization !== CANONICALIZATION) return "event_canonicalization_mismatch";
  if (body.transaction_id !== transactionId || !TX_ID_RE.test(body.transaction_id)) {
    return "event_transaction_id_mismatch";
  }
  if (!Number.isInteger(body.sequence) || body.sequence < 0 || body.sequence !== sequence) {
    return "event_sequence_filename_mismatch";
  }
  if (!Object.hasOwn(TX_TRANSITIONS, body.phase)) return "event_phase_unknown";
  if (body.phase === "RESOLVED") {
    if (!TERMINAL_OUTCOMES.includes(body.terminal_outcome)) return "event_terminal_outcome_invalid";
  } else if (body.terminal_outcome !== null) {
    return "event_terminal_outcome_on_nonterminal_phase";
  }
  if (body.previous_event_hash !== previousEventHash) return "event_previous_hash_broken";
  if (sequence === 0) {
    if (body.previous_event_hash !== null) return "event_previous_hash_invalid";
  } else if (!TAGGED_SHA256_RE.test(body.previous_event_hash)) {
    return "event_previous_hash_invalid";
  }
  if (!RAW_SHA256_RE.test(body.consent_claim_hash)) return "event_consent_claim_hash_invalid";
  if (!TAGGED_SHA256_RE.test(body.transaction_hash)) return "event_transaction_hash_invalid";
  if (!Array.isArray(body.evidence_refs)) return "event_evidence_refs_invalid";
  if (!isCanonicalIso(body.at_iso)) return "event_at_iso_invalid";
  if (!TAGGED_SHA256_RE.test(body.semantic_evidence_hash)) {
    return "event_semantic_evidence_hash_invalid";
  }
  if (!TAGGED_SHA256_RE.test(body.event_hash)) return "event_hash_invalid";
  if (bindings
    && (body.consent_claim_hash !== bindings.consent_claim_hash
      || body.transaction_hash !== bindings.transaction_hash)) {
    return "event_binding_mismatch";
  }
  try {
    if (hashSemantic(body) !== body.semantic_evidence_hash) {
      return "semantic_evidence_hash_mismatch";
    }
    if (hashEvent(body) !== body.event_hash) return "event_hash_mismatch";
  } catch (err) {
    return `event_canonicalization_invalid:${canonicalErrorCode(err)}`;
  }
  return null;
}

function validateAppendProposal({
  expectedSequence,
  expectedPreviousEventHash,
  phase,
  terminalOutcome,
  evidenceRefs,
  atIso,
}) {
  if (!Number.isInteger(expectedSequence) || expectedSequence < 0) return "expected_sequence_invalid";
  if (expectedSequence === 0) {
    if (expectedPreviousEventHash !== null) return "expected_previous_event_hash_invalid";
  } else if (typeof expectedPreviousEventHash !== "string"
    || !TAGGED_SHA256_RE.test(expectedPreviousEventHash)) {
    return "expected_previous_event_hash_invalid";
  }
  if (!Object.hasOwn(TX_TRANSITIONS, phase)) return "phase_unknown";
  if (phase === "RESOLVED") {
    if (!TERMINAL_OUTCOMES.includes(terminalOutcome)) return "terminal_outcome_required";
  } else if (terminalOutcome !== null) {
    return "terminal_outcome_on_nonterminal_phase";
  }
  if (!Array.isArray(evidenceRefs)) return "event_candidate_invalid:evidence_refs_invalid";
  if (atIso !== undefined && !isCanonicalIso(atIso)) return "event_candidate_invalid:at_iso_invalid";
  try {
    canonicalizeJsonV1(evidenceRefs);
  } catch (err) {
    return `event_candidate_invalid:${canonicalErrorCode(err)}`;
  }
  return null;
}

/**
 * Someone already holds this sequence. Whether that is our own completed work
 * or a competing decision is settled ONLY by semantic equality — the one place
 * that question is answered, for both the in-flight race and the crash retry.
 */
function settleAgainstPublished(published, candidate) {
  let publishedSemantic;
  try {
    publishedSemantic = hashSemantic(published);
  } catch (err) {
    return {
      appended: false,
      reason: `event_published_winner_invalid:event_canonicalization_invalid:${canonicalErrorCode(err)}`,
      escalate_to_human: true,
    };
  }
  if (published?.semantic_evidence_hash !== publishedSemantic) {
    return {
      appended: false,
      reason: "event_published_winner_invalid:semantic_evidence_hash_mismatch",
      escalate_to_human: true,
    };
  }
  let candidateSemantic;
  try {
    candidateSemantic = hashSemantic(candidate);
  } catch (err) {
    return {
      appended: false,
      reason: `event_candidate_invalid:${canonicalErrorCode(err)}`,
    };
  }
  if (published.semantic_evidence_hash === candidateSemantic) {
    return {
      appended: false, reason: "already_applied_idempotently",
      idempotent: true, event: Object.freeze(published),
    };
  }
  return {
    appended: false, reason: "transaction_transition_conflict",
    escalate_to_human: true, winner_phase: published.phase,
  };
}

function withCleanupFailure(result, cleanupFailure) {
  return cleanupFailure ? { ...result, cleanup_failure: cleanupFailure } : result;
}

/** fsync a path; a directory handle is how the link itself is made durable. */
async function fsyncPath(path) {
  const fh = await open(path, "r");
  try {
    await fh.sync();
  } finally {
    await fh.close();
  }
}

const DEFAULT_PUBLICATION_OPS = Object.freeze({
  linkFile: link,
  unlinkTemp: unlink,
  fsyncDir: fsyncPath,
});

/**
 * Publish bytes at `finalPath` with no-replace semantics, or refuse.
 * @returns {Promise<{published:true}|{published:false, reason:string}>}
 */
async function publishNoReplace(dir, finalPath, bytes, ops = DEFAULT_PUBLICATION_OPS) {
  const temp = join(dir, `.tmp-${randomUUID()}`);
  try {
    const fh = await open(temp, "wx", 0o600);
    try {
      await fh.writeFile(bytes);
      await fh.sync();
    } finally {
      await fh.close();
    }
  } catch (err) {
    return { published: false, reason: `event_temp_write_failed:${err?.code ?? "unknown"}` };
  }

  let result;
  try {
    await ops.linkFile(temp, finalPath);
    try {
      await ops.fsyncDir(dir);
      result = { published: true, durable: true };
    } catch (err) {
      result = {
        published: true,
        durable: false,
        reason: `event_publication_durability_uncertain:${err?.code ?? "unknown"}`,
        durability_uncertain: true,
        canonical_event_visible: true,
        effect_retry_forbidden: true,
        replay_required: true,
      };
    }
  } catch (err) {
    if (err?.code === "EEXIST") {
      try {
        await ops.fsyncDir(dir);
        result = { published: false, durable: true, reason: "event_already_published" };
      } catch (syncErr) {
        result = {
          published: false,
          durable: false,
          reason: `event_publication_durability_uncertain:${syncErr?.code ?? "unknown"}`,
          durability_uncertain: true,
          canonical_event_visible: true,
          effect_retry_forbidden: true,
          replay_required: true,
        };
      }
    } else {
      result = {
        published: false,
        durable: false,
        reason: `event_publication_unavailable:${err?.code ?? "unknown"}`,
      };
    }
  }

  try {
    await ops.unlinkTemp(temp);
  } catch (err) {
    result.cleanup_failure = `event_temp_cleanup_failed:${err?.code ?? "unknown"}`;
  }
  return result;
}

/**
 * Read the whole history and derive the current phase from disk ALONE.
 *
 * Fails closed on anything it cannot fully verify: a torn event, an alien file,
 * a broken hash link. A history that cannot be proven is never partially
 * trusted, because the next append would build on an unproven head.
 */
export async function replayClosureTransaction({ demaHome, transactionId } = {}) {
  if (typeof transactionId !== "string" || !TX_ID_RE.test(transactionId)) {
    return refuse("transaction_id_malformed", { escalate_to_human: false });
  }
  const home = resolveHome(demaHome);
  const dir = eventsDirOf(home, transactionId);

  let entries;
  try {
    entries = await readdir(dir);
  } catch (err) {
    if (err?.code === "ENOENT") {
      // Absent is a legitimate state: the claim may exist with no transaction yet.
      return Object.freeze({
        ok: true, exists: false, sequence: -1, phase: null,
        head_event_hash: null, terminal: false, events: Object.freeze([]),
      });
    }
    return refuse(`events_dir_unreadable:${err?.code ?? "unknown"}`, { escalate_to_human: true });
  }

  const seqs = [];
  for (const name of entries) {
    if (TEMP_FILE_RE.test(name)) continue; // abandoned publication attempt — never evidence
    // String.match rather than the regex method of the same name as the shell
    // call: identical result for this non-global regex, and it keeps the
    // actuator gate's shell-invocation scan free of a false positive.
    const m = name.match(EVENT_FILE_RE);
    if (!m) {
      return refuse("events_dir_unexpected_entry", { escalate_to_human: true, entry: name });
    }
    seqs.push(Number(m[1]));
  }
  seqs.sort((a, b) => a - b);

  const events = [];
  let previous = null;
  let bindings = null;
  for (let i = 0; i < seqs.length; i += 1) {
    if (seqs[i] !== i) return refuse("event_sequence_gap", { escalate_to_human: true, expected: i, found: seqs[i] });

    const path = join(dir, eventName(i));
    let body;
    try {
      body = JSON.parse(await readFile(path, "utf8"));
    } catch {
      // A torn or edited event. The bytes stay exactly as found — repairing an
      // immutable event in place would destroy the only evidence of the crash.
      return refuse("event_unparseable", {
        escalate_to_human: true, terminal_outcome: "RECOVERY_REQUIRED", sequence: i,
      });
    }
    const invalid = validateStoredEvent(body, {
      transactionId,
      sequence: i,
      previousEventHash: previous,
      bindings,
    });
    if (invalid) return refuse(invalid, { escalate_to_human: true, sequence: i });
    if (i === 0 && body.phase !== "PREPARED") {
      return refuse("first_event_not_prepared", { escalate_to_human: true });
    }
    if (i > 0 && !TX_TRANSITIONS[events[i - 1].phase]?.includes(body.phase)) {
      return refuse("illegal_phase_in_history", { escalate_to_human: true, sequence: i });
    }
    if (body.phase === "RESOLVED"
      && body.terminal_outcome === "COMPLETED_VERIFIED"
      && events[i - 1]?.phase !== COMPLETED_VERIFIED_PREDECESSOR) {
      return refuse("completed_verified_requires_anchored", { escalate_to_human: true, sequence: i });
    }
    if (bindings === null) {
      bindings = Object.freeze({
        consent_claim_hash: body.consent_claim_hash,
        transaction_hash: body.transaction_hash,
      });
    }
    previous = body.event_hash;
    events.push(Object.freeze(body));
  }

  // ── SECOND PASS: PHASE-SPECIFIC SEMANTIC VALIDATION ──
  // The loop above proved the bytes are intact and the chain is well-formed. It
  // did NOT prove a restoration reference points at the right world. Stored
  // history is authoritative after restart, so a forged BEFORE_STATE_VERIFIED
  // event with a correctly recomputed event hash would otherwise replay clean.
  // Runs only when that phase is present, so historical chains without it —
  // including legacy direct ROLLED_BACK → RESOLVED — are untouched.
  // Runs when a restoration proof exists, or when any event CLAIMS one of the
  // C4B2A rollback schemas. Keyed on the claim rather than on the phase, so a
  // pre-C4B2A chain carrying a rollback phase with some other evidence shape is
  // never retroactively invalidated.
  const needsRollbackBinding = isCurrentRollbackChain(events);
  if (needsRollbackBinding) {
    // The descriptor is read only on this path, so ordinary replays pay nothing.
    let storedDescriptor = null;
    try {
      storedDescriptor = JSON.parse(
        await readFile(join(transactionDir(home, transactionId), "transaction.json"), "utf8"),
      );
    } catch {
      return refuse("transaction_descriptor_unreadable", { escalate_to_human: true });
    }
    const derived = deriveRollbackBindingContext({
      descriptor: storedDescriptor, events, transactionId,
    });
    if (derived.error) {
      return refuse(derived.error, { escalate_to_human: true });
    }
    // Every rollback phase in a CURRENT chain is held to the current law —
    // unconditionally, exactly as the writer was.
    for (let i = 0; i < events.length; i += 1) {
      const invalid = validateRollbackEvidenceForAppend({
        phase: events[i].phase,
        terminalOutcome: events[i].terminal_outcome,
        evidenceRefs: events[i].evidence_refs,
        context: derived.context,
        events,
      });
      if (invalid !== null) return refuse(invalid, { escalate_to_human: true, sequence: i });
    }
  }

  const head = events[events.length - 1] ?? null;
  return Object.freeze({
    ok: true,
    exists: events.length > 0,
    sequence: events.length - 1,
    phase: head?.phase ?? null,
    terminal_outcome: head?.terminal_outcome ?? null,
    terminal: head?.phase === "RESOLVED",
    head_event_hash: head?.event_hash ?? null,
    consent_claim_hash: head?.consent_claim_hash ?? null,
    events: Object.freeze(events),
  });
}

/**
 * Classify a SETTLED transaction. Replay compatibility lets old history stay
 * readable; it does not let old, unproven history — or an unrelated terminal —
 * be promoted into a verified rollback.
 *
 * Exactly one class is returned, and only VERIFIED_ROLLBACK may ever be
 * reported to a caller as `rollback_verified: true`.
 *
 * @param context the authoritative binding context, or null when unavailable
 * @returns {"VERIFIED_ROLLBACK"|"RECOVERY_REQUIRED"|"LEGACY_UNQUALIFIED_ROLLBACK"
 *          |"FORWARD_COMPLETED"|"NON_ROLLBACK_TERMINAL"|"INVALID"}
 */
export function classifySettledMechanicalRecovery({ state, context = null } = {}) {
  if (!state?.ok || state.exists !== true || state.terminal !== true) return "INVALID";
  const phases = state.events.map((e) => e.phase);
  const outcome = state.terminal_outcome;

  // Forward completion is never a rollback, however the chain got there.
  if (outcome === "COMPLETED_VERIFIED") return "FORWARD_COMPLETED";

  if (outcome === "RECOVERY_REQUIRED") {
    // Position is not qualification. Before this may ever map to a corridor
    // STOPPED verdict it must carry the whole adjudicated chain: the exact
    // suffix, a bound context, and three exact evidence shapes.
    const suffix = phases.slice(-3);
    const shape = suffix.length === 3
      && suffix[0] === "ROLLBACK_STARTED"
      && suffix[1] === "RECOVERY_REQUIRED"
      && suffix[2] === "RESOLVED";
    if (!shape) {
      return phases.includes("ROLLED_BACK") ? "LEGACY_UNQUALIFIED_ROLLBACK" : "NON_ROLLBACK_TERMINAL";
    }
    if (!context) return "INVALID";
    const started = state.events.find((e) => e.phase === "ROLLBACK_STARTED");
    if (validateRollbackStartedEvidence(started?.evidence_refs, context) !== null) return "INVALID";
    // The fallback is what the measurement selects when restoration does not
    // hold. A chain that began intending EXECUTION_FAILED_ROLLED_BACK and then
    // measured a failed restoration settles here LAWFULLY — that is monotonic
    // degradation, not a divergent adjudication.
    if (started.evidence_refs[0].recovery_fallback_outcome !== outcome) return "INVALID";
    const flagged = state.events.find((e) => e.phase === "RECOVERY_REQUIRED");
    if (validateRollbackRecoveryEvidence(flagged?.evidence_refs, context) !== null) return "INVALID";
    const resolved = state.events[state.events.length - 1];
    if (validateRollbackTerminalEvidence(resolved.evidence_refs, context, "RECOVERY_REQUIRED") !== null) {
      return "INVALID";
    }
    return "RECOVERY_REQUIRED";
  }

  // The exact ordered suffix. Anything else that merely contains ROLLED_BACK is
  // pre-C4B1 history: still replayable, never eligible for corridor mapping.
  const suffix = phases.slice(-4);
  const qualifiedShape = suffix.length === 4
    && suffix[0] === "ROLLBACK_STARTED"
    && suffix[1] === "ROLLED_BACK"
    && suffix[2] === "BEFORE_STATE_VERIFIED"
    && suffix[3] === "RESOLVED";
  if (!qualifiedShape) {
    return phases.includes("ROLLED_BACK") ? "LEGACY_UNQUALIFIED_ROLLBACK" : "NON_ROLLBACK_TERMINAL";
  }
  if (!ROLLBACK_TERMINAL_OUTCOMES.includes(outcome)) return "NON_ROLLBACK_TERMINAL";

  // Shape alone is not qualification: the evidence must bind, and the settled
  // terminal must equal the outcome the FIRST adjudication froze.
  if (!context) return "INVALID";
  const started = state.events.find((e) => e.phase === "ROLLBACK_STARTED");
  if (validateRollbackStartedEvidence(started?.evidence_refs, context) !== null) return "INVALID";
  // A verified rollback must land on the outcome the adjudication reserved for
  // exact restoration — never on the fallback, never on something else.
  if (started.evidence_refs[0].rollback_success_outcome !== outcome) return "INVALID";
  const rolled = state.events.find((e) => e.phase === "ROLLED_BACK");
  if (validateRolledBackEvidence(rolled?.evidence_refs, context) !== null) return "INVALID";
  const restored = state.events.find((e) => e.phase === "BEFORE_STATE_VERIFIED");
  if (validateRestorationEvidence(restored?.evidence_refs, context) !== null) return "INVALID";
  const resolvedEvent = state.events[state.events.length - 1];
  if (validateRollbackTerminalEvidence(resolvedEvent.evidence_refs, context, outcome) !== null) {
    return "INVALID";
  }
  return "VERIFIED_ROLLBACK";
}

/** Descriptor must reproduce exactly from the claim; drift is corruption. */
function descriptorDrift(stored, expected) {
  return Object.keys(expected).filter((k) => stored?.[k] !== expected[k]);
}

/**
 * Establish (or recover) the transaction for an already-consumed claim.
 *
 * The claim is GENESIS: a crash between claim and first event is recoverable
 * because the claim itself carries the intent and the recovery policy. This
 * never creates, consumes, releases or reinterprets consent.
 */
async function openClosureTransactionWithPublicationOps(
  { claim, demaHome, atIso } = {},
  publicationOps = DEFAULT_PUBLICATION_OPS,
) {
  if (!claim || typeof claim !== "object") return refuse("claim_missing");
  if (typeof claim.claim_hash !== "string") return refuse("claim_hash_missing");
  const txId = claim.transaction_id;
  if (typeof txId !== "string" || !TX_ID_RE.test(txId)) return refuse("transaction_id_malformed");

  const home = resolveHome(demaHome);
  const dir = transactionDir(home, txId);
  const events = eventsDirOf(home, txId);
  const descPath = join(dir, "transaction.json");

  const body = descriptorBody(claim);
  const descriptor = { ...body, transaction_hash: hashDescriptor(body) };

  await mkdir(events, { recursive: true, mode: 0o700 });

  // Descriptor is immutable and created once. If one is already there it must
  // agree with the claim in every binding.
  let stored = null;
  try {
    stored = JSON.parse(await readFile(descPath, "utf8"));
  } catch (err) {
    if (err?.code !== "ENOENT") {
      return refuse("transaction_descriptor_unreadable", { escalate_to_human: true });
    }
  }
  if (stored === null) {
    await writeFile(descPath, `${JSON.stringify(descriptor, null, 2)}\n`, { flag: "wx", mode: 0o600 })
      .catch(() => {});
    stored = JSON.parse(await readFile(descPath, "utf8"));
  }
  const drift = descriptorDrift(stored, descriptor);
  if (drift.length > 0) {
    return refuse("transaction_binding_mismatch", {
      escalate_to_human: true, drifted_fields: Object.freeze(drift),
    });
  }

  const state = await replayClosureTransaction({ demaHome: home, transactionId: txId });
  if (!state.ok) return refuse(state.reason, { escalate_to_human: true });
  if (state.exists) {
    try {
      await publicationOps.fsyncDir(events);
    } catch (err) {
      return refuse(`event_publication_durability_uncertain:${err?.code ?? "unknown"}`, {
        durability_uncertain: true,
        canonical_event_visible: true,
        effect_retry_forbidden: true,
        replay_required: true,
        escalate_to_human: true,
      });
    }
    return Object.freeze({ ok: true, reason: "already_prepared", transaction: Object.freeze(stored), state });
  }

  const published = await writeEvent({
    home, txId, sequence: 0, phase: "PREPARED", terminalOutcome: null,
    previousEventHash: null, claimHash: claim.claim_hash,
    transactionHash: descriptor.transaction_hash, evidenceRefs: [], atIso,
  }, publicationOps);
  if (!published.appended) {
    const { appended: _appended, reason, ...details } = published;
    return refuse(reason, {
      ...details,
      escalate_to_human: Boolean(published.escalate_to_human),
    });
  }

  return Object.freeze({
    ok: true,
    reason: "prepared",
    transaction: Object.freeze(stored),
    event: published.event,
    ...(published.cleanup_failure ? { cleanup_failure: published.cleanup_failure } : {}),
  });
}

export async function openClosureTransaction(args = {}) {
  return openClosureTransactionWithPublicationOps(args);
}

/** Build, publish, and resolve the race for exactly one event. */
async function writeEvent(p, publicationOps = DEFAULT_PUBLICATION_OPS) {
  const event = {
    schema: MISSION_CLOSURE_TX_EVENT_SCHEMA,
    domain: MISSION_CLOSURE_TX_EVENT_DOMAIN,
    canonicalization: CANONICALIZATION,
    transaction_id: p.txId,
    sequence: p.sequence,
    phase: p.phase,
    terminal_outcome: p.terminalOutcome ?? null,
    previous_event_hash: p.previousEventHash,
    consent_claim_hash: p.claimHash,
    transaction_hash: p.transactionHash,
    evidence_refs: p.evidenceRefs ?? [],
    at_iso: p.atIso ?? new Date().toISOString(),
  };
  if (!Array.isArray(event.evidence_refs)) {
    return { appended: false, reason: "event_candidate_invalid:evidence_refs_invalid" };
  }
  if (!isCanonicalIso(event.at_iso)) {
    return { appended: false, reason: "event_candidate_invalid:at_iso_invalid" };
  }
  try {
    event.semantic_evidence_hash = hashSemantic(event);
    event.event_hash = hashEvent(event);
  } catch (err) {
    return { appended: false, reason: `event_candidate_invalid:${canonicalErrorCode(err)}` };
  }

  const dir = eventsDirOf(p.home, p.txId);
  const finalPath = join(dir, eventName(p.sequence));
  const res = await publishNoReplace(
    dir,
    finalPath,
    `${JSON.stringify(event, null, 2)}\n`,
    publicationOps,
  );
  if (res.published && res.durable) {
    return withCleanupFailure(
      { appended: true, event: Object.freeze(event) },
      res.cleanup_failure,
    );
  }
  if (res.reason !== "event_already_published") {
    const failure = { appended: false, reason: res.reason };
    if (res.cleanup_failure) failure.cleanup_failure = res.cleanup_failure;
    if (res.durability_uncertain) failure.durability_uncertain = true;
    if (res.canonical_event_visible) failure.canonical_event_visible = true;
    if (res.effect_retry_forbidden) failure.effect_retry_forbidden = true;
    if (res.replay_required) failure.replay_required = true;
    failure.escalate_to_human = true;
    return failure;
  }

  // Someone else published this sequence first. Whether that is success or a
  // conflict is decided by SEMANTIC equality, never by bytes or timestamps.
  const replayed = await replayClosureTransaction({ demaHome: p.home, transactionId: p.txId });
  if (!replayed.ok) {
    return withCleanupFailure({
      appended: false,
      reason: `event_published_winner_invalid:${replayed.reason}`,
      escalate_to_human: true,
    }, res.cleanup_failure);
  }
  const winner = replayed.events[p.sequence];
  const bindingFields = [
    "schema", "domain", "canonicalization", "transaction_id", "sequence",
    "previous_event_hash", "consent_claim_hash", "transaction_hash",
  ];
  for (const field of bindingFields) {
    if (winner?.[field] !== event[field]) {
      return withCleanupFailure({
        appended: false,
        reason: `event_published_winner_invalid:${field}_mismatch`,
        escalate_to_human: true,
      }, res.cleanup_failure);
    }
  }
  return withCleanupFailure(
    settleAgainstPublished(winner, event),
    res.cleanup_failure,
  );
}

/**
 * Compare-and-append one event.
 *
 * The caller declares the head it believes it is building on. A stale head can
 * never append: the whole history is re-verified, the transition is checked
 * against the closed map, and publication is no-replace.
 */
async function appendClosureEventWithPublicationOps({
  demaHome, transactionId, expectedSequence, expectedPreviousEventHash,
  phase, terminalOutcome = null, evidenceRefs = [], atIso,
} = {}, publicationOps = DEFAULT_PUBLICATION_OPS) {
  if (typeof transactionId !== "string" || !TX_ID_RE.test(transactionId)) {
    return Object.freeze({ appended: false, reason: "transaction_id_malformed" });
  }
  const invalidProposal = validateAppendProposal({
    expectedSequence,
    expectedPreviousEventHash,
    phase,
    terminalOutcome,
    evidenceRefs,
    atIso,
  });
  if (invalidProposal) return Object.freeze({ appended: false, reason: invalidProposal });
  const home = resolveHome(demaHome);
  const state = await replayClosureTransaction({ demaHome: home, transactionId });

  if (!state.ok) {
    return Object.freeze({ appended: false, reason: state.reason, escalate_to_human: true });
  }
  if (!state.exists) {
    // Nothing on disk yet: the only event that may open a history is PREPARED,
    // and only openClosureTransaction may write it (it alone binds the claim).
    if (phase !== "PREPARED") {
      return Object.freeze({ appended: false, reason: "first_event_must_be_prepared" });
    }
    return Object.freeze({ appended: false, reason: "use_open_closure_transaction" });
  }
  if (expectedSequence !== state.sequence + 1) {
    // A worker that died AFTER publishing but before recording success retries
    // with a head stale by exactly the work it already committed. Replaying its
    // own event is recovery, not a caller fault — provided it is semantically
    // the same event. Reporting a sequence fault here would push a completed
    // step into escalation and invite a duplicate effect on the next attempt.
    const published = state.events[expectedSequence];
    if (published) {
      try {
        await publicationOps.fsyncDir(eventsDirOf(home, transactionId));
      } catch (err) {
        return Object.freeze({
          appended: false,
          reason: `event_publication_durability_uncertain:${err?.code ?? "unknown"}`,
          durability_uncertain: true,
          canonical_event_visible: true,
          effect_retry_forbidden: true,
          replay_required: true,
          escalate_to_human: true,
        });
      }
      return Object.freeze(
        settleAgainstPublished(published, {
          domain: MISSION_CLOSURE_TX_EVENT_DOMAIN,
          transaction_id: transactionId,
          sequence: expectedSequence,
          phase,
          terminal_outcome: terminalOutcome ?? null,
          previous_event_hash: expectedPreviousEventHash,
          consent_claim_hash: state.events[0].consent_claim_hash,
          transaction_hash: state.events[0].transaction_hash,
          evidence_refs: evidenceRefs ?? [],
        }),
      );
    }
    return Object.freeze({
      appended: false, reason: "sequence_not_contiguous",
      head_sequence: state.sequence, requested: expectedSequence,
    });
  }
  if (expectedPreviousEventHash !== state.head_event_hash) {
    return Object.freeze({ appended: false, reason: "previous_event_hash_mismatch", head_sequence: state.sequence });
  }
  // New writes are governed by the STRICT map, not the replay map.
  if (!TX_APPEND_TRANSITIONS[state.phase]?.includes(phase)) {
    return Object.freeze({ appended: false, reason: "illegal_phase_transition", from: state.phase, to: phase });
  }
  // STRICT WRITER LAW. The phase (and, for RESOLVED, the terminal outcome)
  // decides that the current evidence law applies — never the evidence itself.
  // Deciding from the evidence let a new append buy legacy privileges simply by
  // omitting the schema that would have constrained it.
  if (appendRequiresRollbackEvidence(phase, terminalOutcome)) {
    // prepared_intent_hash is descriptor-bound, not event-bound, so the binding
    // is read from the authoritative descriptor rather than inferred from an
    // event that never carried it.
    let storedDescriptor = null;
    try {
      storedDescriptor = JSON.parse(
        await readFile(join(transactionDir(home, transactionId), "transaction.json"), "utf8"),
      );
    } catch {
      return Object.freeze({ appended: false, reason: "transaction_descriptor_unreadable" });
    }
    const derived = deriveRollbackBindingContext({
      descriptor: storedDescriptor, events: state.events, transactionId,
    });
    if (derived.error) {
      return Object.freeze({ appended: false, reason: derived.error, from: state.phase, to: phase });
    }
    const invalid = validateRollbackEvidenceForAppend({
      phase, terminalOutcome, evidenceRefs, context: derived.context, events: state.events,
    });
    if (invalid !== null) {
      return Object.freeze({ appended: false, reason: invalid, from: state.phase, to: phase });
    }
  }
  if (phase === "RESOLVED") {
    if (!TERMINAL_OUTCOMES.includes(terminalOutcome)) {
      return Object.freeze({ appended: false, reason: "terminal_outcome_required" });
    }
    const required = requiredTerminalPredecessor(terminalOutcome, state.events);
    if (required !== null && state.phase !== required) {
      // Reason strings stay derived, so COMPLETED_VERIFIED still reports the
      // exact `completed_verified_requires_anchored` other callers assert on.
      return Object.freeze({
        appended: false,
        reason: `${terminalOutcome.toLowerCase()}_requires_${required.toLowerCase()}`,
        from: state.phase,
      });
    }
  } else if (terminalOutcome !== null) {
    return Object.freeze({ appended: false, reason: "terminal_outcome_on_nonterminal_phase" });
  }

  const head = state.events[state.events.length - 1];
  const res = await writeEvent({
    home, txId: transactionId, sequence: expectedSequence, phase, terminalOutcome,
    previousEventHash: state.head_event_hash, claimHash: head.consent_claim_hash,
    transactionHash: head.transaction_hash, evidenceRefs, atIso,
  }, publicationOps);
  return Object.freeze(res);
}

export async function appendClosureEvent(args = {}) {
  return appendClosureEventWithPublicationOps(args);
}

export const _internal = Object.freeze({
  TX_ID_RE, EVENT_FILE_RE, TEMP_FILE_RE, transactionDir, eventsDirOf, eventName,
  hashDescriptor, hashEvent, hashSemantic, descriptorBody, publishNoReplace,
  openClosureTransactionWithPublicationOps, appendClosureEventWithPublicationOps,
  DEFAULT_PUBLICATION_OPS,
});
