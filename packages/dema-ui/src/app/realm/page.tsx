"use client";

import dynamic from "next/dynamic";

const GameShell = dynamic(
  () => import("@/components/game/GameShell").then((module) => module.GameShell),
  { ssr: false },
);
const SovereignBoot = dynamic(
  () => import("@/components/game/SovereignBoot").then((module) => module.SovereignBoot),
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
      <GameShell />
      <SovereignBoot />
    </>
  );
}
