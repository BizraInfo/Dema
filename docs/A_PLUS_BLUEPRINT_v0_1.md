# Dema · A+ Development Blueprint v0.1

**Date**: 2026-05-23
**Status**: `BLUEPRINT` — development standard, not a status claim
**Scope**: BIZRA Node0 + DEMA (the local CLI in this repo)
**Companion docs**: [`BIZRA_NODE0_DEMA_GOAL_SCRIPT_v0_1.md`](BIZRA_NODE0_DEMA_GOAL_SCRIPT_v0_1.md) (north-star goal) · [`CURRENT_LIMITS.md`](CURRENT_LIMITS.md) (status truth-map) · [`ROADMAP.md`](ROADMAP.md) (slice queue)

---

## Why this document exists

This is the **A+ development standard** for Dema. It names what A+ means
in concrete terms for a single-operator, local-first, stdlib-only
sovereign CLI — not for a fictional enterprise SaaS. It maps every
dimension of A+ quality to disk reality, names the remaining gaps, and
prescribes the next slice ordering.

It is meant to be opened side-by-side with the goal script: the goal
script states _why_ the work exists; this document states _how A+
quality is structured and how it gets there from where we are now_.

> **Recalibration note.** Common "enterprise blueprint" templates ask
> for team roles, production monitoring, on-call rotations, and
> rollback playbooks. Most of those concepts do not apply to a
> single-operator sovereign CLI. Where a section does not apply, this
> document names that fact honestly rather than invent fictional
> structure.

---

## 1. Executive summary

| Dimension                  | State today                                                                               | Gap to A+                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Architecture clarity       | SHIPPED · 11 packages with clear face/core boundary (ADR-001)                             | None                                                       |
| Dependency posture         | SHIPPED · 0 prod + 0 dev deps                                                             | None — guard it; do not introduce                          |
| Test discipline            | TESTED · 2,516 tests at this branch · 177 test files                                      | Layer 2 LLM-as-judge + Layer 3 golden dataset              |
| CI/CD                      | WIRED_PARTIAL · 3 workflows live (`check`, `codeql`, `bizra-review`) · 0 release workflow | Release workflow + SBOM + Dependabot for GH Actions        |
| Consent posture            | SHIPPED · ADR-005 + FATE exact-string + L0–L5 envelope + 23 onboarding-seal tests         | None for the core; extend seal as new surfaces land        |
| Public-facing truth labels | SHIPPED · `CURRENT_LIMITS.md` + Layer 1 artifact-safety scanner                           | Promote rows as they reach MEASURED                        |
| First-run experience       | SHIPPED · `dema first-run` (5 steps) + `dema --version`                                   | Clean-VM smoke (operator action)                           |
| Receipt spine              | WIRED_PARTIAL · read/list local · upstream-issued for ARTIFACT-011                        | Local mint is `DESIGNED_NOT_LIVE` by design                |
| Threat model               | WIRED_PARTIAL · 21-line `SECURITY.md` (non-negotiables)                                   | STRIDE-style expansion (parking lot)                       |
| Observability              | N/A — by design                                                                           | Operator-side `dema doctor` + receipts cover what's needed |

**Headline**: the architecture, deps, tests, consent, and truth-label
spines are all **A+ in posture**. The remaining A+ gaps are **eval
Layer 2/3, release workflow, threat-model expansion, and a clean-VM
first-run smoke** — each named with a typed-GO line in
[`ROADMAP.md`](ROADMAP.md).

---

## 2. Architecture & design

### 2.1 Component map

