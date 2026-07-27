import { NextResponse } from "next/server";

// @ts-expect-error — plain ESM kernel, deliberately untyped and import-free.
import { buildConsentContract, evaluateAdmission } from "@core/first-encounter-admission.js";
// @ts-expect-error — see above.
import { scanMetadataOnly } from "@core/first-encounter-scan.js";

import { DEMO_ROOT, MISSION_QUESTION, manifestHash } from "@/lib/first-encounter/scope";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The contract is rebuilt server-side from a fresh scan rather than trusted from
 * the client. A client that posted back a widened scope would get a phrase
 * mismatch, because the required phrase is derived from the scope the server
 * actually sees — consent cannot be replayed against a bigger folder.
 *
 * P4 stops at the verdict. Admission does NOT read content yet; synthesis,
 * refusal, and receipts are the next rung and are deliberately absent.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const provided_phrase = typeof body?.phrase === "string" ? body.phrase : "";

    const scan = await scanMetadataOnly(DEMO_ROOT);
    const contract = buildConsentContract({
      root_label: "dema-neutral-mission-corpus-1a",
      root_real_path: scan.root_real_path,
      inventory: scan.inventory,
      mission_question: MISSION_QUESTION,
      manifest_hash: await manifestHash(),
    });

    const verdict = evaluateAdmission({ contract, provided_phrase });
    return NextResponse.json({ ok: true, verdict, contract }, { status: verdict.content_admitted ? 200 : 403 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: String((error as Error)?.message ?? error) },
      { status: 500 },
    );
  }
}
