---
id: doc-002
title: BIZRA Product and Engineering Lifecycle Audit v1
type: other
created_date: '2026-07-21 01:07'
updated_date: '2026-07-21 01:37'
tags:
  - audit
  - product-proof
  - governance
---
# BIZRA Product and Engineering Lifecycle Audit v1

## Audit identity

```yaml
audit_id: BIZRA-PDMLC-BASELINE-1A
generated_at: 2026-07-21T05:23:12+04:00
last_verified_at: 2026-07-21T05:36:51+04:00
repository: BizraInfo/Dema
canonical_commit: efc2b4381c6d4f641bdfa1f64db9e383e5425c45
canonical_tree: 1b33e560a0a86ebb85299ae83a9d800f5d042792
truth_label: LOCALLY_EXECUTED_WITH_LIVE_GITHUB_EVIDENCE
external_authenticity: NOT_PROVEN
authority_delta: 0
```

This is a repository-grounded audit. It authorizes no code change, branch mutation,
push, PR closure, merge, release, runtime start, model invocation, corpus content
read, receipt mint, or external publication.

## Executive verdict

```yaml
product_stage: ALPHA_EVIDENCE_BOUNDED_PRE_PRODUCTION
product_code_regression_from_pr_407: NOT_DEMONSTRATED
release_evidence: BLOCKED_INCOMPLETE
local_exact_main_proof_surface: RED_IN_ARBITRARY_BASENAME_WORKTREE
remote_root_quality_security_rails: GREEN
remote_ui_rail: ABSENT_ON_MAIN
remote_semantic_review_rails: NOT_EXECUTED
mission_runtime_0a: PLANNING_ONLY_NOT_READY_TO_IMPLEMENT
decision: PROCEED_WITH_CORRECTED_SEQUENCE
```

The best code-backed product description is:

> Dema is a local-first BIZRA product face and bounded mission control/proof plane
> with deterministic replay, exact context-bound consent previews, a persistent
> operator-driven mission corridor, cryptographic proof primitives, metadata-only
> Recovery Mission gathering, and one sandbox-confined reversible action path.
> It is not yet an integrated Sovereign Mission Operating System or production
> mission worker runtime.

The strongest current differentiator is evidence discipline. The largest gap is
not another architecture document; it is convergence of release proof, one real
human-value mission, worker-substitution integration, and repeatable user outcomes.

No defensible composite maturity number is emitted. A number such as 3.62/5 has no
repository-defined weights or reproducible scoring function. The audit therefore
reports maturity by evidence class.

## 1. Exact state binding

### Canonical remote and clean tree

- Live `origin/main`: `efc2b4381c6d4f641bdfa1f64db9e383e5425c45`.
- Clean detached audit worktree: `/data/bizra/worktrees/integration-check`.
- Tree: `1b33e560a0a86ebb85299ae83a9d800f5d042792`.
- PR #407 head `7b68f885bb638d728576957abe4ff9fcf2fcb9c8` has the same tree and zero changed files.

### Active checkout is not canonical main

The active checkout is
`chore/backlog-init-agent-instructions@2922897214ebdd4c23d1f9f3e954f2e09804b1ea`.
It is 7 commits ahead and 7 behind canonical main. Its tree differs by 188 files,
1,040 insertions, and 35,890 deletions. It must not be treated as main or used as
a feature base as-is. Untracked Backlog, plugin, and design artifacts were preserved
and not absorbed into product claims.

## 2. PR #407 release-corridor finding

PR #407 is an empty verification commit over exact main. Its live state:

| Rail | Result |
| --- | --- |
| check / Node 20 | PASS |
| check / Node 22 | PASS |
| CodeQL | PASS |
| gitleaks | PASS |
| BIZRA Review Gate | FAIL |
| CodeRabbit / Socket advisory checks | PASS |

Inside BIZRA Review Gate, install, `npm test`, coverage, and `npm run check`
passed. Failure occurred at `Resolve BIZRA review class`:

```text
Unsupported BIZRA review branch: verify/main-after-405
Process completed with exit code 1.
```

