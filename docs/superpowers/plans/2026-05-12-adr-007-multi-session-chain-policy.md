# Plan: ADR-007 Multi-Session Chain Policy v0.1

**Date:** 2026-05-12
**Branch:** `adr-007-multi-session-chain-policy`
**Status:** SPEC-only · no implementation · no chain mint
**Methodology:** subagent-driven-development (single task)
**Scope:** authoring one ADR file · matching existing ADR-001..ADR-006 format

## Context

On 2026-05-12 ~19:15 GST, a SPARC analyzer forensic investigation resolved a chain-state gap. Root cause: another Claude Code session running concurrently on the same Node0 (session id `8183a42d-96a3-441b-8ed0-1958ba84d13f` vs my session `0c74e543-904a-4546-8f34-f02dd9f24f5c`) invoked `dema-assure all` twice at 15:05 Dubai, extending the agent chain through my session's just-saved code without my session's awareness.

Detailed evidence + 5 follow-up decisions are captured in `~/.claude/projects/-home-bizra-operating-system-Downloads-Dema/memory/project_cross_session_chain_mutation_discovered.md` (the operator-side canon).

This finding contradicts an implicit assumption baked into ADR-006: "Mint mode · canonical chain extension" assumed a single producer per chain. On Node0 in practice, the chain is filesystem-scoped (`~/.dema/agents/dema.node0_mission_agent/`), and multiple concurrent Claude Code sessions on the same hardware can all mutate it.

