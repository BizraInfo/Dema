# IDENTITY-RECOVERY-REFUSE-AND-REPORT-1E — refuse-and-report receipt

- **Date:** 2026-07-23 (GST)
- **Branch:** `fix/identity-recovery-refuse-report-1e` off exact `origin/main`
  `a1b4558770031cdc8abbdb768a7c297638947467` (verified live via `ls-remote`
  before branch creation; record BASE_MOVED if main differs at push time)
- **Implementation commit:** `c9e1fc8` (exact head recorded in the PR body at
  push time; this receipt lands in the sealing commit on top of it)
- **Truth label:** LOCAL_ONLY · not remotely re-verified
- **Supersedes:** the automatic-quarantine design of PR #414
  (`fix/identity-committed-transition-recovery-1d`, head `faa3ad6`), closed
  without merge.

## Founder decision (final)

```text
AUTO_QUARANTINE:
REJECTED

AUTOMATIC ROOT-OF-TRUST RECOVERY:
REMOVED

AUTOMATIC RECOVERY BEHAVIOR:
DETECT_AND_REPORT_ONLY

MUTATING RECOVERY:
NOT IMPLEMENTED

FUTURE MUTATING SLICE:
IDENTITY-EXPLICIT-RECOVERY-TRANSACTION-1F

REQUIRED FUTURE AUTHORITY:
C5
```

PR #414 proved experimentally that automatic quarantine creates unacceptable
root-of-trust mutation complexity — its final Greptile verdict (bound to exact
head `faa3ad6`, 2026-07-23T16:01Z) was a live P1: a concurrently substituted
`$DEMA_HOME/keys` parent lets the quarantine `rename()` move attacker-selected
paths. The architectural response is not another patch round: automatic
recovery mutation is removed entirely.

## Governing invariant

```text
Detection may be automatic.
Diagnosis may be automatic.
Evidence preservation may be passive and read-only.
Root-of-trust recovery mutation requires a separate,
explicitly consented C5 transaction.
```

## Removed automatic-mutation inventory (never landed on this branch)

Rejected from PR #414 (not salvaged): `quarantineActivePointer`,
`attemptGenesisRecovery`, automatic pointer rename/removal, automatic
reinitialization after corruption, automatic remigration after pointer
failure, post-verify-failure quarantine in init and migrate,
`recovered_from`/`quarantine_path` result fields, and receipt-scanning used to
decide whether automatic replacement is safe.

Removed from pre-1E main behavior: `initAuthorshipKey`'s presence-only pointer
check let a **symlinked or non-regular invalid pointer** fall through to
`activateGeneration`, which silently REPLACED the pointer (reproduced red:
R4 snapshot mismatch; R5 `EISDIR` after a keypair + generation had already
been written). Both paths now refuse read-only with zero mutation.

## Salvaged read-only components (re-derived, not cherry-picked)

Pointer-classification concept (valid / absent / genesis-strand /
prior-strand / untracked), typed recovery classes, `verified_existing_identity`
on the valid-identity refusal, failure reproductions, and zero-mutation
assertions — all reimplemented from first principles against exact main.

## Recovery classification contract

`classifyPointerAuthority` (internal, read-only) + `inspectIdentityRecovery`
(exported) map a home to exactly one of:

```text
NO_ACTIVE_IDENTITY · VALID_ACTIVE_IDENTITY · INVALID_GENESIS_POINTER ·
INVALID_PRIOR_POINTER · UNTRACKED_INVALID_POINTER · UNSAFE_POINTER_PATH ·
CORRUPT_GENERATION · RETIRED_GENERATION · IDENTITY_TRANSITION_IN_PROGRESS ·
RECOVERY_STATE_UNKNOWN
```

Classification uses the canonical loader, preserves its exact error, follows
no unsafe symlink, reads no private-key content outside the approved loader,
mutates nothing, never infers "unused identity" from missing receipts, and
reports `RECOVERY_STATE_UNKNOWN` (e.g. unreadable retired registry, mid-read
vanish) rather than guessing. An unreadable registry is UNKNOWN — not
"retired", not "serviceable".

Behavior contracts (all envelopes carry `authority_delta: 0`):

- init + valid identity → `key_already_exists` + `verified_existing_identity:true`
- init + invalid identity → `recovery_required` + exact `recovery_class` +
  `recommended_action: RUN_EXPLICIT_IDENTITY_RECOVERY` +
  `active_pointer_preserved · generation_preserved · new_identity_generated:false`
- init post-commit verification failure → `recovery_required` +
  `transition_state: pointer_committed_verification_failed` + preserved flags;
  retries return a stable classification and never generate a second keypair
- migrate + valid identity → `already_migrated` + `verified_existing_identity:true`
- migrate + invalid identity → `recovery_required` + `recovery_class` +
  `legacy_pair_preserved · active_pointer_preserved`; never remigrates, never
  overwrites a concurrent identity (re-classified under the lease)
