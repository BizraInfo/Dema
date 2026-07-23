// NODE00-THREE-ROOT-CENSUS-0B — the ONLY fs surface for this slice.
//
// Two deliberately separate concerns live here, both outside the pure kernel:
//
//   1. `censusFsAdapter()` — a read-only METADATA adapter exposing exactly the three
//      operations the kernel's contract allows: lstat, readdir, now. It uses
//      `lstatSync` (never `statSync`) so a symlink is described, never resolved, and
//      never dereferenced. It cannot read content and cannot mutate any SCANNED path.
//
//   2. `planProofOutput()` / `writeCensusProof()` — the external proof writer. It is
//      NOT part of the scanner: the scanner never learns where output goes, and the
//      writer never learns how to walk. The writer's mutations are confined to the
//      approved proof root.
//
// CORRECTIVE ROUND 0B.1 closes two review findings:
//
//   A. PROOF-ROOT REDIRECTION. The first version checked only the world-write bit on
//      the immediate parent. A non-sticky GROUP-writable ancestor let another member
//      of that group replace a directory on the path before the temp dir was created,
//      so artifacts landed in an attacker-controlled directory and the later identity
//      check fired too late. Now EVERY mutable ancestor is screened before ANY write:
//      group- or world-writable is a hard refusal unless the directory is sticky AND
//      owned by us or by root. Sticky alone is not enough: in a sticky directory an
//      entry may be renamed or removed by the entry's owner, the DIRECTORY's owner, or
//      root — so a foreign-owned sticky ancestor is still replaceable by its owner.
//      Unknown ownership fails closed.
//
//   C. RETRY POISONING. A failed write, failed revalidation or failed rename left the
//      deterministic temp directory behind, and re-running the same run id died with
//      an uncontrolled EEXIST. Now every failure returns a NAMED envelope and cleanup
//      is authorised only for the exact directory this invocation created, proven by
//      the device+inode captured immediately AFTER mkdir — deliberately NOT by the
//      marker file, because binding cleanup to the marker meant a failed marker write
//      stranded the directory and poisoned every retry. A directory substituted since
//      creation, or a pre-existing one, is never deleted: it is reported for operator
//      recovery.
//
// DECLARED LIMIT — PROOF_ROOT_PARENT_SUBSTITUTION_RESISTANCE:
// NOT_PROVEN_AGAINST_HOSTILE_CONCURRENT_MUTATOR. Permission screening plus
// device+inode revalidation and same-parent atomic rename defeat a stale or swapped
// root observed between those points. They do NOT provide descriptor-relative
// (`openat2`-grade) containment, so an attacker who substitutes a parent directory
// concurrently, inside the race window, is not excluded. Stated, not papered over.

