// BIZRA-CONTEXT-SPINE-1B2 — pure context resolver and proof builder.
//
// No filesystem, process, clock, network, model, or authority effect. The
// gatherer and CLI own I/O; this module only re-derives supplied bytes.

import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { dirname, isAbsolute, relative, resolve as resolvePath } from "node:path";

export const CONTEXT_SPINE_SCHEMA = "bizra.dema.context_spine.v1";
export const CONTEXT_CONTRACT_SCHEMA_V1 = "bizra.context.contract.v1";
export const CONTEXT_CONTRACT_SCHEMA = "bizra.context.contract.v2";
export const PROJECTION_SCHEMA = "bizra.context.projection.v1";
export const CONTEXT_LOCK_SCHEMA = "bizra.context.lock.v1";
export const CONTEXT_BOUND_EVENT = "CONTEXT_BOUND";
export const SESSION_RECEIPT_EVENT = "SESSION_RECEIPT";

export const CONTEXT_PRECEDENCE = Object.freeze([
  "CONSTITUTION",
  "AUTHORITY_LEASE",
  "NODE",
  "REPOSITORY",
  "SUBTREE",
  "RESOLVED_MISSION_CONTEXT",
  "TOOL_PROJECTION",
  "SESSION_MEMORY",
  "HISTORICAL_LOG",
]);

const SCOPES = Object.freeze(["node", "repository", "subtree"]);
const NETWORK_RANK = Object.freeze({
  NONE: 0,
  LOOPBACK: 1,
  NODE_LOCAL: 2,
  BOUNDED_REMOTE: 3,
});
const LEGACY_NETWORK_MODES = Object.freeze([
  "NONE",
  "LOOPBACK_READ_ONLY",
  "LOOPBACK",
  "EXTERNAL",
]);
const DEFAULT_VALUES = Object.freeze(["ALLOW", "DENY"]);
const GRANTABILITY_VALUES = Object.freeze(["HUMAN_EXPLICIT", "NEVER"]);
const RULE_KEYS = Object.freeze([
  "context_inherited",
  "authority_human_granted",
  "evidence_observed",
  "memory_derived",
  "tool_projection_only",
]);
const AUTHORITY_KEYS = Object.freeze([
  "runtime",
  "model_invocation",
  "external_write",
  "signing",
]);
const SECRET_KEY = /(?:api[_-]?key|authorization|credential|password|private[_-]?key|secret|token)/i;

const CONSTITUTIONAL_AUTHORITY = Object.freeze({
  capabilities: Object.freeze(
    Object.fromEntries(
      AUTHORITY_KEYS.map((key) => [
        key,
        Object.freeze({ default: "DENY", grantability: "HUMAN_EXPLICIT" }),
      ]),
    ),
  ),
  network: Object.freeze({ default: "NONE", max_grantable: "BOUNDED_REMOTE" }),
  never_delegable: Object.freeze(["self_expand_authority", "fabricate_consent"]),
});

const OPERATION_CAPABILITY = Object.freeze({
  runtime: "runtime",
  model_invocation: "model_invocation",
  external_write: "external_write",
  external: "external_write",
  write: "external_write",
  signing: "signing",
  network: "network",
});

const CONSTITUTIONAL_RULES = Object.freeze(
  Object.fromEntries(RULE_KEYS.map((key) => [key, true])),
);

function isPlainObject(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (Object.getPrototypeOf(value) === Object.prototype ||
        Object.getPrototypeOf(value) === null),
  );
}

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freezeDeep(child);
  return value;
}

function hashObject(value) {
  return `sha256:${sha256(stableStringify(value))}`;
}

function hashText(value) {
  return `sha256:${sha256(String(value))}`;
}

function nonEmptyString(value, field) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value;
}

function isoString(value, field) {
  nonEmptyString(value, field);
  if (!Number.isFinite(Date.parse(value))) {
    throw new TypeError(`${field} must be an ISO timestamp`);
  }
  return value;
}

