// UNSTRUCTURED-ASSET-AWARENESS-GATE-1A — metadata-first unstructured asset management.
//
// Recognizes mixed-format user chaos as first-class Node0 assets. Five-stage
// pipeline: observe → classify → consent → transform → prove. Metadata-only;
// no content read, OCR, embeddings, network, upload, sharing, or economic action.

import { createHash } from "node:crypto";

import { buildPreviewBoundary } from "./preview-boundary.js";

export const UNSTRUCTURED_ASSET_AWARENESS_SCHEMA =
  "bizra.dema.unstructured_asset_awareness.v0.1";
export const UNSTRUCTURED_ASSET_AWARENESS_TRUTH_LABEL =
  "UNSTRUCTURED_ASSET_AWARENESS_DOCS_ONLY";

export const UNSTRUCTURED_FIXTURE_GENERATED_AT = "2026-06-26T16:00:00.000Z";

export const UNSTRUCTURED_FIXTURE_ASSETS = Object.freeze([
  Object.freeze({
    asset_id: "ua:reports/q4-summary.pdf",
    name: "q4-summary.pdf",
    relative_path: "reports/q4-summary.pdf",
    extension: ".pdf",
    unstructured_type: "pdf_report",
    category: "research",
    sensitivity: "business",
    size_bytes: 2_400_000,
    mtime_iso: UNSTRUCTURED_FIXTURE_GENERATED_AT,
  }),
  Object.freeze({
    asset_id: "ua:notes/daily.md",
    name: "daily.md",
    relative_path: "notes/daily.md",
    extension: ".md",
    unstructured_type: "markdown_notes",
    category: "research",
    sensitivity: "personal",
    size_bytes: 12_000,
    mtime_iso: UNSTRUCTURED_FIXTURE_GENERATED_AT,
  }),
  Object.freeze({
    asset_id: "ua:exports/contacts.csv",
    name: "contacts.csv",
    relative_path: "exports/contacts.csv",
    extension: ".csv",
    unstructured_type: "csv_export",
    category: "business",
    sensitivity: "personal",
    size_bytes: 88_000,
    mtime_iso: UNSTRUCTURED_FIXTURE_GENERATED_AT,
  }),
  Object.freeze({
    asset_id: "ua:screenshots/invoice-042.png",
    name: "invoice-042.png",
    relative_path: "screenshots/invoice-042.png",
    extension: ".png",
    unstructured_type: "screenshot_image",
    category: "media",
    sensitivity: "financial",
    size_bytes: 540_000,
    mtime_iso: UNSTRUCTURED_FIXTURE_GENERATED_AT,
  }),
  Object.freeze({
    asset_id: "ua:voice/meeting-note.m4a",
    name: "meeting-note.m4a",
    relative_path: "voice/meeting-note.m4a",
    extension: ".m4a",
    unstructured_type: "audio_note",
    category: "media",
    sensitivity: "business",
    size_bytes: 3_200_000,
    mtime_iso: UNSTRUCTURED_FIXTURE_GENERATED_AT,
  }),
  Object.freeze({
    asset_id: "ua:videos/demo-walkthrough.mp4",
    name: "demo-walkthrough.mp4",
    relative_path: "videos/demo-walkthrough.mp4",
    extension: ".mp4",
    unstructured_type: "video_recording",
    category: "media",
    sensitivity: "business",
    size_bytes: 48_000_000,
    mtime_iso: UNSTRUCTURED_FIXTURE_GENERATED_AT,
  }),
  Object.freeze({
    asset_id: "ua:archives/old-project.zip",
    name: "old-project.zip",
    relative_path: "archives/old-project.zip",
    extension: ".zip",
    unstructured_type: "zip_archive",
    category: "project",
    sensitivity: "business",
    size_bytes: 120_000_000,
    mtime_iso: UNSTRUCTURED_FIXTURE_GENERATED_AT,
  }),
  Object.freeze({
    asset_id: "ua:code/snippet.py",
    name: "snippet.py",
    relative_path: "code/snippet.py",
    extension: ".py",
    unstructured_type: "source_code",
    category: "code",
    sensitivity: "business",
    size_bytes: 4_500,
    mtime_iso: UNSTRUCTURED_FIXTURE_GENERATED_AT,
  }),
  Object.freeze({
    asset_id: "ua:finance/budget-2026.xlsx",
    name: "budget-2026.xlsx",
    relative_path: "finance/budget-2026.xlsx",
    extension: ".xlsx",
    unstructured_type: "spreadsheet",
    category: "finance",
    sensitivity: "financial",
    size_bytes: 256_000,
    mtime_iso: UNSTRUCTURED_FIXTURE_GENERATED_AT,
  }),
  Object.freeze({
    asset_id: "ua:legal/service-agreement.pdf",
    name: "service-agreement.pdf",
    relative_path: "legal/service-agreement.pdf",
    extension: ".pdf",
    unstructured_type: "contract_legal",
    category: "legal",
    sensitivity: "legal",
    size_bytes: 890_000,
    mtime_iso: UNSTRUCTURED_FIXTURE_GENERATED_AT,
  }),
  Object.freeze({
    asset_id: "ua:backups/q4-summary-copy.pdf",
    name: "q4-summary.pdf",
    relative_path: "backups/q4-summary-copy.pdf",
    extension: ".pdf",
    unstructured_type: "pdf_report",
    category: "research",
    sensitivity: "business",
    size_bytes: 2_400_000,
    mtime_iso: UNSTRUCTURED_FIXTURE_GENERATED_AT,
    duplicate_metadata_fingerprint: "dup:q4-summary.pdf:2400000:.pdf",
  }),
  Object.freeze({
    asset_id: "ua:unknown/mystery.dat",
    name: "mystery.dat",
    relative_path: "unknown/mystery.dat",
    extension: ".dat",
    unstructured_type: "unknown_binary",
    category: "unknown",
    sensitivity: "unknown",
    size_bytes: 64_000,
    mtime_iso: UNSTRUCTURED_FIXTURE_GENERATED_AT,
  }),
  Object.freeze({
    asset_id: "ua:private/journal-entry.docx",
    name: "journal-entry.docx",
    relative_path: "private/journal-entry.docx",
    extension: ".docx",
    unstructured_type: "personal_private",
    category: "personal",
    sensitivity: "private",
    size_bytes: 18_000,
    mtime_iso: UNSTRUCTURED_FIXTURE_GENERATED_AT,
  }),
]);

