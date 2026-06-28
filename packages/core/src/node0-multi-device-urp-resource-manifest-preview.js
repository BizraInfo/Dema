// NODE0-MULTI-DEVICE-URP-RESOURCE-MANIFEST-PREVIEW-1A
//
// Preview-only composer for one human node's laptop + mobile resource body.
// It consumes provided metadata manifests only. It does not scan, extract,
// read content, sync devices, write URP state, mint, or touch wallets.

import { createHash } from "node:crypto";

import { buildPreviewBoundary } from "./preview-boundary.js";

export const NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_SCHEMA =
  "bizra.node0.multi_device_urp_resource_manifest_preview.v0.1";
export const NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_TRUTH_LABEL =
  "NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_PREVIEW_ONLY";
export const NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_GENERATED_AT =
  "2026-06-28T01:00:00.000Z";

export const NODE0_DEVICE_RESOURCE_MANIFEST_FIXTURE = Object.freeze([
  Object.freeze({
    device_id: "dev:laptop-primary",
    device_type: "laptop_node",
    label: "Primary laptop",
    trust_level: "paired_trusted",
    resources: Object.freeze([
      Object.freeze({
        resource_id: "res:laptop:proof-export.zip",
        name: "node0-proof-export.zip",
        category: "proof_archive",
        relative_path: "archives/node0-proof-export.zip",
        extension: ".zip",
        size_bytes: 12_000_000,
        mtime_iso: NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_GENERATED_AT,
        sensitivity: "business",
        project_hint: "node0",
        version_hint: "v1",
      }),
      Object.freeze({
        resource_id: "res:laptop:bizra-notes-v2.md",
        name: "bizra-notes-v2.md",
        category: "notes",
        relative_path: "work/bizra-notes-v2.md",
        extension: ".md",
        size_bytes: 18_400,
        mtime_iso: NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_GENERATED_AT,
        sensitivity: "personal",
        project_hint: "bizra",
        version_hint: "v2",
      }),
      Object.freeze({
        resource_id: "res:laptop:budget-2026.xlsx",
        name: "budget-2026.xlsx",
        category: "finance",
        relative_path: "finance/budget-2026.xlsx",
        extension: ".xlsx",
        size_bytes: 256_000,
        mtime_iso: NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_GENERATED_AT,
        sensitivity: "financial",
        project_hint: "node0",
      }),
    ]),
  }),
  Object.freeze({
    device_id: "dev:mobile-primary",
    device_type: "mobile_node",
    label: "Primary mobile",
    trust_level: "paired_high_trust",
    resources: Object.freeze([
      Object.freeze({
        resource_id: "res:mobile:proof-export.zip",
        name: "node0-proof-export.zip",
        category: "proof_archive",
        relative_path: "exports/node0-proof-export.zip",
        extension: ".zip",
        size_bytes: 12_000_000,
        mtime_iso: NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_GENERATED_AT,
        sensitivity: "business",
        project_hint: "node0",
        version_hint: "v1",
      }),
      Object.freeze({
        resource_id: "res:mobile:bizra-notes-v1.md",
        name: "bizra-notes-v1.md",
        category: "notes",
        relative_path: "notes/bizra-notes-v1.md",
        extension: ".md",
        size_bytes: 17_900,
        mtime_iso: NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_GENERATED_AT,
        sensitivity: "personal",
        project_hint: "bizra",
        version_hint: "v1",
      }),
      Object.freeze({
        resource_id: "res:mobile:field-capture.mov",
        name: "field-capture.mov",
        category: "media",
        relative_path: "camera/field-capture.mov",
        extension: ".mov",
        size_bytes: 48_000_000,
        mtime_iso: NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_GENERATED_AT,
        sensitivity: "private",
        project_hint: "node0",
      }),
    ]),
  }),
]);

const SENSITIVE_LEVELS = new Set(["personal", "financial", "legal", "private"]);

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freezeDeep(child);
  return value;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function previewHash(payload) {
  return `sha256:${sha256(stableStringify(payload))}`;
}

function manifestBoundary() {
  return freezeDeep({
    ...buildPreviewBoundary(),
    file_content_read: false,
    file_mutation_performed: false,
    mobile_extraction_performed: false,
    device_sync_performed: false,
    ocr_performed: false,
    embedding_generated: false,
    upload_performed: false,
    network_used: false,
    urp_write_performed: false,
    token_minted: false,
    wallet_accessed: false,
    transfer_performed: false,
    daemon_started: false,
    autonomous_action_performed: false,
  });
}

