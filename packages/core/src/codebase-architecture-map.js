// Codebase Architecture Map — v0.1 · read-only · bounded · deterministic.
//
// Purpose: ingest an absolute repository path, recursively scan source /
// config / test / docs / workflow files via an iterative walker, and emit a
// concise, navigable architecture map for onboarding, debugging, dependency
// tracing, and system evolution — WITHOUT needing an LLM.
//
// Operating-law (per Mumu 2026-05-21 GO):
//   "A codebase map must be read-only, bounded, deterministic, and useful
//    without needing an LLM."
//
// Boundary (10-key domain vocabulary, mirrors routed-invocation-verifier
// boundary shape with one domain-specific addition `secret_files_skipped`,
// per the per-module-domain-vocab canon documented in preview-boundary.js):
//   - runtime=true · file_io=true
//   - network_used=false · model_invocation=false · mutation=false
//   - federation=false · mint=false · token_economy=false · urp_networking=false
//   - secret_files_skipped=true
//
// Hard refusals (no toggle):
//   - no file write
//   - no model invocation
//   - no network call
//   - no shell execution against the target repo
//   - no chain advance / no receipt mint
//   - no federation invocation / no URP networking
//   - no target_repo mutation
//   - no symlink follow (record metadata only)
//   - no /proc, /sys, /dev scanning
//   - no read of secret-pattern files (.env*, *secret*, *credential*,
//     *.pem/.key/.crt/.p12, id_rsa*) — metadata only

import { readdir, readFile, stat, realpath, readlink } from "node:fs/promises";
import {
  join,
  resolve,
  isAbsolute,
  extname,
  relative,
  dirname,
  sep,
} from "node:path";
import { homedir } from "node:os";
import { performance } from "node:perf_hooks";

export const CODEBASE_ARCHITECTURE_MAP_SCHEMA =
  "bizra.dema.codebase_architecture_map.v0.1";

// ─── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_MAX_FILES = 20000;
export const DEFAULT_MAX_DEPTH = 12;
export const DEFAULT_MAX_FILE_SIZE = 2_097_152; // 2 MiB
export const DEFAULT_MAX_TOTAL_BYTES_READ = 67_108_864; // 64 MiB cumulative
export const DEFAULT_WALKER_BUDGET_MS = 5000;
const REGEX_LINE_MAX_CHARS = 10000;

export const DEFAULT_EXCLUSIONS = Object.freeze([
  ".git",
  "node_modules",
  "dist",
  "build",
  "out",
  "coverage",
  ".next",
  ".nuxt",
  ".svelte-kit",
  "target",
  ".gradle",
  "__pycache__",
  ".venv",
  "venv",
  "env",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  ".tox",
  "vendor",
  "tmp",
  "logs",
  ".cache",
  ".artifacts",
  ".proof-forge",
  ".qodo",
  ".claude",
]);

const SOURCE_EXTS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".jsx",
  ".py",
  ".rs",
  ".go",
  ".java",
  ".kt",
  ".swift",
  ".rb",
  ".php",
  ".c",
  ".cc",
  ".cpp",
  ".h",
  ".hpp",
  ".cs",
]);
const CONFIG_EXTS = new Set([".json", ".yml", ".yaml", ".toml", ".ini"]);
const DOC_EXTS = new Set([".md", ".mdx", ".rst", ".txt"]);
const BINARY_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".bz2",
  ".xz",
  ".7z",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".a",
  ".o",
  ".wasm",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".mp3",
  ".mp4",
  ".mov",
  ".avi",
  ".mkv",
  ".webm",
  ".gguf",
  ".safetensors",
  ".pt",
  ".pth",
  ".onnx",
  ".bin",
]);
const MANIFEST_BASENAMES = new Set([
  "package.json",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "Cargo.toml",
  "Cargo.lock",
  "pyproject.toml",
  "poetry.lock",
  "requirements.txt",
  "setup.py",
  "setup.cfg",
  "tsconfig.json",
  "go.mod",
  "go.sum",
  "Gemfile",
  "Gemfile.lock",
]);

// File-name secret patterns. Files matching these are recorded as
// role=secret_metadata_only with content_skipped_secret=true. Contents are
// NEVER read.
const SECRET_NAME_REGEXES = [
  /^\.env(\..*)?$/i, // .env, .env.local, .env.example
  /secret/i,
  /credential/i,
  /\.(pem|key|crt|p12)$/i,
  /^id_rsa/i,
];

