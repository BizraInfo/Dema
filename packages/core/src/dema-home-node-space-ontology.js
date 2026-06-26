// DEMA-HOME-NODE-SPACE-ONTOLOGY-1A — sovereign Node Space ontology gate.
//
// Encodes: Dema Home is the Node Space; human-as-node; seed identity;
// unbounded potential with bounded execution. Docs/test/review only.

import { createHash } from "node:crypto";

import { buildPreviewBoundary } from "./preview-boundary.js";

export const DEMA_HOME_NODE_SPACE_ONTOLOGY_SCHEMA =
  "bizra.dema.dema_home_node_space_ontology.v0.1";
export const DEMA_HOME_NODE_SPACE_ONTOLOGY_TRUTH_LABEL =
  "DEMA_HOME_NODE_SPACE_ONTOLOGY_DOCS_ONLY";

export const ONTOLOGY_NODE_IDS = Object.freeze([
  "human_node",
  "seed_identity",
  "dema_home",
  "node_space",
  "device_constellation",
  "asset_graph",
  "consent_boundary",
  "scan_modes",
  "memory_context",
  "value_transformation",
  "receipt_proof",
  "contribution_eligibility",
  "urp_candidate_boundary",
]);

export const FORBIDDEN_OVERCLAIMS = Object.freeze([
  "live autonomous Node0",
  "live token mint",
  "live SAT treasury",
  "automatic URP submission",
  "silent content scan",
  "silent mobile extraction",
  "silent sharing",
  "unbounded execution",
]);

export const ALLOWED_CLAIMS = Object.freeze([
  "Dema Home is the Node Space for one human node.",
  "Metadata awareness is the default scan posture.",
  "Content awareness requires scoped explicit consent.",
  "Mobile is high-value and high-sensitivity.",
  "Value transformation is preview-only until proof exists.",
  "URP contribution is candidate-only until separate consent and receipt.",
  "No scan implies sharing; no receipt implies reward.",
  "Potential is unbounded; execution is bounded by consent and proof.",
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
    file_content_read: false,
    runtime_execution_performed: false,
    network_used: false,
    upload_performed: false,
    sharing_performed: false,
    token_minted: false,
    wallet_accessed: false,
    urp_submission_performed: false,
    node0_activation_performed: false,
    autonomous_runtime_claimed: false,
  });
}

function buildOntologyNodes() {
  const nodes = {
    human_node: {
      node_id: "human_node",
      label: "Human as Node",
      description: "One sovereign human operator represented as a single node identity.",
      boundary: "identity_owned_by_human",
    },
    seed_identity: {
      node_id: "seed_identity",
      label: "Seed Identity",
      description: "Every node is a seed with unbounded potential; execution remains bounded.",
      boundary: "potential_unbounded_execution_bounded",
    },
    dema_home: {
      node_id: "dema_home",
      label: "Dema Home",
      description: "Local sovereign representation of the human node — not mere storage.",
      boundary: "lives_under_DEMA_HOME",
    },
    node_space: {
      node_id: "node_space",
      label: "Node Space",
      description: "The identity boundary containing devices, assets, memory, consent, and proofs.",
      boundary: "human_owns_node_space",
    },
    device_constellation: {
      node_id: "device_constellation",
      label: "Device Constellation",
      description: "Laptop, mobile, external storage, exports — each a sovereign asset source.",
      boundary: "trust_pairing_required",
    },
    asset_graph: {
      node_id: "asset_graph",
      label: "Asset Graph",
      description: "Metadata-first graph of unstructured and structured assets across devices.",
      boundary: "metadata_default_content_consent",
    },
    consent_boundary: {
      node_id: "consent_boundary",
      label: "Consent Boundary",
      description: "Exact-string, scoped consent gates every non-metadata action.",
      boundary: "fail_closed",
    },
    scan_modes: {
      node_id: "scan_modes",
      label: "Scan Modes",
      description: "Ladder from metadata-only through fingerprint, content, deep, share/export.",
      boundary: "default_metadata_only",
    },
    memory_context: {
      node_id: "memory_context",
      label: "Memory Context",
      description: "Session and operator memory within the node space — not silent extraction.",
      boundary: "local_only_preview",
    },
    value_transformation: {
      node_id: "value_transformation",
      label: "Value Transformation",
      description: "Chaos → organized, consented, value-aware previews inside bounded transforms.",
      boundary: "preview_only_until_proof",
    },
    receipt_proof: {
      node_id: "receipt_proof",
      label: "Receipt / Proof",
      description: "Source trace, boundaries, and reproducible commands for every deeper action.",
      boundary: "required_before_deeper_scan",
    },
    contribution_eligibility: {
      node_id: "contribution_eligibility",
      label: "Contribution Eligibility",
      description: "Receipt-planned path toward contribution — never implied by scan alone.",
      boundary: "candidate_preview_only",
    },
    urp_candidate_boundary: {
      node_id: "urp_candidate_boundary",
      label: "URP Candidate Boundary",
      description: "Share/export/URP packaging requires separate consent and proof plan.",
      boundary: "no_submission_without_consent",
    },
  };
  return freezeDeep(
    ONTOLOGY_NODE_IDS.map((id) => Object.freeze({ ...nodes[id], consent_mode: consentModeForNode(id) })),
  );
}

