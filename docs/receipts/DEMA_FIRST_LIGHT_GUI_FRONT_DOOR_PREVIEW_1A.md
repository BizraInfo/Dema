# Receipt: DEMA-FIRST-LIGHT-GUI-FRONT-DOOR-PREVIEW-1A

Truth label: `DEMA_FIRST_LIGHT_FRONT_DOOR_PREVIEW_MEASURED_REPO` (runtime label: `PREVIEW_ONLY`).

## Slice

The **First Light front door** as a self-contained, zero-external-request static GUI preview
(`apps/front-door/index.html`), rendered from a **pure contract kernel** — there is no GUI shadow
truth. Integrated from `dema-node0 UI.html`, corrected and aligned with the Isnād Modern canon.

## Corrections applied to the source

1. "Bonded Contract" → **Node Bond Preview** (EN + Arabic).
2. "Bond receipt" → **Bond fingerprint preview** (all sites, EN + Arabic).
3. Added the global banner **`DEMA FIRST LIGHT · PREVIEW ONLY · NO MINT · NO FEDERATION`**.
4. Seal phrase set to `user-select:none` — it must be typed by hand, not pasted.
5. External requests: **zero** (verified — the only `fetch()` targets `127.0.0.1:11434`, opt-in).
6. `URP envelope draft` status `ACTIVE` → **`DESIGNED`**; all URP surfaces read `DESIGNED — NOT LIVE`.
7. `apps` / `data` consent toggles **disabled** (agent-gated) — they require a local dema agent.
8. The `127.0.0.1` model probe is opt-in, button-triggered, and states "nothing leaves your device".
9. Inventory export carries the **bond fingerprint (a hash)** + consents + capabilities — **not** raw
   identity (name/intent).
10. No live mint / federation / URP / daemon / file-scan / app-scan / receipt-mint is implied.

## Proof Contract

`verifyFrontDoorHtml(html)` (pure) + the review gate verify the shipped HTML against the kernel
contract. 13 focused tests. The gate fails closed on: an external asset request, a CDN/font host, a
`fetch()` to a non-`127.0.0.1` host, a URP labeled `ACTIVE`, a live mint or live-federation claim, a
missing PREVIEW/NO-MINT/NO-FEDERATION/SIMULATED/Node-Bond-Preview marker, missing Arabic, or apps/data
toggles that are not agent-gated.

`npm run check` runs `dema-first-light-front-door-preview-check.mjs`.

## What this proves

The kernel is the source of truth and the HTML conforms: bilingual (Arabic first-class), consent-first,
evidence-chipped, zero external requests, PREVIEW_ONLY, boundary all-false, `authority_delta: 0`.

## What this does NOT prove

No operator execution, daemon runtime, network use, wallet access, live federation, or live URP. It
renders a preview — runs no scan, mints no receipt, activates nothing. The opt-in `127.0.0.1` probe
does not prove a running model.

## Commands

```bash
node scripts/review/dema-first-light-front-door-preview-check.mjs --json
node --test tests/dema-first-light-front-door-preview.test.js
npm run check
# open the preview locally:
xdg-open apps/front-door/index.html   # or: open apps/front-door/index.html
```
