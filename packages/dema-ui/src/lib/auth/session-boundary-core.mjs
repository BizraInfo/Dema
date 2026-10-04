import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const LOCAL_SESSION_COOKIE = "dema_local_session_v1";
export const LOCAL_SESSION_TTL_SECONDS = 15 * 60;
export const LOCAL_AUTH_SECRET_ENV = "DEMA_LOCAL_AUTH_SECRET";

const SESSION_VERSION = "v1";
const CLOCK_SKEW_SECONDS = 30;

export function configuredLocalSecret(env = process.env) {
  const explicit = typeof env[LOCAL_AUTH_SECRET_ENV] === "string" ? env[LOCAL_AUTH_SECRET_ENV].trim() : "";
  if (explicit) return explicit;
  if (String(env.AUTH_PROVIDER ?? "").trim().toLowerCase() === "local") {
    const canonical = typeof env.AUTH_SECRET === "string" ? env.AUTH_SECRET.trim() : "";
    if (canonical) return canonical;
  }
  return null;
}

export function secretStatus(env = process.env) {
  const secret = configuredLocalSecret(env);
  if (!secret) return { configured: false, usable: false, reason: "missing_secret" };
  if (Buffer.byteLength(secret, "utf8") < 32) {
    return { configured: true, usable: false, reason: "secret_too_short" };
  }
  return { configured: true, usable: true, reason: null };
}

export function isLoopbackHost(hostHeader) {
  if (typeof hostHeader !== "string" || !hostHeader.trim()) return false;
  const raw = hostHeader.trim().toLowerCase();
  if (raw === "::1") return true;
  if (raw.startsWith("[")) {
    const close = raw.indexOf("]");
    if (close < 0 || raw.slice(1, close) !== "::1") return false;
    const suffix = raw.slice(close + 1);
    return suffix === "" || /^:\d+$/.test(suffix);
  }
  const parts = raw.split(":");
  if (parts.length > 2 || (parts.length === 2 && !/^\d+$/.test(parts[1]))) return false;
  const hostname = parts[0];
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function sessionMac(secret, payload) {
  return createHmac("sha256", secret).update(payload, "utf8").digest("base64url");
}

function equalText(left, right) {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function secretsEqual(left, right) {
  return typeof left === "string" && typeof right === "string" && equalText(left, right);
}

export function issueLocalSession(secret, nowMs = Date.now()) {
  const issuedAt = Math.floor(nowMs / 1000);
  const nonce = randomBytes(32).toString("base64url");
  const payload = `${SESSION_VERSION}.${issuedAt}.${nonce}`;
  return `${payload}.${sessionMac(secret, payload)}`;
}

export function verifyLocalSession(value, secret, nowMs = Date.now()) {
  if (typeof value !== "string") return { ok: false, reason: "missing_session" };
  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== SESSION_VERSION) return { ok: false, reason: "malformed_session" };

  const issuedAt = Number(parts[1]);
  if (!Number.isSafeInteger(issuedAt) || issuedAt <= 0) return { ok: false, reason: "invalid_timestamp" };

  const now = Math.floor(nowMs / 1000);
  const age = now - issuedAt;
  if (age < -CLOCK_SKEW_SECONDS) return { ok: false, reason: "future_session" };
  if (age > LOCAL_SESSION_TTL_SECONDS) return { ok: false, reason: "expired_session" };

  const payload = `${parts[0]}.${parts[1]}.${parts[2]}`;
  if (!equalText(sessionMac(secret, payload), parts[3])) return { ok: false, reason: "invalid_signature" };
  return { ok: true, issuedAt, expiresAt: issuedAt + LOCAL_SESSION_TTL_SECONDS };
}

export function cookieHeader(value, secure = false) {
  const flags = [
    `${LOCAL_SESSION_COOKIE}=${value}`,
    "Path=/",
    `Max-Age=${LOCAL_SESSION_TTL_SECONDS}`,
    "HttpOnly",
    "SameSite=Strict",
  ];
  if (secure) flags.push("Secure");
  return flags.join("; ");
}

export function clearCookieHeader() {
  return `${LOCAL_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict`;
}

export function parseCookieHeader(header) {
  if (typeof header !== "string") return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === LOCAL_SESSION_COOKIE) return rest.join("=") || null;
  }
  return null;
}

export function safeNextPath(value) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.includes("\r") ||
    value.includes("\n")
  ) return "/realm";
  return value;
}
