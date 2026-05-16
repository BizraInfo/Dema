# ADR-007: Multi-Session Chain Policy

**Status:** Accepted
**Date:** 2026-05-12
**Accepted-Date:** 2026-05-16
**Decision makers:** Mumu (Mohamed Beshr)
**Supersedes:** none
**Related:** [ADR-002 No Shadow State](ADR-002-no-shadow-state.md), [ADR-006 Continuous Assurance and No-mint Verification](ADR-006-continuous-assurance-and-no-mint-verification.md)
**Implements:** none (option choice A/B/C remains a separate halt-gate)
**Evidence:** `project_cross_session_chain_mutation_discovered.md` (operator-side memory canon · path redacted) and three confirming events on 2026-05-16 documented in §Confirming evidence below.

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

## Confirming evidence (2026-05-16 GST)

Three additional cross-session events on 2026-05-16 GST confirm the pattern documented in this ADR and resolve Open Question 1 below ("intentional or incidental").

1. **05:07:27 GST — SessionStart hook stale by one commit.** Codex CLI (PID 10378, 22h 38m uptime, cwd `~/Downloads/Dema`) committed `8df722d` (`feat(core): add corpus preview index`) on the local detached chain while a sibling Claude Code session was being spawned. The sibling session's `SessionStart` hook captured `head: 92712db`, which was already one commit behind reality by the time the session loaded ~3 minutes later. **Per-session HEAD snapshots are stale by default in multi-producer environments, even at sub-minute timescales.** Any within-session claim of "HEAD unchanged" must re-read `git rev-parse HEAD` at the moment of the claim, not at session start.

2. **05:17 GST — stale external AI artifact recommended already-shipped action.** An external AI artifact dated "Sat, 16 May 2026" recommended committing a code change whose target subject (`fix(node-adapter): harden legacy shellout boundary`) had already been shipped 37 minutes earlier by Codex as commit `92712db`. The artifact's premise ("dirty by design, scoped to two files, waiting for packaging/commit") conflicted with disk state (`git status --porcelain` empty, both target files mtime ≥ 30 min stale). **Cloud-author artifacts can be hours stale on a live multi-producer host and must be verified against disk before any action.** Per the existing operator canon `feedback_cloud_disk_asymmetry`: disk wins over narrative.

3. **05:14 GST — forensic identification of `@openai/codex` as concurrent producer.** Process inspection identified the second producer as the `@openai/codex` CLI binary at PID 10378, parented to a `node codex` host. The producer holds the operator's GitHub-noreply identity (`Mohamed Beshr <155658129+BizraInfo@users.noreply.github.com>`), runs preview-only commits adhering to the "preview-only until proof gates pass" invariant, and was detached from any branch (59 commits ahead of `origin/main`). The chain was captured under the local label `codex/2026-05-16-preview-stream` (pointing at `8df722d`) to prevent loss before any further session-side acts.

**Resolution of Open Question 1:** concurrent sessions on Node0 are **intentional**. The operator runs a sustained Codex CLI session for preview-surface engineering alongside ad-hoc Claude Code sessions for forensic, ADR, and operator-side memory work. Node0 is therefore a multi-producer environment by design at the Claude-Code/Codex-CLI level, not an incidental dual-session state.

**Status promotion to Accepted locks:** (a) the problem statement, (b) the three options A/B/C and their trade-offs, (c) the deferred-decision posture on the option choice, and (d) the three Companion changes. **It does not choose Option A, B, or C.** That selection remains a separate halt-gate, now informed by the resolved Q1 answer favoring Option B (serialize) or Option C (accept-with-attribution) over Option A (per-session subchain), since multi-producer-by-design weakens the case for aggregation cost.

## Open questions

1. **Concurrent sessions — intentional or incidental?** Does Node0 currently host multiple concurrent Claude Code sessions by design (e.g., separate operator-side and implementation sessions running together), or was the 2026-05-12 dual-session state incidental? The answer determines whether Option B (serialize) or Option C (accept) is the right default posture. **Resolved 2026-05-16: intentional — see §Confirming evidence above.**

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