```
Dema (local CLI)
├─ apps/cli/                      → entry point · dispatcher · case branches per command
└─ packages/                      → 11 internal packages, no externally exposed API
   ├─ consent/                    → consent envelopes + audit ledger
   ├─ core/                       → ~80 modules: status, doctor, roadmap-dev, first-run,
   │                                onboarding-seal, artifact-safety-eval, proof-room-bundle,
   │                                approval-gate, urp-local, sat-*, pat-*, behavioral-*
   ├─ fate/                       → exact-string consent enforcement (===; fail-closed)
   ├─ installer/                  → idempotent setup writing only to $DEMA_HOME
   ├─ memory/                     → operator-local memory facets
   ├─ mission/                    → mission lifecycle (intention → receipt) preview surface
   ├─ models/                     → model-broker · routes to local Ollama / LM Studio (preview)
   ├─ node-adapter/               → adapter to upstream governed gateway (preview)
   ├─ receipts/                   → receipt-store (READ-only; no mint surface)
   ├─ tasks/                      → task-capsule shape preview
   └─ verifier/                   → SAT-1..5 pipeline orchestrator
```

### 2.2 Data flow — the mission lifecycle

From the goal script:

```
intention                                         (operator phrase)
  │
  ▼
task capsule         packages/tasks · packages/mission
  │
  ▼
PAT proposal         (preview surface today; runtime WIRED_PARTIAL)
  │
  ▼
SAT verification     packages/verifier · packages/core/sat-*  (orchestrator-verify v0.1 SHIPPED)
  │
  ▼
FATE gate            packages/fate · exact-string === byte match · fail-closed
  │
  ▼
human consent        ConsentCard · ADR-005 · L0–L5 envelope (approval-gate.js)
  │
  ▼
bounded execution    L4 surfaces only behind typed-GO · receipt path bounded
  │
  ▼
tests / evals        eval:layer1 SHIPPED · Layer 2/3 GAP
  │
  ▼
receipt              read/list local · upstream-issued for ARTIFACT-011
  │
  ▼
memory update        packages/memory · operator-local
  │
  ▼
roadmap update       dema roadmap dev (live anchor)
  │
  ▼
next safe action     state · doctor · roadmap dev
```

### 2.3 Integration points (across BIZRA repos · read-only references)

| Repo                       | Role for Dema                                                             | Boundary                                                |
| -------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------- |
| `bizra-omega` (Rust)       | Issues identity-bound artifacts (DIDs, signing keys, ARTIFACT-011 series) | Dema **reads / lists** receipts; never issues. ADR-003. |
| `bizra-data-lake` (Python) | Hosts cognition gateway · 14k+ tests · Founder Proof corpus               | Dema **never touches** the data lake at runtime.        |
| `bizra-cli` (TS)           | Sibling face for operator workflows outside Dema                          | Visual isomorphism (ADR-013); no runtime sharing        |

### 2.4 Technology stack

| Layer           | Choice                                             | Why this is the choice                     |
| --------------- | -------------------------------------------------- | ------------------------------------------ |
| Runtime         | Node.js ≥20.x (tested 20 + 22 in CI matrix)        | Stdlib-only; ubiquitous; ESM stable        |
| Language        | JavaScript (ESM)                                   | Zero compile step; readable in `Read` tool |
| Tests           | `node:test` (stdlib)                               | Zero deps; matches posture                 |
| Schema          | Hand-rolled validators in `packages/core/*`        | Avoids ajv / zod dependency footprint      |
| Receipts        | JSON envelopes tagged `bizra.dema.*.v0.1`          | Inspectable in any editor                  |
| Cryptography    | `node:crypto` (sha256, future ed25519)             | Stdlib                                     |
| Process control | `node:child_process` (installer / tests only)      | Stdlib                                     |
| Persistence     | Filesystem under `$DEMA_HOME` (default `~/.dema/`) | Sovereign-local                            |
| TUI             | Stdlib `process.stdout` · ANSI strings             | ADR-010 declined adding a TUI dependency   |

### 2.5 Performance & reliability targets (calibrated to Dema)

| Target                           | Current                             | Source                                |
| -------------------------------- | ----------------------------------- | ------------------------------------- |
| Cold CLI startup (`dema status`) | ~ms (operator-attested)             | Not yet timed in CI                   |
| `npm test` wall-clock            | ~7 s @ 2,516 tests                  | `node --test` measured                |
| Test pass rate on main           | 100% (2,504/2,504)                  | `ab47dbe`                             |
| Receipt store read latency       | < 100 ms for full directory listing | Not yet measured                      |
| CI green-rate on main            | clean over the last 30 days         | `.github/workflows/check.yml` history |
| Zero-dep invariant               | 0 prod + 0 dev deps                 | `package.json`                        |

