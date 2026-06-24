# BIZRA / Dema · Project Charter & Status v0.1

**Status:** Living document · updated per commit that changes project state.
**Authored:** 2026-05-18 GST
**Schema-tagged JSON companion:** `dema project-status [--json]` (13th canonical spine surface, since commit at HEAD).
**Receipt-bound to:** Proof-Forge chain head (latest verifiable in `.proof-forge/EVIDENCE_INDEX.json`).
**Audit method:** every claim in this document either binds to a receipt, a canon section, or a memory anchor. Unbound claims are doctrine violations.

This document embodies PMBOK 7th-edition project-management discipline as applied to BIZRA. It is not a status update; it is the **canonical project artifact a stakeholder may verify against the codebase at any time**.

---

## §1 · Vision

```text
Sovereign AI nodes that grow without betraying their humans.
```

The full system intent lives in:

- `docs/public/third-fact-v0.1.md` — the public manifesto (Bitcoin-anchored at blocks 948027 + 948028 + 948029)
- `docs/canon/BIZRA_TOPOLOGY_CANON.md` — the structural topology canon
- Founding PDFs at `~/Downloads/BIZRA_Third_Fact_v0_1_FINAL.pdf` (and siblings)

BIZRA is **not** a chatbot, a token, a blockchain, a model, or an operating system. It is a seed architecture for a different relationship between humans, intelligence, resources, proof, and value.

---

## §2 · The three structural laws of BIZRA topology

All three were canonized on 2026-05-18. Together they constitute the structural identity of any BIZRA node.

