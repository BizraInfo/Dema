# PUBLIC-METRIC-CLAIM-GATE-PREVIEW-1A

Truth label: `PUBLIC_METRIC_CLAIM_GATE_PREVIEW_MEASURED_REPO`

## Purpose

**Materialization Pulse Step 5 (Claim Binding), done correctly.** The load-bearing distinction:

```text
shape-matching  →  RECOGNIZES a claim   (isomorphism / graph / lexicon — recognition only)
evidence binding →  PROVES its value    (hierarchy + EXACT value check — the only truth path)
```

This is the **output-side** guard (what may be shown publicly) that pairs with the input-side corpus
sanitizer (what may be ingested). It exists to stop the known containment failure — "12,680 tests" —
before it reaches UX / docs / receipts / deploy.

## Pipeline

```text
claim { metric, asserted_value, kind }
  → resolve evidence[metric] by hierarchy
  → exact value check
  → truth label
  → public-displayable? (VERIFIED/DERIVED/DECLARED/PREVIEW only)
```

## Evidence hierarchy (lower = stronger; ai_text is never authority)

```text
1 signed_receipt · 2 ci_attestation · 3 current_limits · 4 claim_ledger · 5 repo_state · 6 operator_declaration · 99 ai_text(never)
```

## Truth labels

```text
VERIFIED  exact evidence match (pointer required to be public)     DERIVED   computed from verified inputs
DECLARED  founder/operator testimony (honest, not measured)        PREVIEW   designed-not-live surface
UNKNOWN   no trusted evidence (NOT public truth)                   REJECTED  contradicts evidence / live w/o proof
REMOVED   flagged unsafe/misleading
```

## Input / Output Contract

```js
runPublicMetricClaimGatePreview({ consent, input })
// input = { claims: [{ id, text, metric, asserted_value, kind }], evidence: { <metric>: { value, source_class, pointer } } }
```
Exact consent: `GO: public metric claim gate preview`

```text
schema · truth_label · ok · status · content_hash · claim_count · label_counts
public_displayable_count · rejected_count · unknown_count
bindings[] (id · metric · asserted_value · label · public_displayable · evidence_pointer · evidence_source_class · reason)
boundary (all-false) · mint_allowed:false · authority_delta:0 · blocked_by[]
```

## Verification

```js
verifyPublicMetricClaimGatePreview(payload)
```
Body-bound re-derivation PLUS re-derivation of **every binding** from its (claim, evidence) pair — a
REJECTED laundered to VERIFIED, or a non-displayable label marked public, is rejected.

## What this does NOT prove

It does not extract claims from raw copy (claims are supplied structured) and does not fetch/measure
evidence (injected). It cannot certify that an injected evidence value is itself true — only that a
public claim matches its cited evidence exactly. Isomorphism is recognition-only, never truth. No
model, network, deploy, mutation, or mint.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/public-metric-claim-gate-preview.js
tests/public-metric-claim-gate-preview.test.js
scripts/review/public-metric-claim-gate-preview-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/PUBLIC_METRIC_CLAIM_GATE_PREVIEW_1A.md
docs/02-architecture/PUBLIC_METRIC_CLAIM_GATE_PREVIEW_v0_1.md
```

## Commands

```bash
node --test tests/public-metric-claim-gate-preview.test.js
node scripts/review/public-metric-claim-gate-preview-check.mjs --json
npm test
npm run check
```
