# CI/CD Pipeline

> **Purpose:** Detailed reference for every GitHub Actions workflow in this repository — what triggers each one, what it executes, what it gates, what it pins, and how the operator updates it safely. The companion to [`docs/RELEASE_PROCESS.md`](RELEASE_PROCESS.md), which covers the broader release lifecycle; this document goes deep on the workflow internals themselves.
>
> **Scope:** `.github/workflows/*.yml` in this repo. The Dema repository runs **4 workflows totaling 198 LOC**. There is no separate CD surface — there is no auto-deploy and no auto-publish; "deployment" in this repo means a merged commit on `main` plus optionally a git tag.
>
> **Last refreshed:** 2026-05-24 GST against `main @ 66dd426`.

---

## 1. Workflow inventory

| Workflow | File | LOC | Triggers | Jobs | Typical green duration |
|---|---|---:|---|---|---|
| `check` | `.github/workflows/check.yml` | 30 | `pull_request` · `push: main` · `workflow_dispatch` | `test` (Node 20.x + 22.x matrix) | ~2m23s |
| `BIZRA Review Gate` | `.github/workflows/bizra-review.yml` | 78 | `pull_request` · `push: main` · `workflow_dispatch` | `proof-quality` (Node 22.x) | ~2m15s |
| `CodeQL` | `.github/workflows/codeql.yml` | 42 | `push: main` · `pull_request: main` · `schedule: cron '0 6 * * 1'` | `analyze` (JavaScript) | ~1m37s |
| `gitleaks` | `.github/workflows/gitleaks.yml` | 48 | `pull_request` · `push: main` · `workflow_dispatch` | `scan` (full history) | ~10s |

All four must report `success` before a slice on `main` is considered shipped. A `success` on three of four with one `failure` is **not** shipped — diagnose the failing gate before continuing.

---

## 2. `check` — npm test matrix + canonical aggregator

**File:** `.github/workflows/check.yml`

**What it does:** Runs the test suite across two Node versions, then runs coverage and the canonical aggregator (`npm run check`) on the newer of the two.

**Job: `test`**

| Step | Command | Run on |
|---|---|---|
| Checkout | `actions/checkout@de0fac2e` (v6.0.2 · Node 24) | both 20.x and 22.x |
| Set up Node | `actions/setup-node@48b55a01` (v6.4.0 · Node 24) | both 20.x and 22.x |
| Install | `npm install --no-audit --no-fund` | both 20.x and 22.x |
| Test | `npm test` | both 20.x and 22.x |
| Coverage | `npm run coverage` | **22.x only** |
| Aggregate check | `npm run check` | **22.x only** |

**Why coverage + check are 22.x-only:** Node 22 introduced the `--test-coverage-{lines,branches,functions}` threshold flags used by `npm run coverage`. `npm run check` (via `scripts/check.mjs`) internally calls coverage, so it inherits the same constraint. Tests themselves run on both versions to keep the engine floor honest.

**Engine pin:** `package.json` `engines.node` is `">=20"`. The CI matrix represents the floor (20.x) and the head (22.x). Bumping the floor requires updating both `package.json` engines AND the workflow matrix; bumping the head is workflow-local.

**Strategy:** `fail-fast: false` — both Node versions run to completion even if one fails. Operators see both signals rather than one short-circuited.

---

## 3. `BIZRA Review Gate` — repo-specific review chain

**File:** `.github/workflows/bizra-review.yml`

**What it does:** Re-runs the full quality stack (`test + coverage + check`) on Node 22.x, then routes the change to a branch-specific review class and runs 4 review scripts against it.

**Job: `proof-quality`** · timeout 15 min · Node 22.x

**Pre-review quality gates** (must all pass before the review scripts fire):

1. `npm install --no-audit --no-fund`
2. `npm test`
3. `npm run coverage`
4. `npm run check`

**Branch-class resolution** (case statement on `GITHUB_HEAD_REF` / `GITHUB_REF_NAME`):

