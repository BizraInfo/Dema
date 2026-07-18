"use client";

import { useGame } from "@/lib/game/store";
import { AUTOPOIETIC_STAGES, VERIFICATION_RAILS, stationById } from "@/lib/game/ecosystem";
import { COLOR_CLASS } from "@/lib/game/data";
import { cn } from "@/lib/utils";
import { ArrowRight, Check, Minus } from "lucide-react";

export function StructuralView() {
  const stage = useGame((s) => s.office.loopStage);
  const tasks = useGame((s) => s.office.tasks);
  const selectedId = useGame((s) => s.office.selectedProposal);
  const proposal = useGame((s) =>
    selectedId ? s.office.proposals.find((p) => p.id === selectedId) : null
  );

  return (
    <div className="glass scroll-thin h-full min-h-0 overflow-y-auto rounded-xl border border-border p-3">
      <div className="flex items-center justify-between pb-2">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Structural View · DAG
        </h3>
        <span className="font-mono text-[9px] text-proof">cold lens</span>
      </div>

      {/* loop pipeline */}
      <div className="mb-3">
        <div className="mb-1 text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
          autopoietic pipeline
        </div>
        <div className="flex items-center gap-0.5 overflow-x-auto pb-1">
          {AUTOPOIETIC_STAGES.map((s, i) => {
            const c = COLOR_CLASS[s.color];
            const active = i === stage;
            const done = i < stage;
            return (
              <div key={s.id} className="flex items-center shrink-0">
                <div
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-md border px-1.5 py-1 transition-all",
                    active ? cn(c.border, c.bg, c.text, "glow-proof") : done ? "border-verified/30 bg-verified/5 text-verified" : "border-border/50 bg-card/30 text-muted-foreground"
                  )}
                >
                  <span className="text-sm">{s.glyph}</span>
                  <span className="font-mono text-[8px] uppercase">{s.name}</span>
                </div>
                {i < AUTOPOIETIC_STAGES.length - 1 && (
                  <ArrowRight size={10} className="mx-0.5 text-border" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* task swimlane */}
      <div className="mb-3">
        <div className="mb-1 text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
          task flow · {tasks.length} active
        </div>
        {tasks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/50 p-3 text-center text-[11px] text-muted-foreground">
            No active tasks in the pipeline.
          </div>
        ) : (
          <div className="space-y-1">
            {tasks.map((t) => {
              const c = COLOR_CLASS[t.color];
              return (
                <div key={t.id} className="rounded-lg border border-border/60 bg-card/30 p-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("text-xs", c.text)}>{t.glyph}</span>
                    <span className="flex-1 truncate text-[10px] text-foreground">{t.title}</span>
                    <span className="font-mono text-[8px] text-muted-foreground">
                      {t.status} · {t.step + 1}/{t.route.length}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-0.5 overflow-x-auto">
                    {t.route.map((sid, i) => {
                      const stn = stationById(sid);
                      const reached = i < t.step;
                      const current = i === t.step;
                      return (
                        <div key={sid} className="flex items-center shrink-0">
                          <div
                            className={cn(
                              "rounded px-1 py-0.5 font-mono text-[8px] uppercase",
                              current ? cn(c.bg, c.text) : reached ? "bg-verified/15 text-verified" : "bg-foreground/5 text-muted-foreground"
                            )}
                          >
                            {stn?.name}
                          </div>
                          {i < t.route.length - 1 && <span className="text-border mx-0.5">→</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* verification rails for selected proposal */}
      <div>
        <div className="mb-1 text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
          verification mesh {proposal ? `· ${proposal.title.slice(0, 24)}` : "· select a proposal"}
        </div>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-5">
          {VERIFICATION_RAILS.map((r) => {
            const passed = proposal?.rails[r.id];
            const c = COLOR_CLASS[r.color];
            return (
              <div
                key={r.id}
                className={cn(
                  "flex items-center gap-1 rounded border p-1",
                  passed ? cn(c.border, c.bg) : "border-border/50 bg-card/20"
                )}
              >
                {passed ? (
                  <Check size={10} className={c.text} />
                ) : (
                  <Minus size={10} className="text-muted-foreground" />
                )}
                <span className={cn("truncate text-[8px] font-mono uppercase", passed ? c.text : "text-muted-foreground")}>
                  {r.name}
                </span>
                {r.required && <span className="text-[7px] text-fail">●</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
