"use client";

import { DOCTRINE } from "@/lib/game/data";
import { SceneHeader } from "./primitives";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function Codex() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <SceneHeader
        title="Doctrine Codex"
        glyph="📖"
        accent="consent"
        subtitle="Study the constitutional law of BIZRA Node0. Every gate, agent, and receipt obeys these principles."
      />

      {/* narrative law */}
      <div className="glass relative overflow-hidden rounded-xl border border-consent/40 p-4 glow-consent">
        <div className="shimmer absolute inset-0 opacity-40" />
        <div className="relative">
          <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-consent">Narrative Law</h3>
          <blockquote className="mt-2 font-mono text-sm leading-relaxed text-foreground/90 sm:text-base">
            “Power without proof is overclaim.<br />
            Autonomy without consent is violation.<br />
            Knowledge without evidence is noise.<br />
            A sovereign node earns trust by closing one verified gate at a time.”
          </blockquote>
        </div>
      </div>

      <div className="glass scroll-thin min-h-0 flex-1 overflow-y-auto rounded-xl border border-border p-3">
        <Accordion type="single" collapsible className="space-y-2">
          {DOCTRINE.map((d, i) => (
            <AccordionItem
              key={d.title}
              value={`item-${i}`}
              className="overflow-hidden rounded-lg border border-border/60 bg-card/30 px-3"
            >
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2.5">
                  <span className="text-lg text-consent">{d.glyph}</span>
                  <span className="font-mono text-sm font-semibold">{d.title}</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {d.body}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
