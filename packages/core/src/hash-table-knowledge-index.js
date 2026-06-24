import { sha256, stableStringify } from "../../consent/src/consent-common.js";

export const HASH_TABLE_KNOWLEDGE_INDEX_SCHEMA = "bizra.dema.hash_table_knowledge_index.v0.1";

export const HASH_TABLE_AXES = Object.freeze([
  "component",
  "claim",
  "module",
  "insight",
  "risk",
  "decision",
]);

const AXIS_SET = new Set(HASH_TABLE_AXES);

const CANONICAL_BOUNDARY = Object.freeze({
  runtime_execution_performed: false,
  file_write_performed: false,
  model_invocation_performed: false,
  network_call_performed: false,
  self_modification_performed: false,
  autonomous_loop_started: false,
  signing_performed: false,
  key_generation_performed: false,
  mint_performed: false,
  token_or_reward_activated: false,
  poi_activation_performed: false,
  federation_started: false,
  mcp_runtime_started: false,
  a2a_runtime_started: false,
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEvidence(evidence) {
  if (!Array.isArray(evidence)) return [];
  return Object.freeze([...new Set(evidence.map(text).filter(Boolean))].sort());
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return Object.freeze([]);
  return Object.freeze([...new Set(tags.map(text).filter(Boolean).map((tag) => tag.toLowerCase()))].sort());
}

function reject(reason_code, details = {}) {
  return deepFreeze({ valid: false, rejected: true, reason_code, ...details });
}

export function normalizeKnowledgeEntry(entry, index = 0) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return reject("entry_malformed", { index });
  }
  const axis = text(entry.axis).toLowerCase();
  if (!AXIS_SET.has(axis)) return reject("axis_unknown", { axis, index });
  const key = text(entry.key).toLowerCase();
  if (!key) return reject("key_required", { axis, index });
  const id = text(entry.id) || `${axis}:${key}`;
  const evidence = normalizeEvidence(entry.evidence ?? entry.evidence_anchors);
  if (evidence.length === 0) return reject("evidence_required", { id, axis, key, index });
  const body = {
    id,
    axis,
    key,
    title: text(entry.title) || key,
    summary: text(entry.summary),
    evidence,
    tags: normalizeTags(entry.tags),
    status: text(entry.status) || "provided",
  };
  return deepFreeze({ ...body, entry_hash: sha256(stableStringify(body)) });
}

function bucketId(axis, key) {
  return sha256(stableStringify({ axis, key }));
}

function emptyBuckets() {
  return Object.fromEntries(HASH_TABLE_AXES.map((axis) => [axis, {}]));
}

function sortEntry(a, b) {
  return a.axis.localeCompare(b.axis) || a.key.localeCompare(b.key) || a.id.localeCompare(b.id);
}

export function buildHashTableKnowledgeIndex({ entries = [], namespace = "node0" } = {}) {
  if (!Array.isArray(entries)) return reject("entries_must_be_array");
  const normalized = [];
  const seenIds = new Set();
  for (let i = 0; i < entries.length; i += 1) {
    const n = normalizeKnowledgeEntry(entries[i], i);
    if (!n.entry_hash) return n;
    if (seenIds.has(n.id)) return reject("duplicate_entry_id", { id: n.id });
    seenIds.add(n.id);
    normalized.push(n);
  }
  normalized.sort(sortEntry);

  const buckets = emptyBuckets();
  for (const entry of normalized) {
    const id = bucketId(entry.axis, entry.key);
    const bucket = buckets[entry.axis][id] ?? {
      bucket_id: id,
      axis: entry.axis,
      key: entry.key,
      entries: [],
    };
    bucket.entries.push(entry);
    buckets[entry.axis][id] = bucket;
  }

  for (const axis of HASH_TABLE_AXES) {
    for (const [id, bucket] of Object.entries(buckets[axis])) {
      bucket.entries.sort((a, b) => a.id.localeCompare(b.id));
      buckets[axis][id] = {
        ...bucket,
        entry_count: bucket.entries.length,
        bucket_hash: sha256(stableStringify({ axis: bucket.axis, key: bucket.key, entries: bucket.entries.map((entry) => entry.entry_hash) })),
      };
    }
  }

  const body = {
    schema: HASH_TABLE_KNOWLEDGE_INDEX_SCHEMA,
    truth_label: "HASH_TABLE_KNOWLEDGE_INDEX_LIVE_KERNEL",
    mode: "DETERMINISTIC_INDEX_ONLY",
    namespace: text(namespace) || "node0",
    axes: HASH_TABLE_AXES,
    entry_count: normalized.length,
    entries: normalized,
    buckets,
    boundary: { ...CANONICAL_BOUNDARY },
    what_this_proves: Object.freeze([
      "Entries can be normalized into deterministic multi-axis buckets.",
      "Each entry and bucket is content-addressed for replayable review.",
      "Queries are local in-memory lookups over supplied data only.",
    ]),
    what_this_does_not_prove: Object.freeze([
      "This is not a database, vector index, memory daemon, crawler, or autonomous retrieval system.",
      "It does not read files, write files, call a model, call a network, sign, mint, reward, or federate.",
      "It does not prove semantic truth; it indexes claims and evidence anchors supplied by the caller.",
    ]),
  };

  return deepFreeze({
    ...body,
    index_hash: sha256(stableStringify(body)),
  });
}

