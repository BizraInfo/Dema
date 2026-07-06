# DEMA-FIRST-LIGHT-GUI-FRONT-DOOR-PREVIEW-1A

Truth label: `DEMA_FIRST_LIGHT_FRONT_DOOR_PREVIEW_MEASURED_REPO` (runtime: `PREVIEW_ONLY`).

## Purpose

The First Light front door — Dema's human entry surface (language → identity → consent) — as a
**self-contained, zero-external-request static preview**. The screen is a proof object, per the Isnād
Modern canon: gold only where proof exists, every number wears an evidence chip, Arabic first-class,
consent/errors/proof never hidden.

## Contract-first architecture

```text
packages/core/src/dema-first-light-front-door-preview.js   ← pure CONTRACT + verifier (source of truth)
apps/front-door/index.html                                 ← RENDERS the contract (no shadow truth)
scripts/review/dema-first-light-front-door-preview-check.mjs ← reads the HTML, runs the verifier
```

The kernel declares what the front door must be; the review gate verifies the shipped HTML satisfies
it. The HTML never carries a truth the contract does not sanction.

## Contract (enforced by `verifyFrontDoorHtml`)

Required in the HTML:
- disclaimers: `PREVIEW ONLY`, `NO MINT`, `NO FEDERATION`
- `127.0.0.1` (the one permitted network target — opt-in localhost model probe)
- `NOT LIVE` labels (URP / apps-scan / data-scan / daemon / receipt-mint)
- evidence chips (`MEASURED`, `SIMULATED`)
- self-audit (`Audit this door`)
- renamed surfaces (`Node Bond Preview`, `Bond fingerprint preview`)
- apps/data consent toggles agent-gated (`agent ? 'disabled …'`)
- Arabic script present (bilingual, first-class)

Forbidden in the HTML:
- external `src`/`href` requests, `@import`, CDN/font hosts, external `<script src>`, analytics/beacon
- any `fetch()` to a host other than `127.0.0.1`
- a URP surface labeled `ACTIVE`
- a live mint (`receipt minted` / `token minted` / `minting live`) or live-federation claim

## Boundaries

- Pure kernel; no fs/network/clock/random (the gate injects the HTML string).
- Static HTML: no build step, no dependencies (repo posture: 0 deps).
- All-false boundary; `authority_delta: 0`. A preview surface has no execution authority.
- The opt-in `127.0.0.1` probe is the sole network act and does not prove a running model.

## Files

```text
packages/core/src/dema-first-light-front-door-preview.js
apps/front-door/index.html
tests/dema-first-light-front-door-preview.test.js
scripts/review/dema-first-light-front-door-preview-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/DEMA_FIRST_LIGHT_GUI_FRONT_DOOR_PREVIEW_1A.md
docs/02-architecture/DEMA_FIRST_LIGHT_GUI_FRONT_DOOR_PREVIEW_v0_1.md
```

## Commands

```bash
node --test tests/dema-first-light-front-door-preview.test.js
node scripts/review/dema-first-light-front-door-preview-check.mjs --json
npm test
npm run check
```
