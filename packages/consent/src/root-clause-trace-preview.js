// DEMA-ROOT-CLAUSE-TRACE-REGISTRY-PREVIEW-1A — PREVIEW_ONLY root-clause trace +
// fail-closed verifier over a hand-reviewed Three-Root Canon clause registry.
//
// PREVIEW_ONLY. This kernel derives a content-addressed `root_set_hash` from a
// selected set of hand-reviewed root clauses (drawn from The Message / الرسالة,
// The Seed / البذرة, and The Third Fact). That `root_set_hash` is the value the
// already-shipped consent envelope (DEMA-ROOT-BOUND-CONSENT-ENVELOPE-PREVIEW-1A)
// consumes as its `root_set_hash`, so a consent binding can point at actual named
// clauses instead of an opaque hash.
//
// It RECORDS/VERIFIES a clause selection ONLY. It runs no optimizer, invokes no
// model, opens no network, performs no live mutation, mints nothing, binds no
// identity, and enforces no live governance. The clause summaries are human
// paraphrases — NOT the authoritative encoding of the roots (those are sealed
// under docs/root-canon/ with their own manifest).
//
// Core law: a valid root trace must carry at least one clause from EACH of the
// three roots, and every carried clause_hash must match the registry's hash of
// that clause's summary — otherwise the trace is BLOCKed.
//
// Pure kernel: no fs / net / http / child_process / fetch, no Date.now, no
// Math.random. The registry is INJECTED by the caller (the review gate / tests
// read the JSON and pass the parsed object). Content addressing uses node:crypto.
// Boundary is the canonical all-false preview boundary; every claim is a preview.

import { createHash } from "node:crypto";

import {
  buildPreviewBoundary,
  isCanonicalBoundary,
} from "../../core/src/boundary-schema.js";

export const ROOT_CLAUSE_TRACE_SCHEMA = "bizra.consent.root_trace.v0.1";
export const ROOT_CLAUSE_TRACE_EVAL_SCHEMA = "bizra.consent.root_trace_eval.v0.1";
export const ROOT_CLAUSE_TRACE_TRUTH_LABEL = "PREVIEW_ONLY";

