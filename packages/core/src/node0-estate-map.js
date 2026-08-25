// NODE0-ESTATE-MAP-0A — pure approved-root snapshot comparator.
//
// This component accepts only caller-supplied, metadata-only descriptors. It
// never scans a root, reads the filesystem, stores state, invokes a provider,
// or mints a receipt. It proves only deterministic comparison of supplied
// evidence; it does not prove that an observation describes the real world.

import { CANONICAL_JSON_V1_ALGORITHM } from "../../canon/src/canonical-json-v1.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";

export const NODE0_ESTATE_MAP_SCHEMA = "bizra.dema.node0_estate_map.v0.1";
export const NODE0_ESTATE_MAP_TRUTH_LABEL = "NODE0_ESTATE_MAP_COMPONENT_ONLY";

const SHA256 = /^sha256:[0-9a-f]{64}$/;
const ROOT_STATUSES = new Set(["AVAILABLE", "UNAVAILABLE", "UNKNOWN"]);
const COMPLETENESS = new Set(["COMPLETE", "INCOMPLETE"]);
const BOUNDARY_KEYS = Object.freeze([
  "filesystem_scan_performed",
  "file_content_read",
  "file_mutation_performed",
  "network_used",
  "provider_invocation_performed",
  "model_invocation_performed",
  "runtime_started",
  "consent_consumed",
  "receipt_mint_performed",
]);

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function hasOnlyKeys(value, allowed) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function addUnique(values, value) {
  if (!values.includes(value)) values.push(value);
}

export function node0EstateMapBoundary() {
  return Object.freeze(Object.fromEntries(BOUNDARY_KEYS.map((key) => [key, false])));
}

function boundaryAllFalse(boundary) {
  return isPlainObject(boundary)
    && Object.keys(boundary).length === BOUNDARY_KEYS.length
    && BOUNDARY_KEYS.every((key) => boundary[key] === false);
}

function validateRegistry(registry, blocked) {
  if (!isPlainObject(registry)) {
    addUnique(blocked, "approved_roots_missing_or_malformed");
    return null;
  }
  if (!hasOnlyKeys(registry, ["registry_id", "registry_digest", "roots"])) {
    addUnique(blocked, "approved_roots_contains_forbidden_field");
  }
  if (!nonEmptyString(registry.registry_id)) addUnique(blocked, "registry_id_missing_or_malformed");
  if (!SHA256.test(registry.registry_digest)) addUnique(blocked, "registry_digest_malformed");
  if (!Array.isArray(registry.roots) || registry.roots.length === 0) {
    addUnique(blocked, "approved_roots_missing_or_empty");
    return null;
  }

  const roots = new Map();
  for (const root of registry.roots) {
    if (!isPlainObject(root) || !hasOnlyKeys(root, ["root_id", "root_identity_digest"])) {
      addUnique(blocked, "approved_root_malformed");
      continue;
    }
    if (!nonEmptyString(root.root_id)) {
      addUnique(blocked, "approved_root_id_missing_or_malformed");
      continue;
    }
    if (!SHA256.test(root.root_identity_digest)) {
      addUnique(blocked, `approved_root_identity_digest_malformed:${root.root_id}`);
      continue;
    }
    if (roots.has(root.root_id)) {
      addUnique(blocked, `approved_root_duplicate:${root.root_id}`);
      continue;
    }
    roots.set(root.root_id, Object.freeze({ ...root }));
  }
  return roots;
}

function validateObservation({ observation, name, registry, approvedRoots, blocked, allowNull }) {
  if (observation === null && allowNull) return null;
  if (!isPlainObject(observation)) {
    addUnique(blocked, `${name}_observation_missing_or_malformed`);
    return null;
  }
  if (!hasOnlyKeys(observation, ["observation_id", "observation_digest", "registry_digest", "roots"])) {
    addUnique(blocked, `${name}_observation_contains_forbidden_field`);
  }
  if (!nonEmptyString(observation.observation_id)) addUnique(blocked, `${name}_observation_id_missing_or_malformed`);
  if (!SHA256.test(observation.observation_digest)) addUnique(blocked, `${name}_observation_digest_malformed`);
  if (observation.registry_digest !== registry?.registry_digest) {
    addUnique(blocked, `${name}_registry_digest_mismatch`);
  }
  if (!Array.isArray(observation.roots)) {
    addUnique(blocked, `${name}_roots_missing_or_malformed`);
    return null;
  }

  const roots = new Map();
  for (const root of observation.roots) {
    if (!isPlainObject(root) || !hasOnlyKeys(root, [
      "root_id",
      "root_identity_digest",
      "status",
      "completeness",
      "metadata_digest",
    ])) {
      addUnique(blocked, `${name}_root_malformed`);
      continue;
    }
    if (!nonEmptyString(root.root_id)) {
      addUnique(blocked, `${name}_root_id_missing_or_malformed`);
      continue;
    }
    const approved = approvedRoots?.get(root.root_id);
    if (!approved) {
      addUnique(blocked, `${name}_root_unknown:${root.root_id}`);
      continue;
    }
    if (approved.root_identity_digest !== root.root_identity_digest) {
      addUnique(blocked, `${name}_root_identity_mismatch:${root.root_id}`);
      continue;
    }
    if (!ROOT_STATUSES.has(root.status)) {
      addUnique(blocked, `${name}_root_status_malformed:${root.root_id}`);
      continue;
    }
    if (!COMPLETENESS.has(root.completeness)) {
      addUnique(blocked, `${name}_root_completeness_malformed:${root.root_id}`);
      continue;
    }
    if (root.status === "AVAILABLE" && !SHA256.test(root.metadata_digest)) {
      addUnique(blocked, `${name}_root_metadata_digest_malformed:${root.root_id}`);
      continue;
    }
    if (root.status !== "AVAILABLE" && root.metadata_digest !== null) {
      addUnique(blocked, `${name}_root_metadata_digest_must_be_null:${root.root_id}`);
      continue;
    }
    if (roots.has(root.root_id)) {
      addUnique(blocked, `${name}_root_duplicate:${root.root_id}`);
      continue;
    }
    roots.set(root.root_id, Object.freeze({ ...root }));
  }
  return Object.freeze({
    observation_id: observation.observation_id,
    observation_digest: observation.observation_digest,
    roots,
  });
}

