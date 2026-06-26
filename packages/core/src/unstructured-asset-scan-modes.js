// UNSTRUCTURED-ASSET-SCAN-MODES-1A — sovereign scan-mode policy for unstructured assets.
//
// Product law: metadata scan is default; deeper scans require explicit scoped
// consent; share/export is separate; economic/URP/token is never implied by scan.
// Docs/test/review only — no runtime scan execution in this kernel.

import { createHash } from "node:crypto";

import { buildPreviewBoundary } from "./preview-boundary.js";

export const UNSTRUCTURED_ASSET_SCAN_MODES_SCHEMA =
  "bizra.dema.unstructured_asset_scan_modes.v0.1";
export const UNSTRUCTURED_ASSET_SCAN_MODES_TRUTH_LABEL =
  "UNSTRUCTURED_ASSET_SCAN_MODES_DOCS_ONLY";

export const DEFAULT_SCAN_MODE = "metadata_only_default";

export const SCAN_MODE_IDS = Object.freeze([
  "metadata_only_default",
  "fingerprint_dedupe_consent",
  "content_classification_consent",
  "deep_understanding_strong_consent",
  "share_export_separate_consent",
]);

const FORBIDDEN_WITHOUT_CONSENT = Object.freeze([
  "silent_content_read",
  "silent_byte_fingerprint",
  "silent_ocr",
  "silent_transcription",
  "silent_embedding",
  "silent_knowledge_graph_extraction",
  "silent_summarization",
  "silent_upload",
  "silent_sharing",
  "silent_export",
  "silent_urp_submission",
  "silent_token_action",
  "silent_wallet_access",
  "implied_reward_from_scan",
]);

const SENSITIVITY_RULES = Object.freeze([
  Object.freeze({
    rule_id: "personal_private_paths",
    pattern: "/private/",
    minimum_mode: "deep_understanding_strong_consent",
    note: "Personal/private folders require strong consent before any content understanding.",
  }),
  Object.freeze({
    rule_id: "legal_finance_paths",
    pattern: "/legal/|/finance/",
    minimum_mode: "content_classification_consent",
    note: "Legal and finance paths require at least scoped content classification consent.",
  }),
  Object.freeze({
    rule_id: "media_binary_paths",
    pattern: "/voice/|/videos/|/screenshots/",
    minimum_mode: "deep_understanding_strong_consent",
    note: "Audio, video, and screenshots require strong consent for OCR/transcription.",
  }),
  Object.freeze({
    rule_id: "unknown_binary",
    pattern: ".bin|.dat|unknown",
    minimum_mode: "content_classification_consent",
    note: "Unknown binaries require manual review before deep scan.",
  }),
]);

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freezeDeep(child);
  return value;
}

function scanBoundary() {
  return freezeDeep({
    ...buildPreviewBoundary(),
    file_content_read: false,
    byte_fingerprint_performed: false,
    ocr_performed: false,
    transcription_performed: false,
    embedding_generated: false,
    knowledge_graph_built: false,
    content_parsed: false,
    network_used: false,
    upload_performed: false,
    sharing_performed: false,
    export_performed: false,
    economic_action_performed: false,
    token_minted: false,
    wallet_accessed: false,
    urp_submission_performed: false,
    node0_activation_performed: false,
  });
}

