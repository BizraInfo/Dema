// AWAY-CONTRACT-SCHEMA-1A — fail-closed shape validator for Dema Away Contracts
// (docs/02-architecture/AWAY_CONTRACT_SPEC_v0_1.md · child of ADR-043).
//
// Schema validates permission. It does not grant permission. It does not
// execute permission. It only refuses unsafe shape. A valid result here means
// "this contract body is well-formed and internally consistent" — never that
// absence mode started, that any action is authorized to run, or that any
// consent was given. Consent stays with the operator's exact-string phrase;
// execution stays behind its own future slices.
//
// Pure kernel: no fs / network / process / clock / random. Act-time is
// injected via options.now_iso and rejected when absent — the kernel never
// reads the wall clock (wall-clock-at-verify is a time bomb; expiry is judged
// as of the caller's declared act-time).

import { createHash } from "node:crypto";

export const AWAY_CONTRACT_SCHEMA = "bizra.dema.away_contract.v0.1";
export const AWAY_CONTRACT_VALIDATION_RESULT_SCHEMA =
  "bizra.dema.away_contract.validation_result.v0.1";
export const AWAY_CONTRACT_TRUTH_LABEL = "AWAY_CONTRACT_SCHEMA_VALIDATION_ONLY";

export const AWAY_CONTRACT_ACTION_CLASSES = Object.freeze([
  "READ_ONLY",
  "DOCS_ONLY",
  "LOCAL_EDIT",
  "TEST_ONLY",
  "COMMIT_ALLOWED",
  "PUSH_ALLOWED",
  "MODEL_ALLOWED",
  "NETWORK_ALLOWED",
  "MOBILE_ESCALATION_ALLOWED",
  "IRREVERSIBLE_ACTION",
]);

// Never grantable by an Away Contract at all (spec §7 ⛔ set). Requesting one
// rejects the whole contract — there is no "allowed" placement for these.
export const AWAY_CONTRACT_NEVER_GRANTABLE_ACTIONS = Object.freeze([
  "FORCE_PUSH",
  "WALLET_ACTION",
  "TOKEN_MINT",
  "BIZRA_ACTIVATION",
  "PUBLIC_URP_REGISTRATION",
  "PRIVATE_DATA_EXPORT",
  "CREDENTIAL_ACCESS",
  "INSTALL_BACKGROUND_DAEMON",
  "DISABLE_GATES",
  "BYPASS_CONSENT",
]);

export const AWAY_CONTRACT_ESCALATION_LEVELS = Object.freeze([
  "LEVEL_0_NO_NOTIFY",
  "LEVEL_1_SUMMARY_ONLY",
  "LEVEL_2_SOFT_NOTIFY",
  "LEVEL_3_CONSENT_REQUIRED",
  "LEVEL_4_URGENT_STOP_AND_ALERT",
]);

export const AWAY_CONTRACT_MAX_UNATTENDED_RISK_CEILING = 3;

export const AWAY_CONTRACT_REQUIRED_FIELDS = Object.freeze([
  "schema",
  "contract_id",
  "operator_id",
  "node_id",
  "mission_scope",
  "allowed_actions",
  "forbidden_actions",
  "data_scope",
  "model_policy",
  "tool_policy",
  "commit_policy",
  "push_policy",
  "network_policy",
  "mobile_escalation_policy",
  "risk_ceiling",
  "expires_at",
  "stop_conditions",
  "receipt_required",
  "review_required_on_return",
]);

const EXPLICIT_POLICY_FIELDS = Object.freeze([
  "model_policy",
  "push_policy",
  "network_policy",
]);

const POLICY_CONFLICTS = Object.freeze([
  ["PUSH_ALLOWED", "push_policy", "push_action_conflicts_with_policy"],
  ["MODEL_ALLOWED", "model_policy", "model_action_conflicts_with_policy"],
  ["NETWORK_ALLOWED", "network_policy", "network_action_conflicts_with_policy"],
]);

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

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function sortedDeduped(values) {
  return Object.freeze([...new Set(values)].sort());
}

function parseIsoMs(value) {
  if (!isNonEmptyString(value)) return NaN;
  return Date.parse(value);
}

// All-false boundary invariant: validation attempts nothing and starts nothing.
export function awayContractBoundary() {
  return Object.freeze({
    execution_attempted: false,
    model_invocation: false,
    network: false,
    token_mint: false,
    activation: false,
    daemon_started: false,
  });
}

