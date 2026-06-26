// MULTI-DEVICE-ASSET-AWARENESS-1A — sovereign device constellation model.
//
// Models user assets across laptop, mobile, external storage, and cloud-export
// folders. Metadata-first default; scoped content consent; mobile high-value/high-
// sensitivity; cross-device dedupe and organization as plan-only previews.

import { createHash } from "node:crypto";

import { buildPreviewBoundary } from "./preview-boundary.js";

export const MULTI_DEVICE_ASSET_AWARENESS_SCHEMA =
  "bizra.dema.multi_device_asset_awareness.v0.1";
export const MULTI_DEVICE_ASSET_AWARENESS_TRUTH_LABEL =
  "MULTI_DEVICE_ASSET_AWARENESS_DOCS_ONLY";

export const DEFAULT_SCAN_MODE = "metadata_only_default";

export const DEVICE_FIXTURE_GENERATED_AT = "2026-06-26T17:00:00.000Z";

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freezeDeep(child);
  return value;
}

function deviceBoundary() {
  return freezeDeep({
    ...buildPreviewBoundary(),
    file_content_read: false,
    ocr_performed: false,
    transcription_performed: false,
    embedding_generated: false,
    content_parsed: false,
    mobile_extraction_performed: false,
    cloud_connector_accessed: false,
    network_used: false,
    upload_performed: false,
    sharing_performed: false,
    economic_action_performed: false,
    token_minted: false,
    wallet_accessed: false,
    urp_submission_performed: false,
    node0_activation_performed: false,
  });
}

function baseDeviceProfile({
  device_id,
  device_type,
  trust_level,
  label,
  asset_type_counts,
  hardware_resource_profile,
  storage_profile,
  sensitivity_profile,
  consent_scope,
  extra = {},
}) {
  return freezeDeep({
    device_id,
    device_type,
    label,
    trust_level,
    scan_mode_default: DEFAULT_SCAN_MODE,
    asset_type_counts,
    hardware_resource_profile,
    storage_profile,
    sensitivity_profile,
    consent_scope,
    duplicate_candidate_plan: Object.freeze({
      method: "metadata_fingerprint_cross_device_plan",
      requires_consent: "fingerprint_dedupe_consent",
      preview_only: true,
    }),
    organization_plan: Object.freeze({
      strategy: "cluster_by_top_level_and_type",
      preview_only: true,
    }),
    context_awareness_plan: Object.freeze({
      signals: Object.freeze(["folder_structure", "timestamps", "device_role"]),
      content_read_implied: false,
      preview_only: true,
    }),
    content_awareness_plan: Object.freeze({
      default: "metadata_only_default",
      requires: "content_classification_consent",
      mobile_requires: "deep_understanding_strong_consent",
      preview_only: true,
    }),
    urp_candidate_resource_plan: Object.freeze({
      candidate_only: true,
      submission_requires: "share_export_separate_consent",
      preview_only: true,
    }),
    ...extra,
  });
}

