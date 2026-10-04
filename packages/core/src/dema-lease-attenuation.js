// DEMA-LEASE-ATTENUATION-1A — authority may only ever narrow.
//
// This is a HABIT, not an ACTOR. There is no privileged component here that
// inspects a delegation and decides whether to permit it; a guard like that is
// only a guard while nothing reaches the effect around it, and something always
// does. Instead the widening is made unrepresentable: a lease can be obtained in
// exactly two ways — as a genesis root, or by deriving from one already held —
// and derivation computes the INTERSECTION of what the parent holds with what
// the child asks for. No code path in this module returns a lease wider than its
// parent, so there is nothing left to enforce.
//
// An over-request is therefore not refused. It is clamped, and REPORTED in
// `narrowed`, because a caller that believed it held more than it does has a
// bug worth surfacing even though the bug is now harmless.
//
// The same law is missing in bizra-telescript (`Authority::delegate` takes only
// a name, and `go()` is accept-or-reject rather than intersect-on-arrival). It
// was found missing independently in both codebases, three years and two
// languages apart, which is why it is written here as a law rather than a patch.
//
// PURE. No fs, no net, no clock, no crypto import — the hash is injected, as in
// the deployment and season kernels. The caller supplies `now`; this module
// never asks what time it is.

export const LEASE_ATTENUATION_SCHEMA = "bizra.dema.derived_capability_lease.v0.1";

/** A leaf that spawns nothing sits at the bottom; the root sits at 0. */
export const MAX_DELEGATION_DEPTH = 8;

/** Every dimension of a lease. Each one may shrink; none may grow. */
export const NARROWABLE_DIMENSIONS = Object.freeze([
  "capability_ids",
  "scope",
  "expires_at",
  "max_blast_radius",
]);

const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const strArr = (v) => (Array.isArray(v) ? v.filter((s) => typeof s === "string" && s) : null);
const ms = (iso) => { const t = Date.parse(iso); return Number.isFinite(t) ? t : null; };
const dirOf = (s) => String(s).replace(/\/?$/, "/");

/** `child` is within `parent` when it is the same path or beneath it. */
function scopeWithin(child, parent) {
  if (typeof child !== "string" || typeof parent !== "string") return false;
  if (child === parent) return true;
  if (child.includes("..")) return false;
  return child.startsWith(dirOf(parent));
}

function blastOf(v) {
  if (!isObj(v) || !Number.isFinite(v.files) || !Number.isFinite(v.bytes)) return null;
  return { files: v.files, bytes: v.bytes };
}

function seal(body, parentChainHash, hash) {
  return Object.freeze({
    ...body,
    max_blast_radius: Object.freeze({ ...body.max_blast_radius }),
    capability_ids: Object.freeze([...body.capability_ids]),
    chain_hash: hash({ parent: parentChainHash, ...body }),
  });
}

function bodyOf(lease) {
  const { chain_hash: _h, ...body } = lease;
  return body;
}

/**
 * The only root. Everything else descends from one of these, and a chain that
 * does not begin at depth 0 with no parent is not a chain.
 */
export function genesisLease({
  issuer = null,
  capability_ids = [],
  scope = null,
  expires_at = null,
  max_blast_radius = null,
  hash,
} = {}) {
  if (typeof hash !== "function") throw new TypeError("hash function required");
  const caps = strArr(capability_ids);
  const blast = blastOf(max_blast_radius);
  if (!caps || typeof scope !== "string" || ms(expires_at) === null || !blast) {
    throw new TypeError("genesis lease requires capability_ids, scope, expires_at, max_blast_radius");
  }
  return seal(
    {
      schema: LEASE_ATTENUATION_SCHEMA,
      issuer,
      capability_ids: [...caps].sort(),
      scope,
      expires_at,
      max_blast_radius: blast,
      depth: 0,
      parent_chain_hash: null,
    },
    null,
    hash,
  );
}

/**
 * Derive a child from a lease you already hold.
 *
 * Every dimension is `min(parent, request)`. An omitted dimension inherits the
 * parent's bound unchanged — asking for nothing gets you your parent's authority
 * at depth+1, never more.
 *
 * Returns `{ lease, narrowed }` where `narrowed` names every dimension in which
 * the request exceeded the parent and was clamped.
 */
