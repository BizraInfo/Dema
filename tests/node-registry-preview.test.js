import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildNodeRegistryPreview,
  NODE_REGISTRY_PREVIEW_SCHEMA,
  NODE_REGISTRY_FORBIDDEN_ORDINALS,
  NODE_REGISTRY_ORDINAL_CLAIM_PHRASE_TEMPLATE,
  NODE_REGISTRY_VALID_STATUSES,
  NODE_REGISTRY_PRIMARY_REFUSALS,
} from "../packages/core/src/node-registry-preview.js";

import { PREVIEW_BOUNDARY_CANONICAL_KEYS } from "../packages/core/src/preview-boundary.js";

function assertCanonicalBoundary(boundary, label) {
  for (const key of PREVIEW_BOUNDARY_CANONICAL_KEYS) {
    assert.equal(
      boundary[key],
      false,
      `${label}.boundary.${key} must be false`,
    );
  }
}

// ─── 16 BASE TESTS ──────────────────────────────────────────────────────────

test("NodeRegistryPreview emits canonical schema and truth label", () => {
  const r = buildNodeRegistryPreview();
  assert.equal(r.schema, "bizra.dema.node_registry_preview.v0.1");
  assert.equal(r.schema, NODE_REGISTRY_PREVIEW_SCHEMA);
  assert.equal(r.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(r.mode, "preview_only");
  assert.equal(r.receipt_shape_ready, true);
});

test("NodeRegistryPreview default state has exactly Node0 accepted and zero ghosts", () => {
  const r = buildNodeRegistryPreview();
  assert.equal(r.registry_state.accepted.length, 1);
  assert.equal(r.registry_state.accepted[0].node_ordinal, 0);
  assert.equal(r.registry_state.accepted[0].node_label, "Node0");
  assert.equal(r.registry_state.accepted[0].status, "accepted_primary");
  assert.equal(r.registry_state.ghost.length, 0);
});

test("NodeRegistryPreview emits canonical 16-key boundary all false", () => {
  const r = buildNodeRegistryPreview();
  assertCanonicalBoundary(r.boundary, "registry");
});

test("NodeRegistryPreview output is deep-frozen at every level", () => {
  const r = buildNodeRegistryPreview({
    ghosts: [
      { node_ordinal: 1, status: "ghost_preview", candidate_name: "Friend" },
    ],
  });
  assert.equal(Object.isFrozen(r), true);
  assert.equal(Object.isFrozen(r.registry_state), true);
  assert.equal(Object.isFrozen(r.registry_state.accepted), true);
  assert.equal(Object.isFrozen(r.registry_state.accepted[0]), true);
  assert.equal(Object.isFrozen(r.registry_state.ghost), true);
  assert.equal(Object.isFrozen(r.registry_state.ghost[0]), true);
  assert.equal(Object.isFrozen(r.refusals), true);
  assert.equal(Object.isFrozen(r.consent), true);
  assert.equal(Object.isFrozen(r.boundary), true);
  assert.equal(Object.isFrozen(r.canon_anchors), true);
});

test("NodeRegistryPreview is deterministic given identical inputs", () => {
  const a = buildNodeRegistryPreview({
    ghosts: [
      { node_ordinal: 1, status: "ghost_preview", candidate_name: "Friend" },
    ],
  });
  const b = buildNodeRegistryPreview({
    ghosts: [
      { node_ordinal: 1, status: "ghost_preview", candidate_name: "Friend" },
    ],
  });
  assert.equal(
    JSON.stringify(a),
    JSON.stringify(b),
    "same inputs must produce byte-equal JSON",
  );
});

test("next_available_ordinal computed correctly with only Node0 accepted", () => {
  const r = buildNodeRegistryPreview();
  // 0 is taken, 1 is next available, 2 is also free but 1 is smallest
  assert.equal(r.registry_state.next_available_ordinal, 1);
});

test("next_available_ordinal skips FORBIDDEN_ORDINALS (3 and 4)", () => {
  // active Node0 + accepted Node1 + accepted Node2 → next available is 5 (3 and 4 are forbidden)
  const r = buildNodeRegistryPreview({
    active: [
      { node_ordinal: 0, node_label: "Node0", status: "accepted_primary" },
      { node_ordinal: 1, node_label: "Node1", status: "accepted_primary" },
      { node_ordinal: 2, node_label: "Node2", status: "accepted_primary" },
    ],
  });
  assert.equal(r.registry_state.next_available_ordinal, 5);
  assert.equal(r.registry_state.highest_assigned_ordinal, 2);
});

test("highest_assigned_ordinal tracks the max assigned ordinal", () => {
  const r = buildNodeRegistryPreview({
    active: [
      { node_ordinal: 0, node_label: "Node0", status: "accepted_primary" },
    ],
    ghosts: [
      { node_ordinal: 1, status: "ghost_preview", candidate_name: "Friend" },
    ],
  });
  assert.equal(r.registry_state.highest_assigned_ordinal, 1);
});

test("FORBIDDEN_ORDINALS contains 3 and 4 per canon_registry", () => {
  assert.equal(NODE_REGISTRY_FORBIDDEN_ORDINALS.has(3), true);
  assert.equal(NODE_REGISTRY_FORBIDDEN_ORDINALS.has(4), true);
  // and the registry surface exposes them
  const r = buildNodeRegistryPreview();
  assert.deepEqual([...r.registry_state.forbidden_ordinals], [3, 4]);
});

test("ORDINAL_CLAIM_PHRASE_TEMPLATE matches exact-string canon", () => {
  assert.equal(
    NODE_REGISTRY_ORDINAL_CLAIM_PHRASE_TEMPLATE,
    "GO accept Node<N> ordinal",
  );
  // Verify the substitution in a ghost entry
  const r = buildNodeRegistryPreview({
    ghosts: [
      { node_ordinal: 1, status: "ghost_preview", candidate_name: "Friend" },
    ],
  });
  assert.equal(
    r.registry_state.ghost[0].ordinal_claim_phrase,
    "GO accept Node1 ordinal",
  );
});

test("VALID_STATUSES contains exactly accepted_primary, accepted_companion, ghost_preview", () => {
  assert.equal(NODE_REGISTRY_VALID_STATUSES.size, 3);
  assert.equal(NODE_REGISTRY_VALID_STATUSES.has("accepted_primary"), true);
  assert.equal(NODE_REGISTRY_VALID_STATUSES.has("accepted_companion"), true);
  assert.equal(NODE_REGISTRY_VALID_STATUSES.has("ghost_preview"), true);
});

test("Ghost Node1 with candidate_name produces a frozen ghost entry", () => {
  const r = buildNodeRegistryPreview({
    ghosts: [
      { node_ordinal: 1, status: "ghost_preview", candidate_name: "Friend" },
    ],
  });
  assert.equal(r.registry_state.ghost.length, 1);
  assert.equal(r.registry_state.ghost[0].node_ordinal, 1);
  assert.equal(r.registry_state.ghost[0].node_label, "Node1");
  assert.equal(r.registry_state.ghost[0].candidate_name, "Friend");
  assert.equal(r.registry_state.ghost[0].status, "ghost_preview");
  assert.equal(Object.isFrozen(r.registry_state.ghost[0]), true);
});

test("Multiple ghosts coexist (Node1 + Node2)", () => {
  const r = buildNodeRegistryPreview({
    ghosts: [
      { node_ordinal: 1, status: "ghost_preview", candidate_name: "FriendA" },
      { node_ordinal: 2, status: "ghost_preview", candidate_name: "FriendB" },
    ],
  });
  assert.equal(r.registry_state.ghost.length, 2);
  assert.equal(r.registry_state.ghost[0].node_ordinal, 1);
  assert.equal(r.registry_state.ghost[1].node_ordinal, 2);
  assert.equal(
    r.registry_state.next_available_ordinal,
    5,
    "5 = 3 forbidden, 4 forbidden, next is 5",
  );
});

test("blocked_effects includes federation, node_connection, and ordinal-assignment guards", () => {
  const r = buildNodeRegistryPreview();
  assert.ok(r.blocked_effects.includes("federation"));
  assert.ok(r.blocked_effects.includes("node_connection"));
  assert.ok(
    r.blocked_effects.includes("ordinal_assignment_without_typed_consent"),
  );
  assert.ok(
    r.blocked_effects.includes("ordinal_assignment_into_forbidden_list"),
  );
});

test("primary_refusals surfaces the structural refusal taxonomy", () => {
  const r = buildNodeRegistryPreview();
  assert.equal(r.primary_refusals, NODE_REGISTRY_PRIMARY_REFUSALS);
  assert.ok(
    r.primary_refusals.includes(
      "refuse_to_skip_ordinals_without_canon_authorization",
    ),
  );
  assert.ok(
    r.primary_refusals.includes(
      "refuse_to_register_ordinal_in_forbidden_list_until_canon_amends",
    ),
  );
  assert.ok(r.primary_refusals.includes("refuse_to_assign_duplicate_ordinals"));
});

test("consent block locks the exact-string discipline (ADR-005 binding)", () => {
  const r = buildNodeRegistryPreview();
  assert.equal(r.consent.exact_string_required, true);
  assert.equal(r.consent.fuzzy_match_allowed, false);
  assert.equal(r.consent.case_insensitive_allowed, false);
  assert.equal(r.consent.prefix_match_allowed, false);
});

// ─── 16 ADVERSARIAL TESTS ───────────────────────────────────────────────────

test("ADVERSARIAL: ghost with ordinal -1 is refused with ordinal_not_a_non_negative_integer", () => {
  const r = buildNodeRegistryPreview({
    ghosts: [
      { node_ordinal: -1, status: "ghost_preview", candidate_name: "Bad" },
    ],
  });
  assert.equal(r.registry_state.ghost.length, 0);
  assert.equal(r.refusals.length, 1);
  assert.equal(
    r.refusals[0].refusal_reason,
    "ordinal_not_a_non_negative_integer",
  );
});

test("ADVERSARIAL: ghost with ordinal 3 is refused (forbidden by canon_registry)", () => {
  const r = buildNodeRegistryPreview({
    ghosts: [
      { node_ordinal: 3, status: "ghost_preview", candidate_name: "Bad" },
    ],
  });
  assert.equal(r.registry_state.ghost.length, 0);
  assert.equal(
    r.refusals[0].refusal_reason,
    "ordinal_forbidden_by_canon_registry",
  );
});

test("ADVERSARIAL: ghost with ordinal 4 is refused (forbidden by canon_registry)", () => {
  const r = buildNodeRegistryPreview({
    ghosts: [
      { node_ordinal: 4, status: "ghost_preview", candidate_name: "Bad" },
    ],
  });
  assert.equal(r.registry_state.ghost.length, 0);
  assert.equal(
    r.refusals[0].refusal_reason,
    "ordinal_forbidden_by_canon_registry",
  );
});

test("ADVERSARIAL: ghost with ordinal 0 collides with Node0 and is refused (duplicate_ordinal)", () => {
  const r = buildNodeRegistryPreview({
    ghosts: [
      { node_ordinal: 0, status: "ghost_preview", candidate_name: "Bad" },
    ],
  });
  assert.equal(r.registry_state.ghost.length, 0);
  assert.equal(r.refusals[0].refusal_reason, "duplicate_ordinal");
});

test("ADVERSARIAL: two ghosts with identical ordinal 1 — only first accepted, second refused", () => {
  const r = buildNodeRegistryPreview({
    ghosts: [
      { node_ordinal: 1, status: "ghost_preview", candidate_name: "FriendA" },
      { node_ordinal: 1, status: "ghost_preview", candidate_name: "FriendB" },
    ],
  });
  assert.equal(r.registry_state.ghost.length, 1);
  assert.equal(r.refusals.length, 1);
  assert.equal(r.refusals[0].refusal_reason, "duplicate_ordinal");
});

test("ADVERSARIAL: ghost without candidate_name is refused", () => {
  const r = buildNodeRegistryPreview({
    ghosts: [{ node_ordinal: 1, status: "ghost_preview" }],
  });
  assert.equal(r.registry_state.ghost.length, 0);
  assert.equal(
    r.refusals[0].refusal_reason,
    "ghost_preview_requires_candidate_name",
  );
});

test("ADVERSARIAL: ghost with empty-string candidate_name is refused", () => {
  const r = buildNodeRegistryPreview({
    ghosts: [{ node_ordinal: 1, status: "ghost_preview", candidate_name: "" }],
  });
  assert.equal(r.registry_state.ghost.length, 0);
  assert.equal(
    r.refusals[0].refusal_reason,
    "ghost_preview_requires_candidate_name",
  );
});

test("ADVERSARIAL: ghost with unknown status 'active' is refused (status must be ghost_preview)", () => {
  const r = buildNodeRegistryPreview({
    ghosts: [{ node_ordinal: 1, status: "active", candidate_name: "Friend" }],
  });
  assert.equal(r.registry_state.ghost.length, 0);
  // status is recognized as unknown (not in VALID_STATUSES) — reason fires unknown_status_value path
  assert.equal(r.refusals[0].refusal_reason, "unknown_status_value");
});

test("ADVERSARIAL: active entry with status ghost_preview is refused (status mismatch)", () => {
  const r = buildNodeRegistryPreview({
    active: [{ node_ordinal: 0, node_label: "Node0", status: "ghost_preview" }],
  });
  assert.equal(r.registry_state.accepted.length, 0);
  assert.equal(
    r.refusals[0].refusal_reason,
    "active_entry_cannot_be_ghost_preview",
  );
});

test("ADVERSARIAL: active entry with companion_of equal to own node_label is refused", () => {
  const r = buildNodeRegistryPreview({
    active: [
      {
        node_ordinal: 0,
        node_label: "Node0",
        status: "accepted_primary",
        companion_of: "Node0",
      },
    ],
  });
  assert.equal(r.registry_state.accepted.length, 0);
  assert.equal(
    r.refusals[0].refusal_reason,
    "companion_of_must_not_self_reference",
  );
});

test("ADVERSARIAL: ordinal as string '1' is refused (not a number)", () => {
  const r = buildNodeRegistryPreview({
    ghosts: [
      { node_ordinal: "1", status: "ghost_preview", candidate_name: "Friend" },
    ],
  });
  assert.equal(r.registry_state.ghost.length, 0);
  assert.equal(
    r.refusals[0].refusal_reason,
    "ordinal_not_a_non_negative_integer",
  );
});

test("ADVERSARIAL: ordinal 1.5 (non-integer) is refused", () => {
  const r = buildNodeRegistryPreview({
    ghosts: [
      { node_ordinal: 1.5, status: "ghost_preview", candidate_name: "Friend" },
    ],
  });
  assert.equal(r.registry_state.ghost.length, 0);
  assert.equal(
    r.refusals[0].refusal_reason,
    "ordinal_not_a_non_negative_integer",
  );
});

test("ADVERSARIAL: skipping Node1 to register Node2 ghost is refused (would_skip_ordinal)", () => {
  // Node0 accepted, no Node1, ghost requests Node2
  const r = buildNodeRegistryPreview({
    ghosts: [
      { node_ordinal: 2, status: "ghost_preview", candidate_name: "Friend" },
    ],
  });
  assert.equal(r.registry_state.ghost.length, 0);
  assert.equal(r.refusals[0].refusal_reason, "would_skip_ordinal");
});

test("ADVERSARIAL: mutation attempt on returned registry has no effect (deep-frozen)", () => {
  const r = buildNodeRegistryPreview({
    ghosts: [
      { node_ordinal: 1, status: "ghost_preview", candidate_name: "Friend" },
    ],
  });
  let threw = false;
  try {
    r.registry_state.ghost[0].candidate_name = "MutatedAttacker";
  } catch (e) {
    threw = true;
  }
  assert.equal(
    r.registry_state.ghost[0].candidate_name,
    "Friend",
    "candidate_name must stay Friend after attempted mutation",
  );
  // also try pushing into accepted array
  try {
    r.registry_state.accepted.push({
      node_ordinal: 99,
      status: "accepted_primary",
    });
  } catch (e) {
    threw = true;
  }
  assert.equal(
    r.registry_state.accepted.length,
    1,
    "accepted must stay length 1",
  );
});

test("ADVERSARIAL: prototype-pollution attempt via ghost input does not leak", () => {
  const polluted = {
    node_ordinal: 1,
    status: "ghost_preview",
    candidate_name: "Friend",
  };
  // attempt to pollute the entry's prototype chain
  Object.setPrototypeOf(polluted, { secret_token: "SHOULD_NOT_LEAK" });
  const r = buildNodeRegistryPreview({ ghosts: [polluted] });
  assert.equal(r.registry_state.ghost.length, 1);
  // The frozen output entry does NOT inherit secret_token
  assert.equal("secret_token" in r.registry_state.ghost[0], false);
  assert.equal(r.registry_state.ghost[0].secret_token, undefined);
});

test("ADVERSARIAL: RTL candidate name preserved verbatim in ghost slot", () => {
  const r = buildNodeRegistryPreview({
    ghosts: [
      { node_ordinal: 1, status: "ghost_preview", candidate_name: "محمد بشر" },
    ],
  });
  assert.equal(r.registry_state.ghost.length, 1);
  assert.equal(r.registry_state.ghost[0].candidate_name, "محمد بشر");
  // claim phrase still uses LTR ordinal substitution
  assert.equal(
    r.registry_state.ghost[0].ordinal_claim_phrase,
    "GO accept Node1 ordinal",
  );
});

// ─── v0.1f COUNT + URP INVENTORY TESTS ──────────────────────────────────────

test("v0.1f: default state has connected_node_count: 1 and zero ghosts pending", () => {
  const r = buildNodeRegistryPreview();
  assert.equal(
    r.registry_state.connected_node_count,
    1,
    "Node0 alone → 1 connected",
  );
  assert.equal(r.registry_state.primary_node_count, 1);
  assert.equal(r.registry_state.companion_device_count, 0);
  assert.equal(r.registry_state.ghost_pending_count, 0);
});

test("v0.1f: companion device shares ordinal but counts as companion, not connected", () => {
  // Per Node ordinal law + device-companion canonization: founder's primary +
  // founder's phone share ordinal 0 BUT the phone has companion_of: <primary>.
  // The phone counts as companion_device, NOT as a separate connected node.
  // NOTE: same-ordinal duplicate is itself refused by the registry; this test
  // verifies the count logic when a companion is registered under a DIFFERENT
  // ordinal (e.g., a second human with their phone as companion).
  const r = buildNodeRegistryPreview({
    active: [
      { node_ordinal: 0, node_label: "Node0", status: "accepted_primary" },
      {
        node_ordinal: 1,
        node_label: "Node1",
        status: "accepted_companion",
        companion_of: "Node0",
      },
    ],
  });
  assert.equal(
    r.registry_state.accepted.length,
    2,
    "both entries accepted (different ordinals)",
  );
  assert.equal(
    r.registry_state.connected_node_count,
    1,
    "only primary counts as connected human",
  );
  assert.equal(
    r.registry_state.companion_device_count,
    1,
    "one companion registered",
  );
  assert.equal(r.registry_state.primary_node_count, 1);
});

test("v0.1f: ceremony moment — Node0 + accepted Node1 → connected_node_count: 2", () => {
  const r = buildNodeRegistryPreview({
    active: [
      { node_ordinal: 0, node_label: "Node0", status: "accepted_primary" },
      {
        node_ordinal: 1,
        node_label: "Node1",
        status: "accepted_primary",
        candidate_name: "Friend",
      },
    ],
  });
  assert.equal(
    r.registry_state.connected_node_count,
    2,
    "the moment friend accepts → 2 connected",
  );
  assert.equal(r.registry_state.ghost_pending_count, 0);
});

test("v0.1f: ghost slot is counted as pending, not connected", () => {
  const r = buildNodeRegistryPreview({
    ghosts: [
      { node_ordinal: 1, status: "ghost_preview", candidate_name: "Friend" },
    ],
  });
  assert.equal(
    r.registry_state.connected_node_count,
    1,
    "Node0 alone is still 1",
  );
  assert.equal(
    r.registry_state.ghost_pending_count,
    1,
    "Friend pending acceptance",
  );
});

test("v0.1f: total_pat_agents_planned = primary_node_count × 7", () => {
  const r = buildNodeRegistryPreview({
    active: [
      { node_ordinal: 0, node_label: "Node0", status: "accepted_primary" },
      { node_ordinal: 1, node_label: "Node1", status: "accepted_primary" },
    ],
  });
  assert.equal(
    r.urp_shared_pool_inventory.current_totals_if_each_node_were_to_activate
      .pat_agents,
    14,
  );
});

test("v0.1f: total_sat_agents_planned = primary_node_count × 5", () => {
  const r = buildNodeRegistryPreview({
    active: [
      { node_ordinal: 0, node_label: "Node0", status: "accepted_primary" },
      { node_ordinal: 1, node_label: "Node1", status: "accepted_primary" },
    ],
  });
  assert.equal(
    r.urp_shared_pool_inventory.current_totals_if_each_node_were_to_activate
      .sat_agents,
    10,
  );
  assert.equal(
    r.urp_shared_pool_inventory.current_totals_if_each_node_were_to_activate
      .total_agents,
    24,
  );
});

test("v0.1f: urp_shared_pool_inventory.federation_active is FALSE at v0.1f stage", () => {
  const r = buildNodeRegistryPreview();
  assert.equal(r.urp_shared_pool_inventory.federation_active, false);
  assert.equal(r.urp_shared_pool_inventory.urp_runtime_active, false);
  assert.equal(r.urp_shared_pool_inventory.mode, "preview_only");
});

test("v0.1f: urp_shared_pool_inventory carries the 5 canonical resource categories", () => {
  const r = buildNodeRegistryPreview();
  const cats = r.urp_shared_pool_inventory.resource_categories;
  assert.deepEqual(
    [...cats],
    [
      "hardware",
      "data_corpus",
      "knowledge_base",
      "experience_history",
      "skill_library",
    ],
  );
  // contributed_resources empty per category (no node has federated)
  for (const cat of cats) {
    assert.deepEqual(
      [...r.urp_shared_pool_inventory.contributed_resources[cat]],
      [],
    );
  }
  assert.equal(
    r.urp_shared_pool_inventory.contribution_status,
    "preview_only_no_node_has_federated",
  );
});

test("v0.1f: per_primary_node_contribution declares PAT=7 + SAT=5 (canonical Scaling table)", () => {
  const r = buildNodeRegistryPreview();
  assert.equal(
    r.urp_shared_pool_inventory.per_primary_node_contribution
      .pat_agents_local_per_node,
    7,
  );
  assert.equal(
    r.urp_shared_pool_inventory.per_primary_node_contribution
      .sat_agents_into_shared_urp_per_node,
    5,
  );
});

test("ADVERSARIAL v0.1f: count fields ignore refused ghost entries", () => {
  // Two ghosts submitted: one valid (Node1), one with would_skip_ordinal (Node5).
  // The valid one counts in ghost_pending; the refused one does NOT.
  const r = buildNodeRegistryPreview({
    ghosts: [
      { node_ordinal: 1, status: "ghost_preview", candidate_name: "Friend" },
      { node_ordinal: 5, status: "ghost_preview", candidate_name: "TooSoon" },
    ],
  });
  assert.equal(
    r.registry_state.ghost_pending_count,
    1,
    "only the validly-ordered ghost counts",
  );
  assert.equal(r.refusals.length, 1, "one refusal recorded");
  assert.equal(r.refusals[0].refusal_reason, "would_skip_ordinal");
});

test("ADVERSARIAL v0.1f: count fields are integers · zero allocations possible", () => {
  // Verify the count fields are integers (not floats, not strings, not bigints).
  // Friend asks "how many nodes?" — the answer must be a plain number that
  // renders cleanly in a TUI.
  const r = buildNodeRegistryPreview();
  assert.equal(Number.isInteger(r.registry_state.connected_node_count), true);
  assert.equal(Number.isInteger(r.registry_state.companion_device_count), true);
  assert.equal(Number.isInteger(r.registry_state.ghost_pending_count), true);
  assert.equal(
    Number.isInteger(
      r.urp_shared_pool_inventory.current_totals_if_each_node_were_to_activate
        .pat_agents,
    ),
    true,
  );
  assert.equal(
    Number.isInteger(
      r.urp_shared_pool_inventory.current_totals_if_each_node_were_to_activate
        .sat_agents,
    ),
    true,
  );
});
