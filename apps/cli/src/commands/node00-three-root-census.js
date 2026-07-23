// NODE00-THREE-ROOT-CENSUS-0B — the ONLY fs surface for this slice.
//
// Two deliberately separate concerns live here, both outside the pure kernel:
//
//   1. `censusFsAdapter()` — a read-only METADATA adapter exposing exactly the three
//      operations the kernel's contract allows: lstat, readdir, now. It uses
//      `lstatSync` (never `statSync`) so a symlink is described, never resolved, and
//      never dereferenced. It cannot read content and cannot mutate: no readFile,
//      open, createReadStream, realpath, writeFile, rename, mkdir, chmod, rm, unlink
//      or copyFile is applied to any SCANNED path.
//
//   2. `planProofOutput()` / `writeCensusProof()` — the external proof writer. It is
//      NOT part of the scanner: the scanner never learns where output goes, and the
//      writer never learns how to walk. The writer's mutations are confined to the
//      approved proof root and are the only writes this slice performs.
//
// DECLARED LIMIT — PROOF_ROOT_PARENT_SUBSTITUTION_RESISTANCE:
// NOT_PROVEN_AGAINST_HOSTILE_CONCURRENT_MUTATOR. The writer captures and revalidates
// the proof-root device+inode around the write and promotes by same-parent atomic
// rename, which defeats a stale or swapped root observed between those points. It
// does NOT provide descriptor-relative (`openat2`-grade) containment, so an attacker
// who can substitute a parent directory *concurrently, in the race window* is not
// excluded. That is stated, not papered over.

