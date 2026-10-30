// DEEPSEEK-V4.1-FLASH-ADMIT-1A — Node0 capability admit (MAP / CANDIDATE only).
//
// Human GO (2026-10-30): admit the tech-report binding into Dema season state.
// Does NOT download weights, invoke a model, open HF, or mutate DEMA_HOME.
// authority_delta = 0. Weights fetch remains a separate typed GO.

import { createHash } from "node:crypto";

import { buildPreviewBoundary } from "./preview-boundary.js";

export const DEEPSEEK_V41_FLASH_ADMIT_SCHEMA =
  "bizra.dema.deepseek_v41_flash_admit_preview.v0.1";
export const DEEPSEEK_V41_FLASH_ADMIT_TRUTH_LABEL =
  "DEEPSEEK_V41_FLASH_ADMITTED_MAP_CANDIDATE_ONLY";

/** Measured PDF identity from Downloads (map-before-merge). */
export const SOURCE_PDF = Object.freeze({
  path_declared:
    "/home/bizra-operating-system/Downloads/DeepSeek_V41_Tech_Report.pdf",
  sha256:
    "ba68e2e40408125ae6d2f63a9a241b61c73910691c74ec1a2a7023c851eac08d",
  extract_path_declared:
    "/data/bizra/logs/sparc-spec-pseudocode/pdf-extract/DeepSeek_V41_Tech_Report.txt",
  map_doc:
    "docs/02-architecture/season-node0-habitat-genesis-1a-pseudocode/phase_07_deepseek_v41_flash_map.md",
});

export const HF_ID_DECLARED = "deepseek-ai/DeepSeek-V4.1-Flash";

export const ADMIT_STATUS = "ADMITTED_MAP_CANDIDATE";

/** Paper-claimed figures — DECLARED, not re-measured on this host. */
export const PAPER_CLAIMS = Object.freeze({
  backbone_params: "552B_MoE",
  context_tokens: "1M",
  active_prefill: "8B",
  active_decode: "16B",
  global_kv_bytes_per_token: 890,
  global_kv_vs_v4_flash: "approx_1/4",
  persistent_kv_vs_v4_flash: "approx_1/8",
  mechanisms: Object.freeze([
    "CED",
    "CSA2",
    "FP4_KV",
    "SWA_Bounded_Replay",
    "Engram",
    "DSpark",
    "Single_Pass_mHC",
  ]),
});

/**
 * KV estate vocabulary — Dema-native labels mapped from the paper.
 * Analogy only; not a running inference cache.
 */
export const KV_ESTATE = Object.freeze({
  global_hbm: {
    dema_analogy: "truth_spine_global_sealed_state",
    paper: "global_KV_always_in_HBM",
  },
  swa_local: {
    dema_analogy: "short_horizon_working_set",
    paper: "sliding_window_attention_local_KV",
  },
  persistent_ssd: {
    dema_analogy: "prefix_reuse_under_host_or_ssd",
    paper: "persistent_KV_on_SSD_or_host_memory",
  },
  bounded_replay: {
    dema_analogy: "re_derive_local_state_from_sealed_chain",
    paper: "SWA_Bounded_Replay",
  },
});

export const FORBIDDEN_EFFECTS = Object.freeze([
  "weights_download",
  "model_invoke",
  "huggingface_fetch",
  "gpu_alloc",
  "dema_home_mutate",
  "NODE0_CLOSED",
  "RSI_LIVE",
  "SINGULARITY_LIVE",
]);

export const WEIGHTS_FETCH_REQUIRES =
  "GO: download DeepSeek-V4.1-Flash weights under stated disk/GPU envelope";

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function freezeDeep(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const v of Object.values(value)) freezeDeep(v);
    Object.freeze(value);
  }
  return value;
}

/**
 * Build Node0 admit preview for DeepSeek-V4.1-Flash (map/candidate only).
 */
export function buildDeepseekV41FlashAdmitPreview({
  admit_id = "deepseek-v41-flash-admit-1a",
  human_go = "GO",
} = {}) {
  const body = {
    schema: DEEPSEEK_V41_FLASH_ADMIT_SCHEMA,
    truth_label: DEEPSEEK_V41_FLASH_ADMIT_TRUTH_LABEL,
    mode: "PREVIEW_ONLY",
    authority_delta: 0,
    admit_id,
    admit_status: ADMIT_STATUS,
    human_go_ref: human_go,
    source_pdf: SOURCE_PDF,
    hf_id_declared: HF_ID_DECLARED,
    weights: Object.freeze({
      fetched: false,
      on_disk: false,
      invoke_allowed: false,
      fetch_requires_exact_go: WEIGHTS_FETCH_REQUIRES,
    }),
    paper_claims: PAPER_CLAIMS,
    kv_estate: KV_ESTATE,
    forbidden_effects: FORBIDDEN_EFFECTS,
    boundary: buildPreviewBoundary({
      content_read: true,
      model_invocation_performed: false,
      filesystem_write_performed: false,
      network_used: false,
      receipt_mint_performed: false,
      tool_executed: false,
    }),
    not_established: Object.freeze([
      "paper_benchmarks_reproduced",
      "890_bytes_per_token_measured_here",
      "weights_integrity",
      "Node0_GPU_fit",
      "license_runtime_compliance_audit",
    ]),
  };

  const admit_digest = `sha256:${sha256Hex(
    Buffer.from(JSON.stringify(body), "utf8")
  )}`;
  return freezeDeep({ ...body, admit_digest });
}

export function refuseWeightsFetch(consent) {
  if (consent === WEIGHTS_FETCH_REQUIRES) {
    return freezeDeep({
      ok: false,
      reason: "GO_PHRASE_MATCHED_BUT_FETCH_NOT_IMPLEMENTED_THIS_SLICE",
      fetched: false,
      authority_delta: 0,
      note: "Exact phrase accepted as future unlock; this module never downloads.",
    });
  }
  return freezeDeep({
    ok: false,
    reason: "CONSENT_MISSING_OR_MISMATCH",
    fetched: false,
    expected_phrase: WEIGHTS_FETCH_REQUIRES,
    authority_delta: 0,
  });
}

export function verifyDeepseekV41FlashAdmitPreview(admit) {
  const errors = [];
  if (!admit || admit.schema !== DEEPSEEK_V41_FLASH_ADMIT_SCHEMA) {
    errors.push("schema");
  }
  if (admit?.truth_label !== DEEPSEEK_V41_FLASH_ADMIT_TRUTH_LABEL) {
    errors.push("truth_label");
  }
  if (admit?.authority_delta !== 0) errors.push("authority_delta");
  if (admit?.weights?.fetched === true) errors.push("weights_fetched");
  if (admit?.weights?.invoke_allowed === true) errors.push("invoke_allowed");
  if (admit?.source_pdf?.sha256 !== SOURCE_PDF.sha256) {
    errors.push("pdf_sha256_drift");
  }
  if (admit?.admit_status !== ADMIT_STATUS) errors.push("admit_status");
  return freezeDeep({ ok: errors.length === 0, errors });
}

export function runDeepseekV41FlashAdmitGate(input = {}) {
  const admit = buildDeepseekV41FlashAdmitPreview(input);
  const v = verifyDeepseekV41FlashAdmitPreview(admit);
  return freezeDeep({ ok: v.ok, admit, verify: v });
}