function assertAuthority(authority, field = "authority") {
  if (!isPlainObject(authority)) throw new TypeError(`${field} must be an object`);
  if (!isPlainObject(authority.capabilities)) {
    throw new TypeError(`${field}.capabilities must be an object`);
  }
  for (const key of AUTHORITY_KEYS) {
    const capability = authority.capabilities[key];
    if (!isPlainObject(capability)) throw new TypeError(`${field}.capabilities.${key} must be an object`);
    if (!DEFAULT_VALUES.includes(capability.default)) {
      throw new TypeError(`${field}.capabilities.${key}.default is invalid`);
    }
    if (!GRANTABILITY_VALUES.includes(capability.grantability)) {
      throw new TypeError(`${field}.capabilities.${key}.grantability is invalid`);
    }
    if (capability.grantability === "NEVER" && capability.default !== "DENY") {
      throw new TypeError(`${field}.capabilities.${key} hard deny must default to DENY`);
    }
  }
  if (!isPlainObject(authority.network)) throw new TypeError(`${field}.network must be an object`);
  if (!Object.hasOwn(NETWORK_RANK, authority.network.default)) {
    throw new TypeError(`${field}.network.default is invalid`);
  }
  if (!Object.hasOwn(NETWORK_RANK, authority.network.max_grantable)) {
    throw new TypeError(`${field}.network.max_grantable is invalid`);
  }
  if (NETWORK_RANK[authority.network.default] > NETWORK_RANK[authority.network.max_grantable]) {
    throw new TypeError(`${field}.network.default exceeds max_grantable`);
  }
  assertStringArray(authority.never_delegable, `${field}.never_delegable`);
  if (authority.never_delegable.length === 0) {
    throw new TypeError(`${field}.never_delegable must not be empty`);
  }
  return authority;
}

function assertLegacyAuthority(authority, field) {
  if (!isPlainObject(authority)) throw new TypeError(`${field} must be an object`);
  for (const key of AUTHORITY_KEYS) {
    if (typeof authority[key] !== "boolean") throw new TypeError(`${field}.${key} must be boolean`);
  }
  if (!LEGACY_NETWORK_MODES.includes(authority.network_mode)) {
    throw new TypeError(`${field}.network_mode is invalid`);
  }
}

function migrateV1Authority(authority) {
  const networkMode = {
    NONE: "NONE",
    LOOPBACK_READ_ONLY: "LOOPBACK",
    LOOPBACK: "NODE_LOCAL",
    EXTERNAL: "BOUNDED_REMOTE",
  }[authority.network_mode];
  return {
    capabilities: Object.fromEntries(
      AUTHORITY_KEYS.map((key) => [
        key,
        {
          default: authority[key] ? "ALLOW" : "DENY",
          grantability: "HUMAN_EXPLICIT",
        },
      ]),
    ),
    network: { default: networkMode, max_grantable: networkMode },
    never_delegable: [...CONSTITUTIONAL_AUTHORITY.never_delegable],
  };
}

function assertRules(rules, field = "rules") {
  if (!isPlainObject(rules)) throw new TypeError(`${field} must be an object`);
  for (const key of RULE_KEYS) {
    if (typeof rules[key] !== "boolean") throw new TypeError(`${field}.${key} must be boolean`);
  }
  return rules;
}

function assertStringArray(value, field) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !entry)) {
    throw new TypeError(`${field} must be an array of non-empty strings`);
  }
  return value;
}

function assertNoSecretKeys(value, path = "$", seen = new Set()) {
  if (!value || typeof value !== "object") return;
  if (seen.has(value)) throw new TypeError("context payload must not contain cycles");
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_KEY.test(key)) throw new TypeError(`secret field refused at ${path}.${key}`);
    assertNoSecretKeys(child, `${path}.${key}`, seen);
  }
  seen.delete(value);
}

function boundary() {
  return Object.freeze({
    runtime_started: false,
    model_invocation_performed: false,
    network_used: false,
    source_estate_mutation: false,
    evidence_workspace_mutation: false,
    event_log_appended: false,
    runtime_mutation: false,
    external_effect: false,
    active_effect: false,
    authority_delta: 0,
  });
}

function validMission(mission) {
  return (
    isPlainObject(mission) &&
    typeof mission.mission_id === "string" &&
    mission.mission_id.length > 0 &&
    typeof mission.contract_version === "string" &&
    mission.contract_version.length > 0 &&
    typeof mission.lease_id === "string" &&
    mission.lease_id.length > 0
  );
}

function validSession(session) {
  return (
    isPlainObject(session) &&
    typeof session.tool === "string" &&
    session.tool.length > 0 &&
    typeof session.session_id === "string" &&
    session.session_id.length > 0 &&
    typeof session.started_at === "string" &&
    Number.isFinite(Date.parse(session.started_at))
  );
}

