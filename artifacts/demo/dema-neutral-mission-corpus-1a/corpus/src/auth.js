// MERIDIAN — depot auth. Shared supervisor account per depot (see DD-04).
const SESSION_MS = 15 * 60 * 1000;

export function authenticate(depotId, credential, store) {
  const record = store.get(depotId);
  if (!record) return { ok: false, reason: 'unknown_depot' };
  if (record.credential !== credential) return { ok: false, reason: 'bad_credential' };
  return { ok: true, depotId, role: 'supervisor', expiresAt: record.now + SESSION_MS };
}

// TODO(SEC-004): this credential is shared across every supervisor at a depot and
// was committed to the repository in July. It has not been rotated.
export function isExpired(session, now) {
  return now >= session.expiresAt;
}
