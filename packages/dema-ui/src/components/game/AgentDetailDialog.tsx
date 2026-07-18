"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useGame } from "@/lib/game/store";
import { AGENTS, COLOR_CLASS, ZONES } from "@/lib/game/data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Star, ShieldAlert, Sparkles, MapPin } from "lucide-react";
import type { AgentId } from "@/lib/game/types";
import { GlyphBadge } from "./primitives";

const XP_PER_LEVEL = 150;

export function AgentDetailDialog({
  agentId,
  onClose,
}: {
  agentId: AgentId | null;
  onClose: () => void;
}) {
  const agent = AGENTS.find((a) => a.id === agentId);
  const st = useGame((s) => (agentId ? s.agents[agentId] : null));
  const toggleDeploy = useGame((s) => s.toggleDeploy);
  const setScene = useGame((s) => s.setScene);
  const selectZone = useGame((s) => s.selectZone);

  if (!agent) return null;
  const c = COLOR_CLASS[agent.color];
  const zone = ZONES.find((z) => z.id === agent.zone);
  const xpInLevel = st ? st.xp % XP_PER_LEVEL : 0;
  const lvlPct = st && st.level >= 5 ? 100 : (xpInLevel / XP_PER_LEVEL) * 100;

  return (
    <Dialog open={!!agentId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-strong max-w-lg border-border overflow-hidden">
        <div className={cn("absolute inset-x-0 top-0 h-24 opacity-30", c.bg)} />
        <DialogHeader className="relative">
          <div className="flex items-start gap-3">
            <GlyphBadge glyph={agent.glyph} color={agent.color} size="lg" />
            <div className="flex-1 min-w-0">
              <DialogTitle className="font-mono text-lg flex items-center gap-2">
                {agent.name}
                <span className={cn("rounded-md border px-1.5 py-0.5 text-[11px]", c.border, c.text, c.bg)}>
                  Lvl {st?.level ?? 1}
                </span>
              </DialogTitle>
              <DialogDescription className="mt-1">{agent.role}</DialogDescription>
              <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin size={11} /> {zone?.name}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="relative space-y-4">
          {/* xp bar */}
          <div>
            <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
              <span>XP {st?.xp ?? 0}</span>
              <span>{st && st.level >= 5 ? "MAX" : `${xpInLevel}/${XP_PER_LEVEL} to Lvl ${(st?.level ?? 1) + 1}`}</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
              <div className={cn("h-full rounded-full", c.dot)} style={{ width: `${lvlPct}%` }} />
            </div>
          </div>

          {/* skill tree */}
          <div>
            <h4 className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Skill Tree
            </h4>
            <div className="space-y-1.5">
              {agent.skillTree.map((sk, i) => {
                const unlocked = (st?.level ?? 1) >= sk.level;
                const current = (st?.level ?? 1) === sk.level;
                return (
                  <div
                    key={sk.name}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border p-2 transition-colors",
                      unlocked
                        ? cn(c.border, c.bg)
                        : "border-border/50 bg-card/30 opacity-55",
                      current && "ring-1 ring-proof/40"
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-md border font-mono text-xs",
                        unlocked ? cn(c.border, c.text) : "border-border text-muted-foreground"
                      )}
                    >
                      {unlocked ? <Star size={12} className={cn("fill-current", c.text)} /> : sk.level}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("text-xs font-medium", unlocked ? "text-foreground" : "text-muted-foreground")}>
                          {sk.name}
                        </span>
                        {current && (
                          <span className="text-[9px] font-mono text-proof">CURRENT</span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug">{sk.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* powers / resource / boundary */}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-border/60 bg-card/30 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-proof">
                <Sparkles size={12} /> Powers
              </div>
              <ul className="mt-1.5 space-y-1">
                {agent.powers.map((p) => (
                  <li key={p} className="text-[11px] text-foreground/80 flex items-center gap-1.5">
                    <span className="text-proof">▸</span> {p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/30 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-fail">
                <ShieldAlert size={12} /> {agent.boundary ? "Boundary" : "Weakness"}
              </div>
              <p className="mt-1.5 text-[11px] text-foreground/80 leading-snug">
                {agent.boundary ?? agent.weakness}
              </p>
              <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                Resource · {agent.resource}
              </div>
            </div>
          </div>

          {/* actions */}
          <div className="flex items-center gap-2">
            <Button
              variant={st?.deployed ? "default" : "outline"}
              size="sm"
              onClick={() => toggleDeploy(agent.id)}
              className={cn(st?.deployed && "bg-verified text-background hover:bg-verified/90")}
            >
              {st?.deployed ? "✓ Deployed to Zone" : "Deploy to Zone"}
            </Button>
            {zone && !zone.locked && zone.scene && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!zone.scene) return;
                  selectZone(zone.id);
                  setScene(zone.scene);
                  onClose();
                }}
              >
                Travel to {zone.short} →
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
