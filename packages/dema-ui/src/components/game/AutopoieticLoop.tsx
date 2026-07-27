"use client";

import { motion } from "framer-motion";
import { useGame } from "@/lib/game/store";
import { AUTOPOIETIC_STAGES, stationById } from "@/lib/game/ecosystem";
import { COLOR_CLASS } from "@/lib/game/data";
import { TruthLabelBadge } from "./primitives";
import { cn } from "@/lib/utils";

export function AutopoieticLoop({ compact = false }: { compact?: boolean }) {
  const stage = useGame((s) => s.office.loopStage);
  const running = useGame((s) => s.office.running);
  const setScene = useGame((s) => s.setScene);

  const R = compact ? 38 : 46; // ring radius %
  const cx = 50;
  const cy = 50;

  return (
    <div className="glass relative flex flex-col rounded-xl border border-border p-3">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Autopoietic Loop
        </h3>
        {/* Canon holds the autopoietic runtime as DESIGNED_NOT_LIVE. This panel is a
            deterministic stage animation driven by a client-side tick, NOT a running
            loop — so it must never render the word LIVE. See .claude/rules/00-claim-discipline.md
            and scripts/review/ui-truth-label-check.mjs, which fails the build if it does. */}
        <div className="flex items-center gap-2">
          <TruthLabelBadge label="DESIGNED_NOT_LIVE" size="xs" />
          <span
            className={cn(
              "font-mono text-[10px]",
              running ? "text-consent anim-pulse" : "text-muted-foreground"
            )}
          >
            {running ? "◐ ANIMATING" : "○ IDLE"}
          </span>
        </div>
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-[260px]">
        {/* ring svg */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100">
          <circle
            cx={cx}
            cy={cy}
            r={R}
            fill="none"
            stroke="currentColor"
            className="text-proof/15"
            strokeWidth="0.5"
            strokeDasharray="2 2"
          />
          {/* active arc pulse */}
          {running && (
            <motion.circle
              cx={cx}
              cy={cy}
              r={R}
              fill="none"
              stroke="currentColor"
              className="text-proof"
              strokeWidth="1"
              strokeDasharray={`${(360 / AUTOPOIETIC_STAGES.length) * 0.7} ${2 * Math.PI * R}`}
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: "50px 50px" }}
            />
          )}
        </svg>

        {/* center */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="font-mono text-2xl text-proof text-glow-proof">
            {AUTOPOIETIC_STAGES[stage].glyph}
          </div>
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-foreground/80">
            {AUTOPOIETIC_STAGES[stage].name}
          </div>
          <div className="text-[8px] text-muted-foreground">
            stage {stage + 1}/{AUTOPOIETIC_STAGES.length}
          </div>
        </div>

        {/* stage nodes around the ring */}
        {AUTOPOIETIC_STAGES.map((s, i) => {
          const angle = (i / AUTOPOIETIC_STAGES.length) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(angle) * R;
          const y = cy + Math.sin(angle) * R;
          const c = COLOR_CLASS[s.color];
          const active = i === stage;
          return (
            <button
              key={s.id}
              title={`${s.name} — ${s.desc}`}
              onClick={() => {
                const stn = stationById(s.station);
                if (stn) setScene("ecosystem");
              }}
              className="group absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <motion.span
                animate={active && running ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                transition={{ duration: 1.2, repeat: active && running ? Infinity : 0 }}
                className={cn(
                  "grid size-6 place-items-center rounded-full border text-[11px] transition-colors",
                  active ? cn(c.border, c.bg, c.text, "glow-proof") : "border-border/60 bg-card/40 text-muted-foreground"
                )}
              >
                {s.glyph}
              </motion.span>
              {active && (
                <span className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap font-mono text-[8px] uppercase text-proof">
                  {s.name}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-1 text-center text-[10px] text-muted-foreground">
        {AUTOPOIETIC_STAGES[stage].desc}
      </p>
    </div>
  );
}