The semantic steps `pr-class`, `proof-scope`, `no-overclaim`, and
`receipt-integrity` were skipped.

Precise classification:

```yaml
root_cause: NONCONFORMING_BRANCH_NAME_REJECTED_BY_DOCUMENTED_FAIL_CLOSED_POLICY
workflow_policy_inconsistency_for_verify_prefix: NOT_DEMONSTRATED
release_process_mismatch: VERIFIED
product_regression: NOT_DEMONSTRATED
release_ready: false
```

`verify/*` is absent from both the workflow resolver and the script-side policy.
The fail-closed result is correct. The preferred recovery is a fresh accepted
`ci/*` verification branch/PR on the exact candidate tree. Adding `verify/*`
would be a policy change requiring synchronized workflow, script, tests, and docs;
a YAML-only change would still fail `pr-class`.

Separate drift: the workflow accepts `copilot/*` while the script-side broad-scope
prefix list does not. This is real synchronization drift, but it is not the cause
of PR #407.

Evidence:
- `.github/workflows/bizra-review.yml:36-83`
- `scripts/review/pr-class.mjs:31-102`
- GitHub run `29681212875`, job `88177613297`

## 3. New local reproducibility finding

The same exact main tree is not green in the arbitrary-basename clean worktree.

`npm test` result:

```yaml
tests: 7674
pass: 7673
fail: 1
failing_test: proof-room-bundle CLI --public-safe --json emits redacted bundle
expected_repo_root_basename: Dema
actual_repo_root_basename: integration-check
exit_code: 1
```

`npm run check` independently failed on the same assertion with 7,709 passes
and one failure. `npm run pre-push:seal` failed because `npm run check` failed.
`npm run delivery:check` therefore exited 1.

Root cause is `tests/proof-room-bundle.test.js:292`, which hard-codes
`repo_root_basename === "Dema"`. The identical source/test passes from the
`/home/bizra-operating-system/Downloads/Dema` checkout. Current production output
reports the actual basename while the test requires a stable literal. The repository
does not yet ratify which behavior is the PUBLIC_SAFE privacy contract.

This is a release-proof contract/portability defect, not a demonstrated product-code
regression. TASK-020 owns the original defect; TASK-028 is the reconciled release-
corridor umbrella.

## 4. Gate-integrity finding

On canonical main, the `test`, `coverage`, and `check` scripts pipe through
`tee` and then invoke the classifier after a semicolon. This can discard the
original command exit in defined combined-failure cases. TASK-018 closes the issue
on `fix/check-exit-integrity-1b@e5886a1`, two commits directly over canonical main,
but that fix is not merged.

Until TASK-018 lands, a green classifier exit is not sufficient evidence that every
underlying gate exited zero.

## 5. Proof ledger from the audit

### Exact-main local results

| Command | Result | Interpretation |
| --- | --- | --- |
| 10-surface focused test slice | 171/171 PASS | Bounded kernel evidence only |
| Architecture focused slice | 371/371 PASS | Bounded exact-main architecture evidence only |
| Recovery focused slice | 7/7 PASS | Bounded recovery evidence only |
| Local URP + signed mission-lifecycle slice | 317/317 PASS | Local preview/structural-proof evidence only |
| Ten focused semantic review scripts | 10/10 PASS | Local script evidence; these were not executed by PR #407 |
| `npm test` | FAIL, 7,673/7,674 | Checkout-basename portability defect |
| `npm run check` | FAIL, 7,709/7,710 | Same defect |
| `npm run llm:guidance` | PASS, 7/7 | Guidance routing only |
| `git diff --check` | PASS | Diff hygiene only |
| `npm run release:readiness` | PASS, 100/100 | Configuration/readiness audit, not aggregate release proof |
| `npm run proof:verdict` | PASS, `READY_LOCAL` | Hermetic local-only kernel result |
| `npm run pre-push:seal` | FAIL | `npm_check` failed |
| `npm run delivery:check` | FAIL | μ pre-push gate failed |
| `dema peak-self-loop --json` | PASS, PREVIEW_ONLY | Deterministic declared-fixture critique only |

