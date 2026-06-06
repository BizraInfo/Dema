# Boundary: Core vs Face

## The hard line

```
                    ┌──────────────────┐
                    │    DEMA (face)   │
                    │                  │
                    │  Renders truth   │
                    │  Packages UX     │
                    │  Manages local   │
                    │  memory + prefs  │
                    └────────┬─────────┘
                             │
                     gateway contracts
                     (read-heavy, write
                      through approved
                      endpoints only)
                             │
                    ┌────────▼─────────┐
                    │  bizra-omega     │
                    │  (core)          │
                    │                  │
                    │  Owns truth      │
                    │  Runs missions   │
                    │  Validates chain │
                    │  Scores trust    │
                    │  Guards law      │
                    └──────────────────┘
```

## What DEMA owns

| Domain            | Examples                                                   |
| ----------------- | ---------------------------------------------------------- |
| Product UX        | Dashboard, onboarding, settings, command surface           |
| Rendering         | Trust strip, receipt chain, manifest cards, state gap      |
| Research surface  | Perplexity integration, citation display, research library |
| Operator surfaces | Browser actions, computer actions, permission dialogs      |
| Local state       | Preferences, UI state, research cache, local memory        |
| CLI packaging     | Command definitions, TUI rendering, output formatting      |
| Desktop shell     | Window management, tray, native integrations               |
| Design system     | Tokens, typography, icons, component library               |

## What bizra-omega owns

| Domain        | Examples                                    |
| ------------- | ------------------------------------------- |
| Mission law   | Mission types, state machines, lifecycle    |
| Admissibility | Input validation, constitutional checks     |
| Receipts      | Receipt creation, signing, chain integrity  |
| Trust engine  | Trust scoring, state transitions, decay     |
| Manifests     | Manifest creation, artifact binding         |
| Chain         | Append-only history, integrity verification |
| Gateway       | API contracts, auth, rate limiting          |

## What crosses the boundary

### DEMA → Core (writes)

- Submit new task/mission (via gateway)
- Request action execution (via gateway)
- Submit user preference changes that affect trust (via gateway)

### Core → DEMA (reads)

- Trust state snapshot
- Latest receipts (paginated)
- Active manifests
- Current → ideal state gap
- Mission status
- Admissibility result for proposed actions

## Violation checklist

If any of these are true, the boundary is broken:

- [ ] DEMA has a `trust-engine/` or `admissibility/` directory
- [ ] DEMA creates `Receipt` objects directly (not via gateway)
- [ ] DEMA maintains mission state machines
- [ ] DEMA runs chain validation logic
- [ ] DEMA has gateway endpoint definitions (those belong in omega)
- [ ] DEMA interprets constitutional rules (it only displays results)

## Contract sync

`scripts/sync-contracts.sh` runs on CI and verifies:

1. All types in `packages/schemas/` match the corresponding gateway response shapes
2. All SDK methods in `packages/sdk/` have corresponding gateway endpoints
3. No orphaned contracts exist on either side
