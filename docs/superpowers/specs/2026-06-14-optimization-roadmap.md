# Dema — Evidence-Bound Optimization Roadmap (2026-06-14)

> Derived from the multi-lens analysis of 2026-06-14. **Every item traces to a MEASURED finding this session.** Truth labels: `MEASURED` (probed today) · `DESIGN` (intended, not run) · `OPERATIONAL` (process/delivery). This roadmap does **not** re-author `docs/.../BIZRA Elite Full-Stack Blueprint` (process canon already exists) — it prioritizes concrete optimization slices against it.

## Evidence base (measured today)

- 21 packages · 67,181 src LOC · **0 prod / 0 dev deps** · Node ≥20 · ESM stdlib-only.
- Dependency graph is an **acyclic DAG**: `consent` (0 internal deps) ← `receipts` (imports consent ×13) ← 19 others. No cycle.
- Tests: **13,931 asserts across 345 files**; only **183 (1.3%) are error-path** (`throws`/`rejects`); 1,672 schema-shape.
- Security: **64 files** enforce `RUNTIME_..._FALSE_KEYS` / `consent_required` / fail-closed.
- Tech-debt markers: **4** TODO/FIXME in 67k LOC. Structural debt: **dispatcher `apps/cli/src/index.js` = 5,308 LOC**.
- `process.exit` in `packages/` (non-CLI): **3** occurrences.
- Perf: harness present (`packages/perf/src/perf-{baseline,benchmark,improvement}.js` + `scripts/perf-bench.mjs`) — `DESIGN`/capable, **no fresh numbers run today**.

## The one systemic tension (highest-order finding)

`MEASURED` — **discipline is richly _coded_ but thinly _adversarially proven_.** The product's core promise (fail-closed boundary, exact-string consent) is enforced in 64 files, yet only ~1.3% of assertions exercise its negative paths. The next unit of work that most increases _trust_ is not features — it is **negative-path proof of the boundary the system already enforces.** (Ihsān/Amānah: the claim must not exceed the proof.)

## Prioritized roadmap (SNR-ranked)

| #      | Item                                           | Evidence                                                       | Action slice                                                                                                                                                                                                                                          | Effort | Cascading risk                                         |
| ------ | ---------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------ |
| **P0** | **Boundary error-path test suite**             | 64 enforcers vs 183 error-path asserts                         | **Partially shipped — PR #153 (merged) added direct DAG-root tests for `assertIntentWithinBound`.** Next slices: wrong consent phrase, tampered receipt hash, forbidden-key injection, expired/act-time consent — `consent` + `receipts` roots first. | M      | Low — additive tests; raises trust on the core promise |
| **P1** | **Dispatcher decomposition**                   | `index.js` 5,308 LOC god-file                                  | Continue `refactor/cli-dispatcher-extract-commands` (18 commits); **rebase onto current `origin/main` first** (now `12d2a56` after #151/#152/#153). Extract one command family per commit, TDD.                                                       | L      | Med — branch is behind main; rebase before more slices |
| **P2** | **Brand-token Plan 2**                         | A+B shipped (3 of ~10 TUI files)                               | Migrate heterogeneous files (`doctor-dashboard` 16-color, `dema-realm.cjs` CJS, `status`/`tui-formatter`/`banner-keys`/`network-blueprint`/`agent-kernel`) per their mapped color usage. **Blocked on theme PR landing.**                             | M      | Low                                                    |
| **P3** | **Pull stray `process.exit` from `packages/`** | 3 occurrences                                                  | Replace with thrown errors / returned status; keep exit-as-control-flow CLI-only.                                                                                                                                                                     | S      | Low — library purity                                   |
| **P4** | **Run + pin a perf baseline**                  | harness exists, unrun                                          | `node scripts/perf-bench.mjs` → record baseline receipt; then gate regressions in `npm run check`. Replaces the stale mockup perf numbers with MEASURED ones.                                                                                         | S      | Low                                                    |
| **P5** | **Delivery channel** `RESOLVED`                | root cause: commands pasted to chat, not run in operator shell | **Fixed** — disk-channel pattern (`git push … > /data/bizra/logs/x.log 2>&1`) proven across #152/#153. Remaining: ship `docs/brand-token-theme-spec` (P2 prerequisite) the same way.                                                                  | S      | — (unblocked)                                          |

## Cascading-risk map

- **Local `main`** reconciled to `origin/main` `12d2a56` after PR #151/#152/#153 merged. Confirm before P1 rebase.
- **Delivery channel** (was P5) RESOLVED — root cause was commands pasted into chat instead of run in the operator shell; the disk-channel pattern (`git push … > /data/bizra/logs/x.log 2>&1`) is proven across #152/#153.
- **Dispatcher branch** (P1) is behind the moved `main` — must rebase onto current `origin/main` (`12d2a56`) before more slices.

## Delivery log (2026-06-14)

- ✅ PR #151 — world-map wall-clock time-bomb fix (merged).
- ✅ PR #152 — multi-runtime local model discovery + Amānah `network_used` boundary fix (merged `a1ebee4`).
- ✅ PR #153 — `assertIntentWithinBound` DAG-root boundary tests, P0 first slice (merged `12d2a56`).
- ⏳ Remaining local: `docs/brand-token-theme-spec` (P2 prerequisite) — ship via the proven disk-channel pattern.

## Ihsān / Adl / Amānah mapping (concrete, not decorative)

- **Amānah (trust/proof):** P0 directly — never let the fail-closed _claim_ exceed its _test proof_.
- **Adl (fairness/bounded):** P1 — a 5,308-LOC god-file concentrates change-risk; decomposition distributes it.
- **Ihsān (excellence):** P3/P4 — library purity + measured (not asserted) perf.
- **No-zann:** P4 replaces mockup perf numbers with measured ones; this whole roadmap is bound to today's probes, not the design-canvas mockup.

## Out of scope (declared)

- No new CI/CD doctrine — the repo already has SHA-pinned workflows + μ-gate + G8 classifier + `npm run check`.
- No federation/Node1+ work — gated/preview by design.
- No fabricated DORA/PMBOK metrics — none were measured.
