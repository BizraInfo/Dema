// C7 · BIZRA URP local (Universal Resource Pool) per ADR-008 §C7.
//
// Operator's resource substrate · queryable view of hardware · data ·
// knowledge · experience · skills. Local-only · per-resource consent ·
// allocation accounting.

import { buildPreviewBoundary } from "./preview-boundary.js";

const SCHEMA = "bizra.dema.urp_local.v0.1";
const ALLOCATION_SCHEMA = "bizra.dema.urp_allocation.v0.1";

const RESOURCE_CATEGORIES = Object.freeze([
  "hardware",
  "data_corpus",
  "knowledge_base",
  "experience_history",
  "skill_library",
]);

const REQUIRED_BLOCKED_EFFECTS = Object.freeze([
  "allocate_resource_without_per_resource_consent",
  "share_resource_to_node1_or_node2_without_typed_go",
  "modify_resource_inventory",
  "publish_resource_inventory_externally",
  "execute_runtime",
  "federation_invocation",
]);

function safeString(v) {
  return typeof v === "string" ? v : "";
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function safeNumber(v, fallback = 0) {
  return typeof v === "number" && !Number.isNaN(v) ? v : fallback;
}

function classifyResource(resource) {
  const cat = safeString(resource?.category).toLowerCase();
  if (RESOURCE_CATEGORIES.includes(cat)) return cat;
  return "unknown";
}

export function buildURPLocalPreview({
  hardware_summary = null,
  data_corpus_summary = null,
  knowledge_base_summary = null,
  experience_history_summary = null,
  skill_library_summary = null,
} = {}) {
  const hw =
    hardware_summary && typeof hardware_summary === "object"
      ? hardware_summary
      : null;
  const dc =
    data_corpus_summary && typeof data_corpus_summary === "object"
      ? data_corpus_summary
      : null;
  const kb =
    knowledge_base_summary && typeof knowledge_base_summary === "object"
      ? knowledge_base_summary
      : null;
  const eh =
    experience_history_summary && typeof experience_history_summary === "object"
      ? experience_history_summary
      : null;
  const sl =
    skill_library_summary && typeof skill_library_summary === "object"
      ? skill_library_summary
      : null;

  return Object.freeze({
    schema: SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    pool_scope: "node0_local_only",
    federation_allowed: false,
    resource_categories: RESOURCE_CATEGORIES,
    hardware: hw
      ? Object.freeze({
          cpu_cores: safeNumber(hw.cpu_cores, 0),
          memory_gb: safeNumber(hw.memory_gb, 0),
          gpu_present: hw.gpu_present === true,
          gpu_model: safeString(hw.gpu_model),
          gpu_memory_gb: safeNumber(hw.gpu_memory_gb, 0),
          disk_free_gb: safeNumber(hw.disk_free_gb, 0),
          data_present: true,
        })
      : Object.freeze({ data_present: false }),
    data_corpus: dc
      ? Object.freeze({
          total_messages: safeNumber(dc.total_messages, 0),
          total_conversations: safeNumber(dc.total_conversations, 0),
          platforms_count: safeNumber(dc.platforms_count, 0),
          consent_classified: dc.consent_classified === true,
          data_present: true,
        })
      : Object.freeze({ data_present: false }),
    knowledge_base: kb
      ? Object.freeze({
          memory_entries_count: safeNumber(kb.memory_entries_count, 0),
          adr_count: safeNumber(kb.adr_count, 0),
          canon_docs_count: safeNumber(kb.canon_docs_count, 0),
          data_present: true,
        })
      : Object.freeze({ data_present: false }),
    experience_history: eh
      ? Object.freeze({
          receipts_count: safeNumber(eh.receipts_count, 0),
          sessions_count: safeNumber(eh.sessions_count, 0),
          cryptographic_anchors_count: safeNumber(
            eh.cryptographic_anchors_count,
            0,
          ),
          data_present: true,
        })
      : Object.freeze({ data_present: false }),
    skill_library: sl
      ? Object.freeze({
          skills_count: safeNumber(sl.skills_count, 0),
          categories: Object.freeze(
            safeArray(sl.categories).filter((c) => typeof c === "string"),
          ),
          data_present: true,
        })
      : Object.freeze({ data_present: false }),
    blocked_effects: REQUIRED_BLOCKED_EFFECTS,
    sharing_consent_phrase_template:
      "GO: share <resource_id> from Node0 to <target_node>",
    boundary: buildPreviewBoundary(),
  });
}

// Allocation request: declare what resource is wanted · for what duration ·
// for what consumer (which PAT). Returns ALLOCATION CANDIDATE · not an
// active allocation. Operator must consent before allocation activates.
export function buildResourceAllocationCandidate({
  resource = null,
  consumer_agent_id = "",
  duration_minutes = 0,
  purpose = "",
} = {}) {
  const r = resource && typeof resource === "object" ? resource : null;
  const consumer = safeString(consumer_agent_id);
  const dur = safeNumber(duration_minutes, 0);
  const purposeSafe = safeString(purpose).trim();

  const category = r ? classifyResource(r) : "unknown";
  const resourceId = safeString(r?.id || r?.resource_id || "");

  const violations = [];
  if (!r) violations.push("no_resource");
  if (consumer.length === 0) violations.push("no_consumer_agent_id");
  if (purposeSafe.length === 0) violations.push("no_purpose");
  if (dur <= 0) violations.push("invalid_duration");
  if (category === "unknown")
    violations.push(
      `unknown_resource_category · expected one of ${RESOURCE_CATEGORIES.join(",")}`,
    );

  const valid = violations.length === 0;
  const consentPhrase = valid
    ? `GO: allocate ${category} '${resourceId}' to ${consumer} for ${dur}min · '${purposeSafe.slice(0, 60)}'`
    : null;

  return Object.freeze({
    schema: ALLOCATION_SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "draft_only",
    drafted_at: new Date().toISOString(),
    resource_id: resourceId,
    resource_category: category,
    consumer_agent_id: consumer,
    duration_minutes: dur,
    purpose: purposeSafe,
    valid,
    violations: Object.freeze(violations),
    consent_phrase: consentPhrase,
    allocation_active: false,
    requires_typed_go: true,
    audit_trail_required: true,
    receipt_shape_ready: valid,
    boundary: buildPreviewBoundary(),
  });
}

export function buildURPLocalSummary(inputs = {}) {
  const preview = buildURPLocalPreview(inputs);
  const presentCategories = RESOURCE_CATEGORIES.filter(
    (c) => preview[c]?.data_present === true,
  );
  return Object.freeze({
    schema: "bizra.dema.urp_local_summary.v0.1",
    truth_label: preview.truth_label,
    mode: "summary",
    source_schema: preview.schema,
    pool_scope: preview.pool_scope,
    federation_allowed: preview.federation_allowed,
    categories_with_data: Object.freeze(presentCategories),
    categories_without_data_count:
      RESOURCE_CATEGORIES.length - presentCategories.length,
    blocked_effect_count: preview.blocked_effects.length,
    boundary: preview.boundary,
  });
}

export const URP_LOCAL_SCHEMA_NAME = SCHEMA;
export const URP_LOCAL_ALLOCATION_SCHEMA_NAME = ALLOCATION_SCHEMA;
export const URP_LOCAL_RESOURCE_CATEGORIES = RESOURCE_CATEGORIES;
export const URP_LOCAL_REQUIRED_BLOCKED_EFFECTS = REQUIRED_BLOCKED_EFFECTS;
