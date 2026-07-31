import { NextResponse } from "next/server";

// @ts-expect-error — plain ESM kernel
import {
  buildNode0KillerDemoValueLoopCli,
  verifyNode0KillerDemoValueLoopCli,
} from "@core/node0-killer-demo-value-loop-cli.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const envelope = buildNode0KillerDemoValueLoopCli();
    const verified = verifyNode0KillerDemoValueLoopCli(envelope);
    return NextResponse.json({
      ok: verified.ok,
      blocked_by: verified.blocked_by,
      story: envelope.story,
      truth_label: envelope.truth_label,
      demo_stage: envelope.demo_stage,
      command: envelope.command,
      bound_counts: envelope.story?.bound_counts ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: String((error as Error)?.message ?? error),
      },
      { status: 500 },
    );
  }
}
