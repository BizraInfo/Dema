# AASR Node0 State Router Preview v0.1

**Slice:** `AASR-FILE-ACTION-AND-RESOURCE-STATE-ROUTER-PREVIEW-1A`  
**Truth label:** `AASR_NODE0_STATE_ROUTER_PREVIEW_ONLY`

## Purpose

AASR routes preview artifacts into state-block candidates. It is the bridge
between Dema's File Steward receipt atoms and the Node0 multi-device resource
body preview. It does not execute state transitions.

## Inputs

```js
buildAasrNode0StateRouterPreview({
  incoming_claim,
  file_action_receipt_preview,
  resource_manifest_preview,
  snr_weights,
  pat_sat_refs,
  consent_proof,
  compliance_policy,
  previous_state_hash,
  boundary
})
```

## Output Contract

The preview emits:

- schema and truth label
- router stage
- incoming and normalized claim
- routed artifact type
- SNR decision
- PAT/SAT preview route
- consent state
- compliance state
- resource state transition preview
- file-action state transition preview
- chained state block preview
- APR refinement recommendation
- final router verdict
- blocked reasons
- all-false boundaries
- what this proves / does not prove

## Routing Law

The router may compose preview evidence and explain the next safe state. It may
not perform the state transition. Missing consent or compliance violations block
execution while preserving an inspectable preview.

## Hard Boundaries

The 1A router does not:

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

This proves AASR can route File Steward receipt previews and Node0 resource
manifest previews into deterministic, consent/compliance-aware state-block
previews.

## What This Does Not Prove

This does not prove live APR, RSI, reward, federation, runtime autonomy, or
execution of any routed action.
