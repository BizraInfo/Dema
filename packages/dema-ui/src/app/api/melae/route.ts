import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { MELAE_SYSTEM_PROMPT } from "@/lib/game/melae";
import type { MelaeResult } from "@/lib/game/melae";

export const runtime = "nodejs";
export const maxDuration = 30;

// ---------------------------------------------------------------------------
// POST /api/melae
// Body: { prompt: string }
// Returns: MelaeResult (strict JSON from the LLM) or a preview-classified error
// (bizra.dema.ui_preview.diagnostic.v0.1 — a UI teaching lens, not the real FDE kernel).
//
// Doctrine: if the LLM is unavailable, this is an OUTWARD failure.
// We never launder it as a fake success. The error is classified and returned.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  let body: { prompt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        diagnostic: "bizra.dema.ui_preview.diagnostic.v0.1",
        lens: "inward",
        failure_class: "schema",
        error: "Invalid JSON body.",
      },
      { status: 400 }
    );
  }

  const prompt = body?.prompt?.trim();
  if (!prompt || prompt.length < 2) {
    return NextResponse.json(
      {
        ok: false,
        diagnostic: "bizra.dema.ui_preview.diagnostic.v0.1",
        lens: "inward",
        failure_class: "schema",
        error: "Prompt is too short (minimum 2 characters).",
      },
      { status: 400 }
    );
  }
  if (prompt.length > 8000) {
    return NextResponse.json(
      {
        ok: false,
        diagnostic: "bizra.dema.ui_preview.diagnostic.v0.1",
        lens: "inward",
        failure_class: "schema",
        error: "Prompt exceeds 8000 character limit.",
      },
      { status: 413 }
    );
  }

  // EXTERNAL EGRESS BOUNDARY: this route sends the prompt to an external LLM
  // (z-ai-web-dev-sdk). The app is LOCAL_ONLY by default, so egress is
  // fail-closed — it requires an explicit operator opt-in. Without it we
  // disclose the egress and refuse, never silently phoning out.
  if (process.env.DEMA_MELAE_EXTERNAL_LLM !== "1") {
    return NextResponse.json(
      {
        ok: false,
        diagnostic: "bizra.dema.ui_preview.diagnostic.v0.1",
        lens: "outward",
        failure_class: "consent_required",
        external_egress: true,
        egress_target: "z-ai-web-dev-sdk (external LLM)",
        error:
          "External LLM egress is disabled by default (LOCAL_ONLY). Enabling it sends your prompt to an external third-party service. Set DEMA_MELAE_EXTERNAL_LLM=1 to opt in.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: MELAE_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      thinking: { type: "disabled" },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw || raw.trim().length === 0) {
      // OUTWARD — the model returned nothing; this is an environment/service issue
      return NextResponse.json(
        {
          ok: false,
          diagnostic: "bizra.dema.ui_preview.diagnostic.v0.1",
          lens: "outward",
          failure_class: "network",
          error: "LLM returned an empty response. The model may be temporarily unavailable.",
        },
        { status: 502 }
      );
    }

    // Strip markdown code fences if present
    const cleaned = raw
      .replace(/^```(?:json)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim();

    let result: MelaeResult;
    try {
      result = JSON.parse(cleaned);
    } catch {
      // INWARD — the model returned non-JSON; this is a proof/verification failure
      // Try to extract a JSON object from the text as a fallback
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[0]);
        } catch {
          return NextResponse.json(
            {
              ok: false,
              diagnostic: "bizra.dema.ui_preview.diagnostic.v0.1",
              lens: "inward",
              failure_class: "proof",
              error: "LLM response was not valid JSON. Proof verification failed.",
              raw: cleaned.slice(0, 500),
            },
            { status: 502 }
          );
        }
      } else {
        return NextResponse.json(
          {
            ok: false,
            diagnostic: "bizra.dema.ui_preview.diagnostic.v0.1",
            lens: "inward",
            failure_class: "proof",
            error: "LLM response contained no JSON object. Proof verification failed.",
            raw: cleaned.slice(0, 500),
          },
          { status: 502 }
        );
      }
    }

    // Validate the schema minimally
    if (
      !result.analytical_diagnostics ||
      typeof result.analytical_diagnostics.initial_snr !== "number" ||
      typeof result.optimized_prompt !== "string"
    ) {
      return NextResponse.json(
        {
          ok: false,
          diagnostic: "bizra.dema.ui_preview.diagnostic.v0.1",
          lens: "inward",
          failure_class: "schema",
          error: "LLM response did not match the MELAE output schema.",
          raw: cleaned.slice(0, 500),
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      result,
      received_at: Date.now(),
    });
  } catch (err: unknown) {
    // OUTWARD — SDK / network / auth failure. Do NOT pretend success.
    const message = err instanceof Error ? err.message : "Unknown SDK error";
    return NextResponse.json(
      {
        ok: false,
        diagnostic: "bizra.dema.ui_preview.diagnostic.v0.1",
        lens: "outward",
        failure_class: "ci_unavailable",
        error: `LLM service unavailable: ${message}`,
      },
      { status: 503 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    engine: "MELAE v3.0",
    doctrine: "bizra.dema.ui_preview.diagnostic.v0.1",
    status: "ready",
    description:
      "Master Expert Linguistic Autonomous Engine. POST { prompt: string } to analyze & optimize.",
  });
}
