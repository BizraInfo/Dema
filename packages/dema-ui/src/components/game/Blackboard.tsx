"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "@/lib/game/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SceneHeader, StarRating } from "./primitives";
import { Moon, Landmark, Check, X, RotateCcw, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface Proposal {
  id: string;
  text: string;
  safe: boolean;
  reason: string;
}

const PROPOSALS: Proposal[] = [
  { id: "p1", text: "Draft a local retrieval plan from /data/clean.", safe: true, reason: "Local read of clean data. Safe." },
  { id: "p2", text: "Self-certify my own output as final verdict.", safe: false, reason: "PAT cannot certify itself. SAT must verify." },
  { id: "p3", text: "Run the deterministic test swarm locally.", safe: true, reason: "Local deterministic tests produce delivery proof." },
  { id: "p4", text: "Auto-seal identity action without prompting.", safe: false, reason: "Identity/seal requires exact consent." },
  { id: "p5", text: "Export receipt bundle to federation peers now.", safe: false, reason: "Federation not live. Needs exact consent." },
  { id: "p6", text: "Compress context losslessly for retrieval.", safe: true, reason: "Local compression within budget. Safe." },
];

export function Blackboard() {
  const recordPass = useGame((s) => s.recordConsentPass);
  const recordMistake = useGame((s) => s.recordConsentMistake);
  const awardXp = useGame((s) => s.awardXp);
  const addResource = useGame((s) => s.addResource);
  const completeMission = useGame((s) => s.completeMission);
  const setRail = useGame((s) => s.setRail);
  const completed = useGame((s) => s.completedMissions.blackboardTrial);

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"choosing" | "revealed">("choosing");
  const [choice, setChoice] = useState<boolean | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const finished = index >= PROPOSALS.length;

  const decide = (verify: boolean) => {
    if (phase !== "choosing") return;
    setChoice(verify);
    setPhase("revealed");
    const p = PROPOSALS[index];
    const correct = verify === p.safe;
    setResults((r) => [...r, correct]);
    if (correct) {
      recordPass();
      awardXp("patWhisperer", 12);
      awardXp("satJudge", 14);
      addResource("trustScore", 1);
      toast.success(verify ? "SAT verified ✓" : "SAT rejected ✗", { description: p.reason });
    } else {
      recordMistake();
      toast.error("Blackboard mismatch", { description: p.reason });
    }
  };

  const next = () => {
    setPhase("choosing");
    setChoice(null);
    setIndex((i) => i + 1);
  };

  const restart = () => {
    setIndex(0);
    setPhase("choosing");
    setChoice(null);
    setResults([]);
  };

  const correctCount = results.filter(Boolean).length;
  const stars = finished
    ? results.length - correctCount === 0
      ? 5
      : results.length - correctCount <= 1
      ? 4
      : results.length - correctCount <= 2
      ? 3
      : 2
    : 0;

  useEffect(() => {
    if (finished) {
      completeMission("blackboardTrial", stars, { consentMistakes: results.filter((r) => !r).length });
      if (stars >= 4) setRail("formal", true);
    }
     
  }, [finished]);

  const p = PROPOSALS[index];

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <SceneHeader
        title="PAT / SAT Blackboard"
        glyph="🌙"
        accent="knowledge"
        subtitle="Mission 5 · PAT Whisperer + SAT Judge. PAT proposes; SAT verifies or rejects. Win only if all verified actions stay in boundary."
        right={completed ? <StarRating value={completed.stars} /> : undefined}
      />

      <div className="flex items-center gap-3 text-xs font-mono">
        <span className="text-muted-foreground">PROPOSAL {Math.min(index + 1, PROPOSALS.length)}/{PROPOSALS.length}</span>
        <span className="flex items-center gap-1 text-verified"><Check size={12} /> {correctCount}</span>
        <span className="flex items-center gap-1 text-fail"><X size={12} /> {results.length - correctCount}</span>
        <div className="ml-auto h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-foreground/10">
          <div className="h-full rounded-full bg-knowledge transition-all" style={{ width: `${(index / PROPOSALS.length) * 100}%` }} />
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {/* blackboard columns backdrop */}
        <div className="pointer-events-none absolute inset-0 grid grid-cols-2 gap-2 opacity-20">
          <div className="rounded-xl border border-knowledge/40 bg-knowledge/5" />
          <div className="rounded-xl border border-verified/40 bg-verified/5" />
        </div>

        <AnimatePresence mode="wait">
          {finished ? (
            <motion.div key="r" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative flex flex-col items-center gap-4 text-center">
              <div className="text-5xl">{stars >= 4 ? "🏛" : "⚠"}</div>
              <div className="font-mono text-2xl font-bold">Consensus Reached</div>
              <StarRating value={stars} size={26} />
              <p className="max-w-sm text-xs text-muted-foreground">
                {stars === 5 ? "All proposals correctly mediated. Boundary held." : "Some proposals escaped boundary. PAT and SAT must align."}
              </p>
              <Button onClick={restart} variant="outline" size="sm"><RotateCcw size={14} /> New Session</Button>
            </motion.div>
          ) : (
            <motion.div key={p.id + index} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="relative w-full max-w-xl">
              <div className="rounded-2xl border border-knowledge/40 bg-card/60 p-5 shadow-xl">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  <span className="flex items-center gap-1 text-knowledge"><Moon size={11} /> PAT proposal</span>
                  <span className="flex items-center gap-1 text-verified"><Landmark size={11} /> SAT awaits verdict</span>
                </div>
                <p className="mt-3 text-center font-mono text-base leading-relaxed text-foreground">
                  “{p.text}”
                </p>

                {phase === "revealed" && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 overflow-hidden">
                    <div className={cn("rounded-lg border p-3 text-sm", choice === p.safe ? "border-verified/40 bg-verified/10" : "border-fail/40 bg-fail/10")}>
                      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        {choice === p.safe ? <Check size={12} className="text-verified" /> : <X size={12} className="text-fail" />} doctrine
                      </div>
                      <p className="mt-1 text-foreground/90">{p.reason}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Correct verdict: {p.safe ? "VERIFY (safe)" : "REJECT (boundary)"}
                      </p>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button size="sm" onClick={next}>Next proposal <ChevronRight size={14} /></Button>
                    </div>
                  </motion.div>
                )}
              </div>

              {phase === "choosing" && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={() => decide(true)} className="flex items-center justify-center gap-2 rounded-lg border border-verified/40 bg-verified/10 p-3 font-mono text-xs uppercase text-verified transition-all hover:scale-[1.02] hover:shadow-lg">
                    <Check size={16} /> SAT Verify
                  </button>
                  <button onClick={() => decide(false)} className="flex items-center justify-center gap-2 rounded-lg border border-fail/40 bg-fail/10 p-3 font-mono text-xs uppercase text-fail transition-all hover:scale-[1.02] hover:shadow-lg">
                    <X size={16} /> SAT Reject
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="text-center text-[11px] text-muted-foreground">PAT cannot certify itself. SAT cannot secretly execute user work.</p>
    </div>
  );
}
