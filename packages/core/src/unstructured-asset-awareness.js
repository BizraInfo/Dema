// UNSTRUCTURED-ASSET-AWARENESS-GATE-1A — metadata-only unstructured life-data awareness.
//
// Evolves homebase asset awareness from "what files exist" to "what hidden value
// may exist in mixed unstructured data" — without content reads, OCR, embeddings,
// network, upload, sharing, or economic action.

import { createHash } from "node:crypto";

import { buildPreviewBoundary } from "./preview-boundary.js";
import {
  LOCAL_ASSET_INVENTORY_SCHEMA,
} from "./local-asset-awareness.js";

export const UNSTRUCTURED_ASSET_AWARENESS_SCHEMA =
  "bizra.dema.unstructured_asset_awareness.v0.1";
export const UNSTRUCTURED_ASSET_AWARENESS_TRUTH_LABEL =
  "UNSTRUCTURED_ASSET_AWARENESS_DOCS_ONLY";

export const UNSTRUCTURED_FIXTURE_GENERATED_AT = "2026-06-26T14:00:00.000Z";

export const UNSTRUCTURED_LIFE_CATEGORIES = Object.freeze([
  "personal",
  "business",
  "research",
  "finance",
  "legal",
  "media",
  "code",
  "project",
  "unknown",
]);

export const UNSTRUCTURED_SENSITIVITY_CLASSES = Object.freeze([
  "public_metadata",
  "sensitive_personal",
  "sensitive_finance",
  "sensitive_legal",
  "sensitive_media",
  "unknown_review",
]);

