#!/usr/bin/env node
// NODE0-LOCAL-RESOURCE-POOL-1A · read-only local resource pool indexer.
// No key generation, private-key read, signing, migration, Block0 seal,
// public network, token claims, or secret file content reads.
// Hermetic flag: NODE0_POOL_SKIP_SCAN=1

import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { extname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";

import {
  REPO_CATALOG,
  isSecretPath,
} from "./cross-repo-genesis-provenance.mjs";

export const NODE0_LOCAL_RESOURCE_POOL_SCHEMA =
  "bizra.dema.node0_local_resource_pool.v0.1";

/** @typedef {"LOCAL_ASSET"|"LOCAL_PROOF"|"LOCAL_REPO"|"LOCAL_DATASET"|"LOCAL_COMPUTE_CAPABILITY"|"HISTORICAL_ARTIFACT"|"MIGRATION_CANDIDATE"|"SECRET_REFERENCE_DO_NOT_READ"|"UNKNOWN_REQUIRES_OPERATOR_REVIEW"} ArtifactCategory */

export const ARTIFACT_CATEGORIES = Object.freeze([
  "LOCAL_ASSET",
  "LOCAL_PROOF",
  "LOCAL_REPO",
  "LOCAL_DATASET",
  "LOCAL_COMPUTE_CAPABILITY",
  "HISTORICAL_ARTIFACT",
  "MIGRATION_CANDIDATE",
  "SECRET_REFERENCE_DO_NOT_READ",
  "UNKNOWN_REQUIRES_OPERATOR_REVIEW",
]);

const SCAN_MAX_FILES = 2000;
const SCAN_MAX_DEPTH = 8;

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "target",
  "dist",
  "build",
  ".venv",
  "__pycache__",
]);

const PROOF_PATH_PATTERN =
  /proof|receipt|block0|genesis|seal|provenance|\.receipt\.json$/i;
const RECEIPT_PATH_PATTERN = /receipt|\.receipt\.json$/i;
const TEST_PATH_PATTERN = /\.test\.(js|ts|mjs|cjs|rs|py|go)$/i;

const CODE_EXTS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".rs",
  ".py",
  ".go",
  ".rb",
  ".java",
  ".kt",
]);
const DATA_EXTS = new Set([".json", ".csv", ".parquet", ".ndjson", ".jsonl"]);
const DOC_EXTS = new Set([".md", ".txt", ".rst", ".pdf"]);

/**
 * Classify a single file path into an artifact category.
 * Never reads file content.
 * @param {string} filePath
 * @param {string} canonRole
 * @returns {ArtifactCategory}
 */
export function classifyResourcePath(filePath, canonRole = "CURRENT_CANON") {
  if (isSecretPath(filePath)) return "SECRET_REFERENCE_DO_NOT_READ";

  const ext = extname(filePath).toLowerCase();

  // Archived/historical repos: classify before proof check so code files
  // are correctly flagged MIGRATION_CANDIDATE rather than LOCAL_PROOF.
  if (canonRole === "ARCHIVED_REFERENCE" || canonRole === "HISTORICAL_CANON") {
    if (CODE_EXTS.has(ext)) return "MIGRATION_CANDIDATE";
    return "HISTORICAL_ARTIFACT";
  }

  if (PROOF_PATH_PATTERN.test(filePath)) return "LOCAL_PROOF";

  if (DATA_EXTS.has(ext)) return "LOCAL_DATASET";
  if (CODE_EXTS.has(ext)) return "LOCAL_COMPUTE_CAPABILITY";
  if (DOC_EXTS.has(ext)) return "LOCAL_ASSET";

  return "UNKNOWN_REQUIRES_OPERATOR_REVIEW";
}

/**
 * Walk a local directory tree collecting path-level metadata.
 * Never reads file content.
 * @param {string} root
 * @param {string} canonRole
 */
