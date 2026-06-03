// OBS-1A · Observability event-log kernel.
//
// A pure, LOCAL-ONLY, content-addressed + hash-chained event log. It is the
// observability layer the SPARC audit flagged as the weakest pillar (no
// structured event trail), built WITHOUT a network daemon and WITHOUT
// auto-instrumenting dispatch — events are recorded only when a caller
// explicitly emits one. Honors BIZRA's local-first / no-surveillance stance.
//
// Three units:
//   buildEvent()  — pure builder → frozen, schema-tagged, content-addressed
//                   record. Redacted BY CONSTRUCTION: accepts a command NAME,
//                   an outcome enum, a correlation_id, a boundary-attestation
//                   map, and a PRIMITIVES-ONLY metadata map — never raw argv or
//                   content. Fail-closed on missing/invalid input.
//   appendEvent() — appends one JSON line to $DEMA_HOME/events/log.jsonl,
//                   chaining prev_hash to the previous entry's event_id
//                   (genesis = null) for tamper evidence. Local fs only.
//   readEvents()  — read-only replay: re-derives each event_id (content
//                   integrity) and verifies the prev_hash chain. Never throws
//                   on a corrupt line — skips and flags it.
//
// REUSES (no duplication): sha256, stableStringify  packages/consent/src/consent-common.js
// No network. No keys. No consent. No CLI.

import { existsSync, mkdirSync, appendFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";

export const EVENT_LOG_SCHEMA = "bizra.dema.event_log_entry.v0.1";

const VALID_OUTCOMES = Object.freeze(["ok", "error", "refused"]);
const MAX_METADATA_KEYS = 32;
const MAX_METADATA_STRING = 256;

function isNonEmptyString(v) {
  return typeof v === "string" && v.length > 0;
}

// Redaction guard: every value in an attestation/metadata map must be a scalar
// primitive. Objects, arrays, and functions are rejected so raw argv or content
// can never be smuggled into a record. Strings are length-capped.
function assertPrimitiveMap(map, label) {
  if (map === undefined) return {};
  if (map === null || typeof map !== "object" || Array.isArray(map)) {
    throw new TypeError(`event-log: ${label} must be a plain object`);
  }
  const keys = Object.keys(map);
  if (keys.length > MAX_METADATA_KEYS) {
    throw new RangeError(
      `event-log: ${label} exceeds ${MAX_METADATA_KEYS} keys`,
    );
  }
  for (const k of keys) {
    const v = map[k];
    const ok =
      v === null ||
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean";
    if (!ok) {
      throw new TypeError(
        `event-log: ${label}.${k} must be a primitive (no nested content)`,
      );
    }
    if (typeof v === "string" && v.length > MAX_METADATA_STRING) {
      throw new RangeError(
        `event-log: ${label}.${k} exceeds ${MAX_METADATA_STRING} chars`,
      );
    }
  }
  return map;
}

function freezeMap(map) {
  const out = {};
  for (const k of Object.keys(map).sort()) out[k] = map[k];
  return Object.freeze(out);
}

export function buildEvent({
  command,
  outcome,
  correlation_id,
  boundary,
  metadata,
  recorded_at_iso,
} = {}) {
  if (!isNonEmptyString(command)) {
    throw new TypeError("event-log: command (non-empty string) is required");
  }
  if (!VALID_OUTCOMES.includes(outcome)) {
    throw new TypeError(
      `event-log: outcome must be one of ${VALID_OUTCOMES.join("|")}`,
    );
  }
  if (!isNonEmptyString(correlation_id)) {
    throw new TypeError(
      "event-log: correlation_id (non-empty string) is required",
    );
  }
  const safeBoundary = freezeMap(assertPrimitiveMap(boundary, "boundary"));
  const safeMetadata = freezeMap(assertPrimitiveMap(metadata, "metadata"));

  const body = Object.freeze({
    schema: EVENT_LOG_SCHEMA,
    recorded_at_iso: recorded_at_iso || new Date().toISOString(),
    command,
    outcome,
    correlation_id,
    boundary: safeBoundary,
    metadata: safeMetadata,
  });
  const event_id = sha256(stableStringify(body));
  return Object.freeze({ ...body, event_id });
}

// Recompute the content-address of an appended entry (exclude chain + id fields).
function contentEventId(entry) {
  const body = {
    schema: entry.schema,
    recorded_at_iso: entry.recorded_at_iso,
    command: entry.command,
    outcome: entry.outcome,
    correlation_id: entry.correlation_id,
    boundary: entry.boundary ?? {},
    metadata: entry.metadata ?? {},
  };
  return sha256(stableStringify(body));
}

function logPathFor(home) {
  return join(home, "events", "log.jsonl");
}

function readLines(path) {
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, "utf8");
  return raw.split("\n").filter((l) => l.trim().length > 0);
}

export function appendEvent({ home, event }) {
  if (!isNonEmptyString(home)) {
    throw new TypeError("event-log: home (DEMA_HOME path) is required");
  }
  if (
    !event ||
    event.schema !== EVENT_LOG_SCHEMA ||
    !isNonEmptyString(event.event_id)
  ) {
    throw new TypeError(
      "event-log: a valid event (from buildEvent) is required",
    );
  }
  const path = logPathFor(home);
  mkdirSync(dirname(path), { recursive: true });

  const existing = readLines(path);
  let prev_hash = null;
  if (existing.length > 0) {
    try {
      prev_hash = JSON.parse(existing[existing.length - 1]).event_id ?? null;
    } catch {
      prev_hash = null;
    }
  }

  const record = { ...event, prev_hash };
  appendFileSync(path, JSON.stringify(record) + "\n");
  return Object.freeze({
    path,
    event_id: event.event_id,
    line_number: existing.length + 1,
    prev_hash,
  });
}

export function readEvents({ home, limit } = {}) {
  const path = logPathFor(home);
  const lines = readLines(path);

  const entries = [];
  let corrupt_lines = 0;
  let verified = true;
  let chain_intact = true;
  let prevId = null;

  for (const line of lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      corrupt_lines += 1;
      continue;
    }
    if (contentEventId(entry) !== entry.event_id) verified = false;
    const expectedPrev = entries.length === 0 ? null : prevId;
    if ((entry.prev_hash ?? null) !== expectedPrev) chain_intact = false;
    prevId = entry.event_id;
    entries.push(Object.freeze(entry));
  }

  const out =
    Number.isInteger(limit) && limit > 0 ? entries.slice(-limit) : entries;
  return Object.freeze({
    entries: out,
    count: entries.length,
    verified,
    chain_intact,
    corrupt_lines,
  });
}
