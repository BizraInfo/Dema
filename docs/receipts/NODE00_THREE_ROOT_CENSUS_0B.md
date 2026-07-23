# Receipt: NODE00-THREE-ROOT-CENSUS-0B

Truth label: `NODE00_THREE_ROOT_CENSUS_MEASURED_REPO`

## Slice

Bounded three-root metadata census: most-specific-root ownership, privacy-preserving
portable evidence, and an external proof-root writer separate from the scanner.

```text
plan → admit roots → bounded walk → build → verify → tamper-reject → external write
```

## Base

Cut from the exact reviewed remote main, in an isolated worktree.

```text
Dema main (verified by API before mutation):  079fee557d7c230f2e6c076cc7a776418a393235
bizra-data-lake main (verified, read-only):   6a3c1427836ec0290e4ecb43bf23f55ee70912c2
branch:                                        feat/node00-three-root-census-0b
worktree:                                      /data/bizra/worktrees/node00-three-root-census-0b/Dema
```

The pre-existing dirty checkout on `chore/backlog-init-agent-instructions`
(`420a20c8c2836ad93673eef3c93316a63c243574`) was recorded as
`PRE_EXISTING_DIRTY_CHECKOUT / PRESERVED_UNMODIFIED / NOT_A_0B_INPUT` and verified
byte-identical after the bounded fetch (HEAD, porcelain, and sha256 of all four real
modified files unchanged). It was not merged, switched, cleaned, reset or stashed.

## Proof contract

The gate passes only while:

- the exact GO phrase matches byte-for-byte;
- root admission fails closed on missing / non-directory / symlink / symlink-ancestor
  / duplicate `device:inode` identity, and root identity is revalidated after
  traversal (`ROOT_SUBSTITUTED_DURING_SCAN` ⇒ never `COMPLETE`);
- ownership is most-specific-root: a parent reaching an admitted child root records
  `delegated_root` and does not descend; no `device:inode` is owned twice;
- symlinks are recorded and never resolved or descended; cross-device entries are
  recorded and never descended;
- unreadable and vanished entries remain explicit warnings, never silent omissions;
- any bound hit yields `BOUNDED_PARTIAL` with a named `truncation_reason`;
- topology is derived from admitted roots, never assumed;
- a `private` root — and any `public` root nested inside one — discloses no path or
  basename in body, entries, warnings or thrown errors;
- the payload is content-addressed and body-bound verified, invariant to root argument
  order, run id, timestamp, PID and temp path;
- the boundary stays all-false on the exact canonical key set (not vacuous).

## Measured runtime census

One real bounded census against the three authorized roots.

```text
run_dir:       /data/bizra/proofs/node00-three-root-census-0b/RUN-20260724-0B-1
content_hash:  sha256:b8d828847603d47f666b0cf9903d24fc18594f415e2f63c62ac9cc9960b74013
manifest_sha256: sha256:ade9ff78c3e2ca3df56821c8909182ef470c37d30cbe80be305078bbb834e5ea
completeness:  COMPLETE (truncation_reason: null)
wall clock:    7.71 s        max RSS: 1,831,400 kB
```

| Root | Visibility | Entries | Files | Dirs | Symlinks | Path emitted |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `DOWNLOADS` (`~/Downloads`) | private | 219,419 | 199,004 | 20,057 | 296 | **no** (hash only) |
| `DEMA_REPO` (0B worktree) | public | 2,364 | 2,169 | 195 | 0 | yes |
| `DATA_LAKE_REPO` (`/data/bizra/repos/bizra-data-lake`) | public | 404,691 | 368,939 | 35,672 | 80 | yes |
| **total** | | **626,474** | 570,112 | 55,924 | 376 | |

### Measured topology — not the assumed one

```text
containment: []            (none)
disjoint:    DATA_LAKE_REPO|DEMA_REPO, DATA_LAKE_REPO|DOWNLOADS, DEMA_REPO|DOWNLOADS
```

The pre-stated expectation was `DOWNLOADS contains DEMA_REPO`. **Measured: all three
roots are disjoint**, because `DEMA_REPO` for this run is the isolated 0B worktree
under `/data/bizra/worktrees/`, not the legacy checkout under `~/Downloads`. Published
as measured, not as expected. Devices: `~/Downloads` = 66310, `/data/bizra` = 66312.

Consequently `delegated_roots = 0` in this run — the delegation path is proven by the
review-gate fixture and tests (which model a public root nested inside a private one),
not by this particular topology.

### Terminal counters