- metadata repair remains ONLY inside explicitly consented ordinary migration
  whose active authority state is absent — never as recovery of an invalid
  pointer (R16: malformed metadata bytes preserved, no `.recovery` sibling)

## Recovery-inspector schema

`inspectIdentityRecovery(demaHome)` → `bizra.dema.identity_recovery_inspection.v0.1`:
`recovery_class`, `active_pointer_path`, `active_pointer_hash`,
`generation_fingerprint`, `generation_path`, `loader_error`,
`previous_generation`, `legacy_pair_presence`, `artifact_binding_state`
(`DETECTED` / `NOT_DETECTED_BOUNDED_SCAN` / `UNKNOWN` — bounded 512-entry
read-only scan; any incompleteness is `UNKNOWN`, never a definitive non-use),
`transition_lease_state` (`NONE`/`HOLDER_ALIVE`/`HOLDER_DEAD`/`UNREADABLE`),
`automatic_recovery_allowed: false`, `required_consent_class: "C5"`,
`recommended_action`, `authority_delta: 0`. Never returns PEM, raw key bytes,
secret material, or receipt contents (R17 asserts serialized output).

## Zero-mutation proof

Runtime: every invalid-identity scenario snapshots the ENTIRE `DEMA_HOME`
tree (kind + content hash + symlink target per entry) before the call and
asserts byte-identical equality after (R1–R7, R11–R16).

Structural: `scripts/review/identity-recovery-refuse-report-check.mjs`
(wired into `scripts/check.mjs`) fails when (1) any forbidden quarantine
symbol reappears in `packages/`/`apps/`, (2) any authority-mutating function
(`rename`/`unlink`/`mkdir`/`writeFile`/`generateEd25519Keypair`/
`activateGeneration`/`writeActivePointer`/`repairGenerationMetadata`/… or
write-mode `open` flags) becomes REACHABLE from the read-only surface via
function-dependency reachability (not line/text position), or (3) init/migrate
stop routing invalid pointers through the classifier. Verified red on
synthetic quarantine-shaped source.

## Red-first reproductions

Suite `tests/identity-recovery-refuse-report.test.js` was written first and
run against unmodified main: **29 of 31 tests failed** for the mandated
reasons — missing `inspectIdentityRecovery` (12), missing refuse-and-report
envelopes, and the live replacement defect (R4 snapshot mismatch; R5 `EISDIR`
mid-replacement). R14/R15 passed on main only because a coincident legacy-file
early-return masked those two paths; they remain as guards.

## Test results (local, sandbox)

```text
1E suite:                        32/32 green (R1–R21 + R4b + §10 contract + gate)
identity + authorship suites:    164/164 green (9 suites)
npm test:                        7855/7859 — 4 failures, ALL reproduced at
                                 clean base a1b4558 in this sandbox and green
                                 on CI: EROFS preflight (masked known-env),
                                 homebase human-summary, urp-proof artifact
                                 scan, self-check report scan → classified
                                 SANDBOX-ENVIRONMENTAL, zero new failures
npm run coverage:                95.36 L / 84.35 B / 97.75 F ≥ 95/84/95
                                 (authorship-key-store.js 85.87 B)
claim corpus gate:               current=122 baseline=122 new=0 dangling=0
kernel purity · ipc gate · actuator · integration check · llm:guidance ·
git diff --check:                exit 0
npm run check:                   gates 0–120 pass (incl. the new 1E gate at
                                 position 24); stops at gate 121 (isolated
                                 full-TAP re-run) on the SAME 3 sandbox-
                                 environmental failures — the known sandbox
                                 stop point (1D receipt records identical
                                 behavior); trusted-environment verdict is CI
```

## Unresolved limitations

- R21 proves no env-fallback via HOME/DEMA_HOME canaries and explicit-path
  containment; it does not interpose syscalls, so it cannot prove a negative
  over the whole process — the static gate + loader containment carry the rest.
- The static gate's function extraction is brace-matching over the module's
  declaration-only style, not a full parser (no AST dependency exists in the
  tree); reachability is at function granularity.
- `artifact_binding_state` scans only flat regular files under
  `$DEMA_HOME/receipts` (bound 512); anything else is `UNKNOWN` by design.
- The three sandbox-environmental npm-test failures are classified, not fixed;
  they fail identically on unmodified base and pass on CI.

## Review round 1E.1 — Greptile exact-head `58c543f` (IDENTITY-RECOVERY-REPORT-INTEGRITY-1E.1)

```text
REVIEW ROUND:
Greptile exact-head 58c543f (2026-07-23T17:14Z, live inline findings)

FINDING A:
untrusted generation path escaped diagnostic containment

FINDING B:
static function-reachability parser was declaration-incomplete

STATUS:
reproduced (red-first) · FIXED
```

