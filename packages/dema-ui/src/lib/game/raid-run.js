export function createRaidRun() {
  const controller = new AbortController();

  return Object.freeze({
    get cancelled() {
      return controller.signal.aborted;
    },
    cancel() {
      controller.abort();
    },
    wait(delayMs) {
      return new Promise((resolve) => {
        if (controller.signal.aborted) {
          resolve(false);
          return;
        }

        const onAbort = () => {
          clearTimeout(timer);
          resolve(false);
        };
        const timer = setTimeout(() => {
          controller.signal.removeEventListener("abort", onAbort);
          resolve(true);
        }, delayMs);
        controller.signal.addEventListener("abort", onAbort, { once: true });
      });
    },
  });
}
