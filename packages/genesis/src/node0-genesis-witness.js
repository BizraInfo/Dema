// NODE0-GENESIS-ANCHOR-1A — the out-of-band commitment that makes the Genesis
// root something other than a document vouching for itself.
//
// THE DEFECT THIS REPAIRS, measured on d52a6fa. `genesis/root-trust-v1.json`
// carries `body_sha256` computed over its own body. Rewrite the payload —
// substitute an attacker's public key and fingerprint — recompute the digest,
// and `loadNodeRootTrust` accepts it. The record's integrity field protects
// against accident, never against an actor who can write the file, because that
// actor writes the field too. A state cannot prove its own binding.
//
// WHAT WAS ALREADY CATCHING IT, AND WHY THAT WAS NOT ENOUGH. Under a non-empty
// ledger the substitution fails: the real receipts were signed by the real K0
// and the chain returns signature_invalid. So the root's only anchor was the
// history it exists to validate. At genesis — the exact moment the root is
// established — there is no history, nothing disagrees, and an attacker holding
// the matching private key can then author a coherent history the node believes.
//
// WHY K0 SIGNING ITSELF IS NOT THE ANSWER. A signature over the root record
// proves possession of the key named in that record. An attacker who substitutes
// KX signs their own record just as validly. Possession is not identity, so a
// self-signature raises cost without closing the case. It may still be recorded
// as proof of possession; it may never be read as proof of selection.
//
// THE INHERITED PRINCIPLE. Bootstrap trust is an axiom established out of band;
// continuity after bootstrap is cryptographically verified. Bitcoin hardcodes
// block 0 into the binary and publishes its hash. A VM guest trusts its host by
// stated assumption. in-toto names a builder identity outside the artifact. None
// of them derive genesis from the system genesis begins. BIZRA's out-of-band act
// is the sovereign human ceremony, and this module gives that act a durable
// commitment stored OUTSIDE DEMA_HOME — a trust-on-first-use pin.
//
// VETO, NEVER NOMINATE. The pin holds a fingerprint and a commitment. It holds
// no PEM and no key material of any kind, and a pin that offers key material is
// refused as a representation rather than read. This is the difference between
// an anchor and a second genesis authority: the canonical root remains exactly
// one file, and the pin can only say "the root I am being shown is not the one
// the human accepted". It can never answer "then here is the right one".
//
// WHERE THE PIN LIVES. Outside DEMA_HOME, resolved from an injected path or an
// environment variable — never a constant baked into reusable logic, so a test,
// a second node, or a differently-laid-out host can each supply their own.
//
// BOUNDED CLAIM. Given the sovereign ceremony and the integrity of the local
// bootstrap verifier and its trust domain, unauthorized mutation of the root
// cannot be silently accepted. This claims nothing against a malicious kernel,
// root administrator, firmware, hypervisor, or an attacker able to replace both
// the verifier and every local trust store. Those are stated host assumptions,
// and calling them proof would be the overclaim this whole ladder refuses.

import { link, mkdir, open, readFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { sha256 } from "../../receipts/src/authorship-signature.js";
import { loadNodeRootTrust, nodeRootTrustPath } from "./node-root-trust.js";

export const GENESIS_WITNESS_SCHEMA = "bizra.dema.node0_genesis_witness.v0.1";

/// Exact, single-purpose, and deliberately not the provisioning phrase.
/// Establishing an origin and witnessing an already-established origin are two
/// different acts: the first creates authority, the second only remembers it.
export const WITNESS_GENESIS_ROOT_CONSENT_PHRASE = "WITNESS EXISTING NODE0 GENESIS ROOT";

/// Env override first, then a location under the user's config root — chosen
/// because it is OUTSIDE DEMA_HOME. A pin stored inside the directory it guards
/// would be rewritten by the same actor that rewrote the root.
export const GENESIS_WITNESS_ENV = "DEMA_GENESIS_WITNESS";

export function resolveWitnessPath(env = process.env) {
  if (typeof env[GENESIS_WITNESS_ENV] === "string" && env[GENESIS_WITNESS_ENV].length > 0) {
    return env[GENESIS_WITNESS_ENV];
  }
  const configRoot = env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(configRoot, "bizra", "genesis-witness-v1.json");
}

const isStr = (v) => typeof v === "string" && v.length > 0;
const isHex64 = (v) => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);

