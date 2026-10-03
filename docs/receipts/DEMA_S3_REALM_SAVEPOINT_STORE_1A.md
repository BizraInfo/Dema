# DEMA-S3-REALM-SAVEPOINT-STORE-1A

Truth label: `LOCAL_ISOLATED_TESTED_NOT_REPO_QUALIFIED`

## Purpose

Add the smallest durable continuity primitive missing between the existing
`NODE0-REALM-STATE-KERNEL-1A` replay logic and the older operator-only realm
checkpoint bookmark.

This slice creates an immutable local savepoint chain. Each savepoint binds an
already-derived realm event head and realm-state hash to a model-neutral
continuation contract:

- current phase;
- exact next legal action;
- must-not-repeat actions;
- resume-capsule commitment;
- authority delta fixed at zero.

It is subordinate to the existing realm/mission authority. It does not create a
second mission lifecycle and does not decide whether an underlying realm event
is true.

## Verified local-isolated behavior

Measured on Node.js `v22.16.0` in an isolated reconstruction of the exact new
module, canonical JSON v1 implementation, and test file:

```text
node --test tests/dema-realm-savepoint-store.test.js
16 tests · 16 pass · 0 fail
```

The tests cover:

1. first immutable savepoint publication and replay;
2. exact parent-hash chaining;
3. canonical `must_not_repeat` ordering;
4. refusal of nonzero authority delta;
5. duplicate-set rejection;
6. one-byte tamper detection;
7. sequence-gap rejection;
8. abandoned private-temp recovery;
9. unexpected authority-directory entry rejection;
10. competing in-process writers — one winner, one conflict;
11. identical race settlement as idempotent;
12. fresh-process reconstruction with no prior model context;
13. broken-parent rejection;
14. directory-fsync uncertainty — retry forbidden, replay required;
15. real child-process race — sequence zero cannot fork;
16. canonical byte stability across caller key ordering.

Syntax checks passed for the module and test file.

Local isolated file hashes before repository publication:

```text
module sha256: 4eb587d011c7aba588b554149c13e7a044f065dd734ebfc057004c5625112a65
test   sha256: 1097212bf0ef42eefa6ac9a30db505aecd261f87b204aa736c5c79f7bdd903c2
```

These hashes describe the isolated source used for the focused run. Repository
blob and commit identities are separate Git facts.

## Publication law

A canonical savepoint path appears only after:

```text
private temp create (wx)
-> write complete canonical bytes
-> fsync temp file
-> hard-link no-replace to canonical sequence path
-> fsync authority directory
-> unlink private temp
-> replay and re-verify complete chain
```

An existing sequence is settled through exact savepoint-hash equality:
identical work is idempotent; different work is a transition conflict.

## Explicit boundaries

This slice does **not**:

- replace or modify `last-checkpoint.json` / `timeline.json`;
- wire a CLI command;
- import or invoke a model;
- generate a resume capsule;
- observe or reconcile Git/filesystem/process world state;
- bind a production identity or signature;
- prove independent authenticity;
- start a daemon;
- use network, federation, token, wallet, PoI, or reward paths;
- perform the TASK-029 founder ceremony;
- prove Node0 closure, continuous buoyancy, or production readiness.

The canonicalizer is injected by the caller. This keeps the module unregistered
until the repository's canonical-consumer review explicitly accepts the import
and wiring surface.

## Qualification gap

The current execution container could not clone the exact repository because
DNS resolution for `github.com` was unavailable. Therefore the following are
**not claimed**:

- exact-branch `npm test`;
- exact-branch `npm run check`;
- `npm run llm:guidance`;
- canonical-consumer gate status;
- claim-corpus status;
- integration with existing CLI or realm kernel;
- remote CI status.

The branch is a reviewable candidate only. Promotion requires an exact-tree run
of the project gates and an honest `CURRENT_LIMITS.md` / capability-registry
update in the integration slice.

## Next proof step

On a clean exact checkout of the branch:

```text
node --test tests/dema-realm-savepoint-store.test.js
npm test
npm run check
npm run llm:guidance
npm run claim:check:corpus
git diff --check
```

Then bind one real realm-state-kernel output and one worker-handoff checkpoint to
the savepoint store, terminate the first process, reconstruct in a fresh process,
and prove the same next legal action with `authority_delta: 0`.
