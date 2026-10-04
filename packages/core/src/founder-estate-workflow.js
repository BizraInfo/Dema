// Founder Estate First Light: one bounded, metadata-only read path.
// Reuses local-asset-awareness; it does not read file contents or mutate roots.

import { isAbsolute, resolve } from "node:path";
import { homedir } from "node:os";
import { buildLocalAssetInventory } from "./local-asset-awareness.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";

export const BIZRA_ESTATE_CAPABILITY_ID = "OBSERVE_BIZRA_ESTATE_METADATA";
export const BIZRA_ESTATE_CAPABILITY_SCHEMA = "bizra.dema.founder_estate_capability.v0.1";
export const BIZRA_ESTATE_OBSERVATION_SCHEMA = "bizra.dema.founder_estate_observation.v0.1";
export const BIZRA_ESTATE_REPORT_SCHEMA = "bizra.dema.founder_estate_report.v0.1";

export const DEFAULT_ESTATE_ROOTS = Object.freeze([
  "/home/bizra-operating-system/bizra-home",
  "/home/bizra-operating-system/Downloads/Dema",
  "/home/bizra-operating-system/bizra-worktrees",
  "/home/bizra-operating-system/.campaigns",
]);

export const DEFAULT_ESTATE_LIMITS = Object.freeze({
  max_depth: 2,
  // Keep the canonical observation below the 1 MiB evidence envelope while
  // preserving explicit truncation/proof-ceiling semantics for larger estates.
  max_entries: 500,
});

export const ESTATE_EXCLUSIONS = Object.freeze([
  ".git",
  "node_modules",
  ".ssh",
  ".gnupg",
  ".env and .env.* files",
  "wallet, credential, password, token, secret and key paths",
  "private keys and browser profiles",
]);

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freezeDeep(child);
  return value;
}

function numberOr(value, fallback, minimum) {
  return Number.isInteger(value) && value >= minimum ? value : fallback;
}

function normalizedRoots(roots) {
  if (!Array.isArray(roots) || roots.length === 0) throw new TypeError("estate_roots_required");
  const out = [];
  for (const value of roots) {
    if (typeof value !== "string" || !value.trim() || !isAbsolute(value)) {
      throw new TypeError("estate_root_must_be_absolute");
    }
    const path = resolve(value);
    if (path === "/" || path === homedir() || path === "/home/bizra-operating-system") {
      throw new TypeError("estate_root_too_broad");
    }
    if (!out.includes(path)) out.push(path);
  }
  return out;
}

export function resolveFounderEstateRoots(env = process.env) {
  const configured = typeof env?.BIZRA_ESTATE_ROOTS === "string" && env.BIZRA_ESTATE_ROOTS.trim()
    ? env.BIZRA_ESTATE_ROOTS.split(/[:\n]/).map((root) => root.trim()).filter(Boolean)
    : DEFAULT_ESTATE_ROOTS;
  return Object.freeze(normalizedRoots(configured));
}

export function buildEstateCapability({ roots = resolveFounderEstateRoots(), limits = {} } = {}) {
  const normalized = normalizedRoots(roots);
  const max_depth = numberOr(limits.max_depth ?? limits.maxDepth, DEFAULT_ESTATE_LIMITS.max_depth, 0);
  const max_entries = numberOr(limits.max_entries ?? limits.maxEntries, DEFAULT_ESTATE_LIMITS.max_entries, 1);
  return freezeDeep({
    schema: BIZRA_ESTATE_CAPABILITY_SCHEMA,
    id: BIZRA_ESTATE_CAPABILITY_ID,
    effect_class: "READ_ONLY",
    authority_class: "LOCAL_READ_ONLY",
    roots: normalized.map((path) => ({
      path,
      reason: "configured BIZRA/Node0 estate root",
      path_hash: sha256CanonicalJsonV1({ path }),
    })),
    limits: { max_depth, max_entries },
    symlink_policy: "DO_NOT_FOLLOW",
    content_policy: "METADATA_ONLY",
    exclusions: ESTATE_EXCLUSIONS,
    expected_writes: "NONE",
    network: "NONE",
    model_required: false,
  });
}

export function isBizraEstateIntent(text) {
  if (typeof text !== "string") return false;
  const lower = text.toLowerCase();
  const estateTerm = /\b(?:bizra|dema)\b/.test(lower) && /\b(?:asset|estate|file|folder|repo(?:sitory)?|project|workspace|research|organize|map|inspect|understand)\w*/.test(lower);
  return estateTerm && !/^\s*(?:delete|remove|destroy|move|rename|push|merge|deploy|publish)\b/i.test(text);
}

