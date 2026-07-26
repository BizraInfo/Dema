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
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <>
      <GameShell />
      <SovereignBoot />
    </>
  );
}
