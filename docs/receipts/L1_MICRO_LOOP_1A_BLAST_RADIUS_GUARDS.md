# Receipt: L1-MICRO-LOOP-1A — blast-radius guards

Truth label: `L1_GUARDED_NOT_ACTIVATED` — `LOCAL_ONLY`, sandbox-scoped.

Supersedes nothing. **Binds to** the retraction
`RETRACTION-20260731T173800-L1-defects`, which withdrew
`DEMA-ACTIVATION-L1-20260731T172500` and its `L1_MEASURED_SANDBOX` label.
That withdrawal stands: **L1 is not activated.** This receipt records only that
the four defects are closed and that each regression transports its attack.

## What was wrong

The loop admitted its own act and never bounded it. `evaluateVerificationAdmission`
asked *is this check judge-free?* — a question about the **verifier**. Nothing
asked *what does this act destroy, and can the act reach the evidence it will be
judged by?* — the questions about the **act**. All four defects live in that gap,
and all four returned `PASS`.

| Id | Defect | Measured before | Guard |
| --- | --- | --- | --- |
| E1 | `renameSync` silently destroys an occupied `dst`; only `src` is checkpointed, so the overwritten bytes exist nowhere and the inverse rename restores the path, never the victim | `PASS`, victim content replaced, unrecoverable | `dst_occupied` — a rename is only reversible into empty space. Occupancy by `lstat`, so a dangling symlink still occupies its path |
| E2 | The audit trail lives inside the leased scope, so `src: ".l1/chain.jsonl"` renames the chain away; `sealReceipt` then finds none, re-anchors at `GENESIS_HEAD`, and `verifyChain` reports `valid:true` on the erasure — which is itself sealed as a `PASS` | `PASS`, chain 2 entries → 1, still "valid" | `act_targets_audit_state` — the act may not reach `.l1/`, in `src` or `dst` |
| E3 | `resumeL1Cycle` takes no lease and checks none, yet its `ACTED` path renames and copies — mutation outside any authority envelope, including post-expiry | no lease parameter existed | `resume` carries the cycle's own live lease: `lease_required` · `lease_expired` · `lease_mismatch`. A fresh envelope may not adopt another envelope's unfinished act |
| E4 | `inside()` compared `path.resolve` output — purely lexical. A symlink inside the sandbox pointing out of it read as in-scope, so an act wrote past the lease boundary | `PASS`, payload written outside the leased root | `inside()` resolves through `realpathSync` (nearest existing ancestor + unborn tail) and fails closed when nothing resolves. Root-cause fix: every caller, including `checkLease`, routes through it |

E4 was not closed by the E1/E2 guards — lexical `inside()` still reported the
escaping `dst` as in-scope. It required fixing the shared comparator, not adding
a fourth check at the call site.

## Proof

```bash
node --test tests/l1-micro-loop.test.js      # 21/21 (E5 continuity included)
node scripts/review/kernel-purity-check.mjs  # OK · 451 scanned · 0 violations
npm run llm:guidance                          # PASS
```

Regressions carry the attack, not the control: `L1-13`/`13b` (E1), `L1-14` (E2,
including the `.l1/backup` plant from the other side), `L1-15` (E4, symlink as
`dst` and as `src`), `L1-16` (E3, all three refusal reasons, each asserting the
rollback rename did **not** happen).

Red-before was established by execution, not by checkout: the same probe scripts
that returned `PASS` for E1/E2/E4 against the pre-guard kernel now refuse. Git is
unusable in this sandbox (`.git/config.worktree` is a `/dev/null` char-device
overlay), so a pre-fix SHA checkout was not available and is not claimed.

## What this does not prove

- **Not L1 activation.** The retraction holds until the operator re-certifies.
- **Not a tamper-proof audit chain.** E5 (`docs/receipts/L1_MICRO_LOOP_1A_CHAIN_CONTINUITY_E5.md`)
  closes out-of-band chain delete when `.l1/last_seal_head` remains. Deleting
  both chain and marker still looks like genesis; suffix truncation still
  verifies. External signed head remains open.
- Not L2 chaining, not a daemon or resident process, not network, not model
  invocation. The proposer remains a typed intent.
- Not a clean repo suite. `npm test` exits 1 with failures unrelated to this
  kernel — all 27 remaining failures were classified by execution, not by sampling:
  24 are the dead-git sandbox (`.git/config.worktree` is a `/dev/null` char
  device) — proven by re-running each failing suite under a shadow `GIT_DIR`
  with the real index, where they go green; 2 are `uv_os_get_passwd` ENOENT
  (no passwd entry, `/etc` denied); 1 is EROFS on `~/.dema`. **Correction:** an
  earlier draft of this receipt named `tests/dema-stand.test.js` as cross-suite
  interference. That was a name mismatch — the failing file is
  `tests/dema-stand-cli.test.js`, which reproduces standalone and is dead-git.
  No cross-suite interference was found. None of the classes touch
  `l1-micro-loop.js`, which has no consumers outside its own test.

## Lesson (belongs in ADR-049 before L2)

**Admission is not containment.** Verifiability and blast radius are two gates,
and v0.2 only ever built the first. Before L2 chains acts, the admission
question must gain a second half: not only *can this be checked without
judgment?* but *what is the worst this act can reach?* — with the evidence
store outside everything the act can name.
