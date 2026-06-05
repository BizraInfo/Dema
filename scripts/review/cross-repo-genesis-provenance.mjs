#!/usr/bin/env node
// CROSS-REPO-GENESIS-PROVENANCE-1A · read-only genesis/key/proof inventory.
// No key generation, private-key read, signing, migration, or Block0 seal.

import { execFile } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const CROSS_REPO_GENESIS_PROVENANCE_SCHEMA =
  "bizra.dema.cross_repo_genesis_provenance.v0.1";

export const SEARCH_TERMS = Object.freeze([
  "genesis",
  "Node0",
  "Ed25519",
  "block0",
  "receipt",
  "URP",
  "POI",
  "seal",
  "identity",
  "SAT",
  "PAT",
  "SovereignIdentity",
  "GenesisNode",
]);

/** @typedef {"CURRENT_CANON"|"HISTORICAL_CANON"|"ARCHIVED_REFERENCE"|"IMPLEMENTATION_CANDIDATE"|"SPEC_ONLY"|"TEST_FIXTURE"|"LIVE_PROOF_CANDIDATE"|"SECRET_REFERENCE_DO_NOT_READ"|"MIGRATION_CANDIDATE"|"REJECTED_OR_SUPERSEDED"} StatusClass */

export const REPO_CATALOG = Object.freeze([
  {
    name: "Dema",
    fullName: "BizraInfo/Dema",
    archived: false,
    visibility: "PUBLIC",
    canonRole: "CURRENT_CANON",
    localEnvKeys: ["DEMA_ROOT"],
    defaultLocalPaths: [],
  },
  {
    name: "bizra-data-lake",
    fullName: "BizraInfo/bizra-data-lake",
    archived: false,
    visibility: "PUBLIC",
    canonRole: "HISTORICAL_CANON",
    localEnvKeys: ["BIZRA_DATA_LAKE_ROOT"],
    defaultLocalPaths: [
      "/data/bizra/data-lake",
      join(homedir(), "BIZRA Node0/bizra-data-lake"),
    ],
  },
  {
    name: "BIZRA-OS",
    fullName: "BizraInfo/BIZRA-OS",
    archived: false,
    visibility: "PRIVATE",
    canonRole: "IMPLEMENTATION_CANDIDATE",
    localEnvKeys: ["BIZRA_OS_ROOT"],
    defaultLocalPaths: [],
  },
  {
    name: "bizra-genesis-node",
    fullName: "BizraInfo/bizra-genesis-node",
    archived: true,
    visibility: "PRIVATE",
    canonRole: "ARCHIVED_REFERENCE",
    localEnvKeys: ["BIZRA_GENESIS_NODE_ROOT"],
    defaultLocalPaths: [],
  },
  {
    name: "bizra-node0-genesis",
    fullName: "BizraInfo/bizra-node0-genesis",
    archived: true,
    visibility: "PUBLIC",
    canonRole: "ARCHIVED_REFERENCE",
    localEnvKeys: ["BIZRA_NODE0_GENESIS_ROOT"],
    defaultLocalPaths: [],
  },
  {
    name: "bizra_scaffold",
    fullName: "BizraInfo/bizra_scaffold",
    archived: true,
    visibility: "PUBLIC",
    canonRole: "ARCHIVED_REFERENCE",
    localEnvKeys: ["BIZRA_SCAFFOLD_ROOT"],
    defaultLocalPaths: [],
  },
]);

const SECRET_PATH_PATTERN =
  /(?:private|secret|id_ed25519|\.pem(?:\.|$)|\/keys\/|\/secrets\/|\.key$)/i;

const LOCAL_SCAN_MAX_PER_TERM = 40;
const LOCAL_SCAN_MAX_DEPTH = 8;
const GH_SEARCH_LIMIT = 30;

/**
 * @param {string} filePath
 */
export function isSecretPath(filePath) {
  return SECRET_PATH_PATTERN.test(filePath);
}

/**
 * @param {string} filePath
 */