export function parseContextContract(content, path = "BIZRA.md") {
  nonEmptyString(content, "content");
  const match = content.match(/<!--\s*BIZRA_CONTEXT\s*\n([\s\S]*?)\n\s*-->/m);
  if (!match) throw new TypeError(`CONTEXT_CONTRACT_MISSING: ${path}`);

  let contract;
  try {
    contract = JSON.parse(match[1]);
  } catch {
    throw new TypeError(`CONTEXT_CONTRACT_INVALID_JSON: ${path}`);
  }
  if (!isPlainObject(contract) || ![CONTEXT_CONTRACT_SCHEMA_V1, CONTEXT_CONTRACT_SCHEMA].includes(contract.schema)) {
    throw new TypeError(`CONTEXT_CONTRACT_SCHEMA_INVALID: ${path}`);
  }
  if (!SCOPES.includes(contract.scope)) {
    throw new TypeError(`CONTEXT_SCOPE_INVALID: ${path}`);
  }
  nonEmptyString(contract.context_id, `${path}.context_id`);
  if (contract.parent_context_id !== null) {
    nonEmptyString(contract.parent_context_id, `${path}.parent_context_id`);
  }
  const authority_migration =
    contract.schema === CONTEXT_CONTRACT_SCHEMA_V1
      ? "V1_MIGRATION_EXPLICIT"
      : null;
  const authority =
    contract.schema === CONTEXT_CONTRACT_SCHEMA_V1
      ? (assertLegacyAuthority(contract.authority_ceiling, `${path}.authority_ceiling`),
        migrateV1Authority(contract.authority_ceiling))
      : assertAuthority(contract.authority, `${path}.authority`);
  assertRules(contract.rules, `${path}.rules`);
  assertStringArray(contract.required_mission_for, `${path}.required_mission_for`);
  assertStringArray(contract.invariants, `${path}.invariants`);

  return freezeDeep({
    ...contract,
    authority,
    authority_migration,
    source_path: path,
    source_sha256: hashText(content),
  });
}

function compareAuthority(parent, current, blockedBy) {
  for (const key of AUTHORITY_KEYS) {
    if (parent.capabilities[key].default === "DENY" && current.capabilities[key].default === "ALLOW") {
      blockedBy.push("AUTHORITY_BROADENING");
    }
    if (parent.capabilities[key].grantability === "NEVER" && current.capabilities[key].grantability !== "NEVER") {
      blockedBy.push("AUTHORITY_BROADENING");
    }
  }
  if (NETWORK_RANK[current.network.default] > NETWORK_RANK[parent.network.default]) {
    blockedBy.push("AUTHORITY_BROADENING");
  }
  if (NETWORK_RANK[current.network.max_grantable] > NETWORK_RANK[parent.network.max_grantable]) {
    blockedBy.push("AUTHORITY_BROADENING");
  }
  if (parent.never_delegable.some((entry) => !current.never_delegable.includes(entry))) {
    blockedBy.push("AUTHORITY_BROADENING");
  }
}

function foldAuthority(parent, current) {
  return {
    capabilities: Object.fromEntries(
      AUTHORITY_KEYS.map((key) => [
        key,
        {
          default:
            parent.capabilities[key].default === "DENY" || current.capabilities[key].default === "DENY"
              ? "DENY"
              : "ALLOW",
          grantability:
            parent.capabilities[key].grantability === "NEVER" || current.capabilities[key].grantability === "NEVER"
              ? "NEVER"
              : "HUMAN_EXPLICIT",
        },
      ]),
    ),
    network: {
      default:
        NETWORK_RANK[current.network.default] < NETWORK_RANK[parent.network.default]
          ? current.network.default
          : parent.network.default,
      max_grantable:
        NETWORK_RANK[current.network.max_grantable] < NETWORK_RANK[parent.network.max_grantable]
          ? current.network.max_grantable
          : parent.network.max_grantable,
    },
    never_delegable: uniqueSorted([
      ...parent.never_delegable,
      ...current.never_delegable,
    ]),
  };
}

