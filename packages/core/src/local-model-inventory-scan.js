// C1.5 · Local Model Inventory Scan (per ADR-008 · inserted between C1 and C2).
//
// Operating-law: inventory before routing · routing before chat · chat before
// tools · tools before autonomy. Per operator guidance 2026-05-18.
//
// Wraps the pre-existing collectModelInventory (packages/models/) with:
//   1. Canonical 16-key boundary all-false (rather than the 6-key boundary
//      the existing inventory emits)
//   2. truth_label LOCALHOST_READ_ONLY_SCAN per ADR-008 C1.5 spec
//   3. schema bizra.dema.local_model_inventory.v0.1
//   4. HuggingFace cache scanner (~/.cache/huggingface/hub)
//   5. /data/bizra explicit secondary scan root
//   6. Per-record augmentation: file_type · usable_for (inferred, never claimed
//      verified · per Key Maker §3 V/D/A/U discipline)
//
// Hard boundaries (per spec):
//   - no model load
//   - no prompt execution
//   - no public network (localhost only)
//   - no shell execution
//   - no file writes (output to stdout only)
//   - no chain advance · no receipt mint · no federation

import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

import { collectModelInventory } from "../../../packages/models/src/model-inventory.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

const SCHEMA = "bizra.dema.local_model_inventory.v0.1";
const TRUTH_LABEL = "LOCALHOST_READ_ONLY_SCAN";

const SECONDARY_SCAN_ROOTS_DEFAULT = Object.freeze([
  "/data/bizra/models",
  "/data/bizra"
]);

const REQUIRED_BLOCKED_EFFECTS = Object.freeze([
  "model_load",
  "prompt_execution",
  "public_network_use",
  "shell_execution_from_dema",
  "file_writes_outside_stdout",
  "chain_advance",
  "receipt_mint",
  "federation_invocation",
  "node1_connection"
]);

// Inference-only · NEVER claimed verified · per Key Maker §3.
// Naming-based heuristics for capability hints. Reviewer should treat
// these as A (assumed-with-Ihsan) until empirically tested.
function inferUsableFor(modelId) {
  const id = String(modelId || "").toLowerCase();
  const hints = new Set();
  if (/embed|nomic|mxbai|bge/.test(id)) hints.add("embedding");
  if (/code|coder|starcoder|deepcoder/.test(id)) hints.add("coding");
  if (/r1|reason|qwq|o1|deepseek-r/.test(id)) hints.add("reasoning");
  if (/vl|vision|llava|multimodal|mmproj/.test(id)) hints.add("vision");
  if (/whisper/.test(id)) hints.add("speech_to_text");
  if (/kokoro|piper|tts|xtts/.test(id)) hints.add("text_to_speech");
  if (/(small|nano|tiny|mini)|[:-][1-7]b/.test(id)) hints.add("fast_chat");
  if (/26b|34b|70b|72b|79b|80b/.test(id)) hints.add("strong_reasoning_candidate");
  if (/bizra/.test(id)) hints.add("bizra_custom");
  if (hints.size === 0) hints.add("unknown");
  return Object.freeze([...hints].sort());
}

function inferFileType(record) {
  if (record?.source === "ollama") return "ollama";
  if (record?.source === "lm_studio") return "lm_studio";
  const path = String(record?.path || "").toLowerCase();
  if (path.endsWith(".gguf")) return "gguf";
  if (path.endsWith(".safetensors")) return "safetensors";
  if (path.endsWith(".bin")) return "bin";
  if (path.endsWith(".pt") || path.endsWith(".pth")) return "pytorch";
  if (path.endsWith(".onnx")) return "onnx";
  if (path.includes("/snapshots/")) return "hf_snapshot";
  return "unknown";
}

function augmentRecord(record) {
  if (!record || typeof record !== "object") {
    return Object.freeze({
      provider: "unknown",
      model_id: "unknown",
      path: null,
      file_type: "unknown",
      size_bytes: 0,
      modified_at: null,
      source: "unknown",
      load_status: "not_loaded_by_scan",
      usable_for: Object.freeze(["unknown"])
    });
  }
  return Object.freeze({
    provider: typeof record.source === "string" ? record.source : "unknown",
    model_id: typeof record.id === "string" ? record.id : "unknown",
    path: typeof record.path === "string" ? record.path : null,
    file_type: inferFileType(record),
    size_bytes: typeof record.size_bytes === "number" ? record.size_bytes : 0,
    modified_at: typeof record.modified_at === "string" ? record.modified_at : null,
    source: record.source === "ollama" || record.source === "lm_studio" ? "api" : "filesystem",
    load_status: "not_loaded_by_scan",
    usable_for: inferUsableFor(record.id)
  });
}

