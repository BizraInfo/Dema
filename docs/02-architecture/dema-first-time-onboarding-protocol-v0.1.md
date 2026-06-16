# Dema First-Time Onboarding Protocol v0.1

**Status:** `DECLARED_SPEC` / `DESIGNED_NOT_LIVE`
**Scope:** The contract for a human's first entry into a Dema-faced Node0 — the
seven-stage onboarding mechanism, the four-phase presentation view over it, and the
four entry laws (ephemeral decline, zero-model bootstrap, model-discovery independence,
preview-vs-live wording).
**Runtime boundary:** This document does not implement an onboarding runtime executor,
write a profile, scan local assets, discover or invoke a model, open a network
connection, mint a receipt, start federation, seal Block0, or make any token, PoI,
Shariah, legal, or production claim. It binds future code; it executes nothing.

## 1. Authority and Boundary

This protocol formalizes the laws already carried implicitly in source and ADR:

- `packages/core/src/onboarding-lifecycle.js` — the seven-stage mechanism (source of
  truth; this protocol must not contradict it).
- [ADR-011 Onboarding Consciousness Layer](../06-adr/ADR-011-onboarding-consciousness-layer.md)
  — the eleven binding onboarding laws (accepted; this protocol references, never rewrites).
- [FIRST_RUN_WIZARD.md](../FIRST_RUN_WIZARD.md) and
  [dema-tui-onboarding-design.md](dema-tui-onboarding-design.md) — the screen and TUI
  surfaces this protocol governs.
- [CLAIM_REGISTER_v0_1.md](../CLAIM_REGISTER_v0_1.md) — the truth-label and forbidden-claim
  authority for every word emitted during onboarding.

When the four-phase view and the seven-stage mechanism disagree, **the seven-stage
mechanism and ADR-011 govern**; the four phases are a presentation grouping only.

## 2. Non-Negotiable Invariants

1. Language is stage 0; first-mission is the last stage; the order is canon
   (ADR-011 Law 1, Law 6).
2. A node with no local model is a fully valid node (ADR-011 Law 5).
3. No raw scan without a per-scan exact-string consent gate (ADR-011 Law 3, Law 7).
4. First-time onboarding is preview-bound; it does not imply federation, POI, or any
   runtime activation (ADR-011 Law 8).
5. Every word emitted during onboarding carries a truth label or is preview-safe
   (no live-action wording before runtime exists).

## 3. Canonical Mechanism — The Seven Stages

The mechanism is the seven-stage progression exported as
`ONBOARDING_LIFECYCLE_STAGE_IDS` from `packages/core/src/onboarding-lifecycle.js`. The
order is canon and a rearrangement is a doctrine violation:

1. `language`
2. `technical_level`
3. `node_role`
4. `purpose`
5. `resources`
6. `consent_constitution`
7. `first_mission`

This protocol is a contract over those exact stage ids. A determinism test binds this
list to the source export so the spec cannot drift from the mechanism.

## 4. Presentation View — Four Phases Over Seven Stages

The four-phase rail is a **presentation grouping** for human storytelling. It does not
replace or reorder the seven stages; it labels them. The mapping is fixed:

| Phase         | Stages it presents                                                                 |
| ------------- | ---------------------------------------------------------------------------------- |
| Bond          | `language` + a name/identity bond                                                  |
| Foundation    | `technical_level` + `node_role` + `purpose` + `resources` + `consent_constitution` |
| Discovery     | asset map (descriptor-first) + model-capability discovery                          |
| First Mission | `first_mission`                                                                    |

Phase order is canon: **Bond → Foundation → Discovery → First Mission**. Discovery sits
between consent and the first mission because both asset mapping and model discovery are
consent-gated descriptor steps (Section 7), not part of the constitutional stage spine.

## 5. Law 1 — Ephemeral / Decline Mode

A candidate may decline foundation. The ephemeral path is first-class:

- In ephemeral mode, onboarding persists nothing — no profile, no memory, no inventory,
  no receipt. The boundary attestation holds `filesystem_write_performed: false`.
