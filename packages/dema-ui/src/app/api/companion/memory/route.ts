import { NextRequest, NextResponse } from "next/server";
import { requireLocalSession } from "../../../../lib/auth/session-boundary.ts";
import { gatherMemoryIndex } from "../../../../lib/companion/gather.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const denied = await requireLocalSession(request);
  if (denied) return denied;
  const index = await gatherMemoryIndex(process.env.DEMA_HOME);
  return NextResponse.json(index, {
    status: index.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
