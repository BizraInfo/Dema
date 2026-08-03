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
import {
  applyPreparedMechanicalClosure,
  finalizeAppliedMechanicalClosure,
  prepareMechanicalClosure,
  replaySeal,
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

  const applied = applyPreparedMechanicalClosure({ prepared: mechanicalPrepared, effect });
  if (applied.status !== "APPLIED") {
    return txRefusal(applied.reason ?? "mechanical_apply_blocked", {
      omega0_card: applied,
      transaction_state: intentPhase.state,
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
    return txRefusal(appliedPhase.reason ?? "effect_applied_persistence_failed", {
      omega0_card: applied,
      transaction_state: appliedPhase.state ?? intentPhase.state,
      effect_retry_forbidden: true,
    });
  }

  const sealed = finalizeAppliedMechanicalClosure({ applied, effect });
  if (sealed.status !== "SEALED") {
    return txRefusal(sealed.reason ?? "mechanical_finalize_blocked", {
      omega0_card: sealed,
      transaction_state: appliedPhase.state,
      effect_retry_forbidden: true,
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
    return txRefusal(verifiedPhase.reason ?? "verification_persistence_failed", {
      omega0_card: sealed,
      transaction_state: verifiedPhase.state ?? appliedPhase.state,
      effect_retry_forbidden: true,
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
    return txRefusal(sealedPhase.reason ?? "seal_persistence_failed", {
      omega0_card: sealed,
      transaction_state: sealedPhase.state ?? verifiedPhase.state,
      effect_retry_forbidden: true,
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
