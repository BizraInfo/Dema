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

export const CAPABILITY_LEASE_SCHEMA = "bizra.dema.capability_lease_verdict.v0.1";

const KNOWN_EFFECTS = Object.freeze([
  "read_only", "reversible_local", "privileged", "destructive",
  "external_network", "financial", "identity_key",
]);
// no lease may auto-authorize these — always a fresh sovereign gate
const HARD_SOVEREIGN = Object.freeze(["identity_key", "financial"]);
// these may proceed under a matching lease
const LEASE_ELIGIBLE = Object.freeze(["reversible_local", "privileged", "destructive", "external_network"]);

const verdict = (v, reason) => Object.freeze({ schema: CAPABILITY_LEASE_SCHEMA, verdict: v, reason, authority_delta: 0 });

const parseMs = (iso) => { const t = Date.parse(iso); return Number.isFinite(t) ? t : null; };
const nonEmpty = (s) => typeof s === "string" && s.length > 0;

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
 * The execution-authority verdict. `machine_state.ready` gates any effect-bearing
 * ALLOW (a sterile/measured machine); read_only observation does not require it.
 */
export function authorityVerdict({
  effect_class, capability_id, exact_scope = null,
  standing_lease = null, measured_blast_radius = null, machine_state = null, now = null,
} = {}) {
  if (!KNOWN_EFFECTS.includes(effect_class)) return verdict("UNVERIFIABLE", "effect_class_unknown");
  if (!nonEmpty(capability_id)) return verdict("UNVERIFIABLE", "capability_id_required");

  if (effect_class === "read_only") return verdict("ALLOW", "read_only_observation");
  if (HARD_SOVEREIGN.includes(effect_class)) return verdict("QUEUE_SOVEREIGN", `hard_sovereign_effect:${effect_class}`);

  if (LEASE_ELIGIBLE.includes(effect_class)) {
    if (!standing_lease) return verdict("QUEUE_SOVEREIGN", "no_standing_lease");
    const cover = leaseCovers(standing_lease, capability_id, exact_scope, measured_blast_radius, now);
    if (!cover.ok) {
      // an unverifiable field is UNVERIFIABLE; a concrete mismatch is a DENY (never silent-allow)
      return /unverifiable|unmeasured/.test(cover.reason)
        ? verdict("UNVERIFIABLE", cover.reason)
        : verdict("DENY", cover.reason);
    }
    if (!machine_state || machine_state.ready !== true) return verdict("UNVERIFIABLE", "machine_state_not_ready");
    return verdict("ALLOW", "within_standing_lease");
  }
  return verdict("UNVERIFIABLE", "effect_class_unhandled");
}
