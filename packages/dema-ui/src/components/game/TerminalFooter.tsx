"use client";

import { useGame } from "@/lib/game/store";
import { TruthLabelBadge } from "./primitives";
import { cn } from "@/lib/utils";

export function TerminalFooter() {
  const readiness = useGame((s) => s.readiness());
  const overclaims = useGame((s) => s.overclaims);
  const ihsanStreak = useGame((s) => s.ihsanStreak);
  const receipts = useGame((s) => s.receipts.length);
  const diagnostics = useGame((s) => s.diagnostic.receipts.length);
  const violations = useGame((s) => s.diagnostic.authorityViolations);
  const inflight = useGame((s) => s.diagnostic.inflightFailures);
  const setScene = useGame((s) => s.setScene);

  return (
    <footer className="mt-auto border-t border-border/70 glass-strong">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-[10px] font-mono text-muted-foreground sm:px-4">
        <span className="flex items-center gap-1.5">
          <span className={cn("size-1.5 rounded-full", readiness === "READY_LOCAL" ? "bg-verified anim-pulse" : "bg-proof")} />
          node0://local
        </span>
        <span className="hidden sm:inline text-border">|</span>
        <span className="hidden sm:inline">readiness</span>
        <TruthLabelBadge label={readiness} size="xs" />
        <span className="hidden sm:inline text-border">|</span>
        <span className="hidden sm:inline">receipts · {receipts}</span>
        <span className="hidden sm:inline text-border">|</span>
        <span className="hidden sm:inline">diagnostics · {diagnostics}</span>
        {inflight > 0 && (
          <>
            <span className="hidden sm:inline text-border">|</span>
            <span className="text-consent">⚠ {inflight} frozen</span>
          </>
        )}
        {violations > 0 && (
          <>
            <span className="hidden sm:inline text-border">|</span>
            <span className="text-fail">⊗ {violations} violations</span>
          </>
        )}
        {ihsanStreak >= 2 && (
          <>
            <span className="hidden sm:inline text-border">|</span>
            <span className="text-consent">ihsān ×{ihsanStreak}</span>
          </>
        )}
        {overclaims > 0 && (
          <>
            <span className="hidden sm:inline text-border">|</span>
            <span className="text-fail">zann · {overclaims}</span>
          </>
        )}
        <span className="ml-auto hidden md:inline italic text-foreground/50">
          “A failure classification cannot increase system authority.”
        </span>
        <button
          onClick={() => setScene("diagnostics")}
          className="ml-auto rounded border border-fail/40 bg-fail/10 px-2 py-0.5 text-fail hover:bg-fail/20 md:ml-2"
        >
          ⚖ Doxology
        </button>
      </div>
    </footer>
  );
}
