"use client";

import { useGame, levelFromXp } from "@/lib/game/store";
import { AGENTS, COLOR_CLASS, ZONES } from "@/lib/game/data";
import { cn } from "@/lib/utils";
import { Panel, TruthLabelBadge } from "./primitives";
import { AgentDetailDialog } from "./AgentDetailDialog";
import { useState } from "react";
import type { AgentId } from "@/lib/game/types";

const XP_PER_LEVEL = 150;

export function AgentPanel({ asSheet = false }: { asSheet?: boolean }) {
  const agents = useGame((s) => s.agents);
  const standing = useGame((s) => s.receiptStanding);
  const [open, setOpen] = useState<AgentId | null>(null);

  const deployedCount = Object.values(agents).filter((a) => a.deployed).length;
  const earnedLevel = standing.xp === null ? null : levelFromXp(standing.xp);
  const earnedTruth = standing.xp === null ? "UNKNOWN" : "VERIFIED";

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
      <div className="rounded-lg border border-border/70 bg-card/50 p-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Receipt standing</span>
          <TruthLabelBadge label={earnedTruth} size="xs" />
        </div>
        <p className="mt-1 font-mono text-sm text-foreground">
          {standing.status === "unread" && "Reading ledger…"}
          {standing.status !== "unread" && standing.xp === null && "XP UNKNOWN"}
          {standing.xp !== null && `${standing.xp} verified ledger entries · display L${earnedLevel}`}
        </p>
        <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
          Count of the canonical ledger. Not an XP grant. Per-agent levels stay UNKNOWN.
          {standing.receiptIds[0] ? ` First receipt ${standing.receiptIds[0].slice(0, 12)}…` : ""}
        </p>
      </div>
      {AGENTS.map((a) => {
        const st = agents[a.id];
        const c = COLOR_CLASS[a.color];
        const zone = ZONES.find((z) => z.id === a.zone);
        const practice = st.practiceXp ?? 0;
        const lvlPct = ((practice % XP_PER_LEVEL) / XP_PER_LEVEL) * 100;
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
                <span className={cn("font-mono text-[10px]", c.text)}>earned UNKNOWN</span>
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-foreground/10">
                <div
                  className={cn("h-full rounded-full", c.dot)}
                  style={{ width: `${st.level >= 5 ? 100 : lvlPct}%` }}
                />
              </div>
              <div className="mt-0.5 truncate text-[9px] uppercase tracking-wider text-muted-foreground">
                {zone?.short} · practice {practice} · {a.role.split(",")[0]}
              </div>
              {/* Every AGENTS entry carries truthLabel from fleet-canon.ts. It was held in
                  data but never rendered — a label the user cannot see is a comment, not a
                  disclosure. The roster is DESIGNED_NOT_LIVE and must say so on screen. */}
              <div className="mt-1">
                <TruthLabelBadge label={a.truthLabel ?? "UNKNOWN"} size="xs" />
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
