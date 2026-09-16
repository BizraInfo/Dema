import { NextRequest, NextResponse } from "next/server";
import { requireLocalSession } from "@/lib/auth/session-boundary";
import { readFounderSituation } from "@core/founder-useful-system.js";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = await requireLocalSession(req);
  if (denied) return denied;
  const envelope = readFounderSituation();
  return NextResponse.json(envelope, { headers: { "Cache-Control": "no-store" } });
}
