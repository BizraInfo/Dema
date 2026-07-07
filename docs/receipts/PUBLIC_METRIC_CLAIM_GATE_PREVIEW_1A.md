# Receipt: PUBLIC-METRIC-CLAIM-GATE-PREVIEW-1A

Truth label: `PUBLIC_METRIC_CLAIM_GATE_PREVIEW_MEASURED_REPO`

## Slice

Pure preview-only public-metric claim-binding gate (Materialization Pulse Step 5): given a structured claim and an evidence store, it classifies the claim's shape, resolves evidence by hierarchy (signed receipt > CI attestation > CURRENT_LIMITS row > public claim ledger > repo state > operator declaration), checks the asserted value against evidence, and assigns a truth label (VERIFIED / DERIVED / DECLARED / PREVIEW / UNKNOWN / REJECTED / REMOVED) with an evidence pointer; a wrong value or a live-capability claim without live proof is REJECTED, an unmeasured metric is UNKNOWN, and only VERIFIED/DERIVED/DECLARED/PREVIEW claims are public-displayable; isomorphism/shape-matching is used ONLY for recognition, never as truth; no model, no network, no deploy, kernel stays pure.

```text
plan → build → verify → tamper-reject
```

## The correction it encodes

Materialization Pulse Step 5, done right: **shape-matching RECOGNIZES a claim; only evidence binding
PROVES its value.** Isomorphism / graph / lexicon matching is used ONLY to classify shape — never as
truth. (The DeepSeek "isomorphic verifier" that claimed "isomorphism is mathematically exact truth"
was the overclaim this gate refuses.)

```text
claim extracted → shape recognized → evidence located → value checked EXACTLY → truth label → public gate
```

## The acceptance table (reproduced by the review gate)

| Claim | Evidence | Label | Public? |
|---|---|---|---|
| "12,680 Tests Passing" | ci: 6,993 | **REJECTED** | no |
| "6,993 Dema-core tests" | ci: 6,993 | **VERIFIED** | yes ← pointer |
| "~15,000 hours" | (testimony) | **DECLARED** | yes |
| "Live URP" | current_limits: preview | **REJECTED** | no |
| "URP Preview" | — | **PREVIEW** | yes |
| "SEED minted" | (no settlement proof) | **REJECTED** | no |
| "9,000 tests" (wrong value) | ci: 6,993 | **REJECTED** | no |
| "42 Rust crates" (no evidence) | — | **UNKNOWN** | no |

## Proof Contract

The gate must pass only while:

- the exact GO phrase matches byte-for-byte,
- each label is a **pure function of (claim, evidence)** — `verify` re-derives every binding, so a
  REJECTED laundered to VERIFIED is rejected,
- a measured claim is `VERIFIED` **only** when its asserted value exactly matches trusted evidence
  AND an evidence pointer exists; a wrong value → `REJECTED`; no trusted evidence → `UNKNOWN`,
- `ai_text` is never authoritative evidence,
- a live-capability claim (`urp live` / `SEED minted`) → `REJECTED` unless a live proof from a
  signed_receipt/ci_attestation source is present,
- only `VERIFIED / DERIVED / DECLARED / PREVIEW` are `public_displayable`; every claim is reported, none hidden,
- the boundary stays all-false.

Honesty: this gate does **not** extract claims from raw copy (claims are supplied structured) and does
**not** measure evidence itself (the evidence store is injected). It enforces that a public claim
matches its cited evidence exactly and is labeled — it cannot certify the injected evidence is itself
true. Claim extraction from live copy is a separate follow-on.

## Boundary

`claim_gate_complete` verdict only. No model, network, deploy, mutation, or mint. `boundary` all-false ·
`authority_delta` 0 · `mint_allowed` false.

`npm run check` runs `public-metric-claim-gate-preview-check.mjs` and keeps `PUBLIC_METRIC_CLAIM_GATE_PREVIEW_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/public-metric-claim-gate-preview.test.js
node scripts/review/public-metric-claim-gate-preview-check.mjs --json
npm run check
```
