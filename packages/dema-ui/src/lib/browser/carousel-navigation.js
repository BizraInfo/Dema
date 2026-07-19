export function subscribeCarouselNavigation(api, onStoreChange) {
  if (!api) return () => {};
  api.on("reInit", onStoreChange);
  api.on("select", onStoreChange);
  return () => {
    api.off("reInit", onStoreChange);
    api.off("select", onStoreChange);
  };
}

export function getCarouselNavigationSnapshot(api) {
  if (!api) return 0;
  return (api.canScrollPrev() ? 1 : 0) | (api.canScrollNext() ? 2 : 0);
}
