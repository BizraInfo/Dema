"use client";

import { useState } from "react";
import { GameHeader } from "./GameHeader";
import { MissionPanel } from "./MissionPanel";
import { StageRouter } from "./StageRouter";
import { TerminalFooter } from "./TerminalFooter";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function GameShell() {
  const [missionsOpen, setMissionsOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
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
        <aside className="hidden w-[320px] shrink-0 border-l border-border/70 p-2 xl:block">
          <div className="h-full">
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
          <div className="h-[calc(100%-3rem)]">
            <MissionPanel asSheet />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
