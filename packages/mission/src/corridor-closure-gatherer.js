// CORRIDOR-CLOSURE-GATHERER-1A — the BINDING caller for THE WELD.
//
// mission-corridor-closure.js is a pure kernel. Purity forbids it from reading
// the durable nonce store or the receipt ledger, so it can check that a consent
// registry is well-SHAPED but never that it is telling the TRUTH:
//
//   consentRegistry: { has: () => false, add: () => {} }   → COMPLETED_VERIFIED
//
// That is the documented ceiling in the kernel header, the same shape-not-binding
// ceiling peak-self-loop-preview.js records for evidence. This module is the
// caller that closes it: the production route re-reads the one canonical C1
// nonce claim, binds that claim to the exact prepared intent and C2 transaction,
// and binds the remaining surfaces to the canonical receipt ledger, real
// filesystem, and anchor log. The legacy O_EXCL nonce adapter remains exported
// only for compatibility tests; the production C3 route never creates a second
// authority marker.
//
// I/O tier by design (allowlisted in scripts/review/kernel-purity-allowlist.js).
// All paths stay under DEMA_HOME. No network, no child_process, no model.
//
// ── KNOWN LIMIT · the FIRST closure is placement-anchored only ──
// enforceAnchorPolicy verifies an anchor LOG against the observed chain. When
// the canonical ledger is empty there is no prior chain to anchor, so the anchor
// law reduces to "anchorDir resolves outside the leased scope". We do NOT mint a
// synthetic genesis head to make the check look stronger than it is. After the
// first closure appends its receipt, appendClosureAnchor writes a real anchor
// record, and every subsequent closure is verified against it.