function scanHuggingFaceCache(cacheRoot = join(homedir(), ".cache", "huggingface", "hub")) {
  if (!existsSync(cacheRoot)) {
    return Object.freeze({ root_present: false, models: Object.freeze([]) });
  }
  let entries;
  try {
    entries = readdirSync(cacheRoot, { withFileTypes: true });
  } catch {
    return Object.freeze({ root_present: true, models: Object.freeze([]), error: "read_failed" });
  }
  const models = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("models--")) continue;
    const fullPath = join(cacheRoot, entry.name);
    let modifiedAt = null;
    let sizeBytes = 0;
    try {
      const s = statSync(fullPath);
      modifiedAt = s.mtime.toISOString();
    } catch { /* ignore */ }
    // Convert "models--org--name" → "org/name"
    const niceName = entry.name.slice("models--".length).replace(/--/g, "/");
    models.push(augmentRecord({
      id: niceName,
      source: "huggingface",
      path: fullPath,
      size_bytes: sizeBytes,
      modified_at: modifiedAt
    }));
  }
  return Object.freeze({
    root: cacheRoot,
    root_present: true,
    model_count: models.length,
    models: Object.freeze(models.sort((a, b) => a.model_id.localeCompare(b.model_id)))
  });
}

function scanSecondaryRoot(root, { maxDepth = 3, maxFiles = 200 } = {}) {
  if (!existsSync(root)) {
    return Object.freeze({ root, root_present: false, models: Object.freeze([]) });
  }
  const found = [];
  function walk(dir, depth) {
    if (depth > maxDepth) return;
    if (found.length >= maxFiles) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (found.length >= maxFiles) break;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip git/target/node_modules/.cache for speed
        if (/^(\.git|target|node_modules|\.cache|incremental)$/.test(entry.name)) continue;
        walk(fullPath, depth + 1);
      } else if (entry.isFile() && /\.(gguf|safetensors|onnx|pt|pth|bin)$/i.test(entry.name)) {
        // Skip Rust compile artifacts (.bin in target/ paths, dep-graph etc.)
        if (/dep-graph|query-cache|postings|chains|index\.bin/.test(entry.name)) continue;
        if (/\/target\//.test(fullPath)) continue;
        try {
          const s = statSync(fullPath);
          if (s.isFile() && s.size > 1024 * 1024) { // > 1 MB
            found.push(augmentRecord({
              id: entry.name,
              source: "filesystem",
              path: fullPath,
              size_bytes: s.size,
              modified_at: s.mtime.toISOString()
            }));
          }
        } catch { /* ignore */ }
      }
    }
  }
  walk(root, 0);
  return Object.freeze({
    root,
    root_present: true,
    model_count: found.length,
    truncated_at_max_files: found.length >= maxFiles,
    models: Object.freeze(found.sort((a, b) => b.size_bytes - a.size_bytes))
  });
}

