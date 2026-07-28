---
id: TASK-039
title: 'NODE-INVITE-CODE-1A: beta invitation codes — designed, deliberately deferred'
status: To Do
assignee: []
created_date: '2026-07-28 07:25'
labels:
  - cli
  - beta
  - deferred
dependencies: []
references:
  - packages/core/src/node-registry-preview.js
  - packages/fate/src/fate.js
  - packages/core/src/node0-receipt-signing-ed25519.js
priority: low
type: feature
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Designed 2026-07-28 with the operator, then DELIBERATELY NOT BUILT. This task exists so the design is not re-derived from scratch later, and so the reason for deferring is on record.

## Why deferred

Access control for the closed beta is already solved: the repo is private and testers are added as GitHub collaborators. At the intended wave size (5-8 people) that IS the throttle, at zero code cost. Ordinals can be assigned by hand — `packages/core/src/node-registry-preview.js` already allocates them, already models `ghost_preview` slots, and already emits the exact-string claim phrase `"GO accept Node<N> ordinal"` (ADR-005).

Three further reasons:

1. The community/market-value motivation only lands once the credential is unforgeable, and that requires an Ed25519 issuer key — an operator-only halt gate that is not yet done. Building now ships the weakest version of the feature that motivated it.
2. Dema is local-first with no shared runtime (`federation_invoked` false), so there is no server capacity to protect. The seat cap protects operator attention, which collaborator count already caps.
3. Opportunity cost. A pure kernel, CLI verbs, manifest, ~10 tests, an ADR and a `CURRENT_LIMITS` row is a full slice, spent on a problem eight GitHub invitations solve today — and it does nothing for the actual goal, which is reducing how much each tester needs the operator. Onboarding quality does that; a gate does not.

## Trigger to revisit

Build this when EITHER holds:

- The repo goes PUBLIC. GitHub collaborators stops being the throttle at that moment and the code becomes the real gate. This is the likely trigger, since community contribution by freelance developers requires a public repo.
- Wave size exceeds roughly 20 testers, where hand-assigned ordinals and by-name attribution stop scaling.

## The design, as settled

Approach chosen: hash-commitment manifest. Rejected alternatives: Ed25519-signed self-contained tokens (needs the key ceremony, blocks on the operator) and HMAC-derived codes (verification requires the issuing secret, which would hand invitees issuance power).

Critical structural point — the gate and the credential have OPPOSITE lifespans, and conflating them was the first draft's error:

    GATE (deleted at GA)          CREDENTIAL (permanent)
    --------------------          ----------------------
    invites.json manifest         ordinal + label + arrival
    seat cap by construction      non-transferable
    dema invite redeem verb       hash-committed at issuance
                                  Ed25519-signed after ceremony

Components:

- `packages/core/src/node-invite-code.js` — pure kernel: `deriveCodeHash`, `verifyInviteCode`, `buildRedemptionPlan`. No fs, no clock, no random; entropy and time injected.
- `apps/cli/src/commands/invite.js` — `dema invite issue <name>`, `dema invite redeem <code>`, `dema invite list`. Space-subcommands per ADR-012; no new kebab verbs.
- `invites.json` — tracked manifest, salted hashes only. Plaintext codes never committed; they live in the operator's local ledger under DEMA_HOME.
- Reused unchanged: `node-registry-preview.js` for ordinal allocation and `FORBIDDEN_ORDINALS {3,4}` (per `docs/canon/canon_registry.json`; refuses with `ordinal_forbidden_by_canon_registry`), and `packages/fate/src/fate.js` `evaluateConsent` for the claim phrase.

Flow: operator issues a 128-bit code, manifest gains {hash, ordinal, label}, operator commits and sends the code out-of-band. Tester pulls, runs `dema invite redeem <code>`, the hash matches, a `ghost_preview` slot opens at that ordinal, and the tester types the exact claim phrase to promote it to accepted.

Designed for deletion: dependencies point ONE way only — invite imports registry, never the reverse, and no other module may import the invite kernel. At sunset, delete the manifest, kernel and verb; nothing else breaks, because enrollment records were already written in the registry's own shape. No migration. Interim behaviour: absent or empty manifest makes `dema invite` inert, so "beta over, everyone installs normally" is the default rather than a special mode.

Boundary: pure kernel, `preview_only`, canonical 16-key boundary deep-equal all-false, `federation_invoked` and `node_connection_performed` false. Nobody connects to anybody — each invitee runs their own Node0. Dema does not mint receipts (CLAUDE.md); redemption writes a receipt-SHAPED local record with `no_mint: true`, matching `dema evidence receipt preview`.

Refusals, each named rather than thrown: unknown code, already-redeemed code, ordinal collision, forbidden ordinal, wrong claim phrase (exact match only — no fuzzy, no case-fold), manifest absent.

Tests, red first: kernel purity, hash determinism, 128-bit entropy, forged code rejected, TAMPERED MANIFEST ENTRY rejected, replay of a redeemed code rejected, wrong claim phrase rejected, forbidden ordinals refused, 16-key boundary deep-equal all-false, plus a CLI integration test on a throwaway DEMA_HOME.

## Doctrinal constraint to carry forward

Codes must be NON-TRANSFERABLE and the ordinal bound to returned feedback. If codes can be traded, their value derives from artificial scarcity rather than contribution — the riba/zann shape the constitutional frame rejects — and the signal is destroyed. Bound to contribution, "Node5" means the fifth human who actually tested and sent something back, which matches `receipts = eligibility, tokens != truth`. Arrival order is a fair and ungameable basis: nobody can retroactively be earlier.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Revisit trigger has fired: the repo is public, or the tester wave exceeds ~20 — confirm which before building
- [ ] #2 Gate and credential remain separated: manifest/seat-cap/redeem verb are deletable at GA, the ordinal record persists
- [ ] #3 Invite kernel is imported by nothing; dependency points only invite -> registry, so sunset is a clean subtraction
- [ ] #4 Codes are non-transferable and the ordinal binds to returned feedback, not to arrival alone
<!-- AC:END -->