export function scanLocalRoot(root, canonRole = "CURRENT_CANON") {
  const proof_assets = [];
  const receipt_assets = [];
  const test_surfaces = [];
  const secret_reference_paths = [];
  const migration_candidates = [];
  const category_counts = Object.fromEntries(
    ARTIFACT_CATEGORIES.map((c) => [c, 0]),
  );
  const lang_counts = {};
  let file_count = 0;
  let truncated = false;

  function walk(dir, depth) {
    if (depth > SCAN_MAX_DEPTH) return;
    if (file_count >= SCAN_MAX_FILES) {
      truncated = true;
      return;
    }
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (file_count >= SCAN_MAX_FILES) {
        truncated = true;
        return;
      }
      if (entry.name.startsWith(".") && entry.name !== ".dema") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(full, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      file_count++;

      const rel = relative(root, full).replace(/\\/g, "/");
      const ext = extname(entry.name).toLowerCase();
      if (ext) lang_counts[ext] = (lang_counts[ext] ?? 0) + 1;

      const category = classifyResourcePath(rel, canonRole);
      category_counts[category]++;

      if (category === "SECRET_REFERENCE_DO_NOT_READ") {
        secret_reference_paths.push(rel);
        continue;
      }
      if (PROOF_PATH_PATTERN.test(rel)) {
        proof_assets.push({ path: rel, category });
      }
      if (RECEIPT_PATH_PATTERN.test(rel)) {
        receipt_assets.push({ path: rel, category });
      }
      if (TEST_PATH_PATTERN.test(rel)) {
        test_surfaces.push({ path: rel });
      }
      if (category === "MIGRATION_CANDIDATE") {
        migration_candidates.push({ path: rel, canonRole });
      }
    }
  }

  walk(root, 0);

  const languages_hint = Object.entries(lang_counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([ext, count]) => `${ext}(${count})`);

  return {
    file_count,
    truncated,
    languages_hint,
    category_counts,
    proof_assets: proof_assets.slice(0, 50),
    receipt_assets: receipt_assets.slice(0, 50),
    test_surfaces: test_surfaces.slice(0, 50),
    secret_reference_paths: secret_reference_paths.slice(0, 50),
    migration_candidates: migration_candidates.slice(0, 20),
  };
}

/**
 * Replace absolute local paths in committed report output.
 * @param {string|null} p
 * @returns {string|null}
 */
function redactLocalPath(p) {
  if (typeof p === "string" && p.startsWith("/"))
    return "<LOCAL_PATH_REDACTED>";
  return p;
}

