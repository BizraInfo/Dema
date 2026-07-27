"use client";

import { useGame } from "@/lib/game/store";
import { ORG_AGENTS } from "@/lib/game/ecosystem";
import { COLOR_CLASS } from "@/lib/game/data";
import { cn } from "@/lib/utils";
import { Panel } from "./primitives";
import type { Proposal } from "@/lib/game/store";
import { GitBranch, Check, X, Clock, Layers } from "lucide-react";

const STATUS_META: Record<
  Proposal["status"],
  { label: string; color: "unknown" | "verified" | "consent" | "fail"; icon: React.ElementType }
> = {
  pending: { label: "PENDING", color: "unknown", icon: Clock },
  verified: { label: "VERIFIED", color: "verified", icon: Check },
  integrated: { label: "INTEGRATED", color: "consent", icon: Layers },
  rejected: { label: "REJECTED", color: "fail", icon: X },
};

export function EvolutionGraph({ asSheet = false }: { asSheet?: boolean }) {
  const proposals = useGame((s) => s.office.proposals);
  const selectedId = useGame((s) => s.office.selectedProposal);
  const select = useGame((s) => s.selectProposal);
  const completed = useGame((s) => s.office.completedCount);
  const rejected = useGame((s) => s.office.rejectedCount);

  return (
    <Panel
      title="Evolution Graph"
      glyph="⑂"
      accent="knowledge"
      truth="DESIGNED_NOT_LIVE"
      right={
        <span className="font-mono text-[10px] text-muted-foreground">
          {completed}✓ / {rejected}✗
        </span>
      }
      className={cn(asSheet && "h-full border-0")}
      bodyClassName="scroll-thin overflow-y-auto p-2 space-y-1 max-h-full"
    >
      {proposals.length === 0 ? (
        <div className="flex flex-col items-center gap-1 p-4 text-center text-[11px] text-muted-foreground">
          <GitBranch size={20} className="opacity-40" />
          No proposals yet. Completed tasks spawn proposals here.
        </div>
      ) : (
        proposals.map((p) => {
          const sm = STATUS_META[p.status];
          const c = COLOR_CLASS[sm.color];
          const ag = ORG_AGENTS.find((a) => a.id === p.agent);
          const active = selectedId === p.id;
          const passed = Object.values(p.rails).filter(Boolean).length;
          return (
            <button
              key={p.id}
              onClick={() => select(active ? null : p.id)}
              className={cn(
                "w-full rounded-lg border p-2 text-left transition-all",
                active ? cn(c.border, c.bg, "ring-1 ring-proof/40") : "border-border/60 bg-card/30 hover:bg-card/60"
              )}
            >
              <div className="flex items-center gap-1.5">
                <sm.icon size={12} className={c.text} />
                <span className="flex-1 truncate text-[11px] font-medium text-foreground">
                  {p.title}
                </span>
                {p.parentId && (
                  <span title="forked">
                    <GitBranch size={10} className="text-knowledge" />
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center justify-between text-[9px] font-mono">
                <span className={cn("uppercase", c.text)}>{sm.label}</span>
                <span className="text-muted-foreground">
                  {passed}/10 rails · {ag?.glyph}
                </span>
              </div>
            </button>
          );
        })
      )}
    </Panel>
  );
}
