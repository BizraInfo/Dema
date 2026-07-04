// AWAY-CONTRACT-COMPILER-1A — plain bounded-intent → draft Away Contract body
// (child of ADR-043 · docs/02-architecture/AWAY_CONTRACT_SPEC_v0_1.md · fourth
// rung of the ladder).
//
// Compiler drafts. Schema validates. Verifier binds. Receipt records consent.
// None of them starts work.
//
// This is not Cedar, EIP-712, or Temporal compilation — it is the first local
// draft compiler for Dema's own Away Contract body. The compiler never calls
// the verifier or the receipt writer, never writes files, never infers
// push/model/network permission from allowed_actions (explicit policies are
// copied verbatim), and never flips receipt/review requirements to false.
//
// Pure kernel: no fs / network / process / clock / random. Act-time is
// injected via options.now_iso; the deterministic contract_id derives from the
// canonical intent + now_iso, so the same declared intent at the same declared
// moment always drafts the same contract.

import { createHash } from "node:crypto";

import {
  AWAY_CONTRACT_SCHEMA,
  validateAwayContract,
} from "./away-contract-schema.js";

export const AWAY_CONTRACT_COMPILER_RESULT_SCHEMA =
  "bizra.dema.away_contract.compiler_result.v0.1";
export const AWAY_CONTRACT_COMPILER_TRUTH_LABEL = "AWAY_CONTRACT_COMPILATION_ONLY";

const DEFAULT_CONTRACT_ID_PREFIX = "away";
// Prefix must stay filesystem- and receipt-safe once the 12-hex suffix lands.
const SAFE_PREFIX = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

// The intent fields the compiler copies into the draft. Anything else in the
// intent is ignored (with a warning) — unknown keys never reach the body.
const INTENT_FIELDS = Object.freeze([
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

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function compilerBoundary() {
  return Object.freeze({
    execution_attempted: false,
    contract_started: false,
    receipt_written: false,
    model_invocation: false,
    network: false,
    token_mint: false,
    activation: false,
    daemon_started: false,
    external_policy_compiled: false,
  });
}

export function compileAwayContractIntent(intent, options = {}) {
  const blocked_by = [];
  const warnings = [];

  const now_iso = options?.now_iso;
  if (!isNonEmptyString(now_iso)) blocked_by.push("now_iso_missing");

  if (!isPlainObject(intent)) {
    blocked_by.push("intent_not_object");
    return buildResult({ blocked_by, warnings });
  }

  const prefix = options?.contract_id_prefix ?? DEFAULT_CONTRACT_ID_PREFIX;
  if (!SAFE_PREFIX.test(prefix)) {
    blocked_by.push("unsafe_contract_id_prefix");
  }
  if (blocked_by.length > 0) {
    return buildResult({ blocked_by, warnings });
  }

  const draft = {};
  for (const field of INTENT_FIELDS) {
    if (field in intent && intent[field] !== undefined) draft[field] = intent[field];
  }
  // Drafting convenience only: an ABSENT requirement defaults to true. An
  // explicit false is copied verbatim so validation rejects it — the compiler
  // never silently flips an operator's declared value.
  if (!("receipt_required" in draft)) draft.receipt_required = true;
  if (!("review_required_on_return" in draft)) draft.review_required_on_return = true;

  const unknownFields = Object.keys(intent).filter(
    (key) => !INTENT_FIELDS.includes(key),
  );
  if (unknownFields.length > 0) warnings.push("unknown_intent_fields_ignored");

  const contract_id = `${prefix}-${sha256(stableStringify({ draft, now_iso })).slice(0, 12)}`;
  const contract = { schema: AWAY_CONTRACT_SCHEMA, contract_id, ...draft };

  const validation_result = validateAwayContract(contract, { now_iso });
  for (const warning of validation_result.warnings) warnings.push(warning);

  if (!validation_result.valid) {
    blocked_by.push("compiled_contract_invalid");
    return buildResult({ blocked_by, warnings, validation_result });
  }

  return buildResult({
    blocked_by,
    warnings,
    compiled: true,
    contract,
    contract_id,
    contract_hash: validation_result.contract_hash,
    validation_result,
  });
}

function buildResult({
  blocked_by,
  warnings,
  compiled = false,
  contract = null,
  contract_id = null,
  contract_hash = null,
  validation_result = null,
}) {
  return Object.freeze({
    compiled,
    rejected: !compiled,
    schema: AWAY_CONTRACT_COMPILER_RESULT_SCHEMA,
    truth_label: AWAY_CONTRACT_COMPILER_TRUTH_LABEL,
    contract_id,
    contract_hash,
    contract,
    validation_result,
    blocked_by: Object.freeze([...blocked_by]),
    warnings: Object.freeze([...warnings]),
    boundary: compilerBoundary(),
  });
}