function rootResult({ approved, prior, current }) {
  if (!current) return { root_id: approved.root_id, outcome: "OBSERVATION_MISSING" };
  if (current.status === "UNAVAILABLE") return { root_id: approved.root_id, outcome: "UNAVAILABLE" };
  if (current.status !== "AVAILABLE" || current.completeness !== "COMPLETE") {
    return { root_id: approved.root_id, outcome: "INCOMPARABLE" };
  }
  if (!prior) return { root_id: approved.root_id, outcome: "BASELINE_REQUIRED" };
  if (prior.status !== "AVAILABLE" || prior.completeness !== "COMPLETE") {
    return { root_id: approved.root_id, outcome: "RESTORED_UNVERIFIED" };
  }
  return {
    root_id: approved.root_id,
    outcome: prior.metadata_digest === current.metadata_digest ? "UNCHANGED" : "CHANGED",
  };
}

function summarize(roots) {
  const summary = {
    baseline_required: 0,
    changed: 0,
    incomparable: 0,
    observation_missing: 0,
    restored_unverified: 0,
    unavailable: 0,
    unchanged: 0,
  };
  for (const { outcome } of roots) {
    if (outcome === "BASELINE_REQUIRED") summary.baseline_required += 1;
    if (outcome === "CHANGED") summary.changed += 1;
    if (outcome === "INCOMPARABLE") summary.incomparable += 1;
    if (outcome === "OBSERVATION_MISSING") summary.observation_missing += 1;
    if (outcome === "RESTORED_UNVERIFIED") summary.restored_unverified += 1;
    if (outcome === "UNAVAILABLE") summary.unavailable += 1;
    if (outcome === "UNCHANGED") summary.unchanged += 1;
  }
  const hold = summary.baseline_required
    + summary.incomparable
    + summary.observation_missing
    + summary.restored_unverified
    + summary.unavailable;
  return Object.freeze({
    ...summary,
    comparable: roots.length - hold,
    zero_meaningful_delta: hold === 0 ? summary.changed === 0 : null,
  });
}

function decision({ registry, approved, prior, current, blocked }) {
  if (blocked.length > 0) {
    return freezeDeep({
      schema: NODE0_ESTATE_MAP_SCHEMA,
      truth_label: NODE0_ESTATE_MAP_TRUTH_LABEL,
      verdict: "REFUSE",
      blocked_by: Object.freeze([...blocked]),
      held_by: Object.freeze([]),
      approved_root_registry: registry ? Object.freeze({
        registry_id: registry.registry_id ?? null,
        registry_digest: registry.registry_digest ?? null,
      }) : null,
      prior_observation_digest: prior?.observation_digest ?? null,
      current_observation_digest: current?.observation_digest ?? null,
      roots: Object.freeze([]),
      summary: Object.freeze({
        baseline_required: 0,
        changed: 0,
        incomparable: 0,
        observation_missing: 0,
        restored_unverified: 0,
        unavailable: 0,
        unchanged: 0,
        comparable: 0,
        zero_meaningful_delta: null,
      }),
      authority_delta: 0,
      boundary: node0EstateMapBoundary(),
    });
  }

  const roots = [...approved.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, root]) => Object.freeze(rootResult({
      approved: root,
      prior: prior?.roots.get(root.root_id) ?? null,
      current: current?.roots.get(root.root_id) ?? null,
    })));
  const summary = summarize(roots);
  const held_by = roots
    .filter(({ outcome }) => outcome !== "UNCHANGED" && outcome !== "CHANGED")
    .map(({ root_id, outcome }) => `${outcome.toLowerCase()}:${root_id}`);
  return freezeDeep({
    schema: NODE0_ESTATE_MAP_SCHEMA,
    truth_label: NODE0_ESTATE_MAP_TRUTH_LABEL,
    verdict: held_by.length === 0 ? "PASS" : "HOLD",
    blocked_by: Object.freeze([]),
    held_by: Object.freeze(held_by),
    approved_root_registry: Object.freeze({
      registry_id: registry.registry_id,
      registry_digest: registry.registry_digest,
    }),
    prior_observation_digest: prior?.observation_digest ?? null,
    current_observation_digest: current?.observation_digest ?? null,
    roots: Object.freeze(roots),
    summary,
    authority_delta: 0,
    boundary: node0EstateMapBoundary(),
  });
}