| Pattern | Class |
|---|---|
| `devops/release-readiness` · `ci/devops-release-readiness-class` | `devops/release-readiness` |
| `proof/u1-proof-pin` · `docs/u1-proof-pin` · `ci/u1-proof-pin-class` | `docs/u1-proof-pin` |
| `u2/dema-preview-surfaces` · `ci/u2-dema-preview-class` | `u2/dema-preview-surfaces` |
| `tooling/claim-ledger-checker` · `ci/claim-ledger-checker-class` | `tooling/claim-ledger-checker` |
| `u2.1/amana-kernel-contracts` · `ci/u2.1-amana-kernel-contracts-class` | `u2.1/amana-kernel-contracts` |
| `proof/u1-*` (glob) | `proof/u1` |
| `adr/*` · `policy/*` · `governance/*` · `tooling/*` · `season-*` · `fix/*` · `ci/*` · `docs/*` · `feat/*` · `chore/*` (glob) | `policy/broad-scope` |
| `main` (push event) | `policy/merged-to-main` (no file-set enforcement; canonical state already gated) |
| anything else | **fails immediately** with `"Unsupported BIZRA review branch"` |

**Review scripts** (run after class is resolved):

| Script | Purpose |
|---|---|
| `scripts/review/pr-class.mjs --class <class>` | Asserts the change touches files allowed for the resolved class |
| `scripts/review/proof-scope.mjs --class <class>` | Asserts proof claims stay within the class's allowed scope |
| `scripts/review/no-overclaim.mjs --class <class>` | Catches claims that overstate truth (e.g., SHIPPED for WIRED_PARTIAL) |
| `scripts/review/receipt-integrity.mjs --class <class>` | Validates receipt-chain references in the diff |

**Operator note:** new branches not matching any pattern will fail this workflow with exit 1. To add a new class, edit `bizra-review.yml` and add the case + corresponding allow-list in the review scripts. This is the **workflow-changes-authorized gate** per CLAUDE.md — only the operator may change CI workflows.

---

## 4. `CodeQL` — static-analysis security scan

**File:** `.github/workflows/codeql.yml`

**What it does:** GitHub's CodeQL engine runs the `security-and-quality` query suite against the JavaScript surface of the repo. Findings show up in the Security tab and block PRs if they are above the configured severity threshold.

**Job: `analyze`** · 15-min timeout · runs `Analyze (JavaScript)`

| Step | Action |
|---|---|
| Checkout | `actions/checkout@de0fac2e` (v6.0.2) |
| Initialize CodeQL | `github/codeql-action/init@7211b7c8` (v4.36.0) · `queries: security-and-quality` |
| Perform CodeQL Analysis | `github/codeql-action/analyze@7211b7c8` (v4.36.0) · category `/language:javascript` |

**Triggers:**
- `push` to `main`
- `pull_request` against `main`
- `schedule`: every Monday at 06:00 UTC (`cron: '0 6 * * 1'`) — catches new CodeQL rules even when no code lands.

**Permissions:** `security-events: write` · `actions: read` · `contents: read` — minimal set needed to upload SARIF results and read workflow context. No `contents: write` — CodeQL never writes back to the repo.

**Strategy:** `fail-fast: false` (only JavaScript today; matrix is forward-compatible if Python or Rust are added).

**Known posture:** PR #95 (2026-05-23 closeout) inherited red CodeQL findings on the merge base SHA — these are alerts on `main`'s history, not on the new diff. See commit `ab47dbe` body for the diagnosis. Not blocking on the slice that surfaced them.

---

## 5. `gitleaks` — secret scanning

**File:** `.github/workflows/gitleaks.yml`

**What it does:** Scans the **full branch git history** (`fetch-depth: 0`) for secrets using `gitleaks v8.30.1`. Fails the workflow on any finding (`--exit-code 1`) and redacts secrets in CI logs (`--redact`) so the workflow output itself never becomes the leak surface.

