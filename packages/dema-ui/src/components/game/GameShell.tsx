"use client";

import { useEffect, useState } from "react";
import { GameHeader } from "./GameHeader";
import { MissionPanel } from "./MissionPanel";
import { AgentPanel } from "./AgentPanel";
import { StageRouter } from "./StageRouter";
import { useGame } from "@/lib/game/store";
import { useCompanionJson } from "@/lib/companion/use-companion";
import { TerminalFooter } from "./TerminalFooter";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

function ReceiptStandingBridge() {
  const hydrate = useGame((s) => s.hydrateReceiptStanding);
  const { data, status } = useCompanionJson<{
    truth_label?: string;
    xp?: number | null;
    reason?: string | null;
    receipts?: Array<{ receipt_id?: string }>;
  }>("/api/companion/standing");

  useEffect(() => {
    if (status === "error") hydrate({ truth_label: "UNKNOWN", reason: "standing_unavailable", xp: null, receipts: [] });
    if (status === "ok" && data) hydrate(data);
  }, [status, data, hydrate]);

  return null;
}

export function GameShell() {
  const [missionsOpen, setMissionsOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <ReceiptStandingBridge />
      <GameHeader
        onToggleMissions={() => setMissionsOpen(true)}
      />

      <div className="flex min-h-0 flex-1">
        {/* center: stage */}
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-2 sm:p-3">
          <div className="flex min-h-0 flex-1 flex-col">
            <StageRouter />
          </div>
        </main>

        {/* right: missions & receipts (desktop) */}
        <aside className="hidden w-[320px] shrink-0 flex-col gap-2 border-l border-border/70 p-2 xl:flex">
          <div className="min-h-0 flex-1">
            <AgentPanel />
          </div>
          <div className="min-h-0 flex-1">
            <MissionPanel />
          </div>
        </aside>
      </div>

      <TerminalFooter />

      <Sheet open={missionsOpen} onOpenChange={setMissionsOpen}>
        <SheetContent side="right" className="w-[320px] p-2 glass-strong border-border">
          <SheetHeader className="px-1">
            <SheetTitle className="font-mono text-sm tracking-wider">Missions & Receipts</SheetTitle>
          </SheetHeader>
          <div className="flex h-[calc(100%-3rem)] flex-col gap-2">
            <div className="min-h-0 flex-1">
              <AgentPanel asSheet />
            </div>
            <div className="min-h-0 flex-1">
              <MissionPanel asSheet />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