function compareRules(current, blockedBy) {
  for (const key of RULE_KEYS) {
    if (current[key] !== CONSTITUTIONAL_RULES[key]) {
      blockedBy.push("CONTEXT_CONTRADICTION");
    }
  }
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function strictDescendantPath(childSourcePath, parentSourcePath) {
  if (!isAbsolute(childSourcePath) || !isAbsolute(parentSourcePath)) return false;
  const childDirectory = resolvePath(dirname(childSourcePath));
  const parentDirectory = resolvePath(dirname(parentSourcePath));
  const descendant = relative(parentDirectory, childDirectory);
  return descendant !== "" && !descendant.startsWith("..") && !isAbsolute(descendant);
}

function validateContextGraph(contracts, blockedBy) {
  const contextIds = new Set();
  const byId = new Map();
  for (const contract of contracts) {
    if (contextIds.has(contract.context_id)) blockedBy.push("DUPLICATE_CONTEXT_ID");
    contextIds.add(contract.context_id);
    byId.set(contract.context_id, contract);
  }

  for (const contract of contracts) {
    const visited = new Set([contract.context_id]);
    let parentId = contract.parent_context_id;
    while (parentId !== null && byId.has(parentId)) {
      if (visited.has(parentId)) {
        blockedBy.push("CONTEXT_CYCLE");
        break;
      }
      visited.add(parentId);
      parentId = byId.get(parentId).parent_context_id;
    }
  }
}

export function resolveContext({
  layers,
  operation_class = "read",
  mission = null,
  memory = null,
} = {}) {
  if (!Array.isArray(layers) || layers.length === 0) {
    throw new TypeError("layers must contain at least the node context");
  }
  assertNoSecretKeys({ mission, memory });

  const blockedBy = [];
  const contracts = layers.map((layer) =>
    parseContextContract(layer.content, layer.path),
  );
  validateContextGraph(contracts, blockedBy);
  let previous = null;
  let effectiveAuthority = CONSTITUTIONAL_AUTHORITY;
  const requiredMissionFor = new Set();
  const invariants = new Set();

  for (const [index, contract] of contracts.entries()) {
    const expectedScope = index === 0 ? "node" : index === 1 ? "repository" : "subtree";
    if (contract.scope !== expectedScope) blockedBy.push("CONTEXT_SCOPE_ORDER_INVALID");
    if (!isAbsolute(contract.source_path)) blockedBy.push("CONTEXT_PATH_INVALID");

    if (previous === null) {
      if (contract.scope !== "node" || contract.parent_context_id !== null) {
        blockedBy.push("PARENT_CONTEXT_MISMATCH");
      }
    } else if (contract.parent_context_id !== previous.context_id) {
      blockedBy.push("PARENT_CONTEXT_MISMATCH");
      if (!contracts.some(({ context_id }) => context_id === contract.parent_context_id)) {
        blockedBy.push("PARENT_CONTEXT_MISSING");
        if (contract.scope === "subtree") blockedBy.push("CONTEXT_LAYER_SKIPPED");
      }
    }

    if (index >= 2) {
      const parentLayer = index === 2 ? contracts[1] : previous;
      if (!strictDescendantPath(contract.source_path, parentLayer.source_path)) {
        blockedBy.push("CONTEXT_SCOPE_ESCAPE");
        if (index > 2) blockedBy.push("CONTEXT_ORDER_NONDETERMINISTIC");
      }
    }

    compareAuthority(effectiveAuthority, contract.authority, blockedBy);
    compareRules(contract.rules, blockedBy);
    effectiveAuthority = foldAuthority(effectiveAuthority, contract.authority);
    for (const value of contract.required_mission_for) requiredMissionFor.add(value);
    for (const value of contract.invariants) invariants.add(value);
    previous = contract;
  }

  const contextChain = contracts.map((contract) => ({
    scope: contract.scope,
    path: contract.source_path,
    context_id: contract.context_id,
    source_sha256: contract.source_sha256,
  }));
  const effectiveContext = {
    schema: CONTEXT_SPINE_SCHEMA,
    context_id: previous.context_id,
    precedence: CONTEXT_PRECEDENCE,
    context_chain: contextChain,
    authority: effectiveAuthority,
    required_mission_for: uniqueSorted(requiredMissionFor),
    invariants: uniqueSorted(invariants),
  };
  const effectiveContextSha256 = hashObject(effectiveContext);
  const capability = OPERATION_CAPABILITY[operation_class];
  const operationAuthority = capability
    ? capability === "network"
      ? effectiveAuthority.network
      : effectiveAuthority.capabilities[capability]
    : null;
  const operationDefaultDenied =
    operationAuthority?.default === "DENY" ||
    (capability === "network" && operationAuthority?.default === "NONE");
  const missionRequired = requiredMissionFor.has(operation_class) || operationDefaultDenied;
  const hardDenied =
    operationAuthority?.grantability === "NEVER" ||
    (capability === "network" && operationAuthority?.max_grantable === "NONE");
  const declaredLease = validMission(mission);
  if (hardDenied) {
    blockedBy.push("AUTHORITY_HARD_DENY");
  } else if (operationDefaultDenied && !declaredLease) {
    blockedBy.push("DEFAULT_DENY_WITHOUT_LEASE");
  }
  if (missionRequired && !declaredLease) blockedBy.push("MISSION_REQUIRED");

  const authorityStatus = capability
    ? {
        capability,
        decision: hardDenied
          ? "HARD_DENY"
          : capability === "network" && declaredLease
            ? "ELIGIBLE_FOR_BOUNDED_SCOPE_ADJUDICATION"
            : declaredLease
              ? "ELIGIBLE_UNDER_STRUCTURALLY_VALID_DECLARED_LEASE"
              : "DEFAULT_DENY_WITHOUT_LEASE",
        lease_structure: declaredLease ? "VALID" : "ABSENT",
        human_authenticity: "UNATTESTED",
        lease_freshness: "UNATTESTED",
        actor_identity_assurance: declaredLease ? "DECLARED" : "UNKNOWN",
        active_effect: false,
        context_network_max_grantable:
          capability === "network" ? operationAuthority?.max_grantable ?? null : null,
        network_scope_adjudication:
          capability !== "network"
            ? "NOT_APPLICABLE"
            : hardDenied
              ? "NOT_PERMITTED"
              : declaredLease
                ? "REQUIRED"
                : "NOT_REACHED",
        active_network_effect: capability === "network" ? false : null,
      }
    : { capability: null, decision: "NOT_APPLICABLE" };

  const memoryStatus =
    memory === null
      ? "NOT_SUPPLIED"
      : memory.effective_context_sha256 === effectiveContextSha256
        ? "CORROBORATED"
        : "SUPERSEDED";

  const result = {
    schema: CONTEXT_SPINE_SCHEMA,
    ok: blockedBy.length === 0,
    blocked_by: uniqueSorted(blockedBy),
    context_chain: contextChain,
    effective_context: effectiveContext,
    effective_context_sha256: effectiveContextSha256,
    mission_required: missionRequired,
    authority_status: authorityStatus,
    mission: declaredLease
      ? {
          mission_id: mission.mission_id,
          contract_version: mission.contract_version,
          lease_id: mission.lease_id,
        }
      : null,
    memory_status: memoryStatus,
    authority_delta: 0,
    active_effect: false,
    boundary: boundary(),
  };
  return freezeDeep(result);
}

export function verifyResolvedContext(result, input) {
  const blockedBy = [];
  let rederived;
  try {
    rederived = resolveContext(input);
  } catch (error) {
    return { ok: false, blocked_by: [error.message] };
  }
  if (!result || result.schema !== CONTEXT_SPINE_SCHEMA) blockedBy.push("SCHEMA_MISMATCH");
  if (result?.effective_context_sha256 !== rederived.effective_context_sha256) {
    blockedBy.push("EFFECTIVE_CONTEXT_HASH_MISMATCH");
  }
  if (stableStringify(result?.effective_context) !== stableStringify(rederived.effective_context)) {
    blockedBy.push("EFFECTIVE_CONTEXT_DERIVATION_MISMATCH");
  }
  if (stableStringify(result?.context_chain) !== stableStringify(rederived.context_chain)) {
    blockedBy.push("CONTEXT_CHAIN_MISMATCH");
  }
  if (stableStringify(result?.blocked_by) !== stableStringify(rederived.blocked_by)) {
    blockedBy.push("BLOCKED_BY_MISMATCH");
  }
  if (result?.mission_required !== rederived.mission_required) {
    blockedBy.push("MISSION_REQUIREMENT_MISMATCH");
  }
  if (stableStringify(result?.authority_status) !== stableStringify(rederived.authority_status)) {
    blockedBy.push("AUTHORITY_STATUS_MISMATCH");
  }
  if (result?.authority_delta !== 0 || stableStringify(result?.boundary) !== stableStringify(boundary())) {
    blockedBy.push("BOUNDARY_VIOLATION");
  }
  return { ok: blockedBy.length === 0 && rederived.ok === result?.ok, blocked_by: uniqueSorted(blockedBy) };
}

function projectionMetadata(target, resolved) {
  if (!resolved?.ok) throw new TypeError("cannot project a blocked context");
  if (!['codex', 'claude'].includes(target)) throw new TypeError("projection target is invalid");
  return {
    schema: PROJECTION_SCHEMA,
    projection_target: target,
    source_chain: resolved.context_chain,
    effective_context_sha256: resolved.effective_context_sha256,
    authority: "projection_only",
    authority_delta: 0,
  };
}

export function renderProjection({ target, resolved } = {}) {
  const metadata = projectionMetadata(target, resolved);
  const filename = target === "codex" ? "AGENTS.md" : "CLAUDE.md";
  return [
    "<!-- BIZRA_PROJECTION",
    stableStringify(metadata),
    "-->",
    "",
    `# ${filename}`,
    "",
    "GENERATED — DO NOT EDIT DIRECTLY.",
    "",
    "This compatibility projection is derived from the effective BIZRA context chain.",
    "Read the nearest BIZRA.md source and docs/LLM_SYSTEM_FLOW.md before acting.",
    "",
    `Effective context: ${resolved.effective_context_sha256}`,
    "Precedence: constitution → authority lease → node → repository → subtree → mission → projection → memory → history.",
    "",
    "Non-negotiables:",
    "- Dema is the face, not the whole system.",
    "- No runtime execution, hidden daemon, implicit model invocation, or external provider call by default.",
    "- Exact-string consent only; tool availability and memory do not grant authority.",
    "- Current disk evidence outranks transcripts, memory, and historical logs.",
    "- Lower context layers may narrow or specialize, never broaden authority or contradict canon.",
    "- Local state stays under DEMA_HOME or ~/.dema; receipts are read/list here and governed runtime issues them.",
    "",
    "Run the narrowest targeted check first, then the repository gates; report UNKNOWN and BLOCKED honestly.",
    "",
  ].join("\n");
}

export function verifyProjection(content, { target, resolved } = {}) {
  try {
    const expected = renderProjection({ target, resolved });
    return content === expected
      ? { ok: true, blocked_by: [] }
      : { ok: false, blocked_by: ["PROJECTION_DRIFT"] };
  } catch (error) {
    return { ok: false, blocked_by: [error.message] };
  }
}

export function buildContextLock({
  resolved,
  physical_state,
  mission = null,
  session,
  observed_at_iso,
  projection_targets = ["codex", "claude"],
} = {}) {
  if (!resolved?.ok) throw new TypeError("cannot lock a blocked context");
  assertNoSecretKeys({ physical_state, mission, session });
  if (!isPlainObject(physical_state)) throw new TypeError("physical_state is required");
  for (const key of ["cwd", "repo_root", "repo", "branch", "head", "tree", "dirty_digest"]) {
    nonEmptyString(physical_state[key], `physical_state.${key}`);
  }
  if (!validMission(mission)) throw new TypeError("mission is required for a context lock");
  if (!validSession(session)) throw new TypeError("session is required for a context lock");
  isoString(observed_at_iso, "observed_at_iso");
  assertStringArray(projection_targets, "projection_targets");

  const body = {
    schema: CONTEXT_LOCK_SCHEMA,
    context_id: resolved.effective_context.context_id,
    effective_context_sha256: resolved.effective_context_sha256,
    context_chain: resolved.context_chain,
    physical_state: {
      cwd: physical_state.cwd,
      repo_root: physical_state.repo_root,
      repo: physical_state.repo,
      branch: physical_state.branch,
      head: physical_state.head,
      tree: physical_state.tree,
      dirty_digest: physical_state.dirty_digest,
    },
    mission: {
      mission_id: mission.mission_id,
      contract_version: mission.contract_version,
      lease_id: mission.lease_id,
    },
    session: {
      tool: session.tool,
      session_id: session.session_id,
      started_at: session.started_at,
    },
    projection_targets: [...projection_targets].sort(),
    authority_delta: 0,
    boundary: boundary(),
    observed_at_iso,
  };
  return freezeDeep({ ...body, lock_hash: hashObject(body) });
}

export function verifyContextLock(lock, { resolved, physical_state } = {}) {
  const blockedBy = [];
  try {
    assertNoSecretKeys(lock);
    if (!lock || lock.schema !== CONTEXT_LOCK_SCHEMA) blockedBy.push("SCHEMA_MISMATCH");
    if (lock?.authority_delta !== 0) blockedBy.push("AUTHORITY_DELTA_NONZERO");
    if (stableStringify(lock?.boundary) !== stableStringify(boundary())) blockedBy.push("BOUNDARY_VIOLATION");
    const { lock_hash, ...body } = lock ?? {};
    if (!lock_hash || lock_hash !== hashObject(body)) blockedBy.push("LOCK_HASH_MISMATCH");
    if (resolved && lock?.effective_context_sha256 !== resolved.effective_context_sha256) {
      blockedBy.push("EFFECTIVE_CONTEXT_HASH_MISMATCH");
    }
    if (physical_state && stableStringify(lock?.physical_state) !== stableStringify({
      cwd: physical_state.cwd,
      repo_root: physical_state.repo_root,
      repo: physical_state.repo,
      branch: physical_state.branch,
      head: physical_state.head,
      tree: physical_state.tree,
      dirty_digest: physical_state.dirty_digest,
    })) {
      blockedBy.push("PHYSICAL_STATE_MISMATCH");
    }
  } catch (error) {
    blockedBy.push(error.message);
  }
  return { ok: blockedBy.length === 0, blocked_by: uniqueSorted(blockedBy) };
}

function primitiveSummary(summary) {
  if (summary === undefined) return {};
  if (!isPlainObject(summary)) throw new TypeError("summary must be an object");
  const output = {};
  const reserved = new Set([
    "event_type",
    "context_id",
    "effective_context_sha256",
    "lock_hash",
    "repo_root",
    "head",
    "tree",
    "dirty_digest",
    "tool",
    "session_id",
    "mission_id",
    "lease_id",
    "authority_delta",
  ]);
  for (const [key, value] of Object.entries(summary)) {
    if (SECRET_KEY.test(key)) throw new TypeError(`secret summary field refused: ${key}`);
    if (reserved.has(key)) throw new TypeError(`reserved summary field refused: ${key}`);
    if (value !== null && !["string", "number", "boolean"].includes(typeof value)) {
      throw new TypeError(`summary.${key} must be primitive`);
    }
    output[key] = value;
  }
  return output;
}

export function buildContextEvent({
  event_type,
  lock,
  session,
  outcome = "ok",
  summary,
  recorded_at_iso,
} = {}) {
  if (![CONTEXT_BOUND_EVENT, SESSION_RECEIPT_EVENT].includes(event_type)) {
    throw new TypeError("event_type is invalid");
  }
  if (!validSession(session)) throw new TypeError("session is required");
  if (!lock || lock.schema !== CONTEXT_LOCK_SCHEMA) throw new TypeError("valid lock is required");
  const lockVerification = verifyContextLock(lock);
  if (!lockVerification.ok) {
    throw new TypeError(`invalid context lock: ${lockVerification.blocked_by.join(",")}`);
  }
  if (!["ok", "error", "refused"].includes(outcome)) throw new TypeError("outcome is invalid");
  const physical = lock.physical_state;
  const mission = lock.mission;
  const metadata = {
    event_type,
    context_id: lock.context_id,
    effective_context_sha256: lock.effective_context_sha256,
    lock_hash: lock.lock_hash,
    repo_root: physical.repo_root,
    head: physical.head,
    tree: physical.tree,
    dirty_digest: physical.dirty_digest,
    tool: session.tool,
    session_id: session.session_id,
    mission_id: mission.mission_id,
    lease_id: mission.lease_id,
    authority_delta: 0,
    ...primitiveSummary(summary),
  };
  const event = {
    command: event_type,
    outcome,
    correlation_id: session.session_id,
    boundary: boundary(),
    metadata,
  };
  if (recorded_at_iso !== undefined) event.recorded_at_iso = isoString(recorded_at_iso, "recorded_at_iso");
  return freezeDeep(event);
}
