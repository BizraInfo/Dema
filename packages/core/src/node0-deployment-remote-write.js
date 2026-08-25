// NODE0-DEPLOYMENT-REMOTE-WRITE-1A — the instrument for `remote_write`, the last
// closure row and the only one that never had a guard anywhere.
//
// The invariant asks: "Can any external party silently mutate local sovereign
// state? It must not." A source scan cannot answer that — it can read code and
// never see a mount, a listener, or a sync daemon. That is why
// `remoteWriteObservation()` in node0-remote-write-guard.js returns null and why
// this row stayed UNKNOWN while nine others closed.
//
// What it needs is a DEPLOYMENT observation: listeners, route authority, writable
// state roots, sync/mount paths, and process authority. Every one of those is a
// property of THIS machine. None requires the internet, a second node, or anyone
// else's hardware — you do not prove "nothing writes in from outside" by going
// outside, you prove it by measuring your own exposure.
//
// PURE. No fs, no net, no process. It is handed a gathered surface and judges it.
// The gathering must happen where the numbers are true: inside a PID- or
// network-namespaced sandbox the machine looks almost empty, and reporting "no
// listeners, no processes" from there would be the worst false GREEN available —
// on the row that governs whether outsiders can write into the node. So an
// observer that admits it is namespaced is refused rather than believed.
//
// THE ROOTS. The three genesis documents are the most sovereign state on the
// machine, anchored in Bitcoin blocks 948027-948029. A root file that is WRITABLE
// is an external write path even when the writer is the operator himself, by his
// explicit instruction 2026-08-19: the roots must not be changeable even by him.
// A root only he can rewrite is still a root that can be rewritten, and the
// generation this protects is not present to object.

export const NODE0_DEPLOYMENT_REMOTE_WRITE_SCHEMA =
  "bizra.dema.node0_deployment_remote_write_observation.v0.1";

/** Must equal the invariant's `required_scope` or the row can never settle. */
export const NODE0_DEPLOYMENT_REMOTE_WRITE_SCOPE = "node0_deployment_remote_write";

export const NODE0_DEPLOYMENT_REMOTE_WRITE_TRANSACTION_ID =
  "node0-deployment-remote-write-proof";

export const REMOTE_WRITE_VERDICTS = Object.freeze([
  "NO_EXTERNAL_WRITE_PATH",
  "EXTERNAL_WRITE_PATH_PRESENT",
  "INCOMPLETE",
]);

/** All five must be measured. A missing facet is INCOMPLETE, never clean. */
export const REQUIRED_FACETS = Object.freeze([
  "listeners",
  "mounts",
  "state_roots",
  "process_authority",
  "root_files",
]);

/** The genesis documents, by name. Absence of any is INCOMPLETE. */
export const ROOT_FILE_NAMES = Object.freeze([
  "bizra.pdf",
  "themassage.pdf",
  "BIZRA_Third_Fact_v0_1_FINAL.pdf",
]);

/** Filesystems through which another party can write without a local process. */
export const SYNC_FSTYPE_RE = /gvfs|fuse\.|nfs|cifs|smb|sshfs|davfs|s3fs|rclone/i;

/**
 * Correlation taxonomy (REMOTE-WRITE-CORRELATION-CONTRACT-1A, operator audit
 * 2026-08-25): ExternalReachability ≠ ExternalWriteAuthority.
 *
 * DIRECT kinds bind an external write capability to sovereign state BY
 * STRUCTURE — the route or the permission is itself measured, so a single one
 * asserts EXTERNAL_WRITE_PATH_PRESENT.
 *
 * REACHABILITY-ONLY kinds prove exposure without proving a write route to
 * sovereign state (who owns the socket? does its protocol write? does it reach
 * state?). Alone they settle NOTHING: INCOMPLETE with a named reason — which
 * blocks closure exactly as hard as VIOLATED, but claims no uncorrelated
 * causal fact. Trace ≠ Diagnosis until correlation is earned.
 */
