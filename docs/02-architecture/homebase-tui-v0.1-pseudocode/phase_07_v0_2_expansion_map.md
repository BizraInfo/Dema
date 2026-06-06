# Phase 7 · v0.2 / v0.3 Expansion Map

**Pseudocode-bundle file:** `phase_07_v0_2_expansion_map.md`
**Origin:** the cloud-author blueprint that triggered this SPEC proposed a 5-screen "control room" experience (Home / Mission / Consent / Knowledge / Proof). The existing `homebase-tui-v0.1.md` already covers the **Home** screen of that vision. The other four screens are downstream evolutions, each gated behind its own scoped GO.
**Goal:** map each cloud-author screen to a future version slice with explicit dependencies, scope, test floor, and the constitutional anchor that must hold.

---

## 7.1 · Versioning rule

```text
v0.1   First-contact identity-first homebase   (this bundle)
v0.2   Mission deepdive + consent decision     (adds 2 screens)
v0.3   Knowledge + URP cards                   (adds 2 screens)
v0.4   Conversational layer over LLM           (adds 1 layer + 1 screen)
```

Each step requires:

1. A separate scoped GO from the operator (per ADR-005).
2. Re-verification of the 5-command HANDOVER §1 gate.
3. A new Proof-Forge receipt minted upon completion.
4. Memory anchor updated to record the new ring of capability.
5. ≥ 15 adversarial tests per new component (Master Craftsmanship #2).

Skipping any of these breaks the doctrine and pushes the system into the "engineered but emotionally distant" failure mode the cloud-author warned against.

---

## 7.2 · v0.2 · Mission deepdive + Consent decision screens

### Mission screen

```text
TRIGGER       [m] from v0.1 homebase (currently spawns `dema mission draft`)
EVOLUTION     v0.2 opens a Mission panel INSIDE the TUI (not spawn-out)
DATA SOURCES  buildMissionLoopPreview() · buildPatProposalSet() · buildSatVerdictSummary()
NEW BUILDERS  none required · existing PAT-1 (Mission Scribe) + PAT-5 (Consent Drafter) +
              SAT-1 (Boundary) + SAT-2 (Consent) + SAT-3 (Doctrine) builders already shipped
              per ADR-008 C4 + C5
SCREEN
  ┌──────────────────────────────────────────────────────────────────────────┐
  │ MISSION · draft #<id>  · ring·proposal · 03:42 GST                       │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ INTENT                                                                   │
  │   "<operator intent in their own words>"                                 │
  │                                                                          │
  │ PROPOSALS (from PATs)                                                    │
  │   1. PAT-1 Mission Scribe   · proposed plan · 4 steps                    │
  │   2. PAT-2 Research Comp.   · evidence    · 2 sources                    │
  │   3. PAT-5 Consent Drafter  · phrase to type                             │
  │                                                                          │
  │ SAT VERDICTS                                                             │
  │   SAT-1 Boundary  · ●  green   · all 16 keys would remain false          │
  │   SAT-2 Consent   · ●  green   · phrase well-formed                      │
  │   SAT-3 Doctrine  · ●  green   · V/D/A/U claims bind                     │
  │                                                                          │
  │ NEXT                                                                     │
  │   [a] approve plan  [c] enter consent screen  [Esc] return to homebase   │
  └──────────────────────────────────────────────────────────────────────────┘
EXTRAS        - Adds a `<MissionPanel>` JSX component
              - Adds a key dispatch in handleKey for [a] approve
              - Adds a sub-screen for consent (below)
NEW TESTS     ≥ 15 covering: mission rendering · proposal aggregation ·
              SAT verdict consumption · approve-without-consent refused ·
              cross-component snapshot stability
GATES         operator typed-GO: "GO mission-panel-v0.2"
              re-verify HANDOVER §1 5 commands · still green
              new Proof-Forge receipt #18 (Strong or Ironclad) before claiming v0.2 shipped
```

### Consent screen

```text
TRIGGER       [c] from Mission panel · or [c] from any L1+ affordance in any screen
EVOLUTION     The TUI hosts the consent-typing experience instead of bouncing to shell
DATA SOURCES  buildConsentPlanPreview() · existing surface from commit 3dc6d32
SCREEN
  ┌──────────────────────────────────────────────────────────────────────────┐
  │ CONSENT · plan #<id> · classified actuators · 03:42 GST                  │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ ACTION CLASS                                                             │
  │   <actuator_class> (e.g., journal_write · receipt_mint_request)          │
  │                                                                          │
  │ POLICY DECISIONS                                                         │
  │   - effect family: <e.g., "filesystem_write_performed">                  │
  │   - autonomy level: <L1_remember | L2_propose | L3_act | ...>            │
  │   - blocked effects: [<list always blocked>]                             │
  │                                                                          │
  │ EXACT PHRASE TO TYPE                                                     │
  │   "GO: <scope>"                                                          │
  │                                                                          │
  │ TYPE HERE: __________________________________                            │
  │                                                                          │
  │ [Esc] cancel                                                             │
  └──────────────────────────────────────────────────────────────────────────┘
DOCTRINE      - Paste-detection: > 50 chars within 100ms = rejected
              - Fuzzy match: NEVER
              - Case-insensitive: NEVER
              - Partial match: NEVER
              - Trailing whitespace: stripped before compare
              - Visible character-by-character feedback
NEW TESTS     ≥ 20 adversarial (this surface IS the consent gate · highest-leverage tests)
GATES         operator typed-GO: "GO consent-panel-v0.2"
              new Proof-Forge receipt #19
```

---

## 7.3 · v0.3 · Knowledge + URP cards screens

### Knowledge screen

```text
TRIGGER       [k] new affordance on v0.1 homebase
EVOLUTION     Surfaces corpus inventory + theme-graph preview + retrieval preview with citations
DATA SOURCES  existing corpus builders shipped per ADR-008 C8 (corpus-integration.js,
              corpus-preview-index.js, plus the 8 corpus-*-preview.js modules)
SCREEN
  ┌──────────────────────────────────────────────────────────────────────────┐
  │ KNOWLEDGE · corpus · themes · retrieval · 03:42 GST                      │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ CORPUS                                                                   │
  │   600 GB · 27,044 msgs · 1,545 convs · 6 platforms                       │
  │   (read-only · D4-secret never returned · per ADR-008 C8)                │
  │                                                                          │
  │ THEMES (top 5)                                                           │
  │   - BIZRA constitutional anchors        · 4,820 chunks                   │
  │   - Receipt discipline                   · 2,103 chunks                   │
  │   - Consent gating                       · 1,940 chunks                   │
  │   - Ring concentric model                · 1,612 chunks                   │
  │   - Founder mission narrative            · 1,488 chunks                   │
  │                                                                          │
  │ RETRIEVAL QUERY:  "______________________________________"               │
  │                                                                          │
  │ [Esc] return                                                             │
  └──────────────────────────────────────────────────────────────────────────┘
NEW TESTS     ≥ 15 covering: corpus-inventory aggregation · theme rendering ·
              D4-secret refusal verification · retrieval result citation shape
GATES         typed-GO: "GO knowledge-panel-v0.3"
              receipt #20
```

### URP cards screen

```text
TRIGGER       [u] new affordance on v0.1 homebase
EVOLUTION     URP local manifests as cards (verified resource descriptors per cloud-author §3)
DATA SOURCES  existing URP local builder (urp-local.js · ADR-008 C7)
SCREEN
  ┌──────────────────────────────────────────────────────────────────────────┐
  │ URP LOCAL · 5 categories · NOT federated · 03:42 GST                     │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ HARDWARE         ▓░░░░░░░░░  CPU / GPU / RAM / disk inventory             │
  │ DATA CORPUS      ▓▓▓░░░░░░░  600 GB · indexed                             │
  │ KNOWLEDGE BASE   ▓▓▓░░░░░░░  themes/topics · indexed                      │
  │ EXPERIENCE HIST. ▓░░░░░░░░░  17 receipts · session log                    │
  │ SKILL LIBRARY    ▓▓░░░░░░░░  PAT × 7 + SAT × 5 + 9 spine surfaces         │
  │                                                                          │
  │ FEDERATION       ○  not active (by design · Ring 1 not yet earned)        │
  │                                                                          │
  │ [Esc] return                                                             │
  └──────────────────────────────────────────────────────────────────────────┘
NEW TESTS     ≥ 15 covering: URP card aggregation · federation_invoked stays false ·
              capability-card refusal pattern
GATES         typed-GO: "GO urp-panel-v0.3"
              receipt #21
```

---

## 7.4 · v0.4 · Conversational layer (chat over LLM)

```text
STATUS        DEFERRED · explicitly excluded from v0.1, v0.2, v0.3
RATIONALE     v0.1 spec §4 "Components NOT in v0.1: Chat box on top of an LLM"
              applies until the system has the surface to refuse-as-product on
              every conversational turn. That gate is harder than it sounds.
INPUTS        Local LLM Adapter (C1) · llm-router (C1 preview) · llm-invoke
WHY HARD      Conversation undermines the boundary discipline if any turn
              accidentally crosses an effect family without surfacing the
              consent strip. The chat layer must be receipt-emitting per turn.
WHAT IT WOULD
PROBABLY LOOK  Slack-style turn-by-turn surface anchored under the homebase
LIKE          banner · every assistant message bound to a schema-tagged
              chat_turn.v0.1 spine + canonical boundary check · every L1+
              suggestion routes through consent screen before firing
PREREQUISITES PROOF that v0.2 + v0.3 surfaces hold under adversarial review
              (Ring 1 N=1 reviewer feedback consumed · Ring 2 design partner
              cohort engaged)
GATES         typed-GO: "GO chat-layer-v0.4"
              receipt #N · likely several intermediate
```

---

## 7.5 · Anti-pattern fence

The cloud-author blueprint correctly named the temptations to avoid. Phase_07 makes them explicit:

| Temptation                                                              | Reject reason                                                  |
| ----------------------------------------------------------------------- | -------------------------------------------------------------- |
| Build all 5 screens at once                                             | Dilutes the slice; v0.1 cannot ship if v0.2 ships in same arc  |
| Add a global chat box on homebase                                       | Breaks identity-first hook; falls into ChatGPT-with-steps trap |
| Add gamification (streaks · levels)                                     | Anti-Ihsān per Key Maker §11                                   |
| Add a Node1 inter-node handshake mockup before Ring 1 reviewer feedback | Skips a ring                                                   |
| Allow non-typed "approve" affordance for L1+ actions                    | Violates ADR-005                                               |
| Add raw-corpus excerpts to knowledge screen                             | D4-secret leak surface; ADR-008 C8 forbids                     |
| Make URP cards mutable from inside TUI                                  | URP is read-only at v0.1-0.3; mutation needs a separate ADR    |
| Bypass smoke-boundary for "internal-only" panels                        | Every screen emits a schema → every schema gets smoke-checked  |

---

## 7.6 · Sequencing rule

```text
v0.1 → typed-GO → land → re-verify → mint receipt
        ↓
v0.2 mission     ← engage Ring 1 reviewer with v0.1 + lighthouse pack first
        ↓
v0.2 consent
        ↓
v0.3 knowledge
        ↓
v0.3 urp
        ↓
v0.4 chat        ← only after Ring 2 cohort proves the discipline holds
```

Each transition is operator-act-gated. The runtime does not auto-promote.

---

## 7.7 · Why this map matters

The cloud-author blueprint correctly identified that:

> "The runtime exists. Now give it a home. The home must make Mumu feel sovereign before it makes agents feel powerful."

This map preserves that closing law while protecting the v0.1 minimum solvable special case. The smallest masterpiece (v0.1 single screen + 5 commands of verification) is the test for whether the system is REAL enough to grow. Every later screen is an extension of that test, not a substitute for it.

If v0.1 ships, v0.2 becomes feasible. If v0.1 is skipped, v0.2 is just architecture-doctrine again — which is exactly the trap the executive verdict said BIZRA had escaped.

---

## 7.8 · Output

```text
OUTPUT  v0.2 / v0.3 / v0.4 surface map · each gated · each test-quantified
USED BY future spec-pseudocode invocations · one per version transition
        Each transition will produce its own phase_01..phase_06 bundle
        co-located at docs/02-architecture/homebase-tui-vN.M-pseudocode/
```

**End of phase_07.**
**End of SPEC-PSEUDOCODE bundle.**
