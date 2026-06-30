import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import {
  HEALTH_MISSION_CONSENT_PHRASE,
  HEALTH_MISSION_RECEIPT_SCHEMA,
} from "./health-snapshot.js";

const SCHEMA = "bizra.dema.mission_manifest.v0.1";

const SUPPORTED_TYPES = ["health_snapshot"];

export function buildMissionManifest(missionType, { now = new Date() } = {}) {
  const type = missionType || "health_snapshot";

  if (!SUPPORTED_TYPES.includes(type)) {
    return {
      error: `Unknown mission type: '${type}'. Supported: ${SUPPORTED_TYPES.join(", ")}.`,
    };
  }

  const manifest = {
    schema: SCHEMA,
    generated_at: now.toISOString(),
    mission_type: type,
    mode: "PRE_EXECUTION_DECLARATION",
    manifest_generation_boundary: {
      truth_label: "LOCAL_STATIC_DECLARATION",
      filesystem_write_performed: false,
      network_used: false,
      model_invocation_performed: false,
      receipt_mint_performed: false,
    },
    consent_boundary: {
      truth_label: "LOCAL_STATIC_DECLARATION",
      required_phrase: HEALTH_MISSION_CONSENT_PHRASE,
      required_phrase_hash: sha256(HEALTH_MISSION_CONSENT_PHRASE),
      exact_string_only: true,
      consent_required: true,
      expected_consent_collected_at_execution: true,
    },
    expected_mission_boundary: {
      truth_label: "LOCAL_STATIC_DECLARATION",
      filesystem_write_performed: true,
      network_used: false,
      runtime_execution_performed: false,
      model_loaded: false,
      model_invocation_performed: false,
      prompt_executed: false,
      external_call_performed: false,
      raw_corpus_scan_performed: false,
      raw_data_included: false,
      tool_executed: false,
      chain_advance_performed: false,
      receipt_mint_performed: false,
      federation_invoked: false,
      node_connection_performed: false,
      public_network_used: false,
      consent_required: true,
      expected_consent_collected_at_execution: true,
      content_read: false,
    },
    proof_boundary: {
      truth_label: "LOCAL_STATIC_DECLARATION",
      receipt_schema: HEALTH_MISSION_RECEIPT_SCHEMA,
      content_hash_algorithm: "sha256",
      content_hash_input: "stableStringify(attests)",
      tamper_detectable: true,
      verifier_available: true,
      behavioral_probe_available: true,
    },
    resource_boundary: {
      truth_label: "LOCAL_STATIC_DECLARATION",
      resource_truth_label: "LOCAL_STATIC_ESTIMATE",
      estimated_wall_time_class: "low",
      static_wall_time_budget_ms: 5000,
      expected_filesystem_read_classes: [
        "setup_state",
        "harness_state",
        "doctor_predicates",
        "witness_state",
        "memory_summary",
      ],
      expected_filesystem_write_classes: ["mission_receipt"],
      network_endpoints: [],
      model_invocations: [],
      memory_estimate_class: "trivial",
    },
  };

  manifest.manifest_hash = sha256(stableStringify(manifest));

  return manifest;
}

export function formatMissionManifest(manifest) {
  if (manifest.error) return manifest.error;

  const cb = manifest.consent_boundary;
  const mb = manifest.expected_mission_boundary;
  const pb = manifest.proof_boundary;
  const rb = manifest.resource_boundary;

  const mbKeys = Object.keys(mb).filter(
    (k) =>
      k !== "truth_label" &&
      k !== "consent_required" &&
      k !== "expected_consent_collected_at_execution",
  );
  const willDo = mbKeys.filter((k) => mb[k] === true);
  const willNotCount = mbKeys.filter((k) => mb[k] === false).length;

  const lines = [
    "Resource-Aware Mission Manifest v0.1",
    "=".repeat(42),
    `  Mission Type:     ${manifest.mission_type}`,
    `  Mode:             ${manifest.mode}`,
    "",
    "  Manifest Generation:",
    "    This command: read-only, no network, no model, no write",
    "",
    "  Consent:",
    `    Required phrase: ${cb.required_phrase}`,
    `    Exact string only: ${cb.exact_string_only ? "yes" : "no"}`,
    "    Consent required: yes (collected at execution time)",
    "",
    `  Expected Mission Boundary (${mbKeys.length} keys):`,
    `    Will do:         ${willDo.map((k) => k.replace(/_performed$/, "")).join(", ")}`,
    `    Will NOT:        ${willNotCount} others`,
    "",
    "  Proof:",
    `    Receipt schema:  ${pb.receipt_schema}`,
    `    Hash:            ${pb.content_hash_algorithm}(${pb.content_hash_input})`,
    `    Verifier:        ${pb.verifier_available ? "available" : "not available"}`,
    `    Probe:           ${pb.behavioral_probe_available ? "available" : "not available"}`,
    "",
    "  Resources (estimated):",
    `    Wall time:       ${rb.estimated_wall_time_class} (budget: ${rb.static_wall_time_budget_ms}ms)`,
    `    Reads:           ${rb.expected_filesystem_read_classes.join(", ")}`,
    `    Writes:          ${rb.expected_filesystem_write_classes.join(", ")}`,
    `    Network:         ${rb.network_endpoints.length === 0 ? "none" : rb.network_endpoints.join(", ")}`,
    `    Models:          ${rb.model_invocations.length === 0 ? "none" : rb.model_invocations.join(", ")}`,
    "",
    `  Manifest Hash:     ${manifest.manifest_hash.slice(0, 16)}...`,
    "=".repeat(42),
  ];

  return lines.join("\n");
}
