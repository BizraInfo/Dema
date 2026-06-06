// Node Registry Preview — v0.1e
//
// The schema-tagged registry surface that makes the Node ordinal law (canonized
// 2026-05-18, commit `1831aa9`, `docs/canon/BIZRA_TOPOLOGY_CANON.md` §"Node
// ordinal law") operational.
//
// What this module is:
//   • The single source of truth for which ordinals are accepted at this Node0
//     and which ordinals are pre-allocated as ghost-previews (Node1 candidate,
//     Node2 candidate, etc.).
//   • A pure, deterministic, preview-only builder. No I/O. No mutation.
//   • Bound by the canonical 16-key boundary — federation_invoked stays false,
//     node_connection_performed stays false, etc.
//
// What this module is NOT:
//   • A federation handshake (that lives upstream of this repo per ADR-001).
//   • A live runtime that mints ordinals (the canon-amend ceremony does that;
//     this surface witnesses the assignment, it does not perform it).
//   • A network discovery surface (offline-only; no public_network_used).
//
// Operating law applied:
//   "NodeN is assigned, never guessed."
//   "No duplicate ordinals. No skipped ordinals. No hidden ordinals."
//   "A device is never automatically a separate node."
//   — `docs/canon/BIZRA_TOPOLOGY_CANON.md` §"Node ordinal law"

import { buildPreviewBoundary } from "./preview-boundary.js";

const SCHEMA = "bizra.dema.node_registry_preview.v0.1";
const TRUTH_LABEL = "NODE0_LOCAL_SEED";
const MODE = "preview_only";

// Ordinals 3 and 4 are currently forbidden in code/docs per
// `docs/canon/canon_registry.json` forbidden_topology_phrases. The registry
// surface MUST refuse to allocate these ordinals until canon amends that list.
// See [Node ordinal law](../../docs/canon/BIZRA_TOPOLOGY_CANON.md).
const FORBIDDEN_ORDINALS = Object.freeze(new Set([3, 4]));

const RELATED_SCHEMAS = Object.freeze([
  "bizra.dema.user_profile.v0.1",
  "bizra.dema.onboarding.preview.v0.1",
  "bizra.dema.node_network_blueprint.v0.1",
]);

// The exact-string consent phrase template a candidate must type to promote
// their ghost-preview slot into an accepted node. Per ADR-005, no fuzzy match,
// no case-insensitive, no prefix-match. The literal substitution token is
// `<N>` for the candidate ordinal — call sites format this with String.replace
// rather than templated interpolation to keep it pure and obvious.
const ORDINAL_CLAIM_PHRASE_TEMPLATE = "GO accept Node<N> ordinal";

const VALID_STATUSES = Object.freeze(
  new Set(["accepted_primary", "accepted_companion", "ghost_preview"]),
);

function defaultNode0() {
  return Object.freeze({
    node_ordinal: 0,
    node_label: "Node0",
    status: "accepted_primary",
    candidate_name: null,
    companion_of: null,
  });
}

function classifyOrdinal(ordinal, seenOrdinals) {
  if (typeof ordinal !== "number" || !Number.isInteger(ordinal)) {
    return { ok: false, refusal: "ordinal_not_a_non_negative_integer" };
  }
  if (ordinal < 0) {
    return { ok: false, refusal: "ordinal_not_a_non_negative_integer" };
  }
  if (FORBIDDEN_ORDINALS.has(ordinal)) {
    return { ok: false, refusal: "ordinal_forbidden_by_canon_registry" };
  }
  if (seenOrdinals.has(ordinal)) {
    return { ok: false, refusal: "duplicate_ordinal" };
  }
  return { ok: true, refusal: null };
}

function validateStatus(status, expected) {
  if (!VALID_STATUSES.has(status)) {
    return { ok: false, refusal: "unknown_status_value" };
  }
  if (expected && status !== expected) {
    return { ok: false, refusal: `status_must_be_${expected}` };
  }
  return { ok: true, refusal: null };
}

