# Dema Mobile QR Consent v0

**Status:** DECLARED design (docs-only spec; no implementation yet).
**Date:** 2026-05-16
**Scope:** Specify the manual-echo confirmation protocol between the Node0 laptop and the Z Fold 6 companion device. Mobile is **consent-viewer + manual-echo-source only**. Mobile is never a runtime actuator, secret store, or authority surface.

## Current facts (disk-verified)

- `~/.claude/projects/.../memory/node0-space.md` (operator canon, 2026-05-09) declares: _"Node0 = MSI Titan + Z Fold 6 = single node."_ The phone is the canonical companion device.
- `packages/core/src/node0-homebase-state-preview.js` (commit `13f32c5`) declares `companion_device: "Z Fold 6"`. No mobile communication protocol on disk.
- `packages/consent/src/consent-common.js` declares `MICRO_CONSENT_SHAPE` (7 fields).
- `packages/consent/src/consent-hash-preview.js` declares `OPERATIONS = {read, write, execute, call}` and `RESOURCE_TYPES = {file, path, command, service}`.
- 2026-05-16 ~11:10 GST: operator-typed state — phone connected via USB-C, USB-tether enabled at the phone level. The laptop's OS does not currently show a `usb0` / `enx*` interface up; default route still goes through WiFi. **No network channel is assumed by this spec.**

## Why mobile is constrained to manual-echo

A live socket / paired daemon between laptop and phone has four well-documented failure modes the spec intentionally refuses:

1. **Secret-on-phone risk** — any token persisted on the phone becomes an exfiltration target on phone loss or compromise.
2. **Implicit-authority risk** — a paired socket makes the phone a runtime actuator; the user feels they "approved on phone" but the laptop took action; consent provenance becomes ambiguous.
3. **Background-daemon risk** — Dema CLAUDE.md forbids hidden daemons; a mobile pairing daemon contradicts the invariant.
4. **Network-trust risk** — local WiFi is not a trust boundary on a typical operator's network.

The v0 protocol routes around all four by **never giving the phone any computational authority**. The phone shows a phrase; the operator types it. The laptop verifies. The phone never holds, sends, or executes anything authoritative.

## The manual-echo protocol (v0)

```
Step 1 (laptop · trigger):
  Operator initiates an action on the laptop that requires
  cross-device confirmation (e.g., a Step-7-tier mission act).

Step 2 (laptop · challenge generation):
  Laptop generates a fresh challenge:
    - challenge_id     (random 128-bit hex)
    - mission_id       (from MICRO_CONSENT_SHAPE)
    - action           (one of OPERATIONS)
    - purpose          (human-readable, ≤ 200 chars)
    - expires_at       (RFC 3339 timestamp, 90 seconds in future)
    - phrase           (deterministic hash-derived from the above, encoded
                        as a 12-word readable phrase or a 6-digit code)

Step 3 (laptop · challenge display):
  Laptop displays the full challenge on its screen.
  Laptop ALSO renders a QR code containing the same challenge fields
  (no secret, no token; just the challenge itself + the phrase).

Step 4 (phone · display only):
  Phone (via QR scanner or simple text viewer) reads the same challenge
  and displays:
    - mission_id (truncated)
    - action
    - purpose (full text)
    - the phrase (verbatim)
  Phone does NOT communicate this back to the laptop over any channel.

Step 5 (operator · manual echo):
  Operator types the phrase, verbatim, into the laptop's consent input.

Step 6 (laptop · verification):
  Laptop verifies:
    - phrase matches the laptop-generated phrase exactly (byte-equal)
    - expires_at has not passed
    - challenge_id has not been used before (replay-protection)
  Records the verified consent into the consent-hash-table preview.

Step 7 (laptop · receipt):
  Laptop emits an evidence-chain receipt with:
    - the challenge_id
    - the verified phrase fingerprint (NOT the phrase itself in the receipt; phrase is treated as a secret)
    - the resulting permitted action
    - the boundary section all-false except for `consent_recorded: true`
```

## Boundary invariants (every implementation must honor)

| Invariant                                                                              | Why                                                                     |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Phone holds no secret. The phrase appears on screen, not in app storage.               | Mitigates phone-loss exfiltration.                                      |
| Phone has no network endpoint for Dema. No socket open, no API, no push.               | Mitigates implicit-authority and daemon risk.                           |
| Laptop verification is exact-byte phrase comparison.                                   | Per `MICRO_CONSENT_SHAPE` exact-string consent canon.                   |
| Challenge `expires_at` is enforced (default 90 s).                                     | Mitigates phrase-screenshot replay.                                     |
| `challenge_id` is one-time-use.                                                        | Mitigates within-window replay.                                         |
| Receipt records phrase fingerprint, not the phrase itself.                             | Phrase is a per-event secret; receipt audits the event, not the secret. |
| Phone-side software is a generic QR/text viewer. No Dema-specific app required for v0. | Reduces operator install burden + attack surface.                       |

