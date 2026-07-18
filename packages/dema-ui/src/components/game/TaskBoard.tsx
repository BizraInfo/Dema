"use client";

import { useGame } from "@/lib/game/store";
import { COLOR_CLASS } from "@/lib/game/data";
import { stationById } from "@/lib/game/ecosystem";
import { cn } from "@/lib/utils";
import { Panel } from "./primitives";
import { Inbox, Loader2, Check } from "lucide-react";

export function TaskBoard({ asSheet = false }: { asSheet?: boolean }) {
  const tasks = useGame((s) => s.office.tasks);
  const completed = useGame((s) => s.office.completedCount);
  const spawn = useGame((s) => s.spawnOfficeTask);

  return (
    <Panel
      title="Task Board"
      glyph="🗂"
      accent="proof"
      right={
        <button
          onClick={spawn}
          className="rounded border border-proof/40 bg-proof/10 px-1.5 py-0.5 font-mono text-[9px] uppercase text-proof hover:bg-proof/20"
        >
          + task
        </button>
      }
      className={cn(asSheet && "h-full border-0")}
      bodyClassName="scroll-thin overflow-y-auto p-2 space-y-1.5 max-h-full"
    >
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-1 p-4 text-center text-[11px] text-muted-foreground">
          <Inbox size={20} className="opacity-40" />
          No active tasks. Ignite the loop or spawn one.
        </div>
      ) : (
        tasks.map((t) => {
          const c = COLOR_CLASS[t.color];
          const stn = stationById(t.route[t.step]);
          const ag = t.agentId;
          return (
            <div
              key={t.id}
              className={cn("rounded-lg border bg-card/40 p-2", c.border)}
            >
              <div className="flex items-center gap-1.5">
                <span className={cn("text-sm", c.text)}>{t.glyph}</span>
                <span className="flex-1 truncate text-[11px] font-medium text-foreground">
                  {t.title}
                </span>
                {t.status === "working" ? (
                  <Loader2 size={11} className="animate-spin text-proof" />
                ) : (
                  <span className="text-[9px] font-mono text-muted-foreground">→ {stn?.name}</span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-[8px] font-mono uppercase text-muted-foreground">
                  step {t.step + 1}/{t.route.length}
                </span>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/10">
                  <div
                    className={cn("h-full rounded-full transition-all", c.dot)}
                    style={{ width: `${t.status === "working" ? t.progress * 100 : 100}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })
      )}
      <div className="flex items-center justify-between px-1 pt-1 text-[9px] font-mono text-muted-foreground">
        <span>active {tasks.length}</span>
        <span className="flex items-center gap-1 text-verified">
          <Check size={10} /> {completed} delivered
        </span>
      </div>
    </Panel>
  );
}