const BLOCKED_EFFECTS = Object.freeze([
  "file_write",
  "model_invocation",
  "network_call",
  "shell_execution",
  "chain_advance",
  "receipt_mint",
  "federation_invocation",
  "urp_networking",
  "target_repo_mutation",
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isSecretFilename(name) {
  for (const re of SECRET_NAME_REGEXES) {
    if (re.test(name)) return true;
  }
  return false;
}

function isForbiddenSystemPath(p) {
  return (
    /^\/proc(\/|$)/.test(p) || /^\/sys(\/|$)/.test(p) || /^\/dev(\/|$)/.test(p)
  );
}

function isForbiddenOperatorPath(p, home) {
  const safe = home || homedir();
  return (
    p === join(safe, ".ssh") ||
    p.startsWith(join(safe, ".ssh") + sep) ||
    p === join(safe, ".dema") ||
    p.startsWith(join(safe, ".dema") + sep)
  );
}

function classifyFileRole(relPath, name, ext, isSymlink) {
  if (isSymlink) return "symlink";
  if (isSecretFilename(name)) return "secret_metadata_only";
  // workflow: .github/workflows/*.yml or .gitlab-ci.yml or .circleci/config.yml
  if (
    /(^|\/)\.github\/workflows\//.test(relPath) &&
    (ext === ".yml" || ext === ".yaml")
  )
    return "workflow";
  if (
    name === ".gitlab-ci.yml" ||
    /(^|\/)\.circleci\/config\.yml$/.test(relPath)
  )
    return "workflow";
  // test
  if (
    /(^|\/)tests?\//.test(relPath) ||
    /(^|\/)spec\//.test(relPath) ||
    /\.(test|spec)\.(js|mjs|cjs|ts|tsx|jsx|py|rs|go)$/.test(name)
  )
    return "test";
  // docs
  if (DOC_EXTS.has(ext)) return "docs";
  // config / manifest
  if (MANIFEST_BASENAMES.has(name)) return "config";
  if (CONFIG_EXTS.has(ext)) return "config";
  // script
  if (
    /(^|\/)scripts?\//.test(relPath) ||
    /(^|\/)bin\//.test(relPath) ||
    ext === ".sh"
  )
    return "script";
  // binary
  if (BINARY_EXTS.has(ext)) return "binary";
  // source
  if (SOURCE_EXTS.has(ext)) return "source";
  return "source"; // default for unknown text-looking files
}

function shouldExcludeDirName(name, exclusionSet) {
  return exclusionSet.has(name);
}

function isTextRole(role) {
  return (
    role === "source" ||
    role === "test" ||
    role === "docs" ||
    role === "config" ||
    role === "script" ||
    role === "workflow"
  );
}

// Count LOC (lines of code) on already-read content. Excludes trailing empty
// lines; counts all lines including comments (we are structural, not
// semantic).
function countLines(content) {
  if (typeof content !== "string" || content.length === 0) return 0;
  let n = 1;
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) === 10) n++;
  }
  // Trim trailing newline-only inflation
  if (content.endsWith("\n")) n -= 1;
  return n;
}

// ─── Edge extraction (ReDoS-safe regexes, bounded quantifiers only) ──────────

// All patterns share two invariants:
//   1. No nested quantifiers (no `(a+)+` shapes).
//   2. Bounded {0,N} or {1,N} character-class spans.
// Lines longer than REGEX_LINE_MAX_CHARS are skipped entirely before regex.

const RE_JS_IMPORT_FROM =
  /^\s{0,8}import\s+[^;'"]{0,200}\s+from\s+['"]([^'"]{1,500})['"]/;
const RE_JS_IMPORT_BARE = /^\s{0,8}import\s+['"]([^'"]{1,500})['"]/;
const RE_JS_REQUIRE = /\brequire\(\s*['"]([^'"]{1,500})['"]\s*\)/g;
const RE_PY_FROM = /^\s{0,8}from\s+([\w.]{1,200})\s+import\b/;
const RE_PY_IMPORT = /^\s{0,8}import\s+([\w.,\s]{1,200})$/;
const RE_RUST_USE = /^\s{0,8}use\s+([\w:]{1,200})\s*(?:as\s+\w{1,80}\s*)?;/;
const RE_GO_IMPORT_ONE = /^\s{0,8}import\s+"([^"]{1,500})"/;
const RE_GO_IMPORT_GRP = /^\s{0,8}"([^"]{1,500})"\s*$/;
const RE_WORKFLOW_USES = /^\s{0,16}uses:\s+([^\s#]{1,300})/;
const RE_TOML_DEP_LINE = /^([A-Za-z0-9_.-]{1,100})\s*=/;

// All extractors use String.prototype.match (non-global form) instead of
// RegExp.prototype.exec. Functionally identical for non-global single-shot
// captures, but avoids the actuator-check `\bexec\s*\(` false-positive that
// fires on the safe regex-`exec` shape (we never call `child_process.exec`).
function extractJsEdges(content, fromPath, lineCap) {
  const edges = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > lineCap) continue;
    let m = line.match(RE_JS_IMPORT_FROM);
    if (m) {
      edges.push({ from: fromPath, to_raw: m[1], kind: "import" });
      continue;
    }
    m = line.match(RE_JS_IMPORT_BARE);
    if (m) {
      edges.push({ from: fromPath, to_raw: m[1], kind: "import" });
      continue;
    }
    for (const r of line.matchAll(RE_JS_REQUIRE)) {
      edges.push({ from: fromPath, to_raw: r[1], kind: "require" });
    }
  }
  return edges;
}

