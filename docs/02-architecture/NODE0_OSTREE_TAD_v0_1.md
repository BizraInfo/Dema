# BIZRA Node0 / Dema — OSTree-Model Technical Architecture Document v0.1

**Status:** `DECLARED` (architecture doc). Live mappings labeled `MEASURED_LOCAL`;
the libostree adoption is `ASPIRATIONAL`.
**Scope:** BIZRA Node0 + Dema local Genesis Realm — packaging, immutability,
content-addressing, and atomic deployment of a node's verified state.
**Truth boundary:** There is **zero OSTree on disk today**, and `ostree` is **not
installed** on the operator's machine (verified 2026-05-31). This document is a
technical architecture, not a runtime, not a receipt, not CI output. It binds
future code; it executes nothing. It does not add a dependency.

**Anchored to (real files):**

- `packages/receipts/src/canonical-receipt.js` — content-addressed signed receipt
- `packages/receipts/src/canonical-ledger.js` — on-disk prev_hash chain
- `packages/genesis/src/block0-manifest.js` — `BLOCK0_MANIFEST_SCHEMA = "bizra.dema.block0_genesis_snapshot.v0.1"`
- `packages/flywheel/src/flywheel-*.js` — §19 step-6→11 chain
- `docs/INSTALLER_ARCHITECTURE.md` · `docs/ARCHITECTURE.md`
- `docs/02-architecture/pat-builder-sat-validator.md` · `docs/02-architecture/SAT_ROLE_BOUNDARY.md`

**Companion:** [`NODE0_MASTER_PLAN_v0_1.md`](../NODE0_MASTER_PLAN_v0_1.md) (the
phased build sequence to Block0 seal).

---

## 0. Why OSTree, and why the analogy is honest

OSTree (libostree) is "git for operating system binaries": a **content-addressed
object store**, an immutable **commit chain** with parent pointers, named **refs**,
**atomic deployments** with **rollback**, and **GPG-signed** commits a stranger can
verify without trusting the publisher.

BIZRA Node0 already has the _same shape_ in its proof spine — independently
arrived at. This TAD makes the correspondence explicit (Layer A, real today) and
then proposes adopting libostree itself as the deployment substrate (Layer B,
aspirational), so Node0's "what is this node, exactly, and can a stranger
re-derive it?" question gets a battle-tested answer instead of a bespoke one.

The analogy is not decoration: the receipt chain is _literally_ a content-addressed,
parent-linked, signed commit log. The question this TAD answers is whether to keep
re-implementing OSTree's properties by hand, or stand on libostree.

---

## 1. Layer map — OSTree concept → BIZRA primitive

| OSTree concept                                               | BIZRA Node0 primitive                                                                                             | Status today                                          |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Content-addressed **object** (blob keyed by sha256)          | Canonical receipt — `receipt_id = sha256(stableStringify(body))` (`canonical-receipt.js:142`)                     | `MEASURED_LOCAL`                                      |
| **Commit** (object + parent + metadata)                      | Receipt entry — `canonical_body` + `prev_hash` + `truth_label` + signature                                        | `MEASURED_LOCAL`                                      |
| **Commit log** (parent chain)                                | `prev_hash` chain — `entry.prev_hash === entries[i-1].receipt_id` (`canonical-ledger.js`)                         | `MEASURED_LOCAL`                                      |
| **GPG-signed commit** (external trust)                       | Ed25519 `receipt_signature_b64`; authority = external pubkey ONLY (embedded fingerprint never trusted — REJECT-4) | `MEASURED_LOCAL`                                      |
| **`ostree fsck`** (verify object integrity + chain)          | `verifyCanonicalChain()` / `verifyLedgerReplay()` — zero-trust re-derivation                                      | `MEASURED_LOCAL`                                      |
| **Treefile / manifest** (declares what composes the tree)    | Block0 commitment set — 12 prerequisite proof-hashes + `claim_boundary` (`block0-manifest.js`)                    | `PARTIAL` (generator exists; not all prereqs sealed)  |
| **Deployment** (atomic checkout of a commit → bootable tree) | Block0 genesis snapshot — a sealed `block0_id` over the commitment set, gated by `SEAL_BLOCK0` consent            | `PARTIAL` (1A generator; no verifier/persist/CLI)     |
| **Rollback** (pin a prior deployment)                        | Chain replay — any prior state is re-derivable from the signed chain                                              | `PARTIAL` (chain replays; no deploy/rollback surface) |
| **Ref** (named pointer to a commit, e.g. a branch)           | "latest" pointers (latest mission / authorship receipt)                                                           | `DESIGNED_NOT_LIVE` (ad-hoc, not unified)             |
| **Static delta** (efficient commit-to-commit diff)           | Receipt-chain delta                                                                                               | `DESIGNED_NOT_LIVE`                                   |
| **Remote / pull** (federate between repos)                   | Shared Universal Resource Pool across nodes                                                                       | `BLOCKED` — federation, forbidden-until-proven        |

