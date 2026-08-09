// NODE0-REMOTE-WRITE-GUARD-1A — can anything outside push state into this node?
//
// NOT ML. NOT runtime. NOT a firewall. This decides one closure invariant from
// supplied source evidence; it opens nothing, closes nothing, and blocks nothing
// at runtime.
//
// WHY THIS EXISTS. `remote_write` is one of the ten closure invariants and the
// ONLY one with no guard anywhere in the tree — measured 2026-08-09: every other
// closure capability had an implementation under some name, this one had none.
// An invariant nothing checks is a sentence, and a sentence cannot refuse.
//
// THE PROVABLE HALF. Dema is a CLI. It has no server. So the strongest
// mechanical claim is CAPABILITY ABSENCE: if no source file can bind a
// listening socket, then no external party can open a connection to this node
// and mutate it — there is nothing to connect to. That is checkable from
// source, deterministic, and cannot be satisfied by belief.
//
// WHAT THIS DELIBERATELY DOES NOT PROVE. Absence of an inbound socket is not
// absence of every external write path. It says nothing about another local
// process writing to DEMA_HOME, a cloud-sync daemon replaying a directory, a
// git remote fetched by a local action, or a mounted share. Those are
// deployment surfaces, not source properties, and reporting this guard as if it
// covered them would be exactly the overclaim the invariant exists to catch.

export const NODE0_REMOTE_WRITE_GUARD_SCHEMA =
  "bizra.dema.node0_remote_write_guard.v0.1";
export const NODE0_REMOTE_WRITE_GUARD_TRUTH_LABEL = "IMPLEMENTED_LOCAL";

/// Kept as data so a reader can audit the scan surface without reading control
/// flow, and so adding a vector is a one-line reviewable change.
export const INBOUND_LISTENER_PATTERNS = Object.freeze([
  Object.freeze({ id: "http_server", pattern: /\bhttps?\s*\.\s*createServer\s*\(/ }),
  Object.freeze({ id: "net_server", pattern: /\bnet\s*\.\s*createServer\s*\(/ }),
  Object.freeze({ id: "tls_server", pattern: /\btls\s*\.\s*createServer\s*\(/ }),
  Object.freeze({ id: "socket_listen", pattern: /\.\s*listen\s*\(/ }),
  Object.freeze({ id: "websocket_server", pattern: /\bWebSocketServer\b/ }),
  Object.freeze({ id: "http2_server", pattern: /\bhttp2\s*\.\s*create(Secure)?Server\s*\(/ }),
  Object.freeze({ id: "runtime_serve", pattern: /\b(Deno|Bun)\s*\.\s*serve\s*\(/ }),
]);

/// A comment or a string mentioning a pattern is not a listener. The probe
/// files in this tree literally contain "fetch(" as a string because they scan
/// OTHER code for it — counting that as capability would be a false positive of
/// exactly the kind this guard is supposed to prevent.
function stripNonCode(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/`(?:\\.|[^`\\])*`/g, "``");
}

/**
 * Pure. Decides the `remote_write` invariant from already-read source files.
 *
 * @param {{files: Array<{path: string, source: string}>}} evidence
 */
export function evaluateRemoteWriteGuard(evidence = {}) {
  const files = Array.isArray(evidence.files) ? evidence.files : [];
  const findings = [];

  for (const file of files) {
    if (typeof file?.source !== "string" || typeof file?.path !== "string") {
      findings.push({ path: file?.path ?? null, id: "unreadable_file" });
      continue;
    }
    const code = stripNonCode(file.source);
    for (const { id, pattern } of INBOUND_LISTENER_PATTERNS) {
      if (pattern.test(code)) findings.push({ path: file.path, id });
    }
  }

  // A scan of nothing finds nothing. Without this, an empty or broken gatherer
  // would report the strongest possible security result — the exact shape of a
  // vacuous pass.
  const scanned = files.length;
  const vacuous = scanned === 0;

  const remote_write = findings.length > 0;

  return Object.freeze({
    schema: NODE0_REMOTE_WRITE_GUARD_SCHEMA,
    truth_label: NODE0_REMOTE_WRITE_GUARD_TRUTH_LABEL,
    // The invariant's required value is FALSE: no inbound write surface.
    remote_write,
    // UNKNOWN when the scan proved nothing, so absence of findings can never be
    // mistaken for absence of capability.
    status: vacuous ? "UNKNOWN" : remote_write ? "VIOLATED" : "SATISFIED",
    vacuous,
    files_scanned: scanned,
    listener_findings: Object.freeze(findings),
    patterns_checked: INBOUND_LISTENER_PATTERNS.length,
    what_this_proves:
      "Whether this node's own source contains any capability to bind an inbound listening socket.",
    what_this_does_not_prove:
      "Does not prove the absence of every external write path: another local process writing under DEMA_HOME, a cloud-sync daemon, a mounted share, or a git remote fetched by a local action are deployment surfaces, not source properties.",
  });
}

/// Produces the sourced observation the closure-invariant kernel consumes, so
/// the verdict carries where it came from rather than a bare boolean.
export function remoteWriteObservation(report) {
  if (!report || report.vacuous) return null;
  return Object.freeze({
    observed: report.remote_write,
    source: `node0-remote-write-guard: ${report.files_scanned} files, ${report.patterns_checked} patterns, ${report.listener_findings.length} finding(s)`,
  });
}
