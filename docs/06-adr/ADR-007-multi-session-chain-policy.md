# ADR-007: Multi-Session Chain Policy

**Status:** Accepted
**Date:** 2026-05-12 (proposed) · **Accepted:** 2026-05-16 (commit `ab757a1` on branch `adr/007-accept`; cherry-picked to `main` via commit `0ef5998` / PR #44)
**Status-sync note (2026-05-18):** the season-* foundation arc branches were branched off `adr/007-accept` before the acceptance commit landed and inherited `Status: Proposed`. This in-place amendment reconciles the current branch with main's authoritative state. No re-decision; only repo-internal consistency.
**Decision makers:** Mumu (Mohamed Beshr)
**Supersedes:** none
**Related:** [ADR-002 No Shadow State](ADR-002-no-shadow-state.md), [ADR-006 Continuous Assurance and No-mint Verification](ADR-006-continuous-assurance-and-no-mint-verification.md)
**Implements:** A/B/C selection still deferred to operator typed-GO. Companion changes #1, #2, #3 are RESOLVED (see "Companion change status" section below).
**Evidence:** `project_cross_session_chain_mutation_discovered.md` (operator-side memory canon · path redacted) (operator-side forensic canon)

## Context

On 2026-05-12 ~19:15 GST, a cross-session chain mutation was discovered on Node0. Session `0c74e543-…` (full id redacted) (this session) observed 12 receipts minted across 2 full `dema-assure all` cycles by a concurrent session (`8183a42d-…` (full id redacted)), with the agent chain head at `656589525cda36927d06c8f1415576e649d03482f6273e9a40df4c2351e7e092` at investigation time. Chain integrity was preserved — the hash chain itself remained valid and unbroken. What broke was single-session attribution: any within-session claim of "chain unchanged" was silently false because a second producer was advancing the chain concurrently. The forensic investigation was recorded in operator-side canon at `project_cross_session_chain_mutation_discovered.md` (operator-side memory canon · path redacted).

## Problem

ADR-006 §1 ("Mint mode · canonical chain extension") implicitly assumes a single producer per chain. The section specifies that `mint_lib.mint_receipt(...)` "Advances `chain-head.txt` atomically" and that `dema-assure all` is "reserved for meaningful state transitions." This language treats the chain as owned by one active session at a time. No invariant prevents a second session from simultaneously calling `mint_lib.mint_receipt` and advancing `chain-head.txt`.

The Node0 agent chain at `~/.dema/agents/dema.node0_mission_agent/` is filesystem-scoped. It is a directory on disk shared across all Claude Code sessions running on the same host. There is no lock, no namespace, and no producer-identity enforcement that would prevent two concurrent sessions from racing on `chain-head.txt`. The Invariant V-I10 from ADR-006 ("chain_head_before == chain_head_after" for verify mode) is enforced only within a single invocation; it does not detect mutations caused by a sibling session running between the pre-check and post-check reads. Furthermore, the Bash audit-log hook in `~/.claude/settings.json` applies `head -c 500` truncation (line 330), which currently hides cross-session command bodies during forensic reconstruction. Attribution investigation requires reading full command strings; the truncation blocks that capability.

## Options considered

### Option A: Per-session subchain

Each Claude Code session gets its own `chain_id` namespace, keyed by session identifier (e.g., `agent.session_<session_id>`). Sessions mint into isolated subchain directories. A periodic aggregation step collects subchain heads and mints a roll-up receipt into the canonical root chain.

- **Pro:** Full attribution isolation. No race condition on `chain-head.txt`. A single-session audit report is always complete and uncontaminated by other sessions.
- **Con:** Aggregation introduces a new unsolved problem: when does aggregation run, who triggers it, and which session owns the roll-up receipt? Roll-up timing creates a new class of "pending" state. The canonical chain becomes a two-level structure that all existing tooling must be updated to traverse.
- **Cost:** Every mint envelope acquires a `chain_id` field referencing the session's subchain. A roll-up aggregation mechanism must be designed and its own policy ADR authored. Existing receipt viewers and `chain.py` gate must be updated to handle nested chain traversal.

### Option B: Filesystem mutex on `chain-head.txt`

Serialize all mints behind an exclusive lock. The locking primitive is `flock(2)` on the `chain-head.txt` file itself (or a sibling `.chain-head.lock` file). A session wishing to mint acquires the exclusive lock, reads the current head, writes the receipt, advances the head, then releases. Concurrent sessions wait.

- **Pro:** Preserves the existing single-chain model exactly. No structural changes to the receipt envelope or chain directory layout. Chain integrity proofs remain as simple as today: one file, one linked list.
- **Con:** Introduces latency: a session that acquires the lock holds it for the full mint operation (digest derivation + file write + head update). Under high-concurrency scenarios (many parallel `dema-assure all` runs), sessions may queue. Lock acquisition failure (crash, SIGKILL) requires a recovery policy to remove stale locks. Option B alone does not add per-session attribution to the receipt envelope; Companion change 2 is required to close that gap.
- **Cost:** Every mint call in `mint_lib.py` must wrap the write section in `fcntl.flock`. Lock contention metrics must be captured (wait time, retries) and surfaced in `perf.py`. A typed retry policy is needed for stale-lock recovery.

### Option C: Declare chain as shared resource

Acknowledge the current reality explicitly: the Node0 chain is a shared filesystem resource. Document concurrent-mint semantics openly in the chain spec. Add a `session_id` field to the receipt envelope as metadata. Apply no lock and no subchain isolation. Operators see attribution per receipt but there is no enforcement preventing concurrent writes.

- **Pro:** Zero structural change to `mint_lib.py` or chain traversal code. `session_id` metadata alone makes attribution visible in the receipt viewer. Honest about the current state rather than retroactively imposing a constraint the original design never promised.
- **Con:** Does not eliminate the race on `chain-head.txt`. Two simultaneous writes can corrupt the head pointer if both sessions read the same previous head and write different values in rapid succession. In practice the risk is low on a single-operator Node0 with one active human; under automated testing or parallel assurance runs the risk increases.
- **Cost:** Every mint envelope acquires a `session_id` field. Operators can see attribution but have no enforcement guarantee. A note in ADR-006 or a companion update doc must clarify that the single-producer assumption is relaxed.

## Decision

Deferred to operator typed-GO.

ADR-007 identifies the problem, maps the forensic evidence, and proposes the three options above with their trade-offs. It does not select among them. The choice of Option A, B, or C involves non-trivial engineering cost and policy implications (aggregation timing, lock recovery, or relaxed consistency guarantees) that must be weighed by the operator. The selection among A, B, and C is its own halt-gate decision, requiring a separate typed GO. Until that GO is issued, the chain continues to operate in the current unguarded state, and all cross-session findings should be noted with their session-scoped view qualifier per the forensic canon.

## Consequences

### If Option A is selected

Every receipt mint envelope acquires a `chain_id` field referencing the emitting session's subchain identifier. The canonical root chain is extended only via the roll-up aggregation step, not directly by individual sessions. The aggregation mechanism (trigger, ownership, receipt schema) requires its own ADR before implementation. All receipt-reading tooling (`chain.py`, `dema audit`, `dema receipts`) must be updated to traverse the two-level structure. Existing chain receipts pre-dating Option A adoption retain their current flat structure and are treated as root-chain entries.

### If Option B is selected

Every call to `mint_lib.mint_receipt` acquires an exclusive filesystem lock before writing. Lock wait time and retry counts become new fields in `perf.py` metrics. A stale-lock recovery procedure is documented (timeout threshold + manual removal path). No change to the receipt envelope schema beyond adding optional `lock_wait_ms` to the metrics payload. The chain structure, traversal, and attribution model are unchanged from today. When paired with Companion change 2, the receipt envelope additionally acquires `session_id` for cross-session attribution under the serialized-mint regime.

### If Option C is selected

Every receipt mint envelope acquires a `session_id` field (populated from the Claude Code session identifier or a process-derived token). Operators can correlate receipts to the session that produced them. The race on `chain-head.txt` is acknowledged as a known risk managed by Node0's single-operator model. A brief "concurrent-mint semantics" section is added to `mint_lib.py`'s module docstring declaring the shared-resource contract.

## Companion changes (independent of A/B/C choice)

The following three changes can land regardless of which option is selected. They improve forensic capability and attribution transparency without committing to any chain architecture decision:

1. **Lift `head -c 500` truncation in `~/.claude/settings.json` PreToolUse Bash hook.** The current 500-byte cap hides cross-session command bodies, making attribution forensics difficult. Raising the cap to `head -c 4000` (or routing full bodies to a sidecar file) restores the ability to reconstruct which session issued which command. This change is scoped to `~/.claude/settings.json` and requires a separate typed-GO as it touches audit infrastructure.

2. **Add `session_id` field to the receipt envelope as metadata.** This is a non-breaking envelope addition — the `session_id` field is informational and does not affect chain-integrity validation, `prev_digest` linkage, or `self_digest` computation. It provides attribution for every future mint regardless of whether Option A, B, or C governs the chain structure. This change touches `mint_lib.py` and requires a separate typed-GO as it is a code change.

3. **Update memory canons that claimed "chain unchanged" within a single-session view.** Any canon entry asserting "chain unchanged" without a session-scope qualifier is now potentially misleading. The forensic canon's §"Discipline encoded" rule requires adding "as-of HH:MM session view" qualifiers to such claims. This change targets operator-side memory files (`~/.claude/projects/.../memory/`) and requires a separate typed-GO.

## Companion change status (post-acceptance · verified 2026-05-18)

All three companion changes have been executed end-to-end with disk evidence. Status verified by direct file inspection on 2026-05-18 GST.

| # | Change | Status | Evidence anchor |
|---|---|---|---|
| 1 | Lift `head -c 500` bash hook truncation | **RESOLVED** | `~/.claude/settings.json:330` — cap is now `head -c 4000` |
| 2 | Add `session_id` field to receipt envelope | **RESOLVED** | `~/.dema/kernel/assurance/mint_lib.py:95` — `_resolve_session_id()` function carries explicit "ADR-007 §6 CC2 + audit P0-2" reference; env-var resolution chain `session_id arg → CLAUDE_SESSION_ID → CLAUDE_CODE_SESSION_ID → "unknown"` |
| 3 | Add session-scope qualifiers to memory canons | **RESOLVED** | 12 qualifiers applied across 8 operator-memory files; 0 unqualified claims remain in canonical scope. Documented in operator-side memory canon (path redacted) on 2026-05-16 07:32 GST |

The companion changes are independent of the A/B/C selection. They are operational without committing the chain architecture to any of the three options. The A/B/C decision remains an open typed-GO halt-gate.

## Open questions

1. **Concurrent sessions — intentional or incidental?** Does Node0 currently host multiple concurrent Claude Code sessions by design (e.g., separate operator-side and implementation sessions running together), or was the 2026-05-12 dual-session state incidental? The answer determines whether Option B (serialize) or Option C (accept) is the right default posture.

2. **Latency tolerance for Option B.** The `dema-assure all` cycle currently completes in under 120 seconds (ADR-006 performance target). If two sessions overlap, lock contention could extend total wall-clock time. What is the operator's acceptable wait ceiling for a mint operation blocked behind a sibling session?

3. **Aggregation cadence for Option A.** If subchains are chosen, when should roll-up aggregation fire: hourly, daily, per-session-end, or on explicit operator command? Each has different consistency properties. Per-session-end aggregation requires a reliable session-end hook; hourly/daily aggregation leaves subchain entries temporarily invisible to root-chain viewers.

4. **Agent identity model.** Is `dema.node0_mission_agent` meant to be one logical agent per Node0 host (shared across all sessions), or one logical agent per Claude Code session? The answer determines whether the chain is fundamentally single-producer (Option B fits naturally) or multi-producer-by-design (Option C or A fits).

5. **Generalization to multi-node future.** When Node1 and subsequent nodes are activated, each will have its own agent chain. Does the cross-session finding on Node0 generalize: should Node0 be treated as if it is already a multi-node cluster with one node per Claude Code session? Or is the intra-node race qualitatively different from inter-node federation?

## References

- [ADR-002 No Shadow State](ADR-002-no-shadow-state.md) — establishes that all persistent state must be visible and inspectable; relevant because cross-session chain mutations are not visible to the session that did not produce them.
- [ADR-006 Continuous Assurance and No-mint Verification](ADR-006-continuous-assurance-and-no-mint-verification.md) — §1 Mint mode contains the single-producer assumption this ADR calls into question; V-I10 is the invariant whose cross-session blind spot is documented here.
- `mint_lib.py` at `~/.dema/kernel/assurance/mint_lib.py` — current implementation; single-producer assumption lives in the `mint_receipt` function's `chain-head.txt` read-modify-write sequence.
- Cross-session forensic canon at `project_cross_session_chain_mutation_discovered.md` (operator-side memory canon · path redacted) — operator-side primary evidence for the 2026-05-12 discovery.
- Bash audit log at `claude-bash-audit.log` (operator-side log · path redacted) — secondary forensic evidence channel; currently hampered by 500-byte truncation (see Companion changes item 1).