A `release:readiness` score of 100 and a hermetic `READY_LOCAL` must not outrank
the failing executable suite, pre-push seal, delivery gate, or remote Review Gate.
They are component outputs, not the final release verdict.

### Branch-only focused results

| Candidate | Focused result | Integration status |
| --- | --- | --- |
| Mission Contract `1a2a7f` | 13/13 PASS | Remote branch, no PR, dirty worktree symlink, not merge-ready |
| Model Swap `3f72e6f` | 16/16 PASS | Remote branch, no PR, absent main |
| Worker Handoff `0ff5399` | 28/28 PASS | Local-only branch, no remote, no PR, absent main |

Focused green means the bounded test passed; it does not mean integrated, reviewed,
release-ready, or proven in a live mission.

## 6. Architecture and capability maturity map

| Domain | Exact-main maturity | Code-backed finding | Exact evidence |
| --- | --- | --- | --- |
| Product face | PARTIAL | Real CLI/front door; complete customer-journey and cross-surface parity are not demonstrated | `bin/dema`; `apps/cli/src/commands`; `npm run llm:guidance` 7/7 |
| Canonical preview boundary | VERIFIED, schema scope | Frozen 17-key all-false schema; output equality alone does not prove effect containment | `packages/core/src/boundary-schema.js:6-50`; focused boundary tests |
| Node0 adapter/runtime | PARTIAL / DESIGNED_NOT_LIVE | Adapter delegates to an external gateway/status command or reports unavailable; no integrated governed runtime | `packages/node-adapter/src/node0-adapter.js:137-204` |
| Exact/context consent | PARTIAL | Exact phrase plus root/nonce/expiry preview are measured; consent is not effect containment | `packages/consent/src/root-bound-consent-envelope-preview.js:32-39`; focused consent tests |
| FATE / EffectCap enforcement | DESIGNED_NOT_LIVE | Registration/descriptor/consent gate invokes the registered handler; actual effects are not policed against `allowed_effects` | `packages/core/src/effect-cap.js:272-295` |
| Persistent Mission Corridor | VERIFIED, bounded control-plane scope | DEMA_HOME contract+journal, fresh-process reconstruction, atomic nonce race, and operator-consented terminal `STOPPED` transition; no worker/model/engine | `packages/mission/src/mission-corridor.js:32-46,217-229`; `apps/cli/src/commands/mission.js:1470-1475,1748-1795`; `tests/mission-corridor.test.js` |
| Mission Corridor physical containment | UNKNOWN / UNPROVED | Root binding is lexically normalized; symlink realpath containment is not proven | `apps/cli/src/commands/mission.js:1470-1475` |
| Signed mission lifecycle | VERIFIED, structural-proof scope | Signed, content-addressed lifecycle and transition contract exists; this is not a live supervisor | `packages/mission/src/mission-lifecycle.js:1-25,42-108,152-195,483-500`; `tests/mission-lifecycle*.test.js` |
| Realm replay | VERIFIED, kernel scope | Deterministic injected hash-chain replay; no durable store, restart, or external authenticity for this kernel | `packages/core/src/node0-realm-state-kernel.js`; `tests/node0-realm-state-kernel.test.js` |
| Recovery Mission | VERIFIED, bounded preview scope | Human-gated state machine plus metadata-only gatherer; no content interpretation, durable restart, auto-selection, or external authenticity | `packages/core/src/dema-recovery-mission-engine.js`; `packages/core/src/dema-recovery-mission-gatherer.js`; `tests/dema-recovery-mission-{engine,gatherer}.test.js`; 7/7 focused recovery slice |
| Reversible execute/undo | PARTIAL | One sandbox rename/backup/undo path; not a general sandbox/action engine | `packages/core/src/node0-reversible-execute-gate.js`; `tests/node0-reversible-execute-gate.test.js` |
| Receipts/signing | PARTIAL | Ed25519 binding, tamper rejection, and consent-gated persistent local authorship keys exist; hardware custody, rotation/recovery ceremony, external identity anchor, and runtime issuer do not | `packages/receipts/src/authorship-key-store.js:30-44,144-205`; `tests/authorship-key-store.test.js`; Ed25519 tests |
| Capability registry | PARTIAL / SEMANTIC_DRIFT | 69 curated rows pass, but all are labelled PREVIEW_ONLY/action false while the reversible-execute row describes a real sandbox rename; it is an evidence index, not a reliable whole-product action-maturity registry | `packages/core/src/dema-capability-truth-registry.js:441-462`; `tests/dema-capability-truth-registry.test.js:38-60` |
| Model evaluation | PARTIAL | Six-task local endpoint baseline; not continuous governance, swap integration, or correctness proof | `packages/core/src/model-eval-baseline.js`; `tests/model-eval-baseline.test.js`; `tests/model-eval-baseline-cli.test.js` |
| Local URP and mission preview | VERIFIED, bounded preview scope | Local URP genesis/composition/pulse/harness/artifact/CLI/cockpit surfaces have focused proof; no federation implication | registry rows `packages/core/src/dema-capability-truth-registry.js:64-82`; `packages/urp/src/five-sat-urp-launch.js`; `tests/five-sat-urp-launch.test.js`; 317/317 focused slice |
| Federation / wallet / mint / settlement | DESIGNED_NOT_LIVE | Local previews do not prove live node federation or economic operation | `docs/CURRENT_LIMITS.md`; `packages/core/src/boundary-schema.js:6-50` |
| Model swap / worker handoff | ABSENT_ON_MAIN | Focused branch candidates exist; neither capability is integrated on exact main | `3f72e6f` 16/16; `0ff5399` 28/28 |
| Mission Runtime 0A | PLANNING_ONLY | No integrated supervisor; signed lifecycle and corridor primitives do not make the proposed nine-stage runtime live | TASK-026/spec plus exact-main absence check |
| PAT/SAT | PARTIAL_SCAFFOLDS | Contracts, roles, dry-run board, and bounded suggestions are not a live twelve-agent fleet | `packages/core/src/pat-sat-blackboard-dry-run.js`; `packages/core/src/pat-sat-blackboard-live.js`; `tests/pat-sat-blackboard-{dry-run,live}.test.js`; `docs/CURRENT_LIMITS.md` |
| Release management | BLOCKED | Local portability, exit integrity, UI rail, and PR semantic proof corridor are incomplete | full-suite failures; TASK-018/019/020/028; PR #407 |
| Operations / customer / commercial | UNPROVEN | No production SLO run, repeated accepted design-partner missions, willingness-to-pay, retention, or unit economics evidence was found | exact-main `rg` inventory plus Backlog task/document review; absence recorded as UNKNOWN, not zero |

