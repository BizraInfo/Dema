# Receipt: NODE00-THREE-ROOT-CENSUS-0B

Truth label: `NODE00_THREE_ROOT_CENSUS_MEASURED_REPO`

Status: **corrective round 0B.1 — implementation corrected, real qualification BLOCKED.**

## Supersede notice

Every runtime claim in the first version of this receipt is **withdrawn**. The first
implementation satisfied a superseded contract and its live run is not admissible
qualification evidence:

| Withdrawn claim | Why |
| --- | --- |
| "privacy-preserving portable evidence" / `PRIVATE_FILENAMES_DISCLOSED=0` as a privacy proof | The run emitted one record per private object with an **unsalted** `relative_path_hash` plus exact size, device, inode, mode, depth. Raw names were suppressed, so the counter was narrowly true — but an unsalted hash is an offline identification oracle. Correct classification: `RAW_NAMES_SUPPRESSED / PRIVATE_METADATA_PSEUDONYMIZED / REIDENTIFICATION_RESISTANCE_NOT_PROVEN`. |
| "626,474-entry census across three authorized roots" as qualification | It censused the **implementation worktree** as `DEMA_REPO`, not the 0A-observed subject. The build environment is not a census subject. |
| "measured topology = all three disjoint" | An artefact of the wrong binding, not a fact about the real Node00 estate. |
| `REAL_NESTED_DELEGATION_EXERCISED` | Never exercised live — `delegated_roots = 0` in that run. Delegation is proven by fixture only. |

The superseded artifacts are retained, unmodified and unpublished, at
`/data/bizra/proofs/node00-three-root-census-0b/` with a `SUPERSEDED.md` marker:
`SUPERSEDED · PRIVACY_CONTRACT_INADMISSIBLE · LOCAL_SENSITIVE_METADATA ·
NOT_A_0B_ACCEPTANCE_RECEIPT`. They are **not** to be uploaded or cited.

## Base

```text
Dema main (verified by API before mutation):  079fee557d7c230f2e6c076cc7a776418a393235
bizra-data-lake main (verified, read-only):   6a3c1427836ec0290e4ecb43bf23f55ee70912c2
PR #417 head at round start:                  f47f4a5927aed501cdd1b4437a1ec4c22df0c64b
branch:                                       feat/node00-three-root-census-0b
implementation worktree (NOT a subject):      /data/bizra/worktrees/node00-three-root-census-0b/Dema
```

The pre-existing dirty checkout on `chore/backlog-init-agent-instructions`
(`420a20c8`) remains `PRE_EXISTING_DIRTY_CHECKOUT / PRESERVED_UNMODIFIED /
NOT_A_0B_INPUT` — not merged, switched, cleaned, reset or stashed.

## What round 0B.1 corrected

### 1. `PRIVATE_AGGREGATE` (P0)

A private root now emits **no per-file record of any kind** — no path, basename, path
hash, exact size, exact mtime, device, inode, mode, depth, or stable per-entry
identifier. Only fixed-vocabulary aggregates escape: counts plus
extension / coarse-type / size-bucket / mtime-bucket distributions. `mtime` buckets are
ages against a **declared** `reference_time_ms` (a required input when any private root
is present), so no exact timestamp escapes. The only private per-entry row permitted is
a four-field delegation marker (`root_id`, `entry_type`, `delegated_to`,
`ownership_state`). Private warnings are aggregated by reason code.
`verifyPortableArtifacts()` enforces this where evidence becomes portable, and the
writer refuses to emit a violating artifact set.

### 2. Root binding (P0)

`plan()` refuses any declared root whose normalized path equals the declared
`implementation_worktree` (`dema_repo_subject_equals_implementation_worktree`),
including trailing-separator and `..` spellings. A root marked `requires_binding: true`
must carry an explicit `binding.binding_source` or the plan blocks with
`root_binding_unresolved`.

### 3. Greptile A — proof-root redirection

The whole mutable ancestor chain is screened **before any write**. Group- or
world-writable is a hard refusal unless the directory is sticky **and owned by us or by
root**. The proof root must also be owned by the current uid and not itself
group/world-writable. Tests assert **zero** `mkdirSync`/`writeFileSync` calls occur when
an ancestor is unsafe.

### 4. Greptile B — per-root visitation truth

Every admitted root carries `scan_state` ∈ `NOT_STARTED · COMPLETE · PARTIAL · FAILED`
with its own reason and `visited_entries`. A root never reached because a census-wide
bound was exhausted is `NOT_STARTED / GLOBAL_BOUND_EXHAUSTED` — never a successful
empty root. Global `COMPLETE` requires every root `COMPLETE`; `verify()` refuses
otherwise (`complete_with_non_complete_root`).

