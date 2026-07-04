// CONSENT-MATRIX-COVERAGE-1A — pure validator for CLI risk + consent registry.

import { CLI_CONSENT_MATRIX_ENTRIES } from "./cli-consent-matrix-entries.js";

export const CLI_CONSENT_MATRIX_SCHEMA = "bizra.dema.cli_consent_matrix.v0.1";
export const CLI_CONSENT_MATRIX_TRUTH_LABEL =
  "CLI_CONSENT_MATRIX_DECLARATIVE_ONLY";

export const CLI_RISK_LEVELS = Object.freeze([
  "read_only",
  "preview_only",
  "local_write",
  "content_read",
  "network",
  "external_runtime",
  "key_wallet",
  "activation",
]);

export const CONSENT_MECHANISMS = Object.freeze([
  "none",
  "fail_closed_preview",
  "exact_phrase",
  "approval_gate",
  "subcommand_gated",
]);

const MUTATING_RISKS = new Set([
  "local_write",
  "network",
  "external_runtime",
  "key_wallet",
  "activation",
]);

const STRONG_CONSENT = new Set([
  "exact_phrase",
  "approval_gate",
  "subcommand_gated",
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function isMutatingRisk(riskLevels) {
  return riskLevels.some((r) => MUTATING_RISKS.has(r));
}

function isHighSensitivity(riskLevels) {
  return riskLevels.some((r) => r === "key_wallet" || r === "activation");
}

function isContentReadRisk(riskLevels) {
  return riskLevels.includes("content_read");
}

/**
 * @param {object} params
 * @param {readonly string[]} params.commandSurface
 * @param {(relPath: string) => boolean} [params.testFileExists]
 */
export function buildCliConsentMatrixReport({
  commandSurface,
  testFileExists = () => true,
} = {}) {
  const commands = commandSurface ? [...commandSurface] : [];
  const byCommand = new Map(
    CLI_CONSENT_MATRIX_ENTRIES.map((entry) => [entry.command, entry]),
  );

  const findings = [];
  const missing_commands = [];
  const orphan_commands = [];

  for (const cmd of commands) {
    if (!byCommand.has(cmd)) missing_commands.push(cmd);
  }
  for (const cmd of byCommand.keys()) {
    if (!commands.includes(cmd)) orphan_commands.push(cmd);
  }

  for (const entry of CLI_CONSENT_MATRIX_ENTRIES) {
    const { command, risk_levels, consent, test_refs } = entry;

    for (const risk of risk_levels) {
      if (!CLI_RISK_LEVELS.includes(risk)) {
        findings.push({
          command,
          code: "unknown_risk_level",
          detail: risk,
        });
      }
    }

    if (!CONSENT_MECHANISMS.includes(consent.mechanism)) {
      findings.push({
        command,
        code: "unknown_consent_mechanism",
        detail: consent.mechanism,
      });
    }

    if (!consent.detail || typeof consent.detail !== "string") {
      findings.push({ command, code: "missing_consent_detail" });
    }

    if (!Array.isArray(test_refs) || test_refs.length === 0) {
      findings.push({ command, code: "missing_test_refs" });
    } else {
      for (const ref of test_refs) {
        if (!testFileExists(ref)) {
          findings.push({
            command,
            code: "test_ref_missing_on_disk",
            detail: ref,
          });
        }
      }
    }

    if (isMutatingRisk(risk_levels)) {
      if (
        consent.mechanism === "none" ||
        consent.mechanism === "fail_closed_preview"
      ) {
        findings.push({
          command,
          code: "mutating_command_requires_strong_consent",
          detail: consent.mechanism,
        });
      }
    }

    if (isHighSensitivity(risk_levels) && !STRONG_CONSENT.has(consent.mechanism)) {
      findings.push({
        command,
        code: "high_sensitivity_requires_strong_consent",
        detail: consent.mechanism,
      });
    }

    if (isContentReadRisk(risk_levels) && !STRONG_CONSENT.has(consent.mechanism)) {
      findings.push({
        command,
        code: "content_read_requires_strong_consent",
        detail: consent.mechanism,
      });
    }

    if (
      risk_levels.length === 1 &&
      risk_levels[0] === "read_only" &&
      consent.mechanism !== "none"
    ) {
      findings.push({
        command,
        code: "read_only_should_use_none_consent",
        detail: consent.mechanism,
      });
    }
  }

  const ok =
    findings.length === 0 &&
    missing_commands.length === 0 &&
    orphan_commands.length === 0;

  const summary = {
    total_commands: commands.length,
    matrix_rows: CLI_CONSENT_MATRIX_ENTRIES.length,
    mutating_commands: CLI_CONSENT_MATRIX_ENTRIES.filter((e) =>
      isMutatingRisk(e.risk_levels),
    ).length,
    high_sensitivity_commands: CLI_CONSENT_MATRIX_ENTRIES.filter((e) =>
      isHighSensitivity(e.risk_levels),
    ).length,
  };

  return deepFreeze({
    schema: CLI_CONSENT_MATRIX_SCHEMA,
    truth_label: CLI_CONSENT_MATRIX_TRUTH_LABEL,
    ok,
    summary,
    missing_commands: Object.freeze([...missing_commands].sort()),
    orphan_commands: Object.freeze([...orphan_commands].sort()),
    findings: Object.freeze([...findings]),
    entries: CLI_CONSENT_MATRIX_ENTRIES,
  });
}

export function verifyCliConsentMatrixReport(report) {
  if (!report || report.schema !== CLI_CONSENT_MATRIX_SCHEMA) {
    return Object.freeze({ ok: false, reason: "schema_mismatch" });
  }
  if (report.ok !== true) {
    return Object.freeze({ ok: false, reason: "report_not_ok" });
  }
  return Object.freeze({ ok: true, reason: null });
}