function freezeEntry(entry) {
  return Object.freeze({
    node_ordinal: entry.node_ordinal,
    node_label: entry.node_label ?? `Node${entry.node_ordinal}`,
    status: entry.status,
    candidate_name: entry.candidate_name ?? null,
    companion_of: entry.companion_of ?? null,
    ordinal_claim_phrase:
      entry.status === "ghost_preview"
        ? ORDINAL_CLAIM_PHRASE_TEMPLATE.replace(
            "<N>",
            String(entry.node_ordinal),
          )
        : null,
  });
}

function buildRefusal({ kind, attempted, reason }) {
  return Object.freeze({
    kind,
    attempted_ordinal: attempted.node_ordinal ?? null,
    attempted_label: attempted.node_label ?? null,
    refusal_reason: reason,
  });
}

// v0.1f canonical scaling constants — every accepted human-node contributes
// these agent counts per the Scaling table in BIZRA_TOPOLOGY_CANON.md.
// PAT-7 mints locally on the operator's device; SAT-5 mints into the one
// shared URP. Companion devices belonging to the same human do NOT multiply
// these counts — only distinct human-nodes do (the ordinal counts the human,
// not the device).
const PAT_AGENTS_PER_NODE = 7;
const SAT_AGENTS_PER_NODE = 5;

// URP resource categories per ADR-008 §C7 + `packages/core/src/urp-local.js`.
// These are the categories each accepted node MAY contribute to the shared
// URP pool. At v0.1f stage no node has activated federation, so contributed
// resources is always empty per category; the structure declares the shape
// the future federated URP will fill.
const URP_RESOURCE_CATEGORIES = Object.freeze([
  "hardware",
  "data_corpus",
  "knowledge_base",
  "experience_history",
  "skill_library",
]);

// Refuse-as-product taxonomy surfaced on the registry envelope itself. These
// are the structural refusals the builder will emit even before any input
// triggers them — they describe what the registry WILL refuse regardless of
// call-site behavior.
const PRIMARY_REFUSALS = Object.freeze([
  "refuse_to_assign_ordinal_without_typed_consent_phrase",
  "refuse_to_skip_ordinals_without_canon_authorization",
  "refuse_to_assign_duplicate_ordinals",
  "refuse_to_register_ordinal_in_forbidden_list_until_canon_amends",
  "refuse_to_change_node_ordinal_after_acceptance",
  "refuse_to_set_companion_of_to_self",
  "refuse_to_emit_federation_signal_at_preview_stage",
  "refuse_to_skip_seed_pattern_invariant_for_lite_nodes",
]);

const BLOCKED_EFFECTS = Object.freeze([
  "federation",
  "raw_data_sharing",
  "public_broadcast",
  "economic_activation",
  "node_connection",
  "ordinal_assignment_without_typed_consent",
  "ordinal_assignment_into_forbidden_list",
]);

