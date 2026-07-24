"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "@/lib/game/store";
import { COLOR_CLASS, MISSIONS, RAIL_META } from "@/lib/game/data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SceneHeader, StarRating, TruthLabelBadge } from "./primitives";
import { Check, X, Sparkles, ShieldCheck, Lock } from "lucide-react";
import { toast } from "sonner";

export function Ceremony() {
  const rails = useGame((s) => s.rails);
  const resources = useGame((s) => s.resources);
  const overclaims = useGame((s) => s.overclaims);
  const consentMistakes = useGame((s) => s.consentMistakes);
  const completed = useGame((s) => s.completedMissions);
  const ceremonyCompleted = useGame((s) => s.ceremonyCompleted);
  const setRail = useGame((s) => s.setRail);
  const completeCeremony = useGame((s) => s.completeCeremony);
  const forgeReceipt = useGame((s) => s.forgeReceipt);

  const [sealing, setSealing] = useState(false);
  const [sparks, setSparks] = useState<number[]>([]);

  const missionCount = Object.keys(completed).length;
  const litRails = RAIL_META.filter((r) => rails[r.key] && !r.preview).length;
  const requiredMissions = 5;

  const reqs = [
    { label: "Formal proof rail", ok: rails.formal },
    { label: "Cryptographic proof rail", ok: rails.cryptographic },
    { label: "Empirical proof rail", ok: rails.empirical },
    { label: "Node Health ≥ 80", ok: resources.nodeHealth >= 80 },
    { label: `${requiredMissions}+ missions completed (${missionCount})`, ok: missionCount >= requiredMissions },
  ];
  const canSeal = reqs.every((r) => r.ok) && !ceremonyCompleted;

  const stars = (() => {
    const penalty = overclaims + consentMistakes;
    if (penalty === 0) return 5;
    if (penalty <= 2) return 4;
    if (penalty <= 4) return 3;
    return 2;
  })();

  const seal = () => {
    setSealing(true);
    setRail("formal", true);
    setRail("cryptographic", true);
    setRail("empirical", true);
    // spawn sparks
    const ids = Array.from({ length: 18 }, (_, i) => i);
    setSparks(ids);
    setTimeout(() => {
      const rec = forgeReceipt({
        label: "READY_LOCAL Ceremony · Node0 sealed",
        mission: "readyLocal",
        rails: { formal: true, cryptographic: true, empirical: true, economic: false },
      });
      completeCeremony(stars);
      setSealing(false);
      toast.success("NODE0 READY_LOCAL 🔮", {
        description: `Human Sovereignty Preserved · receipt ${rec.hash.slice(0, 10)}…`,
      });
    }, 1600);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <SceneHeader
        title="READY_LOCAL Ceremony"
        glyph="✦"
        accent="verified"
        subtitle="Mission 10 · The safe default victory. Seal Node0 as READY_LOCAL — proof attached, consent preserved, no overclaim."
        right={ceremonyCompleted ? <TruthLabelBadge label="READY_LOCAL" /> : <TruthLabelBadge label="DECLARED" />}
      />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* ceremony stage */}
        <div className="glass relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-border p-6 scanlines">
          {/* hash-chain fireworks */}
          <AnimatePresence>
            {ceremonyCompleted &&
              sparks.map((i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 0, x: 0, scale: 0.5 }}
                  animate={{
                    opacity: [0, 1, 0],
                    y: -120 - Math.random() * 80,
                    x: (Math.random() - 0.5) * 200,
                    scale: 1.2,
                  }}
                  transition={{ duration: 1.4, delay: i * 0.05 }}
                  className="absolute bottom-10 text-lg"
                  style={{ left: `${30 + Math.random() * 40}%` }}
                >
                  {["🔮", "✦", "★", "△", "⬡"][i % 5]}
                </motion.span>
              ))}
          </AnimatePresence>

          <div className="relative flex flex-col items-center gap-4 text-center">
            {/* node sigil */}
            <motion.div
              animate={sealing ? { rotate: 360, scale: [1, 1.15, 1] } : { rotate: 0 }}
              transition={sealing ? { duration: 1.6, repeat: Infinity } : {}}
              className={cn(
                "relative grid size-32 place-items-center rounded-full border-2",
                ceremonyCompleted ? "border-verified bg-verified/10 glow-verified" : "border-consent/50 bg-consent/5"
              )}
            >
              <div className="absolute inset-2 rounded-full border border-dashed border-consent/30 anim-spin-slow" />
              <span className="font-mono text-5xl text-consent">⬡</span>
              {ceremonyCompleted && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -right-1 -top-1 grid size-8 place-items-center rounded-full bg-verified text-background">
                  <Check size={16} />
                </motion.div>
              )}
            </motion.div>

            <div>
              <h3 className="font-mono text-2xl font-bold">
                {ceremonyCompleted ? "NODE0 READY_LOCAL" : "Awaiting Proof"}
              </h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {ceremonyCompleted
                  ? "Human Sovereignty Preserved. The node earns trust one verified gate at a time."
                  : "Complete the proof rails, restore node health, and clear overclaims to seal the ceremony."}
              </p>
            </div>

            {ceremonyCompleted ? (
              <div className="flex flex-col items-center gap-2">
                <StarRating value={stars} size={30} />
                <p className="font-mono text-xs text-verified">receipt sealed · READY_LOCAL</p>
              </div>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={!canSeal || sealing} size="lg" className="bg-consent text-background hover:bg-consent/90">
                    {sealing ? <Sparkles className="animate-pulse" /> : <ShieldCheck />}
                    {sealing ? "Sealing…" : "Seal READY_LOCAL"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="glass-strong border-consent/40">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-mono">Consent Gate · Seal Ceremony</AlertDialogTitle>
                    <AlertDialogDescription>
                      Sealing Node0 as READY_LOCAL is an exact-consent action. This will light all proof rails and emit a final receipt. Federation, token economy, and remote readiness remain locked (DESIGNED_NOT_LIVE).
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel><Lock size={14} /> Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={seal} className="bg-consent text-background hover:bg-consent/90">
                      <ShieldCheck size={14} /> I consent — seal
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* requirements */}
        <div className="flex flex-col gap-3">
          <div className="glass rounded-xl border border-border p-3">
            <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Seal Requirements</h3>
            <div className="mt-2 space-y-1.5">
              {reqs.map((r) => (
                <div key={r.label} className={cn("flex items-center gap-2 rounded-lg border p-2", r.ok ? "border-verified/40 bg-verified/5" : "border-border/60 bg-card/30")}>
                  <span className={cn("grid size-5 place-items-center rounded-full", r.ok ? "bg-verified text-background" : "bg-foreground/10 text-muted-foreground")}>
                    {r.ok ? <Check size={11} /> : <X size={11} />}
                  </span>
                  <span className={cn("text-xs", r.ok ? "text-verified" : "text-muted-foreground")}>{r.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-xl border border-border p-3">
            <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Projected Stars</h3>
            <div className="mt-2 flex items-center justify-between">
              <StarRating value={stars} size={20} />
              <span className="text-[10px] font-mono text-muted-foreground">
                {overclaims + consentMistakes === 0 ? "clean run" : `${overclaims + consentMistakes} penalty`}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] font-mono">
              <span className="text-fail">overclaims · {overclaims}</span>
              <span className="text-fail">mistakes · {consentMistakes}</span>
            </div>
          </div>

          <div className="glass rounded-xl border border-border p-3 text-[11px] text-muted-foreground">
            <p className="font-mono uppercase tracking-wider text-consent">locked after sealing</p>
            <ul className="mt-1.5 space-y-1">
              <li>· Federation (DESIGNED_NOT_LIVE)</li>
              <li>· Token economy (PREVIEW_ONLY)</li>
              <li>· PUBLIC_SAFE / READY_REMOTE (future proof)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
