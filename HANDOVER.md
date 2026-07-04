# Dema · Project Handover

**For:** any technical reviewer, contributor, or successor receiving this codebase.
**Reading time:** ~10 minutes.
**Goal:** by the end of this document, you can verify the system works, navigate the canon, and act safely within the established boundaries.

---

## §0 · One paragraph

Dema is the **local-first product face of BIZRA Node0** — a sovereign AI homebase. It runs on the operator's laptop, refuses to act without exact-string consent, emits canonical 16-key boundary objects on every surface, and chains evidence cryptographically (sha256 + OpenTimestamps to Bitcoin). After ADR-008 (May 18 2026) it ships with a 12-component runtime: 7 Private Agents (PAT × 7) + 5 System Agents (SAT × 5) + agent kernel + EffectCap layer + orchestrator + URP + corpus/asset/web/file access + receipt mint integration. **The system is preview-only by default and only graduates to action through typed-GO consent phrases verified by SAT-2 (consent auditor) and SAT-3 (doctrine compliance) before any L3+ effect can fire.**

---

## §1 · Verify the system in 5 commands

Run these in order from the repo root. Total time: ~10 seconds.

```bash
# 1. Confirm the test suite passes
npm test
#   → expected: 0 failures. The test count grows with every slice — it was
#     1159 at this document's 2026-05-18 snapshot and 6273 as observed locally
#     on 2026-07-03. Trust the live run, not any number written in prose.

# 2. Confirm lint + integration check
npm run check
#   → expected: 0 failures across help-discovery + smoke-cli-match + test-files-documented

# 3. Confirm canonical 16-key boundary across all 9 spine surfaces
npm run smoke-boundary
#   → expected: commands_checked: 9 · all_canonical: true

# 4. Confirm canonical-flow doctrine invariants
npm run llm:guidance
#   → expected: PASS all 7 checks · READ_ONLY_AUDIT

# 5. Confirm Proof Forge chain integrity (55 receipts · genesis → IRONCLAD)
python3 scripts/forge_evidence.py --verify --project-dir .
#   → expected: ok: true · receipt_count: 17 · 5 legacy warnings (expected)
```

If all 5 return as expected, **the system is verifiable at HEAD as committed.** Any reviewer can reproduce these results byte-for-byte without trust.

---

## §2 · Reading order for understanding

| Phase | Document                                                                                                             | Purpose                                               |
| ----- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1     | [README.md](README.md)                                                                                               | Product overview · usage examples                     |
| 2     | [docs/founder-field-notes/v0.1.md](docs/founder-field-notes/v0.1.md)                                                 | Why this project exists · the empowerment thesis      |
| 3     | [GLOSSARY.md](GLOSSARY.md)                                                                                           | BIZRA vocabulary (PAT · SAT · URP · Ihsān · etc.)     |
| 4     | [docs/02-architecture/dema-autonomy-envelope.md](docs/02-architecture/dema-autonomy-envelope.md)                     | L0-L5 autonomy levels · what Dema may do              |
| 5     | [docs/02-architecture/key-maker-epistemic-conduct-v0.1.md](docs/02-architecture/key-maker-epistemic-conduct-v0.1.md) | Reasoning discipline · 5 invariants                   |
| 6     | [docs/06-adr/ADR-008-runtime-activation.md](docs/06-adr/ADR-008-runtime-activation.md)                               | The 12-component runtime spec                         |
| 7     | [API_REFERENCE.md](API_REFERENCE.md)                                                                                 | All 9 spine CLI commands with examples                |
| 8     | [SECURITY.md](SECURITY.md)                                                                                           | Threat model · refusal taxonomy · boundary discipline |
| 9     | [docs/founder-field-notes/inroom-walkthrough-v0.1.md](docs/founder-field-notes/inroom-walkthrough-v0.1.md)           | In-person review script (gentle + adversarial modes)  |

**Estimated full-context reading time: 90 minutes.** A reviewer can produce useful feedback after step 5 (45 minutes).

---

## §3 · System architecture at a glance

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  OPERATOR (Mumu)                                                            │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │ typed-GO consent phrases (ADR-005)
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  DEMA CLI (apps/cli/src/index.js)                                           │
│    9 spine commands (preview-only by default)                               │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
              ┌────────────────┴────────────────┐
              ▼                                 ▼
┌─────────────────────────┐         ┌──────────────────────────────────────┐
│  CANONICAL SUBSTRATE    │         │  RUNTIME (per ADR-008 · 12 components)│
│  (preview-only spine)   │         │                                       │
│                         │         │  C1   Local LLM Adapter (Ollama)     │
│  state · profiles ·     │         │  C1.5 Local Model Inventory Scan     │
│  consent-card ·         │         │  C2   Effect-Capability layer         │
│  mission-loop ·         │         │  C3   Agent Loop Kernel (8 states)    │
│  evidence-event ·       │         │  C4   PAT × 7 (private agents)        │
│  llm-router ·           │         │  C5   SAT × 5 (system verifiers)      │
│  process-mining ·       │         │  C6   Multi-Agent Orchestrator        │
│  key-maker-check ·      │         │  C7   URP local (resource pool)       │
│  llm-invoke             │         │  C8   Corpus integration              │
│                         │         │  C9   Asset access                    │
│  Every surface emits:   │         │  C10  Bounded web access              │
│    schema-tagged JSON   │         │  C11  Bounded local-file access       │
│    truth_label          │         │  C12  Receipt mint integration        │
│    canonical 16-key     │         │                                       │
│      boundary all-false │         │  ALL gated by: SAT pipeline +        │
│                         │         │     exact-string consent +           │
│                         │         │     governed gateway handoff          │
└─────────────────────────┘         └──────────────────────────────────────┘
              │                                 │
              ▼                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  EVIDENCE (~/.dema/  + .proof-forge/  + Bitcoin attestation)                │
