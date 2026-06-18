// BIZRA-ADK-AGENT-CONTRACT-1A · refuse invalid agent contracts.

import {
  buildAgentContract,
  missingGuardrailFields,
  REQUIRED_GUARDRAIL_FIELDS,
} from "./agent-contract.js";
import {
  isKnownScope,
  isPatScope,
  isSatScope,
  scopePrivacyAligned,
  AGENT_SCOPES,
  PRIVACY_CLASSES,
} from "./agent-scope.js";
import {
  ADK_ALWAYS_FORBIDDEN_EFFECTS,
  PAT_SAT_FIREWALL_FORBIDDEN,
  SAT_RAW_MEMORY_FORBIDDEN,
  isCanonicalEffect,
} from "./effect-policy.js";

export const VALIDATION_SCHEMA = "bizra.dema.adk_agent_validation.v0.1";

function pushError(errors, code, message) {
  errors.push(Object.freeze({ code, message }));
}

/**
 * @param {object} raw - parsed JSON or plain object
 * @returns {{ valid: boolean, contract: object|null, errors: ReadonlyArray<object>, schema: string }}
 */
export function validateAgentContract(raw) {
  const errors = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    pushError(errors, "invalid_contract_shape", "Agent contract must be a JSON object.");
    return freezeResult(null, errors);
  }

  const contract = buildAgentContract(raw);

  if (contract.schema !== "bizra.dema.adk_agent_contract.v0.1") {
    pushError(errors, "invalid_schema", "schema must be bizra.dema.adk_agent_contract.v0.1");
  }

  const missing = missingGuardrailFields(contract);
  for (const field of missing) {
    pushError(errors, "missing_guardrail_field", `Required field missing or invalid: ${field}`);
  }

  if (!isKnownScope(contract.scope)) {
    pushError(
      errors,
      "invalid_scope",
      `scope must be one of: ${Object.values(AGENT_SCOPES).join(", ")}`,
    );
  }

  if (
    contract.scope &&
    contract.privacy_class &&
    !scopePrivacyAligned(contract.scope, contract.privacy_class)
  ) {
    pushError(
      errors,
      "scope_privacy_mismatch",
      `scope ${contract.scope} requires privacy_class ${
        isPatScope(contract.scope)
          ? PRIVACY_CLASSES.PAT_RAW_LOCAL
          : PRIVACY_CLASSES.SAT_SUMMARY_ONLY
      }`,
    );
  }

  for (const effect of [...contract.allowed_effects, ...contract.forbidden_effects]) {
    if (!isCanonicalEffect(effect)) {
      pushError(errors, "unknown_effect", `Unknown effect token: ${effect}`);
    }
  }

  for (const effect of ADK_ALWAYS_FORBIDDEN_EFFECTS) {
    if (!contract.forbidden_effects.includes(effect)) {
      pushError(
        errors,
        "always_forbidden_missing",
        `forbidden_effects must include ${effect}`,
      );
    }
    if (contract.allowed_effects.includes(effect)) {
      pushError(
        errors,
        "forbidden_effect_allowed",
        `${effect} cannot appear in allowed_effects`,
      );
    }
  }

  if (contract.stop_by_default !== true) {
    pushError(errors, "stop_by_default_required", "stop_by_default must be true");
  }

  if (!contract.what_this_does_not_prove) {
    pushError(
      errors,
      "what_this_does_not_prove_required",
      "what_this_does_not_prove is mandatory",
    );
  }

  checkPatSatFirewall(contract, errors);

  return freezeResult(errors.length === 0 ? contract : contract, errors);
}

function checkPatSatFirewall(contract, errors) {
  if (isPatScope(contract.scope)) {
    for (const effect of PAT_SAT_FIREWALL_FORBIDDEN) {
      if (contract.allowed_effects.includes(effect)) {
        pushError(
          errors,
          "pat_sat_firewall",
          `PAT agent cannot allow raw-memory crossing effect: ${effect}`,
        );
      }
    }
    if (/sat|summary export/i.test(contract.receipt_policy)) {
      pushError(
        errors,
        "pat_sat_firewall",
        "PAT receipt_policy cannot export raw memory to SAT",
      );
    }
  }

  if (isSatScope(contract.scope)) {
    for (const effect of SAT_RAW_MEMORY_FORBIDDEN) {
      if (contract.allowed_effects.includes(effect)) {
        pushError(
          errors,
          "pat_sat_firewall",
          `SAT agent cannot receive or export raw PAT memory: ${effect}`,
        );
      }
    }
    if (suggestsSatRawPatConsentViolation(contract.consent_policy)) {
      pushError(
        errors,
        "pat_sat_firewall",
        "SAT consent_policy cannot authorize raw PAT memory access",
      );
    }
  }
}

function suggestsSatRawPatConsentViolation(consentPolicy) {
  const text = String(consentPolicy ?? "").toLowerCase();
  if (!/raw.?pat|private.?memory/.test(text)) return false;

  const denial =
    /\b(never|no|not|without|exclude|refuse|deny|cannot|can't|must not|only proof)\b/.test(
      text,
    );
  if (denial) return false;

  return true;
}

function freezeResult(contract, errors) {
  return Object.freeze({
    schema: VALIDATION_SCHEMA,
    valid: errors.length === 0,
    contract: errors.length === 0 ? contract : contract,
    errors: Object.freeze(errors),
    required_guardrail_fields: REQUIRED_GUARDRAIL_FIELDS,
    boundary: Object.freeze({
      read_only: true,
      agent_execution_performed: false,
      network_used: false,
      key_generated: false,
      signing_performed: false,
      federation_started: false,
      token_minted: false,
    }),
  });
}
