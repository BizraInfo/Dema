// NODE0-LOCAL-CLOSURE-READINESS-1A
//
// Pure readiness composer for closing Node0 locally. It binds the measured
// evidence-source registry to a Node0 space-index envelope, then reports the
// exact next gates: hash consent, dedup plan, reorg plan, SAT metadata summary,
// PoI review, and no-mint blockers. It does not scan, read content, write files,
// invoke a model, call the network, submit to SAT, verify impact, or mint.

import { createHash } from "node:crypto";

import {
  NODE0_SPACE_INDEX_SCHEMA,
  buildNode0HashConsentPhrase,
} from "./node0-space-index.js";
import {
  NODE0_EVIDENCE_SOURCE_REGISTRY_SCHEMA,
  NODE0_EVIDENCE_SOURCE_REGISTRY_TRUTH_LABEL,
  buildNode0EvidenceSourceRegistryPayload,
  defaultNode0EvidenceSourceRegistryInput,
} from "./node0-evidence-source-registry.js";

export const NODE0_LOCAL_CLOSURE_READINESS_SCHEMA =
  "bizra.dema.node0_local_closure_readiness.v0.1";
export const NODE0_LOCAL_CLOSURE_READINESS_TRUTH_LABEL =
  "NODE0_LOCAL_CLOSURE_READINESS_MEASURED_REPO";
export const NODE0_LOCAL_CLOSURE_READINESS_GO_PHRASE =
  "GO: build Node0 local closure readiness preview";

const ROOT_HASH = `sha256:${"a".repeat(64)}`;
const PIPELINE_IDS = Object.freeze([
  "source_registry",
  "metadata_index",
  "content_hash_scan",
  "dedup_plan",
  "reorg_plan",
  "apply_reorg",
  "sat_summary",
  "proof_of_impact",
  "mint",
]);

