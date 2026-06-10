# Claims Ledger for Impact Launchpad v0.1

> This ledger makes the Impact Launchpad idea inspectable before any public
> launch, economic mechanism, token, reward, or Proof-of-Impact runtime exists.

## 1. Truth Label

```text
DECLARED_CLAIMS_LEDGER_IMPACT_LAUNCHPAD_v0_1
```

This document is a docs-only governance ledger. It does not implement
Proof-of-Impact, launch an Impact Launchpad, compute rewards, mint tokens,
connect URP, connect Node1, create a public marketplace, or issue legal,
financial, or Shariah-compliance claims.

## 2. Source Chain

This ledger inherits from:

- `docs/CLAIM_REGISTER_v0_1.md` - public claim labels and forbidden claims.
- `docs/genesis/BIZRA_GENESIS_BLOCK_v0.1.md` - proof-before-mint covenant.
- `docs/NODE0_DEMA_URP_FLAGSHIP_DOD.md` - Gate J economy quarantine.
- `docs/06-adr/ADR-006-continuous-assurance-and-no-mint-verification.md` -
  Node0 authority, GitHub Actions witness, and no-mint verification.
- `docs/06-adr/ADR-009-poi-proof-of-impact-design.md` - Proof-of-Impact
  design contract and activation gates.
- `docs/NODE0_DEMA_COMPLETE_COMPONENT_DNA_v0_1.md` - component status labels.
- `docs/THIRD_FACT_CURRENT_STATE_DELTA.md` - current PoI/economy label:
  `DESIGNED_NOT_LIVE`.
- `docs/security/POI_0_PREFLIGHT.md` and `docs/security/ECON_0_PREFLIGHT.md` -
  preflight design notes, not live implementation authority.

Current remote-green witness for the Genesis/DOD docs slice:

| Rail                |        Run ID | Conclusion | Head SHA                                   |
| ------------------- | ------------: | ---------- | ------------------------------------------ |
| `check`             | `27077293690` | success    | `af83f662b6256ebf2be891dfb8209d38318fe5ca` |
| `BIZRA Review Gate` | `27077293678` | success    | `af83f662b6256ebf2be891dfb8209d38318fe5ca` |
| `gitleaks`          | `27077293688` | success    | `af83f662b6256ebf2be891dfb8209d38318fe5ca` |
| `CodeQL`            | `27077293694` | success    | `af83f662b6256ebf2be891dfb8209d38318fe5ca` |

These are CI witness records. Per ADR-006, GitHub Actions is not Node0
authority and does not mint canonical Node0 receipts.

## 3. Purpose

The Impact Launchpad thesis is powerful enough to create claim drift if it is
left as narrative. This ledger gives it a hard boundary:

```text
Build value -> prove impact -> bind evidence -> classify claim -> only then
consider reward eligibility in a future governed layer.
```

The ledger exists to record what may be said now, what remains forbidden, and
what evidence is required before a claim can be promoted.

## 4. Minimal Solvable Special Case

The smallest useful slice is not a marketplace, a token contract, or a scoring
engine. It is one row for one future contribution claim:

```text
Contribution C was submitted for Impact Launchpad review.
```

At v0.1 that sentence may only be classified as `DESIGNED_NOT_LIVE` or
`UNKNOWN`, depending on whether a design artifact exists. It must not be
classified as `VERIFIED`, `MEASURED`, reward-eligible, token-backed, or
financial.

This minimal case is enough because every larger future case must pass through
the same ledger fields.

## 5. Ledger Row Shape

Every future Impact Launchpad claim must be recorded with this shape before it
can leave internal drafting:

| Field                     | Required content                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `claim_id`                | Stable identifier, for example `IL-001`.                                                                                 |
| `claim_text`              | Exact sentence being considered for external or public use.                                                              |
| `claim_area`              | One of: contribution, review, impact, reward eligibility, economy, launchpad.                                            |
| `current_label`           | One Claim Register label: `VERIFIED`, `MEASURED`, `DERIVED`, `SCENARIO`, `DESIGNED_NOT_LIVE`, `UNKNOWN`, or `FORBIDDEN`. |
| `source_path`             | Repo path, receipt path, or external source request that supports the label.                                             |
| `evidence_gate`           | The next concrete proof required for promotion.                                                                          |
| `forbidden_promotion`     | The stronger claim that must not be made yet.                                                                            |
| `operator_consent_needed` | Exact consent phrase required before any governed action, if applicable.                                                 |
| `review_boundary`         | Technical, legal, Shariah, safety, or public-claim review boundary.                                                      |
| `next_action`             | The smallest next proof step.                                                                                            |

A claim with no `source_path` is treated as `UNKNOWN`. A claim whose stronger
version appears in the Claim Register forbidden list is treated as `FORBIDDEN`
until the required evidence and review gates exist.

## 6. Seed Rows

