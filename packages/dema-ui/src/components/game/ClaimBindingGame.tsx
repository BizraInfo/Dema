"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "@/lib/game/store";
import { CLAIM_CARDS, COLOR_CLASS, TRUTH_LABELS } from "@/lib/game/data";
import type { TruthLabel } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SceneHeader, StarRating, TruthLabelBadge } from "./primitives";
import {
  Check,
  X,
  RotateCcw,
  ChevronRight,
  Link2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

const BUCKETS: TruthLabel[] = [
  "VERIFIED",
  "DECLARED",
  "DESIGNED_NOT_LIVE",
  "LOCAL_ONLY",
  "UNKNOWN",
];

const ROUND_SIZE = 6;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface FloatItem {
  id: number;
  x: number;
}

export function ClaimBindingGame() {
  const recordCorrect = useGame((s) => s.recordCorrectBinding);
  const recordOverclaim = useGame((s) => s.recordOverclaim);
  const awardXp = useGame((s) => s.awardXp);
  const addResource = useGame((s) => s.addResource);
  const completeMission = useGame((s) => s.completeMission);
  const forgeReceipt = useGame((s) => s.forgeReceipt);
  const streak = useGame((s) => s.ihsanStreak);
  const completed = useGame((s) => s.completedMissions.bindClaim);

  const [round, setRound] = useState(() => shuffle(CLAIM_CARDS).slice(0, ROUND_SIZE));
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"choosing" | "revealed">("choosing");
  const [choice, setChoice] = useState<TruthLabel | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [floats, setFloats] = useState<FloatItem[]>([]);
  const [shake, setShake] = useState(false);

  const card = round[index];
  const finished = index >= round.length;

  const spawnFloat = () => {
    const id = Date.now();
    const x = 40 + Math.random() * 20;
    setFloats((f) => [...f, { id, x }]);
    setTimeout(() => setFloats((f) => f.filter((it) => it.id !== id)), 1300);
  };

  const classify = (label: TruthLabel) => {
    if (phase !== "choosing") return;
    setChoice(label);
    setPhase("revealed");
    const correct = label === card.correct;
    setResults((r) => [...r, correct]);
    if (correct) {
      recordCorrect();
      awardXp("truthBinder", 25);
      addResource("compute", -2);
      spawnFloat();
      toast.success("Claim bound ✓", {
        description: `${card.correct} · +1 Evidence Shard`,
      });
    } else {
      recordOverclaim();
      awardXp("truthBinder", 5);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      toast.error("Overclaim — ZANN fog", {
        description: `Correct label was ${card.correct}. Trust −8.`,
      });
    }
  };

  const next = () => {
    setPhase("choosing");
    setChoice(null);
    setIndex((i) => i + 1);
  };

  const restart = () => {
    setRound(shuffle(CLAIM_CARDS).slice(0, ROUND_SIZE));
    setIndex(0);
    setPhase("choosing");
    setChoice(null);
    setResults([]);
  };

  const correctCount = results.filter(Boolean).length;
  const stars = useMemo(() => {
    if (!finished) return 0;
    const wrong = results.length - correctCount;
    if (wrong === 0) return 5;
    if (wrong === 1) return 4;
    if (wrong === 2) return 3;
    if (wrong === 3) return 2;
    return 1;
  }, [finished, results, correctCount]);

  const onEnterFinish = () => {
    if (finished) {
      completeMission("bindClaim", stars, { overclaims: results.filter((_, i) => !results[i]).length });
      if (stars >= 4) {
        forgeReceipt({
          label: "Claim-Binding Round · proof room",
          mission: "bindClaim",
          rails: { formal: true, empirical: true },
        });
      }
    }
  };

  // call complete once when finished
  useEffect(() => {
    if (finished) onEnterFinish();
     
  }, [finished]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <SceneHeader
        title="Bind the Claim"
        glyph="⛓"
        accent="proof"
        subtitle="Mission 1 · Truth Binder. Classify each claim card into its true label. Bind to evidence — never overclaim."
        right={
          completed ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-muted-foreground">BEST</span>
              <StarRating value={completed.stars} />
            </div>
          ) : undefined
        }
      />

      {/* progress + score */}
      <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
        <span className="text-muted-foreground">
          CARD {Math.min(index + 1, round.length)}/{round.length}
        </span>
        <span className="flex items-center gap-1 text-verified">
          <Check size={12} /> {correctCount} bound
        </span>
        <span className="flex items-center gap-1 text-fail">
          <X size={12} /> {results.length - correctCount} overclaim
        </span>
        {streak >= 2 && (
          <span className="flex items-center gap-1 text-consent">✦ Ihsān ×{streak}</span>
        )}
        <div className="ml-auto h-1.5 flex-1 max-w-[220px] overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full bg-proof transition-all"
            style={{ width: `${(index / round.length) * 100}%` }}
          />
        </div>
      </div>

      {/* stage */}
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center">
        {/* floating receipts */}
        {floats.map((f) => (
          <span
            key={f.id}
            className="anim-float pointer-events-none absolute text-2xl text-proof"
            style={{ left: `${f.x}%`, bottom: "30%" }}
          >
            🔮
          </span>
        ))}

        <AnimatePresence mode="wait">
          {finished ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 text-center"
            >
              <div className="text-5xl">{stars >= 4 ? "🔮" : stars >= 3 ? "✦" : "⚠"}</div>
              <div>
                <div className="font-mono text-2xl font-bold">
                  Round Complete
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {correctCount}/{round.length} claims correctly bound
                </div>
              </div>
              <StarRating value={stars} size={26} />
              <p className="max-w-sm text-xs text-muted-foreground">
                {stars === 5
                  ? "Perfect binding. No overclaim. Proof room sealed."
                  : stars >= 3
                  ? "Solid. A few claims slipped into ZANN fog."
                  : "Too many overclaims. Re-bind with evidence."}
              </p>
              <Button onClick={restart} variant="outline" size="sm">
                <RotateCcw size={14} /> New Round
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key={card.id + index}
              initial={{ opacity: 0, y: 20, rotateY: 90 }}
              animate={{ opacity: 1, y: 0, rotateY: 0 }}
              exit={{ opacity: 0, y: -20, rotateY: -90 }}
              transition={{ duration: 0.35 }}
              className={cn("w-full max-w-xl", shake && "anim-zann")}
            >
              {/* claim card */}
              <div className="relative rounded-2xl border border-proof/40 bg-card/60 p-5 shadow-xl glow-proof">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  <span className="flex items-center gap-1 text-proof">
                    <Link2 size={11} /> claim · {card.id}
                  </span>
                  <span>evidence {card.evidence ? "available" : "—"}</span>
                </div>
                <p className="mt-3 text-center font-mono text-base leading-relaxed text-foreground sm:text-lg">
                  “{card.text}”
                </p>

                {phase === "revealed" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-4 overflow-hidden"
                  >
                    <div className="rounded-lg border border-border/70 bg-background/50 p-3 text-sm">
                      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        <AlertTriangle size={11} /> evidence
                      </div>
                      <p className="mt-1 text-foreground/90">{card.evidence}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground">YOUR LABEL</span>
                        <TruthLabelBadge label={choice!} size="xs" />
                        <span className="text-[10px] font-mono text-muted-foreground">CORRECT</span>
                        <TruthLabelBadge label={card.correct} size="xs" />
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button size="sm" onClick={next}>
                        Next claim <ChevronRight size={14} />
                      </Button>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* buckets */}
              {phase === "choosing" && (
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {BUCKETS.map((b) => {
                    const meta = TRUTH_LABELS.find((t) => t.key === b)!;
                    const c = COLOR_CLASS[meta.color];
                    return (
                      <button
                        key={b}
                        onClick={() => classify(b)}
                        className={cn(
                          "group flex flex-col items-center gap-1 rounded-lg border p-2.5 transition-all hover:scale-[1.03]",
                          c.bg,
                          c.border,
                          "hover:shadow-lg"
                        )}
                      >
                        <span className={cn("size-2 rounded-full", c.dot)} />
                        <span className={cn("text-center font-mono text-[10px] uppercase leading-tight tracking-wider", c.text)}>
                          {meta.label.replace(" · ", "\n")}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        Power without proof is overclaim. Bind each claim to its true evidence state.
      </p>
    </div>
  );
}
