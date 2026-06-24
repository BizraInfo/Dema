// NODE0-HARDWARE-PROFILE-1A — pure hardware architecture profile kernel.
//
// Turns CALLER-GATHERED machine observations into a deterministic, frozen,
// truth-labeled architecture profile: coarse capacity bands, reference-machine
// match (ordinal only), and PREVIEW-ONLY runtime layout policies. Zero I/O.
//
// This does NOT enforce policies, allocate resources, start daemons, or probe
// the machine. It states how Node0 SHOULD layer compute given measured inputs.

import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

export const NODE0_HARDWARE_PROFILE_SCHEMA = "bizra.dema.node0_hardware_profile.v0.1";
export const NODE0_HARDWARE_PROFILE_TRUTH_LABEL = "NODE0_HARDWARE_PROFILE_LOCAL_ONLY";

const MODE = "READ_ONLY_PROFILE";

export const NODE0_REFERENCE_PROFILES = Object.freeze({
  msi_hx18_titan_linux: Object.freeze({
    id: "msi_hx18_titan_linux",
    label: "MSI Titan HX 18 · Node0 reference workstation",
    cpu_cores_min: 24,
    memory_total_gb_min: 96,
    gpu_memory_gb_min: 14,
    gpu_name_substrings: Object.freeze(["4090"]),
    disk_free_gb_min: 256,
    platform: "linux",
  }),
});

const CANONICAL_BOUNDARY = Object.freeze({
  key_generated: false,
  signature_created: false,
  token_minted: false,
  federation_used: false,
  daemon_started_or_stopped: false,
  private_content_read: false,
  home_scan_performed: false,
  runtime_claim_promoted: false,
  resource_allocated: false,
  policy_enforced: false,
});

