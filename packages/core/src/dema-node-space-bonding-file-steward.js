// DEMA-NODE-SPACE-BONDING-FILE-STEWARD-1A
//
// Preview-only Node Space file steward. It maps file inventory metadata into
// consent-bound organization proposals and receipt-ready action previews.
// It never reads content and never mutates files.

import { createHash } from "node:crypto";

import { buildPreviewBoundary } from "./preview-boundary.js";

export const DEMA_NODE_SPACE_BONDING_FILE_STEWARD_SCHEMA =
  "bizra.dema.node_space_bonding_file_steward.v0.1";
export const DEMA_NODE_SPACE_BONDING_FILE_STEWARD_TRUTH_LABEL =
  "DEMA_NODE_SPACE_BONDING_FILE_STEWARD_PREVIEW_ONLY";
export const DEMA_NODE_SPACE_BONDING_STAGE =
  "NODE_SPACE_AWARENESS_PREVIEW";

export const FILE_STEWARD_FIXTURE_GENERATED_AT =
  "2026-06-28T00:00:00.000Z";

export const FILE_STEWARD_FIXTURE_INVENTORY = Object.freeze([
  Object.freeze({
    file_id: "fs:downloads/IMG_20260627.PNG",
    name: "IMG_20260627.PNG",
    relative_path: "downloads/IMG_20260627.PNG",
    extension: ".png",
    kind: "file",
    size_bytes: 540_000,
    mtime_iso: FILE_STEWARD_FIXTURE_GENERATED_AT,
  }),
  Object.freeze({
    file_id: "fs:work/BIZRA notes final FINAL.md",
    name: "BIZRA notes final FINAL.md",
    relative_path: "work/BIZRA notes final FINAL.md",
    extension: ".md",
    kind: "file",
    size_bytes: 18_000,
    mtime_iso: FILE_STEWARD_FIXTURE_GENERATED_AT,
  }),
  Object.freeze({
    file_id: "fs:work/bizra-notes-final.md",
    name: "bizra-notes-final.md",
    relative_path: "work/bizra-notes-final.md",
    extension: ".md",
    kind: "file",
    size_bytes: 18_000,
    mtime_iso: FILE_STEWARD_FIXTURE_GENERATED_AT,
  }),
  Object.freeze({
    file_id: "fs:finance/budget 2026.xlsx",
    name: "budget 2026.xlsx",
    relative_path: "finance/budget 2026.xlsx",
    extension: ".xlsx",
    kind: "file",
    size_bytes: 256_000,
    mtime_iso: FILE_STEWARD_FIXTURE_GENERATED_AT,
  }),
  Object.freeze({
    file_id: "fs:archives/node0-proof-export.zip",
    name: "node0-proof-export.zip",
    relative_path: "archives/node0-proof-export.zip",
    extension: ".zip",
    kind: "file",
    size_bytes: 12_000_000,
    mtime_iso: FILE_STEWARD_FIXTURE_GENERATED_AT,
  }),
]);

export const FILE_STEWARD_FORBIDDEN_OVERCLAIMS = Object.freeze([
  "renamed file",
  "moved file",
  "merged file",
  "deleted file",
  "read file content",
  "uploaded file",
  "autonomous action",
  "live file steward",
  "agent rl",
  "token reward",
]);

const EXTENSION_CATEGORY = Object.freeze({
  ".md": "notes",
  ".txt": "notes",
  ".pdf": "documents",
  ".docx": "documents",
  ".xlsx": "finance",
  ".csv": "dataset",
  ".png": "media",
  ".jpg": "media",
  ".jpeg": "media",
  ".zip": "archive",
});

const CATEGORY_FOLDER = Object.freeze({
  notes: "01-notes",
  documents: "02-documents",
  finance: "03-finance",
  dataset: "04-datasets",
  media: "05-media",
  archive: "06-archives",
  unknown: "99-review",
});

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freezeDeep(child);
  return value;
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
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

function receiptHash(payload) {
  return `sha256:${sha256(stableStringify(payload))}`;
}

