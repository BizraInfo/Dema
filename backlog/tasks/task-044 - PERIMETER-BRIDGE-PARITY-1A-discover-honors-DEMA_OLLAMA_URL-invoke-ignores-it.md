---
id: TASK-044
title: 'PERIMETER-BRIDGE-PARITY-1A: discover honors DEMA_OLLAMA_URL, invoke ignores it'
status: To Do
assignee: []
created_date: '2026-07-28 09:49'
labels:
  - models
  - cli
  - perimeter
dependencies: []
references:
  - packages/models/src/model-inventory.js
  - packages/core/src/llm-adapter.js
  - packages/core/src/consent-bridge-parity.js
  - docs/06-adr/ADR-042-operator-bridge-threat-model.md
priority: high
type: bug
ordinal: 44000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
MEASURED 2026-07-28 by a perimeter sweep under the operator doctrine "Probabilistic Core, Deterministic Perimeter".

The two halves of the local-LLM perimeter read DIFFERENT sources for the same fact — where the model lives:

  packages/models/src/model-inventory.js:226
      ollamaUrl = process.env.DEMA_OLLAMA_URL || DEFAULT_OLLAMA_URL
      -> `dema models discover` HONORS the ADR-042 operator bridge.

  packages/core/src/llm-adapter.js
      grep DEMA_OLLAMA_URL -> 0 hits.
      -> `dema llm-invoke` ignores it entirely; it accepts only an
         explicit ollamaBaseUrl / --base, else the hardcoded default.

Failure mode: an operator who follows ADR-042 and exports DEMA_OLLAMA_URL (say a non-default port, or a second machine on loopback) gets `dema models discover` listing models from the bridged endpoint while `dema llm-invoke` silently talks to 127.0.0.1:11434 — a different node, or nothing at all. Dema would report models it cannot invoke, and invoke a model it never listed. Same class as the gateway probe defect closed this morning: two surfaces asserting the same fact from different sources.

ADR-042 declares these bridges as a set — DEMA_OLLAMA_URL, DEMA_LM_STUDIO_URL, DEMA_LLAMACPP_URL — so parity should be checked for all three across every surface that resolves an endpoint, not just ollama+invoke. Note consent-bridge-parity.js already exists as a parity kernel; check whether it can carry this assertion rather than adding a new one.

Design question to settle before implementing (why this is filed, not fixed): precedence. Recommended order is explicit argument (--base) > env bridge (DEMA_*_URL) > hardcoded loopback default, because an explicit operator flag should always win over ambient environment. That must be stated once and enforced identically in every resolver, ideally by extracting ONE shared endpoint-resolution kernel that both inventory and adapter call — otherwise the split recurs the next time a surface is added. The localhost-only security boundary (isLocalhostBaseUrl) must remain enforced after resolution, whatever the source.

Related: LOCAL-LLM-BASE-RESOLVER-1A (452d047) fixed the adapter default needing DNS; this is the sibling gap in the same perimeter.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 One shared endpoint-resolution kernel exists; both model-inventory and llm-adapter call it rather than each resolving independently
- [ ] #2 Precedence is explicit --base > DEMA_*_URL env bridge > loopback default, documented and identical on every surface
- [ ] #3 With DEMA_OLLAMA_URL set to a non-default loopback port, discover and llm-invoke provably target the SAME endpoint
- [ ] #4 Parity asserted for all three ADR-042 bridges (ollama, lm_studio, llamacpp), reusing consent-bridge-parity.js if it fits
- [ ] #5 isLocalhostBaseUrl enforcement still applies after resolution regardless of which source supplied the value
<!-- AC:END -->
