# Dema slice anatomy

The fixed shape every NODE0/DEMA proof slice in this repo follows, the naming
transforms the scaffold applies, the wiring map, the invariants the gates enforce,
and how to turn the red stubs green. Read this when an anchor is missing, when the
host repo has drifted, or when you are building the kernel logic the scaffold left as
`not_implemented`.

Reference slice (all parts present, fully built): `NODE0-RECEIPT-SIGNING-ED25519-1A`.

## 1. The nine parts

A complete slice is five new files plus four wiring edits:

```
packages/core/src/<kebab>.js                       # pure kernel
tests/<kebab>.test.js                              # mirrored test (red first)
scripts/review/<kebab>-check.mjs                   # review gate
docs/receipts/<CAPID>.md                           # receipt
docs/02-architecture/<PREFIX>_v0_1.md              # architecture doc

scripts/check.mjs                                  # + review-gate command line
docs/TESTING.md                                    # + test row + review command
docs/CURRENT_LIMITS.md                             # + capability row
packages/core/src/dema-capability-truth-registry.js# + row + REQUIRED id + count bump
  (and tests/dema-capability-truth-registry.test.js: + count-digit bump)
```

## 2. Naming transforms

From a slice id like `NODE0-RECEIPT-SIGNING-ED25519-1A`:

| Derived name | Value | Used for |
| --- | --- | --- |
| `kebab` | `node0-receipt-signing-ed25519` | file names (id minus the version segment, lowercased) |
| `PREFIX` | `NODE0_RECEIPT_SIGNING_ED25519` | exported const prefix, arch doc base |
| `CAPID` | `NODE0_RECEIPT_SIGNING_ED25519_1A` | registry `capability_id`, receipt file name |
| `schema` | `bizra.dema.node0_receipt_signing_ed25519.v0.1` | `<PREFIX>_SCHEMA` |
| `Camel` | `Node0ReceiptSigningEd25519` | `plan<Camel>`, `run<Camel>`, `verify<Camel>` |
| `version` | `1A` | the trailing version segment |

Id format: uppercase segments separated by `-`, last segment a version like `1A`,
`1B`, `2A` (`^[A-Z0-9]+(-[A-Z0-9]+)*-\d+[A-Z]$`).

## 3. The kernel (`packages/core/src/<kebab>.js`)

A **pure** kernel (path rule `core-kernels.md`): no `fs` / network / process / clock /
random unless injected and documented in the header. Exports, in order:

- `<PREFIX>_SCHEMA`, `<PREFIX>_TRUTH_LABEL`, `<PREFIX>_GO_PHRASE` — string constants.
- `<camelLower>Boundary()` — frozen, **all-false** object. The keys mirror the
  registry row boundary (`execution_allowed`, `daemon_started`, `network_used`,
  `token_minted`, `wallet_accessed`, `live_execution_performed`,
  `file_mutation_performed`, `model_invocation_performed`). Flipping any one to `true`
  is an execution claim — never do it in a preview slice.
- `plan<Camel>({ consent, input })` — **fail-closed**. Collects a `blocked_by` array;
  `eligible` only when it is empty. Consent is an **exact byte-for-byte** GO-phrase
  match — no fuzzy/partial/normalized consent. **Absence of a block is never
  validation:** push a named block until you can *positively* prove a precondition,
  in line with the registry-resolution discipline (`SERVER_VALIDATED` means a positive
  resolution, not the absence of a flag).
- `build<Camel>Payload(input)` — returns a frozen, **content-addressed** payload
  (`content_hash = sha256(stableStringify(body))`). Reshape `body` to carry the real
  fields this slice attests.
- `verify<Camel>(payload)` — the **re-derivation** path required by the core-kernels
  rule. Recompute the hash over the body minus its hash field and reject any mismatch,
  then add slice-specific field checks. **Body-bound, not seed-bound** (see §7).
- `run<Camel>({ consent, input })` — the orchestrator the review gate consumes. Runs
  `plan → build → verify → tamper-reject` and returns the proof envelope
  `{ ok, schema, truth_label, content_hash, boundary, blocked_by }`, failing closed
  (a named block) on any failure.

The scaffold makes `plan*` and `build*Payload` real and leaves `verify*`/`run*` as
`throw new Error("not_implemented:...")`. That is your build target.

## 4. The test (`tests/<kebab>.test.js`)

`node:test` + `node:assert/strict`. Imports the kernel exports and the review-gate's
`run<Camel>Check`. Each test encodes one clause of the proof contract:

