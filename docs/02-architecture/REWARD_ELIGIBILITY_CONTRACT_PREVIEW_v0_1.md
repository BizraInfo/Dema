# REWARD-ELIGIBILITY-CONTRACT-PREVIEW-1A

Truth label: `REWARD_ELIGIBILITY_CONTRACT_PREVIEW_MEASURED_REPO`

## Purpose

Preview-only reward-eligibility contract: classifies a DEMA lifecycle outcome as reward-eligible or reward-ineligible from evidence refs, monitor state, and claim flags — inert output with no score, no authority signal, no action-permission field; forbidden claims and monitor-hiding are dominant refusals; evidence refs mandatory.

## Node0 genesis-seed framing (why this is not "a scorer with no consumer")

Node0 is the genesis constitutional seed of the BIZRA ecosystem: it must carry
the DNA that future nodes connect to. This contract is therefore **URP-facing** —
its designed constitutional consumer exists — but every live-runtime coupling is
switched **off**. DNA is not live-organism authority.

| Layer | Status now | Meaning |
| --- | --- | --- |
| Reward-eligibility law (this slice) | Buildable now | Defines what can *ever* count as reward-eligible. |
| BIZRA URP genesis DNA | Preview only | Defines the future resource-pool law Node1/Node2/… connect to. |
| SAT-5 constitutional verifier set | Preview only | Defines the verifier constitution that judges Node0 itself. |
| Reward scoring | Later | Only after the eligibility law is sealed. |
| URP live distribution | Later | Requires proof, identity, anti-fraud, consent, impact verification. |
| Mint / token / economic value | Blocked | Cannot be inferred from cost or simulated impact. |

The verdict names `designed_for_future_consumers`
(`BIZRA_URP_GENESIS_PREVIEW`, `SAT5_CONSTITUTIONAL_VERIFIER_SET`,
`FUTURE_NODE_ADMISSION_FLOW`) while pinning
`live_runtime_consumer_enabled = actuator_readable_permission = urp_live =
federation_live = false`. Verify rejects any attempt to flip these on, even with
a recomputed hash. Encode URP + SAT-5 now; activate only when proof, consent,
identity, anti-fraud, and impact verification are ready.

## Input Contract

```js
runRewardEligibilityContractPreview({ consent, input })
```

Exact consent:

```text
GO: evaluate reward eligibility
```

## Output Contract

```text
schema
truth_label
ok
content_hash
boundary.execution_allowed (false)
blocked_by[]
```

## Verification

```js
verifyRewardEligibilityContractPreview(payload)
```

Body-bound re-derivation. Tampering any field breaks the bind.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/reward-eligibility-contract-preview.js
tests/reward-eligibility-contract-preview.test.js
scripts/review/reward-eligibility-contract-preview-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/REWARD_ELIGIBILITY_CONTRACT_PREVIEW_1A.md
docs/02-architecture/REWARD_ELIGIBILITY_CONTRACT_PREVIEW_v0_1.md
```

## Commands

```bash
node --test tests/reward-eligibility-contract-preview.test.js
node scripts/review/reward-eligibility-contract-preview-check.mjs --json
npm test
npm run check
```
