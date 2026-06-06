# Dema UX Proof Harness

**Status:** DECLARED checklist (preview-only; no runtime, no UI implementation).
**Date:** 2026-05-16
**Scope:** A docs-only checklist that any future Dema UX surface (TUI cockpit, mobile companion channel, voice-presence prompt, screen-recording UX, future web view) must score against before it is considered "BIZRA-native" and ready for typed-GO. Complements `dema-tui-onboarding-design.md` (composition design) by adding the **uniqueness-character review** that prevents generic-agent-dashboard drift.

This file does not propose new code, new schemas, new CLI verbs, or new runtime surfaces. It is a review register.

## Why this exists

A UX surface can pass every technical gate (`npm test`, `npm run check`, `boundary-invariant-check`, `canon-check`, `llm:guidance`, `release:readiness`) and still drift into generic-agent-dashboard aesthetic. Technical gates measure correctness. This harness measures **character**: does the surface prove BIZRA's specific difference, or could it be the dashboard of any AI product?

## The one-sentence discriminator

> **Could a competitor (OpenAI · LangChain · Replit · Agent Zero · any generic agent product) copy this screen and still look normal?**

If yes → not unique enough → fails the harness.
If no, because the screen depends on Node0 + URP + PAT-7 + SAT-5 + EvidenceChain + Ihsan-floor + the locked shared world → BIZRA-native → passes.

## 12-criterion scorecard

Every UX surface must answer "Pass" to all 12 before it advances past preview status.

| ID  | Criterion                        | Pass condition                                                                                                                                                  | Anchor primitive (on-disk)                                   |
| --- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| A   | Sovereignty                      | The user can answer "where am I / who am I / what is allowed / what is blocked / what proof exists" in ≤30 seconds                                              | `node0-homebase-state-preview`                               |
| B   | Mission-centricity               | Every screen surfaces a current or next-safe mission                                                                                                            | `consent-planner` + `next_safe_action` field                 |
| C   | Living-homebase feeling          | First-screen renders the operator's identity, primary device, companion device, PAT party, SAT guardians visibly                                                | `node0-homebase-state-preview`                               |
| D   | Consent before capability        | Every action with side effects is preceded by a consent card displaying allowed/denied effects, required `MICRO_CONSENT_SHAPE` field, and receipt-preview state | `consent-hash-preview`                                       |
| E   | Proof visibility                 | No claim displays without a truth label (MEASURED / EMERGING / LATENT / ASPIRATIONAL / EXTRAPOLATED)                                                            | `melae-preview`                                              |
| F   | PAT/SAT separation               | PAT language reads as support; SAT language reads as protection; ownership never confused                                                                       | `pat-builder-sat-validator.md` + Homebase preview registries |
| G   | Local-LLM-as-resource            | No screen reads "the model decided." Screens read "PAT proposed · SAT reviewed · DEMA displayed · operator consented."                                          | `models` CLI verb output                                     |
| H   | Standing-on-shoulders discipline | Every external-pattern reference maps to a BIZRA primitive via the External Pattern Registry; no naked import of MCP/A2A/hook/AHK/contract authority            | `external-pattern-registry-preview`                          |
| I   | Emotional integrity              | Onboarding reduces cognitive burden rather than adding new commands to memorize                                                                                 | composition of existing 27 CLI verbs                         |
| J   | Boundary honesty                 | Blocked states render as protection with named pre-condition, not as failure                                                                                    | `blocked_actions` + `unlock_condition` fields                |
| K   | Replayability                    | A completed mission can be reconstructed from intent → consent → PAT proposal → SAT verdict → evidence → receipt → impact                                       | `evidence-chain-preview`                                     |
| L   | Non-generic language             | No generic-agent vocabulary: "agent swarm", "AI employee", "autonomous magic", "growth dashboard", "prompt runner" do not appear in any rendered string         | static-source review of UX source files                      |

## 5-round design review ritual

Every new UX surface (or non-trivial change to an existing one) runs these 5 rounds in order. Any "No" answer halts promotion.

### Round 1 · SNR review

- Remove: jargon, vanity claims, duplicated panels, unclear buttons, ambiguous status indicators, unverified phrases.
- Keep: mission, state, proof, consent, blocked actions, next-safe-action.

### Round 2 · Ihsān review

- Is this truthful (no MEASURED claim without measurement)?
- Is this protective (does the screen prevent foreseeable operator error)?
- Is this beneficial (does the screen reduce operator burden)?
- Is this clear (can a non-technical operator parse it in under 1 minute)?
- Does it reduce harm (is no information leaked that should remain private)?
- Does it respect attention (no spinners without progress; no decorative noise)?

### Round 3 · Boundary review

For each rendered statement, ask:

- Could a reader infer runtime is live? (must be `false` if so)
- Could a reader infer federation is open?
- Could a reader infer SAT belongs to the user rather than the system?
- Could a reader infer shared URP is active?
- Could a reader infer MEASURED proof exists where only PREVIEW exists?

### Round 4 · Story review

- Does this screen continue the journey from seed to homebase to mission to receipt to impact?
- Does it preserve operator dignity (no "you screwed up" framing for blocked states)?
- Does it turn pain into structure and proof, or does it perform suffering?

### Round 5 · Competitor review (the one-sentence discriminator)