function fileStewardBoundary() {
  return freezeDeep({
    ...buildPreviewBoundary(),
    file_rename_performed: false,
    file_move_performed: false,
    file_merge_performed: false,
    file_delete_performed: false,
    file_content_read: false,
    ocr_performed: false,
    embedding_generated: false,
    upload_performed: false,
    autonomous_action_performed: false,
  });
}

function normalizeFile(file, index) {
  const name = String(file.name ?? `unnamed-${index}`);
  const extension = String(file.extension ?? "")
    .toLowerCase()
    .trim();
  const relative_path = String(file.relative_path ?? name);
  const kind = file.kind === "directory" ? "directory" : "file";
  return freezeDeep({
    file_id: String(file.file_id ?? `fs:${relative_path}`),
    name,
    relative_path,
    extension,
    kind,
    size_bytes: Number.isFinite(file.size_bytes) ? file.size_bytes : 0,
    mtime_iso: String(file.mtime_iso ?? FILE_STEWARD_FIXTURE_GENERATED_AT),
    metadata_only: true,
  });
}

function classifyFile(file) {
  if (file.kind !== "file") return "unknown";
  return EXTENSION_CATEGORY[file.extension] ?? "unknown";
}

function slugify(value) {
  const slug = String(value)
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-final(-final)+$/g, "-final");
  return slug || "untitled";
}

function plannedName(file, category, rootLabel) {
  const base = slugify(file.name);
  const prefix = slugify(rootLabel || "node-space");
  return `${prefix}-${category}-${base}${file.extension}`;
}

function countBy(files, fn) {
  const counts = {};
  for (const file of files) {
    const key = fn(file);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return freezeDeep(counts);
}

function groupBy(files, fn) {
  const groups = new Map();
  for (const file of files) {
    const key = fn(file);
    const group = groups.get(key) ?? [];
    group.push(file);
    groups.set(key, group);
  }
  return groups;
}

function buildFileTypeClusters(files) {
  return freezeDeep(
    [...groupBy(files, classifyFile).entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, rows]) => ({
        cluster_id: `cluster:${category}`,
        category,
        file_count: rows.length,
        file_ids: rows.map((file) => file.file_id).sort(),
        classification_basis: "extension_name_path_metadata_only",
      })),
  );
}

function buildProjectContextCandidates(files, userContext) {
  const rootHint = slugify(userContext?.project_hint ?? "node-space");
  return freezeDeep([
    {
      candidate_id: `project:${rootHint}`,
      label: userContext?.project_hint ?? "Node Space working set",
      evidence_basis: "root_label_and_filename_tokens_only",
      file_ids: files
        .filter((file) => /bizra|dema|node0|proof/i.test(file.name))
        .map((file) => file.file_id)
        .sort(),
      confidence: "metadata_hint",
    },
  ]);
}

function buildUnstructuredDataMap(files) {
  return freezeDeep(
    files.map((file) => ({
      file_id: file.file_id,
      relative_path: file.relative_path,
      category: classifyFile(file),
      metadata_fields_used: Object.freeze([
        "name",
        "relative_path",
        "extension",
        "size_bytes",
        "mtime_iso",
      ]),
      content_read: false,
      content_awareness_status: "blocked_until_scoped_consent",
    })),
  );
}

function duplicateKey(file) {
  return `${slugify(file.name)}:${file.size_bytes}:${file.extension}`;
}

function buildDuplicateCandidatePlan(files) {
  return freezeDeep(
    [...groupBy(files, duplicateKey).entries()]
      .filter(([, rows]) => rows.length > 1)
      .map(([fingerprint, rows]) => ({
        plan_id: `duplicate:${sha256(fingerprint).slice(0, 16)}`,
        detection_method: "name_size_extension_metadata_only",
        file_ids: rows.map((file) => file.file_id).sort(),
        proposed_action: "review_duplicates_before_any_merge",
        content_hash_required_before_merge: true,
        consent_required: "GO: compare duplicate file contents for this plan only",
        preview_only: true,
      })),
  );
}

