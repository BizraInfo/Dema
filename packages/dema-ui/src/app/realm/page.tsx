"use client";

import { useEffect, useState } from "react";
import { GameShell } from "@/components/game/GameShell";
import { SovereignBoot } from "@/components/game/SovereignBoot";

/**
 * The spatial / cinematic surface, preserved verbatim from the previous root route.
 * It was not discarded — it moved below the mission front door. A stranger meets
 * the mission first; this is a deeper layer they reach after value, not before it.
 */
export default function Realm() {
  const [genesis, setGenesis] = useState<{
    truth_label: string;
    dema: { status: string; mission_id?: string; receipt_hash?: string };
    pat: { status: string; count: number };
    sat: { status: string; inventory: Array<{ role_id: string; verdict: string }> };
    world_cell: { effect_count: number; duplicate_effects: number; recovery_status: string };
  } | null>(null);
  useEffect(() => {
    fetch("/api/genesis-realm-status", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then(setGenesis)
      .catch(() => setGenesis(null));
  }, []);
  return (
    <>
      {genesis && <div className="fixed inset-x-4 top-4 z-50 mx-auto max-w-4xl rounded-lg border border-teal/50 bg-background/95 px-4 py-3 font-mono text-xs text-foreground shadow-lg backdrop-blur">
        <div className="text-teal">GENESIS WORLD-CELL · {genesis.truth_label}</div>
        <div className="mt-1 grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
          <span>DEMA {genesis.dema.status}</span>
          <span>PAT {genesis.pat.count}/7 · {genesis.pat.status}</span>
          <span>SAT {genesis.sat.inventory.length}/5 · {genesis.sat.status}</span>
          <span>effect {genesis.world_cell.effect_count} · duplicates {genesis.world_cell.duplicate_effects}</span>
        </div>
        <div className="mt-1 text-muted-foreground">mission {genesis.dema.mission_id} · receipt {genesis.dema.receipt_hash}</div>
      </div>}
      <GameShell />
      <SovereignBoot />
    </>
  );
}
