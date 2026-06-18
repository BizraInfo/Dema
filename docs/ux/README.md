# Dema UX design sources

**Truth label:** `REFERENCE_ONLY` — prototypes and wireframes; not live runtime.

## Primary pack

Operator design pack: `/home/bizra-operating-system/Downloads/BIZRA Dema (6).zip`

Key surfaces for Node0 / Mumu closed loop:

| Asset | Role |
| --- | --- |
| `Dema Node0 Cockpit v2 - Meaning-Guided Loop.dc.html` | Daily loop pipeline: covenant → scan → map → seed → assume → meaning → **consent** → receipt → growth |
| `Micro-Consent Gate - TUI Wireframes.dc.html` | Micro-consent moment: pipeline bar with **YOU** gate, I WILL / I WILL NOT |
| `Dema Living Terminal - Vibe-Proof Fusion.dc.html` | Living terminal + proof framing |
| `Dema First-Time Onboarding.dc.html` | First-time onboarding (Bond → Foundation → Discovery → First Mission) |
| `docs/ux/DEMA_FIRST_TIME_ONBOARDING_PROTOCOL_v0_1.md` | Onboarding protocol (companion to `docs/02-architecture/dema-first-time-onboarding-protocol-v0.1.md`) |

## Shipped TUI mapping (repo)

| Design pattern | Code |
| --- | --- |
| Realm home frame + boot sequence | `packages/core/src/dema-realm-home.js` |
| Mumu closed-loop cockpit (pipeline + consent gate) | `packages/core/src/node0-mumu-cockpit.js` |
| Journey state machine | `scripts/node0-mumu-cli.mjs` → `buildMumuJourney()` |
| CLI surfaces | `dema node0 mumu journey`, `dema realm` (footer cockpit) |

Governed loop execution stays `npm run node0` (ADR-037). Dema is the read-only face.

## Palette (Chronicles)

- Obsidian background `#020408`
- Gold invariants `#D4AF37`
- Emerald verified `#10B981`
- Crimson blocked `#EF4444`
- Ash metadata `#9CA3AF`