Enterprise-style SLO numbers (uptime %, p99 latency) do not apply —
Dema is not a service.

---

## 3. Development management

### 3.1 Phases & milestones

Authoritative source: [`ROADMAP.md`](ROADMAP.md). Restated here for
self-containment:

| Phase                                     | Range             | Status            | Exit criteria (binary)                                                                                                                    |
| ----------------------------------------- | ----------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Phase 1 · External witness activation** | Day 1–30 (active) | ACTIVE            | C1 PR #95 merged ✅ · C2 public-safe proof-room ✅ · C3 Lighthouse Pack ✅ · C4 Ring-1 reviewers chosen ⏸ · C5 feedback receipts 🔜       |
| **Phase 2 · POI preview + Ring-2 cohort** | Day 31–60         | DESIGNED_NOT_LIVE | C1 POI test plan · C2 adversarial tests · C3 3-node cohort · C4 12-agent loop · C5 no public token claim (locked by Layer 1)              |
| **Phase 3 · Design partner close**        | Day 61–90         | PROJECTED         | C1 redacted public packet · C2 partner interviews · C3 Arabic/Urdu/Hindi entry path · C4 Bitcoin anchor decision · C5 90-day close report |

### 3.2 Team roles (N=1 + AI co-pilots)

Honest version of "roles & responsibilities" for a sovereign
single-operator project:

| Role                         | Held by                | Scope                                                                      |
| ---------------------------- | ---------------------- | -------------------------------------------------------------------------- |
| Operator / sovereign author  | Mumu                   | Every typed-GO; all final decisions                                        |
| Pair-programming + execution | Claude (in CLI)        | Implementer · planner · verifier under user-typed instructions             |
| Independent reviewer         | Cursor · GPT · Aurelle | Cross-source convergence; verified per three-source reconciliation pattern |
| External witness             | Ring-1 reviewers (TBD) | Phase 1 / C4                                                               |

No team-of-engineers roles to fabricate.

### 3.3 Risk assessment

| Risk                                             | Likelihood                   | Impact       | Mitigation in place                                                                                  | Gap                                                                       |
| ------------------------------------------------ | ---------------------------- | ------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Dependency creep introducing supply-chain risk   | low                          | high         | 0-dep invariant enforced by review · ADR-010 declined a TUI dep                                      | Add tripwire: CI fails on first `dependencies` or `devDependencies` entry |
| Path / secret leakage in shared artifact         | medium                       | high         | Layer 1 artifact-safety scanner · public-safe proof-room variant                                     | Audit any new artifact through `npm run eval:layer1` before share         |
| Overclaim drift in docs / changelog              | medium                       | high         | Layer 1 claim-boundary scan · `CURRENT_LIMITS.md` discipline · review gates                          | Continued discipline; no new gate needed                                  |
| Silent autonomous execution                      | low                          | catastrophic | ADR-005 exact-string consent · approval-gate matrix · onboarding-seal `daemon_not_running` invariant | None — already first-class                                                |
| Memory index bloat                               | high                         | low          | Known: `MEMORY.md` is over the soft limit                                                            | Compress pre-2026-05-12 entries (parked)                                  |
| Stale feat/\* branch sprawl                      | high                         | low          | `dema roadmap dev` lists active feat branches                                                        | Delete merged branches                                                    |
| First-time-user trips on `~/.dema`               | medium                       | medium       | `dema first-run` 5-step entry · `dema doctor`                                                        | Smoke on a clean VM (not yet done)                                        |
| LLM judge introducing remote-provider dependency | low (avoidable)              | high         | Eval-audit Constitutional Conflict 1                                                                 | Decide Layer 2 path: local-model · scaffold-only · DESIGNED_NOT_LIVE      |
| CodeQL parent-aggregate red (inherited)          | known                        | cosmetic     | 74 unused-local-variable alerts on pre-PR-95 base                                                    | Low-risk cleanup slice                                                    |
| Bus-factor (N=1)                                 | inherent to sovereign design | medium       | Memory system + receipt spine make work resumable; Founder Proof corpus is public-bindable           | Acceptable trade-off for the goal                                         |