- Post-decline wording changes accordingly. Allowed: "session ready", "nothing was saved",
  "session preview prepared in memory only". The decline path must not imply durable state.
- Re-entry after an ephemeral session starts clean; nothing carries over.

## 6. Law 2 — Zero-Model Bootstrap Mode

Dema operates with no model present (ADR-011 Law 5):

- Bootstrap Mode is the model-less shell: every onboarding stage and every spine surface
  completes with no model downloadable, present, or invoke-able.
- The model is an optional engine, discovered downstream (Section 7), never assumed.
- A model-less node is not a degraded node; it is a complete node.

## 7. Law 3 — Model-Discovery Independence

Asset mapping and model-capability discovery are independent, consent-gated, descriptor-first
steps (ADR-011 Law 3, Law 4, Law 7):

- Skipping asset mapping must not skip model-capability discovery, and vice versa.
- Mapping tier 0 (no assets declared) still reaches model-capability discovery.
- Neither step performs a raw scan without its own per-scan exact-string consent phrase;
  the answer is captured as a descriptor (a labeled operator estimate), not a scan.

## 8. Law 4 — Preview-vs-Live Wording

Before an onboarding runtime exists, no word may imply a live, durable, or proven act.

- Allowed wording: `preview`, `receipt preview`, `boundary held`, `session ready`.
- Forbidden as live wording (until runtime + receipt exist): `create`, `verified`,
  `proof exists`, `node is born`. These terms may appear only here, in this forbidden
  list, never as a live claim elsewhere in onboarding copy.
- Every emitted claim carries a truth label per `CLAIM_REGISTER_v0_1.md`.

## 9. Daily-Loop Separation

First-time onboarding is distinct from the daily closed loop
(Seed → Assumption → Meaning → Consent → Receipt → Growth). The daily loop is named here
for boundary clarity and specified elsewhere; this protocol governs first entry only.

## 10. Reuse Map (DECLARED, not implemented here)

A future Bootstrap-Mode runtime composes existing kernels; it does not reinvent them:

- `packages/core/src/onboarding-seal.js` — the nine-invariant onboarding seal evaluator.
- `packages/consent/src/consent-common.js` + `packages/fate/src/fate.js` — exact-phrase
  consent hashing and verdict.
- `packages/models/src/model-broker-preview.js` — model routing with no invocation.
- `packages/core/src/local-asset-awareness.js` — metadata-only asset inventory (descriptor).
- `packages/agents/src/agent-profile-registry.js` — the PAT-7 profile registry.
- `packages/verifier/src/evidence-receipt-preview.js` — preview receipts vs signed receipts.

## 11. Replay and Test Requirements

The determinism test (`tests/onboarding-protocol-determinism.test.js`) enforces:

1. The status line declares `DECLARED_SPEC` / `DESIGNED_NOT_LIVE`.
2. The seven stage ids in Section 3 exactly match `ONBOARDING_LIFECYCLE_STAGE_IDS` from
   `packages/core/src/onboarding-lifecycle.js`, in order (spec↔code drift guard).
3. The four-phase mapping table exists and the phase order is Bond → Foundation →
   Discovery → First Mission.
4. Law 1 ephemeral decline path and "nothing was saved" wording are present.
5. Law 2 Bootstrap Mode (model-less / no model required) is present.
6. Law 3 declares tier-0 still reaches model discovery and asset-map skip is independent
   of model-discovery skip.
7. Law 4 forbidden-wording list and allowed-wording list are present; `node is born`
   appears only inside the forbidden list.
8. A canonical onboarding-protocol descriptor (phases → stages + laws) hashes
   deterministically (key-order independent) and a changed field diverges.

## 12. Non-Claims / Forbidden Wording

This protocol does not claim any of the following — each named here only as a
forbidden claim, never asserted: `live onboarding runtime`, `durable profile creation`,
`performed scan`, `discovered or invoked model`, `federation`, `POI`, `token economy`,
`Block0 seal`, `legal or Shariah readiness`, `production readiness`. Onboarding is
preview-bound until a governed runtime and receipt evidence prove otherwise.
