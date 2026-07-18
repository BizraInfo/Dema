"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "@/lib/game/store";
import {
  REVIEW_AGENTS,
  SAMPLE_PROMPTS,
  SIGNAL_ELEMENTS,
  NOISE_ELEMENTS,
  snrLabel,
} from "@/lib/game/melae";
import { COLOR_CLASS } from "@/lib/game/data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SceneHeader } from "./primitives";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  AlertTriangle,
  Lock,
  Wand2,
  Zap,
  Target,
  History,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-6 text-[10px]"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Copied to clipboard");
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check size={11} className="text-verified" /> : <Copy size={11} />}
      {label || "copy"}
    </Button>
  );
}

function SnrGauge({ snr, label, source }: { snr: number; label: string; source: string }) {
  const meta = snrLabel(snr);
  const c = COLOR_CLASS[meta.color];
  return (
    <div className={cn("rounded-lg border p-2.5", c.border, c.bg)}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-[9px] font-mono text-muted-foreground">{source}</span>
      </div>
      <div className="mt-1.5 flex items-end gap-1.5">
        <span className={cn("font-mono text-2xl font-bold leading-none", c.text)}>{Math.round(snr)}</span>
        <span className={cn("mb-0.5 text-[10px] font-mono uppercase", c.text)}>{meta.label}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
        <motion.div
          className={cn("h-full rounded-full", c.dot)}
          initial={{ width: 0 }}
          animate={{ width: `${snr}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export function MelaeForge() {
  const input = useGame((s) => s.melae.input);
  const loading = useGame((s) => s.melae.loading);
  const result = useGame((s) => s.melae.result);
  const error = useGame((s) => s.melae.error);
  const heuristicSnr = useGame((s) => s.melae.heuristicSnr);
  const history = useGame((s) => s.melae.history);
  const setInput = useGame((s) => s.setMelaeInput);
  const analyze = useGame((s) => s.analyzePrompt);
  const clear = useGame((s) => s.clearMelaeResult);
  const selectHistory = useGame((s) => s.selectFromHistory);

  const canAnalyze = input.trim().length >= 2 && !loading;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <SceneHeader
        title="MELAE v3.0 Forge"
        glyph="✦"
        accent="knowledge"
        subtitle="Master Expert Linguistic Autonomous Engine. Submit a prompt — receive SNR diagnostics, 3-agent peer review & an optimized variant. Powered by a real LLM on the backend."
        right={
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="rounded border border-proof/30 bg-proof/5 px-1.5 py-0.5 text-proof">
              REAL LLM
            </span>
            <span className="text-muted-foreground">{history.length} analyzed</span>
          </div>
        }
      />

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_1fr]">
        {/* LEFT: input + live SNR */}
        <div className="glass flex min-h-0 flex-col rounded-xl border border-border p-3">
          <div className="flex items-center justify-between pb-2">
            <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Input Prompt
            </h3>
            <span className="font-mono text-[10px] text-muted-foreground">
              {input.length} chars
            </span>
          </div>

          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste a prompt to analyze… e.g. 'Hey could you please write me a nice blog post about AI stuff and etc'"
            className="scroll-thin min-h-[100px] flex-1 resize-none border-border/60 bg-card/40 font-mono text-sm"
          />

          {/* sample gallery */}
          <div className="mt-2">
            <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
              sample gallery
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {SAMPLE_PROMPTS.map((sp) => (
                <button
                  key={sp.id}
                  onClick={() => setInput(sp.text)}
                  title={sp.desc}
                  className="flex items-center gap-1 rounded border border-border/60 bg-card/30 px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-knowledge/40 hover:text-knowledge"
                >
                  <span>{sp.glyph}</span>
                  {sp.label}
                </button>
              ))}
            </div>
          </div>

          {/* live heuristic SNR */}
          {heuristicSnr && (
            <div className="mt-2 space-y-1.5">
              <SnrGauge snr={heuristicSnr.snr} label="Live Heuristic SNR" source="LOCAL_ONLY · client" />
              <div className="grid grid-cols-2 gap-1.5">
                <div className="rounded-lg border border-border/60 bg-card/30 p-1.5">
                  <div className="text-[8px] font-mono uppercase text-verified">signal (+10×)</div>
                  {heuristicSnr.signal.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-[9px]">
                      <span className="truncate text-muted-foreground">{s.label}</span>
                      <span className="font-mono text-verified">{s.score}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-border/60 bg-card/30 p-1.5">
                  <div className="text-[8px] font-mono uppercase text-fail">noise (−5×)</div>
                  {heuristicSnr.noise.map((n) => (
                    <div key={n.id} className="flex items-center justify-between text-[9px]">
                      <span className="truncate text-muted-foreground">{n.label}</span>
                      <span className="font-mono text-fail">{n.score}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[8px] text-muted-foreground">
                Heuristic SNR = clamp((ΣSignal × 10) − (ΣNoise × 5), 0, 100). The LLM computes its own analytical SNR.
              </p>
            </div>
          )}

          <div className="mt-2 flex items-center gap-1.5">
            <Button
              onClick={() => analyze()}
              disabled={!canAnalyze}
              className="flex-1 bg-knowledge text-background hover:bg-knowledge/90"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              {loading ? "Analyzing…" : "Analyze & Optimize"}
            </Button>
            {result && (
              <Button size="sm" variant="ghost" onClick={clear}>
                clear
              </Button>
            )}
          </div>
        </div>

        {/* RIGHT: results */}
        <div className="glass scroll-thin min-h-0 overflow-y-auto rounded-xl border border-border p-3">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex h-full flex-col items-center justify-center gap-3"
              >
                <Loader2 size={28} className="animate-spin text-knowledge" />
                <p className="font-mono text-xs text-muted-foreground">
                  MELAE pipeline running…
                </p>
                <p className="text-[10px] text-muted-foreground">
                  classify → SNR → 3-agent review → optimize
                </p>
              </motion.div>
            ) : error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-3 py-6 text-center"
              >
                <div className="grid size-12 place-items-center rounded-full border-2 border-fail/40 bg-fail/10">
                  <AlertTriangle size={22} className="text-fail" />
                </div>
                <div>
                  <div className="font-mono text-sm font-bold text-fail">
                    {error.lens.toUpperCase()} FAILURE
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    DEMA-FDE · {error.class}
                  </div>
                </div>
                <p className="max-w-xs text-[11px] text-muted-foreground">{error.message}</p>
                {error.lens === "outward" && (
                  <div className="flex items-center gap-1 rounded border border-consent/40 bg-consent/5 px-2 py-1 text-[10px] font-mono text-consent">
                    <Lock size={10} /> Not laundered as success — doctrine holds.
                  </div>
                )}
              </motion.div>
            ) : result ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                {/* analytical SNR (LLM-computed) */}
                <SnrGauge
                  snr={result.analytical_diagnostics.initial_snr}
                  label="Analytical SNR (LLM)"
                  source="VERIFIED · model-computed"
                />

                {/* diagnostics */}
                <div className="rounded-lg border border-border/60 bg-card/30 p-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
                    <span className="rounded bg-knowledge/15 px-1.5 py-0.5 text-knowledge">
                      {result.analytical_diagnostics.input_class}
                    </span>
                    {result.analytical_diagnostics.ambiguity_flagged && (
                      <span className="flex items-center gap-1 rounded bg-fail/15 px-1.5 py-0.5 text-fail">
                        <AlertTriangle size={9} /> ambiguity &gt; 20%
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[11px] text-foreground/80">
                    <span className="text-muted-foreground">intent: </span>
                    {result.analytical_diagnostics.intent}
                  </p>
                  <p className="mt-1 text-[11px] text-foreground/80">
                    <span className="text-muted-foreground">refactor: </span>
                    {result.analytical_diagnostics.critical_refactor_opportunity}
                  </p>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    <div>
                      <div className="text-[8px] font-mono uppercase text-verified">top signal</div>
                      {result.analytical_diagnostics.top_signal_contributors.slice(0, 3).map((s) => (
                        <div key={s} className="text-[9px] text-muted-foreground">+ {s}</div>
                      ))}
                    </div>
                    <div>
                      <div className="text-[8px] font-mono uppercase text-fail">top noise</div>
                      {result.analytical_diagnostics.top_noise_contributors.slice(0, 3).map((s) => (
                        <div key={s} className="text-[9px] text-muted-foreground">− {s}</div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3-agent peer review */}
                <div>
                  <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                    Step 3 · Multi-Agent Cross-Pollination
                  </div>
                  <div className="mt-1 space-y-1">
                    {REVIEW_AGENTS.map((a) => {
                      const c = COLOR_CLASS[a.color];
                      const verdict =
                        a.id === "compiler"
                          ? result.peer_review.compiler
                          : a.id === "polymath"
                          ? result.peer_review.polymath
                          : result.peer_review.disrupter;
                      return (
                        <div key={a.id} className={cn("flex items-start gap-2 rounded-lg border p-2", c.border, c.bg)}>
                          <span className={cn("mt-0.5 text-base leading-none", c.text)}>{a.glyph}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <span className={cn("text-[10px] font-mono font-semibold", c.text)}>{a.name}</span>
                              <span className="text-[8px] text-muted-foreground">{a.role}</span>
                            </div>
                            <p className="mt-0.5 text-[10px] leading-snug text-foreground/80">{verdict}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* optimized prompt */}
                <div className="rounded-lg border border-knowledge/40 bg-knowledge/5 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-knowledge">
                      <Sparkles size={11} /> Optimized Prompt
                    </span>
                    <CopyButton text={result.optimized_prompt} />
                  </div>
                  <pre className="scroll-thin mt-1.5 max-h-40 overflow-y-auto whitespace-pre-wrap rounded bg-background/50 p-2 font-mono text-[11px] leading-relaxed text-foreground/90">
                    {result.optimized_prompt}
                  </pre>
                </div>

                {/* performance variants */}
                <div className="grid gap-1.5 sm:grid-cols-2">
                  <div className="rounded-lg border border-proof/30 bg-proof/5 p-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-[9px] font-mono uppercase text-proof">
                        <Target size={10} /> highest precision
                      </span>
                      <CopyButton text={result.performance_variants.highest_precision} />
                    </div>
                    <pre className="scroll-thin mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap font-mono text-[10px] leading-snug text-foreground/80">
                      {result.performance_variants.highest_precision}
                    </pre>
                  </div>
                  <div className="rounded-lg border border-snr/30 bg-snr/5 p-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-[9px] font-mono uppercase text-snr">
                        <Zap size={10} /> fastest execution
                      </span>
                      <CopyButton text={result.performance_variants.fastest_execution} />
                    </div>
                    <pre className="scroll-thin mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap font-mono text-[10px] leading-snug text-foreground/80">
                      {result.performance_variants.fastest_execution}
                    </pre>
                  </div>
                </div>

                {/* execution flags */}
                <div className="flex flex-wrap items-center gap-1">
                  {result.execution_flags.map((f) => (
                    <span key={f} className="flex items-center gap-0.5 rounded bg-verified/15 px-1.5 py-0.5 text-[9px] font-mono text-verified">
                      <Check size={9} /> {f}
                    </span>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex h-full flex-col items-center justify-center gap-3 text-center"
              >
                <Wand2 size={28} className="text-muted-foreground/40" />
                <p className="max-w-xs text-[11px] text-muted-foreground">
                  Paste a prompt on the left and hit <span className="text-knowledge">Analyze & Optimize</span> to run the full MELAE pipeline.
                </p>
                <p className="text-[10px] text-muted-foreground/70">
                  The LLM classifies your input, computes analytical SNR, runs the 3-agent peer review, and emits an optimized variant + two performance variants.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* history strip */}
      {history.length > 0 && (
        <div className="glass rounded-xl border border-border p-2">
          <div className="flex items-center gap-1.5 px-1 pb-1 text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
            <History size={11} /> History ({history.length})
          </div>
          <ScrollArea className="scroll-thin max-h-20">
            <div className="flex gap-1.5 px-1 pb-1">
              {history.map((h) => {
                const c = COLOR_CLASS[h.status === "ok" ? "verified" : "fail"];
                return (
                  <button
                    key={h.id}
                    onClick={() => selectHistory(h.id)}
                    className={cn("flex min-w-[140px] max-w-[200px] flex-col gap-0.5 rounded border p-1.5 text-left", c.border, c.bg)}
                  >
                    <div className="flex items-center gap-1">
                      <span className={cn("size-1.5 rounded-full", c.dot)} />
                      <span className="truncate text-[9px] font-mono text-foreground/80">
                        {h.input.slice(0, 30)}…
                      </span>
                    </div>
                    <span className="text-[8px] text-muted-foreground">
                      SNR {Math.round(h.heuristicSnr.snr)} · {h.status === "ok" ? `LLM ${h.result?.analytical_diagnostics.initial_snr ?? "?"}` : h.errorClass}
                    </span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