function normalizeResource(resource, device) {
  return freezeDeep({
    ...resource,
    device_id: device.device_id,
    device_type: device.device_type,
    metadata_only: true,
    content_read: false,
  });
}

function allResources(devices) {
  return freezeDeep(
    devices.flatMap((device) =>
      (device.resources ?? []).map((resource) => normalizeResource(resource, device)),
    ),
  );
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return freezeDeep(counts);
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    const group = map.get(key) ?? [];
    group.push(item);
    map.set(key, group);
  }
  return map;
}

function duplicateFingerprint(resource) {
  return `${resource.name}:${resource.size_bytes}:${resource.extension}`;
}

function versionFamily(resource) {
  return String(resource.name)
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[-_ ]v?\d+$/u, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildDeviceManifests(devices) {
  return freezeDeep(
    devices.map((device) => ({
      device_id: device.device_id,
      device_type: device.device_type,
      label: device.label,
      trust_level: device.trust_level,
      resource_count: (device.resources ?? []).length,
      provenance: Object.freeze({
        source: "provided_device_resource_manifest",
        scan_executed: false,
        content_read: false,
      }),
      resource_ids: Object.freeze(
        (device.resources ?? []).map((resource) => resource.resource_id).sort(),
      ),
    })),
  );
}

function buildResourceClusters(resources) {
  return freezeDeep(
    [...groupBy(resources, (resource) => resource.category).entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, rows]) => ({
        cluster_id: `resource-cluster:${category}`,
        category,
        resource_count: rows.length,
        device_ids: Object.freeze([...new Set(rows.map((r) => r.device_id))].sort()),
        resource_ids: Object.freeze(rows.map((r) => r.resource_id).sort()),
        basis: "category_metadata_only",
      })),
  );
}

function buildNoiseMap(resources) {
  return freezeDeep(
    resources
      .filter((resource) => /final|copy|export|archive|v\d+/i.test(resource.name))
      .map((resource) => ({
        resource_id: resource.resource_id,
        device_id: resource.device_id,
        noise_hint: /v\d+/i.test(resource.name)
          ? "version_chain_candidate"
          : "organization_review_candidate",
        basis: "filename_metadata_only",
      })),
  );
}

function buildSensitiveHints(resources) {
  return freezeDeep(
    resources
      .filter((resource) => SENSITIVE_LEVELS.has(resource.sensitivity))
      .map((resource) => ({
        resource_id: resource.resource_id,
        device_id: resource.device_id,
        sensitivity: resource.sensitivity,
        human_review_required: true,
        content_read_allowed: false,
      })),
  );
}

function buildDuplicateCandidates(resources) {
  return freezeDeep(
    [...groupBy(resources, duplicateFingerprint).entries()]
      .filter(([, rows]) => rows.length > 1)
      .filter(([, rows]) => new Set(rows.map((r) => r.device_id)).size > 1)
      .map(([fingerprint, rows]) => ({
        candidate_id: `cross-device-duplicate:${sha256(fingerprint).slice(0, 16)}`,
        detection_method: "name_size_extension_cross_device_metadata",
        resource_ids: Object.freeze(rows.map((r) => r.resource_id).sort()),
        device_ids: Object.freeze([...new Set(rows.map((r) => r.device_id))].sort()),
        content_hash_required_for_confirmation: true,
        merge_allowed_now: false,
      })),
  );
}

function buildVersionChainCandidates(resources) {
  return freezeDeep(
    [...groupBy(resources, versionFamily).entries()]
      .filter(([, rows]) => rows.length > 1)
      .filter(([, rows]) => rows.some((r) => r.version_hint))
      .filter(([, rows]) => new Set(rows.map((r) => r.device_id)).size > 1)
      .map(([family, rows]) => ({
        chain_id: `version-chain:${sha256(family).slice(0, 16)}`,
        family,
        detection_method: "filename_version_hint_metadata",
        resource_ids: Object.freeze(rows.map((r) => r.resource_id).sort()),
        device_ids: Object.freeze([...new Set(rows.map((r) => r.device_id))].sort()),
        latest_version_unverified: true,
        content_compare_required: true,
      })),
  );
}