---

## 4. DevOps & automation

### 4.1 CI/CD pipeline architecture

| Workflow       | File                                 | Triggers         | Gates                                             |
| -------------- | ------------------------------------ | ---------------- | ------------------------------------------------- |
| `check`        | `.github/workflows/check.yml`        | PR + push        | env-hygiene + `node --test` matrix (Node 20 + 22) |
| `codeql`       | `.github/workflows/codeql.yml`       | PR + weekly cron | JS security analysis                              |
| `bizra-review` | `.github/workflows/bizra-review.yml` | PR               | review-comment integrity scan                     |

### 4.2 Local pre-merge gate (operator-side)

| Gate                      | Command                                    | Purpose                                       |
| ------------------------- | ------------------------------------------ | --------------------------------------------- |
| Whitespace lint           | `git diff --check`                         | Block trailing whitespace / mixed tabs        |
| Unit + integration tests  | `npm test`                                 | All tests                                     |
| Composite checks          | `npm run check`                            | env-hygiene + tests + node0_self_check_verify |
| LLM guidance routing      | `npm run llm:guidance`                     | Confirm canonical-flow links live             |
| Layer 1 artifact safety   | `npm run eval:layer1 -- --artifact <path>` | Per-artifact verdict before share             |
| μ-layer test orchestrator | `.git/hooks/pre-push` (operator-installed) | Pre-push gate                                 |

### 4.3 Release workflow (the actual gap)

| Item                                                          | Status                                           | Plan                                                  |
| ------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------- |
| Versioning policy                                             | SHIPPED · [`ROADMAP.md` §Versioning](ROADMAP.md) | None                                                  |
| `release.yml` workflow                                        | PLANNED                                          | Docs-only spec first; mention in ADR                  |
| SBOM emission                                                 | PLANNED (parking lot)                            | `scripts/sbom.mjs` CycloneDX                          |
| Installer signing (macOS notarize / Windows cert / Linux gpg) | PLANNED (parking lot)                            | Docs slice first                                      |
| Tag → release pipeline                                        | Manual today                                     | Acceptable until terminal installer endpoint resolves |

### 4.4 Deployment & rollback

**Not applicable in the enterprise sense.** Dema is per-operator-machine
local install via `git clone` + `npm link` (today) or future
`install.bizra.ai/dema/install.sh` (PLANNED, not live). "Rollback" =
`git checkout <prev tag>`. Spelling that out honestly so no fictional
rollback playbook is invented.

### 4.5 Monitoring & alerting

**Not applicable in the production-service sense.** Dema's "monitoring"
is operator-side:

| Surface               | Command                                     |
| --------------------- | ------------------------------------------- |
| Local health          | `dema doctor`                               |
| State posture         | `dema status`                               |
| Live roadmap anchor   | `dema roadmap dev`                          |
| Receipt audit trail   | `dema receipts list` (read-only)            |
| First-run readiness   | `dema first-run`                            |
| Onboarding regression | `node --test tests/onboarding-seal.test.js` |

No PagerDuty. No Grafana. No on-call rotation. By design.

---

## 5. Quality assurance

### 5.1 Code review standards

| Standard                                                  | Source                                   |
| --------------------------------------------------------- | ---------------------------------------- |
| Conventional commits (`feat:`, `docs:`, `fix:`, …)        | Repo log history; enforced by review     |
| Co-authored by Claude line                                | Recent commits                           |
| `git diff --check` clean                                  | Pre-commit local                         |
| New test file → documentation row in `docs/TESTING.md`    | `integration-check` enforces             |
| No `eval(` or `new Function(` in source                   | `actuator-check` enforces                |
| No prose overclaim in artifacts                           | Layer 1 artifact-safety scanner enforces |
| ADR required for L4/L5 loosening or constitutional change | ADR-005 + repo `CLAUDE.md`               |