import {
  lstatSync,
  readdirSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  renameSync,
  rmSync,
  existsSync,
} from "node:fs";
import { isAbsolute, join, normalize, sep, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

import {
  runNode00ThreeRootCensus,
  verifyPortableArtifacts,
  NODE00_THREE_ROOT_CENSUS_GO_PHRASE,
  NODE00_THREE_ROOT_CENSUS_SCHEMA,
} from "../../../../packages/core/src/node00-three-root-census.js";

export const PROOF_ROOT_SUBSTITUTION_RESISTANCE =
  "NOT_PROVEN_AGAINST_HOSTILE_CONCURRENT_MUTATOR";

export const RUN_MARKER_FILENAME = ".node00-census-run-marker.json";

// The writer's entire mutation surface, injectable so every refusal rule is
// unit-testable without touching a real disk.
export const DEFAULT_WRITER_FS = Object.freeze({
  lstatSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  renameSync,
  rmSync,
  existsSync,
});

function typeOf(stat) {
  if (stat.isSymbolicLink()) return "symlink";
  if (stat.isDirectory()) return "directory";
  if (stat.isFile()) return "file";
  return "other";
}

// Read-only metadata adapter. lstatSync only — a symlink is described, never followed.
export function censusFsAdapter({ clock = Date.now } = {}) {
  return {
    lstat(path) {
      const stat = lstatSync(path); // never statSync: no dereference
      return {
        device: stat.dev,
        inode: stat.ino,
        mode: stat.mode,
        size_bytes: stat.size,
        mtime_ms: Number.isFinite(stat.mtimeMs) ? stat.mtimeMs : 0,
        type: typeOf(stat),
      };
    },
    readdir(path) {
      return readdirSync(path); // names only, no withFileTypes dereference
    },
    now: clock,
  };
}

function normalizedAbs(value) {
  const normalized = normalize(value);
  if (normalized.length > 1 && normalized.endsWith(sep)) return normalized.slice(0, -1);
  return normalized;
}

function ancestorsOf(path) {
  const out = [];
  let current = normalizedAbs(path);
  for (;;) {
    const parent = normalizedAbs(dirname(current));
    if (parent === current) return out;
    out.push(parent);
    current = parent;
  }
}

function isStrictlyInside(parent, child) {
  return child !== parent && child.startsWith(parent === sep ? sep : parent + sep);
}

const STICKY = 0o1000;
const GROUP_OR_WORLD_WRITE = 0o022;

// Finding A: a directory an untrusted principal can write to is one where that
// principal can rename or replace our path component.
//
// Sticky is an exemption ONLY when the sticky directory is owned by us or by root: in
// a sticky directory an entry may be renamed or removed by the entry's owner, the
// directory's owner, or root. A sticky directory owned by a FOREIGN principal
// therefore still lets that owner replace our path component, so it is NOT exempt.
export function replaceableByOthers(mode, ownerUid = null, currentUid = null) {
  if ((mode & GROUP_OR_WORLD_WRITE) === 0) return false;
  if ((mode & STICKY) === 0) return true;
  if (ownerUid === null || currentUid === null) return true; // cannot prove ownership => fail closed
  return !(ownerUid === currentUid || ownerUid === 0);
}

// Fail-closed validation of the output location. Every refusal is a NAMED block.
export function planProofOutput({
  proofRoot,
  scannedRoots = [],
  demaHome = process.env.DEMA_HOME,
  fs = DEFAULT_WRITER_FS,
  currentUid = typeof process.getuid === "function" ? process.getuid() : null,
} = {}) {
  const { lstatSync: lstat, existsSync: exists } = fs;
  const blocked_by = [];
  if (typeof proofRoot !== "string" || proofRoot === "" || !isAbsolute(proofRoot)) {
    return Object.freeze({
      ok: false,
      blocked_by: Object.freeze(["output_path_not_absolute"]),
      resolved: null,
      identity: null,
    });
  }
  const resolved = normalizedAbs(proofRoot);

  let stat;
  try {
    stat = lstat(resolved);
  } catch {
    blocked_by.push("output_root_missing"); // must ALREADY exist — the writer never creates it
    return Object.freeze({ ok: false, blocked_by: Object.freeze(blocked_by), resolved, identity: null });
  }
  if (stat.isSymbolicLink()) blocked_by.push("output_root_is_symlink");
  else if (!stat.isDirectory()) blocked_by.push("output_root_not_directory");
  if (currentUid !== null && stat.uid !== undefined && stat.uid !== currentUid) {
    blocked_by.push("output_root_not_owned_by_current_uid");
  }
  if (replaceableByOthers(stat.mode, stat.uid, currentUid)) {
    blocked_by.push("proof_root_itself_group_or_world_writable");
  }

  // Finding A: screen the WHOLE mutable ancestor chain, BEFORE any write.
  for (const ancestor of ancestorsOf(resolved)) {
    let aStat;
    try {
      aStat = lstat(ancestor);
    } catch {
      blocked_by.push("output_root_ancestor_unreadable");
      break;
    }
    if (aStat.isSymbolicLink()) {
      blocked_by.push("output_root_ancestor_symlink");
      break;
    }
    if (replaceableByOthers(aStat.mode, aStat.uid, currentUid)) {
      blocked_by.push(
        (aStat.mode & STICKY) !== 0
          ? "proof_root_ancestor_sticky_foreign_owned"
          : (aStat.mode & 0o002) !== 0
            ? "proof_root_ancestor_world_writable"
            : "proof_root_ancestor_group_writable",
      );
      break;
    }
  }

  for (const root of scannedRoots) {
    const scanned = normalizedAbs(root.path ?? root);
    if (resolved === scanned || isStrictlyInside(scanned, resolved)) {
      blocked_by.push("output_inside_scanned_root");
      break;
    }
  }

  for (const dir of [resolved, ...ancestorsOf(resolved)]) {
    if (exists(join(dir, ".git"))) {
      blocked_by.push("output_inside_repository_worktree");
      break;
    }
  }

  if (typeof demaHome === "string" && demaHome !== "") {
    const home = normalizedAbs(demaHome);
    if (resolved === home || isStrictlyInside(home, resolved)) blocked_by.push("output_beneath_dema_home");
  }

  return Object.freeze({
    ok: blocked_by.length === 0,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
    resolved,
    identity: blocked_by.length === 0 ? Object.freeze({ device: stat.dev, inode: stat.ino }) : null,
  });
}

function sha256Text(text) {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function jsonl(rows) {
  return rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length > 0 ? "\n" : "");
}

function fail(code, extra = {}) {
  return Object.freeze({ ok: false, blocked_by: Object.freeze([code]), run_dir: null, ...extra });
}

// Finding C: cleanup is authorised ONLY for the exact directory this invocation
// created, and only after revalidating every property that makes it ours.
// Ownership is proven by the device+inode captured immediately after THIS invocation
// created the directory — NOT by the marker file. Binding cleanup to the marker meant a
// failed marker write left an unreclaimable directory that poisoned every retry.
function reclaimOwnTempDir({ fs, tempDir, proofRootResolved, createdIdentity, proofIdentity }) {
  if (!isStrictlyInside(proofRootResolved, tempDir)) return "temp_dir_outside_proof_root";
  if (!createdIdentity) return "temp_dir_identity_unknown"; // never delete what we cannot prove is ours
  let stat;
  try {
    stat = fs.lstatSync(tempDir);
  } catch {
    return null; // already gone — nothing to reclaim
  }
  if (stat.isSymbolicLink()) return "temp_dir_is_symlink";
  if (!stat.isDirectory()) return "temp_dir_not_directory";
  if (proofIdentity && stat.dev !== proofIdentity.device) return "temp_dir_cross_device";
  if (stat.dev !== createdIdentity.dev || stat.ino !== createdIdentity.ino) {
    return "temp_dir_substituted_since_creation";
  }
  try {
    fs.rmSync(tempDir, { recursive: true, force: false });
  } catch {
    return "temp_dir_cleanup_failed";
  }
  return null;
}

// Writes the proof set into a temporary run directory and promotes it by a
// same-parent atomic rename. No raw fs exception escapes: every failure path returns a
// named envelope.
export function writeCensusProof({
  proofRoot,
  runId,
  result,
  scannedRoots,
  demaHome,
  runMetadata = {},
  fs = DEFAULT_WRITER_FS,
  currentUid = typeof process.getuid === "function" ? process.getuid() : null,
} = {}) {
  const plan = planProofOutput({ proofRoot, scannedRoots, demaHome, fs, currentUid });
  if (!plan.ok) return Object.freeze({ ok: false, blocked_by: plan.blocked_by, run_dir: null });
  if (typeof runId !== "string" || !/^[A-Za-z0-9._-]+$/.test(runId)) return fail("run_id_malformed");
  if (!result || result.ok !== true) return fail("census_not_ok");

  // The privacy contract is enforced again where evidence becomes PORTABLE —
  // generation-time enforcement alone is not enough.
  const portable = verifyPortableArtifacts({
    payload: result.payload,
    entries: result.entries,
    warnings: result.warnings,
  });
  if (!portable.ok) return Object.freeze({ ok: false, blocked_by: portable.reasons, run_dir: null });

  const finalDir = join(plan.resolved, runId);
  const tempDir = join(plan.resolved, `.tmp-${runId}`); // SAME parent => rename cannot cross devices

  try {
    if (fs.existsSync(finalDir)) return fail("run_dir_exists");
    // Finding C: a pre-existing temp directory is EVIDENCE, never something to delete.
    if (fs.existsSync(tempDir)) {
      return fail("STALE_TEMP_RUN_REQUIRES_OPERATOR_RECOVERY", { stale_temp_dir: tempDir });
    }
  } catch {
    return fail("proof_root_unreadable");
  }

  try {
    fs.mkdirSync(tempDir, { recursive: false, mode: 0o700 });
  } catch {
    return fail("temp_dir_create_failed");
  }

  // Capture the identity of what we just created, BEFORE writing anything into it.
  // This is what authorises cleanup later, so a failed marker write cannot strand it.
  let createdIdentity = null;
  try {
    const st = fs.lstatSync(tempDir);
    createdIdentity = { dev: st.dev, ino: st.ino };
  } catch {
    createdIdentity = null;
  }

  const abort = (code) => {
    const cleanupError = reclaimOwnTempDir({
      fs, tempDir, proofRootResolved: plan.resolved, createdIdentity, proofIdentity: plan.identity,
    });
    return cleanupError
      ? Object.freeze({
          ok: false,
          blocked_by: Object.freeze([code, "RECOVERABLE_TEMP_ARTIFACT_REQUIRES_HUMAN", cleanupError]),
          run_dir: null,
          stale_temp_dir: tempDir,
        })
      : fail(code);
  };

  const manifestText = `${JSON.stringify(result.payload, null, 2)}\n`;
  const receipt = {
    schema: `${NODE00_THREE_ROOT_CENSUS_SCHEMA}.receipt`,
    capability_id: "NODE00-THREE-ROOT-CENSUS-0B",
    content_hash: result.content_hash,
    manifest_sha256: sha256Text(manifestText),
    completeness: result.payload.completeness,
    truncation_reason: result.payload.truncation_reason,
    per_root_scan_state: result.payload.per_root.map((r) => ({
      root_id: r.root_id,
      privacy_mode: r.privacy_mode,
      scan_state: r.scan_state,
      scan_reason: r.scan_reason,
    })),
    totals: result.payload.totals,
    boundary: result.boundary,
    proof_root_substitution_resistance: PROOF_ROOT_SUBSTITUTION_RESISTANCE,
    asset_content_bytes_read: 0,
    symlinks_followed: 0,
    mount_boundaries_crossed: 0,
    scanned_root_mutation: 0,
    private_per_entry_rows_emitted: 0,
    run_metadata: runMetadata,
  };

  try {
    fs.writeFileSync(
      join(tempDir, RUN_MARKER_FILENAME),
      `${JSON.stringify({ run_id: runId, marker: RUN_MARKER_FILENAME, owner_uid: currentUid })}\n`,
      { mode: 0o600 },
    );
    fs.writeFileSync(join(tempDir, "manifest.json"), manifestText, { mode: 0o600 });
    fs.writeFileSync(join(tempDir, "entries.jsonl"), jsonl(result.entries), { mode: 0o600 });
    fs.writeFileSync(join(tempDir, "warnings.jsonl"), jsonl(result.warnings), { mode: 0o600 });
    fs.writeFileSync(join(tempDir, "manifest.sha256"), `${sha256Text(manifestText)}  manifest.json\n`, { mode: 0o600 });
    fs.writeFileSync(join(tempDir, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  } catch {
    return abort("proof_write_failed");
  }

  // Revalidate proof-root identity immediately before promotion.
  let post;
  try {
    post = fs.lstatSync(plan.resolved);
  } catch {
    return abort("proof_root_vanished_before_promotion");
  }
  if (post.dev !== plan.identity.device || post.ino !== plan.identity.inode) {
    return abort("proof_root_identity_changed_before_promotion");
  }

  try {
    fs.renameSync(tempDir, finalDir); // same parent => atomic, never cross-device
  } catch {
    return abort("proof_promotion_failed");
  }

  return Object.freeze({
    ok: true,
    blocked_by: Object.freeze([]),
    run_dir: finalDir,
    manifest_sha256: receipt.manifest_sha256,
    content_hash: result.content_hash,
  });
}

// Bounded runtime census + proof write. Module entrypoint, deliberately NOT a
// registered CLI command name (ADR-012: no new kebab commands).
export function runCensusToProof({
  roots,
  proofRoot,
  runId,
  bounds,
  implementationWorktree,
  referenceTimeMs = Date.now(),
  demaHome = process.env.DEMA_HOME,
}) {
  const adapter = censusFsAdapter();
  const result = runNode00ThreeRootCensus({
    consent: NODE00_THREE_ROOT_CENSUS_GO_PHRASE,
    input: {
      roots,
      adapter,
      bounds,
      reference_time_ms: referenceTimeMs,
      implementation_worktree: implementationWorktree,
    },
  });
  if (!result.ok) return Object.freeze({ ok: false, blocked_by: result.blocked_by, run_dir: null });
  const written = writeCensusProof({
    proofRoot,
    runId,
    result,
    scannedRoots: roots,
    demaHome,
    runMetadata: { node_version: process.version, pid: process.pid },
  });
  return Object.freeze({ ...written, payload: result.payload });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (name) => {
    const i = process.argv.indexOf(`--${name}`);
    return i === -1 ? undefined : process.argv[i + 1];
  };
  const out = runCensusToProof({
    roots: JSON.parse(arg("roots") ?? "[]"),
    proofRoot: arg("proof-root"),
    runId: arg("run-id"),
    implementationWorktree: arg("implementation-worktree"),
    referenceTimeMs: arg("reference-time-ms") ? Number(arg("reference-time-ms")) : Date.now(),
    bounds: arg("max-entries") ? { max_entries: Number(arg("max-entries")) } : undefined,
  });
  console.log(JSON.stringify(out, null, 2));
  if (!out.ok) process.exit(1);
}
