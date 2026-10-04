# NODE0-MINIMUM-SEASON-SAVE-RESUME-1A

Truth label: `NODE0_MINIMUM_SEASON_SAVE_RESUME_MEASURED_REPO`

## Purpose

Make Node0 remember exactly where it is after the model disappears. A new process
with no chat history recovers the active mission, what completed, what must not be
repeated, what consent is still pending, the one next safe action, and the
repository commit + tree that produced the checkpoint.

## Two halves, one authority each

| | Pure kernel | I/O store |
| --- | --- | --- |
| Path | `packages/core/src/node0-minimum-season-save-resume.js` | `packages/receipts/src/season-state-store.js` |
| Owns | state contract, semantic hash, chain algebra, refusal reasons | publication, fsync, sequence fence, HEAD replacement |
| Touches disk | never | only under `DEMA_HOME` |

A pure kernel can validate SHAPE; only the store can prove BINDING. That split is
why `verifySeasonState` re-derives from the payload's own fields and never trusts
a passed-in flag.

## State contract

Persisted fields: `schema`, `domain`, `season_id`, `mission_id`,
`mission_contract_hash`, `mission_phase`, `completed_steps`, `next_safe_action`,
`must_not_repeat`, `pending_consent`, `last_receipt_hash`, `repository_commit`,
`repository_tree`, `state_sequence`, `previous_state_hash`, `truth_label`,
`boundary`, `saved_at`, `state_hash`.

Rules the contract enforces:

- `completed_steps` — caller order preserved, duplicates **refused** (a silent
  dedupe would destroy the record of what actually ran).
- `must_not_repeat` — byte-exact. No sort, no trim, no dedupe.
- `pending_consent` — always an array of `{phrase, scope}`; empty means none.
  Resume returns it still pending. Any other shape fails closed.
- `next_safe_action` — one bounded `UPPER_SNAKE` action, not a plan.
- Secrets, tokens, env-var carriage and private keys are refused before write.
- Raw chat history is never stored — there is no field for it.

### Why `saved_at` is excluded from the hash

The mission contract forbids uncontrolled clock data inside the semantic hash:
two processes that reconstruct the same continuation must agree on its identity
regardless of when they saved (S12). The clock is not thereby unbound — the save
**receipt** binds `saved_at` alongside `state_hash`, so the time is attested, it
simply is not allowed to change what the state *is*.

## Storage layout

```text
$DEMA_HOME/seasons/<season_id>/
  states/sha256-<64hex>.json      immutable, content-addressed
  receipts/sha256-<64hex>.json    immutable, binds state_hash + saved_at
  seq/<NNNNNN>.json               the sequence FENCE
  HEAD.json                       mutable pointer
```

## Atomic save design

```text
1  validate the state contract
2  read and verify the current HEAD when present
3  bind the new state to the previous state hash
4  canonicalize (bizra.canonical-json.v1) and hash the semantic state
5  publish the content-addressed state   (temp → fsync → link → fsync dir)
6  fsync
7  publish the save receipt              (temp → fsync → link → fsync dir)
8  fsync
8b WIN THE SEQUENCE FENCE                (link seq/<N>.json — EEXIST ⇒ you lost)
9  atomically replace HEAD               (temp → fsync → rename)
10 fsync the containing directory
11 re-read and verify the committed state from disk
12 return the new state hash and receipt hash
```

A failed save leaves either the previous valid HEAD or the complete new one.
HEAD is written **last**, and only after everything it names is durable, so it
can never point at missing, partial or hash-invalid state.

### Why a fence and not a lock

C4D already settled how this repo fences concurrent writers: publish to an
addressed path with no-replace semantics and let the filesystem pick the winner
(`packages/receipts/src/mission-closure-transaction.js`). `seq/<NNNNNN>.json` is
therefore the authority for "who owns sequence N"; `HEAD.json` is a pointer
published only by the writer that already won. HEAD is a cache of a decision made
elsewhere, never the decision itself — which is why a re-hashed forged HEAD still
fails (S9b).

### Why `link()` for objects and `rename()` for HEAD

States, receipts and fence entries are immutable, so they use no-replace `link()`:
a canonical path only ever appears whole and is never silently overwritten. HEAD
is a mutable pointer, and `rename()` is the only primitive that swaps one whole
pointer for another atomically. Using `link()` for HEAD would make the second save
impossible; using `rename()` for objects would let a torn write overwrite a good
one. The two are not interchangeable.

### The crash window between them

A writer can die holding the fence but before replacing HEAD. Replaying the
identical save then finds `EEXIST` with the same `state_hash`, recognises its own
prior attempt, and **continues to HEAD publication** rather than returning early —
so the retry repairs the stranded pointer instead of reporting a success that left
HEAD behind (S6b).

## Fail-closed outcomes

`malformed_head` · `state_missing` · `receipt_missing` · `state_hash_mismatch` ·
`receipt_hash_mismatch` · `previous_state_link_broken` · `sequence_regression` ·
`repository_commit_mismatch` · `repository_tree_mismatch` · `unknown_schema` ·
`secret_bearing_state` · `pending_consent_shape_invalid` ·
`head_candidates_conflict` · `stale_head_lost_race` · `season_path_escapes_home`

`EMPTY` is a typed success, not an exception: no season yet is a legitimate first
use, and refusing it would block the first lawful save. No stack traces, no
environment values, no filesystem detail outside the declared `DEMA_HOME`.

## Boundaries

- All-false boundary invariant; resume performs no world mutation and executes
  no mission step.
- Resume is reconstruction, never autonomous continuation. `consent_granted` is
  hard-coded `false`.
- Local single-node storage only. No network, daemon, wallet, token, federation,
  Node1, model-state persistence, or cross-host replication.

## Files

```text
packages/core/src/node0-minimum-season-save-resume.js
packages/receipts/src/season-state-store.js
apps/cli/src/commands/season.js
apps/cli/src/index.js
packages/core/src/cli-consent-matrix-entries.js
tests/node0-minimum-season-save-resume.test.js
scripts/review/node0-minimum-season-save-resume-check.mjs
scripts/review/kernel-purity-allowlist.js
scripts/review/canonical-json-v1-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/NODE0_MINIMUM_SEASON_SAVE_RESUME_1A.md
docs/02-architecture/NODE0_MINIMUM_SEASON_SAVE_RESUME_v0_1.md
```

## Commands

```bash
node --test tests/node0-minimum-season-save-resume.test.js
node scripts/review/node0-minimum-season-save-resume-check.mjs --json
dema season save --season <id> --mission <id> --phase <PHASE> --next <ACTION> \
  --repo-commit <sha40> --repo-tree <sha40> [--step <s>]... [--must-not-repeat <s>]...
dema season status --json
dema season resume --json
npm test
npm run check
```