function buildScanModes() {
  return freezeDeep([
    Object.freeze({
      mode_id: "metadata_only_default",
      level: 0,
      label: "Metadata Scan / Default",
      consent_required: false,
      strong_consent_required: false,
      separate_consent_required: false,
      description:
        "File name, extension, path, size, timestamps, folder structure, rough type — no content opened.",
      allowed_operations: Object.freeze([
        "list_files",
        "classify_by_extension_and_path",
        "cluster_by_folder",
        "surface_duplicate_candidates_metadata_only",
        "emit_asset_management_plan_preview",
      ]),
      forbidden_operations: Object.freeze([
        "read_file_bytes",
        "compute_content_hash",
        "ocr",
        "transcribe",
        "parse_document_body",
        "summarize_content",
        "generate_embeddings",
        "build_knowledge_graph",
        "upload",
        "share",
        "export",
        "urp_submission",
        "token_action",
      ]),
    }),
    Object.freeze({
      mode_id: "fingerprint_dedupe_consent",
      level: 1,
      label: "Fingerprint Scan / Explicit Consent",
      consent_required: true,
      strong_consent_required: false,
      separate_consent_required: false,
      description:
        "Local hash / duplicate detection; may read bytes only to fingerprint — no semantic parsing.",
      allowed_operations: Object.freeze([
        "compute_local_content_hash",
        "dedupe_by_fingerprint",
        "attach_hash_to_proof_trace",
      ]),
      forbidden_operations: Object.freeze([
        "semantic_parse",
        "ocr",
        "transcribe",
        "embedding",
        "upload",
        "share",
        "export",
      ]),
      required_consent_phrase_hint: "GO FINGERPRINT SCAN <scope>",
    }),
    Object.freeze({
      mode_id: "content_classification_consent",
      level: 2,
      label: "Content Classification / Explicit Consent",
      consent_required: true,
      strong_consent_required: false,
      separate_consent_required: false,
      description:
        "Parse text/content locally within chosen scope; classify topics and sensitivity; summarize only inside scope.",
      allowed_operations: Object.freeze([
        "parse_text_content_local",
        "classify_topics_and_sensitivity",
        "scoped_summary_preview",
      ]),
      forbidden_operations: Object.freeze([
        "ocr_without_strong_consent",
        "transcribe_without_strong_consent",
        "embedding_without_strong_consent",
        "knowledge_graph_without_strong_consent",
        "upload",
        "share",
        "export",
      ]),
      required_consent_phrase_hint: "GO CONTENT SCAN <folder-scope>",
    }),
    Object.freeze({
      mode_id: "deep_understanding_strong_consent",
      level: 3,
      label: "Deep Understanding / Strong Consent",
      consent_required: true,
      strong_consent_required: true,
      separate_consent_required: false,
      description:
        "OCR, transcription, entity extraction, knowledge graph, embeddings, value suggestions — high-sensitivity consent.",
      allowed_operations: Object.freeze([
        "ocr_images",
        "transcribe_audio_video",
        "extract_entities",
        "build_knowledge_graph_local",
        "generate_embeddings_local",
        "emit_value_suggestions_preview",
      ]),
      forbidden_operations: Object.freeze([
        "upload",
        "share",
        "export",
        "urp_submission",
        "token_mint",
        "wallet_access",
      ]),
      required_consent_phrase_hint: "GO DEEP SCAN <folder-scope>",
    }),
    Object.freeze({
      mode_id: "share_export_separate_consent",
      level: 4,
      label: "Share / Export / URP Candidate / Separate Consent",
      consent_required: true,
      strong_consent_required: true,
      separate_consent_required: true,
      description:
        "User selects exact assets; Dema prepares share package with receipt and proof plan — no live token/wallet unless separately authorized.",
      allowed_operations: Object.freeze([
        "prepare_share_package_preview",
        "prepare_export_package_preview",
        "attach_receipt_and_proof_plan",
        "mark_urp_candidate_preview_only",
      ]),
      forbidden_operations: Object.freeze([
        "live_token_mint",
        "live_wallet_action",
        "live_urp_submission",
        "implied_reward_from_scan",
      ]),
      required_consent_phrase_hint: "GO SHARE EXPORT <asset-ids>",
    }),
  ]);
}

function buildConsentRequirements() {
  return freezeDeep({
    default_mode: Object.freeze({
      mode_id: DEFAULT_SCAN_MODE,
      consent_required: false,
      user_must_opt_in_for_deeper_modes: true,
    }),
    non_default_modes: Object.freeze(
      SCAN_MODE_IDS.filter((id) => id !== DEFAULT_SCAN_MODE).map((mode_id) =>
        Object.freeze({
          mode_id,
          consent_required: true,
          scoped_selection_required: mode_id !== "fingerprint_dedupe_consent",
          show_receipt_before_run_recommended: true,
        }),
      ),
    ),
    economic_never_implied: Object.freeze({
      scan_does_not_imply: Object.freeze([
        "token_mint",
        "wallet_access",
        "urp_submission",
        "reward_eligibility",
        "sat_settlement",
      ]),
    }),
  });
}