const SENSITIVE_CLASSES = Object.freeze([
  "personal",
  "financial",
  "legal",
  "private",
  "unknown",
]);

const HIGH_CONSENT_SENSITIVITY = new Set([
  "personal",
  "financial",
  "legal",
  "private",
  "unknown",
]);

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freezeDeep(child);
  return value;
}

function metadataFingerprint(asset) {
  return `dup:${asset.name}:${asset.size_bytes}:${asset.extension}`;
}

function awarenessBoundary() {
  return freezeDeep({
    ...buildPreviewBoundary(),
    file_content_read: false,
    ocr_performed: false,
    embedding_generated: false,
    transcription_performed: false,
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

function countByField(assets, field) {
  const counts = {};
  for (const asset of assets) {
    const key = asset[field];
    counts[key] = (counts[key] || 0) + 1;
  }
  return freezeDeep(counts);
}

function buildDuplicateCandidates(assets) {
  const byFingerprint = new Map();
  for (const asset of assets) {
    const fp = asset.duplicate_metadata_fingerprint || metadataFingerprint(asset);
    const group = byFingerprint.get(fp) || [];
    group.push(asset.asset_id);
    byFingerprint.set(fp, group);
  }
  return freezeDeep(
    [...byFingerprint.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([fingerprint, asset_ids]) =>
        Object.freeze({
          fingerprint,
          asset_ids: Object.freeze([...asset_ids]),
          detection_method: "metadata_name_size_extension",
          content_hash_required_for_confirmation: true,
        }),
      ),
  );
}

function consentModeForAsset(asset) {
  if (asset.unstructured_type === "unknown_binary") {
    return "manual_review_before_content_classification_consent";
  }
  if (asset.sensitivity === "private" || asset.relative_path.includes("/private/")) {
    return "deep_understanding_strong_consent";
  }
  if (HIGH_CONSENT_SENSITIVITY.has(asset.sensitivity)) {
    return "content_classification_consent";
  }
  return "metadata_only_default";
}

function buildParseabilityPlan(assets) {
  return freezeDeep(
    assets.map((asset) =>
      Object.freeze({
        asset_id: asset.asset_id,
        unstructured_type: asset.unstructured_type,
        parseable_by_metadata: true,
        content_parse_requires_consent: consentModeForAsset(asset),
        blocked_by_default: asset.unstructured_type === "unknown_binary",
        suggested_parser_preview:
          asset.unstructured_type === "unknown_binary"
            ? null
            : `${asset.unstructured_type}_metadata_classifier`,
      }),
    ),
  );
}

function buildConsentRequirements(assets) {
  return freezeDeep({
    default_mode: "metadata_only_default",
    per_asset: Object.freeze(
      assets.map((asset) =>
        Object.freeze({
          asset_id: asset.asset_id,
          sensitivity: asset.sensitivity,
          minimum_consent_mode: consentModeForAsset(asset),
          content_read_allowed_without_consent: false,
        }),
      ),
    ),
    rules: Object.freeze([
      "Metadata awareness is default — no file content opened.",
      "Parse, summarize, OCR, transcribe, embed require explicit scoped consent.",
      "Share, export, and URP candidacy require separate consent.",
      "Scanning never implies reward, token, or wallet action.",
    ]),
  });
}

function buildValueTransformationCandidates(assets) {
  const transforms = {
    pdf_report: "summary_and_table_extraction_preview",
    markdown_notes: "outline_and_task_candidates_preview",
    csv_export: "schema_inference_and_dataset_preview",
    screenshot_image: "ocr_and_entity_extraction_preview",
    audio_note: "transcription_and_summary_preview",
    video_recording: "transcript_and_chapter_preview",
    zip_archive: "inventory_tree_preview",
    source_code: "module_map_and_docstring_preview",
    spreadsheet: "tabular_normalization_preview",
    contract_legal: "clause_outline_preview",
    personal_private: "blocked_until_strong_consent",
    unknown_binary: "blocked_pending_review",
  };
  return freezeDeep(
    assets.map((asset) =>
      Object.freeze({
        asset_id: asset.asset_id,
        transformation_preview: transforms[asset.unstructured_type] ?? "manual_review_preview",
        preview_only: true,
        requires_consent: consentModeForAsset(asset),
        economic_action_implied: false,
      }),
    ),
  );
}

function buildBlockedOrUnknownAssets(assets) {
  return freezeDeep(
    assets
      .filter(
        (a) =>
          a.unstructured_type === "unknown_binary" ||
          a.category === "unknown" ||
          a.sensitivity === "unknown",
      )
      .map((asset) =>
        Object.freeze({
          asset_id: asset.asset_id,
          reason:
            asset.unstructured_type === "unknown_binary"
              ? "unknown_binary_requires_manual_review"
              : "unknown_sensitivity_requires_review",
          allowed_default_action: "metadata_only",
        }),
      ),
  );
}

function buildAssetManagementPlan(assets) {
  return freezeDeep({
    stages: Object.freeze([
      Object.freeze({
        stage: 1,
        name: "observe",
        description: "Detect files, folders, types, sizes, timestamps, duplicates, clusters.",
        performed: "metadata_only_preview",
      }),
      Object.freeze({
        stage: 2,
        name: "classify",
        description: "Identify category: personal, business, research, finance, legal, media, code, project, unknown.",
        performed: "metadata_classifier_preview",
      }),
      Object.freeze({
        stage: 3,
        name: "consent",
        description: "Gate content read, parsing, embedding, summarizing, exporting, sharing.",
        performed: "consent_requirements_emitted",
      }),
      Object.freeze({
        stage: 4,
        name: "transform",
        description: "Convert chaos into structured asset previews: summaries, tables, KG nodes, tasks, datasets.",
        performed: "value_transformation_candidates_preview_only",
      }),
      Object.freeze({
        stage: 5,
        name: "prove",
        description: "Attach boundaries, hash plan, source trace, value hypothesis, receipt plan.",
        performed: "proof_plan_emitted",
      }),
    ]),
    asset_count: assets.length,
  });
}

function buildProofPlan(assets) {
  return freezeDeep({
    source_trace: Object.freeze({
      fixture_id: "unstructured_homebase_chaos_v1",
      asset_ids: Object.freeze(assets.map((a) => a.asset_id)),
      generated_at_iso: UNSTRUCTURED_FIXTURE_GENERATED_AT,
    }),
    consent_boundary: Object.freeze({
      default: "metadata_only_default",
      content_requires: "explicit_scoped_consent",
      share_requires: "separate_consent",
    }),
    reproducible_command:
      "dema assets scan --mode metadata_only_default --root <path> --json",
    hash_plan_preview: Object.freeze({
      method: "metadata_fingerprint_for_dedupe_plan",
      content_hash_requires: "fingerprint_dedupe_consent",
    }),
    receipt_plan_preview: true,
    preview_only: true,
  });
}

export function buildUnstructuredAssetFixture() {
  return freezeDeep({
    schema: "bizra.dema.unstructured_asset_fixture.v0.1",
    generated_at_iso: UNSTRUCTURED_FIXTURE_GENERATED_AT,
    assets: UNSTRUCTURED_FIXTURE_ASSETS,
  });
}

export function buildUnstructuredAssetAwareness({
  assets = UNSTRUCTURED_FIXTURE_ASSETS,
  generated_at_iso = UNSTRUCTURED_FIXTURE_GENERATED_AT,
} = {}) {
  const report_id = `sha256:${createHash("sha256")
    .update(
      JSON.stringify({
        schema: UNSTRUCTURED_ASSET_AWARENESS_SCHEMA,
        count: assets.length,
      }),
    )
    .digest("hex")}`;

  const sensitivity_classes = freezeDeep({
    counts: countByField(assets, "sensitivity"),
    high_consent_classes: Object.freeze([...HIGH_CONSENT_SENSITIVITY]),
  });

  return freezeDeep({
    schema: UNSTRUCTURED_ASSET_AWARENESS_SCHEMA,
    truth_label: UNSTRUCTURED_ASSET_AWARENESS_TRUTH_LABEL,
    valid: true,
    generated_at_iso,
    report_id,
    asset_type_counts: countByField(assets, "unstructured_type"),
    category_counts: countByField(assets, "category"),
    sensitivity_classes,
    duplicate_candidates: buildDuplicateCandidates(assets),
    parseability_plan: buildParseabilityPlan(assets),
    consent_requirements: buildConsentRequirements(assets),
    value_transformation_candidates: buildValueTransformationCandidates(assets),
    blocked_or_unknown_assets: buildBlockedOrUnknownAssets(assets),
    asset_management_plan: buildAssetManagementPlan(assets),
    proof_plan: buildProofPlan(assets),
    what_this_does_not_prove: Object.freeze([
      "No file content was read — classification uses names, extensions, paths, and sizes only.",
      "Value transformations are preview suggestions, not executed conversions.",
      "No upload, sharing, token, wallet, or URP submission was performed.",
    ]),
    boundary: awarenessBoundary(),
    boundaries: awarenessBoundary(),
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

  const typeCounts = report.asset_type_counts ?? {};
  const expectedTypes = new Set(
    UNSTRUCTURED_FIXTURE_ASSETS.map((a) => a.unstructured_type),
  );
  for (const t of expectedTypes) {
    if (!typeCounts[t]) {
      blocked_by.push(`missing_asset_type:${t}`);
    }
  }

  for (const sensitivity of SENSITIVE_CLASSES) {
    if (!report.sensitivity_classes?.counts?.[sensitivity]) {
      blocked_by.push(`missing_sensitivity_class:${sensitivity}`);
    }
  }

  const sensitiveAssets = UNSTRUCTURED_FIXTURE_ASSETS.filter((a) =>
    HIGH_CONSENT_SENSITIVITY.has(a.sensitivity),
  );
  for (const asset of sensitiveAssets) {
    const row = report.consent_requirements?.per_asset?.find(
      (r) => r.asset_id === asset.asset_id,
    );
    if (!row || row.content_read_allowed_without_consent !== false) {
      blocked_by.push(`sensitive_missing_consent:${asset.asset_id}`);
    }
    if (row?.minimum_consent_mode === "metadata_only_default") {
      blocked_by.push(`sensitive_needs_higher_consent:${asset.asset_id}`);
    }
  }

  if (!report.duplicate_candidates?.length) {
    blocked_by.push("duplicate_candidates_missing");
  }

  const unknownBlocked = report.blocked_or_unknown_assets?.find(
    (b) => b.asset_id === "ua:unknown/mystery.dat",
  );
  if (!unknownBlocked) {
    blocked_by.push("unknown_binary_not_blocked");
  }

  for (const candidate of report.value_transformation_candidates ?? []) {
    if (candidate.preview_only !== true || candidate.economic_action_implied === true) {
      blocked_by.push(`value_not_preview_only:${candidate.asset_id}`);
    }
  }

  const proof = report.proof_plan;
  if (!proof?.source_trace?.asset_ids?.length) {
    blocked_by.push("proof_missing_source_trace");
  }
  if (!proof?.consent_boundary?.default) {
    blocked_by.push("proof_missing_consent_boundary");
  }
  if (!proof?.reproducible_command?.includes("metadata_only_default")) {
    blocked_by.push("proof_missing_reproducible_command");
  }

  if (report.asset_management_plan?.stages?.length !== 5) {
    blocked_by.push("asset_management_plan_stages_incomplete");
  }

  return Object.freeze({ ok: blocked_by.length === 0, blocked_by });
}

export function runUnstructuredAssetAwarenessGate() {
  const report = buildUnstructuredAssetAwareness();
  const verified = verifyUnstructuredAssetAwareness(report);
  return freezeDeep({
    ok: verified.ok,
    schema: UNSTRUCTURED_ASSET_AWARENESS_SCHEMA,
    truth_label: UNSTRUCTURED_ASSET_AWARENESS_TRUTH_LABEL,
    verified,
    fixture_asset_count: UNSTRUCTURED_FIXTURE_ASSETS.length,
    report,
  });
}