### 5. Greptile C — retry-safe proof writing

No raw fs exception escapes; every failure returns a named envelope. Cleanup is
authorised only for the exact directory this invocation created, proven by the
device+inode captured immediately **after** `mkdir`. A pre-existing temp directory is
evidence, never deleted (`STALE_TEMP_RUN_REQUIRES_OPERATOR_RECOVERY`); one substituted
since creation returns `RECOVERABLE_TEMP_ARTIFACT_REQUIRES_HUMAN`. Same-run-id retry
after a failed write succeeds cleanly instead of dying on `EEXIST`.

## Second review round — 4 further P1s found at `e1d0376` and fixed

Greptile re-reviewed the corrected head and found four more defects. All are real; all
were reproduced before fixing.

| # | Finding | Root cause | Fix |
| --- | --- | --- | --- |
| G1/G4 | **`max_depth` skipped unrelated roots** — a deep root hitting the depth limit marked every later *disjoint* root `NOT_STARTED / GLOBAL_BOUND_EXHAUSTED`, even shallow ones well inside the limit | a **root-local** condition was written into **census-wide** truncation state | `walkRoot()` now returns a per-root truncation reason; only `max_entries` / `max_millis` are census-wide. A depth-limited root is `PARTIAL / max_depth` and the census continues. Reproduced: `DEEP=PARTIAL`, `SHALLOW` was wrongly `NOT_STARTED`; now `COMPLETE`. |
| G2 | **Sticky ancestor remained replaceable** — a sticky directory owned by a *foreign* principal was exempted | in a sticky directory an entry may be renamed by the entry's owner, **the directory's owner**, or root | sticky exemption is now ownership-qualified: exempt only when owner is the current uid or root; unknown ownership fails closed |
| G3 | **Marker-write failure poisoned retries** — if the run-marker write failed after `mkdir`, cleanup required the absent marker and stranded the directory, so every retry returned `STALE_TEMP_…` | cleanup was bound to the **marker file** | cleanup is now bound to the temp directory's **device+inode captured right after `mkdir`**. The marker remains as evidence but is not required to reclaim. |

Three regression tests (`G2`, `G3`, `G4`) pin these; `M7` and `M13` were updated to the
corrected semantics rather than left asserting the old behaviour.

### Third review round — 2 further Major findings at `6a2b01b`

| # | Finding | Fix |
| --- | --- | --- |
| G5 | **`run_id` allowed `.` and `..`** — `/^[A-Za-z0-9._-]+$/` accepted them, so `join(proofRoot, runId)` resolved to the proof root itself or its **parent**. Safety rested only on the incidental `existsSync` ordering, not on validation; any reordering would reopen a real path-traversal write. | Require a leading alphanumeric, reject `.`/`..` explicitly, and assert **explicit containment** of both `finalDir` and `tempDir` inside the proof root (`run_dir_escapes_proof_root`). |
| G6 | **Private roots leaked raw, unbounded extensions** through `extension_distribution` — a bespoke suffix (`.kdbx`, `.ovpn`, a proprietary tag) is an identifying signal that survives aggregation, contradicting the "fixed-vocabulary aggregates only" contract. Nothing verified distribution keys. | Private roots project extensions onto a **closed** `EXTENSION_VOCABULARY`; anything undeclared buckets to `other`. `verify()` now refuses a private root whose extension / size-bucket / mtime-bucket keys fall outside their declared vocabularies. Public roots still report the observed extension. |

This is the re-identification risk the PR explicitly asked reviewers to probe, and it was
real. Tests `G5` and `G6` pin both.

### Fourth review round — 1 further P1 at `ac242d9`

| # | Finding | Fix |
| --- | --- | --- |
| G7 | **Identity failure poisoned retries.** If `lstat(tempDir)` failed immediately after `mkdir`, `createdIdentity` stayed `null` and the writer carried on. Any later failure then could not authorise cleanup, so the directory was stranded and every same-run-id retry returned `STALE_TEMP_…`. | Without an identity the directory can never be proven ours, so the writer now refuses **before writing anything** and reclaims immediately. A **non-recursive** remove succeeds only on an empty directory, so a directory substituted underneath us is reported (`RECOVERABLE_TEMP_ARTIFACT_REQUIRES_HUMAN`) rather than destroyed. Test `G7`. |

**Cumulative: 10 real defects found and fixed across four review rounds** (3 + 4 + 2 + 1).

### 6. CI-red repair

