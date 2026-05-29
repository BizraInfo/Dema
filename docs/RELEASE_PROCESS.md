# Release Process

> **Purpose:** Documents how a change moves from local edit to landed-on-`main`-with-green-CI in this repository. Covers versioning, the readiness gate chain, rollback, the multi-session chain mutation policy that constrains concurrent producers, and the canonical Release Decision Record (RDR) artifact.
>
> **Scope:** Dema CLI repo (this repo). The BIZRA Omega substrate at `/data/bizra/dema-runtime-arch-wt/` is a separate release surface and has its own discipline; this document does not govern it.
>
> **Last refreshed:** 2026-05-24 GST against `main @ 7315cf1`.

---

## 1. Versioning

| Field                          | Value (measured 2026-05-24)                                           | Source                                                 |
| ------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------ |
| `package.json` `version`       | `0.1.0-alpha.0`                                                       | `package.json`                                         |
| Most recent release tag        | `v0.3.5`                                                              | `git tag --sort=-creatordate`                          |
| Tag history (descending)       | `v0.3.5` · `v0.3.2` · `v0.3.1` · `v0.3.0` · `v0.2.7` · `v0.2.0-alpha` | `git tag`                                              |
| Safety tag (pre-rebase backup) | `matrix-pre-rebase-20260520`                                          | manual                                                 |
| Engine pin                     | `node >= 20` (CI on Node 24)                                          | `package.json` engines + `.github/workflows/check.yml` |
| Production dependency count    | **0**                                                                 | `package.json` (stdlib-only invariant)                 |

**Conventions:**

- Tags are prefixed `v` for release tags (`v0.3.5`).
- Non-release tags use descriptive prefixes (`matrix-pre-rebase-<YYYYMMDD>`).
- `package.json` `version` and the tag stream may diverge during refactors; the **tag** is the canonical release marker, the **commit** is the canonical artifact.

---

## 2. Readiness gate chain

Every change to `main` passes through three concentric layers of gates. All three must be green before the slice is considered shipped.

### Layer A · Local pre-commit (operator's machine)

Run before staging:

```bash
npm test                  # full unit suite · expected 3396/3396 PASS at 79b46eb onward
npm run check             # canonical aggregator (env-hygiene + test + coverage + ~40 CLI subcalls + review gates)
npm run llm:guidance      # 7/7 router/canon checks
git diff --check          # whitespace + conflict markers
```

For docs-only changes that touch no `apps/`, `packages/`, `scripts/`, `bin/`, or `tests/`, the lighter shape is acceptable:

```bash
npm test
npm run llm:guidance
git diff --check
```

Optional but recommended on substantial changes:

```bash
npm run coverage          # 95/85/95 thresholds (lines/branches/functions)
npm run proof:room        # composed proof gates
npm run release:readiness # scored 0-100, 0 risks expected
npm run gtm:readiness     # GTM doc surface readiness
npm run urp:discovery     # URP shared-discovery posture
npm run env-hygiene       # env var leak check
```

### Layer B · Local pre-push (μ-layer orchestrator)

The pre-push hook at `.git/hooks/pre-push` (operator-installed; **not** in repo) runs the μ-layer orchestrator `~/.dema/bin/mu-test-all`, which executes 7 doctrine harnesses:

| Harness                 | Purpose                                                      | Expected              |
| ----------------------- | ------------------------------------------------------------ | --------------------- |
| μ-H1 drift linter       | catches doctrine drift in CLAUDE.md / AGENTS.md / canon docs | PASS                  |
| μ-K1 self-critique      | self-critique discipline harness                             | PASS                  |
| μ-H2 tool envelope      | tool-call envelope canon (boundary keys, runtime emission)   | PASS                  |
| μ-C1-enforcer           | docs/\* gating                                               | PASS                  |
| μ-M2 doctrine projector | doctrine-catch registry                                      | PASS                  |
| μ-A1 audit tool         | `mu_state_root` audit                                        | PASS or WARN (exit 0) |
| μ-C1 consent CLI        | consent surface canon                                        | PASS                  |

A typical green run reports **104 PASS / 0 FAIL · ~18s**. The pre-push hook gates the push and appends a receipt to `~/.dema/lint/mu_test_run_log.ndjson`.

**Bypass:** `DEMA_PRE_PUSH_BYPASS=1 git push ...` is permitted only with an explicit reason; the bypass is logged to `~/.dema/lint/consent_enforcement_log.ndjson`. Avoid bypass on `main`.