| Law                                                                                          | Question it answers        | Canonized at commit |
| -------------------------------------------------------------------------------------------- | -------------------------- | ------------------- |
| [Node ordinal law](../canon/BIZRA_TOPOLOGY_CANON.md#node-ordinal-law)                        | who is in the network      | `1831aa9`           |
| [Seed-pattern invariant](../canon/BIZRA_TOPOLOGY_CANON.md#seed-pattern-invariant-fractality) | what every node carries    | `8b55321`           |
| [Skill Growth Law](../canon/BIZRA_TOPOLOGY_CANON.md#skill-growth-law)                        | how a node may safely grow | `1899332`           |

> _"A BIZRA node that violates any of these three laws is not a BIZRA node. It may be impressive software. It is not part of this network."_ — closing line of the Skill Growth Law canon section.

---

## §3 · Stakeholder map · concentric rings

Per memory anchor `feedback_evidence_first_gtm_concentric_rings`, BIZRA propagates through rings of increasing skepticism. **Refuse to claim a ring not earned. Refuse to skip a ring.**

| Ring | Role                        | Identity                      | Status                                                    | Anchor                                              |
| ---- | --------------------------- | ----------------------------- | --------------------------------------------------------- | --------------------------------------------------- |
| 0    | Founder                     | Mumu (Mohamed Beshr)          | active · Node0 · operator since 2026-04-12                | `~/.dema/profile.json`                              |
| 1    | First invited human         | **Samy**                      | **ghost-accepted Node1** · 2026-05-18 12:25 GST           | Proof-Forge receipt `2026-05-18_082658` (#21)       |
| 1.5  | Candidate (Phase C pending) | Samy's device install         | not yet run (USB handoff pending)                         | `~/.dema/memory/node1-acceptance-2026-05-18.json`   |
| 2    | Candidate (next)            | Asus VivoBook friend          | not yet contacted                                         | memory anchor `project_lighthouse_candidate_n1`     |
| 2    | Cohort (target ≥ 5)         | future Ring-2 design partners | not yet engaged                                           | —                                                   |
| 3    | Design partner cohort       | future                        | deferred                                                  | —                                                   |
| 4    | Public                      | future                        | **deliberately not earned**                               | —                                                   |
| ω    | Concurrent Claude session   | per ADR-007                   | filesystem-scoped · receipts attribute to the local chain | `docs/06-adr/ADR-007-multi-session-chain-policy.md` |

**Refusal binding:** the project will NOT claim Ring 2 until at least 5 Ring-2 design partners have engaged with cross-node receipt verification. It will NOT claim Ring 4 until Ring 3 has minted at least 6 IRONCLAD cross-node receipts.

---

## §4 · Value stream · what counts as value

```text
unit_of_value : ironclad_proof_forge_receipt
NOT counted    : features, LOC, commits, stars, downloads, retention,
                 model parameters, benchmark scores, vanity metrics
```

| Metric                             |                                           Current value | Date       |
| ---------------------------------- | ------------------------------------------------------: | ---------- |
| Total Proof-Forge receipts         |                                         **25** IRONCLAD | 2026-05-18 |
| Receipts minted today (2026-05-18) | **9** (#17 was today too — total today since pre-v0.1a) | —          |
| Canonical spine surfaces           |                     **13** (after this commit · was 12) | —          |
| Structural laws canonized          |      **3** (Node ordinal · Seed-pattern · Skill Growth) | —          |
| Tests passing                      |                 **1361** (after this commit · was 1329) | —          |
| Tests failing                      |                                                   **0** | —          |
| External humans in canon           |                    **1** (Samy as Node1 ghost-accepted) | —          |
| Bitcoin attestations               |    2 of 4 calendars timestamped on PROOF_SUMMARY.md.ots | —          |

Each value unit is a receipt-chained, hash-linked, replayable artifact. A reviewer can re-derive every claim above from the receipt chain.

---

## §5 · Risk register

Per PMBOK principle "Optimize risk responses." **Refuse to close a risk without a named mitigation** (enforced structurally in `project-status-preview.js`).

| ID  | Risk                                                                       | Severity | Mitigation                                                                                                                 | Status                                  | Owner                         |
| --- | -------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ----------------------------- |
| R1  | Single-point-of-failure: Mumu                                              | high     | evidence-first GTM creates network successor pool; concentric rings refuse to skip steps; receipt chain is self-witnessing | monitored                               | Mumu                          |
| R2  | Push held since 2026-05-17 CI dispatch incident                            | medium   | workflow worktree clean at HEAD · retry push when ready · sibling branches reachable                                       | monitored                               | Mumu                          |
| R3  | Samy's Phase C device install pending                                      | low      | USB handoff path documented · install.sh tested for Node1 ordinal · refusal-as-product if Samy declines                    | monitored                               | Mumu + Samy                   |
| R4  | OpenTimestamps Bitcoin confirmation pending on PROOF_SUMMARY.md.ots        | low      | 2 of 4 calendars timestamped · receipt #17 transitively anchors #18-#25 via prev_hash                                      | monitored                               | OTS calendars (external)      |
| R5  | OpenClaw/Hermes-style silent skill drift in future BIZRA agents            | medium   | Skill Growth Law canonized · skill-growth-governor.js refuses silent overwrite · "reflection is not proof" binding         | mitigated                               | Skill Growth Governor builder |
| R6  | Federation activation without proof readiness                              | high     | `federation_invoked: false` pinned across all 13 spine surfaces · ADR-001 makes runtime upstream · Phase 3 gated           | mitigated                               | ADR-001 + boundary discipline |
| R7  | Premature Ring-4 (public) claim                                            | high     | refuse-as-product on stakeholder ring progression · deliberately_not_earned status in project-status surface               | mitigated                               | concentric ring discipline    |
| R8  | Concurrent Claude sessions advancing chain · attribution loss              | medium   | ADR-007 accepts filesystem-scoped chain · session_id metadata · cross-session forensics tooling                            | mitigated (ADR-007 Accepted 2026-05-16) | Mumu + ADR-007                |
| R9  | Operator memory drift across sessions (HEAD ahead of last memory snapshot) | low      | every significant commit triggers memory anchor update + MEMORY.md index entry · doctrine-catches-author pattern           | monitored                               | session-start memory load     |

---

## §6 · Quality posture

Per PMBOK principle "Build quality into processes and deliverables."

| Quality dimension                    | Floor / posture                                               | Verification surface                                         |
| ------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------ |
| Test floor                           | 0 failing on every commit (currently 1361/1361)               | `npm test`                                                   |
| Adversarial test floor per component | ≥ 15 (per Master Craftsmanship #2)                            | per-test-file counter                                        |
| Canonical boundary discipline        | all 13 spine surfaces emit 16-key boundary all-false          | `npm run smoke-boundary`                                     |
| Doctrine compliance                  | canon-check 0 findings · llm-guidance 7/7 PASS                | `npm run check` + `npm run llm:guidance`                     |
| Receipt-chain integrity              | every receipt sha-256 chained to predecessor · ok: true       | `python3 scripts/forge_evidence.py --verify --project-dir .` |
| Master Craftsmanship 10-invariant    | enforced per slice · documented in commit messages            | each `feat:` commit lists which invariants apply             |
| 5-gate state                         | all_green at HEAD · publishable into Proof-Forge if requested | the 5 commands above run together                            |

---

## §7 · PMBOK 7th-edition · 12-principle embodiment

Per PMBOK 7th edition. Each principle is bound to a structural mechanism in the codebase, not a slogan.

| #   | Principle                 | BIZRA structural embodiment                                                                                 |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | Stewardship               | `CLAUDE.md` halt gates · refuse-as-product taxonomy on every spine surface                                  |
| 2   | Team                      | Node-level team · operator + invited humans via Node ordinal law · concentric rings refuse to skip cohorts  |
| 3   | Stakeholders              | Evidence-first GTM rings · Ring-1 N=1 closed (Samy) · refuse to claim rings not earned                      |
| 4   | Value                     | Unit of value = IRONCLAD Proof-Forge receipt · NOT features · NOT LOC                                       |
| 5   | Systems thinking          | 3 structural laws (Node ordinal · Seed-pattern · Skill Growth) jointly govern topology                      |
| 6   | Leadership                | Operator leads by typing exact-string GO · refuses fuzzy consent · holds Daughter Test before every act     |
| 7   | Tailoring                 | Master Craftsmanship 10-invariant binding · tailored to each slice (preview vs runtime · pure vs impure)    |
| 8   | Quality                   | 5 verification gates on every commit · 16-key canonical boundary · ≥15 adversarial tests per component      |
| 9   | Complexity                | Preview-only spine · runtime lives upstream · scope discipline · same installer for every node              |
| 10  | Risk                      | Risk register surface · refuse-as-product taxonomy · rollback paths documented · halt-gates explicit        |
| 11  | Adaptability & resilience | Every slice reversible · install.sh --uninstall returns clean state · receipt chain configurable per branch |
| 12  | Change                    | Version-bumped per slice · canon amendments via ADR · Skill Growth Law governs self-improvement             |

These are not aspirations. Each one has a code path or doc anchor that enforces or witnesses it.

---

## §8 · Project work · cadence and discipline

```text
Lifecycle approach              : iterative-incremental · slice-based · receipt-gated
Slice size                       : single commit · ≤ 600 LOC delta · ≥ 15 adversarial tests
Slice gate sequence              : impl → 5 verification gates → commit → receipt mint
Cadence                          : as operator-energy allows · no daily/weekly cadence floor
Definition of done (DoD) per slice:
  1. All 5 verification gates green
  2. Canon-check 0 topology + 0 authorization findings
  3. Master Craftsmanship 10-invariant compliance documented in commit
  4. Memory anchor written
  5. Proof-Forge receipt minted (if substantive)
Definition of done (DoD) per session:
  1. MEMORY.md updated
  2. Last receipt is IRONCLAD
  3. Workflow worktree clean
  4. Open typed-GOs explicitly recorded
```

---

## §9 · Today's session summary (2026-05-18)

A single day arc that shipped 3 structural canon laws, the first external human (Samy as Node1), and the new ANSI TUI.

| Time GST  | Slice                                               | Receipt            | Outcome                                     |
| --------- | --------------------------------------------------- | ------------------ | ------------------------------------------- |
| 11:22     | v0.1a profile primitives (commit `9a8389e`)         | #18                | identity primitives shipped                 |
| 11:25     | v0.1b Node ordinal law canon (commit `1831aa9`)     | #18 (combined)     | first structural law                        |
| 11:46     | Seed-pattern invariant canon + ADR-009 POI design   | #19                | second structural law + 7th pillar designed |
| 11:48     | 4-commit arc receipt #19                            | #19                | session-scope evidence link                 |
| 12:05     | v0.1e+f node-registry-preview + URP inventory       | #20                | 10th + 11th spine surface                   |
| **12:25** | **Samy accepted Node1 (in-person ceremony)**        | **#21**            | **first external human in canon**           |
| 12:37     | Phase C handoff package (samy-specific)             | #22                | superseded by #23                           |
| 12:59     | Unified installer + onboarding lifecycle + ANSI TUI | #23                | unified CLI feel · zero new deps        |
| 13:09     | DevOps post-deployment sweep + vercel fix           | (commit `62b2331`) | publishing path corrected                   |
| 13:25     | Skill Growth Governor v0.1 (12th spine)             | #24                | 4-line law in code                          |
| 13:30     | Skill Growth Law canonized                          | #25                | third structural law in canon               |
| **NOW**   | **Project Charter & Status v0.1 + 13th spine**      | **#26 (pending)**  | **PMBOK embodiment in code + doc**          |

---

## §10 · Lessons learned (today)

1. **Doctrine catches author.** When canon-registry flagged literal forbidden ordinal labels in source comments, the catch landed BEFORE any false claim shipped. The system is operationally load-bearing.
2. **Refuse-as-product compounds.** Each new surface inherits the refusal taxonomy of every prior surface. By the time the skill-growth-governor shipped, it could honor 8 refusals with confidence because the prior 12 surfaces had each proven the pattern works.
3. **Seed-pattern invariant manifested in installer.** When Mumu asked "shouldn't we have unified installer," the rebuild was canon-coherent in 3 commits + 60 min. Same shape would have taken days if seed-pattern hadn't been canonized first.
4. **In-person ceremony is irreplaceable.** Samy's typed consent at Mumu's terminal landed Ring-1 N=1 in a way no remote ceremony could. Future Node2 ceremony will be remote-mediated; we'll learn whether the discipline survives the channel.
5. **8 receipts in one day is sustainable** because every receipt was bound to 5 verification commands. No mint without verify.

---

## §11 · Next-session handoff state

When this session ends, the next session resumes from:

```text
HEAD                           : <current commit, see git log>
Branch                         : season-gap2-summary-flag
Commits ahead of origin/main   : 125 (large · first push of this branch when ready)
Workflow worktree              : clean
Receipts on chain              : 25 (will be 26 after this commit's mint)
Open typed-GOs (none pending mid-flight as of writing):
  - GO push origin season-gap2-summary-flag       (operator-act · halt-gate)
  - GO send Samy invitation email                  (operator-act · Gmail)
  - GO USB packaging for Samy                      (~10 min code · operator-local)
  - GO ots upgrade                                 (network · Bitcoin node needed)
Deferred actions:
  - Bring USB to Samy for Phase C device install
  - Reach out to Asus VivoBook friend (Node2 candidate)
  - Author ADR-010+ for federation activation (months away)
  - Author Homebase TUI Ink-based v0.2 (pseudocode bundle already at docs/02-architecture/homebase-tui-v0.1-pseudocode/)
```

---

## §12 · Governance · how this document stays honest

This document is regenerable from:

```bash
dema project-status --json    # canonical machine-readable surface
git log --oneline             # commit history (the receipts)
python3 scripts/forge_evidence.py --verify --project-dir .   # chain integrity
```

A reviewer who suspects this document of drifting from truth can:

1. Run the three commands above
2. Compare the JSON output's `value_stream`, `stakeholders`, `risk_register` to this document
3. Flag any discrepancy as a doctrine violation

The schema-tagged JSON surface is authoritative. This document is the human-readable view of it. **When the surface and the document disagree, the surface wins** (per BIZRA's canon: "trust what you observe now").

---

## §13 · Closing law (PM-applied)

```text
A project that cannot show its receipts is not a project.
A project that cannot name its refusals is not disciplined.
A project that cannot say what it WON'T do is not yet a product.

BIZRA shows its receipts.
BIZRA names its refusals.
BIZRA refuses to do what it cannot prove.

That is peak project management at world-class standard.
```

---

**Schema-tagged companion:** `dema project-status [--json]`
**Canon anchor:** `docs/canon/BIZRA_TOPOLOGY_CANON.md`
**Proof-forge anchor:** `.proof-forge/EVIDENCE_INDEX.json`

**End of Project Charter & Status v0.1.**
