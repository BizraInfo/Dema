// NODE0-EVIDENCE-SOURCE-REGISTRY-1A
//
// Pure local source registry for Node0 evidence surfaces. It registers where
// evidence may come from before any indexing, dedup, impact review, or mint
// decision. This kernel does not read source contents, download connector data,
// mutate GitHub/Drive, scrape the web, start runtime, or mint tokens.

import { createHash } from "node:crypto";

export const NODE0_EVIDENCE_SOURCE_REGISTRY_SCHEMA =
  "bizra.dema.node0_evidence_source_registry.v0.1";
export const NODE0_EVIDENCE_SOURCE_REGISTRY_TRUTH_LABEL =
  "NODE0_EVIDENCE_SOURCE_REGISTRY_MEASURED_REPO";
export const NODE0_EVIDENCE_SOURCE_REGISTRY_GO_PHRASE =
  "GO: register Node0 evidence source registry locally";

export const NODE0_EVIDENCE_SOURCE_TYPES = Object.freeze([
  "local_path",
  "github_repo",
  "google_drive",
  "claude_export",
  "public_domain",
  "proof_receipt",
  "design_asset",
  "economy_simulation",
]);

const PRIVACY_LEVELS = Object.freeze([
  "private_local",
  "private_connector",
  "operator_export",
  "public",
  "repo_local",
]);

const TRUTH_LABELS = Object.freeze([
  "SOURCE_REGISTERED_NOT_INGESTED",
  "SOURCE_VERIFIED_PUBLIC_SURFACE",
  "SOURCE_VERIFIED_LOCAL_REPO",
  "OWNER_PROVIDED_NOT_VERIFIED",
  "ECONOMY_SIMULATION_ONLY",
  "DESIGN_ASSET_REGISTERED",
  "PROOF_RECEIPT_REGISTERED",
]);

const DEDUP_POLICIES = Object.freeze([
  "hash_detect_only_no_delete",
  "metadata_match_only",
  "canonical_url_or_remote_match",
  "receipt_hash_match",
]);

const PROMOTION_GATES = Object.freeze([
  "node0_index_required",
  "receipt_required_before_impact_queue",
  "external_review_required_before_public_claim",
  "poi_required_before_mint",
  "simulation_never_mints",
  "manual_review_required",
]);

