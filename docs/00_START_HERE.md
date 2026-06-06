# 00 · Start Here

> **Purpose:** Single-page routing doc. Find the right entry point for your reviewer class in under 60 seconds.
>
> **Last verified:** 2026-05-24 GST against `main @ ccde52a`.

---

## What this is (one line)

**Dema** is a local-first AI cockpit that refuses unsafe state, names the gap, and prints the fix — the product face of the **BIZRA** ecosystem.

For the full doctrine, see [`docs/public/third-fact-v0.1.md`](public/third-fact-v0.1.md). For the truth boundary, see [`docs/CURRENT_LIMITS.md`](CURRENT_LIMITS.md).

---

## Choose your path

Pick the row that matches your reviewer class. Read top-to-bottom. The path is bounded — every entry is reachable in this repo today.

| You are...                        | Start with                                                                                        | Then read                                                                                                                                                                                                                                                                                                                                                                             | Time              |
| --------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| **Public reviewer**               | [`QUICKSTART.md`](QUICKSTART.md) — run 4 commands · see actual output                             | [`CURRENT_LIMITS.md`](CURRENT_LIMITS.md) → [`public/third-fact-v0.1.md`](public/third-fact-v0.1.md) → [`THIRD_FACT_CURRENT_STATE_DELTA.md`](THIRD_FACT_CURRENT_STATE_DELTA.md)                                                                                                                                                                                                        | ~15 min           |
| **Technical reviewer (engineer)** | [`ARCHITECTURE.md`](ARCHITECTURE.md) — system model                                               | [`TESTING.md`](TESTING.md) → [`06-adr/INDEX.md`](06-adr/INDEX.md) → [`CI_CD_PIPELINE.md`](CI_CD_PIPELINE.md) → [`RELEASE_PROCESS.md`](RELEASE_PROCESS.md)                                                                                                                                                                                                                             | ~45 min           |
| **Security reviewer**             | [`../SECURITY.md`](../SECURITY.md) — non-negotiables                                              | [`CURRENT_LIMITS.md`](CURRENT_LIMITS.md) "Hard non-claims" → [`THIRD_FACT_CURRENT_STATE_DELTA.md`](THIRD_FACT_CURRENT_STATE_DELTA.md) TF-001/TF-006/TF-007 → [`CI_CD_PIPELINE.md`](CI_CD_PIPELINE.md) §5 gitleaks · §4 CodeQL                                                                                                                                                         | ~30 min           |
| **Investor / business**           | [`public/third-fact-v0.1.md`](public/third-fact-v0.1.md) — the thesis (public draft)              | [`THIRD_FACT_CURRENT_STATE_DELTA.md`](THIRD_FACT_CURRENT_STATE_DELTA.md) → [`ROADMAP.md`](ROADMAP.md) → [`GTM_READINESS_MATRIX.md`](GTM_READINESS_MATRIX.md)                                                                                                                                                                                                                          | ~30 min           |
| **New contributor**               | [`QUICKSTART.md`](QUICKSTART.md) → [`../README.md`](../README.md)                                 | [`TESTING.md`](TESTING.md) → [`06-adr/INDEX.md`](06-adr/INDEX.md) → [`RELEASE_PROCESS.md`](RELEASE_PROCESS.md)                                                                                                                                                                                                                                                                        | ~1 hr             |
| **AI ethics / regulator**         | [`THIRD_FACT_CURRENT_STATE_DELTA.md`](THIRD_FACT_CURRENT_STATE_DELTA.md) — per-claim truth labels | [`CURRENT_LIMITS.md`](CURRENT_LIMITS.md) → [`06-adr/ADR-005-operator-actions-require-explicit-consent.md`](06-adr/ADR-005-operator-actions-require-explicit-consent.md) → [`06-adr/ADR-015-llm-suggestion-verifier-authority.md`](06-adr/ADR-015-llm-suggestion-verifier-authority.md) → [`06-adr/ADR-016-eval-layer2-scaffold-only.md`](06-adr/ADR-016-eval-layer2-scaffold-only.md) | ~30 min           |
| **Operator (Ring-1, internal)**   | [`../CLAUDE.md`](../CLAUDE.md) — operator discipline                                              | [`ROADMAP.md`](ROADMAP.md) → [`06-adr/INDEX.md`](06-adr/INDEX.md) → operator-side memory + μ-layer + receipt chain (per [`THIRD_FACT_CURRENT_STATE_DELTA.md`](THIRD_FACT_CURRENT_STATE_DELTA.md) TF-006)                                                                                                                                                                              | as long as needed |

---

## Top-of-page truth at a glance

The honest state of this repository as of `main @ ccde52a` (2026-05-24):

