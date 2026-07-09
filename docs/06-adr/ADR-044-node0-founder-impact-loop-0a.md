# ADR-044 — NODE0-FOUNDER-IMPACT-LOOP-0A

**Status:** PROPOSED (design/scoping only — implementation requires a separate build GO)
**Date:** 2026-07-09
**Truth label:** `NODE0_FOUNDER_IMPACT_CANDIDATE_LOCAL_ONLY`
**Deciders:** Mohamed (operator/founder)
**Supersedes / relates:** builds on #349 (corpus sanitizer), #350 (claim gate), #355 (materialization pulse), FDE dual-diagnostic (`DEMA_FDE_DUAL_DIAGNOSTIC_1A`), ADK v0.1, canonical receipts.

---

## Context

The governance rails are shipped and green. The unbuilt frontier is the **founder-self-application proof-of-impact loop**: Dema applying Proof of Impact to the founder **first**, on a bounded slice of his own 3-year corpus, producing **one useful artifact** and **one candidate founder-impact receipt** — the literal first instance of `founder-self-application-first`.

This is the smallest act that converts the thesis from `DESIGNED_NOT_LIVE` toward `MEASURED`: not "Dema is live," but "Dema gave Mohamed one useful, provable thing back, first."

## Decision

Implement `NODE0-FOUNDER-IMPACT-LOOP-0A` as a **founder-scoped mission on the shipped materialization-pulse spine** — not a new engine. The loop:

```
declare bounded source set (operator-consented paths)
  → sanitize   (untrusted-corpus-sanitizer-preview · #349)
  → build ONE useful artifact = an OKF-conformant knowledge digest
       + BIZRA proof-extension frontmatter (truth_label, evidence, source hashes)
  → claim-gate (public-metric-claim-gate-preview · #350)
  → emit ONE candidate founder-impact receipt (canonical-receipt)
       impact_class: "candidate" · served_to: founder-first · mint_allowed: false
  → FDE-classify any blocker (dema-fde-dual-diagnostic) · STOP on consent/outward
```

The artifact is **deterministic** (no model invocation in 0A): parse → structure → cross-link → cite the sanitized bounded slice into a navigable, OKF-conformant bundle. Model-enriched synthesis is a **future 0B** slice (requires `ollama serve` + separate GO).

## Core invariant (binding)

**A failure classification cannot increase system authority.** No FDE path, no verify path, no error handler may flip `mint_allowed`, `continue_allowed`, or scope from false→true or escalate `served_to`. Failure may only reduce/hold authority, freeze state, request consent, or escalate to the operator. The review gate and `verifyFounderImpactReceipt` assert this monotonicity.

## Boundary (what 0A does / does not do)

| Performs (consented) | Refuses |
|---|---|
| `content_read` of the **declared bounded** source set (exact-string consent) | raw whole-corpus scan without consent |
| `filesystem_write` of **one** artifact + one candidate receipt | model invocation (0A is deterministic) |
| deterministic digest + hashes | external/network call · federation · daemon |
| candidate receipt (content-addressed) | **mint** · signed-as-verified impact · public claim |

Receipt boundary block records honestly: `model_invocation_performed:false`, `external_call_performed:false`, `receipt_mint_performed:false`, `federation_invoked:false`, `content_read:true` (consented), `filesystem_write_performed:true` (artifact), `raw_data_included:false` (binds hashes, not payloads).

## Truth boundary

This proves **only a local candidate founder-impact loop**. It does **not** prove live PoI, verified impact, mint eligibility, federation, full autonomy, or RSI at scale.

## Consequences

- **Positive:** first founder-self-application artifact + receipt; reuses shipped rails (no new trust surface); realizes "OKF with receipts"; gives Mohamed a usable, cited digest of his own corpus slice (solves the "query my own head without re-reading" pain) with provenance GBrain lacks.
- **Cost:** crosses from all-false preview to consented local read+write — honestly recorded, bounded, reversible.
- **Rejected alternatives:** (a) new standalone engine — rejected (would duplicate the pulse; violates "do not launder"); (b) model-enriched artifact in 0A — deferred to 0B (keeps 0A boundary-safe and Ollama-independent); (c) "verified impact" receipt — rejected (0A is candidate-only; verification needs an independent judge, out of scope).

## Verification (acceptance gates — all present on disk)

`npm test` · `npm run coverage` · `npm run check` · `npm run perf` · `npm run delivery:check` · `npm run proof:truth:check` · `git diff --check`

Full module/CLI/schema/test/FDE-matrix/promotion detail: `docs/specs/NODE0_FOUNDER_IMPACT_LOOP_0A.md`.
