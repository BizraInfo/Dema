# ADR-051: One Dema per Node — the Companion Membrane and the Two-Plane Memory Federation

**Status:** Proposed
**Date:** 2026-07-31
**Deciders:** Mumu (operator) · SAT review before any promotion
**Truth posture:** `DECLARED_DRAFT` — this ADR canonizes operator-dictated
doctrine (2026-07-31 session) so the shape cannot drift. Almost everything
here is `[DECLARED]` or `[GREENFIELD]`; the few `[EXISTS]` anchors are named.
Nothing promotes a surface.

---

## Context

The operator articulated Dema's constitutional role: the human should never
have to wrestle with the personal agent team (PAT ×7), the system agent team
(SAT ×5), or raw alignment machinery. Dema — named for the founder's
daughter, bound to its node for the node's lifetime like a movement in its
case — is the single face the human ever meets.

Simultaneously: every node's memory must be sovereign, while every Dema
should get smarter from what all Demas learn. Those two demands conflict
unless the planes are separated by law, not by policy.

`[EXISTS]` anchors: PAT-1..7 / SAT-1..5 organs · URP vocabulary and
`node0-local-urp-proof` test lineage · verification-admission kernel v0.2
(the gate pattern this ADR reuses) · receipts/ISNAD chain discipline.

`[EXISTS ELSEWHERE — not Dema core]`: GenomeFS capsule `sensitivity` classes
including `CONFIDENTIAL_IP` live in the **filefactory** tree
(`/data/bizra/repos/bizra-filefactory`), not in `packages/core`. Dema's own
sensitivity vocabulary is different (personal / financial / …). Any use of
`CONFIDENTIAL_IP` by this ADR requires an explicit import-or-map decision
first; it is cited here as a cross-repo reference, never as a Dema anchor.
*(Corrected 2026-07-31 after an independent audit caught the false anchor.)*

`[NOT THIS]`: `packages/core/src/dema-first-lesson-canon.js` is a shipped
local markdown-retrieval seed. It is **not** an Experience-plane typed
lesson and shares no schema with §4. The name collision is real; the Lesson
schema (Action 1) must not reuse "lesson canon" as an identifier.

## Decision

Adopt the **Companion Membrane + Two-Plane Federation** model:

1. **One Dema per node, for life.** A node is activated by binding exactly
   one Dema; the binding is permanent, personal, and non-transferable. Dema
   is not an app on the node; it is the node's companion identity.
2. **The membrane law.** The human speaks only to Dema. Dema translates
   intention into missions for PAT, receives SAT verdicts, and surfaces to
   the human only: proposals, consent requests, receipts, and the three
   sovereign boundaries. Agent-team internals (retries, worker forks,
   validator disputes) never reach the human unrequested.
3. **Two planes, separated by law:**

```text
PERSONAL PLANE (sovereign, local, lifetime)
  memories · files · conversations · preferences · secrets · relationships
  → NEVER federates. Not to the URP, not to another Dema, not to training,
    not "anonymized". (Replication is a different axis — see §3.1.)

EXPERIENCE PLANE (communal, BIZRA URP knowledge graph)
  distilled lessons: strategy outcomes · failure patterns · verifier designs
  · routing statistics · skill improvements — content-addressed, receipted
  → flows OUT through the Lesson Admission Gate only
  → flows BACK daily to every Dema (the collective optimization loop)
```

### 3.1 Replication vs federation — reconciling ADR-004

An independent audit found this ADR's original wording ("never leaves the
node, not for sync") in **direct contradiction** with ADR-004 §Sync
(Accepted): *"opt-in only; user explicitly chooses what syncs to cloud"*.
A Proposed ADR may not silently override an Accepted one. The contradiction
was real; the resolution is that they govern **two different axes**:

```text
REPLICATION  — the human copies THEIR OWN memory to storage THEY control
               (backup, second device). Governed by ADR-004: opt-in,
               per-category, explicit consent. ADR-051 does not restrict it.
               The data stays the human's; no other Dema can read it.

FEDERATION   — memory crosses to the URP / another Dema / a training set.
               Governed by ADR-051: for the Personal Plane, FORBIDDEN,
               with no opt-in and no consent path. Only typed lessons
               (§4) may ever cross, and only through the Admission Gate.
```

