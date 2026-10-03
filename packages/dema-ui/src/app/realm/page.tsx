"use client";

import dynamic from "next/dynamic";
import { NowSurface } from "@/components/situation/NowSurface";

const GameShell = dynamic(
  () => import("@/components/game/GameShell").then((module) => module.GameShell),
  { ssr: false },
);

/**
 * The spatial / cinematic surface, preserved verbatim from the previous root route.
 * It was not discarded — it moved below the mission front door. A stranger meets
 * the mission first; this is a deeper layer they reach after value, not before it.
 */
export default function Realm() {
  return (
    <>
      <NowSurface />
      <GameShell />
    </>
  );
}
