// URP shared runtime — discovery-only v0.1 per HOUSE_OF_WISDOM_UKE_URP_CANON_v0_1.md §8.
//
// Defines the local shared-state manifest shape and SAT-governed write boundary.
// No filesystem writes · no network · no UKE auto-ingest · no PAT private export.

import { buildPreviewBoundary } from "./preview-boundary.js";

const VERIFICATION_PIPELINE_SCHEMA =
  "bizra.dema.orchestrator_verification_pipeline.v0.1";

export const URP_SHARED_RUNTIME_DISCOVERY_SCHEMA =
  "bizra.dema.urp_shared_runtime_discovery.v0.1";
export const URP_SHARED_STATE_MANIFEST_SCHEMA =
  "bizra.dema.urp_shared_state_manifest.v0.1";
export const URP_SHARED_WRITE_BOUNDARY_SCHEMA =
  "bizra.dema.urp_shared_write_boundary.v0.1";

export const URP_SHARED_MANIFEST_RELATIVE_PATH =
  "urp/shared-state-manifest.json";

export const URP_SHAREABLE_CONSENT_PREFIX = "GO: share ";

export const FORBIDDEN_WRITE_KINDS = Object.freeze([
  "uke_auto_ingest",
  "pat_private_memory_export",
  "network_publish",
  "federation_activate",
  "chain_bound_mint",
  "token_economy_emit",
  "runtime_start",
]);

export const ALLOWED_WRITE_KINDS_DISCOVERY = Object.freeze([
  "manifest_append_entry",
  "manifest_replace_entry",
]);

const URP_DISCOVERY_FLAGS = Object.freeze({
  uke_auto_ingest_performed: false,
  pat_private_memory_exported: false,
  shared_urp_network_publish_performed: false,
  federation_activation_performed: false,
  chain_bound_mint_performed: false,
  token_economy_claim_emitted: false,
});

const DISCOVERY_BOUNDARY = buildPreviewBoundary();

function safeString(value) {
  return typeof value === "string" ? value : "";
}

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function buildUrpSharedStateManifest({
  node_id = "node0",
  manifest_version = 1,
  entries = [],
} = {}) {
  const safeEntries = Array.isArray(entries)
    ? entries.filter((entry) => entry && typeof entry === "object")
    : [];

  return deepFreeze(
    clone({
      schema: URP_SHARED_STATE_MANIFEST_SCHEMA,
      mode: "DISCOVERY_ONLY",
      truth_label: "DECLARED",
      status: "local_manifest_template",
      node_id: safeString(node_id) || "node0",
      manifest_version:
        typeof manifest_version === "number" && manifest_version > 0
          ? manifest_version
          : 1,
      manifest_relative_path: URP_SHARED_MANIFEST_RELATIVE_PATH,
      entries: safeEntries,
      uke_cortex: Object.freeze({
        status: "not_connected",
        auto_ingest: false,
        promotion_ladder_active: false,
      }),
      tiers_supported: Object.freeze([
        "RAW_CLAIM",
        "LOCAL_CANDIDATE",
        "PAT_PROPOSED",
        "SAT_VERIFIED",
        "HOUSE_OF_WISDOM_ACCEPTED",
        "URP_SHAREABLE",
        "META_CANON",
      ]),
      boundary: DISCOVERY_BOUNDARY,
      urp_discovery_flags: URP_DISCOVERY_FLAGS,
      note: "Template manifest for URP shared runtime discovery. No live shared soil; SAT-governed writes are evaluated but not performed in v0.1.",
    }),
  );
}

function satPipelineAllowsWrite(sat_pipeline) {
  const pipeline = safeObject(sat_pipeline);
  if (!pipeline) return { ok: false, code: "missing_sat_pipeline" };
  if (pipeline.schema !== VERIFICATION_PIPELINE_SCHEMA) {
    return { ok: false, code: "invalid_sat_pipeline_schema" };
  }
  if (
    pipeline.overall_verdict !== "pipeline_verified" ||
    pipeline.passed !== true
  ) {
    return { ok: false, code: "sat_pipeline_not_verified" };
  }
  return { ok: true };
}

function consentAllowsUrpShare(consent_phrase, candidate_id) {
  const phrase = safeString(consent_phrase).trim();
  const id = safeString(candidate_id).trim();
  if (!phrase.startsWith(URP_SHAREABLE_CONSENT_PREFIX)) {
    return { ok: false, code: "consent_prefix_mismatch" };
  }
  if (id && !phrase.includes(id)) {
    return { ok: false, code: "consent_missing_candidate_id" };
  }
  return { ok: true };
}

