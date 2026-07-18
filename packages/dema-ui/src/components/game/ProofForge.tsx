"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "@/lib/game/store";
import { COLOR_CLASS } from "@/lib/game/data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SceneHeader } from "./primitives";
import { ProofRailDashboard } from "./ProofRailDashboard";
import { Hammer, RotateCcw, Check, Link2, Coins } from "lucide-react";
import { toast } from "sonner";

const GRID = 9; // 3x3

function hashCell(seed: number) {
  return (
    "0x" +
    Array.from({ length: 4 }, (_, i) =>
      Math.floor((Math.sin(seed * 31 + i * 7) * 1e9) % 65536)
        .toString(16)
        .slice(-2)
        .padStart(2, "0")
    ).join("")
  );
}

export function ProofForge() {
  const resources = useGame((s) => s.resources);
  const spend = useGame((s) => s.spendResources);
  const forgeReceipt = useGame((s) => s.forgeReceipt);
  const awardXp = useGame((s) => s.awardXp);
  const setRail = useGame((s) => s.setRail);
  const completeMission = useGame((s) => s.completeMission);
  const completed = useGame((s) => s.completedMissions.proofForgeMission);

  const [grid, setGrid] = useState<boolean[]>(Array(GRID).fill(false));
  const [forged, setForged] = useState<{ hash: string; count: number } | null>(null);
  const [forging, setForging] = useState(false);

  const placed = grid.filter(Boolean).length;
  const canForge = placed >= 3 && resources.consentKeys >= 1 && resources.compute >= 5;

  const toggle = (i: number) => {
    if (forging) return;
    setForged(null);
    setGrid((g) => {
      const n = [...g];
      if (!n[i] && resources.evidenceShards - placed < 1) {
        toast.error("No Evidence Shards left", { description: "Mine & clean data in the Data Forest." });
        return g;
      }
      n[i] = !n[i];
      return n;
    });
  };

  const reset = () => {
    setGrid(Array(GRID).fill(false));
    setForged(null);
  };

  const doForge = () => {
    if (!canForge) return;
    setForging(true);
    setTimeout(() => {
      const ok = spend({ evidenceShards: placed, consentKeys: 1, compute: 5 });
      if (!ok) {
        setForging(false);
        toast.error("Insufficient resources");
        return;
      }
      const chainHash = hashCell(placed + Date.now());
      const rec = forgeReceipt({
        label: `Replay Bundle · ${placed} shards`,
        mission: "proofForgeMission",
        rails: { cryptographic: true, formal: true },
      });
      setRail("cryptographic", true);
      setRail("empirical", true);
      awardXp("proofsmith", 30 + placed * 4);
      setForged({ hash: rec.hash, count: placed });
      setGrid(Array(GRID).fill(false));
      setForging(false);
      const stars = placed >= 7 ? 5 : placed >= 5 ? 4 : 3;
      completeMission("proofForgeMission", stars);
      toast.success("Receipt Crystal forged 🔮", {
        description: `chain ${chainHash.slice(0, 10)}… · ${placed} shards bound`,
      });
    }, 1100);
  };

  const c = COLOR_CLASS.proof;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <SceneHeader
        title="Proof Forge"
        glyph="⚒"
        accent="proof"
        subtitle="Mission 9 · Proofsmith. Place Evidence Shards into the manifest grid and forge a replayable receipt. The hash chain must hold."
        right={
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="flex items-center gap-1 text-proof"><Coins size={12} /> {Math.round(resources.evidenceShards)}</span>
            <span className="text-muted-foreground">shards</span>
          </div>
        }
      />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_280px]">
        {/* crafting grid */}
        <div className="glass relative flex flex-col rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Manifest Grid</h3>
            <span className="font-mono text-[11px] text-proof">{placed} shards placed</span>
          </div>

          <div className="relative flex flex-1 items-center justify-center py-4">
            {forging && (
              <div className="absolute inset-0 z-20 grid place-items-center bg-background/40 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-2">
                  <Hammer className="anim-pulse text-proof" size={28} />
                  <span className="font-mono text-xs text-proof">forging hash chain…</span>
                </div>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              {grid.map((on, i) => (
                <button
                  key={i}
                  onClick={() => toggle(i)}
                  className={cn(
                    "group relative grid size-20 place-items-center rounded-lg border-2 transition-all sm:size-24",
                    on
                      ? cn(c.border, c.bg, "glow-proof")
                      : "border-dashed border-border/60 bg-card/30 hover:border-proof/40"
                  )}
                >
                  {on ? (
                    <motion.span
                      initial={{ scale: 0, rotate: -30 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="flex flex-col items-center gap-1"
                    >
                      <span className="text-2xl">🧩</span>
                      <span className="font-mono text-[8px] text-proof">{hashCell(i + 1).slice(0, 8)}</span>
                    </motion.span>
                  ) : (
                    <span className="text-muted-foreground/40 text-xl group-hover:text-proof/50">+</span>
                  )}
                  {/* chain link hint between cells */}
                  {on && i % 3 !== 2 && grid[i + 1] && (
                    <span className="absolute right-[-9px] top-1/2 -translate-y-1/2 text-proof">
                      <Link2 size={12} />
                    </span>
                  )}
                  {on && i < 6 && grid[i + 3] && (
                    <span className="absolute bottom-[-9px] left-1/2 -translate-x-1/2 rotate-90 text-proof">
                      <Link2 size={12} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={doForge} disabled={!canForge || forging} className="flex-1 bg-proof text-background hover:bg-proof/90">
              <Hammer size={15} /> Forge Receipt
            </Button>
            <Button onClick={reset} variant="outline" size="icon" disabled={forging}>
              <RotateCcw size={15} />
            </Button>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Cost: 3+ shards · 1 consent key · 5 compute. Minimum 3 shards for a valid chain.
          </p>
        </div>

        {/* output + rails */}
        <div className="flex flex-col gap-3">
          <div className="glass rounded-xl border border-border p-3">
            <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Last Receipt</h3>
            <AnimatePresence mode="wait">
              {forged ? (
                <motion.div
                  key={forged.hash}
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="mt-2 flex flex-col items-center gap-2 rounded-lg border border-proof/40 bg-proof/5 p-3 glow-proof"
                >
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.3, 1] }}
                    className="text-4xl"
                  >
                    🔮
                  </motion.span>
                  <span className="font-mono text-[11px] text-proof">{forged.hash}</span>
                  <span className="flex items-center gap-1 text-[10px] text-verified">
                    <Check size={11} /> {forged.count} shards · chain sealed
                  </span>
                </motion.div>
              ) : (
                <div className="mt-2 flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 p-4 text-center">
                  <span className="text-3xl opacity-40">🔮</span>
                  <span className="text-[11px] text-muted-foreground">
                    Forge a receipt to mint a Receipt Crystal.
                  </span>
                </div>
              )}
            </AnimatePresence>
            {completed && (
              <div className="mt-2 text-center text-[10px] font-mono text-consent">
                ✓ Mission complete · best {completed.stars}★
              </div>
            )}
          </div>

          <ProofRailDashboard compact />
        </div>
      </div>
    </div>
  );
}
