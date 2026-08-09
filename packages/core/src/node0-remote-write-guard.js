// NODE0-SOURCE-LISTENER-SCAN-1A — which inbound surfaces are declared in source?
//
// NOT ML. NOT runtime. NOT a firewall. This classifies supplied source evidence;
// it opens nothing, closes nothing, and blocks nothing at runtime.
//
// WHY THIS EXISTS. The first version tried to source the `remote_write`
// closure invariant from this scan. Scope review proved that promotion invalid:
// source declarations cannot establish deployment state. The scan remains
// useful only after its result and vocabulary are kept at source scope.
//
// THE PROVABLE HALF. A complete scan can report whether the listed listener,
// server-script, and non-read-method-route declarations occur in the inspected
// artifacts. A clear source scan is useful evidence about source, not proof that
// a deployed node has no remote mutation path.
//
// WHAT THIS DELIBERATELY DOES NOT PROVE. Absence of an inbound socket is not
// absence of every external write path. It says nothing about another local
// process writing to DEMA_HOME, a cloud-sync daemon replaying a directory, a
// git remote fetched by a local action, or a mounted share. Those are
// deployment surfaces, not source properties, and reporting this guard as if it
// covered them would be exactly the overclaim the invariant exists to catch.

export const NODE0_REMOTE_WRITE_GUARD_SCHEMA =
  "bizra.dema.node0_source_listener_scan.v0.2";
export const NODE0_REMOTE_WRITE_GUARD_TRUTH_LABEL = "MEASURED_LOCAL";

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
  Object.freeze({
    id: "next_server_script",
    pattern: /\bnext\s+(?:dev|start)\b|\.next\/standalone\/.+\/server\.js\b/,
    path_pattern: /(?:^|[\\/])package\.json$/,
    inspect_raw: true,
  }),
  Object.freeze({
    id: "non_read_method_route",
    pattern: /\bexport\s+(?:async\s+)?function\s+(?:POST|PUT|PATCH|DELETE)\s*\(/,
    path_pattern: /(?:^|[\\/])route\.(?:js|mjs|cjs|ts|tsx)$/,
  }),
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
 * Pure. Classifies listener declarations in already-read source artifacts.
 *
 * @param {{
 *   files: Array<{path: string, source: string}>,
 *   coverage_issues?: Array<{id: string, path: string|null}>
 * }} evidence
 */
export function evaluateRemoteWriteGuard(evidence = {}) {
  const files = Array.isArray(evidence.files) ? evidence.files : [];
  const coverageIssues = Array.isArray(evidence.coverage_issues)
    ? [...evidence.coverage_issues]
    : [];
  const findings = [];

  for (const file of files) {
    if (typeof file?.source !== "string" || typeof file?.path !== "string") {
      coverageIssues.push({ path: file?.path ?? null, id: "unreadable_file" });
      continue;
    }
    const code = stripNonCode(file.source);
    for (const { id, pattern, path_pattern, inspect_raw } of INBOUND_LISTENER_PATTERNS) {
      if (path_pattern && !path_pattern.test(file.path)) continue;
      const inspected = inspect_raw ? file.source : code;
      if (pattern.test(inspected)) findings.push({ path: file.path, id });
    }
  }

  // A scan of nothing finds nothing. Without this, an empty or broken gatherer
  // would report the strongest possible security result — the exact shape of a
  // vacuous pass.
  const scanned = files.length;
  const vacuous = scanned === 0;
  const coverage_complete = coverageIssues.length === 0;

  const source_listener_detected = findings.length > 0;

  return Object.freeze({
    schema: NODE0_REMOTE_WRITE_GUARD_SCHEMA,
    truth_label: NODE0_REMOTE_WRITE_GUARD_TRUTH_LABEL,
    source_listener_detected,
    // These statuses classify the narrow scan only. They are deliberately not
    // SATISFIED/VIOLATED, which are closure-invariant verdicts.
    status:
      source_listener_detected
        ? "FINDINGS"
        : vacuous || !coverage_complete
        ? "UNKNOWN"
        : "CLEAR",
    vacuous,
    coverage_complete,
    coverage_issues: Object.freeze(
      coverageIssues.map((issue) => Object.freeze({ ...issue })),
    ),
    files_scanned: scanned,
    listener_findings: Object.freeze(findings),
    patterns_checked: INBOUND_LISTENER_PATTERNS.length,
    what_this_proves:
      "Whether the inspected source and manifest artifacts contain any listed listener, server-script, or non-read-method route declaration.",
    what_this_does_not_prove:
      "Does not prove the absence of every external write path: another local process writing under DEMA_HOME, a cloud-sync daemon, a mounted share, or a git remote fetched by a local action are deployment surfaces, not source properties.",
  });
}

/// A source listener scan is not a deployment-level remote-write observation.
/// Keep this compatibility adapter fail-closed so existing callers cannot turn
/// "no listed syntax found" into proof that every local, mounted, synced, or
/// runtime write path is absent. A future deployment instrument may replace
/// this only when it covers the full invariant scope.
export function remoteWriteObservation(_report) {
  return null;
}
