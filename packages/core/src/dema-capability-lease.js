// DEMA-FOUNDER-RELIEF-CAPABILITY-LEASE-0D — the authority kernel. Renders an
// execution-authority verdict from more than effect risk:
//
//   effect_class + capability_id + exact_scope + standing_lease
//     + measured_blast_radius + machine_state  ->  ALLOW | DENY | QUEUE_SOVEREIGN | UNVERIFIABLE
//
// The law the critique named: EFFECT_RISK != EXECUTION_AUTHORITY. A `reversible_local`
// (or even `external_network`) act may proceed autonomously ONLY under a matching,
// unexpired, blast-bounded standing lease the operator granted; without one it queues.
// identity_key / financial are HARD-SOVEREIGN: no lease can ever auto-authorize them
// (the Daughter Test — binding identity or value always needs awake exact consent).
// PURE & FAIL-CLOSED: any missing/ambiguous field is UNVERIFIABLE, never ALLOW.
//
// ── v0.2 · a lease must show where it came from ──────────────────────────────
//
// v0.1 accepts any object shaped like a lease. That is what made the attenuation
// law (DEMA-LEASE-ATTENUATION-1A) a habit nobody practised: `deriveLease` cannot
// return a lease wider than its parent, but nothing stopped a caller from writing
// the wider lease as an object literal and handing it here instead.
//
// v0.2 closes that by requiring the DERIVATION CHAIN, re-verified through
// `verifyLeaseChain`, and using its leaf as the effective lease. There is no
// "if a chain is present, check it" branch — that branch is the defect, not the
// fix — so under v0.2 a chainless lease is refused outright.
//
// Which contract governs a call is NOT a caller preference. Presenting an
// attenuation-schema lease selects v0.2 whether the caller asked for it or not:
// a stronger artefact can never buy weaker checking. v0.1 is otherwise untouched,
// so every existing call site keeps working under the rules it was written for.
//
// The hash stays INJECTED, as in the attenuation kernel — this module never
// imports crypto and never asks what time it is.

import {
  LEASE_ATTENUATION_SCHEMA,
  verifyLeaseChain,
} from "./dema-lease-attenuation.js";

export const CAPABILITY_LEASE_SCHEMA = "bizra.dema.capability_lease_verdict.v0.1";
export const CAPABILITY_LEASE_SCHEMA_V0_2 = "bizra.dema.capability_lease_verdict.v0.2";

const KNOWN_EFFECTS = Object.freeze([
  "read_only", "reversible_local", "privileged", "destructive",
  "external_network", "financial", "identity_key",
]);
// no lease may auto-authorize these — always a fresh sovereign gate
const HARD_SOVEREIGN = Object.freeze(["identity_key", "financial"]);
// these may proceed under a matching lease
const LEASE_ELIGIBLE = Object.freeze(["reversible_local", "privileged", "destructive", "external_network"]);

const verdict = (v, reason, schema = CAPABILITY_LEASE_SCHEMA) =>
  Object.freeze({ schema, verdict: v, reason, authority_delta: 0 });

const parseMs = (iso) => { const t = Date.parse(iso); return Number.isFinite(t) ? t : null; };
const nonEmpty = (s) => typeof s === "string" && s.length > 0;

/**
 * Which lease contract governs this call.
 *
 * An attenuation lease or a `lease_chain` selects v0.2 on its own, so the
 * stronger contract cannot be opted out of by simply not asking for it. An
 * unrecognised `contract` is refused rather than defaulted — silently falling
 * back to v0.1 would make a typo a downgrade.
 */
export function leaseContractVersion({ standing_lease = null, lease_chain = null, contract = null } = {}) {
  if (contract !== null && contract !== undefined && contract !== "v0.1" && contract !== "v0.2") return "unknown";
  if (contract === "v0.2") return "v0.2";
  if (lease_chain !== null && lease_chain !== undefined) return "v0.2";
  if (standing_lease && typeof standing_lease === "object" && standing_lease.schema === LEASE_ATTENUATION_SCHEMA) {
    return "v0.2";
  }
  return "v0.1";
}

