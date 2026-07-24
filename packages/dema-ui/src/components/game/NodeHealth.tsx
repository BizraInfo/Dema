"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useGame } from "@/lib/game/store";
import { COLOR_CLASS } from "@/lib/game/data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { SceneHeader, StarRating, StatBar } from "./primitives";
import { Wrench, HeartPulse, Cpu, MemoryStick, Zap, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Svc {
  id: string;
  name: string;
  status: "ok" | "degraded" | "failed";
}

const INITIAL_SVCS: Svc[] = [
  { id: "daemon-core", name: "daemon-core", status: "degraded" },
  { id: "data-lake", name: "data-lake", status: "ok" },
  { id: "model-adapter", name: "model-adapter", status: "failed" },
  { id: "proof-rail", name: "proof-rail", status: "degraded" },
  { id: "consent-gate", name: "consent-gate", status: "ok" },
];

const TARGET = { cpu: 60, ram: 60, energy: 50 };

function SliderControl({
  label,
  icon: Icon,
  value,
  set,
  target,
  color,
}: {
  label: string;
  icon: React.ElementType;
  value: number;
  set: (v: number) => void;
  target: number;
  color: keyof typeof COLOR_CLASS;
}) {
  const c = COLOR_CLASS[color];
  const onTarget = Math.abs(value - target) <= 8;
  return (
    <div className="rounded-lg border border-border/60 bg-card/30 p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
          <Icon size={13} className={c.text} /> {label}
        </span>
        <span className={cn("font-mono text-xs", onTarget ? "text-verified" : c.text)}>{value}%</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={(v) => set(v[0])}
        min={0}
        max={100}
        step={1}
        className="mt-2"
      />
      <div className="mt-1 flex justify-between text-[9px] font-mono text-muted-foreground">
        <span>target {target}</span>
        {onTarget && <span className="text-verified">✓ balanced</span>}
      </div>
    </div>
  );
}

export function NodeHealth() {
  const resources = useGame((s) => s.resources);
  const spend = useGame((s) => s.spendResources);
  const addResource = useGame((s) => s.addResource);
  const awardXp = useGame((s) => s.awardXp);
  const setRail = useGame((s) => s.setRail);
  const completeMission = useGame((s) => s.completeMission);
  const completed = useGame((s) => s.completedMissions.nodeRestore);

  const [cpu, setCpu] = useState(40);
  const [ram, setRam] = useState(75);
  const [energy, setEnergy] = useState(30);
  const [svcs, setSvcs] = useState<Svc[]>(INITIAL_SVCS);
  const [restored, setRestored] = useState(false);

  const balance = Math.max(
    0,
    100 - (Math.abs(cpu - TARGET.cpu) + Math.abs(ram - TARGET.ram) + Math.abs(energy - TARGET.energy)) * 0.55
  );
  const failedCount = svcs.filter((s) => s.status !== "ok").length;
  const health = Math.max(0, Math.min(100, balance - failedCount * 8));
  const modelReady = failedCount === 0 && health >= 80;

  const repair = (id: string) => {
    if (!spend({ compute: 6 })) {
      toast.error("Need 6 compute to repair");
      return;
    }
    setSvcs((s) => s.map((v) => (v.id === id ? { ...v, status: "ok" } : v)));
    toast.success("Service repaired", { description: id });
  };

  const restore = () => {
    if (failedCount > 0) {
      toast.error("Repair all services first");
      return;
    }
    if (!modelReady) {
      toast.error("Balance CPU/RAM/Energy to reach readiness");
      return;
    }
    setRestored(true);
    addResource("nodeHealth", 100 - resources.nodeHealth > 0 ? 40 : 5);
    setRail("formal", true);
    awardXp("resourceSteward", 35);
    awardXp("modelTamer", 20);
    addResource("trustScore", 5);
    const stars = health >= 92 ? 5 : health >= 80 ? 4 : 3;
    completeMission("nodeRestore", stars);
    toast.success("Node Health Restored ♥", { description: `Local model READY · ${stars}★` });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <SceneHeader
        title="Node Health Restoration"
        glyph="📊"
        accent="snr"
        subtitle="Mission 8 · Resource Steward. Balance CPU/RAM/Energy, repair failed services & restore local model readiness."
        right={
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-snr">⛏ {Math.round(resources.compute)}</span>
            {completed && <StarRating value={completed.stars} />}
          </div>
        }
      />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_300px]">
        {/* left: sliders + services */}
        <div className="glass scroll-thin flex flex-col gap-3 overflow-y-auto rounded-xl border border-border p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <SliderControl label="CPU" icon={Cpu} value={cpu} set={setCpu} target={TARGET.cpu} color="snr" />
            <SliderControl label="RAM" icon={MemoryStick} value={ram} set={setRam} target={TARGET.ram} color="proof" />
            <SliderControl label="Energy" icon={Zap} value={energy} set={setEnergy} target={TARGET.energy} color="consent" />
          </div>

          <div>
            <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Services</h3>
            <div className="mt-2 space-y-1.5">
              {svcs.map((s) => {
                const c = s.status === "ok" ? COLOR_CLASS.verified : s.status === "degraded" ? COLOR_CLASS.consent : COLOR_CLASS.fail;
                return (
                  <div key={s.id} className={cn("flex items-center gap-2 rounded-lg border p-2", c.border, c.bg)}>
                    <span className={cn("size-2 rounded-full", c.dot, s.status !== "ok" && "anim-pulse")} />
                    <span className="font-mono text-xs text-foreground flex-1">{s.name}</span>
                    <span className={cn("text-[10px] font-mono uppercase", c.text)}>{s.status}</span>
                    {s.status !== "ok" && (
                      <Button size="sm" variant="outline" onClick={() => repair(s.id)}>
                        <Wrench size={12} /> Repair (6 cpu)
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* right: health readout */}
        <div className="flex flex-col gap-3">
          <div className="glass rounded-xl border border-border p-4">
            <div className="flex items-center gap-2">
              <HeartPulse size={16} className="text-fail" />
              <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Node Health</h3>
            </div>
            <div className="mt-3 flex flex-col items-center gap-2">
              <div className="relative grid size-28 place-items-center">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" className="text-foreground/10" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="44" fill="none"
                    stroke="currentColor"
                    className={cn(health >= 80 ? "text-verified" : health >= 50 ? "text-consent" : "text-fail")}
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${(health / 100) * 276} 276`}
                    style={{ transition: "stroke-dasharray 0.5s" }}
                  />
                </svg>
                <div className="text-center">
                  <div className="font-mono text-2xl font-bold">{Math.round(health)}</div>
                  <div className="text-[9px] uppercase text-muted-foreground">health</div>
                </div>
              </div>
              <StatBar value={balance} color="snr" className="w-full" />
              <span className="text-[10px] font-mono text-muted-foreground">balance {Math.round(balance)}%</span>
            </div>
          </div>

          <div className={cn("glass rounded-xl border p-3 transition-all", modelReady ? "border-verified/40 glow-verified" : "border-border")}>
            <div className="flex items-center gap-2">
              {modelReady ? <Check size={14} className="text-verified" /> : <AlertTriangle size={14} className="text-consent" />}
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Local Model</span>
            </div>
            <motion.p className={cn("mt-1 font-mono text-sm", modelReady ? "text-verified" : "text-muted-foreground")}>
              {modelReady ? "READY_LOCAL" : failedCount > 0 ? `${failedCount} services down` : "balancing…"}
            </motion.p>
          </div>

          <Button onClick={restore} disabled={restored || !modelReady} className="bg-verified text-background hover:bg-verified/90">
            <HeartPulse size={15} /> Restore Node
          </Button>
          {restored && <p className="text-center text-[11px] text-verified">Node restored · Formal proof rail lit</p>}
        </div>
      </div>
    </div>
  );
}