export function buildNodeRegistryPreview({
  active = [defaultNode0()],
  ghosts = [],
} = {}) {
  // Defensive normalization — accept Iterable-like inputs but never mutate
  // them. Caller-side arrays are read once and copied into the envelope.
  const activeIn = Array.isArray(active) ? active.slice() : [];
  const ghostsIn = Array.isArray(ghosts) ? ghosts.slice() : [];

  const seenOrdinals = new Set();
  const acceptedSeenLabels = new Set();
  const refusals = [];
  const acceptedOut = [];
  const ghostsOut = [];

  // Pass 1 — validate active entries first because they own the lower ordinals.
  for (const entry of activeIn) {
    const classify = classifyOrdinal(entry?.node_ordinal, seenOrdinals);
    if (!classify.ok) {
      refusals.push(
        buildRefusal({
          kind: "active",
          attempted: entry ?? {},
          reason: classify.refusal,
        }),
      );
      continue;
    }
    const statusCheck = validateStatus(entry.status, null);
    if (!statusCheck.ok) {
      refusals.push(
        buildRefusal({
          kind: "active",
          attempted: entry,
          reason: statusCheck.refusal,
        }),
      );
      continue;
    }
    if (entry.status === "ghost_preview") {
      refusals.push(
        buildRefusal({
          kind: "active",
          attempted: entry,
          reason: "active_entry_cannot_be_ghost_preview",
        }),
      );
      continue;
    }
    // companion_of must not self-reference. v0.1e treats label-equality with
    // own label as the self-reference test; uid-based self-reference is a
    // downstream concern handled by buildUserProfile callers.
    if (
      entry.companion_of &&
      entry.node_label &&
      entry.companion_of === entry.node_label
    ) {
      refusals.push(
        buildRefusal({
          kind: "active",
          attempted: entry,
          reason: "companion_of_must_not_self_reference",
        }),
      );
      continue;
    }
    seenOrdinals.add(entry.node_ordinal);
    if (entry.node_label) acceptedSeenLabels.add(entry.node_label);
    acceptedOut.push(freezeEntry(entry));
  }

  // Compute next_available_ordinal as a moving cursor: smallest non-negative
  // integer NOT in seenOrdinals AND NOT in FORBIDDEN_ORDINALS. Advances as
  // each ghost is accepted so the "no skip" rule is enforceable in order.
  function computeNextAvailable() {
    let n = 0;
    while (seenOrdinals.has(n) || FORBIDDEN_ORDINALS.has(n)) {
      n += 1;
    }
    return n;
  }

  // Pass 2 — ghost entries layered on top of accepted ordinals. Sorted by
  // ordinal ascending so the "no skip" rule is order-independent of input.
  const sortedGhosts = ghostsIn.slice().sort((a, b) => {
    const av =
      typeof a?.node_ordinal === "number"
        ? a.node_ordinal
        : Number.MAX_SAFE_INTEGER;
    const bv =
      typeof b?.node_ordinal === "number"
        ? b.node_ordinal
        : Number.MAX_SAFE_INTEGER;
    return av - bv;
  });
  for (const entry of sortedGhosts) {
    const classify = classifyOrdinal(entry?.node_ordinal, seenOrdinals);
    if (!classify.ok) {
      refusals.push(
        buildRefusal({
          kind: "ghost",
          attempted: entry ?? {},
          reason: classify.refusal,
        }),
      );
      continue;
    }
    const statusCheck = validateStatus(entry.status, "ghost_preview");
    if (!statusCheck.ok) {
      refusals.push(
        buildRefusal({
          kind: "ghost",
          attempted: entry,
          reason: statusCheck.refusal,
        }),
      );
      continue;
    }
    if (
      typeof entry.candidate_name !== "string" ||
      entry.candidate_name.length === 0
    ) {
      refusals.push(
        buildRefusal({
          kind: "ghost",
          attempted: entry,
          reason: "ghost_preview_requires_candidate_name",
        }),
      );
      continue;
    }
    // "No skipped ordinals" — per canonized Node ordinal law. The next ghost
    // accepted must equal the current next_available cursor; otherwise the
    // registry refuses without canon authorization for the gap.
    const cursor = computeNextAvailable();
    if (entry.node_ordinal !== cursor) {
      refusals.push(
        buildRefusal({
          kind: "ghost",
          attempted: entry,
          reason: "would_skip_ordinal",
        }),
      );
      continue;
    }
    seenOrdinals.add(entry.node_ordinal);
    ghostsOut.push(freezeEntry(entry));
  }

  const maxSeen = seenOrdinals.size > 0 ? Math.max(...seenOrdinals) : -1;
  const nextAvailable = computeNextAvailable();

  // v0.1f count primitives — derived from the validated accepted/ghost arrays.
  // The companion vs primary split is per the device-companion canonization:
  // a human keeps one ordinal across multiple devices; only primaries count
  // as distinct human-nodes for the PAT/SAT multiplication.
  const companion_device_count = acceptedOut.filter(
    (e) => e.companion_of !== null,
  ).length;
  const primary_node_count = acceptedOut.length - companion_device_count;
  const connected_node_count = primary_node_count;
  const ghost_pending_count = ghostsOut.length;

  // v0.1f scaling totals — what the canonical Scaling table predicts for the
  // current node count. These are PLANNED counts; actual mint requires each
  // node's device-side PAT-7 activation (deferred until federation surfaces
  // land). Preview-only · no runtime · no federation.
  const total_pat_agents_planned = primary_node_count * PAT_AGENTS_PER_NODE;
  const total_sat_agents_planned = primary_node_count * SAT_AGENTS_PER_NODE;
  const total_agents_planned =
    total_pat_agents_planned + total_sat_agents_planned;

  // v0.1f shared URP pool inventory shape — preview of what the federated URP
  // WOULD show once activation occurs. At v0.1f stage no node has federated,
  // so contributed_resources is empty per category; the structure declares
  // the shape the future federated URP will fill.
  const contributed_resources_template = Object.freeze(
    Object.fromEntries(
      URP_RESOURCE_CATEGORIES.map((cat) => [cat, Object.freeze([])]),
    ),
  );
  const urp_shared_pool_inventory = Object.freeze({
    mode: "preview_only",
    federation_active: false,
    urp_runtime_active: false,
    per_primary_node_contribution: Object.freeze({
      pat_agents_local_per_node: PAT_AGENTS_PER_NODE,
      sat_agents_into_shared_urp_per_node: SAT_AGENTS_PER_NODE,
    }),
    current_totals_if_each_node_were_to_activate: Object.freeze({
      pat_agents: total_pat_agents_planned,
      sat_agents: total_sat_agents_planned,
      total_agents: total_agents_planned,
    }),
    resource_categories: URP_RESOURCE_CATEGORIES,
    contributed_resources: contributed_resources_template,
    contribution_status: "preview_only_no_node_has_federated",
    canon_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md#scaling",
  });

  return Object.freeze({
    schema: SCHEMA,
    truth_label: TRUTH_LABEL,
    mode: MODE,
    receipt_shape_ready: true,
    related_schemas: RELATED_SCHEMAS,
    registry_state: Object.freeze({
      accepted: Object.freeze(acceptedOut),
      ghost: Object.freeze(ghostsOut),
      next_available_ordinal: nextAvailable,
      highest_assigned_ordinal: maxSeen,
      forbidden_ordinals: Object.freeze(
        Array.from(FORBIDDEN_ORDINALS).sort((a, b) => a - b),
      ),
      connected_node_count,
      primary_node_count,
      companion_device_count,
      ghost_pending_count,
      seed_pattern_invariant_applies_to_every_entry: true,
    }),
    urp_shared_pool_inventory,
    refusals: Object.freeze(refusals),
    primary_refusals: PRIMARY_REFUSALS,
    blocked_effects: BLOCKED_EFFECTS,
    consent: Object.freeze({
      claim_phrase_template: ORDINAL_CLAIM_PHRASE_TEMPLATE,
      exact_string_required: true,
      fuzzy_match_allowed: false,
      case_insensitive_allowed: false,
      prefix_match_allowed: false,
    }),
    canon_anchors: Object.freeze({
      ordinal_law: "docs/canon/BIZRA_TOPOLOGY_CANON.md#node-ordinal-law",
      seed_pattern_invariant:
        "docs/canon/BIZRA_TOPOLOGY_CANON.md#seed-pattern-invariant-fractality",
      registry_metadata: "docs/canon/canon_registry.json",
    }),
    boundary: buildPreviewBoundary(),
  });
}

export const NODE_REGISTRY_PREVIEW_SCHEMA = SCHEMA;
export const NODE_REGISTRY_FORBIDDEN_ORDINALS = FORBIDDEN_ORDINALS;
export const NODE_REGISTRY_ORDINAL_CLAIM_PHRASE_TEMPLATE =
  ORDINAL_CLAIM_PHRASE_TEMPLATE;
export const NODE_REGISTRY_VALID_STATUSES = VALID_STATUSES;
export const NODE_REGISTRY_PRIMARY_REFUSALS = PRIMARY_REFUSALS;
