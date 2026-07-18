"use client";

import { useEffect, useRef } from "react";
import { useGame } from "@/lib/game/store";
import { SceneHeader } from "./primitives";
import { LivingOffice } from "./LivingOffice";
import { StructuralView } from "./StructuralView";
import { AutopoieticLoop } from "./AutopoieticLoop";
import { TaskBoard } from "./TaskBoard";
import { SystemLog } from "./SystemLog";
import { EvolutionGraph } from "./EvolutionGraph";
import { VerificationMesh } from "./VerificationMesh";
import { OfficeAgentInspector } from "./OfficeAgentInspector";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Play, Pause, Zap, Map, GitGraph, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";

export function EcosystemView() {
  const running = useGame((s) => s.office.running);
  const speed = useGame((s) => s.office.speed);
  const view = useGame((s) => s.office.view);
  const completed = useGame((s) => s.office.completedCount);
  const rejected = useGame((s) => s.office.rejectedCount);
  const loopStage = useGame((s) => s.office.loopStage);
  const toggleRun = useGame((s) => s.toggleOfficeRun);
  const setSpeed = useGame((s) => s.setOfficeSpeed);
  const setView = useGame((s) => s.setOfficeView);
  const tick = useGame((s) => s.tickOffice);
  const resetOffice = useGame((s) => s.resetOffice);
  const selectedAgent = useGame((s) => s.office.selectedAgent);

  // tick loop
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    const interval = Math.max(250, 900 / speed);
    timer.current = setInterval(() => {
      useGame.getState().tickOffice();
    }, interval);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [speed, tick]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <SceneHeader
        title="Living Agent Office"
        glyph="✦"
        accent="proof"
        subtitle="Layer 4 · Multi-Agent Organization. Watch 11 specialists route, verify & release proof. Every move maps to the autopoietic loop — no decorative wandering."
        right={
          <div className="flex items-center gap-1.5">
            <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
              {completed}✓ / {rejected}✗
            </span>
          </div>
        }
      />

      {/* HUD controls */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          onClick={() => {
            toggleRun();
            toast(running ? "Loop paused" : "Autopoietic loop ignited");
          }}
          className={cn(running ? "bg-fail/80 text-white hover:bg-fail/70" : "bg-proof text-background hover:bg-proof/90")}
        >
          {running ? <Pause size={13} /> : <Play size={13} />}
          {running ? "Pause" : "Ignite"}
        </Button>
        <div className="flex items-center overflow-hidden rounded-md border border-border">
          {[1, 2, 4].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s as 1 | 2 | 4)}
              className={cn(
                "flex items-center gap-0.5 px-2 py-1 font-mono text-[10px] transition-colors",
                speed === s ? "bg-proof/15 text-proof" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Zap size={9} /> {s}x
            </button>
          ))}
        </div>
        <div className="flex items-center overflow-hidden rounded-md border border-border">
          <button
            onClick={() => setView("spatial")}
            className={cn(
              "flex items-center gap-0.5 px-2 py-1 font-mono text-[10px] transition-colors",
              view === "spatial" ? "bg-proof/15 text-proof" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Map size={9} /> Spatial
          </button>
          <button
            onClick={() => setView("structural")}
            className={cn(
              "flex items-center gap-0.5 px-2 py-1 font-mono text-[10px] transition-colors",
              view === "structural" ? "bg-proof/15 text-proof" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <GitGraph size={9} /> Structural
          </button>
        </div>
        <Button size="sm" variant="ghost" onClick={() => { resetOffice(); toast("Office reset"); }} className="text-muted-foreground">
          <RotateCcw size={12} />
        </Button>
        <div className="ml-auto hidden items-center gap-2 font-mono text-[10px] text-muted-foreground md:flex">
          <Sparkles size={11} className="text-proof" />
          loop stage · {loopStage + 1}/10
        </div>
      </div>

      {/* body */}
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[230px_1fr_300px]">
        {/* left: loop + mesh */}
        <div className="hidden flex-col gap-3 min-h-0 lg:flex">
          <AutopoieticLoop />
          <div className="min-h-0 flex-1">
            <VerificationMesh />
          </div>
        </div>

        {/* center: office / structural */}
        <div className="min-h-0">
          {view === "spatial" ? <LivingOffice /> : <StructuralView />}
        </div>

        {/* right: tabbed rail */}
        <div className="min-h-0">
          <Tabs defaultValue={selectedAgent ? "inspector" : "tasks"} className="flex h-full min-h-0 flex-col" key={selectedAgent ?? "none"}>
            <TabsList className="grid grid-cols-4 bg-card/40">
              <TabsTrigger value="inspector" className="text-[10px]">Inspect</TabsTrigger>
              <TabsTrigger value="tasks" className="text-[10px]">Tasks</TabsTrigger>
              <TabsTrigger value="evolution" className="text-[10px]">Evolve</TabsTrigger>
              <TabsTrigger value="log" className="text-[10px]">Log</TabsTrigger>
            </TabsList>
            <TabsContent value="inspector" className="mt-2 min-h-0 flex-1 data-[state=inactive]:hidden">
              <OfficeAgentInspector />
            </TabsContent>
            <TabsContent value="tasks" className="mt-2 min-h-0 flex-1 data-[state=inactive]:hidden">
              <TaskBoard />
            </TabsContent>
            <TabsContent value="evolution" className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto scroll-thin data-[state=inactive]:hidden">
              <EvolutionGraph />
              <div className="lg:hidden">
                <VerificationMesh />
              </div>
            </TabsContent>
            <TabsContent value="log" className="mt-2 min-h-0 flex-1 data-[state=inactive]:hidden">
              <SystemLog />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* mobile loop row */}
      <div className="lg:hidden">
        <AutopoieticLoop compact />
      </div>
    </div>
  );
}
