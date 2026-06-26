// OPERATOR-BRIDGE-THREAT-MODEL-1A — pure validator for high-trust operator bridge env vars.

export const OPERATOR_BRIDGE_THREAT_MODEL_SCHEMA =
  "bizra.dema.operator_bridge_threat_model.v0.1";
export const OPERATOR_BRIDGE_THREAT_MODEL_TRUTH_LABEL =
  "OPERATOR_BRIDGE_THREAT_MODEL_DOCS_ONLY";

export const OPERATOR_BRIDGE_ADR_REL_PATH =
  "docs/06-adr/ADR-042-operator-bridge-threat-model.md";

/** High-trust bridge env vars that must appear in ADR-042. */
export const OPERATOR_BRIDGE_ENV_REGISTRY = Object.freeze([
  Object.freeze({
    name: "DEMA_NODE0_STATUS_COMMAND",
    bridge_class: "node0_legacy_shellout",
    trust_level: "high",
    summary:
      "Operator-set shell-out command; execFile (shell:false) returns untrusted JSON normalized by node0-adapter.",
  }),
  Object.freeze({
    name: "DEMA_NODE0_ADAPTER",
    bridge_class: "node0_adapter_dispatch",
    trust_level: "high",
    summary:
      "Selects gateway-http vs legacy shellout; mis-set values can route status reads through unintended backends.",
  }),
  Object.freeze({
    name: "DEMA_GATEWAY_URL",
    bridge_class: "node0_gateway_http",
    trust_level: "high",
    summary:
      "Localhost-only HTTP surface to bizra-cognition-gateway GET endpoints; non-localhost refused.",
  }),
  Object.freeze({
    name: "DEMA_OLLAMA_URL",
    bridge_class: "localhost_llm_probe",
    trust_level: "medium",
    summary:
      "Localhost Ollama probe/invoke URL; model invocation requires separate exact-consent gates.",
  }),
  Object.freeze({
    name: "DEMA_LM_STUDIO_URL",
    bridge_class: "localhost_llm_probe",
    trust_level: "medium",
    summary:
      "Localhost LM Studio probe/invoke URL; default talk-loop provider route.",
  }),
  Object.freeze({
    name: "DEMA_LLAMACPP_URL",
    bridge_class: "localhost_llm_probe",
    trust_level: "medium",
    summary:
      "Localhost llama.cpp server probe/invoke URL; fallback provider route.",
  }),
  Object.freeze({
    name: "DEMA_AGENT_DB_QUERY_PATH",
    bridge_class: "local_memory_query_wrapper",
    trust_level: "medium",
    summary:
      "Operator-side path override for memory query wrapper; subprocess bridge with read-only consent envelope.",
  }),
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

/**
 * @param {object} params
 * @param {string} [params.adrText]
 * @param {boolean} [params.adrExists]
 */
export function buildOperatorBridgeThreatModelReport({
  adrText = "",
  adrExists = false,
} = {}) {
  const findings = [];
  const undocumented_env_vars = [];

  if (!adrExists) {
    findings.push(
      Object.freeze({
        code: "adr_missing",
        message: `ADR not found at ${OPERATOR_BRIDGE_ADR_REL_PATH}`,
      }),
    );
  }

  for (const entry of OPERATOR_BRIDGE_ENV_REGISTRY) {
    if (!adrText.includes(entry.name)) {
      undocumented_env_vars.push(entry.name);
      findings.push(
        Object.freeze({
          code: "bridge_env_undocumented",
          env_var: entry.name,
          message: `${entry.name} must be documented in ${OPERATOR_BRIDGE_ADR_REL_PATH}`,
        }),
      );
    }
  }

  const required_anchors = [
    "DEMA_NODE0_STATUS_COMMAND",
    "localhost",
    "ADR-003",
    "ADR-005",
    "read-only",
  ];
  for (const anchor of required_anchors) {
    if (adrExists && !adrText.includes(anchor)) {
      findings.push(
        Object.freeze({
          code: "adr_anchor_missing",
          anchor,
          message: `ADR must reference "${anchor}"`,
        }),
      );
    }
  }

  const ok =
    adrExists &&
    undocumented_env_vars.length === 0 &&
    findings.length === 0;

  return deepFreeze({
    schema: OPERATOR_BRIDGE_THREAT_MODEL_SCHEMA,
    truth_label: OPERATOR_BRIDGE_THREAT_MODEL_TRUTH_LABEL,
    ok,
    adr_path: OPERATOR_BRIDGE_ADR_REL_PATH,
    bridge_env_count: OPERATOR_BRIDGE_ENV_REGISTRY.length,
    high_trust_count: OPERATOR_BRIDGE_ENV_REGISTRY.filter(
      (e) => e.trust_level === "high",
    ).length,
    undocumented_env_vars: Object.freeze([...undocumented_env_vars]),
    findings: Object.freeze(findings),
  });
}

export function verifyOperatorBridgeThreatModelReport(report) {
  const ok =
    report?.schema === OPERATOR_BRIDGE_THREAT_MODEL_SCHEMA &&
    report?.ok === true &&
    Array.isArray(report.findings) &&
    report.findings.length === 0;
  return Object.freeze({ ok, schema: OPERATOR_BRIDGE_THREAT_MODEL_SCHEMA });
}