const WHAT_THIS_PROVES = Object.freeze([
  "Caller-gathered hardware observations normalize into coarse capacity bands and a frozen architecture-policy preview.",
  "A known reference profile (MSI Titan HX 18 class) can be matched ordinally when observations fall within declared tolerances.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "Policies are PREVIEW ONLY — nothing here enforces GPU exclusivity, stops competing servers, or configures providers.",
  "Reference profile match is descriptive, not a warranty that this exact SKU is present.",
  "Capacity bands are coarse; they do not leak raw telemetry into URP reward or federation surfaces.",
  "This does not benchmark models, route live traffic, or activate PAT/SAT runtime.",
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const text = (v) => (typeof v === "string" ? v.trim() : "");

function classifyCompute(cores) {
  if (cores === null) return "unknown";
  if (cores <= 0) return "none";
  if (cores <= 8) return "small";
  if (cores <= 16) return "medium";
  if (cores <= 24) return "large";
  return "ultra";
}

function classifyMemory(gb) {
  if (gb === null) return "unknown";
  if (gb <= 0) return "none";
  if (gb <= 16) return "small";
  if (gb <= 32) return "medium";
  if (gb <= 64) return "large";
  return "ultra";
}

function classifyGpuMemory(gb) {
  if (gb === null) return "none";
  if (gb <= 0) return "none";
  if (gb <= 8) return "small";
  if (gb <= 16) return "laptop_16gb";
  if (gb <= 24) return "desktop_24gb";
  return "datacenter";
}

function classifyStorageFree(gb) {
  if (gb === null) return "unknown";
  if (gb <= 0) return "none";
  if (gb <= 128) return "small";
  if (gb <= 1024) return "medium";
  return "large";
}

function normalizeGpu(gpus) {
  if (!Array.isArray(gpus)) return Object.freeze([]);
  return Object.freeze(
    gpus
      .filter((g) => g && typeof g === "object")
      .map((g) =>
        Object.freeze({
          name: text(g.name) || null,
          memory_total_mib: num(g.memory_total_mib),
          memory_free_mib: num(g.memory_free_mib),
        }),
      )
      .filter((g) => g.name || g.memory_total_mib !== null),
  );
}

function primaryGpu(gpus) {
  if (!gpus.length) return null;
  const sorted = [...gpus].sort(
    (a, b) => (b.memory_total_mib ?? 0) - (a.memory_total_mib ?? 0),
  );
  return sorted[0];
}

function matchReferenceProfile(obs) {
  const ref = NODE0_REFERENCE_PROFILES.msi_hx18_titan_linux;
  const blockers = [];
  const cores = num(obs.cpu_cores_logical);
  const mem = num(obs.memory_total_gb);
  const disk = num(obs.disk?.free_gb);
  const gpu = primaryGpu(obs.gpus);
  const gpuGb =
    gpu && gpu.memory_total_mib !== null ? gpu.memory_total_mib / 1024 : null;
  const gpuName = text(gpu?.name).toLowerCase();

  if (text(obs.platform).toLowerCase() !== ref.platform) blockers.push("platform_mismatch");
  if (cores === null || cores < ref.cpu_cores_min) blockers.push("cpu_below_reference");
  if (mem === null || mem < ref.memory_total_gb_min) blockers.push("memory_below_reference");
  if (disk === null || disk < ref.disk_free_gb_min) blockers.push("disk_below_reference");
  if (gpuGb === null || gpuGb < ref.gpu_memory_gb_min) blockers.push("gpu_memory_below_reference");
  if (!ref.gpu_name_substrings.some((s) => gpuName.includes(s.toLowerCase()))) {
    blockers.push("gpu_name_mismatch");
  }

  return deepFreeze({
    reference_id: ref.id,
    reference_label: ref.label,
    matched: blockers.length === 0,
    blockers: Object.freeze(blockers),
  });
}

function buildArchitecturePolicies({ capacity, gpu, memoryTotalGb, memoryAvailableGb }) {
  const gpuGb = gpu && gpu.memory_total_mib !== null ? gpu.memory_total_mib / 1024 : null;
  const gpuFreeGb = gpu && gpu.memory_free_mib !== null ? gpu.memory_free_mib / 1024 : null;
  const singleGpuTenant = gpuGb !== null && gpuGb <= 24;

  const layers = Object.freeze({
    compute_plane: Object.freeze({
      role: "parallel_eval_and_preview_workers",
      cpu_class: capacity.compute,
      notes: Object.freeze([
        "Use logical cores for parallel gatherers (eval baseline, observe) — not for hidden daemons.",
        "PAT/SAT dry-run workers remain PREVIEW_ONLY until activation gates pass.",
      ]),
    }),
    gpu_plane: Object.freeze({
      role: "single_primary_inference_device",
      gpu_class: capacity.gpu,
      max_simultaneous_loaded_models: singleGpuTenant ? 1 : 2,
      exclusive_recommended: singleGpuTenant,
      notes: Object.freeze([
        "16 GB laptop GPUs cannot host llama serve + LM Studio + Ollama loaded models concurrently.",
        "Pick one primary local provider per session; unload before switching.",
      ]),
    }),
    ram_plane: Object.freeze({
      role: "cpu_offload_and_corpus_headroom",
      memory_class: capacity.memory,
      ram_offload_viable: memoryTotalGb !== null && memoryTotalGb >= 64,
      notes: Object.freeze([
        "High RAM enables CPU spill for oversized Modelfiles but does not remove the single-GPU load constraint.",
        "Keep DEMA_HOME, model weights, and eval receipts on fast NVMe.",
      ]),
    }),
    storage_plane: Object.freeze({
      role: "model_zoo_receipts_corpus",
      storage_class: capacity.storage,
      notes: Object.freeze([
        "Partition: ~/.dema (operator state) · LM Studio/Ollama model dirs · /data/bizra/logs (eval artifacts).",
      ]),
    }),
  });

  const provider_stack = Object.freeze([
    Object.freeze({ id: "lm_studio", port: 1234, priority: 1, role: "primary_chat_ui" }),
    Object.freeze({ id: "ollama", port: 11434, priority: 2, role: "cli_and_modelfile_lab" }),
    Object.freeze({ id: "llamacpp", port: 8080, priority: 3, role: "optional_single_model_serve" }),
  ]);

  const operational_rules = Object.freeze([
    "Before loading a model in LM Studio, stop competing llama/ollama GPU holders if VRAM is tight.",
    "Run dema eval baseline after provider changes; route preview consumes measured scores only.",
    "Do not claim MoE or live council until dry-run activation gates pass.",
  ]);

  return deepFreeze({
    mode: "preview_only",
    layers,
    provider_stack,
    operational_rules,
    observed_gpu_free_gb: gpuFreeGb,
    observed_memory_available_gb: memoryAvailableGb,
  });
}

function normalizeObservations(raw = {}) {
  const gpus = normalizeGpu(raw.gpus);
  const disk = raw.disk && typeof raw.disk === "object" ? raw.disk : {};
  return deepFreeze({
    platform: text(raw.platform) || null,
    hostname: text(raw.hostname) || null,
    cpu_cores_logical: num(raw.cpu_cores_logical),
    memory_total_gb: num(raw.memory_total_gb),
    memory_available_gb: num(raw.memory_available_gb),
    gpus,
    disk: Object.freeze({
      mount: text(disk.mount) || null,
      total_gb: num(disk.total_gb),
      free_gb: num(disk.free_gb),
    }),
  });
}

function buildCapacityClasses(obs) {
  const gpu = primaryGpu(obs.gpus);
  const gpuGb =
    gpu && gpu.memory_total_mib !== null ? gpu.memory_total_mib / 1024 : null;
  return deepFreeze({
    compute: classifyCompute(obs.cpu_cores_logical),
    memory: classifyMemory(obs.memory_total_gb),
    gpu: classifyGpuMemory(gpuGb),
    storage: classifyStorageFree(obs.disk.free_gb),
  });
}

function buildFailure(blockedBy) {
  return deepFreeze({
    schema: NODE0_HARDWARE_PROFILE_SCHEMA,
    truth_label: NODE0_HARDWARE_PROFILE_TRUTH_LABEL,
    mode: MODE,
    valid: false,
    status: "REFUSED_PROFILE_INPUT_INVALID",
    blocked_by: blockedBy,
    boundary: deepFreeze({ ...buildPreviewBoundary(), ...CANONICAL_BOUNDARY }),
    what_this_proves: [],
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
  });
}

export function buildNode0HardwareProfile(observations = {}, { generated_at_iso } = {}) {
  const obs = normalizeObservations(observations);
  const blockers = [];
  if (obs.cpu_cores_logical === null) blockers.push("missing_cpu_cores_logical");
  if (obs.memory_total_gb === null) blockers.push("missing_memory_total_gb");
  if (blockers.length > 0) return buildFailure(Object.freeze(blockers));

  const capacity = buildCapacityClasses(obs);
  const gpu = primaryGpu(obs.gpus);
  const reference = matchReferenceProfile(obs);
  const architecture = buildArchitecturePolicies({
    capacity,
    gpu,
    memoryTotalGb: obs.memory_total_gb,
    memoryAvailableGb: obs.memory_available_gb,
  });

  const body = {
    schema: NODE0_HARDWARE_PROFILE_SCHEMA,
    truth_label: NODE0_HARDWARE_PROFILE_TRUTH_LABEL,
    mode: MODE,
    valid: true,
    observations: obs,
    capacity_classes: capacity,
    reference_profile: reference,
    architecture_policies: architecture,
    workstation_tier: reference.matched ? "node0_reference_ultra" : "generic_linux_workstation",
    boundary: deepFreeze({ ...buildPreviewBoundary(), ...CANONICAL_BOUNDARY }),
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
    generated_at_iso: text(generated_at_iso) || null,
  };

  const { profile_hash, ...hashBody } = body;
  const frozen = deepFreeze({ ...body, profile_hash: sha256(stableStringify(hashBody)) });
  return frozen;
}

export function verifyNode0HardwareProfile(report) {
  if (!report || typeof report !== "object") {
    return deepFreeze({ valid: false, blocked_by: Object.freeze(["invalid_report"]) });
  }
  const blocked = [];
  if (report.schema !== NODE0_HARDWARE_PROFILE_SCHEMA) blocked.push("schema_mismatch");
  if (report.truth_label !== NODE0_HARDWARE_PROFILE_TRUTH_LABEL) blocked.push("truth_label_mismatch");
  if (report.valid !== true) blocked.push("report_not_valid");

  const { profile_hash, ...body } = report;
  const expected = sha256(stableStringify(body));
  if (profile_hash !== expected) blocked.push("profile_hash_mismatch");

  for (const [k, v] of Object.entries(report.boundary || {})) {
    if (v !== false) blocked.push(`boundary_not_false:${k}`);
  }

  if (!Array.isArray(report.what_this_does_not_prove)) blocked.push("missing_what_this_does_not_prove");
  else if (
    JSON.stringify(report.what_this_does_not_prove) !== JSON.stringify(WHAT_THIS_DOES_NOT_PROVE)
  ) {
    blocked.push("what_this_does_not_prove_tampered");
  }

  const recomputed = buildNode0HardwareProfile(report.observations, {
    generated_at_iso: report.generated_at_iso,
  });
  if (recomputed.workstation_tier !== report.workstation_tier) blocked.push("workstation_tier_drift");

  return deepFreeze({
    valid: blocked.length === 0,
    blocked_by: Object.freeze(blocked),
    reason_code: blocked.length === 0 ? "node0_hardware_profile_valid" : "node0_hardware_profile_invalid",
  });
}