`D` — ADR-004 remains authoritative for replication and is **not** amended.
ADR-051 governs federation only. A future sync implementation must satisfy
both: ADR-004's per-category consent *and* ADR-051's rule that the
destination must be operator-controlled storage, never a shared plane.
*(Added 2026-07-31; the original absolute wording was a doctrine defect.)*

4. **The Lesson Admission Gate** `[GREENFIELD]` — the same fail-closed
   pattern as verification-admission v0.2, applied to knowledge egress. A
   lesson may cross from Personal to Experience plane only when ALL hold:
   - **typed**: matches a lesson schema (pattern, evidence-class, outcome) —
     never free narrative, never transcript, never document content;
   - **judge-free provenance**: bound to receipts (mission id, verifier,
     outcome hashes), not to model summaries of what happened;
   - **privacy-scrubbed structurally**: no PII fields exist in the schema —
     scrubbing by construction, not by redaction;
   - **sensitivity-gated**: source capsules marked `CONFIDENTIAL_IP` or
     stricter require explicit operator consent per lesson class;
   - **fail closed**: unknown lesson type → refused; unbound evidence →
     refused; certifier = proposer → refused.
5. **The daily loop** (`optimize all Demas`):

```text
node experience (receipts, outcomes)
  → Dema distills candidate lessons
  → Lesson Admission Gate (fail-closed, receipted)
  → URP knowledge graph (content-addressed, ISNAD lineage)
  → nightly pull by every Dema
  → attunement: each Dema's routing/skill priors update from
    VERIFIED communal lessons only — never from another node's raw data
```

## Options Considered

### Option A: Central shared memory (industry default)
All user context in one cloud store, per-tenant rows.
**Refused on law:** violates memory sovereignty; one breach = every life
exposed; "anonymization" of rich personal memory is a known fiction.

### Option B: Fully isolated Demas, no sharing
Perfect privacy, zero collective learning.
**Refused on physics:** every Dema repeats every other Dema's failures;
the network never compounds; BIZRA's moat (governed collective experience)
never forms.

### Option C: Two-plane federation with admission-gated lessons — **CHOSEN**
| Dimension | Assessment |
|---|---|
| Privacy | Personal plane never egresses — by construction |
| Compounding | Every verified lesson lifts every node, daily |
| Alignment surface | Human faces one companion, not twelve agents |
| Precedent | Federated-learning-adjacent, but receipts replace gradient trust |
| Cost | Lesson schema + gate + URP graph sync — sliced, bounded |

## Trade-off Analysis

`D` — The gate will refuse useful knowledge. A rich anecdote about *why* a
customer negotiation worked cannot cross, because it cannot be scrubbed by
construction. That loss is the price of the sovereignty guarantee, and it is
the correct trade: BIZRA's asset is trustworthy records, and one leaked
memory poisons the entire promise. Lessons compound slower than gossip —
and remain admissible in court, in audits, and in conscience.

## Consequences

**Easier:** onboarding (a new node's Dema starts with the whole network's
verified experience, zero personal data) · trust narrative (provable "your
memory never leaves") · alignment (one membrane to harden, not N surfaces).
**Harder:** lesson schema design is real work per domain · URP graph needs
lineage + revocation (a lesson traced to a falsified receipt must be
recallable network-wide) · nightly attunement must itself be receipted.
**Revisit:** lesson classes for `CONFIDENTIAL_IP` sources; cross-node
dispute resolution when lessons conflict.

## Action Items

1. [ ] Lesson schema v0.1 (typed classes: failure-pattern, verifier-design,
   routing-outcome, skill-delta) — pure kernel + tests, same idiom as
   verification-admission.
2. [ ] Lesson Admission Gate kernel `[GREENFIELD]` — reuse v0.2 gate
   pattern; refusal reasons: `untyped_lesson`, `unbound_evidence`,
   `pii_capable_schema`, `sensitivity_consent_required`, `self_certification`.
3. [ ] URP graph node/edge schema with ISNAD lineage + recall edge.
4. [ ] Membrane contract doc: exactly what Dema surfaces to the human
   (proposals · consent · receipts · sovereign boundaries) and what it
   structurally cannot surface.
5. [ ] All of the above wait behind the L1 loop slice (ADR-049 order holds —
   no complications before the base caliber is certified).

## What this ADR does not prove

That any federation exists. There is one node, one Dema, and a gate pattern
proven only for verifier admission. This ADR fixes the *shape* so that when
the second node is born, its Dema inherits a constitution, not a habit.
`Disk wins.`