function consentModeForNode(nodeId) {
  const map = {
    human_node: "identity_implicit",
    seed_identity: "philosophy_only",
    dema_home: "operator_home",
    node_space: "sovereign_boundary",
    device_constellation: "trust_pairing",
    asset_graph: "metadata_only_default",
    consent_boundary: "exact_string_required",
    scan_modes: "metadata_only_default",
    memory_context: "local_session",
    value_transformation: "scoped_consent",
    receipt_proof: "required_for_deeper_actions",
    contribution_eligibility: "receipt_plan_required",
    urp_candidate_boundary: "separate_consent",
  };
  return map[nodeId] ?? "explicit_consent";
}

function buildRelationships() {
  return freezeDeep([
    Object.freeze({ from: "human_node", to: "seed_identity", relation: "is_a", boundary: "philosophy_not_runtime" }),
    Object.freeze({ from: "human_node", to: "node_space", relation: "owns", boundary: "sovereign" }),
    Object.freeze({ from: "dema_home", to: "node_space", relation: "represents", boundary: "local_face_only" }),
    Object.freeze({ from: "node_space", to: "device_constellation", relation: "contains", boundary: "multi_device" }),
    Object.freeze({ from: "device_constellation", to: "asset_graph", relation: "feeds", boundary: "metadata_first" }),
    Object.freeze({ from: "asset_graph", to: "consent_boundary", relation: "gated_by", boundary: "fail_closed" }),
    Object.freeze({ from: "consent_boundary", to: "scan_modes", relation: "selects", boundary: "scoped_choice" }),
    Object.freeze({ from: "scan_modes", to: "value_transformation", relation: "enables_preview", boundary: "not_automatic" }),
    Object.freeze({ from: "value_transformation", to: "receipt_proof", relation: "requires", boundary: "proof_before_claim" }),
    Object.freeze({ from: "receipt_proof", to: "contribution_eligibility", relation: "plans", boundary: "preview_only" }),
    Object.freeze({ from: "contribution_eligibility", to: "urp_candidate_boundary", relation: "bounded_by", boundary: "separate_consent" }),
    Object.freeze({ from: "node_space", to: "memory_context", relation: "includes", boundary: "local_only" }),
  ]);
}

function buildInvariants() {
  return freezeDeep([
    Object.freeze({ id: "home_is_node_space", statement: "Dema Home is the Node Space." }),
    Object.freeze({ id: "human_owns", statement: "The human owns the Node Space." }),
    Object.freeze({ id: "multi_device", statement: "Node Space can span multiple user devices." }),
    Object.freeze({ id: "metadata_default", statement: "Metadata awareness is default." }),
    Object.freeze({ id: "content_consent", statement: "Content awareness requires scoped consent." }),
    Object.freeze({ id: "mobile_sensitive", statement: "Mobile is high-value and high-sensitivity." }),
    Object.freeze({ id: "transform_preview", statement: "Value transformation is preview-only until proof exists." }),
    Object.freeze({ id: "urp_candidate", statement: "URP contribution is candidate-only until separate consent and receipt." }),
    Object.freeze({ id: "no_scan_share", statement: "No scan implies sharing." }),
    Object.freeze({ id: "no_receipt_reward", statement: "No receipt implies reward." }),
    Object.freeze({ id: "no_philosophy_runtime", statement: "No philosophy claim implies live runtime." }),
  ]);
}

function buildProofRequirements() {
  return freezeDeep({
    every_action_requires: Object.freeze(["consent_mode", "boundary", "preview_or_receipt"]),
    contribution_path_requires: Object.freeze(["receipt_plan", "proof_trace", "separate_urp_consent"]),
    reproducible_command_hint: "dema home node-space --json",
    preview_only: true,
  });
}