export function deriveLease({ parent, request = {}, hash } = {}) {
  if (typeof hash !== "function") throw new TypeError("hash function required");
  if (!isObj(parent) || parent.schema !== LEASE_ATTENUATION_SCHEMA) {
    throw new TypeError("deriveLease requires a lease produced by this module");
  }
  const depth = Number(parent.depth) + 1;
  if (!Number.isFinite(depth) || depth > MAX_DELEGATION_DEPTH) {
    throw new RangeError(`delegation depth ${depth} exceeds MAX_DELEGATION_DEPTH ${MAX_DELEGATION_DEPTH}`);
  }
  const req = isObj(request) ? request : {};
  const narrowed = [];

  // capabilities: intersection, never union
  const held = new Set(parent.capability_ids);
  const asked = strArr(req.capability_ids);
  let caps;
  if (asked === null) {
    caps = [...parent.capability_ids];
  } else {
    caps = asked.filter((c) => held.has(c)).sort();
    if (asked.some((c) => !held.has(c))) narrowed.push("capability_ids");
  }

  // scope: must be at or beneath the parent's, else clamp to the parent's
  let scope = parent.scope;
  if (typeof req.scope === "string") {
    if (scopeWithin(req.scope, parent.scope)) scope = req.scope;
    else narrowed.push("scope");
  }

  // expiry: the earlier of the two
  let expires_at = parent.expires_at;
  if (typeof req.expires_at === "string") {
    const a = ms(req.expires_at), b = ms(parent.expires_at);
    if (a !== null && b !== null && a <= b) expires_at = req.expires_at;
    else narrowed.push("expires_at");
  }

  // blast radius: the smaller of each bound, taken independently
  let blast = { ...parent.max_blast_radius };
  const asking = blastOf(req.max_blast_radius);
  if (asking) {
    blast = {
      files: Math.min(asking.files, parent.max_blast_radius.files),
      bytes: Math.min(asking.bytes, parent.max_blast_radius.bytes),
    };
    if (
      asking.files > parent.max_blast_radius.files ||
      asking.bytes > parent.max_blast_radius.bytes
    ) {
      narrowed.push("max_blast_radius");
    }
  }

  const lease = seal(
    {
      schema: LEASE_ATTENUATION_SCHEMA,
      issuer: req.issuer ?? parent.issuer ?? null,
      capability_ids: caps,
      scope,
      expires_at,
      max_blast_radius: blast,
      depth,
      parent_chain_hash: parent.chain_hash,
    },
    parent.chain_hash,
    hash,
  );
  return Object.freeze({ lease, narrowed: Object.freeze(narrowed) });
}

/** Is `child` no wider than `parent` in any dimension? */
export function isNoWiderThan(child, parent) {
  if (!isObj(child) || !isObj(parent)) return { ok: false, reason: "malformed_link" };
  const held = new Set(parent.capability_ids ?? []);
  const extra = (child.capability_ids ?? []).filter((c) => !held.has(c));
  if (extra.length) return { ok: false, reason: `wider_capabilities:${extra.join(",")}` };
  if (!scopeWithin(child.scope, parent.scope)) return { ok: false, reason: "wider_scope" };
  const a = ms(child.expires_at), b = ms(parent.expires_at);
  if (a === null || b === null || a > b) return { ok: false, reason: "wider_expiry" };
  const cb = blastOf(child.max_blast_radius), pb = blastOf(parent.max_blast_radius);
  if (!cb || !pb || cb.files > pb.files || cb.bytes > pb.bytes) {
    return { ok: false, reason: "wider_blast_radius" };
  }
  if (Number(child.depth) !== Number(parent.depth) + 1) return { ok: false, reason: "depth_not_successive" };
  return { ok: true, reason: null };
}

/**
 * Verify an ordered chain [genesis, ..., leaf].
 *
 * This RE-DERIVES the law rather than checking digests. A hash chain proves only
 * that nobody edited a link after the fact; it says nothing about whether the
 * links were lawful when written. Someone who bypasses `deriveLease`, writes a
 * wider child by hand and recomputes its hash produces a perfectly intact chain.
 * So every link is re-tested against `isNoWiderThan` as well.
 */
export function verifyLeaseChain({ chain, hash } = {}) {
  if (typeof hash !== "function") return { ok: false, reason: "hash_function_required", depth: null };
  if (!Array.isArray(chain) || chain.length === 0) {
    return { ok: false, reason: "empty_chain", depth: null };
  }
  const [root, ...rest] = chain;
  if (!isObj(root) || root.schema !== LEASE_ATTENUATION_SCHEMA) {
    return { ok: false, reason: "malformed_root", depth: null };
  }
  if (root.depth !== 0 || root.parent_chain_hash !== null) {
    return { ok: false, reason: "chain_does_not_begin_at_genesis", depth: null };
  }
  if (hash({ parent: null, ...bodyOf(root) }) !== root.chain_hash) {
    return { ok: false, reason: "root_chain_hash_mismatch", depth: null };
  }

  let prev = root;
  for (const link of rest) {
    if (!isObj(link) || link.schema !== LEASE_ATTENUATION_SCHEMA) {
      return { ok: false, reason: "malformed_link", depth: null };
    }
    if (link.parent_chain_hash !== prev.chain_hash) {
      return { ok: false, reason: "chain_link_broken", depth: null };
    }
    if (hash({ parent: prev.chain_hash, ...bodyOf(link) }) !== link.chain_hash) {
      return { ok: false, reason: "chain_hash_mismatch", depth: null };
    }
    const law = isNoWiderThan(link, prev);
    if (!law.ok) return { ok: false, reason: law.reason, depth: null };
    prev = link;
  }
  return { ok: true, reason: null, depth: prev.depth };
}
