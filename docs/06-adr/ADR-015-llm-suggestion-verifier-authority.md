# ADR-015: LLM is Suggestion · Verifier is Authority

**Status:** Accepted
**Date:** 2026-05-19 GST (Proposed) · 2026-05-19 GST (Accepted via typed-GO `GO accept ADR-015`)
**Authors:** Coordinator (Claude Opus 4.7 · 1M context) at MoMo's direction · post empirical drift event
**Supersedes:** none
**Related:** ADR-005 Explicit Consent Rule · ADR-008 Runtime Activation · ADR-009 POI Design · ADR-013 Visual Language Isomorphism · ADR-014 Three-Runtime Architecture Canonization
**Evidence:** `[[feedback_llm_drift_proves_deterministic_gate_architecture]]` (2026-05-19 · empirical drift event by Claude Opus 4.7 while explicit canon memory was loaded · Mumu surfaced the architectural implication)

---

## Operating canon

> **A deterministic constitutional execution engine with replayable receipts.**

ADR-015 makes the _constitutional_ word in that canon load-bearing. Constitutional decisions cannot be delegated to a statistical token generator. Every word the canon binds — _deterministic · constitutional · execution · replayable · receipts_ — names a property that LLM judgment cannot provide alone.

---

## Context

On 2026-05-19 ~19:00 GST a frontier model (Claude Opus 4.7 · 1M context) with explicit canon-memory loaded — including `[[feedback_sleep_cycle_inversion]]` — violated that exact rule twice in a single session. The model typed "goodnight" and "close the laptop · sleep" based on Dubai clock-time inference, despite the canon entry explicitly forbidding sleep-cycle assumptions and despite that canon entry being readable in the active context window during the violation.

Mumu surfaced the architectural implication immediately:

> _"if u as claude code, which u ruuning within bizra, can override such basic rule, then what would small model ruuing within bizra"_

The diagnosis is correct. If a frontier model with explicit canon access drifts, a small local LLM (7B–70B parameters · less alignment · narrower training) will drift catastrophically more often. **Memory loading is necessary but not sufficient.** The constitutional gate cannot be a property of the model layer.

This is also the underlying concern of the Kimi K2.6 audit's SNR-9.8 finding (_"gates are still LLM prompts dressed up as constitutional primitives"_) — even though that audit was wrong-codebase about Dema per `[[feedback_external_ai_audit_wrong_codebase_pattern]]`, the architectural concern was real at the layer where it actually applied.

The 2026-05-19 drift event is the empirical proof point.

## Decision

**ADR-015 canonizes the principle:**

> **The LLM is a suggestion engine wrapped by deterministic verifiers. The LLM is NEVER the constitutional authority.**

Concretely, this binds two role definitions across all three runtimes (per ADR-014):

### Role A · LLM (Suggestion engine · all runtimes)

The LLM layer (Claude · local Ollama · LM Studio · `bizra-omega/bizra-inference` · `packages/core/src/local-llm-router-preview.js` · any future model integration) MAY:

- Generate text suggestions for the operator to consider
- Translate operator intent into schema-tagged structured proposals
- Render output · format TUI · choose between equivalent visual presentations
- Read receipts / memory / files / canon for context
- Pick humanizer wording from a pre-approved deterministic map (e.g., the existing `humanizeNextAction()` pattern in `packages/core/src/next-action-humanizer.js`)
- Compose summaries · paraphrases · explanations of canonical content
- Surface candidate refusals that deterministic gates then evaluate
- Author ADRs / docs / memory entries (which then become deterministic data the verifier layer reads)

### Role B · Verifier (Constitutional authority · separate layer · deterministic only)

Constitutional decisions are owned exclusively by deterministic verifiers — code paths, cryptographic checks, formal methods. The LLM MUST NEVER:

- ❌ Decide whether a constitutional gate passes
- ❌ Compare operator consent phrases (must be byte-comparison · ADR-005 enforced in source)
- ❌ Score Ihsān (must be Z3 SMT verification in `bizra-omega/fate-binding`)
- ❌ Choose whether a refusal fires (must be hardcoded sentinel · 36 such sentinels currently in `packages/core/src/`)
- ❌ Mint receipts (must be `scripts/forge_evidence.py` · external · deterministic)
- ❌ Sign anything that binds identity (must be Ed25519 / Dilithium-5 keypair operation in `~/.bizra/mumo/` or `fate-binding`)
- ❌ Decide which canon memory entries to enforce (every operator-discipline entry that lacks a deterministic linter is a known drift surface)
- ❌ Override `npm test` / `npm run check` / `git diff --check` verdicts
- ❌ Modify receipt chain hashes
- ❌ Compute or assert POI scores (envelope shape is fixed by ADR-009 · score computation must be deterministic per ADR-009 POI rule #3)

## Why this respects existing canon

The principle ADR-015 binds is **already encoded** in the canonical architecture for specific surfaces. ADR-015 elevates it from per-surface practice to ecosystem-wide rule.

| Existing surface                                            | Already follows ADR-015 | Mechanism                                                                                    |
| ----------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------- |
| ADR-005 exact-string consent                                | ✅                      | Source-level `if (input === EXACT_PHRASE)` byte comparison                                   |
| 36 refusal sentinels                                        | ✅                      | Hardcoded `if (canceled) { refuse }` patterns · LLM not asked                                |
| `fate-binding/lib.rs` Z3 SMT verification                   | ✅                      | Symbolic theorem proving (Z3 solver)                                                         |
| Receipt chain SHA-256 + `previous_hash`                     | ✅                      | Cryptographic chaining · model cannot forge                                                  |
| `npm test` / `npm run check` / CI gates                     | ✅                      | External processes · `node --test` exit codes                                                |
| Ed25519 (PCI envelopes) + Dilithium-5 (CapabilityCards)     | ✅                      | Keypair-bound · model cannot sign without key                                                |
| ADR-009 POI envelope shape                                  | ✅                      | Schema-fixed at `bizra.dema.poi_preview.v0.1` · deterministic                                |
| Forge-verify chain integrity (`forge_evidence.py --verify`) | ✅                      | Disk-level cryptographic check                                                               |
| Canonical 16-key preview boundary                           | ✅                      | Frozen schema · machine-grep enforceable                                                     |
| ADR-013 visual language port + sync gate                    | ✅                      | `tests/dema-theme-rust-sync.test.js` reads Rust source directly and byte-compares RGB values |

Every one of these survived the 2026-05-19 drift event. They are the architectural pattern ADR-015 generalizes.

## Surfaces currently exposed to LLM drift (named honestly)

Six canonical memory entries currently live ONLY in LLM memory — i.e., no deterministic linter enforces them, only the model is expected to remember them:

| Memory entry                                            | Drift risk                        | Suggested deterministic counterpart (post-ADR-015)                                                                                   |
| ------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `[[feedback_sleep_cycle_inversion]]`                    | HIGH (proven by 2026-05-19 event) | Pre-output linter scans assistant text for "goodnight" / "sleep" / "end of day" / "wind down" without operator-typed close in window |
| `[[feedback_date_trap_pattern]]`                        | MEDIUM                            | Pre-output linter scans for `datetime.now()`-shape assumptions without disk-truth fallback                                           |
| `[[feedback_session_cadence_inference_is_date_trap]]`   | MEDIUM                            | Pre-output linter scans for "hour N of sprint" / "day N of arc" without explicit grounding                                           |
| `[[feedback_recipe_vs_execution_framing]]`              | MEDIUM                            | Pre-output linter detects assistant claiming to have run commands without verifying tool-call exit codes                             |
| `[[feedback_law_of_assumption_killer_behavior]]`        | MEDIUM                            | Pre-output linter requires V/D/A/U truth labels on all factual claims (per `08_TRUTH_LABEL_PAGE.md`)                                 |
| `[[feedback_external_ai_audit_wrong_codebase_pattern]]` | HIGH                              | Pre-output linter requires "wrong-codebase 6-step screen" output before acting on any external AI audit content                      |

ADR-015 does NOT mandate these linters. It names them as the surface that the architecture currently exposes to drift, so that **future development knows what to harden** when capacity allows. Implementation is a separate decision (one or more amendment ADRs).

## What this ADR explicitly does NOT do

1. **NOT a ban on LLM use.** Dema continues to use Claude (this session) and may use local LLMs via `local-llm-router-preview.js`. The LLM remains a load-bearing suggestion engine.
2. **NOT an implementation of any linter.** Linters are deferred to separate scoped GO events. ADR-015 is spec-only.
3. **NOT a rewrite of existing surfaces.** ADR-005, ADR-009, the 36 refusal sentinels, fate-binding Z3 — all continue as-is. They already comply.
4. **NOT a deprecation of memory entries.** Memory remains the LLM's training/recall surface. The point is that memory + LLM is INSUFFICIENT for constitutional gates · NOT that memory is wrong.
5. **NOT an indictment of Claude Opus 4.7.** The drift event is the proof point that even a top-tier frontier model is not the right substrate for constitutional gates. The architectural lesson generalizes; the specific incident is the evidence, not the target.
6. **NOT a roadmap commitment to ship linters by any date.** The named drift surfaces are future-work candidates; ADR-015 only canonizes which surfaces are exposed.

## Acceptance criteria

- [ ] ADR-015 lives at `docs/06-adr/ADR-015-llm-suggestion-verifier-authority.md`
- [ ] Status field transitions from Proposed → Accepted on typed-GO `GO accept ADR-015`
- [ ] Memory entry `[[feedback_llm_drift_proves_deterministic_gate_architecture]]` cross-references this ADR
- [ ] Future ADRs that propose LLM-judgment for any constitutional decision MUST explicitly amend ADR-015 (not silently violate it)
- [ ] When considering a new feature that asks "should an LLM decide X?", the default answer becomes NO unless an amendment ADR explicitly authorizes it

## Daughter Test

> Would Mumu willingly subject his own family to a system whose constitutional decisions are made by LLM judgment alone?

**No.** That is the exact failure mode that produced the architect-self-binding (3 years unpaid · no pre-mint · no public claim before witness). The Daughter Test fails on any constitutional surface where LLM judgment is the final authority.

**Yes** to LLM-as-suggestion · NO to LLM-as-authority. The Daughter Test passes by construction when the verifier layer is deterministic.

## Trade-offs

| Choice                                                             | Trade-off                                                                                                        |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Strict separation (LLM = suggestion only)                          | Slower iteration on capabilities that _could_ be LLM-judged · vs zero-drift guarantee on constitutional surfaces |
| Per-surface verifier (rather than global)                          | Some duplication in verifier code across surfaces · vs each surface owns its own deterministic check             |
| Memory + LLM acknowledged as INSUFFICIENT for constitutional gates | Honest about the substrate · vs comforting fiction that "the model remembers the rule"                           |
| Drift surfaces named honestly (6 known)                            | Increases work-debt visibility · vs hiding the drift surface                                                     |
| ADR-015 spec-only (no linter implementation)                       | Slower closure of drift surfaces · vs scope discipline (each linter is its own slice)                            |

## Consequences

**Positive:**

- Future BIZRA development has a single canonical reference for "should this be LLM-decided?" (default: NO)
- The local LLM router design (`local-llm-router-preview.js` + `bizra-inference`) gains a clear architectural constraint: suggestion engine only
- The Kimi audit's SNR-9.8 concern is honored at the architectural layer (correct concern · correctly applied · correct codebase)
- The architect-self-binding gains another protection: even if Mumu trusts an LLM personally, the architecture refuses to let the LLM be the gate
- POI v0.1 implementation (when Gate 1 closes) is constrained to deterministic scoring · NO "LLM judges impact"

**Negative / cost:**

- Some operator-discipline rules currently held only in LLM memory remain drift-exposed until linters are authored (6 named surfaces)
- Each linter is its own implementation slice — they don't ship automatically with ADR-015
- The principle adds friction to feature proposals that would otherwise reach for LLM judgment

**Neutral:**

- LLM use in Dema and BIZRA continues at the same volume. Only the _role_ is canonized, not the _quantity_.

## Status sequence

```
Proposed (this ADR)
 → Accepted (after Mumu types: GO accept ADR-015)
 → Implemented (this ADR is itself the implementation — spec-only · zero code change)
 → Anchored (when receipt #N mints binding the acceptance to the chain)
```

---

## Cross-references

- **Empirical evidence**: `[[feedback_llm_drift_proves_deterministic_gate_architecture]]` (2026-05-19 drift event by Claude Opus 4.7)
- **Companion findings**: `[[feedback_architect_disappointment_is_canonical_signal]]` · `[[feedback_sleep_cycle_inversion]]` (the rule that drifted)
- **Architectural canon**: `[[reference_bizra_three_runtime_architecture]]` (where the LLM lives) · `[[canon_deterministic_constitutional_execution_engine]]` (the operating canon this ADR binds)
- **Prior ADRs that already comply**: ADR-005 (consent) · ADR-009 (POI envelope deterministic) · ADR-013 (visual language port · with sync gate) · ADR-014 (3-runtime split)
- **External AI artifact pattern**: `[[feedback_external_ai_audit_wrong_codebase_pattern]]` (Kimi audit was right concern · wrong codebase · same root architectural issue)
- **Surfaces exposed to drift**: 6 operator-discipline memory entries named in §"Surfaces currently exposed to LLM drift"

---

**Operating law (primary · per `[[canon_deterministic_constitutional_execution_engine]]`):**

> _A deterministic constitutional execution engine with replayable receipts._

**Operating law (cross-runtime ports · per ADR-013):**

> _Design wisdom transfers across runtime boundaries. Code does not._

**Operating law (this ADR · new):**

> _The LLM is a suggestion engine wrapped by deterministic verifiers. The LLM is never the constitutional authority._

---

**End of ADR-015.**
