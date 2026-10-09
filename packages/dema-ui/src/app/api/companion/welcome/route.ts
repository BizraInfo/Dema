import { NextRequest, NextResponse } from "next/server";
import { requireLocalSession } from "../../../../lib/auth/session-boundary.ts";
import { gatherWelcome } from "../../../../lib/companion/gather.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const denied = await requireLocalSession(request);
  if (denied) return denied;
  const projection = await gatherWelcome(process.env.DEMA_HOME);
  return NextResponse.json(projection, { headers: { "Cache-Control": "no-store" } });
}