### Important correction: durable state is partial, not absent

The proposed baseline's statement that durable event storage and restart recovery
are wholly unproved is too broad. Exact main contains the persistent Mission Corridor:
a disclosed DEMA_HOME contract+journal control plane with fresh-process reconstruction.
Its stop surface is an operator-consented terminal control-plane transition, not a
process kill switch, and its root binding proves lexical normalization rather than
physical symlink containment. What remains unproved is general Node0/Recovery Mission
persistence, process crash recovery for live workers, and end-to-end substitution.

### Documentation drift

- `docs/DEMA_ARCHITECTURE.md` says last verified 2026-05-24 at `549b05d`;
  it is not a current exact-tree audit.
- The capability registry is scoped but can be read as exhaustive; its all-PREVIEW_ONLY
  policy also misclassifies the registered reversible sandbox action.
- TASK-019 is marked Done although its UI workflow is absent from exact main,
  `packages/dema-ui/next.config.ts` still ignores build errors, and branch protection
  cannot be proven from repository content.
- TASK-020 is marked Done on local candidate `99243bb`, but that candidate changes
  production output to a stable literal label despite the task's original derive-the-
  actual-basename contract and bundles unrelated actuator/style-walker changes.
- `release:readiness` and hermetic release-verdict outputs can be over-promoted
  unless an aggregate precedence rule explicitly places executable failures above them.