### Layer C · Remote CI (GitHub Actions)

Four workflows fire on every push to `main` and every pull request. All are SHA-pinned to Node-24-native action versions (per PR #108, 2026-05-24):

| Workflow              | File                                          | Purpose                                                              | Typical duration |
| --------------------- | --------------------------------------------- | -------------------------------------------------------------------- | ---------------- |
| **gitleaks**          | `.github/workflows/gitleaks.yml` (48 LOC)     | secret scan via `gitleaks v8.30.1` with `commits + paths` allowlist  | ~10s             |
| **CodeQL**            | `.github/workflows/codeql.yml` (42 LOC)       | static-analysis security scan                                        | ~1m37s           |
| **check**             | `.github/workflows/check.yml` (30 LOC)        | runs `npm run check` (aggregator)                                    | ~2m23s           |
| **BIZRA Review Gate** | `.github/workflows/bizra-review.yml` (78 LOC) | repo-specific review gates (env-hygiene, canon, boundary invariants) | ~2m15s           |

All four must report `success` before the slice is considered shipped. A `success` on three of four with one `failure` is **not** shipped — diagnose the failing gate before continuing.

**Note on Copilot review:** GitHub Copilot reviews PRs on a separate cadence. Treat real findings as valuable signal (cf. the canon-violation + silent-exit + process.exit bugs caught on PR #109). Distinguish from stale-view false positives by reading the cited code at the cited line.

**Note on CodeRabbit:** Two unrelated failure modes — (a) billing exhaustion, (b) rate-limit. Neither is engineering signal. See the operator-side gotchas memo for distinguishing wording.

---

## 3. Release-readiness scoring

`npm run release:readiness` produces a 0-100 score and a list of risks/next-actions. Current score should be **100/100** with **0 risks**. Any non-zero risk list is a halt-gate before tagging a release.

The script reads:

- test suite state (count + pass rate)
- coverage thresholds (95/85/95)
- gate outcomes (proof:room, llm:guidance, env-hygiene)
- recent PR review history
- known-parked items from `docs/ROADMAP.md`

---

## 4. Release artifact: the Release Decision Record (RDR)

Per `docs/DELIVERY_BLUEPRINT.md` Level-4 mandate, every substantial work unit (typically 5+ commits or a multi-layer publication) produces a Release Decision Record at `docs/RELEASE_DECISION_RECORD_<slug>_<YYYY-MM-DD>.md`.

The first canonical instance is `docs/RELEASE_DECISION_RECORD_adr-007-accept_2026-05-16.md` (RDR-001).

An RDR closes:

- **Scope** (what shipped · what was deliberately excluded)
- **Schedule** (gate sequence + result truth-labels: MEASURED / PENDING / DESIGNED_NOT_LIVE)
- **Quality** (test surface · coverage · gate outcomes)
- **Risk** (known risks + mitigations)
- **Rollback** (procedure if the merge needs to be reverted)
- **Stakeholder evidence** (who authorized · what was the typed-GO)

Single-commit fixes and docs-only slices do not require an RDR — the commit message body covers them. The RDR threshold is the operator's judgment; default to "if in doubt, write one."

---

## 5. Rollback procedure

Rollback paths in order of preference:

| Severity                                                     | Path                                                             | Effect                                                           |
| ------------------------------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| Bad commit on `main` not yet pushed                          | `git reset --soft HEAD~1`                                        | Un-do commit; keep working tree                                  |
| Bad commit on `main` already pushed, no downstream consumers | `git revert <sha>` + push                                        | Forward-only revert · preserves history                          |
| Bad commit triggers CI gate failure                          | Fix-forward in a follow-up commit                                | Preferred when feasible · avoids history rewrite                 |
| Multi-commit branch needs unwind                             | `git revert -m 1 <merge-sha>` on the merge commit                | Reverts the whole merged branch                                  |
| Catastrophic state corruption                                | Reset to a known safety tag (e.g., `matrix-pre-rebase-20260520`) | Last resort · destroys subsequent history · requires operator GO |

**Halt-gates per CLAUDE.md** that constrain rollback:

- `git push --force` to `main` is forbidden without explicit typed-GO.
- `git reset --hard` is forbidden without explicit typed-GO.
- Deleting branches or tags is forbidden without explicit typed-GO.

Tags are append-only. A retracted release is marked with a follow-up commit + an annotated tag (`v0.3.5-retracted`); the original tag is not deleted.

---

## 6. Multi-session chain mutation policy (ADR-007)

[ADR-007](06-adr/ADR-007-multi-session-chain-policy.md) governs concurrent producers on the Node0 receipt chain at `~/.dema/agents/dema.node0_mission_agent/`. It is **operator-side** (the chain is not in this repo) but the release process must honor it because release-time receipt minting can collide with concurrent assurance runs.

**Current state:** ADR-007 is Accepted (2026-05-16 · PR #44 / commit `0ef5998`). Decision A/B/C among the three resolution options remains **deferred to operator typed-GO** — the chain operates in the unguarded shared-resource state (effectively Option C semantics) until that GO lands.

**Release implications:**

- Concurrent producers are permitted; the N+2 split-commit canon (memory: `project_2026_05_20_codex_concurrent_producer_n2.md`) is the working pattern when two agents publish in the same window.
- Every within-session claim of "chain unchanged" requires a session-scoped qualifier — release announcements that depend on chain state must cite the session id and timestamp.
- The `session_id` field in receipt envelopes is a forward-looking commitment (Companion change #2) and lives in `bizra-omega`, OUT of this repo per ADR-001 + ADR-003.

---

## 7. CI workflow pinning policy

All `.github/workflows/*.yml` action references are SHA-pinned (not tag-pinned). Current pinning baseline (2026-05-24, post-PR #108):

- `actions/checkout@de0fac2e` (v6.0.2)
- `actions/setup-node@48b55a01` (v6.4.0)
- `github/codeql-action/*@7211b7c8` (v4.36.0)

**Update protocol:** when bumping a pinned action, use the canary-then-fan-out pattern (memory: `feedback_per_workflow_reinventory_after_first_bump`):

1. Bump one workflow first (the canary).
2. Push and verify a clean run on that workflow.
3. Re-inventory every other workflow's run log for deprecation warnings (warnings are workflow-local, not repo-wide).
4. Fan out the bump to the remaining workflows once the canary is verified.

**Why SHA pinning:** action tag mutability is a supply-chain risk. SHA pins make the action input deterministic and Dependabot-reviewable.

---

## 8. Halt-gates (operator's stop conditions)

Per `~/CLAUDE.md` (user-scope operator discipline), the following actions require explicit typed-GO from the operator — they cannot be taken in `/A` autonomous mode:

- `git push` to any shared branch (`main`, `master`, or any branch with downstream consumers)
- `git push --force` to any branch
- `git reset --hard` or any destructive rebase
- Deleting files, branches, tags, or PRs
- Posting to shared external systems (Slack, GitHub comments, email)
- Modifying secrets, production configs, or CI workflows
- Tagging a release (creates a public artifact)

Local commits, local file edits, and local test runs do **not** require typed-GO — they are reversible operator-side actions.

---

## Related

- [`docs/06-adr/ADR-007-multi-session-chain-policy.md`](06-adr/ADR-007-multi-session-chain-policy.md) — concurrent producer policy
- [`docs/06-adr/ADR-006-continuous-assurance-and-no-mint-verification.md`](06-adr/ADR-006-continuous-assurance-and-no-mint-verification.md) — verify is read-only; mint is bifurcated
- [`docs/RELEASE_DECISION_RECORD_adr-007-accept_2026-05-16.md`](RELEASE_DECISION_RECORD_adr-007-accept_2026-05-16.md) — canonical RDR-001
- [`docs/GTM_READINESS_MATRIX.md`](GTM_READINESS_MATRIX.md) — this process closes Tier-2 row #16 (PARTIAL → COMPLETE)
- [`docs/06-adr/INDEX.md`](06-adr/INDEX.md) — full ADR map
- [`docs/ROADMAP.md`](ROADMAP.md) — parked-vs-active items, including ADR-007 Option A/B/C selection
- [`docs/CURRENT_LIMITS.md`](CURRENT_LIMITS.md) — labeled-truth boundaries

---

## Update protocol

Re-refresh this document when:

- The CI workflow set changes (add/remove/rename a workflow).
- Pinned action SHAs are bumped (update §7 baseline).
- A new readiness script lands in `package.json scripts` (add to §2).
- ADR-007 Option A/B/C selection lands (rewrite §6).
- An RDR convention changes (e.g., new mandatory section).
- A new safety tag is created (record in §1).

Update the **Last refreshed** line and `main @ <sha>` reference on every refresh.
