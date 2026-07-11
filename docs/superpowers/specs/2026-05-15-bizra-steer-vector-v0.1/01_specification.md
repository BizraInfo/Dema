# BIZRA Steer Vector v0.1 Specification

## Status

Truth label: `DECLARED_STEER_VECTOR_SPEC_ONLY`.

This is a specification-only design artifact. It names valid steering paths,
autonomy levels, and constitutional bounds for Dema and BIZRA-facing agents. It
does not implement runtime code, start a daemon, grant capabilities, mint
receipts, activate federation, or authorize Step 7.

## Binding sources

- [BIZRA Topology Canon](../../../canon/BIZRA_TOPOLOGY_CANON.md)
- [Dema Autonomy Envelope v0.1](../../../02-architecture/dema-autonomy-envelope.md)
- [PAT-Builder / SAT-Validator Doctrine](../../../02-architecture/pat-builder-sat-validator.md)
- [LLM System Flow Contract](../../../LLM_SYSTEM_FLOW.md)

If this spec conflicts with any binding source above, the binding source wins.

## Definition

A **Steer Vector** is a declared direction of influence over what Dema, PAT, SAT,
or the operator should attend to, remember, propose, execute, validate, or
externally commit.

Steering is not execution by itself. A steer vector may only become an action
through the autonomy level and gate that matches its path.

```text
steer intent -> valid path -> autonomy level -> gate -> artifact / denial
```

## Required steer-vector fields

Any future machine-readable steer vector should carry these fields:

| Field                   | Meaning                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `steer_id`              | Stable local identifier for the steer vector.                                                             |
| `origin`                | Human, Dema, PAT, SAT, receipt, policy, or external adapter.                                              |
| `path`                  | One of the valid steering paths in this spec.                                                             |
| `autonomy_level`        | L0, L1, L2, L3, L4, or L5.                                                                                |
| `target`                | What the steer changes: attention, memory, proposal, local work, runtime mission, or external commitment. |
| `declared_purpose`      | Human-readable reason for the steer.                                                                      |
| `allowed_effect`        | Maximum effect the steer may produce at this level.                                                       |
| `required_gate`         | Consent, SAT verdict, exact GO, or none.                                                                  |
| `receipt_expectation`   | None, memory write, proposal artifact, local commit, runtime receipt, or external cross-reference.        |
| `reversibility`         | Inherent, local undo, append-only record, or irreversible.                                                |
| `forbidden_escalations` | Higher-level actions this steer must not trigger.                                                         |

## Valid steering paths

| Path                      | Name                      | Autonomy level | Valid origin                                                           | Valid target                                                                                            | Gate                                                                   |
| ------------------------- | ------------------------- | -------------: | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `SV0_OBSERVE`             | Attention steer           |             L0 | Human, Dema, PAT, SAT report                                           | What to inspect or prioritize                                                                           | None                                                                   |
| `SV1_REMEMBER`            | Memory steer              |             L1 | Human, Dema, PAT                                                       | Local preference, goal, note, or avoidance pattern under `DEMA_HOME` / `~/.dema`                        | Scope declared in current task                                         |
| `SV2_PROPOSE`             | Proposal steer            |             L2 | Human, Dema, PAT, SAT report                                           | Plan, mission draft, consent draft, refusal explanation, or option ranking                              | None for proposal; later action must re-gate                           |
| `SV3_LOCAL_WORK`          | Local work steer          |             L3 | Human, Dema, PAT                                                       | Repo edit, local artifact, local commit, or reversible local state update                               | Explicit bounded scope                                                 |
| `SV4_GOVERNED_RUNTIME`    | Runtime mission steer     |             L4 | Human through Dema/PAT, then SAT validation                            | Governed mission submission or receipt-chain mutation outside this repo                                 | Exact-string consent plus governed runtime path plus SAT admissibility |
| `SV5_EXTERNAL_COMMITMENT` | External commitment steer |             L5 | Human only, mediated by Dema/PAT and certified by SAT where applicable | Push, PR, publication, timestamp, identity artifact, federation, payment, governance, or economy action | Typed in-the-moment GO for the specific irreversible action            |

No other steering path is valid in v0.1.

## Path details

### SV0_OBSERVE — attention steer

SV0 changes what is inspected, highlighted, sorted, filtered, or summarized. It
may read files, reports, receipts, adapter status, or documentation. It may not
write memory, edit files, run missions, start runtime, or claim readiness.

Examples:

- "Audit the remaining dirty worktree."
- "Show only blocked todos."
- "Compare the staged diff to the canon."

### SV1_REMEMBER — memory steer

SV1 writes local memory or state under the approved local state root. It may
record goals, decisions, preferences, command activations, or session anchors.
It must be schema-tagged when a schema exists and must be inspectable later.

SV1 must not write hidden state, bias future proposals covertly, store secrets,
or raise autonomy without disclosure.

### SV2_PROPOSE — proposal steer

SV2 produces data: plans, mission drafts, consent plans, refusal explanations,
ranked options, diagrams, or specs. It may shape the next safe action, but the
proposal itself does not execute.

SV2 must not be treated as consent for L4 or L5. If an SV2 proposal is later
used by runtime, the runtime receipt should hash or reference the proposal.

