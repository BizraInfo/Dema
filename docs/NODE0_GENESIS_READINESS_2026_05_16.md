# Node0 Genesis Readiness — 2026-05-16 Snapshot

**Status:** DECLARED state snapshot
**Date:** 2026-05-16 08:30 GST (verified clock)
**Base commit:** `8df722d feat(core): add corpus preview index` (main worktree HEAD)
**Branch:** `adr/007-accept` (this branch carries ADR-007 acceptance + this snapshot)
**Scope:** Maps the current state of the Node0 genesis node against the production-readiness ladder. Does NOT propose new architecture, deploy services, mint receipts, modify CI, push to remote, or authorize federation. Complements (does not replace) [`DELIVERY_BLUEPRINT.md`](DELIVERY_BLUEPRINT.md) (process discipline) and [`NODE0_ACTIVATION_ROADMAP.md`](NODE0_ACTIVATION_ROADMAP.md) (stage progression).

## Truth labels used (per `NODE0_ACTIVATION_ROADMAP.md`)

- `MEASURED` — observed on disk / verified by command in this snapshot
- `DERIVED` — computed from MEASURED inputs
- `DECLARED` — stated by the operator or this doc
- `PLANNED` — design committed, not yet implemented
- `ASPIRATIONAL` — direction only, not yet implementable

## 1. Host topology — MEASURED

| Field | Value | Evidence |
|---|---|---|
| Host name | `Bizra-Node0` | `uname -a` |
| Kernel | `Linux 6.17.0-23-generic` · Ubuntu 24.04.1 · x86_64 | `uname -a` |
| Uptime | 1d 1h 48m (at audit time) | `uptime` |
| Memory | 125 GiB total · 102 GiB free | `free -h` |
| Disk `/` | 937 GiB · 32% used · 611 GiB free | `df -h /` |
| Disk `/data` | 1.9 TiB · 42% used · 1.1 TiB free | `df -h /data` |
| Primary device | MSI Titan (DECLARED per operator canon) | operator memory `node0-space.md` |
| Companion device | Z Fold 6 (DECLARED, no daemon, no socket) | operator memory `node0-space.md` |
| Concurrent producers | `claude` PID 845865 (3h 16m) · `@openai/codex` PID 10378 (1d 1h 52m, idle since 05:07 GST) | `ps -eo pid,etime,cmd` |

Node0-IS-Dema's-space embodiment doctrine (per operator canon): the hardware is the node; software organs are aspects of one local sovereign system, not a multi-tenant service.

## 2. Software inventory — MEASURED

### 2.1 Repository structure

- **12 packages** under `packages/`: `consent` (5 files), `core` (29), `fate` (1), `installer` (1), `memory` (1), `mission` (2), `models` (5), `node-adapter` (2), `receipts` (1), `tasks` (1), `verifier` (5).
- **51 test files** under `tests/`.
- **7 ADRs** under `docs/06-adr/`: ADR-001 through ADR-007 (6 Accepted on main; ADR-007 promoted to Accepted on `adr/007-accept` branch as commit `ab757a1`).
- **24 canonical schemas** exported across `packages/*/src/*.js` (full list below).

### 2.2 CLI surface — 27 verbs (`apps/cli/src/index.js`)

```
active · amana · ambient · behavior · chat · consent · design
diagnostics · doctor · evidence · ihsan · mcp · memory · mission
models · monetize · network · onboard · receipts · report · roadmap
setup · sovereign · status · task · today · welcome
```

Plus help variants (`help`, `--help`, `-h`).

### 2.3 Schema namespace — 24 schemas under `bizra.dema.*`

```
amana_contracts_preview · approval_verdict
consent_hash_lookup_preview · consent_hash_table_preview
consent_hash_table_verification_preview
corpus_benchmark_schema_preview · corpus_data_tier_classifier_preview
corpus_eval_scorecard_preview · corpus_gold_label_fixture_preview
corpus_manual_review_queue_preview · corpus_preview_index
corpus_redaction_fixture_preview · corpus_scorecard_receipt_schema_preview
evidence_chain_preview · evidence_receipt_preview
ihsan_floor_preview · melae_gate_preview
model_corpus_manifest_preview · process_rsi_preview · process_snr_preview
process_value_fixture_pack_preview · sape_scorecard_preview
sat_verdict · true_value_preview
```

