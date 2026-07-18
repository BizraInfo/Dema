"use client";

import { useGame } from "@/lib/game/store";
import { AGENTS, COLOR_CLASS, MISSIONS } from "@/lib/game/data";
import { cn } from "@/lib/utils";
import { Panel, StarRating } from "./primitives";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowRight, Receipt as ReceiptIcon, Lock } from "lucide-react";
import type { SceneId } from "@/lib/game/types";

export function MissionPanel({ asSheet = false }: { asSheet?: boolean }) {
  const completed = useGame((s) => s.completedMissions);
  const receipts = useGame((s) => s.receipts);
  const setScene = useGame((s) => s.setScene);

  const doneCount = MISSIONS.filter((m) => completed[m.id]).length;
  const totalStars = Object.values(completed).reduce((a, m) => a + m.stars, 0);

  return (
    <Panel
      title="Missions & Receipts"
      glyph="◈"
      accent="proof"
      right={
        <span className="font-mono text-[10px] text-muted-foreground">
          {doneCount}/{MISSIONS.length} · {totalStars}★
        </span>
      }
      className={cn(asSheet && "h-full border-0")}
      bodyClassName="p-0"
    >
      <Tabs defaultValue="missions" className="flex h-full min-h-0 flex-col">
        <TabsList className="m-2 grid grid-cols-2 bg-card/40">
          <TabsTrigger value="missions" className="text-[11px]">Missions</TabsTrigger>
          <TabsTrigger value="receipts" className="text-[11px]">Receipts ({receipts.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="missions" className="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden">
          <ScrollArea className="scroll-thin h-full px-2 pb-2">
            <div className="space-y-1.5">
              {MISSIONS.map((m) => {
                const res = completed[m.id];
                const agent = AGENTS.find((a) => a.id === m.agent)!;
                const c = COLOR_CLASS[agent.color];
                return (
                  <button
                    key={m.id}
                    onClick={() => setScene(m.scene as SceneId)}
                    className="group flex w-full items-start gap-2.5 rounded-lg border border-border/60 bg-card/30 p-2.5 text-left transition-all hover:border-border hover:bg-card/60"
                  >
                    <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border font-mono text-sm", c.border, c.bg, c.text)}>
                      {agent.glyph}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-xs font-semibold text-foreground">{m.title}</span>
                        {res ? <StarRating value={res.stars} size={10} /> : <Lock size={11} className="text-muted-foreground/40" />}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">{m.desc}</p>
                      <div className="mt-1 flex items-center gap-1">
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{m.zone}</span>
                        <ArrowRight size={9} className="text-proof opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>
        <TabsContent value="receipts" className="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden">
          <ScrollArea className="scroll-thin h-full px-2 pb-2">
            {receipts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-6 text-center">
                <ReceiptIcon size={28} className="text-muted-foreground/40" />
                <p className="text-[11px] text-muted-foreground">
                  No receipts yet. Forge proof in the Proof Forge or complete missions.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {receipts.map((r) => (
                  <div key={r.id} className="rounded-lg border border-proof/30 bg-proof/5 p-2">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate font-mono text-[11px] text-foreground">{r.label}</span>
                      <span className="text-sm">🔮</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1 font-mono text-[9px] text-proof">
                      <span className="truncate">{r.hash}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      {(["formal", "cryptographic", "empirical", "economic"] as const).map((k) => (
                        <span
                          key={k}
                          className={cn(
                            "size-1.5 rounded-full",
                            r.rails[k] ? "bg-proof" : "bg-foreground/15",
                            k === "economic" && r.rails[k] && "bg-consent"
                          )}
                          title={k}
                        />
                      ))}
                      <span className="ml-1 text-[9px] uppercase text-muted-foreground">{r.mission}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </Panel>
  );
}
