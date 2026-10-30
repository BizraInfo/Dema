// HABITAT-ACTOR-PARTY-ONTOLOGY-1A — MMORPG constitutional role map (PREVIEW).
//
// Locks the season peak: Human = Player (sovereign), Dema = bonded avatar,
// PAT-7 = private party under Dema, SAT-5 = world guards (serve all equally),
// Hometown = local device sandbox, Village Gate = network/URP boundary.
// Refuses PAT↔SAT label conflation. authority_delta = 0. No runtime agents.

import { createHash } from "node:crypto";

import { buildPreviewBoundary } from "./preview-boundary.js";

export const HABITAT_ACTOR_PARTY_SCHEMA =
  "bizra.dema.habitat_actor_party_ontology.v0.1";
export const HABITAT_ACTOR_PARTY_TRUTH_LABEL =
  "HABITAT_ACTOR_PARTY_ONTOLOGY_PREVIEW_ONLY";

/** Canonical role ids — not interchangeable. */
export const ROLE_IDS = Object.freeze([
  "player_human",
  "avatar_dema",
  "pat_party",
  "sat_world_guard",
  "hometown_local",
  "village_gate",
  "urp_open_world",
  "habitat_bizra",
]);

export const PAT_PARTY_SIZE = 7;
export const SAT_GUARD_SIZE = 5;

/** Labels that must never be applied to the wrong realm. */
export const NAMING_DRIFT_FORBIDDEN = Object.freeze([
  Object.freeze({
    id: "sat_labeled_as_local_builder",
    bad_label: "SAT",
    when_role: "pat_party",
    reason:
      "Local builders under Dema are PAT; SAT are URP/world guardians only.",
  }),
  Object.freeze({
    id: "pat_labeled_as_world_guard",
    bad_label: "PAT",
    when_role: "sat_world_guard",
    reason:
      "World guardians serve all nodes equally; PAT serves one bonded human.",
  }),
  Object.freeze({
    id: "dema_as_habitat",
    bad_label: "BIZRA_HABITAT",
    when_role: "avatar_dema",
    reason: "BIZRA is the habitat; Dema is the actor/avatar — never collapse.",
  }),
  Object.freeze({
    id: "human_as_daemon",
    bad_label: "DEMA",
    when_role: "player_human",
    reason: "Human is the Player above the system; Dema is the bonded avatar.",
  }),
]);

export const FORBIDDEN_OVERCLAIMS = Object.freeze([
  "NODE0_CLOSED",
  "RSI_LIVE",
  "SINGULARITY_LIVE",
  "federation_live",
  "5_million_sat_running",
  "live_pat_agents_spawned",
  "live_sat_agents_spawned",
]);

export const ALLOWED_CLAIMS = Object.freeze([
  "BIZRA is the habitat; Dema is the bonded actor; the human is the Player.",
  "PAT-7 is the private party under Dema inside the Hometown.",
  "SAT-5 are world guardians of the URP; they serve everyone equally.",
  "Every human node is a seed; we do not build a chain of blocks as the unit.",
  "Village Gate crossings require constitutional verification and receipts.",
  "This ontology is PREVIEW_ONLY; no agents are spawned; authority_delta = 0.",
]);

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freezeDeep(child);
  return value;
}

function ontologyBoundary() {
  return freezeDeep({
    ...buildPreviewBoundary(),
    runtime_execution_performed: false,
    network_used: false,
    token_minted: false,
    wallet_accessed: false,
    urp_submission_performed: false,
    node0_activation_performed: false,
    autonomous_runtime_claimed: false,
    pat_agents_spawned: false,
    sat_agents_spawned: false,
    rsi_activated: false,
    singularity_claimed: false,
  });
}

function buildRoles() {
  return freezeDeep([
    {
      role_id: "player_human",
      mmorpg: "Player",
      realm: "above_system",
      serves: "self_sovereign_intent",
      size: 1,
      consent_mode: "exact_string_sovereign",
    },
    {
      role_id: "avatar_dema",
      mmorpg: "Main Character / Avatar",
      realm: "hometown",
      serves: "one_bonded_human",
      size: 1,
      consent_mode: "singularity_bond_1_to_1",
    },
    {
      role_id: "pat_party",
      mmorpg: "Party companions",
      realm: "hometown",
      serves: "dema_under_human",
      size: PAT_PARTY_SIZE,
      consent_mode: "dema_party_leadership",
    },
    {
      role_id: "sat_world_guard",
      mmorpg: "Dungeon / world NPCs & guardians",
      realm: "open_world_urp",
      serves: "all_humanity_equal",
      size: SAT_GUARD_SIZE,
      consent_mode: "constitution_only",
    },
    {
      role_id: "hometown_local",
      mmorpg: "Private stronghold / village",
      realm: "local_device",
      serves: "player_dema_pat_privacy",
      size: null,
      consent_mode: "local_sandbox_total_sovereignty",
    },
    {
      role_id: "village_gate",
      mmorpg: "Zone boundary / instance portal",
      realm: "network_boundary",
      serves: "receipt_verified_export_only",
      size: null,
      consent_mode: "typed_go_outward",
    },
    {
      role_id: "urp_open_world",
      mmorpg: "Grand Exchange / open world",
      realm: "shared_continent",
      serves: "verified_skills_and_compute_pool",
      size: null,
      consent_mode: "sat_verified_public",
    },
    {
      role_id: "habitat_bizra",
      mmorpg: "Game engine / world physics",
      realm: "constitutional_substrate",
      serves: "all_nodes_without_being_an_actor",
      size: null,
      consent_mode: "constitution_anchored",
    },
  ]);
}

