// HOUSE-OF-WISDOM-LOCAL-INDEX-PREVIEW-1A
//
// Pure, read-only classifier for caller-provided local knowledge units. This is
// NOT the House of Wisdom runtime, NOT UKE acceptance, NOT URP sharing, NOT a
// SAT verification pass, and NOT a receipt/signature writer. It keeps candidate
// knowledge below the canon ladder's promotion gates while producing a stable,
// agent-readable preview envelope.

import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

export const HOUSE_OF_WISDOM_LOCAL_INDEX_PREVIEW_SCHEMA =
  "bizra.dema.house_of_wisdom_local_index_preview.v0.1";

export const HOUSE_OF_WISDOM_LOCAL_INDEX_PREVIEW_TRUTH_LABEL =
  "HOUSE_OF_WISDOM_LOCAL_INDEX_PREVIEW_ONLY";

const DESIGNED_NOT_LIVE = "DESIGNED_NOT_LIVE";
const LOCAL_CANDIDATE = "LOCAL_CANDIDATE";
const NOT_TRUTH_PROVEN = "PROVENANCE_CLASSIFIED_NOT_TRUTH_PROVEN";

const EVIDENCE_CLASSES = Object.freeze([
  "OPERATOR_AUTHORED",
  "CANON_REFERENCE",
  "RECEIPT_REFERENCE",
  "MEASURED",
  "DERIVED",
  "VERIFIED",
]);

const REQUIRED_STRING_FIELDS = Object.freeze([
  "unit_id",
  "title",
  "domain",
  "claim",
  "evidence_class",
  "source_ref",
]);

const FORBIDDEN_FIELD_NAMES = Object.freeze([
  "api_key",
  "artifact_content",
  "bzc",
  "economic_value",
  "federation_target",
  "full_receipt_json",
  "mint_candidate",
  "password",
  "pat_private_memory",
  "private_key",
  "private_key_pem",
  "raw_artifact",
  "reward",
  "reward_function",
  "secret",
  "token",
  "token_eligible",
]);

export const HOUSE_BOUNDARY_KEYS = Object.freeze([
  "file_read_performed",
  "file_write_performed",
  "signing_performed",
  "key_loaded",
  "key_generated",
  "web_crawl_performed",
  "uke_auto_ingest_performed",
  "sat_runtime_verification_performed",
  "house_acceptance_performed",
  "urp_publish_performed",
  "reward_function_emitted",
  "token_minted",
  "economic_value_claimed",
  "federation_used",
]);

const WHAT_THIS_PROVES = Object.freeze([
  "Caller-provided local knowledge units can be classified into a preview-only LOCAL_CANDIDATE index without reading files, signing receipts, or promoting claims.",
  "The preview can preserve House-of-Wisdom/UKE/URP boundaries while producing deterministic hashes for local review.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "UKE runtime is live.",
  "House of Wisdom has accepted any claim.",
  "URP shared runtime is connected.",
  "A SAT runtime has verified these claims.",
  "A reward, token, or economic value has been created.",
  "Federation is operational.",
  "The local claims are true.",
]);

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }
  return value;
}

function buildHouseBoundary() {
  return Object.freeze(
    Object.fromEntries(HOUSE_BOUNDARY_KEYS.map((key) => [key, false])),
  );
}

function findForbiddenFields(value, path = "", seen = new WeakSet()) {
  if (!value || typeof value !== "object") return [];
  if (seen.has(value)) return [];
  seen.add(value);
  const found = [];
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      found.push(...findForbiddenFields(value[i], `${path}[${i}]`, seen));
    }
    return found;
  }
  for (const [key, nested] of Object.entries(value)) {
    const nestedPath = path ? `${path}.${key}` : key;
    if (FORBIDDEN_FIELD_NAMES.includes(key)) {
      found.push(nestedPath);
      continue;
    }
    found.push(...findForbiddenFields(nested, nestedPath, seen));
  }
  return found;
}

function baseEnvelope(overrides) {
  return deepFreeze({
    schema: HOUSE_OF_WISDOM_LOCAL_INDEX_PREVIEW_SCHEMA,
    truth_label: HOUSE_OF_WISDOM_LOCAL_INDEX_PREVIEW_TRUTH_LABEL,
    mode: "preview_only",
    house_status: {
      highest_tier_emitted: LOCAL_CANDIDATE,
      uke_runtime_status: DESIGNED_NOT_LIVE,
      urp_shared_runtime_status: DESIGNED_NOT_LIVE,
      sat_governance_runtime_status: DESIGNED_NOT_LIVE,
      house_acceptance_status: DESIGNED_NOT_LIVE,
    },
    boundary: buildPreviewBoundary(),
    house_boundary: buildHouseBoundary(),
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
    ...overrides,
  });
}