The chain integrity remains preserved (every receipt's `prev_digest` correctly chains, all gate_status PASS, no corruption). What is NOT preserved is **single-session attribution** — narrations of "chain unchanged at X" hold only within the session's own filesystem-read view at the moment of the read.

ADR-007 codifies this finding and proposes policy options without yet locking a decision.

## Task

### Task 1: Author ADR-007 Multi-Session Chain Policy v0.1

**Location:** `docs/06-adr/ADR-007-multi-session-chain-policy.md`

**Status field in ADR:** `Proposed` (NOT `Accepted` — this ADR proposes options · the decision among A/B/C is deferred to operator typed-GO)

**Header schema:** match `docs/06-adr/ADR-006-continuous-assurance-and-no-mint-verification.md` exactly:
```markdown
# ADR-007: Multi-Session Chain Policy

**Status:** Proposed
**Date:** 2026-05-12
**Decision makers:** Mumu (Mohamed Beshr)
**Supersedes:** none
**Related:** [ADR-002 No Shadow State](ADR-002-no-shadow-state.md), [ADR-006 Continuous Assurance and No-mint Verification](ADR-006-continuous-assurance-and-no-mint-verification.md)
**Implements:** none (proposal stage)
**Evidence:** `~/.claude/projects/-home-bizra-operating-system-Downloads-Dema/memory/project_cross_session_chain_mutation_discovered.md` (operator-side forensic canon)
```

**Sections (in order):**

1. **Context** — single paragraph summarizing the cross-session discovery. Cite:
   - Date/time of the discovery (2026-05-12 ~19:15 GST)
   - The two session ids
   - That 12 receipts were minted into agent chain `656589525c…` (final head at investigation time) across 2 full `dema-assure all` cycles by the other session
   - Chain integrity preserved · only single-session attribution broken

2. **Problem** — 1-2 paragraphs framing the structural issue:
   - ADR-006 §1 ("Mint mode · canonical chain extension") implicitly assumes a single producer per chain
   - Node0 filesystem hosts the chain at `~/.dema/agents/dema.node0_mission_agent/` · this directory is shared across all Claude Code sessions on the host
   - Concurrent sessions can race on `chain-head.txt` (Phase 2 atomicity boundary)
   - Within-session "chain unchanged" claims are not authoritative across sessions
   - The bash audit-log `head -c 500` truncation at `~/.claude/settings.json` line 330 currently hides cross-session command bodies, blocking attribution forensics

3. **Options considered** — three explicit alternatives, each with cost/benefit:

   **Option A: Per-session subchain** — each Claude Code session gets its own `chain_id` namespace (e.g., `agent.session_<session_id>`). Sub-chains roll up to the canonical agent chain via periodic aggregation receipts.
   - Pro: full isolation · no race · per-session attribution trivial
   - Con: complex · breaks single-chain mental model · roll-up policy needed
   - Cost: large refactor of `mint_lib` + every assurance gate

   **Option B: Filesystem mutex on `chain-head.txt`** — serialize all mints behind an exclusive lock (e.g., `flock(2)` on the chain-head file).
   - Pro: minimal API change · preserves single-chain model · prevents races
   - Con: doesn't help attribution (still no session id in receipt) · adds startup latency on contention
   - Cost: small `mint_lib` patch + 1 STRUCT test for lock acquisition

   **Option C: Declare chain as shared resource** — document concurrent-mint semantics in operator-facing way · add `session_id` field to receipt envelope · no lock · no isolation.
   - Pro: simplest · honest · no code change for the chain itself
   - Con: races still possible (if rare in practice) · attribution becomes diagnostic, not preventive
   - Cost: 1 receipt-envelope field addition + documentation

4. **Decision** — `Deferred to operator typed-GO`. ADR-007 proposes the three options but does not select among them. The selection is its own halt-gate decision.

5. **Consequences (per option, brief)** — what changes if A, B, or C is selected:
   - A: every mint envelope acquires a `chain_id` field referencing the session's subchain · roll-up needs its own ADR
   - B: every mint acquires lock contention metrics · failures need typed retry policy
   - C: every mint envelope acquires `session_id` · operators see attribution but no enforcement

6. **Companion changes (independent of A/B/C choice)** — these can land regardless:
   - Lift `head -c 500` truncation in `~/.claude/settings.json` PreToolUse Bash hook to `head -c 4000` (or remove cap entirely with sidecar file). Restores forensic capability.
   - Add `session_id` field to receipt envelope as metadata (no chain-integrity change). Future receipts carry attribution even before A/B/C is decided.
   - Update memory canons that claimed "chain unchanged" within single-session view to add the "as-of HH:MM session view" qualifier (per the cross-session canon's own §"Discipline encoded" rule).

7. **Open questions** — 4-6 questions the operator must answer to advance the decision:
   - Does Node0 currently host multiple concurrent Claude Code sessions intentionally?
   - What's the operator's tolerance for chain-mint latency (Option B)?
   - Should subchain roll-up (Option A) be hourly, daily, or per-session-end?
   - Is the `dema.node0_mission_agent` identity meant to be one logical agent per Node0, or one per Claude Code session?
   - For multi-node future (Node1+): does this finding generalize?

8. **References:**
   - ADR-002 No Shadow State
   - ADR-006 Continuous Assurance and No-mint Verification
   - `mint_lib.py` (current single-producer assumption)
   - Cross-session canon at operator-side memory dir
   - Bash audit log at `/data/bizra/logs/claude-bash-audit.log`

### Acceptance criteria

1. File exists at `docs/06-adr/ADR-007-multi-session-chain-policy.md`
2. Header schema matches ADR-006 (8 metadata fields: Status, Date, Decision makers, Supersedes, Related, Implements, Evidence)
3. Status is `Proposed` (not `Accepted`)
4. All 8 sections present in order: Context · Problem · Options A/B/C · Decision · Consequences · Companion changes · Open questions · References
5. Each option has explicit Pro/Con/Cost
6. Companion changes section includes the audit-log truncation lift + session_id metadata field + canon qualifier update
7. `npm test` still returns 104/104 PASS (this is a docs-only change · should not affect tests)
8. `git status` shows ONE new file (the ADR) and zero modified files outside docs/06-adr/
9. File size in the range ~9-15 KB (matching ADR-006's 13,944 B order of magnitude)

### Out of scope (do NOT do)

- Do NOT modify `mint_lib.py` or any assurance gate code
- Do NOT touch `~/.claude/settings.json` (the audit-log truncation lift is a SEPARATE typed-GO)
- Do NOT add session_id to any existing receipt envelope (that's a SEPARATE typed-GO)
- Do NOT update existing memory canons (the qualifier update is a SEPARATE typed-GO)
- Do NOT mark Status as `Accepted` (operator decides among A/B/C in a future typed-GO)
- Do NOT push to remote
- Do NOT extend the agent chain (this is docs-only · zero mints)
- Do NOT touch test_runner code

### Halt-gates (per ~/CLAUDE.md and project CLAUDE.md)

- No push (local commit only)
- No chain mint
- No code change outside the one new ADR file
- No edits to ~/.dema/ tree

### Branch

- Feature branch: `adr-007-multi-session-chain-policy` (already created)
- Push decision: deferred to operator
- Merge to main: deferred to operator (separate halt-gate)

## Methodology notes

This plan is intentionally a SINGLE task:
- One file authored
- One commit
- One spec-compliance review
- One code-quality review (here "code" = the ADR's structure + adherence to format)
- Then control returns to operator

Subagent will receive the full Task 1 text inline (per skill's "don't make subagent read plan file" rule).