import { createHash } from "node:crypto";
import {
  closeSync, constants, fstatSync, fsyncSync, linkSync, lstatSync, mkdirSync,
  openSync, readFileSync, readdirSync, realpathSync, unlinkSync, writeSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";

import { buildAnchorRecord, verifyAnchorLog } from "../../core/src/chain-anchor.js";
import { CORRIDOR_RECOVERY_STOP_BINDING_SCHEMA } from "./mission-corridor.js";
import {
  applyPreparedMechanicalClosure,
  finalizeAppliedMechanicalClosure,
  prepareMechanicalClosure,
  replaySeal,
  restoreToBeforeState,
} from "../../core/src/omega0-mechanical-closure.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";
import {
  CANONICAL_LEDGER_RELPATH, loadCanonicalLedger, appendCanonicalReceipt,
} from "../../receipts/src/canonical-ledger.js";
import {
  CANONICAL_RECEIPT_CONSENT_PHRASE, verifyCanonicalChain,
} from "../../receipts/src/canonical-receipt.js";
import { loadPublicKey } from "../../receipts/src/authorship-key-store.js";
import {
  recordConsentNonce, isConsentNonceUsed, _internal as nonceInternal,
} from "../../receipts/src/consent-nonce-registry-atomic.js";
import {
  inspectConsentNonce, nonceDigest,
} from "../../receipts/src/consent-nonce-claim.js";
import {
  openClosureTransaction, replayClosureTransaction, appendClosureEvent,
  BEFORE_STATE_VERIFIED_EVIDENCE_SCHEMA, MISSION_CLOSURE_TX_RELDIR,
  TX_APPEND_TRANSITIONS,
  CORRIDOR_ROLLBACK_STARTED_EVIDENCE_SCHEMA,
  CORRIDOR_ROLLBACK_COMPLETED_EVIDENCE_SCHEMA,
  CORRIDOR_ROLLBACK_RECOVERY_EVIDENCE_SCHEMA,
  CORRIDOR_ROLLBACK_TERMINAL_EVIDENCE_SCHEMA,
  classifySettledMechanicalRecovery,
  readRollbackBindingContext,
  validateRollbackStartedEvidence,
  ROLLBACK_FALLBACK_OUTCOME,
} from "../../receipts/src/mission-closure-transaction.js";

export const CORRIDOR_CLOSURE_ANCHOR_RELPATH = "anchors/corridor-closure-anchors.ndjson";
export const CORRIDOR_CLOSURE_CHAIN_ID = "canonical-receipt-ledger";
export const CORRIDOR_RENAME_INTENT_SCHEMA = "bizra.dema.corridor_rename_intent.v1";
export const CORRIDOR_RENAME_RECOVERY_POLICY = Object.freeze({
  schema: "bizra.dema.corridor_rename_recovery_policy.v1",
  observed_pre_state: "safe_to_execute",
  observed_expected_post_state: "recover_without_initial_reapply",
  observed_no_replace_target_published_source_link_pending:
    "finish_pending_source_unlink_then_verify_without_overwrite",
  observed_other_state: "RECOVERY_REQUIRED",
});
export const CORRIDOR_RENAME_RECOVERY_POLICY_HASH =
  sha256CanonicalJsonV1(CORRIDOR_RENAME_RECOVERY_POLICY);

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

function pathRefusal(code, detail = code) {
  const err = new Error(detail);
  err.code = code;
  return err;
}

function captureDirectoryIdentity(path) {
  const info = lstatSync(path);
  if (info.isSymbolicLink() || !info.isDirectory()) {
    throw pathRefusal("rename_scope_root_unsafe", "rename scope root must be a real directory");
  }
  return Object.freeze({
    realpath: realpathSync(path),
    dev: String(info.dev),
    ino: String(info.ino),
  });
}

function sameDirectoryIdentity(left, right) {
  return left?.realpath === right?.realpath
    && left?.dev === right?.dev
    && left?.ino === right?.ino;
}

function assertDirectoryIdentity(path, expected) {
  let observed;
  try {
    observed = captureDirectoryIdentity(path);
  } catch (err) {
    throw pathRefusal(
      "rename_root_identity_mismatch",
      `rename root identity unavailable: ${err?.code ?? "unknown"}`,
    );
  }
  if (!sameDirectoryIdentity(observed, expected)) {
    throw pathRefusal("rename_root_identity_mismatch", "rename root identity changed after consent");
  }
  return observed;
}

function regularFileIdentity(path) {
  const info = lstatSync(path);
  if (info.isSymbolicLink() || !info.isFile()) {
    throw pathRefusal("rename_operand_not_regular_file", "rename operand must be a regular file");
  }
  return Object.freeze({ dev: String(info.dev), ino: String(info.ino) });
}

function sameFileIdentity(left, right) {
  return left?.dev === right?.dev && left?.ino === right?.ino;
}

function withBoundDirectory(root, expected, fn) {
  assertDirectoryIdentity(root, expected);
  const flags = constants.O_RDONLY
    | (constants.O_DIRECTORY ?? 0)
    | (constants.O_NOFOLLOW ?? 0);
  const fd = openSync(root, flags);
  try {
    const opened = fstatSync(fd);
    if (String(opened.dev) !== expected.dev || String(opened.ino) !== expected.ino) {
      throw pathRefusal("rename_root_identity_mismatch", "opened rename root differs from consented root");
    }
    const boundRoot = `/proc/self/fd/${fd}`;
    return fn(boundRoot);
  } finally {
    closeSync(fd);
  }
}

function renameOperand(root, value) {
  if (typeof value !== "string" || value.length === 0) return null;
  const path = resolve(root, value);
  // This adapter intentionally supports one top-level file rename only. A
  // nested or absolute operand would escape the manifest the verifier measures.
  if (dirname(path) !== root || value === "." || value === "..") return null;
  return path;
}

function readRenameManifest(root) {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => ({
      path: entry.name,
      content_id: sha256(readFileSync(join(root, entry.name))),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Measure and hash the exact rename the operator is about to authorize.
 *
 * The result is safe to place inside C2 evidence: it binds the operands, the
 * measured pre-state, and the only post-state recovery may accept. It performs
 * reads only and never claims authority or mutates the estate.
 */
export function buildRenameEffectIntent({ scopeRoot, from, to } = {}) {
  const root = resolve(String(scopeRoot ?? ""));
  let rootIdentity;
  try {
    rootIdentity = captureDirectoryIdentity(root);
  } catch (err) {
    return Object.freeze({ ok: false, reason: err?.code ?? "rename_scope_root_unavailable" });
  }
  const fromPath = renameOperand(root, from);
  const toPath = renameOperand(root, to);
  if (!fromPath || !toPath) {
    return Object.freeze({ ok: false, reason: "rename_operand_outside_scope" });
  }
  if (from === to) return Object.freeze({ ok: false, reason: "rename_operands_identical" });

  let before;
  try {
    before = withBoundDirectory(root, rootIdentity, (boundRoot) => readRenameManifest(boundRoot));
  } catch (err) {
    return Object.freeze({ ok: false, reason: `rename_manifest_unavailable:${err?.code ?? "unknown"}` });
  }
  if (!before.some((entry) => entry.path === from)) {
    return Object.freeze({ ok: false, reason: "rename_source_missing" });
  }
  let sourceIdentity;
  try {
    sourceIdentity = withBoundDirectory(
      root,
      rootIdentity,
      (boundRoot) => regularFileIdentity(join(boundRoot, from)),
    );
  } catch (err) {
    return Object.freeze({ ok: false, reason: err?.code ?? "rename_source_unsafe" });
  }
  try {
    withBoundDirectory(root, rootIdentity, (boundRoot) => lstatSync(join(boundRoot, to)));
    return Object.freeze({ ok: false, reason: "rename_target_exists" });
  } catch (err) {
    if (err?.code !== "ENOENT") {
      return Object.freeze({ ok: false, reason: `rename_target_unavailable:${err?.code ?? "unknown"}` });
    }
  }

  const plan = Object.freeze([Object.freeze({ op: "rename", from, to })]);
  const expectedAfter = Object.freeze(before
    .map((entry) => Object.freeze(entry.path === from ? { ...entry, path: to } : { ...entry }))
    .sort((a, b) => a.path.localeCompare(b.path)));
  const intent = Object.freeze({
    schema: CORRIDOR_RENAME_INTENT_SCHEMA,
    effect_kind: "rename",
    scope_root: root,
    scope_root_identity: rootIdentity,
    source_file_identity: sourceIdentity,
    plan,
    plan_hash: sha256(JSON.stringify(plan)),
    before_manifest: Object.freeze(before.map((entry) => Object.freeze({ ...entry }))),
    before_hash: sha256(JSON.stringify(before)),
    expected_after_manifest: expectedAfter,
    expected_after_hash: sha256(JSON.stringify(expectedAfter)),
  });
  return Object.freeze({
    ok: true,
    intent,
    prepared_intent_hash: sha256CanonicalJsonV1(intent),
  });
}

export function resolveDemaHome(override) {
  if (typeof override === "string" && override.length > 0) return override;
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

/**
 * Single-use consent bound to REAL bytes: one O_EXCL file per nonce.
 *
 * `has` fails CLOSED (an unreadable entry reads as USED), so a corrupted
 * registry can never hand back a spent authority. `add` THROWS when the
 * registry refuses — the weld treats a thrown add as a failed transaction
 * rather than silently proceeding on unrecorded consent.
 */
export function buildDiskConsentRegistry({ demaHome, actionType = "C3_LOCAL_WRITE", targetHash, consentProofHash }) {
  const home = resolveDemaHome(demaHome);
  // Create the registry directory up front so that its LATER absence is
  // unambiguous evidence of tampering, and `has` can keep failing closed on an
  // unreadable directory. Without this, a never-initialised registry is
  // indistinguishable from an erased one, and the fail-closed read reports every
  // nonce as already consumed — refusing every first closure on a fresh home.
  mkdirSync(nonceInternal.paths(home).dir, { recursive: true, mode: 0o700 });
  return Object.freeze({
    has: (nonce) => isConsentNonceUsed({ nonce, demaHome: home }),
    add: async (nonce) => {
      const r = await recordConsentNonce({
        nonce, actionType, targetHash, consentProofHash, demaHome: home,
      });
      if (!r.recorded) {
        // Losing the exclusive create means somebody else consumed this nonce
        // between our `has` and our `add`. That is precisely the race D3 exists
        // to arbitrate, and the loser must not proceed.
        throw new Error(`consent nonce not recorded: ${r.error}`);
      }
      return r;
    },
  });
}

/**
 * Compatibility adapter for the weld after C1 has already consumed authority.
 * It never creates a second marker: both probes re-read the one canonical C1
 * claim and require exact byte-bound identity with the claim the orchestrator
 * received. The weld's old has/add interface remains intact for other callers.
 */
export function buildClaimBoundConsentRegistry({ demaHome, claim }) {
  const home = resolveDemaHome(demaHome);
  const exactClaimHeld = async (nonce) => {
    if (!claim || claim.nonce_digest !== nonceDigest(nonce)) return false;
    const seen = await inspectConsentNonce({ nonce, demaHome: home });
    return seen.used === true
      && seen.corrupt === false
      && seen.claim_hash_valid === true
      && seen.claim?.claim_hash === claim.claim_hash
      && seen.claim?.transaction_id === claim.transaction_id;
  };
  return Object.freeze({
    // `has` here means "unavailable to THIS transaction". The exact C1 holder
    // may proceed; any missing, corrupt, or different claim fails closed.
    has: async (nonce) => !(await exactClaimHeld(nonce)),
    add: async (nonce) => {
      if (!(await exactClaimHeld(nonce))) {
        throw new Error("canonical consent claim is missing, corrupt, or not held by this transaction");
      }
      return Object.freeze({ recorded: true, authority: "C1", claim_hash: claim.claim_hash });
    },
  });
}

async function appendDurableClosurePhase({
  demaHome, transactionId, phase, terminalOutcome = null, evidenceRefs = [], atIso,
}) {
  const before = await replayClosureTransaction({ demaHome, transactionId });
  if (!before.ok || !before.exists) {
    return Object.freeze({ ok: false, reason: before.reason ?? "transaction_not_prepared" });
  }
  const existing = before.events.find((event) => event.phase === phase);
  const proposal = existing
    ? {
      expectedSequence: existing.sequence,
      expectedPreviousEventHash: existing.previous_event_hash,
    }
    : {
      expectedSequence: before.sequence + 1,
      expectedPreviousEventHash: before.head_event_hash,
    };
  const appended = await appendClosureEvent({
    demaHome,
    transactionId,
    ...proposal,
    phase,
    terminalOutcome,
    evidenceRefs,
    atIso,
  });
  if (appended.appended !== true && appended.idempotent !== true) {
    return Object.freeze({ ok: false, reason: appended.reason, details: appended });
  }
  const state = await replayClosureTransaction({ demaHome, transactionId });
  if (!state.ok) return Object.freeze({ ok: false, reason: state.reason });
  return Object.freeze({ ok: true, state, event: appended.event });
}

export async function appendClosureTransactionPhase(args = {}) {
  return appendDurableClosurePhase(args);
}

/**
 * Resolve the exact persisted rename intent before a recovery consent check.
 * A post-state can no longer be re-derived from the source path, so recovery
 * reads the C2 intent event and verifies it against the immutable C1 hash.
 */
export async function resolveRenameEffectIntent({
  demaHome, claim = null, scopeRoot, from, to,
} = {}) {
  if (claim === null) return buildRenameEffectIntent({ scopeRoot, from, to });
  if (claim.recovery_policy_hash !== CORRIDOR_RENAME_RECOVERY_POLICY_HASH) {
    return Object.freeze({ ok: false, reason: "rename_recovery_policy_mismatch" });
  }

  const replay = await replayClosureTransaction({
    demaHome: resolveDemaHome(demaHome),
    transactionId: claim.transaction_id,
  });
  if (!replay.ok) return Object.freeze({ ok: false, reason: replay.reason });
  const intentEvent = replay.events?.find((event) => event.phase === "EFFECT_INTENT_PERSISTED");
  const evidence = intentEvent?.evidence_refs?.find(
    (ref) => ref?.schema === "bizra.dema.corridor_rename_intent_evidence.v1",
  );

  let resolvedIntent = evidence?.intent ?? null;
  if (resolvedIntent === null) {
    const fresh = buildRenameEffectIntent({ scopeRoot, from, to });
    if (!fresh.ok) return fresh;
    resolvedIntent = fresh.intent;
  }

  let preparedIntentHash;
  try {
    preparedIntentHash = sha256CanonicalJsonV1(resolvedIntent);
  } catch {
    return Object.freeze({ ok: false, reason: "persisted_rename_intent_not_canonical" });
  }
  const expectedPlan = [{ op: "rename", from, to }];
  if (preparedIntentHash !== claim.prepared_intent_hash
      || (evidence?.prepared_intent_hash && evidence.prepared_intent_hash !== preparedIntentHash)
      || resolvedIntent.scope_root !== resolve(String(scopeRoot ?? ""))
      || sha256(JSON.stringify(expectedPlan)) !== resolvedIntent.plan_hash
      || JSON.stringify(resolvedIntent.plan) !== JSON.stringify(expectedPlan)) {
    return Object.freeze({ ok: false, reason: "persisted_rename_intent_binding_mismatch" });
  }
  return Object.freeze({
    ok: true,
    intent: resolvedIntent,
    prepared_intent_hash: preparedIntentHash,
    recovered: evidence !== undefined,
  });
}

function txRefusal(reason, extra = {}) {
  return Object.freeze({ ok: false, reason, authority_delta: 0, ...extra });
}

function replayPersistedSealedCard({ state, prepared, effect }) {
  const sealedEvent = state?.events?.find((event) => event.phase === "SEALED");
  if (!sealedEvent) return null;
  const refs = sealedEvent.evidence_refs?.filter(
    (ref) => ref?.schema === "bizra.dema.corridor_rename_seal_evidence.v1",
  ) ?? [];
  if (refs.length !== 1) return txRefusal("persisted_sealed_card_evidence_ambiguous");
  const evidence = refs[0];
  const sealed = evidence.omega0_card;
  if (!sealed || sealed.status !== "SEALED"
      || evidence.prepared_intent_hash !== prepared.prepared_intent_hash
      || evidence.seal_head !== sealed.seal_head
      || sealed.plan_hash !== prepared.intent.plan_hash
      || sealed.before_hash !== prepared.intent.before_hash
      || sealed.after_hash !== prepared.intent.expected_after_hash) {
    return txRefusal("persisted_sealed_card_binding_mismatch");
  }
  let replay;
  try {
    replay = replaySeal(sealed, effect);
  } catch (err) {
    return txRefusal("persisted_sealed_card_world_unavailable", {
      error: String(err?.message ?? err),
    });
  }
  if (replay.replayed !== true) {
    return txRefusal("persisted_sealed_card_replay_failed", { replay });
  }
  return Object.freeze({ ok: true, sealed, replay });
}

async function verifyMechanicalTransactionAuthority({
  demaHome, claim, prepared, mission, lease, consent,
}) {
  if (!claim || typeof claim !== "object") return txRefusal("consent_claim_missing");
  if (!prepared?.ok || !prepared.intent) return txRefusal("prepared_intent_missing");

  let preparedIntentHash;
  try {
    preparedIntentHash = sha256CanonicalJsonV1(prepared.intent);
  } catch {
    return txRefusal("prepared_intent_not_canonical");
  }

  const drift = [];
  if (prepared.prepared_intent_hash !== preparedIntentHash) drift.push("prepared_intent_wrapper_hash");
  if (claim.prepared_intent_hash !== preparedIntentHash) drift.push("prepared_intent_hash");
  if (claim.recovery_policy_hash !== CORRIDOR_RENAME_RECOVERY_POLICY_HASH) drift.push("recovery_policy_hash");
  if (claim.action_kind !== "COMPLETE") drift.push("action_kind");
  if (claim.action_class !== "C3_LOCAL_WRITE") drift.push("action_class");
  if (claim.mission_id === null || claim.mission_id === undefined) drift.push("mission_id");
  if (typeof claim.contract_hash !== "string") drift.push("contract_hash");
  if (typeof claim.checkpoint_event_hash !== "string") drift.push("checkpoint_event_hash");
  if (claim.consent_context_hash !== consent?.ref) drift.push("consent_context_hash");
  if (claim.nonce_digest !== nonceDigest(consent?.nonce)) drift.push("nonce_digest");
  if (prepared.intent.plan_hash !== consent?.plan_hash) drift.push("plan_hash");
  if (prepared.intent.scope_root !== mission?.root) drift.push("mission_scope_root");
  if (prepared.intent.scope_root !== lease?.scope_root) drift.push("lease_scope_root");
  if (drift.length > 0) {
    return txRefusal("mechanical_transaction_authority_mismatch", {
      drifted_fields: Object.freeze(drift),
    });
  }

  const seen = await inspectConsentNonce({ nonce: consent.nonce, demaHome });
  if (seen.used !== true || seen.corrupt !== false || seen.claim_hash_valid !== true
      || seen.claim?.claim_hash !== claim.claim_hash
      || seen.claim?.transaction_id !== claim.transaction_id) {
    return txRefusal("canonical_consent_claim_not_held", {
      escalate_to_human: true,
    });
  }
  return Object.freeze({ ok: true, prepared_intent_hash: preparedIntentHash });
}

/**
 * Bind C1 authority to C2 before crossing the real rename boundary.
 *
 * This function intentionally stops at C2 `SEALED`. The canonical ledger,
 * anchor, corridor terminal event, and `RESOLVED` tail are separate durable
 * boundaries and must not be reconstructed from an in-memory success result.
 */
export async function runTransactionalMechanicalClosure({
  demaHome,
  claim,
  prepared,
  mission,
  lease,
  consent,
  anchorDir,
  effect,
  proveUndo = true,
} = {}) {
  const home = resolveDemaHome(demaHome);
  const authority = await verifyMechanicalTransactionAuthority({
    demaHome: home, claim, prepared, mission, lease, consent,
  });
  if (!authority.ok) return authority;

  try {
    if (typeof effect?.bindPreparedIntent === "function") {
      effect.bindPreparedIntent(prepared.intent);
    }
  } catch (err) {
    return txRefusal(err?.code ?? "rename_root_identity_mismatch", {
      error: String(err?.message ?? err),
    });
  }

  const claimedAt = Date.parse(claim.claimed_at_iso);
  if (!Number.isFinite(claimedAt) || new Date(claimedAt).toISOString() !== claim.claimed_at_iso) {
    return txRefusal("consent_claim_time_invalid");
  }

  let opened;
  try {
    opened = await openClosureTransaction({
      claim,
      demaHome: home,
      atIso: claim.claimed_at_iso,
    });
  } catch (err) {
    return txRefusal(`transaction_open_failed:${err?.code ?? "unknown"}`);
  }
  if (opened.ok !== true) {
    return txRefusal(opened.reason ?? "transaction_open_refused", { details: opened });
  }

  const intentPhase = await appendDurableClosurePhase({
    demaHome: home,
    transactionId: claim.transaction_id,
    phase: "EFFECT_INTENT_PERSISTED",
    evidenceRefs: [{
      schema: "bizra.dema.corridor_rename_intent_evidence.v1",
      prepared_intent_hash: authority.prepared_intent_hash,
      recovery_policy_hash: CORRIDOR_RENAME_RECOVERY_POLICY_HASH,
      checkpoint_event_hash: claim.checkpoint_event_hash,
      intent: prepared.intent,
    }],
    atIso: claim.claimed_at_iso,
  });
  if (!intentPhase.ok) {
    return txRefusal(intentPhase.reason ?? "effect_intent_persistence_failed", {
      transaction_state: intentPhase.state ?? null,
      details: intentPhase.details,
    });
  }

  const persistedSeal = replayPersistedSealedCard({
    state: intentPhase.state,
    prepared,
    effect,
  });
  if (persistedSeal?.ok === false) return persistedSeal;
  if (persistedSeal?.ok === true) {
    return Object.freeze({
      ok: true,
      reason: null,
      authority_delta: 0,
      resumed_from_post_state: true,
      reused_sealed_card: true,
      omega0_card: persistedSeal.sealed,
      transaction_state: intentPhase.state,
    });
  }

  const mechanicalPrepared = prepareMechanicalClosure({
    mission,
    lease,
    consent,
    anchorDir,
    effect,
    intent: prepared.intent,
    now: claimedAt,
    proveUndo,
  });
  if (mechanicalPrepared.status !== "PREPARED") {
    return txRefusal(mechanicalPrepared.reason ?? "mechanical_prepare_blocked", {
      omega0_card: mechanicalPrepared,
      transaction_state: intentPhase.state,
    });
  }

  // ── THE EFFECT BOUNDARY ──
  // Everything from here on may have changed the world, so every failure exit
  // below settles with durable rollback history instead of merely refusing.
  const applied = applyPreparedMechanicalClosure({ prepared: mechanicalPrepared, effect });
  if (applied.status !== "APPLIED") {
    if (PRE_EFFECT_BOUNDARY_OMEGA0_REASONS.includes(applied.reason)) {
      // Refused by a guard clause before Omega0 observed or touched anything.
      return txRefusal(applied.reason ?? "mechanical_apply_blocked", {
        omega0_card: applied,
        transaction_state: intentPhase.state,
      });
    }
    return await settleMechanicalFailureWithVerifiedRollback({
      demaHome: home,
      claim,
      prepared,
      effect,
      failure: {
        stage: "EFFECT_APPLY",
        reason: applied.reason ?? "mechanical_apply_blocked",
        omega0_card: applied,
      },
      transactionState: intentPhase.state,
    });
  }

  const appliedPhase = await appendDurableClosurePhase({
    demaHome: home,
    transactionId: claim.transaction_id,
    phase: "EFFECT_APPLIED",
    evidenceRefs: [{
      schema: "bizra.dema.corridor_rename_effect_applied_evidence.v1",
      prepared_intent_hash: authority.prepared_intent_hash,
      plan_hash: prepared.intent.plan_hash,
      before_hash: prepared.intent.before_hash,
      after_hash: applied.after_hash,
    }],
    atIso: claim.claimed_at_iso,
  });
  if (!appliedPhase.ok) {
    // The world changed but its proof did not land. Recovery starts from the
    // last DURABLE phase, which is still EFFECT_INTENT_PERSISTED.
    return await settleMechanicalFailureWithVerifiedRollback({
      demaHome: home,
      claim,
      prepared,
      effect,
      failure: {
        stage: "EFFECT_APPLIED_PERSISTENCE",
        reason: appliedPhase.reason ?? "effect_applied_persistence_failed",
        details: appliedPhase.details,
      },
      transactionState: appliedPhase.state ?? intentPhase.state,
    });
  }

  const sealed = finalizeAppliedMechanicalClosure({ applied, effect });
  if (sealed.status !== "SEALED") {
    return await settleMechanicalFailureWithVerifiedRollback({
      demaHome: home,
      claim,
      prepared,
      effect,
      failure: {
        stage: "MECHANICAL_FINALIZE",
        reason: sealed.reason ?? "mechanical_finalize_blocked",
        omega0_card: sealed,
      },
      transactionState: appliedPhase.state,
    });
  }

  const verifiedPhase = await appendDurableClosurePhase({
    demaHome: home,
    transactionId: claim.transaction_id,
    phase: "VERIFIED",
    evidenceRefs: [{
      schema: "bizra.dema.corridor_rename_verification_evidence.v1",
      prepared_intent_hash: authority.prepared_intent_hash,
      before_hash: sealed.before_hash,
      after_hash: sealed.after_hash,
      verification: sealed.verification,
      reversibility: sealed.reversibility,
    }],
    atIso: claim.claimed_at_iso,
  });
  if (!verifiedPhase.ok) {
    return await settleMechanicalFailureWithVerifiedRollback({
      demaHome: home,
      claim,
      prepared,
      effect,
      failure: {
        stage: "VERIFICATION_PERSISTENCE",
        reason: verifiedPhase.reason ?? "verification_persistence_failed",
        details: verifiedPhase.details,
      },
      transactionState: verifiedPhase.state ?? appliedPhase.state,
    });
  }

  const sealedPhase = await appendDurableClosurePhase({
    demaHome: home,
    transactionId: claim.transaction_id,
    phase: "SEALED",
    evidenceRefs: [{
      schema: "bizra.dema.corridor_rename_seal_evidence.v1",
      prepared_intent_hash: authority.prepared_intent_hash,
      seal_head: sealed.seal_head,
      omega0_card: sealed,
    }],
    atIso: claim.claimed_at_iso,
  });
  if (!sealedPhase.ok) {
    // Last exit before this function returns a SEALED transaction. Everything
    // after it — ledger, anchor, corridor terminal — belongs to other slices.
    return await settleMechanicalFailureWithVerifiedRollback({
      demaHome: home,
      claim,
      prepared,
      effect,
      failure: {
        stage: "SEAL_PERSISTENCE",
        reason: sealedPhase.reason ?? "seal_persistence_failed",
        details: sealedPhase.details,
      },
      transactionState: sealedPhase.state ?? verifiedPhase.state,
    });
  }

  return Object.freeze({
    ok: true,
    reason: null,
    authority_delta: 0,
    resumed_from_post_state: applied.recovery_mode !== "APPLIED_FROM_PRE_STATE",
    recovery_mode: applied.recovery_mode,
    reused_sealed_card: false,
    omega0_card: sealed,
    transaction_state: sealedPhase.state,
  });
}
// ── C4B2A — DURABLE MECHANICAL ROLLBACK HISTORY ─────────────────────────────
//
// The route above crosses the effect boundary BEFORE it appends EFFECT_APPLIED,
// so a failure in that window leaves the world changed while the durable head
// still reads EFFECT_INTENT_PERSISTED. Recovery therefore begins from the last
// DURABLE phase, never from what this process remembers doing.
//
// This is the ONE production writer of ROLLBACK_STARTED, ROLLED_BACK,
// BEFORE_STATE_VERIFIED and RECOVERY_REQUIRED. It is reachable only from
// post-effect-boundary failure exits inside runTransactionalMechanicalClosure,
// it never touches the canonical ledger, the closure anchor, the corridor
// journal or consent, and it never retries the original effect.
//
// FOUR LAWS THIS WRITER OBEYS
//
//  1. AUTHORITATIVE CONTEXT BEFORE MUTATION. The descriptor and durable intent
//     are revalidated by the C4B1 binding derivation — the same one replay uses
//     — before ROLLBACK_STARTED is appended and before the world is touched. A
//     recovery-local "find the intent event" helper would be a second, weaker
//     validator, and the weaker one becomes the real policy once they drift.
//  2. THE FIRST ADJUDICATION OWNS THE OUTCOME. ROLLBACK_STARTED freezes the
//     intended terminal outcome. A retry carrying a differently-classifying
//     failure object is non-authoritative context and can never change history.
//  3. ONLY A FULLY PROVEN CHAIN IS A VERIFIED ROLLBACK. Terminal state is
//     classified, never assumed: COMPLETED_VERIFIED, an unrelated refusal, and
//     a pre-C4B1 unqualified ROLLED_BACK chain all report rollback_verified
//     false.
//  4. EVIDENCE CARRIES CODES, NOT TEXT. No exception message, path or stack
//     fragment enters an immutable event.
//
// Mapping a rollback result onto a corridor CHECKPOINT or STOPPED verdict is
// deliberately NOT done here — that is C4B2B.

/** The closed set of post-boundary failure sites this writer serves. */
export const MECHANICAL_FAILURE_STAGES = Object.freeze([
  "EFFECT_APPLY",
  "EFFECT_APPLIED_PERSISTENCE",
  "MECHANICAL_FINALIZE",
  "VERIFICATION_PERSISTENCE",
  "SEAL_PERSISTENCE",
]);

// The rollback evidence schemas and their validators live with the append/replay
// verifier that enforces them; re-exported here because this module is the only
// thing that writes them.
export {
  CORRIDOR_ROLLBACK_STARTED_EVIDENCE_SCHEMA,
  CORRIDOR_ROLLBACK_COMPLETED_EVIDENCE_SCHEMA,
  CORRIDOR_ROLLBACK_RECOVERY_EVIDENCE_SCHEMA,
  CORRIDOR_ROLLBACK_TERMINAL_EVIDENCE_SCHEMA,
} from "../../receipts/src/mission-closure-transaction.js";

// Once the ledger has committed, the receipt chain is the authority and undoing
// the world beneath it would contradict a signed receipt. Recovery past this
// line is forward reconciliation (C4C), never a rollback.
const POST_LEDGER_PHASES = Object.freeze(["LEDGER_COMMITTED", "ANCHORED"]);

const ROLLBACK_PHASES = Object.freeze([
  "ROLLBACK_STARTED", "ROLLED_BACK", "BEFORE_STATE_VERIFIED", "RECOVERY_REQUIRED",
]);

// Stages whose CONDITIONAL success outcome is fixed by WHERE they failed.
const STAGE_TERMINAL_OUTCOMES = Object.freeze({
  EFFECT_APPLIED_PERSISTENCE: "EXECUTION_FAILED_ROLLED_BACK",
  VERIFICATION_PERSISTENCE: "VERIFICATION_FAILED_ROLLED_BACK",
  SEAL_PERSISTENCE: "SEAL_FAILED_NO_COMPLETE",
});

// For the two stages where the world-facing kernel decides, its own reason
// selects the outcome that applies IF exact restoration is later verified.
// `restoration_failed` maps to the stage's own terminal rather than to
// RECOVERY_REQUIRED: whether recovery is required is measured afterwards, not
// asserted here.
const OMEGA0_REASON_TERMINAL_OUTCOMES = Object.freeze({
  effect_failed: "EXECUTION_FAILED_ROLLED_BACK",
  verification_failed: "VERIFICATION_FAILED_ROLLED_BACK",
});

// The stage's default conditional success outcome when the card reason does not
// select one. An unknown post-boundary failure still crossed the effect
// boundary, so a verified restoration of it is an execution rollback.
const STAGE_DEFAULT_SUCCESS_OUTCOME = Object.freeze({
  EFFECT_APPLY: "EXECUTION_FAILED_ROLLED_BACK",
  MECHANICAL_FINALIZE: "VERIFICATION_FAILED_ROLLED_BACK",
});

// Omega0 refuses these before it observes or touches the world, so they are not
// post-boundary failures and must keep the route's existing refusal behaviour.
export const PRE_EFFECT_BOUNDARY_OMEGA0_REASONS = Object.freeze([
  "authority_mismatch",
  "adapter_incomplete",
]);

// ── BOUNDED VOCABULARY ──
// Every string that reaches an immutable event comes from one of these maps.
const OMEGA0_REASON_CODES = Object.freeze({
  effect_failed: "EFFECT_FAILED",
  verification_failed: "VERIFICATION_FAILED",
  restoration_failed: "RESTORATION_FAILED",
  adapter_incomplete: "ADAPTER_INCOMPLETE",
  authority_mismatch: "AUTHORITY_MISMATCH",
});

const STAGE_REASON_CODES = Object.freeze({
  EFFECT_APPLIED_PERSISTENCE: "EVENT_PERSISTENCE_FAILED",
  VERIFICATION_PERSISTENCE: "EVENT_PERSISTENCE_FAILED",
  SEAL_PERSISTENCE: "EVENT_PERSISTENCE_FAILED",
});

const RESTORATION_REASON_CODES = Object.freeze({
  restoration_world_unrecognised: "RESTORATION_WORLD_UNRECOGNISED",
  restoration_hash_mismatch: "RESTORATION_HASH_MISMATCH",
  restoration_inverse_failed: "RESTORATION_INVERSE_FAILED",
  restoration_inverse_unavailable: "RESTORATION_UNAVAILABLE",
  restoration_backward_recovery_failed: "RESTORATION_BACKWARD_FAILED",
  restoration_backward_recovery_unavailable: "RESTORATION_UNAVAILABLE",
  restoration_observation_failed: "RESTORATION_OBSERVATION_FAILED",
  restoration_intermediate_classification_failed: "RESTORATION_IDENTITY_MISMATCH",
  restoration_intent_missing: "RESTORATION_UNAVAILABLE",
  restoration_effect_missing: "RESTORATION_UNAVAILABLE",
  restoration_before_hash_missing: "RESTORATION_UNAVAILABLE",
  rename_source_identity_mismatch: "RESTORATION_IDENTITY_MISMATCH",
  rename_target_identity_mismatch: "RESTORATION_IDENTITY_MISMATCH",
  rename_publication_identity_mismatch: "RESTORATION_IDENTITY_MISMATCH",
  rename_intermediate_state_mismatch: "RESTORATION_WORLD_UNRECOGNISED",
  rename_backward_restoration_failed: "RESTORATION_BACKWARD_FAILED",
  rename_root_identity_mismatch: "RESTORATION_IDENTITY_MISMATCH",
});

/**
 * The ONE place a mechanical failure becomes a terminal outcome.
 *
 * Callers pass a structured stage, never a string fragment: inferring outcomes
 * from substrings at several call sites is how two exits silently disagree
 * about what the same failure meant.
 */
export function classifyMechanicalFailureOutcome(failure) {
  const stage = failure?.stage;
  if (!MECHANICAL_FAILURE_STAGES.includes(stage)) return "EXECUTION_FAILED_ROLLED_BACK";
  if (Object.hasOwn(STAGE_TERMINAL_OUTCOMES, stage)) return STAGE_TERMINAL_OUTCOMES[stage];
  const reason = failure?.omega0_card?.reason;
  return OMEGA0_REASON_TERMINAL_OUTCOMES[reason]
    ?? STAGE_DEFAULT_SUCCESS_OUTCOME[stage]
    ?? "EXECUTION_FAILED_ROLLED_BACK";
}

/** Failure -> bounded reason code. Never the raw message. */
export function classifyMechanicalFailureReasonCode(failure) {
  if (isDurabilityUncertain(failure)) return "DURABILITY_UNCERTAIN";
  const omega0 = OMEGA0_REASON_CODES[failure?.omega0_card?.reason];
  if (omega0) return omega0;
  const staged = STAGE_REASON_CODES[failure?.stage];
  if (staged) return staged;
  return "UNKNOWN";
}

const restorationReasonCode = (reason) =>
  RESTORATION_REASON_CODES[reason] ?? (reason === undefined ? "RESTORATION_NOT_ATTEMPTED" : "UNKNOWN");

const failureStageCode = (failure) =>
  MECHANICAL_FAILURE_STAGES.includes(failure?.stage) ? failure.stage : "UNKNOWN";

/**
 * A durability-uncertain publication is not a normal failure: the canonical
 * event may already be visible but unconfirmed, so retrying the effect or
 * stacking another phase on that head would build on something unproven.
 */
function isDurabilityUncertain(failure) {
  if (failure?.details?.durability_uncertain === true) return true;
  const reason = failure?.reason;
  return typeof reason === "string"
    && reason.startsWith("event_publication_durability_uncertain:");
}

// Which event was mid-publication when the uncertainty arose.
const UNCERTAIN_INTENDED_PHASE = Object.freeze({
  EFFECT_APPLIED_PERSISTENCE: "EFFECT_APPLIED",
  VERIFICATION_PERSISTENCE: "VERIFIED",
  SEAL_PERSISTENCE: "SEALED",
});

/**
 * Decide whether an uncertain publication may be resumed.
 *
 * A successful directory fsync proves the directory is durable — NOT that the
 * event we tried to write is the one that won. The replayed head is the only
 * thing that answers that, so it is classified rather than assumed.
 */
function decideUncertainResume({ state, intendedPhase }) {
  const head = state.phase;
  if (intendedPhase && head === intendedPhase) {
    return { ok: true, resume: "INTENDED_EVENT_CANONICAL" };
  }
  if (ROLLBACK_PHASES.includes(head)) {
    return { ok: true, resume: "ROLLBACK_ALREADY_STARTED" };
  }
  // Rollback may begin from any durable phase the strict writer allows it from.
  if (TX_APPEND_TRANSITIONS[head]?.includes("ROLLBACK_STARTED")) {
    return { ok: true, resume: "PRIOR_HEAD_CANONICAL" };
  }
  return { ok: false, resume: "DIVERGENT_HEAD" };
}

function closureEventsDir(home, transactionId) {
  return join(home, MISSION_CLOSURE_TX_RELDIR, transactionId, "events");
}

/** Durably acknowledge the event directory, or report that we cannot. */
function eventDirectoryDurable(home, transactionId) {
  let fd = null;
  try {
    fd = openSync(closureEventsDir(home, transactionId), "r");
    fsyncSync(fd);
    return true;
  } catch {
    return false;
  } finally {
    if (fd !== null) closeSync(fd);
  }
}

const hasPhase = (state, phase) => state.events.some((e) => e.phase === phase);

function rollbackSettled({ state, terminalOutcome, reason, recoveryMode = null }) {
  return Object.freeze({
    ok: false,
    rollback_verified: true,
    recovery_required: false,
    recovery_class: "VERIFIED_ROLLBACK",
    terminal_outcome: terminalOutcome,
    effect_retry_forbidden: true,
    transaction_state: state,
    authority_delta: 0,
    recovery_mode: recoveryMode,
    reason,
  });
}

/**
 * Recovery is required AND the chain proved it. Reachable only after
 * classifySettledMechanicalRecovery returned RECOVERY_REQUIRED, so it is the one
 * result that may later be offered as grounds to stop the corridor.
 */
function rollbackQualifiedRecovery({ state = null, reason, restorationReason = null }) {
  return Object.freeze({
    ok: false,
    rollback_verified: false,
    recovery_required: true,
    recovery_class: "RECOVERY_REQUIRED",
    terminal_outcome: "RECOVERY_REQUIRED",
    effect_retry_forbidden: true,
    transaction_state: state,
    authority_delta: 0,
    escalate_to_human: true,
    restoration_reason: restorationReason,
    reason,
  });
}

/**
 * A settled transaction that is NOT a verified rollback and NOT a
 * RECOVERY_REQUIRED settlement. Reported honestly, never as either.
 */
function rollbackNotQualified({ state, recoveryClass, reason }) {
  return Object.freeze({
    ok: false,
    rollback_verified: false,
    recovery_required: false,
    recovery_class: recoveryClass,
    terminal_outcome: state.terminal_outcome ?? null,
    effect_retry_forbidden: true,
    transaction_state: state,
    authority_delta: 0,
    escalate_to_human: true,
    reason,
  });
}

/**
 * A refusal: recovery is required, but this path never established a qualified
 * chain — it refused before or during adjudication.
 *
 * MEASURED DEFECT this closes: every refusal used to report the QUALIFIED class.
 * Under C4B2B that class maps to STOP_CONSENT_REQUIRED, so a post-ledger
 * divergence, an unreadable transaction or a failed durability probe would each
 * invite the operator to stop the corridor on evidence that was never
 * established. The STOP gate re-verifies and refuses, so it failed closed — but
 * the handoff was a lie. A class must be measured, never asserted.
 */
function rollbackUnqualifiedRecovery({ state = null, reason, restorationReason = null }) {
  return Object.freeze({
    ok: false,
    rollback_verified: false,
    recovery_required: true,
    recovery_class: "RECOVERY_REQUIRED_UNQUALIFIED",
    terminal_outcome: state?.terminal_outcome ?? null,
    effect_retry_forbidden: true,
    transaction_state: state,
    authority_delta: 0,
    escalate_to_human: true,
    restoration_reason: restorationReason,
    reason,
  });
}

/**
 * A settlement that genuinely needs recovery but does NOT qualify as a clean
 * RECOVERY_REQUIRED adjudication — e.g. an adjudication that intended to roll
 * back and then could not restore. Recovery is still required; the class stays
 * honest so C4B2B can never map it to a corridor verdict.
 */
function rollbackRecoveryUnqualified({ state, recoveryClass, reason, restorationReason = null }) {
  return Object.freeze({
    ok: false,
    rollback_verified: false,
    recovery_required: true,
    recovery_class: recoveryClass,
    terminal_outcome: state?.terminal_outcome ?? "RECOVERY_REQUIRED",
    effect_retry_forbidden: true,
    transaction_state: state,
    authority_delta: 0,
    escalate_to_human: true,
    restoration_reason: restorationReason,
    reason,
  });
}

/** Report an already-settled transaction by CLASS, never by assumption. */
function reportSettled({ state, context, reason, restorationReason = null }) {
  const recoveryClass = classifySettledMechanicalRecovery({ state, context });
  if (recoveryClass === "VERIFIED_ROLLBACK") {
    return rollbackSettled({
      state,
      terminalOutcome: state.terminal_outcome,
      reason,
      recoveryMode: state.events.find((e) => e.phase === "BEFORE_STATE_VERIFIED")
        ?.evidence_refs?.[0]?.recovery_mode ?? null,
    });
  }
  if (recoveryClass === "RECOVERY_REQUIRED") {
    return rollbackQualifiedRecovery({ state, reason, restorationReason });
  }
  // A RECOVERY_REQUIRED terminal that failed qualification still needs recovery.
  if (state?.terminal_outcome === "RECOVERY_REQUIRED") {
    return rollbackRecoveryUnqualified({ state, recoveryClass, reason, restorationReason });
  }
  return rollbackNotQualified({ state, recoveryClass, reason });
}

/**
 * Settle one post-effect-boundary mechanical failure with durable proof.
 *
 * Produces exactly one of: verified rollback history
 * (ROLLBACK_STARTED → ROLLED_BACK → BEFORE_STATE_VERIFIED → RESOLVED), or an
 * explicit RECOVERY_REQUIRED with no destructive guess.
 *
 * Requires only the C1 claim identity, the transaction descriptor, the
 * transaction events, the persisted intent, and the observed world — so a fresh
 * process can complete a recovery the dead one started.
 *
 * @returns {Promise<Readonly<object>>} typed, immutable; never "COMPLETE"
 */
export async function settleMechanicalFailureWithVerifiedRollback({
  demaHome, claim, prepared = null, effect, failure, transactionState = null,
} = {}) {
  const home = resolveDemaHome(demaHome);
  const transactionId = claim?.transaction_id;
  const reason = failure?.reason ?? failure?.omega0_card?.reason ?? "mechanical_failure";
  if (typeof transactionId !== "string" || transactionId.length === 0) {
    return rollbackUnqualifiedRecovery({ state: transactionState, reason: "rollback_transaction_id_missing" });
  }

  // 1 — the transaction as DISK tells it, not as the caller remembers it.
  let state = await replayClosureTransaction({ demaHome: home, transactionId });
  if (!state.ok) {
    return rollbackUnqualifiedRecovery({ reason: `rollback_replay_refused:${state.reason}` });
  }
  if (!state.exists) {
    return rollbackUnqualifiedRecovery({ state, reason: "rollback_transaction_not_prepared" });
  }

  // 2 — AUTHORITATIVE CONTEXT, before any append and before any world mutation.
  //     Same derivation replay uses: descriptor shape, descriptor hash, chain
  //     binding, exactly one intent event, exactly one intent reference,
  //     intent hash re-derived from bytes, before_hash re-derived from the
  //     manifest, and the policy/checkpoint bindings.
  const bound = await readRollbackBindingContext({
    demaHome: home, transactionId, expectedHeadEventHash: state.head_event_hash,
  });
  if (!bound.ok) {
    return rollbackUnqualifiedRecovery({ state, reason: `rollback_binding_refused:${bound.reason}` });
  }
  // Continue on the FRESH disk state the derivation returned, never the snapshot
  // this function arrived with.
  state = bound.state;
  const context = bound.context;
  const intent = context.intent;
  const preparedIntentHash = context.prepared_intent_hash;

  // The caller's prepared object is supporting evidence only — it may never
  // replace the disk-derived context, and a disagreement is a hard stop.
  if (prepared?.prepared_intent_hash && prepared.prepared_intent_hash !== preparedIntentHash) {
    return rollbackUnqualifiedRecovery({ state, reason: "rollback_prepared_intent_disagrees_with_disk" });
  }

  // 3 — already settled: classify, never assume.
  if (state.terminal) return reportSettled({ state, context, reason });

  // 4 — the ledger is the authority past this line; a rollback would contradict
  //     a signed receipt. Forward reconciliation is C4C, not this writer.
  if (POST_LEDGER_PHASES.includes(state.phase)) {
    return rollbackUnqualifiedRecovery({
      state, reason: "rollback_after_ledger_authority_forbidden",
    });
  }

  // 5 — durability uncertainty: prove WHICH head is canonical, then decide.
  if (isDurabilityUncertain(failure)) {
    if (!eventDirectoryDurable(home, transactionId)) {
      return rollbackUnqualifiedRecovery({ state, reason: "rollback_durability_unresolved:fsync_failed" });
    }
    state = await replayClosureTransaction({ demaHome: home, transactionId });
    if (!state.ok || !state.exists) {
      return rollbackUnqualifiedRecovery({ reason: "rollback_durability_unresolved:replay_unverifiable" });
    }
    if (state.terminal) return reportSettled({ state, context, reason });
    const decided = decideUncertainResume({
      state, intendedPhase: UNCERTAIN_INTENDED_PHASE[failure?.stage] ?? null,
    });
    if (!decided.ok) {
      // No helper mutation, no effect retry, no phase on an unproven head.
      return rollbackUnqualifiedRecovery({
        state, reason: `rollback_durability_unresolved:${decided.resume.toLowerCase()}`,
      });
    }
  }

  const atIso = state.events[0].at_iso;

  // 6 — ROLLBACK_STARTED: durable recovery adjudication begins, and FREEZES the
  //     intended terminal outcome. No recovery helper may mutate anything until
  //     this event has settled.
  if (!hasPhase(state, "ROLLBACK_STARTED")) {
    const started = await appendDurableClosurePhase({
      demaHome: home,
      transactionId,
      phase: "ROLLBACK_STARTED",
      evidenceRefs: [{
        schema: CORRIDOR_ROLLBACK_STARTED_EVIDENCE_SCHEMA,
        transaction_hash: context.transaction_hash,
        prepared_intent_hash: preparedIntentHash,
        // FROZEN: the cause and the objective.
        failure_stage: failureStageCode(failure),
        failure_reason_code: classifyMechanicalFailureReasonCode(failure),
        recovery_objective: "RESTORE_EXACT_BEFORE_STATE",
        // FROZEN as the two outcomes the MEASUREMENT may select between —
        // not as a claim that the first one is already the final result.
        rollback_success_outcome: classifyMechanicalFailureOutcome(failure),
        recovery_fallback_outcome: ROLLBACK_FALLBACK_OUTCOME,
      }],
      atIso,
    });
    if (!started.ok) {
      // The helper was NOT called. The world is exactly where the failure left it.
      return rollbackUnqualifiedRecovery({
        state, reason: `rollback_started_not_durable:${started.reason}`,
      });
    }
    state = started.state;
  }

  // 7 — THE DURABLE ADJUDICATION IS THE AUTHORITY FROM HERE ON.
  //     A retry carrying a differently-classifying failure object is
  //     non-authoritative context; it can never rewrite what was frozen.
  const startedEvent = state.events.find((e) => e.phase === "ROLLBACK_STARTED");
  const invalidAdjudication = validateRollbackStartedEvidence(startedEvent?.evidence_refs, context);
  if (invalidAdjudication !== null) {
    return rollbackUnqualifiedRecovery({
      state, reason: `rollback_adjudication_invalid:${invalidAdjudication}`,
    });
  }
  const adjudication = startedEvent.evidence_refs[0];
  const durableOutcome = adjudication.rollback_success_outcome;
  const fallbackOutcome = adjudication.recovery_fallback_outcome;

  // 8 — MEASURE the recovery. The helper is idempotent by observation and
  //     refuses a world it does not recognise, so attempting it is always safe:
  //     it can restore, or it can report that it cannot. What it may never do is
  //     guess. The result of this measurement — not the adjudication — decides
  //     which of the two frozen outcomes applies.
  let restoration = null;
  if (!hasPhase(state, "BEFORE_STATE_VERIFIED")) {
    restoration = restoreToBeforeState({ intent, effect });
  }

  // 9 — restoration failed or could not be verified: degrade monotonically to
  //     the frozen fallback. This is lawful even when the adjudication reserved
  //     EXECUTION_FAILED_ROLLED_BACK for success — that outcome was always
  //     conditional on exact restoration holding.
  if (restoration && restoration.ok !== true) {
    if (!hasPhase(state, "RECOVERY_REQUIRED")) {
      const flagged = await appendDurableClosurePhase({
        demaHome: home,
        transactionId,
        phase: "RECOVERY_REQUIRED",
        evidenceRefs: [{
          schema: CORRIDOR_ROLLBACK_RECOVERY_EVIDENCE_SCHEMA,
          prepared_intent_hash: preparedIntentHash,
          failure_reason_code: adjudication.failure_reason_code,
          restoration_reason_code: restorationReasonCode(restoration?.reason),
        }],
        atIso,
      });
      if (!flagged.ok) {
        return rollbackUnqualifiedRecovery({
          state, reason: `rollback_recovery_not_durable:${flagged.reason}`,
          restorationReason: restoration?.reason ?? null,
        });
      }
      state = flagged.state;
    }
    const resolved = await appendDurableClosurePhase({
      demaHome: home,
      transactionId,
      phase: "RESOLVED",
      terminalOutcome: fallbackOutcome,
      evidenceRefs: [{
        schema: CORRIDOR_ROLLBACK_TERMINAL_EVIDENCE_SCHEMA,
        prepared_intent_hash: preparedIntentHash,
        terminal_outcome: fallbackOutcome,
      }],
      atIso,
    });
    if (!resolved.ok) {
      return rollbackUnqualifiedRecovery({
        state, reason: `rollback_recovery_terminal_not_durable:${resolved.reason}`,
        restorationReason: restoration?.reason ?? null,
      });
    }
    // Classify the settled recovery chain: only a fully adjudicated one
    // qualifies, and a rollback intent that failed to restore never does.
    return reportSettled({
      state: resolved.state, context, reason,
      restorationReason: restoration?.reason ?? null,
    });
  }

  // 10 — verified rollback. The proof discloses the mode the helper actually
  //      used, so an already-restored world is never dressed up as an inverse.
  const proof = restoration ?? null;
  if (!hasPhase(state, "ROLLED_BACK")) {
    const rolled = await appendDurableClosurePhase({
      demaHome: home,
      transactionId,
      phase: "ROLLED_BACK",
      evidenceRefs: [{
        schema: CORRIDOR_ROLLBACK_COMPLETED_EVIDENCE_SCHEMA,
        prepared_intent_hash: preparedIntentHash,
        before_hash: intent.before_hash,
        restored_hash: proof?.restored_hash ?? intent.before_hash,
        recovery_mode: proof?.recovery_mode ?? "ALREADY_BEFORE_STATE",
      }],
      atIso,
    });
    if (!rolled.ok) {
      return rollbackUnqualifiedRecovery({ state, reason: `rolled_back_not_durable:${rolled.reason}` });
    }
    state = rolled.state;
  }

  if (!hasPhase(state, "BEFORE_STATE_VERIFIED")) {
    const verified = await appendDurableClosurePhase({
      demaHome: home,
      transactionId,
      phase: "BEFORE_STATE_VERIFIED",
      evidenceRefs: [{
        schema: BEFORE_STATE_VERIFIED_EVIDENCE_SCHEMA,
        prepared_intent_hash: preparedIntentHash,
        before_hash: proof.before_hash,
        restored_hash: proof.restored_hash,
        restoration_verified: true,
        recovery_mode: proof.recovery_mode,
        undo_success_pct: proof.undo_success_pct,
      }],
      atIso,
    });
    if (!verified.ok) {
      return rollbackUnqualifiedRecovery({
        state, reason: `before_state_verified_not_durable:${verified.reason}`,
      });
    }
    state = verified.state;
  }

  const resolved = await appendDurableClosurePhase({
    demaHome: home,
    transactionId,
    phase: "RESOLVED",
    terminalOutcome: durableOutcome,
    evidenceRefs: [{
      schema: CORRIDOR_ROLLBACK_TERMINAL_EVIDENCE_SCHEMA,
      prepared_intent_hash: preparedIntentHash,
      terminal_outcome: durableOutcome,
    }],
    atIso,
  });
  if (!resolved.ok) {
    // The restoration proof is durable; only the terminal is missing. A retry
    // resumes from BEFORE_STATE_VERIFIED and reuses this exact frozen outcome.
    return rollbackUnqualifiedRecovery({
      state, reason: `rollback_resolved_not_durable:${resolved.reason}`,
    });
  }
  // Report by CLASS: the chain must prove itself even to its own writer.
  return reportSettled({ state: resolved.state, context, reason });
}

// ── C4B2B.1 — CROSS-ARTIFACT RECOVERY-STOP VERIFIER ─────────────────────────
//
// The STOP gate proves the stop was PERMITTED at the moment it happened. This
// proves, later and independently, WHICH verified failure made it necessary:
//
//   corridor STOPPED event
//     → recovery_stop_binding
//       → the exact C2 transaction descriptor
//         → the exact terminal event hash
//           → the exact RECOVERY_REQUIRED suffix
//             → a qualified RECOVERY_REQUIRED classification
//
// A note naming the transaction is tamper-evident because the event is hashed,
// but it is not a machine-checkable proof relationship. This is.

/**
 * Re-prove a recovery-caused corridor STOPPED event against C2 on disk.
 *
 * @returns {Promise<Readonly<{ok:boolean, reason?:string, recovery_class?:string}>>}
 */
export async function verifyRecoveryStopBinding({ demaHome, event } = {}) {
  const fail = (reason) => Object.freeze({ ok: false, reason });
  if (!event || typeof event !== "object") return fail("event_missing");
  if (event.state !== "STOPPED") return fail("event_not_stopped");
  if (event.terminal_outcome !== "RECOVERY_REQUIRED") return fail("event_outcome_not_recovery_required");
  const binding = event.recovery_stop_binding;
  if (!binding || typeof binding !== "object" || Array.isArray(binding)) {
    return fail("recovery_stop_binding_missing");
  }
  if (binding.schema !== CORRIDOR_RECOVERY_STOP_BINDING_SCHEMA) {
    return fail("recovery_stop_binding_schema_mismatch");
  }
  if (binding.terminal_outcome !== "RECOVERY_REQUIRED") {
    return fail("recovery_stop_binding_terminal_outcome_invalid");
  }

  const home = resolveDemaHome(demaHome);
  // Disk is the authority. Nothing in the binding is trusted; every field is
  // re-derived and compared.
  const bound = await readRollbackBindingContext({
    demaHome: home, transactionId: binding.closure_transaction_id,
  });
  if (!bound.ok) return fail(`closure_transaction_unverifiable:${bound.reason}`);

  if (bound.context.transaction_hash !== binding.transaction_hash) {
    return fail("transaction_hash_mismatch");
  }
  if (bound.context.prepared_intent_hash !== binding.prepared_intent_hash) {
    return fail("prepared_intent_hash_mismatch");
  }
  // A head that advanced or differs means this binding no longer describes the
  // transaction it claims to.
  if (bound.state.head_event_hash !== binding.terminal_event_hash) {
    return fail("terminal_event_hash_mismatch");
  }
  if (bound.state.terminal !== true) return fail("closure_transaction_not_settled");
  if (bound.state.terminal_outcome !== "RECOVERY_REQUIRED") {
    return fail("closure_transaction_outcome_not_recovery_required");
  }

  const recoveryClass = classifySettledMechanicalRecovery({
    state: bound.state, context: bound.context,
  });
  if (recoveryClass !== "RECOVERY_REQUIRED") {
    return fail(`closure_transaction_unqualified:${recoveryClass}`);
  }
  return Object.freeze({ ok: true, recovery_class: recoveryClass });
}

/**
 * Bind the weld's injected `appendReceipt` to the on-disk canonical ledger.
 *
 * Translation layer, deliberately narrow: the weld speaks {ok, head}; the
 * ledger speaks {appended, head}. The ledger's consent argument is a fixed
 * module API constant (not operator authority) — the operator's authority was
 * already established by the corridor consent gate before this point.
 */
export function buildLedgerAppender({ demaHome, now, transactionId = null }) {
  const home = resolveDemaHome(demaHome);
  return async ({ canonicalBody, truthLabel }) => {
    if (transactionId !== null) {
      if (canonicalBody?.closure_transaction_id !== transactionId) {
        throw new Error("ledger append refused: closure_transaction_id_mismatch");
      }
      const entries = await loadCanonicalLedger({ demaHome: home });
      if (entries.length > 0) {
        const publicKey = await loadPublicKey(home);
        const verified = verifyCanonicalChain({ entries, pubkeyPem: publicKey });
        if (!verified.verified) {
          throw new Error(`ledger append refused: existing_chain_${verified.reason}`);
        }
      }
      const matches = entries
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => entry?.canonical_body?.closure_transaction_id === transactionId);
      if (matches.length > 1) {
        throw new Error("ledger append refused: duplicate_closure_transaction_id");
      }
      if (matches.length === 1) {
        const { entry, index } = matches[0];
        let sameBody = false;
        try {
          sameBody = sha256CanonicalJsonV1(entry.canonical_body)
            === sha256CanonicalJsonV1(canonicalBody);
        } catch { /* conflict reported below */ }
        if (!sameBody || entry.truth_label !== truthLabel || entry.created_at_iso !== now) {
          throw new Error("ledger append refused: closure_transaction_semantic_conflict");
        }
        return Object.freeze({
          ok: true,
          head: entry.receipt_id,
          length: index + 1,
          receipt: entry,
          idempotent: true,
        });
      }
    }
    const r = await appendCanonicalReceipt({
      canonicalBody,
      truthLabel,
      // The receipt's created_at_iso is committed to receipt_id and signature.
      // It comes from the caller's already-consented `now`, never a fresh clock
      // read here, so the receipt cannot drift from the authorised transition.
      now,
      whatProves:
        "One consent-bound corridor effect reached Omega0 SEALED and this signed receipt was appended to the canonical ledger as evidence for C2 LEDGER_COMMITTED; no later closure boundary is claimed",
      whatDoesNotProve:
        "Federation, token economy, PoI rewards, autonomous PAT/SAT, verification by any separate process/key/organisation (the verifier runs IN-PROCESS inside the same trust boundary), power-loss durability of the rename itself, or that the mission's objective was useful to a human",
      consent: CANONICAL_RECEIPT_CONSENT_PHRASE,
      demaHome: home,
    });
    // Throw with the LEDGER's own reason. The weld turns any throw here into
    // LEDGER_COMMIT_FAILED_NO_COMPLETE and records the message, so a generic
    // "refused" would erase the one detail an operator needs (no key, broken
    // chain, unreadable ledger) from the terminal event.
    if (r.appended !== true) throw new Error(`ledger append refused: ${r.error ?? "unknown"}`);
    return Object.freeze({ ok: true, head: r.head, length: r.length, receipt: r.receipt, idempotent: false });
  };
}

/** Observe the live receipt chain: what the anchor is a claim ABOUT. */
export async function observeCanonicalLedger({ demaHome }) {
  const entries = await loadCanonicalLedger({ demaHome: resolveDemaHome(demaHome) });
  return Object.freeze({
    entries: entries.length,
    head: entries.length ? entries[entries.length - 1].receipt_id : null,
    head_history: Object.freeze(entries.map((e) => e.receipt_id)),
  });
}

function anchorLogPath(demaHome) {
  return join(resolveDemaHome(demaHome), CORRIDOR_CLOSURE_ANCHOR_RELPATH);
}

/** Read the anchor log. A missing log is an empty log; a corrupt line throws. */
export function readClosureAnchorLog({ demaHome }) {
  let raw;
  try {
    raw = readFileSync(anchorLogPath(demaHome), "utf8");
  } catch (err) {
    if (err && err.code === "ENOENT") return [];
    throw err; // an unreadable anchor log must never masquerade as "no anchor"
  }
  return raw.split("\n").filter((l) => l.trim().length > 0).map((l) => JSON.parse(l));
}

function readCanonicalLedgerHeadsSync(demaHome) {
  let raw;
  try {
    raw = readFileSync(join(resolveDemaHome(demaHome), CANONICAL_LEDGER_RELPATH), "utf8");
  } catch (err) {
    throw pathRefusal(
      "closure_anchor_ledger_unavailable",
      `closure anchor ledger unavailable: ${err?.code ?? "unknown"}`,
    );
  }
  return raw.split("\n").filter((line) => line.trim().length > 0).map((line, index) => {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      throw pathRefusal("closure_anchor_ledger_unparseable", `ledger entry ${index} is not JSON`);
    }
    if (typeof entry?.receipt_id !== "string" || !/^[0-9a-f]{64}$/.test(entry.receipt_id)) {
      throw pathRefusal("closure_anchor_ledger_head_invalid", `ledger entry ${index} has no canonical head`);
    }
    return entry.receipt_id;
  });
}

function fsyncPathAndParent(path) {
  let fileFd = null;
  let parentFd = null;
  try {
    fileFd = openSync(path, "r");
    fsyncSync(fileFd);
    closeSync(fileFd);
    fileFd = null;
    parentFd = openSync(dirname(path), "r");
    fsyncSync(parentFd);
    closeSync(parentFd);
    parentFd = null;
  } finally {
    if (fileFd !== null) closeSync(fileFd);
    if (parentFd !== null) closeSync(parentFd);
  }
}

function writeAllSync(fd, value) {
  const bytes = Buffer.from(value, "utf8");
  let offset = 0;
  while (offset < bytes.length) {
    const written = writeSync(fd, bytes, offset, bytes.length - offset);
    if (written <= 0) throw pathRefusal("closure_anchor_short_write");
    offset += written;
  }
}

/**
 * Append a new anchor record AFTER the artifact it testifies about exists.
 * Anchoring before the append would testify about a chain state that the very
 * next write invalidates — the witness must outlive, not precede, the act.
 * The production caller holds the global closure-tail lock across ledger and
 * anchor publication; this function revalidates monotonic ledger-prefix facts
 * inside that serialized boundary and durably acknowledges its own write.
 */
export function appendClosureAnchor({ demaHome, entries, head }) {
  const path = anchorLogPath(demaHome);
  const parent = dirname(path);
  mkdirSync(parent, { recursive: true, mode: 0o700 });
  const log = readClosureAnchorLog({ demaHome });
  const verified = verifyAnchorLog(log, sha256);
  if (!verified.intact) throw new Error(`closure_anchor_log_${verified.verdict.toLowerCase()}`);

  const ledgerHeads = readCanonicalLedgerHeadsSync(demaHome);
  if (!Number.isInteger(entries) || entries < 1 || entries > ledgerHeads.length) {
    throw pathRefusal("closure_anchor_ledger_prefix_missing");
  }
  if (ledgerHeads[entries - 1] !== head) {
    throw pathRefusal("closure_anchor_head_not_in_ledger_prefix");
  }

  const exact = log.filter((record) => record.entries === entries && record.head === head);
  if (exact.length > 1) throw new Error("closure_anchor_duplicate_semantics");
  if (exact.length === 1) {
    fsyncPathAndParent(path);
    return exact[0];
  }

  const last = log.length ? log[log.length - 1] : null;
  if (last) {
    if (entries <= last.entries) throw pathRefusal("closure_anchor_not_monotonic");
    if (ledgerHeads[last.entries - 1] !== last.head) {
      throw pathRefusal("closure_anchor_prior_prefix_forked");
    }
  }
  if (log.some((record) => record.entries === entries || record.head === head)) {
    throw new Error("closure_anchor_semantic_conflict");
  }

  const record = buildAnchorRecord({
    chain_id: CORRIDOR_CLOSURE_CHAIN_ID,
    entries,
    head,
    previous: last,
    hash: sha256,
    at: null, // no clock in the anchor body: the record is content-addressed
  });
  let anchorFd = null;
  try {
    anchorFd = openSync(path, "a", 0o600);
    writeAllSync(anchorFd, `${JSON.stringify(record)}\n`);
    fsyncSync(anchorFd);
    closeSync(anchorFd);
    anchorFd = null;
  } finally {
    if (anchorFd !== null) closeSync(anchorFd);
  }
  const parentFd = openSync(parent, "r");
  try {
    fsyncSync(parentFd);
  } finally {
    closeSync(parentFd);
  }
  return record;
}

/**
 * The bounded effect: ONE rename inside the leased scope.
 *
 * Omega0 verifies `file_count_preserved` and zero `source_loss`, so the act must
 * conserve content — a rename qualifies, a create does not. The adapter never
 * reports its own success: Omega0 recomputes the manifest itself (design law 4).
 *
 * Every method is synchronous because runMechanicalClosure calls them
 * synchronously; the ledger observation is computed beforehand and injected.
 */
export function buildRenameEffectAdapter({ scopeRoot, from, to, anchorLog = [], observed = null }) {
  const root = resolve(scopeRoot);
  if (!renameOperand(root, from) || !renameOperand(root, to)) {
    throw new Error("rename_operand_outside_scope");
  }
  if (from === to) throw new Error("rename_operands_identical");

  const initialRootIdentity = captureDirectoryIdentity(root);
  let boundRootIdentity = initialRootIdentity;
  let boundIntent = null;
  const expectedPlan = JSON.stringify([{ op: "rename", from, to }]);

  const validatePlan = (plan) => {
    if (JSON.stringify(plan) !== expectedPlan) {
      throw pathRefusal("rename_plan_mismatch", "rename adapter received a plan it did not propose");
    }
  };

  const withRoot = (fn) => withBoundDirectory(root, boundRootIdentity, fn);

  const publishNoReplace = (boundRoot, op) => {
    const source = join(boundRoot, op.from);
    const target = join(boundRoot, op.to);
    const sourceIdentity = regularFileIdentity(source);
    if (boundIntent?.source_file_identity
        && !sameFileIdentity(sourceIdentity, boundIntent.source_file_identity)) {
      throw pathRefusal("rename_source_identity_mismatch", "rename source changed after consent");
    }

    try {
      // link(2) is the no-replace publication primitive available in Node for a
      // regular file. Unlike stat→rename, EEXIST is decided atomically by the
      // filesystem and the target is never overwritten.
      linkSync(source, target);
    } catch (err) {
      if (err?.code === "EEXIST") {
        throw pathRefusal("rename_target_exists", `rename target already exists: ${op.to}`);
      }
      throw err;
    }

    const targetIdentity = regularFileIdentity(target);
    if (!sameFileIdentity(sourceIdentity, targetIdentity)) {
      const err = pathRefusal(
        "rename_publication_identity_mismatch",
        "published rename target does not identify the source inode",
      );
      err.recovery_class = "RECOVERY_REQUIRED";
      throw err;
    }

    try {
      unlinkSync(source);
    } catch (cause) {
      // Process death or unlink failure here leaves two names for one inode.
      // That exact state is measured and recoverable on the next invocation;
      // an arbitrary occupied target is never treated as equivalent.
      const err = pathRefusal(
        "rename_source_unlink_pending",
        `rename target published but source unlink is pending: ${cause?.code ?? "unknown"}`,
      );
      err.recovery_class = "RECOVERY_REQUIRED";
      err.cause = cause;
      throw err;
    }
  };

  const expectedIntermediateManifest = (intent) => {
    const sourceEntry = intent.before_manifest.find((entry) => entry.path === from);
    if (!sourceEntry) return null;
    return [...intent.before_manifest, { ...sourceEntry, path: to }]
      .sort((a, b) => a.path.localeCompare(b.path));
  };

  const inspectIntermediate = (boundRoot, intent) => {
    const expected = expectedIntermediateManifest(intent);
    if (!expected) return Object.freeze({ recoverable: false });
    let sourceIdentity;
    let targetIdentity;
    try {
      sourceIdentity = regularFileIdentity(join(boundRoot, from));
      targetIdentity = regularFileIdentity(join(boundRoot, to));
    } catch {
      return Object.freeze({ recoverable: false });
    }
    const observedManifest = readRenameManifest(boundRoot);
    const recoverable = sameFileIdentity(sourceIdentity, targetIdentity)
      && sameFileIdentity(sourceIdentity, intent.source_file_identity)
      && sha256(JSON.stringify(observedManifest)) === sha256(JSON.stringify(expected));
    return Object.freeze({
      recoverable,
      kind: recoverable ? "NO_REPLACE_TARGET_PUBLISHED_SOURCE_LINK_PENDING" : null,
    });
  };

  return Object.freeze({
    bindPreparedIntent(intent) {
      if (intent?.scope_root !== root
          || !sameDirectoryIdentity(intent?.scope_root_identity, initialRootIdentity)
          || JSON.stringify(intent?.plan) !== expectedPlan) {
        throw pathRefusal("rename_root_identity_mismatch", "prepared rename intent is not bound to this root");
      }
      assertDirectoryIdentity(root, intent.scope_root_identity);
      boundRootIdentity = intent.scope_root_identity;
      boundIntent = intent;
      return true;
    },
    propose: () => withRoot(() => [{ op: "rename", from, to }]),
    manifest: () => withRoot((boundRoot) => readRenameManifest(boundRoot)),
    classifyRecoverableIntermediate(intent) {
      validatePlan(intent?.plan);
      return withRoot((boundRoot) => inspectIntermediate(boundRoot, intent));
    },
    recoverIntermediate(intent) {
      validatePlan(intent?.plan);
      return withRoot((boundRoot) => {
        const inspected = inspectIntermediate(boundRoot, intent);
        if (!inspected.recoverable) {
          throw pathRefusal("rename_intermediate_state_mismatch", "rename intermediate is not recoverable");
        }
        unlinkSync(join(boundRoot, from));
        const after = readRenameManifest(boundRoot);
        if (sha256(JSON.stringify(after)) !== intent.expected_after_hash) {
          throw pathRefusal("rename_intermediate_completion_failed", "pending source unlink did not reach expected state");
        }
        return { applied: intent.plan };
      });
    },
    // BACKWARD twin of recoverIntermediate(). That one unlinks the SOURCE to
    // complete forward to expected_after; this one unlinks the TARGET to return
    // to before. They are deliberately separate methods with opposite meanings:
    // reusing the forward one during a rollback would finish the very operation
    // the caller is abandoning.
    //
    // inspectIntermediate is the whole guard — it proves both names identify the
    // consented inode AND the observed manifest equals the expected two-link
    // state. Only the target link is retired; the original source name and inode
    // are never touched. Any mismatch fails closed with no mutation.
    restoreIntermediateBackward(intent) {
      validatePlan(intent?.plan);
      return withRoot((boundRoot) => {
        const inspected = inspectIntermediate(boundRoot, intent);
        if (!inspected.recoverable) {
          throw pathRefusal(
            "rename_intermediate_state_mismatch",
            "rename intermediate is not the consented two-link state",
          );
        }
        unlinkSync(join(boundRoot, to));
        const after = readRenameManifest(boundRoot);
        if (sha256(JSON.stringify(after)) !== intent.before_hash) {
          throw pathRefusal(
            "rename_backward_restoration_failed",
            "target unlink did not reach the durable before state",
          );
        }
        return Object.freeze({ restored: true, restored_hash: intent.before_hash });
      });
    },
    apply(plan) {
      validatePlan(plan);
      withRoot((boundRoot) => {
        for (const op of plan) publishNoReplace(boundRoot, op);
      });
      return { applied: plan };
    },
    recoverApplied(plan) {
      validatePlan(plan);
      // State classification happens in applyPreparedMechanicalClosure before
      // this hook is reached. This reconstructs only the undo handle; it does
      // not publish another target after process death in expected post-state.
      withRoot((boundRoot) => {
        const targetIdentity = regularFileIdentity(join(boundRoot, to));
        if (boundIntent?.source_file_identity
            && !sameFileIdentity(targetIdentity, boundIntent.source_file_identity)) {
          throw pathRefusal("rename_target_identity_mismatch", "recovered target is not the consented source inode");
        }
      });
      return { applied: plan };
    },
    undo(applied) {
      const plan = applied?.applied ?? [{ op: "rename", from, to }];
      validatePlan(plan);
      withRoot((boundRoot) => {
        for (const op of [...plan].reverse()) {
          publishNoReplace(boundRoot, { from: op.to, to: op.from });
        }
      });
      return true;
    },
    anchorState: () => ({ anchorLog, observed }),
  });
}
