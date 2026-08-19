# APR Node0 Route Refinery Preview v0.1

**Slice:** `APR-NODE0-ROUTE-REFINERY-PREVIEW-1A`
**Truth label:** `APR_NODE0_ROUTE_REFINERY_PREVIEW_ONLY`

## Purpose

APR critiques and refines AASR route previews before any route can be treated as
action-eligible. It is a preview-only quality gate between state routing and any
future governed action surface.

## Inputs

```js
buildAprNode0RouteRefineryPreview({
  aasr_route_preview,
  proof_requirements,
  risk_policy,
  consent_policy,
  improvement_policy,
  previous_state_hash,
  boundary
})
```

## Output Contract

The preview emits:

- schema and truth label
- refinery stage
- input route id
- route quality score
- proof gap analysis
- consent gap analysis
- risk gap analysis
- overclaim analysis
- recommended route adjustments
- safe next action recommendation
- `blocked_by` array of reason codes
- chained refinement block preview
- all-false boundaries
- what this proves / does not prove

## Refinement Law

APR may analyze and score a route preview. It may recommend safer wording,
missing proof, consent collection, or risk reduction. It may not execute,
approve, mutate, write, publish, or invoke anything.

## Hard Boundaries

The 1A refinery does not:

- execute a route
- scan files or devices
- mutate files
- read content
- perform OCR or embeddings
- use network
- write URP state
- mint tokens
- access wallets
- transfer assets
- start a daemon
- invoke a model
- perform autonomous action

## What This Proves

This proves APR can critique an AASR route preview and deterministically separate
proof, consent, risk, and overclaim gaps into a chained refinement preview.

## What This Does Not Prove

This does not prove live APR, live RSI, reward, federation, economic settlement,
runtime autonomy, model reasoning, or execution of any route.
