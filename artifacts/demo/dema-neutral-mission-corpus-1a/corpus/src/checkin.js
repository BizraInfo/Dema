import { config } from './config.js';

// REQ-011 duplicate detection — client side only. The API is not idempotent.
export function recordCheckin(state, scan, now) {
  const windowMs = config.duplicateWindowSeconds * 1000;
  const recent = state.recent.filter((r) => now - r.at <= windowMs);
  if (recent.some((r) => r.barcode === scan.barcode)) {
    return { accepted: false, reason: 'duplicate_within_window' };
  }
  state.recent = [...recent, { barcode: scan.barcode, at: now }];
  state.queue.push({ ...scan, queuedAt: now });
  return { accepted: true };
}