export function buildDemaHomeNodeSpaceOntology({
  generated_at_iso = "2026-06-26T18:00:00.000Z",
} = {}) {
  const ontology_id = `sha256:${createHash("sha256")
    .update(DEMA_HOME_NODE_SPACE_ONTOLOGY_SCHEMA)
    .digest("hex")}`;

  return freezeDeep({
    schema: DEMA_HOME_NODE_SPACE_ONTOLOGY_SCHEMA,
    truth_label: DEMA_HOME_NODE_SPACE_ONTOLOGY_TRUTH_LABEL,
    valid: true,
    generated_at_iso,
    ontology_id,
    axiom: Object.freeze({
      dema_home_is_node_space: true,
      node_space_is_human_identity_boundary: true,
      every_human_is_a_node: true,
      every_node_is_a_seed: true,
      seed_carries_unbounded_potential: true,
      execution_bounded_by_consent_proof_sovereignty: true,
    }),
    ontology_nodes: buildOntologyNodes(),
    relationships: buildRelationships(),
    invariants: buildInvariants(),
    allowed_claims: ALLOWED_CLAIMS,
    forbidden_overclaims: FORBIDDEN_OVERCLAIMS,
    proof_requirements: buildProofRequirements(),
    what_this_does_not_prove: Object.freeze([
      "This ontology does not activate Node0 or perform scans.",
      "Philosophical potential does not imply live economic or network execution.",
    ]),
    boundary: ontologyBoundary(),
    boundaries: ontologyBoundary(),
  });
}

function boundaryAllFalse(boundary) {
  if (!boundary || typeof boundary !== "object") return false;
  return Object.values(boundary).every((v) => v === false);
}

function hasPositiveOverclaim(text, phrase) {
  const lower = text.toLowerCase();
  const p = phrase.toLowerCase();
  let idx = 0;
  while ((idx = lower.indexOf(p, idx)) !== -1) {
    const before = lower.slice(Math.max(0, idx - 4), idx);
    if (!before.endsWith("no ")) return true;
    idx += p.length;
  }
  return false;
}

export function verifyDemaHomeNodeSpaceOntology(ontology) {
  const blocked_by = [];

  if (!ontology || ontology.schema !== DEMA_HOME_NODE_SPACE_ONTOLOGY_SCHEMA) {
    blocked_by.push("invalid_schema");
    return Object.freeze({ ok: false, blocked_by });
  }
  if (ontology.truth_label !== DEMA_HOME_NODE_SPACE_ONTOLOGY_TRUTH_LABEL) {
    blocked_by.push("invalid_truth_label");
  }
  if (!boundaryAllFalse(ontology.boundary)) {
    blocked_by.push("boundary_not_all_false");
  }

  const nodeIds = new Set((ontology.ontology_nodes ?? []).map((n) => n.node_id));
  for (const id of ONTOLOGY_NODE_IDS) {
    if (!nodeIds.has(id)) {
      blocked_by.push(`missing_ontology_node:${id}`);
    }
  }

  for (const rel of ontology.relationships ?? []) {
    if (!rel.boundary) {
      blocked_by.push(`relationship_missing_boundary:${rel.from}->${rel.to}`);
    }
  }

  for (const node of ontology.ontology_nodes ?? []) {
    if (!node.consent_mode) {
      blocked_by.push(`node_missing_consent_mode:${node.node_id}`);
    }
  }

  const invariantIds = new Set((ontology.invariants ?? []).map((i) => i.id));
  for (const required of [
    "home_is_node_space",
    "metadata_default",
    "no_scan_share",
    "no_philosophy_runtime",
  ]) {
    if (!invariantIds.has(required)) {
      blocked_by.push(`missing_invariant:${required}`);
    }
  }

  const scanText = JSON.stringify({
    axiom: ontology.axiom,
    allowed_claims: ontology.allowed_claims,
    invariants: ontology.invariants,
    ontology_nodes: (ontology.ontology_nodes ?? []).map((n) => ({
      description: n.description,
      label: n.label,
    })),
  });
  for (const phrase of FORBIDDEN_OVERCLAIMS) {
    if (hasPositiveOverclaim(scanText, phrase)) {
      blocked_by.push(`forbidden_overclaim_present:${phrase}`);
    }
  }

  const proof = ontology.proof_requirements;
  if (!proof?.contribution_path_requires?.includes("receipt_plan")) {
    blocked_by.push("proof_missing_receipt_requirement");
  }

  return Object.freeze({ ok: blocked_by.length === 0, blocked_by });
}

export function runDemaHomeNodeSpaceOntologyGate() {
  const ontology = buildDemaHomeNodeSpaceOntology();
  const verified = verifyDemaHomeNodeSpaceOntology(ontology);
  return freezeDeep({
    ok: verified.ok,
    schema: DEMA_HOME_NODE_SPACE_ONTOLOGY_SCHEMA,
    truth_label: DEMA_HOME_NODE_SPACE_ONTOLOGY_TRUTH_LABEL,
    verified,
    ontology_node_count: ontology.ontology_nodes.length,
    ontology,
  });
}
