---
id: TASK-038
title: >-
  SECRET-PATTERN-FALSE-POSITIVE-1A: gate 35 fails closed on the word
  task-finalization
status: In Progress
assignee:
  - '@claude'
created_date: '2026-07-28 06:24'
updated_date: '2026-07-28 06:32'
labels:
  - ci
  - gates
  - claim-discipline
dependencies: []
references:
  - scripts/review/repo-claude-config-check.mjs
  - scripts/check.mjs
  - .claude/agents/project-manager-backlog.md
  - docs/TESTING.md
priority: high
type: bug
ordinal: 38000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`scripts/review/repo-claude-config-check.mjs` fails closed on a FALSE POSITIVE, and because it is gate 35 of `npm run check` (registered at `scripts/check.mjs:57`), every gate after it goes unverified on any branch carrying the trigger.

## The trigger is prose, not a credential

`SECRET_PATTERN` at `scripts/review/repo-claude-config-check.mjs:25`:

    /GITHUB_TOKEN|OPENAI_API_KEY|ANTHROPIC_API_KEY|PRIVATE KEY|ghp_[A-Za-z0-9]|sk-[A-Za-z0-9]{10}/i

The `sk-[A-Za-z0-9]{10}` alternative has no left boundary. `.claude/agents/project-manager-backlog.md:17` contains the ordinary sentence:

    - `backlog instructions task-finalization` before checking acceptance criteria, ...

`ta**sk-finalizati**on` matches. Measured with the real pattern — the match is the literal string `"sk-finalizati"`. The same class also fires on `risk-management` and `disk-utilization` (verified true); `task-execution` and `task-creation` happen to fall one character short, which is why this went unnoticed.

There is no credential anywhere in the file. The flagged text is the correct name of a real `backlog` subcommand, so rewording the doc would make it wrong — the gate is what is defective.

## Blast radius, measured

- BRANCH-LOCAL, not repo-wide. `main` does not carry `.claude/agents/project-manager-backlog.md` at all, and no tracked `.claude/` file on `main` trips the pattern, so CI on `main` is not red from this gate.
- The line arrived in `9289574`, tip of `chore/backlog-init-agent-instructions`, and is inherited by anything branched from it (including `fix/doctor-first-run-truth-1a`).
- The gate runs in CI via `.github/workflows/check.yml:30` and `.github/workflows/bizra-review.yml:35`, so any PR from an affected branch is red on `check` and blind on every gate after 35.

## Why it shipped

The gate has NO test file — `tests/` contains nothing for `repo-claude-config-check`. It is registered in `scripts/check.mjs` and documented at `docs/TESTING.md:592`, but its predicates are never exercised, so neither the false positive nor a future true-negative regression would be caught.

## Same defect class as TASK-036

TASK-036 defect 2 was a naive substring match (`findings.includes("not connected")`) producing a false claim about gateway reachability. This is the same shape one layer up: an unanchored substring producing a false claim about secrets. Worth fixing with the same discipline — assert on structure, not on incidental character sequences.

## Note on shape

The script is currently a flat top-level module with side effects (`readFileSync`, `spawnSync`, `process.exit`), so `SECRET_PATTERN` cannot be imported for testing without executing the whole gate. Closing this properly means extracting the predicate as a pure function first, per the repo's own `pure kernel -> gatherer -> CLI wrapper -> tests` convention. That extraction, not the regex character, is the bulk of the work.

GATE EDIT — requires explicit operator GO before implementation. Narrowing a secret-detection pattern reduces detection surface even when it only removes false positives, so it must not be done autonomously.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The unanchored sk- alternative in SECRET_PATTERN no longer matches a mid-word occurrence: task-finalization, risk-management and disk-utilization all pass
- [x] #2 A real key shape still fails the gate — assert on sk-proj- and sk-ant- style tokens at a token boundary, plus ghp_, GITHUB_TOKEN, OPENAI_API_KEY, ANTHROPIC_API_KEY and PRIVATE KEY, so the narrowing is proven not to be a weakening
- [x] #3 The secret predicate is extracted as a pure importable function so it can be tested without executing the gate, per the repo pure-kernel convention
- [x] #4 A new tracked test file covers the predicate red-first and is registered in docs/TESTING.md
- [ ] #5 node scripts/review/repo-claude-config-check.mjs exits 0 on chore/backlog-init-agent-instructions, and npm run check proceeds past gate 35 so the gates after it are actually verified
- [x] #6 No entry is added to any KNOWN_MASKABLE or allowlist — the fix corrects the pattern, it does not mask the failure
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extract the predicate into a NEW sibling module scripts/review/secret-pattern.js exporting SECRET_PATTERN + hasSecretPattern(text). Precedent: scripts/review/kernel-purity-allowlist.js is already an importable sibling of kernel-purity-check.mjs. This avoids restructuring the gate body (readFileSync/spawnSync/execFileSync/process.exit at top level) — a no-test gate is the wrong place for a large refactor, and a sibling module satisfies "importable without executing the gate" with a minimal diff.
2. Move the pattern across UNCHANGED first, so the gate stays red in exactly the same way. Pure code motion, no behaviour change.
3. RED: tests/repo-claude-secret-pattern.test.js asserts task-finalization / risk-management / disk-utilization do NOT match, and that real shapes DO. Must fail against the moved buggy pattern — proving the test transports the actual defect, not a control.
4. GREEN: add a negative lookbehind (?<![A-Za-z0-9]) to BOTH unanchored alternatives, sk- and ghp_. Same defect class; fixing only the one that happened to fire would leave the sibling live.
5. Prove not-a-weakening: same test asserts sk-proj-, sk-ant-api03-, ghp_, GITHUB_TOKEN, OPENAI_API_KEY, ANTHROPIC_API_KEY, PRIVATE KEY still match, including at token boundaries like =, quote and line start.
6. Register the test in docs/TESTING.md (integration-check only sees tracked, registered tests).
7. Verify: node scripts/review/repo-claude-config-check.mjs exits 0; npm run check proceeds PAST gate 35 so the later gates are actually exercised; npm test failure-name set unchanged vs the base measured for TASK-036.
8. No KNOWN_MASKABLE entry, no allowlist entry — correct the pattern, never mask the failure.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
VERIFIED 2026-07-28. Implemented under operator GO.

