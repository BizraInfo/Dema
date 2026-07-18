"use client";

import { useGame } from "@/lib/game/store";
import { COLOR_CLASS, RESOURCE_META } from "@/lib/game/data";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Compass,
  LayoutGrid,
  ListChecks,
  Map as MapIcon,
  Menu,
  Users,
  Cpu,
  Sparkles,
  ShieldAlert,
  Wand2,
} from "lucide-react";
import { TruthLabelBadge } from "./primitives";
import { useLang } from "@/hooks/use-lang";
import type { SceneId } from "@/lib/game/types";

const MODE_TABS: { id: SceneId; label: string; icon: React.ElementType }[] = [
  { id: "corridor", label: "Corridor", icon: Compass },
  { id: "world", label: "World", icon: MapIcon },
  { id: "ecosystem", label: "Ecosystem", icon: Sparkles },
  { id: "melae", label: "MELAE", icon: Wand2 },
  { id: "diagnostics", label: "Doxology", icon: ShieldAlert },
  { id: "nodeStatus", label: "Node", icon: Cpu },
  { id: "codex", label: "Codex", icon: BookOpen },
];

export function GameHeader({
  onToggleAgents,
  onToggleMissions,
}: {
  onToggleAgents: () => void;
  onToggleMissions: () => void;
}) {
  const resources = useGame((s) => s.resources);
  const readiness = useGame((s) => s.readiness());
  const currentScene = useGame((s) => s.currentScene);
  const setScene = useGame((s) => s.setScene);
  const overclaims = useGame((s) => s.overclaims);
  const ihsanStreak = useGame((s) => s.ihsanStreak);
  const [lang, setLang] = useLang();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 glass-strong">
      <div className="flex items-center gap-3 px-3 py-2 sm:px-4">
        {/* logo / title */}
        <button
          onClick={() => setScene("corridor")}
          className="flex items-center gap-2.5 shrink-0 group"
        >
          <span className="relative grid size-9 place-items-center rounded-lg border border-consent/40 bg-consent/10 text-consent anim-pulse">
            <span className="font-mono text-lg leading-none">⬡</span>
          </span>
          <span className="hidden sm:flex flex-col leading-tight text-left">
            <span className="font-serif text-base font-bold tracking-[0.3em] text-gold-light">
              DEMA
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              BIZRA Node0 · Sovereign Proofworld
            </span>
          </span>
        </button>

        <div className="h-7 w-px bg-border/70 hidden sm:block" />

        {/* readiness */}
        <TruthLabelBadge label={readiness} />

        {/* resource strip */}
        <div className="scroll-thin -mx-1 flex flex-1 items-center gap-1.5 overflow-x-auto px-1 py-0.5">
          {RESOURCE_META.map((r) => {
            const val = resources[r.key as keyof typeof resources];
            const c = COLOR_CLASS[r.color];
            return (
              <div
                key={r.key}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md border border-border/60 bg-card/40 px-2 py-1",
                  r.preview && "ring-1 ring-consent/20"
                )}
                title={r.label + (r.preview ? " (PREVIEW_ONLY)" : "")}
              >
                <span className={cn("text-xs leading-none", c.text)}>{r.glyph}</span>
                <span className="font-mono text-xs tabular-nums text-foreground">
                  {Math.round(val)}
                </span>
                <span className="hidden xl:inline text-[10px] uppercase tracking-wider text-muted-foreground">
                  {r.label}
                </span>
                {r.preview && (
                  <span className="hidden 2xl:inline text-[9px] text-consent/70">PREV</span>
                )}
              </div>
            );
          })}
        </div>

        {/* streak / overclaim indicators */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          {ihsanStreak >= 2 && (
            <span className="flex items-center gap-1 rounded-md border border-consent/40 bg-consent/10 px-2 py-1 text-[11px] font-mono text-consent">
              ✦ Ihsān ×{ihsanStreak}
            </span>
          )}
          {overclaims > 0 && (
            <span className="flex items-center gap-1 rounded-md border border-fail/40 bg-fail/10 px-2 py-1 text-[11px] font-mono text-fail">
              ⚠ ZANN {overclaims}
            </span>
          )}
        </div>

        {/* language toggle */}
        <button
          onClick={() => setLang(lang === "ar" ? "en" : "ar")}
          className="hidden sm:grid size-8 shrink-0 place-items-center rounded-md border border-border/60 bg-card/40 font-mono text-[11px] text-muted-foreground hover:text-gold-light"
          aria-label="Toggle language"
          title={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
        >
          {lang === "ar" ? "EN" : "ع"}
        </button>

        {/* mobile toggles */}
        <div className="flex items-center gap-1 lg:hidden shrink-0">
          <button
            onClick={onToggleAgents}
            className="grid size-8 place-items-center rounded-md border border-border/60 bg-card/40 text-muted-foreground hover:text-foreground"
            aria-label="Agents"
          >
            <Users size={15} />
          </button>
          <button
            onClick={onToggleMissions}
            className="grid size-8 place-items-center rounded-md border border-border/60 bg-card/40 text-muted-foreground hover:text-foreground"
            aria-label="Missions"
          >
            <ListChecks size={15} />
          </button>
        </div>
      </div>

      {/* nav strip */}
      <div className="flex items-center gap-1 px-3 pb-1.5 sm:px-4">
        {currentScene !== "corridor" && !MODE_TABS.some((t) => t.id === currentScene) && (
          <button
            onClick={() => setScene("corridor")}
            className="flex items-center gap-1 rounded-md border border-border/60 bg-card/40 px-2 py-1 text-[11px] font-mono text-muted-foreground hover:text-proof"
          >
            <LayoutGrid size={12} /> ← Corridor
          </button>
        )}
        {MODE_TABS.map((t) => {
          const active = currentScene === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setScene(t.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider transition-colors",
                active
                  ? "bg-proof/15 text-proof border border-proof/40"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              )}
            >
              <t.icon size={12} />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
        <span className="ml-auto text-[10px] font-mono text-muted-foreground/70 hidden sm:inline">
          trace · web-cad0b18f
        </span>
      </div>
    </header>
  );
}
