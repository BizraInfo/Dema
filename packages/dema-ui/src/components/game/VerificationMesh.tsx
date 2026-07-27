"use client";

import { useGame } from "@/lib/game/store";
import { VERIFICATION_RAILS, ORG_AGENTS } from "@/lib/game/ecosystem";
import { COLOR_CLASS } from "@/lib/game/data";
import { cn } from "@/lib/utils";
import { Panel } from "./primitives";
import { Button } from "@/components/ui/button";
import { Check, X, GitBranch, ShieldCheck, Lock } from "lucide-react";
import { toast } from "sonner";

export function VerificationMesh() {
  const selectedId = useGame((s) => s.office.selectedProposal);
  const proposal = useGame((s) =>
    selectedId ? s.office.proposals.find((p) => p.id === selectedId) : null
  );
  const verifyRail = useGame((s) => s.verifyRail);
  const approve = useGame((s) => s.approveProposal);
  const reject = useGame((s) => s.rejectProposal);
  const fork = useGame((s) => s.forkProposal);

  if (!proposal) {
    return (
      <Panel title="Verification Mesh" glyph="⛓" accent="proof" truth="DESIGNED_NOT_LIVE" bodyClassName="p-3">
        <div className="flex flex-col items-center gap-2 py-6 text-center text-[11px] text-muted-foreground">
          <ShieldCheck size={22} className="opacity-40" />
          Select a proposal in the Evolution Graph to inspect its verification rails.
        </div>
      </Panel>
    );
  }

  const requiredMet = VERIFICATION_RAILS.filter((r) => r.required).every(
    (r) => proposal.rails[r.id]
  );

  return (
    <Panel
      title="Verification Mesh"
      glyph="⛓"
      accent="proof"
      truth="DESIGNED_NOT_LIVE"
      right={
        <span className="font-mono text-[10px] text-muted-foreground">
          {Object.values(proposal.rails).filter(Boolean).length}/{VERIFICATION_RAILS.length}
        </span>
      }
      bodyClassName="p-3 space-y-2"
    >
      <div className="rounded-lg border border-border/60 bg-card/30 p-2">
        <div className="flex items-center gap-1.5">
          <GitBranch size={12} className="text-knowledge" />
          <span className="flex-1 truncate text-[11px] font-medium text-foreground">
            {proposal.title}
          </span>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 font-mono text-[9px] uppercase",
              proposal.status === "integrated"
                ? "bg-consent/15 text-consent"
                : proposal.status === "verified"
                ? "bg-verified/15 text-verified"
                : proposal.status === "rejected"
                ? "bg-fail/15 text-fail"
                : "bg-unknown/15 text-unknown"
            )}
          >
            {proposal.status}
          </span>
        </div>
        {proposal.parentId && (
          <div className="mt-0.5 text-[9px] font-mono text-knowledge">
            ⑂ forked lineage
          </div>
        )}
      </div>

      {/* rails grid */}
      <div className="grid grid-cols-2 gap-1.5">
        {VERIFICATION_RAILS.map((r) => {
          const passed = !!proposal.rails[r.id];
          const c = COLOR_CLASS[r.color];
          const ag = ORG_AGENTS.find((a) => a.id === r.agent);
          return (
            <button
              key={r.id}
              onClick={() => !passed && verifyRail(proposal.id, r.id)}
              disabled={passed || proposal.status === "integrated" || proposal.status === "rejected"}
              className={cn(
                "group flex items-center gap-1.5 rounded-lg border p-1.5 text-left transition-all disabled:cursor-default",
                passed ? cn(c.border, c.bg) : "border-border/60 bg-card/30 hover:border-proof/40"
              )}
              title={r.desc}
            >
              <span
                className={cn(
                  "grid size-4 shrink-0 place-items-center rounded-full",
                  passed ? c.dot + " text-background" : "border border-border"
                )}
              >
                {passed && <Check size={9} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className={cn("truncate text-[10px] font-mono", passed ? c.text : "text-muted-foreground")}>
                  {r.name}
                </div>
                <div className="flex items-center gap-0.5 text-[8px] text-muted-foreground">
                  <span>{ag?.glyph}</span>
                  {r.required && <span className="text-fail">●req</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* actions */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <Button
          size="sm"
          onClick={() => {
            approve(proposal.id);
            toast.success("Proposal integrated", { description: `${proposal.title} → receipt sealed` });
          }}
          disabled={proposal.status !== "verified"}
          className="bg-consent text-background hover:bg-consent/90 h-7"
        >
          <ShieldCheck size={12} /> Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            reject(proposal.id);
            toast.error("Proposal rejected");
          }}
          disabled={proposal.status === "integrated" || proposal.status === "rejected"}
          className="border-fail/40 text-fail hover:bg-fail/10 h-7"
        >
          <X size={12} /> Reject
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            fork(proposal.id);
            toast("Proposal forked", { description: "Time-travel copy created for re-verification" });
          }}
          className="h-7"
        >
          <GitBranch size={12} /> Fork
        </Button>
        {proposal.status === "pending" && !requiredMet && (
          <span className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground">
            <Lock size={9} /> approve locked · rails incomplete
          </span>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Fork = time-travel debugging: copy a proposal's rail state and re-verify from any point.
      </p>
    </Panel>
  );
}