Neither finding is authority mutation — no mutation occurred. Both are
refuse-and-report integrity defects: the first promoted an
attacker-controlled pointer claim into authoritative diagnostics
(evidence laundering); the second let the zero-mutation gate claim complete
reachability over syntax it did not parse.

**Finding A fix — path-trust containment.** `inspectIdentityRecovery` never
republishes a `generation_path` from a pointer the canonical loader rejected.
New contract: `generation_path` is non-null ONLY with
`generation_path_state: "VERIFIED_CONTAINED"`, sourced exclusively from the
loader's own containment-checked result. A rejected/escaping/traversal/
mismatched claim yields `generation_path: null`,
`generation_path_state: "UNTRUSTED_OR_UNCONTAINED"`, and
`pointer_claimed_generation_path_hash: sha256(<raw claim>)` — the raw
attacker-controlled path appears nowhere in the envelope. No usable claim →
`"ABSENT"` (unknown, absent, and rejected are never collapsed). Red-first
tests A1–A8: absolute-external, `../` traversal, normalize-outside,
symlink-escape, and mismatched-fingerprint claims are all withheld
(marker-string absence asserted on the full serialized envelope); valid
identity returns `VERIFIED_CONTAINED`.

**Finding B fix — syntax-complete-or-fail-closed gate.** The repository has
zero direct dependencies (verified in `package.json`), so no approved AST
parser exists and adding one would expand supply-chain scope — the sanctioned
fallback applies. The extractor now attributes: named/async function
declarations, `const/let/var`-assigned arrow functions (block and expression
bodies) and function expressions, and class declarations (whole class body
reachable via the class name). Reachability edges are BARE identifier
references over comment/string-stripped bodies (callback-passed helpers stay
in the graph; over-connection is fail-safe). Any callable syntax left in the
residual (object-literal methods at top level, paren-free arrows,
comma-expression arrows, …) fails the gate as `unsupported_callable_form` —
the gate never silently ignores a form it cannot parse. Red-first tests
B9–B15: arrow / function-expression / object-method / class-method /
multi-hop mutator helpers all detected; clean read-only graph passes;
unsupported syntax fails closed.

Also closed in this round: CodeQL alert 350 (`js/file-system-race`, HIGH —
test snapshot helper now reads through an `O_NOFOLLOW` descriptor classified
by `fstat` on the OPEN fd, no check-then-use) and alert 351 + CodeRabbit
minor (unused `loadActiveKeyPair` binding removed).

Round qualification: 1E suite 47/47 · identity/authorship/regression suites
162/162 · corpus gate green · full npm test/coverage re-run recorded in the
PR body at the new head.

**Second Greptile pass (exact head `5878ec2`, 2026-07-23T17:32Z) — two
narrower live findings, both fixed red-first in the same responsibility:**

- **Finding C — untrusted `previous_generation` exposed:** the inspector
  copied a rejected pointer doc's `previous_generation` verbatim, re-opening
  the same laundering channel `generation_path` had closed. Now published
  ONLY in canonical 64-hex fingerprint shape; any path-like or malformed
  claim is withheld (`null`), with the full raw doc still hash-bound via
  `active_pointer_hash` (tests A9–A10).
- **Finding D — getter/generator/computed-name methods bypassed the residual
  scan:** the enumerated method-shorthand regex is replaced by a catch-all —
  ANY `) {` (paren-close brace-open) in the unattributed residual fails
  closed as `paren_brace_callable_form`, subsuming shorthand, accessors,
  generators, computed names, and forms not yet imagined. The guarded module
  keeps no top-level control flow, so the catch-all cannot false-positive
  there (tests B16–B18).
- **CodeQL 352 (HIGH js/file-system-race, second instance):** the snapshot
  walker's remaining `lstat→readlink` check-then-use removed — readlink IS
  the symlink probe; everything else classifies via `fstat` on an
  `O_NOFOLLOW` descriptor. No path re-check after a path check anywhere.

**Third Greptile pass (exact head `613b93a`, 2026-07-23T17:44Z) — one live
finding, fixed red-first (1E.3):**

- **Finding E — unverified prior generation published:** a shape-valid 64-hex
  `previous_generation` from a loader-REJECTED doc is still an unverified,
  attacker-influencable lineage claim — shape validity is not trust, and an
  explicit C5 recovery could be steered by it. Now `previous_generation` is
  published ONLY from a loader-ACCEPTED pointer (the same bytes bound by
  `active_pointer_hash`); a rejected doc's claim is represented solely by
  `pointer_claimed_previous_generation_hash`. Genesis-vs-prior diagnosis
  remains in `recovery_class`, which derives from claim PRESENCE, not the
  claim's value (tests A9–A11 + updated §10 contract). CI on `613b93a`
  settled 9/9 SUCCESS including CodeQL (alerts 350/351/352 all closed).

