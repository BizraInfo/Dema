import { homedir } from "node:os";
import { extname, join } from "node:path";

export const SCHEMA = "bizra.dema.model_inventory.v0.1";
export const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
export const DEFAULT_LM_STUDIO_URL = "http://127.0.0.1:1234";
export const DEFAULT_TIMEOUT_MS = 1500;

const MODEL_EXTENSIONS = new Set([".gguf", ".safetensors", ".bin", ".onnx"]);

export function defaultDownloadsRoot() {
  return process.env.DEMA_MODEL_DOWNLOADS_ROOT
    || process.env.DEMA_DOWNLOADS_ROOT
    || join(homedir(), "Downloads");
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