- plan fail-closed without exact consent; plan eligible with consent + well-formed input
- payload content-addressed + all-false boundary
- verify accepts a fresh payload; rejects a tampered `content_hash`; rejects a field
  change that left the hash stale (see §7 for the harder launder it does not yet defend)
- review gate returns `ok: true` after build → verify → tamper-reject
- orchestrator boundary stays all-false

Red first: the `verify`/`run`/gate tests fail with `not_implemented` until you build
the bodies. **Build the kernel up to the test; never soften the test down to the
kernel.**

## 5. The review gate (`scripts/review/<kebab>-check.mjs`)

`#!/usr/bin/env node`, exports `run<Camel>Check()` (supplies the canonical fixture and
calls `run<Camel>`), supports `--json` (strip heavy fields), prints a human summary
otherwise, and `process.exit(1)` when `!result.ok`. Run as a module via the
`import.meta.url === pathToFileURL(process.argv[1]).href` guard so importing it from
the test does not execute it.

## 6. Wiring map and anchors

| File | Edit | Anchor the scaffold uses |
| --- | --- | --- |
| `scripts/check.mjs` | add `["node", ["scripts/review/<kebab>-check.mjs"]],` | line containing `dema-capability-truth-registry-check.mjs` (inserts before it) |
| `docs/TESTING.md` | add test-table row | end of the `` | `tests/...` `` table |
| `docs/TESTING.md` | add review command | line `node scripts/review/dema-capability-truth-registry-check.mjs` |
| `docs/CURRENT_LIMITS.md` | add capability row | line `| Stdlib-only dependency posture` |
| registry source | append `REQUIRED_CAPABILITY_IDS` id | `REQUIRED_CAPABILITY_IDS = Object.freeze([` … `]);` |
| registry source | insert `capability({...})` row | close of `function defaultCapabilityRows()` |
| registry source | bump count prose | `the <word> shipped pre-action spine capabilities` |
| registry test | bump count digits | `capability_count, <N>` and `measured_repo_count, <N>` (×2) + `<word>-capability truth registry` |

**The count-bump trap.** `capability_count` / `measured_repo_count` are derived from
the array length in the *source*, but **hard-coded as digits in two test assertions**,
and the count also appears as a number-word in the registry test name and in prose. A
by-hand slice that adds a row but forgets a digit breaks the registry test with a
confusing off-by-one. The scaffold bumps all of them, and only when the row is newly
added (re-runs do not over-count).

If the scaffold reports `anchor not found` for any edit, the host repo has drifted
from this shape. Do not force it — wire that one file by hand and note the drift so
the anchor can be updated.

## 7. Invariants the gates enforce

- **Kernel purity** (`scripts/review/kernel-purity-check.mjs`): no effectful imports in
  `packages/core/src` unless injected. Pass `fs`, clocks (`now`), and randomness
  (`generateKeypair`) as parameters; the reference slice injects all three.
- **No overclaim** (`scripts/review/no-overclaim.mjs`, Layer 1): forbidden live-claim
  phrases in structured artifacts. Keep preview/boundary language honest; the boundary
  stays all-false; `[MEASURED]` is earned only when green.
- **Registry check** (`scripts/review/dema-capability-truth-registry-check.mjs`):
  verifies every evidence path in a row **exists on disk**. This is why `--no-arch`
  drops the arch doc from the row — a listed-but-absent file fails this gate.
- **Body-bound verification, not seed-bound** (caught in #253, applied #254): a verifier
  must diff the **whole body**, not a seed/subset. A seed-bound hash lets a forged
  `final_state`/`boundary` launder through. The generic scaffold's `verify` checks
  internal hash consistency only, which catches a stale-hash tamper but **not** a
  forge-and-recompute launder. To defend against that you need an **independent
  anchor** — a signature over the payload (see `packages/receipts/src/authorship-signature.js`)
  or an externally measured state hash (see the `state_hash` split in
  `node0-reversible-execute-gate.js`). Add a forge+recompute rejection test only once
  that anchor exists, and do not claim launder-resistance before then.

## 8. Closing the slice

After the focused test, `npm test`, and `npm run check` all pass:

1. Replace the `TODO(<ID>)` in the registry row `what_this_proves` with a precise,
   non-overclaiming statement, and the `N tests` placeholder in `TESTING.md` with the
   real count.
2. Promote the `CURRENT_LIMITS.md` row from "Red-first scaffold …" to `[MEASURED]`
   with the real evidence summary.
3. Run the `proof-closeout` skill. One branch = one slice = one proof story; surface
   any unrelated dirty files rather than absorbing them.
