# Release Decision Record · `adr/007-accept` · 2026-05-16

**RDR identifier:** RDR-001 (first canonical instance per `DELIVERY_BLUEPRINT.md` Level-4 mandate)
**Branch:** `adr/007-accept` (pushed to `origin/adr/007-accept` at 12:00 GST)
**Base commit:** `8df722d feat(core): add corpus preview index`
**Head commit:** `e64b9c3 docs(adr-007): mark Companion change #1 RESOLVED`
**Commits ahead:** 18
**Session window:** 2026-05-16 05:10 → 12:05 GST (~7h)
**Decision authority:** operator (this record documents state; it does not grant publish authority)
**Decision verdict (assistant-side):** `GateVerdict.REVIEW` — branch is mechanically ready; operator review remains the halt-gate for merge.

## Why this record exists

`docs/DELIVERY_BLUEPRINT.md` § "CI/CD maturity model" declares: *"Level 4 (Managed): Coverage thresholds, pinned actions, risk-code reporting, and **release decision records become mandatory**."* No RDR existed on disk until this one. The 18-commit branch is the first work unit substantial enough to warrant the canonical instance.

This RDR is the **single integration document** that closes scope, quality, risk, rollback, and stakeholder evidence for the branch in one place — per `DELIVERY_BLUEPRINT.md` § "Management Body of Knowledge alignment", Integration management row.

## 1. Scope (PMBOK Integration + Scope management)

### What this branch ships

A **9-layer publication unit** — Policy → Map → State → Proof → Spec → Implementation → Design → Character → Lifecycle-Tested-and-Extended — across 18 commits / +7,131 insertions / 43 files changed:

| Layer | Commit | Artifact |
|---|---|---|
| Policy | `ab757a1` | ADR-007 Multi-Session Chain Policy promoted Proposed → Accepted |
| Map | `b8a8a14` | Node0 Genesis Readiness 2026-05-16 state snapshot |
| State | `13f32c5` | Node0 Homebase + Shared URP world preview foundations (2 modules) |
| Proof | `7e24611` | Cross-package boundary-invariant lint (`scripts/review/boundary-invariant-check.mjs`) |
| Spec (parent) | `a645d70` | Integration Foundry registry v0.1 spec bundle (4-file template) |
| Impl (parent) | `b400bd9` | External pattern registry preview module |
| Design | `aca328f` | Dema TUI cockpit and onboarding design |
| Character | `c3c3b0c` | Dema UX Proof Harness (12-criterion scorecard) |
| Carry-fwd | `dd37f23` | Model Role Router v0.1 + Mobile QR Consent v0 specs |
| Lifecycle test | `d9e0b2f` | System-lifecycle integration test (8 organs end-to-end, 11 cases) |
| Impl | `68b104c` | Model Role Router preview implementation (15 tests) |
| Fix-fwd | `d239815` | T-18 module-count assertion forward-compatible |
| Impl | `6c30b3f` | Mobile QR Challenge preview implementation (17 tests) |
| Fix-fwd | `2a85027` | T-15 module-count assertion forward-compatible |
| Sibling-spec #1 | `07ffbef` | URP Carrying Cost preview v0.1 spec bundle (4 files) |
| Sibling-specs #2-5 | `1e0e314` | mcp / a2a / skill-manifest / urp-resource-offer specs |
| Sibling-impls × 5 | `16e4b25` | All 5 sibling preview modules implemented (parallel-agent batch · 90 tests · 2,182 LOC) |
| Resolved gate | `e64b9c3` | ADR-007 Companion change #1 disk-verified as already implemented |

### What this branch deliberately does NOT ship (PMBOK Scope: Exclusions)

- Push to `main` or any other shared branch beyond `origin/adr/007-accept` (CLAUDE.md user-scope halt-gate)
- ADR-007 Option A/B/C choice (per ADR § Decision: operator must weigh trade-offs)
- Companion change #2 (`session_id` field in receipt envelope) — lives in `bizra-omega`, OUT OF THIS REPO per ADR-001 + ADR-003
- Federation / Node1 onboarding — ASPIRATIONAL per ROADMAP.md
- TUI framework choice — requires its own ADR per zero-dependency invariant
- Any runtime execution, daemon, mission run, receipt mint, or external-system call