function buildBatchRenamePlanPreview(files, rootLabel) {
  const planned = files.map((file) => {
    const category = classifyFile(file);
    const proposed_name = plannedName(file, category, rootLabel);
    return {
      action_id: `rename:${sha256(file.file_id).slice(0, 16)}`,
      action_type: "rename_preview",
      source_file_id: file.file_id,
      from_relative_path: file.relative_path,
      proposed_name,
      proposed_name_base: proposed_name,
      consent_required: "GO: preview rename only; separate GO required to execute",
      mutation_performed: false,
    };
  });
  const counts = countBy(planned, (plan) => plan.proposed_name);
  return freezeDeep(
    planned.map((plan) => {
      const name_collision = counts[plan.proposed_name] > 1;
      const extension = plan.proposed_name.match(/\.[^.]+$/)?.[0] ?? "";
      const stem = extension
        ? plan.proposed_name.slice(0, -extension.length)
        : plan.proposed_name;
      return {
        ...plan,
        proposed_name: name_collision
          ? `${stem}-${sha256(plan.source_file_id).slice(0, 8)}${extension}`
          : plan.proposed_name,
        name_collision,
        collision_resolution:
          name_collision ? "short_file_id_hash_suffix" : "not_required",
      };
    }),
  );
}

function buildFolderOrganizationPlanPreview(files) {
  return freezeDeep(
    [...groupBy(files, classifyFile).entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, rows]) => ({
        plan_id: `folder:${category}`,
        category,
        proposed_folder: CATEGORY_FOLDER[category] ?? CATEGORY_FOLDER.unknown,
        file_ids: rows.map((file) => file.file_id).sort(),
        action_type: "move_preview",
        consent_required: "GO: preview folder organization only; separate GO required to execute",
        mutation_performed: false,
      })),
  );
}

function buildMergeCandidatePlanPreview(duplicatePlans) {
  return freezeDeep(
    duplicatePlans.map((plan) => ({
      plan_id: plan.plan_id.replace("duplicate:", "merge:"),
      source_duplicate_plan_id: plan.plan_id,
      action_type: "merge_preview",
      file_ids: plan.file_ids,
      merge_allowed_now: false,
      blocked_by: Object.freeze([
        "content_hash_not_computed",
        "exact_merge_consent_not_collected",
      ]),
      consent_required: "GO: compare and merge this duplicate group after content hash proof",
    })),
  );
}

function buildContentAwarenessConsentRequests(files) {
  return freezeDeep(
    files.map((file) => ({
      request_id: `content-consent:${sha256(file.file_id).slice(0, 16)}`,
      file_id: file.file_id,
      requested_capability: "content_aware_classification",
      consent_phrase_required:
        "GO: read content for this file steward classification only",
      default_allowed: false,
      reason: "metadata_only_preview_cannot_read_or_summarize_file_content",
    })),
  );
}

function buildReceiptRequirements() {
  return freezeDeep({
    every_action_preview_requires: Object.freeze([
      "claim",
      "evidence",
      "consent_required",
      "boundary",
      "verification_result",
      "receipt_preview_id",
      "receipt_hash",
    ]),
    execution_requires_separate_exact_consent: true,
    preview_receipts_are_not_execution_receipts: true,
  });
}

function buildActionReceiptPreview(action, boundary) {
  const receipt_body = {
    claim: "file_action_preview_only",
    action_id: action.action_id ?? action.plan_id,
    action_type: action.action_type,
    source: action.source_file_id ?? action.source_duplicate_plan_id,
    evidence: "metadata_inventory_only",
    consent_required: action.consent_required,
    verification_result: "PREVIEW_VERIFIED_NO_FILE_CHANGED",
    boundary,
  };
  const receipt_hash = receiptHash(receipt_body);
  return freezeDeep({
    receipt_preview_id: receipt_hash,
    receipt_hash,
    action_id: receipt_body.action_id,
    action_type: action.action_type,
    claim: receipt_body.claim,
    evidence: receipt_body.evidence,
    consent_required: receipt_body.consent_required,
    boundary,
    verification_result: receipt_body.verification_result,
    no_file_changed: true,
  });
}

function buildReceiptPreviews(renamePlans, folderPlans, mergePlans, boundary) {
  return freezeDeep(
    [...renamePlans, ...folderPlans, ...mergePlans].map((action) =>
      buildActionReceiptPreview(action, boundary),
    ),
  );
}