### SV3_LOCAL_WORK — local work steer

SV3 may perform bounded local work such as documentation edits, tests, local
commits, or reversible file changes. It must produce a reviewable diff and stay
inside the named scope.

SV3 must not push, publish, start runtime, open PRs, issue identity material,
perform federation, or mint governed runtime receipts.

### SV4_GOVERNED_RUNTIME — runtime mission steer

SV4 crosses from local proposal into governed runtime. It requires exact-string
human consent, a ready governed runtime path outside this repo, and SAT
admissibility from the shared URP side before any L4 receipt can be born.

SV4 is append-only in evidence: the recorded receipt remains even if the mission
effect has an undo path. Dema may read/list the receipt; governed runtime issues
it.

### SV5_EXTERNAL_COMMITMENT — external commitment steer

SV5 covers irreversible or external acts: push, PR creation/merge, publishing,
timestamping, identity-bound artifacts, federation handshakes, payments,
governance actions, or economy actions.

SV5 requires typed in-the-moment GO for the exact action. Auto-mode, prior
approval, relayed approval, or a broad goal statement is not enough.

## Topology bounds

All steering must preserve the Topology Canon:

```text
Human -> DEMA (the face; surfaced by P7 Integrator/Nexus) -> PAT local work
PAT -> Membrane -> SAT in shared URP, when validation is needed
SAT -> Membrane -> PAT -> DEMA -> Human
```

Steer vectors must not introduce:

- per-user URP language,
- SAT-5 living inside each local node,
- direct PAT-to-node peer trust,
- direct human network operation,
- federation claims before proof gates pass.

## Constitutional bounds

| Bound               | Requirement                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| Dema boundary       | Dema is the local face, not the whole BIZRA system.                                              |
| Runtime boundary    | No runtime execution is authorized by this spec.                                                 |
| Consent boundary    | L4 requires exact-string consent; L5 requires typed in-the-moment GO.                            |
| SAT boundary        | L4+ cannot become system-recognized without SAT admissibility where the doctrine requires it.    |
| Receipt boundary    | Dema reads/lists receipts; governed runtime issues them.                                         |
| State boundary      | Operator-scoped local state stays under `DEMA_HOME` or `~/.dema`.                                |
| Data boundary       | Raw private data, secrets, keys, and identity documents must not be inserted into steer vectors. |
| Federation boundary | Node1, Node2, and broader mesh operations remain preview-only until proof gates pass.            |
| Economy boundary    | No token, reward, payment, or governance action is valid below SV5.                              |
| Proof language      | Use preview, declared, planned, measured, and blocked labels honestly; do not overclaim.         |

## Invalid steering patterns

| Invalid pattern                                                   | Why it is rejected                                              |
| ----------------------------------------------------------------- | --------------------------------------------------------------- |
| `SV2_PROPOSE -> SV4_GOVERNED_RUNTIME` without fresh exact consent | Proposal is data, not permission.                               |
| `SV1_REMEMBER -> SV5_EXTERNAL_COMMITMENT`                         | Memory cannot authorize irreversible action.                    |
| `SV3_LOCAL_WORK -> git push`                                      | Local work does not include external publication.               |
| `SV4_GOVERNED_RUNTIME -> receipt minted by Dema repo`             | Dema reads/lists; governed runtime issues.                      |
| `SAT report -> direct file edit`                                  | SAT validates; PAT/Dema performs local builder work if allowed. |
| `Human broad goal -> federation handshake`                        | Federation is L5 and needs exact action GO plus proof gates.    |
| `Auto-mode -> identity artifact`                                  | Identity-bound artifacts are L5 hard stops.                     |
| `Steer vector -> hidden daemon`                                   | Hidden daemons are forbidden at every level.                    |

## Refusal rules

A steer vector must fail closed when:

1. its path is not one of the six valid paths;
2. its requested effect exceeds its autonomy level;
3. its target conflicts with the Topology Canon;
4. consent is missing, stale, relayed, fuzzy, or broader than the action;
5. it attempts to move raw private data, secrets, or identity material;
6. it asks Dema to mint a governed runtime receipt;
7. it asks for federation, economy, publication, or identity work without SV5 GO;
8. it cannot produce a reviewable artifact or denial reason.

## Example declarations

```text
SV0_OBSERVE:
  target: staged diff
  allowed_effect: summarize risk
  required_gate: none
```

```text
SV2_PROPOSE:
  target: Node0 mission draft
  allowed_effect: produces executes:false proposal
  required_gate: none until promotion to SV4
```

```text
SV3_LOCAL_WORK:
  target: docs-only spec
  allowed_effect: create Markdown file and run non-runtime checks
  required_gate: bounded task scope
```

```text
SV5_EXTERNAL_COMMITMENT:
  target: push branch
  allowed_effect: external publication
  required_gate: typed in-the-moment GO naming branch and remote
```

## Completion criteria for this spec

This v0.1 spec is complete when it:

1. names all six valid steering paths;
2. maps each path to exactly one autonomy level;
3. states the required gate for each path;
4. preserves the Topology Canon and PAT/SAT split;
5. declares runtime, receipt, federation, identity, and economy hard stops;
6. remains Markdown-only and under 500 lines.
