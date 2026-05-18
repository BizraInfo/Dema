# ADR-001: DEMA Is the One Face

**Status:** Accepted
**Date:** 2026-04-17
**Decision makers:** Mumu (Mohamed Beshr)

## Context

BIZRA's architecture has multiple specialist systems — core runtime, chain engine, trust engine, admissibility, missions. Users should never interact with these directly. There must be exactly one product-facing surface.

Market analysis shows three proven patterns competing in this space:
- **Claude Code** — terminal-first, codebase-aware, MCP-connected
- **Perplexity** — citation-first research, library, local MCP bridge
- **Manus** — browser/desktop operator with explicit permissions

None of these provides all three under a unified trust model with constitutional memory and proof.

## Decision

DEMA is the sole user-facing product surface for BIZRA. All user interactions — web, CLI, desktop — go through DEMA. No other repo ships a user-facing interface.

DEMA operates in six modes: Ask, Code, Research, Browser, Computer, Memory/Trust. All modes share one trust model, one permission system, and one receipt chain.

## Consequences

- All UX investment concentrates in one repo
- Specialist systems remain behind the DEMA SDK/gateway boundary
- No other repo may ship user-facing UI or CLI commands
- DEMA must maintain parity across web, CLI, and desktop for core trust concepts
- The trust strip is always visible regardless of active mode

---

## Clarification: product modes vs infrastructure spine

**Amended:** 2026-05-18 · typed-GO authorization. Status of the original decision remains **Accepted**; this section disambiguates without changing it.

The original Decision (above) names six **product modes** for DEMA: Ask, Code, Research, Browser, Computer, Memory/Trust. Those are user-facing surfaces — what an operator selects when they want to do something.

The current implementation work has produced eight **infrastructure spine commands**, all preview-only: `state`, `profiles`, `consent-card`, `mission-loop`, `evidence-event`, `llm-router`, `process-mining`, `key-maker-check`. These are infrastructure that any future product mode must call before capability is granted.

The two sets of six are not the same. They are not in conflict.

```
USER-FACING PRODUCT MODES (per original Decision)
  Ask · Code · Research · Browser · Computer · Memory/Trust
                        ⇣ each must traverse ⇣
INFRASTRUCTURE PREVIEW SPINE (per current implementation)
  state · profiles · consent-card · mission-loop · evidence-event · llm-router · process-mining · key-maker-check
                        ⇣ each pinned by ⇣
CANONICAL PREVIEW BOUNDARY
  16 keys · all false · isCanonicalBoundary (strict) · isCanonicalBoundaryShape (post-JSON)
                        ⇣ verified by ⇣
SMOKE-BOUNDARY CANARY
  npm run smoke-boundary · exit 0 = canonical · exit 1 = drift
```

The spine commands do not replace the modes. They provide the truth, identity, consent, lifecycle, evidence, and routing substrate each future mode must traverse before any capability is allowed.

## Implementation status table (as of 2026-05-18 · HEAD `d0f8267`)

### Product modes (the original six)

| Mode | Status | Notes |
|---|---|---|
| Ask | PLANNED | No CLI/UI surface yet; future mode atop the spine |
| Code | PLANNED | No CLI/UI surface yet; future mode atop the spine |
| Research | PLANNED | No CLI/UI surface yet; future mode atop the spine |
| Browser | PLANNED | No CLI/UI surface yet; future mode atop the spine |
| Computer | PLANNED | No CLI/UI surface yet; future mode atop the spine |
| Memory/Trust | PARTIAL PREVIEW | Substrate is partially present via `state`, `profiles`, context capsule. Full mode UX not yet built |

### Infrastructure spine (the eight implemented previews)

| Surface | Status | Source |
|---|---|---|
| `state` | LOCAL PREVIEW IMPLEMENTED | `packages/core/src/state.js` · schema `bizra.dema.node0_state.v0.1` |
| `profiles` | LOCAL PREVIEW IMPLEMENTED | `packages/core/src/profiles.js` · 5 actor profiles + ContextCapsule · `--summary` variant |
| `consent-card` | LOCAL PREVIEW IMPLEMENTED | `packages/core/src/consent-card-preview.js` |
| `mission-loop` | LOCAL PREVIEW IMPLEMENTED | `packages/core/src/mission-loop-preview.js` · `--summary` variant |
| `evidence-event` | LOCAL PREVIEW IMPLEMENTED | `packages/core/src/evidence-chain-event-preview.js` |
| `llm-router` | LOCAL PREVIEW IMPLEMENTED | `packages/core/src/local-llm-router-preview.js` |
| `process-mining` | LOCAL PREVIEW IMPLEMENTED | `packages/core/src/process-mining-preview.js` · operator-pattern mirror · `--summary` variant |
| `key-maker-check` | LOCAL PREVIEW IMPLEMENTED | `packages/core/src/key-maker-compliance.js` · self-audits 5 invariants from [Key Maker Epistemic Conduct v0.1](../02-architecture/key-maker-epistemic-conduct-v0.1.md) · `--summary` variant |

### Cross-layer trust primitives

| Surface | Status | Source |
|---|---|---|
| Canonical preview boundary | IMPLEMENTED | `packages/core/src/preview-boundary.js` · 16 canonical keys · 2 verifier variants |
| Smoke-boundary canary | IMPLEMENTED | `scripts/smoke-boundary.mjs` · `npm run smoke-boundary` |

## Open questions for reviewers

1. **Numerology coincidence vs design.** Is "six modes" a constitutional commitment (e.g. derived from a specific doctrine source) or a numerical convenience that could expand to seven or shrink to five as the product matures?
2. **Mode-to-spine mapping.** Each future mode will call multiple spine commands. Is there a per-mode mapping document forthcoming, or will it be inferred from per-mode integration tests?
3. **Memory/Trust as the bridge mode.** Memory/Trust is the only mode marked PARTIAL PREVIEW — it overlaps most naturally with the spine. Should Memory/Trust ship first as the canonical "spine-exposed-to-user" mode?

These questions are intentionally left open for the Lighthouse N=1 review to resolve.

## References

- Architecture Map v0.2 §15 (this drift was first formally surfaced here): `/tmp/bizra-overnight/architecture/ARCHITECTURE_MAP_v0.2.md`
- Claim Ledger v1 finding F01 (independent discovery of the same drift): `/tmp/bizra-overnight/gtm-pack/08_CLAIM_LEDGER_v1.md`
- Foundation Provenance Pack v1.2 §5 (continuity mapping that informed this clarification): `/tmp/bizra-overnight/gtm-pack/07_FOUNDATION_PROVENANCE_PACK_v1.2.md`