The exact-head CI failure at `f47f4a5` was **this slice's own test**, not the
environment: `not ok 4793 - this slice changes no TASK-029…`. CI checks out at
fetch-depth 1, so `origin/main` does not resolve and `git diff origin/main...HEAD`
threw. The test now resolves a base ref if one exists and otherwise asserts against the
working tree, naming the scope it used. CI reported `# pass 7937 / # fail 1` — that one
failure was ours; the three failures seen locally are sandbox-only and do **not** occur
on CI.

## Gates

```bash
node --test tests/node00-three-root-census.test.js     # 48 tests
node scripts/review/node00-three-root-census-check.mjs --json
npm test
npm run check
git diff --check
```

## BLOCKED: `SECURE_PROOF_ROOT_UNAVAILABLE`

The corrected real census is **not run**. The newly-implemented Finding-A rule refuses
every durable location writable from this environment. Measured, not assumed:

| Path | mode | verdict |
| --- | --- | --- |
| `/` | `drwxr-xr-x` uid 65534 | admissible ancestor |
| `/data` | `drwxr-xr-x` uid 1000 | admissible ancestor — **but read-only to this process** |
| `/data/bizra` | `drwxrwxr-x` uid 1000 | **group-writable, non-sticky ⇒ refused** |
| `/data/bizra/proofs` | `drwxrwxr-x` | refused |
| `/data/bizra/proofs/node00-three-root-census-0b` | `drwxrwxr-x` | refused |
| session `$TMPDIR` (`/tmp` sticky → `/tmp/claude-1000` `drwx------` uid 1000) | — | permission-admissible but **ephemeral**, not a durable proof root |

`planProofOutput()` run against the real paths returns
`proof_root_itself_group_or_world_writable, proof_root_ancestor_group_writable` for
every durable candidate. After the G2 fix the session `$TMPDIR` is refused as well
(`/tmp` is sticky but owned by uid 65534, not by us or root), so **no** admissible proof
root exists in this environment at all. Creating a clean parent under `/data` is denied (read-only),
and changing permissions on shared directories is explicitly out of scope.

Per the corrective contract, no artifacts are written before a proof-root plan is
accepted. Consequently these remain **unproven**:

```text
DEMA_REPO_BOUND_TO_LEGACY_SUBJECT     BLOCKED (fixture-proven only)
REAL_NESTED_DELEGATION_EXERCISED      BLOCKED (fixture-proven only)
```

Delegation, ownership, privacy mode, scan states and writer refusals are all proven by
the 48 focused tests against synthetic trees. They are **not** proven against the real
three-root estate.

## Declared limits

- `PROOF_ROOT_PARENT_SUBSTITUTION_RESISTANCE: NOT_PROVEN_AGAINST_HOSTILE_CONCURRENT_MUTATOR`
  — no descriptor-relative (`openat2`-grade) containment.
- Independent authenticity is **not** proved: `verify()` is body-bound but has no
  external anchor, so a forger controlling every field and recomputing the hash is not
  detected. No launder-resistance is claimed.
- Reproducibility across a **live** root is not claimed; determinism is proven against a
  frozen snapshot.
- The legacy-checkout byte-identity test is bound **locally by measurement** and **in CI
  by mechanism** (the writer refuses any output inside a repository worktree; the kernel
  reaches no mutator). The absolute legacy path does not exist on CI, so a
  path-dependent assertion would be vacuous there.

## Authority correction register

```text
0A authority recommendation incorrectly stated C0+C1;
0B source implementation requires bounded C3.

Round 1 used a superseded private-per-entry design.
Round 1 substituted the implementation worktree for the required Dema subject.
Round 1 produced a useful prototype, NOT an admissible 0B qualification.

Round 1 removed one self-created scratch worktree without explicit deletion authority:
  AUTHORITY_PROCESS_DEVIATION
  NO_OPERATOR_DATA_AFFECTED
  MUST_NOT_REPEAT

Existing scanners (node0-space-index, buildLocalAssetInventory, sovereign_scan.py,
quick_scan.py) contributed VOCABULARY only. None is imported, executed or wrapped.
quick_scan.py symlink-following remains a founder-supplied, independently UNVERIFIED
concern — this slice neither reads nor executes it.

0A census artifacts are locally hash-bound at Level 3 from the independent audit
boundary. The original 0A package was NOT modified.
```

## Program sequencing

```yaml
next_capability_slice: MISSION-ENVELOPE-CANON-1A
mission_envelope_1a_eligible: false
unrelated_capability_expansion_allowed: false

maintenance_exceptions:
  - critical_security_repair
  - build_or_ci_integrity_repair
  - dependency_vulnerability_remediation
  - documentation_truth_correction
```

TASK-029, TASK-030 and TASK-032 remain outside this slice. PR #417 stays **draft**.
`NODE0_NOT_CLOSED`.
