export function createMediaQueryStore(matchMedia, query) {
  return Object.freeze({
    subscribe(onStoreChange) {
      const media = matchMedia(query);
      media.addEventListener("change", onStoreChange);
      return () => media.removeEventListener("change", onStoreChange);
    },
    getSnapshot() {
      return matchMedia(query).matches;
    },
  });
}
