# Mission-Centric Thesis

> **Dema turns the LLM economy from a model marketplace into a mission marketplace: from subscribing to tools, to authorizing agents, to paying for verified outcomes.**

This document is **PRODUCT_THESIS**, not measured implementation. It states the destination model Dema is built toward, anchored to existing prior art and existing repo invariants. Where the thesis names a future delivery model (AaaS, OaaS), it is positioning, not an active offer. Active offers live in [market-positioning.md](market-positioning.md).

## Lineage — the shoulders Dema stands on

Each layer below solved one capability the prior layer lacked. Dema does not invent any of these primitives. It composes them into a single product face that any one human can use to finish a task and walk away with proof.

| Layer                             | Era                             | What it solved                                                  |
| --------------------------------- | ------------------------------- | --------------------------------------------------------------- |
| AutoHotKey                        | early 2000s                     | user-scripted desktop automation                                |
| Telescript (General Magic)        | mid-1990s                       | mobile agents carrying intent                                   |
| Smart contracts (Szabo / Buterin) | 1990s concept, 2010s deployment | programmable consent and settlement                             |
| MCP (Model Context Protocol)      | 2024                            | standardized tool plane                                         |
| A2A (Agent-to-Agent)              | 2024                            | agent-to-agent contract layer                                   |
| **Dema**                          | **2026**                        | **mission-centric, consent-bound, receipt-backed product face** |

The pattern Dema absorbs from each: scriptable user intent (AHK), mobile execution that carries proof (Telescript), programmable consent (smart contracts), standardized tool calls (MCP), agent coordination contracts (A2A). The pattern Dema rejects: any layer that hides authority from the human or treats the model as the endpoint.

## The shift

| From                         | To                              |
| ---------------------------- | ------------------------------- |
| Model-centric                | Mission-centric                 |
| SaaS — subscribe to a tool   | AaaS — authorize an agent       |
| Runtime fees — pay per token | OaaS — pay for verified outcome |
| Chat output                  | Verified outcome with receipt   |

**Model-centric** asks: which LLM, which prompt, which fine-tune. **Mission-centric** asks: which task, which proof, which receipt. The model is a tool; the mission is the product.

## On AaaS and OaaS — proof-safe qualifier

AaaS (Agent as a Service) and OaaS (Output as a Service) are product-positioning models for future Dema offerings. They are **not** active token, reward, or public-network claims. They do not promise passive income, AGI, or federation economics. They describe what is being sold, not how revenue is recognized.

Dema's current alpha offer is the **Sovereign Local AI Node Setup + Safety Audit** — a verified-installation-and-audit deliverable. That offer is closer to OaaS in shape than to SaaS: the buyer pays for a verified outcome (a working, safe local node), not for runtime access to a model. AaaS — agents that complete bounded missions on a buyer's behalf — remains gated behind ARTIFACT-011 and the FATE consent layer per [ADR-005](../06-adr/ADR-005-operator-actions-require-explicit-consent.md).

The honest truth label:

- **OaaS positioning today:** Sovereign Local AI Node Setup + Safety Audit. (PRODUCT_OFFER, active.)
- **AaaS positioning:** described, not active. Will require ARTIFACT-011, the receipts handoff to `bizra-omega`, and a measured first bounded diagnostic.

## Why this thesis matters for the engineering

Every Dema invariant traces back to mission-centricity. None of them would be load-bearing if Dema were model-centric.

- **`executes: false` on every mission proposal** — the mission is described and bounded _before_ it runs. [packages/core/src/mission.js](../../packages/core/src/mission.js) returns a preview, never an execution.
- **Schema-tagged outputs (`bizra.dema.<thing>.v0.1`)** — every output is content the user can verify. See CLAUDE.md invariant #5.
- **Exact-string consent via `evaluateConsent()`** — the user authorizes the _mission_, not the model. No fuzzy match. See [packages/fate/src/fate.js](../../packages/fate/src/fate.js) and CLAUDE.md invariant #4.
- **Receipts as first-class artifacts** — outcome verification, not chat history. See [docs/RECEIPTS.md](../RECEIPTS.md) and [packages/receipts/src/receipt-store.js](../../packages/receipts/src/receipt-store.js).
- **Local-first state under `~/.dema/`** — the user owns the mission record. See ADR-004.

The architecture is not arbitrary. It is the engineering shape of "the mission is the product."

## See also

- [dema-one-face.md](dema-one-face.md) — competitive landscape and fusion patterns.
- [market-positioning.md](market-positioning.md) — active target user, current offer, killer screens.
- [no-shadow-state-law.md](no-shadow-state-law.md) — the integrity law beneath the thesis.
- [../06-adr/ADR-001-dema-is-one-face.md](../06-adr/ADR-001-dema-is-one-face.md) — single product surface decision.
- [../06-adr/ADR-005-operator-actions-require-explicit-consent.md](../06-adr/ADR-005-operator-actions-require-explicit-consent.md) — consent law for missions.
- [../ABSORPTION_NOTES_v1.md](../ABSORPTION_NOTES_v1.md) — patterns Dema studies from Hermes and OpenClaw.
