# NODE0-FIRST-LIGHT-0A — FROM CONSENT TO PROOF

**Status:** MEASURED_LOCAL corridor (local grounded loop) — with repository-wide
coverage gate recorded as **KNOWN_OPEN**.

This document maps the First Light integration corridor (H0–H10) to Dema modules
and commands. Truth labels follow repo canon: `MEASURED` | `WIRED_PARTIAL` |
`ABSENT` | `SEED` | `KNOWN_OPEN`.

### Coverage known-open (do not smooth)

`npm run check` remains red because the repository-wide native coverage thresholds
are already unmet on clean main. First Light improves aggregate line coverage from
91.49% to 93.00% but does not close the inherited 95% line and 84% branch
thresholds. Coverage rescue is a separate bounded mission
(`REPOSITORY-COVERAGE-TRUTH-AND-RESCUE-1A`).

| Tree | Lines | Branches |
|------|------:|---------:|
| Clean main `72ef164` | 91.49% | 78.33% |
| First Light candidate | 93.00% | 77.80% |
| Threshold | 95% | 84% |

Do **not** label: `full check: PASS` · `coverage: CLOSED` · `release ready: true`.

---

## Mission

**NODE0-FIRST-LIGHT-0A — FROM CONSENT TO PROOF**

The first usable Node0 must perform this complete journey (read-only scope; no move,
rename, delete, or external publication):

```text
Start Node0
→ open DEMA locally
→ choose one BIZRA research folder
→ show the exact read-only scope
→ receive one consent
→ inventory and index the files
→ ask a real question
→ retrieve relevant sources
→ run the local model
→ produce a grounded answer
→ seal a SHA-bound receipt
→ render one truthful DEMA Proof Card
→ survive restart
```

---

## Corridor map (H0–H10)

| Step | Corridor intent | Existing modules / commands | Truth label | Notes |
|------|-----------------|----------------------------|-------------|-------|
| **H0** | Preserve current local state | Main repo git snapshot → `/data/bizra/tmp/node0-first-light-0a/H0-state.txt` | **MEASURED** | H0 complete 2026-07-30; main repo dirty (102 entries), parked work preserved |
| **H1** | Clean integration worktree | `feat/node0-first-light-0a` @ `origin/main` → `/data/bizra/worktrees/node0-first-light-0a/Dema` | **MEASURED** | HEAD `72ef164f7c90351c781b01be085bc7e62bffe914`; porcelain clean |
| **H2** | Reuse DEMA admission + exact-consent route | `packages/core/src/first-encounter-admission.js` · `first-encounter-scan.js` · `packages/consent/src/root-bound-consent-envelope-preview.js` · `dema consent plan` · `node0-consented-inventory-gatherer-preview.js` · `NODE0-CONSENTED-INVENTORY-GATHERER-PREVIEW-1A` | **WIRED_PARTIAL** | Admission kernel MEASURED; root-bound consent envelope MEASURED preview; inventory gatherer MEASURED preview; **not joined** as one folder-pick → scope → consent flow |
| **H3** | Reuse retrieval / model / receipt loop | `dema talk` (+ `--consent`, `--receipt`) · `packages/core/src/local-model-adapter-preview.js` · `materialization-pulse-receipt-schema-preview.js` · `node0-materialization-pulse-e2e-preview.js` · `dema mission run <file>` | **WIRED_PARTIAL** | Talk live invoke MEASURED; talk-runtime receipt MEASURED; materialization pulse E2E MEASURED preview; **no estate-scoped RAG** over a chosen folder |
| **H4** | Define one canonical truth envelope | `materialization-pulse-receipt-schema-preview.js` · `proof-passport.js` · `packages/receipts/` canonical schemas | **SEED** | Pulse receipt + proof passport MEASURED previews; **First Light envelope** (mission_id, scope, consent_receipt, source_hashes, retrieval_hash, prompt_hash, raw_response_hash, answer_hash, receipt_id, observed_at, verification_state) **not yet defined** |
| **H5** | Connect receipt read-back to DEMA | `dema mission shelf` · `dema mission review` · `dema mission compact` · `dema receipts` · `authorship-verify-latest.js` · `proof-passport-verify.js` | **WIRED_PARTIAL** | Shelf/review/verify MEASURED for mission-pulse receipts; **no read-back path** for First Light truth envelope |
| **H6** | Render one receipt-derived Proof Card | `node0-mission-pilot-cockpit-preview.js` · `dema mission cockpit` · `dema-first-light-front-door-preview.js` · `proof-passport.js` formatters | **WIRED_PARTIAL** | Mission cockpit MEASURED (emission-derived); front-door MEASURED **static preview** — not receipt-bound; Proof Card for First Light envelope **ABSENT** |
| **H7** | Persist mission + index across restart | `$DEMA_HOME` / `~/.dema` layout · `dema setup` · `node0-space-index.js` · `node0-library-census.js` · `dema mission corridor` journal | **WIRED_PARTIAL** | DEMA_HOME persistence MEASURED; space-index + library census MEASURED (metadata); corridor MEASURED; **First Light mission_id + folder index continuity ABSENT** |
| **H8** | Package one local start command | `dema welcome` · `dema onboard` · `dema setup` · `dema status` | **ABSENT** | Golden-path CLI MEASURED individually; **`bizra start` / `dema first-light` one-button wake ABSENT** |
| **H9** | Run one real founder mission | `dema founder impact` loop · `node0-founder-impact-loop-preview.js` · `dema mission emit` / `cockpit` patterns | **WIRED_PARTIAL** | Founder-impact loop MEASURED CANDIDATE; useful as **pattern reuse**, not the First Light folder Q&A journey |
| **H10** | Seal First Light | (none yet) | **ABSENT** | Completion seal / First Light receipt / promotion gate **not implemented** |