export function queryHashTableKnowledgeIndex({ index, axis, key } = {}) {
  const verification = verifyHashTableKnowledgeIndex(index);
  if (!verification.valid) return verification;
  const normalizedAxis = text(axis).toLowerCase();
  if (!AXIS_SET.has(normalizedAxis)) return reject("axis_unknown", { axis: normalizedAxis });
  const normalizedKey = text(key).toLowerCase();
  if (!normalizedKey) return reject("key_required", { axis: normalizedAxis });
  const id = bucketId(normalizedAxis, normalizedKey);
  const bucket = index.buckets[normalizedAxis][id] ?? null;
  return deepFreeze({
    valid: true,
    axis: normalizedAxis,
    key: normalizedKey,
    bucket_id: id,
    found: Boolean(bucket),
    entries: bucket ? bucket.entries : Object.freeze([]),
    reason_code: bucket ? "bucket_found" : "bucket_not_found",
  });
}

export function verifyHashTableKnowledgeIndex(index) {
  if (!index || typeof index !== "object" || Array.isArray(index)) return reject("index_malformed");
  const blocked_by = [];
  if (index.schema !== HASH_TABLE_KNOWLEDGE_INDEX_SCHEMA) blocked_by.push("schema_mismatch");
  if (index.truth_label !== "HASH_TABLE_KNOWLEDGE_INDEX_LIVE_KERNEL") blocked_by.push("truth_label_mismatch");
  if (!Array.isArray(index.axes) || stableStringify(index.axes) !== stableStringify(HASH_TABLE_AXES)) blocked_by.push("axes_mismatch");
  if (!index.boundary || typeof index.boundary !== "object") blocked_by.push("boundary_missing");
  else {
    for (const [key, value] of Object.entries(index.boundary)) {
      if (value !== false) blocked_by.push(`boundary_not_false:${key}`);
    }
  }
  if (!Array.isArray(index.entries)) blocked_by.push("entries_missing");
  else {
    const ids = new Set();
    for (const entry of index.entries) {
      if (!entry || typeof entry !== "object") {
        blocked_by.push("entry_malformed");
        continue;
      }
      if (ids.has(entry.id)) blocked_by.push(`duplicate_entry_id:${entry.id}`);
      ids.add(entry.id);
      const { entry_hash, ...body } = entry;
      if (!entry_hash || sha256(stableStringify(body)) !== entry_hash) blocked_by.push(`entry_hash_mismatch:${entry.id ?? "unknown"}`);
      if (!AXIS_SET.has(entry.axis)) blocked_by.push(`axis_unknown:${entry.axis}`);
      if (!Array.isArray(entry.evidence) || entry.evidence.length === 0) blocked_by.push(`evidence_required:${entry.id ?? "unknown"}`);
    }
  }
  const { index_hash, ...body } = index;
  if (!index_hash || sha256(stableStringify(body)) !== index_hash) blocked_by.push("index_hash_mismatch");
  if (blocked_by.length > 0) return deepFreeze({ valid: false, rejected: true, reason_code: "hash_table_index_invalid", blocked_by });
  return deepFreeze({ valid: true, rejected: false, reason_code: "hash_table_index_valid", entry_count: index.entry_count, index_hash: index.index_hash });
}
