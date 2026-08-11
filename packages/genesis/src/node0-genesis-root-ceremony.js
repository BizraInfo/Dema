// NODE0-GENESIS-ROOT-BOOTSTRAP-CEREMONY-1A — the human act that gives a Node
// an origin, and the law that it may happen only once, only at the beginning.
//
// WHAT WAS MISSING. PROVISIONED-ROOT-TRUST-BOUNDARY-1A built the root-trust
// store and proved one production consumer can verify a K0-signed history
// across a K0 -> K1 rotation through it. But the count of real production paths
// that could ESTABLISH that root was zero: only tests called
// `provisionNodeRootTrust`. A primitive nothing human can reach is not yet a
// habitat feature. This module is the bootstrap authority that reaches it.
//
// ORIGIN PRECEDES HISTORY. This is the whole law of the file. A genesis root is
// a statement about where a chain BEGINS, so it can only be made truthfully
// before the chain has begun. Once canonical receipts exist, or a rotation has
// already happened, any root this ceremony wrote would be a claim about a past
// it did not witness — an ancestor manufactured after the fact. So the ceremony
// refuses, with `genesis_root_requires_fresh_node`, rather than guessing.
//
// Concretely, ALL of these must hold, and every one of them is read from disk:
//
//   VERIFIED active identity      there is a K0 to be the root
//   no root-trust record          this Node has no origin yet
//   canonical ledger EMPTY        no history exists to be retro-fitted
//   exactly ONE generation        no earlier key ever held authority
//   empty/absent retired registry no succession has ever completed
//
// The last two are separate on purpose. A generation directory could be
// populated without a completed retirement (a crashed rotation), and a
// retirement could exist whose generation was pruned; either one alone is
// enough to prove this Node is not at its beginning.
//
// FAIL CLOSED ON UNREADABLE, NEVER "PROBABLY FRESH". An unreadable generations
// directory or retirement registry refuses. "I could not tell" and "it is
// fresh" are different answers, and only one of them may write a root.
//
// BOOTSTRAP AUTHORITY, NOT A CAPABILITY. This is not a mission capability, not
// a PAT capability, not an autonomous Dema action, not an RSI action, and not
// something FATE grants at runtime. A model that can invoke ordinary mission
// tools must not be able to establish its own origin. The evidence for that is
// the caller topology in the tree, not this comment: the only production caller
// of this function is the `dema genesis root establish` CLI adapter.
//
// IDENTITY IS SUPPLIED, NEVER DERIVED. `nodeId` comes from the human. Nothing
// here invents, infers, or defaults it — deriving identity is exactly the class
// of act that must not happen inside an automated path.

import { readFile, readdir } from "node:fs/promises";

import {
  activeKeyPaths,
  inspectActiveIdentity,
  loadPublicKey,
} from "../../receipts/src/authorship-key-store.js";
import { loadCanonicalLedger } from "../../receipts/src/canonical-ledger.js";
import { fingerprintPublicKeyPem } from "../../receipts/src/authorship-signature.js";
import {
  provisionNodeRootTrust,
  loadNodeRootTrust,
  ESTABLISH_ROOT_TRUST_CONSENT_PHRASE,
} from "./node-root-trust.js";
import { loadGenesisWitness } from "./node0-genesis-witness.js";

export const GENESIS_ROOT_CEREMONY_SCHEMA =
  "bizra.dema.node0_genesis_root_ceremony.v0.1";

/// The single refusal that means "this Node is past its own beginning".
export const GENESIS_ROOT_REQUIRES_FRESH_NODE = "genesis_root_requires_fresh_node";

export { ESTABLISH_ROOT_TRUST_CONSENT_PHRASE };

const isStr = (v) => typeof v === "string" && v.length > 0;

/** How many key generations this home has ever installed. Unreadable → throw. */
async function generationCount(ap) {
  try {
    return (await readdir(ap.generationsDir)).length;
  } catch (err) {
    if (err?.code === "ENOENT") return 0;
    throw err;
  }
}

/** How many keys this home has ever retired. Absent → 0; corrupt → throw. */
async function retiredCount(ap) {
  let raw;
  try {
    raw = await readFile(ap.retiredRegistry, "utf8");
  } catch (err) {
    if (err?.code === "ENOENT") return 0;
    throw err;
  }
  const doc = JSON.parse(raw);
  return Array.isArray(doc?.retired) ? doc.retired.length : 0;
}

/**
 * Read-only: is this Node still at its own beginning?
 *
 * Returns every reason it is not, rather than the first — a human standing up a
 * Node deserves the whole picture in one answer, and a partial one invites a
 * second ceremony attempt against a state that was never going to qualify.
 *
 * When `witnessPath` is supplied, the surviving out-of-home pin is consulted
 * too — the erasure law. Every other predicate here lives INSIDE DEMA_HOME, so
 * erasing DEMA_HOME resets them all to "fresh"; the pin is the one fact that
 * survives, and a pin at that path — present, or present-but-unreadable — is
 * proof this machine already witnessed an origin. Only a genuinely ABSENT pin
 * (`genesis_witness_unavailable`) leaves freshness intact. The pin stays
 * veto-only: it can block a fresh root; it can never supply one. Additive by
 * omission — callers that do not pass `witnessPath` keep the exact prior
 * behavior.
 *
 * @returns {{fresh:boolean, blocked_by:string[], active_fingerprint:string|null,
 *            ledger_entries:number|null, generation_count:number|null,
 *            retired_count:number|null}}
 */