function resolveLocalRoot(entry, demaRoot) {
  if (entry.name === "Dema") return demaRoot;
  for (const key of entry.localEnvKeys) {
    const fromEnv = process.env[key];
    if (fromEnv && existsSync(fromEnv)) return fromEnv;
  }
  for (const candidate of entry.defaultLocalPaths) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Build the Node0 local resource pool report.
 *
 * @param {object} [opts]
 * @param {string} [opts.demaRoot] - root of the Dema repo; defaults to cwd
 * @param {string} [opts.demaHome] - DEMA_HOME for local state scan
 * @param {string|null} [opts.generatedAt] - injectable ISO timestamp for tests
 * @param {boolean} [opts.skipScan] - hermetic mode (NODE0_POOL_SKIP_SCAN=1)
 * @param {boolean} [opts.rawPaths] - include unredacted absolute paths (default false)
 * @param {object|null} [opts.fixtureOverride] - hermetic fixture for tests
 */
export async function buildNode0LocalResourcePoolReport({
  demaRoot = process.cwd(),
  demaHome = process.env.DEMA_HOME ?? join(homedir(), ".dema"),
  generatedAt = null,
  skipScan = process.env.NODE0_POOL_SKIP_SCAN === "1",
  rawPaths = false,
  fixtureOverride = null,
} = {}) {
  const generated_at = generatedAt ?? new Date().toISOString();

  const boundaries = Object.freeze({
    read_only: true,
    network_used: false,
    secret_content_read: false,
    mutation_performed: false,
    key_generated: false,
    signing_performed: false,
    block0_sealed: false,
    federation_started: false,
  });

  if (skipScan) {
    const fx = fixtureOverride ?? {};
    return Object.freeze({
      schema: NODE0_LOCAL_RESOURCE_POOL_SCHEMA,
      generated_at,
      hermetic: true,
      boundaries,
      repos: Object.freeze(fx.repos ?? []),
      artifact_categories: Object.freeze(
        fx.artifact_categories ??
          Object.fromEntries(ARTIFACT_CATEGORIES.map((c) => [c, 0])),
      ),
      proof_assets: Object.freeze(fx.proof_assets ?? []),
      receipt_assets: Object.freeze(fx.receipt_assets ?? []),
      test_surfaces: Object.freeze(fx.test_surfaces ?? []),
      secret_reference_paths: Object.freeze(fx.secret_reference_paths ?? []),
      migration_candidates: Object.freeze(fx.migration_candidates ?? []),
      dema_home_scan: Object.freeze({ status: "SKIPPED" }),
      summary: Object.freeze({
        total_local_repos_found: 0,
        total_local_repos_missing: 0,
        total_file_count: 0,
        secret_reference_count: (fx.secret_reference_paths ?? []).length,
        proof_asset_count: (fx.proof_assets ?? []).length,
        receipt_asset_count: (fx.receipt_assets ?? []).length,
        test_surfaces_count: (fx.test_surfaces ?? []).length,
        migration_candidate_count: (fx.migration_candidates ?? []).length,
      }),
      secret_reference_operator_review_note: null,
      next_recommended_gate: Object.freeze({
        gate: "BLOCKED_BY_UNRESOLVED_PROVENANCE",
        reason: "Hermetic mode: no live scan performed.",
      }),
    });
  }

  const repos = [];
  const all_proof_assets = [];
  const all_receipt_assets = [];
  const all_test_surfaces = [];
  const all_secret_reference_paths = [];
  const all_migration_candidates = [];
  const total_category_counts = Object.fromEntries(
    ARTIFACT_CATEGORIES.map((c) => [c, 0]),
  );

  for (const entry of REPO_CATALOG) {
    const localRoot = resolveLocalRoot(entry, demaRoot);
    const exists = localRoot ? existsSync(localRoot) : false;

    let scan = null;
    if (exists) {
      scan = scanLocalRoot(localRoot, entry.canonRole);
      for (const [cat, count] of Object.entries(scan.category_counts)) {
        total_category_counts[cat] += count;
      }
      for (const p of scan.proof_assets)
        all_proof_assets.push({ repo: entry.fullName, ...p });
      for (const p of scan.receipt_assets)
        all_receipt_assets.push({ repo: entry.fullName, ...p });
      for (const p of scan.test_surfaces)
        all_test_surfaces.push({ repo: entry.fullName, ...p });
      for (const p of scan.secret_reference_paths)
        all_secret_reference_paths.push({ repo: entry.fullName, path: p });
      for (const p of scan.migration_candidates)
        all_migration_candidates.push({ repo: entry.fullName, ...p });
    }

    repos.push(
      Object.freeze({
        name: entry.name,
        fullName: entry.fullName,
        canonRole: entry.canonRole,
        archived: entry.archived,
        visibility: entry.visibility,
        local_root: rawPaths ? localRoot : redactLocalPath(localRoot),
        status: exists
          ? "FOUND"
          : localRoot
            ? "PATH_NOT_EXISTS"
            : "NOT_CONFIGURED",
        file_count: scan?.file_count ?? null,
        truncated: scan?.truncated ?? false,
        languages_hint: scan?.languages_hint ?? [],
        test_surfaces_count: scan?.test_surfaces?.length ?? 0,
        proof_assets_count: scan?.proof_assets?.length ?? 0,
        receipt_assets_count: scan?.receipt_assets?.length ?? 0,
        secret_reference_count: scan?.secret_reference_paths?.length ?? 0,
        migration_candidates_count: scan?.migration_candidates?.length ?? 0,
      }),
    );
  }

  const demaHomeExists = existsSync(demaHome);
  let demaHomeScan = null;
  if (demaHomeExists) {
    demaHomeScan = scanLocalRoot(demaHome, "CURRENT_CANON");
    for (const [cat, count] of Object.entries(demaHomeScan.category_counts)) {
      total_category_counts[cat] += count;
    }
    for (const p of demaHomeScan.secret_reference_paths) {
      all_secret_reference_paths.push({ repo: "dema-home", path: p });
    }
  }

  // isSecretPath-1B: private-pilot and operator-review-doc FPs now excluded by
  // SECRET_PATH_FP_EXCLUSION in cross-repo-genesis-provenance.mjs. The manual
  // secretReviewNote blocker has been removed; gate advances naturally when
  // all_secret_reference_paths is empty.
  const hasSecretRefs = all_secret_reference_paths.length > 0;
  const secretReviewNote = null;

  let next_recommended_gate;
  if (hasSecretRefs) {
    next_recommended_gate = {
      gate: "BLOCKED_BY_UNRESOLVED_PROVENANCE",
      reason:
        "Unresolved SECRET_REFERENCE_DO_NOT_READ paths require operator review before advancing any key ceremony gate.",
    };
  } else {
    next_recommended_gate = {
      gate: "DEMA-AGENT-REGISTRY-1A",
      reason:
        "NODE0-LOCAL-RESOURCE-POOL-1A complete; no secret reference blockers detected. Suggest DEMA-AGENT-REGISTRY-1A as next gate per delivery spine.",
    };
  }

  const summary = Object.freeze({
    total_local_repos_found: repos.filter((r) => r.status === "FOUND").length,
    total_local_repos_missing: repos.filter((r) => r.status !== "FOUND").length,
    total_file_count:
      repos.reduce((s, r) => s + (r.file_count ?? 0), 0) +
      (demaHomeScan?.file_count ?? 0),
    secret_reference_count: all_secret_reference_paths.length,
    proof_asset_count: all_proof_assets.length,
    receipt_asset_count: all_receipt_assets.length,
    test_surfaces_count: all_test_surfaces.length,
    migration_candidate_count: all_migration_candidates.length,
  });

  return Object.freeze({
    schema: NODE0_LOCAL_RESOURCE_POOL_SCHEMA,
    generated_at,
    hermetic: false,
    boundaries,
    dema_root: rawPaths ? demaRoot : redactLocalPath(demaRoot),
    dema_home: rawPaths ? demaHome : redactLocalPath(demaHome),
    repos: Object.freeze(repos),
    artifact_categories: Object.freeze(total_category_counts),
    proof_assets: Object.freeze(all_proof_assets.slice(0, 100)),
    receipt_assets: Object.freeze(all_receipt_assets.slice(0, 100)),
    test_surfaces: Object.freeze(all_test_surfaces.slice(0, 100)),
    secret_reference_paths: Object.freeze(all_secret_reference_paths),
    migration_candidates: Object.freeze(all_migration_candidates.slice(0, 50)),
    dema_home_scan: demaHomeExists
      ? Object.freeze({
          status: "FOUND",
          path: rawPaths ? demaHome : redactLocalPath(demaHome),
          file_count: demaHomeScan.file_count,
          proof_assets_count: demaHomeScan.proof_assets.length,
          secret_reference_count: demaHomeScan.secret_reference_paths.length,
        })
      : Object.freeze({ status: "NOT_FOUND" }),
    summary,
    secret_reference_operator_review_note: secretReviewNote,
    next_recommended_gate: Object.freeze(next_recommended_gate),
  });
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const rawPaths = process.argv.includes("--raw-paths");
  const report = await buildNode0LocalResourcePoolReport({
    demaRoot: process.cwd(),
    rawPaths,
  });
  console.log(JSON.stringify(report, null, 2));
}
