# ADR-014: Three-Runtime Architecture Canonization

**Status:** Accepted
**Date:** 2026-05-19 (Proposed) · 2026-05-19 (Accepted via typed-GO `GO accept ADR-009 and ADR-014` · truth label `ADR_009_AND_ADR_014_ACCEPTED_FOR_PRIVATE_WITNESS_GTM`)
**Authors:** Coordinator (Claude Opus 4.7, 1M ctx) at MoMo's direction
**Cross-references:**
- ADR-013 (visual language isomorphism — sibling slice)
- `[[canon_deterministic_constitutional_execution_engine]]` (the irreducible product definition this ADR architecturally binds)
- `[[reference_bizra_three_runtime_architecture]]` (the disk-verified survey this ADR formalizes)
- `[[feedback_external_ai_audit_wrong_codebase_pattern]]` (why the Kimi audit was wrong-codebase, motivating this canonization)

---

## Operating canon

> **A deterministic constitutional execution engine with replayable receipts.**

— authored by Mumu, 2026-05-19. The 8-word irreducible definition of BIZRA/Dema. Every word in this ADR is in service of making that sentence true at runtime, across all three runtimes BIZRA spans.

## Context

The 2026-05-19 session uncovered a structural truth that had never been canonized:

**BIZRA is a three-runtime system by design, not by accident.** The codebases live in different repositories, written in different languages, serving different audiences, but they implement complementary halves of the same constitutional engine:

- `bizra-data-lake/` — **Python** · multi-stage data pipeline (INTAKE → RAW → PROCESSED → INDEXED → GOLD)
- `bizra-data-lake/bizra-omega/` — **Rust** · 20-crate sovereign appliance + ratatui TUI + Z3 SMT + Ed25519 + Dilithium-5
- `Dema/` (this repo) — **JavaScript** · zero-dep preview face + lightweight cockpit

Repeatedly during this session, external AI audits (Kimi 2026-05-19, ChatGPT 2026-05-16 NTU spec, ChatGPT 2026-05-16 Interactive CLI TUI conversation) referenced architecture from *one* runtime and applied recommendations to *another* — what the canonized memory entry `[[feedback_external_ai_audit_wrong_codebase_pattern]]` calls the wrong-codebase pattern. The Kimi audit, for instance, correctly named `Ed25519 + BLAKE3 + Rust IPC` as missing — but the codebase it was actually examining (bizra-omega) **already has all three** (`fate-binding/lib.rs:6-7`, `bizra-cli/Cargo.toml` ed25519-dalek + blake3 workspace deps). Acting on that audit as written would inject Rust into Dema's deliberately zero-dep JS layer — wrong runtime, right concern.

This ADR canonizes the three-runtime architecture so the next session does not re-discover it, and so external AI artifacts can be evaluated against an explicit topology rather than implicit assumption.

## Decision

We canonize the three-runtime architecture as follows. Each runtime has an explicit:

### Runtime A — `bizra-data-lake/` (Python)