**The one-sentence thesis:**

```text
A Node0 is an OSTree-shaped, content-addressed, signed commit chain of verified
state; Block0 is its first sealed deployment; a stranger fsck's it with the
public key alone.
```

---

## 2. Layer A — what is already OSTree-shaped (MEASURED_LOCAL)

This is not aspirational. It runs and has tests.

```text
object store    : every receipt is addressed by sha256 of its canonical body
commit          : body = { schema, prev_hash, body_hash, canonical_body,
                           truth_label, what_this_proves, what_this_does_not_prove,
                           operator_public_key_fingerprint, created_at_iso }
parent link     : prev_hash → previous receipt_id (null = genesis)
signature       : Ed25519 over the body; verified under the EXTERNAL pubkey only
fsck            : verifyCanonicalChain walks the chain, re-derives every hash,
                  rejects body_hash_mismatch / receipt_id_mismatch /
                  prev_hash_mismatch / signature_invalid / genesis_prev_hash_not_null
```

The flywheel chain (`flywheel-one-task → settlement → ledger → xp-proposal →
sat-validation → xp-mint`) already produces content-addressed, signed, replay-
verifiable entries for §19 steps 6–11. Each is an OSTree-style commit in all but
name.

**Implication:** Layer A means BIZRA does not need OSTree to _have_ the properties.
It already proves them. OSTree adoption (Layer B) is about **standardizing the
substrate and getting atomic deploy/rollback for free**, not about acquiring the
properties.

---

## 3. Layer B — proposed libostree adoption (ASPIRATIONAL)

Forward path, explicitly not live. Proposed only if the value (atomic deploy,
rollback, dedup, signed distribution) outweighs adding a non-stdlib system
dependency — which **conflicts with the current "zero prod / zero dev dependency,
stdlib-only" invariant** (`CLAUDE.md`). That tension is the central decision (§6).

Proposed model:

```text
ostree repo            ~/.dema/ostree/            (content-addressed object store)
node-state commit      one commit per sealed Node0 state transition
ref  bizra/node0/main  → latest sealed Node0 commit
ref  bizra/node0/block0 → the Block0 genesis commit (immutable, pinned)
deployment             atomic checkout of a commit into a runnable node layout
signature              commit GPG/Ed25519 signed; verified offline by a stranger
manifest (treefile)    declares the node composition (see §4)
```

The Block0 genesis snapshot becomes the **root commit** on `bizra/node0/block0` —
immutable, signed, the proof-of-origin. Subsequent verified state transitions are
children. Rollback = re-pin a parent commit. `ostree fsck` subsumes
`verifyCanonicalChain`.

---

## 4. The Node0 composition manifest (DECLARED schema sketch)

An OSTree treefile declares _what composes the tree_. The BIZRA analogue declares
_what composes a sealed Node0_ — and it is mostly already specified by the Block0
commitment set. Proposed manifest (schema declaration only, no implementation):

```jsonc
{
  "schema": "bizra.dema.node0_composition_manifest.v0.1", // DECLARED, not built
  "node0_ref": "bizra/node0/block0",
  "block0_id": "<sha256 of the Block0 commitment set>", // from block0-manifest.js
  "receipt_chain_root": "<receipt_id of the genesis canonical receipt>",
  "kernels": [
    // content-addressed module set
    { "name": "flywheel-one-task", "source_hash": "<sha256 of module bytes>" },
    { "name": "flywheel-sat-validation", "source_hash": "<sha256>" },
    // ... the verified kernel set that defines this node's behavior
  ],
  "sat_gates": [
    "sat.verifier",
    "sat.compliance",
    "sat.resource",
    "sat.economist",
    "sat.evolution",
  ],
  "prerequisites": {
    /* the 12 Block0 proof-hashes — see block0-manifest.js */
  },
  "claim_boundary": {
    // mandatory-false (block0-manifest.js)
    "token_minted_to_humans": false,
    "public_network_used": false,
    "federation_used": false,
  },
  "operator_public_key_fingerprint": "<sha256 of spki DER>",
  "created_at_iso": "<ISO-8601>",
}
```