export const DIRECT_WRITE_FINDING_KINDS = Object.freeze([
  "sync_mount_over_state_root",
  "writable_state_root",
  "writable_root_file",
  "root_file_under_sync_mount",
  "root_file_hash_drift",
]);
export const REACHABILITY_ONLY_FINDING_KINDS = Object.freeze([
  "non_loopback_listener",
]);

const LOOPBACK_RE = /^(127\.|::1$|localhost$)/i;
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const arr = (v) => (Array.isArray(v) ? v : null);

const out = (verdict, reason, findings = []) =>
  Object.freeze({
    verdict,
    reason,
    external_write_path_present: verdict === "EXTERNAL_WRITE_PATH_PRESENT",
    findings: Object.freeze(findings),
  });

/**
 * Judge a gathered deployment surface.
 *
 * Returns `external_write_path_present`, which the adapter hands to the ledger as
 * `observed`. The invariant declares `required: false`, so a surface with no
 * external write path scores SATISFIED and one with a correlated write path
 * scores VIOLATED — a real refutation, not silence. A surface with only
 * reachability findings (exposure without an established write route to
 * sovereign state) scores INCOMPLETE: it settles nothing, which keeps the row
 * UNKNOWN and Node0 OPEN without asserting an uncorrelated causal fact.
 */
export function evaluateDeploymentSurface(surface) {
  if (!isObj(surface)) return out("INCOMPLETE", "no_surface");

  const measured = arr(surface.measured_facets) ?? [];
  const missing = REQUIRED_FACETS.filter((f) => !measured.includes(f));
  if (missing.length) {
    return out("INCOMPLETE", `facet_unmeasured:${missing.join(",")}`);
  }

  // An observer that cannot see the machine cannot certify it. This is the
  // sandbox condition, and it must refuse rather than report a clean surface.
  const pa = surface.process_authority;
  if (!isObj(pa) || typeof pa.visible_pids !== "number") {
    return out("INCOMPLETE", "process_authority_unmeasured");
  }
  if (pa.namespace_isolated === true) {
    return out("INCOMPLETE", "observer_namespace_isolated_cannot_certify");
  }

  const listeners = arr(surface.listeners);
  const mounts = arr(surface.mounts);
  const stateRoots = arr(surface.state_roots);
  const rootFiles = arr(surface.root_files);
  if (!listeners || !mounts || !stateRoots || !rootFiles) {
    return out("INCOMPLETE", "facet_malformed");
  }

  // The roots must all be present to be judged. A missing genesis document is
  // not a clean surface; it is an unanswered question.
  for (const name of ROOT_FILE_NAMES) {
    if (!rootFiles.some((f) => isObj(f) && String(f.path).endsWith(name))) {
      return out("INCOMPLETE", `root_file_absent:${name}`);
    }
  }

  const findings = [];

  for (const l of listeners) {
    if (!isObj(l)) continue;
    if (!LOOPBACK_RE.test(String(l.address))) {
      findings.push(
        Object.freeze({ kind: "non_loopback_listener", address: l.address, port: l.port ?? null }),
      );
    }
  }

  const rootPaths = stateRoots.map((r) => String(isObj(r) ? r.path : "")).filter(Boolean);
  for (const m of mounts) {
    if (!isObj(m)) continue;
    if (!SYNC_FSTYPE_RE.test(String(m.fstype))) continue;
    const t = String(m.target);
    if (rootPaths.some((p) => t === p || t.startsWith(p.replace(/\/?$/, "/")))) {
      findings.push(
        Object.freeze({ kind: "sync_mount_over_state_root", target: t, fstype: m.fstype }),
      );
    }
  }

  for (const r of stateRoots) {
    if (!isObj(r)) continue;
    if (r.group_writable === true || r.other_writable === true) {
      findings.push(
        Object.freeze({ kind: "writable_state_root", path: r.path, mode: r.mode ?? null }),
      );
    }
  }

  for (const f of rootFiles) {
    if (!isObj(f)) continue;
    // Writable BY ANYONE, owner included. See the header.
    if (f.writable === true) {
      findings.push(Object.freeze({ kind: "writable_root_file", path: f.path }));
    }
    if (f.under_sync_mount === true) {
      findings.push(Object.freeze({ kind: "root_file_under_sync_mount", path: f.path }));
    }
    if (
      typeof f.sha256 === "string" &&
      typeof f.expected_sha256 === "string" &&
      f.sha256 !== f.expected_sha256
    ) {
      findings.push(
        Object.freeze({ kind: "root_file_hash_drift", path: f.path, observed: f.sha256 }),
      );
    }
  }

  if (findings.length) {
    const direct = findings.filter((f) => DIRECT_WRITE_FINDING_KINDS.includes(f.kind));
    if (direct.length > 0) {
      return out("EXTERNAL_WRITE_PATH_PRESENT", `findings:${findings.length}`, findings);
    }
    // Reachability without correlation: exposure is real, the write route is
    // not established. Refuse to certify clean AND refuse to assert a causal
    // path — INCOMPLETE, with every finding carried so nothing is hidden.
    const kinds = [...new Set(findings.map((f) => f.kind))].join(",");
    return out(
      "INCOMPLETE",
      `reachability_without_write_correlation:${kinds}`,
      findings,
    );
  }
  return out("NO_EXTERNAL_WRITE_PATH", null, []);
}

