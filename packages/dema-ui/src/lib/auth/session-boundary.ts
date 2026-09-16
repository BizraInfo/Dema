import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import {
  clearCookieHeader,
  configuredLocalSecret,
  cookieHeader,
  isLoopbackHost,
  issueLocalSession,
  LOCAL_SESSION_COOKIE,
  parseCookieHeader,
  safeNextPath,
  secretsEqual,
  secretStatus,
  verifyLocalSession,
} from "./session-boundary-core.mjs";

export {
  configuredLocalSecret,
  isLoopbackHost,
  issueLocalSession,
  LOCAL_SESSION_COOKIE,
  safeNextPath,
  secretsEqual,
  secretStatus,
  verifyLocalSession,
};

export function localAuthStatus() {
  return secretStatus();
}

export function localHostAllowed(hostHeader: string | null | undefined): boolean {
  return isLoopbackHost(hostHeader);
}

function unauthorized(code: string, status = 401) {
  const error =
    status === 403
      ? "Loopback host required"
      : status === 503
        ? "Local authentication is not configured"
        : "Authentication required";
  return NextResponse.json(
    { ok: false, code, error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function requireLocalSession(request: Request): Promise<NextResponse | null> {
  if (!localHostAllowed(request.headers.get("host"))) return unauthorized("LOCAL_HOST_REQUIRED", 403);

  const status = localAuthStatus();
  if (!status.usable) return unauthorized(`AUTH_${(status.reason ?? "missing_secret").toUpperCase()}`, 503);

  const cookie = parseCookieHeader(request.headers.get("cookie"));
  const result = verifyLocalSession(cookie, configuredLocalSecret() as string);
  if (!result.ok) return unauthorized("AUTH_SESSION_REQUIRED", 401);
  return null;
}

export async function readLocalSession() {
  const requestHeaders = await headers();
  if (!localHostAllowed(requestHeaders.get("host"))) return { ok: false as const, reason: "LOCAL_HOST_REQUIRED" };
  const status = localAuthStatus();
  if (!status.usable) return { ok: false as const, reason: `AUTH_${(status.reason ?? "missing_secret").toUpperCase()}` };
  const store = await cookies();
  const result = verifyLocalSession(store.get(LOCAL_SESSION_COOKIE)?.value ?? null, configuredLocalSecret() as string);
  return result.ok
    ? { ok: true as const, issuedAt: result.issuedAt, expiresAt: result.expiresAt }
    : { ok: false as const, reason: result.reason };
}

export function setLocalSession(response: NextResponse, secret: string, secure: boolean) {
  response.headers.set("Set-Cookie", cookieHeader(issueLocalSession(secret), secure));
  return response;
}

export function clearLocalSession(response: NextResponse) {
  response.headers.set("Set-Cookie", clearCookieHeader());
  return response;
}
