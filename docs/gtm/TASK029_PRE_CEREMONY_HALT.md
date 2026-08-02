# TASK-029 pre-ceremony halt (GTM G0)

Truth: **no production signing posture claim** until founder ceremony completes.

## What is already proven (fixture / code)

- External-trust authorship verification paths exist on disk (see task notes).
- P0.2b crash matrix (2026-07-29) found **CP5** blocking defect: crash after
  `appendRetiredRegistry` and before `activateGeneration` can leave
  `retired_generation` with no usable active key. Ceremony blocked until CP5 closes.
- **CP5 CLOSED (2026-08-02, AUTHORSHIP-ROTATION-RESUME-1A).** The crash is
  reproduced by a real child `SIGKILL` at the pointer-commit boundary, and the
  measured pre-fix posture is **fail-closed, not unsafe** — nothing ever signs
  with a retired key — so CP5 was a liveness defect. `resumeAuthorshipRotation`
  rolls an interrupted rotation forward under the exact phrase
  `RESUME AUTHORSHIP ROTATION`, after re-verifying the already-archived
  generation through the same contract `loadActiveKeyPair` enforces. Read-only
  inspection reports the state and repairs nothing. Fixture homes only — no real
  key was generated or rotated. See `docs/CURRENT_LIMITS.md`
  (AUTHORSHIP-ROTATION-RESUME-1A) and `tests/authorship-rotation-resume.test.js`.
  **This unblocks the ceremony gate; it does not perform, replace, or reduce the
  ceremony.** Everything below still stands.

## What this GTM cycle does NOT do

- No real key generation
- No revocation receipt on operator Dema home (`DEMA_HOME`)
- No registry mutation
- No cron change

## Exact founder GO required before ceremony

Typed consent for rotate + expected old fingerprint + isolated ceremony machine.
After GO: close CP5 in a dedicated slice, then run ceremony outside AI transcripts.

## GTM language until then

"Local receipts are content-addressed; production mission-signing key rotation is
scheduled under founder ceremony (TASK-029). Do not treat current key custody as
launch-ready signing posture."
