"use client";

// Language preference for Dema's bilingual surfaces (EN / AR).
// Local-only: stored in localStorage, never transmitted.

import { useCallback, useEffect, useState } from "react";
import type { Lang } from "@/lib/lifecycle";

const KEY = "dema.lang";

export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(KEY);
      if (stored === "ar" || stored === "en") setLangState(stored);
    } catch {
      // storage unavailable — stay with default, fail open to EN
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(KEY, l);
    } catch {
      // ignore — preference simply won't persist
    }
  }, []);

  return [lang, setLang];
}
