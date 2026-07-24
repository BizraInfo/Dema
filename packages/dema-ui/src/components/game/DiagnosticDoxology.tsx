"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "@/lib/game/store";
import {
  DIAGNOSTIC_SCENARIOS,
  FAILURE_CLASSES,
  LENS_META,
  failureById,
} from "@/lib/game/diagnostic";
import type { FailureClass, FailureInput } from "@/lib/game/diagnostic";
import { COLOR_CLASS } from "@/lib/game/data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SceneHeader } from "./primitives";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ShieldAlert,
  Lock,
  Check,
  X,
  RotateCcw,
  ChevronRight,
  AlertOctagon,
  ScrollText,
  Ban,
} from "lucide-react";
import { toast } from "sonner";

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export function DiagnosticDoxology() {
  const submitFailure = useGame((s) => s.submitFailure);
  const receipts = useGame((s) => s.diagnostic.receipts);
  const violations = useGame((s) => s.diagnostic.authorityViolations);
  const inflight = useGame((s) => s.diagnostic.inflightFailures);
  const attemptViolation = useGame((s) => s.attemptAuthorityViolation);
  const resolve = useGame((s) => s.resolveFailure);
  const resetDiag = useGame((s) => s.resetDiagnostic);

  const [queue] = useState(() => shuffle(DIAGNOSTIC_SCENARIOS));
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"choosing" | "revealed">("choosing");
  const [choice, setChoice] = useState<FailureClass | null>(null);
  const [verdict, setVerdict] = useState<ReturnType<typeof submitFailure> | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const finished = index >= queue.length;

  const sc = queue[index];

  const classify_now = (fc: FailureClass) => {
    if (phase !== "choosing") return;
    setChoice(fc);
    // submit the SAME input to the sealed classifier — operator's choice is scored against it
    const v = submitFailure(sc.input);
    setVerdict(v);
    setPhase("revealed");
    const correct = fc === sc.correct && fc === v.failure_class.id;
    setResults((r) => [...r, correct]);
    if (correct) {
      toast.success("Classification correct", { description: sc.explanation });
    } else {
      toast.error("Misclassification", {
        description: `Sealed verdict: ${v.failure_class.label}. The operator must respect the classifier.`,
      });
    }
  };

  const next = () => {
    setPhase("choosing");
    setChoice(null);
    setVerdict(null);
    setIndex((i) => i + 1);
  };

  const restart = () => {
    setIndex(0);
    setPhase("choosing");
    setChoice(null);
    setVerdict(null);
    setResults([]);
    resetDiag();
  };

  const tryViolate = (action: "autopatch" | "mint" | "publish") => {
    if (!verdict) return;
    const ok = attemptViolation("current", action); // always false
    toast.error(`Authority violation REFUSED`, {
      description: `attempted ${action.toUpperCase()} — invariant enforced. Trust −6, overclaim +1.`,
    });
    void ok;
  };

  const correctCount = results.filter(Boolean).length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <SceneHeader
        title="Diagnostic Doxology · PREVIEW_ONLY"
        glyph="⚖"
        accent="fail"
        subtitle="A synthetic teaching game for the FDE lens vocabulary — not the real diagnostic kernel. Classify every failure as Inward / Outward / Boundary / Economy. This demo classifier enforces: a failure classification can NEVER increase system authority."
        right={
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="text-consent">Ledger: {receipts.length}</span>
            <span className={cn(violations > 0 ? "text-fail" : "text-verified")}>
              Violations: {violations}
            </span>
          </div>
        }
      />

      {/* Core Law banner */}
      <div className="glass rounded-xl border border-fail/30 p-3">
        <div className="grid gap-1 text-[10px] font-mono sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["code failed", "patch the code", "inward"],
            ["proof failed", "repair the proof", "inward"],
            ["world failed", "repair the env", "outward"],
            ["consent missing", "stop", "boundary"],
            ["impact simulated", "do not mint", "economy"],
            ["cost measured", "not value", "metrics"],
          ].map(([cond, act, lens]) => {
            const c = COLOR_CLASS[LENS_META[lens as keyof typeof LENS_META].color];
            return (
              <div key={cond} className={cn("flex items-center gap-1.5 rounded border px-1.5 py-0.5", c.border, c.bg)}>
                <span className="text-muted-foreground">{cond}</span>
                <ChevronRight size={9} className="text-muted-foreground" />
                <span className={c.text}>{act}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_300px]">
        {/* classifier stage */}
        <div className="glass relative flex flex-col rounded-xl border border-border p-4">
          <div className="flex items-center justify-between pb-2">
            <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Operator Classifier
            </h3>
            <span className="font-mono text-[11px] text-muted-foreground">
              CASE {Math.min(index + 1, queue.length)}/{queue.length} · ✓{correctCount} ✗{results.length - correctCount}
            </span>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center">
            <AnimatePresence mode="wait">
              {finished ? (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-3 text-center"
                >
                  <div className="text-4xl">{correctCount >= 6 ? "⚖" : "⚠"}</div>
                  <div className="font-mono text-xl font-bold">Doxology Complete</div>
                  <p className="max-w-sm text-xs text-muted-foreground">
                    {correctCount}/{queue.length} correct. {violations === 0 ? "Zero authority violations — the invariant held." : `${violations} violation attempts refused.`}
                  </p>
                  <Button onClick={restart} variant="outline" size="sm">
                    <RotateCcw size={13} /> New Session
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key={sc.id + index}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  className="w-full max-w-xl"
                >
                  {/* failure card */}
                  <div className="rounded-2xl border border-fail/40 bg-card/60 p-4 shadow-xl">
                    <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      <span className="flex items-center gap-1 text-fail">
                        <AlertOctagon size={11} /> failure · {sc.id}
                      </span>
                      <span>source · {sc.input.source}</span>
                    </div>
                    <h4 className="mt-2 font-mono text-base font-semibold text-foreground">
                      {sc.title}
                    </h4>
                    <p className="mt-1 text-sm text-muted-foreground">{sc.input.message}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {sc.input.evidence.map((e) => (
                        <span key={e} className="rounded bg-foreground/5 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                          {e}
                        </span>
                      ))}
                    </div>

                    {phase === "revealed" && verdict && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-3 overflow-hidden"
                      >
                        <div
                          className={cn(
                            "rounded-lg border p-3 text-sm",
                            choice === sc.correct
                              ? "border-verified/40 bg-verified/10"
                              : "border-fail/40 bg-fail/10"
                          )}
                        >
                          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                            {choice === sc.correct ? <Check size={12} className="text-verified" /> : <X size={12} className="text-fail" />}
                            sealed verdict
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span className="text-[11px] text-muted-foreground">your call:</span>
                            <span className={cn("rounded border px-1.5 py-0.5 font-mono text-[10px]", COLOR_CLASS[failureById(choice!).color].border, COLOR_CLASS[failureById(choice!).color].text)}>
                              {failureById(choice!).label}
                            </span>
                            <span className="text-[11px] text-muted-foreground">sealed:</span>
                            <span className={cn("rounded border px-1.5 py-0.5 font-mono text-[10px]", COLOR_CLASS[verdict.failure_class.color].border, COLOR_CLASS[verdict.failure_class.color].text)}>
                              {verdict.failure_class.label}
                            </span>
                          </div>
                          <p className="mt-2 text-foreground/90">{sc.explanation}</p>
                          <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] font-mono">
                            <span className="text-muted-foreground">lens: <span className={COLOR_CLASS[LENS_META[verdict.lens].color].text}>{LENS_META[verdict.lens].label}</span></span>
                            <span className="text-muted-foreground">authority Δ: <span className={verdict.authority_delta < 0 ? "text-fail" : "text-verified"}>{verdict.authority_delta}</span></span>
                            <span className="text-muted-foreground">autopatch: {verdict.autopatch_allowed ? <span className="text-verified">yes</span> : <span className="text-fail">no</span>}</span>
                            <span className="text-muted-foreground">mint: {verdict.mint_allowed ? <span className="text-verified">yes</span> : <span className="text-fail">no</span>}</span>
                          </div>

                          {/* invariant enforcer — try to violate */}
                          {!verdict.continue_allowed && (
                            <div className="mt-3 rounded-lg border border-fail/30 bg-fail/5 p-2">
                              <div className="flex items-center gap-1 text-[10px] font-mono uppercase text-fail">
                                <Ban size={11} /> invariant enforcer — attempt forbidden action
                              </div>
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                <Button size="sm" variant="outline" onClick={() => tryViolate("autopatch")} className="h-6 border-fail/40 text-fail hover:bg-fail/10 text-[10px]">
                                  autopatch anyway
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => tryViolate("mint")} className="h-6 border-fail/40 text-fail hover:bg-fail/10 text-[10px]">
                                  mint anyway
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => tryViolate("publish")} className="h-6 border-fail/40 text-fail hover:bg-fail/10 text-[10px]">
                                  publish anyway
                                </Button>
                              </div>
                            </div>
                          )}

                          <div className="mt-3 flex justify-end">
                            <Button size="sm" onClick={next}>
                              Next case <ChevronRight size={13} />
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* class buckets */}
                  {phase === "choosing" && (
                    <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                      {FAILURE_CLASSES.map((f) => {
                        const c = COLOR_CLASS[f.color];
                        const lensMeta = LENS_META[f.lens];
                        return (
                          <button
                            key={f.id}
                            onClick={() => classify_now(f.id)}
                            className={cn(
                              "group flex items-start gap-1.5 rounded-lg border p-2 text-left transition-all hover:scale-[1.02]",
                              c.border, c.bg
                            )}
                          >
                            <span className={cn("text-base leading-none", c.text)}>{f.glyph}</span>
                            <div className="min-w-0">
                              <div className={cn("text-[10px] font-mono font-semibold leading-tight", c.text)}>
                                {f.label}
                              </div>
                              <div className="text-[8px] uppercase text-muted-foreground">
                                {lensMeta.label}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {inflight > 0 && (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-consent/40 bg-consent/5 px-2 py-1 text-[10px] font-mono text-consent">
              <Lock size={10} /> {inflight} unresolved outward/boundary failures — node frozen for safety
            </div>
          )}
        </div>

        {/* receipt ledger */}
        <div className="glass flex min-h-0 flex-col rounded-xl border border-border">
          <div className="flex items-center justify-between border-b border-border/70 px-3 py-2">
            <h3 className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <ScrollText size={13} /> Diagnostic Ledger
            </h3>
            <span className="font-mono text-[10px] text-muted-foreground">{receipts.length}</span>
          </div>
          <ScrollArea className="scroll-thin flex-1 px-2 py-2">
            {receipts.length === 0 ? (
              <div className="flex flex-col items-center gap-1 p-4 text-center text-[11px] text-muted-foreground">
                <ShieldAlert size={20} className="opacity-40" />
                No diagnostics yet. Classify a failure to log a preview verdict.
              </div>
            ) : (
              <div className="space-y-1.5">
                {receipts.map((r) => {
                  const c = COLOR_CLASS[r.verdict.failure_class.color];
                  return (
                    <div key={r.id} className={cn("rounded-lg border p-2", c.border, c.bg)}>
                      <div className="flex items-center gap-1.5">
                        <span className={cn("text-sm", c.text)}>{r.verdict.failure_class.glyph}</span>
                        <span className="flex-1 truncate text-[10px] font-mono font-semibold text-foreground">
                          {r.verdict.failure_class.label}
                        </span>
                        {!r.verdict.continue_allowed && <Lock size={10} className="text-consent" />}
                      </div>
                      <div className="mt-0.5 font-mono text-[9px] text-proof">{r.demo_ref}</div>
                      <div className="mt-0.5 truncate text-[9px] text-muted-foreground">
                        {r.verdict.input.message}
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-[8px] font-mono uppercase">
                        <span className={c.text}>{LENS_META[r.verdict.lens].label}</span>
                        <span className="text-muted-foreground">· Δauth {r.verdict.authority_delta}</span>
                      </div>
                      {r.verdict.continue_allowed && (
                        <button
                          onClick={() => resolve(r.id)}
                          className="mt-1 w-full rounded border border-verified/40 bg-verified/10 py-0.5 text-[9px] font-mono uppercase text-verified hover:bg-verified/20"
                        >
                          ✓ mark resolved
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        Inward failures may be repaired · Outward failures must be diagnosed · Missing consent stops action · Simulated impact cannot mint · A failure classification cannot increase authority.
      </p>
    </div>
  );
}
