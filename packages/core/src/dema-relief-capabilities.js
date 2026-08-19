// DEMA-FOUNDER-RELIEF-CAPABILITIES-0B2 — typed capability operations.
//
// The trust-boundary fix. The Safe Work Queue now references OPERATION NAMES
// from this in-code registry, never caller-supplied shell. Each op's command is
// derived HERE as an argv array (executed shell:false → injection-impossible),
// and its effect is DECLARED HERE (subject_effect + control_plane_effect). So
// autonomy authority derives from the REGISTERED CAPABILITY, not from a label a
// caller attached to arbitrary text. `{effect_class:"read_only", command:"rm -rf"}`
// is structurally impossible: a caller supplies an op name (+ validated args),
// never a command.
//
// This begins the law the critique named: EFFECT_RISK != EXECUTION_AUTHORITY.
// This registry pins the *effect* of each op honestly; a later capability-lease
// layer (scope + standing authority + measured blast radius + machine state)
// composes on top before a FATE verdict. This is the floor, labeled as such.

const SAFE_OP = /^[a-z0-9]+(\.[a-z0-9_]+)+$/; // dotted lowercase op names only

// args are validated per-op; test paths must be real repo test files, nothing else.
function validTestPaths(paths) {
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > 12) return null;
  const ok = paths.every(
    (p) => typeof p === "string" && /^tests\/[A-Za-z0-9._-]+\.test\.js$/.test(p),
  );
  return ok ? paths : null;
}

// op -> { subject_effect, control_plane_effect, resolve(args) -> {file, argv} | {error} }
// resolve NEVER interpolates caller strings into a shell; it returns argv arrays.
const REGISTRY = Object.freeze({
  "git.status": { subject_effect: "read_only", control_plane_effect: "none", resolve: () => ({ file: "git", argv: ["status", "--short"] }) },
  "git.diff_check": { subject_effect: "read_only", control_plane_effect: "none", resolve: () => ({ file: "git", argv: ["diff", "--check"] }) },
  "git.branch_info": { subject_effect: "read_only", control_plane_effect: "none", resolve: () => ({ file: "git", argv: ["branch", "-vv"] }) },
  "test.run": {
    subject_effect: "read_only",
    control_plane_effect: "none",
    resolve: (a) => {
      const p = validTestPaths(a && a.paths);
      return p ? { file: "node", argv: ["--test", ...p] } : { error: "invalid_test_paths" };
    },
  },
  "purity.check": { subject_effect: "read_only", control_plane_effect: "none", resolve: () => ({ file: "node", argv: ["scripts/review/kernel-purity-check.mjs"] }) },
  "corpus.gate": { subject_effect: "read_only", control_plane_effect: "none", resolve: () => ({ file: "node", argv: ["scripts/claims/claim-corpus-gate.mjs"] }) },
  "integration.check": { subject_effect: "read_only", control_plane_effect: "none", resolve: () => ({ file: "node", argv: ["scripts/review/integration-check.mjs"] }) },
  "disk.inspect": { subject_effect: "read_only", control_plane_effect: "none", resolve: () => ({ file: "df", argv: ["-h", "/data"] }) },
  // Added because a real failure had no instrument. 160 qualified branches sat
  // unmerged not because anything refused them but because nothing surfaced
  // them — the operator's own answer was "nothing blocked me, I just didn't see
  // it". A report handed over once goes invisible again; a registered op does
  // not. Read-only: it lists, it never merges.
  "git.unmerged_branches": {
    subject_effect: "read_only", control_plane_effect: "none",
    resolve: () => ({ file: "git", argv: ["branch", "-r", "--no-merged", "origin/main"] }),
  },
});

export function listCapabilities() {
  return Object.keys(REGISTRY);
}

/**
 * Resolve a typed operation to an executable (file, argv) + its declared effect.
 * Pure & fail-closed: a malformed op name, an unknown op, or invalid args all
 * return `{ error }`. There is no path by which a caller string becomes a shell.
 */
export function resolveOperation(op, args = {}) {
  if (typeof op !== "string" || !SAFE_OP.test(op)) return Object.freeze({ error: "op_malformed" });
  const entry = REGISTRY[op];
  if (!entry) return Object.freeze({ error: `unknown_operation:${op}` });
  const r = entry.resolve(args || {});
  if (r && r.error) return Object.freeze({ error: r.error });
  if (!r || typeof r.file !== "string" || !Array.isArray(r.argv)) return Object.freeze({ error: "op_resolve_failed" });
  return Object.freeze({
    op,
    file: r.file,
    argv: Object.freeze([...r.argv]),
    subject_effect: entry.subject_effect,
    control_plane_effect: entry.control_plane_effect,
  });
}
