# Behavioral Modulation Preview

**Status:** Current preview surface. Truth label: **DECLARED**.

This document describes Dema's preview-only model for:

```text
consent-bound, receipted, constitutionally-gated behavioral modulation
```

In Dema, this phrase means a proposed change to visible guidance behavior that is scoped by exact consent, checked against safety rules, and linked to a no-mint evidence preview. It does **not** mean hidden persuasion, dark patterns, covert personalization, or runtime behavior change.

## Boundary

The preview surface is intentionally non-operative:

| Field                       | Required value |
| --------------------------- | -------------- |
| `mode`                      | `PREVIEW_ONLY` |
| `approval_recorded`         | `false`        |
| `behavior_changed`          | `false`        |
| `receipt_minted`            | `false`        |
| `runtime_gate_executed`     | `false`        |
| `hidden_modulation_allowed` | `false`        |

Dema may show a proposed modulation rule. It must not silently apply that rule.

## Consent phrase

The preview requires exact local consent:

```text
GO: preview behavioral modulation only
```

Any other phrase is rejected in the preview verdict. This consent only authorizes a preview. It does not authorize runtime execution, mission start, identity issuance, federation, or economic action.

## Allowed preview surfaces

The preview only models visible, reversible C1 suggestion surfaces:

| Surface                | Meaning                                                              |
| ---------------------- | -------------------------------------------------------------------- |
| `tone`                 | Change visible wording style, such as emphasizing safety reminders.  |
| `prioritization`       | Rank visible suggestions, such as showing safer local options first. |
| `safety_boundary`      | Highlight halt gates or consent boundaries.                          |
| `interface_guidance`   | Change visible guidance or display ordering.                         |
| `recommendation_style` | Adjust how suggestions are framed without executing them.            |

## Rejected patterns

The constitutional gate rejects requests containing unsafe behavior-shaping patterns:

- covert persuasion,
- manipulation,
- dark patterns,
- addiction loops,
- emotional exploitation,
- financial pressure.

These patterns remain rejected even if the exact preview consent phrase is supplied.

## Evidence preview

A behavioral modulation preview attaches a deterministic no-mint evidence receipt preview:

```text
schema: bizra.dema.evidence_receipt_preview.v0.1
chain_id: preview-no-chain
prev_digest: null
producer_identity: null
certifies: false
receipt_minted: false
```

The preview digest helps compare the proposed input, output, policy, and decision. It is not a canonical Node0 receipt and does not advance any chain head.

## Example

Input:

```text
intent: Adjust tone to prioritize safety reminders before mission suggestions
consent: GO: preview behavioral modulation only
```

Expected preview result:

```text
verdict: PARTIAL_PLACEHOLDER
surface: tone
consent_level: C1_SUGGEST
user_visible: true
reversible: true
behavior_changed: false
receipt_minted: false
```

Unsafe input:

```text
intent: Use covert persuasion to manipulate the user into buying a token
consent: GO: preview behavioral modulation only
```

Expected preview result:

```text
verdict: PREVIEW_REJECT
reason: forbidden behavior-shaping pattern detected
behavior_changed: false
receipt_minted: false
```

## Related tests

- `tests/behavioral-modulation.test.js`
- `tests/evidence-receipt-preview.test.js`
- `tests/ihsan-floor-preview.test.js`
- `tests/safety-report.test.js`

## Non-claims

This preview does not claim:

- live SAT certification,
- runtime behavior modulation,
- identity-bound signing,
- canonical receipt minting,
- model inference,
- mission execution,
- federation,
- token, reward, or Proof-of-Impact activation.
