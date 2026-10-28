export type MissionOutcomeProjection = {
  kind: "receipted" | "authorization-refused" | "unverified";
  title: string;
  message: string;
};

const UNVERIFIED: MissionOutcomeProjection = {
  kind: "unverified",
  title: "Mission outcome not verified",
  message: "The response does not establish whether the runtime acted. Inspect the authoritative runtime mission record before retrying.",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const MISSION_OPERATION = "METADATA_INVENTORY_READ_ONLY";

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isHash(value: unknown): value is string {
  return typeof value === "string" && HASH_RE.test(value);
}

function isCountMap(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.keys(value).length > 0 && Object.values(value).every(isCount);
}

function sameCountMap(left: unknown, right: unknown): boolean {
  return isCountMap(left) && isCountMap(right) &&
    Object.keys(left).length === Object.keys(right).length &&
    Object.keys(left).every((key) => left[key] === right[key]);
}

function sameLimits(left: unknown, right: unknown): boolean {
  const keys = ["max_entries", "max_depth", "wall_clock_seconds", "storage_write_bytes"];
  return isRecord(left) && isRecord(right) && keys.every((key) =>
    isCount(left[key]) && left[key] === right[key]
  );
}

function hasConflictingOutcomeEvidence(...sources: Record<string, unknown>[]): boolean {
  const keys = ["events", "result", "result_hash", "receipt", "receipt_hash", "judgment",
    "observation", "sat_evidence_packet", "execution", "effect", "effect_started",
    "execution_performed", "mission_executed", "status"];
  return sources.some((source) => keys.some((key) => Object.prototype.hasOwnProperty.call(source, key)));
}

function hasConsistentMissionReceipt(governed: Record<string, unknown>): boolean {
  const contract = governed.contract;
  const consentReceipt = governed.consent_receipt;
  const result = governed.result;
  const observation = governed.observation;
  const judgment = governed.judgment;
  const receipt = governed.receipt;
  if (!isRecord(contract) || !isRecord(consentReceipt) || !isRecord(result) ||
      !isRecord(observation) || !isRecord(judgment) || !isRecord(receipt)) return false;

  const contractHash = governed.contract_hash;
  const consentReceiptHash = governed.consent_receipt_hash;
  const resultHash = governed.result_hash;
  const receiptHash = governed.receipt_hash;
  const missionId = contract.mission_id;
  const operation = MISSION_OPERATION;
  const counts = ["files", "directories", "symlinks", "skipped"];
  const observedBooleans = ["contents_read", "contents_hashed", "network_used", "source_mutated"];
  const resultCounts = result.counts;
  const observationCounts = observation.counts;
  const resultObserved = result.observed;

  if (
    contract.schema !== "bizra.genesis.mission_contract.v0.1" ||
    !hasText(missionId) || !hasText(contract.canonical_root) ||
    contract.permitted_operation !== operation || contract.metadata_only !== true || contract.network !== false ||
    !isRecord(contract.limits) ||
    !Array.isArray(governed.blocked_by) || governed.blocked_by.length !== 0 ||
    !isHash(contractHash) ||
    consentReceipt.schema !== "bizra.genesis.consent_receipt.v0.1" ||
    consentReceipt.mission_id !== missionId || consentReceipt.consent_verdict !== "PERMIT_PREVIEW" ||
    consentReceipt.permitted_operation !== operation || !hasText(consentReceipt.authorized_at_iso) ||
    !isHash(consentReceipt.consent_context_hash) || !isHash(consentReceiptHash) ||
    result.schema !== "bizra.genesis.mission_result.v0.1" ||
    Object.prototype.hasOwnProperty.call(result, "status") || Object.prototype.hasOwnProperty.call(result, "ok") ||
    result.mission_id !== missionId || result.contract_hash !== contractHash ||
    result.canonical_root !== contract.canonical_root || result.metadata_only !== true ||
    result.permitted_operation !== operation || result.limits_honored !== true ||
    observation.root_realpath !== contract.canonical_root || observation.limits_honored !== true ||
    !isCountMap(result.type_histogram) || !sameCountMap(result.type_histogram, observation.type_histogram) ||
    !isCountMap(result.skipped_reasons) || !sameCountMap(result.skipped_reasons, observation.skipped_reasons) ||
    !isCount(result.total_file_bytes) || result.total_file_bytes !== observation.total_file_bytes ||
    !sameLimits(contract.limits, result.limits) || !isCount(observation.elapsed_ms) ||
    !isRecord(resultCounts) || !isRecord(observationCounts) ||
    !sameCountMap(resultCounts, observationCounts) ||
    !counts.every((key) => isCount(resultCounts[key]) && resultCounts[key] === observationCounts[key]) ||
    !isRecord(resultObserved) ||
    !observedBooleans.every((key) => resultObserved[key] === false && observation[key] === false) ||
    !["symlinks_followed", "entries_outside_root"].every((key) =>
      resultObserved[key] === 0 && observation[key] === 0
    ) ||
    !isHash(resultHash) ||
    receipt.schema !== "bizra.genesis.mission_receipt.v0.1" ||
    Object.prototype.hasOwnProperty.call(receipt, "status") || Object.prototype.hasOwnProperty.call(receipt, "ok") ||
    Object.prototype.hasOwnProperty.call(receipt, "receipt_hash") ||
    receipt.mission_id !== missionId || receipt.contract_hash !== contractHash ||
    receipt.consent_context_hash !== consentReceipt.consent_context_hash ||
    receipt.consent_receipt_hash !== consentReceiptHash || receipt.result_hash !== resultHash ||
    !isHash(receipt.judgment_hash) || !isHash(receipt.previous_state_root) ||
    receipt.permitted_operation !== operation || receipt.metadata_only !== true ||
    receipt.network_used !== false || receipt.token_minted !== false ||
    !hasText(receipt.executed_at_iso) || !Number.isFinite(Date.parse(receipt.executed_at_iso)) ||
    !isHash(receiptHash) || governed.previous_state_root !== receipt.previous_state_root ||
    !isHash(governed.resulting_state_root) ||
    judgment.schema !== "bizra.genesis.sat5_judgment.v0.1" || judgment.subject !== "NODE0" ||
    judgment.status !== "ACTIVE_LOCAL" || judgment.implementation !== "DETERMINISTIC_VERIFIER" ||
    judgment.autonomous_ai_agent !== false || judgment.evidence_complete !== true ||
    !Array.isArray(judgment.verifier_verdicts) || judgment.verifier_verdicts.length !== 5 ||
    !judgment.verifier_verdicts.every((verdict) => isRecord(verdict) && hasText(verdict.id) &&
      hasText(verdict.lane) && verdict.verdict === "PASS" && Array.isArray(verdict.reasons) && verdict.reasons.length === 0) ||
    !Array.isArray(judgment.failing_verifiers) || judgment.failing_verifiers.length !== 0 ||
    judgment.set_verdict !== "ADMISSIBLE" || judgment.admissible !== true ||
    judgment.judges_node0 !== true || judgment.serves_node0 !== false ||
    !isHash(judgment.judgment_hash) || receipt.judgment_hash !== judgment.judgment_hash ||
    governed.refused === true || Object.prototype.hasOwnProperty.call(governed, "status")
  ) return false;

  return true;
}

export function projectMissionOutcome(
  response: unknown,
  httpStatus: number | null,
): MissionOutcomeProjection {
  if (!isRecord(response)) return UNVERIFIED;

  const governed = isRecord(response.governed) ? response.governed : null;
  const blockedBy = Array.isArray(governed?.blocked_by) ? governed.blocked_by : [];
  if (
    httpStatus === 400 &&
    response.ok === false &&
    governed !== null &&
    governed.ok === false &&
    governed.consent_recorded === true &&
    blockedBy.length === 1 &&
    blockedBy[0] === "exact_consent_not_matched" &&
    !hasConflictingOutcomeEvidence(response, governed)
  ) {
    return {
      kind: "authorization-refused",
      title: "Authorization refused",
      message: "The runtime reported an exact-consent mismatch and recorded this request before authorization. This response does not establish whether an effect occurred; inspect authoritative mission state before retrying.",
    };
  }

  if (
    httpStatus === 200 &&
    response.ok === true &&
    governed !== null &&
    governed.ok === true &&
    (!Object.prototype.hasOwnProperty.call(response, "blocked_by") ||
      (Array.isArray(response.blocked_by) && response.blocked_by.length === 0)) &&
    response.refused !== true &&
    !Object.prototype.hasOwnProperty.call(response, "status") &&
    hasConsistentMissionReceipt(governed)
  ) {
    return {
      kind: "unverified",
      title: "Mission receipt returned but not verified",
      message: "The response is structurally consistent, but this screen does not re-derive its content hashes or independently verify SAT or an external effect. Inspect the authoritative mission record before retrying.",
    };
  }

  return UNVERIFIED;
}