- Could a generic agent product copy this screen verbatim and still make sense? If yes → fail.

## The 7-minute acceptance test

Before any UX surface promotes from PREVIEW to LIVE status (which requires a separate ADR + typed-GO), the operator must report — in their own words — that within 7 minutes of opening the surface:

1. I know where I am
2. I know what matters today
3. I know what is safe to do
4. I know what is blocked and why
5. I can ask my PAT party to propose something
6. I can see SAT protect the system from over-reach
7. I can approve one bounded mission with exact consent
8. I receive a verifiable receipt
9. I know the next safe step

If any of the 9 cannot be reported, the surface holds at PREVIEW. The 9 are not a checklist for the implementer; they are the report-back the operator gives.

## What this harness is NOT

- ❌ Not an executable test (no `tests/dema-ux-proof-harness.test.js`); it is a review register
- ❌ Not a framework choice for the TUI (deferred to a separate ADR per `dema-tui-onboarding-design.md`)
- ❌ Not a new CLI verb (`dema ux-review` is not proposed)
- ❌ Not a runtime gate; it is applied at PR review time and at design ADR time
- ❌ Not a substitute for the existing technical gates (`npm test`, `boundary-invariant-check`, `canon-check`, etc.) — orthogonal to them

## How the harness applies in this branch

Applied to `dema-tui-onboarding-design.md` (commit `aca328f`):

| Criterion                   | Pass on disk? | Evidence                                                                                                                                                              |
| --------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A Sovereignty               | ✅            | 10 cards expose where/who/what-allowed/what-blocked/proof state                                                                                                       |
| B Mission-centricity        | ✅            | Mission Card present; Next-Safe-Action Card present on every screen                                                                                                   |
| C Living-homebase feeling   | ✅            | Identity Card renders MoMo + MSI laptop + Z Fold 6 + PAT-7 + SAT-5                                                                                                    |
| D Consent before capability | ✅            | Consent Card sources from `consent-hash-preview`; "Approve" requires exact MICRO_CONSENT_SHAPE phrase per boundary invariant                                          |
| E Proof visibility          | ✅            | "Every card displays" pattern + truth-label rule from boundary invariants                                                                                             |
| F PAT/SAT separation        | ✅            | Party Card lists PAT-7 by role + SAT-5 with their verdict surface; no role conflation                                                                                 |
| G Local-LLM-as-resource     | ✅            | Card sourcing pattern: "PAT proposed · SAT reviewed · DEMA displayed · operator consented"                                                                            |
| H Standing-on-shoulders     | ✅            | `external-pattern-registry-preview` exists at HEAD; 11 external patterns mapped to BIZRA primitives                                                                   |
| I Emotional integrity       | ✅            | Composes existing 27 verbs; introduces zero new commands to memorize                                                                                                  |
| J Boundary honesty          | ✅            | Shared URP World Card shows ghost_hold + unlock_condition rendering                                                                                                   |
| K Replayability             | ✅            | Evidence Card sources from `evidence-chain-preview` (chain_id + prev_hash + event_hash)                                                                               |
| L Non-generic language      | ✅            | Vocabulary used: homebase, mission, guardian, receipt, proof, local URP, shared world, consent, ghost-hold, next-safe-action. None of the generic-agent terms appear. |

The TUI design at `aca328f` passes all 12 criteria. **This is evidence that the harness is operative, not aspirational.**

## References

- [`dema-tui-onboarding-design.md`](dema-tui-onboarding-design.md) — the composition design this harness is first applied to
- [`pat-builder-sat-validator.md`](pat-builder-sat-validator.md) — PAT/SAT separation source
- [`../canon/BIZRA_TOPOLOGY_CANON.md`](../canon/BIZRA_TOPOLOGY_CANON.md) — topology vocabulary discipline
- [`../FIRST_RUN_WIZARD.md`](../FIRST_RUN_WIZARD.md) — onboarding screen sequence
- [`../USER_LIFECYCLE.md`](../USER_LIFECYCLE.md) — user journey
- [`../06-adr/ADR-005-operator-actions-require-explicit-consent.md`](../06-adr/ADR-005-operator-actions-require-explicit-consent.md) — consent-before-capability ADR
- [`../06-adr/ADR-007-multi-session-chain-policy.md`](../06-adr/ADR-007-multi-session-chain-policy.md) — multi-session attribution discipline
- [`../superpowers/specs/2026-05-16-integration-foundry-registry/01_specification.md`](../superpowers/specs/2026-05-16-integration-foundry-registry/01_specification.md) — Standing-on-shoulders binding spec
- `packages/core/src/node0-homebase-state-preview.js` — identity + party state source
- `packages/core/src/shared-urp-world-preview.js` — world card source
- `packages/core/src/external-pattern-registry-preview.js` — Standing-on-shoulders implementation
- `packages/consent/src/consent-hash-preview.js` — consent card source
- `packages/verifier/src/evidence-chain-preview.js` — evidence card source
- `packages/verifier/src/ihsan-floor-preview.js` — ihsan card source
- `packages/verifier/src/melae-preview.js` — truth-label source

## Operating law

```
A screen that looks like any agent dashboard fails.
A screen that displays the operator's sovereign homebase,
their mission, their party, their guardians, their proof,
and their next safe step passes.
```
