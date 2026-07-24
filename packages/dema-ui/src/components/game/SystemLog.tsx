"use client";

import { useGame } from "@/lib/game/store";
import { cn } from "@/lib/utils";
import { Panel } from "./primitives";
import type { LogEntry } from "@/lib/game/store";

const KIND_CLASS: Record<LogEntry["kind"], string> = {
  info: "text-muted-foreground",
  proof: "text-proof",
  consent: "text-consent",
  fail: "text-fail",
  learn: "text-verified",
  loop: "text-knowledge",
};

export function SystemLog({ asSheet = false }: { asSheet?: boolean }) {
  const log = useGame((s) => s.office.log);

  return (
    <Panel
      title="System Activity"
      glyph="📡"
      accent="snr"
      right={
        <span className="font-mono text-[10px] text-muted-foreground">
          {log.length} events
        </span>
      }
      className={cn(asSheet && "h-full border-0")}
      bodyClassName="scroll-thin overflow-y-auto p-2 space-y-0.5 max-h-full"
    >
      {log.map((e) => (
        <div
          key={e.id}
          className="flex items-start gap-1.5 rounded px-1.5 py-1 text-[11px] hover:bg-card/40"
        >
          <span className="mt-0.5 text-xs leading-none">{e.glyph}</span>
          <div className="min-w-0 flex-1">
            <span className={cn("font-mono text-[9px] uppercase tracking-wider", KIND_CLASS[e.kind])}>
              {e.agent}
            </span>
            <p className="truncate text-foreground/80">{e.text}</p>
          </div>
        </div>
      ))}
    </Panel>
  );
}