│                                                                             │
│  Local state                Receipt chain              Bitcoin anchor        │
│  5.8 GB · 24 memory         55 receipts · genesis      Founding PDFs blocks  │
│  entries · 3 receipts       2026-05-07 → IRONCLAD #55  948027/948028/948029  │
│                                                        IRONCLAD #17: pending  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §4 · The 10 Master Craftsmanship invariants (binding across all components)

Per [ADR-008](docs/06-adr/ADR-008-runtime-activation.md), every component in this codebase satisfies all 10:

```
 1. Canon-bound              schema · truth_label · canonical 16-key boundary
 2. Test-backed              ≥80% coverage · ≥15 adversarial scenarios per component
 3. Consent-gated            exact-string per ADR-005 · no fuzzy · no case-insensitive
 4. Receipt-emitting         receipt_shape_ready flag on every valid emission
 5. Doctrine-coherent        Key Maker §3 V/D/A/U claim labeling
 6. Boundary-disciplined     declared blocked_effects (no implicit denials)
 7. Adversarial-tested       red-team probes (prototype pollution · fuzzy match · forgery · etc.)
 8. Verify-before-asserting  refusal verdicts explicitly named with reasons
 9. Reversible               pure functions · preview-only · no I/O in builders
 10. Cross-referenced        links to ADR + Key Maker canon + relevant memory anchors
```

**Verify these hold:** `npm test` passes with 0 failures (1159 tests at the 2026-05-18 handover snapshot — the count grows with each slice; `docs/CURRENT_LIMITS.md` is the live maturity ledger) · every component has its own test file enforcing the 10 invariants for its surface.

---

## §5 · Boundary discipline · what the system refuses

The system fails closed when discipline is violated. The 16 canonical boundary keys (every spine command emits all 16, all pinned `false`):

```
filesystem_write_performed       runtime_execution_performed     model_loaded
model_invocation_performed       prompt_executed                  external_call_performed
raw_corpus_scan_performed        raw_data_included                tool_executed
chain_advance_performed          receipt_mint_performed           federation_invoked
node_connection_performed        public_network_used              consent_collected
network_used
```

A spine command output with any key set to `true` is structurally invalid · SAT-1 (boundary verifier) rejects it on sight.

**To cross this boundary requires:**

1. Typed-GO with exact consent phrase (per ADR-005)
2. SAT pipeline pass (all applicable SATs run via the orchestrator)
3. Governed gateway handoff (per ADR-001 · runtime lives upstream of this repo)

There is no internal path to bypass this. The discipline is enforced by code, not policy.

---

## §6 · Cryptographic chain · provable history

Every milestone leaves a Proof Forge receipt chained to all prior receipts via sha256 prev_hash linking:

```
Receipt #1  2026-05-07  v0.3.1 interactive approval gate
Receipt #2  2026-05-11  spearpoint + investor presentation kit
... (12 intermediate receipts)
Receipt #15 2026-05-16  Step7 micro-primitives extracted
Receipt #16 2026-05-18  ADR-008 Runtime Activation COMPLETE (Strong)
Receipt #17 2026-05-18  ADR-008 IRONCLAD (4 verification commands)
... (37 additional receipts 2026-05-19 — ADR-011 full 4-phase implementation
     arc · master-craftsmanship audit consolidation · all IRONCLAD except #46/#47
     which are Logged due to verification-script grep typos · see EVIDENCE_INDEX.json)
Receipt #48 2026-05-19  ADR-011 advanced Proposed → Accepted (3 new laws + Genesis Preview Card)
Receipt #49 2026-05-19  ADR-011 phase-1 node-onboarding-extension (5 schema blocks)
Receipt #50 2026-05-19  ADR-011 phase-2 homebase-language-picker (Law #9 + Law #10)
Receipt #51 2026-05-19  ADR-011 phase-3 Genesis Preview Card (Law #11 + sha256 receipt_id_preview)
Receipt #52 2026-05-19  ADR-011 phase-3 fixup (timestamp excluded from hash · determinism restored)
Receipt #53 2026-05-19  ADR-011 phase-4 FINAL (full T-1..T-18 + P1-P10 compliance suite)
Receipt #54 2026-05-19  master-craftsmanship audit (ADR-011 suite externally witnessed COMPLIANT 10/10)
Receipt #55 2026-05-19  master-craftsmanship polish (discoverability + ADR-012 amendment)
```

