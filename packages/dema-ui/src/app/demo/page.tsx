"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type BoundCount = { value: number | boolean; path: string };

type Story = {
  title: string;
  situation: string;
  what_node0_did: string;
  what_changed: string;
  hero_number: { label: string; value: number; bound_to: string };
  bound_counts: Record<string, BoundCount>;
  demo_stage: string;
  truth_label: string;
  preview_only: boolean;
  framing: string;
};

type Payload = {
  ok: boolean;
  story?: Story;
  truth_label?: string;
  demo_stage?: string;
  command?: string;
  error?: string;
};

/**
 * DEMO-STORY-1A — narrative face for the measured killer-demo counters.
 * Numbers come only from the core kernel via /api/demo/node0-value-loop.
 */
export default function DemoStoryPage() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/demo/node0-value-loop");
        const json = (await res.json()) as Payload;
        if (!cancelled) setPayload(json);
      } catch (err) {
        if (!cancelled) setError(String((err as Error)?.message ?? err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const story = payload?.story;

  return (
    <main className="min-h-screen bg-[#07090c] px-6 py-12 text-[#e8e4dc] md:px-10">
      <div className="mx-auto max-w-3xl space-y-10">
        <header className="space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#c49a5a]">
            Dema · Node0 demo story
          </p>
          <h1 className="font-serif text-3xl leading-tight md:text-4xl">
            {story?.title ?? "Loading local proof story…"}
          </h1>
          <p className="font-mono text-xs text-[#8b93a3]">
            {story?.framing ?? "PRE_TOKEN_LOCAL_PROOF · preview-only"}
          </p>
        </header>

        {error && (
          <p className="rounded border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">
            {error}
          </p>
        )}

        {story && (
          <section className="space-y-8">
            <article className="space-y-2">
              <h2 className="text-sm uppercase tracking-[0.2em] text-[#c49a5a]">
                Situation
              </h2>
              <p className="text-lg leading-relaxed text-[#d8d2c6]">
                {story.situation}
              </p>
            </article>
            <article className="space-y-2">
              <h2 className="text-sm uppercase tracking-[0.2em] text-[#c49a5a]">
                What Node0 did
              </h2>
              <p className="text-lg leading-relaxed text-[#d8d2c6]">
                {story.what_node0_did}
              </p>
            </article>
            <article className="space-y-2">
              <h2 className="text-sm uppercase tracking-[0.2em] text-[#c49a5a]">
                What changed
              </h2>
              <p className="text-lg leading-relaxed text-[#d8d2c6]">
                {story.what_changed}
              </p>
            </article>

            <div className="rounded-lg border border-[#c49a5a]/35 bg-[#0c1016] p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#c49a5a]">
                Hero number (kernel-bound)
              </p>
              <p className="mt-2 font-serif text-5xl text-[#e8e4dc]">
                {story.hero_number.value}
              </p>
              <p className="mt-2 text-sm text-[#a8b0bd]">
                {story.hero_number.label}
              </p>
              <p className="mt-1 font-mono text-[10px] text-[#6b7382]">
                bound_to: {story.hero_number.bound_to}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(story.bound_counts).map(([key, count]) => (
                <div
                  key={key}
                  className="rounded border border-white/10 bg-black/30 p-4"
                >
                  <p className="font-mono text-[10px] uppercase tracking-wider text-[#8b93a3]">
                    {key}
                  </p>
                  <p className="mt-1 text-2xl">{String(count.value)}</p>
                  <p className="mt-1 font-mono text-[10px] text-[#5f6673]">
                    {count.path}
                  </p>
                </div>
              ))}
            </div>

            <p className="font-mono text-xs text-[#8b93a3]">
              truth: {story.truth_label} · stage: {story.demo_stage} ·{" "}
              {payload?.command}
            </p>
          </section>
        )}

        <footer className="flex flex-wrap gap-4 border-t border-white/10 pt-6 text-sm">
          <Link href="/" className="text-[#c49a5a] underline-offset-4 hover:underline">
            ← First encounter
          </Link>
          <span className="font-mono text-[#6b7382]">
            CLI: dema demo node0-value-loop
          </span>
        </footer>
      </div>
    </main>
  );
}
