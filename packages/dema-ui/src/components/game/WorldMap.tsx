"use client";

import { motion } from "framer-motion";
import { useGame } from "@/lib/game/store";
import { AGENTS, COLOR_CLASS, ZONES } from "@/lib/game/data";
import type { ZoneDef } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { Lock, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { TruthLabelBadge } from "./primitives";

export function WorldMap() {
  const setScene = useGame((s) => s.setScene);
  const selectZone = useGame((s) => s.selectZone);
  const selectedZone = useGame((s) => s.selectedZoneId);
  const overclaims = useGame((s) => s.overclaims);
  const nodeHealth = useGame((s) => s.resources.nodeHealth);

  const go = (z: ZoneDef) => {
    selectZone(z.id);
    if (z.locked) {
      toast.error(`${z.name} is sealed`, { description: z.lockReason });
      return;
    }
    if (z.scene) setScene(z.scene);
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3 px-1 pb-3">
        <div>
          <h2 className="font-mono text-lg font-semibold tracking-tight sm:text-xl">
            <span className="text-consent">⬡</span> Node World Map
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground max-w-2xl">
            Your device is a living Human Node. Travel between zones to mine data,
            spend compute, bind claims, pass consent gates, and forge proof.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-verified" /> live
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-knowledge" /> local
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-unknown" /> locked
          </span>
        </div>
      </div>

      {/* map canvas */}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border/70 glass hash-grid scanlines">
        {/* ambient drift particles */}
        {Array.from({ length: 14 }).map((_, i) => (
          <span
            key={i}
            className="pointer-events-none absolute size-1 rounded-full bg-proof/40 anim-drift"
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 100}%`,
              animationDelay: `${i * 0.6}s`,
              animationDuration: `${6 + (i % 5)}s`,
            }}
          />
        ))}

        {/* ZANN fog when overclaiming */}
        {overclaims > 0 && (
          <div
            className="pointer-events-none absolute inset-0 z-10"
            style={{
              background:
                "radial-gradient(600px circle at 50% 50%, oklch(0.62 0.23 25 / 0.10), transparent 70%)",
            }}
          />
        )}

        {/* connecting lines */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none">
          {ZONES.filter((z) => z.id !== "citadel").map((z) => {
            const c = COLOR_CLASS[z.color];
            const active = selectedZone === z.id;
            return (
              <line
                key={z.id}
                x1="50%"
                y1="50%"
                x2={`${z.pos.x}%`}
                y2={`${z.pos.y}%`}
                stroke="currentColor"
                className={cn(
                  "transition-all",
                  active ? c.text : "text-proof/20",
                  z.locked && "text-unknown/20"
                )}
                strokeWidth={active ? 1.6 : 1}
                strokeDasharray="4 5"
              />
            );
          })}
        </svg>

        {/* citadel core glow */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 size-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-consent/10 blur-2xl anim-pulse" />

        {/* zone nodes */}
        {ZONES.map((z, i) => {
          const c = COLOR_CLASS[z.color];
          const agent = AGENTS.find((a) => a.id === z.agent)!;
          const active = selectedZone === z.id;
          const isCenter = z.id === "citadel";
          return (
            <motion.button
              key={z.id}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.06, type: "spring", stiffness: 120, damping: 14 }}
              onClick={() => go(z)}
              onMouseEnter={() => selectZone(z.id)}
              className="group absolute z-20 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${z.pos.x}%`, top: `${z.pos.y}%` }}
            >
              <div
                className={cn(
                  "relative flex flex-col items-center gap-1 rounded-xl border p-2 transition-all",
                  isCenter ? "size-20 sm:size-24" : "min-w-[84px]",
                  c.bg,
                  active ? cn(c.border, "scale-105") : "border-border/60",
                  z.locked && "opacity-60"
                )}
              >
                {active && !z.locked && (
                  <span className={cn("absolute inset-0 rounded-xl anim-ring", c.border)} />
                )}
                <span
                  className={cn(
                    "font-mono leading-none",
                    isCenter ? "text-3xl sm:text-4xl" : "text-2xl",
                    c.text,
                    z.locked && "grayscale"
                  )}
                >
                  {z.locked ? <Lock size={22} className="text-unknown" /> : z.glyph}
                </span>
                <span className="text-center font-mono text-[10px] uppercase tracking-wider text-foreground/80 leading-tight">
                  {z.short}
                </span>
                {!z.locked && (
                  <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                    <span className={c.text}>{agent.glyph}</span>
                  </span>
                )}
                {isCenter && (
                  <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-mono text-consent">
                    ♥ {Math.round(nodeHealth)}%
                  </span>
                )}
              </div>

              {/* tooltip label */}
              {active && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute left-1/2 top-full z-30 mt-1 w-52 -translate-x-1/2 rounded-lg border border-border bg-popover p-2.5 text-left shadow-xl"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("font-mono text-xs font-semibold", c.text)}>
                      {z.name}
                    </span>
                    <TruthLabelBadge label={z.truthLabel} size="xs" />
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                    {z.description}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      Agent · {agent.name}
                    </span>
                    {!z.locked && (
                      <span className="flex items-center gap-0.5 text-[10px] font-mono text-proof">
                        enter <ArrowRight size={10} />
                      </span>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.button>
          );
        })}

        {/* corner readout */}
        <div className="pointer-events-none absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] font-mono text-muted-foreground/70">
          <span>SECTOR · NODE0 / LOCAL</span>
          <span>{ZONES.filter((z) => !z.locked).length}/{ZONES.length} ZONES UNLOCKED</span>
        </div>
      </div>
    </div>
  );
}