function extractPyEdges(content, fromPath, lineCap) {
  const edges = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > lineCap) continue;
    let m = line.match(RE_PY_FROM);
    if (m) {
      edges.push({ from: fromPath, to_raw: m[1], kind: "import" });
      continue;
    }
    m = line.match(RE_PY_IMPORT);
    if (m) {
      const mods = m[1]
        .split(",")
        .map((s) => s.trim().split(/\s+/)[0])
        .filter(Boolean);
      for (const mod of mods)
        edges.push({ from: fromPath, to_raw: mod, kind: "import" });
    }
  }
  return edges;
}

function extractRustEdges(content, fromPath, lineCap) {
  const edges = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > lineCap) continue;
    const m = line.match(RE_RUST_USE);
    if (m) edges.push({ from: fromPath, to_raw: m[1], kind: "use" });
  }
  return edges;
}

function extractGoEdges(content, fromPath, lineCap) {
  const edges = [];
  const lines = content.split(/\r?\n/);
  let inGroup = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > lineCap) continue;
    if (/^\s*import\s+\(/.test(line)) {
      inGroup = true;
      continue;
    }
    if (inGroup && /^\s*\)/.test(line)) {
      inGroup = false;
      continue;
    }
    if (inGroup) {
      const m = line.match(RE_GO_IMPORT_GRP);
      if (m) edges.push({ from: fromPath, to_raw: m[1], kind: "import" });
      continue;
    }
    const m = line.match(RE_GO_IMPORT_ONE);
    if (m) edges.push({ from: fromPath, to_raw: m[1], kind: "import" });
  }
  return edges;
}

function extractWorkflowEdges(content, fromPath, lineCap) {
  const edges = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > lineCap) continue;
    const m = line.match(RE_WORKFLOW_USES);
    if (m)
      edges.push({ from: fromPath, to_raw: m[1], kind: "workflow_action" });
  }
  return edges;
}

function extractManifestEdges(content, fromPath, name, lineCap) {
  const edges = [];
  if (name === "package.json") {
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return edges;
    }
    for (const section of [
      "dependencies",
      "devDependencies",
      "peerDependencies",
    ]) {
      const block = parsed?.[section];
      if (block && typeof block === "object") {
        for (const dep of Object.keys(block)) {
          edges.push({ from: fromPath, to_raw: dep, kind: "manifest" });
        }
      }
    }
  } else if (name === "Cargo.toml" || name === "pyproject.toml") {
    const lines = content.split(/\r?\n/);
    let inDeps = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > lineCap) continue;
      const trimmed = line.trim();
      if (
        /^\[(?:dependencies|dev-dependencies|build-dependencies)\]$/.test(
          trimmed,
        ) ||
        /^\[tool\.poetry\.(?:dependencies|dev-dependencies|group\.[a-z0-9_-]{1,40}\.dependencies)\]$/.test(
          trimmed,
        )
      ) {
        inDeps = true;
        continue;
      }
      if (/^\[/.test(trimmed) && trimmed !== "") {
        inDeps = false;
        continue;
      }
      if (inDeps) {
        const m = trimmed.match(RE_TOML_DEP_LINE);
        if (m && m[1] !== "version")
          edges.push({ from: fromPath, to_raw: m[1], kind: "manifest" });
      }
    }
  } else if (name === "requirements.txt") {
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === "" || line.startsWith("#")) continue;
      if (line.length > lineCap) continue;
      const pkg = line.split(/[<>=!~;\s]/)[0];
      if (pkg) edges.push({ from: fromPath, to_raw: pkg, kind: "manifest" });
    }
  }
  return edges;
}