function buildUserChoiceModel() {
  return freezeDeep({
    prompt_style: "scoped_choice_not_vague_permission",
    bad_prompt_example: "Can I scan your files?",
    good_prompt_template:
      "I found {file_count} files by metadata only. To understand content, choose a scan mode:",
    choices: Object.freeze([
      Object.freeze({
        option_id: "metadata_only",
        mode_id: "metadata_only_default",
        label: "Metadata only — safest default",
        selected_by_default: true,
      }),
      Object.freeze({
        option_id: "fingerprint",
        mode_id: "fingerprint_dedupe_consent",
        label: "Fingerprint for duplicates",
      }),
      Object.freeze({
        option_id: "parse_selected",
        mode_id: "content_classification_consent",
        label: "Parse selected folders",
      }),
      Object.freeze({
        option_id: "deep_selected",
        mode_id: "deep_understanding_strong_consent",
        label: "Deep scan selected folders",
      }),
      Object.freeze({
        option_id: "exclude_sensitive",
        mode_id: "metadata_only_default",
        label: "Exclude private/sensitive folders",
        exclusion_hint: "private, legal, finance paths remain metadata-only",
      }),
      Object.freeze({
        option_id: "show_receipt_first",
        mode_id: null,
        label: "Show me the consent receipt before running",
        applies_to_all_non_default: true,
      }),
    ]),
  });
}

function buildProofReceiptRequirements() {
  return freezeDeep({
    required_fields: Object.freeze([
      "scan_mode",
      "scope",
      "user_consent_phrase_or_approval_id",
      "timestamp_iso",
      "boundaries",
      "reproducible_command",
      "source_trace",
    ]),
    reproducible_command_template:
      "dema assets scan --mode <mode_id> --root <path> --scope <scope> --consent-receipt <id>",
    preview_only: true,
    must_emit_before_non_default_run: true,
  });
}

export function buildUnstructuredAssetScanModesPolicy({
  generated_at_iso = "2026-06-26T16:00:00.000Z",
} = {}) {
  const scan_modes = buildScanModes();
  const policy_id = `sha256:${createHash("sha256")
    .update(
      JSON.stringify({
        schema: UNSTRUCTURED_ASSET_SCAN_MODES_SCHEMA,
        modes: SCAN_MODE_IDS,
      }),
    )
    .digest("hex")}`;

  return freezeDeep({
    schema: UNSTRUCTURED_ASSET_SCAN_MODES_SCHEMA,
    truth_label: UNSTRUCTURED_ASSET_SCAN_MODES_TRUTH_LABEL,
    valid: true,
    generated_at_iso,
    policy_id,
    default_mode: DEFAULT_SCAN_MODE,
    product_law: Object.freeze({
      default: "metadata awareness",
      full_content_scan: "explicit scoped consent",
      sharing_export: "separate consent",
      reward_urp_token: "never implied by scanning",
    }),
    scan_modes,
    consent_requirements: buildConsentRequirements(),
    allowed_operations: Object.freeze({
      metadata_only_default: scan_modes[0].allowed_operations,
      with_consent_only: Object.freeze(
        scan_modes
          .filter((m) => m.consent_required)
          .map((m) => m.mode_id),
      ),
    }),
    forbidden_without_consent: FORBIDDEN_WITHOUT_CONSENT,
    sensitivity_rules: SENSITIVITY_RULES,
    user_choice_model: buildUserChoiceModel(),
    proof_receipt_requirements: buildProofReceiptRequirements(),
    what_this_does_not_prove: Object.freeze([
      "This policy kernel does not execute scans — it defines modes and consent boundaries only.",
      "Selecting a mode in preview does not read file content or perform fingerprints.",
      "Share/export and economic rails remain preview-only until separately authorized.",
    ]),
    boundary: scanBoundary(),
    boundaries: scanBoundary(),
  });
}

