"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { useGame } from "@/lib/game/store";
import { AGENTS } from "@/lib/game/data";

const KEY = "bizra_node0_intro_seen";

export function IntroOverlay() {
  const [open, setOpen] = useState(false);
  const reset = useGame((s) => s.reset);

  useEffect(() => {
    let seen = false;
    try {
      seen = !!localStorage.getItem(KEY);
    } catch {
      seen = false;
    }
    if (!seen) {
      // defer to avoid synchronous setState-in-effect cascading render
      const t = setTimeout(() => setOpen(true), 0);
      return () => clearTimeout(t);
    }
  }, []);

  const close = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && close()}>
      <AlertDialogContent className="glass-strong max-w-lg border-consent/40">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 font-mono text-lg">
            <span className="text-consent">⬡</span> BIZRA Node0 · Sovereign Proofworld
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 text-left text-muted-foreground">
            <span className="block">
              You are the <span className="text-consent">Human Sovereign Node Operator</span>. Your
              device is a living node. Grow it from an unbound local machine into a healthy{" "}
              <span className="text-verified">READY_LOCAL</span> proof node — without overclaiming.
            </span>
            <span className="block">
              Command <span className="text-knowledge">{AGENTS.length} agents</span>. Mine data, spend compute,
              bind claims to evidence, pass consent gates, forge receipts, run CI raids, and inspect
              Genesis. Every action respects proof, consent, and truth labels.
            </span>
            <span className="block rounded-lg border border-fail/30 bg-fail/5 p-2 text-[12px] text-fail/90">
              Hard rule: never represent design-only systems as live. Federation, token economy &
              autonomy remain locked until proven.
            </span>
            <span className="block font-mono text-[11px] italic text-foreground/60">
              “Power without proof is overclaim. Autonomy without consent is violation.”
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <button
            onClick={() => {
              reset();
              close();
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            reset node
          </button>
          <AlertDialogAction onClick={close} className="bg-consent text-background hover:bg-consent/90">
            Enter Node0 →
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