// Pure wrapper around an existing collectModelInventory result. No I/O here.
// Used by tests + by the main scanner.
export function wrapInventoryAsLocalScan(inventory, { hfScan = null, secondaryScans = [] } = {}) {
  const safeInventory = inventory && typeof inventory === "object" ? inventory : {};
  const ollamaSource = safeInventory.providers?.ollama || {};
  const lmStudioSource = safeInventory.providers?.lm_studio || {};
  const downloadsSource = safeInventory.providers?.downloads || {};

  const ollamaModels = Array.isArray(ollamaSource.available)
    ? ollamaSource.available.map(augmentRecord)
    : (Array.isArray(ollamaSource.models) ? ollamaSource.models.map(augmentRecord) : []);
  const lmStudioModels = Array.isArray(lmStudioSource.available)
    ? lmStudioSource.available.map(augmentRecord)
    : (Array.isArray(lmStudioSource.models) ? lmStudioSource.models.map(augmentRecord) : []);
  const downloadsModels = Array.isArray(downloadsSource.files)
    ? downloadsSource.files.map(augmentRecord)
    : (Array.isArray(downloadsSource.models) ? downloadsSource.models.map(augmentRecord) : []);

  const providers = Object.freeze({
    ollama: Object.freeze({
      reachable: ollamaSource.reachable === true,
      error: ollamaSource.error ?? null,
      model_count: ollamaModels.length,
      models: Object.freeze(ollamaModels)
    }),
    lm_studio: Object.freeze({
      reachable: lmStudioSource.reachable === true,
      error: lmStudioSource.error ?? null,
      model_count: lmStudioModels.length,
      models: Object.freeze(lmStudioModels)
    }),
    downloads: Object.freeze({
      root: downloadsSource.root ?? null,
      root_present: downloadsSource.root_present !== false,
      model_count: downloadsModels.length,
      models: Object.freeze(downloadsModels)
    }),
    huggingface_cache: hfScan ?? Object.freeze({ root_present: false, models: Object.freeze([]) }),
    secondary_filesystem_scans: Object.freeze(secondaryScans)
  });

  const totalModels =
    providers.ollama.model_count +
    providers.lm_studio.model_count +
    providers.downloads.model_count +
    (providers.huggingface_cache.model_count || 0) +
    secondaryScans.reduce((sum, s) => sum + (s.model_count || 0), 0);

  return Object.freeze({
    schema: SCHEMA,
    truth_label: TRUTH_LABEL,
    mode: "preview_only",
    generated_at: typeof safeInventory.generated_at === "string" ? safeInventory.generated_at : new Date().toISOString(),
    total_models: totalModels,
    providers,
    blocked_effects: REQUIRED_BLOCKED_EFFECTS,
    boundary: buildPreviewBoundary()
  });
}

// Full scan: invokes the existing inventory + HF cache + secondary roots.
// One I/O surface · all read-only · all localhost-bounded.
export async function buildLocalModelInventoryScan({
  collectFn = collectModelInventory,
  hfCacheRoot = join(homedir(), ".cache", "huggingface", "hub"),
  secondaryRoots = SECONDARY_SCAN_ROOTS_DEFAULT,
  inventoryOptions = {}
} = {}) {
  const inventory = await collectFn(inventoryOptions);
  const hfScan = scanHuggingFaceCache(hfCacheRoot);
  const secondaryScans = secondaryRoots
    .filter((r) => typeof r === "string")
    .map((r) => scanSecondaryRoot(r));
  return wrapInventoryAsLocalScan(inventory, { hfScan, secondaryScans });
}

// Summary view: collapses model lists to counts + routing-readiness signals.
export function buildLocalModelInventorySummary(scan) {
  const safe = scan && typeof scan === "object" ? scan : {};
  return Object.freeze({
    schema: "bizra.dema.local_model_inventory_summary.v0.1",
    truth_label: safe.truth_label || TRUTH_LABEL,
    mode: "summary",
    source_schema: safe.schema || SCHEMA,
    total_models: safe.total_models || 0,
    provider_summary: Object.freeze({
      ollama_reachable: safe.providers?.ollama?.reachable === true,
      ollama_count: safe.providers?.ollama?.model_count || 0,
      lm_studio_reachable: safe.providers?.lm_studio?.reachable === true,
      lm_studio_count: safe.providers?.lm_studio?.model_count || 0,
      downloads_count: safe.providers?.downloads?.model_count || 0,
      hf_cache_count: safe.providers?.huggingface_cache?.model_count || 0,
      secondary_scans_total: (safe.providers?.secondary_filesystem_scans || [])
        .reduce((sum, s) => sum + (s.model_count || 0), 0)
    }),
    routing_readiness: Object.freeze({
      has_chat_capable: (safe.total_models || 0) > 0 &&
        safe.providers?.ollama?.reachable === true,
      has_embedding_capable: (safe.providers?.ollama?.models || [])
        .some((m) => (m.usable_for || []).includes("embedding")),
      has_coding_capable: (safe.providers?.ollama?.models || [])
        .some((m) => (m.usable_for || []).includes("coding")),
      has_vision_capable: (safe.providers?.ollama?.models || [])
        .some((m) => (m.usable_for || []).includes("vision")) ||
        (safe.providers?.downloads?.models || [])
          .some((m) => (m.usable_for || []).includes("vision"))
    }),
    boundary: safe.boundary || buildPreviewBoundary()
  });
}

export const LOCAL_MODEL_INVENTORY_REQUIRED_BLOCKED_EFFECTS = REQUIRED_BLOCKED_EFFECTS;
export const LOCAL_MODEL_INVENTORY_SCHEMA = SCHEMA;
export const LOCAL_MODEL_INVENTORY_TRUTH_LABEL = TRUTH_LABEL;
