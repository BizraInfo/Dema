"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "@/lib/game/store";
import { COLOR_CLASS } from "@/lib/game/data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SceneHeader, StarRating, StatBar } from "./primitives";
import { Pickaxe, FlaskConical, Loader2, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";

const STAGES = ["Extract", "Classify", "Dedupe", "Chunk", "Compress"];
const MINE_COST = 3;
const MINE_GAIN = 5;
const REFINE_ORE = 5;
const REFINE_COST = 8;

export function DataRefine() {
  const resources = useGame((s) => s.resources);
  const spend = useGame((s) => s.spendResources);
  const addResource = useGame((s) => s.addResource);
  const awardXp = useGame((s) => s.awardXp);
  const completeMission = useGame((s) => s.completeMission);
  const completed = useGame((s) => s.completedMissions.cleanForest);

  const [stage, setStage] = useState<number>(-1); // -1 idle, 0..STAGES-1 running
  const [batch, setBatch] = useState(false);
  const [sludge, setSludge] = useState(0);

  const mine = () => {
    if (!spend({ compute: MINE_COST })) {
      toast.error("Need more compute to mine");
      return;
    }
    addResource("dataOre", MINE_GAIN);
    setSludge((s) => Math.min(100, s + 6));
    toast("⛏ Mined raw ore", { description: `+${MINE_GAIN} Data Ore` });
  };

  const refine = async () => {
    if (batch) return;
    if (resources.dataOre < REFINE_ORE) {
      toast.error("Not enough Data Ore", { description: `Need ${REFINE_ORE} ore to refine a batch.` });
      return;
    }
    if (!spend({ compute: REFINE_COST, dataOre: REFINE_ORE })) {
      toast.error("Need more compute to refine");
      return;
    }
    setBatch(true);
    for (let i = 0; i < STAGES.length; i++) {
      setStage(i);
       
      await new Promise((r) => setTimeout(r, 520));
    }
    setStage(-1);
    setBatch(false);
    addResource("cleanData", 4);
    addResource("evidenceShards", 2);
    addResource("snrEnergy", 8);
    addResource("ihsanQuality", 2);
    setSludge((s) => Math.max(0, s - 30));
    awardXp("dataAlchemist", 18);
    awardXp("memoryCartographer", 10);
    toast.success("Batch refined 💠", { description: "+4 Clean Data · +2 Evidence Shards · SNR ↑" });
  };

  useEffect(() => {
    if (!completed && resources.cleanData >= 8 && resources.snrEnergy >= 60) {
      const stars = resources.snrEnergy >= 75 && sludge < 20 ? 5 : resources.snrEnergy >= 60 ? 4 : 3;
      completeMission("cleanForest", stars);
    }
     
  }, [resources.cleanData, resources.snrEnergy]);

  const graphNodes = Math.min(26, Math.floor(resources.cleanData) + 2);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <SceneHeader
        title="Clean the Data Forest"
        glyph="⚗"
        accent="snr"
        subtitle="Mission 3 · Data Alchemist + Memory Cartographer. Mine raw ore, refine it through the pipeline into Clean Data & Evidence Shards."
        right={
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-knowledge">🪨 {Math.round(resources.dataOre)}</span>
            <span className="text-verified">💠 {Math.round(resources.cleanData)}</span>
            {completed && <StarRating value={completed.stars} />}
          </div>
        }
      />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_300px]">
        {/* pipeline */}
        <div className="glass flex flex-col rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Refinery Pipeline</h3>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" onClick={mine} disabled={batch}>
                <Pickaxe size={13} /> Mine Ore ({MINE_COST} cpu)
              </Button>
              <Button size="sm" onClick={refine} disabled={batch || resources.dataOre < REFINE_ORE} className="bg-snr text-background hover:bg-snr/90">
                {batch ? <Loader2 size={13} className="animate-spin" /> : <FlaskConical size={13} />} Refine Batch
              </Button>
            </div>
          </div>

          {/* ore pile */}
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-border/60 bg-card/30 p-2.5">
            <span className="text-lg">🪨</span>
            <div className="flex-1">
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                <span>RAW ORE</span>
                <span>{Math.round(resources.dataOre)} units · refine needs {REFINE_ORE}</span>
              </div>
              <StatBar value={Math.min(100, resources.dataOre * 4)} color="knowledge" className="mt-1" />
            </div>
          </div>

          {/* sludge / snr */}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border/60 bg-card/30 p-2.5">
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground"><span>SNR</span><span>{Math.round(resources.snrEnergy)}%</span></div>
              <StatBar value={resources.snrEnergy} color="snr" className="mt-1" showGlow />
            </div>
            <div className="rounded-lg border border-border/60 bg-card/30 p-2.5">
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground"><span>SLUDGE RISK</span><span>{Math.round(sludge)}%</span></div>
              <StatBar value={sludge} color="fail" className="mt-1" />
            </div>
          </div>

          {/* stages */}
          <div className="mt-4 flex flex-1 items-center gap-2">
            {STAGES.map((s, i) => {
              const active = stage === i;
              const done = batch && stage > i;
              const c = COLOR_CLASS[active ? "snr" : done ? "verified" : "unknown"];
              return (
                <div key={s} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className={cn(
                      "grid size-12 place-items-center rounded-lg border-2 transition-all sm:size-14",
                      active ? "border-snr bg-snr/10 glow-proof" : done ? "border-verified bg-verified/10" : "border-border/60 bg-card/30"
                    )}
                  >
                    {active ? (
                      <Loader2 size={18} className="animate-spin text-snr" />
                    ) : done ? (
                      <Check size={18} className="text-verified" />
                    ) : (
                      <span className={cn("text-lg", c.text)}>{["🪨", "🏷", "♻", "🧩", "📦"][i]}</span>
                    )}
                  </div>
                  <span className={cn("text-[10px] font-mono uppercase", active ? "text-snr" : "text-muted-foreground")}>{s}</span>
                </div>
              );
            })}
          </div>

          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Knowledge without evidence is noise. Refine ore into bound, classified knowledge.
          </p>
        </div>

        {/* knowledge graph */}
        <div className="glass flex flex-col rounded-xl border border-border p-3">
          <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Memory Map</h3>
          <div className="relative mt-2 aspect-square w-full overflow-hidden rounded-lg border border-border/60 bg-background/40">
            <svg className="absolute inset-0 h-full w-full">
              {Array.from({ length: graphNodes }).map((_, i) => {
                const angle = (i / graphNodes) * Math.PI * 2;
                const r = 34;
                const cx = 50 + Math.cos(angle) * r;
                const cy = 50 + Math.sin(angle) * r;
                return (
                  <g key={i}>
                    <line x1="50%" y1="50%" x2={`${cx}%`} y2={`${cy}%`} stroke="currentColor" className="text-knowledge/25" strokeWidth={0.6} />
                    {i < graphNodes - 1 && (
                      <line
                        x1={`${cx}%`}
                        y1={`${cy}%`}
                        x2={`${50 + Math.cos(((i + 1) / graphNodes) * Math.PI * 2) * r}%`}
                        y2={`${50 + Math.sin(((i + 1) / graphNodes) * Math.PI * 2) * r}%`}
                        stroke="currentColor"
                        className="text-knowledge/15"
                        strokeWidth={0.4}
                      />
                    )}
                  </g>
                );
              })}
            </svg>
            {Array.from({ length: graphNodes }).map((_, i) => {
              const angle = (i / graphNodes) * Math.PI * 2;
              const r = 34;
              return (
                <motion.span
                  key={i}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-knowledge anim-pulse"
                  style={{ left: `${50 + Math.cos(angle) * r}%`, top: `${50 + Math.sin(angle) * r}%`, animationDelay: `${i * 0.1}s` }}
                />
              );
            })}
            <div className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-knowledge/30 blur-sm" />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[9px] text-knowledge">core</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
            <span className="flex items-center gap-1 text-knowledge"><Sparkles size={11} /> {graphNodes} chunks</span>
            <span className="text-muted-foreground">{Math.round(resources.cleanData)} clean</span>
          </div>
        </div>
      </div>
    </div>
  );
}