function boundaryAllFalse(boundary) {
  if (!boundary || typeof boundary !== "object") return false;
  return Object.values(boundary).every((v) => v === false);
}

export function verifyUnstructuredAssetScanModesPolicy(policy) {
  const blocked_by = [];

  if (!policy || policy.schema !== UNSTRUCTURED_ASSET_SCAN_MODES_SCHEMA) {
    blocked_by.push("invalid_schema");
    return Object.freeze({ ok: false, blocked_by });
  }
  if (policy.truth_label !== UNSTRUCTURED_ASSET_SCAN_MODES_TRUTH_LABEL) {
    blocked_by.push("invalid_truth_label");
  }
  if (policy.default_mode !== DEFAULT_SCAN_MODE) {
    blocked_by.push("default_mode_not_metadata_only");
  }
  if (!boundaryAllFalse(policy.boundary)) {
    blocked_by.push("boundary_not_all_false");
  }

  const modes = policy.scan_modes ?? [];
  if (modes.length !== SCAN_MODE_IDS.length) {
    blocked_by.push("scan_mode_count_mismatch");
  }

  const metadataMode = modes.find((m) => m.mode_id === DEFAULT_SCAN_MODE);
  if (!metadataMode || metadataMode.consent_required !== false) {
    blocked_by.push("metadata_mode_must_not_require_consent");
  }
  if (metadataMode?.allowed_operations?.includes("read_file_bytes")) {
    blocked_by.push("metadata_mode_must_not_read_bytes");
  }
  if (!metadataMode?.forbidden_operations?.includes("read_file_bytes")) {
    blocked_by.push("metadata_mode_must_forbid_read_bytes");
  }

  for (const mode of modes) {
    if (mode.mode_id === DEFAULT_SCAN_MODE) continue;
    if (mode.consent_required !== true) {
      blocked_by.push(`consent_required_missing:${mode.mode_id}`);
    }
  }

  const deepMode = modes.find(
    (m) => m.mode_id === "deep_understanding_strong_consent",
  );
  if (!deepMode || deepMode.strong_consent_required !== true) {
    blocked_by.push("deep_scan_missing_strong_consent");
  }

  const shareMode = modes.find(
    (m) => m.mode_id === "share_export_separate_consent",
  );
  if (!shareMode || shareMode.separate_consent_required !== true) {
    blocked_by.push("share_export_missing_separate_consent");
  }

  const forbidden = policy.forbidden_without_consent ?? [];
  for (const action of [
    "silent_content_read",
    "silent_embedding",
    "silent_upload",
    "silent_sharing",
  ]) {
    if (!forbidden.includes(action)) {
      blocked_by.push(`forbidden_missing:${action}`);
    }
  }

  const receipt = policy.proof_receipt_requirements;
  if (!receipt?.required_fields?.includes("scope")) {
    blocked_by.push("proof_receipt_missing_scope");
  }
  if (!receipt?.required_fields?.includes("user_consent_phrase_or_approval_id")) {
    blocked_by.push("proof_receipt_missing_consent");
  }
  if (!receipt?.reproducible_command_template?.includes("dema assets scan")) {
    blocked_by.push("proof_receipt_missing_command");
  }

  return Object.freeze({ ok: blocked_by.length === 0, blocked_by });
}

export function runUnstructuredAssetScanModesGate() {
  const policy = buildUnstructuredAssetScanModesPolicy();
  const verified = verifyUnstructuredAssetScanModesPolicy(policy);
  return freezeDeep({
    ok: verified.ok,
    schema: UNSTRUCTURED_ASSET_SCAN_MODES_SCHEMA,
    truth_label: UNSTRUCTURED_ASSET_SCAN_MODES_TRUTH_LABEL,
    verified,
    scan_mode_count: policy.scan_modes.length,
    policy,
  });
}
