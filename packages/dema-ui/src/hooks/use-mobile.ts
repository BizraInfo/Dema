import * as React from "react"
import { createMediaQueryStore } from "@/lib/browser/mobile-media"

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

const mobileStore = createMediaQueryStore(
  (query: string) => window.matchMedia(query),
  MOBILE_QUERY
)

function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    mobileStore.subscribe,
    mobileStore.getSnapshot,
    getServerSnapshot
  )
}
