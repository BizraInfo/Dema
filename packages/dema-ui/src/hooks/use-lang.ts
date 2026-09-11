"use client";

// Language preference for Dema's bilingual surfaces (EN / AR).
// Local-only: stored in localStorage, never transmitted.

import { useCallback, useSyncExternalStore } from "react";
import type { Lang } from "@/lib/lifecycle";

const KEY = "dema.lang";
const listeners = new Set<() => void>();

function readLang(): Lang {
  try {
    return window.localStorage.getItem(KEY) === "ar" ? "ar" : "en";
  } catch {
    return "en";
  }
}

function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) listener();
  };
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useLang(): [Lang, (l: Lang) => void] {
  const lang = useSyncExternalStore(subscribe, readLang, () => "en");

  const setLang = useCallback((l: Lang) => {
    try {
      window.localStorage.setItem(KEY, l);
    } catch {
      // ignore — preference simply won't persist
    }
    for (const listener of listeners) listener();
  }, []);

  return [lang, setLang];
}