- The self-loop preview embeds a default signal claiming `npm test + npm run check`
  are clean. That signal is stale for the arbitrary-basename worktree and is declared
  fixture input, not current telemetry. Its SNR/RSI score cannot govern this audit.

## 7. Release blocker register

| ID | Severity | Blocker | Closure evidence |
| --- | --- | --- | --- |
| RB-01 | P0 | PR #407 nonconforming `verify/*` name skips all semantic review steps | Accepted-prefix exact-tree PR; four semantic scripts and all required rails green |
| RB-02 | P0 | Public-safe proof-room basename contract is worktree-dependent on main and TASK-020's candidate changes production semantics | Ratified PUBLIC_SAFE privacy contract; reviewed minimal repair; arbitrary-basename full ladder green |
| RB-03 | P0 | Main does not preserve all underlying gate exits | TASK-018 merged and adversarial combined-failure cases green |
| RB-04 | P0 governance | TASK-019/020/021/022 say Done while required evidence is unchecked, absent from main, or local-only | Each owning task is truth-corrected before promotion; Done means its declared integration boundary is met |
| RB-05 | P0 policy | Workflow accepts `copilot/*` while script-side broad-scope policy does not | One synchronized branch-class matrix test covers workflow, script, docs, and accepted prefixes |
| RB-06 | P0 developer-alpha | Exact main has no Dema UI workflow and still ignores TypeScript build errors | TASK-019 reconciled, UI rail merged and green, ignore flag removed, required-check configuration externally verified |
| RB-07 | P1 TASK-026 prerequisite | Model-swap/handoff candidates are absent from main; handoff is local-only | Reviewed serial integration; this does not block release claims that exclude those capabilities |
| RB-08 | P1 | Mission contract/state/chain ownership is unresolved and the branch candidate is incomplete | Versioned field/state/chain adapter decision plus TASK-026/spec amendment |
| RB-09 | P1 | Positive component readiness labels can coexist with failing aggregate gates | Precedence contract or report wording makes final eligibility fail closed |
| RB-10 | P1 | Focused architecture and self-loop default evidence can become stale | Exact-main regeneration or explicit snapshot labels |
| RB-11 | P1 | No repeated user/commercial outcome evidence | Bounded design-partner records with privacy and acceptance contracts |

## 8. Prioritized portfolio

### P0 — restore trustworthy proof

1. Complete TASK-027 and preserve this audit.
2. Land TASK-018 from `e5886a1`; update its stale acceptance/final-summary metadata.
3. Reconcile TASK-020 with TASK-028 before coding: ratify whether PUBLIC_SAFE reports
   the actual checkout basename or a stable product label; review `99243bb` as a
   bundled candidate and do not cherry-pick it wholesale. TASK-028 is the release-
   corridor umbrella and supersedes duplicate closure claims for this defect.
4. Reconcile TASK-019: its UI rail/fixes exist only on `8d0600e`, not exact main;
   merge proof and required-check configuration remain separate gates.
5. Execute TASK-028 on the resulting exact tree and open a conforming `ci/*`
   verification PR. Do not weaken branch classification.
6. Rebuild TASK-017 after TASK-018; its obsolete-history branch must not merge directly.
7. Before any candidate promotion, its owning task must align status, checked
   acceptance criteria, remote/main presence, and truth label. TASK-027 records the
   current violations; each owning task closes its own status correction.

### P1 — prove value and integrate prerequisites

1. Execute TASK-005 as the real bounded Recovery Mission crossing. Freeze its corpus,
   content authorization, founder selection, before/after artifact, separate-lens
   review, and human acceptance first.
2. Define TASK-007 acceptance/DoD and run the Founding-20/design-partner evidence lane.
3. Rebase, review, qualify, and integrate TASK-021 model-swap.
4. Rebase TASK-022 on the resulting main, resolve shared registry/check/docs conflicts,
   push under separate authorization, and integrate.
5. Ratify contract ownership and amend TASK-026/spec: either version/adapter-bind the
   existing Mission Corridor to the nine-stage contract or define a distinct preview
   contract without claiming shared persistence. No second DEMA_HOME writer is allowed.

