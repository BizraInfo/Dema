"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "@/lib/game/store";
import { OATH_STEPS, ORG_AGENTS } from "@/lib/game/ecosystem";
import { COLOR_CLASS } from "@/lib/game/data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronRight, RotateCcw } from "lucide-react";

const KEY = "bizra_node0_boot_v2";

export function SovereignBoot() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [materialized, setMaterialized] = useState(0);
  const reset = useGame((s) => s.reset);
  const setScene = useGame((s) => s.setScene);
  const toggleRun = useGame((s) => s.toggleOfficeRun);
  const setSpeed = useGame((s) => s.setOfficeSpeed);

  useEffect(() => {
    let seen = false;
    try {
      seen = !!localStorage.getItem(KEY);
    } catch {
      seen = false;
    }
    if (!seen) {
      const t = setTimeout(() => setOpen(true), 0);
      return () => clearTimeout(t);
    }
  }, []);

  // materialize agents during step 1
  useEffect(() => {
    if (step !== 1) return;
    let m = 0;
    const start = setTimeout(() => setMaterialized(0), 0);
    const t = setInterval(() => {
      m += 1;
      if (m > ORG_AGENTS.length) {
        clearInterval(t);
        return;
      }
      setMaterialized(m);
    }, 180);
    return () => {
      clearTimeout(start);
      clearInterval(t);
    };
  }, [step]);

  const close = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  const finish = () => {
    close();
    setScene("ecosystem");
    // ignite the loop after a beat
    setTimeout(() => {
      if (!useGame.getState().office.running) toggleRun();
      setSpeed(1);
    }, 400);
  };

  const cur = OATH_STEPS[step];
  const isLast = step === OATH_STEPS.length - 1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.92, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            className="glass-strong relative w-full max-w-lg overflow-hidden rounded-2xl border border-consent/40 p-6 glow-consent"
          >
            {/* progress */}
            <div className="absolute inset-x-0 top-0 h-0.5 bg-foreground/10">
              <motion.div
                className="h-full bg-consent"
                animate={{ width: `${((step + 1) / OATH_STEPS.length) * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <span>Sovereign Boot · ceremony</span>
              <span>{step + 1} / {OATH_STEPS.length}</span>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={cur.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="mt-4"
              >
                {/* sigil */}
                <div className="flex justify-center">
                  <motion.div
                    animate={step === 0 ? { scale: [0.5, 1.1, 1], rotate: [0, 180, 360] } : {}}
                    transition={{ duration: 1.2 }}
                    className="relative grid size-20 place-items-center rounded-full border-2 border-consent/50 bg-consent/5"
                  >
                    <div className="absolute inset-2 rounded-full border border-dashed border-consent/30 anim-spin-slow" />
                    <span className="font-mono text-4xl text-consent">{cur.glyph}</span>
                  </motion.div>
                </div>

                <h2 className="mt-4 text-center font-mono text-xl font-bold text-foreground">
                  {cur.title}
                </h2>
                <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
                  {cur.body}
                </p>

                {/* agent materialization on step 1 */}
                {step === 1 && (
                  <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                    {ORG_AGENTS.map((a, i) => {
                      const visible = i < materialized;
                      const c = COLOR_CLASS[a.color];
                      return (
                        <AnimatePresence key={a.id}>
                          {visible && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0, y: -10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              className={cn("flex flex-col items-center gap-0.5 rounded-lg border p-1", c.border, c.bg)}
                            >
                              <span className={cn("text-lg", c.text)}>{a.glyph}</span>
                              <span className="font-mono text-[8px] uppercase text-foreground/70">{a.name}</span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      );
                    })}
                  </div>
                )}

                {/* loop ring on step 2 */}
                {step === 2 && (
                  <div className="relative mx-auto mt-4 aspect-square w-40">
                    <svg className="absolute inset-0" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" className="text-proof/20" strokeWidth="1" strokeDasharray="2 3" />
                    </svg>
                    {ORG_AGENTS.slice(0, 10).map((_, i) => {
                      const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
                      return (
                        <motion.span
                          key={i}
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.08 }}
                          className="absolute grid size-5 place-items-center rounded-full border border-proof/40 bg-proof/10 text-[9px] text-proof"
                          style={{ left: `${50 + Math.cos(angle) * 42}%`, top: `${50 + Math.sin(angle) * 42}%`, transform: "translate(-50%,-50%)" }}
                        >
                          {["👁","📡","💭","🌙","⛓","⚖","🜪","🏗","📊","✦"][i]}
                        </motion.span>
                      );
                    })}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-xl text-proof anim-pulse">⟳</div>
                  </div>
                )}

                {/* oath affirmation on step 3 */}
                {step === 3 && (
                  <div className="mt-3 rounded-lg border border-consent/30 bg-consent/5 p-2 text-center font-mono text-[11px] italic text-foreground/80">
                    I consent to govern this node.<br />
                    Power without proof is overclaim.
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* actions */}
            <div className="mt-5 flex items-center justify-between">
              <button
                onClick={() => { reset(); setStep(0); }}
                className="text-[10px] text-muted-foreground hover:text-foreground"
              >
                <RotateCcw size={11} className="mr-1 inline" />
                reset node
              </button>
              <Button
                onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
                className="bg-consent text-background hover:bg-consent/90"
              >
                {cur.action}
                {!isLast && <ChevronRight size={14} />}
              </Button>
            </div>

            {/* skip */}
            <button
              onClick={finish}
              className="absolute right-3 top-3 text-[10px] text-muted-foreground/60 hover:text-foreground"
            >
              skip →
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