/**
 * A commitment over the ENTIRE canonical root record, including its own
 * `body_sha256`.
 *
 * Covering the stored digest too is the point: an attacker who rewrites the
 * payload and recomputes the internal digest produces a different record, and
 * therefore a different commitment. The record can restore its internal
 * consistency; it cannot restore agreement with a value held elsewhere.
 *
 * Field-order independent, so a re-serialized but semantically identical record
 * still matches — the commitment is about content, not formatting.
 */
export function rootRecordCommitment(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  const keys = Object.keys(record).sort();
  return sha256(JSON.stringify(keys.map((k) => [k, record[k]])));
}

const refuse = (reason, extra = {}) =>
  Object.freeze({ ok: false, reason, authority_delta: 0, ...extra });

/**
 * Record the sovereign ceremony's acceptance of an ALREADY-ESTABLISHED root.
 *
 * CREATE-ONLY, by the same link()/EEXIST construction the root itself uses: a
 * pin that could be replaced is not a pin. It never creates, changes or rotates
 * a root — it can only remember one that already exists, which is why it reads
 * the canonical record rather than accepting key material from its caller.
 */
export async function establishGenesisWitness({
  demaHome,
  witnessPath,
  nodeId,
  ceremonyId,
  consent,
  witnessedAt,
} = {}) {
  if (consent !== WITNESS_GENESIS_ROOT_CONSENT_PHRASE) {
    return refuse("consent_required", { required_phrase: WITNESS_GENESIS_ROOT_CONSENT_PHRASE });
  }
  if (!isStr(nodeId)) return refuse("node_id_required");
  if (!isStr(ceremonyId)) return refuse("ceremony_id_required");
  if (!isStr(witnessedAt)) return refuse("witnessed_at_required");

  // The root must ALREADY exist. A witness may never bring one into being.
  const root = await loadNodeRootTrust({ demaHome, expectedNodeId: nodeId });
  if (!root.ok) return refuse(`canonical_root_unavailable:${root.reason}`);
  if (root.ceremonyId !== ceremonyId) return refuse("ceremony_id_mismatch");

  let record;
  try {
    record = JSON.parse(await readFile(nodeRootTrustPath(demaHome), "utf8"));
  } catch (err) {
    return refuse(`canonical_root_unreadable:${err?.code ?? "unknown"}`);
  }

  const body = {
    schema: GENESIS_WITNESS_SCHEMA,
    node_id: nodeId,
    ceremony_id: ceremonyId,
    canonical_root_fingerprint: root.rootTrustFingerprint,
    canonical_root_record_commitment: rootRecordCommitment(record),
    consent_commitment: sha256(
      `${WITNESS_GENESIS_ROOT_CONSENT_PHRASE}\n${nodeId}\n${ceremonyId}\n${root.rootTrustFingerprint}`,
    ),
    witnessed_at: witnessedAt,
    epistemic_status: "CEREMONY_PINNED",
    // Remembering which root the human accepted grants nothing new. Asserted on
    // write and re-checked on read so an edited pin claiming otherwise refuses.
    authority_delta: 0,
  };
  const bytes = `${JSON.stringify(body, null, 2)}\n`;

  const path = witnessPath ?? resolveWitnessPath();
  const dir = dirname(path);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const temp = join(dir, `.genesis-witness-${randomUUID()}.tmp`);
  try {
    const fh = await open(temp, "wx", 0o400);
    try {
      await fh.writeFile(bytes, { encoding: "utf8" });
      await fh.sync();
    } finally { await fh.close(); }
  } catch (err) {
    return refuse(`temp_write_failed:${err?.code ?? "unknown"}`);
  }

  let result;
  try {
    await link(temp, path);
    const dh = await open(dir, "r");
    try { await dh.sync(); } finally { await dh.close(); }
    result = Object.freeze({
      ok: true, path,
      canonical_root_fingerprint: body.canonical_root_fingerprint,
      epistemic_status: body.epistemic_status,
      authority_delta: 0,
    });
  } catch (err) {
    result = err?.code === "EEXIST"
      ? refuse("genesis_witness_already_established", { path })
      : refuse(`publication_unavailable:${err?.code ?? "unknown"}`);
  }
  try { await unlink(temp); } catch { /* orphan temp is never authoritative */ }
  return result;
}