export function validateAwayContract(contract, options = {}) {
  const blocked_by = [];
  const warnings = [];

  const nowMs = parseIsoMs(options?.now_iso);
  if (Number.isNaN(nowMs)) {
    blocked_by.push("now_iso_required");
  }

  const isObject =
    contract !== null && typeof contract === "object" && !Array.isArray(contract);
  if (!isObject) {
    blocked_by.push("contract_not_object");
    return buildResult({ contract: null, blocked_by, warnings });
  }

  for (const field of AWAY_CONTRACT_REQUIRED_FIELDS) {
    if (!(field in contract) || contract[field] === undefined) {
      blocked_by.push(`${field}_required`);
    }
  }
  if (blocked_by.some((code) => code.endsWith("_required"))) {
    return buildResult({ contract, blocked_by, warnings });
  }

  if (contract.schema !== AWAY_CONTRACT_SCHEMA) blocked_by.push("schema_mismatch");
  if (!isNonEmptyString(contract.contract_id)) blocked_by.push("contract_id_missing");
  if (!isNonEmptyString(contract.operator_id)) blocked_by.push("operator_id_missing");
  if (!isNonEmptyString(contract.node_id)) blocked_by.push("node_id_missing");
  if (!isNonEmptyString(contract.mission_scope)) blocked_by.push("mission_scope_missing");
  if (!isNonEmptyString(contract.data_scope)) blocked_by.push("data_scope_missing");
  if (!isNonEmptyString(contract.tool_policy)) blocked_by.push("tool_policy_missing");
  if (!isNonEmptyString(contract.commit_policy)) blocked_by.push("commit_policy_missing");

  for (const field of EXPLICIT_POLICY_FIELDS) {
    if (contract[field] !== "allowed" && contract[field] !== "forbidden") {
      blocked_by.push(`${field}_not_explicit`);
    }
  }

  if (!AWAY_CONTRACT_ESCALATION_LEVELS.includes(contract.mobile_escalation_policy)) {
    blocked_by.push("mobile_escalation_policy_invalid");
  }

  if (
    typeof contract.risk_ceiling !== "number" ||
    !Number.isSafeInteger(contract.risk_ceiling) ||
    contract.risk_ceiling < 0
  ) {
    blocked_by.push("risk_ceiling_invalid");
  } else if (contract.risk_ceiling > AWAY_CONTRACT_MAX_UNATTENDED_RISK_CEILING) {
    blocked_by.push("risk_ceiling_exceeds_unattended_max");
  }

  const expiresMs = parseIsoMs(contract.expires_at);
  if (Number.isNaN(expiresMs)) {
    blocked_by.push("expires_at_invalid");
  } else if (!Number.isNaN(nowMs) && expiresMs <= nowMs) {
    blocked_by.push("expires_at_not_future");
  }

  if (!isStringArray(contract.allowed_actions)) {
    blocked_by.push("allowed_actions_not_array");
  } else if (contract.allowed_actions.length === 0) {
    blocked_by.push("allowed_actions_empty");
  }

  if (!isStringArray(contract.forbidden_actions)) {
    blocked_by.push("forbidden_actions_not_array");
  }

  if (!isStringArray(contract.stop_conditions)) {
    blocked_by.push("stop_conditions_not_array");
  } else if (contract.stop_conditions.length === 0) {
    blocked_by.push("stop_conditions_empty");
  }

  if (contract.receipt_required !== true) {
    blocked_by.push("receipt_required_must_be_true");
  }
  if (contract.review_required_on_return !== true) {
    blocked_by.push("review_required_on_return_must_be_true");
  }

  if (isStringArray(contract.allowed_actions) && isStringArray(contract.forbidden_actions)) {
    const allowed = sortedDeduped(contract.allowed_actions);
    const forbidden = sortedDeduped(contract.forbidden_actions);

    if (allowed.some((a) => AWAY_CONTRACT_NEVER_GRANTABLE_ACTIONS.includes(a))) {
      blocked_by.push("never_grantable_action_requested");
    }
    if (
      allowed.some(
        (a) =>
          !AWAY_CONTRACT_ACTION_CLASSES.includes(a) &&
          !AWAY_CONTRACT_NEVER_GRANTABLE_ACTIONS.includes(a),
      )
    ) {
      blocked_by.push("unknown_action_class");
    }
    if (allowed.some((a) => forbidden.includes(a))) {
      blocked_by.push("allowed_forbidden_overlap");
    }
    for (const [action, policyField, code] of POLICY_CONFLICTS) {
      if (allowed.includes(action) && contract[policyField] === "forbidden") {
        blocked_by.push(code);
      }
    }
    if (allowed.includes("IRREVERSIBLE_ACTION")) {
      // Shape-valid, but the spec (§6) forbids an Away Contract alone from
      // authorizing irreversible acts — live per-act consent stays required.
      warnings.push("irreversible_action_requires_live_per_act_consent");
    }
  }

  return buildResult({ contract, blocked_by, warnings });
}

function buildResult({ contract, blocked_by, warnings }) {
  const valid = blocked_by.length === 0;

  let normalized_contract = null;
  let contract_hash = null;
  if (valid) {
    normalized_contract = Object.freeze({
      ...contract,
      allowed_actions: sortedDeduped(contract.allowed_actions),
      forbidden_actions: sortedDeduped(contract.forbidden_actions),
      stop_conditions: sortedDeduped(contract.stop_conditions),
    });
    contract_hash = `sha256:${sha256(stableStringify(normalized_contract))}`;
  }

  return Object.freeze({
    valid,
    rejected: !valid,
    schema: AWAY_CONTRACT_VALIDATION_RESULT_SCHEMA,
    truth_label: AWAY_CONTRACT_TRUTH_LABEL,
    contract_id: isNonEmptyString(contract?.contract_id) ? contract.contract_id : null,
    contract_hash,
    blocked_by: Object.freeze([...blocked_by]),
    warnings: Object.freeze([...warnings]),
    normalized_contract,
    boundary: awayContractBoundary(),
  });
}
