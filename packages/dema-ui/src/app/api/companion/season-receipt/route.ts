import { NextRequest, NextResponse } from "next/server";
import { requireLocalSession } from "../../../../lib/auth/session-boundary.ts";
import { readHeadSeasonReceipt } from "../../../../lib/companion/gather.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const denied = await requireLocalSession(request);
  if (denied) return denied;
  const hash = request.nextUrl.searchParams.get("hash") ?? "";
  const found = await readHeadSeasonReceipt(process.env.DEMA_HOME, hash);
  if (!found.ok) {
    return NextResponse.json(
      { ok: false, reason: found.reason, season_ids: found.season_ids ?? undefined },
      { status: found.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    { ok: true, season_id: found.season_id, receipt_hash: found.receipt_hash, receipt: found.receipt },
    { headers: { "Cache-Control": "no-store" } },
  );
}