## 2. Schedule (PMBOK Schedule management · gate-based, not date-based)

Per ROADMAP.md: *"Roadmaps use phase gates and truth labels instead of unverified dates."*

Gate sequence for this branch (current state vs Level 4 mandate):

| Gate | Result | Truth |
|---|---|---|
| Local invariant check | ✅ green | MEASURED |
| `git diff --check` (whitespace) | ✅ clean | MEASURED |
| `npm test` full suite | ✅ **682/682 PASS** (776 ms) | MEASURED |
| `npm run check` (Node0 self-check) | ✅ `ok: true · validationPassed: true` | MEASURED |
| `npm run llm:guidance` | ✅ 7/7 PASS | MEASURED |
| `npm run release:readiness` | ✅ Risks empty · Next-actions empty | MEASURED |
| `scripts/review/canon-check.mjs` | ✅ 0 topology · 0 authorization findings | MEASURED |
| `scripts/review/boundary-invariant-check.mjs` | ✅ 30/30 modules · 62 authority flags | MEASURED |
| Push to `origin/adr/007-accept` (new branch) | ✅ at 12:00 GST | MEASURED |
| External CI pipeline (GitHub Actions) | ⏳ status pending operator | PENDING |
| Code review (CodeRabbit / reviewers) | ⏳ pending PR open | PENDING |
| Operator merge decision | ⏳ halt-gate per CLAUDE.md | PENDING |

## 3. Quality gates (PMBOK Quality management)

### 3.1 Test surface

- **Tests on disk:** 63 test files, **682 individual cases**
- **Pass rate this session:** 682/682 (100%) repeatedly verified across 6+ commits
- **Suite runtime:** ~776 ms (consistent across runs)
- **Determinism:** every new preview module asserts `assert.deepEqual(a, b)` on two builder calls + `assert.notEqual(a, b)` on references (fresh-frozen-per-call pattern across 30 preview modules)
- **Coverage of boundary discipline:** `boundary-invariant-check.mjs` scans 30 source modules against 62-flag allowlist; 0 violations

### 3.2 Static-source review

