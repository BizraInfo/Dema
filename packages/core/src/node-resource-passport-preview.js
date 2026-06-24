import { buildPreviewBoundary } from "./preview-boundary.js";

export const NODE_RESOURCE_PASSPORT_PREVIEW_SCHEMA =
  "bizra.dema.node_resource_passport_preview.v0.1";

const TRUTH_LABEL = "NODE_RESOURCE_PASSPORT_PREVIEW_ONLY";
const DESIGNED_NOT_LIVE = "DESIGNED_NOT_LIVE";

const CANDIDATE_TYPES = Object.freeze([
  "compute",
  "storage",
  "knowledge",
  "action",
  "verification",
  "community",
]);

const REWARD_BLOCKERS = Object.freeze([
  "no SAT verification runtime",
  "no PoI settlement runtime",
  "no economic rail settlement",
  "no token mint runtime",
]);

const WHAT_THIS_PROVES = Object.freeze([
  "Existing read-only preview surfaces can be composed into one Node0 resource passport preview.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "URP submission is live.",
  "Federation is active.",
  "SAT runtime verified this passport.",
  "A reward has been earned.",
  "PoI settlement exists.",
  "A token can be minted.",
  "Economic value has been created.",
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safeNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function buildBoundary() {
  return deepFreeze({
    ...buildPreviewBoundary(),
    secret_read: false,
    file_write_performed: false,
    token_minted: false,
    reward_emitted: false,
    poi_score_calculated: false,
    federation_used: false,
    runtime_pat_sat_activated: false,
    urp_offer_emitted: false,
  });
}

function classifyCompute(cpuCores) {
  if (typeof cpuCores !== "number" || !Number.isFinite(cpuCores))
    return "unknown";
  if (cpuCores <= 0) return "none";
  if (cpuCores <= 4) return "small";
  if (cpuCores <= 16) return "medium";
  return "large";
}

function classifyStorage(gb) {
  if (typeof gb !== "number" || !Number.isFinite(gb)) return "unknown";
  if (gb <= 0) return "none";
  if (gb <= 128) return "small";
  if (gb <= 1024) return "medium";
  return "large";
}

function classifyModelCount(count) {
  if (typeof count !== "number" || !Number.isFinite(count)) return "unknown";
  if (count <= 0) return "none";
  if (count <= 3) return "small";
  if (count <= 8) return "medium";
  return "large";
}

function classifyKnowledgeCorpus(knowledgeBase) {
  if (!isObject(knowledgeBase) || knowledgeBase.data_present !== true)
    return "unknown";
  const total =
    safeNumber(knowledgeBase.memory_entries_count) +
    safeNumber(knowledgeBase.adr_count) +
    safeNumber(knowledgeBase.canon_docs_count);
  if (total <= 0) return "none";
  if (total <= 100) return "small";
  if (total <= 1000) return "medium";
  return "large";
}

function classifyMemory(gb) {
  if (typeof gb !== "number" || !Number.isFinite(gb)) return "unknown";
  if (gb <= 0) return "none";
  if (gb <= 16) return "small";
  if (gb <= 32) return "medium";
  if (gb <= 64) return "large";
  return "ultra";
}

function classifyGpuMemory(gb) {
  if (typeof gb !== "number" || !Number.isFinite(gb)) return "unknown";
  if (gb <= 0) return "none";
  if (gb <= 8) return "small";
  if (gb <= 16) return "laptop_16gb";
  if (gb <= 24) return "desktop_24gb";
  return "datacenter";
}

function buildCapacityClasses(urpLocalPreview, modelSummary) {
  const hardware = isObject(urpLocalPreview.hardware)
    ? urpLocalPreview.hardware
    : {};
  const modelCount =
    safeNumber(modelSummary?.model_count, null) ??
    safeNumber(modelSummary?.count, null);

  return deepFreeze({
    compute: classifyCompute(hardware.cpu_cores),
    memory: classifyMemory(hardware.memory_gb),
    gpu: classifyGpuMemory(hardware.gpu_memory_gb),
    storage: classifyStorage(hardware.disk_free_gb),
    models: classifyModelCount(modelCount),
    knowledge_corpus: classifyKnowledgeCorpus(urpLocalPreview.knowledge_base),
  });
}

function extractNodeOrdinal(nodeRegistryPreview) {
  const accepted = nodeRegistryPreview.registry_state?.accepted;
  const node0 = Array.isArray(accepted)
    ? accepted.find((entry) => entry?.node_ordinal === 0)
    : null;
  return safeNumber(node0?.node_ordinal, 0);
}

function buildProofStatus(proofPassportSummary) {
  const aggregate = proofPassportSummary.aggregate;
  return deepFreeze({
    source: "proof_passport_summary",
    verdict:
      typeof aggregate.verdict === "string" ? aggregate.verdict : "UNKNOWN",
    receipt_count: safeNumber(aggregate.total_receipts, 0),
    verified_count: safeNumber(aggregate.verified_count, 0),
    failed_count: safeNumber(aggregate.failed_count, 0),
  });
}

function validateInputs({
  nodeRegistryPreview,
  urpLocalPreview,
  proofPassportSummary,
  sharedUrpWorldPreview,
}) {
  const blockers = [];
  if (!isObject(nodeRegistryPreview) || !isObject(nodeRegistryPreview.registry_state)) {
    blockers.push("invalid_node_registry_preview");
  }
  if (!isObject(urpLocalPreview)) {
    blockers.push("invalid_urp_local_preview");
  }
  if (!isObject(proofPassportSummary) || !isObject(proofPassportSummary.aggregate)) {
    blockers.push("invalid_proof_passport_summary");
  }
  if (
    sharedUrpWorldPreview !== undefined &&
    !isObject(sharedUrpWorldPreview)
  ) {
    blockers.push("invalid_shared_urp_world_preview");
  }
  return blockers;
}

function buildFailureEnvelope(blockedBy) {
  return deepFreeze({
    schema: NODE_RESOURCE_PASSPORT_PREVIEW_SCHEMA,
    truth_label: TRUTH_LABEL,
    mode: "preview_only",
    valid: false,
    status: "REFUSED_PREVIEW_INPUT_INVALID",
    blocked_by: blockedBy,
    reward_candidate_lens: {
      reward_candidate_eligible: false,
      reward_runtime_status: DESIGNED_NOT_LIVE,
      poi_runtime_status: DESIGNED_NOT_LIVE,
      token_mint_status: DESIGNED_NOT_LIVE,
      blocked_by: REWARD_BLOCKERS,
    },
    urp: {
      submission_status: DESIGNED_NOT_LIVE,
      federation_status: DESIGNED_NOT_LIVE,
    },
    boundary: buildBoundary(),
    what_this_proves: [],
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
  });
}

export function buildNodeResourcePassportPreview({
  nodeRegistryPreview,
  urpLocalPreview,
  proofPassportSummary,
  urpResourceOfferPreview = null,
  agentDualLoopPreview = null,
  sharedUrpWorldPreview = undefined,
  modelSummary = null,
} = {}) {
  const blockers = validateInputs({
    nodeRegistryPreview,
    urpLocalPreview,
    proofPassportSummary,
    sharedUrpWorldPreview,
  });
  if (blockers.length > 0) return buildFailureEnvelope(Object.freeze(blockers));

  const rewardLens = isObject(agentDualLoopPreview?.reward_candidate_lens)
    ? agentDualLoopPreview.reward_candidate_lens
    : null;

  return deepFreeze({
    schema: NODE_RESOURCE_PASSPORT_PREVIEW_SCHEMA,
    truth_label: TRUTH_LABEL,
    mode: "preview_only",
    valid: true,
    node_identity: {
      node_role: "NODE0_SEED",
      node_ordinal: extractNodeOrdinal(nodeRegistryPreview),
      identity_disclosure: "ORDINAL_ONLY",
    },
    agent_capacity: {
      local_pat_count: 7,
      system_sat_count: 5,
      runtime_status: DESIGNED_NOT_LIVE,
    },
    proof_status: buildProofStatus(proofPassportSummary),
    capacity_classes: buildCapacityClasses(urpLocalPreview, modelSummary),
    contribution_candidacy: {
      candidate_types: CANDIDATE_TYPES,
      offer_emitted: false,
      consent_requested: false,
      source_offer_status: isObject(urpResourceOfferPreview)
        ? "preview_input_observed_not_emitted"
        : "no_offer_input",
    },
    reward_candidate_lens: {
      reward_candidate_eligible: false,
      reward_runtime_status: DESIGNED_NOT_LIVE,
      poi_runtime_status: DESIGNED_NOT_LIVE,
      token_mint_status: DESIGNED_NOT_LIVE,
      source_reward_status: rewardLens?.status ?? "no_reward_lens_input",
      blocked_by: REWARD_BLOCKERS,
    },
    urp: {
      submission_status: DESIGNED_NOT_LIVE,
      federation_status: DESIGNED_NOT_LIVE,
      shared_world_status:
        typeof sharedUrpWorldPreview?.status === "string"
          ? sharedUrpWorldPreview.status
          : "no_shared_world_input",
    },
    boundary: buildBoundary(),
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
  });
}
