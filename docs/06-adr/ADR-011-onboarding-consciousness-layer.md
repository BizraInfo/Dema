# ADR-011: Onboarding Consciousness Layer

**Status:** Accepted
**Date:** 2026-05-18 (proposed) · 2026-05-19 (accepted with v0.2 scope extensions: returning-user language load · second language capture · Genesis Preview Card)
**Decision makers:** Mumu (Mohamed Beshr)
**Supersedes:** none (extends ADR-008 §C1.5 model-readiness boundary + ADR-005 consent discipline + ADR-010 v0.2 framework)
**Related:** [ADR-001 Dema Is One Face](ADR-001-dema-is-one-face.md), [ADR-002 No Shadow State](ADR-002-no-shadow-state.md), [ADR-005 Operator Actions Require Explicit Consent](ADR-005-operator-actions-require-explicit-consent.md), [ADR-008 Runtime Activation](ADR-008-runtime-activation.md), [ADR-009 POI Design](ADR-009-poi-proof-of-impact-design.md), [ADR-010 Interactive TUI Layer · Dep Decision](ADR-010-interactive-tui-layer-dep-decision.md), [Law of Assumption](../canon/LAW_OF_ASSUMPTION.md), [BIZRA Topology Canon](../canon/BIZRA_TOPOLOGY_CANON.md)
**Implements:** the constitutional framework for **how a human enters BIZRA**. Defines the law that every operator-facing onboarding surface must obey — the existing 11th canonical spine surface `onboarding-lifecycle` (shipped 2026-05-18 commit 70e3233), the planned v0.1c language picker for Samy's Node1 device first-boot (named in `~/.dema/memory/node1-acceptance-2026-05-18.json` next_phase), and any future onboarding-adjacent surface (welcome flow · install handshake · invitation rendering).
**Evidence:**
- 11th spine surface `onboarding-lifecycle` operational at HEAD `89d5eff` via `packages/core/src/onboarding-lifecycle.js` (CANONICAL_STAGES exports 7-stage flow · stage 0 is `language` · enforces `refuse_to_advance_past_language_stage_without_language_set` · forbids `skip_language_stage`)
- Memory anchor `~/.dema/memory/node1-acceptance-2026-05-18.json` next_phase names `v0_1c_language_picker_for_samys_device_first_run` as deferred work
- Memory `feedback_ux_storytelling_data_viz_onboarding_key_to_user_in.md` (2026-05-18) names the 5 dimensions (UX · onboarding flow · feeling real · storytelling · data viz) as the load-bearing test for every operator-facing surface
- Memory `project_2026_05_18_law_of_assumption_canonized_repo_level.md` (this morning's session) canonizes the 4-claim-state discipline (V/D/A/U) that every onboarding emission must carry
- Operator quote on this ADR's commit context: *"dema must embody this dna inside its persona · whis will make sure that dema output have deeply meaning"*

---

## Context

At HEAD `89d5eff` BIZRA / Dema has:

1. **A visible homebase** — bare `dema` on TTY renders the 14th canonical spine surface (`bizra.dema.homebase_v0_1.v0.1`) with the operator's name, memory, status, and the Law of Assumption citation in the boundary footer.
2. **An operational onboarding lifecycle** — the 11th spine surface (`bizra.dema.onboarding_lifecycle.v0.1`) already implements a 7-stage flow with language as stage 0, refusing to advance past language until set.
3. **A constitutionally accepted Node1** — Samy typed `GO accept Node1 ordinal` at Node0's terminal in person at 12:25 GST today; witness inscribed at `~/.dema/memory/node1-acceptance-2026-05-18.json`. His device install is pending.
4. **A bound framework for v0.2 interactive TUI** — ADR-010 Accepted Option D · zero-deps interactive layer.

What is **not** yet canonized as ADR-level law:

- The relationship between the existing onboarding-lifecycle surface and Samy's eventual device first-boot.
- The constitutional gates that any onboarding surface must satisfy regardless of which implementation renders it.
- The handling of **model-less nodes**, **technical/non-technical operators**, **non-English first-speakers**, and **unknown model state**.
- The boundary between onboarding and federation (a node onboarding does NOT imply federation; the artifact must declare this).
- The boundary between onboarding and POI (onboarding does NOT generate proof-of-impact; the artifact must declare this).

This ADR closes that gap **before** Samy's operational install or any second external human attempts to enter.

## Problem

Without an ADR-level onboarding law:

1. **Onboarding can drift into UX feature work** instead of constitutional integrity work. The 5-dimensions feedback canon (2026-05-18) names this risk: technical correctness without UX/storytelling/feeling-real doesn't reach humans.
2. **Each new external human becomes a one-off** rather than a structurally-receivable case. Samy's install at HEAD `89d5eff` would test whether the install path works; it would *not* test whether the onboarding law is canonical because the law isn't yet inscribed.
3. **The existing onboarding-lifecycle surface ships a 7-stage flow but its laws are implicit** — they live in source-code constants (`CANONICAL_STAGES`) and refusal arrays without a canon-doc explaining *why language must be stage 0* or *why model-less nodes are valid*.
4. **Model-readiness ambiguity is unresolved.** ADR-008 §C1.5 (Local Model Inventory Scan) declared model scanning requires consent · but onboarding doesn't yet enforce that a model-less node is a valid sovereign node. A new user without local LLMs must still be able to fully onboard and use Dema preview-only.
5. **Daughter Test failure mode**: a non-technical, non-English-speaking, model-less candidate must be able to enter BIZRA without being confused, scanned without consent, connected without choice, or coerced into any technical assumption they didn't make. If the first 60 seconds fail the Daughter Test, the message has not reached them.
6. **POI/federation contamination risk**: without explicit onboarding-doesn't-imply-federation/POI law, future implementers may bind onboarding outputs to federation activation by mistake.

## Design — onboarding consciousness law

This ADR specifies the framework. No new code lands under this ADR. Implementation slices arrive under separate typed-GO phrases inscribed at the bottom.

### Definition

**Onboarding Consciousness (OC)** is the canonical discipline by which any human enters BIZRA as a sovereign node. OC is:

- **Language-first** — the first exchange is the operator's choice of language. Identity, technical level, model state, device specifics, and consent for any scan come AFTER language is set.
- **Comprehension-bound** — consent is invalid if the operator did not understand the text they typed. Language is therefore the prerequisite for consent (ADR-005 strict-form exact-string consent depends on the operator understanding the phrase).
- **Model-agnostic at entry** — a candidate without local LLMs is a fully-valid Node-N. Model scanning, model invocation, and model routing all happen on consent gates downstream of onboarding completion. A model-less node can preview every surface, render the homebase, and operate the entire canonical spine.
- **Topology-aware** — onboarding declares the candidate's ordinal (Node0, Node1, Node2, ...) per `BIZRA_TOPOLOGY_CANON.md` "Node ordinal law". Ordinal monotonicity is enforced: Node-N requires N-1 paired-receipt evidence; ordinals 3 and 4 are forbidden per `canon_registry.json:forbidden_topology_phrases`.
- **Descriptor-first** — when onboarding asks about resources (storage capacity · model inventory · network state), the answer is captured as a **descriptor** (a labeled estimate the operator declares) — NOT as a raw scan. A scan happens only after a separate consent gate with its own ADR-005 phrase.
- **Preview-only at output** — every onboarding emission is `mode: "preview_only"` with `federation_invoked: false`, `chain_advance_performed: false`, `receipt_mint_performed: false` until explicit graduation gates fire. Onboarding never auto-activates downstream pillars.

### Eleven binding laws

```text
1. Language before identity.
   The first question is "What language should I speak with you?"
   Identity questions (name · operator role · node ordinal) come AFTER.

2. Understanding before consent.
   No ADR-005 exact-string consent is valid if the operator did not
   understand the phrase. Consent in an unknown language is structurally
   invalid · the operator's typed string must be readable to them.

3. Consent before scan.
   No file system, model inventory, network, or device scan happens
   without a per-scan exact-string consent phrase. The existence of a
   user account is not blanket consent for any scan.

4. Scan before model use.
   Even after a model inventory scan completes, model invocation
   requires an additional consent gate (per ADR-008 §C1 LLM Adapter).
   Knowing a model exists ≠ permission to invoke it.

5. Model-less node validity.
   A node with zero local models is a sovereign Node-N. Onboarding
   MUST complete without requiring any model to be present, downloadable,
   or invoke-able. Every spine surface MUST work on a model-less node.

6. Node ordinal monotonicity.
   Node-N candidacy requires Node-(N-1) paired-receipt evidence (the
   witness file from the prior node's typed-GO ceremony). Ordinals 3
   and 4 are forbidden. Companion devices share an ordinal; they do
   not increment it.

7. Descriptor before raw resource.
   Onboarding captures resource information as operator-declared
   descriptors (text labels with operator-supplied estimates), not as
   scanned raw inventory. Scanning is a downstream consent gate, not
   an onboarding step.

8. Preview before federation.
   Completing onboarding does NOT activate federation, does NOT trigger
   POI scoring, does NOT publish anything, does NOT modify the receipt
   chain. All these require explicit, separate, typed-GO phrases at
   their own gate ADRs.

9. Returning-user language load before re-asking.
   If `~/.dema/profile.json::language_code` is set, the language stage
   loads from disk and does NOT re-prompt. Re-prompting an established
   operator for their own language is a structural error — it implies
   the system has forgotten who they are. Only first-run candidates
   (profile.json absent OR language_code null) see the language picker.
   An operator may explicitly invoke `dema onboard --reset-language`
   to re-ask · the default path is silent load.

10. Second language as fallback dignity.
    After the primary language is set, the candidate is OPTIONALLY
    asked for a secondary language. The default answer is "skip" and
    a single press of Enter accepts it. The secondary language enables:
    (a) fallback display when a primary-language string is missing,
    (b) bilingual consent phrase rendering ("GO: ... (primary)" / "GO:
    ... (secondary)") for operators who want to read the consent
    phrase in their stronger comprehension language while the system
    accepts either form. NEVER required · NEVER auto-detected · NEVER
    inferred from typing patterns.

11. Genesis Preview before mint.
    Onboarding completion produces a **Genesis Preview Card** — a
    deterministic preview-only JSON artifact representing what an
    onboarding receipt WOULD look like if minted. The card is shown
    to the candidate, printed to terminal, and stored under
    `~/.dema/state/` (NOT under `~/.dema/receipts/`). The actual
    receipt mint requires a separate typed-GO that quotes the card's
    `receipt_id_preview` hash. Card emission is NOT a chain-advance,
    NOT a receipt write, NOT an external publication. See § Genesis
    Preview Card below for the canonical schema.
```

### Canonical refusals (binding regardless of implementation)

```text
NEVER:
  · skip_language_stage
    (canon: language is stage 0 · advancing past it without selection
     is structurally invalid · the existing onboarding-lifecycle.js
     already enforces this via refuse_to_advance_past_language_stage_
     without_language_set; ADR-011 inscribes the rule.)

  · accept_consent_typed_in_a_language_the_operator_did_not_set
    (the operator must have chosen the language they then type consent
     phrases in · ADR-005 strict-form depends on this.)

  · scan_files_models_or_network_without_separate_consent_gate
    (onboarding completion is NOT a blanket scan license · each scan
     has its own exact-string phrase.)

  · auto_invoke_model_after_inventory_scan_completes
    (knowing models exist ≠ permission to load/invoke them · separate
     consent per ADR-008 §C1.)

  · require_model_presence_for_onboarding_to_complete
    (model-less node validity · onboarding completion must work with
     zero local LLMs detected.)

  · auto_advance_to_federation_after_onboarding
    (no federation handshake fires from onboarding completion.)

  · auto_advance_to_POI_after_onboarding
    (POI is design-only per ADR-009 · no scoring fires from onboarding.)

  · capture_raw_device_inventory_during_onboarding
    (descriptors only · raw inventory needs its own gate.)

  · publish_onboarding_output_to_any_external_surface
    (onboarding emissions are preview-only · local-only · no public
     broadcast · no telemetry.)

  · re_ask_language_to_established_operator
    (per Law #9 · if profile.json carries language_code, language
     stage MUST silently load · re-asking implies amnesia.)

  · require_second_language_to_proceed
    (per Law #10 · secondary language is OPTIONAL · default is "skip"
     · the candidate must be able to advance with a single Enter.)

  · auto_detect_language_from_keyboard_or_locale
    (language must be operator-declared · not inferred from system
     locale, keyboard layout, IP, typing patterns, or any signal that
     bypasses the operator's explicit declaration.)

  · mint_onboarding_receipt_without_quoted_genesis_card_hash
    (per Law #11 · the receipt mint typed-GO MUST quote the Genesis
     Preview Card's receipt_id_preview · this binds the mint to a
     specific preview the candidate saw.)
```

### Canonical output schema (proposed extension)

The existing 11th surface emits `bizra.dema.onboarding_lifecycle.v0.1`. ADR-011 extends this with additional optional fields **without** introducing a new parallel schema (preserves single-source-of-truth for onboarding):

```jsonc
{
  // existing fields (already shipped at commit 70e3233):
  "schema": "bizra.dema.onboarding_lifecycle.v0.1",
  "truth_label": "NODE0_LOCAL_SEED",
  "mode": "preview_only",
  "stages": [/* 7 canonical stages · language is stage 0 */],
  "current_stage": "<stage_id>",
  "boundary": { /* canonical 16-key · all false */ },

  // ADR-011 extensions (proposed · not yet implemented):
  "node_topology": {
    "current_ordinal": 0,                   // Node0 by default
    "candidate_ordinal": null,              // null until onboarding for a new node
    "paired_receipt_required": true,        // for ordinal ≥ 1
    "paired_receipt_id": null,              // populated from prior-node witness
    "ordinal_monotonicity_verified": false  // gate
  },
  "model_readiness": {
    "status": "MODEL_UNKNOWN",              // MODEL_UNKNOWN | MODEL_LESS_DECLARED |
                                            // MODEL_INVENTORY_PENDING_CONSENT |
                                            // MODEL_INVENTORY_DECLARED | MODEL_AVAILABLE
    "local_models_required": false,         // never true
    "scan_consent_required": true,
    "scan_performed": false,
    "model_invocation_allowed": false,
    "fallback_path": "continue_model_less_onboarding"
  },
  "language_state": {
    "language_set": false,
    "language_code": null,                  // ISO 639-1 when set (primary / mother tongue)
    "consent_phrases_will_render_in": null, // matches language_code when set
    "secondary_language_code": null,        // ISO 639-1 · optional · operator-declared
    "secondary_language_offered": false,    // true once Law #10 prompt fires
    "returning_user_load": false,           // true if loaded silently from profile.json (Law #9)
    "language_source": "unset"              // unset | first_run_picker | profile_load | reset_explicit
  },
  "candidate_lifecycle": {                  // NEW · explicit first-run vs returning-user
    "is_first_run": true,                   // false when profile.json exists with required fields
    "is_returning_user": false,             // true when profile.json loaded silently
    "onboarding_trigger": null,             // "first_run" | "reset_explicit" | "candidate_invite"
    "stage_skipped_due_to_profile": []      // list of stage_ids skipped via Law #9 / returning-user load
  },
  "blocked_effects": {                      // separate from canonical boundary · 
                                            //   these are onboarding-specific blocks
    "federation": true,
    "raw_data_sharing": true,
    "public_broadcast": true,
    "economic_activation": true,
    "poi_scoring": true,
    "model_scan_without_consent": true,
    "model_invocation": true,
    "auto_advance_to_node_n_plus_1": true
  }
}
```

The `current_node`, `next_node`, `model_readiness`, and `blocked_effects` extensions are the new contractual surface ADR-011 binds. The implementation slice (under separate typed-GO) lands them into the existing `onboarding-lifecycle.js` builder.

### Daughter Test predicates

The following predicates MUST hold for any onboarding implementation to claim ADR-011 compliance:

```text
P1 · A non-English-speaking candidate can complete onboarding by
     selecting their language as stage 0 and seeing every subsequent
     prompt in that language.

P2 · A non-technical candidate sees no jargon at stage 0-2 that would
     embarrass them or make them feel they're failing a test.

P3 · A model-less candidate completes onboarding without ever being
     prompted to install, download, or scan for a model.

P4 · A candidate who does not know their model state selects
     MODEL_UNKNOWN and proceeds — onboarding does not gatekeep on
     model declaration accuracy.

P5 · A candidate who quits onboarding mid-flow leaves no scan trace,
     no federation handshake, no published artifact. Their ~/.dema/
     contains only what they explicitly typed.

P6 · A candidate is never asked to consent to anything they cannot read.

P7 · Onboarding completion does NOT add the candidate to any external
     ledger, network, or registry without a separate explicit gate.

P8 · A returning operator (profile.json carries language_code) opens
     `dema` and is NEVER re-asked for their language. The system loads
     it silently and renders subsequent text in that language. Only
     `dema onboard --reset-language` (explicit) re-asks.

P9 · A candidate may decline the second language with a single press
     of Enter. The second-language stage NEVER blocks advancement.
     A candidate who declines secondary language sees the same
     downstream experience as one who supplies it (no penalty, no
     reduced-function path).

P10 · A candidate who completes the 7-stage flow sees a Genesis Preview
      Card BEFORE any receipt mint fires. The card is human-readable,
      shows what would-be-minted, and explicitly states no mint has
      occurred. The candidate may close the session at this point with
      zero side effect on the chain.
```

Each predicate becomes a test in the eventual implementation slice (`tests/node-onboarding-adr011-compliance.test.js` or similar).

---

## Genesis Preview Card · ADR-011 v0.2 extension

The Genesis Preview Card is the canonical preview-only artifact that represents what an onboarding receipt would look like if the candidate typed the consent phrase. It is the **bridge between completing the 7-stage flow and minting a receipt** — and the bridge MUST exist so the candidate can SEE what would be written about them before they authorize it.

### Canonical schema

```jsonc
{
  "schema": "bizra.dema.genesis_preview_card.v0.1",
  "truth_label": "NODE0_LOCAL_SEED",
  "mode": "preview_only",
  "card_type": "onboarding_completion_genesis",
  "candidate": {
    "node_ordinal": 0,                          // or 1, 2 per ordinal law
    "preferred_name": "<operator-declared>",
    "primary_language": "<ISO 639-1>",
    "secondary_language": "<ISO 639-1 | null>",
    "device_label": "<string | null>",
    "model_readiness": "MODEL_UNKNOWN",         // per model_readiness enum
    "technical_level": "<self-declared scale>"
  },
  "would_mint_if_consented": {
    "receipt_type": "node_onboarding_genesis.v0.1",
    "receipt_id_preview": "<sha256 of canonical card payload>",
    "consent_phrase_required": "<exact ADR-005 phrase rendered in primary_language>",
    "consent_phrase_secondary": "<same phrase in secondary_language · null if not set>",
    "mint_destination": "~/.dema/receipts/node-onboarding-genesis-<receipt_id>.json"
  },
  "blocked_until_typed_GO": [
    "actual_receipt_mint",
    "chain_advance_performed",
    "federation_handshake",
    "external_publication",
    "node_ordinal_increment"
  ],
  "card_storage": {
    "path": "~/.dema/state/genesis-preview-<timestamp>.json",
    "store_scope": "local_preview_only",
    "expires_after": "session_end_or_24h",
    "purpose": "auditable record that the candidate SAW this exact preview before any mint"
  },
  "boundary": {                                  // canonical 16-key · ALL false
    "network_used": false,
    "runtime_execution": false,
    "filesystem_write_performed": false,         // card storage is NOT a content write
    "receipt_mint_performed": false,
    "chain_advance_performed": false,
    "federation_invoked": false,
    "node_connection_performed": false,
    "consent_collected": false,
    "model_loaded": false,
    "model_invocation_performed": false,
    "prompt_executed": false,
    "external_call_performed": false,
    "raw_corpus_scan_performed": false,
    "raw_data_included": false,
    "tool_executed": false,
    "public_network_used": false
  }
}
```

### Generation rules

1. The card emits when the candidate reaches **stage 6** (`first_mission`) AND all prior stages (`language`, `technical_level`, `node_role`, `purpose`, `resources`, `consent_constitution`) carry validated values.
2. `receipt_id_preview` is `sha256(canonical_payload_without_card_storage_block)`. Same inputs → same hash. Deterministic. Auditable by the candidate themselves.
3. The card is **printed to terminal** in the candidate's `primary_language` (with secondary-language reading available via flag).
4. The card is **written to `~/.dema/state/genesis-preview-<ISO_timestamp>.json`** — NOT to `~/.dema/receipts/`. This is a critical boundary: receipts are minted artifacts; preview cards are display artifacts that record what was shown.
5. The card does NOT advance the receipt chain. Chain length remains constant. `forge_evidence.py --verify` is unaffected.
6. The candidate can close the session here. No chain mutation has occurred. No federation handshake exists. The card is the maximum extent of state created by ADR-011 onboarding without a mint typed-GO.

### Mint typed-GO

To mint the actual receipt (separate event):

```text
GO: mint node-onboarding-genesis receipt for card <receipt_id_preview>
```

The phrase MUST quote the exact `receipt_id_preview` from a card written to disk. This binds the mint to a specific preview the candidate saw — preventing "mint without preview" or "mint a different shape than was previewed."

### Why this matters

Without a Genesis Preview Card, the candidate would consent to receipt-mint without seeing the receipt's structure. That violates **Law #2 (Understanding before consent)** at the receipt-content level: they understood the consent phrase, but did they understand what would be recorded about them?

The Genesis Preview Card closes that loop: the canonical preview-only card shows the receipt's exact payload before the mint, ensuring the candidate consents to the *content*, not just to the *event*.

---

## What does NOT change regardless of implementation

- **The 11 prior spine surfaces continue to emit identical bytes.** ADR-011 only enriches the 11th surface's schema (additive extension); it does not modify state, profiles, consent-card, mission-loop, evidence-event, llm-router, process-mining, key-maker-check, llm-invoke, node-registry, skill-growth-governor, project-status, or homebase outputs.
- **ADR-005 exact-string consent** stays binding (no fuzzy · no case-insensitive · no paste-detection bypass · no inference from colloquial language).
- **The 16-key canonical boundary** stays canonical at every emission. Onboarding does not introduce new boundary keys.
- **The 4 structural laws** (Node ordinal · Seed-pattern invariant · Skill Growth Law · Law of Assumption) all stay binding. ADR-011 operationalizes them at the human-entry surface but does not modify them.
- **Zero-deps doctrine** stays binding (per `dependencies: {} · devDependencies: {}` at HEAD).

---

## Test surface · what proves ADR-011 compliance

```text
T-1   onboarding-lifecycle emission contains node_topology block when
      candidate ordinal is being onboarded · default Node0 path omits
      candidate-only fields cleanly.
T-2   model_readiness defaults to MODEL_UNKNOWN · never MODEL_REQUIRED.
T-3   model_readiness.local_models_required is structurally false ·
      callers cannot inject true.
T-4   blocked_effects.federation is structurally true · cannot be
      flipped by onboarding completion.
T-5   blocked_effects.model_scan_without_consent is structurally true.
T-6   blocked_effects.auto_advance_to_node_n_plus_1 is structurally
      true · onboarding never causes Node-N+1 acceptance to fire.
T-7   language_state.language_set defaults false · advancing past
      stage 0 without setting it is refused (regression test for
      existing refuse_to_advance_past_language_stage_without_language_set
      that ADR-011 inscribes).
T-8   node_topology.candidate_ordinal > 0 requires paired_receipt_id
      to be non-null AND a prior-node witness file to exist on disk.
T-9   ordinal 3 and ordinal 4 are refused per canon_registry
      forbidden_topology_phrases (regression for ordinal monotonicity).
T-10  P1-P7 Daughter Test predicates each get one regression test.
T-11  full onboarding flow on a model-less node completes without any
      model-related side effect (file system spy verifies no
      ~/.dema/models/ read · no model API call).
T-12  onboarding completion does NOT mint a receipt to the chain ·
      does NOT advance .proof-forge/chain.json · does NOT modify any
      gitignored federation state.
T-13  homebase render (commit 1d6b85a) accepts an onboarding-incomplete
      candidate gracefully · greeting falls back to "Welcome." (the
      gather/preview already handle this · ADR-011 inscribes it as law).
T-14  v0.1c language picker (when shipped) calls into onboarding-
      lifecycle stage 0 and respects T-1..T-12 above.

T-15  Returning-user language load: if ~/.dema/profile.json contains
      language_code "ar", running `dema onboard` SILENTLY loads that
      value · language_state.language_source === "profile_load" ·
      language_state.returning_user_load === true · candidate_lifecycle.
      stage_skipped_due_to_profile includes "language". No prompt is
      rendered in stdout for the language stage. (Law #9 regression.)

T-16  Reset-language flag: `dema onboard --reset-language` clears the
      profile's language_code AND re-runs the language picker even
      when a value existed. language_state.language_source ===
      "reset_explicit". (Law #9 escape hatch test.)

T-17  Second language optional: at stage 0b (post-primary-language),
      the candidate may decline by pressing Enter. language_state.
      secondary_language_offered === true · language_state.
      secondary_language_code === null · candidate proceeds to
      stage 1 without delay. The system MUST NOT re-prompt or warn.
      (Law #10 regression.)

T-18  Genesis Preview Card on completion: reaching stage 6 with all
      prior stages valid emits a card with schema "bizra.dema.
      genesis_preview_card.v0.1" · card written to ~/.dema/state/
      genesis-preview-<timestamp>.json · receipt_id_preview is a
      valid sha256 · boundary.receipt_mint_performed === false ·
      .proof-forge chain length unchanged before and after card
      emission. (Law #11 regression.)
```

T-1 through T-9 are unit-test-shape. T-10..T-14 may need integration-test scaffolding (`DEMA_FORCE_TTY=1` env · subprocess spawn · etc.) when implementation lands.

---

## Implementation outline · informative-only · once typed-GO is received

This ADR DOES NOT bind implementation. Implementation requires separate typed-GO per ADR-005 + Skill Growth Law's *"no skill promotion without receipt"*.

```text
NEW MODULES:  packages/core/src/node-onboarding-extension.js  (~80 LOC)
              · Pure builder: extends onboarding-lifecycle preview with
                node_topology · model_readiness · language_state ·
                blocked_effects blocks per the schema above.
              · No I/O · no env reads · deterministic given input.

EDITS:        packages/core/src/onboarding-lifecycle.js  (~30 LOC)
              · Import buildNodeOnboardingExtension from the new module.
              · Compose it into the existing onboarding preview output
                without changing existing field shapes (additive only).
              · Bump schema minor version if reviewer requires it;
                otherwise add fields under existing v0.1 (the schema's
                allowing-extra-fields convention is established).

NEW MODULE:   packages/core/src/homebase-language-picker.js  (~60 LOC)
              · v0.1c language picker · per node1-acceptance witness
                next_phase named.
              · Pure builder: takes operator input language code +
                emits a preview with greeting in chosen language ·
                routes Samy's Asus VivoBook first-boot.
              · Composes with the homebase-preview (commit 91d8b80)
                to render greetings in operator's language.

NEW TESTS:    tests/node-onboarding-adr011-compliance.test.js
              · T-1 .. T-14 enumerated above
              · ~14 base tests + Daughter Test predicate regressions
              · Expected: 1420 → ~1434

CANON-CHECK:  Add a forbidden phrase for the smuggling pattern
              "model_required_for_onboarding" or similar in
              docs/canon/canon_registry.json forbidden_topology_phrases.

DOCS:         GLOSSARY.md gets "Onboarding Consciousness" entry.
              HANDOVER.md gets a §3 reference to ADR-011 in the
                reading order.
              docs/canon/canon_registry.json gets adr_011 anchor.

ESTIMATED LOC DELTA:    ~200 source + ~280 test = ~480 LOC
ESTIMATED TEST DELTA:   +14 tests · 1420 → ~1434 baseline target
```

---

## Decision · pending typed-GO

This ADR adoption binds the **framework** only. Implementation slices require separate typed-GO. Acceptable templates:

```text
GO: adopt ADR-011 onboarding consciousness layer
   (binds the framework · status flips Proposed → Accepted · no impl)

GO: implement ADR-011 phase-1 onboarding extension module
   (lands packages/core/src/node-onboarding-extension.js · L1 source)

GO: implement ADR-011 phase-2 v0.1c language picker
   (lands packages/core/src/homebase-language-picker.js · L1 source ·
    routes Samy's Node1 first-boot through it)

GO: implement ADR-011 phase-3 ADR-011 compliance test suite
   (lands tests/node-onboarding-adr011-compliance.test.js)

GO: implement ADR-011 · full v0.1c onboarding slice
   (single combined slice · all three phases above)
```

The first phrase binds the decision · phases 1-3 (or the combined `· full v0.1c onboarding slice`) bind implementation.

**Until typed-GO is received**: no implementation lands under this ADR. Phase-1 of v0.1c onboarding-with-ADR-011-compliance is blocked at "framework set · awaiting decision."

---

## Samy operational install path · re-scoped under ADR-011

The original "Samy device install" track was scoped under operational discipline (USB/clone/install.sh). ADR-011 introduces a new prerequisite:

```text
BEFORE Samy's Asus VivoBook attempts to install Dema:
  · ADR-011 status = Accepted
  · v0.1c language picker (Phase 2) shipped
  · ADR-011 compliance test suite (Phase 3) green

THEN the install proceeds:
  · install.sh --ordinal 1 --paired-receipt-* (from 12:25 GST ceremony)
  · Samy's first boot routes through v0.1c language picker
  · Onboarding stage 0 sets language
  · Subsequent stages respect ADR-011 laws (model-less validity · etc.)
  · Homebase renders in Samy's chosen language

AFTER first boot:
  · Samy's onboarding-lifecycle emission is captured as evidence
  · Receipt mint of his PAT-7 fires on HIS hardware (not Node0's)
  · ADR-011 compliance is empirically verified against an external human

ONLY THEN:
  · Plan Node2 onboarding under same ADR-011 law (no ADR-012 needed
    unless new constitutional surface emerges)
```

This makes Samy's install the **first ADR-011 compliance test against a real external human** — not just a software install.

---

## Closing law

```text
A node cannot join before the human understands.
The first proof of consent is language.
A returning operator is never re-asked their own name or tongue.
A second language is an offer of dignity, not a requirement.
A model-less node is a sovereign node.
Onboarding produces a preview before it produces a receipt.
The candidate sees what would be written before authorizing the write.
Onboarding never federates.
Onboarding never mints without quoted preview.
```

Operating frame:

```text
The face exists (HEAD c44d190 / 89d5eff · v0.1a + LoA embodied).
Now we define how it welcomes the next human.
The first sentence Dema speaks to a candidate is the candidate's
  own language, asked back.
Everything else flows from comprehension.
```

A BIZRA / Dema instance that admits a human via any path other than ADR-011 onboarding consciousness is structurally invalid · the same way a node that violates the LoA, the ordinal law, the seed-pattern invariant, or the Skill Growth Law is structurally invalid.

**End of ADR-011 · binding when typed-GO is received.**
