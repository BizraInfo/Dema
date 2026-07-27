/**
 * مكتبة نود0 · NODE0-LIBRARY-CENSUS-1A — pure census kernel.
 *
 * Answers "where do we stand" over a set of file METADATA rows. Pure: no fs, no
 * clock, no network. The gatherer walks the disk; this decides what each file is
 * and refuses to produce a number that cannot say when it was taken and what it
 * covered.
 *
 * Three defects found on 2026-07-25 are encoded here as behaviour, not comments:
 *
 *   1. A vendor name is not an export. Matching the bare substring `claude`
 *      filed 33,030 `.claude/` config files as conversation history — a 74×
 *      inflation of the one shelf that mattered most. `classifyPath` now
 *      requires export SHAPE and vetoes tooling directories outright.
 *
 *   2. Disk is not library. 104 GB of VM memory dump, 68 GB of virtual disk and
 *      36 GB of model weights are node space, not the founder's work. Every
 *      shelf declares a `class`, and totals are split so neither figure can be
 *      quoted for the other.
 *
 *   3. A number without provenance is a claim. `buildCensus` refuses to run
 *      without `measured_at` and `roots`. A corpus that grows daily makes every
 *      undated total false within hours — the operator caught three of mine.
 */

import { assertMetadataOnly } from "./first-encounter-admission.js";

export const NODE0_LIBRARY_CENSUS_SCHEMA = "bizra.dema.node0_library_census.v0.1";
export const NODE0_LIBRARY_CENSUS_TRUTH_LABEL = "LOCAL_METADATA_CENSUS";

/** Never counted as anything — tooling, not authorship. Vetoes every shelf. */
const NEVER_LIBRARY = /(^|\/)(node_modules|\.git|\.next|__pycache__|\.venv|venv|site-packages|\.cache|dist|build|target)(\/|$)/i;

/** Config/tooling dirs that a naive vendor-name match would misread as chat. */
const NOT_CHAT = /(^|\/)\.claude(\/|$)|claude-code/i;

/**
 * The librarian's shelves, in the operator's own taxonomy.
 * `class` decides whether a shelf counts toward the library or the node space.
 */
export const SHELVES = Object.freeze({
  chat_history: {
    class: "library",
    path: new RegExp(
      [
        String.raw`(^|/)conversations?[-_.]`,
        String.raw`(^|/)conversations?\.(json|jsonl|parquet|csv|html)$`,
        String.raw`(^|/)chat[-_ ]?(export|history|archive|log|corpus)s?(/|[-_.])`,
        String.raw`(^|/)(chatgpt|claude|gemini|grok|deepseek|qwen|mistral|copilot)[-_ ][^/]*\.(md|txt|json|jsonl|html)$`,
        String.raw`(^|/)(chat|conversation)s?/[^/]*\.(json|jsonl|md)$`,
      ].join("|"),
      "i",
    ),
    not: NOT_CHAT,
  },
  research_papers: { class: "library", ext: [".pdf", ".bib", ".tex"] },
  books: { class: "library", ext: [".epub", ".mobi", ".azw3", ".djvu"] },
  code: {
    class: "library",
    ext: [".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".rs", ".go", ".java", ".c",
          ".h", ".cpp", ".sh", ".rb", ".php", ".sql", ".ipynb"],
  },
  diagrams_charts: { class: "library", ext: [".svg", ".mmd", ".drawio", ".vsdx", ".dot", ".graphml"] },
  prototypes: { class: "library", ext: [".dc.html"] },
  documents: { class: "library", ext: [".md", ".txt", ".doc", ".docx", ".odt", ".rtf", ".html", ".htm"] },
  spreadsheets: { class: "library", ext: [".csv", ".xls", ".xlsx", ".ods", ".tsv", ".parquet"] },
  slides: { class: "library", ext: [".ppt", ".pptx", ".key", ".odp"] },
  images: { class: "library", ext: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".heic", ".bmp", ".tif", ".tiff", ".psd", ".ai"] },
  video: { class: "library", ext: [".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v", ".wmv"] },
  audio: { class: "library", ext: [".mp3", ".wav", ".m4a", ".flac", ".ogg", ".opus", ".aac"] },
  archives: { class: "library", ext: [".zip", ".tar", ".gz", ".tgz", ".7z", ".rar", ".bz2", ".xz"] },
  config: { class: "library", ext: [".json", ".yaml", ".yml", ".ini", ".conf", ".xml", ".toml"] },

  // ── node space: real, useful, and NOT the founder's authored work ──
  vm_images: { class: "node_space", ext: [".vmdk", ".vmem", ".vdi", ".qcow2", ".ova", ".vmx", ".vhd"] },
  model_weights: { class: "node_space", ext: [".gguf", ".safetensors", ".pt", ".pth", ".onnx", ".ckpt"] },
  os_images: { class: "node_space", ext: [".iso", ".img"] },
});