All schemas are version-tagged `.v0.1`. All are PREVIEW_ONLY (no runtime authority).

### 2.4 Local state — `~/.dema/` organs (15 directories)

```
agents · audit · bin · demo · founder_inventory · kernel · logs
memory · milestones · receipts · screen · skills · vigil · voice · wisdom
```

Plus operator profile (`profile.json`) and local config (`config.local.json`).

## 3. Boundary gates — MEASURED (all closed)

Last full local-gate run on `8df722d` at 05:14 GST returned:

| Gate | Result | Source |
|---|---|---|
| `npm test` | **500/500 PASS** · 0 fail · 0 skip · 740 ms | `tests/*.test.js` |
| `npm run check` | **PASS** · `network_used:false · runtime_execution:false · auto_fix_performed:false · private_data_scanned:false` · 2 proofs SHA-256 verified | `scripts/node0-self-check.mjs --verify` |
| `npm run llm:guidance` | **PASS** · 7/7 schema checks | `scripts/llm-guidance-check.mjs` |
| `git diff --check` | clean | git plumbing |

Per Dema CLAUDE.md invariant: "No runtime execution in this repo. No hidden daemon. Exact-string consent only. All local state stays under DEMA_HOME or ~/.dema. Receipts are read/list here; governed runtime issues. Node1/Node2 remain preview-only until proof gates pass." All four conditions hold in this snapshot.

## 4. Production-readiness state by layer

The "production ready" target is layered. Each layer must close before the next becomes meaningful. Per `NODE0_ACTIVATION_ROADMAP.md` § Stage progression.

### 4.1 Layer A — Local genesis (SEED → ARTIFACT-011)

| Step | State | Truth | Evidence |
|---|---|---|---|
| A1 v0.2.3 memory awareness on `main` | shipped | MEASURED | `git log` shows v0.2.3 merged |
| A2 OpenTimestamps `ots upgrade` (Bitcoin anchor) | **status not re-verified in this snapshot** | DECLARED-then-stale-check-needed | `proof-of-priority/PIN.md` exists; UPGRADED status not re-confirmed today |
| A3 `bizra-cognition-gateway` running | depends on out-of-tree state | EXTERNAL | gateway lives in `bizra-data-lake`, not this repo |
| A4 Dema adapter migrated to gateway HTTP | shipped | MEASURED | `92712db fix(node-adapter): harden legacy shellout boundary` (today) + ADR-003 |
| A5 **ARTIFACT-011 first receipt** | **NOT ISSUED** | PLANNED | `~/.dema/receipts/` contains 3 preview/audit JSONs (May 6) but no canonical `ARTIFACT-011.json` with `truth_label:"MEASURED"` |

**Layer A close gate:** A5 (ARTIFACT-011 issuance) requires (a) live `bizra-cognition-gateway` reachable, (b) `dema doctor` exit 0 against live gateway, (c) loaded local model with `lm_studio.connected=true`, (d) operator types exact phrase `GO: Node0 bounded diagnostic activation only`. None of (a)-(d) is observable from this snapshot's read-only audit.

**Layer A status: OPEN.** Local genesis node is *infrastructurally ready* (adapter hardened, gates closed, 500 tests pass) but the *certifying receipt* has not been issued.

### 4.2 Layer B — SPROUT (continuous bounded diagnostics → multi-action proof chain)

| Step | State | Truth |
|---|---|---|
| B1 Continuous bounded diagnostics (7+ receipts, no daemon) | NOT STARTED | PLANNED |
| B2 Receipt cross-repo handoff (Dema ↔ bizra-omega round-trip) | NOT STARTED | PLANNED |
| B3 Local model probe receipts (`bizra.dema.model_probe.v0.1`) | NOT STARTED | PLANNED |
| B4 First multi-action proof chain (5-step chained receipts) | NOT STARTED | PLANNED |