/**
 * Read the pin. Strict, and hostile to anything that looks like a second root.
 */
export async function loadGenesisWitness({ witnessPath } = {}) {
  const path = witnessPath ?? resolveWitnessPath();
  let raw;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    if (err?.code === "ENOENT") return refuse("genesis_witness_unavailable");
    return refuse(`genesis_witness_unreadable:${err?.code ?? "unknown"}`);
  }
  let w;
  try { w = JSON.parse(raw); } catch { return refuse("genesis_witness_malformed"); }
  if (!w || typeof w !== "object" || Array.isArray(w)) return refuse("genesis_witness_malformed");

  // A witness that carries key material is trying to be a root. Refused as a
  // REPRESENTATION, before any field of it is trusted — the shape itself is the
  // violation, not the value.
  if (JSON.stringify(w).includes("BEGIN PUBLIC KEY") || isStr(w.root_public_key_pem)) {
    return refuse("genesis_witness_may_not_carry_key_material");
  }
  if (w.schema !== GENESIS_WITNESS_SCHEMA) return refuse("genesis_witness_schema_unknown");
  for (const k of ["node_id", "ceremony_id", "consent_commitment", "witnessed_at", "epistemic_status"]) {
    if (!isStr(w[k])) return refuse(`genesis_witness_missing:${k}`);
  }
  if (!isHex64(w.canonical_root_fingerprint)) return refuse("genesis_witness_fingerprint_invalid");
  if (!isHex64(w.canonical_root_record_commitment)) return refuse("genesis_witness_commitment_invalid");
  if (w.authority_delta !== 0) return refuse("genesis_witness_authority_delta_nonzero");

  return Object.freeze({ ok: true, witness: Object.freeze(w), path });
}

/**
 * The closure-grade load: canonical root, checked against an independent pin.
 *
 * Additive on purpose. `loadNodeRootTrust` remains the structural reader, and
 * callers that only need "what does the record say" keep working unchanged.
 * This is the one that may seed authority-chain verification, because it is the
 * only one whose answer does not come solely from the file being judged.
 *
 * BOTH must be present. A missing pin is `genesis_witness_unavailable`, never a
 * pass — the whole failure mode being closed here is silent acceptance, and
 * silently accepting an unpinned root would reintroduce it wearing a new name.
 */
export async function loadAnchoredGenesisRoot({
  demaHome,
  witnessPath,
  expectedNodeId,
} = {}) {
  const root = await loadNodeRootTrust({ demaHome, expectedNodeId });
  if (!root.ok) return refuse(root.reason);

  const pin = await loadGenesisWitness({ witnessPath });
  if (!pin.ok) return refuse(pin.reason);
  const w = pin.witness;

  if (isStr(expectedNodeId) && w.node_id !== expectedNodeId) {
    return refuse("genesis_witness_node_binding_mismatch");
  }
  if (w.node_id !== root.nodeId) return refuse("genesis_witness_node_binding_mismatch");

  // Fingerprint first: it names WHICH key the human accepted, and is the check
  // that stops a substituted key outright.
  if (w.canonical_root_fingerprint !== root.rootTrustFingerprint) {
    return refuse("genesis_witness_fingerprint_mismatch");
  }

  // Then the record commitment, which covers every other field — including the
  // record's own stored digest. This is what catches a forgery that leaves the
  // key alone and edits something else, where the fingerprint still agrees.
  let record;
  try {
    record = JSON.parse(await readFile(nodeRootTrustPath(demaHome), "utf8"));
  } catch (err) {
    return refuse(`canonical_root_unreadable:${err?.code ?? "unknown"}`);
  }
  if (rootRecordCommitment(record) !== w.canonical_root_record_commitment) {
    return refuse("genesis_witness_commitment_mismatch");
  }

  return Object.freeze({
    ok: true,
    rootTrustAnchorPem: root.rootTrustAnchorPem,
    rootTrustFingerprint: root.rootTrustFingerprint,
    nodeId: root.nodeId,
    ceremonyId: root.ceremonyId,
    establishedAt: root.establishedAt,
    anchor: w.epistemic_status,
    witnessPath: pin.path,
    authority_delta: 0,
  });
}