function freezeDeep(value) {
  if (!value || typeof value !== "object") return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
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

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function countGroups(groups, type) {
  return (groups || []).filter((group) => group?.group_type === type).length;
}

export function node0LocalClosureReadinessBoundary() {
  return freezeDeep({
    execution_allowed: false,
    daemon_started: false,
    network_used: false,
    token_minted: false,
    wallet_accessed: false,
    live_execution_performed: false,
    file_mutation_performed: false,
    model_invocation_performed: false,
  });
}

function defaultIndexEnvelope() {
  return freezeDeep({
    schema: NODE0_SPACE_INDEX_SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "metadata_only_index",
    root: {
      display: "fixture:/node0",
      normalized_path_hash: ROOT_HASH,
      hash_consent_phrase: buildNode0HashConsentPhrase(ROOT_HASH),
    },
    summary: {
      records_count: 9,
      files_count: 6,
      dirs_count: 2,
      symlinks_count: 1,
      denied_count: 1,
      duplicate_candidate_group_count: 2,
      total_indexed_bytes: 2048,
      truncated: false,
    },
    duplicate_candidate_groups: [
      {
        group_type: "size_collision_weak",
        confidence: "weak",
        content_confirmed: false,
        size_bytes: 128,
        members: ["a.md", "b.md"],
      },
      {
        group_type: "size_collision_weak",
        confidence: "weak",
        content_confirmed: false,
        size_bytes: 256,
        members: ["c.json", "d.json"],
      },
    ],
    consent: {
      content_hash_required: false,
      required_phrase: buildNode0HashConsentPhrase(ROOT_HASH),
      provided: false,
      accepted: false,
    },
    boundary: {
      scanned_root_mutated: false,
      file_content_read: false,
      content_hash_performed: false,
      network_used: false,
      delete_or_move_performed: false,
      token_minted: false,
      wallet_accessed: false,
      federation_invoked: false,
      urp_submission_performed: false,
      symlink_followed: false,
    },
  });
}

export function defaultNode0LocalClosureReadinessInput() {
  return freezeDeep({
    registry: buildNode0EvidenceSourceRegistryPayload(
      defaultNode0EvidenceSourceRegistryInput(),
    ),
    index: defaultIndexEnvelope(),
  });
}

function validateRegistry(registry) {
  const blocked = [];
  if (!isPlainObject(registry)) return ["registry_missing"];
  if (registry.schema !== NODE0_EVIDENCE_SOURCE_REGISTRY_SCHEMA) {
    blocked.push("registry_schema_mismatch");
  }
  if (registry.truth_label !== NODE0_EVIDENCE_SOURCE_REGISTRY_TRUTH_LABEL) {
    blocked.push("registry_truth_label_mismatch");
  }
  if (!Array.isArray(registry.sources) || registry.sources.length === 0) {
    blocked.push("registry_sources_missing");
  }
  if (registry.source_count !== registry.sources?.length) {
    blocked.push("registry_source_count_mismatch");
  }
  if (registry.mint_allowed_count !== 0) blocked.push("registry_mint_allowed_not_zero");
  if (registry.policy?.no_live_mint !== true) blocked.push("registry_no_live_mint_missing");
  if (registry.policy?.no_content_read !== true) {
    blocked.push("registry_no_content_read_missing");
  }
  return blocked;
}

function validateIndex(index) {
  const blocked = [];
  if (!isPlainObject(index)) return ["index_missing"];
  if (index.schema !== NODE0_SPACE_INDEX_SCHEMA) blocked.push("index_schema_mismatch");
  if (!["metadata_only_index", "content_hash_index"].includes(index.mode)) {
    blocked.push("index_mode_invalid");
  }
  const rootHash = index.root?.normalized_path_hash;
  if (!/^sha256:[0-9a-f]{64}$/.test(rootHash || "")) {
    blocked.push("index_root_hash_invalid");
  }
  if (index.root?.hash_consent_phrase !== buildNode0HashConsentPhrase(rootHash)) {
    blocked.push("index_hash_consent_not_root_bound");
  }
  if (!isPlainObject(index.summary)) blocked.push("index_summary_missing");
  if (!Array.isArray(index.duplicate_candidate_groups)) {
    blocked.push("index_duplicate_groups_missing");
  }
  if (index.boundary?.scanned_root_mutated !== false) {
    blocked.push("index_scanned_root_mutated_not_false");
  }
  if (index.boundary?.network_used !== false) blocked.push("index_network_used_not_false");
  if (index.boundary?.token_minted !== false) blocked.push("index_token_minted_not_false");
  if (index.mode === "metadata_only_index" && index.boundary?.file_content_read !== false) {
    blocked.push("metadata_index_content_read_not_false");
  }
  if (index.mode === "content_hash_index" && index.consent?.accepted !== true) {
    blocked.push("content_hash_index_consent_not_accepted");
  }
  return blocked;
}

function validateInput(input) {
  if (!isPlainObject(input)) return ["input_not_object"];
  return [...validateRegistry(input.registry), ...validateIndex(input.index)];
}

export function planNode0LocalClosureReadiness({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== NODE0_LOCAL_CLOSURE_READINESS_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  blocked_by.push(...validateInput(input));
  return freezeDeep({
    schema: NODE0_LOCAL_CLOSURE_READINESS_SCHEMA,
    truth_label: NODE0_LOCAL_CLOSURE_READINESS_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by,
  });
}

function buildPipeline(index) {
  const contentHashReady = index.mode === "content_hash_index";
  return freezeDeep([
    { id: "source_registry", status: "READY", authority: "PAT_LOCAL" },
    { id: "metadata_index", status: "READY", authority: "PAT_LOCAL" },
    {
      id: "content_hash_scan",
      status: contentHashReady ? "READY" : "CONSENT_REQUIRED",
      authority: "OPERATOR_EXACT_CONSENT",
    },
    {
      id: "dedup_plan",
      status: contentHashReady ? "READY_FOR_PLAN_ONLY" : "BLOCKED_UNTIL_HASH_SCAN",
      authority: "PAT_LOCAL_PLAN_ONLY",
    },
    {
      id: "reorg_plan",
      status: "BLOCKED_UNTIL_DEDUP_PLAN",
      authority: "PAT_LOCAL_PLAN_ONLY",
    },
    {
      id: "apply_reorg",
      status: "BLOCKED_UNTIL_EXACT_PLAN_CONSENT",
      authority: "OPERATOR_EXACT_CONSENT",
    },
    {
      id: "sat_summary",
      status: "BLOCKED_UNTIL_APPLY_COMPLETE",
      authority: "SAT_METADATA_ONLY",
    },
    {
      id: "proof_of_impact",
      status: "BLOCKED_UNTIL_VERIFIED_IMPACT",
      authority: "FATE_SAT_POI",
    },
    { id: "mint", status: "BLOCKED_NO_LIVE_MINT", authority: "EXTERNAL_REVIEW_REQUIRED" },
  ]);
}

function buildNextAction(index) {
  if (index.mode === "content_hash_index") {
    return freezeDeep({
      kind: "DEDUP_PLAN_PREVIEW",
      exact_phrase: null,
      reason: "content_hash_index_ready_for_plan_only_duplicate_review",
    });
  }
  return freezeDeep({
    kind: "CONTENT_HASH_CONSENT",
    exact_phrase: index.root.hash_consent_phrase,
    reason: "metadata_only_index_cannot_confirm_duplicates_without_exact_hash_consent",
  });
}

function buildImpactQueue(registry) {
  return freezeDeep(
    registry.sources
      .filter(
        (source) =>
          source.impact_candidate === true && source.source_type !== "economy_simulation",
      )
      .map((source) => ({
        source_id: source.source_id,
        source_type: source.source_type,
        truth_label: source.truth_label,
        privacy_level: source.privacy_level,
        promotion_gate: source.promotion_gate,
        queue_status: "REVIEW_CANDIDATE_ONLY",
        impact_verified: false,
        mint_allowed: false,
      })),
  );
}

function sourceSummary(registry) {
  return freezeDeep({
    source_count: registry.source_count,
    source_types: registry.source_types,
    counts_by_type: registry.counts_by_type,
    impact_candidate_count: registry.impact_candidate_count,
    mint_allowed_count: registry.mint_allowed_count,
  });
}

function indexSummary(index) {
  return freezeDeep({
    mode: index.mode,
    root_hash: index.root.normalized_path_hash,
    records_count: index.summary.records_count,
    files_count: index.summary.files_count,
    dirs_count: index.summary.dirs_count,
    symlinks_count: index.summary.symlinks_count,
    denied_count: index.summary.denied_count,
    total_indexed_bytes: index.summary.total_indexed_bytes,
    weak_duplicate_candidate_group_count: countGroups(
      index.duplicate_candidate_groups,
      "size_collision_weak",
    ),
    strong_duplicate_candidate_group_count: countGroups(
      index.duplicate_candidate_groups,
      "content_hash_match",
    ),
    content_hash_performed: index.boundary?.content_hash_performed === true,
    file_content_read: index.boundary?.file_content_read === true,
  });
}

function operatorTopology(registry) {
  const context = registry.operator_context || {};
  return freezeDeep({
    human_nodes: context.human_nodes ?? 1,
    machine_nodes: context.machine_nodes ?? 1,
    dema_role: context.dema_role ?? "local_product_face",
    pat_scope: "LOCAL_ONLY",
    sat_visibility: "METADATA_ONLY_AFTER_APPLY",
  });
}

export function buildNode0LocalClosureReadinessPayload(input) {
  const registry = input?.registry;
  const index = input?.index;
  const contentHashReady = index?.mode === "content_hash_index";
  const body = {
    schema: NODE0_LOCAL_CLOSURE_READINESS_SCHEMA,
    truth_label: NODE0_LOCAL_CLOSURE_READINESS_TRUTH_LABEL,
    readiness_status: contentHashReady ? "READY_FOR_DEDUP_PLAN" : "READY_FOR_HASH_CONSENT",
    operator_topology: operatorTopology(registry),
    sources: sourceSummary(registry),
    index: indexSummary(index),
    pipeline: buildPipeline(index),
    impact_queue: buildImpactQueue(registry),
    next_action: buildNextAction(index),
    remaining_gates: [
      "hash_consent_required_before_strong_dedup",
      "dedup_plan_required_before_reorg_plan",
      "exact_plan_consent_required_before_apply",
      "sat_metadata_summary_only_after_apply",
      "poi_verification_required_before_any_mint",
      "external_legal_audit_required_before_live_token",
    ],
    mint: {
      live_mint_allowed: false,
      preview_mint_allowed: false,
      bzc_preview: 0,
      bzi_preview: 0,
      reason: "POI_NOT_VERIFIED",
    },
    boundary: node0LocalClosureReadinessBoundary(),
  };
  const content_hash = `sha256:${sha256(stableStringify(body))}`;
  return freezeDeep({ ...body, content_hash });
}

function validatePayloadPolicy(payload) {
  const blocked = [];
  if (payload.schema !== NODE0_LOCAL_CLOSURE_READINESS_SCHEMA) {
    blocked.push("schema_mismatch");
  }
  if (payload.truth_label !== NODE0_LOCAL_CLOSURE_READINESS_TRUTH_LABEL) {
    blocked.push("truth_label_mismatch");
  }
  if (!["READY_FOR_HASH_CONSENT", "READY_FOR_DEDUP_PLAN"].includes(payload.readiness_status)) {
    blocked.push("readiness_status_invalid");
  }
  if (payload.operator_topology?.human_nodes !== 1) blocked.push("human_nodes_not_one");
  if (payload.operator_topology?.machine_nodes !== 1) blocked.push("machine_nodes_not_one");
  if (payload.operator_topology?.pat_scope !== "LOCAL_ONLY") blocked.push("pat_scope_not_local");
  if (payload.operator_topology?.sat_visibility !== "METADATA_ONLY_AFTER_APPLY") {
    blocked.push("sat_visibility_not_metadata_after_apply");
  }
  if (payload.sources?.mint_allowed_count !== 0) blocked.push("source_mint_allowed_not_zero");
  if (payload.mint?.live_mint_allowed !== false) blocked.push("live_mint_not_false");
  if (payload.mint?.preview_mint_allowed !== false) blocked.push("preview_mint_not_false");
  if (payload.mint?.bzc_preview !== 0) blocked.push("bzc_preview_not_zero");
  if (payload.mint?.bzi_preview !== 0) blocked.push("bzi_preview_not_zero");
  if (payload.mint?.reason !== "POI_NOT_VERIFIED") blocked.push("mint_reason_invalid");

  for (const [key, value] of Object.entries(payload.boundary || {})) {
    if (value !== false) blocked.push(`boundary_not_false:${key}`);
  }
  if (!Array.isArray(payload.pipeline)) {
    blocked.push("pipeline_missing");
  } else {
    const ids = payload.pipeline.map((stage) => stage.id);
    if (PIPELINE_IDS.some((id, index) => ids[index] !== id)) {
      blocked.push("pipeline_order_invalid");
    }
    const mint = payload.pipeline.find((stage) => stage.id === "mint");
    if (mint?.status !== "BLOCKED_NO_LIVE_MINT") blocked.push("mint_stage_not_blocked");
  }
  if (!Array.isArray(payload.impact_queue)) {
    blocked.push("impact_queue_missing");
  } else {
    for (const entry of payload.impact_queue) {
      if (entry.source_type === "economy_simulation") {
        blocked.push(`simulation_in_impact_queue:${entry.source_id}`);
      }
      if (entry.impact_verified !== false) {
        blocked.push(`impact_verified_not_false:${entry.source_id}`);
      }
      if (entry.mint_allowed !== false) {
        blocked.push(`impact_queue_mint_not_false:${entry.source_id}`);
      }
    }
  }
  if (payload.readiness_status === "READY_FOR_HASH_CONSENT") {
    if (payload.next_action?.kind !== "CONTENT_HASH_CONSENT") {
      blocked.push("next_action_not_hash_consent");
    }
    if (!String(payload.next_action?.exact_phrase || "").startsWith("I CONSENT: HASH NODE0 SPACE sha256:")) {
      blocked.push("next_hash_consent_phrase_missing");
    }
  }
  return blocked;
}

export function verifyNode0LocalClosureReadiness(payload) {
  const blocked_by = [];
  if (!isPlainObject(payload)) {
    return freezeDeep({
      ok: false,
      schema: NODE0_LOCAL_CLOSURE_READINESS_SCHEMA,
      truth_label: NODE0_LOCAL_CLOSURE_READINESS_TRUTH_LABEL,
      content_hash: null,
      blocked_by: ["payload_not_object"],
    });
  }
  const { content_hash, ...body } = payload;
  const expectedHash = `sha256:${sha256(stableStringify(body))}`;
  if (!/^sha256:[0-9a-f]{64}$/.test(content_hash || "")) {
    blocked_by.push("content_hash_invalid");
  }
  if (content_hash !== expectedHash) blocked_by.push("content_hash_mismatch");
  blocked_by.push(...validatePayloadPolicy(payload));
  return freezeDeep({
    ok: blocked_by.length === 0,
    schema: NODE0_LOCAL_CLOSURE_READINESS_SCHEMA,
    truth_label: NODE0_LOCAL_CLOSURE_READINESS_TRUTH_LABEL,
    content_hash: content_hash ?? null,
    blocked_by,
  });
}

export function runNode0LocalClosureReadiness({ consent, input } = {}) {
  const boundary = node0LocalClosureReadinessBoundary();
  const plan = planNode0LocalClosureReadiness({ consent, input });
  if (!plan.eligible) {
    return freezeDeep({
      ok: false,
      schema: NODE0_LOCAL_CLOSURE_READINESS_SCHEMA,
      truth_label: NODE0_LOCAL_CLOSURE_READINESS_TRUTH_LABEL,
      content_hash: null,
      boundary,
      blocked_by: plan.blocked_by,
    });
  }

  const payload = buildNode0LocalClosureReadinessPayload(input);
  const verified = verifyNode0LocalClosureReadiness(payload);
  const tampered = verifyNode0LocalClosureReadiness({
    ...payload,
    content_hash: `sha256:${"0".repeat(64)}`,
  });
  const blocked_by = [...verified.blocked_by];
  if (tampered.ok === true) blocked_by.push("tamper_reject_failed");

  return freezeDeep({
    ok: blocked_by.length === 0,
    schema: NODE0_LOCAL_CLOSURE_READINESS_SCHEMA,
    truth_label: NODE0_LOCAL_CLOSURE_READINESS_TRUTH_LABEL,
    content_hash: payload.content_hash,
    readiness_status: payload.readiness_status,
    next_action: payload.next_action,
    sources: payload.sources,
    index: payload.index,
    pipeline: payload.pipeline,
    impact_queue: payload.impact_queue,
    mint: payload.mint,
    boundary: payload.boundary,
    tamper_reject_ok: tampered.ok === false,
    blocked_by,
    payload,
  });
}