export const UNSTRUCTURED_FIXTURE_RECORDS = Object.freeze([
  Object.freeze({
    record_id: "id:reports/Q1-summary.pdf",
    kind: "file",
    name: "Q1-summary.pdf",
    relative_path: "reports/Q1-summary.pdf",
    extension: ".pdf",
    category: "document",
    size_bytes: 245_760,
    mtime_iso: UNSTRUCTURED_FIXTURE_GENERATED_AT,
    risk_flags: Object.freeze([]),
    content_hash: null,
    content_preview: null,
  }),
  Object.freeze({
    record_id: "id:notes/daily.md",
    kind: "file",
    name: "daily.md",
    relative_path: "notes/daily.md",
    extension: ".md",
    category: "document",
    size_bytes: 4_096,
    mtime_iso: UNSTRUCTURED_FIXTURE_GENERATED_AT,
    risk_flags: Object.freeze([]),
    content_hash: null,
    content_preview: null,
  }),
  Object.freeze({
    record_id: "id:exports/whatsapp-contacts.csv",
    kind: "file",
    name: "whatsapp-contacts.csv",
    relative_path: "exports/whatsapp-contacts.csv",
    extension: ".csv",
    category: "dataset",
    size_bytes: 18_432,
    mtime_iso: UNSTRUCTURED_FIXTURE_GENERATED_AT,
    risk_flags: Object.freeze([]),
    content_hash: null,
    content_preview: null,
  }),
  Object.freeze({
    record_id: "id:screenshots/invoice-2026.png",
    kind: "file",
    name: "invoice-2026.png",
    relative_path: "screenshots/invoice-2026.png",
    extension: ".png",
    category: "media",
    size_bytes: 512_000,
    mtime_iso: UNSTRUCTURED_FIXTURE_GENERATED_AT,
    risk_flags: Object.freeze([]),
    content_hash: null,
    content_preview: null,
  }),
  Object.freeze({
    record_id: "id:voice/idea-memo.m4a",
    kind: "file",
    name: "idea-memo.m4a",
    relative_path: "voice/idea-memo.m4a",
    extension: ".m4a",
    category: "media",
    size_bytes: 1_048_576,
    mtime_iso: UNSTRUCTURED_FIXTURE_GENERATED_AT,
    risk_flags: Object.freeze([]),
    content_hash: null,
    content_preview: null,
  }),
  Object.freeze({
    record_id: "id:videos/team-sync.mp4",
    kind: "file",
    name: "team-sync.mp4",
    relative_path: "videos/team-sync.mp4",
    extension: ".mp4",
    category: "media",
    size_bytes: 52_428_800,
    mtime_iso: UNSTRUCTURED_FIXTURE_GENERATED_AT,
    risk_flags: Object.freeze([]),
    content_hash: null,
    content_preview: null,
  }),
  Object.freeze({
    record_id: "id:backups/old-projects.zip",
    kind: "file",
    name: "old-projects.zip",
    relative_path: "backups/old-projects.zip",
    extension: ".zip",
    category: "archive",
    size_bytes: 10_485_760,
    mtime_iso: UNSTRUCTURED_FIXTURE_GENERATED_AT,
    risk_flags: Object.freeze([]),
    content_hash: null,
    content_preview: null,
  }),
  Object.freeze({
    record_id: "id:projects/demo/main.py",
    kind: "file",
    name: "main.py",
    relative_path: "projects/demo/main.py",
    extension: ".py",
    category: "code_project",
    size_bytes: 2_048,
    mtime_iso: UNSTRUCTURED_FIXTURE_GENERATED_AT,
    risk_flags: Object.freeze([]),
    content_hash: null,
    content_preview: null,
  }),
  Object.freeze({
    record_id: "id:finance/budget-2026.xlsx",
    kind: "file",
    name: "budget-2026.xlsx",
    relative_path: "finance/budget-2026.xlsx",
    extension: ".xlsx",
    category: "document",
    size_bytes: 65_536,
    mtime_iso: UNSTRUCTURED_FIXTURE_GENERATED_AT,
    risk_flags: Object.freeze([]),
    content_hash: null,
    content_preview: null,
  }),
  Object.freeze({
    record_id: "id:legal/service-agreement.pdf",
    kind: "file",
    name: "service-agreement.pdf",
    relative_path: "legal/service-agreement.pdf",
    extension: ".pdf",
    category: "document",
    size_bytes: 180_224,
    mtime_iso: UNSTRUCTURED_FIXTURE_GENERATED_AT,
    risk_flags: Object.freeze(["legal_document_marker"]),
    content_hash: null,
    content_preview: null,
  }),
  Object.freeze({
    record_id: "id:duplicates/Q1-summary-copy.pdf",
    kind: "file",
    name: "Q1-summary-copy.pdf",
    relative_path: "duplicates/Q1-summary-copy.pdf",
    extension: ".pdf",
    category: "document",
    size_bytes: 245_760,
    mtime_iso: UNSTRUCTURED_FIXTURE_GENERATED_AT,
    risk_flags: Object.freeze(["duplicate_candidate"]),
    content_hash: null,
    content_preview: null,
  }),
  Object.freeze({
    record_id: "id:mystery/unknown.bin",
    kind: "file",
    name: "unknown.bin",
    relative_path: "mystery/unknown.bin",
    extension: ".bin",
    category: "unknown",
    size_bytes: 8_192,
    mtime_iso: UNSTRUCTURED_FIXTURE_GENERATED_AT,
    risk_flags: Object.freeze([]),
    content_hash: null,
    content_preview: null,
  }),
  Object.freeze({
    record_id: "id:private/journal-personal.pdf",
    kind: "file",
    name: "journal-personal.pdf",
    relative_path: "private/journal-personal.pdf",
    extension: ".pdf",
    category: "document",
    size_bytes: 90_112,
    mtime_iso: UNSTRUCTURED_FIXTURE_GENERATED_AT,
    risk_flags: Object.freeze(["personal_private_marker"]),
    content_hash: null,
    content_preview: null,
  }),
]);

const EXTENSION_TYPE_MAP = Object.freeze({
  ".pdf": "pdf_document",
  ".md": "markdown_notes",
  ".csv": "csv_export",
  ".png": "screenshot_image",
  ".jpg": "screenshot_image",
  ".jpeg": "screenshot_image",
  ".m4a": "audio_note",
  ".mp3": "audio_note",
  ".wav": "audio_note",
  ".mp4": "video_recording",
  ".mov": "video_recording",
  ".zip": "zip_archive",
  ".xlsx": "spreadsheet",
  ".xls": "spreadsheet",
  ".py": "source_code",
  ".js": "source_code",
  ".ts": "source_code",
  ".bin": "unknown_binary",
  ".dat": "unknown_binary",
});

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "No file content was read — classification uses names, extensions, paths, and metadata only.",
  "No OCR, transcription, embedding, summarization, or parsing was performed.",
  "Parse and transformation plans are preview-only proposals, not executed conversions.",
  "No upload, export, sharing, token, wallet, or URP action occurred.",
  "Duplicate detection uses metadata heuristics only; content hashes were not computed.",
]);

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freezeDeep(child);
  return value;
}

function isValidInventory(inventory) {
  return (
    inventory &&
    inventory.schema === LOCAL_ASSET_INVENTORY_SCHEMA &&
    Array.isArray(inventory.records)
  );
}

