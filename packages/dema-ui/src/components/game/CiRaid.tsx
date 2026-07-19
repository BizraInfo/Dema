"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "@/lib/game/store";
import { CI_GATES, COLOR_CLASS } from "@/lib/game/data";
import { createRaidRun } from "@/lib/game/raid-run";
import type { GateState } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SceneHeader, StarRating } from "./primitives";
import { Check, X, Loader2, Play, RotateCcw, ArrowDown } from "lucide-react";
import { toast } from "sonner";

const GATE_COST = 4; // compute per gate

export function CiRaid() {
  const resources = useGame((s) => s.resources);
  const addResource = useGame((s) => s.addResource);
  const forgeReceipt = useGame((s) => s.forgeReceipt);
  const awardXp = useGame((s) => s.awardXp);
  const setRail = useGame((s) => s.setRail);
  const completeMission = useGame((s) => s.completeMission);
  const completed = useGame((s) => s.completedMissions.ciRaid);

  const [states, setStates] = useState<GateState[]>(CI_GATES.map(() => "idle"));
  const [running, setRunning] = useState<number | null>(null);
  const raidDone = useRef(false);
  const activeRun = useRef<ReturnType<typeof createRaidRun> | null>(null);

  const allPassed = states.every((s) => s === "passed");
  const anyFailed = states.some((s) => s === "failed");
  const canRun = (i: number) => i === 0 || states[i - 1] === "passed";

  const runGate = (i: number) => {
    if (activeRun.current || running !== null || states[i] !== "idle" || !canRun(i)) return;
    const cur = useGame.getState();
    if (cur.resources.compute < GATE_COST) {
      setStates((s) => s.map((v, idx) => (idx === i ? "failed" : v)));
      toast.error("Red gate storm", { description: "Out of compute. Budget exhausted." });
      return;
    }
    const raid = createRaidRun();
    activeRun.current = raid;
    setRunning(i);
    setStates((s) => s.map((v, idx) => (idx === i ? "running" : v)));
    cur.spendResources({ compute: GATE_COST });
    void raid.wait(CI_GATES[i].weight).then((completed) => {
      if (!completed || activeRun.current !== raid) return;
      activeRun.current = null;
      setStates((s) => s.map((v, idx) => (idx === i ? "passed" : v)));
      setRunning(null);
      toast.success(`${CI_GATES[i].name} ✓`, { description: CI_GATES[i].desc });
    });
  };

  const runAll = async () => {
    if (activeRun.current || running !== null) return;
    const raid = createRaidRun();
    activeRun.current = raid;
    const working = [...states];
    for (let i = 0; i < CI_GATES.length; i++) {
      if (raid.cancelled || activeRun.current !== raid) return;
      if (working[i] === "passed") continue;
      const cur = useGame.getState();
      if (cur.resources.compute < GATE_COST) {
        setStates((s) => s.map((v, idx) => (idx === i ? "failed" : v)));
        working[i] = "failed";
        toast.error("Red gate storm", { description: "Out of compute. Budget exhausted." });
        raid.cancel();
        activeRun.current = null;
        setRunning(null);
        break;
      }
      setRunning(i);
      setStates((s) => s.map((v, idx) => (idx === i ? "running" : v)));
      cur.spendResources({ compute: GATE_COST });
      const completed = await raid.wait(CI_GATES[i].weight);
      if (!completed || activeRun.current !== raid) return;
      working[i] = "passed";
      setStates((s) => s.map((v, idx) => (idx === i ? "passed" : v)));
      setRunning(null);
      toast.success(`${CI_GATES[i].name} ✓`, { description: CI_GATES[i].desc });
    }
    if (activeRun.current === raid) activeRun.current = null;
  };

  const reset = () => {
    activeRun.current?.cancel();
    activeRun.current = null;
    setStates(CI_GATES.map(() => "idle"));
    raidDone.current = false;
    setRunning(null);
  };

  useEffect(
    () => () => {
      activeRun.current?.cancel();
      activeRun.current = null;
    },
    [],
  );

  useEffect(() => {
    if (allPassed && !raidDone.current) {
      raidDone.current = true;
      const rec = forgeReceipt({
        label: "CI Release Verdict · all gates green",
        mission: "ciRaid",
        rails: { empirical: true, formal: true },
      });
      setRail("empirical", true);
      awardXp("ciRanger", 40);
      awardXp("satJudge", 15);
      addResource("impactTokens", 5);
      completeMission("ciRaid", 5);
      toast.success("Release Verdict ✓", { description: `receipt ${rec.hash.slice(0, 10)}…` });
    }

  }, [allPassed, addResource, awardXp, completeMission, forgeReceipt, setRail]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <SceneHeader
        title="CI Gate Raid"
        glyph="🏹"
        accent="verified"
        subtitle="Mission 6 · CI Ranger. Raid through tests, lint, security, guidance, proof export & release verdict. Keep compute in budget."
        right={
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-snr">⛏ {Math.round(resources.compute)}</span>
            {completed && <StarRating value={completed.stars} />}
          </div>
        }
      />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_240px]">
        {/* raid path */}
        <div className="glass scroll-thin overflow-y-auto rounded-xl border border-border p-3">
          <div className="flex items-center justify-between px-1 pb-2">
            <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Raid Path</h3>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" onClick={runAll} disabled={running !== null || allPassed || anyFailed}>
                <Play size={13} /> Run All
              </Button>
              <Button size="sm" variant="ghost" onClick={reset}>
                <RotateCcw size={13} />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {CI_GATES.map((g, i) => {
              const st = states[i];
              const c = COLOR_CLASS[st === "passed" ? "verified" : st === "failed" ? "fail" : "proof"];
              const enabled = canRun(i) && st === "idle" && running === null;
              return (
                <div key={g.id}>
                  <div
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-2.5 transition-all",
                      st === "passed" ? "border-verified/40 bg-verified/5" : st === "failed" ? "border-fail/40 bg-fail/5 glow-fail" : st === "running" ? "border-proof/50 bg-proof/5 glow-proof" : "border-border/60 bg-card/30"
                    )}
                  >
                    <span className={cn("grid size-8 shrink-0 place-items-center rounded-md border font-mono text-xs", c.border, c.bg, c.text)}>
                      {st === "passed" ? <Check size={15} /> : st === "failed" ? <X size={15} /> : st === "running" ? <Loader2 size={14} className="animate-spin" /> : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-foreground">{g.name}</span>
                        {st === "passed" && <span className="text-[9px] font-mono text-verified">GREEN</span>}
                        {st === "running" && <span className="text-[9px] font-mono text-proof">RUNNING</span>}
                        {st === "failed" && <span className="text-[9px] font-mono text-fail">RED STORM</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug">{g.desc}</p>
                      {st === "running" && (
                        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-foreground/10">
                          <div className="h-full w-1/3 rounded-full bg-proof shimmer" />
                        </div>
                      )}
                    </div>
                    <Button size="sm" variant="ghost" disabled={!enabled} onClick={() => runGate(i)} className="shrink-0">
                      Run
                    </Button>
                  </div>
                  {i < CI_GATES.length - 1 && (
                    <div className="flex justify-center py-0.5">
                      <ArrowDown size={12} className={cn(states[i] === "passed" ? "text-verified" : "text-border")} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {anyFailed && (
            <div className="mt-3 rounded-lg border border-fail/40 bg-fail/5 p-2.5 text-center">
              <p className="text-xs text-fail">Red gate storm halted the raid.</p>
              <Button size="sm" variant="outline" onClick={reset} className="mt-2">
                <RotateCcw size={13} /> Restart Raid
              </Button>
            </div>
          )}
        </div>

        {/* verdict panel */}
        <div className="flex flex-col gap-3">
          <div className="glass rounded-xl border border-border p-3">
            <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Release Verdict</h3>
            <div className="mt-3 flex flex-col items-center gap-2">
              <div className={cn("grid size-20 place-items-center rounded-full border-2", allPassed ? "border-verified bg-verified/10 glow-verified" : anyFailed ? "border-fail bg-fail/10" : "border-border bg-card/30")}>
                {allPassed ? (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-4xl">🎯</motion.span>
                ) : anyFailed ? (
                  <span className="text-3xl">⚠</span>
                ) : (
                  <span className="text-2xl opacity-40">○</span>
                )}
              </div>
              <span className={cn("font-mono text-xs uppercase", allPassed ? "text-verified" : anyFailed ? "text-fail" : "text-muted-foreground")}>
                {allPassed ? "DELIVERY PROVEN" : anyFailed ? "RAID HALTED" : "AWAITING GATES"}
              </span>
              {allPassed && <StarRating value={5} />}
            </div>
          </div>
          <div className="glass rounded-xl border border-border p-3 text-[11px] text-muted-foreground">
            <p className="font-mono uppercase tracking-wider text-proof">raid doctrine</p>
            <p className="mt-1.5 leading-snug">Each gate costs {GATE_COST} compute. A red gate storm halts the release. All gates green ⇒ empirical proof rail lit.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