import {
  lstatSync,
  readdirSync,
  mkdirSync,
  writeFileSync,
  renameSync,
  existsSync,
} from "node:fs";
import { isAbsolute, join, normalize, sep, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

import {
  runNode00ThreeRootCensus,
  NODE00_THREE_ROOT_CENSUS_GO_PHRASE,
  NODE00_THREE_ROOT_CENSUS_SCHEMA,
} from "../../../../packages/core/src/node00-three-root-census.js";

export const PROOF_ROOT_SUBSTITUTION_RESISTANCE =
  "NOT_PROVEN_AGAINST_HOSTILE_CONCURRENT_MUTATOR";

// The writer's entire mutation surface, injectable so every refusal rule is
// unit-testable without touching a real disk.
export const DEFAULT_WRITER_FS = Object.freeze({
  lstatSync,
  mkdirSync,
  writeFileSync,
  renameSync,
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

// Fail-closed validation of the output location. Every refusal is a NAMED block; an
// unnamed pass is never how this returns ok.
export function planProofOutput({
  proofRoot,
  scannedRoots = [],
  demaHome = process.env.DEMA_HOME,
  fs = DEFAULT_WRITER_FS,
} = {}) {
  const { lstatSync: lstat, existsSync: exists } = fs;
  const blocked_by = [];
  if (typeof proofRoot !== "string" || proofRoot === "" || !isAbsolute(proofRoot)) {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["output_path_not_absolute"]), resolved: null });
  }
  const resolved = normalizedAbs(proofRoot);
  if (resolved !== normalize(proofRoot).replace(/\/$/, "") && resolved !== normalize(proofRoot)) {
    blocked_by.push("output_path_ambiguous");
  }

  let stat;
  try {
    stat = lstat(resolved);
  } catch {
    blocked_by.push("output_root_missing"); // must ALREADY exist — the writer never creates it
    return Object.freeze({ ok: false, blocked_by: Object.freeze(blocked_by), resolved });
  }
  if (stat.isSymbolicLink()) blocked_by.push("output_root_is_symlink");
  else if (!stat.isDirectory()) blocked_by.push("output_root_not_directory");

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

  // Trusted parent: not world-writable unless sticky. An attacker-writable parent
  // makes every containment guarantee below it meaningless.
  const parent = normalizedAbs(dirname(resolved));
  try {
    const pStat = lstat(parent);
    const worldWritable = (pStat.mode & 0o002) !== 0;
    const sticky = (pStat.mode & 0o1000) !== 0;
    if (worldWritable && !sticky) blocked_by.push("output_parent_attacker_writable");
  } catch {
    blocked_by.push("output_parent_unreadable");
  }

  return Object.freeze({
    ok: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
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

// Writes the proof set into a temporary run directory and promotes it by a
// same-parent atomic rename. Refuses to promote if the proof-root identity changed.
export function writeCensusProof({
  proofRoot,
  runId,
  result,
  scannedRoots,
  demaHome,
  runMetadata = {},
  fs = DEFAULT_WRITER_FS,
} = {}) {
  const plan = planProofOutput({ proofRoot, scannedRoots, demaHome, fs });
  if (!plan.ok) return Object.freeze({ ok: false, blocked_by: plan.blocked_by, run_dir: null });
  if (typeof runId !== "string" || !/^[A-Za-z0-9._-]+$/.test(runId)) {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["run_id_malformed"]), run_dir: null });
  }
  if (!result || result.ok !== true) {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["census_not_ok"]), run_dir: null });
  }

  const finalDir = join(plan.resolved, runId);
  const tempDir = join(plan.resolved, `.tmp-${runId}`); // SAME parent => rename cannot cross devices
  if (fs.existsSync(finalDir)) {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["run_dir_exists"]), run_dir: null });
  }

  fs.mkdirSync(tempDir, { recursive: false, mode: 0o750 });

  const manifestText = `${JSON.stringify(result.payload, null, 2)}\n`;
  fs.writeFileSync(join(tempDir, "manifest.json"), manifestText, { mode: 0o640 });
  fs.writeFileSync(join(tempDir, "entries.jsonl"), jsonl(result.entries), { mode: 0o640 });
  fs.writeFileSync(join(tempDir, "warnings.jsonl"), jsonl(result.warnings), { mode: 0o640 });
  fs.writeFileSync(join(tempDir, "manifest.sha256"), `${sha256Text(manifestText)}  manifest.json\n`, { mode: 0o640 });

  // Volatile run metadata lives HERE, outside the hashed deterministic body.
  const receipt = {
    schema: `${NODE00_THREE_ROOT_CENSUS_SCHEMA}.receipt`,
    capability_id: "NODE00-THREE-ROOT-CENSUS-0B",
    content_hash: result.content_hash,
    manifest_sha256: sha256Text(manifestText),
    completeness: result.payload.completeness,
    truncation_reason: result.payload.truncation_reason,
    totals: result.payload.totals,
    boundary: result.boundary,
    proof_root_substitution_resistance: PROOF_ROOT_SUBSTITUTION_RESISTANCE,
    asset_content_bytes_read: 0,
    symlinks_followed: 0,
    mount_boundaries_crossed: 0,
    scanned_root_mutation: 0,
    run_metadata: runMetadata,
  };
  fs.writeFileSync(join(tempDir, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o640 });

  // Revalidate proof-root identity immediately before promotion.
  let post;
  try {
    post = fs.lstatSync(plan.resolved);
  } catch {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["proof_root_vanished_before_promotion"]), run_dir: null });
  }
  if (post.dev !== plan.identity.device || post.ino !== plan.identity.inode) {
    return Object.freeze({
      ok: false,
      blocked_by: Object.freeze(["proof_root_identity_changed_before_promotion"]),
      run_dir: null,
    });
  }

  fs.renameSync(tempDir, finalDir); // same parent => atomic, never cross-device
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
export function runCensusToProof({ roots, proofRoot, runId, bounds, demaHome = process.env.DEMA_HOME }) {
  const adapter = censusFsAdapter();
  const result = runNode00ThreeRootCensus({
    consent: NODE00_THREE_ROOT_CENSUS_GO_PHRASE,
    input: { roots, adapter, bounds },
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
  const roots = JSON.parse(arg("roots") ?? "[]");
  const out = runCensusToProof({
    roots,
    proofRoot: arg("proof-root"),
    runId: arg("run-id"),
    bounds: arg("max-entries") ? { max_entries: Number(arg("max-entries")) } : undefined,
  });
  console.log(JSON.stringify(out, null, 2));
  if (!out.ok) process.exit(1);
}
