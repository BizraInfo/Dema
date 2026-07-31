# G0 Witness Pack — assembly receipt

Truth label: `DECLARED` · assembly metadata only · not a verification of the product.

## Assembled

| Artifact | Role |
| --- | --- |
| `docs/gtm/G0_PRIVATE_WITNESS_BUNDLE.md` | Pack index |
| `docs/gtm/G0_PRIVATE_SEND_GO_CARD.md` | Send halt / GO phrase |
| `docs/gtm/NODE0_EVALUATOR_DEMO_SCRIPT.md` | Evaluator script |
| `docs/CURRENT_LIMITS.md` | Public limits (on target SHA) |
| `docs/BIZRA_THIRD_PARTY_EVALUATION_PACK_v0_1.md` | Evaluation Pack canon (if present on SHA) |

## Freeze rule

Bind sends to an exact main SHA after D3 freeze. This file does not name a SHA until freeze.

## Non-claims

- No send performed by writing this receipt
- No Layer-1 substitute for `npm run eval:layer1` / artifact-safety on each file
- No production signing posture (TASK-029 open)
- No G1 launch
