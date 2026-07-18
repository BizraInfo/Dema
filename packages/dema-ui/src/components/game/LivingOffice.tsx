"use client";

import { motion } from "framer-motion";
import { useGame } from "@/lib/game/store";
import { WORKSTATIONS, ORG_AGENTS, stationById } from "@/lib/game/ecosystem";
import { COLOR_CLASS } from "@/lib/game/data";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function LivingOffice() {
  const agents = useGame((s) => s.office.agents);
  const tasks = useGame((s) => s.office.tasks);
  const selectedAgent = useGame((s) => s.office.selectedAgent);
  const selectAgent = useGame((s) => s.selectOfficeAgent);
  const running = useGame((s) => s.office.running);
  const [focusStation, setFocusStation] = useState<string | null>(null);

  // active task route lines
  const routeLines = tasks.flatMap((t) => {
    const pts: { x: number; y: number }[] = [];
    for (let i = t.step; i < t.route.length; i++) {
      const s = stationById(t.route[i]);
      if (s) pts.push(s.pos);
    }
    return pts.map((p, i) => ({ p, i, id: t.id, color: t.color }));
  });

  return (
    <div className="glass relative h-full min-h-0 overflow-hidden rounded-xl border border-border scanlines">
      {/* hash grid floor */}
      <div className="absolute inset-0 hash-grid opacity-60" />

      {/* ambient */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-proof/5 blur-3xl" />
      {running &&
        Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            className="pointer-events-none absolute size-1 rounded-full bg-proof/30 anim-drift"
            style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, animationDelay: `${i * 0.5}s`, animationDuration: `${6 + (i % 4)}s` }}
          />
        ))}

      {/* route lines */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none">
        {tasks.map((t) => {
          const c = COLOR_CLASS[t.color];
          const from = t.pos;
          const to = stationById(t.route[t.step])?.pos;
          if (!to) return null;
          return (
            <line
              key={t.id}
              x1={`${from.x}%`}
              y1={`${from.y}%`}
              x2={`${to.x}%`}
              y2={`${to.y}%`}
              stroke="currentColor"
              className={cn(c.text, "opacity-40")}
              strokeWidth="0.6"
              strokeDasharray="3 4"
            />
          );
        })}
      </svg>

      {/* workstations */}
      {WORKSTATIONS.map((w) => {
        const c = COLOR_CLASS[w.color];
        const focused = focusStation === w.id;
        const busy = tasks.some((t) => t.route[t.step] === w.id);
        return (
          <button
            key={w.id}
            onClick={() => setFocusStation(focused ? null : w.id)}
            className={cn(
              "group absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-lg border p-1.5 transition-all",
              focused ? cn(c.border, c.bg, "scale-110") : "border-border/60 bg-card/50 hover:bg-card/80",
              busy && "ring-1 ring-proof/40"
            )}
            style={{ left: `${w.pos.x}%`, top: `${w.pos.y}%` }}
            title={w.name}
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className={cn("text-base leading-none", c.text)}>{w.glyph}</span>
              <span className="font-mono text-[8px] uppercase tracking-wider text-foreground/70">
                {w.name}
              </span>
            </div>
            {busy && (
              <span className="absolute -right-1 -top-1 size-2 rounded-full bg-proof anim-pulse" />
            )}
            {focused && (
              <div className="absolute left-1/2 top-full z-20 mt-1 w-40 -translate-x-1/2 rounded-md border border-border bg-popover p-1.5 text-[10px] text-muted-foreground">
                {w.desc}
              </div>
            )}
          </button>
        );
      })}

      {/* task cards (traveling) */}
      {tasks.map((t) => {
        const c = COLOR_CLASS[t.color];
        return (
          <motion.div
            key={t.id}
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
            animate={{ left: `${t.pos.x}%`, top: `${t.pos.y}%` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <div className={cn("flex items-center gap-1 rounded-full border bg-card/90 px-1.5 py-0.5 shadow-lg", c.border)}>
              <span className={cn("text-[11px]", c.text)}>{t.glyph}</span>
              {t.status === "working" && (
                <svg className="size-3 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" className="text-foreground/15" strokeWidth="4" />
                  <circle
                    cx="18" cy="18" r="15" fill="none"
                    stroke="currentColor"
                    className={c.text}
                    strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={`${t.progress * 94} 94`}
                  />
                </svg>
              )}
            </div>
          </motion.div>
        );
      })}

      {/* agent sprites */}
      {ORG_AGENTS.map((a) => {
        const st = agents[a.id];
        const c = COLOR_CLASS[a.color];
        const selected = selectedAgent === a.id;
        const working = st.state === "working";
        return (
          <motion.button
            key={a.id}
            onClick={() => selectAgent(selected ? null : a.id)}
            className="absolute z-30 -translate-x-1/2 -translate-y-1/2"
            animate={{ left: `${st.pos.x}%`, top: `${st.pos.y}%` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            title={`${a.name} · ${st.state}`}
          >
            {/* emote / speech bubble */}
            {(st.emote || st.thought) && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2"
              >
                {st.thought ? (
                  <div className={cn("whitespace-nowrap rounded-md border bg-popover px-1.5 py-0.5 text-[9px] text-foreground/90 shadow", c.border)}>
                    {st.thought.slice(0, 22)}
                    {st.thought.length > 22 && "…"}
                  </div>
                ) : (
                  <span className="text-sm anim-pulse">{st.emote}</span>
                )}
              </motion.div>
            )}

            {/* avatar */}
            <motion.div
              animate={working ? { scale: [1, 1.08, 1] } : { scale: 1 }}
              transition={working ? { duration: 1, repeat: Infinity } : {}}
              className={cn(
                "relative grid size-8 place-items-center rounded-full border-2 bg-card text-sm shadow-lg transition-colors sm:size-9",
                selected ? cn(c.border, c.text, "glow-proof") : cn(c.border, c.text),
                st.state === "walking" && "ring-2 ring-proof/30"
              )}
            >
              {a.glyph}
              {st.state === "walking" && (
                <span className="absolute -bottom-1 text-[8px]">🚶</span>
              )}
              {/* state dot */}
              <span
                className={cn(
                  "absolute -right-0.5 -top-0.5 size-2 rounded-full",
                  working ? "bg-verified" : st.state === "walking" ? "bg-proof anim-pulse" : st.state === "reviewing" ? "bg-consent" : "bg-foreground/20"
                )}
              />
            </motion.div>
            <span className="mt-0.5 block text-center font-mono text-[8px] uppercase tracking-wider text-foreground/60">
              {a.name}
            </span>
          </motion.button>
        );
      })}

      {/* legend */}
      <div className="pointer-events-none absolute bottom-1.5 left-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[8px] font-mono text-muted-foreground/70">
        <span className="flex items-center gap-0.5"><span className="size-1.5 rounded-full bg-verified" /> working</span>
        <span className="flex items-center gap-0.5"><span className="size-1.5 rounded-full bg-proof anim-pulse" /> walking</span>
        <span className="flex items-center gap-0.5"><span className="size-1.5 rounded-full bg-consent" /> reviewing</span>
        <span className="hidden sm:inline">· click an agent to inspect</span>
      </div>
      <div className="pointer-events-none absolute bottom-1.5 right-1.5 font-mono text-[8px] text-muted-foreground/70">
        LAYER 4 · MULTI-AGENT ORGANIZATION
      </div>
    </div>
  );
}
