# BIZRA Node0 / Dema Master Craftsmanship Checklist v0.1

**Status:** `DECLARED_NODE0_MASTER_COMPLETION_SCORECARD_v0_1`
**Scope:** BIZRA Node0 + Dema local Genesis Realm
**Created:** 2026-05-30
**Truth boundary:** This document is a scorecard and completion standard. It is
not a runtime, not a receipt, not a CI result, and not a public launch claim.

This checklist converts the operator's Bulletproof Genesis Node standard into a
repo-native completion map. It is deliberately stricter than a roadmap: every
requirement must name the evidence anchor, the current label, the missing piece,
and the overclaim it blocks.

## 0. North Star

BIZRA Node0 is the complete local seed of the future ecosystem.

It must prove:

```text
one complete node
one sovereign user
one Dema
twelve agents
one task
one proof
one reward
one learning
one improvement
one next mission
```

Node0 is not a chatbot, LLM wrapper, pitch demo, or public network claim. It is
the Genesis Realm: a sovereign local proof-economy operating system seed. A
future Node1 may extend capacity and independent verification, but must not be
needed to complete missing Node0 organs.

## 1. Truth Labels

| Label                | Meaning in this checklist                                               |
| -------------------- | ----------------------------------------------------------------------- |
| `DESIGNED_NOT_LIVE`  | Designed, specified, or named, but no live local implementation.        |
| `PARTIAL`            | Some primitives exist, but the complete loop or integration is missing. |
| `MEASURED_LOCAL`     | Works locally with local tests or replayable evidence.                  |
| `REMOTE_CI_VERIFIED` | The exact slice is sealed by remote CI. Re-check before reuse.          |
| `SIMULATED_NOT_LIVE` | Tabletop, mock, scenario, or static emulation only.                     |
| `BLOCKED`            | Cannot proceed until a named dependency is sealed.                      |

Rule:

```text
No surface may claim more than its receipts, tests, and verifiers prove.
```

Forbidden claims until separately proven:

- public token economy live
- guaranteed income or reward
- public federation live
- Node1/Node2 network live
- fully autonomous agent swarm
- general trustless verifier for the entire system
- legal validation
- Shariah certification
- market value
- full recursive self-improvement

## 2. Disk-Calibrated Foundation

This section records what the current repo already anchors. It does not replace
running tests or checking CI on the exact branch.

