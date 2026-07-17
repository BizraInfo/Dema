# Receipt: DEMA-PROGRAM-GRAPH-NICHE-CELL-0A

Truth label: `PREVIEW_ONLY` — deterministic representation kernel measured by
in-repository tests. `authority_delta: 0`.

## Slice

Minimum deterministic program-lifecycle substrate for one proposed Niche
Mission Cell: immutable ProgramDefinition → canonical-json-v1 hash envelope
(`{canonicalization, body, body_hash}`; the hash subject is `body` alone) →
pure derived ProgramProjection → structural transition candidates. The graph
owns topology and derived readiness; the Mission Corridor journal owns
history; FATE owns authority; this kernel persists nothing and grants
nothing.

## Proof contract (measured)

1. A bounded Niche Mission Cell is representable
   (DEMA-CONTINUUM-FOUNDER-RECOVERY-001, 8 linear tasks T1–T8).
2. Required evidence and the all-false authority ceiling are explicit and
   closed (missing/extra/non-boolean/true keys fail closed).
3. Tasks form a valid deterministic graph (duplicate/missing/self/cyclic
   dependencies fail closed; order-invariant `body_hash`).
4. Only lawful transitions are structurally admissible (closed 9-state
   table; unlisted fails closed).
5. Narration cannot advance state: lifecycle fields in caller input are
   rejected by name; candidates always return `transition_applied: false`.
6. Missing evidence blocks acceptance (`evidence_missing:<ref>`); refs prove
   presence, never truth.
7. Failure cannot increase authority (`authority_granted: false` on every
   path; no code path flips a ceiling flag).
8. Tamper is detected: forged projection, stale hash, and forge-and-rehash
   over invariant-violating / reordered / schema-relabeled bodies all fail
   verification (7/7 battery rejections in the gate).
9. No external effect: kernel is pure (no fs/network/process/clock/random —
   asserted by source scan in the test battery).

## Commands

```bash
node --test tests/dema-program-graph.test.js       # 41 tests
node scripts/review/dema-program-graph-check.mjs   # gate (also in npm run check)
```

Canonical fixture hash (deterministic, reproduced by the gate on any
checkout as `definition_hash`):

```text
sha256:4ee38e44f6fdf8f8b83355609f6d2d51460eb96683466b0345d9ec9fa039a33c
```

## Rollback

- **Before push:** discard the isolated worktree/local branch (destructive
  local option: `git reset --hard <base>` inside the slice worktree only).
- **After push, before merge:** close the PR and/or delete the remote branch
  under separate authorization, or publish a corrective commit — never
  rewrite published history.
- **After merge:** revert the squash/merge commit through a separately
  reviewed PR; `main` is never rewritten.

## Boundary

```text
No runtime execution · no model invocation · no network · no persistence
No consent surface · no evidence truth · no opportunity detection
No archive read · no capability promotion · authority_delta: 0
```

## What this does not prove

- Persistent lifecycle execution or transition history (journal law — the
  corridor, not this kernel).
- Authentic consent, evidence truth, human identity, or real (organizational)
  verifier independence — identifier separation only.
- Any archive was read, any asset recovered, any mission improved, any model
  worked, any effect occurred, any value created, any capability promoted.
- Global `program_id` uniqueness (format-only validation; a future registry
  owns uniqueness).