function buildMintEligibilityPreview(resources, urpPolicy) {
  return freezeDeep({
    preview_only: true,
    eligible_candidate_count: resources.filter((r) =>
      ["proof_archive", "notes", "media"].includes(r.category),
    ).length,
    policy: urpPolicy,
    requires: Object.freeze([
      "human_review",
      "content_consent_if_needed",
      "impact_verification",
      "separate_mint_authorization",
    ]),
    token_minted: false,
    wallet_accessed: false,
  });
}

function buildUrpContributionPreview(resources) {
  return freezeDeep({
    preview_only: true,
    candidate_resource_ids: Object.freeze(
      resources
        .filter((r) => ["proof_archive", "notes"].includes(r.category))
        .map((r) => r.resource_id)
        .sort(),
    ),
    transfer_performed: false,
    urp_write_performed: false,
    consent_required: "GO: preview URP packaging only; separate GO required to write or transfer",
  });
}

function buildReceiptChainPreview({
  node_id,
  previous_state_hash,
  resources,
  boundaries,
}) {
  const block = {
    node_id,
    previous_state_hash,
    resource_ids: resources.map((resource) => resource.resource_id).sort(),
    truth_label: NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_TRUTH_LABEL,
    verification_result: "PREVIEW_VERIFIED_NO_DEVICE_ACTION",
    boundaries,
  };
  return freezeDeep({
    previous_state_hash,
    block_preview_hash: previewHash(block),
    verification_result: block.verification_result,
    no_device_action_performed: true,
  });
}

function buildSelfImprovementInputs(resources) {
  return freezeDeep({
    preview_only: true,
    later_rsi_inputs: Object.freeze([
      "cross_device_duplicate_density",
      "sensitive_resource_review_load",
      "version_chain_resolution_rate",
      "receipt_chain_continuity",
    ]),
    observed_metadata_counts: countBy(resources, (resource) => resource.category),
    model_training_or_rl_performed: false,
  });
}

export function buildNode0MultiDeviceUrpResourceManifestPreview({
  node_id = "node0:mohamed",
  human_owner = "Mohamed",
  devices = null,
  device_resource_manifests = NODE0_DEVICE_RESOURCE_MANIFEST_FIXTURE,
  urp_policy = "candidate_only_no_write",
  consent_proof = Object.freeze({ collected: false, mode: "preview_only" }),
  previous_state_hash = "sha256:genesis-preview",
  boundary = manifestBoundary(),
} = {}) {
  const boundaries = freezeDeep({ ...manifestBoundary(), ...boundary });
  const resources = allResources(device_resource_manifests);
  const device_manifests = buildDeviceManifests(device_resource_manifests);
  const derived_devices = freezeDeep(
    device_manifests.map((device) => ({
      device_id: device.device_id,
      device_type: device.device_type,
    })),
  );
  const declaredDeviceIds = new Set((devices ?? []).map((device) => device.device_id));
  const manifestDeviceIds = new Set(derived_devices.map((device) => device.device_id));
  const device_mismatch =
    declaredDeviceIds.size > 0 &&
    (declaredDeviceIds.size !== manifestDeviceIds.size ||
      [...manifestDeviceIds].some((id) => !declaredDeviceIds.has(id)));
  const duplicate_cross_device_candidates = buildDuplicateCandidates(resources);
  const version_chain_cross_device_candidates =
    buildVersionChainCandidates(resources);

  return freezeDeep({
    schema: NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_SCHEMA,
    truth_label: NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_TRUTH_LABEL,
    node_id,
    human_owner,
    device_count: device_manifests.length,
    devices: derived_devices,
    input_device_manifest_consistency: Object.freeze({
      declared_devices_match_manifests: !device_mismatch,
      declared_device_count: declaredDeviceIds.size,
      manifest_device_count: manifestDeviceIds.size,
    }),
    device_manifests,
    consent_proof,
    unified_node_space_summary: Object.freeze({
      resource_count: resources.length,
      device_count: device_manifests.length,
      category_counts: countBy(resources, (resource) => resource.category),
      device_type_counts: countBy(device_resource_manifests, (device) => device.device_type),
      metadata_only: true,
    }),
    resource_clusters: buildResourceClusters(resources),
    noise_map: buildNoiseMap(resources),
    sensitive_resource_hints: buildSensitiveHints(resources),
    duplicate_cross_device_candidates,
    version_chain_cross_device_candidates,
    mint_eligibility_preview: buildMintEligibilityPreview(resources, urp_policy),
    urp_contribution_preview: buildUrpContributionPreview(resources),
    receipt_chain_preview: buildReceiptChainPreview({
      node_id,
      previous_state_hash,
      resources,
      boundaries,
    }),
    self_improvement_inputs: buildSelfImprovementInputs(resources),
    blocked_by: Object.freeze(
      device_mismatch ? ["declared_devices_do_not_match_manifests"] : [],
    ),
    boundaries,
    what_this_proves: Object.freeze([
      "Provided laptop and mobile resource manifests can be composed into one metadata-only Node0 resource body preview.",
      "Cross-device duplicate and version-chain candidates can be surfaced without content reads.",
      "URP and mint eligibility can be represented as blocked previews without writing URP state, minting, or wallet access.",
    ]),
    what_this_does_not_prove: Object.freeze([
      "No laptop or mobile scan was executed.",
      "No mobile extraction, content read, OCR, embedding, upload, sync, URP write, mint, wallet, transfer, daemon, or autonomous action occurred.",
      "No resource impact, reward, or contribution eligibility is verified.",
    ]),
  });
}