## The gate was wrong in BOTH directions

The false positive was the reported symptom. Writing the true-positive half of the test — the half AC2 exists to force — exposed a worse defect underneath, which was RED before the fix:

`sk-[A-Za-z0-9]{10}` demanded ten CONSECUTIVE alphanumerics immediately after `sk-`. Every modern key is segmented: `sk-proj-…`, `sk-ant-api03-…`. The hyphen inside the first ten characters broke the match, so **the gate never detected an OpenAI project key or an Anthropic key at all.** The shapes most worth catching were the ones it silently let through. That is a false NEGATIVE in a secret-detection gate, and it had been live for as long as the pattern has existed.

So this was not "a regex needs a word boundary". It was an untested predicate that both cried wolf on prose and slept through real credentials.

## Change

- NEW `scripts/review/secret-pattern.js` — pure, no fs/network/process/clock/random. Exports `SECRET_PATTERN` and `hasSecretPattern(text)`. Sibling-module precedent: `scripts/review/kernel-purity-allowlist.js`. Chosen over restructuring the gate body (top-level `readFileSync`/`spawnSync`/`execFileSync`/`process.exit`) because a gate with zero tests is the wrong place for a large refactor.
- `scripts/review/repo-claude-config-check.mjs` — imports the predicate, local const deleted, call site swapped. Code motion was verified behaviour-neutral first: the gate still failed with the byte-identical message before the pattern was touched.
- Pattern now: `(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{10,}` and `(?<![A-Za-z0-9])ghp_[A-Za-z0-9]`. Left boundary kills the prose matches (real keys always start a token); `_-` in the body admits segmented keys. `ghp_` keeps its single-character tail deliberately — no prose contains `ghp_`, so raising its minimum length would narrow detection for nothing. Both unanchored alternatives were fixed, not just the one that happened to fire.
- NEW `tests/repo-claude-secret-pattern.test.js` — 24 tests, both directions.
- `docs/TESTING.md` — registered the new test file.

## Red-first evidence

16 of 24 failed against the moved-but-unfixed pattern, and the failure set itself was the finding: 6 false-positive assertions failed as predicted, and 10 true-positive assertions ALSO failed, which is how the false negative surfaced. `matched: "sk-finalizati"` printed from the real gate line verbatim. After the fix: 24 pass / 0 fail.

## Gate results

- `node scripts/review/repo-claude-config-check.mjs`: exit 0, `no_secret_patterns_tracked` PASS, 31 tracked `.claude` files, 0 hits
- `npm run check`: now advances from gate 35 to **gate 122** — 87 gates that were never being reached now actually execute. It still exits 1, at `scripts/claims/claim-corpus-gate.mjs`, for an unrelated pre-existing reason: unlabeled claims in the operator's UNTRACKED draft docs (`docs/BIZRA_*_v0_1_DRAFT.md`, `docs/INSTRUCTION_P0_*`) — strings like "the only sovereign-AI project" and "Ed25519-signed receipts". Not touched: those are operator WIP, and clearing it would mean either relabelling their prose or running `--update-baseline`, which blesses unlabeled claims and needs its own GO.
- `npm test`: 8108 tests, 8101 pass, 7 fail — same 7 names as the TASK-036 baseline, unchanged. 8084 -> 8108 is exactly the 24 new tests, all passing.
- `kernel-purity-check`: OK, 443 scanned, 0 violations · `style-pillar-check`: exit 0 · `integration-check`: exit 0 with the new test staged so it is actually visible to it · `git diff --check`: exit 0

## Also fixed: stale doc row from TASK-036

`docs/TESTING.md` still described the OLD doctor behaviour — "activation gate BLOCKED → fail with dema-setup fix", "gateway unreachable → warn (not fail)", "14 tests total" — i.e. TASK-036 shipped with its own registry row left stale, describing exactly the behaviour it had removed. Both doctor rows corrected and counts re-MEASURED rather than estimated (23 and 4; a first pass wrote 22 from memory and was wrong).

## Not done

No KNOWN_MASKABLE entry, no allowlist entry — the pattern was corrected, the failure was never masked. Staged, uncommitted, unpushed.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude
created: 2026-07-28 06:32
---
AC5 is HALF proven, deliberately left unchecked. First half yes: gate 35 exits 0 and npm run check now advances to gate 122, so the 87 gates after 35 are genuinely exercised for the first time. Second half no: npm run check still exits 1, at gate 122 claim-corpus-gate, on unlabeled claims in untracked operator draft docs. That is outside this task and needs its own decision (relabel the prose, or --update-baseline which blesses unlabeled claims and is a baseline mutation requiring GO). Checking AC5 would overstate it.
---
<!-- COMMENTS:END -->