export function evaluateUrpSharedWriteBoundary({
  write_kind = "",
  candidate = null,
  sat_pipeline = null,
  consent_phrase = "",
  discovery_only = true,
} = {}) {
  const kind = safeString(write_kind);
  const violations = [];

  if (FORBIDDEN_WRITE_KINDS.includes(kind)) {
    violations.push({ code: "forbidden_write_kind", detail: kind });
  }
  if (
    !ALLOWED_WRITE_KINDS_DISCOVERY.includes(kind) &&
    !FORBIDDEN_WRITE_KINDS.includes(kind)
  ) {
    violations.push({ code: "unknown_write_kind", detail: kind || "(empty)" });
  }

  const satCheck = satPipelineAllowsWrite(sat_pipeline);
  if (!satCheck.ok) violations.push({ code: satCheck.code });

  const candidateObj = safeObject(candidate);
  const candidateId = safeString(
    candidateObj?.candidate_id || candidateObj?.id,
  );
  const consentCheck = consentAllowsUrpShare(consent_phrase, candidateId);
  if (!consentCheck.ok) violations.push({ code: consentCheck.code });

  if (candidateObj?.contains_private_pat_memory === true) {
    violations.push({ code: "pat_private_memory_blocked" });
  }
  if (candidateObj?.tier !== "URP_SHAREABLE" && candidateObj?.tier != null) {
    violations.push({
      code: "tier_not_urp_shareable",
      detail: safeString(candidateObj.tier),
    });
  }

  if (discovery_only) {
    violations.push({ code: "discovery_only_no_persist" });
  }

  const allowed = violations.length === 0;

  return deepFreeze(
    clone({
      schema: URP_SHARED_WRITE_BOUNDARY_SCHEMA,
      mode: "DISCOVERY_ONLY",
      truth_label: allowed ? "DECLARED" : "BOUNDARY_REFUSAL",
      write_kind: kind,
      allowed,
      violations: Object.freeze(violations.map((v) => Object.freeze({ ...v }))),
      sat_pipeline_verdict: safeObject(sat_pipeline)?.overall_verdict ?? null,
      consent_phrase_required_shape: `${URP_SHAREABLE_CONSENT_PREFIX}<candidate-hash> into URP soil`,
      filesystem_write_performed: false,
      boundary: DISCOVERY_BOUNDARY,
      urp_discovery_flags: URP_DISCOVERY_FLAGS,
    }),
  );
}

export function buildUrpSharedRuntimeDiscovery({
  node_id = "node0",
  sat_pipeline = null,
} = {}) {
  const manifest = buildUrpSharedStateManifest({ node_id });
  const sampleCandidate = Object.freeze({
    candidate_id: "discovery-sample-001",
    tier: "URP_SHAREABLE",
    contains_private_pat_memory: false,
    summary: "discovery-only exemplar entry",
  });

  const writeEvaluation = evaluateUrpSharedWriteBoundary({
    write_kind: "manifest_append_entry",
    candidate: sampleCandidate,
    sat_pipeline,
    consent_phrase: `GO: share ${sampleCandidate.candidate_id} into URP soil`,
    discovery_only: true,
  });

  return deepFreeze(
    clone({
      schema: URP_SHARED_RUNTIME_DISCOVERY_SCHEMA,
      mode: "DISCOVERY_ONLY",
      truth_label: "DECLARED",
      status: "discovery_manifest_and_boundary_only",
      manifest,
      write_boundary_sample: writeEvaluation,
      unlock_sequence: Object.freeze([
        "HOUSE_OF_WISDOM_ACCEPTED on candidate",
        "anonymization + claim-register gates",
        "operator typed GO with sharing scope",
        "SAT pipeline_verified",
        "EvidenceChain share receipt (future)",
      ]),
      blocked_capabilities: Object.freeze([
        ...FORBIDDEN_WRITE_KINDS,
        "live_shared_urp_publish",
        "cross_node_sync",
      ]),
      boundary: DISCOVERY_BOUNDARY,
      urp_discovery_flags: URP_DISCOVERY_FLAGS,
      next_safe_action:
        "run SAT pipeline on a PAT-proposed artifact before any URP manifest persist slice",
    }),
  );
}
