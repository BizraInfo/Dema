// CONSENT-NONCE-CLAIM-1A — the ONE canonical atomic consent claim (Gate C).
//
// Replaces two divergent replay authorities that could not see each other:
//
//   missions/consent-nonces/<sha256(nonce)>.json   CLI reservation, digest-keyed
//   consent/nonces/<raw nonce>.json                weld registry, raw-keyed
//
// Measured on disk after a single closure: 8 nonces consumed by the CLI, 1 visible
// to the weld. A nonce spent by one authority was simply invisible to the other.
//
// ── THE LAW ──
// ONE exclusive create IS the claim. There is deliberately no `has()` that an
// executing route may call before `add()`: that sequence lets two callers both
// observe "unused", both perform their effects, and only afterwards compete to
// record. A per-mission lock cannot fix it because the race is ACROSS missions.
// The filesystem arbitrates, once, before the first world-changing effect.
//
// There is NO second "consumed" record and NO phase named CONSUMED anywhere.
// Existence of this file IS consumption. A second record — or a journal phase
// that could disagree with it — would reintroduce the two-step this module
// exists to remove: a claim that succeeds while its consumption fails.
// The transaction history may RECORD consent_claim_hash; it may never flip it.
//
// Resume is by transaction_id: the SAME transaction re-reading its own claim is
// recovery; any OTHER transaction is replay and is refused. That distinction is
// the whole difference between "continue what was authorised" and "authorise
// again".
//
// I/O tier by design (allowlisted). All paths under DEMA_HOME. No network.

import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export const CONSENT_NONCE_CLAIM_SCHEMA = "bizra.dema.consent_nonce_claim.v1";
export const CONSENT_NONCE_DOMAIN = "BIZRA:CORRIDOR_WRITE:v1";
export const CONSENT_NONCE_RELDIR = join("consent", "nonces-v1");

// Read-only recognition of the two superseded stores. Their bytes are never
// rewritten and never migrated: a legacy marker means CONSUMED, full stop, and
// the refusal names which store held it.
export const LEGACY_NAMESPACES = Object.freeze({
  cliReservation: join("missions", "consent-nonces"),
  weldRegistry: join("consent", "nonces"),
});

// PATH KEY ONLY. Domain-separated so this digest can never collide with any
// other sha256 in the system, and deliberately derived from the raw nonce ALONE:
// mixing mission_id or action_kind into the key would create per-mission replay
// domains in which one nonce could win more than once.
const DIGEST_PREFIX = "BIZRA:CONSENT_NONCE:KEY:v1\0";

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

/** Path-safe by construction: the raw nonce NEVER becomes a filesystem path. */
export function nonceDigest(nonce) {
  return sha256(DIGEST_PREFIX + String(nonce));
}

// The legacy weld store keyed by the RAW nonce. Only a nonce that could actually
// have been written there is worth looking for — and looking for anything else
// would itself be the traversal this module forbids.
const LEGACY_RAW_SAFE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
// Shape policy on the raw input. Separators and dots are permitted because the
// digest absorbs them; NUL and empty are not, because they signal a caller bug.
const NONCE_SHAPE_RE = /^[^\0]{1,512}$/;