// The three roots that must ALL be represented in any valid trace.
export const REQUIRED_ROOTS = Object.freeze(["MESSAGE", "SEED", "THIRD_FACT"]);

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hashText(value) {
  return `sha256:${sha256(String(value))}`;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashBody(body) {
  return `sha256:${sha256(stableStringify(body))}`;
}

function str(value) {
  if (typeof value === "string") return value;
  return value == null ? "" : String(value);
}

function freezeDeep(value) {
  if (!value || typeof value !== "object") return value;
  for (const child of Object.values(value)) freezeDeep(child);
  if (!Object.isFrozen(value)) Object.freeze(value);
  return value;
}

// All-false canonical preview boundary. Deriving/verifying a root trace is never
// executing it — every effect key stays false.
export function rootClauseTraceBoundary() {
  return buildPreviewBoundary();
}

// Validate and normalize an injected registry object (parsed JSON). Throws only
// on a structurally broken registry (a missing clauses[] array) — that is a
// programming/authoring error, not a runtime verdict. Per-selection failures are
// handled fail-closed by verifyRootTrace, never by a throw.
export function loadClauseRegistry(registryObject) {
  const registry = registryObject && typeof registryObject === "object" ? registryObject : {};
  if (!Array.isArray(registry.clauses)) {
    throw new Error("root-clause registry missing clauses[]");
  }
  return freezeDeep({
    schema: str(registry.schema),
    version: str(registry.version),
    truth_label: str(registry.truth_label),
    required_roots: [...REQUIRED_ROOTS],
    clauses: registry.clauses.map((c) => ({
      clause_id: str(c?.clause_id),
      root: str(c?.root),
      summary: str(c?.summary),
      clause_hash: str(c?.clause_hash),
    })),
  });
}

function indexRegistry(registry) {
  const clauses = Array.isArray(registry?.clauses) ? registry.clauses : [];
  const byId = new Map();
  for (const c of clauses) {
    if (c && typeof c === "object") byId.set(str(c.clause_id), c);
  }
  return byId;
}

// The canonical clause set the root_set_hash is taken over. Only the carried
// fields (clause_id, root, clause_hash) — never the raw summary — enter the hash.
// Sorted by clause_id so selection order never changes the address.
function hashClauseSet(clauses) {
  const body = {
    required_roots: [...REQUIRED_ROOTS],
    clauses: [...clauses]
      .map((c) => ({
        clause_id: str(c?.clause_id),
        root: c?.root ?? null,
        clause_hash: c?.clause_hash ?? null,
      }))
      .sort((a, b) => a.clause_id.localeCompare(b.clause_id)),
  };
  return hashBody(body);
}

// Build a content-addressed root trace from a selection of clause ids against an
// injected registry. Each carried clause is exactly {clause_id, root, clause_hash};
// clause_hash is DERIVED from the registry summary (content-addressed), never the
// raw summary text. An unknown id is carried with root:null / clause_hash:null so
// the fail-closed verifier can flag it. Deterministic: identical input → deep-equal
// trace + identical root_set_hash.
export function buildRootTrace({ clause_ids, registry } = {}) {
  const byId = indexRegistry(registry);
  const ids = Array.isArray(clause_ids) ? clause_ids.map(str) : [];
  const clauses = ids
    .map((id) => {
      const rc = byId.get(id);
      if (!rc) return { clause_id: id, root: null, clause_hash: null };
      return { clause_id: id, root: str(rc.root), clause_hash: hashText(rc.summary) };
    })
    .sort((a, b) => str(a.clause_id).localeCompare(str(b.clause_id)));

  return freezeDeep({
    schema: ROOT_CLAUSE_TRACE_SCHEMA,
    truth_label: ROOT_CLAUSE_TRACE_TRUTH_LABEL,
    required_roots: [...REQUIRED_ROOTS],
    clauses,
    root_set_hash: hashClauseSet(clauses),
    boundary: rootClauseTraceBoundary(),
    authority_delta: 0,
  });
}

// Fail-closed verification. A trace PERMITs only when: it is non-empty, every
// clause resolves to a registry clause, every carried clause_hash matches the
// registry's hash of that summary, every carried root matches the registry, ALL
// three roots are represented, the recomputed root_set_hash matches the carried
// one, and the boundary is the canonical all-false object. Any failure BLOCKs.
// authority_delta is always 0 — verifying a trace grants no authority.
export function verifyRootTrace({ trace, registry } = {}) {
  const boundary = rootClauseTraceBoundary();
  const blocked_by = [];

  const t = trace && typeof trace === "object" ? trace : null;
  const byId = indexRegistry(registry);
  if (!t) blocked_by.push("trace_invalid");
  if (byId.size === 0) blocked_by.push("registry_empty");

  if (t) {
    if (str(t.schema) !== ROOT_CLAUSE_TRACE_SCHEMA) blocked_by.push("schema_mismatch");

    const clauses = Array.isArray(t.clauses) ? t.clauses : [];
    if (clauses.length === 0) blocked_by.push("empty_clause_set");

    const rootsPresent = new Set();
    for (const c of clauses) {
      const id = str(c?.clause_id);
      const rc = byId.get(id);
      if (!rc) {
        blocked_by.push("unknown_clause");
        continue;
      }
      if (str(c?.clause_hash) !== hashText(rc.summary)) blocked_by.push("clause_hash_mismatch");
      if (str(c?.root) !== str(rc.root)) blocked_by.push("clause_root_mismatch");
      rootsPresent.add(str(rc.root));
    }

    for (const root of REQUIRED_ROOTS) {
      if (!rootsPresent.has(root)) blocked_by.push("three_root_set_incomplete");
    }

    if (!/^sha256:[0-9a-f]{64}$/.test(str(t.root_set_hash))) {
      blocked_by.push("root_set_hash_missing");
    } else if (str(t.root_set_hash) !== hashClauseSet(clauses)) {
      blocked_by.push("root_set_hash_mismatch");
    }

    if (!isCanonicalBoundary(t.boundary)) blocked_by.push("boundary_invalid");
  }

  const deduped = [...new Set(blocked_by)];
  const accepted = deduped.length === 0;
  return Object.freeze({
    schema: ROOT_CLAUSE_TRACE_EVAL_SCHEMA,
    truth_label: ROOT_CLAUSE_TRACE_TRUTH_LABEL,
    accepted,
    verdict: accepted ? "PERMIT_PREVIEW" : "BLOCK",
    reason: accepted ? "root_trace_permitted" : deduped[0],
    blocked_by: Object.freeze(deduped),
    boundary,
    authority_delta: 0,
  });
}

// Alias for callers preferring the evaluate* name.
export const evaluateRootTrace = verifyRootTrace;

// Orchestrator the review gate consumes: pick the first clause of each root from
// the injected registry, build a valid trace and PERMIT it, then self-probe that
// a selection dropping THIRD_FACT is BLOCKed for three_root_set_incomplete.
// Boundary stays all-false; authority_delta stays 0.
export function runRootClauseTracePreview({ registry } = {}) {
  const boundary = rootClauseTraceBoundary();
  const base = {
    schema: ROOT_CLAUSE_TRACE_EVAL_SCHEMA,
    truth_label: ROOT_CLAUSE_TRACE_TRUTH_LABEL,
    boundary,
    authority_delta: 0,
  };

  const clauses = Array.isArray(registry?.clauses) ? registry.clauses : [];
  const pick = {};
  for (const c of clauses) {
    const root = str(c?.root);
    if (REQUIRED_ROOTS.includes(root) && !(root in pick)) pick[root] = str(c?.clause_id);
  }
  const validIds = REQUIRED_ROOTS.map((r) => pick[r]).filter(Boolean);
  if (validIds.length !== REQUIRED_ROOTS.length) {
    return Object.freeze({
      ...base,
      ok: false,
      blocked_by: Object.freeze(["registry_missing_required_root_clause"]),
    });
  }

  const validTrace = buildRootTrace({ clause_ids: validIds, registry });
  const permit = verifyRootTrace({ trace: validTrace, registry });
  if (!permit.accepted) {
    return Object.freeze({
      ...base,
      ok: false,
      blocked_by: Object.freeze(["valid_trace_not_permitted", ...permit.blocked_by]),
    });
  }

  const incompleteIds = validIds.filter((id) => id !== pick.THIRD_FACT);
  const block = verifyRootTrace({
    trace: buildRootTrace({ clause_ids: incompleteIds, registry }),
    registry,
  });
  if (block.accepted || !block.blocked_by.includes("three_root_set_incomplete")) {
    return Object.freeze({
      ...base,
      ok: false,
      blocked_by: Object.freeze(["incomplete_roots_not_blocked"]),
    });
  }

  return Object.freeze({
    ...base,
    ok: true,
    verdict: permit.verdict,
    root_set_hash: validTrace.root_set_hash,
    blocked_by: Object.freeze([]),
  });
}