function failure(blockedBy, inputUnitCount = 0) {
  return baseEnvelope({
    valid: false,
    status: "REFUSED_PREVIEW_INPUT_INVALID",
    blocked_by: Object.freeze([...blockedBy]),
    input_unit_count: inputUnitCount,
    entry_count: 0,
    entries: Object.freeze([]),
    index_preview_hash: null,
  });
}

function normalizeUnit(unit, index) {
  const blockers = [];
  if (!isPlainObject(unit)) {
    return {
      blockers: [`unit[${index}].not_plain_object`],
      entry: null,
    };
  }

  const forbiddenFields = findForbiddenFields(unit);
  for (const field of forbiddenFields) {
    blockers.push(`unit[${index}].forbidden_field:${field}`);
  }

  for (const field of REQUIRED_STRING_FIELDS) {
    if (!nonEmptyString(unit[field])) {
      blockers.push(`unit[${index}].required_field_missing:${field}`);
    }
  }

  if (
    nonEmptyString(unit.evidence_class) &&
    !EVIDENCE_CLASSES.includes(unit.evidence_class)
  ) {
    blockers.push(`unit[${index}].evidence_class_invalid`);
  }

  if (unit.evidence_class === "VERIFIED" && !nonEmptyString(unit.verification_path)) {
    blockers.push(`unit[${index}].verification_path_required_for_verified`);
  }

  if (
    "reward_candidate_eligible" in unit &&
    unit.reward_candidate_eligible !== false
  ) {
    blockers.push(`unit[${index}].reward_candidate_not_allowed_in_preview`);
  }

  if (blockers.length > 0) {
    return { blockers, entry: null };
  }

  // NO-LEAK boundary: forbidden-field detection above keys on field NAME, and the
  // entry below is a whitelist projection of six operator-authored fields. Arbitrary
  // keys (e.g. private_key nested under metadata) are both name-blocked and dropped
  // by this projection. The six emitted free-text fields are caller-authored
  // knowledge content and are passed through verbatim — a claim that *mentions* a
  // sensitive term is legitimate House-of-Wisdom content, not a leak. Emitted values
  // are intentionally NOT scrubbed; the guarantee is name-based + projection-based.
  const entryBody = {
    unit_id: unit.unit_id.trim(),
    title: unit.title.trim(),
    domain: unit.domain.trim(),
    claim: unit.claim.trim(),
    evidence_class: unit.evidence_class.trim(),
    source_ref: unit.source_ref.trim(),
    verification_path: nonEmptyString(unit.verification_path)
      ? unit.verification_path.trim()
      : null,
    local_tier: LOCAL_CANDIDATE,
    truth_status: NOT_TRUTH_PROVEN,
    house_of_wisdom_accepted: false,
    urp_shareable: false,
    reward_candidate_eligible: false,
  };

  return {
    blockers: [],
    entry: deepFreeze({
      ...entryBody,
      unit_ref_hash: sha256(stableStringify(entryBody)),
    }),
  };
}

export function buildHouseOfWisdomLocalIndexPreview({ units } = {}) {
  if (!Array.isArray(units)) {
    return failure(["units_not_array"]);
  }

  if (units.length === 0) {
    return failure(["units_empty"]);
  }

  const blockers = [];
  const entries = [];
  const seenIds = new Set();

  for (let i = 0; i < units.length; i++) {
    const { blockers: unitBlockers, entry } = normalizeUnit(units[i], i);
    blockers.push(...unitBlockers);
    if (!entry) continue;
    if (seenIds.has(entry.unit_id)) {
      blockers.push(`unit[${i}].duplicate_unit_id:${entry.unit_id}`);
      continue;
    }
    seenIds.add(entry.unit_id);
    entries.push(entry);
  }

  if (blockers.length > 0) {
    return failure(blockers, units.length);
  }

  const frozenEntries = Object.freeze(entries);
  const indexBody = {
    schema: HOUSE_OF_WISDOM_LOCAL_INDEX_PREVIEW_SCHEMA,
    truth_label: HOUSE_OF_WISDOM_LOCAL_INDEX_PREVIEW_TRUTH_LABEL,
    entries: frozenEntries.map((entry) => ({
      unit_id: entry.unit_id,
      unit_ref_hash: entry.unit_ref_hash,
      local_tier: entry.local_tier,
      truth_status: entry.truth_status,
    })),
  };

  return baseEnvelope({
    valid: true,
    status: "PREVIEW_BUILT",
    blocked_by: Object.freeze([]),
    input_unit_count: units.length,
    entry_count: frozenEntries.length,
    entries: frozenEntries,
    index_preview_hash: sha256(stableStringify(indexBody)),
  });
}