function resolveHome(demaHome) {
  if (typeof demaHome === "string" && demaHome.length > 0) return demaHome;
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

const claimDir = (home) => join(home, CONSENT_NONCE_RELDIR);
const claimPath = (home, digest) => join(claimDir(home), `${digest}.json`);

function claimBody(p, digest) {
  return {
    schema: CONSENT_NONCE_CLAIM_SCHEMA,
    domain: p.domain ?? CONSENT_NONCE_DOMAIN,
    nonce_digest: digest,
    action_class: p.actionClass ?? null,
    action_kind: p.actionKind ?? null,
    mission_id: p.missionId ?? null,
    contract_hash: p.contractHash ?? null,
    consent_context_hash: p.consentContextHash ?? null,
    transaction_id: p.transactionId ?? null,
    // Write-ahead GENESIS. A crash between the claim and the first transaction
    // event must still be recoverable, so the claim itself carries the intent and
    // the recovery policy — not just the fact that authority was spent.
    checkpoint_event_hash: p.checkpointEventHash ?? null,
    prepared_intent_hash: p.preparedIntentHash ?? null,
    recovery_policy_hash: p.recoveryPolicyHash ?? null,
    claimed_at_iso: p.claimedAtIso ?? null,
  };
}

const hashClaim = (body) => sha256(JSON.stringify(body));
const stripHash = (rec) => { const { claim_hash: _drop, ...rest } = rec ?? {}; return rest; };

async function probePath(path) {
  try {
    await access(path);
    return Object.freeze({ present: true, error: null });
  } catch (err) {
    if (err?.code === "ENOENT") return Object.freeze({ present: false, error: null });
    return Object.freeze({ present: false, error: err?.code ?? "unknown" });
  }
}

/** Which superseded store, if any, already holds this nonce. */
async function legacyRefs(home, nonce) {
  const refs = [];
  const errors = [];
  // The retired CLI writer pre-dates C1's domain-separated key and wrote
  // missions/consent-nonces/<sha256(raw nonce)>.json. Compatibility must use
  // that exact historical algorithm; nonceDigest() is reserved for the new C1
  // namespace and deliberately produces a different key.
  const legacyCliDigest = sha256(String(nonce));
  const cli = join(home, LEGACY_NAMESPACES.cliReservation, `${legacyCliDigest}.json`);
  const cliProbe = await probePath(cli);
  if (cliProbe.error) {
    errors.push(Object.freeze({
      namespace: LEGACY_NAMESPACES.cliReservation,
      error: cliProbe.error,
    }));
  } else if (cliProbe.present) {
    refs.push(Object.freeze({
      namespace: LEGACY_NAMESPACES.cliReservation, key: "sha256(nonce)", status: "LEGACY_CONSUMED",
    }));
  }
  if (LEGACY_RAW_SAFE_RE.test(nonce)) {
    const weld = join(home, LEGACY_NAMESPACES.weldRegistry, `${nonce}.json`);
    const weldProbe = await probePath(weld);
    if (weldProbe.error) {
      errors.push(Object.freeze({
        namespace: LEGACY_NAMESPACES.weldRegistry,
        error: weldProbe.error,
      }));
    } else if (weldProbe.present) {
      refs.push(Object.freeze({
        namespace: LEGACY_NAMESPACES.weldRegistry, key: "raw", status: "LEGACY_CONSUMED",
      }));
    }
  }
  return Object.freeze({ refs: Object.freeze(refs), errors: Object.freeze(errors) });
}

/**
 * Claim one consent nonce, exactly once, globally.
 *
 * @returns {Promise<{claimed:true, claim:object}
 *                 | {claimed:false, reason:string, resumable:boolean,
 *                    existing_claim?:object, legacy_refs?:Array}>}
 */
export async function claimConsentNonce(p = {}) {
  const { nonce, demaHome } = p;
  if (typeof nonce !== "string" || !NONCE_SHAPE_RE.test(nonce)) {
    return Object.freeze({ claimed: false, reason: "consent_nonce_malformed", resumable: false });
  }
  const home = resolveHome(demaHome);
  const digest = nonceDigest(nonce);

  // Superseded stores are authoritative for REFUSAL only. Checked before the
  // create so a nonce spent under the old regime can never be re-won here.
  const legacy = await legacyRefs(home, nonce);
  if (legacy.errors.length > 0) {
    const error = legacy.errors[0].error;
    return Object.freeze({
      claimed: false,
      reason: `consent_nonce_legacy_lookup_failed_closed:${error}`,
      resumable: false,
      escalate_to_human: true,
      legacy_errors: legacy.errors,
    });
  }
  if (legacy.refs.length > 0) {
    return Object.freeze({
      claimed: false, reason: "consent_nonce_legacy_consumed", resumable: false,
      legacy_refs: legacy.refs,
    });
  }

  const body = claimBody(p, digest);
  const record = { ...body, claim_hash: hashClaim(body) };
  const path = claimPath(home, digest);
  await mkdir(claimDir(home), { recursive: true, mode: 0o700 });

  try {
    // THE claim. One exclusive create; the filesystem picks the winner.
    await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  } catch (err) {
    if (err?.code !== "EEXIST") {
      // Cannot prove unused ⇒ never grant. An unwritable registry is not an empty one.
      return Object.freeze({
        claimed: false, reason: `consent_nonce_claim_failed_closed:${err?.code ?? "unknown"}`, resumable: false,
      });
    }
    let existing = null;
    try { existing = JSON.parse(await readFile(path, "utf8")); } catch { existing = null; }
    // The PATH EXISTING is the fact. A body we cannot trust does not soften it:
    // the nonce is consumed, nothing may execute, and only a human may decide
    // what happened. Never reuse.
    if (existing === null || hashClaim(stripHash(existing)) !== existing.claim_hash) {
      return Object.freeze({
        claimed: false,
        reason: "consent_nonce_claim_unreadable_escalate",
        resumable: false,
        escalate_to_human: true,
        existing_claim: Object.freeze(existing ?? { corrupt: true }),
      });
    }
    // Same transaction re-reading its own claim is RECOVERY. Anything else is REPLAY.
    const sameTx = Boolean(p.transactionId) && existing.transaction_id === p.transactionId;
    if (sameTx) {
      // A matching transaction_id is NOT sufficient. Recovery may only continue
      // the transaction that was actually authorised, so every binding the claim
      // committed to must still agree. A caller presenting the same id with a
      // different action, mission, contract or consent context is not resuming —
      // it is trying to re-aim spent authority.
      const drift = [
        ["mission_id", p.missionId],
        ["contract_hash", p.contractHash],
        ["consent_context_hash", p.consentContextHash],
        ["action_kind", p.actionKind],
        ["action_class", p.actionClass],
        ["checkpoint_event_hash", p.checkpointEventHash],
        ["prepared_intent_hash", p.preparedIntentHash],
        ["recovery_policy_hash", p.recoveryPolicyHash],
      ].filter(([k, v]) => v !== undefined && existing[k] !== v).map(([k]) => k);
      if (drift.length > 0) {
        return Object.freeze({
          claimed: false,
          reason: "consent_nonce_binding_mismatch",
          resumable: false,
          escalate_to_human: true,
          drifted_fields: Object.freeze(drift),
          existing_claim: Object.freeze(existing),
        });
      }
    }
    return Object.freeze({
      claimed: false,
      reason: sameTx ? "consent_nonce_claimed_by_this_transaction" : "consent_nonce_already_claimed",
      resumable: sameTx,
      escalate_to_human: false,
      existing_claim: Object.freeze(existing),
    });
  }

  return Object.freeze({ claimed: true, claim: Object.freeze(record) });
}

/**
 * Read-only inspection. FAILS CLOSED: present-but-unreadable reads as USED, and
 * a body whose re-derived claim_hash disagrees is reported invalid rather than
 * trusted — the stored hash is never taken at its word.
 */
export async function inspectConsentNonce({ nonce, demaHome } = {}) {
  if (typeof nonce !== "string" || !NONCE_SHAPE_RE.test(nonce)) {
    return Object.freeze({ used: true, reason: "consent_nonce_malformed" });
  }
  const home = resolveHome(demaHome);
  const digest = nonceDigest(nonce);
  const legacy = await legacyRefs(home, nonce);
  if (legacy.errors.length > 0) {
    const error = legacy.errors[0].error;
    return Object.freeze({
      used: true,
      corrupt: true,
      reason: `consent_nonce_legacy_lookup_failed_closed:${error}`,
      escalate_to_human: true,
      legacy_errors: legacy.errors,
    });
  }
  let raw;
  try {
    raw = await readFile(claimPath(home, digest), "utf8");
  } catch (err) {
    if (err?.code === "ENOENT") {
      return Object.freeze({
        used: legacy.refs.length > 0, corrupt: false,
        legacy_refs: legacy.refs,
      });
    }
    return Object.freeze({ used: true, corrupt: true, reason: err?.code ?? "unreadable" });
  }
  let body;
  try { body = JSON.parse(raw); } catch {
    return Object.freeze({ used: true, corrupt: true, claim_hash_valid: false, escalate_to_human: true });
  }
  const { claim_hash: stored, ...rest } = body;
  const valid = hashClaim(rest) === stored;
  return Object.freeze({
    used: true,
    corrupt: false,
    claim_hash_valid: valid,
    // An edited claim body is not a softer state than a missing one.
    escalate_to_human: !valid,
    claim: Object.freeze(body),
    legacy_refs: legacy.refs,
  });
}

export const _internal = Object.freeze({
  DIGEST_PREFIX, NONCE_SHAPE_RE, LEGACY_RAW_SAFE_RE, claimDir, claimPath, hashClaim, probePath,
});
