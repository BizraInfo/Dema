// CONSENT-BRIDGE-PARITY-1A — crosswalk CLI consent matrix ↔ operator bridge registry.

import { CLI_CONSENT_MATRIX_ENTRIES } from "./cli-consent-matrix-entries.js";
import {
  OPERATOR_BRIDGE_ENV_REGISTRY,
  OPERATOR_BRIDGE_ADR_REL_PATH,
} from "./operator-bridge-threat-model.js";

export const CONSENT_BRIDGE_PARITY_SCHEMA =
  "bizra.dema.consent_bridge_parity.v0.1";
export const CONSENT_BRIDGE_PARITY_TRUTH_LABEL =
  "CONSENT_BRIDGE_PARITY_DOCS_ONLY";

/** Each bridge env var must appear in consent notes for at least one command. */
export const BRIDGE_ENV_COMMAND_AFFINITY = Object.freeze([
  Object.freeze({
    env_var: "DEMA_NODE0_STATUS_COMMAND",
    commands: Object.freeze(["status", "status:json"]),
  }),
  Object.freeze({
    env_var: "DEMA_NODE0_ADAPTER",
    commands: Object.freeze(["node0", "status"]),
  }),
  Object.freeze({
    env_var: "DEMA_GATEWAY_URL",
    commands: Object.freeze(["node0"]),
  }),
  Object.freeze({
    env_var: "DEMA_OLLAMA_URL",
    commands: Object.freeze(["talk", "llm-invoke"]),
  }),
  Object.freeze({
    env_var: "DEMA_LM_STUDIO_URL",
    commands: Object.freeze(["talk", "llm-invoke"]),
  }),
  Object.freeze({
    env_var: "DEMA_LLAMACPP_URL",
    commands: Object.freeze(["talk", "llm-invoke"]),
  }),
  Object.freeze({
    env_var: "DEMA_AGENT_DB_QUERY_PATH",
    commands: Object.freeze(["memory"]),
  }),
]);

const BRIDGE_ENV_NAMES = new Set(
  OPERATOR_BRIDGE_ENV_REGISTRY.map((entry) => entry.name),
);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function entryNotes(entry) {
  return `${entry.consent?.detail ?? ""} ${entry.consent?.mechanism ?? ""}`;
}

function mentionsBridgeSurface(text) {
  if (!text) return false;
  if (text.includes("ADR-042") || text.includes(OPERATOR_BRIDGE_ADR_REL_PATH)) {
    return true;
  }
  if (/operator bridge/i.test(text)) return true;
  for (const name of BRIDGE_ENV_NAMES) {
    if (text.includes(name)) return true;
  }
  return false;
}

export function buildConsentBridgeParityReport() {
  const findings = [];
  const byCommand = new Map(
    CLI_CONSENT_MATRIX_ENTRIES.map((entry) => [entry.command, entry]),
  );

  const external_runtime_commands = CLI_CONSENT_MATRIX_ENTRIES.filter((entry) =>
    entry.risk_levels.includes("external_runtime"),
  ).map((entry) => entry.command);

  for (const entry of CLI_CONSENT_MATRIX_ENTRIES) {
    if (!entry.risk_levels.includes("external_runtime")) continue;
    const notes = entryNotes(entry);
    if (!mentionsBridgeSurface(notes)) {
      findings.push(
        Object.freeze({
          code: "external_runtime_missing_bridge_reference",
          command: entry.command,
          message:
            "external_runtime commands must cite ADR-042, operator bridge, or a registered bridge env var",
        }),
      );
    }
    if (entry.consent?.mechanism !== "subcommand_gated") {
      findings.push(
        Object.freeze({
          code: "external_runtime_weak_consent",
          command: entry.command,
          message: "external_runtime commands must use subcommand_gated consent",
        }),
      );
    }
  }

  for (const affinity of BRIDGE_ENV_COMMAND_AFFINITY) {
    if (!BRIDGE_ENV_NAMES.has(affinity.env_var)) {
      findings.push(
        Object.freeze({
          code: "affinity_env_not_in_registry",
          env_var: affinity.env_var,
          message: `${affinity.env_var} is not in OPERATOR_BRIDGE_ENV_REGISTRY`,
        }),
      );
      continue;
    }
    const covered = affinity.commands.some((command) => {
      const entry = byCommand.get(command);
      if (!entry) return false;
      return entryNotes(entry).includes(affinity.env_var);
    });
    if (!covered) {
      findings.push(
        Object.freeze({
          code: "bridge_env_not_cited_by_command",
          env_var: affinity.env_var,
          commands: affinity.commands,
          message: `${affinity.env_var} must appear in consent notes for one of: ${affinity.commands.join(", ")}`,
        }),
      );
    }
  }

  const registry_env_vars = OPERATOR_BRIDGE_ENV_REGISTRY.map((e) => e.name);
  const affinity_env_vars = BRIDGE_ENV_COMMAND_AFFINITY.map((a) => a.env_var);
  for (const envVar of registry_env_vars) {
    if (!affinity_env_vars.includes(envVar)) {
      findings.push(
        Object.freeze({
          code: "registry_env_missing_affinity",
          env_var: envVar,
          message: `${envVar} has no BRIDGE_ENV_COMMAND_AFFINITY mapping`,
        }),
      );
    }
  }

  const ok = findings.length === 0;

  return deepFreeze({
    schema: CONSENT_BRIDGE_PARITY_SCHEMA,
    truth_label: CONSENT_BRIDGE_PARITY_TRUTH_LABEL,
    ok,
    adr_path: OPERATOR_BRIDGE_ADR_REL_PATH,
    external_runtime_command_count: external_runtime_commands.length,
    bridge_env_count: registry_env_vars.length,
    affinity_mapping_count: BRIDGE_ENV_COMMAND_AFFINITY.length,
    external_runtime_commands: Object.freeze([...external_runtime_commands]),
    findings: Object.freeze(findings),
  });
}

export function verifyConsentBridgeParityReport(report) {
  const ok =
    report?.schema === CONSENT_BRIDGE_PARITY_SCHEMA &&
    report?.ok === true &&
    Array.isArray(report.findings) &&
    report.findings.length === 0;
  return Object.freeze({ ok, schema: CONSENT_BRIDGE_PARITY_SCHEMA });
}

export function runConsentBridgeParityCheck() {
  const report = buildConsentBridgeParityReport();
  const verified = verifyConsentBridgeParityReport(report);
  return deepFreeze({
    ok: report.ok && verified.ok,
    report,
    verified,
  });
}