| Surface                   | Truth label                                                   | Source of truth                                                                    |
| ------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Doctrine                  | Third Fact v0.1 (public draft)                                | [`public/third-fact-v0.1.md`](public/third-fact-v0.1.md)                           |
| Test surface              | **MEASURED** · 2618 / 2618 PASS                               | `npm test`                                                                         |
| Coverage                  | **MEASURED** · 97.57 lines · 88.38 branches · 97.56 functions | `npm run coverage`                                                                 |
| Dependencies              | **MEASURED** · 0 production · 0 dev · stdlib-only             | `package.json`                                                                     |
| CI gates                  | **MEASURED** · 4 SHA-pinned workflows · all green             | [`CI_CD_PIPELINE.md`](CI_CD_PIPELINE.md)                                           |
| Verified Refusal Pattern  | **MEASURED** ★                                                | TF-004 in [`THIRD_FACT_CURRENT_STATE_DELTA.md`](THIRD_FACT_CURRENT_STATE_DELTA.md) |
| GTM readiness             | **PARTIAL** · 32% of 25-doc minimum pack                      | [`GTM_READINESS_MATRIX.md`](GTM_READINESS_MATRIX.md)                               |
| Audit grade               | **MEASURED** · A · 94.5 / 100                                 | [`AUDIT_2026_05_24_v0_1.md`](AUDIT_2026_05_24_v0_1.md)                             |
| Mesh / federation         | **DESIGNED_NOT_LIVE**                                         | [`CURRENT_LIMITS.md`](CURRENT_LIMITS.md) Hard non-claims                           |
| Token economy / PoI       | **DESIGNED_NOT_LIVE**                                         | TF-013 in [`THIRD_FACT_CURRENT_STATE_DELTA.md`](THIRD_FACT_CURRENT_STATE_DELTA.md) |
| Global impact projections | **ASPIRATIONAL**                                              | TF-014                                                                             |

Read these labels seriously. The Third Fact text itself forbids overclaim drift (Pillar 02 Humility · Pillar 03 Proof). Every artifact in this repo carries the labels that bind it.

---

## What this repo does NOT contain

Per [`06-adr/ADR-022`](06-adr/) (substrate-out doctrine — operator-side memory holds the reference) and [`06-adr/ADR-003-core-truth-lives-in-bizra-omega.md`](06-adr/ADR-003-core-truth-lives-in-bizra-omega.md):

- **BIZRA Omega substrate** — the Rust workspace inside `bizra-data-lake` (27+ crates · 14k+ tests). Lives at `/data/bizra/dema-runtime-arch-wt/` for the operator; not in this repo.
- **Runtime mint surface** — receipt minting happens in the governed gateway, not here. This repo reads / lists receipts only.
- **Live federation handshake** — Node1 ceremony is `DESIGNED_NOT_LIVE` until typed-GO opens that lane.
- **Token / PoI / economic runtime** — `DESIGNED_NOT_LIVE` · ADR-009 is scaffold-only · public draft makes no live economic claim.
- **Personal operator memory** — operator-side at `~/.dema/` per ADR-022; this repo holds the contracts, not the data.

If a reviewer expects to find one of the above in this repo, route them to the labeled-truth source ([`CURRENT_LIMITS.md`](CURRENT_LIMITS.md)) before they conclude something is missing in error.

---

## First-time-runner one-liner

```bash
node --version    # must be ≥ 20
git clone https://github.com/BizraInfo/Dema && cd Dema
node bin/dema status
```

If you see the readiness frame, you have a working node. See [`QUICKSTART.md`](QUICKSTART.md) for the full first-run flow.

---

## Where to file feedback

| Channel             | Use                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GitHub issues       | repo bugs · CI failures · doc gaps                                                                                                                           |
| Security disclosure | see [`../SECURITY.md`](../SECURITY.md) — note: current `SECURITY.md` is the non-negotiables list; full STRIDE threat model is `PLANNED` (per GTM matrix #12) |
| Operator (Mumu)     | direct contact reserved for Ring-1 trusted reviewers                                                                                                         |

---

## Update protocol

Re-refresh this routing doc when:

- A new top-level doc lands in `docs/` that a reviewer class should be routed to.
- A reviewer class is added or removed (e.g., when an INVESTOR_MEMO lands and creates a new investor route).
- A truth label in the at-a-glance table changes (re-verify against `npm test` / coverage / GTM matrix tally).

Update the **Last verified** line and the `main @ <sha>` reference on every refresh.

---

## Related

- [`../README.md`](../README.md) — the comprehensive landing page (longer-form than this doc)
- [`GTM_READINESS_MATRIX.md`](GTM_READINESS_MATRIX.md) — 25-doc minimum-viable GTM pack · control file
- [`THIRD_FACT_CURRENT_STATE_DELTA.md`](THIRD_FACT_CURRENT_STATE_DELTA.md) — doctrine-to-disk classification
- [`AUDIT_2026_05_24_v0_1.md`](AUDIT_2026_05_24_v0_1.md) — most recent measured-grade audit