export function inferArtifactType(filePath) {
  const lower = filePath.toLowerCase();
  if (isSecretPath(filePath)) return "secret_reference";
  if (/\.test\.(js|ts|rs|py)$/.test(lower) || /\/tests?\//.test(lower))
    return "test";
  if (/\.(md|txt|rst)$/.test(lower) || /\/docs?\//.test(lower)) return "doc";
  if (/spec|preflight|canon|roadmap/i.test(filePath)) return "spec";
  if (/\.(rs|js|ts|tsx|py|go)$/.test(lower)) return "code";
  if (/\.json$/.test(lower)) return "data";
  return "other";
}

/**
 * @param {object} input
 * @param {string} input.repoName
 * @param {string} input.filePath
 * @param {boolean} input.archived
 * @param {string} input.canonRole
 * @param {string} [input.artifactType]
 * @returns {StatusClass}
 */
export function classifyArtifact({
  repoName,
  filePath,
  archived,
  canonRole,
  artifactType = inferArtifactType(filePath),
}) {
  if (isSecretPath(filePath)) return "SECRET_REFERENCE_DO_NOT_READ";

  if (artifactType === "test") return "TEST_FIXTURE";

  if (repoName === "Dema") {
    if (filePath.includes("packages/genesis/") || filePath.includes("block0"))
      return "CURRENT_CANON";
    if (filePath.includes("docs/_absorbed/")) return "HISTORICAL_CANON";
    if (filePath.includes("docs/08-quality/")) return "HISTORICAL_CANON";
    return "CURRENT_CANON";
  }

  if (repoName === "bizra-data-lake") {
    if (/omni|audit|readiness|GENESIS|genesis/i.test(filePath))
      return "HISTORICAL_CANON";
    if (filePath.includes("bizra-omega/") || filePath.includes("runtime/"))
      return "IMPLEMENTATION_CANDIDATE";
    if (artifactType === "doc" || artifactType === "spec")
      return "HISTORICAL_CANON";
    return "IMPLEMENTATION_CANDIDATE";
  }

  if (repoName === "BIZRA-OS") return "IMPLEMENTATION_CANDIDATE";

  if (archived || canonRole === "ARCHIVED_REFERENCE") {
    if (/PEAK_MASTERPIECE|PRODUCTION READY|100K\+ TPS/i.test(filePath))
      return "REJECTED_OR_SUPERSEDED";
    if (artifactType === "code") return "MIGRATION_CANDIDATE";
    return "ARCHIVED_REFERENCE";
  }

  if (artifactType === "spec" || artifactType === "doc") return "SPEC_ONLY";

  return "ARCHIVED_REFERENCE";
}

/**
 * @param {StatusClass} statusClass
 */
export function migrationDecision(statusClass) {
  switch (statusClass) {
    case "CURRENT_CANON":
      return "INHERIT_ACTIVE";
    case "HISTORICAL_CANON":
      return "REFERENCE_ONLY";
    case "ARCHIVED_REFERENCE":
      return "IGNORE_UNLESS_OPERATOR_REVIEW";
    case "IMPLEMENTATION_CANDIDATE":
      return "OPERATOR_REVIEW_BEFORE_MIGRATE";
    case "SPEC_ONLY":
      return "REFERENCE_ONLY";
    case "TEST_FIXTURE":
      return "IGNORE";
    case "LIVE_PROOF_CANDIDATE":
      return "OPERATOR_VERIFY_ON_DISK";
    case "SECRET_REFERENCE_DO_NOT_READ":
      return "OPERATOR_REVIEW";
    case "MIGRATION_CANDIDATE":
      return "OPERATOR_REVIEW_BEFORE_MIGRATE";
    case "REJECTED_OR_SUPERSEDED":
      return "IGNORE";
    default:
      return "OPERATOR_REVIEW";
  }
}

/**
 * @param {StatusClass} statusClass
 * @returns {boolean}
 */
export function blocksKeyCeremony(statusClass) {
  return (
    statusClass === "LIVE_PROOF_CANDIDATE" ||
    statusClass === "SECRET_REFERENCE_DO_NOT_READ"
  );
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

async function ghRepoView(fullName) {
  const { stdout } = await execFileAsync(
    "gh",
    [
      "repo",
      "view",
      fullName,
      "--json",
      "name,isArchived,visibility,defaultBranchRef,pushedAt",
    ],
    { timeout: 30_000 },
  );
  const parsed = JSON.parse(stdout);
  return {
    name: parsed.name,
    fullName,
    archived: parsed.isArchived,
    visibility: parsed.visibility,
    defaultBranch: parsed.defaultBranchRef?.name ?? null,
    pushedAt: parsed.pushedAt ?? null,
  };
}

async function ghSearchCode(fullName, query) {
  try {
    const { stdout } = await execFileAsync(
      "gh",
      [
        "search",
        "code",
        query,
        "--repo",
        fullName,
        "--limit",
        String(GH_SEARCH_LIMIT),
        "--json",
        "path,repository,textMatches",
      ],
      { timeout: 45_000 },
    );
    const rows = JSON.parse(stdout || "[]");
    return {
      rateLimited: false,
      rows: rows.map((row) => ({
        repo: fullName,
        path: row.path,
        source: "gh_search",
        query,
        evidence:
          row.textMatches?.[0]?.fragment?.trim().slice(0, 120) ?? "gh_match",
      })),
    };
  } catch (err) {
    const msg = String(err.stderr ?? err.message ?? err);
    if (/rate limit|HTTP 403/i.test(msg)) {
      return { rateLimited: true, rows: [] };
    }
    if (err.code === 1 || /HTTP 404|Not Found/i.test(msg)) {
      return { rateLimited: false, rows: [] };
    }
    throw err;
  }
}

function shouldSkipDir(name) {
  return (
    name === "node_modules" ||
    name === ".git" ||
    name === "target" ||
    name === "dist" ||
    name === "build" ||
    name === ".venv" ||
    name === "__pycache__"
  );
}

/**
 * Filename/path term scan — no file content reads.
 * @param {string} root
 * @param {string} repoFullName
 * @param {string[]} terms
 */
export function scanLocalPaths(root, repoFullName, terms = SEARCH_TERMS) {
  /** @type {Array<{repo:string,path:string,source:string,query:string,evidence:string}>} */
  const hits = [];
  const seen = new Set();

  function walk(dir, depth) {
    if (depth > LOCAL_SCAN_MAX_DEPTH) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".dema") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (shouldSkipDir(entry.name)) continue;
        walk(full, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      const rel = relative(root, full).replace(/\\/g, "/");
      const hay = `${rel}`.toLowerCase();
      for (const term of terms) {
        if (!hay.includes(term.toLowerCase())) continue;
        const key = `${repoFullName}:${rel}`;
        if (seen.has(key)) break;
        seen.add(key);
        hits.push({
          repo: repoFullName,
          path: rel,
          source: "local_path_scan",
          query: term,
          evidence: isSecretPath(rel)
            ? "path-only (secret guard)"
            : "path_match",
        });
        if (hits.length >= LOCAL_SCAN_MAX_PER_TERM * terms.length) return;
        break;
      }
    }
  }

  walk(root, 0);
  return hits;
}

/**
 * @param {Array<{repo:string,path:string}>} rows
 */
export function dedupeArtifacts(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = `${row.repo}:${row.path}`;
    if (!map.has(key)) map.set(key, row);
  }
  return [...map.values()].sort((a, b) =>
    `${a.repo}${a.path}`.localeCompare(`${b.repo}${b.path}`),
  );
}

/**
 * @param {object} input
 * @param {Array<{status_class:StatusClass}>} input.artifacts
 * @param {object|null} input.block0LiveReadiness
 * @param {boolean} input.operatorPubkeyPresent
 */
export function deriveNextGate({
  artifacts,
  block0LiveReadiness,
  operatorPubkeyPresent,
}) {
  const secretRefs = artifacts.filter(
    (a) => a.status_class === "SECRET_REFERENCE_DO_NOT_READ",
  );
  const liveProofCandidates = artifacts.filter(
    (a) => a.status_class === "LIVE_PROOF_CANDIDATE",
  );

  if (secretRefs.length > 0 || liveProofCandidates.length > 0) {
    return {
      gate: "BLOCKED_BY_UNRESOLVED_PROVENANCE",
      reason:
        "Unresolved SECRET_REFERENCE_DO_NOT_READ or LIVE_PROOF_CANDIDATE artifacts require operator review before any key ceremony.",
    };
  }

  const migrateCandidates = artifacts.filter(
    (a) =>
      a.status_class === "MIGRATION_CANDIDATE" &&
      a.migration_decision === "OPERATOR_REVIEW_BEFORE_MIGRATE",
  );

  if (
    migrateCandidates.length > 0 &&
    !operatorPubkeyPresent &&
    block0LiveReadiness?.ceremony_required
  ) {
    return {
      gate: "MIGRATE-HISTORICAL-GENESIS-PROOF-1A",
      reason:
        "Historical implementation candidates exist in archive/substrate repos, but Dema live home lacks operator key material — reconcile before import or fresh ceremony.",
    };
  }

  if (!operatorPubkeyPresent) {
    return {
      gate: "NODE0-GENESIS-KEY-CEREMONY-1A",
      reason:
        "Dema live home has no operator pubkey/key path; historical repos document architecture but do not materialize live Dema keys.",
    };
  }

  return {
    gate: "NODE0-GENESIS-KEY-CEREMONY-1A",
    reason:
      "Operator pubkey may be present but Block0 signing ceremony still requires explicit consent-gated private-key operations.",
  };
}

/**
 * Replace absolute local paths in committed report output.
 * Opt-in raw paths are disabled by default.
 * @param {string|null} p
 * @returns {string|null}
 */
function redactLocalPath(p) {
  if (typeof p === "string" && p.startsWith("/"))
    return "<LOCAL_PATH_REDACTED>";
  return p;
}

/**
 * @param {object} [opts]
 * @param {string} [opts.demaRoot]
 * @param {boolean} [opts.skipGh]
 * @param {object|null} [opts.block0LiveReadiness]
 * @param {Array<object>} [opts.artifactOverrides]
 * @param {boolean} [opts.rawPaths] - opt-in to include unredacted local paths (default false)
 */
export async function buildCrossRepoGenesisProvenanceReport({
  demaRoot = process.cwd(),
  skipGh = process.env.CROSS_REPO_SKIP_GH === "1",
  block0LiveReadiness = null,
  artifactOverrides = null,
  rawPaths = false,
} = {}) {
  /** @type {Array<object>} */
  const repoMetadata = [];
  /** @type {Array<object>} */
  const rawHits = artifactOverrides ? [...artifactOverrides] : [];

  if (!artifactOverrides) {
    for (const entry of REPO_CATALOG) {
      let meta = {
        name: entry.name,
        fullName: entry.fullName,
        archived: entry.archived,
        visibility: entry.visibility,
        canonRole: entry.canonRole,
        defaultBranch: null,
        pushedAt: null,
        localRoot: resolveLocalRoot(entry, demaRoot),
        ghAvailable: false,
      };

      if (!skipGh) {
        try {
          const ghMeta = await ghRepoView(entry.fullName);
          meta = { ...meta, ...ghMeta, ghAvailable: true };
        } catch (err) {
          meta.ghError = String(err.message ?? err).slice(0, 200);
        }

        if (meta.ghAvailable) {
          let rateLimited = false;
          for (const term of SEARCH_TERMS.slice(0, 6)) {
            const result = await ghSearchCode(entry.fullName, term);
            if (result.rateLimited) {
              rateLimited = true;
              break;
            }
            rawHits.push(...result.rows);
          }
          meta.ghSearchRateLimited = rateLimited;
        }
      }

      if (meta.localRoot) {
        rawHits.push(
          ...scanLocalPaths(meta.localRoot, entry.fullName, SEARCH_TERMS),
        );
      }

      repoMetadata.push(meta);
    }
  } else {
    for (const entry of REPO_CATALOG) {
      repoMetadata.push({
        name: entry.name,
        fullName: entry.fullName,
        archived: entry.archived,
        visibility: entry.visibility,
        canonRole: entry.canonRole,
        localRoot: resolveLocalRoot(entry, demaRoot),
        ghAvailable: false,
      });
    }
  }

  const deduped = dedupeArtifacts(rawHits);
  const catalogByFull = Object.fromEntries(
    REPO_CATALOG.map((r) => [r.fullName, r]),
  );

  const artifacts = deduped.map((hit) => {
    const catalog = catalogByFull[hit.repo] ?? {
      name: hit.repo.split("/")[1],
      archived: false,
      canonRole: "ARCHIVED_REFERENCE",
    };
    const artifactType = inferArtifactType(hit.path);
    const status_class = classifyArtifact({
      repoName: catalog.name,
      filePath: hit.path,
      archived: catalog.archived,
      canonRole: catalog.canonRole,
      artifactType,
    });
    return Object.freeze({
      repo: hit.repo,
      path: hit.path,
      artifact_type: artifactType,
      status_class,
      migration_decision: migrationDecision(status_class),
      evidence: isSecretPath(hit.path)
        ? "path-only (content not read)"
        : (hit.evidence ?? "indexed"),
      source: hit.source ?? "unknown",
      query: hit.query ?? null,
    });
  });

  const operatorPubkeyPresent =
    block0LiveReadiness?.operator_pubkey_present === true;

  const nextGate = deriveNextGate({
    artifacts,
    block0LiveReadiness,
    operatorPubkeyPresent,
  });

  const inherit = artifacts.filter(
    (a) => a.migration_decision === "INHERIT_ACTIVE",
  );
  const ignore = artifacts.filter((a) =>
    a.migration_decision.startsWith("IGNORE"),
  );
  const operatorReview = artifacts.filter((a) =>
    a.migration_decision.includes("OPERATOR"),
  );

  const networkUsed = !skipGh && !artifactOverrides;

  const repoMetadataOut = rawPaths
    ? repoMetadata
    : repoMetadata.map((r) => ({
        ...r,
        localRoot: redactLocalPath(r.localRoot),
      }));

  return Object.freeze({
    schema: CROSS_REPO_GENESIS_PROVENANCE_SCHEMA,
    ok: repoMetadata.length === REPO_CATALOG.length,
    generated_at_iso: new Date().toISOString(),
    dema_root: rawPaths ? demaRoot : redactLocalPath(demaRoot),
    repos: Object.freeze(repoMetadataOut),
    artifact_count: artifacts.length,
    artifacts: Object.freeze(artifacts),
    block0_live_readiness: block0LiveReadiness,
    decision_matrix: Object.freeze({
      inherit: inherit.slice(0, 20).map((a) => `${a.repo}:${a.path}`),
      ignore_count: ignore.length,
      operator_review_count: operatorReview.length,
      secret_reference_count: artifacts.filter(
        (a) => a.status_class === "SECRET_REFERENCE_DO_NOT_READ",
      ).length,
    }),
    next_gate: Object.freeze(nextGate),
    boundary: Object.freeze({
      read_only_audit: true,
      runtime_execution: false,
      mutation_performed: false,
      private_key_read: false,
      signing_performed: false,
      migration_performed: false,
      block0_sealed: false,
      federation_started: false,
      network_used: networkUsed,
      gh_api_used: networkUsed,
    }),
  });
}

async function loadBlock0LiveReadiness(demaRoot) {
  try {
    const mod = await import(
      join(demaRoot, "packages/genesis/src/block0-live-readiness.js")
    );
    return await mod.assessBlock0LiveReadiness({
      demaHome: process.env.DEMA_HOME || join(homedir(), ".dema"),
    });
  } catch {
    return null;
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const demaRoot = process.cwd();
  const block0 = process.argv.includes("--no-block0")
    ? null
    : await loadBlock0LiveReadiness(demaRoot);
  const report = await buildCrossRepoGenesisProvenanceReport({
    demaRoot,
    block0LiveReadiness: block0,
  });
  console.log(JSON.stringify(report, null, 2));
}