This manifest is **content-addressable and signable** with the existing primitives
(`sha256`, `stableStringify`, `signPayload`) — so even a v0.1 manifest is buildable
**without libostree**. That is the bridge: ship the manifest first as a pure
kernel (Layer A+), adopt real OSTree later (Layer B) only if warranted.

---

## 5. Verification & deployment flow (target)

```text
PAT proposes a node-state transition
  → SAT-5 gates audit it (SAT_ROLE_BOUNDARY contract)
  → MuMu gives SEAL_BLOCK0 / state-transition consent (exact-string, key-bound)
  → a content-addressed, signed composition manifest commit is produced
  → verifyCanonicalChain (today) / ostree fsck (aspirational) re-derives it
  → atomic deployment: the verified commit becomes the active node state
  → rollback: re-pin the previous signed commit; nothing is mutated in place
```

A stranger holding only { manifest + public key + verifier rule } re-derives the
same PASS/FAIL with zero trust. That is the whole point — and it is the property
the proof spine already has (Layer A).

---

## 6. Boundaries, tensions, and decisions required

1. **Dependency invariant.** Real libostree (Layer B) is a non-stdlib system
   dependency. The repo is `zero prod / zero dev deps, stdlib-only`. Adopting
   libostree breaks that invariant. **Decision required:** keep the OSTree _model_
   in pure stdlib (composition manifest as a signed kernel) vs add libostree as an
   operator-side packaging tool _outside_ the stdlib core.
2. **No runtime execution in this repo.** Dema does not run a daemon or deploy a
   node from here. Any real OSTree deploy/rollback is governed-runtime / operator-
   side, not Dema-face scope (`CLAUDE.md` invariant).
3. **Federation is forbidden-until-proven.** OSTree remotes / pull (cross-node
   distribution) maps to the shared-URP — `BLOCKED` until the federation gates pass.
   This TAD describes it; it does not enable it.
4. **Manifest ≠ truth.** A composition manifest declares structure; it does not
   prove the kernels are correct. SAT-5 + the §19 acceptance test prove behavior;
   the manifest only seals _which verified things_ compose the node.

---

## 7. Component truth table

| Component                                                      | Truth label                                             |
| -------------------------------------------------------------- | ------------------------------------------------------- |
| OSTree-shaped receipt chain (object store + commit log + fsck) | `MEASURED_LOCAL`                                        |
| Ed25519-signed, externally-verifiable commits                  | `MEASURED_LOCAL`                                        |
| Block0 manifest generator (BLOCK0-1A)                          | `PARTIAL` (no 1B verifier / persist / CLI)              |
| Node0 composition manifest (`node0_composition_manifest.v0.1`) | `DESIGNED_NOT_LIVE` (schema declared §4)                |
| Unified refs (`bizra/node0/main`, `/block0`)                   | `DESIGNED_NOT_LIVE`                                     |
| Atomic deploy / rollback surface                               | `DESIGNED_NOT_LIVE`                                     |
| Real libostree object store / `ostree` binary                  | `ASPIRATIONAL` (not installed; breaks stdlib invariant) |
| Cross-node OSTree remotes (shared-URP federation)              | `BLOCKED` (forbidden-until-proven)                      |

---

## 8. Smallest honest next step (per companion master plan)

Do **not** start with libostree. Start with the pure, stdlib, content-addressed
**composition manifest kernel** (§4) — it captures 80% of the OSTree value (a
signed, re-derivable declaration of node composition) with zero new dependency and
zero invariant breakage. libostree adoption (Layer B) is a later, separately-GO'd
decision once the manifest + Block0 seal are real.

```text
NODE0-OSTREE-1A:
A pure kernel that builds a signed bizra.dema.node0_composition_manifest.v0.1
from a sealed Block0 + the verified kernel set, and a verifier that re-derives it.
No libostree. No daemon. No federation. No deploy surface yet.
```