export async function inspectGenesisRootFreshness({ demaHome, witnessPath } = {}) {
  const blocked = [];
  let activeFingerprint = null;
  let ledgerEntries = null;
  let generations = null;
  let retired = null;

  const identity = await inspectActiveIdentity(demaHome);
  if (identity.state !== "VERIFIED") {
    blocked.push(`no_verified_active_identity:${identity.state}`);
  } else {
    activeFingerprint = identity.fingerprint;
  }

  const existing = await loadNodeRootTrust({ demaHome });
  if (existing.ok) {
    blocked.push("root_trust_already_established");
  } else if (existing.reason !== "root_trust_unavailable") {
    // A root that exists but cannot be read is NOT an absent root. Refusing
    // here keeps a corrupt origin from being quietly replaced by a fresh one.
    blocked.push(`root_trust_unreadable:${existing.reason}`);
  }

  try {
    ledgerEntries = (await loadCanonicalLedger({ demaHome })).length;
    if (ledgerEntries > 0) blocked.push("canonical_history_exists");
  } catch (err) {
    blocked.push(`canonical_ledger_unreadable:${err?.code ?? "unknown"}`);
  }

  const ap = activeKeyPaths(demaHome);
  try {
    generations = await generationCount(ap);
    // Exactly one is the fresh shape: the first init installs K0 and nothing
    // else. Zero means there is no key to root on; two or more means an earlier
    // key already held authority here.
    if (generations > 1) blocked.push("prior_authorship_generation");
  } catch (err) {
    blocked.push(`generations_unreadable:${err?.code ?? "unknown"}`);
  }
  try {
    retired = await retiredCount(ap);
    if (retired > 0) blocked.push("prior_key_retirement");
  } catch (err) {
    blocked.push(`retired_registry_unreadable:${err?.code ?? "unknown"}`);
  }

  if (isStr(witnessPath)) {
    const pin = await loadGenesisWitness({ witnessPath });
    if (pin.ok) {
      blocked.push("genesis_witness_pin_present");
    } else if (pin.reason !== "genesis_witness_unavailable") {
      // A pin that exists but cannot be trusted is NOT an absent pin. Same law
      // as an unreadable root record above: "I could not tell" never means
      // "fresh".
      blocked.push(`genesis_witness_unreadable:${pin.reason}`);
    }
  }

  return Object.freeze({
    fresh: blocked.length === 0,
    blocked_by: Object.freeze(blocked),
    active_fingerprint: activeFingerprint,
    ledger_entries: ledgerEntries,
    generation_count: generations,
    retired_count: retired,
  });
}

const refuse = (reason, extra = {}) =>
  Object.freeze({
    schema: GENESIS_ROOT_CEREMONY_SCHEMA,
    established: false,
    reason,
    authority_delta: 0,
    ...extra,
  });

/**
 * The ceremony. One human, one exact phrase, one origin.
 *
 * This is an AUTHORITY ADAPTER over `provisionNodeRootTrust`: it establishes
 * that the act is authorized and lawful, then delegates the write. It contains
 * no second copy of the provisioning logic and no second way to write a root —
 * `node-root-trust.js` remains the only writer in the tree.
 *
 * @returns {{schema, established:true, node_id, root_public_key_fingerprint,
 *            ceremony_id, established_at, body_sha256, authority_delta:0}
 *          | {schema, established:false, reason, authority_delta:0, ...}}
 */
export async function establishNodeGenesisRoot({
  demaHome,
  nodeId,
  consent,
  ceremonyId,
  now,
  witnessPath,
} = {}) {
  // Consent first, before any disk read. An unauthorized caller learns nothing
  // about this Node's state, and no I/O happens on its behalf.
  if (consent !== ESTABLISH_ROOT_TRUST_CONSENT_PHRASE) {
    return refuse("consent_required", {
      required_phrase: ESTABLISH_ROOT_TRUST_CONSENT_PHRASE,
    });
  }
  if (!isStr(nodeId)) return refuse("node_id_required");
  if (!isStr(ceremonyId)) return refuse("ceremony_id_required");
  if (!isStr(now)) return refuse("established_at_required");

  const freshness = await inspectGenesisRootFreshness({ demaHome, witnessPath });
  if (!freshness.fresh) {
    return refuse(GENESIS_ROOT_REQUIRES_FRESH_NODE, {
      blocked_by: freshness.blocked_by,
      ledger_entries: freshness.ledger_entries,
      generation_count: freshness.generation_count,
      retired_count: freshness.retired_count,
    });
  }

  const k0 = await loadPublicKey(demaHome);
  if (!k0) return refuse("no_authorship_key");

  const provisioned = await provisionNodeRootTrust({
    demaHome,
    nodeId,
    rootPublicKeyPem: k0,
    consent: ESTABLISH_ROOT_TRUST_CONSENT_PHRASE,
    ceremonyId,
    establishedAt: now,
  });
  if (!provisioned.ok) return refuse(provisioned.reason);

  // Independent read-back through the ordinary production reader. A write that
  // reports success but cannot be read is not an established origin, and the
  // ceremony must not be the only witness to its own result.
  const reloaded = await loadNodeRootTrust({ demaHome, expectedNodeId: nodeId });
  if (!reloaded.ok) return refuse(`root_readback_failed:${reloaded.reason}`);
  if (reloaded.rootTrustFingerprint !== fingerprintPublicKeyPem(k0)) {
    return refuse("root_readback_fingerprint_mismatch");
  }

  return Object.freeze({
    schema: GENESIS_ROOT_CEREMONY_SCHEMA,
    established: true,
    node_id: nodeId,
    root_public_key_fingerprint: reloaded.rootTrustFingerprint,
    ceremony_id: reloaded.ceremonyId,
    established_at: reloaded.establishedAt,
    body_sha256: reloaded.bodySha256,
    authority_delta: 0,
    boundary: Object.freeze({
      bootstrap_authority: true,
      mission_capability: false,
      private_key_material_touched: false,
      network_used: false,
      ledger_written: false,
    }),
  });
}
