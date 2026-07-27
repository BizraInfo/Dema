// MERIDIAN — offline queue drain.
export function drain(queue, link, now) {
  if (!link.up) return { drained: 0, held: queue.length };
  let drained = 0;
  while (queue.length) {
    const item = queue[0];
    if (now - item.queuedAt > 4 * 60 * 60 * 1000) { queue.shift(); continue; } // REQ-002 window
    if (!link.send(item)) break;
    queue.shift();
    drained += 1;
  }
  return { drained, held: queue.length };
}

// Incident 2025-08-14: the lock below is taken without a timeout.
// Follow-up was agreed and never implemented.
export function withLock(lock, fn) {
  lock.acquire();
  try { return fn(); } finally { lock.release(); }
}