// This is the authoritative pure transform. The caller supplies observations;
// this function neither obtains nor stores them.
export function compareNode0EstateMapSnapshots(input = {}) {
  const blocked = [];
  if (!isPlainObject(input)) {
    addUnique(blocked, "input_missing_or_malformed");
    return decision({ registry: null, approved: null, prior: null, current: null, blocked });
  }
  if (!hasOnlyKeys(input, ["approved_roots", "prior", "current"])) {
    addUnique(blocked, "input_contains_forbidden_field");
  }
  const { approved_roots, prior, current } = input;
  const approved = validateRegistry(approved_roots, blocked);
  const priorObservation = validateObservation({
    observation: prior,
    name: "prior",
    registry: approved_roots,
    approvedRoots: approved,
    blocked,
    allowNull: true,
  });
  const currentObservation = validateObservation({
    observation: current,
    name: "current",
    registry: approved_roots,
    approvedRoots: approved,
    blocked,
    allowNull: false,
  });
  return decision({
    registry: approved_roots,
    approved,
    prior: priorObservation,
    current: currentObservation,
    blocked,
  });
}

export function buildNode0EstateMapPayload(input) {
  const decisionValue = compareNode0EstateMapSnapshots(input);
  const body = {
    schema: NODE0_ESTATE_MAP_SCHEMA,
    truth_label: NODE0_ESTATE_MAP_TRUTH_LABEL,
    canonicalization_algorithm: CANONICAL_JSON_V1_ALGORITHM,
    hash_algorithm: "sha256",
    text_encoding: "utf-8",
    decision: decisionValue,
    authority_delta: 0,
    boundary: node0EstateMapBoundary(),
  };
  return freezeDeep({ ...body, content_hash: sha256CanonicalJsonV1(body) });
}

export function verifyNode0EstateMapPayload(payload, input) {
  const blocked_by = [];
  if (!isPlainObject(payload)) {
    addUnique(blocked_by, "payload_missing_or_malformed");
  } else {
    if (!hasOnlyKeys(payload, [
      "schema",
      "truth_label",
      "canonicalization_algorithm",
      "hash_algorithm",
      "text_encoding",
      "decision",
      "authority_delta",
      "boundary",
      "content_hash",
    ])) addUnique(blocked_by, "payload_contains_forbidden_field");
    const { content_hash, ...body } = payload;
    if (!SHA256.test(content_hash)) addUnique(blocked_by, "content_hash_missing_or_malformed");
    else if (sha256CanonicalJsonV1(body) !== content_hash) addUnique(blocked_by, "content_hash_mismatch");
    if (payload.schema !== NODE0_ESTATE_MAP_SCHEMA) addUnique(blocked_by, "schema_mismatch");
    if (payload.truth_label !== NODE0_ESTATE_MAP_TRUTH_LABEL) addUnique(blocked_by, "truth_label_mismatch");
    if (payload.canonicalization_algorithm !== CANONICAL_JSON_V1_ALGORITHM) {
      addUnique(blocked_by, "canonicalization_algorithm_mismatch");
    }
    if (payload.authority_delta !== 0) addUnique(blocked_by, "authority_delta_nonzero");
    if (!boundaryAllFalse(payload.boundary)) addUnique(blocked_by, "boundary_not_all_false");
    if (input === undefined) {
      addUnique(blocked_by, "independent_input_required");
    } else {
      const rederived = compareNode0EstateMapSnapshots(input);
      if (sha256CanonicalJsonV1(rederived) !== sha256CanonicalJsonV1(payload.decision)) {
        addUnique(blocked_by, "decision_rederivation_mismatch");
      }
    }
  }
  return freezeDeep({
    ok: blocked_by.length === 0,
    schema: NODE0_ESTATE_MAP_SCHEMA,
    truth_label: NODE0_ESTATE_MAP_TRUTH_LABEL,
    authority_delta: 0,
    boundary: node0EstateMapBoundary(),
    blocked_by: Object.freeze(blocked_by),
  });
}
