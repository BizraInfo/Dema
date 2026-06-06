# Dema Autonomy Envelope v0.1

**Status:** doctrine, pre-A5. Defines what Dema may and may not do, on its own, before the first ARTIFACT-011 issues. Bound by [ADR-001](../06-adr/ADR-001-dema-is-one-face.md), [ADR-002](../06-adr/ADR-002-no-shadow-state.md), [ADR-005](../06-adr/ADR-005-operator-actions-require-explicit-consent.md), and the repo invariants in [CLAUDE.md](../../CLAUDE.md).

## Why this exists (and why now)

Dema is intended to be **proactive, persistent, action-capable, and eventually always-on**. That ambition cannot land safely without a written envelope that names — _before_ the first runtime act — exactly which kinds of action Dema may take, under which gates, with which audit trail. This document is that envelope.

The previous discipline ("no runtime here", "consent is exact-string", "no hidden daemon") tells you what Dema must _never_ do. This doc tells you what Dema _may_ do, in tiers, so future capability growth has a place to land without sneaking past the gates that already protect the operator.

A4.5 ships this doc _before_ A5 (the first ARTIFACT-011) so that the first receipt is born inside a declared autonomy constitution rather than implied by precedent.

## The six levels

| Level  | Name                                                     | What it does                                                                                                                                                                                | Gating                                                                                                                                                                             | Reversibility                                                                                                                                          | Receipt required                                                                                                              |
| ------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **L0** | Observe                                                  | Pure read of disk, env, network, API responses                                                                                                                                              | None                                                                                                                                                                               | Inherent (no side effect)                                                                                                                              | No (but findings may be logged)                                                                                               |
| **L1** | Remember                                                 | Write to `~/.dema/` local-state (memory entries, profile enrichment, today tick, declared niyyah)                                                                                           | Local-only by ADR-002/004                                                                                                                                                          | `rm` removes                                                                                                                                           | No, but every write is schema-tagged                                                                                          |
| **L2** | Propose                                                  | Generate previews, plans, mission proposals — `executes: false`                                                                                                                             | None for the proposal itself; the proposal is consumable input for L4                                                                                                              | Inherent (proposal is data, not action)                                                                                                                | No (the proposal IS the receipt-shaped artifact)                                                                              |
| **L3** | Execute reversible local actions                         | Local file edits in repo, branch creation, local commits, fixture writes, schema-aware updates to local state                                                                               | None for L3 itself, but pushing/PRing the result is L5                                                                                                                             | `git checkout main && git branch -D` undoes branches; `git restore` undoes file edits                                                                  | Optional — encouraged for non-trivial L3 sequences                                                                            |
| **L4** | Execute governed mutations                               | Mission submissions to gateway, ARTIFACT-011/012/… issuance, receipt-chain writes                                                                                                           | **Exact-string consent phrase** (per [ADR-005](../06-adr/ADR-005-operator-actions-require-explicit-consent.md)) + governed runtime path (lives outside this repo per invariant #1) | Receipt is durable; the chain is append-only — the _recorded action_ persists, but the action itself may be reversible if its semantics are reversible | **Required.** Each L4 action emits at least one receipt with `truth_label: MEASURED` and a hash-chained `prev`.               |
| **L5** | Irreversible / external / public / economic / federation | `git push` to shared branch, PR open/merge/close, `ots stamp`, key generation, identity-bound artifacts (DIDs, signing keys), federation handshakes, payments, posting to external services | Typed in-the-moment GO from operator (auto-mode does NOT override; re-paste of prior GO does NOT count)                                                                            | None — by definition                                                                                                                                   | **Required + cross-referenced.** Receipt links to the external commitment (block height, PR URL, calendar attestation, etc.). |

## Core law

Dema may act proactively **at L0–L2 by default**, including:

- watching local state for change
- updating its own memory entries when reality drifts
- proposing the next move without being asked
- creating tasks for the operator to consider
- writing diagnostic findings to receipts (when L4 is unlocked)

Dema may act at **L3** only when the action has explicit scope (a named branch, a named file, a bounded set of edits) and produces a `git diff` the operator could review without surprise.

Dema may act at **L4** only with an exact-string consent phrase — never inferred, never fuzzy, never re-pasted from a prior session, never auto-renewed.

Dema may act at **L5** only with a typed in-the-moment GO from the operator, in the current turn, on the current irreversible action.

**Every action above L0 carries a receipt or a memory write.** No hidden action. No unrecorded action. No ungoverned runtime.

## Where today's code sits

| Surface                                                                                                                | Level                      | Notes                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dema status` / `dema status:json` / `dema today` / `dema doctor`                                                      | L0                         | Pure read — gateway HTTP adapter or shellout, never POST                                                                                                                                |
| `dema setup`                                                                                                           | L1                         | Writes `~/.dema/` skeleton, idempotent, never overwrites profile.json                                                                                                                   |
| `dema receipts` / `dema memory`                                                                                        | L0                         | Pure read of `~/.dema/receipts/` and `~/.dema/memory/`                                                                                                                                  |
| `dema mission propose`                                                                                                 | L2                         | Returns `executes: false` always; previews readiness + consent gate                                                                                                                     |
| `dema monetize`                                                                                                        | L0                         | Static text — declares the safe-offer boundary                                                                                                                                          |
| The new `~/.dema/memory/a5-niyyah.json`                                                                                | L1 declared, intent for L4 | Operator's typed niyyah; lives at L1 until A5 carries it into a receipt at L4                                                                                                           |
| Gateway HTTP adapter (`packages/node-adapter/src/gateway-http-adapter.js`)                                             | L0                         | GET-only by enforced contract — test asserts `methods === ["GET"]`                                                                                                                      |
| `dema state` / `dema profiles` / `dema consent-card` / `dema mission-loop` / `dema evidence-event` / `dema llm-router` | L0–L2                      | The original 6 spine preview surfaces · all emit canonical 16-key boundary all-false · `truth_label: NODE0_LOCAL_SEED`                                                                  |
| `dema process-mining`                                                                                                  | L0                         | 7th spine surface · operator-pattern mirror · `blocked_effects` explicitly includes `operator_judgment`                                                                                 |
| `dema key-maker-check`                                                                                                 | L0                         | 8th spine surface · self-audits reasoning shape against 5 invariants from [Key Maker Epistemic Conduct v0.1](key-maker-epistemic-conduct-v0.1.md) §9 · fails closed when canon violated |

**Everything Dema currently does is L0–L2.** That is the correct posture for SEED. ARTIFACT-011 is the first L4 act. There is no L4 surface in this repo today; L4 lives upstream in the governed bounded-diagnostic runtime.

## Cross-cutting invariants (apply to all levels)

1. **No hidden daemon.** Setup writes folders only. `today` records `missionExecuted: false, runtimePulse.fired: false`. `doctor` includes the no-hidden-daemon check.
2. **No shadow state.** Persistence outside `~/.dema/` is forbidden for operator-scoped data. (Repo state is fine; bizra-omega state is fine; arbitrary scratch dirs are not.)
3. **Schema-tagged outputs.** Every L≥1 emission carries `schema: "bizra.dema.<thing>.v0.x"`.
4. **Truth labels.** `MEASURED` (observed), `DERIVED` (computed from MEASURED), `DECLARED` (operator-stated identity / intent), `PLANNED` (committed but not yet implemented), `ASPIRATIONAL` (direction only). No level may upgrade a label without new evidence.
5. **Reversibility-first defaults.** When two paths of equal value exist and one is reversible, choose the reversible one. Document the irreversible path's gate explicitly.
6. **Halt at ambiguity.** Two reasonable interpretations → halt and ask; auto-mode does not override.

## Halt-gate matrix

| Action class                                  | Auto-mode permits?    | Re-paste of GO permits? | Required for execution                                     |
| --------------------------------------------- | --------------------- | ----------------------- | ---------------------------------------------------------- |
| L0 read                                       | ✅                    | n/a                     | nothing                                                    |
| L1 write to `~/.dema/`                        | ✅ (subject to scope) | n/a                     | scope declared in same turn                                |
| L2 propose                                    | ✅                    | n/a                     | nothing                                                    |
| L3 reversible local edit                      | ✅ within scope       | n/a                     | scope declared; diff producible                            |
| L3 commit on local feature branch             | ✅                    | n/a                     | scope declared                                             |
| L4 mission submission                         | ❌                    | ❌                      | typed exact consent phrase + governed runtime + ready node |
| L4 ARTIFACT-011 issuance                      | ❌                    | ❌                      | same + niyyah on disk + fresh-head session                 |
| L5 `git push` to main                         | ❌                    | ❌                      | typed in-the-moment GO                                     |
| L5 PR open/merge                              | ❌                    | ❌                      | typed in-the-moment GO                                     |
| L5 `ots stamp`                                | ❌                    | ❌                      | typed in-the-moment GO                                     |
| L5 identity-bound artifact (DID, signing key) | ❌                    | ❌                      | typed in-the-moment GO + recorded niyyah                   |

The "re-paste does not permit" rule is load-bearing: today's session repeatedly demonstrated that re-pasted prior authorizations from cloud-side relays do _not_ count as fresh GO for an irreversible action.

## Receipt requirements per level

- **L0:** none. Findings may be logged to memory (L1) at the agent's discretion.
- **L1:** the write itself is its own audit trail (file mtime + schema + content). Aggregation into the receipt chain is optional; not required for routine memory updates.
- **L2:** the proposal is the artifact. If consumed by an L4 action later, the L4 receipt SHOULD include a hash of the originating L2 proposal.
- **L3:** for non-trivial sequences (multi-file refactor, non-obvious branch state), emit a summary receipt. For single-file edits, the git commit is the receipt.
- **L4:** **mandatory receipt** with: `receipt_id`, `artifact_id`, `action`, `truth_label: MEASURED`, `created_at`, hash-chained `prev`, payload digest. The chain is append-only and the receipt links to its proposing L2 artifact (if any) and its consent phrase.
- **L5:** mandatory receipt + external commitment reference (block height, PR URL, calendar attestation URL, etc.). The L5 receipt is what makes the irreversible act _auditable_ afterward — without it, L5 leaves no trail back into the system's own memory.

## Reversibility matrix

| Action                                      | Reversal cost                                                                                                          |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| L0 read                                     | $0                                                                                                                     |
| L1 write to `~/.dema/`                      | `rm <file>`                                                                                                            |
| L2 propose                                  | discard                                                                                                                |
| L3 local file edit (uncommitted)            | `git restore`                                                                                                          |
| L3 local commit on feature branch           | `git checkout main && git branch -D`                                                                                   |
| L4 receipt write (local)                    | None — chain is append-only. _The act_ may be reversible (e.g. an undo mission), but the _record of the act_ persists. |
| L5 push to main                             | revert commit (recorded in history)                                                                                    |
| L5 PR merge                                 | revert merge commit (recorded in history)                                                                              |
| L5 `ots stamp`                              | none — public timestamp calendar entry is permanent                                                                    |
| L5 OTS upgrade with Bitcoin block embedding | none — Bitcoin block is permanent                                                                                      |
| L5 identity-bound artifact                  | revocation may be possible but the issuance is recorded forever                                                        |

The asymmetry between L4 (durable record, possibly reversible _act_) and L5 (irreversible) is what makes L5 the harder gate.

## Anti-patterns explicitly forbidden

1. **Auto-promotion.** Dema may not promote its own autonomy level by inference (e.g. "the operator approved L4 last time, so I can repeat for the next bounded diagnostic without asking again"). Each L4 / L5 act needs its own consent.
2. **Coalesced consent.** A single GO does not authorize a _sequence_ of L4/L5 acts; each one needs its own typed authorization unless the operator explicitly scopes a sequence ("merge after CI green for PR #X" — bounded to PR #X only).
3. **Memory weaponization.** Dema may not write to memory (L1) in a way that biases future L2 proposals toward higher-autonomy actions without disclosure. Memory entries that influence proposals must be readable by the operator (`dema memory show`).
4. **Shadow consent surfaces.** Dema may not use any consent surface other than the exact-string phrase in `BOUNDED_DIAGNOSTIC_CONSENT_PHRASE` (or whatever the equivalent for higher artifacts becomes). No clickable buttons, no "yes/y/Y" toggles, no fuzzy match.
5. **Cloud-side authorization laundering.** A relayed consent from another AI session (cloud-side Claude, another Claude Code instance, an external assistant) is _not_ the operator's typed consent. The operator's typed consent is the only valid input. (See [`feedback_cloud_disk_asymmetry.md`](../../../.claude/projects/-home-bizra-operating-system-Downloads-Dema/memory/feedback_cloud_disk_asymmetry.md) — the principle generalizes.)

## What this enables

A future "always-on Dema" can now have:

- A scheduling surface (cron, systemd) firing L0 observation cycles continuously, L1 memory updates as state drifts, L2 proposals queued for the operator
- A surfaced "what would Dema do next" view backed by L2 proposals
- A small UI affordance for the operator to type the exact consent phrase that promotes a specific L2 proposal to L4 execution
- Receipt-backed history of every L1+ act, replayable, hash-chained

…all without any of those acts crossing into L5 unless the operator types the GO themselves, in the current moment, on the current action.

## What this forbids

A future "always-on Dema" may not, even if technically capable:

- Open PRs autonomously
- Push to main autonomously
- Stamp anything autonomously
- Generate identity material autonomously
- Federate with peers autonomously
- Spend money autonomously
- Send messages on the operator's behalf autonomously

These are L5 by definition. They require the operator's hand visible on each act.

## Versioning

This document is **v0.1**. Changes that loosen any L4/L5 gate require:

- a written rationale on the PR that proposes the change
- explicit operator GO on the doctrine PR itself
- a corresponding update to the receipt schema if the new action class needs new fields
- a new ADR if the change conflicts with ADR-005

Changes that _tighten_ gates (more restrictive autonomy) need only the standard PR review.

## How A5 (the first ARTIFACT-011) sits inside this envelope

A5 is a single L4 act, gated by:

1. The niyyah at `~/.dema/memory/a5-niyyah.json` (operator-declared, L1).
2. An L2 proposal from `dema mission propose` returning a previewable bounded diagnostic.
3. The exact consent phrase typed by the operator: `GO: Node0 bounded diagnostic activation only`.
4. A real ready Node0 (gateway live ✅, model loaded, daemon stopped, no prior runtime pulse fired).
5. The governed bounded-diagnostic runtime path (lives outside this repo per invariant #1) actually executing the diagnostic.

When all five hold, A5 emits one L4 receipt: `~/.dema/receipts/ARTIFACT-011.json`. That receipt is the chain's first non-genesis link, and its payload includes (or hashes) the niyyah text. The chain transitions from `length: 0` to `length: 1`. That's H6 → H7.

A5 is **not** an L5 act. It produces a local receipt; it does not push, stamp, federate, or sign identity. (A _later_ lane — committing the receipt's hash to a public surface, or anchoring the chain head to Bitcoin — would be L5 and require its own GO.)

This separation matters. The first runtime act should not also be an external commitment. One thing at a time, each gated honestly.
