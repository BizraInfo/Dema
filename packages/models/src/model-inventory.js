import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

import {
  DEFAULT_LM_STUDIO_URL,
  DEFAULT_OLLAMA_URL,
  DEFAULT_TIMEOUT_MS,
  SCHEMA,
  defaultDownloadsRoot,
  humanBytes,
  isModelFilename,
  isLocalUrl,
  portFor,
  resolveLocalLlmBase,
  urlFor,
} from "./model-common.js";
import { buildRoutingRecommendations } from "./model-routing.js";
import { buildSafety, resolveTcpBindings } from "./model-safety.js";

const REDACTED_DOWNLOADS_ROOT = "[local-downloads-root-redacted]";

export { humanBytes } from "./model-common.js";
export { formatModelInventory } from "./model-format.js";
export { parseSsBindings } from "./model-safety.js";

async function fetchJson(
  url,
  { fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {},
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };

    const contentType = response.headers?.get?.("content-type") ?? "";
    if (contentType && !contentType.includes("application/json")) {
      return { ok: false, error: `non-JSON response (${contentType})` };
    }

    return { ok: true, json: await response.json() };
  } catch (err) {
    return { ok: false, error: err?.message ?? String(err) };
  } finally {
    clearTimeout(timer);
  }
}

function normalizeOllamaModel(model) {
  const bytes = Number(model?.size ?? model?.size_vram ?? 0);
  return {
    id: model?.name ?? model?.model ?? "unknown",
    source: "ollama",
    size_bytes: bytes,
    size: humanBytes(bytes),
    modified_at: model?.modified_at ?? null,
  };
}

function normalizeLmStudioModel(model) {
  return {
    id: model?.id ?? "unknown",
    source: "lm_studio",
    size_bytes: null,
    size: "unknown",
    modified_at: null,
  };
}

async function probeOllama({ baseUrl, fetchImpl, timeoutMs }) {
  if (!isLocalUrl(baseUrl)) {
    return {
      source: "ollama",
      url: baseUrl,
      reachable: false,
      model_count: 0,
      active_count: 0,
      models: [],
      active: [],
      error: "non-local endpoint refused",
      active_error: "non-local endpoint refused",
    };
  }

  const [tags, ps] = await Promise.all([
    fetchJson(urlFor(baseUrl, "/api/tags"), { fetchImpl, timeoutMs }),
    fetchJson(urlFor(baseUrl, "/api/ps"), { fetchImpl, timeoutMs }),
  ]);
  const models = tags.ok
    ? (tags.json?.models ?? []).map(normalizeOllamaModel)
    : [];
  const active = ps.ok ? (ps.json?.models ?? []).map(normalizeOllamaModel) : [];

  return {
    source: "ollama",
    url: baseUrl,
    reachable: tags.ok,
    model_count: models.length,
    active_count: active.length,
    models,
    active,
    error: tags.ok ? null : tags.error,
    active_error: ps.ok ? null : ps.error,
  };
}

async function probeLmStudio({ baseUrl, fetchImpl, timeoutMs }) {
  if (!isLocalUrl(baseUrl)) {
    return {
      source: "lm_studio",
      url: baseUrl,
      reachable: false,
      model_count: 0,
      models: [],
      error: "non-local endpoint refused",
    };
  }

  const modelsResponse = await fetchJson(urlFor(baseUrl, "/v1/models"), {
    fetchImpl,
    timeoutMs,
  });
  const models = modelsResponse.ok
    ? (modelsResponse.json?.data ?? []).map(normalizeLmStudioModel)
    : [];

  return {
    source: "lm_studio",
    url: baseUrl,
    reachable: modelsResponse.ok,
    model_count: models.length,
    models,
    error: modelsResponse.ok ? null : modelsResponse.error,
  };
}

