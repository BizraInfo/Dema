"use client";

import { useState } from "react";
import { GameShell } from "@/components/game/GameShell";
import { SovereignBoot } from "@/components/game/SovereignBoot";
import { FirstRun, readFirstRun } from "@/components/dema/FirstRun";
import { useHydrated } from "@/hooks/use-hydrated";
import { useLang } from "@/hooks/use-lang";

export default function Home() {
  const hydrated = useHydrated();
  const [firstRunDone, setFirstRunDone] = useState(
    () => readFirstRun()?.completed ?? false,
  );
  const [lang, setLang] = useLang();

  if (!hydrated) return null;

  if (!firstRunDone) {
    return (
      <FirstRun
        lang={lang}
        setLang={setLang}
        onComplete={() => setFirstRunDone(true)}
      />
    );
  }

  return (
    <>
      <GameShell />
      <SovereignBoot />
    </>
  );
}
