import { NextRequest, NextResponse } from "next/server";
import { requireLocalSession, readLocalSession } from "@/lib/auth/session-boundary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = await requireLocalSession(request);
  if (denied) return denied;
  const session = await readLocalSession();
  return NextResponse.json(
    { ok: true, authenticated: true, expires_at: session.ok && session.expiresAt ? new Date(session.expiresAt * 1000).toISOString() : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST() {
  return NextResponse.json({ ok: false, code: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { Allow: "GET" } });
}