| Area                               | Current label    | Evidence anchor                                                                               | Missing piece                                                                                                                                                                                                                         |
| ---------------------------------- | ---------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KEYCONSENT kernel                  | `MEASURED_LOCAL` | `tests/consent-proof.test.js`                                                                 | Broader gate coverage beyond existing integrated surfaces.                                                                                                                                                                            |
| KEYCONSENT gate integration        | `PARTIAL`        | `tests/keyconsent-1b-verdict-attest.test.js`, `tests/keyconsent-2b-nonce-integration.test.js` | All meaningful mutation paths must require key-bound consent.                                                                                                                                                                         |
| KEYCONSENT CLI                     | `MEASURED_LOCAL` | `tests/dema-consent-cli.test.js`                                                              | Operator UX polish and broader integration.                                                                                                                                                                                           |
| Nonce registry                     | `PARTIAL`        | `tests/consent-nonce-registry.test.js`, `tests/keyconsent-2b-nonce-integration.test.js`       | Registry must cover all meaningful mutation gates.                                                                                                                                                                                    |
| Assumption gate                    | `MEASURED_LOCAL` | `tests/assumption-boundary-validator.test.js`, `tests/assumption-guarded-claim.test.js`       | Broader use beyond guarded claim primitive.                                                                                                                                                                                           |
| Canonical receipt chain            | `PARTIAL`        | `tests/canonical-receipt.test.js`, `tests/canonical-ledger.test.js`                           | RECEIPT-CHAIN-1C (`tests/canonical-task-binding.test.js`) binds one task's flywheel action → IMPACT → SAT receipts into the canonical chain; remaining: bind §19 steps 12–17 as those receipts exist, and label legacy flat receipts. |
| Minimal one-task flywheel          | `PARTIAL`        | `tests/flywheel-one-task.test.js`                                                             | Token settlement, XP, lesson, performance delta, and next mission are not yet composed.                                                                                                                                               |
| Flywheel settlement bridge         | `MEASURED_LOCAL` | `tests/flywheel-settlement.test.js`                                                           | XP, lesson, performance delta, and next mission are not yet composed.                                                                                                                                                                 |
| Flywheel durable ledger append     | `MEASURED_LOCAL` | `tests/flywheel-ledger.test.js`                                                               | Lesson, performance delta, and next mission are not yet composed.                                                                                                                                                                     |
| Flywheel XP grant proposal         | `MEASURED_LOCAL` | `tests/flywheel-xp-proposal.test.js`                                                          | Proposal only — SAT validation and operator-approved XP mint are separate gates.                                                                                                                                                      |
| Flywheel XP mint bridge            | `MEASURED_LOCAL` | `tests/flywheel-sat-validation.test.js`, `tests/flywheel-xp-mint.test.js`                     | Builds a signed skill ledger after SAT validation + consent; persistence, lesson, performance delta, and next mission remain.                                                                                                         |
| Flywheel durable XP state          | `MEASURED_LOCAL` | `tests/flywheel-xp-state.test.js`                                                             | Persists signed XP skill-ledger records to local `DEMA_HOME` and replays the wrapper chain plus impact/SAT/skill-ledger proofs; lesson, performance delta, and next mission remain.                                                   |
| Local dual-token ledger            | `PARTIAL`        | `tests/econ-ledger.test.js`, `tests/econ-ledger-replay.test.js`                               | Broader mission/flywheel use without public economy claims.                                                                                                                                                                           |
| PoI deterministic rule             | `PARTIAL`        | `tests/poi-rule-consent-replay-verification.test.js`                                          | Convert rule output into a mission-scoped score receipt and ledger input.                                                                                                                                                             |
| Agent profiles                     | `PARTIAL`        | `tests/agent-profile-registry.test.js`                                                        | Persistent Dema-visible characters and task ownership.                                                                                                                                                                                |
| Agent wallets                      | `PARTIAL`        | `tests/agent-wallet.test.js`                                                                  | Link wallet changes to mission settlement and agent service events.                                                                                                                                                                   |
| Agent skills / XP                  | `PARTIAL`        | `tests/agent-skill-ledger.test.js`, `tests/flywheel-xp-mint.test.js`, `tests/flywheel-xp-state.test.js` | FLYWHEEL-1F persists verified XP skill-ledger state with replay; persistent Dema-visible agent profile integration remains.                                                                                                            |
| Mission lifecycle                  | `PARTIAL`        | `tests/mission-lifecycle.test.js`                                                             | Compose with full flywheel and Dema Realm surfaces.                                                                                                                                                                                   |
| House of Wisdom writer             | `PARTIAL`        | `tests/how-lesson-writer.test.js`                                                             | Teacher extraction, SAT review, operator approval, and replay link.                                                                                                                                                                   |
| Performance baseline / improvement | `PARTIAL`        | `tests/perf-baseline.test.js`, `tests/perf-improvement.test.js`                               | Real sampling harness and full mission improvement receipt.                                                                                                                                                                           |
| Block0 manifest                    | `PARTIAL`        | `tests/block0-manifest.test.js`                                                               | Verifier, persisted snapshot, and all prerequisites sealed.                                                                                                                                                                           |
| Dema Realm UX                      | `PARTIAL`        | `tests/dema-realm-home.test.js`, `docs/TESTING.md`                                            | One cockpit that shows the full completion scorecard and next safe mission.                                                                                                                                                           |

Golden gap:

```text
The repo is no longer mainly blocked by missing organs.
It is blocked by one orchestrated, replayable lifecycle that composes them.
```

## 3. Master Flywheel Acceptance Test

Node0 is locally complete only when one task passes this whole flow without
network, public economy, private-key leakage, or unconsented mutation.

| Step | Requirement                          | Current label                            | Evidence / gap                                                                                                                               |
| ---: | ------------------------------------ | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
|    1 | Dema restores Node0 state.           | `PARTIAL`                                | Dema status/Realm surfaces exist; complete Genesis cockpit still missing.                                                                    |
|    2 | MuMu selects a mission.              | `PARTIAL`                                | Mission kernel exists; operator mission selection surface is not full flywheel.                                                              |
|    3 | PAT proposes.                        | `DESIGNED_NOT_LIVE`                      | Agent profile registry exists; live PAT proposal runtime is not sealed.                                                                      |
|    4 | SAT audits.                          | `DESIGNED_NOT_LIVE`                      | SAT roles are named; live SAT audit runtime is not sealed.                                                                                   |
|    5 | KEYCONSENT authorizes.               | `PARTIAL`                                | Consent proof and selected gate integrations exist; all mutation paths not covered.                                                          |
|    6 | One local action runs.               | `MEASURED_LOCAL` for guarded claim       | `mintGuardedClaim` proves one enforced mutation primitive.                                                                                   |
|    7 | Receipt writes.                      | `MEASURED_LOCAL` for selected primitives | Canonical ledger exists; full flywheel binding is incomplete.                                                                                |
|    8 | Verifier re-checks.                  | `MEASURED_LOCAL` for selected rules      | Full lifecycle verifier is not complete.                                                                                                     |
|    9 | PoI scores.                          | `PARTIAL`                                | One deterministic rule exists; mission integration missing.                                                                                  |
|   10 | Token ledger updates.                | `PARTIAL`                                | Durable settlement append (FLYWHEEL-1B/1C) composes verified action → IMPACT ledger + replay; broader mission integration remains.           |
|   11 | Agent XP updates.                    | `PARTIAL / MEASURED_LOCAL for XP state`  | FLYWHEEL-1F persists signed XP state and replays impact + SAT + skill-ledger proofs; broader agent profile/Realm integration remains.       |
|   12 | Teacher proposes lesson.             | `DESIGNED_NOT_LIVE`                      | HOW writer exists; Teacher extraction path is not live.                                                                                      |
|   13 | MuMu approves lesson.                | `PARTIAL`                                | Lesson consent shape exists; full operator approval flow missing.                                                                            |
|   14 | House of Wisdom writes entry.        | `PARTIAL`                                | Local writer exists; full proof-backed learning loop incomplete.                                                                             |
|   15 | Performance delta records.           | `PARTIAL`                                | Baseline/improvement kernels exist; real measured mission delta missing.                                                                     |
|   16 | Dema recommends next mission.        | `PARTIAL`                                | Some next-action surfaces exist; full flywheel closeout recommender missing.                                                                 |
|   17 | Replay verifier confirms full chain. | `PARTIAL`                                | Minimal flywheel replay and canonical ledger exist; full chain verifier missing.                                                             |

Pass condition:

```text
All 17 steps pass with receipts, no boundary violation, no unverified reward,
no private key leakage, no accidental network, and replay verification succeeds.
```

Fail condition:

```text
Any unconsented mutation, unverifiable reward, unbacked XP, missing receipt,
non-replayable ledger, or overclaim fails the master test.
```

## 4. Domain Scorecard