export const DEVICE_CONSTELLATION_FIXTURE = Object.freeze([
  baseDeviceProfile({
    device_id: "dev:laptop-primary",
    device_type: "laptop_node",
    trust_level: "paired_trusted",
    label: "Primary laptop",
    asset_type_counts: Object.freeze({
      documents: 420,
      code_projects: 18,
      models: 4,
      archives: 6,
      screenshots: 55,
    }),
    hardware_resource_profile: Object.freeze({
      cpu_cores: 16,
      ram_gb: 64,
      gpu_present: true,
      local_llm_capable: true,
    }),
    storage_profile: Object.freeze({
      total_gb: 2048,
      free_gb: 640,
      external_mounts: 1,
    }),
    sensitivity_profile: Object.freeze({
      level: "medium",
      contains_finance: true,
      contains_legal: true,
    }),
    consent_scope: Object.freeze({
      metadata_scan: "implicit_home_node",
      content_scan: "explicit_scoped",
      fingerprint: "explicit",
    }),
  }),
  baseDeviceProfile({
    device_id: "dev:mobile-primary",
    device_type: "mobile_node",
    trust_level: "paired_high_trust",
    label: "Primary mobile",
    asset_type_counts: Object.freeze({
      photos: 12_400,
      videos: 820,
      voice_notes: 140,
      screenshots: 2100,
      app_exports: 35,
    }),
    hardware_resource_profile: Object.freeze({
      secure_enclave: true,
      biometrics_available: true,
      sensors: Object.freeze(["camera", "microphone", "gps", "accelerometer"]),
      edge_compute_tier: "mobile",
    }),
    storage_profile: Object.freeze({
      total_gb: 256,
      free_gb: 42,
    }),
    sensitivity_profile: Object.freeze({
      level: "high",
      high_value: true,
      high_sensitivity: true,
      contains_personal_context: true,
    }),
    consent_scope: Object.freeze({
      metadata_scan: "explicit_pairing_required",
      content_scan: "deep_understanding_strong_consent",
      mobile_extraction: "never_without_explicit_consent",
      cloud_connector: "separate_consent",
    }),
    extra: {
      mobile_resource_value_profile: Object.freeze({
        high_value: true,
        high_sensitivity: true,
        urp_asset_class_candidate: "mobile_edge_node",
        value_signals: Object.freeze([
          "field_capture",
          "proof_of_presence",
          "media_richness",
          "always_near_human",
        ]),
        extraction_default: "blocked",
      }),
    },
  }),
  baseDeviceProfile({
    device_id: "dev:external-ssd-01",
    device_type: "external_drive",
    trust_level: "paired_trusted",
    label: "External SSD",
    asset_type_counts: Object.freeze({
      backups: 24,
      archives: 18,
      duplicates: 9,
      unknown: 2,
    }),
    hardware_resource_profile: Object.freeze({
      interface: "usb3",
      portable: true,
    }),
    storage_profile: Object.freeze({
      total_gb: 4096,
      free_gb: 1100,
    }),
    sensitivity_profile: Object.freeze({
      level: "medium",
      stale_backup_risk: true,
    }),
    consent_scope: Object.freeze({
      metadata_scan: "explicit_mount_consent",
      fingerprint: "explicit",
    }),
  }),
  baseDeviceProfile({
    device_id: "dev:cloud-export-folder",
    device_type: "optional_cloud_export_folder",
    trust_level: "limited_trust",
    label: "Downloaded cloud exports",
    asset_type_counts: Object.freeze({
      csv_exports: 12,
      json_exports: 8,
      media_downloads: 44,
    }),
    hardware_resource_profile: Object.freeze({
      hosted: false,
      local_folder_only: true,
    }),
    storage_profile: Object.freeze({
      total_gb: 120,
      free_gb: 30,
    }),
    sensitivity_profile: Object.freeze({
      level: "high",
      third_party_origin: true,
    }),
    consent_scope: Object.freeze({
      metadata_scan: "explicit",
      cloud_connector_access: "separate_consent_required",
      direct_cloud_api: "forbidden_by_default",
    }),
  }),
]);

function buildCrossDeviceIndexPlan(devices) {
  return freezeDeep({
    preview_only: true,
    default_scan_mode: DEFAULT_SCAN_MODE,
    device_ids: Object.freeze(devices.map((d) => d.device_id)),
    index_method: "metadata_only_per_device",
    unified_asset_graph_preview: true,
    content_index_requires_consent: true,
  });
}

function buildDuplicateResolutionPlan(devices) {
  return freezeDeep({
    preview_only: true,
    cross_device_dedupe_method: "metadata_fingerprint_then_optional_hash",
    requires_consent: "fingerprint_dedupe_consent",
    candidate_pairs_preview: Object.freeze([
      Object.freeze({
        devices: Object.freeze(["dev:laptop-primary", "dev:external-ssd-01"]),
        reason: "backup_name_size_collision_preview",
      }),
      Object.freeze({
        devices: Object.freeze(["dev:laptop-primary", "dev:mobile-primary"]),
        reason: "screenshot_export_collision_preview",
      }),
    ]),
    execution_blocked_without_consent: true,
  });
}

