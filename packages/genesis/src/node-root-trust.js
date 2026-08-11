// PROVISIONED-ROOT-TRUST-BOUNDARY-1A — where a Node's historical trust begins.
//
// THE QUESTION THIS ANSWERS. `verifyCanonicalAuthorityChain` can walk a lineage
// K0 → K1 → K2 without ever trusting the chain's own claims about itself, but
// only if a caller hands it K0 from outside. Before this module, no caller
// could: every production historical-verification path resolved its anchor from
// one of three places, and not one of them can establish that K0 was ever
// legitimate.
//
//   CURRENT ACTIVE AUTHORITY   loadPublicKey(home) — "who signs today". After a
//                              rotation this is K1, and asking K1 to vouch for
//                              K0's history returns signature_invalid. Measured
//                              on this branch before the change.
//   LEDGER-CLAIMED FIRST SIGNER  entries[0].operator_public_key_fingerprint —
//                              a claim the chain makes about itself. Useful as
//                              an INTEGRITY anchor (canonical-ledger.js says so
//                              explicitly), never as an ancestry proof.
//   GENERATION ARCHIVE         generations/<fp> — supplies key BYTES once an
//                              identity is already trusted. Existence is not
//                              authority; an archived key is a key that was
//                              stored, not a key that was authorized.
//
// So root trust must arrive from OUTSIDE all three. That is what this file is:
// a one-time, human-consented record of which key a Node's history begins at.
//
//   ROOT TRUST ANCHOR  !=  CURRENT ACTIVE AUTHORITY
//                      !=  LEDGER-CLAIMED FIRST SIGNER
//                      !=  GENERATION ARCHIVE
//
// WHAT THE STORED HASH DOES AND DOES NOT DO. The record carries a deterministic
// body hash. That hash detects an accidentally-inconsistent body; it does NOT
// make the root trustworthy. A record cannot certify itself — the trust comes
// from the out-of-band human provisioning act, and the hash only tells you the
// bytes you are reading are the bytes that act wrote.
//
// THREAT BOUNDARY. This is APPLICATION-LEVEL root provisioning. An attacker who
// is already root on the host can rewrite this file, and nothing here would
// detect it. Resistance to a fully compromised host is NOT claimed and is not
// what this slice proves.
//
// CREATE-ONLY, BY CONSTRUCTION. Provisioning uses link()'s EEXIST semantics, so
// "already provisioned" is a filesystem fact rather than a check this code could
// race. There is no update path, no rotate path, and no force flag — a root that
// could be replaced through a production API would not be a root. Revocation,
// recovery, and re-genesis are deliberately absent; they need their own
// ceremony and their own evidence.
//
// Impure by necessity (this is habitat state on disk), but narrowly: read, an
// exclusive create, and fsync. No network, no clock, no random beyond the temp
// name, and never a private key byte.

