import { NextRequest, NextResponse } from "next/server";
import {
  configuredLocalSecret,
  isLoopbackHost,
  localAuthStatus,
  safeNextPath,
  secretsEqual,
  setLocalSession,
  clearLocalSession,
} from "@/lib/auth/session-boundary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function localOnly(request: NextRequest) {
  return isLoopbackHost(request.headers.get("host"));
}

function rateLimitKey(request: NextRequest) {
  return request.headers.get("host") ?? "unknown";
}

function consumeAttempt(key: string) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + WINDOW_MS };
    attempts.set(key, fresh);
    return { blocked: false, retryAfter: 0 };
  }
  if (current.count >= MAX_ATTEMPTS) {
    return { blocked: true, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  current.count += 1;
  return { blocked: false, retryAfter: 0 };
}

export async function POST(request: NextRequest) {
  if (!localOnly(request)) {
    return NextResponse.json({ ok: false, code: "LOCAL_HOST_REQUIRED" }, { status: 403 });
  }

  const status = localAuthStatus();
  if (!status.usable) {
    return NextResponse.json(
      { ok: false, code: `AUTH_${(status.reason ?? "missing_secret").toUpperCase()}`, error: "Local authentication is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const attempt = consumeAttempt(rateLimitKey(request));
  if (attempt.blocked) {
    return NextResponse.json(
      { ok: false, code: "AUTH_RATE_LIMITED", retry_after: attempt.retryAfter },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(attempt.retryAfter) } },
    );
  }

  const body = await request.json().catch(() => null);
  const candidate = typeof body?.secret === "string" ? body.secret : "";
  const secret = configuredLocalSecret();
  if (!secret || !secretsEqual(candidate, secret)) {
    return NextResponse.json(
      { ok: false, code: "AUTH_INVALID_CREDENTIALS", error: "Local authentication failed." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const response = NextResponse.json(
    { ok: true, authenticated: true, next: safeNextPath(typeof body?.next === "string" ? body.next : "/realm") },
    { headers: { "Cache-Control": "no-store" } },
  );
  return setLocalSession(response, secret, request.nextUrl.protocol === "https:");
}

export async function DELETE(request: NextRequest) {
  if (!localOnly(request)) return NextResponse.json({ ok: false, code: "LOCAL_HOST_REQUIRED" }, { status: 403 });
  const response = NextResponse.json({ ok: true, authenticated: false }, { headers: { "Cache-Control": "no-store" } });
  return clearLocalSession(response);
}

export async function GET() {
  return NextResponse.json({ ok: false, code: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { Allow: "POST, DELETE" } });
}
