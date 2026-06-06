# BIZRA · Open Source Engagement and Business Model v0.1

> **Truth discipline:** This file is a **claim-governed digest** for GTM and investor alignment. It does not authorize runtime actions, token mint, public claims, or economic assignment. Source: operator PDF `BIZRA_Open_Source_Engagement_and_Business_Model_v0_1.pdf` (Downloads). Academic framing: Guizani et al., _Open Source Engagement Model_ (arXiv:2303.08266).

| Field                   | Value                     |
| ----------------------- | ------------------------- |
| **Status**              | WORKING_CANON · docs-only |
| **Repo HEAD at ingest** | `004e887`                 |
| **Local test gate**     | `2443/2443` (`npm test`)  |
| **Spearpoint gate**     | `npm run proof:room`      |

## BLUF

BIZRA monetizes **assurance and replayable proof**, not speculation on a token. The open layer builds trust; the commercial layer sells **deployment, support, governance, and proof-room replay** that outsiders can verify without believing marketing copy.

## Engagement model (research mapping)

| Stage              | OSS research lens | BIZRA operational meaning                                                | Truth label                                          |
| ------------------ | ----------------- | ------------------------------------------------------------------------ | ---------------------------------------------------- |
| Founders vision    | Motivation        | Constitutional execution + receipts as product thesis                    | VERIFIED (docs + gates on disk)                      |
| Reputation         | Trust             | Lighthouse Ring-1 private witness; proof-room bundle for outsider replay | WIRED_PARTIAL (gates SHIPPED; external witness OPEN) |
| Business advantage | Differentiation   | Zero-runtime-dependency preview face + SAT-governed consent              | VERIFIED                                             |
| Reciprocity        | Sustainability    | Paid assurance lane funds continued open core                            | PLANNED                                              |

## Commercial lanes (no riba framing)

1. **Open trust layer** — Dema face, public docs, replayable local gates (`npm run check`, `gtm:readiness`, `urp:discovery`, `proof:room`).
2. **Commercial assurance** — Operator-led support, private lighthouse cohort, governed deployment, **Proof Room** export under exact-string consent.
3. **Deferred** — Token mint, PoI economic assignment, public Ring-4 claims, chain-bound URP until proof gates close.

## Proof-room as spearpoint

The investor question is not “do you have a whitepaper?” but **“can an outsider replay your proof?”**

- Read-only composition: `npm run proof:room`
- Full replay (+ unit suite): `npm run proof:room -- --full`
- Witness write (micro-consent only): `GO: write proof room bundle to artifacts/proofs/proof-room-v0.1`

Artifacts live at `artifacts/proofs/proof-room-v0.1/` when written; they are not receipts and do not imply mainnet or token events.

## Stale numbers policy

PDFs and early GTM drafts may cite `2394`, `2423`, or `2437` tests. **Current verified baseline:** `2443/2443` at HEAD `004e887`. Update outward-facing claims only after `npm run gtm:readiness` passes in CI.

## Halt gates (unchanged)

| Action                    | Required phrase                                                   |
| ------------------------- | ----------------------------------------------------------------- |
| Ring-1 pack send          | `GO send pack to <name>`                                          |
| POI test plan (no impl)   | `GO author POI v0.1 test plan (no impl)`                          |
| POI implementation        | `GO impl POI v0.1`                                                |
| Proof room artifact write | `GO: write proof room bundle to artifacts/proofs/proof-room-v0.1` |

## Daughter test

Would you subject your family to a product whose only proof is a deck? This model refuses that: **ship gates first, sell replay second, defer token narrative until witness closes.**
