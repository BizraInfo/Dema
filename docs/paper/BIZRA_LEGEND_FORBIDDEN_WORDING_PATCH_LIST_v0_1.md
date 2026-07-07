# BIZRA Legend Paper — Forbidden-Wording Patch List v0.1

Truth label: `PAPER_EVIDENCE_META_DOCS_ONLY`. Audits the paper (sha256 `2d0953d0…469b01`) for
overclaim wording. **This document lists forbidden terms as targets to remove — none is an
affirmative claim by this repo.**

## Finding: the paper is already largely self-policing

The paper contains its **own** wording discipline. Remark 6.6 explicitly states its Theorem 6.5 "does
not claim BIZRA 'eliminates' or is 'immune to' prompt injection", and names "eliminates / structurally
impossible / immune" as words that "would overclaim." The abstract states it is "**not** a claim that
BIZRA eliminates agent failure modes." So the paper is mostly compliant already. Two residual risks
remain.

## Patch table

| forbidden term | present in paper affirmatively? | verdict | patch / allowed wording |
|---|---|---|---|
| "eliminates" | No — paper explicitly disavows it (Abstract, Remark 6.6) | OK | keep "reduces … to violations of explicit, testable architectural invariants" |
| "immune" | No — Remark 6.6 forbids it | OK | keep conditional Theorem 6.5 wording |
| "structurally impossible" | No — Remark 6.6 forbids it | OK | keep "reduced to an invariant violation" |
| "first architecture" | **Yes** — abstract & §1.1 say "the first agent architecture that enforces VIA structurally" | **PATCH** | soften to "to our knowledge, the first…" or drop the priority claim (CL-18) |
| "kernel-space" (literal) | **Yes** — Table 1 & §4.2 label SAT/FATE "Ring-0 (kernel-space)"; implementation is bubblewrap process isolation | **PATCH** | qualify as "OS-enforced process isolation, modeled on Ring-0" until TEE deployed (CL-19); the paper's Remark 4.2 already softens the gradient claim but the label reads as literal |
| "proven at scale" / "at scale" | No — §8.4/§10 explicitly say single-node only, `n=10^4 ≪ 10^9` | OK | keep "single-node measurements hold; scale is Direction Only" |
| "live URP" | No — §11 marks URP Direction Only | OK | keep `DESIGNED_NOT_LIVE` framing |
| "minted token" / "production economy" | No — PoI is a preview ledger; §7 no live settlement | OK | keep `mint_allowed:false` framing (matches Dema) |
| "solved continual learning" | No — Remark 7.5: "We do not claim Skill Files solve catastrophic forgetting" | OK | keep "structural counter … not measured" |
| "guarantees prompt-injection immunity" | No — Theorem 6.5 is conditional | OK | keep conditional wording |
| "O(1) verification cost" (unqualified) | Guarded — Remark 4.8 says avoid it without the amortization qualifier | OK | always attach "amortized, per query, after O(n) preprocessing" |

## Residual patches required before public release (2)

1. **CL-18 — "first architecture":** a priority claim not verifiable from within. Soften or remove.
2. **CL-19 — "Ring-0 / kernel-space":** currently reads as literal kernel enforcement; the actual
   mechanism is process-level namespace isolation (bubblewrap). Qualify explicitly until a TEE is
   deployed, or the security claims inherit an unearned "kernel-space" strength.

Everything else is already within the paper's own stated wording discipline. The paper's honesty is a
strength; these two patches close the remaining gap.