- **Purpose:** Multi-stage data pipeline + ML inference + corpus management
- **Stages:** INTAKE → RAW → PROCESSED → INDEXED → GOLD (5-stage pipeline)
- **Key surfaces:** `core/snr_protocol.py` (facade routing to 4+ engines · geometric-mean ensemble · fail-closed), `core/sovereign/orchestrator.py`
- **Audience:** Data engineers, ML practitioners
- **Audit status:** AUDIT_A/B/C (dated 2026-02-14, 3 months stale at this ADR's authoring)
- **Constitutional surface:** Ihsān ≥0.95 + SNR ≥0.85 enforced via Python protocol
- **License:** Internal · bizra-data-lake corpus
- **Bridges to:** Runtime B via `bizra-omega/bizra-python` PyO3 crate

### Runtime B — `bizra-data-lake/bizra-omega/` (Rust)

- **Purpose:** Sovereign appliance · proof verification · operator console · cognitive substrate
- **Platform layer (10 crates):** bizra-core (sovereign kernel) · bizra-federation (SWIM gossip + BFT consensus + Ed25519) · bizra-cli (ratatui 0.30 TUI · 14 widgets) · bizra-installer · bizra-api · bizra-inference · bizra-autopoiesis · bizra-hunter · bizra-proofspace · bizra-python
- **Cognitive layer (5 crates):** bizra-cognition (dual-rate thought graph · receipted myelination · replay-from-chain runtime · genesis valuation) · bizra-hooks (sovereign nervous system · zero deps · pure Rust) · bizra-memory (atoms · insights · profile snapshots) · fate-binding (Z3 SMT Ihsān verification · Dilithium-5 post-quantum sigs · Ed25519 PCI envelopes) · bizra-mission
- **Test surface:** 944 tests · 0 clippy warnings · all crates Cargo workspace
- **Audience:** Sovereign operators · formal-verification practitioners
- **Constitutional surface:** Z3 SMT verification of Ihsān constraints · cryptographically signed federation messages · capability cards with PQ signatures
- **License:** MIT per `bizra-cli/Cargo.toml`
- **Bridges to:** Runtime A via PyO3 (bizra-python crate) · Runtime C via design-language port only (ADR-013, no runtime IPC)
- **Author:** MoMo (محمد) per `bizra-cli/Cargo.toml` and other crate authorship

### Runtime C — `Dema/` (JavaScript) ← *this repo*

- **Purpose:** Preview face · accessibility surface · web-friendly demonstration layer
- **Constraint:** Zero runtime dependencies (verified: `dependencies` and `devDependencies` both absent from `package.json`)
- **Surfaces:** 12 packages · 92 source files · 2202 tests at this ADR's authoring · 68 Ironclad receipts (top 7 consecutive)
- **Constitutional surface:** preview-only · NODE0_LOCAL_SEED · 16-key canonical boundary · refusal-as-product · ADR-005 exact-string consent
- **Audience:** Non-technical operators · demo audiences · web contributors · the Lighthouse install pathway
- **License:** Per `package.json`
- **Bridges to:** Runtime B via design-language port (ADR-013 — `packages/core/src/dema-theme.js` mirrors `bizra-cli/src/theme.rs` with byte-for-byte RGB fidelity, machine-verified by `tests/dema-theme-rust-sync.test.js`). **No runtime IPC** with Runtime A or B.

## Why three runtimes (not one)

Each runtime serves a distinct risk profile and audience:

- **Python pipeline (Runtime A):** absorbs the bulk corpus + ML inference complexity. Python is the right tool for data engineering at scale; it would be malpractice to rebuild this in either Rust or JS.
- **Rust appliance (Runtime B):** delivers the proof guarantees the constitution requires. Z3 SMT verification, Ed25519 + Dilithium-5 post-quantum signatures, BFT consensus, formal Ihsān gates — these all benefit dramatically from Rust's type system + memory safety + zero-cost abstractions. Python or JS would be irresponsible here.
- **JS preview face (Runtime C):** stays accessible. No Rust toolchain, no Z3 dep, no Python venv. A new user can `git clone` and `npm test` in under 60 seconds without installing 200MB of dependencies. Necessary because Lighthouse adoption requires friction-free first-touch.

**The deterministic constitutional execution engine with replayable receipts** is the *runtime contract*. Each language implements the half of the contract its operating system + audience demand.

## Cross-runtime bridges (verified)

| Bridge | Direction | Mechanism | Status |
|---|---|---|---|
| Runtime A ↔ Runtime B | Both | PyO3 (`bizra-python` crate) | Verified in disk · Python can call Rust kernels · Rust can call Python ML |
| Runtime B → Runtime C | Design only | ADR-013 visual-language port + sync gate | Verified · `dema-theme.js` byte-aligned with `theme.rs` · machine-enforced by CI |
| Runtime A ↔ Runtime C | None | — | Not currently needed · would be future work if required |

**No bridge introduces runtime coupling.** Each runtime can be developed, tested, and deployed independently. The cross-runtime invariant is the *constitution* (visible in all three runtimes), not the *implementation*.

## What this ADR canonizes

1. **Three-runtime topology** is intentional and load-bearing, not accidental drift.
2. **The wrong-codebase pattern** (audits or specs that mix runtimes) is now formally rejectable by reference to this ADR.
3. **Dema is the preview face**, not the proof appliance. Dema's zero-dep moat is preserved because the proof work happens in Runtime B.
4. **The 8-word definition** (above) is the *runtime contract* binding all three runtimes — not a Dema-only claim.
5. **Future runtime additions** (a hypothetical mobile-native runtime, or a future WASM runtime) MUST be added via ADR amendment to this one, not silently introduced.

## What this ADR explicitly does NOT do

1. **NOT a merge proposal.** Each runtime stays separate. No monorepo consolidation.
2. **NOT a runtime IPC specification.** The bridges that exist (PyO3 between A & B, design-only between B & C) are the bridges that exist. No new bridges are authorized by this ADR.
3. **NOT a deprecation of any runtime.** All three are first-class.
4. **NOT an action on the Kimi audit's specific recommendations.** Those apply to Runtime B which already implements them. Runtime C's zero-dep moat is preserved.
5. **NOT a port of Runtime B's 14 widgets to Runtime C.** That requires separate per-widget ADRs (see `docs/ai-design/dema-design-system-v0.1.md` §6 for the catalog).

## Acceptance criteria

- [ ] This ADR exists at `docs/06-adr/ADR-014-three-runtime-architecture-canonization.md`
- [ ] Memory entry `[[reference_bizra_three_runtime_architecture]]` cross-references this ADR
- [ ] Memory entry `[[canon_deterministic_constitutional_execution_engine]]` cross-references this ADR
- [ ] README.md and dema-theme.js header carry the 8-word definition
- [ ] No additional code change required — this is a binding architectural declaration

## Daughter Test

Would Mumu willingly subject his own family to running this three-runtime system?

**Yes.** Each runtime is honest about what it is, who it serves, and what its constitutional surface guarantees. No deception, no fabrication, no silent runtime coupling. The Daughter Test passes by construction.

## Consequences

**Positive:**
- Future external AI audits can be evaluated against an explicit topology
- New contributors can locate the right runtime for their skillset (Python, Rust, or JS) and contribute without learning all three
- The wrong-codebase pattern that consumed several turns this session becomes a fast-resolution case (point at this ADR)
- The 8-word definition gets architectural binding, not just operator-facing tagline

**Negative:**
- Three runtimes is more complex than one (mitigated by each runtime owning a clean responsibility)
- Architectural drift between runtimes is possible (mitigated by the design-language sync gate from ADR-013 · could be extended to other shared concerns)

**Neutral:**
- The relationship of Dema (Runtime C) to bizra-omega (Runtime B) is now formal rather than implicit. This was the case in reality; this ADR makes it documented.

---

## Status sequence

```
Proposed (this ADR)
 → Accepted (after Mumu reviews and approves)
 → Implemented (this ADR is itself the implementation — zero code change required)
 → Anchored (when receipt #69+ mints binding the canon arc to the chain)
```

**Operating canon (primary, ecosystem-wide):**

> *A deterministic constitutional execution engine with replayable receipts.*

**Operating law (secondary, for cross-runtime ports — from ADR-013):**

> *Design wisdom transfers across runtime boundaries. Code does not.*