- **Truncation guard:** `~/.claude/settings.json` line 330 = `head -c 4000` (per ADR-007 Companion change #1 resolution at `e64b9c3`)
- **Topology canon:** `canon-check.mjs` finds 0 forbidden phrases (capital-N references to ghost-hold nodes beyond the canonical Node1/Node2 pair would fail; the topology canon allowlist is enforced at every commit)
- **Authorization discipline:** `canon-check.mjs` finds 0 forbidden authorization phrases

### 3.3 Schema integrity

- **Canonical schemas exported:** **32** across `packages/*/src/*.js`
- **All `*_preview.v0.1`:** ≤ v0.1 version-tagged; no `LIVE` status anywhere
- **Universal envelope discipline:** every preview emits `{schema, mode, truth_label, ..., boundary}` shape; verified by both per-module tests AND the cross-cutting `boundary-invariant-check` lint

## 4. CI/CD maturity self-assessment (per `DELIVERY_BLUEPRINT.md`)

| Level | Name | Status |
|---|---|---|
| 0 — Ad hoc | Not acceptable | ✅ ABOVE |
| 1 — Scripted | Local `npm test` + smoke commands | ✅ EXCEEDED |
| 2 — Repeatable | `npm run check` provides a repeatable local gate | ✅ EXCEEDED |
| 3 — Defined | Release-readiness audit, review classes, canon checks, proof-safe docs gates declared | ✅ **AT** |
| 4 — Managed | Coverage thresholds, pinned actions, risk-code reporting, release decision records mandatory | 🟡 **THIS RDR IS THE FIRST INSTANCE** — coverage thresholds + pinned actions still external |
| 5 — Optimizing | Performance budgets, rollback rehearsals, SLO dashboards, post-release learning loops | ❌ FUTURE |

**Verdict:** branch operates at **Level 3 (Defined) and partially Level 4 (Managed)** — this RDR moves the Managed-level "release decision records become mandatory" item from declared to operational. Coverage thresholds + pinned-action enforcement remain Level-4 deltas to close.

## 5. Performance-QA mechanisms (per `DELIVERY_BLUEPRINT.md` § Performance-quality assurance)

| Mechanism | Current intent | Measured |
|---|---|---|
| Zero runtime dependencies | Keep startup small | ✅ `package.json` deps=NONE · devDeps=NONE |
| Native Node tests | Avoid build-tool drift | ✅ `node --test` only |
| Smoke commands | Verify CLI surfaces | ✅ 27 CLI verbs · `dema models` returned 12 models at 11:16 GST |
| Coverage thresholds | Enforce behavior coverage | 🟡 `npm run coverage` declared but not enforced in this branch's CI |
| Bounded gateway probes | Prevent hung checks | ✅ `c48117c · 2edc453 · 92712db` shellout-boundary hardening (Codex chain) |
| Large-fixture tests | Receipt/memory/model scans stay bounded | ✅ `2edc453 fix(receipts): bound local receipt listing` |
| Diff hygiene | Whitespace / generated-output drift | ✅ `git diff --check` clean |

## 6. Resource management (PMBOK Resource management)

- **Local compute:** Bizra-Node0 (MSI Titan host) · 125 GiB RAM · 102 GiB free · disk / 32% · /data 42%
- **Local models inventoried:** 12 (7 Ollama reachable + 5 GGUF on disk + 0 LM Studio currently reachable)
- **Concurrent producers:** `claude` (this session) · `@openai/codex` PID 10378 (1d 5h+ uptime · idle since 05:07 GST · untouched throughout)
- **No hidden daemon, no background worker** introduced by this branch (verified by 30/30 boundary-lint clean)

## 7. Communications management (PMBOK Communications)

- **Schema-tagging:** every report / receipt / preview output carries a `bizra.dema.*_preview.v0.1` schema string
- **Truth-labeling:** every output carries `truth_label ∈ {MEASURED, DERIVED, DECLARED, PLANNED, ASPIRATIONAL}` per `melae-preview` discipline
- **No private data in commit messages or docs:** verified by `canon-check.mjs` (0 forbidden authorization findings)

## 8. Risk register (PMBOK Risk management · with severity codes)

| Risk ID | Description | Severity | Mitigation |
|---|---|---|---|
| **R-001** | ADR-007 Option A/B/C remains unchosen | HIGH (decision-blocking for any future multi-session mint work) | Operator-decision halt-gate per ADR § Decision; documented in RDR § 2 schedule |
| **R-002** | Companion change #2 (`session_id` envelope) lives in `bizra-omega` | MEDIUM (cross-repo coordination) | Out-of-repo per ADR-001 + ADR-003; no action possible from this repo |
| **R-003** | Codex CLI concurrent producer (PID 10378) may resume committing | LOW (Codex has been idle 7h; safety-net branch `codex/2026-05-16-preview-stream` snapshots its chain at `8df722d`) | Snapshot label preserved; ADR-007 fix-forward strategy in place |
| **R-004** | 32 canonical schemas + 30 preview modules without integration runtime | LOW (preview-only; no runtime to fail) | Preview-only invariant enforced by boundary lint |
| **R-005** | TUI framework choice deferred indefinitely | LOW (display-only design exists at `aca328f`; no operator-visible failure yet) | ADR-008 candidate noted in `dema-tui-onboarding-design.md` § Open design questions |
| **R-006** | Coverage thresholds declared but not enforced in CI | LOW-MEDIUM (regressions possible without coverage gate) | Level-4 mandate gap; identified in § 4 |
| **R-007** | Dependency on operator-side `~/.claude/settings.json` for bash hook truncation | LOW (already at `head -c 4000` per `e64b9c3` resolution) | Disk-verified; ADR-007 Companion #1 RESOLVED |

**Aggregate risk posture:** 1 HIGH (R-001 operator-decision-bound) · 1 MEDIUM (R-002 cross-repo) · 5 LOW. Per `DELIVERY_BLUEPRINT.md` § Risk management: *"Risks are emitted as explicit codes with owner-ready remediation, never hidden in prose."* — done above.

## 9. Procurement management (PMBOK Procurement)

- **New dependencies added to this branch:** **ZERO** (npm `dependencies` + `devDependencies` both empty before and after this branch's 18 commits)
- **Third-party tools introduced:** none beyond what `8df722d` already had
- **License-check / supply-chain scan:** not invoked by this branch (zero-deps invariant makes it trivially clean)

## 10. Stakeholder management (PMBOK Stakeholder)

- **Operator (Mumu):** sole human stakeholder; typed-GO authorization in place for this session
- **Concurrent agent (Codex):** non-human producer; idle for full 7h session; chain untouched
- **External reviewers (CodeRabbit / future PR reviewers):** stakeholders for the next gate (post-push, pre-merge); no action taken on their behalf in this branch

## 11. Rollout / rollback (per `DELIVERY_BLUEPRINT.md` § Rollout and rollback)

| Surface | Rollout control | Rollback control |
|---|---|---|
| Source code (18 commits) | Atomic local commit · review class · gate evidence on each commit | `git reset --hard 8df722d` (DANGEROUS — requires GO); preferred: revert specific commits |
| Remote branch `origin/adr/007-accept` | Pushed at 12:00 GST; PR-create URL available | `git push origin --delete adr/007-accept` (REVERSIBLE) |
| Local state | All changes confined to repo tree + 2 operator-memory topic files | `git restore` for repo; plain-text removal for memory qualifiers |
| Receipts | None minted this branch | n/a (no mint) |
| Public release | NOT REACHED · gate-blocked by operator merge decision | n/a |

## 12. Decision verdict

**Assistant-side verdict per `pat-builder-sat-validator.md` § GateVerdict:** **`REVIEW`**.

Translation: the branch is mechanically ready (all gates green · 682/682 tests · canon-clean · boundary-lint-clean · pushed · PR-create URL live), but the decision to merge into `main` requires:

1. Operator typed-GO to open a PR (`gh pr create` halt-gate per CLAUDE.md)
2. External review pass (CodeRabbit + reviewers)
3. CI green on the PR
4. Operator merge action

The assistant **cannot grant `PERMIT`** for merge. Per `DELIVERY_BLUEPRINT.md` § Release-readiness decision rule: *"A release candidate is not ready unless... no runtime, federation, identity, or economy claim is implied by Dema docs"* — this branch satisfies that clause; **merge readiness is operator-decision**.

## 13. References (canonical sources this RDR composes)

- `docs/DELIVERY_BLUEPRINT.md` — process discipline + Level-4 RDR mandate
- `docs/NODE0_ACTIVATION_ROADMAP.md` — staged readiness ladder
- `docs/ROADMAP.md` — version sequence
- `docs/NODE0_GENESIS_READINESS_2026_05_16.md` — state snapshot for this branch (commit `b8a8a14`)
- `docs/02-architecture/pat-builder-sat-validator.md` — `GateVerdict` enum
- `docs/02-architecture/dema-ux-proof-harness.md` — UX character review (12 criteria)
- `docs/06-adr/ADR-001..ADR-007` — binding ADRs (ADR-007 promoted in this branch at `ab757a1`)
- `scripts/review/canon-check.mjs` · `boundary-invariant-check.mjs` · `actuator-check.mjs` · `integration-check.mjs` · `release-readiness.mjs` · `llm-guidance-check.mjs` — the 6 review scripts that produced the gate measurements above

## 14. Sign-off (typed-GO required for next stage)

- ✅ **Assistant sign-off:** branch is at `e64b9c3` · 682/682 tests · 7 gates green · risk register populated · this RDR landed.
- ⏳ **Operator typed-GO required for:**
  - Open PR (`gh pr create --base main --head adr/007-accept`)
  - Pick ADR-007 Option A / B / C (separate halt-gate per ADR § Decision)
  - Author + commit ADR-008 for TUI framework choice (operator picks framework)
- ⏳ **Operator typed-GO NOT required for** (work the assistant has authorization to do per current session GO):
  - Apply UX Proof Harness to `FIRST_RUN_WIZARD.md` + `USER_LIFECYCLE.md` (docs-only)
  - Operationalize harness criterion L as `scripts/review/non-generic-vocabulary-check.mjs`
  - Draft ADR-008 enumerating TUI framework options (operator still picks)

## Operating law

```
The branch is measured.
The branch is reviewed.
The branch is decided on by the operator.
The assistant ships the evidence; the operator ships the decision.
```