export const SHELF_NAMES = Object.freeze(Object.keys(SHELVES));

class CensusError extends Error {
  constructor(code, detail) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "CensusError";
    this.code = code;
  }
}

const extOf = (p) => {
  const lower = p.toLowerCase();
  if (lower.endsWith(".dc.html")) return ".dc.html";
  const i = lower.lastIndexOf(".");
  const slash = lower.lastIndexOf("/");
  return i > slash && i > -1 ? lower.slice(i) : "";
};

/** Pure. Returns a shelf name, or "unshelved" when the taxonomy does not cover it. */
export function classifyPath(relativePath) {
  if (typeof relativePath !== "string" || relativePath.length === 0) return "unshelved";
  if (NEVER_LIBRARY.test(relativePath)) return "unshelved";

  const ext = extOf(relativePath);
  // Path signal first — an export named 2024-03.json is chat, not config.
  for (const name of SHELF_NAMES) {
    const def = SHELVES[name];
    if (!def.path) continue;
    if (def.not && def.not.test(relativePath)) continue;
    if (def.path.test(relativePath)) return name;
  }
  for (const name of SHELF_NAMES) {
    if (SHELVES[name].ext?.includes(ext)) return name;
  }
  return "unshelved";
}

export function shelfClass(shelf) {
  return SHELVES[shelf]?.class ?? "unknown";
}

/**
 * @param records  metadata-only rows (see first-encounter-admission METADATA_FIELDS)
 * @param provenance {roots: string[], measured_at: ISO string} — both required
 */
export function buildCensus(records, provenance = {}) {
  if (!Array.isArray(records)) throw new CensusError("INVALID_RECORDS");
  if (!Array.isArray(provenance.roots) || provenance.roots.length === 0) {
    throw new CensusError("ROOTS_REQUIRED", "a number must say what it covered");
  }
  if (typeof provenance.measured_at !== "string" || !provenance.measured_at) {
    throw new CensusError("MEASURED_AT_REQUIRED", "a growing corpus makes undated totals false");
  }

  const clean = records.map(assertMetadataOnly);
  const seen = new Set();
  const shelves = {};
  for (const name of [...SHELF_NAMES, "unshelved"]) {
    shelves[name] = { class: shelfClass(name), files: 0, bytes: 0, ext: {} };
  }
  let bytes = 0;
  let library_bytes = 0;
  let node_space_bytes = 0;

  for (const f of clean) {
    if (seen.has(f.relative_path)) {
      throw new CensusError("DUPLICATE_RELATIVE_PATH", f.relative_path);
    }
    seen.add(f.relative_path);

    const shelf = classifyPath(f.relative_path);
    const s = shelves[shelf];
    s.files += 1;
    s.bytes += f.size;
    const ext = extOf(f.relative_path) || "(none)";
    s.ext[ext] = (s.ext[ext] ?? 0) + 1;

    bytes += f.size;
    if (s.class === "library") library_bytes += f.size;
    else if (s.class === "node_space") node_space_bytes += f.size;
  }

  return Object.freeze({
    schema: NODE0_LIBRARY_CENSUS_SCHEMA,
    truth_label: NODE0_LIBRARY_CENSUS_TRUTH_LABEL,
    provenance: Object.freeze({
      roots: Object.freeze([...provenance.roots]),
      measured_at: provenance.measured_at,
      source: "LOCAL_FILESYSTEM_METADATA",
    }),
    totals: Object.freeze({
      files: clean.length,
      bytes,
      library_bytes,
      node_space_bytes,
      unshelved_bytes: shelves.unshelved.bytes,
    }),
    shelves: Object.freeze(shelves),
    boundaries: Object.freeze({
      file_content_read: false,
      symlink_followed: false,
      file_moved_or_copied: false,
      file_deleted: false,
      network_used: false,
    }),
    does_not_prove: Object.freeze([
      "cloud account size — nine accounts are unmeasured or captured at unknown fractions",
      "corpus completeness — a local archive is not an account",
      "content value — this counts files, it does not read or judge them",
      "shelf correctness beyond the declared taxonomy — see unshelved",
    ]),
  });
}