function buildRelationships() {
  return freezeDeep([
    {
      from: "player_human",
      to: "avatar_dema",
      predicate: "BONDS_1_TO_1",
      boundary: "soulbound_local",
    },
    {
      from: "avatar_dema",
      to: "pat_party",
      predicate: "LEADS_PARTY",
      boundary: "hometown_only",
    },
    {
      from: "pat_party",
      to: "hometown_local",
      predicate: "OPERATES_INSIDE",
      boundary: "no_external_authority",
    },
    {
      from: "hometown_local",
      to: "village_gate",
      predicate: "EXITS_VIA",
      boundary: "typed_go_required",
    },
    {
      from: "village_gate",
      to: "sat_world_guard",
      predicate: "SUBMITS_RECEIPT_TO",
      boundary: "no_raw_hometown_files",
    },
    {
      from: "sat_world_guard",
      to: "urp_open_world",
      predicate: "GUARDS",
      boundary: "equal_law_even_for_genesis",
    },
    {
      from: "habitat_bizra",
      to: "avatar_dema",
      predicate: "HOSTS_WITHOUT_BEING",
      boundary: "habitat_not_actor",
    },
    {
      from: "player_human",
      to: "habitat_bizra",
      predicate: "SOVEREIGN_OVER",
      boundary: "human_above_everything",
    },
  ]);
}

/**
 * Detect forbidden naming drift: labeling a role with the wrong team acronym.
 * @param {{ role_id: string, applied_label: string }} probe
 * @returns {{ ok: boolean, blocked_by: string[], drift_id: string | null }}
 */
export function refuseNamingDrift(probe) {
  const role_id = String(probe?.role_id ?? "");
  const applied_label = String(probe?.applied_label ?? "")
    .trim()
    .toUpperCase();
  const blocked_by = [];
  let drift_id = null;

  for (const rule of NAMING_DRIFT_FORBIDDEN) {
    if (role_id === rule.when_role && applied_label === rule.bad_label) {
      blocked_by.push(rule.id);
      drift_id = rule.id;
    }
  }

  // Extra: numeric roster confusion from cartographer PDF (9 PAT / 8 SAT lists)
  if (role_id === "pat_party" && applied_label.startsWith("SAT-")) {
    blocked_by.push("pat_party_sat_prefix");
    drift_id = drift_id ?? "pat_party_sat_prefix";
  }
  if (role_id === "sat_world_guard" && applied_label.startsWith("PAT-")) {
    blocked_by.push("sat_guard_pat_prefix");
    drift_id = drift_id ?? "sat_guard_pat_prefix";
  }

  return Object.freeze({
    ok: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
    drift_id,
  });
}

/**
 * Seed mint equation (PREVIEW math only — not a live mint).
 * Each node retains Dema+PAT locally and registers 5 SAT slots into URP design.
 */
export function previewSeedScale(nodeCount) {
  const n = Math.max(0, Math.floor(Number(nodeCount) || 0));
  return freezeDeep({
    mode: "PREVIEW_ONLY",
    node_count: n,
    private_dema: n,
    private_pat_slots: n * PAT_PARTY_SIZE,
    urp_sat_slots: n * SAT_GUARD_SIZE,
    claim_ceiling: "DESIGN_EMULATION_NOT_RUNTIME_RECEIPT",
    note: "Counts are design ratios only; no agents are minted or spawned.",
  });
}