/** Does this lease cover the exact (capability, scope, blast) at `now`? -> {ok} | {ok:false, reason} */
function leaseCovers(lease, capability_id, exact_scope, blast, now) {
  if (!lease || typeof lease !== "object") return { ok: false, reason: "no_lease" };
  const caps = Array.isArray(lease.capability_ids)
    ? lease.capability_ids
    : nonEmpty(lease.capability_id) ? [lease.capability_id] : null;
  if (!caps || !caps.includes(capability_id)) return { ok: false, reason: "lease_capability_mismatch" };
  if (!nonEmpty(lease.scope) || !nonEmpty(exact_scope)) return { ok: false, reason: "scope_unverifiable" };
  const inScope = exact_scope === lease.scope || exact_scope.startsWith(lease.scope.replace(/\/?$/, "/"));
  if (!inScope) return { ok: false, reason: "lease_scope_mismatch" };
  const exp = parseMs(lease.expires_at), n = parseMs(now);
  if (exp == null || n == null) return { ok: false, reason: "lease_expiry_unverifiable" };
  if (n >= exp) return { ok: false, reason: "lease_expired" };
  const max = lease.max_blast_radius;
  if (!max || !Number.isFinite(max.files) || !Number.isFinite(max.bytes)) return { ok: false, reason: "lease_blast_bound_unverifiable" };
  if (!blast || blast.reversible !== true || !Number.isFinite(blast.files) || !Number.isFinite(blast.bytes)) {
    return { ok: false, reason: "blast_unmeasured_or_irreversible" };
  }
  if (blast.files > max.files || blast.bytes > max.bytes) return { ok: false, reason: "blast_exceeds_lease" };
  return { ok: true };
}

/**
 * v0.2: resolve the effective lease from its derivation chain.
 *
 * Returns the chain's LEAF, and only after `verifyLeaseChain` has re-derived the
 * attenuation law over every link. A caller may still pass `standing_lease`, but
 * it is then required to BE the leaf — otherwise the chain would attest one lease
 * while a different one was honoured, which is the whole defect wearing a proof.
 */
function resolveChainedLease({ standing_lease, lease_chain, hash }) {
  const noChain = lease_chain === null || lease_chain === undefined;
  if (noChain && !standing_lease) return { ok: false, verdict: "QUEUE_SOVEREIGN", reason: "no_standing_lease" };
  if (noChain || !Array.isArray(lease_chain) || lease_chain.length === 0) {
    return { ok: false, verdict: "DENY", reason: "lease_chain_required" };
  }
  if (typeof hash !== "function") {
    return { ok: false, verdict: "UNVERIFIABLE", reason: "lease_chain_hash_function_required" };
  }
  const chain = verifyLeaseChain({ chain: lease_chain, hash });
  if (!chain.ok) return { ok: false, verdict: "DENY", reason: `lease_chain_unverified:${chain.reason}` };
  const leaf = lease_chain[lease_chain.length - 1];
  if (standing_lease && standing_lease !== leaf && standing_lease.chain_hash !== leaf.chain_hash) {
    return { ok: false, verdict: "DENY", reason: "standing_lease_not_chain_leaf" };
  }
  return { ok: true, lease: leaf, depth: chain.depth };
}

/**
 * The execution-authority verdict. `machine_state.ready` gates any effect-bearing
 * ALLOW (a sterile/measured machine); read_only observation does not require it.
 */
export function authorityVerdict({
  effect_class, capability_id, exact_scope = null,
  standing_lease = null, measured_blast_radius = null, machine_state = null, now = null,
  lease_chain = null, hash = null, contract = null,
} = {}) {
  const version = leaseContractVersion({ standing_lease, lease_chain, contract });
  if (version === "unknown") return verdict("UNVERIFIABLE", `lease_contract_unknown:${contract}`);
  const schema = version === "v0.2" ? CAPABILITY_LEASE_SCHEMA_V0_2 : CAPABILITY_LEASE_SCHEMA;

  if (!KNOWN_EFFECTS.includes(effect_class)) return verdict("UNVERIFIABLE", "effect_class_unknown", schema);
  if (!nonEmpty(capability_id)) return verdict("UNVERIFIABLE", "capability_id_required", schema);

  if (effect_class === "read_only") return verdict("ALLOW", "read_only_observation", schema);
  if (HARD_SOVEREIGN.includes(effect_class)) return verdict("QUEUE_SOVEREIGN", `hard_sovereign_effect:${effect_class}`, schema);

  if (LEASE_ELIGIBLE.includes(effect_class)) {
    let lease = standing_lease;
    if (version === "v0.2") {
      const chained = resolveChainedLease({ standing_lease, lease_chain, hash });
      if (!chained.ok) return verdict(chained.verdict, chained.reason, schema);
      lease = chained.lease;
    } else if (!lease) {
      return verdict("QUEUE_SOVEREIGN", "no_standing_lease", schema);
    }
    const cover = leaseCovers(lease, capability_id, exact_scope, measured_blast_radius, now);
    if (!cover.ok) {
      // an unverifiable field is UNVERIFIABLE; a concrete mismatch is a DENY (never silent-allow)
      return /unverifiable|unmeasured/.test(cover.reason)
        ? verdict("UNVERIFIABLE", cover.reason, schema)
        : verdict("DENY", cover.reason, schema);
    }
    if (!machine_state || machine_state.ready !== true) return verdict("UNVERIFIABLE", "machine_state_not_ready", schema);
    return verdict("ALLOW", "within_standing_lease", schema);
  }
  return verdict("UNVERIFIABLE", "effect_class_unhandled", schema);
}
