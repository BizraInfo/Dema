# Binder Item 03 · ADR-009 POI Design · Accepted

> **Pointer**: the canonical ADR lives at `docs/06-adr/ADR-009-poi-proof-of-impact-design.md`. Status: **Accepted** (2026-05-19 GST via typed-GO `GO accept ADR-009 and ADR-014`).

## TL;DR

POI (Proof-of-Impact · 7th BIZRA pillar) is the canonical mapping from a verified receipt chain to a per-`node_uid` impact score. POI v0.1 is:

- **Proof-gated** (every input is receipt-bound)
- **Local-first** (every node computes its own score)
- **Verification-only at v0.1** (NO reward · NO payout · NO token)
- **Riba-Zero coherent** (no time-decay extraction)

## The 5 canonical refusals (binding)

| # | Refusal |
|---|---|
| 1 | NO reward issuance · NO token · NO payment · NO IMP · NO entitlement claim |
| 2 | NO cross-node score comparison (federation not yet shipped) |
| 3 | NO external attestation (scores not published/broadcast/signed) |
| 4 | NO time-weighted scoring (Riba-Zero invariant) |
| 5 | NO speculation surface (no expected_future_poi · no poi_velocity) |

## The output envelope shape (when POI v0.1 ships)

```json
{
  "schema":      "bizra.dema.poi_preview.v0.1",
  "truth_label": "NODE0_LOCAL_SEED",
  "mode":        "preview_only",
  "node_uid":    "<from buildUserProfile>",
  "receipt_count": <N>,
  "poi_score_preview": <deterministic float>,
  "score_method": "v0.1-canonical",
  "boundary":    "<canonical 16-key, all false>"
}
```

## The 5 activation gates (when POI v0.1 implementation may begin)

| Gate | Required | Current state (2026-05-19) |
|---|---|---|
| 1 | Ring-1 N=1 reviewer engaged with Lighthouse Pack + written feedback | ❌ NOT YET (your reading of this binder is the start of this gate) |
| 2 | v0.1c onboarding landed (profile.language wiring) | ✅ DONE (ADR-011 + language picker shipped) |
| 3 | Operator types `GO impl POI v0.1` | ⏸️ awaits your feedback first |
| 4 | ≥15 adversarial tests prepared | ❌ NOT YET |
| 5 | Proof-Forge receipt upon completion | ⏸️ automatic post-impl |

## Cross-reference

- Full ADR: `docs/06-adr/ADR-009-poi-proof-of-impact-design.md` (192 lines)
- Status field: `Status: Accepted` (line 3)
- Acceptance receipt: #71 (`2026-05-19_140251`)
- Truth label: `ADR_009_AND_ADR_014_ACCEPTED_FOR_PRIVATE_WITNESS_GTM`