**Fourth Greptile pass (exact head `c1e0572`, 2026-07-23T17:54Z) — one live
finding, fixed red-first (1E.4):**

- **Finding F — unvalidated pointer snapshot publishes lineage (TOCTOU):**
  the inspector re-read `active-key.json` after classification; a swap
  between the loader's validated read and that second read could substitute
  bytes the loader never accepted, whose lineage would then be published
  under a VALID classification. Fixed at the root: the inspector performs
  **no pointer read of its own**. `loadActiveKeyPair` now carries
  `previous_generation` from its single accepted snapshot; the classifier
  passes through the loader's fingerprint, containment-verified path,
  lineage, and pointer hash for VALID, and its own one diagnostic read
  (`readActivePointer` raw + doc) supplies every claim and claim-hash for
  rejected states. Structural test A13 asserts the inspector body contains
  no `readFileNoFollow`/`JSON.parse`; A12 proves the loader carries the
  accepted lineage; behavioral coherence asserts the published hash equals
  the loader's `active_pointer_hash`.

**Fifth Greptile pass (exact head `bbabc5d`, 2026-07-23T18:05Z) — one live
finding, fixed red-first (1E.5):**

- **Finding G — mixed pointer snapshots in report:** the classifier called
  `loadActiveKeyPair` (its own internal pointer read) and then
  `readActivePointer` again — a concurrent swap between the two could pair
  snapshot-1's loader error with snapshot-2's claims and hash. Fixed at the
  root: the loader's post-read verification is extracted into a shared
  `verifyPointerDoc(ap, doc, raw)`; `loadActiveKeyPair` and
  `classifyPointerAuthority` each perform exactly ONE `readActivePointer`
  and verify that same snapshot through it. Verdict, claims, claim-hashes,
  and the trusted VALID facts all derive from a single snapshot. Structural
  test A14 pins the classifier body to zero `loadActiveKeyPair` references
  and exactly one `readActivePointer` call.

**Round 1E.6 (founder audit on exact head `fc77903`) — two evidence-trust
findings, both fixed red-first:**

```text
IDENTITY-RECOVERY-REPORT-INTEGRITY-1E.6

FINDING H:
lease and pointer observations could be mixed so stale lease liveness
overrode a canonically valid active identity (any lease presence — including
HOLDER_DEAD and UNREADABLE — forced IDENTITY_TRANSITION_IN_PROGRESS)

FINDING I:
a loader-rejected doc's generation_fingerprint (schema-valid but unverified)
was published as evidence AND used to drive the receipts binding scan

CLASS:
diagnostic snapshot incoherence · authority-precedence violation ·
diagnostic evidence laundering — NOT authority mutation

LAW:
verified pointer authority outranks lease liveness;
only a live holder means transition-in-progress;
a rejected fingerprint claim is hash-bound, never scanned

STATUS:
reproduced red-first (13 failing tests) · FIXED
```

Decision matrix now enforced: a canonically valid identity always reports
`VALID_ACTIVE_IDENTITY` / action `NONE` regardless of lease state (the lease
stays observable in `transition_lease_state`); only `HOLDER_ALIVE` + non-valid
pointer yields `IDENTITY_TRANSITION_IN_PROGRESS` / `RETRY_AFTER_TRANSITION`;
`HOLDER_DEAD`/`UNREADABLE` preserve the exact pointer class with
`RUN_EXPLICIT_IDENTITY_RECOVERY`; empty home + no lease recommends
initialization. Fingerprint contract: `generation_fingerprint` non-null only
as `VERIFIED` (loader-sourced); rejected claims yield
`pointer_claimed_generation_fingerprint_hash` + `UNTRUSTED_CLAIM`; the
artifact scan runs ONLY against a verified fingerprint — every non-valid
state reports `artifact_binding_state: UNKNOWN` (canary-receipt test proves a
planted receipt cannot force `DETECTED` through a rejected claim).

Tests L1–L7 (authority precedence incl. the completed-transition race replay)
+ F1–F5 (fingerprint containment) + rewritten lease/§10/R18 expectations.

CodeRabbit classification (truthful): APPROVED was recorded at `5878ec2`;
later triggers returned "incremental — does not re-review reviewed commits".
That is NOT exact-head substantive review → classified
`REVIEW_NOT_RE_EXECUTED_AT_EXACT_HEAD` until a fresh pass reviews the final
head.

## Non-claims

```text
real signer untouched (~/.dema/keys never resolved, read, or written)
no identity recovery performed
no signer rotation
no automatic self-healing claimed
no DEMA active-bounded proof
no URP-Local live proof
Node0 not closed
```
