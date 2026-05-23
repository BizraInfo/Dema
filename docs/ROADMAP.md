# Dema · Dev Roadmap

**A developer-facing anchor.** Where we are, what just landed, what's next, and what is deliberately deferred — across the last 30 days and the next 90.

> Not the GTM dashboard. Not the investor packet. This file is the one
> place a dev opens to remember the shape of the work without re-reading
> 3 years of files.
>
> The hand-maintained sections below are anchored at **2026-05-23 ·
> main@ab47dbe · 2504/2504 tests**. For LIVE state (current branch, dirty
> tree, recent merges) run:
>
> ```bash
> dema roadmap dev          # human-readable
> dema roadmap dev --json   # machine envelope
> ```
>
> See also: [CURRENT_LIMITS.md](CURRENT_LIMITS.md) for the
> MEASURED / DESIGNED_NOT_LIVE / PLANNED / LOCAL_ONLY truth map.

---

## Where we are (anchor)

| Field | Value |
|---|---|
| **HEAD** | `ab47dbe` feat(cli): `dema first-run` + `--version` v0.1 |
| **Branch** | `main` (synced with origin/main) |
| **Tests** | 2504/2504 PASS |
| **Last canonical check** | `npm run check` PASS · `proof:room` 6/6 PASS · `release_readiness` score 100 |
| **Open PRs** | none from this lane |
| **Open ceremonies** | none active (last ceremony: ARTIFACT-011 on 2026-05-06) |
| **Last refresh of this file** | 2026-05-23 |

---

## Last 30 days — rear view

The shape of the work since 2026-04-23. Each row is one merged slice
with the commit/PR you can audit.

