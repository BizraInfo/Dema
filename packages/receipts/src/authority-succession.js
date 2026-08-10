// ISNAD-AUTHORITY-SUCCESSION-1A — the two halves of one authority transition.
//
// THE DISTINCTION THIS EXISTS FOR. A canonical receipt chain answers one
// question well and a second question not at all:
//
//   MATN INTEGRITY   did key K sign this exact canonical receipt body?
//   AUTHORITY SANAD  was K the legitimately established signing authority at
//                    this point in the chain?
//
// `verifyCanonicalChain` answered only the first, and answered the second by an
// unstated assumption — that whatever key is active now was always the
// authority. That assumption is false the moment the authorship key rotates.
// Measured at 0952c16: after a rotation, a previously verifying chain reports
// `signature_invalid` and no further receipt can be appended.
//
// WHY TWO HALVES AND NOT ONE ENTRY. The commit half must be written after the
// authority switch, and a single atomic append across that boundary cannot
// exist. A pre-written entry claiming completed succession would be false
// evidence if the switch never happened. So the transition is a LINK that spans
// the boundary:
//
//   INTENT   signed by K_old, BEFORE the pointer moves
//            "K_old authorizes this exact K_new as successor for transaction T"
//            It does NOT claim K_new is authoritative.
//
//   COMMIT   signed by K_new, AFTER the pointer selects K_new
//            "K_new proves possession and attests completion of exactly the
//             succession K_old authorized"
//
// Neither half alone establishes succession. The valid pair does, and a crash
// between them leaves an intent with no commit — a legible state, not an
// ambiguous one.
//
// ROOT TRUST IS EXTERNAL. Nothing here anchors on the current active key, the
// retirement registry, the active pointer, or a fingerprint a receipt declares
// about itself. The successor's full public key travels INSIDE the intent, so a
// verifier holding only the genesis key and the chain can walk the whole
// lineage with no filesystem access at all.
//
// AUTHORITY IS BINARY. Valid, invalid, or unknown. There is deliberately no
// graded reliability score for signing authority: a broken link refuses, it
// does not degrade to "probably legitimate".
//
// Design source: the Isnad discipline of hadith science, where a claim (matn)
// and the chain of transmission by which it reached you (sanad) are judged
// separately and both must hold. The mapping is formal, not an identity claim —
// this module is named for its engineering purpose and is auditable without it.
//
// Pure: no fs, no network, no clock, no random, no crypto. Bodies in, decisions
// out. The chain walk that consumes these lives in canonical-receipt.js beside
// the verifier it extends, so the tree keeps ONE chain verifier.

export const AUTHORITY_SUCCESSION_INTENT_SCHEMA =
  "bizra.dema.authority_succession_intent.v0.1";
export const AUTHORITY_SUCCESSION_COMMIT_SCHEMA =
  "bizra.dema.authority_succession_commit.v0.1";

export const SUCCESSION_INTENT_EVENT = "AUTHORITY_SUCCESSION_INTENT";
export const SUCCESSION_COMMIT_EVENT = "AUTHORITY_SUCCESSION_COMMIT";

/// The only domain this slice establishes. A second domain must arrive with its
/// own evidence rather than borrowing this one's meaning.
export const AUTHORSHIP_SUCCESSION_DOMAIN = "NODE0_AUTHORSHIP";

const isHex64 = (v) => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
const isStr = (v) => typeof v === "string" && v.length > 0;
const isPem = (v) => typeof v === "string" && v.includes("BEGIN PUBLIC KEY");

const INTENT_REQUIRED_STRINGS = Object.freeze([
  "rotation_tx_id",
  "predecessor_fingerprint",
  "successor_fingerprint",
]);

const COMMIT_REQUIRED_STRINGS = Object.freeze([
  "rotation_tx_id",
  "predecessor_fingerprint",
  "successor_fingerprint",
  "generation_fingerprint",
]);

/**
 * Which half of a succession, if any, this canonical body is.
 *
 * Returns null for an ordinary receipt. Both the schema AND the event must
 * agree: a body carrying one without the other is not classified as succession,
 * so a near-miss can never half-advance authority.
 */
export function classifySuccessionBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  if (
    body.schema === AUTHORITY_SUCCESSION_INTENT_SCHEMA &&
    body.event === SUCCESSION_INTENT_EVENT
  ) {
    return "INTENT";
  }
  if (
    body.schema === AUTHORITY_SUCCESSION_COMMIT_SCHEMA &&
    body.event === SUCCESSION_COMMIT_EVENT
  ) {
    return "COMMIT";
  }
  return null;
}

const bad = (reason) => Object.freeze({ ok: false, reason });
const good = Object.freeze({ ok: true, reason: null });

/**
 * Shape-validate an intent body. Says nothing about whether the predecessor was
 * the authority in force — that is the chain walk's job, because only the walk
 * knows what was trusted at this position.
 */
