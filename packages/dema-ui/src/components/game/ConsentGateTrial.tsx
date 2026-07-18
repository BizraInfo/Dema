"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "@/lib/game/store";
import { CONSENT_SCENARIOS } from "@/lib/game/data";
import type { ConsentDecision } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SceneHeader, StarRating } from "./primitives";
import { Check, X, RotateCcw, ChevronRight, Lock, ShieldCheck, KeyRound } from "lucide-react";
import { toast } from "sonner";

const DECISIONS: {
  key: ConsentDecision;
  label: string;
  desc: string;
  color: string;
  icon: React.ElementType;
}[] = [
  { key: "ALLOW", label: "Allow", desc: "L0 · safe local action", color: "verified", icon: ShieldCheck },
  { key: "EXACT_CONSENT", label: "Require Consent", desc: "exact phrase gate", color: "consent", icon: KeyRound },
  { key: "FAIL_CLOSED", label: "Fail Closed", desc: "block · doctrine", color: "fail", icon: Lock },
];

const ROUND = 6;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const COLOR: Record<string, string> = {
  verified: "border-verified/40 bg-verified/10 text-verified",
  consent: "border-consent/40 bg-consent/10 text-consent",
  fail: "border-fail/40 bg-fail/10 text-fail",
};

export function ConsentGateTrial() {
  const recordPass = useGame((s) => s.recordConsentPass);
  const recordMistake = useGame((s) => s.recordConsentMistake);
  const awardXp = useGame((s) => s.awardXp);
  const completeMission = useGame((s) => s.completeMission);
  const setRail = useGame((s) => s.setRail);
  const completed = useGame((s) => s.completedMissions.consentTrial);

  const [round, setRound] = useState(() => shuffle(CONSENT_SCENARIOS).slice(0, ROUND));
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"choosing" | "revealed">("choosing");
  const [choice, setChoice] = useState<ConsentDecision | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [slammed, setSlammed] = useState(false);
  const finished = index >= round.length;

  const decide = (d: ConsentDecision) => {
    if (phase !== "choosing") return;
    setChoice(d);
    setPhase("revealed");
    const ok = d === round[index].correct;
    setResults((r) => [...r, ok]);
    if (ok) {
      recordPass();
      awardXp("fateSentinel", 22);
      toast.success("Consent preserved", { description: round[index].explanation });
    } else {
      recordMistake();
      awardXp("fateSentinel", 5);
      if (round[index].correct === "FAIL_CLOSED") {
        setSlammed(true);
        setTimeout(() => setSlammed(false), 600);
      }
      toast.error("Gate violation", {
        description: `Correct: ${round[index].correct}. Trust −10.`,
      });
    }
  };

  const next = () => {
    setPhase("choosing");
    setChoice(null);
    setIndex((i) => i + 1);
  };

  const restart = () => {
    setRound(shuffle(CONSENT_SCENARIOS).slice(0, ROUND));
    setIndex(0);
    setPhase("choosing");
    setChoice(null);
    setResults([]);
  };

  const correctCount = results.filter(Boolean).length;
  const stars = (() => {
    if (!finished) return 0;
    const wrong = results.length - correctCount;
    if (wrong === 0) return 5;
    if (wrong === 1) return 4;
    if (wrong === 2) return 3;
    if (wrong === 3) return 2;
    return 1;
  })();

  useEffect(() => {
    if (finished) {
      completeMission("consentTrial", stars, { consentMistakes: results.filter((r) => !r).length });
      if (stars >= 4) setRail("formal", true);
    }
     
  }, [finished]);

  const sc = round[index];

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <SceneHeader
        title="Consent Gate Trial"
        glyph="🜪"
        accent="consent"
        subtitle="Mission 4 · FATE Sentinel. Decide which actions are safe, which need exact consent, and which must fail closed."
        right={
          completed ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-muted-foreground">BEST</span>
              <StarRating value={completed.stars} />
            </div>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
        <span className="text-muted-foreground">ACTION {Math.min(index + 1, round.length)}/{round.length}</span>
        <span className="flex items-center gap-1 text-verified"><Check size={12} /> {correctCount}</span>
        <span className="flex items-center gap-1 text-fail"><X size={12} /> {results.length - correctCount}</span>
        <div className="ml-auto h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-foreground/10">
          <div className="h-full rounded-full bg-consent transition-all" style={{ width: `${(index / round.length) * 100}%` }} />
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {/* gate slam overlay */}
        {slammed && (
          <div className="anim-slam pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center">
            <div className="rounded-md border-2 border-fail bg-fail/20 px-6 py-2 font-mono text-sm font-bold text-fail glow-fail">
              FAIL_CLOSED
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {finished ? (
            <motion.div key="r" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4 text-center">
              <div className="text-5xl">{stars >= 4 ? "🜪" : "⚠"}</div>
              <div className="font-mono text-2xl font-bold">Gate Trial Complete</div>
              <StarRating value={stars} size={26} />
              <p className="max-w-sm text-xs text-muted-foreground">
                {stars === 5 ? "All gates held. Consent preserved." : stars >= 3 ? "Mostly clean. Some gates were misjudged." : "Too many violations. The ladder must be respected."}
              </p>
              <Button onClick={restart} variant="outline" size="sm"><RotateCcw size={14} /> Retake Trial</Button>
            </motion.div>
          ) : (
            <motion.div key={sc.id + index} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full max-w-xl">
              <div className="rounded-2xl border border-consent/40 bg-card/60 p-5 shadow-xl glow-consent">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">incoming action · L? risk</div>
                <h3 className="mt-2 font-mono text-lg font-semibold text-foreground">{sc.action}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{sc.detail}</p>

                {phase === "revealed" && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 overflow-hidden">
                    <div className={cn("rounded-lg border p-3 text-sm", choice === sc.correct ? "border-verified/40 bg-verified/10" : "border-fail/40 bg-fail/10")}>
                      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        {choice === sc.correct ? <Check size={12} className="text-verified" /> : <X size={12} className="text-fail" />}
                        doctrine
                      </div>
                      <p className="mt-1 text-foreground/90">{sc.explanation}</p>
                      <div className="mt-2 flex items-center gap-2 text-[11px]">
                        <span className="text-muted-foreground">correct verdict:</span>
                        <span className={cn("rounded-md border px-2 py-0.5 font-mono uppercase", COLOR[DECISIONS.find((d) => d.key === sc.correct)!.color])}>
                          {sc.correct.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button size="sm" onClick={next}>Next action <ChevronRight size={14} /></Button>
                    </div>
                  </motion.div>
                )}
              </div>

              {phase === "choosing" && (
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {DECISIONS.map((d) => (
                    <button key={d.key} onClick={() => decide(d.key)} className={cn("flex items-center gap-2.5 rounded-lg border p-3 text-left transition-all hover:scale-[1.02] hover:shadow-lg", COLOR[d.color])}>
                      <d.icon size={18} />
                      <div>
                        <div className="font-mono text-xs font-bold uppercase">{d.label}</div>
                        <div className="text-[10px] text-muted-foreground">{d.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="text-center text-[11px] text-muted-foreground">Autonomy without consent is violation. The Human Node is final authority.</p>
    </div>
  );
}
