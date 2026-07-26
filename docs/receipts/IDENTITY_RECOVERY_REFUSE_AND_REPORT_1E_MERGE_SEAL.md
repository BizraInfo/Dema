# IDENTITY-RECOVERY-REFUSE-AND-REPORT-1E — MERGE SEAL

Documentation-only proof seal for the merge of PR #415. No production code,
tests, or dependencies change in this slice. This receipt makes the merge
proof durable on `main` rather than depending on a feature branch's survival.

## Bound facts

```text
repository:            BizraInfo/Dema
merged PR:             #415
reviewed head:         2e99304d4681c3a802a68c786bd5480612204393
merge commit on main:  22641212bc44c4ddc01e736238490e35f69adffb
base at merge:         a1b4558770031cdc8abbdb768a7c297638947467
merge method:          squash (repo convention) · sha-guarded · no force push
merged_at:             2026-07-23T19:34:05Z
merged_by:             BizraInfo
```

## Post-merge workflow runs on `22641212` (independently checkable by run id)

```text
run_id 89312346163  Analyze (JavaScript) (javascript)   success
run_id 89312346271  scan                                success
run_id 89312346664  test (20.x)                         success
run_id 89312346673  test (22.x)                         success
run_id 89312346972  proof-quality                       success
run_id 89312356114  Socket Security: Project Report     success
run_id 89314793539  aggregate                           success
```

7/7 SUCCESS. Retrievable at
`GET /repos/BizraInfo/Dema/commits/22641212bc44c4ddc01e736238490e35f69adffb/check-runs`.

## Exact-head review verdict

```text
Greptile exact-head check-run (on 2e99304):  success
Greptile exact-head report (verified):       "8 files reviewed, 0 comments added"
open code-scanning alerts at authorization:  0
Greptile findings across all 7 rounds:       8 (each replied + fixed at root)
Greptile findings unaddressed after 1E.6:    0
live P0 / P1 / P2 at authorization:          0 / 0 / 0
```

Verification note (no ZANN): the founder independently reported Greptile
confidence **5/5 / appears safe to merge**. Through this session's connector I
verified the substantive equivalent — the Greptile exact-head check-run
`conclusion: success` with report text *"8 files reviewed, 0 comments added"*
and zero unaddressed findings — but did not retrieve a numeric "5/5" field.
The 5/5 figure is recorded as **FOUNDER-REPORTED**, the 0-comments report as
**CONNECTOR-VERIFIED**.

## Disclosed review limitation

```text
CodeRabbit:  REVIEW_NOT_RE_EXECUTED_AT_EXACT_HEAD
```

CodeRabbit's substantive APPROVED binds to an earlier head (`5878ec2`); its
incremental engine declined to re-review the later exact head `2e99304`, and
an explicit full-review request drew no exact-head response. This is a tooling
limitation and is NOT represented as exact-head approval. Merge admissibility
rested on the clean exact-head Greptile execution + all repository gates +
explicit founder consent — never on CodeRabbit's stale approval.

## Founder consent

Consent was explicit and named the exact reviewed head:
`GO — PROMOTE AND MERGE PR #415 ONLY`, authorized head
`2e99304d4681c3a802a68c786bd5480612204393`. Seven preconditions were
independently verified immediately before mutation (OPEN/DRAFT/unmerged;
remote head == reviewed head via API + `ls-remote`; base `main` @ `a1b4558`
mergeable-clean; 9/9 exact-head workflows success; Greptile exact-head report
clean with all findings addressed; nothing new after the clean verdict; real
signer untouched). The merge used GitHub's `sha` guard so a drifted head would
have been rejected as `MERGE_AUTHORITY_INVALIDATED`.

## What was merged

The seven-round convergence, all fixed at root, all red-first:

1. automatic authority-recovery mutation **removed** (quarantine rejected);
2. refuse-and-report behavior (detect + diagnose only; C5 for mutation);
3. path-claim redaction (rejected `generation_path` → hash + trust state);
4. static-gate syntax completeness or fail-closed;
5. lineage-claim redaction (rejected `previous_generation` → hash);
6. single-snapshot verification (no TOCTOU re-read; shared `verifyPointerDoc`);
7. verified-authority precedence over lease liveness **and** verified-
   fingerprint-only artifact scanning (rejected fingerprint → `UNTRUSTED_CLAIM`,
   `artifact_binding_state: UNKNOWN`).

## Non-claims (unchanged, reaffirmed)

```text
real signer:                    UNTOUCHED (~/.dema/keys never resolved)
identity recovery:              NOT executed
signer rotation:                NOT performed
DEMA active-bounded activation: NOT performed
URP-Local activation:           NOT performed
federation / wallet / token / PoI: NOT performed
Node0:                          NOT closed
```

This seals 1E's read-only recovery foundation. It does NOT authorize
IDENTITY-EXPLICIT-RECOVERY-TRANSACTION-1F or any real root-of-trust mutation,
which remain gated on C5 and a separately reviewed design.

## Provenance note

An earlier local-only commit (`856662d`, on the preserved feature branch,
never pushed) held a draft of this seal inside the main 1E receipt. This file
is the canonical, remote-landed seal; do not cite `856662d` as remotely
preserved.