function unstructuredBoundary(extra = {}) {
  return freezeDeep({
    ...buildPreviewBoundary(),
    ...extra,
    file_content_read: false,
    ocr_performed: false,
    embedding_generated: false,
    content_parsed: false,
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

function normalizeBaseName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/-copy/g, "")
    .replace(/\(copy\)/g, "")
    .replace(/\s+/g, "");
}

function duplicateFingerprint(record) {
  return `${normalizeBaseName(record.name)}|${record.extension}|${record.size_bytes}`;
}

function classifyUnstructuredType(record) {
  const ext = String(record.extension || "").toLowerCase();
  const path = String(record.relative_path || "").toLowerCase();
  if (record.risk_flags?.includes("duplicate_candidate")) {
    return "duplicate_candidate";
  }
  if (path.includes("/private/") || record.risk_flags?.includes("personal_private_marker")) {
    return "personal_private_document";
  }
  if (path.includes("/legal/") || record.risk_flags?.includes("legal_document_marker")) {
    return "contract_legal";
  }
  if (path.includes("/screenshots/") && [".png", ".jpg", ".jpeg"].includes(ext)) {
    return "screenshot_image";
  }
  if (path.includes("/voice/") || path.includes("/audio/")) {
    return "audio_note";
  }
  if (path.includes("/videos/")) {
    return "video_recording";
  }
  if (path.includes("/exports/") && ext === ".csv") {
    return "csv_export";
  }
  if (path.includes("/notes/") && ext === ".md") {
    return "markdown_notes";
  }
  if (path.includes("/reports/") && ext === ".pdf") {
    return "pdf_report";
  }
  if (path.includes("/finance/") && [".xlsx", ".xls"].includes(ext)) {
    return "spreadsheet";
  }
  if (record.category === "code_project" || [".py", ".js", ".ts"].includes(ext)) {
    return "source_code";
  }
  return EXTENSION_TYPE_MAP[ext] ?? "unknown_binary";
}

function classifyLifeCategory(record, unstructuredType) {
  const path = String(record.relative_path || "").toLowerCase();
  if (unstructuredType === "personal_private_document") return "personal";
  if (unstructuredType === "contract_legal" || path.includes("/legal/")) return "legal";
  if (path.includes("/finance/")) return "finance";
  if (path.includes("/reports/") || path.includes("/exports/")) return "business";
  if (path.includes("/notes/") || path.includes("/research/")) return "research";
  if (["screenshot_image", "audio_note", "video_recording"].includes(unstructuredType)) {
    return "media";
  }
  if (unstructuredType === "source_code" || record.category === "code_project") return "code";
  if (path.includes("/projects/")) return "project";
  if (unstructuredType === "unknown_binary") return "unknown";
  return "business";
}

function classifySensitivity(record, unstructuredType, lifeCategory) {
  if (unstructuredType === "personal_private_document") return "sensitive_personal";
  if (lifeCategory === "legal" || unstructuredType === "contract_legal") {
    return "sensitive_legal";
  }
  if (lifeCategory === "finance" || unstructuredType === "spreadsheet") {
    return "sensitive_finance";
  }
  if (lifeCategory === "media") return "sensitive_media";
  if (unstructuredType === "unknown_binary") return "unknown_review";
  return "public_metadata";
}

function consentRequirements(sensitivity, unstructuredType) {
  const base = ["metadata_awareness_only"];
  if (sensitivity.startsWith("sensitive_") || unstructuredType === "unknown_binary") {
    base.push("explicit_typed_go_before_content_read");
  }
  if (["csv_export", "spreadsheet", "markdown_notes", "pdf_report"].includes(unstructuredType)) {
    base.push("content_parse_consent");
  }
  if (["audio_note", "video_recording", "screenshot_image"].includes(unstructuredType)) {
    base.push("transcription_or_ocr_consent");
  }
  if (unstructuredType !== "unknown_binary") {
    base.push("summarize_consent");
    base.push("embed_consent");
    base.push("export_consent");
    base.push("share_consent");
  }
  return Object.freeze([...new Set(base)].sort());
}

function parseabilityPlan(unstructuredType, sensitivity) {
  if (unstructuredType === "unknown_binary") {
    return Object.freeze({
      level: "blocked_manual_review",
      steps: Object.freeze(["manual_review_before_any_parse"]),
    });
  }
  if (unstructuredType === "zip_archive") {
    return Object.freeze({
      level: "metadata_inventory_only_until_consent",
      steps: Object.freeze([
        "list_archive_entries_metadata_only",
        "require_explicit_go_before_inner_extract",
      ]),
    });
  }
  const steps = ["extension_and_path_classification_complete"];
  if (sensitivity.startsWith("sensitive_")) {
    steps.push("await_explicit_typed_go_before_content_read");
  } else {
    steps.push("content_parse_available_after_consent");
  }
  return Object.freeze({ level: "parseable_with_consent", steps: Object.freeze(steps) });
}

function valueTransformationCandidate(record, unstructuredType) {
  const map = Object.freeze({
    pdf_report: "executive_summary_candidate",
    markdown_notes: "knowledge_graph_node_candidate",
    csv_export: "structured_table_candidate",
    screenshot_image: "ocr_text_extract_candidate",
    audio_note: "transcript_summary_candidate",
    video_recording: "meeting_minutes_candidate",
    zip_archive: "project_bundle_inventory_candidate",
    source_code: "codebase_map_candidate",
    spreadsheet: "financial_model_table_candidate",
    contract_legal: "clause_outline_candidate",
    personal_private_document: "blocked_until_consent",
    duplicate_candidate: "dedupe_review_candidate",
    unknown_binary: "manual_classification_candidate",
  });
  return Object.freeze({
    record_id: record.record_id,
    transformation: map[unstructuredType] ?? "manual_review_candidate",
    preview_only: true,
    economic_action_performed: false,
  });
}

function buildDuplicateCandidates(records) {
  const groups = new Map();
  for (const record of records) {
    const fp = duplicateFingerprint(record);
    const group = groups.get(fp) || [];
    group.push(record.record_id);
    groups.set(fp, group);
  }
  const duplicates = [];
  for (const [fingerprint, recordIds] of groups.entries()) {
    if (recordIds.length < 2) continue;
    duplicates.push(
      Object.freeze({
        fingerprint: `sha256:${sha256(fingerprint)}`,
        record_ids: Object.freeze([...recordIds].sort()),
        reason: "matching_basename_extension_size_metadata",
      }),
    );
  }
  return Object.freeze(duplicates.sort((a, b) => a.fingerprint.localeCompare(b.fingerprint)));
}

function buildAssetClassifications(records) {
  return freezeDeep(
    records
      .map((record) => {
        const unstructured_type = classifyUnstructuredType(record);
        const life_category = classifyLifeCategory(record, unstructured_type);
        const sensitivity_class = classifySensitivity(
          record,
          unstructured_type,
          life_category,
        );
        return Object.freeze({
          record_id: record.record_id,
          relative_path_hash: `sha256:${sha256(record.relative_path)}`,
          unstructured_type,
          life_category,
          sensitivity_class,
          parseability_plan: parseabilityPlan(unstructured_type, sensitivity_class),
          consent_requirements: consentRequirements(
            sensitivity_class,
            unstructured_type,
          ),
          value_transformation_candidate: valueTransformationCandidate(
            record,
            unstructured_type,
          ),
        });
      })
      .sort((a, b) => a.record_id.localeCompare(b.record_id)),
  );
}

function buildBlockedOrUnknown(assets) {
  return freezeDeep(
    assets
      .filter(
        (a) =>
          a.unstructured_type === "unknown_binary" ||
          a.parseability_plan.level === "blocked_manual_review" ||
          a.sensitivity_class === "unknown_review",
      )
      .map((a) =>
        Object.freeze({
          record_id: a.record_id,
          unstructured_type: a.unstructured_type,
          reason:
            a.unstructured_type === "unknown_binary"
              ? "unknown_binary_requires_manual_review"
              : "blocked_or_unknown_review_required",
        }),
      ),
  );
}

function buildProofPlan(assets, inventory) {
  return freezeDeep({
    source_trace: Object.freeze(
      assets.map((a) =>
        Object.freeze({
          record_id: a.record_id,
          relative_path_hash: a.relative_path_hash,
          inventory_schema: inventory.schema,
        }),
      ),
    ),
    consent_boundary: Object.freeze({
      metadata_first: true,
      content_read_requires_explicit_go: true,
      no_automatic_share_or_export: true,
    }),
    recommended_artifacts: Object.freeze([
      "metadata_boundary_receipt",
      "explicit_typed_consent_record",
      "content_hash_attestation_after_consented_parse",
    ]),
    preview_only: true,
  });
}

export function buildUnstructuredFixtureInventory({
  records = UNSTRUCTURED_FIXTURE_RECORDS,
  generated_at_iso = UNSTRUCTURED_FIXTURE_GENERATED_AT,
} = {}) {
  const categories = records.reduce((acc, record) => {
    acc[record.category] = (acc[record.category] ?? 0) + 1;
    return acc;
  }, {});

  return freezeDeep({
    schema: LOCAL_ASSET_INVENTORY_SCHEMA,
    truth_label: "LOCAL_METADATA_MEASURED",
    valid: true,
    error: null,
    generated_at_iso,
    root: Object.freeze({
      display: "/home/node0/chaos-fixture",
      path_hash: "sha256:unstructured_fixture_root",
      exists: true,
    }),
    limits: Object.freeze({
      max_depth: 4,
      max_entries: 5000,
      follow_symlinks: false,
    }),
    summary: Object.freeze({
      records_count: records.length,
      files_count: records.length,
      dirs_count: 0,
      symlinks_count: 0,
      denied_count: 0,
      truncated: false,
    }),
    categories: freezeDeep(categories),
    records: freezeDeep([...records]),
    denied: Object.freeze([]),
    warnings: Object.freeze([]),
    boundary: Object.freeze({
      file_content_read: false,
      network_used: false,
    }),
  });
}

export function buildUnstructuredAssetAwareness({
  inventory,
  generated_at_iso = "",
} = {}) {
  if (!isValidInventory(inventory)) {
    return freezeDeep({
      schema: UNSTRUCTURED_ASSET_AWARENESS_SCHEMA,
      truth_label: UNSTRUCTURED_ASSET_AWARENESS_TRUTH_LABEL,
      valid: false,
      error: "invalid_or_missing_inventory",
      generated_at_iso,
      asset_type_counts: Object.freeze({}),
      sensitivity_classes: Object.freeze({}),
      duplicate_candidates: Object.freeze([]),
      asset_classifications: Object.freeze([]),
      parseability_plan: Object.freeze({ summary: "blocked_invalid_inventory" }),
      consent_requirements: Object.freeze([]),
      value_transformation_candidates: Object.freeze([]),
      blocked_or_unknown_assets: Object.freeze([]),
      proof_plan: null,
      asset_management_plan: Object.freeze({
        observe: "blocked",
        classify: "blocked",
        consent: "blocked",
        transform: "blocked",
        prove: "blocked",
      }),
      what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
      boundary: unstructuredBoundary(),
    });
  }

  const records = inventory.records || [];
  const asset_classifications = buildAssetClassifications(records);
  const duplicate_candidates = buildDuplicateCandidates(records);
  const blocked_or_unknown_assets = buildBlockedOrUnknown(asset_classifications);

  const asset_type_counts = asset_classifications.reduce((acc, asset) => {
    acc[asset.unstructured_type] = (acc[asset.unstructured_type] ?? 0) + 1;
    return acc;
  }, {});

  const sensitivity_classes = asset_classifications.reduce((acc, asset) => {
    acc[asset.sensitivity_class] = (acc[asset.sensitivity_class] ?? 0) + 1;
    return acc;
  }, {});

  const value_transformation_candidates = asset_classifications.map(
    (a) => a.value_transformation_candidate,
  );

  const consent_requirements = Object.freeze(
    [...new Set(asset_classifications.flatMap((a) => a.consent_requirements))].sort(),
  );

  const parseability_plan = freezeDeep({
    summary: "metadata_first_parse_after_consent",
    per_asset: asset_classifications.map((a) =>
      Object.freeze({
        record_id: a.record_id,
        level: a.parseability_plan.level,
        steps: a.parseability_plan.steps,
      }),
    ),
  });

  const proof_plan = buildProofPlan(asset_classifications, inventory);

  const report_id = `sha256:${sha256(
    stableStringify({
      inventory_root: inventory.root?.path_hash,
      record_count: records.length,
      duplicate_count: duplicate_candidates.length,
    }),
  )}`;

  return freezeDeep({
    schema: UNSTRUCTURED_ASSET_AWARENESS_SCHEMA,
    truth_label: UNSTRUCTURED_ASSET_AWARENESS_TRUTH_LABEL,
    valid: inventory.valid === true,
    error: inventory.error ?? null,
    mode: "metadata_first_unstructured",
    generated_at_iso:
      typeof generated_at_iso === "string" && generated_at_iso.length > 0
        ? generated_at_iso
        : inventory.generated_at_iso,
    report_id,
    root: inventory.root,
    summary: Object.freeze({
      total_assets: records.length,
      classified_assets: asset_classifications.length,
      duplicate_groups: duplicate_candidates.length,
      blocked_or_unknown_count: blocked_or_unknown_assets.length,
      sensitive_asset_count: asset_classifications.filter((a) =>
        a.sensitivity_class.startsWith("sensitive_"),
      ).length,
    }),
    asset_type_counts: freezeDeep(asset_type_counts),
    sensitivity_classes: freezeDeep(sensitivity_classes),
    duplicate_candidates,
    asset_classifications,
    parseability_plan,
    consent_requirements,
    value_transformation_candidates,
    blocked_or_unknown_assets,
    proof_plan,
    asset_management_plan: Object.freeze({
      observe: "metadata_inventory_complete",
      classify: "extension_path_heuristics_applied",
      consent: "explicit_go_required_before_content_understanding",
      transform: "preview_only_candidates_emitted",
      prove: "source_trace_and_consent_boundary_attached",
    }),
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
    boundary: unstructuredBoundary(inventory.boundary),
  });
}

function boundaryAllFalse(boundary) {
  if (!boundary || typeof boundary !== "object") return false;
  return Object.values(boundary).every((v) => v === false);
}

export function verifyUnstructuredAssetAwareness(report) {
  const blocked_by = [];

  if (!report || report.schema !== UNSTRUCTURED_ASSET_AWARENESS_SCHEMA) {
    blocked_by.push("invalid_schema");
    return Object.freeze({ ok: false, blocked_by });
  }
  if (report.truth_label !== UNSTRUCTURED_ASSET_AWARENESS_TRUTH_LABEL) {
    blocked_by.push("invalid_truth_label");
  }
  if (report.valid !== true) {
    blocked_by.push("report_not_valid");
  }
  if (!boundaryAllFalse(report.boundary)) {
    blocked_by.push("boundary_not_all_false");
  }

  const classifications = report.asset_classifications ?? [];
  if (classifications.length === 0) {
    blocked_by.push("no_classifications");
  }

  for (const asset of classifications) {
    if (!asset.unstructured_type) blocked_by.push(`missing_type:${asset.record_id}`);
    if (
      asset.sensitivity_class?.startsWith("sensitive_") &&
      !asset.consent_requirements?.includes("explicit_typed_go_before_content_read")
    ) {
      blocked_by.push(`sensitive_missing_consent:${asset.record_id}`);
    }
    if (asset.value_transformation_candidate?.preview_only !== true) {
      blocked_by.push(`value_not_preview_only:${asset.record_id}`);
    }
  }

  const unknownAssets = classifications.filter(
    (a) => a.unstructured_type === "unknown_binary",
  );
  for (const asset of unknownAssets) {
    const blocked = report.blocked_or_unknown_assets?.some(
      (b) => b.record_id === asset.record_id,
    );
    if (!blocked) blocked_by.push("unknown_binary_not_blocked");
  }

  if ((report.duplicate_candidates?.length ?? 0) < 1) {
    blocked_by.push("duplicate_candidates_missing");
  }

  if (!report.proof_plan?.source_trace?.length) {
    blocked_by.push("proof_plan_missing_source_trace");
  }
  if (!report.proof_plan?.consent_boundary?.content_read_requires_explicit_go) {
    blocked_by.push("proof_plan_missing_consent_boundary");
  }

  for (const candidate of report.value_transformation_candidates ?? []) {
    if (candidate.economic_action_performed === true) {
      blocked_by.push("economic_action_claimed");
    }
  }

  return Object.freeze({ ok: blocked_by.length === 0, blocked_by });
}

export function runUnstructuredAssetAwarenessGate({
  inventory = buildUnstructuredFixtureInventory(),
} = {}) {
  const report = buildUnstructuredAssetAwareness({ inventory });
  const verified = verifyUnstructuredAssetAwareness(report);
  return freezeDeep({
    ok: verified.ok,
    schema: UNSTRUCTURED_ASSET_AWARENESS_SCHEMA,
    truth_label: UNSTRUCTURED_ASSET_AWARENESS_TRUTH_LABEL,
    verified,
    fixture_asset_count: UNSTRUCTURED_FIXTURE_RECORDS.length,
    classified_count: report.asset_classifications?.length ?? 0,
    report,
  });
}