```text
PRIVATE_FILENAMES_DISCLOSED = 0    (626,474 rows scanned; 0 DOWNLOADS rows carry
                                    relative_path or basename; 0 occurrences of the
                                    raw home path in any shipped artifact)
ASSET_CONTENT_BYTES_READ    = 0
SYMLINKS_FOLLOWED           = 0
MOUNT_BOUNDARIES_CROSSED    = 0
SCANNED_ROOT_MUTATION       = 0    (see below)
DEMA_HOME_WRITES            = 0
NESTED_ROOT_DOUBLE_COUNT    = 0
```

### Zero-mutation evidence

Pre/post `find -xdev -printf '%i %s %T@ %y' | sort | sha256sum` around a dedicated
census run:

| Root | Pre = Post |
| --- | --- |
| `DEMA_REPO` | identical |
| `DATA_LAKE_REPO` | identical |
| `DOWNLOADS` | **drifted** |

The `DOWNLOADS` drift is **external, not caused by this slice**. A concurrent browser
process was writing PNG attachments into `~/Downloads/chatgpt-attachments/` during the
window (timestamps interleave the run). Corroboration: a second census 5 s later
returned `DEMA_REPO` 2,364 and `DATA_LAKE_REPO` 404,691 — byte-identical per-root
records — while `DOWNLOADS` moved 219,419 → 219,435 (+16). The kernel reaches no
mutating API (asserted on comment-stripped source), and every writer mutation is
routed through the injected fs to a proof-root path (asserted on comment-stripped
source).

**Therefore: reproducibility across a LIVE root is NOT claimed.** Determinism is
proven against a frozen metadata snapshot (tests), and holds on quiescent roots
(measured).

## Discovery: the canonical 1024-element array cap

The first real run failed closed, which is the correct behaviour of the canon package
and a genuine design finding:

```text
CanonicalJsonV1Error: array_length_exceeded: array length 626461 exceeds 1024 at $
  at buildNode00ThreeRootCensusPayload (node00-three-root-census.js)
```

`bizra.canonical-json.v1` caps a single array at 1024 elements. Collections are now
digested by a chunked Merkle fold (`foldDigest`, width 512) that uses the one canonical
contract at every level and binds both row order and row count. Pinned by two tests,
including a 2,500-entry census that builds, verifies and stays deterministic.

## Privacy finding caught by the tests

The first implementation emitted an absolute path for every `public` root. A public
root nested inside a private root therefore disclosed the private root's path as its
own prefix (`/fx/downloads/Dema` reveals `/fx/downloads`). Fixed structurally: a public
root that any private root contains withholds its path, and `verify()` refuses a
manifest that re-discloses it (`nested_root_discloses_private_parent_path`).

## Gates

```bash
node --test tests/node00-three-root-census.test.js     # 46 tests
node scripts/review/node00-three-root-census-check.mjs --json
npm test
npm run check
git diff --check
```

## 0A correction register

```text
0A authority recommendation incorrectly stated C0+C1;
0B source implementation requires bounded C3.

Existing scanners (node0-space-index, buildLocalAssetInventory, sovereign_scan.py,
quick_scan.py) contributed VOCABULARY and lessons only. None is imported, executed or
wrapped — node0-space-index carries an fs surface including mkdir/writeFile/rename/
chmod/createReadStream, which must not be reachable from this slice, so its
extension/category vocabulary is deliberately re-declared here instead.

quick_scan.py symlink-following concern was supplied by founder audit, not
independently verified during 0A. It remains unverified here: this slice neither reads
nor executes quick_scan.py.

0A census artifacts are locally hash-bound at Level 3 from the independent audit
boundary. The original 0A package was NOT modified.
```

## Declared limits

- `PROOF_ROOT_PARENT_SUBSTITUTION_RESISTANCE: NOT_PROVEN_AGAINST_HOSTILE_CONCURRENT_MUTATOR`
  — no descriptor-relative (`openat2`-grade) containment.
- Independent authenticity is **not** proved: `verify()` is body-bound but has no
  external anchor, so a forger controlling every field and recomputing the hash is not
  detected. No launder-resistance is claimed.
- Test #8 of the mandated list (legacy checkout byte-for-byte untouched) is bound
  **locally by measurement** (recorded above), and **in CI by mechanism** — the writer
  refuses any output inside a repository worktree, and the kernel reaches no mutator.
  The absolute legacy path does not exist on CI, so a path-dependent assertion would
  be vacuous there; that is stated rather than faked.

## Program sequencing

```yaml
next_capability_slice: MISSION-ENVELOPE-CANON-1A
unrelated_capability_expansion_allowed: false

maintenance_exceptions:
  - critical_security_repair
  - build_or_ci_integrity_repair
  - dependency_vulnerability_remediation
  - documentation_truth_correction

exception_requirements:
  - explicit classification
  - isolated worktree and branch
  - bounded scope
  - separate receipt
```

TASK-029, TASK-030 and TASK-032 remain outside this slice. `NODE0_NOT_CLOSED`.