function actionPolarity(sourceText, index) {
  const clauseStart = Math.max(
    sourceText.lastIndexOf(".", index),
    sourceText.lastIndexOf("!", index),
    sourceText.lastIndexOf("?", index),
    sourceText.lastIndexOf(";", index),
    sourceText.lastIndexOf("\n", index),
  );
  const clause = sourceText.slice(clauseStart + 1, index + 1).toLowerCase();
  const negated = /\b(?:do\s+not|don't|dont|never|must\s+not|no)\b/.test(clause);
  const conditionalAfter = sourceText.slice(index + 1, sourceText.length).split(/[.!?;\n]/, 1)[0];
  const ambiguous = negated && /\b(?:unless|except|if|when)\b/.test(`${clause} ${conditionalAfter}`);
  return { negated, ambiguous };
}

const CONSEQUENTIAL_ACTIONS = Object.freeze([
  ["transfer", /\b(?:transfer|send|pay|withdraw)\b/gi],
  ["purchase", /\b(?:purchase|buy|sell)\b/gi],
  ["delete", /\b(?:delete|remove|destroy)\b/gi],
  ["file_move", /\bmove\b/gi],
  ["file_rename", /\brename\b/gi],
  ["publish", /\b(?:publish|post|deploy)\b/gi],
  ["repository_write", /\b(?:push|merge)\b/gi],
  ["key_operation", /\b(?:sign|rotate\s+(?:the\s+)?key|mint)\b/gi],
  ["execute", /\b(?:execute|run)\b/gi],
]);

const UNKNOWN_CONSEQUENTIAL = /\b(?:irreversible|external\s+side\s+effect|real[- ]world\s+action)\b/gi;

export function classifyConsequentialLanguage(text) {
  const requested_actions = [];
  const prohibited_actions = [];
  const ambiguous_actions = [];
  for (const [action, expression] of CONSEQUENTIAL_ACTIONS) {
    expression.lastIndex = 0;
    for (const match of text.matchAll(expression)) {
      const index = match.index ?? 0;
      const polarity = actionPolarity(text, index);
      const item = {
        action,
        token: match[0],
        index,
        consent_required: true,
      };
      if (polarity.ambiguous) ambiguous_actions.push({ ...item, ambiguity: "negation_with_condition" });
      else if (polarity.negated) prohibited_actions.push({ ...item, prohibition: "FORBIDDEN_BY_USER" });
      else requested_actions.push(item);
    }
  }
  UNKNOWN_CONSEQUENTIAL.lastIndex = 0;
  for (const match of text.matchAll(UNKNOWN_CONSEQUENTIAL)) {
    const index = match.index ?? 0;
    const polarity = actionPolarity(text, index);
    const item = { action: "unknown_consequential_action", token: match[0], index, consent_required: true };
    if (polarity.ambiguous) ambiguous_actions.push({ ...item, ambiguity: "negation_with_condition" });
    else if (polarity.negated) prohibited_actions.push({ ...item, prohibition: "FORBIDDEN_BY_USER" });
    else requested_actions.push(item);
  }
  return {
    requested_actions: requested_actions.sort((a, b) => a.index - b.index || a.action.localeCompare(b.action)),
    prohibited_actions: prohibited_actions.sort((a, b) => a.index - b.index || a.action.localeCompare(b.action)),
    ambiguous_actions: ambiguous_actions.sort((a, b) => a.index - b.index || a.action.localeCompare(b.action)),
  };
}

function rootTotals(inventories) {
  const totals = { records_count: 0, files_count: 0, dirs_count: 0, symlinks_count: 0, denied_count: 0, truncated: false };
  const categories = {};
  for (const inventory of inventories) {
    for (const key of Object.keys(totals)) {
      if (key === "truncated") totals.truncated ||= inventory.summary?.truncated === true;
      else totals[key] += inventory.summary?.[key] ?? 0;
    }
    for (const [category, count] of Object.entries(inventory.categories ?? {})) categories[category] = (categories[category] ?? 0) + count;
  }
  return { totals, categories };
}

export async function buildEstateObservation({ capability = buildEstateCapability(), now = new Date(), scanner = buildLocalAssetInventory } = {}) {
  if (capability?.id !== BIZRA_ESTATE_CAPABILITY_ID) throw new TypeError("estate_capability_invalid");
  const inventories = [];
  for (const root of capability.roots) {
    inventories.push(await scanner({
      root: root.path,
      now,
      limits: { maxDepth: capability.limits.max_depth, maxEntries: capability.limits.max_entries },
    }));
  }
  const { totals, categories } = rootTotals(inventories);
  const body = {
    schema: BIZRA_ESTATE_OBSERVATION_SCHEMA,
    truth_label: "FOUNDER_ESTATE_METADATA_MEASURED",
    capability,
    observed_at_iso: now.toISOString(),
    root_results: inventories,
    totals,
    categories,
    boundary: {
      read_only: true,
      file_content_read: false,
      scanned_root_mutated: false,
      symlink_followed: false,
      network_used: false,
      model_invoked: false,
      delete_or_move_performed: false,
      expected_writes: "NONE",
      authority_delta: 0,
    },
  };
  return freezeDeep({ ...body, result_hash: sha256CanonicalJsonV1(body) });
}

function representativeRecords(observation) {
  return observation.root_results.flatMap((inventory) =>
    (inventory.records ?? []).filter((record) => record.kind === "file" || record.name === "package.json").slice(0, 12).map((record) => ({
      root: inventory.root.display,
      relative_path: record.relative_path,
      category: record.category,
      size_bytes: record.size_bytes,
      mtime_iso: record.mtime_iso,
      truth_label: "MEASURED",
    })),
  ).slice(0, 40);
}

/**
 * @param {{observation: object, missionId: string, sourceText: string, evidenceRef?: string|null}} input
 */
export function buildEstateFounderReport({ observation, missionId, sourceText, evidenceRef = null } = {}) {
  if (!observation || observation.schema !== BIZRA_ESTATE_OBSERVATION_SCHEMA) throw new TypeError("estate_observation_invalid");
  const missingRoots = observation.root_results.filter((inventory) => inventory.root?.exists !== true).map((inventory) => inventory.root?.display ?? "UNKNOWN");
  const deniedReasons = [...new Set(observation.root_results.flatMap((inventory) => (inventory.denied ?? []).map((entry) => entry.reason)))].sort();
  const report = {
    schema: BIZRA_ESTATE_REPORT_SCHEMA,
    truth_label: "FOUNDER_ESTATE_REPORT_MEASURED_WITH_INFERENCES",
    mission_id: missionId,
    source_text: sourceText,
    capability_id: BIZRA_ESTATE_CAPABILITY_ID,
    what_i_looked_at: {
      roots: observation.capability.roots,
      limits: observation.capability.limits,
      exclusions: observation.capability.exclusions,
      symlink_policy: observation.capability.symlink_policy,
      content_policy: observation.capability.content_policy,
    },
    what_i_found: {
      totals: observation.totals,
      categories: observation.categories,
      representative_records: representativeRecords(observation),
    },
    what_i_could_not_see: {
      missing_roots: missingRoots,
      denied_reasons: deniedReasons,
      truncated: observation.totals.truncated,
      note: observation.totals.truncated
        ? "The result is partial because one or more bounded scans reached their entry limit."
        : "Denied and excluded paths remain outside this observation.",
    },
    what_looks_important: {
      measured: Object.entries(observation.categories).filter(([, count]) => count > 0).map(([category, count]) => `${category}: ${count}`),
      inferred: [
        "Multiple roots indicate a fragmented estate surface.",
        "Potential duplicates are NOT proven by metadata-only observation.",
      ],
    },
    what_i_did: "READ_ONLY_METADATA_OBSERVATION",
    what_i_did_not_do: [
      "No move.",
      "No rename.",
      "No delete.",
      "No file-content ingestion.",
      "No network.",
      "No model invocation.",
    ],
    proof: {
      observation_hash: observation.result_hash,
      evidence_ref: evidenceRef,
      authority_delta: 0,
      claim_ceiling: observation.totals.truncated ? "BOUNDED_PARTIAL_METADATA_OBSERVATION" : "BOUNDED_METADATA_OBSERVATION",
    },
    next: "Review the measured estate map, then choose one bounded read-only follow-up.",
    boundary: observation.boundary,
  };
  return freezeDeep(report);
}

export function capabilityIsEquivalent(left, right) {
  return sha256CanonicalJsonV1(left) === sha256CanonicalJsonV1(right);
}
