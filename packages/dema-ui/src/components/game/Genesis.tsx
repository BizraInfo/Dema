"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useGame } from "@/lib/game/store";
import { COLOR_CLASS } from "@/lib/game/data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SceneHeader, StarRating } from "./primitives";
import {
  ScanLine,
  FileText,
  AlertOctagon,
  Lock,
  Check,
  Eye,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

interface Block0Component {
  id: string;
  name: string;
  state: "healthy" | "degraded" | "unverified";
  detail: string;
  blast: "low" | "medium" | "high";
}

const COMPONENTS: Block0Component[] = [
  { id: "b1", name: "lifecycle.manifest", state: "healthy", detail: "Manifest hash stable. Components enumerated.", blast: "low" },
  { id: "b2", name: "identity.seal", state: "unverified", detail: "Seal not bound. Requires exact consent to seal.", blast: "high" },
  { id: "b3", name: "daemon.runtime", state: "degraded", detail: "Daemon in preview mode. No autonomous execution.", blast: "medium" },
  { id: "b4", name: "federation.bridge", state: "unverified", detail: "No live federation. Designed, not runtime.", blast: "high" },
  { id: "b5", name: "token.economy", state: "unverified", detail: "No wallet/mint. Impact tokens are PREVIEW_ONLY.", blast: "high" },
  { id: "b6", name: "local.model", state: "healthy", detail: "Local model adapter bound. Ready within budget.", blast: "low" },
];

export function Genesis() {
  const spend = useGame((s) => s.spendResources);
  const awardXp = useGame((s) => s.awardXp);
  const addResource = useGame((s) => s.addResource);
  const completeMission = useGame((s) => s.completeMission);
  const completed = useGame((s) => s.completedMissions.genesisScope);

  const [inspected, setInspected] = useState<Record<string, boolean>>({});
  const [scoped, setScoped] = useState(false);
  const [triedSeal, setTriedSeal] = useState(false);

  const inspect = (id: string) => {
    setInspected((s) => ({ ...s, [id]: true }));
    toast.success("Component inspected", { description: COMPONENTS.find((c) => c.id === id)!.name });
  };

  const closeScope = () => {
    if (Object.keys(inspected).length < COMPONENTS.length) {
      toast.error("Inspect all components first", { description: "Close-scope requires full inspection." });
      return;
    }
    if (!spend({ consentKeys: 1 })) {
      toast.error("Need 1 Consent Key to close scope");
      return;
    }
    setScoped(true);
    awardXp("genesisArchitect", 35);
    addResource("trustScore", 5);
    completeMission("genesisScope", 5);
    toast.success("Close-scope report filed 📄", { description: "Genesis remains UNSEALED by doctrine." });
  };

  const attemptSeal = () => {
    setTriedSeal(true);
    toast.error("Seal blocked — FAIL_CLOSED", {
      description: "Sealing Genesis requires explicit per-action consent. Inspect & close-scope only.",
    });
  };

  const blastColor = (b: Block0Component["blast"]) =>
    b === "high" ? "fail" : b === "medium" ? "consent" : "verified";

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <SceneHeader
        title="Genesis Close Scope"
        glyph="🌱"
        accent="consent"
        subtitle="Mission 7 · Genesis Architect. Inspect Block0 components, trace blast radius & file a close-scope report — without sealing."
        right={completed ? <StarRating value={completed.stars} /> : undefined}
      />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_300px]">
        {/* components */}
        <div className="glass scroll-thin overflow-y-auto rounded-xl border border-border p-3">
          <div className="flex items-center justify-between px-1 pb-2">
            <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Block0 Components</h3>
            <span className="font-mono text-[11px] text-consent">{Object.keys(inspected).length}/{COMPONENTS.length} inspected</span>
          </div>
          <div className="space-y-2">
            {COMPONENTS.map((c) => {
              const isInspected = inspected[c.id];
              const sc = COLOR_CLASS[c.state === "healthy" ? "verified" : c.state === "degraded" ? "consent" : "unknown"];
              const bc = COLOR_CLASS[blastColor(c.blast)];
              return (
                <div
                  key={c.id}
                  className={cn(
                    "rounded-lg border p-2.5 transition-all",
                    isInspected ? cn(sc.border, sc.bg) : "border-border/60 bg-card/30"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("grid size-7 place-items-center rounded-md border font-mono text-xs", sc.border, sc.text)}>
                      {isInspected ? <Check size={13} /> : <Eye size={13} />}
                    </span>
                    <span className="font-mono text-xs font-semibold text-foreground flex-1 truncate">{c.name}</span>
                    <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-mono uppercase", bc.bg, bc.text)}>
                      blast · {c.blast}
                    </span>
                    {!isInspected && (
                      <Button size="sm" variant="outline" onClick={() => inspect(c.id)}>
                        <ScanLine size={12} /> Inspect
                      </Button>
                    )}
                  </div>
                  {isInspected && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-1.5 overflow-hidden text-[11px] text-muted-foreground"
                    >
                      <span className={cn("uppercase font-mono", sc.text)}>{c.state}</span> · {c.detail}
                    </motion.p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* scope panel */}
        <div className="flex flex-col gap-3">
          <div className="glass rounded-xl border border-border p-3">
            <h3 className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <FileText size={13} /> Close-Scope Report
            </h3>
            <div className="mt-2 space-y-1.5 text-[11px]">
              <div className="flex justify-between"><span className="text-muted-foreground">Components</span><span className="font-mono text-foreground">{Object.keys(inspected).length}/{COMPONENTS.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">High-blast</span><span className="font-mono text-fail">{COMPONENTS.filter((c) => c.blast === "high").length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Sealed</span><span className="font-mono text-verified">0 (doctrine)</span></div>
            </div>
            <Button onClick={closeScope} disabled={scoped} className="mt-3 w-full bg-consent text-background hover:bg-consent/90">
              <FileText size={14} /> File Close-Scope (1 key)
            </Button>
            {scoped && (
              <p className="mt-2 text-center text-[11px] text-verified">✓ Scope closed · Genesis unsealed</p>
            )}
          </div>

          <div className="glass rounded-xl border border-fail/30 p-3">
            <h3 className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.18em] text-fail">
              <ShieldAlert size={13} /> Sealed Boundary
            </h3>
            <p className="mt-1.5 text-[11px] text-muted-foreground leading-snug">
              Genesis cannot be sealed without explicit per-action consent. Attempting to seal fails closed.
            </p>
            <Button onClick={attemptSeal} variant="outline" className="mt-2 w-full border-fail/40 text-fail hover:bg-fail/10">
              <Lock size={13} /> Attempt Seal (blocked)
            </Button>
            {triedSeal && (
              <p className="mt-2 flex items-center gap-1 text-[11px] text-fail">
                <AlertOctagon size={12} /> FAIL_CLOSED · seal requires consent
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