import { link, mkdir, open, readFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

import { sha256, fingerprintPublicKeyPem } from "../../receipts/src/authorship-signature.js";
import { isSpkiPublicKeyPem } from "../../receipts/src/authorship-key-store.js";

export const NODE_ROOT_TRUST_SCHEMA = "bizra.dema.node_root_trust.v0.1";

/// Exact-string, single-purpose. A consent to initialize an authorship key does
/// NOT mean a consent to establish permanent Node genesis trust — those are two
/// different acts with two different blast radii, so they get two phrases.
export const ESTABLISH_ROOT_TRUST_CONSENT_PHRASE =
  "ESTABLISH NODE GENESIS ROOT TRUST";

export const NODE_ROOT_TRUST_RELPATH = "genesis/root-trust-v1.json";

/// The only algorithm the signing path can actually verify. Accepting anything
/// else would provision a root that no verifier could ever use.
const REQUIRED_ALGORITHM = "ed25519";

function resolveHome(override) {
  if (typeof override === "string" && override.length > 0) return override;
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

export function nodeRootTrustPath(demaHome) {
  return join(resolveHome(demaHome), NODE_ROOT_TRUST_RELPATH);
}

const isStr = (v) => typeof v === "string" && v.length > 0;

/**
 * Every field the record's hash covers — which is every field this module
 * writes, except the hash itself (a hash covering itself cannot be computed).
 * Enumerated rather than derived from key order so the covered set is a stated
 * fact, not an accident of how some future caller builds the object. Fields a
 * hand-edited record adds beyond these are uncovered AND unread.
 */
export function nodeRootTrustBody({
  nodeId,
  rootPublicKeyPem,
  rootPublicKeyFingerprint,
  algorithm,
  ceremonyId,
  consentBindingSha256,
  establishedAt,
}) {
  return Object.freeze({
    schema: NODE_ROOT_TRUST_SCHEMA,
    node_id: nodeId,
    root_public_key_pem: rootPublicKeyPem,
    root_public_key_fingerprint: rootPublicKeyFingerprint,
    algorithm,
    ceremony_id: ceremonyId,
    consent_binding_sha256: consentBindingSha256,
    established_at: establishedAt,
    // Establishing where history STARTS grants no new power to anything. The
    // field is asserted on write and re-checked on read so a hand-edited record
    // claiming otherwise fails closed rather than being read as an escalation.
    authority_delta: 0,
  });
}

/** Deterministic hash over the body. Detects corruption; confers no trust. */
export function nodeRootTrustBodyHash(body) {
  return sha256(
    JSON.stringify([
      body.schema,
      body.node_id,
      body.root_public_key_pem,
      body.root_public_key_fingerprint,
      body.algorithm,
      body.ceremony_id,
      body.consent_binding_sha256,
      body.established_at,
      body.authority_delta,
    ]),
  );
}

const refuse = (reason) => Object.freeze({ ok: false, reason, authority_delta: 0 });

/**
 * Establish this Node's genesis root trust. CREATE-ONLY and exactly once.
 *
 * This is a BOOTSTRAP/HUMAN-AUTHORITY operation. Nothing in the mission runtime
 * calls it, and nothing should: DEMA/PAT/Flywheel may READ root trust, never
 * write it. If a self-improvement path could provision its own root, the root
 * would prove nothing.
 *
 * @returns {{ok:true, path, root_public_key_fingerprint, body_sha256,
 *            authority_delta:0}
 *          | {ok:false, reason, authority_delta:0}}
 */
export async function provisionNodeRootTrust({
  demaHome,
  nodeId,
  rootPublicKeyPem,
  consent,
  ceremonyId,
  establishedAt,
} = {}) {
  if (consent !== ESTABLISH_ROOT_TRUST_CONSENT_PHRASE) {
    return Object.freeze({
      ok: false,
      reason: "consent_required",
      required_phrase: ESTABLISH_ROOT_TRUST_CONSENT_PHRASE,
      authority_delta: 0,
    });
  }
  if (!isStr(nodeId)) return refuse("node_id_required");
  if (!isStr(ceremonyId)) return refuse("ceremony_id_required");
  if (!isStr(establishedAt)) return refuse("established_at_required");

  // A private key must never reach this path, let alone this file. Checked
  // before any parse so a paste of the wrong half cannot even be inspected.
  if (typeof rootPublicKeyPem === "string" && rootPublicKeyPem.includes("PRIVATE KEY")) {
    return refuse("private_key_material_refused");
  }
  if (!isSpkiPublicKeyPem(rootPublicKeyPem)) return refuse("root_public_key_invalid");

  // Derive identity from the key's own bytes. A caller-supplied fingerprint is
  // a claim; this is the fact, and it is the only one stored.
  let fingerprint;
  try {
    fingerprint = fingerprintPublicKeyPem(rootPublicKeyPem);
  } catch {
    return refuse("root_public_key_unreadable");
  }

  const body = nodeRootTrustBody({
    nodeId,
    rootPublicKeyPem,
    rootPublicKeyFingerprint: fingerprint,
    algorithm: REQUIRED_ALGORITHM,
    ceremonyId,
    consentBindingSha256: sha256(
      `${ESTABLISH_ROOT_TRUST_CONSENT_PHRASE}\n${nodeId}\n${ceremonyId}\n${fingerprint}`,
    ),
    establishedAt,
  });
  const record = { ...body, body_sha256: nodeRootTrustBodyHash(body) };
  const bytes = `${JSON.stringify(record, null, 2)}\n`;

  const path = nodeRootTrustPath(demaHome);
  const dir = join(resolveHome(demaHome), "genesis");
  await mkdir(dir, { recursive: true, mode: 0o700 });

  // Private no-clobber temp → fsync → link → directory fsync. link() fails with
  // EEXIST if a root is already present, which is what makes "provisioned
  // exactly once" a property of the filesystem rather than of a check that
  // another process could win a race against.
  const temp = join(dir, `.root-trust-${randomUUID()}.tmp`);
  try {
    const fh = await open(temp, "wx", 0o400);
    try {
      await fh.writeFile(bytes, { encoding: "utf8" });
      await fh.sync();
    } finally {
      await fh.close();
    }
  } catch (err) {
    return refuse(`temp_write_failed:${err?.code ?? "unknown"}`);
  }

  let result;
  try {
    await link(temp, path);
    const dh = await open(dir, "r");
    try {
      await dh.sync();
    } finally {
      await dh.close();
    }
    result = Object.freeze({
      ok: true,
      path,
      root_public_key_fingerprint: fingerprint,
      body_sha256: record.body_sha256,
      authority_delta: 0,
    });
  } catch (err) {
    result =
      err?.code === "EEXIST"
        ? refuse("root_trust_already_established")
        : refuse(`publication_unavailable:${err?.code ?? "unknown"}`);
  }
  try {
    await unlink(temp);
  } catch {
    /* best-effort; an orphan temp is never authoritative */
  }
  return result;
}

/**
 * Read this Node's genesis root trust anchor. Fails closed on everything.
 *
 * There is deliberately NO fallback. Not loadPublicKey(), not entries[0], not
 * the generation archive, not the retired registry, not the active pointer. An
 * absent root is `root_trust_unavailable` — a Node that does not know where its
 * history begins must say so, not guess the oldest key it can find.
 *
 * @returns {{ok:true, rootTrustAnchorPem, rootTrustFingerprint, nodeId,
 *            ceremonyId, establishedAt, bodySha256}
 *          | {ok:false, reason}}
 */
export async function loadNodeRootTrust({ demaHome, expectedNodeId } = {}) {
  let raw;
  try {
    raw = await readFile(nodeRootTrustPath(demaHome), "utf8");
  } catch (err) {
    if (err?.code === "ENOENT") return refuse("root_trust_unavailable");
    // A permission or transient read error must NOT masquerade as "absent" —
    // that would let a locked-down root look identical to a Node that never had
    // one, and the two demand different human responses.
    return refuse(`root_trust_unreadable:${err?.code ?? "unknown"}`);
  }

  let record;
  try {
    record = JSON.parse(raw);
  } catch {
    return refuse("root_trust_malformed");
  }
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return refuse("root_trust_malformed");
  }
  if (record.schema !== NODE_ROOT_TRUST_SCHEMA) return refuse("root_trust_schema_unknown");
  for (const k of ["node_id", "root_public_key_pem", "root_public_key_fingerprint",
                   "algorithm", "ceremony_id", "consent_binding_sha256", "established_at"]) {
    if (!isStr(record[k])) return refuse(`root_trust_missing:${k}`);
  }
  if (record.authority_delta !== 0) return refuse("root_trust_authority_delta_nonzero");
  if (record.algorithm !== REQUIRED_ALGORITHM) return refuse("root_trust_algorithm_unsupported");
  if (record.root_public_key_pem.includes("PRIVATE KEY")) {
    return refuse("root_trust_private_key_material");
  }
  if (!isSpkiPublicKeyPem(record.root_public_key_pem)) {
    return refuse("root_trust_public_key_invalid");
  }

  // Re-derive rather than believe. A record whose stored fingerprint disagrees
  // with its own key bytes is internally inconsistent, and which half is wrong
  // is not something this reader may guess.
  let derived;
  try {
    derived = fingerprintPublicKeyPem(record.root_public_key_pem);
  } catch {
    return refuse("root_trust_public_key_unreadable");
  }
  if (derived !== record.root_public_key_fingerprint) {
    return refuse("root_trust_fingerprint_mismatch");
  }

  // Corruption detection only, and deliberately optional: a record without the
  // hash loses nothing that establishes identity, because the fingerprint
  // re-derivation above is unconditional and is the check that actually binds
  // the record to its key material.
  const { body_sha256: stored, ...rest } = record;
  if (isStr(stored) && stored !== nodeRootTrustBodyHash(rest)) {
    return refuse("root_trust_body_hash_mismatch");
  }

  // Node binding is enforced only when the caller states an expectation. A
  // reader that does not know which Node it is asking about cannot be given a
  // silent pass OR a silent failure — it gets exactly what it asked for.
  if (isStr(expectedNodeId) && expectedNodeId !== record.node_id) {
    return refuse("root_trust_node_binding_mismatch");
  }

  return Object.freeze({
    ok: true,
    rootTrustAnchorPem: record.root_public_key_pem,
    rootTrustFingerprint: derived,
    nodeId: record.node_id,
    ceremonyId: record.ceremony_id,
    establishedAt: record.established_at,
    bodySha256: isStr(stored) ? stored : null,
  });
}
