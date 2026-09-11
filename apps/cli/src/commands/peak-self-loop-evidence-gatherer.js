// PEAK-EVIDENCE-BINDING-GATHERER-1A — read-only caller-side evidence binding.
//
// The pure peak-self-loop kernel intentionally cannot read source_ref. This
// gatherer is the IO seam: it resolves each repo-relative source, refuses
// containment escape (including symlink escape), re-derives sha256 from the
// actual bytes, and admits an event only when the declared digest matches.
//
// No mutation, network, process execution, clock, random, model, wallet, or
// token authority is present here.

import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

function eventId(event) {
  return event && typeof event === "object" && !Array.isArray(event)
    ? (event.id ?? null)
    : null;
}

function frozenRejection(event, reason) {
  return Object.freeze({ id: eventId(event), reason });
}

function isContained(rootReal, targetReal) {
  const rel = relative(rootReal, targetReal);
  return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`));
}

export function bindPeakSelfLoopSignalEvents(
  events,
  {
    repoRoot = process.cwd(),
    readFileImpl = readFileSync,
    realpathImpl = realpathSync,
  } = {},
) {
  if (!Array.isArray(events)) {
    return Object.freeze({
      admitted: Object.freeze([]),
      rejected: Object.freeze([
        Object.freeze({ id: null, reason: "signal_events_not_array" }),
      ]),
      complete: false,
    });
  }

  let rootReal;
  try {
    rootReal = realpathImpl(repoRoot);
  } catch {
    return Object.freeze({
      admitted: Object.freeze([]),
      rejected: Object.freeze([
        Object.freeze({ id: null, reason: "repo_root_unreadable" }),
      ]),
      complete: false,
    });
  }

  const admitted = [];
  const rejected = [];

  for (const event of events) {
    if (!event || typeof event !== "object" || Array.isArray(event)) {
      rejected.push(frozenRejection(event, "event_not_object"));
      continue;
    }
    if (typeof event.source_ref !== "string" || event.source_ref.trim() === "") {
      rejected.push(frozenRejection(event, "source_ref_missing"));
      continue;
    }
    if (isAbsolute(event.source_ref)) {
      rejected.push(frozenRejection(event, "source_ref_absolute_forbidden"));
      continue;
    }
    if (
      typeof event.source_sha256 !== "string" ||
      !SHA256_PATTERN.test(event.source_sha256)
    ) {
      rejected.push(frozenRejection(event, "source_sha256_missing_or_malformed"));
      continue;
    }

    const candidate = resolve(rootReal, event.source_ref);
    let targetReal;
    try {
      targetReal = realpathImpl(candidate);
    } catch {
      rejected.push(frozenRejection(event, "source_unreadable_or_missing"));
      continue;
    }

    if (!isContained(rootReal, targetReal)) {
      rejected.push(frozenRejection(event, "source_outside_repo"));
      continue;
    }

    let bytes;
    try {
      bytes = readFileImpl(targetReal);
    } catch {
      rejected.push(frozenRejection(event, "source_unreadable_or_missing"));
      continue;
    }

    const actualSha256 = createHash("sha256").update(bytes).digest("hex");
    if (actualSha256 !== event.source_sha256) {
      rejected.push(frozenRejection(event, "source_hash_mismatch"));
      continue;
    }

    admitted.push(Object.freeze({ ...event }));
  }

  return Object.freeze({
    admitted: Object.freeze(admitted),
    rejected: Object.freeze(rejected),
    complete: rejected.length === 0,
  });
}

export function parsePeakSelfLoopSignalEventsArg(argv = []) {
  const prefix = "--signal-events-json=";
  const matches = argv.filter(
    (arg) => typeof arg === "string" && arg.startsWith(prefix),
  );

  if (matches.length === 0) {
    return Object.freeze({ provided: false, events: Object.freeze([]), error: null });
  }
  if (matches.length !== 1) {
    return Object.freeze({ provided: true, events: Object.freeze([]), error: "signal_events_arg_duplicate" });
  }

  try {
    const parsed = JSON.parse(matches[0].slice(prefix.length));
    if (!Array.isArray(parsed)) {
      return Object.freeze({ provided: true, events: Object.freeze([]), error: "signal_events_json_not_array" });
    }
    return Object.freeze({ provided: true, events: parsed, error: null });
  } catch {
    return Object.freeze({ provided: true, events: Object.freeze([]), error: "signal_events_json_invalid" });
  }
}
