import { NextRequest, NextResponse } from "next/server";
import { requireLocalSession } from "../../../../lib/auth/session-boundary.ts";
import {
  OPERATOR_BOND_CONSENT_PHRASE,
  OPERATOR_BOND_SEASON_BLOCK_REASON,
  writeOperatorBond,
} from "../../../../../../core/src/operator-profile.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function home() {
  return process.env.DEMA_HOME || undefined;
}

export async function GET(request: NextRequest) {
  const denied = await requireLocalSession(request);
  if (denied) return denied;
  return NextResponse.json({
    ok: true,
    required_phrase: OPERATOR_BOND_CONSENT_PHRASE,
    season_binding: "BLOCKED",
    season_binding_reason: OPERATOR_BOND_SEASON_BLOCK_REASON,
    writes: "profile.json",
    boundary: { read_only: true, network_used: false, file_write_performed: false },
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const denied = await requireLocalSession(request);
  if (denied) return denied;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "body_not_json" }, { status: 400 });
  }
  const result = await writeOperatorBond({
    home: home(),
    consent: body?.consent,
    preferred_name: body?.preferred_name,
    language_code: body?.language_code,
    secondary_language_code: body?.secondary_language_code ?? null,
  });
  return NextResponse.json(result, {
    status: result.ok ? 200 : result.reason === "consent_phrase_mismatch" ? 403 : 422,
    headers: { "Cache-Control": "no-store" },
  });
}