function buildOrganizationPlan(devices) {
  return freezeDeep({
    preview_only: true,
    strategy: "cross_device_cluster_by_category_and_project",
    covers_mixed_files: true,
    device_count: devices.length,
    stages: Object.freeze([
      "metadata_cluster",
      "sensitivity_tag",
      "duplicate_surface",
      "organization_preview",
      "consent_before_content",
    ]),
  });
}

function buildContextAwarenessPlan() {
  return freezeDeep({
    preview_only: true,
    content_read_implied: false,
    signals: Object.freeze([
      "device_role",
      "folder_topology",
      "recency_timestamps",
      "cross_device_project_markers",
    ]),
    staged_not_automatic: true,
  });
}

function buildContentAwarenessConsentPlan(devices) {
  return freezeDeep({
    default: DEFAULT_SCAN_MODE,
    per_device: Object.freeze(
      devices.map((d) =>
        Object.freeze({
          device_id: d.device_id,
          content_requires: d.content_awareness_plan.requires,
          mobile_strong_consent:
            d.device_type === "mobile_node"
              ? d.content_awareness_plan.mobile_requires
              : null,
        }),
      ),
    ),
    rules: Object.freeze([
      "No content read by default on any device.",
      "Mobile requires strongest consent tier for OCR/transcription/embeddings.",
      "Cloud connector access is separate from local export-folder metadata scan.",
    ]),
  });
}

function buildUrpCandidateBoundaries() {
  return freezeDeep({
    candidate_only: true,
    submission_requires: "share_export_separate_consent",
    mobile_high_value_class: "mobile_edge_node",
    scan_does_not_imply_urp: true,
    receipt_plan_required: true,
  });
}

function buildProofReceiptRequirements() {
  return freezeDeep({
    required_fields: Object.freeze([
      "device_id",
      "scan_mode",
      "scope",
      "user_consent",
      "timestamp_iso",
      "boundaries",
      "reproducible_command",
    ]),
    reproducible_command_template:
      "dema devices index --mode metadata_only_default --devices <ids> --consent-receipt <id>",
    preview_only: true,
  });
}

export function buildMultiDeviceAssetAwareness({
  devices = DEVICE_CONSTELLATION_FIXTURE,
  generated_at_iso = DEVICE_FIXTURE_GENERATED_AT,
} = {}) {
  const report_id = `sha256:${createHash("sha256")
    .update(JSON.stringify({ schema: MULTI_DEVICE_ASSET_AWARENESS_SCHEMA, n: devices.length }))
    .digest("hex")}`;

  const mobile = devices.find((d) => d.device_type === "mobile_node");

  return freezeDeep({
    schema: MULTI_DEVICE_ASSET_AWARENESS_SCHEMA,
    truth_label: MULTI_DEVICE_ASSET_AWARENESS_TRUTH_LABEL,
    valid: true,
    generated_at_iso,
    report_id,
    default_scan_mode: DEFAULT_SCAN_MODE,
    devices,
    cross_device_index_plan: buildCrossDeviceIndexPlan(devices),
    duplicate_resolution_plan: buildDuplicateResolutionPlan(devices),
    organization_plan: buildOrganizationPlan(devices),
    context_awareness_plan: buildContextAwarenessPlan(),
    content_awareness_consent_plan: buildContentAwarenessConsentPlan(devices),
    mobile_resource_value_profile:
      mobile?.mobile_resource_value_profile ??
      Object.freeze({ high_value: false, high_sensitivity: false }),
    urp_candidate_boundaries: buildUrpCandidateBoundaries(),
    proof_receipt_requirements: buildProofReceiptRequirements(),
    what_this_does_not_prove: Object.freeze([
      "No device was scanned — this models the constellation and plans only.",
      "Cross-device dedupe is plan-only until fingerprint consent exists.",
      "URP candidacy is preview-only; no submission or token action occurred.",
    ]),
    boundary: deviceBoundary(),
    boundaries: deviceBoundary(),
  });
}