### P2 — Mission Runtime 0A preview

Implement TASK-026 only after P0 and the P1 code prerequisites converge. It remains a
pure supervisor/preview, not a live worker runtime.

### HOLD

TASK-015/TASK-016 reversible steward work remains held at the Dema-vs-governed-Node0
execution boundary. Federation, token/economic operation, public autonomy, and new
agent kernels remain outside this tranche.

## 9. Mission Runtime 0A execution charter

### State and objective

```yaml
task: TASK-026
status: PLANNING_ONLY
planned_output_truth_label: PREVIEW_ONLY
objective: prove that one immutable mission can preserve state, acceptance, authority, and evidence while simulated workers change
authority_delta: 0
live_conduction: DESIGNED_NOT_LIVE
```

### Required pre-implementation decisions — not yet ratified

1. **Persistence boundary:** 0A's pure reducer consumes injected, already-read Mission
   Corridor snapshots only. It never calls the corridor writer. Any later persistence
   adapter delegates to the existing C3-consented writer outside the kernel and is
   out of scope for 0A.
2. **Schema/version adapter:** Mission Corridor lacks the proposed acceptance,
   prohibited-outcome, authority, budget, completion, and escalation fields, and its
   states differ from the nine-stage machine. Freeze an exact versioned field/state
   mapping and migration rule before code.
3. **Chain binding:** Mission Corridor uses `index/event_hash/prev_hash`; the handoff
   candidate uses realm `event_id/seq/prev_event`. Specify and test a deterministic
   bridge before claiming one replayable final state.
4. **Consent boundary:** pure in-memory construction may be consent-free PREVIEW_ONLY;
   activation or persistence requires exact context-bound consent. The schema must
   distinguish those states.
5. **Supervisor:** pure reducer over injected contract, state, and events.
6. **Worker handoff/verdict:** import the integrated kernels; do not copy them. Worker
   identity is absent from verdict inputs.
7. **Effect model:** C0-C5 is the canonical action-authority ladder. Reversibility and
   value-bearing are orthogonal effect attributes and must remain explicit or receive
   a separately reviewed composite mapping.
8. **Boundary:** use `buildPreviewBoundary()` and exact deep equality over all 17
   keys, all false.
9. **Evidence language:** amend TASK-026/spec from governed receipts/receipt-chain
   advance to deterministic transition-evidence or receipt candidates with a frozen
   schema. Dema 0A does not mint or advance a governed receipt chain.

### Stage machine

```text
DISCOVER → CONTRACT → PLAN → FATE → EXECUTE → VERIFY → REVIEW → RECEIPT → DECIDE
```

Terminals: `DONE`, `HALTED`, `BUDGET_EXHAUSTED`.

`EXECUTE` means only that an injected result event was recorded. It never runs a
worker, command, model, test, filesystem action, or network call.

### Worker interface

Workers receive exactly `{ checkpoint, eligible_actions }`. They can emit proposal
events only. They receive no mutable contract, consent authority, verdict authority,
receipt-signing capability, filesystem/network/process handle, or effect capability.

### Non-goals

No model invocation, prompt execution, worker spawn, process execution, diff apply,
test execution, filesystem write, network call, clock/random read, daemon, corpus
scan, live adapter, persistent new store, receipt signing/minting, governed chain
advance, federation, token/reward effect, or production-autonomy claim.

### Required acceptance proof

- Missing mission id, empty acceptance criteria, invalid budget, wrong consent,
  contract mismatch, state-chain gap, duplicate sequence, and mutation attempt fail
  closed with named evidence.
- Contract/state are deeply immutable; preview construction, activation, and
  persistence have distinct truth labels and only the latter two require consent.
- The frozen adapter binds corridor state and handoff checkpoints without chain gaps.
- Worker A stops; worker B resumes with identical contract hash and authority ceiling.
- Worker mutation is rejected and represented as preview evidence.
- Identical output under different worker identities yields byte-identical verdict.
- Ten enumerated simulations pass: deterministic happy path; budget exhaustion;
  wrong consent; worker stop/resume; contract mutation rejection; chain gap; duplicate
  sequence; model-blind verdict; replay equality; and all-false boundary plus purity.