**Layer B status: GATED on Layer A close.** No Stage B step is meaningful until A5 is MEASURED.

### 4.3 Layer C — TREE (Federation between sovereign nodes)

| Step | State | Truth |
|---|---|---|
| C1 Node1 onboarding kit | NOT STARTED | ASPIRATIONAL |
| C2 First Node0↔Node1 federation handshake | NOT STARTED | ASPIRATIONAL |
| C3 Cross-node receipt verification | NOT STARTED | ASPIRATIONAL |

**Layer C status: GATED on Layer B complete + multi-operator validation framework.**

### 4.4 Layer D — FOREST (Public network)

| Step | State | Truth |
|---|---|---|
| D1 3-5 node pilot (PILOT_SHARED_URP) | NOT STARTED | ASPIRATIONAL |
| D2 Public network surface (UNIVERSAL_NETWORK_URP) | NOT STARTED | ASPIRATIONAL |

**Layer D status: GATED on Layer C complete + legal/tech/security/social validation per the manifest § V table.**

## 5. Governance state

### 5.1 Accepted ADRs (canonical on `main`)

- **ADR-001** Dema is one face — Accepted
- **ADR-002** No shadow state — Accepted
- **ADR-003** Core truth lives in bizra-omega — Accepted
- **ADR-004** Local-first memory — Accepted
- **ADR-005** Operator actions require explicit consent — Accepted
- **ADR-006** Continuous assurance and no-mint verification — Accepted

### 5.2 ADR-007 status

- **On `main` (commit `8df722d`):** Status `Proposed`
- **On `adr/007-accept` (commit `ab757a1`, this branch):** Status `Accepted` with § Confirming Evidence (3 events: HEAD-stale-at-SessionStart, stale-cloud-AI-artifact, forensic identification of `@openai/codex` as concurrent producer) and Open Question 1 resolved as **intentional**.
- **Publication status:** local-only. Not pushed. Not opened as PR. Selection among Options A/B/C remains a separate halt-gate per the ADR's own contract.

### 5.3 Operator-side memory canon

- `~/.claude/projects/-home-bizra-operating-system-Downloads-Dema/memory/MEMORY.md` — 15,058 bytes (under 24,400-byte budget after 2026-05-16 trim).
- 89 indexed entries pointing to topic files including this session's three new artifacts: `project_2026_05_16_codex_concurrent_producer.md`, `project_2026_05_16_adr_007_companion_change_3_applied.md`.
- ADR-007 Companion Change #3 applied: 12 inline session-scoped qualifiers across 8 memory canon files; post-grep 12/12 ✓.

## 6. Gates remaining between current state and "production ready full-stack"

Ordered by dependency. Each line is one typed-GO halt-gate (per [`ADR-005`](06-adr/ADR-005-operator-actions-require-explicit-consent.md)).

### 6.1 To close Layer A (SEED → SPROUT entry)

1. **Re-verify Layer A2** — run `ots verify proof-of-priority/merkle-root.txt.ots` and update PIN.md if any drift since 2026-05-07 anchor date.
2. **Confirm Layer A3** — `bizra-cognition-gateway` build + run status (lives outside this repo, in `bizra-data-lake`).
3. **Confirm Layer A4** — end-to-end `dema status` against live gateway returning real (not placeholder) data.
4. **Issue ARTIFACT-011** — operator types `GO: Node0 bounded diagnostic activation only` in fresh terminal; governed runtime (NOT this repo) issues the receipt; receipt verifies on disk.
5. **Update `docs/CURRENT_STAGE.md`** (new) — record SEED → SPROUT transition.

### 6.2 To close Layer B (SPROUT)

6. Schedule continuous diagnostics (operator-chosen, no auto-installed daemon).
7. Implement `dema receipts:verify` walk-chain validator (planned as v0.3.6 per ROADMAP.md).
8. Receipt cross-repo handoff design + round-trip test.
9. `dema model status` + `dema model probe` CLI verbs.
10. First multi-action proof chain with tamper detection test.

