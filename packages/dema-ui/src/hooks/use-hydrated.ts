"use client";

import { useSyncExternalStore } from "react";
import {
  getClientHydrationSnapshot,
  getServerHydrationSnapshot,
  subscribeHydration,
} from "@/lib/browser/hydration-store";

export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );
}