export function validateSuccessionIntentBody(body) {
  if (classifySuccessionBody(body) !== "INTENT") return bad("not_an_intent");
  for (const k of INTENT_REQUIRED_STRINGS) {
    if (!isStr(body[k])) return bad(`intent_missing:${k}`);
  }
  if (!isPem(body.successor_public_key_pem)) return bad("intent_successor_pem_invalid");
  if (!isHex64(body.successor_public_key_sha256)) return bad("intent_successor_pem_hash_invalid");
  if (!isHex64(body.consent_binding_sha256)) return bad("intent_consent_binding_invalid");
  if (!isHex64(body.expected_pointer_state_sha256)) return bad("intent_expected_state_invalid");
  if (body.domain !== AUTHORSHIP_SUCCESSION_DOMAIN) return bad("intent_domain_unknown");
  if (body.authority_delta !== 0) return bad("intent_authority_delta_nonzero");
  // An intent that names the same key on both sides is not a succession; it is
  // a key re-declaring itself, which must never advance anything.
  if (body.predecessor_fingerprint === body.successor_fingerprint) {
    return bad("intent_self_succession");
  }
  return good;
}

/** Shape-validate a commit body. Linkage to a specific intent is the walk's job. */
export function validateSuccessionCommitBody(body) {
  if (classifySuccessionBody(body) !== "COMMIT") return bad("not_a_commit");
  for (const k of COMMIT_REQUIRED_STRINGS) {
    if (!isStr(body[k])) return bad(`commit_missing:${k}`);
  }
  if (!isHex64(body.intent_receipt_id)) return bad("commit_intent_receipt_id_invalid");
  if (!isHex64(body.observed_pointer_state_sha256)) return bad("commit_observed_state_invalid");
  if (!isHex64(body.retirement_relation_sha256)) return bad("commit_retirement_relation_invalid");
  if (body.domain !== AUTHORSHIP_SUCCESSION_DOMAIN) return bad("commit_domain_unknown");
  if (body.authority_delta !== 0) return bad("commit_authority_delta_nonzero");
  if (body.predecessor_fingerprint === body.successor_fingerprint) {
    return bad("commit_self_succession");
  }
  // The commit must attest to the generation the pointer actually selected.
  if (body.generation_fingerprint !== body.successor_fingerprint) {
    return bad("commit_generation_not_successor");
  }
  return good;
}

/**
 * Every field the commit must carry over from its intent, unchanged. A mutated
 * retry differs in exactly one of these, which is why they are enumerated once
 * and compared as a set rather than checked ad hoc at each call site.
 */
export const SUCCESSION_CARRIED_FIELDS = Object.freeze([
  "rotation_tx_id",
  "predecessor_fingerprint",
  "successor_fingerprint",
]);

/** Fields on which a commit disagrees with its intent. Empty means it matches. */
export function successionBindingDrift(intentBody, commitBody) {
  const drift = [];
  for (const k of SUCCESSION_CARRIED_FIELDS) {
    if (intentBody?.[k] !== commitBody?.[k]) drift.push(k);
  }
  return Object.freeze(drift);
}

export function buildSuccessionIntentBody({
  rotationTxId,
  predecessorFingerprint,
  successorFingerprint,
  successorPublicKeyPem,
  successorPublicKeySha256,
  consentBindingSha256,
  expectedPointerStateSha256,
} = {}) {
  return Object.freeze({
    schema: AUTHORITY_SUCCESSION_INTENT_SCHEMA,
    event: SUCCESSION_INTENT_EVENT,
    domain: AUTHORSHIP_SUCCESSION_DOMAIN,
    rotation_tx_id: rotationTxId,
    predecessor_fingerprint: predecessorFingerprint,
    successor_fingerprint: successorFingerprint,
    successor_public_key_pem: successorPublicKeyPem,
    successor_public_key_sha256: successorPublicKeySha256,
    consent_binding_sha256: consentBindingSha256,
    expected_pointer_state_sha256: expectedPointerStateSha256,
    // Authorization is not activation. This body deliberately carries no field
    // that could be read as "the successor is already authoritative".
    authorizes_only: "successor_may_commit_after_pointer_selects_it",
    authority_delta: 0,
  });
}

export function buildSuccessionCommitBody({
  rotationTxId,
  predecessorFingerprint,
  successorFingerprint,
  intentReceiptId,
  observedPointerStateSha256,
  generationFingerprint,
  retirementRelationSha256,
} = {}) {
  return Object.freeze({
    schema: AUTHORITY_SUCCESSION_COMMIT_SCHEMA,
    event: SUCCESSION_COMMIT_EVENT,
    domain: AUTHORSHIP_SUCCESSION_DOMAIN,
    rotation_tx_id: rotationTxId,
    predecessor_fingerprint: predecessorFingerprint,
    successor_fingerprint: successorFingerprint,
    intent_receipt_id: intentReceiptId,
    observed_pointer_state_sha256: observedPointerStateSha256,
    generation_fingerprint: generationFingerprint,
    retirement_relation_sha256: retirementRelationSha256,
    authority_delta: 0,
  });
}
