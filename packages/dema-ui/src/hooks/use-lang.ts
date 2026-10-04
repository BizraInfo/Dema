"use client";

// Language preference for Dema's bilingual surfaces (EN / AR).
// Local-only: stored in localStorage, never transmitted.

import { useSyncExternalStore } from "react";
import type { Lang } from "@/lib/lifecycle";

const KEY = "dema.lang";
const listeners = new Set<() => void>();
let volatileLang: Lang = "en";
let memoryOnly = false;

function getSnapshot(): Lang {
  if (memoryOnly) return volatileLang;
  try {
    const stored = window.localStorage.getItem(KEY);
    return stored === "ar" ? "ar" : "en";
  } catch {
    return volatileLang;
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) {
      memoryOnly = false;
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function setLang(lang: Lang) {
  volatileLang = lang;
  try {
    window.localStorage.setItem(KEY, lang);
    memoryOnly = false;
  } catch {
    // The local preference still works when persistence is unavailable.
    memoryOnly = true;
  }
  for (const listener of listeners) listener();
}

const getServerSnapshot = (): Lang => "en";

export function useLang(): [Lang, (l: Lang) => void] {
  return [useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot), setLang];
}