---

## Explicit reuse list

These shipped organs are **in scope for wiring** (not rebuild):

| Capability | Primary paths / commands | Label |
|------------|-------------------------|-------|
| Corpus sanitize (Layer −1) | `dema corpus sanitize --file <abs>` · `untrusted-corpus-sanitizer-preview.js` | MEASURED |
| Mission pulse / run / emit / cockpit | `dema mission pulse\|run\|emit\|cockpit` · harness → pulse → emission → cockpit kernels | MEASURED |
| Mission shelf / review / compact | `dema mission shelf\|review\|compact` · URP shelf index + compaction kernels | MEASURED |
| Talk live + receipt | `dema talk --consent … [--receipt]` · talk loop + runtime receipt CLI | WIRED_PARTIAL |
| First Light front door | `apps/front-door/index.html` · `dema-first-light-front-door-preview.js` | MEASURED (preview) |
| DEMA_HOME persistence | `dema setup` · ADR-004 · `$DEMA_HOME/mission/receipts`, `artifacts/proofs/…` | MEASURED |
| Founder-impact loop (pattern) | `dema founder impact scope\|run\|verify` · sanitizer + digest + claim-gate composition | MEASURED (candidate) |
| Admission + consent binding | `first-encounter-admission.js` · root-bound consent envelope · exact-string consent ADR-005 | WIRED_PARTIAL |
| Inventory / census (metadata) | `node0-consented-inventory-gatherer` · `node0-space-index` · `node0-library-census` | MEASURED (partial) |

---

## Explicit NON-goals (this corridor)

Do **not** expand scope into:

- **PR #440–#444** — authorship rotate, scanner, linker, boundary refinement (parked)
- **PSMP v1.0-rc2** — no spec expansion during First Light integration
- **Steward / Bus / ActOS** — C16/C17/C19 deferred; not required for read-only First Light
- **Federation / mint / Node1 / Node2** — frozen per repo invariants
- **Metal Seed / Wasm realm** — deferred architecture
- **New review gates** unless they directly block the join
- **File mutation** — no rename, delete, move, or publish in First Light v0

---

## Definition of done — First Light (10-step operator journey)

Node0 First Light is **done** when the operator can run **one start command** (name TBD)
and complete all ten steps **without carrying messages between agents**:

1. DEMA opens locally (CLI and/or front-door surface).
2. Operator selects **one absolute folder** (BIZRA research root).
3. Node0 displays the **exact read-only scope** (paths, counts, sensitivity hints).
4. Operator grants **one exact consent** (root-bound, single-use).
5. Node0 **scans and indexes** metadata under `$DEMA_HOME/first-light/<mission_id>/`.
6. Operator asks **one question** in normal language.
7. Node0 answers from **indexed sources** with path/hash citations.
8. A **receipt** binds question, retrieval, model output, answer, and source hashes.
9. A **Proof Card** renders **only** what the truth envelope verifies.
10. After process kill / reboot, **same `mission_id`**, receipt, and index reload.

**Evidence gate:** operator runs the journey once on real BIZRA corpus; receipt verifies;
Proof Card matches envelope; restart preserves state; no scope violation.

**North-star metric:** minutes of founder burden removed — not test count or PR count.

---

## Local proof evidence (MEASURED_LOCAL)

Live mission (operator machine, not CI):

- `bizra start` → consent card → exact phrase → localhost model → receipt → Proof Card
- Fresh-process `--resume` → `RESUMED_VERIFIED` / `VERIFIED_LOCAL`
- Example mission_id: `first-light-c8c6f0c5c27b6bc06a2d`
- Entrypoint: `bin/bizra` · kernels: `packages/core/src/node0-first-light.js` ·
  CLI: `apps/cli/src/bizra.js` + `apps/cli/src/commands/first-light*.js`

Next bounded mission after this commit: **repository-wide coverage truth-and-rescue**
(not First Light scope expansion; not website/DNS; not PR #440–#444).

---

## Corridor discipline

```text
No architecture expansion during H0–H10.
Integration joins existing MEASURED organs.
Every step ships with verify + honest boundary labels.
DEMA displays only what the truth graph supports.
```

---

## References

- `docs/LLM_SYSTEM_FLOW.md` — safe local lifecycle, invariants
- `docs/02-architecture/DEMA_FIRST_LIGHT_GUI_FRONT_DOOR_PREVIEW_v0_1.md`
- `docs/02-architecture/UNTRUSTED_CORPUS_SANITIZER_PREVIEW_v0_1.md`
- `docs/02-architecture/NODE0_LOCAL_MISSION_HARNESS_PREVIEW_v0_1.md`
- `docs/02-architecture/NODE0_MISSION_PILOT_COCKPIT_PREVIEW_v0_1.md`
- `docs/CURRENT_LIMITS.md` — disk-truth labels