/** Only a fully measured, unexposed surface may settle the row. */
export function isCleanEligibleDeployment(o) {
  return (
    o?.evidence_class === "OBSERVED" &&
    o?.remote_write_verdict === "NO_EXTERNAL_WRITE_PATH"
  );
}

export function buildDeploymentRemoteWriteObservation({
  facts = null,
  evidenceClass = "NONE",
  observedAt = null,
  executedCodeHash = null,
  hash,
} = {}) {
  if (typeof hash !== "function") throw new TypeError("hash function required");
  const SURFACE =
    "The machine's own exposure surface — listeners, sync/mount paths, writable state roots, root-file integrity and process authority — was measured on the host";
  const PROSE_BY_VERDICT = {
    NO_EXTERNAL_WRITE_PATH:
      `${SURFACE} and carried no path by which an external party could silently mutate local sovereign state.`,
    EXTERNAL_WRITE_PATH_PRESENT:
      `${SURFACE} and FOUND a path by which an external party could reach local sovereign state; remote_write is VIOLATED on this host as measured.`,
    INCOMPLETE:
      "The machine's exposure surface was measured but either not completely measured or not correlated to write authority over sovereign state; exposure findings are carried as context, and this artefact settles nothing in either direction.",
  };
  const body = {
    schema: NODE0_DEPLOYMENT_REMOTE_WRITE_SCHEMA,
    scope: NODE0_DEPLOYMENT_REMOTE_WRITE_SCOPE,
    transaction_id: NODE0_DEPLOYMENT_REMOTE_WRITE_TRANSACTION_ID,
    evidence_class: evidenceClass,
    remote_write_verdict: facts?.verdict ?? null,
    remote_write_reason: facts?.reason ?? null,
    external_write_path_present: facts?.external_write_path_present ?? null,
    findings: Object.freeze([...(facts?.findings ?? [])]),
    facet_counts: Object.freeze({ ...(facts?.facet_counts ?? {}) }),
    executed_code_hash: executedCodeHash,
    live_execution_performed: evidenceClass === "OBSERVED",
    what_this_proves:
      PROSE_BY_VERDICT[facts?.verdict] ?? PROSE_BY_VERDICT.INCOMPLETE,
    what_this_does_not_prove:
      "It does NOT prove the node is unreachable, that no future mount or listener will appear, that a local process with legitimate authority cannot write, or that any other machine is safe. It speaks for this host at the moment it was measured.",
  };
  return Object.freeze({ ...body, observed_at: observedAt, observation_hash: hash(body) });
}

export function verifyDeploymentRemoteWriteHash(observation, hash) {
  if (!observation || typeof hash !== "function") return false;
  const { observed_at: _o, observation_hash: carried, ...body } = observation;
  return typeof carried === "string" && carried.length > 0 && hash(body) === carried;
}
