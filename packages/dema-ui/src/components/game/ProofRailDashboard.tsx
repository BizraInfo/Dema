"use client";

import { useGame } from "@/lib/game/store";
import { COLOR_CLASS, RAIL_META } from "@/lib/game/data";
import { cn } from "@/lib/utils";
import { Panel } from "./primitives";

export function ProofRailDashboard({ compact = false }: { compact?: boolean }) {
  const rails = useGame((s) => s.rails);

  return (
    <Panel title="Proof Rails" glyph="△" accent="proof" bodyClassName="p-3">
      <div className={cn("grid gap-2", compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
        {RAIL_META.map((r) => {
          const lit = rails[r.key];
          const c = COLOR_CLASS[r.color];
          return (
            <div
              key={r.key}
              className={cn(
                "relative overflow-hidden rounded-lg border p-2.5 transition-all",
                lit ? cn(c.border, c.bg) : "border-border/50 bg-card/30"
              )}
            >
              {lit && <div className="shimmer absolute inset-0" />}
              <div className="relative flex items-center justify-between">
                <span className={cn("font-mono text-[11px] font-semibold uppercase tracking-wider", lit ? c.text : "text-muted-foreground")}>
                  {r.name}
                </span>
                <span className={cn("size-2 rounded-full", lit ? c.dot : "bg-foreground/20", lit && "anim-pulse")} />
              </div>
              <p className="relative mt-1 text-[10px] leading-snug text-muted-foreground">{r.desc}</p>
              {r.preview && (
                <span className="relative mt-1 inline-block rounded bg-consent/15 px-1 text-[8px] font-mono uppercase text-consent">
                  preview
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