async function scanModelFiles(
  root,
  { maxDepth = 4, maxFiles = 500, includeAbsolutePaths = false } = {},
) {
  const files = [];
  const result = await walkModelFiles(root, root, files, {
    depth: 0,
    maxDepth,
    maxFiles,
    includeAbsolutePaths,
  });
  files.sort(
    (a, b) =>
      b.size_bytes - a.size_bytes ||
      a.relative_path.localeCompare(b.relative_path),
  );

  return {
    source: "downloads",
    root: includeAbsolutePaths ? root : REDACTED_DOWNLOADS_ROOT,
    root_redacted: !includeAbsolutePaths,
    model_count: files.length,
    max_depth: maxDepth,
    truncated: files.length >= maxFiles,
    models: files,
    error: result?.error ?? null,
  };
}

async function walkModelFiles(root, dir, files, limits) {
  if (files.length >= limits.maxFiles || limits.depth > limits.maxDepth)
    return null;

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    const rootLabel = limits.includeAbsolutePaths
      ? root
      : REDACTED_DOWNLOADS_ROOT;
    return limits.depth === 0
      ? { error: `${err.code ?? "read_error"}:${rootLabel}` }
      : null;
  }

  for (const entry of entries) {
    if (files.length >= limits.maxFiles) break;
    await visitModelEntry(root, dir, entry, files, limits);
  }

  return null;
}

async function visitModelEntry(root, dir, entry, files, limits) {
  const path = join(dir, entry.name);
  if (entry.isDirectory()) {
    await walkModelFiles(root, path, files, {
      ...limits,
      depth: limits.depth + 1,
    });
  } else if (entry.isFile() && isModelFilename(entry.name)) {
    files.push(
      await modelFileRecord(root, path, entry.name, {
        includeAbsolutePaths: limits.includeAbsolutePaths,
      }),
    );
  }
}

async function modelFileRecord(
  root,
  path,
  id,
  { includeAbsolutePaths = false } = {},
) {
  const fileStat = await stat(path);
  const relativePath = relative(root, path).split("\\").join("/");
  return {
    id,
    source: "downloads",
    path: includeAbsolutePaths ? path : relativePath,
    path_redacted: !includeAbsolutePaths,
    relative_path: relativePath,
    size_bytes: fileStat.size,
    size: humanBytes(fileStat.size),
    modified_at: fileStat.mtime.toISOString(),
  };
}

export async function collectModelInventory({
  // PERIMETER-BRIDGE-PARITY-1A: same resolver the invoke path uses, so
  // discover and llm-invoke can never target different endpoints.
  ollamaUrl = resolveLocalLlmBase({
    envValue: process.env.DEMA_OLLAMA_URL,
    fallback: DEFAULT_OLLAMA_URL,
  }),
  lmStudioUrl = resolveLocalLlmBase({
    envValue: process.env.DEMA_LM_STUDIO_URL,
    fallback: DEFAULT_LM_STUDIO_URL,
  }),
  downloadsRoot = defaultDownloadsRoot(),
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  tcpBindings,
  includeAbsolutePaths = false,
  now = new Date(),
} = {}) {
  const ports = [portFor(ollamaUrl), portFor(lmStudioUrl)].filter(Boolean);
  const [ollama, lmStudio, downloads, tcp] = await Promise.all([
    probeOllama({ baseUrl: ollamaUrl, fetchImpl, timeoutMs }),
    probeLmStudio({ baseUrl: lmStudioUrl, fetchImpl, timeoutMs }),
    scanModelFiles(downloadsRoot, { includeAbsolutePaths }),
    resolveTcpBindings(ports, tcpBindings),
  ]);

  const providers = { ollama, lm_studio: lmStudio, downloads };
  return {
    schema: SCHEMA,
    truth_label: "MEASURED_PARTIAL",
    generated_at: now.toISOString(),
    total_models:
      ollama.model_count + lmStudio.model_count + downloads.model_count,
    boundary: {
      scope: "read-only",
      inference_invoked: false,
      local_http_probe_performed: true,
      external_network_probe_performed: false,
      tcp_listener_probe_performed: tcp.available && !tcp.skipped,
      mutation_performed: false,
      receipt_minted: false,
    },
    providers,
    routing_recommendations: buildRoutingRecommendations(providers),
    safety: buildSafety({ ollamaUrl, lmStudioUrl, tcp, providers }),
  };
}