function boundaryAllFalse(boundary) {
  if (!boundary || typeof boundary !== "object") return false;
  return Object.values(boundary).every((value) => value === false);
}

export function verifyNode0MultiDeviceUrpResourceManifestPreview(report) {
  const blocked_by = [];

  if (!report || report.schema !== NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_SCHEMA) {
    blocked_by.push("invalid_schema");
    return Object.freeze({ ok: false, blocked_by });
  }
  if (report.truth_label !== NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_TRUTH_LABEL) {
    blocked_by.push("invalid_truth_label");
  }
  if (!report.node_id || !report.human_owner) {
    blocked_by.push("missing_node_identity");
  }
  if (!boundaryAllFalse(report.boundaries)) {
    blocked_by.push("boundary_not_all_false");
  }
  for (const code of report.blocked_by ?? []) {
    blocked_by.push(code);
  }
  const deviceTypes = new Set(report.device_manifests?.map((d) => d.device_type));
  for (const required of ["laptop_node", "mobile_node"]) {
    if (!deviceTypes.has(required)) blocked_by.push(`missing_device_type:${required}`);
  }
  for (const device of report.device_manifests ?? []) {
    if (device.provenance?.scan_executed !== false) {
      blocked_by.push(`device_scan_executed:${device.device_id}`);
    }
    if (device.provenance?.content_read !== false) {
      blocked_by.push(`device_content_read:${device.device_id}`);
    }
  }
  if (!Array.isArray(report.duplicate_cross_device_candidates)) {
    blocked_by.push("cross_device_duplicate_candidates_invalid");
  }
  if (!Array.isArray(report.version_chain_cross_device_candidates)) {
    blocked_by.push("cross_device_version_chain_candidates_invalid");
  }
  if (!Array.isArray(report.sensitive_resource_hints)) {
    blocked_by.push("sensitive_resource_hints_invalid");
  }
  if (report.mint_eligibility_preview?.token_minted !== false) {
    blocked_by.push("mint_preview_mutated_token_state");
  }
  if (report.mint_eligibility_preview?.wallet_accessed !== false) {
    blocked_by.push("mint_preview_accessed_wallet");
  }
  if (report.urp_contribution_preview?.urp_write_performed !== false) {
    blocked_by.push("urp_preview_wrote_state");
  }
  if (report.urp_contribution_preview?.transfer_performed !== false) {
    blocked_by.push("urp_preview_transferred");
  }
  if (!/^sha256:/.test(report.receipt_chain_preview?.block_preview_hash ?? "")) {
    blocked_by.push("receipt_chain_hash_missing");
  }
  if (report.self_improvement_inputs?.model_training_or_rl_performed !== false) {
    blocked_by.push("self_improvement_executed");
  }

  return Object.freeze({ ok: blocked_by.length === 0, blocked_by });
}

export function runNode0MultiDeviceUrpResourceManifestPreviewGate() {
  const report = buildNode0MultiDeviceUrpResourceManifestPreview();
  const verified = verifyNode0MultiDeviceUrpResourceManifestPreview(report);
  return freezeDeep({
    ok: verified.ok,
    schema: NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_SCHEMA,
    truth_label: NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_TRUTH_LABEL,
    verified,
    device_count: report.device_count,
    resource_count: report.unified_node_space_summary.resource_count,
    report,
  });
}
