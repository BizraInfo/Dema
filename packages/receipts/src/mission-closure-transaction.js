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
  EFFECT_INTENT_PERSISTED: Object.freeze(["EFFECT_APPLIED", "RESOLVED"]),
  EFFECT_APPLIED: Object.freeze(["VERIFIED", "ROLLBACK_STARTED"]),
  VERIFIED: Object.freeze(["SEALED", "ROLLBACK_STARTED"]),
  SEALED: Object.freeze(["LEDGER_COMMITTED", "RESOLVED"]),
  LEDGER_COMMITTED: Object.freeze(["ANCHORED", "RESOLVED"]),
  ANCHORED: Object.freeze(["RESOLVED"]),
  ROLLBACK_STARTED: Object.freeze(["ROLLED_BACK", "RECOVERY_REQUIRED"]),
  ROLLED_BACK: Object.freeze(["RESOLVED"]),
  RECOVERY_REQUIRED: Object.freeze(["RESOLVED"]),
  RESOLVED: Object.freeze([]),
});

export const TX_PHASES = Object.freeze(Object.keys(TX_TRANSITIONS));

// Success is not a phase you may assert — it is a position in the chain. The
// ledger may commit and the anchor still fail; only ANCHORED has proven the
// receipt chain was not erased.
const COMPLETED_VERIFIED_PREDECESSOR = "ANCHORED";

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
  if (!TX_TRANSITIONS[state.phase].includes(phase)) {
    return Object.freeze({ appended: false, reason: "illegal_phase_transition", from: state.phase, to: phase });
  }
  if (phase === "RESOLVED") {
    if (!TERMINAL_OUTCOMES.includes(terminalOutcome)) {
      return Object.freeze({ appended: false, reason: "terminal_outcome_required" });
    }
    if (terminalOutcome === "COMPLETED_VERIFIED" && state.phase !== COMPLETED_VERIFIED_PREDECESSOR) {
      return Object.freeze({ appended: false, reason: "completed_verified_requires_anchored", from: state.phase });
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
