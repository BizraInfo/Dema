# Diffusion Reasoner Kernel v0.1

- **Schema:** `bizra.dema.diffusion_reasoner.v0.1`
- **Live source of truth:** `packages/core/src/diffusion-reasoner.js` (a real, imported, tested kernel).
- **Status:** the fifth and final live framework kernel from the V2 audit's framework-maturity list — completing the set (HHMM, hash-table, self-awareness, self-loop, diffusion).

## What it is — and what it is emphatically NOT

"Diffusion" here is a **denoising metaphor only**. The kernel takes an ordered **refinement trajectory** (`drafts` — each a revision of the prior) and verifies it **converges**: each step's deterministic **noise score** (count of speculation/overclaim markers from a fixed lexicon) must be non-increasing, ideally ending in an evidence-bound, zero-noise claim.

It is **NOT** a neural diffusion model, **NOT** learned sampling, **NOT** stochastic, and it **generates no text**. It scores and verifies a caller-supplied trajectory. `neural_diffusion` and `learned_sampling` are `false`, and `verifyDiffusionRefinement` fails closed (`neural_diffusion_overclaim`/`learned_sampling_overclaim`) if either is flipped.

## Convergence statuses

- **CONVERGED** — non-increasing noise, ends at zero noise, *and* has ≥1 evidence anchor.
- **DENOISED_UNEVIDENCED** — reached zero noise but no evidence (honest: clean text ≠ proven).
- **REFINING** — non-increasing but still noisy at the end (keep refining).
- **DIVERGED** — noise increased at some step (the reasoning got *worse* — rejected).

`recommendation` maps 1:1: `ACCEPT_CONVERGED` / `NEEDS_EVIDENCE` / `CONTINUE_REFINEMENT` / `REJECT_DIVERGENT`.

## API

- `buildDiffusionRefinement({ drafts, evidence, claim_id })` → frozen, content-addressed report (`convergence_hash`, per-step `draft_hash`, `noise_schedule`).
- `scoreDraftNoise(draft)` → deterministic noise count.
- `verifyDiffusionRefinement(report)` → `{ valid, blocked_by }`: re-derives every load-bearing field (per-step noise scores, `diverged_at_step`, `convergence_status`, `recommendation`, `final_noise_score`, and the anti-overclaim attestation prose) so a recomputed-`convergence_hash` laundering (e.g. DIVERGED→CONVERGED) is still caught.

## Fail-closed

Empty / non-array / malformed drafts, noise/hash/status/recommendation mismatch, non-false boundary, and neural/learned overclaim — every negative verdict carries a `reason_code`. Deterministic, deep-frozen, pure (no fs/network/clock/random/model/text-generation).

## Boundary — what this is not

`boundary` is entirely `false`: no runtime, no text generation, no model call, no network, no self-modification, no signing/key/mint, no PoI/MCP/A2A/federation. The kernel reads caller-supplied drafts + evidence anchors and returns a frozen verdict. A zero-noise claim is not necessarily *true* — convergence binds to caller-supplied evidence, not ground truth.
