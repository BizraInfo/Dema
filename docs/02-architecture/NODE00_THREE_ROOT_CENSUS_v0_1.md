# NODE00-THREE-ROOT-CENSUS-0B — bounded three-root metadata census (v0.1)

Truth label: `NODE00_THREE_ROOT_CENSUS_MEASURED_REPO`

Boundary all-false. No content read, no mutation of any scanned root, no network, no
model invocation, no signer access.

## Purpose

Node00 needs a truthful answer to "what is actually on this machine, and which
declared space owns it" before anything downstream (indexing, dedup, registry, mission
runtime) is allowed to exist. That answer must be obtainable **without** reading a
single byte of content and **without** disclosing private filenames.

## Shape

```text
packages/core/src/node00-three-root-census.js         pure kernel (no fs import)
  └── injected adapter: { lstat, readdir, now }       the ONLY way it touches anything
apps/cli/src/commands/node00-three-root-census.js     the ONLY fs surface
  ├── censusFsAdapter()                               read-only metadata (lstatSync)
  └── planProofOutput() / writeCensusProof()          external proof writer (separate)
scripts/review/node00-three-root-census-check.mjs     review gate (in-memory fixture)
tests/node00-three-root-census.test.js                46 tests
```

The scanner and the writer are deliberately separate: the scanner never learns where
output goes, and the writer never learns how to walk.

## Input contract

```js
runNode00ThreeRootCensus({
  consent: NODE00_THREE_ROOT_CENSUS_GO_PHRASE,   // exact byte match
  input: {
    roots: [{ id, path /* absolute */, visibility: "private" | "public" }],
    adapter: { lstat, readdir, now },            // injected; nothing wider exists
    bounds: { max_depth, max_entries, max_millis },
  },
});
```

## Ownership law

> Every filesystem entry belongs to the most-specific explicitly declared root
> containing it.

When a parent traversal reaches a directory that is itself an admitted root, it
records a `delegated_root` marker and does **not** descend. The child root owns its
own subtree. Consequences, all tested:

- nested-root double count is zero — no `device:inode` is owned twice;
- root **argument order** cannot change ownership or the body hash (roots are
  canonically ordered by normalized path before traversal);
- topology (`containment` / `disjoint`) is **derived from the admitted roots**, never
  assumed. Relocating a root changes the measured topology and the delegation.

## Root admission (fail closed)

Each root must exist, be a directory, not be a symlink, have no symlink ancestor, and
be unique by **observed identity** (`device:inode`). Two declarations resolving to the
same identity fail closed rather than double-count. Identity is captured before and
revalidated after traversal; a change emits `ROOT_SUBSTITUTED_DURING_SCAN` and the run
can never be reported `COMPLETE`.

## Symlink, device and bound laws

| Situation | Behaviour |
| --- | --- |
| symlink | recorded as metadata; never resolved, never descended |
| entry on another device | recorded with `device_boundary: true`; never descended |
| unreadable directory | `DIRECTORY_UNREADABLE` warning — never a silent omission |
| vanished / unreadable entry | `ENTRY_VANISHED_OR_UNREADABLE` warning with its errno |
| `max_depth` / `max_entries` / `max_millis` hit | `BOUNDED_PARTIAL` + named `truncation_reason`, never `COMPLETE` |

## Privacy contract

A root is declared `private` or `public`. For a **private** root:

```yaml
relative_path: null
basename: null
relative_path_hash: "sha256:…"   # canonical-json-v1 over the relative path
extension: permitted
coarse_type: permitted
```

Raw private filenames appear in **no** manifest, entry, warning, log, receipt or
thrown error — `CensusRootAdmissionError` carries the declared root *label*, never a
path.

One case the first implementation got wrong and the tests caught: a **public root
nested inside a private root** would disclose the private root's absolute path as its
own prefix. Such a root therefore also withholds its path. `verify()` enforces both
rules from the body alone, using the measured containment edges — a forged manifest
that re-discloses either is refused (`private_root_path_disclosed`,
`nested_root_discloses_private_parent_path`).

## Determinism and the 1024-element cap

The hashed body is identical for the same frozen metadata snapshot regardless of root
argument order, run id, timestamp, PID or temporary path. Volatile run metadata lives
outside the body, in `receipt.json`.

`bizra.canonical-json.v1` caps a single array at 1024 elements — a deliberate
fail-closed bound. The first real run (626,461 entries) hit it:

```text
CanonicalJsonV1Error: array_length_exceeded: array length 626461 exceeds 1024 at $
```

Collections are therefore digested by a **chunked Merkle fold** (`foldDigest`, width
512): hash each row, fold row hashes in blocks, repeat until one root hash remains.
Every level uses the one canonical contract; the fold binds row order and row count.

## External proof writer

Approved root: `/data/bizra/proofs/node00-three-root-census-0b/<RUN_ID>`.

The writer refuses output that is relative or ambiguous, missing, not a directory, a
symlink, under a symlink ancestor, inside any scanned root, inside any repository
worktree, beneath `$DEMA_HOME`, or under a world-writable (non-sticky) parent. It
captures the proof-root `device:inode` at plan time, revalidates it immediately before
promotion, and promotes by a **same-parent atomic rename** (so promotion can never
cross a filesystem).

Declared limit, stated rather than papered over:

```text
PROOF_ROOT_PARENT_SUBSTITUTION_RESISTANCE:
NOT_PROVEN_AGAINST_HOSTILE_CONCURRENT_MUTATOR
```

No descriptor-relative (`openat2`-grade) containment is claimed.

## Output

```text
manifest.json     deterministic body + content_hash
entries.jsonl     one row per entry, privacy-projected
warnings.jsonl    explicit unreadable / vanished / boundary evidence
receipt.json      volatile run metadata + declared limits
manifest.sha256   sha256 over manifest.json bytes
```

## What this does NOT prove

Content identity (no bytes are read) · semantic meaning · dedup · a persistent asset
registry · physical file organization · independent authenticity (`verify()` is
body-bound but has **no external anchor**, so a forger controlling every field and
recomputing the hash is not detected) · reproducibility across a **live** root
(determinism is proven against a frozen snapshot; a concurrently-written root
legitimately yields a different hash per run) · hostile concurrent proof-root parent
substitution · execution, daemon, network, token, wallet or federation.

## Next capability slice

`MISSION-ENVELOPE-CANON-1A`. No unrelated capability expansion.
