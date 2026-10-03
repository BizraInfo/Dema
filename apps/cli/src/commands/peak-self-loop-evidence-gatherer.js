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
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const SIGNAL_EVENTS_FLAG = "--signal-events-json";
const SIGNAL_EVENTS_PREFIX = `${SIGNAL_EVENTS_FLAG}=`;

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

function looksLikeDemaRepoRoot(candidate) {
  try {
    const pkgPath = join(candidate, "package.json");
    if (!existsSync(pkgPath)) return false;
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    if (pkg?.name === "@bizra/dema-root") return true;
    return (
      existsSync(join(candidate, "apps", "cli")) &&
      existsSync(join(candidate, "packages", "core"))
    );
  } catch {
    return false;
  }
}

/** Module-anchored checkout root (apps/cli/src/commands → repo root). */
export function moduleAnchoredRepoRoot(
  moduleUrl = import.meta.url,
) {
  return resolve(dirname(fileURLToPath(moduleUrl)), "../../../..");
}

/**
 * Prefer a Dema checkout discovered by walking up from `startDir`.
 * Fall back to the module-anchored checkout so a nested cwd still binds
 * against the real repo, and an arbitrary non-repo cwd cannot invent one.
 */
export function resolvePeakSelfLoopRepoRoot({
  startDir = process.cwd(),
  moduleUrl = import.meta.url,
} = {}) {
  let cursor = resolve(startDir);
  for (;;) {
    if (looksLikeDemaRepoRoot(cursor)) return cursor;
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  const anchored = moduleAnchoredRepoRoot(moduleUrl);
  if (looksLikeDemaRepoRoot(anchored)) return anchored;
  return null;
}

export function bindPeakSelfLoopSignalEvents(
  events,
  {
    repoRoot,
    readFileImpl = readFileSync,
    realpathImpl = realpathSync,
    startDir = process.cwd(),
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

  const resolvedRoot =
    typeof repoRoot === "string" && repoRoot.trim() !== ""
      ? repoRoot
      : resolvePeakSelfLoopRepoRoot({ startDir });

  if (resolvedRoot == null) {
    return Object.freeze({
      admitted: Object.freeze([]),
      rejected: Object.freeze([
        Object.freeze({ id: null, reason: "repo_root_unresolvable" }),
      ]),
      complete: false,
    });
  }

  let rootReal;
  try {
    rootReal = realpathImpl(resolvedRoot);
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

function parseSignalEventsJsonValue(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return Object.freeze({
        provided: true,
        events: Object.freeze([]),
        error: "signal_events_json_not_array",
      });
    }
    return Object.freeze({ provided: true, events: parsed, error: null });
  } catch {
    return Object.freeze({
      provided: true,
      events: Object.freeze([]),
      error: "signal_events_json_invalid",
    });
  }
}

export function parsePeakSelfLoopSignalEventsArg(argv = []) {
  const values = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (typeof arg !== "string") continue;
    if (arg.startsWith(SIGNAL_EVENTS_PREFIX)) {
      values.push(arg.slice(SIGNAL_EVENTS_PREFIX.length));
      continue;
    }
    if (arg === SIGNAL_EVENTS_FLAG) {
      const next = argv[i + 1];
      if (typeof next !== "string" || next.startsWith("--")) {
        return Object.freeze({
          provided: true,
          events: Object.freeze([]),
          error: "signal_events_json_missing",
        });
      }
      values.push(next);
      i += 1;
    }
  }

  if (values.length === 0) {
    return Object.freeze({
      provided: false,
      events: Object.freeze([]),
      error: null,
    });
  }
  if (values.length !== 1) {
    return Object.freeze({
      provided: true,
      events: Object.freeze([]),
      error: "signal_events_arg_duplicate",
    });
  }
  return parseSignalEventsJsonValue(values[0]);
}
