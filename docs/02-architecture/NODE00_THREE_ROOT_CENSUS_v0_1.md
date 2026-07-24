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
tests/node00-three-root-census.test.js                48 tests
```

The scanner and the writer are deliberately separate: the scanner never learns where
output goes, and the writer never learns how to walk.

## Input contract

```js
runNode00ThreeRootCensus({
  consent: NODE00_THREE_ROOT_CENSUS_GO_PHRASE,   // exact byte match
  input: {
    roots: [{ id, path /* absolute */, visibility: "private" | "public",
              requires_binding?, binding? }],
    adapter: { lstat, readdir, now },            // injected; nothing wider exists
    bounds: { max_depth, max_entries, max_millis },
    reference_time_ms,                           // required when any root is private
    implementation_worktree,                     // refused as a census subject
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
revalidated after traversal; a change marks that root `FAILED` with reason
`ROOT_SUBSTITUTED_DURING_SCAN`, and the census can never be reported `COMPLETE`.

## Symlink, device and bound laws

| Situation | Behaviour |
| --- | --- |
| symlink | recorded as metadata; never resolved, never descended |
| entry on another device | recorded with `device_boundary: true`; never descended |
| unreadable directory | `DIRECTORY_UNREADABLE` warning — never a silent omission |
| vanished / unreadable entry | `ENTRY_VANISHED_OR_UNREADABLE` warning with its errno |
| `max_depth` / `max_entries` / `max_millis` hit | `BOUNDED_PARTIAL` + named `truncation_reason`, never `COMPLETE` |

## Privacy contract — `PRIVATE_AGGREGATE`

A root is declared `private` or `public`.

A **private** root is reported in `PRIVATE_AGGREGATE` mode: **no per-file record of any
kind leaves the kernel**. Not a path, not a basename, not a path hash, not an exact
size, not an exact mtime, not device/inode/mode/depth, not any stable per-entry
identifier. Only fixed-vocabulary aggregates escape:

```yaml
root_id: DOWNLOADS
privacy_mode: PRIVATE_AGGREGATE
path: null
normalized_path_hash: null
device: null
inode: null
mode: null
summary:
  files_count: · directories_count: · symlinks_count: · other_count:
  inaccessible_count: · delegated_root_count: · device_boundary_count:
  extension_distribution: · coarse_type_distribution:
  size_bucket_distribution:    # SIZE_BUCKETS vocabulary, never exact bytes
  mtime_bucket_distribution:   # MTIME_BUCKETS vocabulary, never exact timestamps
```

`mtime` buckets are ages relative to a **declared** `reference_time_ms`, which is a
required input whenever a private root is present — so the distribution is
reproducible without an exact timestamp ever escaping.

The **only** per-entry row a private root may produce is a delegation marker, carrying
exactly four fields and nothing identifying:

```yaml
root_id: DOWNLOADS
entry_type: delegated_root
delegated_to: DEMA_REPO
ownership_state: DELEGATED_ROOT
```

Warnings for a private root are aggregated by stable reason code
(`{root_id, code, aggregate: true, count}`) — never path-addressable.

### Why the first design was rejected

Round 1 emitted one record per private object with an **unsalted**
`relative_path_hash` plus exact size, device, inode and mode. Raw names were
suppressed, so `PRIVATE_FILENAMES_DISCLOSED = 0` was narrowly true — but an unsalted
deterministic hash is an **offline identification oracle**: anyone with a candidate
filename can compute the hash and confirm presence, and the exact metadata strengthens
correlation. That is `PRIVATE_METADATA_PSEUDONYMIZED`, not privacy-preserving. The
aggregate contract removes the oracle rather than obscuring it.

A **public** root nested inside a **private** root also withholds its absolute path,
because its own would disclose the parent's as a prefix.

`verifyPortableArtifacts()` enforces all of this at the boundary where evidence becomes
portable — the writer refuses to emit an artifact set that violates it, so
generation-time enforcement is not the only line of defence.

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

## Visitation truth

Every admitted root carries an explicit `scan_state`:

```text
NOT_STARTED · COMPLETE · PARTIAL · FAILED
```

A root never reached because a census-wide bound was already exhausted is
`NOT_STARTED` with `reason: GLOBAL_BOUND_EXHAUSTED` and `visited_entries: 0` — it is
**never** reported as a successfully-scanned empty root. `UNSCANNED ≠ EMPTY`. A global
`COMPLETE` requires *every* root `COMPLETE`; `verify()` refuses a manifest claiming
`COMPLETE` while any root is not (`complete_with_non_complete_root`), and refuses a
non-complete root that carries no reason.

## External proof writer

The writer screens the **whole mutable ancestor chain** before any write. A directory
that is group- or world-writable **without** the sticky bit can have its children
renamed or replaced by another principal, so it is a hard refusal
(`proof_root_ancestor_group_writable` / `proof_root_ancestor_world_writable`). Sticky
directories are exempt: sticky means only an entry's owner may rename or remove it,
which is exactly the substitution being defended against. The proof root must also be
owned by the current uid and must not itself be group/world-writable.

It further refuses output that is relative or ambiguous, missing, not a directory, a
symlink, under a symlink ancestor, inside any scanned root, inside any repository
worktree, or beneath `$DEMA_HOME`. It captures the proof-root `device:inode` at plan
time, revalidates it immediately before promotion, and promotes by a **same-parent
atomic rename** (so promotion can never cross a filesystem).

### Retry safety

Every failure path returns a **named envelope** — no raw fs exception escapes. The
temporary run directory carries a run-owned marker file. Cleanup is authorised only
for the exact directory this invocation created, and only after revalidating that it
is inside the proof root, is not a symlink, is a directory, is on the proof root's
device, and carries this run's marker. A temporary directory that already existed on
entry is **evidence, never garbage**: it is reported as
`STALE_TEMP_RUN_REQUIRES_OPERATOR_RECOVERY` and never deleted. A cleanup that cannot
verify ownership returns `RECOVERABLE_TEMP_ARTIFACT_REQUIRES_HUMAN`. Re-running the
same run id after a failed write therefore either succeeds cleanly or reports —
never an uncontrolled `EEXIST`.

Declared limit, stated rather than papered over:

```text
PROOF_ROOT_PARENT_SUBSTITUTION_RESISTANCE:
NOT_PROVEN_AGAINST_HOSTILE_CONCURRENT_MUTATOR
```

No descriptor-relative (`openat2`-grade) containment is claimed.

## Root binding

The **implementation worktree** that builds this slice is never a census subject.
`plan()` refuses any declared root whose normalized path equals the declared
`implementation_worktree` (`dema_repo_subject_equals_implementation_worktree`), and a
root marked `requires_binding: true` must carry an explicit `binding.binding_source`
or the plan blocks with `root_binding_unresolved`. Substituting the build environment
for the real subject is what invalidated the first live run.

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