function buildRiskRegister(files, duplicatePlans) {
  return freezeDeep([
    {
      risk_id: "metadata_misclassification",
      severity: "medium",
      mitigation: "content-aware classification requires scoped consent",
    },
    {
      risk_id: "duplicate_false_positive",
      severity: duplicatePlans.length > 0 ? "medium" : "low",
      mitigation: "content hash proof required before merge or delete",
    },
    {
      risk_id: "sensitive_file_handling",
      severity: files.some((file) => classifyFile(file) === "finance")
        ? "high"
        : "medium",
      mitigation: "no content read, no upload, no mutation by default",
    },
  ]);
}

export function buildDemaNodeSpaceBondingFileSteward({
  root_label = "Dema Node Space",
  file_inventory = FILE_STEWARD_FIXTURE_INVENTORY,
  user_context = Object.freeze({ project_hint: "BIZRA Dema" }),
  classification_policy = "metadata_only_extension_path_name",
  rename_policy = "deterministic_slug_preview",
  organization_policy = "category_folder_preview",
  merge_policy = "duplicates_require_content_hash_and_exact_consent",
  consent_proof = null,
  boundary = fileStewardBoundary(),
} = {}) {
  const files = freezeDeep(file_inventory.map(normalizeFile));
  const fileEntries = freezeDeep(files.filter((file) => file.kind === "file"));
  const boundaries = freezeDeep({ ...boundary, ...fileStewardBoundary() });
  const duplicate_candidate_plan = buildDuplicateCandidatePlan(fileEntries);
  const batch_rename_plan_preview = buildBatchRenamePlanPreview(
    fileEntries,
    root_label,
  );
  const folder_organization_plan_preview =
    buildFolderOrganizationPlanPreview(fileEntries);
  const merge_candidate_plan_preview =
    buildMergeCandidatePlanPreview(duplicate_candidate_plan);
  const file_action_receipt_previews = buildReceiptPreviews(
    batch_rename_plan_preview,
    folder_organization_plan_preview,
    merge_candidate_plan_preview,
    boundaries,
  );

  return freezeDeep({
    schema: DEMA_NODE_SPACE_BONDING_FILE_STEWARD_SCHEMA,
    truth_label: DEMA_NODE_SPACE_BONDING_FILE_STEWARD_TRUTH_LABEL,
    bonding_stage: DEMA_NODE_SPACE_BONDING_STAGE,
    root_label,
    policies: Object.freeze({
      classification_policy,
      rename_policy,
      organization_policy,
      merge_policy,
    }),
    consent_proof: consent_proof ?? Object.freeze({
      collected: false,
      reason: "preview_only_no_execution_consent_collected",
    }),
    node_space_inventory_summary: Object.freeze({
      file_count: files.filter((file) => file.kind === "file").length,
      directory_count: files.filter((file) => file.kind === "directory").length,
      total_size_bytes: files.reduce((sum, file) => sum + file.size_bytes, 0),
      category_counts: countBy(fileEntries, classifyFile),
      metadata_only: true,
    }),
    file_type_clusters: buildFileTypeClusters(fileEntries),
    project_context_candidates: buildProjectContextCandidates(
      fileEntries,
      user_context,
    ),
    unstructured_data_map: buildUnstructuredDataMap(fileEntries),
    duplicate_candidate_plan,
    batch_rename_plan_preview,
    folder_organization_plan_preview,
    merge_candidate_plan_preview,
    file_action_receipt_previews,
    content_awareness_consent_requests:
      buildContentAwarenessConsentRequests(fileEntries),
    receipt_requirements: buildReceiptRequirements(),
    risk_register: buildRiskRegister(fileEntries, duplicate_candidate_plan),
    boundaries,
    what_this_proves: Object.freeze([
      "Dema can turn a metadata-only file inventory into deterministic preview plans.",
      "Every proposed file action can carry consent requirements and a receipt hash preview.",
      "No file mutation, content read, upload, network, OCR, or embedding is required for this preview.",
    ]),
    what_this_does_not_prove: Object.freeze([
      "It does not prove file contents are understood.",
      "It does not execute rename, move, merge, or delete actions.",
      "It does not activate daemon, network, URP, token, wallet, or autonomous runtime behavior.",
    ]),
  });
}