### 5.2 Testing strategy

| Tier                            | Examples                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------- |
| Module unit tests               | `tests/onboarding-seal.test.js` (23) · `tests/artifact-safety-eval.test.js` (15) |
| CLI subprocess tests            | `tests/roadmap-dev.test.js` (12, mixes unit + CLI) · `tests/first-run.test.js`   |
| Integration / boundary tests    | `tests/integration-check.test.js` · `tests/actuator-check.test.js`               |
| Doctrine / regression contracts | onboarding-seal (9 invariants) · no-overclaim · env-hygiene · μ-layer            |
| Layer 1 eval                    | `tests/artifact-safety-eval.test.js` (15)                                        |
| Layer 2 eval (LLM-as-judge)     | **0** — GAP                                                                      |
| Layer 3 eval (golden dataset)   | **0** — GAP                                                                      |

### 5.3 Performance benchmarking

Not currently in CI. Not a Phase 1 priority — Dema's perf surface is
small (CLI commands, JSON serialization). If/when added, scope =
`npm run bench` measuring cold-start and `dema status` wall-clock.

### 5.4 Security & compliance

| Standard                            | Status                                             |
| ----------------------------------- | -------------------------------------------------- |
| `SECURITY.md` non-negotiables       | SHIPPED                                            |
| CodeQL on every PR                  | SHIPPED                                            |
| Dependabot for GH Actions           | PLANNED (parking lot)                              |
| STRIDE threat model                 | PLANNED (parking lot)                              |
| SBOM at release                     | PLANNED (parking lot)                              |
| Installer signing                   | PLANNED (parking lot)                              |
| Privacy: no telemetry, no analytics | SHIPPED — enforced by 0-dep + zero-network posture |
| Compliance (GDPR / CCPA)            | N/A — Dema never leaves the operator's machine     |

### 5.5 Engineering practices already adopted

- **Truth labels on every surface** (`MEASURED`, `DESIGNED_NOT_LIVE`, `PLANNED`, `LOCAL_ONLY`) — outpaces typical enterprise discipline.
- **Exact-string consent gates** — stronger than typical RBAC for irreversible actions.
- **Receipt spine** — every L4 act produces an inspectable JSON envelope.
- **0 dependencies** — eliminates the entire supply-chain risk class.
- **L0–L5 autonomy envelope** — formal, ADR-backed; matches what AI-safety literature is converging on.

### 5.6 Practices to adopt next (priority order)

1. Smoke on a clean VM before declaring `dema first-run` MEASURED end-to-end (operator action).
2. Layer 2 scaffold — author rubrics as data + envelope schema; do not invoke remote LLM from the Dema runtime (resolves the eval-audit Constitutional Conflict 1).
3. Layer 3 golden dataset — seed 20 examples from existing local receipts; build precision/recall calculator (stdlib-only port of the audited Python sketch).
4. STRIDE-style threat model in `SECURITY.md`.
5. `release.yml` + SBOM + Dependabot.

---

## 6. Implementation timeline (build-order, not calendar)

Each row maps to a typed-GO line either already in `ROADMAP.md`
parking lot or named in the prior eval-gap audit.