export function buildHabitatActorPartyOntology({
  generated_at = new Date().toISOString(),
} = {}) {
  const roles = buildRoles();
  const relationships = buildRelationships();
  const payload = JSON.stringify({
    schema: HABITAT_ACTOR_PARTY_SCHEMA,
    roles: roles.map((r) => r.role_id),
    relationships,
    pat: PAT_PARTY_SIZE,
    sat: SAT_GUARD_SIZE,
  });
  const ontology_id = `sha256:${createHash("sha256").update(payload).digest("hex")}`;

  return freezeDeep({
    schema: HABITAT_ACTOR_PARTY_SCHEMA,
    truth_label: HABITAT_ACTOR_PARTY_TRUTH_LABEL,
    mode: "PREVIEW_ONLY",
    authority_delta: 0,
    claim_ceiling: "ONTOLOGY_LOCKED_NOT_RUNTIME",
    ontology_id,
    generated_at,
    axiom: {
      habitat_is_bizra: true,
      actor_is_dema: true,
      player_is_human: true,
      every_node_is_a_seed: true,
      we_build_nodes_not_chains: true,
      dema_serves_one_human: true,
      sat_serves_all_equal: true,
    },
    roles,
    relationships,
    party_sizes: { pat: PAT_PARTY_SIZE, sat: SAT_GUARD_SIZE },
    naming_drift_rules: NAMING_DRIFT_FORBIDDEN,
    allowed_claims: ALLOWED_CLAIMS,
    forbidden_overclaims: FORBIDDEN_OVERCLAIMS,
    seed_scale_preview: previewSeedScale(1),
    self_critique: [
      "This module does not spawn PAT or SAT agents.",
      "Seed scale math is a design ratio, not a live URP inventory.",
      "MMORPG metaphors are teaching aids; constitutional contracts remain the authority.",
      "Cartographer JSON intake and live Node0 closure remain separate frontiers.",
    ],
    what_this_does_not_prove: [
      "Does not prove Node0 is closed or RSI is live.",
      "Does not prove 5M SAT exist at any scale.",
      "Does not authorize Village Gate crossings.",
      "Does not replace dema-home-node-space-ontology or FATE contracts.",
    ],
    boundary: ontologyBoundary(),
    next_safe_action:
      "Keep PAT/SAT labels distinct in code and docs; intake Cartographer JSON only when artifacts land.",
  });
}

export function verifyHabitatActorPartyOntology(ontology) {
  const blocked_by = [];
  if (!ontology || ontology.schema !== HABITAT_ACTOR_PARTY_SCHEMA) {
    blocked_by.push("schema_mismatch");
  }
  if (ontology?.truth_label !== HABITAT_ACTOR_PARTY_TRUTH_LABEL) {
    blocked_by.push("truth_label_mismatch");
  }
  if (ontology?.authority_delta !== 0) {
    blocked_by.push("authority_delta_nonzero");
  }
  if (ontology?.mode !== "PREVIEW_ONLY") {
    blocked_by.push("mode_not_preview");
  }
  if (ontology?.boundary?.pat_agents_spawned || ontology?.boundary?.sat_agents_spawned) {
    blocked_by.push("agents_spawned_claimed");
  }
  if (ontology?.boundary?.rsi_activated || ontology?.boundary?.singularity_claimed) {
    blocked_by.push("overclaim_boundary");
  }

  const roleIds = new Set((ontology?.roles ?? []).map((r) => r.role_id));
  for (const id of ROLE_IDS) {
    if (!roleIds.has(id)) blocked_by.push(`missing_role:${id}`);
  }

  if (ontology?.party_sizes?.pat !== PAT_PARTY_SIZE) {
    blocked_by.push("pat_size_drift");
  }
  if (ontology?.party_sizes?.sat !== SAT_GUARD_SIZE) {
    blocked_by.push("sat_size_drift");
  }

  for (const rel of ontology?.relationships ?? []) {
    if (!rel.boundary) blocked_by.push(`rel_missing_boundary:${rel.from}->${rel.to}`);
  }

  // Drift self-check: SAT must not be listed as hometown builder
  const scan = JSON.stringify({
    axiom: ontology?.axiom,
    allowed_claims: ontology?.allowed_claims,
  }).toLowerCase();
  for (const phrase of FORBIDDEN_OVERCLAIMS) {
    if (scan.includes(phrase.toLowerCase())) {
      blocked_by.push(`forbidden_in_claims:${phrase}`);
    }
  }

  return Object.freeze({
    ok: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

export function runHabitatActorPartyOntologyGate() {
  const ontology = buildHabitatActorPartyOntology();
  const verified = verifyHabitatActorPartyOntology(ontology);
  const drift_checks = [
    refuseNamingDrift({ role_id: "pat_party", applied_label: "SAT" }),
    refuseNamingDrift({ role_id: "sat_world_guard", applied_label: "PAT" }),
    refuseNamingDrift({ role_id: "avatar_dema", applied_label: "BIZRA_HABITAT" }),
    refuseNamingDrift({ role_id: "pat_party", applied_label: "PAT" }),
  ];
  const drift_ok =
    !drift_checks[0].ok &&
    !drift_checks[1].ok &&
    !drift_checks[2].ok &&
    drift_checks[3].ok;

  return Object.freeze({
    ok: verified.ok && drift_ok,
    verified,
    drift_refusal_ok: drift_ok,
    role_count: ontology.roles.length,
    ontology_id: ontology.ontology_id,
    authority_delta: 0,
  });
}