| Domain                | Target | Current label | Next slice                                                                   |
| --------------------- | -----: | ------------- | ---------------------------------------------------------------------------- |
| Consent sovereignty   |  10/10 | `PARTIAL`     | Extend KEYCONSENT proof + nonce to every meaningful mutation path.           |
| Proof spine           |  10/10 | `PARTIAL`     | Bind full flywheel receipts into canonical ledger.                           |
| URP resource wallet   |  10/10 | `PARTIAL`     | Derive one Dema-visible local wallet state from existing URP/ledger kernels. |
| Genesis-local economy |  10/10 | `PARTIAL`     | Compose PoI score into ECON ledger with replay.                              |
| PoI scoring           |  10/10 | `PARTIAL`     | Produce a mission-scoped PoI receipt, not just a rule result.                |
| Agent profiles        |  10/10 | `PARTIAL`     | Make 12 agents persistent Dema-visible characters with proof refs.           |
| Agent XP / skills     |  10/10 | `PARTIAL`     | Persisted XP state exists; connect it to durable agent profiles and Realm.   |
| Mission loop          |  10/10 | `PARTIAL`     | Compose mission lifecycle with flywheel and closeout.                        |
| House of Wisdom       |  10/10 | `PARTIAL`     | Connect receipt -> reflection -> approval -> lesson entry.                   |
| Performance baseline  |  10/10 | `PARTIAL`     | Add real sampling harness and improvement receipt integration.               |
| Recovery / safe mode  |  10/10 | `PARTIAL`     | Canonical ledger repair/quarantine and full corrupt-state UX.                |
| Dema Realm UX         |  10/10 | `PARTIAL`     | Render this scorecard and next safe mission in the Realm.                    |
| Block0 readiness      |  10/10 | `PARTIAL`     | Add verifier and require sealed prerequisites.                               |

Minimum private-alpha state:

```text
key-bound consent on critical gates
one-task flywheel with settlement
performance baseline
Dema Realm cockpit
truthful docs
```

Public launch remains blocked until:

```text
Block0 sealed
legal/economic review complete
security review complete
PoI replay verification complete
public docs claim-clean
no overclaims
```

## 5. SNR Spearpoint

SNR definition:

```text
Signal = actionable architectural insight.
Noise = speculative implementation detail without proof bar.
```

| Candidate                            | Signal | Noise | Verdict                                                                                                  |
| ------------------------------------ | -----: | ----: | -------------------------------------------------------------------------------------------------------- |
| `NODE0-COMPLETION-0` scorecard       |     10 |     1 | This document. Prevents drift across all future slices.                                                  |
| `FLYWHEEL-1B` settlement bridge      |     10 |     2 | Implemented as the first bridge from verified action to local IMPACT entry.                              |
| `FLYWHEEL-1C` durable ledger append  |     10 |     2 | Implemented as the first durable local impact ledger with replay verification.                           |
| `FLYWHEEL-1D` XP grant proposal      |     10 |     2 | Implemented as the §19 step-11 vertebra; proves the XP gate refuses to mint without SAT.                 |
| `SAT-VALIDATE-1A` validation receipt |     10 |     2 | Implemented; a SAT-5 signature unblocks the §11 gate — closes the step-11 chain to the consent boundary. |
| `FLYWHEEL-1E` XP mint bridge         |     10 |     2 | Implemented; composes verified impact + SAT validation + operator consent into a signed skill ledger.    |
| `FLYWHEEL-1F` durable XP state       |     10 |     2 | Implemented; persists signed XP state with replay across impact, SAT, skill-ledger, and wrapper hashes.  |
| Dema Realm full cockpit              |      9 |     5 | Strong, but should read from the scorecard and flywheel state.                                           |
| New cognitive orchestration layer    |      7 |     6 | Useful only if it routes existing organs instead of duplicating them.                                    |
| More isolated kernels                |      6 |     7 | Risk: organ sprawl without organism proof.                                                               |

Latest implemented spearpoint:

```text
FLYWHEEL-1F_DURABLE_XP_STATE_APPEND
```

Minimal solvable special case:

```text
Input: one FLYWHEEL-1D PENDING proposal + its verified IMPACT_CREDIT entry +
one SAT-VALIDATE-1A receipt + scoped operator consent.
Action: run the FLYWHEEL-1E XP mint bridge, wrap the signed skill ledger with
its impact entry, SAT receipt, consent proof hash, and prev_state_hash, then
append it to `$DEMA_HOME/agents/flywheel-xp-state.ndjson`.
Verify: `verifyFlywheelXpState()` replays the wrapper chain, re-verifies the
impact entry and SAT receipt under the external pubkey, re-runs
`verifySkillLedger()`, and aggregates per-agent XP totals.
Non-goals: no marketplace, no lesson, no performance delta, no Dema Realm
profile mutation, no full SAT-5 council runtime.
```

Proof bar:

```text
verified impact entry + SAT receipt + scoped consent -> persisted XP state
first record has prev_state_hash:null; second links to previous state_hash
verifyFlywheelXpState replays impact + SAT + skill ledger + wrapper hashes
missing/wrong consent refuses before the XP state file is created
```

Disproof bar:

```text
missing consent appends XP state
wrong consent target hash appends XP state
tampered SAT receipt appends XP state
tampered impact entry appends XP state
corrupt existing XP state is extended
public economic field appears
```

Current implementation boundary:

```text
FLYWHEEL-1F persists a replayable local XP state record after FLYWHEEL-1E
builds a signed AGENT-SKILL-1A ledger. It does NOT update Dema Realm state,
does not write an agent profile registry entry, does not run a marketplace,
does not write a House-of-Wisdom lesson, and is not the full SAT-5 council
runtime.
```

## 6. Hidden-State Reasoning Boundary

The operator may use HHMM, diffusion, graph-of-thought, and analogical language
as reasoning prompts. This repo must not claim those as live algorithms unless
there are logs, hidden states, transition rules, emissions, and inference code.

Current truth:

```text
HHMM_RUNTIME: DESIGNED_NOT_LIVE
DIFFUSE_COMPRESS_RUNTIME: DESIGNED_NOT_LIVE
SNR_SCORECARD: PARTIAL, represented here as a human-readable ranking table
HASH_TABLE_DISCIPLINE: ACTIVE as stable requirement keys and evidence anchors
```

Analogical compression:

```text
The organs are present.
The organism is not complete until one bloodstream connects action, proof,
reward, learning, improvement, and next mission.
```

## 7. Micro-Compliance Contract

Every future slice that claims progress against this checklist must state:

- truth label
- evidence refs
- consent requirement
- proof bar
- disproof bar
- boundary
- non-goals
- next safe step

Mutation slices must additionally state:

- exact consent phrase or key-bound consent proof scope
- receipt schema
- verifier command or verifier function
- recovery path for rejected or corrupt state

## 8. Self-Critique

What this proves:

- The master checklist now has a repo-native scorecard shape.
- The current hidden gap is integration, not missing isolated organs.
- The next highest-SNR implementation slice is a settlement bridge, not another
  broad architecture layer.

What this does not prove:

- It does not prove the full 17-step flywheel works.
- It does not prove Node1 can independently verify the full Node0 chain.
- It does not prove any public economy, federation, legal status, or Shariah
  certification.
- It does not prove Dema Realm is a complete cockpit.

Remaining blocker:

```text
No single replayable chain currently proves action -> mission-scoped PoI ->
ledger -> XP state -> lesson -> performance delta -> next mission.
```

Forbidden overclaim:

```text
Do not call Node0 complete until the full flywheel acceptance test passes.
```

## 9. Bulletproof Law

```text
If it cannot be consented, it cannot mutate.
If it cannot be verified, it cannot reward.
If it cannot be replayed, it cannot enter the ledger.
If it cannot be traced to proof, it cannot become XP.
If it cannot be approved, it cannot become learning.
If it cannot be measured, it cannot be called optimization.
If it cannot be bounded, it cannot be launched.
```

That is the Genesis Node completion standard.
