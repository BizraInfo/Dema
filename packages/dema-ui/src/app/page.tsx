"use client";

import { useEffect, useState } from "react";
import { GameShell } from "@/components/game/GameShell";
import { SovereignBoot } from "@/components/game/SovereignBoot";
import { FirstRun, readFirstRun } from "@/components/dema/FirstRun";
import { useLang } from "@/hooks/use-lang";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [firstRunDone, setFirstRunDone] = useState(true);
  const [lang, setLang] = useLang();

  useEffect(() => {
    setFirstRunDone(readFirstRun()?.completed ?? false);
    setMounted(true);
  }, []);

  if (!mounted) return null;

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
