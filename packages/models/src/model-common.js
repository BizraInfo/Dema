import { homedir } from "node:os";
import { extname, join } from "node:path";

export const SCHEMA = "bizra.dema.model_inventory.v0.1";
export const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
export const DEFAULT_LM_STUDIO_URL = "http://127.0.0.1:1234";
export const DEFAULT_LLAMACPP_URL = "http://127.0.0.1:8080";
export const DEFAULT_TIMEOUT_MS = 1500;

const MODEL_EXTENSIONS = new Set([".gguf", ".safetensors", ".bin", ".onnx"]);

export function defaultDownloadsRoot() {
  return (
    process.env.DEMA_MODEL_DOWNLOADS_ROOT ||
    process.env.DEMA_DOWNLOADS_ROOT ||
    join(homedir(), "Downloads")
  );
}

export function urlFor(baseUrl, path) {
  return new URL(path, baseUrl).toString();
}

export function portFor(baseUrl) {
  try {
    const url = new URL(baseUrl);
    if (url.port) return Number(url.port);
    return url.protocol === "https:" ? 443 : 80;
  } catch {
    return null;
  }
}

export function isLocalAddress(address) {
  return ["127.0.0.1", "::1", "localhost"].includes(address);
}

export function isLocalUrl(baseUrl) {
  try {
    const url = new URL(baseUrl);
    return isLocalAddress(url.hostname.replace(/^\[|\]$/g, ""));
  } catch {
    return false;
  }
}

// PERIMETER-BRIDGE-PARITY-1A — the single endpoint resolver.
//
// Every surface that needs a local LLM endpoint MUST call this, so two
// surfaces can never derive the same fact from different sources. Measured
// 2026-07-28: `dema models discover` honoured process.env.DEMA_OLLAMA_URL
// while `dema llm-invoke` ignored it, so an operator following ADR-042 would
// list models from one endpoint and invoke another.
//
// Precedence, fixed and identical everywhere:
//   1. explicit  — an operator flag (--base) always wins over ambient state
//   2. envValue  — the ADR-042 bridge (DEMA_OLLAMA_URL / DEMA_LM_STUDIO_URL / …)
//   3. fallback  — the shipped literal-loopback default
//
// The localhost-only boundary is enforced AFTER resolution regardless of which
// source supplied the value: a candidate that is not http:// on a loopback host
// is discarded and resolution continues. Nothing here throws; malformed input
// degrades to the fallback.
export function resolveLocalLlmBase({
  explicit = undefined,
  envValue = undefined,
  fallback = DEFAULT_OLLAMA_URL,
} = {}) {
  for (const candidate of [explicit, envValue]) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (trimmed === "") continue;
    if (!isLoopbackHttpUrl(trimmed)) continue;
    return trimmed;
  }
  return fallback;
}

// http:// on 127.0.0.1, ::1 or localhost. Mirrors llm-adapter's
// isLocalhostBaseUrl: URL parsing (not string matching) defeats
// "localhost.evil.example" and "localhost@evil.example", because both parse to
// a non-loopback hostname.
export function isLoopbackHttpUrl(baseUrl) {
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "http:") return false;
    const host = url.hostname
      .replace(/^\[|\]$/g, "")
      .replace(/\.$/, "")
      .toLowerCase();
    return ["localhost", "127.0.0.1", "::1"].includes(host);
  } catch {
    return false;
  }
}

export function isExposedAddress(address) {
  if (!address) return false;
  return !isLocalAddress(address.replace(/^\[|\]$/g, ""));
}

export function humanBytes(bytes) {
  const value = Number(bytes ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = value;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

export function isModelFilename(name) {
  return MODEL_EXTENSIONS.has(extname(name).toLowerCase());
}