function boundaryAllFalse(boundary) {
  if (!boundary || typeof boundary !== "object") return false;
  return Object.values(boundary).every((value) => value === false);
}

function containsForbiddenOverclaim(report) {
  const text = JSON.stringify({
    what_this_proves: report.what_this_proves,
    node_space_inventory_summary: report.node_space_inventory_summary,
    policies: report.policies,
  }).toLowerCase();
  return FILE_STEWARD_FORBIDDEN_OVERCLAIMS.find((phrase) =>
    text.includes(phrase.toLowerCase()),
  );
}

export function verifyDemaNodeSpaceBondingFileSteward(report) {
  const blocked_by = [];

  if (!report || report.schema !== DEMA_NODE_SPACE_BONDING_FILE_STEWARD_SCHEMA) {
    blocked_by.push("invalid_schema");
    return Object.freeze({ ok: false, blocked_by });
  }
  if (report.truth_label !== DEMA_NODE_SPACE_BONDING_FILE_STEWARD_TRUTH_LABEL) {
    blocked_by.push("invalid_truth_label");
  }
  if (report.bonding_stage !== DEMA_NODE_SPACE_BONDING_STAGE) {
    blocked_by.push("invalid_bonding_stage");
  }
  if (!boundaryAllFalse(report.boundaries)) {
    blocked_by.push("boundary_not_all_false");
  }
  if (report.boundaries?.file_content_read !== false) {
    blocked_by.push("content_read_boundary_not_false");
  }
  if (report.boundaries?.file_rename_performed !== false) {
    blocked_by.push("rename_boundary_not_false");
  }
  if (report.boundaries?.file_delete_performed !== false) {
    blocked_by.push("delete_boundary_not_false");
  }
  for (const action of [
    ...(report.batch_rename_plan_preview ?? []),
    ...(report.folder_organization_plan_preview ?? []),
    ...(report.merge_candidate_plan_preview ?? []),
  ]) {
    if (action.action_type === "delete_preview") {
      blocked_by.push(`delete_action_present:${action.action_id ?? action.plan_id}`);
    }
    if (action.mutation_performed === true || action.merge_allowed_now === true) {
      blocked_by.push(`mutation_allowed:${action.action_id ?? action.plan_id}`);
    }
  }
  if (!report.file_action_receipt_previews?.length) {
    blocked_by.push("receipt_previews_missing");
  }
  for (const receipt of report.file_action_receipt_previews ?? []) {
    if (!/^sha256:[0-9a-f]{64}$/.test(receipt.receipt_preview_id ?? "")) {
      blocked_by.push(`invalid_receipt_hash:${receipt.action_id}`);
    }
    if (receipt.no_file_changed !== true) {
      blocked_by.push(`receipt_missing_no_file_changed:${receipt.action_id}`);
    }
  }
  if (!report.content_awareness_consent_requests?.length) {
    blocked_by.push("content_consent_requests_missing");
  }
  for (const request of report.content_awareness_consent_requests ?? []) {
    if (request.default_allowed !== false) {
      blocked_by.push(`content_consent_default_allowed:${request.file_id}`);
    }
  }
  if (!Array.isArray(report.duplicate_candidate_plan)) {
    blocked_by.push("duplicate_candidate_plan_invalid");
  }
  const overclaim = containsForbiddenOverclaim(report);
  if (overclaim) {
    blocked_by.push(`forbidden_overclaim_present:${overclaim}`);
  }

  return Object.freeze({ ok: blocked_by.length === 0, blocked_by });
}

export function runDemaNodeSpaceBondingFileStewardGate() {
  const report = buildDemaNodeSpaceBondingFileSteward();
  const verified = verifyDemaNodeSpaceBondingFileSteward(report);
  return freezeDeep({
    ok: verified.ok,
    schema: DEMA_NODE_SPACE_BONDING_FILE_STEWARD_SCHEMA,
    truth_label: DEMA_NODE_SPACE_BONDING_FILE_STEWARD_TRUTH_LABEL,
    verified,
    fixture_file_count: FILE_STEWARD_FIXTURE_INVENTORY.length,
    receipt_preview_count: report.file_action_receipt_previews.length,
    report,
  });
}
