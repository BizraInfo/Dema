import { NextRequest, NextResponse } from "next/server";
import { requireLocalSession } from "../../../../lib/auth/session-boundary.ts";
import { gatherPresence } from "../../../../lib/companion/gather.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const denied = await requireLocalSession(request);
  if (denied) return denied;
  // Past the session gate the cookie is valid. It is still not a receipt.
  const projection = await gatherPresence(process.env.DEMA_HOME, true);
  return NextResponse.json(projection, { headers: { "Cache-Control": "no-store" } });
}
