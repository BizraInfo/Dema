# Receipt: BIZRA-LEGEND-PAPER-EVIDENCE-HARDENING-1A

Truth label: `PAPER_EVIDENCE_META_DOCS_ONLY` — docs-only meta-analysis. Registry unchanged (**40**).

## Slice

An **evidence layer** for the BIZRA Legend Paper, built from the **real 12-page PDF** — not the audit
paraphrase (option A). The paper is treated as a **hash-pinned external artifact**, not imported.

- Subject: *Architectural Decoupling of Agency and Verification*
- Path: `/home/bizra-operating-system/Downloads/BIZRA_Legend_Paper_v0_1.pdf` (external, 12 pp)
- **SHA256: `2d0953d0d3cdc597f0b0576b3420074ff0d8f0d89059c8623be5f10112469b01`** (confirmed)

## Deliverables

1. `docs/paper/BIZRA_LEGEND_CLAIM_LEDGER_v0_1.md` — 21 claims, each with a proof class.
2. `docs/paper/BIZRA_LEGEND_REFERENCE_AUDIT_v0_1.md` — 45 refs audited.
3. `docs/paper/BIZRA_LEGEND_IMPLEMENTATION_EVIDENCE_MAP_v0_1.md` — paper Python runtime vs Dema repo.
4. `docs/paper/BIZRA_LEGEND_FORBIDDEN_WORDING_PATCH_LIST_v0_1.md` — wording audit.
5. `docs/receipts/BIZRA_LEGEND_PAPER_EVIDENCE_HARDENING_1A.md` — this receipt.

## Findings (from the real text)

- **21 claims** ledgered. Proven-now (cryptographic): tamper-evidence (Thm 6.1) + non-repudiation
  (Thm 6.2), unconditional under stated crypto assumptions. Conditional formal: FATE non-bypassability
  (6.3), prompt-injection reduction (6.5), PoI soundness (6.7), complexity (4.7). Design-only and
  Direction-only otherwise.
- **14 placeholder references** ([1]–[14], all "A. Author" + fabricated future arXiv IDs) — **blocking
  for public release**. [15]–[45] mostly verified real works.
- **Implementation split:** the paper's "~4,200 LOC Python" runtime is a **separate codebase, not this
  repo**. Dema carries *preview kernels* of several concepts (receipt signing, FATE consent, PoI /
  reward contracts, FDE, authority gradient) — disciplined previews, not the live runtime measured in
  Table 3. Measurements must be attributed to the Python runtime, not Dema.
- **Two residual wording patches:** "first architecture" (unverifiable priority claim) and
  "Ring-0/kernel-space" (metaphor read as literal; actual mechanism is bubblewrap process isolation).
  Everything else is within the paper's own wording discipline (Remark 6.6).

## Preserved sentence

> "BIZRA reduces agent failure modes to violations of explicit, testable architectural invariants."

## What this proves

That every major paper claim now has a proof class, an evidence pointer, and an explicit overclaim
risk; that its placeholder references are enumerated; and that its implementation claims are separated
from this repo's preview surfaces. The paper's claims are indexed and falsifiable, not taken on trust.

## What this does NOT prove

It does not verify the paper's theorems, run its Python runtime, reproduce its measurements, or make
the paper release-ready — 14 references remain placeholders and 2 wording patches remain open. It runs
no code, no daemon, no URP, no mint, no network beyond repo tooling; registry unchanged at 40.

## Commands

```bash
npm run check
git diff --check
dema monitors run --json
```
