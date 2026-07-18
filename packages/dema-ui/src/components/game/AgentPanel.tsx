"use client";

import { useGame } from "@/lib/game/store";
import { AGENTS, COLOR_CLASS, ZONES } from "@/lib/game/data";
import { cn } from "@/lib/utils";
import { Panel } from "./primitives";
import { AgentDetailDialog } from "./AgentDetailDialog";
import { useState } from "react";
import type { AgentId } from "@/lib/game/types";

const XP_PER_LEVEL = 150;

export function AgentPanel({ asSheet = false }: { asSheet?: boolean }) {
  const agents = useGame((s) => s.agents);
  const [open, setOpen] = useState<AgentId | null>(null);

  const deployedCount = Object.values(agents).filter((a) => a.deployed).length;

  return (
    <Panel
      title="Agent Party"
      glyph="✦"
      accent="knowledge"
      right={
        <span className="font-mono text-[10px] text-muted-foreground">
          {AGENTS.length} / {deployedCount} active
        </span>
      }
      className={cn(asSheet && "h-full border-0")}
      bodyClassName="scroll-thin overflow-y-auto p-2 space-y-1.5 max-h-full"
    >
      {AGENTS.map((a) => {
        const st = agents[a.id];
        const c = COLOR_CLASS[a.color];
        const zone = ZONES.find((z) => z.id === a.zone);
        const lvlPct = ((st.xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100;
        return (
          <button
            key={a.id}
            onClick={() => setOpen(a.id)}
            className={cn(
              "group flex w-full items-center gap-2.5 rounded-lg border border-border/60 bg-card/40 p-2 text-left transition-all hover:border-border hover:bg-card/70"
            )}
          >
            <span
              className={cn(
                "relative grid size-9 shrink-0 place-items-center rounded-lg border font-mono text-lg",
                c.bg,
                c.border,
                c.text
              )}
            >
              {a.glyph}
              {st.deployed && (
                <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-verified anim-pulse" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-xs font-medium text-foreground">
                  {a.name}
                </span>
                <span className={cn("font-mono text-[10px]", c.text)}>L{st.level}</span>
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-foreground/10">
                <div
                  className={cn("h-full rounded-full", c.dot)}
                  style={{ width: `${st.level >= 5 ? 100 : lvlPct}%` }}
                />
              </div>
              <div className="mt-0.5 truncate text-[9px] uppercase tracking-wider text-muted-foreground">
                {zone?.short} · {a.role.split(",")[0]}
              </div>
            </div>
          </button>
        );
      })}

      <AgentDetailDialog
        agentId={open}
        onClose={() => setOpen(null)}
      />
    </Panel>
  );
}
