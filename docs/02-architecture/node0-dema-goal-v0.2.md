# Node0 + DEMA Goal v0.2 — Canonical

**Title:** MoMo Local Seed → Local Active → Private 5-Node Proof Mesh
**Status:** Canon-ready · Truth-label discipline applied · Authored 2026-05-17 GST
**Supersedes:** Node0 + DEMA Goal v0.1 (canon-ready after precision edits) — preview/active/runtime wording is sharpened in this version.

---

## 1. Canonical goal statement

Node0 + DEMA must become MoMo's local, mission-centered sovereign intelligence homebase: a calm cockpit where the mission is visible, local models serve as bounded reasoning tools, PAT proposes, SAT-style policy previews validate, DEMA enforces micro-consent, evidence is prepared, receipts are previewed, and every next action is truth-labeled — before any autonomous runtime, canonical mint, federation, public network, or raw-data sharing.

This aligns with the Third Fact principle that BIZRA is not model-centric: the human mission is the center, the model is a tool, the agent is a servant, the node is sovereign, the receipt is witness, the constitution is boundary, and URP is commons.

---

## 2. Truth-safe state labels

| Label                        | Meaning                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `NODE0_LOCAL_SEED`           | Current implementation stage. Seed pattern exists, preview modules exist, but active local mission runtime is not yet complete. |
| `NODE0_LOCAL_ACTIVE_PREVIEW` | DEMA can render state, prepare mission, preview PAT/SAT policy flow, and generate receipt preview.                              |
| `NODE0_LOCAL_ACTIVE_BOUNDED` | One local mission loop runs with local-model support, micro-consent, evidence preview, and receipt preview.                     |
| `PRIVATE_5_NODE_GHOST`       | Node1–4 exist only as ghost/hold profiles. No live mesh.                                                                        |
| `PRIVATE_5_NODE_PILOT`       | Only after Node0 diagnostic, Step 7 decision, offline fixture, and read-only probe gates pass.                                  |
| `PUBLIC_BIZRA`               | Only after legal, security, UX, memory, performance, and proof gates pass.                                                      |

**Nuance:** the Third Fact uses `URP_LOCAL_ACTIVE` as the public stage name for Node0 alone. For implementation precision we use `URP_LOCAL_SEED` internally until runtime instrumentation and the local mission loop are green. `URP_LOCAL_ACTIVE` is reserved for quoting the public Third Fact stage language.

---

## 3. Ownership model (canonical)

```text
MoMo         = sovereign operator / player
Node0        = local sovereign homebase
DEMA         = visible bridge / living cockpit
PAT          = user-owned private think tank (7 personal agents)
SAT          = system-owned / protocol-owned guardians (5 system agents),
               previewed locally until shared URP/SAT runtime exists
FATE         = constitutional boundary gate
Local LLM    = supporting reasoning resource
Local URP    = private node inventory
Shared URP   = future shared-world substrate (locked)
Receipts     = proof witnesses
```

---

## 4. Wording discipline (corrections vs v0.1)

| Replace (v0.1)                                            | With (v0.2)                                                                                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "SAT can approve/block through protocol verdicts."        | "SAT-style policy verdicts are previewed locally until shared URP/SAT runtime is proven."                                                                           |
| "Evidence is recorded. A receipt preview is created."     | "Evidence is prepared or preview-recorded. A receipt preview is created; canonical receipt minting remains typed-GO gated."                                         |
| `URP_LOCAL_ACTIVE` (when describing implementation state) | `URP_LOCAL_SEED`                                                                                                                                                    |
| "No runtime is required."                                 | "No autonomous runtime, federation, canonical mint, public network, or raw-data sharing is required." (because local model calls are still bounded runtime actions) |

---

## 5. Refined minimal solvable special case

The smallest local mission loop that proves the entire idea:

```
1.  MoMo opens DEMA.
2.  DEMA loads Node0 state.
3.  MoMo gives one mission.
4.  PAT proposes a plan.
5.  SAT-style policy preview blocks risky effects.
6.  MoMo approves C2 draft only.
7.  Local LLM drafts as a bounded support engine.
8.  DEMA truth-labels the output.
9.  EvidenceChain preview records the event.
10. Receipt preview appears.
11. DEMA recommends the next safe action.
```

**Success condition:**

```
No autonomous runtime.
No federation.
No canonical mint.
No Node1 connection.
No raw-data scan.
No public claim.
No hidden daemon.
No unverified claim.
```

