"use client";

// Language preference for Dema's bilingual surfaces (EN / AR).
// Local-only: stored in localStorage, never transmitted.

import { useCallback, useState } from "react";
import type { Lang } from "@/lib/lifecycle";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  readStoredLang,
  writeStoredLang,
} from "@/lib/browser/lang-preference";

export function useLang(): [Lang, (l: Lang) => void] {
  const hydrated = useHydrated();
  const [lang, setLangState] = useState<Lang>(readStoredLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    writeStoredLang(undefined, l);
  }, []);

  return [hydrated ? lang : "en", setLang];
}
