# Binder Item 04 · ADR-014 Three-Runtime Architecture · Accepted

> **Pointer**: the canonical ADR lives at `docs/06-adr/ADR-014-three-runtime-architecture-canonization.md`. Status: **Accepted** (2026-05-19 GST via typed-GO `GO accept ADR-009 and ADR-014`).

## TL;DR

BIZRA is a **three-runtime system by design**:

| Runtime | Stack                                                                      | Audience                                                    | Role                                                           |
| ------- | -------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| **A**   | Python · `bizra-data-lake/` (53GB)                                         | Data engineers · ML practitioners                           | 5-stage pipeline (INTAKE → RAW → PROCESSED → INDEXED → GOLD)   |
| **B**   | Rust · `bizra-omega/` (20-crate Cargo workspace · 944 tests)               | Sovereign operators · formal-verification practitioners     | Proof appliance · ratatui TUI · Z3 SMT · Ed25519 + Dilithium-5 |
| **C**   | JavaScript · `Dema/` (this repo · 12 packages · 92 src files · 2223 tests) | Non-technical operators · web contributors · demo audiences | Preview face · zero runtime deps                               |

Each language implements the half of the constitutional contract its OS + audience demand. The cross-runtime invariant is the **constitution**, not the **implementation**.

## Why three runtimes (not one)

| Runtime        | Why this language                                                                                                                           | Why NOT another language                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| A · Python     | Right tool for data engineering at scale                                                                                                    | Rebuilding in Rust or JS would be malpractice                      |
| B · Rust       | Z3 SMT verification · cryptographic signatures · BFT consensus all benefit from Rust's type system + memory safety + zero-cost abstractions | Python or JS would be irresponsible for proof appliance            |
| C · JavaScript | Friction-free first-touch · no Rust toolchain · no Z3 dep · no Python venv · npm install adds 0 packages                                    | Necessary because Lighthouse adoption requires friction-free entry |

## Cross-runtime bridges (verified)

| Bridge | Direction   | Mechanism                                                 |
| ------ | ----------- | --------------------------------------------------------- |
| A ↔ B  | Both        | PyO3 (`bizra-omega/bizra-python` crate)                   |
| B → C  | Design only | ADR-013 visual language port + sync gate (no runtime IPC) |
| A ↔ C  | None        | Not currently needed                                      |

**No bridge introduces runtime coupling.** Each runtime can be developed, tested, deployed independently.

## What this ADR closes

External AI audits that mix runtimes (e.g., the 2026-05-19 Kimi audit that recommended "Rust IPC + Ed25519 + BLAKE3 for v0.7.0" — those exist in Runtime B already · acting on the audit as written would inject Rust into Runtime C and destroy the zero-dep moat).

Future audits can now be evaluated against an **explicit topology** rather than implicit assumption. The wrong-codebase pattern becomes fast-resolution: point at ADR-014.

## What this ADR does NOT do

1. NOT a merge proposal — three runtimes stay separate
2. NOT a runtime IPC specification — only the bridges that exist today are authorized
3. NOT a deprecation of any runtime
4. NOT an action on the Kimi audit's specific recommendations
5. NOT a port of Runtime B's 14 widgets to Runtime C

## Cross-reference

- Full ADR: `docs/06-adr/ADR-014-three-runtime-architecture-canonization.md`
- Status field: `Status: Accepted` (line 3)
- Acceptance receipt: #71 (`2026-05-19_140251`)
- Truth label: `ADR_009_AND_ADR_014_ACCEPTED_FOR_PRIVATE_WITNESS_GTM`
- Companion memory: `[[reference_bizra_three_runtime_architecture]]`