This matches the Third Fact proof chain: mind may propose, memory may retrieve, logic must test, crypto must seal, receipts must preserve, and the human sovereign must consent.

---

## 6. Canonical operating law

```
MoMo before mesh.
Mission before model.
Profile before prompt.
Consent before capability.
Evidence before receipt.
Receipt before reward.
Node0 before Node1.
Ihsān before scale.
```

Aligned with the Third Fact value chain: contribution → verification → receipt → impact score → reward eligibility. No reward without audit trail.

---

## 7. Execution order (canonical)

### Phase 0 — Stabilize current branch

- Settle PR #48 CI (proof-quality green; Node 20 coverage is a separate fix).
- Do not mix CI proof-class repair with DEMA local-active work.

### Phase 1 — Build the truth object: `dema state --json`

Required output shape (see §10):

```json
{
  "schema": "bizra.dema.node0_state.v0.1",
  "truth_label": "NODE0_LOCAL_SEED",
  "operator": "MoMo",
  "node": "Node0",
  "mission_centered": true,
  "runtime": {
    "autonomous_daemon": false,
    "federation": false,
    "minting": false,
    "public_network": false
  },
  "pat": {
    "status": "planned_or_preview",
    "owner": "human",
    "loyalty": "user_mission"
  },
  "sat": {
    "status": "policy_preview_or_stub",
    "owner": "system",
    "loyalty": "system_integrity"
  },
  "local_models": {
    "status": "inventory_or_available",
    "role": "bounded_supporting_resource",
    "routing_allowed": false
  },
  "shared_urp": { "status": "locked_preview" },
  "next_safe_action": "..."
}
```

### Phase 2 — Living cockpit foundation

1. DEMA Homebase first screen
2. Profile / context-capsule preview
3. Local model inventory + router preview
4. Consent Card
5. One preview-only mission loop
6. EvidenceChain preview
7. Receipt preview

### Phase 3 — Node0 bounded diagnostic

Diagnostic must prove: mission object · profile capsule · PAT proposal · SAT-style policy preview · consent state · bounded local-model output · EvidenceChain preview event · receipt preview · blocked-actions list · release-readiness pass.

### Phase 4 — Private 5-node ghost fixture

Node1–4 as ghost profiles only. No sockets. No raw-data exchange. No runtime delegation. Handoff / refusal / rollback schemas exist. Partition / rejoin / malicious-node scenarios pass.

---

## 8. Definition of Done (Node0 Local Active)

```
[ ] dema state --json exists
[ ] local model router (preview) exists
[ ] profile / context capsule (preview) exists
[ ] PAT / SAT ownership split is explicit
[ ] one mission loop runs preview-only
[ ] consent card appears
[ ] EvidenceChain event preview is produced
[ ] receipt preview is produced
[ ] blocked actions are visible
[ ] tests pass
[ ] release-readiness clean
```

---

## 9. Canonization paragraph

> Node0 + DEMA are the first local proof of BIZRA's Third Fact architecture. Node0 is not yet a public network and DEMA is not yet an autonomous runtime. The immediate goal is MoMo Local Seed → Local Active: a mission-centered homebase where DEMA renders truth state, PAT proposes, SAT-style policy previews validate, local models support bounded reasoning, micro-consent gates action, evidence is prepared, and receipts are previewed. Only after this loop is proven should Node0 advance toward bounded diagnostics, ghost-node fixtures, private five-node pilot, and public BIZRA readiness.

---

## 10. State schema reference

The first implementation slice (`dema state --json`) emits a frozen JSON object conforming to `bizra.dema.node0_state.v0.1`. Source of truth: `packages/core/src/state.js` (`buildNode0StatePreview`).

Boundary invariants enforced by the schema:

- `runtime.autonomous_daemon` = `false`
- `runtime.federation` = `false`
- `runtime.minting` = `false`
- `runtime.public_network` = `false`
- `local_models.routing_allowed` = `false`
- `shared_urp.status` = `"locked_preview"`

Any preview that flips one of these to `true` is a contract violation and must be rejected by the test suite.

---

## 11. Reference anchors

- Repo charter: `docs/02-architecture/repo-charter.md`
- LLM system flow: `docs/LLM_SYSTEM_FLOW.md`
- ADR-001 (Dema is one face): `docs/06-adr/ADR-001-dema-is-one-face.md`
- ADR-005 (exact-string consent): `docs/06-adr/ADR-005-operator-actions-require-explicit-consent.md`
- Boundary core vs face: `docs/02-architecture/boundary-core-vs-face.md`