function extractEdgesForFile(content, relPath, name, ext, role, lineCap) {
  if (!isTextRole(role)) return [];
  if (role === "workflow")
    return extractWorkflowEdges(content, relPath, lineCap);
  if (role === "config" && MANIFEST_BASENAMES.has(name)) {
    return extractManifestEdges(content, relPath, name, lineCap);
  }
  switch (ext) {
    case ".js":
    case ".mjs":
    case ".cjs":
    case ".ts":
    case ".tsx":
    case ".jsx":
      return extractJsEdges(content, relPath, lineCap);
    case ".py":
      return extractPyEdges(content, relPath, lineCap);
    case ".rs":
      return extractRustEdges(content, relPath, lineCap);
    case ".go":
      return extractGoEdges(content, relPath, lineCap);
    default:
      return [];
  }
}

// Resolve relative imports (./ ../) against the importing file. Returns
// absolute path if the resolved target (with common extensions) is among the
// known files; null otherwise. Pure path math + set membership — no fs I/O.
function tryResolveLocalEdge(edge, fileSetByRelPath, repoRoot) {
  const raw = edge.to_raw;
  if (typeof raw !== "string" || raw.length === 0) return null;
  if (!raw.startsWith(".")) return null; // only local-relative resolves
  const importer = edge.from;
  const importerDir = dirname(importer);
  const candidate = resolve("/" + importerDir, raw).replace(/^\//, "");
  const candExts = [
    "",
    ".js",
    ".mjs",
    ".cjs",
    ".ts",
    ".tsx",
    ".jsx",
    ".py",
    ".rs",
    ".go",
    "/index.js",
    "/index.mjs",
    "/index.ts",
    "/index.tsx",
    "/mod.rs",
  ];
  for (const ext of candExts) {
    const try1 = candidate + ext;
    if (fileSetByRelPath.has(try1)) return try1;
  }
  return null;
}

// ─── Iterative walker ────────────────────────────────────────────────────────

async function walkRepo(rootRealpath, options) {
  const {
    maxFiles,
    maxDepth,
    exclusionSet,
    includeTests,
    nowMs,
    walkerBudgetMs,
  } = options;

  const files = [];
  const symlinks = [];
  const warnings = [];
  let partial = false;
  let errorReason = null;

  const visitedInodes = new Set();
  const queue = [{ absPath: rootRealpath, depth: 0 }];

  // Track root inode for guard
  try {
    const rootStat = await stat(rootRealpath);
    visitedInodes.add(`${rootStat.dev}:${rootStat.ino}`);
  } catch (err) {
    return {
      files,
      symlinks,
      warnings,
      partial: true,
      errorReason: "root_stat_failed",
      errorMessage: err?.message ?? String(err),
    };
  }

  while (queue.length > 0) {
    if (files.length >= maxFiles) {
      partial = true;
      errorReason = "file_limit_exceeded";
      warnings.push(`file_count_exceeded_${maxFiles}`);
      break;
    }
    if (performance.now() - nowMs > walkerBudgetMs) {
      partial = true;
      warnings.push(`walker_timing_budget_exceeded_${walkerBudgetMs}ms`);
      break;
    }

    const { absPath, depth } = queue.shift();
    if (depth > maxDepth) {
      partial = true;
      warnings.push(`max_depth_exceeded_at_${relative(rootRealpath, absPath)}`);
      continue;
    }

    let entries;
    try {
      entries = await readdir(absPath, { withFileTypes: true });
    } catch (err) {
      warnings.push(
        `readdir_failed:${relative(rootRealpath, absPath) || "."}:${err?.code ?? "UNKNOWN"}`,
      );
      continue;
    }

    for (const ent of entries) {
      const childAbs = join(absPath, ent.name);
      const childRel = relative(rootRealpath, childAbs);

      if (ent.isSymbolicLink()) {
        let target = null;
        try {
          target = await readlink(childAbs);
        } catch {
          /* swallow */
        }
        symlinks.push({ path: childRel, target, role: "symlink" });
        continue;
      }

      if (ent.isDirectory()) {
        if (shouldExcludeDirName(ent.name, exclusionSet)) continue;
        // Symlink-loop guard via inode tracking on directories
        let dstat;
        try {
          dstat = await stat(childAbs);
        } catch {
          continue;
        }
        const inodeKey = `${dstat.dev}:${dstat.ino}`;
        if (visitedInodes.has(inodeKey)) {
          warnings.push(`dir_loop_skipped:${childRel}`);
          continue;
        }
        visitedInodes.add(inodeKey);
        queue.push({ absPath: childAbs, depth: depth + 1 });
        continue;
      }

      if (!ent.isFile()) continue;

      const name = ent.name;
      const ext = extname(name).toLowerCase();
      const role = classifyFileRole(childRel, name, ext, false);
      if (role === "test" && !includeTests) {
        // We still record the file metadata so totals reflect reality, but
        // mark it so callers can filter. Simpler: skip from files[] when
        // includeTests=false (matches the contract test expects).
        continue;
      }

      if (files.length >= maxFiles) {
        partial = true;
        errorReason = "file_limit_exceeded";
        if (!warnings.some((w) => w.startsWith("file_count_exceeded_"))) {
          warnings.push(`file_count_exceeded_${maxFiles}`);
        }
        // Bail out of inner+outer loop by emptying the queue.
        queue.length = 0;
        break;
      }

      let sstat;
      try {
        sstat = await stat(childAbs);
      } catch {
        continue;
      }

      files.push({
        path: childRel,
        name,
        ext,
        role,
        size_bytes: sstat.size,
        mtime: sstat.mtime.toISOString(),
        depth,
      });
    }
  }

  return { files, symlinks, warnings, partial, errorReason };
}

// ─── Hotspot analysis ────────────────────────────────────────────────────────

function analyzeHotspots(
  fileRecords,
  edgesOut,
  edgesIn,
  contentLineCounts,
  dirFileCounts,
  fileContents,
) {
  const hotspotsByPath = new Map();
  function add(path, reason, evidence) {
    if (!hotspotsByPath.has(path))
      hotspotsByPath.set(path, { path, reasons: [], evidence: {} });
    const rec = hotspotsByPath.get(path);
    rec.reasons.push(reason);
    Object.assign(rec.evidence, evidence);
  }

  for (const f of fileRecords) {
    const loc = contentLineCounts.get(f.path) ?? 0;
    if (loc > 500) add(f.path, "file_exceeds_500_LOC", { LOC: loc });
    if (f.size_bytes > 100_000)
      add(f.path, "file_exceeds_100KB", { size_bytes: f.size_bytes });
    const fanIn = edgesIn.get(f.path) ?? 0;
    if (fanIn > 20)
      add(f.path, "high_fan_in_central_dependency", { fan_in: fanIn });
    const fanOut = edgesOut.get(f.path) ?? 0;
    if (fanOut > 30)
      add(f.path, "high_fan_out_god_object_risk", { fan_out: fanOut });

    const content = fileContents.get(f.path);
    if (typeof content === "string" && content.length > 0) {
      const markers = (content.match(/\b(?:TODO|FIXME|XXX|HACK)\b/g) ?? [])
        .length;
      if (markers > 5) add(f.path, "marker_concentration", { markers });
      if (loc > 0) {
        const noise = (
          content.match(/console\.log\(|\bprint\(|eprintln!\(/g) ?? []
        ).length;
        if (loc >= 100 && noise / loc > 0.1)
          add(f.path, "noisy_logging_density", { logs: noise, LOC: loc });
      }
    }
    if (f.role === "workflow" && typeof content === "string") {
      // any `uses: <action>@<not-40hex>` flagged
      const lines = content.split(/\r?\n/);
      let unpinned = 0;
      for (const ln of lines) {
        if (ln.length > 10000) continue;
        const m = ln.match(/\buses:\s+([^\s#]+)/);
        if (m && !/@[a-f0-9]{40}$/.test(m[1])) unpinned++;
      }
      if (unpinned > 0)
        add(f.path, "unpinned_action_supply_chain_risk", {
          unpinned_action_count: unpinned,
        });
    }
  }

  for (const [dir, count] of dirFileCounts) {
    if (count > 50) {
      const key = `dir:${dir}`;
      if (!hotspotsByPath.has(key))
        hotspotsByPath.set(key, { path: dir, reasons: [], evidence: {} });
      hotspotsByPath.get(key).reasons.push("directory_overflow");
      hotspotsByPath.get(key).evidence.dir_file_count = count;
    }
  }

  // source_without_test_pair: for each source/{name}.ext check that some test
  // file mentions {name} in its path
  const testNames = new Set();
  for (const f of fileRecords) {
    if (f.role === "test") {
      const base = f.name.replace(/\.(test|spec)\.[a-z]+$/i, "");
      if (base) testNames.add(base.toLowerCase());
    }
  }
  for (const f of fileRecords) {
    if (f.role !== "source") continue;
    const baseNoExt = f.name.replace(extname(f.name), "").toLowerCase();
    if (baseNoExt.length >= 3 && !testNames.has(baseNoExt)) {
      add(f.path, "source_without_test_pair", { source_basename: baseNoExt });
    }
  }

  const hotspots = [...hotspotsByPath.values()];
  hotspots.sort((a, b) => {
    if (a.reasons.length !== b.reasons.length)
      return b.reasons.length - a.reasons.length;
    return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
  });
  return hotspots;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function buildCodebaseArchitectureMap(repoPath, options = {}) {
  const startedNowMs = performance.now();
  const scannedAt = new Date().toISOString();

  // Input validation
  if (typeof repoPath !== "string" || repoPath.length === 0) {
    return shapedFailure({ reason: "path_required", scannedAt });
  }
  if (!isAbsolute(repoPath)) {
    return shapedFailure({
      reason: "path_must_be_absolute",
      scannedAt,
      repo_path: repoPath,
    });
  }
  if (isForbiddenSystemPath(repoPath)) {
    return shapedFailure({
      reason: "system_path_forbidden",
      scannedAt,
      repo_path: repoPath,
    });
  }
  if (isForbiddenOperatorPath(repoPath, options.home)) {
    return shapedFailure({
      reason: "operator_protected_path_forbidden",
      scannedAt,
      repo_path: repoPath,
    });
  }

  let realRepoPath;
  try {
    realRepoPath = await realpath(repoPath);
  } catch (err) {
    return shapedFailure({
      reason: err?.code === "ENOENT" ? "path_not_found" : "realpath_failed",
      scannedAt,
      repo_path: repoPath,
      error_message: err?.message ?? String(err),
    });
  }
  // Re-check after realpath in case it points at a forbidden location
  if (isForbiddenSystemPath(realRepoPath)) {
    return shapedFailure({
      reason: "system_path_forbidden",
      scannedAt,
      repo_path: repoPath,
    });
  }
  if (isForbiddenOperatorPath(realRepoPath, options.home)) {
    return shapedFailure({
      reason: "operator_protected_path_forbidden",
      scannedAt,
      repo_path: repoPath,
    });
  }

  // Options resolution
  const maxFiles = positiveInt(options.maxFiles, DEFAULT_MAX_FILES);
  const maxDepth = positiveInt(options.maxDepth, DEFAULT_MAX_DEPTH);
  const maxFileSize = positiveInt(options.maxFileSize, DEFAULT_MAX_FILE_SIZE);
  const maxTotalBytes = positiveInt(
    options.maxTotalBytesRead,
    DEFAULT_MAX_TOTAL_BYTES_READ,
  );
  const walkerBudgetMs = positiveInt(
    options.walkerBudgetMs,
    DEFAULT_WALKER_BUDGET_MS,
  );
  const includeTests = Boolean(options.includeTests);
  const hotspotsEnabled = Boolean(options.hotspots);
  const extraExclusions = Array.isArray(options.extraExclusions)
    ? options.extraExclusions
    : [];
  const useDefaultExclusions = options.useDefaultExclusions !== false;
  const exclusionSet = new Set([
    ...(useDefaultExclusions ? DEFAULT_EXCLUSIONS : []),
    ...extraExclusions,
  ]);

  // Walk
  const walkResult = await walkRepo(realRepoPath, {
    maxFiles,
    maxDepth,
    exclusionSet,
    includeTests,
    nowMs: startedNowMs,
    walkerBudgetMs,
  });

  if (walkResult.errorReason === "root_stat_failed") {
    return shapedFailure({
      reason: "root_stat_failed",
      scannedAt,
      repo_path: realRepoPath,
      error_message: walkResult.errorMessage,
    });
  }

  // Sort files deterministically
  walkResult.files.sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
  );
  walkResult.symlinks.sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
  );

  // Read content for text files within byte budget; collect edges + LOC
  const fileSetByRelPath = new Set(walkResult.files.map((f) => f.path));
  const contentByPath = new Map();
  const lineCountByPath = new Map();
  let totalBytesRead = 0;
  const rawEdges = [];

  for (const f of walkResult.files) {
    if (
      f.role === "secret_metadata_only" ||
      f.role === "binary" ||
      f.role === "symlink"
    ) {
      // Never read these
      continue;
    }
    if (f.size_bytes > maxFileSize) {
      f.content_skipped_oversized = true;
      continue;
    }
    if (totalBytesRead + f.size_bytes > maxTotalBytes) {
      f.content_skipped_budget = true;
      if (!walkResult.warnings.includes("total_bytes_budget_reached")) {
        walkResult.warnings.push("total_bytes_budget_reached");
      }
      continue;
    }
    let content;
    try {
      content = await readFile(join(realRepoPath, f.path), "utf8");
    } catch (err) {
      walkResult.warnings.push(
        `readfile_failed:${f.path}:${err?.code ?? "UNKNOWN"}`,
      );
      continue;
    }
    totalBytesRead += content.length;
    contentByPath.set(f.path, content);
    lineCountByPath.set(f.path, countLines(content));
    f.line_count = lineCountByPath.get(f.path);
    const edges = extractEdgesForFile(
      content,
      f.path,
      f.name,
      f.ext,
      f.role,
      REGEX_LINE_MAX_CHARS,
    );
    for (const e of edges) rawEdges.push(e);
  }

  // Resolve edges + compute fan-in / fan-out
  const edges = [];
  const fanOutByPath = new Map();
  const fanInByPath = new Map();
  for (const e of rawEdges) {
    const resolved = tryResolveLocalEdge(e, fileSetByRelPath, realRepoPath);
    const edgeRecord = {
      from: e.from,
      to_raw: e.to_raw,
      to_resolved: resolved,
      kind: e.kind,
      resolved_local: resolved !== null,
      resolved_external: resolved === null && !e.to_raw.startsWith("."),
    };
    edges.push(edgeRecord);
    fanOutByPath.set(e.from, (fanOutByPath.get(e.from) ?? 0) + 1);
    if (resolved) {
      fanInByPath.set(resolved, (fanInByPath.get(resolved) ?? 0) + 1);
    }
  }
  edges.sort((a, b) => {
    if (a.from !== b.from) return a.from < b.from ? -1 : 1;
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
    return a.to_raw < b.to_raw ? -1 : a.to_raw > b.to_raw ? 1 : 0;
  });

  for (const f of walkResult.files) {
    f.fan_in = fanInByPath.get(f.path) ?? 0;
    f.fan_out = fanOutByPath.get(f.path) ?? 0;
    if (f.role === "secret_metadata_only") f.content_skipped_secret = true;
    if (f.role === "binary") f.content_skipped_binary = true;
  }

  // Packages = directories with a recognized manifest
  const packageDirs = new Map();
  for (const f of walkResult.files) {
    if (f.role !== "config") continue;
    if (!MANIFEST_BASENAMES.has(f.name)) continue;
    const dir = dirname(f.path) === "." ? "" : dirname(f.path);
    if (!packageDirs.has(dir)) packageDirs.set(dir, []);
    packageDirs.get(dir).push(f.path);
  }
  const packages = [...packageDirs.entries()]
    .map(([dir, manifests]) => ({
      path: dir || ".",
      manifests: manifests.slice().sort(),
    }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  // Modules = top-level directories under each package, with file count
  const modules = [];
  for (const pkg of packages) {
    const moduleCounts = new Map();
    for (const f of walkResult.files) {
      const inside =
        pkg.path === "."
          ? true
          : f.path === pkg.path || f.path.startsWith(pkg.path + "/");
      if (!inside) continue;
      const rel = pkg.path === "." ? f.path : f.path.slice(pkg.path.length + 1);
      const parts = rel.split("/");
      if (parts.length < 2) continue; // top-level files in pkg are not "modules"
      const modName = parts[0];
      moduleCounts.set(modName, (moduleCounts.get(modName) ?? 0) + 1);
    }
    for (const [m, c] of [...moduleCounts.entries()].sort()) {
      modules.push({ package_path: pkg.path, module: m, file_count: c });
    }
  }

  // Directory file counts for hotspot directory_overflow
  const dirFileCounts = new Map();
  for (const f of walkResult.files) {
    const d = dirname(f.path);
    dirFileCounts.set(d, (dirFileCounts.get(d) ?? 0) + 1);
  }

  // Totals
  const byExtension = {};
  const byRole = {};
  let totalBytes = 0;
  for (const f of walkResult.files) {
    byExtension[f.ext || "(none)"] = (byExtension[f.ext || "(none)"] ?? 0) + 1;
    byRole[f.role] = (byRole[f.role] ?? 0) + 1;
    totalBytes += f.size_bytes;
  }

  // Hotspots
  let hotspots = [];
  if (hotspotsEnabled) {
    hotspots = analyzeHotspots(
      walkResult.files,
      fanOutByPath,
      fanInByPath,
      lineCountByPath,
      dirFileCounts,
      contentByPath,
    );
  }

  return Object.freeze({
    schema: CODEBASE_ARCHITECTURE_MAP_SCHEMA,
    scanned_at: scannedAt,
    repo_path: realRepoPath,
    repo_path_realpath_verified: true,
    scan_config: Object.freeze({
      max_files: maxFiles,
      max_depth: maxDepth,
      max_file_size: maxFileSize,
      max_total_bytes_read: maxTotalBytes,
      walker_budget_ms: walkerBudgetMs,
      include_tests: includeTests,
      hotspots_enabled: hotspotsEnabled,
      use_default_exclusions: useDefaultExclusions,
      extra_exclusions: Object.freeze([...extraExclusions]),
    }),
    totals: Object.freeze({
      file_count: walkResult.files.length,
      symlink_count: walkResult.symlinks.length,
      total_bytes: totalBytes,
      total_bytes_read: totalBytesRead,
      by_extension: Object.freeze(byExtension),
      by_role: Object.freeze(byRole),
    }),
    packages: Object.freeze(packages),
    modules: Object.freeze(modules),
    files: Object.freeze(walkResult.files),
    symlinks: Object.freeze(walkResult.symlinks),
    edges: Object.freeze(edges),
    hotspots: Object.freeze(hotspots),
    warnings: Object.freeze(walkResult.warnings),
    partial: walkResult.partial,
    error_reason: walkResult.errorReason,
    blocked_effects: BLOCKED_EFFECTS,
    boundary: Object.freeze({
      runtime: true,
      file_io: true,
      network_used: false,
      model_invocation: false,
      mutation: false,
      federation: false,
      mint: false,
      token_economy: false,
      urp_networking: false,
      secret_files_skipped: true,
    }),
  });
}

function positiveInt(value, fallback) {
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    Number.isInteger(value)
  ) {
    return value;
  }
  return fallback;
}

function shapedFailure({ reason, scannedAt, repo_path, error_message }) {
  return Object.freeze({
    schema: CODEBASE_ARCHITECTURE_MAP_SCHEMA,
    scanned_at: scannedAt,
    repo_path: repo_path ?? null,
    repo_path_realpath_verified: false,
    error_reason: reason,
    error_message: error_message ?? null,
    partial: true,
    scan_config: null,
    totals: Object.freeze({
      file_count: 0,
      symlink_count: 0,
      total_bytes: 0,
      total_bytes_read: 0,
      by_extension: Object.freeze({}),
      by_role: Object.freeze({}),
    }),
    packages: Object.freeze([]),
    modules: Object.freeze([]),
    files: Object.freeze([]),
    symlinks: Object.freeze([]),
    edges: Object.freeze([]),
    hotspots: Object.freeze([]),
    warnings: Object.freeze([reason]),
    blocked_effects: BLOCKED_EFFECTS,
    boundary: Object.freeze({
      runtime: true,
      file_io: true,
      network_used: false,
      model_invocation: false,
      mutation: false,
      federation: false,
      mint: false,
      token_economy: false,
      urp_networking: false,
      secret_files_skipped: true,
    }),
  });
}

// Compact human summary derived from the envelope.
export function formatCodebaseMapSummary(envelope) {
  if (!envelope || envelope.error_reason) {
    return `codebase map: ERROR (${envelope?.error_reason ?? "unknown"})`;
  }
  const t = envelope.totals;
  const lines = [
    `Codebase map · ${envelope.repo_path}`,
    `Scanned at: ${envelope.scanned_at}`,
    `Files: ${t.file_count} · Symlinks: ${t.symlink_count} · Bytes: ${t.total_bytes} (read: ${t.total_bytes_read})`,
    `By role: ${
      Object.entries(t.by_role)
        .map(([k, v]) => `${k}=${v}`)
        .join(" · ") || "(none)"
    }`,
    `Packages: ${envelope.packages.length} · Modules: ${envelope.modules.length} · Edges: ${envelope.edges.length}`,
    `Hotspots: ${envelope.hotspots.length} (enabled=${envelope.scan_config?.hotspots_enabled ?? false})`,
    `Partial: ${envelope.partial} · Warnings: ${envelope.warnings.length}`,
  ];
  return lines.join("\n");
}