| ID       | Claim text                                                                                       | Current label       | Evidence gate                                                       | Forbidden promotion                                                   |
| -------- | ------------------------------------------------------------------------------------------------ | ------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `IL-001` | "Impact Launchpad is a proposed contribution-review lane for future Proof-of-Impact work."       | `DESIGNED_NOT_LIVE` | Dedicated spec plus Claim Register alignment.                       | Claiming the launchpad is live.                                       |
| `IL-002` | "Proof-of-Impact is the designed outcome-bound reward signal."                                   | `DESIGNED_NOT_LIVE` | ADR-009 activation gates plus implementation proof.                 | Claiming PoI rewards are live or guaranteed.                          |
| `IL-003` | "A contribution can be submitted for future impact review."                                      | `DESIGNED_NOT_LIVE` | Contribution proposal flow and review receipt shape.                | Claiming submitted work is reward-eligible.                           |
| `IL-004` | "Reward eligibility requires verified impact evidence."                                          | `DERIVED`           | Future PoI receipt chain plus review authority.                     | Claiming reward eligibility exists today.                             |
| `IL-005` | "No public economic claim is allowed before legal and Shariah review boundaries are documented." | `DERIVED`           | Legal/Shariah review boundary doc and Claim Review Gate.            | Claiming certification, halal investment status, or financial return. |
| `IL-006` | "No token, value, yield, airdrop, presale, rebate, or investment return exists in Dema today."   | `VERIFIED`          | Claim Register, Component DNA, Current Limits, and this repo state. | Any public token or investment claim.                                 |

## 7. Proof-of-Truth Convergence

Future promotion requires convergence across four rails:

| Rail          | Question                                                                                      | Minimum acceptable proof                                           |
| ------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Formal        | Does the claim follow from accepted docs, ADRs, and component labels?                         | Claim Register row plus source-chain references.                   |
| Cryptographic | Is the underlying contribution hash-bound, receipt-bound, or signed by the correct authority? | Receipt or proof artifact with stable hash and authority boundary. |
| Empirical     | Can a reviewer replay the evidence from disk or rerun a command?                              | Reproducible command, fixture, or artifact bundle.                 |
| Economic      | Does the claim avoid unearned financial, reward, or value language?                           | Explicit no-premint, no-return, and review-boundary statement.     |

If any rail is missing, the claim stays at its weaker label.

## 8. SNR Filter

Signal is actionable architectural insight:

- claim labels tied to evidence,
- promotion gates tied to commands or receipt shapes,
- explicit refusal of reward and token claims,
- exact consent before governed action,
- reviewer-readable source paths.

Noise is speculative implementation:

- token mechanics before PoI proof,
- marketplace language before URP bridge proof,
- public launch claims before Node0 closed-loop proof,
- reward language without receipt-bound impact,
- legal or Shariah claims without documented review.

When a future sentence mixes signal and noise, remove the noise first. If the
sentence cannot survive without the noise, it is not ready for external use.

## 9. Impact Launchpad Non-Claims

This ledger does not claim:

- Impact Launchpad is live.
- Public URP is live.
- UKE House of Wisdom runtime is live.
- Node1 is connected.
- Proof-of-Impact scoring is implemented.
- Any contribution is reward-eligible.
- Any token exists.
- Any token has value.
- Any reward, yield, return, airdrop, presale, rebate, or investment outcome is
  promised.
- Any legal approval, securities review, or Shariah certification exists.
- Dema can mint governed runtime receipts or economic receipts.

These phrases may appear only when explicitly labeled as non-claims or
forbidden claims.

## 10. Promotion Gates

No Impact Launchpad claim may be promoted beyond `DESIGNED_NOT_LIVE` until the
relevant gate is satisfied:

| Promotion target        | Required gate                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `DERIVED`               | Claim follows from accepted docs and cites the exact source chain.                      |
| `VERIFIED`              | A repeatable artifact, receipt, or source path verifies the claim.                      |
| `MEASURED`              | A reproducible command records conditions, output, and SHA.                             |
| Reward eligibility      | Future PoI receipt chain, review authority, legal boundary, and exact operator consent. |
| Public economic wording | Legal review, Shariah review boundary, Claim Register update, and operator approval.    |

Any proposed promotion that touches reward, token, value, or financial language
requires a separate typed GO and must not be bundled into a docs cleanup.

## 11. Ihsan Review

Ihsan discipline requires this ledger to protect three parties at once:

1. The builder, by preserving a route from contribution to fair review.
2. The reviewer, by making evidence and uncertainty visible.
3. The public, by refusing financial or reward claims before proof.

The ethical rule is simple:

```text
Do not turn hope into a claim. Do not turn a claim into a reward. Do not turn a
reward into public language until proof and review exist.
```

## 12. Next Micro

```text
GO: AUTHOR IMPACT LAUNCHPAD CONTRIBUTION PROPOSAL FLOW SPEC
```

That next document should define only the proposal flow and review receipt
shape. It must not implement scoring, token logic, marketplace behavior, or
reward eligibility.