- Every legal transition emits deterministic preview evidence; replay equals the
  incrementally walked final state byte-for-byte.
- Budget exhaustion is terminal and evidenced; no unbounded retry.
- Kernel purity proves no fs/network/process/clock/random/model imports.
- Exact-head local ladder and all required remote rails pass before merge.

### Existing contract candidate disposition

`feat/dema-mission-contract-1a@1a2a7f` is not merge-ready:

- no required `mission_id`;
- no state/checkpoint/resume/chain-gap implementation;
- bespoke 8-key boundary instead of canonical 17-key boundary;
- shallow-frozen payload leaves `input` mutable;
- preview construction and activated/persisted truth are not distinguished, so a
  consent-free payload verifies as the same class as a gated one;
- a valid altered body with a recomputed hash has no independent provenance anchor;
- receipt prose overstates forged-and-rehashed rejection;
- `content_hash` versus spec `contract_hash` is unresolved;
- it overlaps the already-merged Mission Corridor contract surface.

Treat it as a review candidate, not a measured product capability.

## 10. KPI and telemetry contract

### Release leading indicators

- arbitrary-basename local ladder: 6/6 green;
- real exit propagation: 100%;
- Review Gate semantic steps: 4/4 executed and green;
- required remote rails: all green on one candidate tree;
- stale/unknown mandatory evidence: 0.

### Mission Runtime proof indicators

- simulated swap protocol: 10/10;
- contract hash changes during worker swap: 0;
- authority violations: 0;
- unauthorized effects: 0;
- replay equality: 100%;
- transition evidence coverage: 100%;
- unbounded iterations: 0.

### Product outcome indicators

- real bounded missions completed and human-accepted;
- worker-handoff success rate;
- receipt/evidence replay success;
- time to reconstruct context;
- human-review minutes;
- rework avoided;
- cost per accepted mission;
- authority violations;
- user willingness to continue/pay.

No metric becomes zero when evidence is absent; it remains `UNKNOWN`.

## 11. Delivery sequence and 90-day evidence window

Engineering work is gate-driven, not calendar-padded:

```text
P0 proof corridor
→ real Recovery Mission crossing
→ integrate contract/verdict/handoff prerequisites
→ Mission Runtime 0A simulated preview
→ developer alpha
→ design-partner missions
```

The 90-day window is for repeated outcome evidence, not a reason to delay engineering
after gates are green. Promote, revise, or retire based on observed missions and
customer outcomes.

## 12. Self-critique

**KNOWN:** exact remote/main/tree, PR checks/logs, local gate results, branch topology,
focused branch tests, exact-main architecture, and Backlog state were inspected.

**INFERRED:** the present release block is governance/proof integration plus a
worktree-portability test defect; no product regression is demonstrated by PR #407.

**ASSUMED-WITH-IHSAN:** none required for the core findings.

**UNKNOWN:** live Node0 runtime behavior, production model/provider behavior,
external key custody, federation/wallet/economy behavior, independent reproduction,
customer willingness to pay, retention, and real Mission Runtime handoff outcomes.

**BOUNDARY:** this audit did not inspect private corpus contents, invoke a model,
exercise a live worker, mutate product code, push, merge, close PRs, release, sign, or
mint. The self-loop output was a declared-fixture preview and was not treated as
current telemetry.

**NEXT EVIDENCE NEEDED:** close TASK-018, reconcile TASK-019/TASK-020 under TASK-028,
and obtain one exact-tree local/remote corridor; then execute the bounded Recovery
Mission and record human outcome evidence.

## Final receipt

```yaml
decision: PROCEED
next_task: TASK-018_THEN_TASK-019_020_028_RECONCILIATION
new_runtime_infrastructure_authorized: false
mission_runtime_0a_build_authorized: false
product_code_changed: false
backlog_records_created:
  - TASK-027
  - TASK-028
  - doc-002
tracked_product_files_changed: false
network_effects:
  github_read_only: true
  github_write: false
authority_delta: 0
```



