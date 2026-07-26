import { NextResponse } from "next/server";

// Single source of truth — the same kernel the repo's `npm test` proves.
// @ts-expect-error — plain ESM kernel, deliberately untyped and import-free.
import { buildConsentContract } from "@core/first-encounter-admission.js";
// @ts-expect-error — see above.
import { scanMetadataOnly } from "@core/first-encounter-scan.js";

import { DEMO_ROOT, MISSION_QUESTION, manifestHash } from "@/lib/first-encounter/scope";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const scan = await scanMetadataOnly(DEMO_ROOT);
    const contract = buildConsentContract({
      root_label: "dema-neutral-mission-corpus-1a",
      root_real_path: scan.root_real_path,
      inventory: scan.inventory,
      mission_question: MISSION_QUESTION,
      manifest_hash: await manifestHash(),
    });
    return NextResponse.json({
      ok: true,
      phase: "METADATA_DISCOVERY",
      inventory: scan.inventory,
      skipped: scan.skipped,
      contract,
      boundaries: scan.boundaries,
    });
  } catch (error) {
    // Fail closed: an error never falls through to a content-bearing path.
    return NextResponse.json(
      { ok: false, phase: "METADATA_DISCOVERY", error: String((error as Error)?.message ?? error) },
      { status: 500 },
    );
  }
}