function boundaryAllFalse(boundary) {
  if (!boundary || typeof boundary !== "object") return false;
  return Object.values(boundary).every((v) => v === false);
}

export function verifyMultiDeviceAssetAwareness(report) {
  const blocked_by = [];

  if (!report || report.schema !== MULTI_DEVICE_ASSET_AWARENESS_SCHEMA) {
    blocked_by.push("invalid_schema");
    return Object.freeze({ ok: false, blocked_by });
  }
  if (report.truth_label !== MULTI_DEVICE_ASSET_AWARENESS_TRUTH_LABEL) {
    blocked_by.push("invalid_truth_label");
  }
  if (report.default_scan_mode !== DEFAULT_SCAN_MODE) {
    blocked_by.push("default_scan_mode_not_metadata");
  }
  if (!boundaryAllFalse(report.boundary)) {
    blocked_by.push("boundary_not_all_false");
  }

  const devices = report.devices ?? [];
  const deviceTypes = new Set(devices.map((d) => d.device_type));
  for (const required of [
    "laptop_node",
    "mobile_node",
    "external_drive",
    "optional_cloud_export_folder",
  ]) {
    if (!deviceTypes.has(required)) {
      blocked_by.push(`missing_device_class:${required}`);
    }
  }

  const mobile = devices.find((d) => d.device_type === "mobile_node");
  if (!mobile?.sensitivity_profile?.high_value) {
    blocked_by.push("mobile_not_high_value");
  }
  if (!mobile?.sensitivity_profile?.high_sensitivity) {
    blocked_by.push("mobile_not_high_sensitivity");
  }

  for (const device of devices) {
    if (device.scan_mode_default !== DEFAULT_SCAN_MODE) {
      blocked_by.push(`device_default_scan_not_metadata:${device.device_id}`);
    }
    if (device.content_awareness_plan?.content_read_implied === true) {
      blocked_by.push(`content_read_implied:${device.device_id}`);
    }
  }

  if (!report.duplicate_resolution_plan?.execution_blocked_without_consent) {
    blocked_by.push("dedupe_not_consent_gated");
  }

  if (!report.organization_plan?.covers_mixed_files) {
    blocked_by.push("organization_plan_incomplete");
  }

  if (report.context_awareness_plan?.content_read_implied !== false) {
    blocked_by.push("context_implies_content_read");
  }

  if (report.content_awareness_consent_plan?.default !== DEFAULT_SCAN_MODE) {
    blocked_by.push("content_plan_default_wrong");
  }

  if (report.urp_candidate_boundaries?.candidate_only !== true) {
    blocked_by.push("urp_not_candidate_only");
  }
  if (report.urp_candidate_boundaries?.scan_does_not_imply_urp !== true) {
    blocked_by.push("scan_implies_urp");
  }

  const receipt = report.proof_receipt_requirements;
  if (!receipt?.required_fields?.includes("user_consent")) {
    blocked_by.push("proof_missing_consent_field");
  }

  return Object.freeze({ ok: blocked_by.length === 0, blocked_by });
}

export function runMultiDeviceAssetAwarenessGate() {
  const report = buildMultiDeviceAssetAwareness();
  const verified = verifyMultiDeviceAssetAwareness(report);
  return freezeDeep({
    ok: verified.ok,
    schema: MULTI_DEVICE_ASSET_AWARENESS_SCHEMA,
    truth_label: MULTI_DEVICE_ASSET_AWARENESS_TRUTH_LABEL,
    verified,
    device_count: report.devices.length,
    report,
  });
}