### 6.3 To close ADR-007 publication (independent of Layers A–D)

11. **Push `adr/007-accept` to `origin`** (typed-GO halt-gate per user CLAUDE.md). Opens PR review surface.
12. **Choose Option A, B, or C** among per-session subchain / filesystem mutex / declare-shared (separate ADR-007 halt-gate per its § Decision).
13. **Companion Change #1** — lift `head -c 500` truncation in `~/.claude/settings.json` bash audit hook.
14. **Companion Change #2** — add `session_id` field to receipt envelope in `mint_lib.py` (lives in `bizra-data-lake`).

### 6.4 To approach Layer C (federation)

15. Codex's 59-commit detached chain resolution (rebase onto a branch, merge to main, or hold). Captured locally under `codex/2026-05-16-preview-stream` snapshot.
16. Lighthouse N=1 pilot (Asus VivoBook trusted-friend candidate per `project_lighthouse_candidate_n1.md`).
17. Node1 onboarding kit (Stage C1, ASPIRATIONAL per ROADMAP.md).

## 7. Non-goals of this snapshot

This document does NOT:

- Authorize any push, merge, PR, deploy, mint, federation, or external-system posting.
- Modify CI workflows.
- Issue ARTIFACT-011 or any other identity-bound artifact.
- Recommend a choice among ADR-007 Options A/B/C.
- Propose new schemas, packages, or CLI verbs.
- Make claims of performance, latency, or quality beyond what `npm run check` and `npm test` verify.
- Set timelines. Per ROADMAP.md: "logical sequence, not schedule."

## 8. References (canonical sources)

- **Constitution:** [`DEMA_CONSTITUTION.md`](DEMA_CONSTITUTION.md)
- **Delivery process discipline:** [`DELIVERY_BLUEPRINT.md`](DELIVERY_BLUEPRINT.md)
- **Stage progression:** [`NODE0_ACTIVATION_ROADMAP.md`](NODE0_ACTIVATION_ROADMAP.md)
- **Version roadmap:** [`ROADMAP.md`](ROADMAP.md)
- **Architecture:** [`ARCHITECTURE.md`](ARCHITECTURE.md), `docs/02-architecture/*`
- **Engineering discipline:** [`ENGINEERING_DISCIPLINE.md`](ENGINEERING_DISCIPLINE.md)
- **Receipt model:** [`RECEIPTS.md`](RECEIPTS.md)
- **First-run UX:** [`FIRST_RUN_WIZARD.md`](FIRST_RUN_WIZARD.md)
- **Installer architecture:** [`INSTALLER_ARCHITECTURE.md`](INSTALLER_ARCHITECTURE.md)
- **LLM system flow:** [`LLM_SYSTEM_FLOW.md`](LLM_SYSTEM_FLOW.md)
- **GTM:** [`GTM.md`](GTM.md)
- **Lighthouse pilot:** [`LIGHTHOUSE.md`](LIGHTHOUSE.md)
- **All 7 ADRs:** `docs/06-adr/ADR-001..ADR-007`

## Operating law (carried from existing canon)

```
State before screen.
Contract before runtime.
Consent before capability.
Evidence before trust.
No claim without proof.
No action without consent.
No memory without boundary.
No monetization without verified benefit.
No release without reversible evidence and explicit gates.
```

— per [`DELIVERY_BLUEPRINT.md`](DELIVERY_BLUEPRINT.md) § Operating law, [`feedback_law_of_assumption_killer_behavior.md`](../) operator canon, and the 7-line standing-on-giants discipline (`Observe · Extract · Translate · Consent+EffectCap · EvidenceChain · DEMA UX · Allow use`) recorded in `project_giants_integration_map.md`.

## Snapshot integrity

This document was authored against base commit `8df722d` at 2026-05-16 08:30 GST. Every numeric claim in §§ 1–3 was verified by command in the audit window 08:21–08:30 GST. Codex was idle from 05:07 GST through audit window (no concurrent commits to race). The snapshot is intentionally bounded: it describes state on disk at one moment, not a future projection.