**Job: `scan`**

| Step | Detail |
|---|---|
| Checkout | `actions/checkout@de0fac2e` with `fetch-depth: 0` (full history) |
| Install gitleaks | Direct binary download · v8.30.1 · SHA-256 verified |
| Scan | `./gitleaks detect --source . --no-banner --verbose --exit-code 1 --redact` |

**SHA-256 pin on the gitleaks binary:** `551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb`. The download URL is GitHub Releases (`gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz`). A SHA-256 mismatch fails the workflow before scanning — the binary itself is trust-pinned.

**Why direct binary, not marketplace action:** avoids marketplace-action license dependency and adds one more SHA pin to the canon. The gitleaks marketplace action does the same thing under the hood but requires a separate trust decision.

**Allowlist:** `.gitleaks.toml` at repo root. v8.30.1 syntax requires `commits + paths` AND-joined; fingerprints-only is silently rejected (memory: `feedback_gitleaks_v8_allowlist_syntax`). Currently only the deleted Firebase Genesis applet is grandfathered (memory: `project_2026_05_24_firebase_genesis_applet_deleted`).

**Permissions:** `contents: read` — scan-only, no write.

---

## 6. SHA pinning policy

Every `uses:` reference in every workflow is **SHA-pinned**, not tag-pinned. Tags are mutable; SHAs are not. SHA pinning is the supply-chain hardening baseline for this repo.

