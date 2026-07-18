"use client";

import { useGame } from "@/lib/game/store";
import { COLOR_CLASS, RESOURCE_META, ZONES, AGENTS, RAIL_META } from "@/lib/game/data";
import { cn } from "@/lib/utils";
import { SceneHeader, TruthLabelBadge, StatBar } from "./primitives";
import { ProofRailDashboard } from "./ProofRailDashboard";
import { RealResources } from "./RealResources";

export function NodeStatus() {
  const resources = useGame((s) => s.resources);
  const rails = useGame((s) => s.rails);
  const receipts = useGame((s) => s.receipts);
  const agents = useGame((s) => s.agents);
  const overclaims = useGame((s) => s.overclaims);
  const consentMistakes = useGame((s) => s.consentMistakes);
  const completed = useGame((s) => s.completedMissions);
  const readiness = useGame((s) => s.readiness());
  const bestStreak = useGame((s) => s.bestIhsanStreak);
  const setScene = useGame((s) => s.setScene);
  const selectZone = useGame((s) => s.selectZone);

  const missionCount = Object.keys(completed).length;
  const totalStars = Object.values(completed).reduce((a, m) => a + m.stars, 0);
  const litRails = RAIL_META.filter((r) => rails[r.key]).length;

  return (
    <div className="scroll-thin flex h-full min-h-0 flex-col gap-4 overflow-y-auto">
      <SceneHeader
        title="Node Status · CURRENT_LIMITS"
        glyph="⬡"
        accent="consent"
        subtitle="The truth map of your Human Node. Everything is labeled by its real proof state — never by aspiration."
        right={<TruthLabelBadge label={readiness} />}
      />

      {/* top metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Trust Score", val: Math.round(resources.trustScore), color: "verified", icon: "★" },
          { label: "Node Health", val: Math.round(resources.nodeHealth), color: "verified", icon: "♥" },
          { label: "Proof Rails", val: `${litRails}/4`, color: "proof", icon: "△" },
          { label: "Receipts", val: receipts.length, color: "proof", icon: "🔮" },
        ].map((m) => {
          const c = COLOR_CLASS[m.color as keyof typeof COLOR_CLASS];
          return (
            <div key={m.label} className="glass rounded-xl border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{m.label}</span>
                <span className={cn("text-sm", c.text)}>{m.icon}</span>
              </div>
              <div className={cn("mt-1 font-mono text-2xl font-bold", c.text)}>{m.val}</div>
              {typeof m.val === "number" && m.val <= 100 && (m.label === "Trust Score" || m.label === "Node Health") && (
                <StatBar value={m.val} color={m.color as keyof typeof COLOR_CLASS} className="mt-1.5" />
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* zone truth map */}
        <div className="glass rounded-xl border border-border p-3">
          <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Zone Truth Map</h3>
          <div className="mt-2 space-y-1.5">
            {ZONES.map((z) => {
              const c = COLOR_CLASS[z.color];
              const agent = AGENTS.find((a) => a.id === z.agent)!;
              return (
                <button
                  key={z.id}
                  onClick={() => {
                    if (!z.locked) {
                      selectZone(z.id);
                      if (z.scene) setScene(z.scene);
                    }
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border border-border/60 bg-card/30 p-2 text-left transition-colors hover:bg-card/60",
                    z.locked && "cursor-not-allowed opacity-60"
                  )}
                >
                  <span className={cn("grid size-7 place-items-center rounded-md border font-mono", c.border, c.bg, c.text)}>{z.locked ? "🔒" : z.glyph}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-xs text-foreground">{z.name}</div>
                    <div className="truncate text-[10px] text-muted-foreground">{agent.name}</div>
                  </div>
                  <TruthLabelBadge label={z.truthLabel} size="xs" />
                </button>
              );
            })}
          </div>
        </div>

        {/* right column */}
        <div className="flex flex-col gap-4">
          <RealResources />

          <ProofRailDashboard compact />

          {/* integrity */}
          <div className="glass rounded-xl border border-border p-3">
            <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Integrity Ledger</h3>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-border/60 bg-card/30 p-2">
                <div className="text-[10px] uppercase text-muted-foreground">Overclaims</div>
                <div className={cn("font-mono text-lg font-bold", overclaims > 0 ? "text-fail" : "text-verified")}>{overclaims}</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/30 p-2">
                <div className="text-[10px] uppercase text-muted-foreground">Consent Mistakes</div>
                <div className={cn("font-mono text-lg font-bold", consentMistakes > 0 ? "text-fail" : "text-verified")}>{consentMistakes}</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/30 p-2">
                <div className="text-[10px] uppercase text-muted-foreground">Ihsān Best Streak</div>
                <div className="font-mono text-lg font-bold text-consent">{bestStreak}</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/30 p-2">
                <div className="text-[10px] uppercase text-muted-foreground">Missions / Stars</div>
                <div className="font-mono text-lg font-bold text-proof">{missionCount} / {totalStars}★</div>
              </div>
            </div>
          </div>

          {/* resources */}
          <div className="glass rounded-xl border border-border p-3">
            <h3 className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Mission Resources ⁽ᵍᵃᵐᵉ⁾</h3>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
              {RESOURCE_META.map((r) => {
                const c = COLOR_CLASS[r.color];
                const val = resources[r.key as keyof typeof resources];
                return (
                  <div key={r.key} className="flex items-center gap-1.5">
                    <span className={cn("text-xs", c.text)}>{r.glyph}</span>
                    <span className="font-mono text-xs tabular-nums text-foreground">{Math.round(val)}</span>
                    <span className="text-[9px] uppercase text-muted-foreground truncate">{r.label}{r.preview ? "⁽ᵖ⁾" : ""}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