| Date (GST) | Slice | Where it lives |
|---|---|---|
| 2026-05-23 | **PR #95 · Dema A+ Local-First Closeout v0.1** (S1..S5) — Layer 1 artifact-safety eval · public-safe proof-room · Onboarding Seal v0.1 · Gate A docs uplift (`docs/CURRENT_LIMITS.md` new, `docs/PRODUCT.md` rewrite, README first-run 15→5) · `dema first-run` + `--version` | `ab47dbe..b60a8c6` on main |
| 2026-05-21 | PR #94 · v0.1.8 GTM drift closure + proof-room witness artifacts | `fdbf01f` |
| 2026-05-21 | PR #90 · orchestrator-verify v0.1 (SAT-1..5 pipeline CLI surface) | merged main; SAT pipeline now exposed |
| 2026-05-21 | PR #89 · codebase-map `--save-map` v0.2 (4-PR save canon complete) | repo intelligence layer durable |
| 2026-05-21 | PR #88 · codebase-architecture-map v0.1 (first repo intelligence layer) | stdlib-only, 0 deps held |
| 2026-05-21 | PR #87 · verification-result-save v0.1 (closes local evidence spine) | route + invocation + verification all durable |
| 2026-05-20 | μ-A2 mu-test-all + μ-layer hardening (4-fix slice) | μ-layer CI · pre-push hook source |
| 2026-05-19 | ADR-011 onboarding-consciousness phases 1–4 + post-review punch-list | UX + chat router + doctor dashboard |
| 2026-05-18 | Node1 acceptance ceremony (Samy) · 12:25 GST · first external GO | IRONCLAD receipt #21 |
| 2026-05-18 | ADR-008 runtime activation (12 components landed in one arc) | 35-commit day; 1165/1165 PASS |
| 2026-05-17 | Step 7 micro-primitives + 4-axis PoT convergence audit | PR #48; doctrine catch N+15 |
| 2026-05-16 | PR #45 env-hygiene + proof-forge genesis | ADR-007 Accepted (multi-session chain policy) |
| 2026-05-12 | Verify-Before-Act hook suite v0.1 · Founder IP separation spec | bash blacklist + 3 hooks active |
| 2026-05-09 | v0.3.5 install hardening (PR #22 · `--dry-run`/`--check`/uninstall) | Gate 6 closed → Node1 ungated |
| 2026-05-08 | v0.3.2 SAT verifier sibling + CLI wiring · Pulse Bundle v1 sealed | first clean strict-gate cycle |
| 2026-05-06 | v0.3.0 Active Command Kernel + ARTIFACT-011 minted | `~/.dema/receipts/artifact-011.json` |

A fuller chronology lives in [`CHANGELOG.md`](../CHANGELOG.md) and in
`memory/` per-event entries.

---

## 90-day forward arc

Three phases, each gated by typed operator consent. No phase advances
without all its exit criteria carrying evidence.

### Phase 1 · External witness activation (Day 1–30)

Status: **ACTIVE**. Send the Lighthouse Pack to Ring-1 reviewers only
under explicit typed GO. No mass send.

| Exit criterion | Status | Evidence |
|---|---|---|
| C1 · PR #95 merged to main | ✅ VERIFIED | `ab47dbe` |
| C2 · Public-safe proof-room generated | ✅ READY | `artifacts/proofs/proof-room-v0.1-public-safe/` · Layer 1 PUBLIC_SAFE |
| C3 · Lighthouse Pack prepared | ✅ READY / NOT_SENT | `~/Documents/bizra/launch-pack-v0.1/` (9 files · MANIFEST.sha256 PASS) |
| C4 · Ring-1 reviewer list selected | ⏸ SOURCE_PENDING | requires operator decision |
| C5 · Feedback receipts collected | 🔜 PROJECTED | depends on C4 |

### Phase 2 · POI preview + Ring-2 cohort (Day 31–60)

Status: **DESIGNED_NOT_LIVE**. Write the POI test plan; do not enable
the reward economy. ADR-009 already drafted.

| Exit criterion | Status |
|---|---|
| C1 · POI test plan authored | PLANNED |
| C2 · Adversarial tests drafted | PLANNED |
| C3 · 3-node Ring-2 cohort selected | PLANNED |
| C4 · 12-agent feedback loop verified | PLANNED |
| C5 · No token/economy claim made publicly | LOCKED (Layer 1 scanner gate) |

### Phase 3 · Design partner close (Day 61–90)

Status: **PROJECTED**. 5–10 design partners, not mass market.

| Exit criterion | Status |
|---|---|
| C1 · Public-safe proof packet redacted (separate from Lighthouse) | PLANNED |
| C2 · Partner interviews complete | PLANNED |
| C3 · Arabic / Urdu / Hindi entry path declared | PLANNED |
| C4 · Bitcoin anchor decision recorded | PLANNED |
| C5 · 90-day close report issued | PLANNED |

**Binary criterion across all phases**: if evidence is missing, the
phase does not advance. No "almost there" promotions.

---

## Next 5 moves (curated, prioritized)

Pick from the top. Each carries the exact next file/command so the
dev does not lose time re-orienting.

1. **Delete the merged feat branch** `feat/dema-a-plus-local-first-closeout-v0-1` (sandbox-blocked earlier; run with `!`-prefix). Local + remote.
2. **CODEQL_UNUSED_LOCAL_VARIABLE_CLEANUP_v0.1** — separate small PR to clear the 74 inherited `js/unused-local-variable` alerts on the pre-PR-95 base. Flips the CodeQL parent aggregate to green for future PRs. Stdlib-only edits.
3. **Refresh memory index size** — `MEMORY.md` is 26.4 KB vs 24.4 KB soft limit. Compress pre-2026-05-12 entries into a rollup line; move detail into their topic files.
4. **`dema roadmap dev` polish** — the live anchor CLI ships in this same PR; if it surfaces gaps, iterate before the next slice lands.
5. **Phase 1 / C4 — choose Ring-1 reviewers** — operator decision; not a code task. Without C4, Phase 1 cannot exit.

---

## Parking lot — deferred with unblock-GO lines

Each parked item is here on purpose. The exact typed phrase that would
unblock it is the second line.

#### S6 / ARTIFACT-012 · Second bounded-diagnostic ceremony
- **Why parked**: Aurelle's `NODE0_FIRST_BOUNDED_DIAGNOSTIC_RECEIPT_V0_1` — reproduce the bounded-diagnostic chain on clean main to prove ARTIFACT-011 wasn't a one-off. Constitutional L4 act.
- **Unblock GO**: `GO Node0 second bounded diagnostic activation only`
- **Status**: ceremony-gated · do not pipeline

#### `BIZRA_SOVEREIGN_SOURCE_REGISTRY_v0_1` · Metadata-first multi-source inventory
- **Why parked**: Convergent restraint of all three perspectives (Claude+Cursor+ChatGPT/Aurelle) — Aurelle explicitly said "do not expand architecture". Defer until Node1 closes properly.
- **Unblock GO**: `GO discovery-only for BIZRA_SOVEREIGN_SOURCE_REGISTRY_v0_1, metadata-only, no ingestion`
- **Status**: post-Node0/Node1 expansion

#### `CODEQL_UNUSED_LOCAL_VARIABLE_CLEANUP_v0_1`
- **Why parked**: Pre-existing, low-severity; flips CodeQL aggregate green. Worth doing pre-release, not pre-merge.
- **Unblock GO**: `GO clean up the 74 inherited js/unused-local-variable CodeQL alerts on main`
- **Status**: low-risk, low-priority

#### Installer signing roadmap (macOS notarization · Windows code-sign · Linux gpg)
- **Why parked**: `install.bizra.ai` endpoint planned-not-live; signing infrastructure depends on it.
- **Unblock GO**: `GO author docs/INSTALLER_SIGNING_ROADMAP_v0_1.md with dated targets`
- **Status**: docs-only first

#### SBOM emission at release
- **Why parked**: stdlib-only surface; SBOM is light but adds tooling. Worth it before any v0.4 tag.
- **Unblock GO**: `GO add scripts/sbom.mjs emitting CycloneDX SBOM at every release`
- **Status**: cosmetic until v0.4

#### Dependabot for GitHub Actions
- **Why parked**: 3 workflows are SHA-pinned (good); Dependabot would auto-bump them.
- **Unblock GO**: `GO add .github/dependabot.yml for github-actions ecosystem only`
- **Status**: hygiene; do before v0.4

#### Expanded threat model in SECURITY.md
- **Why parked**: Current SECURITY.md is the non-negotiables list (21 lines) — not a STRIDE-style model.
- **Unblock GO**: `GO expand SECURITY.md with STRIDE-style threat model, no key rotation policy yet`
- **Status**: docs slice; ~1 hour

#### Memory consent UX (ADR-004)
- **Why parked**: Opt-in sync per memory category needs design + per-category typed gate. UX-first.
- **Unblock GO**: `GO design dema memory consent UX v0.1`
- **Status**: design before code

#### Skill quarantine (ASPIRATIONAL)
- **Why parked**: `~/.dema/skills/` exists but isn't wired. Skills need sandbox + signing + per-skill consent envelope.
- **Unblock GO**: `GO author dema skill quarantine v0.1 design spec`
- **Status**: aspirational until v0.5+

#### Desktop / TUI v0.2 interactive layer (ADR-010)
- **Why parked**: ADR-010 declined the dependency decision. Wraps CLI surface in window; same trust model.
- **Unblock GO**: `GO author dema TUI v0.2 dep-decision ADR-016`
- **Status**: depends on ADR

#### Mission Spaces (per ADR-001)
- **Why parked**: Long-running mission with own bounded scope. Distant.
- **Unblock GO**: `GO author dema mission spaces v0.1 spec`
- **Status**: v0.5+

#### Receipt search (`dema receipts search <query>`)
- **Why parked**: nice-to-have; need v0.3.6 receipt chain validator first.
- **Unblock GO**: `GO author dema receipts search v0.1 over local mirror only`
- **Status**: post-validator

#### Federation between nodes (per PAT/SAT doctrine)
- **Why parked**: Typed handshake; federation receipt is L5 by definition. Distant.
- **Unblock GO**: `GO author dema federation handshake v0.1 spec, no runtime`
- **Status**: v0.5+

---

## What is NOT on this roadmap

Out of scope by ADR / constitution. Even if asked, the answer is no
without ADR + typed GO + invariant update.

- Hosting `bizra-cognition-gateway` — lives in `bizra-data-lake`, not Dema.
- Implementing missions, the receipt chain, or admissibility logic — lives in `bizra-omega` (Rust workspace upstream).
- Parallel trust score / parallel mission registry / parallel receipt schema — ADR-003 violation.
- Issuing identity-bound artifacts (DIDs, signing keys, ARTIFACT-011) from inside Dema — issuance lives upstream; Dema reads/lists.

---

## What we mustn't lose — anchor docs index

The files a dev opens FIRST when re-orienting:

| Doc | Purpose |
|---|---|
| [`README.md`](../README.md) | Public landing · 5-command first run · PLANNED-not-live banner on install URL |
| [`docs/CURRENT_LIMITS.md`](CURRENT_LIMITS.md) | MEASURED vs DESIGNED_NOT_LIVE vs PLANNED vs LOCAL_ONLY truth map |
| [`docs/PRODUCT.md`](PRODUCT.md) | What Dema is / is not / who it's for |
| [`docs/INDEX.md`](INDEX.md) | Documentation index (fast paths by reader role) |
| [`CHANGELOG.md`](../CHANGELOG.md) | Tagged releases + logical milestones |
| [`AGENTS.md`](../AGENTS.md) | Thin router into `docs/LLM_SYSTEM_FLOW.md` |
| [`CLAUDE.md`](../CLAUDE.md) | Repo-local Claude entry point |
| [`docs/LLM_SYSTEM_FLOW.md`](LLM_SYSTEM_FLOW.md) | The canonical LLM flow (read before any agent edit) |
| [`docs/06-adr/`](06-adr/) | All 15 ADRs (001 = Dema is one face; 005 = exact consent; 007 = chain policy; 011 = onboarding) |
| [`docs/02-architecture/dema-autonomy-envelope.md`](02-architecture/dema-autonomy-envelope.md) | The L0–L5 envelope · what each level allows |
| [`docs/TESTING.md`](TESTING.md) | Every test file with one-line purpose |
| [`SECURITY.md`](../SECURITY.md) | Security non-negotiables |
| `~/.dema/receipts/artifact-011.json` | The first bounded-diagnostic receipt (operator-local) |
| `.proof-forge/` (gitignored) | Operator-local proof receipts; 76 receipts + 36 verification artifacts as of 2026-05-21 |

---

## Versioning policy (unchanged)

- **Tightening edits** to the autonomy envelope (more restrictive gates, additional anti-patterns) → standard PR review.
- **Loosening edits** to L4/L5 gates → require operator typed GO + new ADR (per `docs/02-architecture/dema-autonomy-envelope.md` §Versioning).
- New L4-capable surfaces always require a corresponding receipt schema + SAT verdict path before they may merge.

---

## When this file goes stale

This file's anchor block names a HEAD SHA and a date. If you open it
more than a week after that date, run `dema roadmap dev` to see the
live anchor and update this file's "Where we are" + "Last 30 days"
sections from the live output.

The hand-maintained sections (Next 5 moves, Parking lot, What we
mustn't lose) drift slower and are refreshed only when their content
changes.