| Order | Slice                                                       | Effort  | Unblock GO line                                                                    |
| ----- | ----------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------- |
| 1     | Delete merged `feat/dema-a-plus-local-first-closeout-v0-1`  | ~5 min  | (operator inline)                                                                  |
| 2     | Eval Layer 1 JSON-schema validator (closes the only L1 gap) | ~2 h    | `GO ship eval-layer-1-schema-validator-v0-1 in packages/core`                      |
| 3     | Eval Layer 2 scaffold — data-only rubrics + envelope shape  | ~4–6 h  | `GO ship eval-layer-2-scaffold-v0-1 as data-only rubrics, no remote LLM`           |
| 4     | Golden-dataset v0.1 (20 seeds from local receipts)          | ~3–4 h  | `GO ship golden-dataset-v0-1 with 20 seeded examples from local receipts`          |
| 5     | CodeQL inherited-alert cleanup (74 unused-vars)             | ~2 h    | `GO clean up the 74 inherited js/unused-local-variable CodeQL alerts on main`      |
| 6     | `MEMORY.md` index compression                               | ~1 h    | `GO compress pre-2026-05-12 memory index entries`                                  |
| 7     | STRIDE-style threat model expansion of `SECURITY.md`        | ~1 h    | `GO expand SECURITY.md with STRIDE-style threat model, no key rotation policy yet` |
| 8     | `release.yml` workflow draft (no tag-and-publish yet)       | ~2 h    | `GO author .github/workflows/release.yml as PR-only-no-publish draft`              |
| 9     | SBOM emission script                                        | ~2 h    | `GO add scripts/sbom.mjs emitting CycloneDX SBOM at every release`                 |
| 10    | Dependabot for GH Actions only                              | ~30 min | `GO add .github/dependabot.yml for github-actions ecosystem only`                  |

This sequence keeps every slice ≤ ~6 hours, doc-or-stdlib only, and
introduces no constitutional changes.

---

## 7. Success metrics

| Metric                                                  | Today                           | A+ target                                                                     |
| ------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------- |
| Tests passing                                           | 2,516                           | Hold + extend with Layer 2/3                                                  |
| Deps (prod + dev)                                       | 0 + 0                           | Hold                                                                          |
| ADRs accepted                                           | 15                              | 16 (Layer 2 design ADR) + 17 (release/SBOM ADR)                               |
| Surfaces at MEASURED truth-label                        | ~12 rows in `CURRENT_LIMITS.md` | Every named subsystem reaches MEASURED or is honestly named DESIGNED_NOT_LIVE |
| Layer 1 artifact-safety verdicts on shareable artifacts | Enforced for proof-room         | Enforced for any new shareable artifact pre-share                             |
| 7-question flagship test answerable                     | Partially                       | Fully answerable in < 30 min by a new reader from the local repo              |
| Phase 1 exit criteria met                               | 3/5 (C1, C2, C3)                | 5/5 (need C4, C5)                                                             |
| Phase 2 entered                                         | No (DESIGNED_NOT_LIVE)          | Typed-GO entry once Phase 1 closes                                            |

---

## 8. What this blueprint is NOT recommending

- Adopting any external framework (Phoenix · Arize · LangSmith · etc.) — would break the 0-dep invariant.
- Inventing a "DevOps team" or service-mesh layer.
- Production alerting / on-call rotations for a local CLI.
- Performance-benchmark CI gates before they have a clear customer.
- Releasing Phase 2 surfaces before Phase 1 closes.
- Auto-promoting any row from `DESIGNED_NOT_LIVE` to `MEASURED` without adding evidence to `CURRENT_LIMITS.md` at the same time.

---

## 9. Mapping back to the goal script's operating law

| Goal-script line              | Section that serves it                                                     |
| ----------------------------- | -------------------------------------------------------------------------- |
| **State before screen**       | §2.1 component map · §4.5 `dema doctor` / `status` surfaces                |
| **Contract before runtime**   | §2.4 stack choices · §5.1 review standards · §6 every slice typed-GO-bound |
| **Consent before capability** | §3.3 silent-execution risk row · ADR-005                                   |
| **Evidence before trust**     | §5.4 truth labels · §4.2 Layer 1 eval · receipt spine throughout           |
| **Node0 before mesh**         | §1 headline · §3.1 phase ordering (Phase 1 before Phase 2)                 |

Every line is either MEASURED today or named honestly as the next
slice to ship.

---

## When this document changes

This file is `v0.1`. Material edits to A+ definitions, phase ordering,
or risk classification require an ADR + an operator-typed GO. Edits
that refine or clarify (without weakening) the standard may land
through a standard PR.

Last refreshed: 2026-05-23.
