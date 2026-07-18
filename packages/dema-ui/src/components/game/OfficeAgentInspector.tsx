"use client";

import { useGame } from "@/lib/game/store";
import { ORG_AGENTS } from "@/lib/game/ecosystem";
import { COLOR_CLASS } from "@/lib/game/data";
import { cn } from "@/lib/utils";
import { Panel, GlyphBadge, StatBar } from "./primitives";
import { X, Cpu, Brain, Sparkles } from "lucide-react";

export function OfficeAgentInspector() {
  const selected = useGame((s) => s.office.selectedAgent);
  const agentState = useGame((s) => (selected ? s.office.agents[selected] : null));
  const select = useGame((s) => s.selectOfficeAgent);
  const tasks = useGame((s) => s.office.tasks);

  if (!selected || !agentState) {
    return (
      <Panel title="Inspector" glyph="🔍" accent="proof" bodyClassName="p-3">
        <div className="flex flex-col items-center gap-2 py-6 text-center text-[11px] text-muted-foreground">
          <Cpu size={22} className="opacity-40" />
          Click an agent on the office floor to inspect its reasoning, skills & current task.
        </div>
      </Panel>
    );
  }

  const def = ORG_AGENTS.find((a) => a.id === selected)!;
  const c = COLOR_CLASS[def.color];
  const stateColor =
    agentState.state === "working" ? "verified" : agentState.state === "walking" ? "proof" : agentState.state === "reviewing" ? "consent" : "unknown";
  const sc = COLOR_CLASS[stateColor];
  const currentTask = tasks.find((t) => t.id === agentState.taskId);

  return (
    <Panel
      title="Inspector"
      glyph="🔍"
      accent={def.color}
      right={
        <button
          onClick={() => select(null)}
          className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-card/60 hover:text-foreground"
        >
          <X size={13} />
        </button>
      }
      bodyClassName="p-3 space-y-3 overflow-y-auto scroll-thin"
    >
      {/* identity */}
      <div className="flex items-center gap-2.5">
        <GlyphBadge glyph={def.glyph} color={def.color} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="font-mono text-sm font-bold text-foreground">{def.name}</div>
          <div className="truncate text-[11px] text-muted-foreground">{def.role}</div>
        </div>
        <span className={cn("rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase", sc.border, sc.bg, sc.text)}>
          {agentState.state}
        </span>
      </div>

      {/* SOUL */}
      <div className={cn("rounded-lg border p-2", c.border, c.bg)}>
        <div className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
          <Brain size={10} /> SOUL.md
        </div>
        <p className="mt-1 text-[11px] italic text-foreground/80">“{def.soul}”</p>
      </div>

      {/* current task / thought */}
      <div className="rounded-lg border border-border/60 bg-card/30 p-2">
        <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Current</div>
        {currentTask ? (
          <div className="mt-1">
            <div className="flex items-center gap-1.5">
              <span className={cn("text-sm", COLOR_CLASS[currentTask.color].text)}>{currentTask.glyph}</span>
              <span className="text-[11px] font-medium text-foreground">{currentTask.title}</span>
            </div>
            <StatBar value={currentTask.progress * 100} color={currentTask.color} className="mt-1.5" showGlow />
          </div>
        ) : (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {agentState.thought || "Idle — awaiting the loop."}
          </p>
        )}
        {agentState.emote && (
          <div className="mt-1 text-lg">{agentState.emote}</div>
        )}
      </div>

      {/* powers */}
      <div>
        <div className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
          <Sparkles size={10} className={c.text} /> Powers
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {def.powers.map((p) => (
            <span key={p} className={cn("rounded border px-1.5 py-0.5 text-[9px] font-mono", c.border, c.bg, c.text)}>
              {p}
            </span>
          ))}
        </div>
      </div>

      {/* reasoning chain (mock stream) */}
      <div className="rounded-lg border border-border/60 bg-background/40 p-2 font-mono text-[10px] leading-relaxed">
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">reasoning · trace</div>
        <div className="mt-1 space-y-0.5 text-foreground/70">
          <div><span className="text-proof">▸</span> observe → {def.name} at station</div>
          <div><span className="text-proof">▸</span> {agentState.state === "working" ? "executing assigned step" : agentState.state === "walking" ? "routing to target" : "idle / monitoring"}</div>
          <div><span className="text-proof">▸</span> emit structured output (no direct edits)</div>
          <div><span className={c.text}>▸</span> await SAT verification</div>
        </div>
      </div>
    </Panel>
  );
}