Bitcoin attestations:

```
Founding documents (3 PDFs) → blocks 948027 + 948028 + 948029 (CONFIRMED 2026-04)
PROOF_SUMMARY.md            → submitted to 4 OTS calendars (PENDING 2026-05-18)
```

**Verify the chain:**

```bash
python3 scripts/forge_evidence.py --verify --project-dir .
# Walks all 55 receipts · recomputes hashes · reports any breaks
```

**Verify the Bitcoin anchor (after confirmation):**

```bash
ots upgrade PROOF_SUMMARY.md.ots
ots verify PROOF_SUMMARY.md.ots
```

---

## §7 · What's intentionally NOT in this repo (and why)

```
✗ Runtime activation                Lives upstream in governed gateway (per ADR-001)
                                    This repo is "the face" · preview + consent only

✗ Push to origin enabled            Held due to CI dispatch incident (external · since 2026-05-17)
                                    13+ commits in local history await resolution

✗ Federation / Node1 connection     Phase 3 readiness · gated by Ring-1 reviewer feedback
                                    (per concentric rings GTM in field notes)

✗ Public token / economic claim     RIBA_ZERO constitutional anchor · no economic activation
                                    until proven useful impact + ADR-008 §C12 readiness

✗ Chain advance from CLI            C12 prepares mint requests · governed gateway issues canonical
                                    receipts · this CLI cannot mint canonically itself
```

These are **features, not absences.** Each maps to a constitutional anchor or ADR. If you remove any one of them without a coordinated ADR amendment + SAT-3 doctrine review, the system loses the property that distinguishes it from typical agent libraries.

---

## §8 · Stewardship continuity

If you receive this codebase from Mumu:

```
1. Read GLOSSARY.md before any code change · BIZRA vocabulary is precise
2. Read ADR-005 + ADR-008 before any consent or runtime change
3. Run the 5-command verification (§1) BEFORE any commit
4. Any new component must pass the 10 Master Craftsmanship checks (§4)
5. Any new schema must follow bizra.dema.<snake_case>.vN.M convention
6. Any new test file requires a TESTING.md row (enforced by integration check)
7. Any new CLI command requires a HELP entry (enforced by integration check)
8. Push only happens with operator typed-GO · CI dispatch incident still external as of HEAD
```

---

## §9 · Where the doctrine lives (binding canon)

```
LEVEL                                 DOCUMENT
─────────────────────────────────    ───────────────────────────────────────────────
L0 Quranic frame                      Founding PDFs (Bitcoin-anchored)
L1 Constitutional anchors             docs/canon/BIZRA_TOPOLOGY_CANON.md
L2 ADRs                               docs/06-adr/ADR-001 → ADR-008
L3 Code spine                         packages/core/src/ (62 files · 14,408 LOC)
L4 Sealed evidence                    .proof-forge/ (55 receipts · gitignored locally)
L5 Verified state                     ~/.dema/ (5.8 GB local · 24 memory · 3 receipts)
L6 Held state                         13+ commits local · push held externally
L7 Unearned                           Ring 1 (external reviewer feedback) · still future
```

**Argue at the right level.** A bug in C4-PAT-3 lives at L3 · a doctrinal violation lives at L2 · a missing receipt grade lives at L4-L5.

---

## §10 · Honest residual list

```
1. CI dispatch incident · external · 13+ commits held from origin since 2026-05-17.
   Does NOT block local verification (§1). Resolves when GitHub Actions dispatch
   recovers for adjacent PR branches.

2. PROOF_SUMMARY.md.ots Bitcoin attestation pending (submitted 2026-05-18 ~09:49).
   Confirms within 1-12h. Run `ots upgrade PROOF_SUMMARY.md.ots` after confirmation.

3. Ring 1 reviewer not yet engaged. The system is technically ready (1896 tests passed
   at HEAD `e6412ab` · 12 ADR-008 components + ADR-011 full 4-phase implementation
   arc + master-craftsmanship audit module all ship · IRONCLAD receipt #55). The
   operator-act of inviting one trusted-friend reviewer remains the only unmoved
   variable per the field notes.

4. The conversational layer (LLM invocation in operator-facing UX) requires C1
   (Local LLM Adapter) to be wired into an interactive surface. `dema llm-invoke`
   provides the primitive · the operator-facing experience over it is Phase-2 work.

5. The Homebase TUI (Phase-1 first-contact spec at docs/02-architecture/homebase-tui-v0.1.md)
   is specified but not implemented. Ink-based · ~1-2 days of work · will replace
   the bare-banner `dema` invocation with the identity-first welcome screen.
```

These are named honestly so a successor doesn't have to discover them.

---

## §11 · License + contact

License: see [LICENSE](LICENSE).
Author: Mohamed Beshr (Mumu) · bizra.wizard@bizra.ai
Repo: [BizraInfo/Dema](https://github.com/BizraInfo/Dema)
Status: ADR-008 COMPLETE · 12 components live · IRONCLAD attested.

---

**End of handover.** If you can run the 5 commands in §1 and all return as expected, the system is verifiably yours.