**Current pinning baseline (2026-05-24, post-PR #108 Node 24 migration):**

| Action | SHA pin | Tag equivalent | Notes |
|---|---|---|---|
| `actions/checkout` | `de0fac2e4500dabe0009e67214ff5f5447ce83dd` | v6.0.2 | Node 24 native |
| `actions/setup-node` | `48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e` | v6.4.0 | Node 24 native |
| `github/codeql-action/init` | `7211b7c8077ea37d8641b6271f6a365a22a5fbfa` | v4.36.0 | Node 24 compatible |
| `github/codeql-action/analyze` | `7211b7c8077ea37d8641b6271f6a365a22a5fbfa` | v4.36.0 | Node 24 compatible |

**Update protocol** (canary-then-fan-out · memory: `feedback_per_workflow_reinventory_after_first_bump`):

1. Pick **one** workflow as the canary (PR #108 used `bizra-review.yml` because it exercises the broadest surface).
2. Bump the canary's pinned SHAs to the target.
3. Push and verify the canary runs green with zero deprecation warnings in the log.
4. **Re-inventory every other workflow's run log** for deprecation warnings — warnings are workflow-local, not repo-wide, so a clean canary doesn't prove the rest are clean.
5. Fan out the bump to the remaining workflows in a follow-up commit on the same branch.

**Why canary-then-fan-out:** the alternative (bump all 4 at once) loses signal — if something breaks, you cannot tell which workflow's bump caused it. The canary gives a small, isolated test before committing to the broad change.

---

## 7. Node version policy

| Surface | Version | Source |
|---|---|---|
| `package.json` engines | `>=20` | `package.json` |
| `check` workflow matrix | 20.x + 22.x | `.github/workflows/check.yml` |
| `BIZRA Review Gate` workflow | 22.x | `.github/workflows/bizra-review.yml` |
| CodeQL / gitleaks workflow runtimes | Node 24 (action-internal) | post-PR #108 SHA bump |
| Local development | operator's choice ≥ 20 | per-machine |

**Node 24 migration timeline:**
- 2026-06-02 — GitHub deprecation: Node 20 → Node 24 forced default in actions
- 2026-09-16 — Node 20 fully removed from runners
- 2026-05-24 — this repo migrated proactively (PR #108) · all 4 workflows now Node 24 native via action SHA bumps · zero deprecation warnings across all workflow logs

**Coverage thresholds (Node 22+ only):** 95 lines · 85 branches · 95 functions. Tightening any of these requires updating `package.json scripts.coverage` AND verifying every test file still hits the new bar.

---

## 8. Workflow-changes-authorized gate

Per CLAUDE.md user-scope operator discipline, **modifying CI workflows requires explicit operator authorization** — this is a halt-gate identical to `git push` to a shared branch.

Specifically:
- Editing any `.github/workflows/*.yml` requires typed-GO.
- Adding a new workflow requires typed-GO + an ADR for non-trivial workflows.
- Bumping a pinned action SHA requires typed-GO; the canary-then-fan-out protocol (§6) must be followed.
- Removing a workflow requires typed-GO + a documented rationale (PR description or commit body).

**Detection:** the `BIZRA Review Gate` workflow's branch-class case statement is the runtime enforcement; the `policy/broad-scope` class includes `ci/*` as a recognized branch family.

**Local pre-commit signal:** `git diff --name-only HEAD~1..HEAD | grep -E '^\.github/workflows/'` — if non-empty, the slice touched CI and needs the typed-GO check.

---

## 9. Operator runbook — CI debugging

**When a workflow fails:**

| Symptom | First diagnostic |
|---|---|
| `check` red on Node 20.x but green on 22.x | An ES feature or test API requires Node 22; either patch the test or document the floor bump |
| `check` red on both | Run `npm test` locally — if green locally but red in CI, examine the env-hygiene gate (env vars differ) |
| `BIZRA Review Gate` red at `pr-class` | Branch name doesn't match any recognized class; either rename or add a case |
| `BIZRA Review Gate` red at `no-overclaim` | Commit message or doc has a SHIPPED claim that should be WIRED_PARTIAL / TESTED / etc. |
| `CodeQL` red | Read the Security tab; distinguish new findings (block) from inherited findings on the merge base (not blocking on the diff) |
| `gitleaks` red | Read the redacted finding; either it's a real leak (rotate + remove from history) or add a `commits + paths` allowlist entry in `.gitleaks.toml` |
| Workflow times out | Default 15 min on `BIZRA Review Gate` and `CodeQL` (other two have no explicit timeout); if exceeded, profile the slowest step — `npm run check` is the most likely culprit |

**Re-running a workflow:** `gh run rerun <run-id>` or `gh run rerun <run-id> --failed` (only failed jobs). No need to push an empty commit just to re-trigger.

**Reading workflow logs:** `gh run view <run-id> --log` or `gh run view <run-id> --log-failed` for the failing step only.

**Polling for completion:** prefer an until-loop over polling at 30s+ intervals — see the operator's session pattern. Do not poll faster than 30s against the GitHub API.

---

## Related

- [`docs/RELEASE_PROCESS.md`](RELEASE_PROCESS.md) — broader release lifecycle (this doc closes Tier-2 #15; companion to Tier-2 #16)
- [`docs/06-adr/INDEX.md`](06-adr/INDEX.md) — ADR map
- [`docs/GTM_READINESS_MATRIX.md`](GTM_READINESS_MATRIX.md) — this doc closes Tier-2 row #15 (MISSING → COMPLETE)
- [`.gitleaks.toml`](../.gitleaks.toml) — secret-scan allowlist
- [`package.json`](../package.json) — engine pin + script definitions
- [`docs/CURRENT_LIMITS.md`](CURRENT_LIMITS.md) — labeled-truth boundaries
- [`scripts/review/`](../scripts/review/) — repo-specific review scripts referenced by §3

---

## Update protocol

Re-refresh this document when:
- A workflow is added, removed, or renamed.
- A workflow's triggers change (e.g., new branch added to the `branches:` list).
- A pinned action SHA is bumped (update §6 baseline table).
- A new review script is added under `scripts/review/` (update §3).
- The Node engine floor or matrix changes (update §7).
- A new branch-class pattern is added to `bizra-review.yml`'s case statement (update §3).

Update the **Last refreshed** line and the `main @ <sha>` reference on every refresh.