## Out of scope (v0)

- BLE / NFC / WiFi pairing
- Push notifications to phone
- Phone-side Dema app
- Biometric on phone (TouchID / FaceID) as a consent factor
- Multi-device fan-out (more than one companion)
- Persistence of consent state on phone
- Phone-initiated actions (phone never starts a Dema action)
- Tethered-USB IP networking (treated as a transport concern, orthogonal to consent)

## v1 (future, separate spec required)

After v0 is proven and tested:

- A secure local IP channel (WiFi, USB-tether, or NFC) MAY transport the verified-phrase fingerprint from phone to laptop, eliminating the operator-typing step. This requires its own ADR because it gives the phone a (narrow) authority. v0 deliberately refuses this until proven.

## Functional requirements (for a future implementation)

### F-01 · CLI surface

```
dema consent challenge generate [--mission MISSION_ID] [--action ACTION] [--purpose TEXT] [--json]
dema consent challenge verify [--challenge-id ID] [--phrase PHRASE] [--json]
```

### F-02 · Module exports

```
packages/consent/src/mobile-qr-challenge-preview.js

export const MOBILE_QR_CHALLENGE_PREVIEW_SCHEMA = "bizra.dema.mobile_qr_challenge_preview.v0.1"
export function buildMobileQrChallengePreview({mission_id, action, purpose, now, expires_in_seconds})
export function verifyMobileQrChallengePreview(challenge, typed_phrase, now)
```

### F-03 · Determinism + purity

- Module imports zero `fs / net / http / child_process`.
- `buildMobileQrChallengePreview` returns a fresh frozen object per call with the same input → same phrase (deterministic).
- `verifyMobileQrChallengePreview` is a pure function (returns `{ok: bool, reason}`).

### F-04 · Boundary

All authority flags false: `runtime`, `federation`, `mint`, `network_used`, `secret_persisted_on_phone`, `phone_authority_granted`, `socket_opened`, `hook_executed`.

### F-05 · Phrase encoding

For v0.1, phrase is derived deterministically from `sha256(canonical(challenge))` truncated to 6 bytes and encoded as a 12-word BIP-39-style readable phrase **OR** a 6-digit numeric code (operator preference). Either encoding gives ~30+ bits of entropy per challenge — adequate against typing-error replay, not against targeted brute-force (mitigated by 90 s expiry).

### F-06 · Replay protection

`challenge_id` is stored in `~/.dema/consent/used_challenges/` (one file per consumed id) and checked on verify. After 24 h, entries auto-purge (separate `dema consent cleanup` verb, out of v0.1 scope).

## Acceptance criteria (for a future implementation, not this spec)

1. Round-trip test: generate challenge → display phrase → manually type phrase → verify returns `ok=true`.
2. Expired challenge returns `ok=false` with `reason: "expired"`.
3. Wrong phrase returns `ok=false` with `reason: "phrase_mismatch"`.
4. Replay of consumed `challenge_id` returns `ok=false` with `reason: "replay"`.
5. Receipt schema records phrase fingerprint, not the phrase.
6. No `node:net` / `node:http` import anywhere in the module.
7. Boundary-invariant lint passes.

## What this spec does NOT authorize

- Implementing the module (separate typed-GO + likely a fresh session)
- Adding the CLI verb (separate typed-GO; touches `apps/cli/src/index.js` — Codex's active area)
- Phone-side software
- Any persistent socket between laptop and phone
- Any phone-initiated authority

## References (canonical sources)

- `packages/consent/src/consent-common.js` — `MICRO_CONSENT_SHAPE`
- `packages/consent/src/consent-hash-preview.js` — `OPERATIONS`, `RESOURCE_TYPES`, exact-lookup-only policy
- `packages/consent/src/consent-planner.js` — `buildConsentPlanPreview` (the upstream consent surface this protocol feeds into)
- `packages/core/src/node0-homebase-state-preview.js` — `companion_device: "Z Fold 6"`
- `docs/06-adr/ADR-005-operator-actions-require-explicit-consent.md` — explicit-consent ADR
- `docs/02-architecture/dema-tui-onboarding-design.md` — Consent Card spec
- `docs/02-architecture/dema-ux-proof-harness.md` — criterion D (Consent before capability) + criterion J (Boundary honesty)
- `~/.claude/projects/.../memory/node0-space.md` — Node0-IS-Dema's-space embodiment doctrine (operator canon)

## Operating law

```
The phone shows a phrase.
The operator types the phrase.
The laptop verifies.
The phone never holds, sends, or executes anything authoritative.
```