const REQUIRED_FIELDS = Object.freeze([
  "source_id",
  "source_type",
  "location_label",
  "verification_method",
  "truth_label",
  "privacy_level",
  "dedup_policy",
  "promotion_gate",
  "impact_candidate",
  "mint_allowed",
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
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function countBy(items, key) {
  return Object.fromEntries(
    [...items.reduce((acc, item) => {
      const value = item[key];
      acc.set(value, (acc.get(value) ?? 0) + 1);
      return acc;
    }, new Map())].sort(([a], [b]) => String(a).localeCompare(String(b))),
  );
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeSource(source) {
  return {
    source_id: String(source.source_id),
    source_type: String(source.source_type),
    location_label: String(source.location_label),
    verification_method: String(source.verification_method),
    truth_label: String(source.truth_label),
    privacy_level: String(source.privacy_level),
    dedup_policy: String(source.dedup_policy),
    promotion_gate: String(source.promotion_gate),
    impact_candidate: source.impact_candidate === true,
    mint_allowed: source.mint_allowed === true,
  };
}

function normalizeSources(sources) {
  return sources.map(normalizeSource).sort((a, b) => a.source_id.localeCompare(b.source_id));
}

function registryPolicy() {
  return freezeDeep({
    no_content_read: true,
    no_drive_download: true,
    no_github_write: true,
    no_web_scrape_in_runtime: true,
    no_delete_or_reorg: true,
    no_impact_claim_from_registration: true,
    no_live_mint: true,
    simulation_is_not_impact: true,
  });
}

// All-false execution boundary. Registration is a pure classification surface.
export function node0EvidenceSourceRegistryBoundary() {
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

export function defaultNode0EvidenceSourceRegistryInput() {
  return freezeDeep({
    registry_id: "node0_home_base_sources",
    operator_context: {
      human_nodes: 1,
      machine_nodes: 1,
      dema_role: "local_product_face",
      pat_sat_alignment: "PAT_LOCAL_SAT_METADATA_ONLY",
    },
    sources: [
      {
        source_id: "local_node0_assets",
        source_type: "local_path",
        location_label: "Node0 local messy data and assets",
        verification_method: "metadata_index_envelope",
        truth_label: "SOURCE_REGISTERED_NOT_INGESTED",
        privacy_level: "private_local",
        dedup_policy: "hash_detect_only_no_delete",
        promotion_gate: "node0_index_required",
        impact_candidate: true,
        mint_allowed: false,
      },
      {
        source_id: "github_dema_repo",
        source_type: "github_repo",
        location_label: "BizraInfo/Dema",
        verification_method: "git_remote_or_public_repo_check",
        truth_label: "SOURCE_VERIFIED_LOCAL_REPO",
        privacy_level: "public",
        dedup_policy: "canonical_url_or_remote_match",
        promotion_gate: "receipt_required_before_impact_queue",
        impact_candidate: true,
        mint_allowed: false,
      },
      {
        source_id: "google_drive_workspace",
        source_type: "google_drive",
        location_label: "Connected Google Drive BIZRA workspace",
        verification_method: "drive_connector_metadata_only",
        truth_label: "OWNER_PROVIDED_NOT_VERIFIED",
        privacy_level: "private_connector",
        dedup_policy: "metadata_match_only",
        promotion_gate: "manual_review_required",
        impact_candidate: true,
        mint_allowed: false,
      },
      {
        source_id: "claude_desktop_exports",
        source_type: "claude_export",
        location_label: "Claude Desktop conversation and artifact exports",
        verification_method: "operator_export_metadata",
        truth_label: "OWNER_PROVIDED_NOT_VERIFIED",
        privacy_level: "operator_export",
        dedup_policy: "hash_detect_only_no_delete",
        promotion_gate: "manual_review_required",
        impact_candidate: true,
        mint_allowed: false,
      },
      {
        source_id: "bizra_ai_public_domain",
        source_type: "public_domain",
        location_label: "https://bizra.ai",
        verification_method: "web_public_page_check",
        truth_label: "SOURCE_VERIFIED_PUBLIC_SURFACE",
        privacy_level: "public",
        dedup_policy: "canonical_url_or_remote_match",
        promotion_gate: "external_review_required_before_public_claim",
        impact_candidate: false,
        mint_allowed: false,
      },
      {
        source_id: "proof_receipt_chain",
        source_type: "proof_receipt",
        location_label: "Local Dema proof and receipt artifacts",
        verification_method: "receipt_hash_verify",
        truth_label: "PROOF_RECEIPT_REGISTERED",
        privacy_level: "private_local",
        dedup_policy: "receipt_hash_match",
        promotion_gate: "receipt_required_before_impact_queue",
        impact_candidate: true,
        mint_allowed: false,
      },
      {
        source_id: "award_design_assets",
        source_type: "design_asset",
        location_label: "BIZRA design system, cockpit, website, and visual assets",
        verification_method: "local_design_artifact_metadata",
        truth_label: "DESIGN_ASSET_REGISTERED",
        privacy_level: "private_local",
        dedup_policy: "hash_detect_only_no_delete",
        promotion_gate: "manual_review_required",
        impact_candidate: true,
        mint_allowed: false,
      },
      {
        source_id: "economy_simulator",
        source_type: "economy_simulation",
        location_label: "BIZRA economy simulator reports",
        verification_method: "simulation_report_label_check",
        truth_label: "ECONOMY_SIMULATION_ONLY",
        privacy_level: "private_local",
        dedup_policy: "hash_detect_only_no_delete",
        promotion_gate: "simulation_never_mints",
        impact_candidate: false,
        mint_allowed: false,
      },
    ],
  });
}

function validateSource(source, seenIds, seenLocations) {
  const blocked = [];
  if (!isPlainObject(source)) return ["source_not_object"];

  for (const field of REQUIRED_FIELDS) {
    if (!(field in source)) blocked.push(`missing_${field}:${source.source_id ?? "unknown"}`);
  }
  if (blocked.length > 0) return blocked;

  const id = source.source_id;
  if (typeof id !== "string" || !/^[a-z0-9][a-z0-9_-]{2,80}$/.test(id)) {
    blocked.push(`invalid_source_id:${String(id)}`);
  }
  if (seenIds.has(id)) blocked.push(`duplicate_source_id:${id}`);
  seenIds.add(id);

  if (!NODE0_EVIDENCE_SOURCE_TYPES.includes(source.source_type)) {
    blocked.push(`unsupported_source_type:${id}`);
  }
  if (!PRIVACY_LEVELS.includes(source.privacy_level)) {
    blocked.push(`unsupported_privacy_level:${id}`);
  }
  if (!TRUTH_LABELS.includes(source.truth_label)) {
    blocked.push(`unsupported_truth_label:${id}`);
  }
  if (!DEDUP_POLICIES.includes(source.dedup_policy)) {
    blocked.push(`unsupported_dedup_policy:${id}`);
  }
  if (!PROMOTION_GATES.includes(source.promotion_gate)) {
    blocked.push(`unsupported_promotion_gate:${id}`);
  }
  if (typeof source.location_label !== "string" || source.location_label.trim() === "") {
    blocked.push(`location_label_missing:${id}`);
  }
  if (
    typeof source.verification_method !== "string" ||
    source.verification_method.trim() === ""
  ) {
    blocked.push(`verification_method_missing:${id}`);
  }
  if (source.mint_allowed !== false) {
    blocked.push(`mint_allowed_not_false:${id}`);
  }
  if (source.source_type === "economy_simulation" && source.impact_candidate !== false) {
    blocked.push(`simulation_source_cannot_enter_impact_queue:${id}`);
  }
  if (source.source_type === "economy_simulation" && source.truth_label !== "ECONOMY_SIMULATION_ONLY") {
    blocked.push(`simulation_truth_label_required:${id}`);
  }
  if (source.source_type === "public_domain" && source.privacy_level !== "public") {
    blocked.push(`public_domain_must_be_public:${id}`);
  }

  const locationKey = `${source.source_type}:${source.location_label}`;
  if (seenLocations.has(locationKey)) blocked.push(`duplicate_source_location:${id}`);
  seenLocations.add(locationKey);

  return blocked;
}

function validateRegistryInput(input) {
  const blocked = [];
  if (!isPlainObject(input)) return ["input_not_object"];
  if (typeof input.registry_id !== "string" || input.registry_id.trim() === "") {
    blocked.push("registry_id_missing");
  }
  if (!Array.isArray(input.sources) || input.sources.length === 0) {
    blocked.push("sources_missing");
    return blocked;
  }

  const seenIds = new Set();
  const seenLocations = new Set();
  for (const source of input.sources) {
    blocked.push(...validateSource(source, seenIds, seenLocations));
  }

  return blocked;
}

function validatePayload(payload) {
  const blocked = [];
  if (!isPlainObject(payload)) return ["payload_not_object"];
  if (payload.schema !== NODE0_EVIDENCE_SOURCE_REGISTRY_SCHEMA) {
    blocked.push("schema_mismatch");
  }
  if (payload.truth_label !== NODE0_EVIDENCE_SOURCE_REGISTRY_TRUTH_LABEL) {
    blocked.push("truth_label_mismatch");
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(payload.content_hash ?? "")) {
    blocked.push("content_hash_invalid");
  }
  if (!Array.isArray(payload.sources)) {
    blocked.push("sources_missing");
  } else {
    blocked.push(
      ...validateRegistryInput({
        registry_id: payload.registry_id,
        sources: payload.sources,
      }),
    );
  }
  for (const [key, value] of Object.entries(payload.boundary ?? {})) {
    if (value !== false) blocked.push(`boundary_not_false:${key}`);
  }
  if (payload.mint_allowed_count !== 0) blocked.push("mint_allowed_count_not_zero");
  if (payload.policy?.no_content_read !== true) blocked.push("policy_no_content_read_missing");
  if (payload.policy?.no_live_mint !== true) blocked.push("policy_no_live_mint_missing");
  return blocked;
}

export function planNode0EvidenceSourceRegistry({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== NODE0_EVIDENCE_SOURCE_REGISTRY_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  blocked_by.push(...validateRegistryInput(input));
  const sourceTypesSeen = Array.isArray(input?.sources)
    ? [...new Set(input.sources.map((source) => source.source_type).filter(Boolean))]
    : [];

  return freezeDeep({
    schema: NODE0_EVIDENCE_SOURCE_REGISTRY_SCHEMA,
    truth_label: NODE0_EVIDENCE_SOURCE_REGISTRY_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by,
    source_types_seen: sourceTypesSeen,
  });
}

export function buildNode0EvidenceSourceRegistryPayload(input) {
  const sources = normalizeSources(input?.sources ?? []);
  const body = {
    schema: NODE0_EVIDENCE_SOURCE_REGISTRY_SCHEMA,
    truth_label: NODE0_EVIDENCE_SOURCE_REGISTRY_TRUTH_LABEL,
    registry_id: input?.registry_id ?? null,
    operator_context: input?.operator_context ?? null,
    source_count: sources.length,
    source_types: NODE0_EVIDENCE_SOURCE_TYPES,
    counts_by_type: countBy(sources, "source_type"),
    counts_by_privacy: countBy(sources, "privacy_level"),
    impact_candidate_count: sources.filter((source) => source.impact_candidate).length,
    mint_allowed_count: sources.filter((source) => source.mint_allowed).length,
    sources,
    policy: registryPolicy(),
    boundary: node0EvidenceSourceRegistryBoundary(),
  };
  const content_hash = `sha256:${sha256(stableStringify(body))}`;
  return freezeDeep({ ...body, content_hash });
}

export function verifyNode0EvidenceSourceRegistry(payload) {
  const blocked_by = validatePayload(payload);
  if (isPlainObject(payload)) {
    const { content_hash, ...body } = payload;
    const expectedHash = `sha256:${sha256(stableStringify(body))}`;
    if (content_hash !== expectedHash) blocked_by.push("content_hash_mismatch");
  }
  return freezeDeep({
    ok: blocked_by.length === 0,
    schema: NODE0_EVIDENCE_SOURCE_REGISTRY_SCHEMA,
    truth_label: NODE0_EVIDENCE_SOURCE_REGISTRY_TRUTH_LABEL,
    content_hash: payload?.content_hash ?? null,
    blocked_by,
  });
}

export function runNode0EvidenceSourceRegistry({ consent, input } = {}) {
  const boundary = node0EvidenceSourceRegistryBoundary();
  const plan = planNode0EvidenceSourceRegistry({ consent, input });
  if (!plan.eligible) {
    return freezeDeep({
      ok: false,
      schema: NODE0_EVIDENCE_SOURCE_REGISTRY_SCHEMA,
      truth_label: NODE0_EVIDENCE_SOURCE_REGISTRY_TRUTH_LABEL,
      content_hash: null,
      boundary,
      blocked_by: plan.blocked_by,
    });
  }

  const payload = buildNode0EvidenceSourceRegistryPayload(input);
  const verified = verifyNode0EvidenceSourceRegistry(payload);
  const tampered = verifyNode0EvidenceSourceRegistry({
    ...payload,
    content_hash: `sha256:${"0".repeat(64)}`,
  });
  const blocked_by = [...verified.blocked_by];
  if (tampered.ok === true) blocked_by.push("tamper_reject_failed");

  return freezeDeep({
    ok: blocked_by.length === 0,
    schema: NODE0_EVIDENCE_SOURCE_REGISTRY_SCHEMA,
    truth_label: NODE0_EVIDENCE_SOURCE_REGISTRY_TRUTH_LABEL,
    content_hash: payload.content_hash,
    registry_id: payload.registry_id,
    source_count: payload.source_count,
    counts_by_type: payload.counts_by_type,
    impact_candidate_count: payload.impact_candidate_count,
    mint_allowed_count: payload.mint_allowed_count,
    policy: payload.policy,
    boundary: payload.boundary,
    tamper_reject_ok: tampered.ok === false,
    blocked_by,
    payload,
  });
}
